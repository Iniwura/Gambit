import {ZamaSDK} from '@zama-fhe/sdk';
import {createConfig} from '@zama-fhe/sdk/ethers';
import {web} from '@zama-fhe/sdk/web';
import {sepolia} from '@zama-fhe/sdk/chains';
import {BrowserProvider,Contract,getAddress} from 'ethers';

const CHAIN_ID=11155111n;
export const SEPOLIA_ID=11155111;

export type Plan={base:0|1|2,trigger:0|1|2,response:0|1|2};
export type MatchReceipt={
  challengeId:bigint;
  outcome:0|1|2;
  resolutionTx:string;
  finalizationTx:string;
  explorerUrl:string;
  authenticated:true;
};

const ABI=[
 'function seal(bytes32,bytes32,bytes32,bytes) returns (uint256)',
 'function openChallenge(uint256 policyId) returns (uint256)',
 'function submit(uint256 id,bytes32,bytes32,bytes32,bytes)',
 'function resolve(uint256 id)',
 'function finalize(uint256 id,uint8 outcome,bytes decryptionProof)',
 'function policyStatus(uint256 id) view returns (address owner,bool active,uint32 completions)',
 'function challengeStatus(uint256 id) view returns (uint256 policyId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 finalOutcome)',
 'function publicResultHandle(uint256 id) view returns (bytes32)',
 'event PolicySealed(uint256 indexed policyId,address indexed owner)',
 'event ChallengeOpened(uint256 indexed challengeId,uint256 indexed policyId,address indexed challenger)',
 'event ChallengeReady(uint256 indexed challengeId,bytes32 resultHandle)',
 'event ChallengeFinalized(uint256 indexed challengeId,uint8 outcome)'
];

type WalletProvider={request:(args:{method:string,params?:unknown[]})=>Promise<unknown>};
function requireWallet():WalletProvider{
  const candidate=(window as unknown as {ethereum?:WalletProvider}).ethereum;
  if(!candidate)throw Error('Install or enable an Ethereum wallet to enter Sepolia challenge mode.');
  return candidate;
}
export function assertPlan(plan:Plan){
  for(const k of ['base','trigger','response'] as const){
    if(!Number.isInteger(plan[k])||plan[k]<0||plan[k]>2)throw Error('Invalid strategy action');
  }
}

export async function createGambitSepoliaClient(rawAddress:string){
  const address=getAddress(rawAddress);
  const ethereum=requireWallet();
  const ethAccounts=await ethereum.request({method:'eth_requestAccounts'});
  if(!Array.isArray(ethAccounts)||!ethAccounts[0])throw Error('Wallet connection was cancelled.');
  const browserProvider=new BrowserProvider(ethereum);
  const network=await browserProvider.getNetwork();
  if(network.chainId!==CHAIN_ID){
    throw Error('GAMBIT requires Ethereum Sepolia. Please switch your wallet and reconnect.');
  }
  const signer=await browserProvider.getSigner();
  const userAddress=getAddress(await signer.getAddress());
  const config=createConfig({
    chains:[sepolia],
    // The injected provider's event signatures differ between wallet libraries.
    // EIP-1193 request support is checked above; runtime wallet events are used
    // only by Zama's adapter, whose exact type is defined in its own package.
    ethereum:ethereum as any,
    relayers:{[sepolia.id]:web()}
  });
  const sdk=new ZamaSDK(config);
  const contract=new Contract(address,ABI,signer);

  async function encryptedPlan(plan:Plan){
    assertPlan(plan);
    const encrypted=await sdk.encrypt({
      contractAddress:address as `0x${string}`,
      userAddress:userAddress as `0x${string}`,
      values:[
        {value:BigInt(plan.base),type:'euint8'},
        {value:BigInt(plan.trigger),type:'euint8'},
        {value:BigInt(plan.response),type:'euint8'}
      ]
    });
    if(encrypted.encryptedValues.length!==3)throw Error('Encryption returned wrong number of handles');
    return encrypted;
  }
  async function committedTransaction(txPromise:Promise<unknown>){
    const tx=await txPromise as {hash:string,wait:()=>Promise<{status:number,logs:readonly unknown[]}|null>};
    const receipt=await tx.wait();
    if(!receipt||receipt.status!==1)throw Error('Transaction reverted or not finalized');
    return {hash:tx.hash,receipt};
  }
  function findEvent(logs:readonly unknown[],name:string){
    for(const log of logs){
      try{
        const parsed=contract.interface.parseLog(log as any);
        if(parsed?.name===name)return parsed;
      }catch{/* other contracts/logs are irrelevant */}
    }
    throw Error('Missing expected onchain event: '+name);
  }

  /** The owner submits one encrypted policy, not a public commitment/reveal. */
  async function sealPolicy(plan:Plan){
    const inputs=await encryptedPlan(plan);
    const tx=await committedTransaction(contract.seal(
      ...inputs.encryptedValues,
      inputs.inputProof
    ));
    const event=findEvent(tx.receipt.logs,'PolicySealed');
    const policyId=BigInt(event.args.policyId);
    const state=await contract.policyStatus(policyId);
    if(getAddress(state.owner)!==userAddress||!state.active)throw Error('Policy state mismatch');
    return {policyId,transactionHash:tx.hash};
  }

  /** Challenger creates a match. Defender is NOT required to reconnect. */
  async function openChallenge(policyId:bigint){
    const tx=await committedTransaction(contract.openChallenge(policyId));
    const event=findEvent(tx.receipt.logs,'ChallengeOpened');
    const id=BigInt(event.args.challengeId);
    const state=await contract.challengeStatus(id);
    if(BigInt(state.policyId)!==policyId||getAddress(state.challenger)!==userAddress)
      throw Error('Challenge identity mismatch');
    return {challengeId:id,transactionHash:tx.hash};
  }

  /** Caller must be the challenge's wallet; ciphertext is bound to this contract. */
  async function submitChallenge(challengeId:bigint,plan:Plan){
    const inputs=await encryptedPlan(plan);
    const tx=await committedTransaction(contract.submit(
      challengeId,
      ...inputs.encryptedValues,
      inputs.inputProof
    ));
    const state=await contract.challengeStatus(challengeId);
    if(!state.submitted||state.finalized||state.expired)throw Error('Submitted challenge state mismatch');
    return {transactionHash:tx.hash};
  }

  /**
   * Any wallet may resolve/finalize, but only the SDK's KMS signature can
   * authenticate the public outcome. NEVER animate until status.finalized.
   */
  async function resolveAndFinalize(challengeId:bigint):Promise<MatchReceipt>{
    const before=await contract.challengeStatus(challengeId);
    if(!before.submitted||before.finalized||before.expired)throw Error('Challenge not resolvable');
    // If a previous browser session already resolved, resume from the stored
    // publicly decryptable outcome handle. Don't resubmit a duplicate resolve.
    let handle:`0x${string}`;
    let resolutionTx='';
    if(before.resolved){
      handle=await contract.publicResultHandle(challengeId) as `0x${string}`;
    }else{
      const resolved=await committedTransaction(contract.resolve(challengeId));
      const ready=findEvent(resolved.receipt.logs,'ChallengeReady');
      handle=ready.args.resultHandle as `0x${string}`;
      resolutionTx=resolved.hash;
    }
    const proof=await sdk.decryption.decryptPublicValues([handle]);
    const value=proof.clearValues[handle];
    if(typeof value!=='bigint'&&typeof value!=='number')throw Error('Invalid decrypted result');
    const outcome=Number(value);
    if(!Number.isInteger(outcome)||outcome<0||outcome>2)throw Error('Decryption gave illegal outcome');
    if(!proof.decryptionProof||proof.decryptionProof==='0x')throw Error('Missing KMS proof');
    const finalized=await committedTransaction(contract.finalize(challengeId,outcome,proof.decryptionProof));
    const after=await contract.challengeStatus(challengeId);
    if(!after.finalized||Number(after.finalOutcome)!==outcome)
      throw Error('KMS finalization mismatch');
    return {challengeId,outcome:outcome as 0|1|2,
      resolutionTx,finalizationTx:finalized.hash,
      explorerUrl:'https://sepolia.etherscan.io/tx/'+finalized.hash,
      authenticated:true};
  }

  return {address,userAddress,sealPolicy,openChallenge,submitChallenge,resolveAndFinalize};
}
