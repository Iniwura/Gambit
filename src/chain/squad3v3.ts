import {ZamaSDK} from '@zama-fhe/sdk';
import {createConfig} from '@zama-fhe/sdk/ethers';
import {web} from '@zama-fhe/sdk/web';
import {sepolia} from '@zama-fhe/sdk/chains';
import {BrowserProvider,Contract,getAddress} from 'ethers';

const CHAIN_ID=11155111n;
export type Tactic={base:0|1|2,trigger:0|1|2,response:0|1|2};
export type Squad=[Tactic,Tactic,Tactic];
export type SquadMatchReceipt={
  matchId:bigint;
  outcome:0|1|2;
  resolutionTx:string;
  finalizationTx:string;
  explorerUrl:string;
  authenticated:true;
};

const ABI=[
  'function open(address opponent) returns (uint256)',
  'function commitSquad(uint256 id,bytes32[3] bases,bytes32[3] triggers,bytes32[3] responses,bytes proof)',
  'function resolve(uint256 id)',
  'function finalize(uint256 id,uint8 outcome,bytes decryptionProof)',
  'function status(uint256 id) view returns (address challenger,address opponent,bool challengerCommitted,bool opponentCommitted,bool resolved,bool finalized,bool expired,uint8 publicOutcome)',
  'function outcomeHandle(uint256 id) view returns (bytes32)',
  'event MatchOpened(uint256 indexed id,address indexed challenger,address indexed opponent)',
  'event OutcomeReady(uint256 indexed id,bytes32 encryptedOutcomeHandle)',
];

type WalletProvider={request:(args:{method:string,params?:unknown[]})=>Promise<unknown>};
function requireWallet():WalletProvider{
  const candidate=(window as unknown as {ethereum?:WalletProvider}).ethereum;
  if(!candidate)throw Error('Install or enable an Ethereum wallet to enter Sepolia 3v3 mode.');
  return candidate;
}
function assertTactic(tactic:Tactic){
  for(const key of ['base','trigger','response'] as const){
    const value=tactic[key];
    if(!Number.isInteger(value)||value<0||value>2)throw Error('Invalid squad tactic action');
  }
}
function assertSquad(squad:Squad){squad.forEach(assertTactic);}

export async function createGambit3v3SepoliaClient(rawAddress:string){
  const address=getAddress(rawAddress);
  const ethereum=requireWallet();
  const accounts=await ethereum.request({method:'eth_requestAccounts'});
  if(!Array.isArray(accounts)||!accounts[0])throw Error('Wallet connection was cancelled.');
  const provider=new BrowserProvider(ethereum);
  const network=await provider.getNetwork();
  if(network.chainId!==CHAIN_ID)throw Error('GAMBIT 3v3 requires Ethereum Sepolia (11155111).');
  const signer=await provider.getSigner();
  const userAddress=getAddress(await signer.getAddress());
  const config=createConfig({chains:[sepolia],ethereum:ethereum as any,relayers:{[sepolia.id]:web()}});
  const sdk=new ZamaSDK(config);
  const contract=new Contract(address,ABI,signer);

  async function encryptedSquad(squad:Squad){
    assertSquad(squad);
    const values=squad.flatMap(tactic=>[
      {value:BigInt(tactic.base),type:'euint8' as const},
      {value:BigInt(tactic.trigger),type:'euint8' as const},
      {value:BigInt(tactic.response),type:'euint8' as const},
    ]);
    const encrypted=await sdk.encrypt({contractAddress:address as `0x${string}`,userAddress:userAddress as `0x${string}`,values});
    if(encrypted.encryptedValues.length!==9)throw Error('Encryption returned an incomplete squad plan');
    return encrypted;
  }
  async function committed(txPromise:Promise<unknown>){
    const tx=await txPromise as {hash:string,wait:()=>Promise<{status:number,logs:readonly unknown[]}|null>};
    const receipt=await tx.wait();
    if(!receipt||receipt.status!==1)throw Error('Transaction reverted or not finalized');
    return {hash:tx.hash,receipt};
  }
  function findEvent(logs:readonly unknown[],name:string){
    for(const log of logs){try{const parsed=contract.interface.parseLog(log as any);if(parsed?.name===name)return parsed;}catch{/* unrelated protocol logs */}}
    throw Error('Missing expected onchain event: '+name);
  }

  async function openMatch(opponent:string){
    const other=getAddress(opponent);
    if(other===userAddress)throw Error('Choose a second wallet for the opponent.');
    const tx=await committed(contract.open(other));
    const event=findEvent(tx.receipt.logs,'MatchOpened');
    const matchId=BigInt(event.args.id);
    const state=await contract.status(matchId);
    if(getAddress(state.challenger)!==userAddress||getAddress(state.opponent)!==other)throw Error('3v3 match identity mismatch');
    return {matchId,transactionHash:tx.hash};
  }

  async function commitMatch(matchId:bigint,squad:Squad){
    const encrypted=await encryptedSquad(squad);
    const handles=encrypted.encryptedValues as [string,string,string,string,string,string,string,string,string];
    const tx=await committed(contract.commitSquad(matchId,
      [handles[0],handles[3],handles[6]],[handles[1],handles[4],handles[7]],[handles[2],handles[5],handles[8]],encrypted.inputProof));
    const state=await contract.status(matchId);
    if(!state.challengerCommitted&&!state.opponentCommitted)throw Error('3v3 commitment state mismatch');
    return {transactionHash:tx.hash};
  }

  async function resolveAndFinalize(matchId:bigint):Promise<SquadMatchReceipt>{
    const before=await contract.status(matchId);
    if(!before.challengerCommitted||!before.opponentCommitted||before.finalized||before.expired)throw Error('3v3 match is not resolvable');
    let handle:`0x${string}`; let resolutionTx='';
    if(before.resolved)handle=await contract.outcomeHandle(matchId) as `0x${string}`;
    else{
      const resolved=await committed(contract.resolve(matchId));
      const ready=findEvent(resolved.receipt.logs,'OutcomeReady');
      handle=ready.args.encryptedOutcomeHandle as `0x${string}`;
      resolutionTx=resolved.hash;
    }
    const proof=await sdk.decryption.decryptPublicValues([handle]);
    const raw=proof.clearValues[handle];
    if(typeof raw!=='bigint'&&typeof raw!=='number')throw Error('Invalid decrypted 3v3 result');
    const outcome=Number(raw);
    if(!Number.isInteger(outcome)||outcome<0||outcome>2)throw Error('KMS returned an illegal 3v3 outcome');
    if(!proof.decryptionProof||proof.decryptionProof==='0x')throw Error('Missing KMS decryption proof');
    const finalized=await committed(contract.finalize(matchId,outcome,proof.decryptionProof));
    const after=await contract.status(matchId);
    if(!after.finalized||Number(after.publicOutcome)!==outcome)throw Error('3v3 finalization state mismatch');
    return {matchId,outcome:outcome as 0|1|2,resolutionTx,finalizationTx:finalized.hash,
      explorerUrl:'https://sepolia.etherscan.io/tx/'+finalized.hash,authenticated:true};
  }

  return {address,userAddress,openMatch,commitMatch,resolveAndFinalize};
}
