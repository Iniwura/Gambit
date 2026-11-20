import {ZamaSDK} from '@zama-fhe/sdk';
import {createConfig} from '@zama-fhe/sdk/ethers';
import {web} from '@zama-fhe/sdk/web';
import {sepolia} from '@zama-fhe/sdk/chains';
import {BrowserProvider,Contract,getAddress,keccak256,ZeroAddress} from 'ethers';
import {encodeSquadInputs,decodePackedSquadScore,canOpenSquad,squadDuelStep,validateSquadStatus} from './squad-lifecycle.mjs';

/**
 * Versioned experimental v2 wallet client for deployed SquadGambit; live encrypted match is NOT VERIFIED.
 *
 * Security gates BEFORE any user action:
 *  - exactly Sepolia chain 11155111
 *  - exact configured candidate address (never old SealedGambit)
 *  - immutable runtime code hash from independently verified deployment
 *  - selected wallet address pinned and revalidated before every signature
 *  - explicit user interaction needed for each state-changing method
 *  - re-read contract state after mining and verify canonical events
 *  - accept signed KMS output only after successful onchain finalizeDuel
 *
 * Importing this module does not connect, send transactions or deploy.
 */
type WalletProvider={request:(args:{method:string,params?:unknown[]})=>Promise<unknown>};
export type FighterPlan={base:0|1|2,trigger:0|1|2,response:0|1|2};
export type SquadResult={
  squadId:bigint;duelId:bigint;pointsChallenger:number;pointsDefender:number;
  outcome:0|1|2;authenticated:true;evidence:'contract-state'|'transaction';
  explorerUrl:string;resolutionTx:string;finalizationTx:string;
};
const CHAIN_ID=11155111n;
const LEGACY=getAddress('0x12adc9f3860FB20E9655197386CDFc1DD78FF0c0');
const CODE_HASH=/^0x[a-fA-F0-9]{64}$/;
const abi=[
  'function sealSquad(address allowedOpponent,bytes32[10] encryptedPlans,bytes inputProof) returns(uint256 squadId)',
  'function closeSquad(uint256 squadId)',
  'function openDuel(uint256 squadId) returns(uint256 duelId)',
  'function submitDuel(uint256 duelId,bytes32[10] encryptedPlans,bytes inputProof)',
  'function resolveDuel(uint256 duelId)',
  'function finalizeDuel(uint256 duelId,uint8 packedScore,bytes proof)',
  'function expireUnsubmitted(uint256 duelId)',
  'function squadStatus(uint256 id) view returns(address owner,address allowedOpponent,bool active,bool claimed)',
  'function duelForSquad(uint256 id) view returns(uint256)',
  'function duelStatus(uint256 id) view returns(uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
  'function publicResultHandle(uint256 duelId) view returns(bytes32)',
  'event SquadSealed(uint256 indexed squadId,address indexed owner,address indexed allowedOpponent)',
  'event DuelOpened(uint256 indexed duelId,uint256 indexed squadId,address indexed challenger)',
  'event DuelSubmitted(uint256 indexed duelId)',
  'event DuelReady(uint256 indexed duelId,bytes32 resultHandle)',
  'event DuelFinalized(uint256 indexed duelId,uint8 pointsChallenger,uint8 pointsDefender,uint8 outcome)'
];

export async function createSquadSepoliaClient(
  targetAddress:string,
  expectedRuntimeHash:string,
  wallet?:WalletProvider
){
  if(!CODE_HASH.test(expectedRuntimeHash))
    throw Error('Missing verified deployed SquadGambit runtime fingerprint.');
  const contractAddress=getAddress(targetAddress);
  if(contractAddress===LEGACY||contractAddress===ZeroAddress)
    throw Error('Refusing legacy or empty address for encrypted squad v2.');
  const ethereum=wallet??(window as unknown as {ethereum?:WalletProvider}).ethereum;
  if(!ethereum)throw Error('A browser Ethereum wallet is required.');
  const eth:WalletProvider=ethereum;
  const chainRaw=await eth.request({method:'eth_chainId'});
  if(typeof chainRaw!=='string'||BigInt(chainRaw)!==CHAIN_ID)
    throw Error('Switch your wallet to Ethereum Sepolia (11155111).');
  const rawAccounts=await eth.request({method:'eth_requestAccounts'});
  if(!Array.isArray(rawAccounts)||typeof rawAccounts[0]!=='string')
    throw Error('Wallet connection cancelled.');
  const userAddress=getAddress(rawAccounts[0]);
  const provider=new BrowserProvider(eth as any);
  const network=await provider.getNetwork();
  if(network.chainId!==CHAIN_ID)throw Error('Wrong wallet network.');
  const code=await provider.getCode(contractAddress);
  if(code==='0x'||keccak256(code).toLowerCase()!==expectedRuntimeHash.toLowerCase())
    throw Error('SquadGambit runtime fingerprint mismatch. No writes permitted.');
  const signer=await provider.getSigner();
  if(getAddress(await signer.getAddress())!==userAddress)
    throw Error('Wallet signer and selected account disagree.');
  const contract=new Contract(contractAddress,abi,signer);
  const sdk=new ZamaSDK(createConfig({
    chains:[sepolia],ethereum:eth as any,relayers:{[sepolia.id]:web()}
  }));

  async function assertWalletStable(){
    const id=await eth.request({method:'eth_chainId'});
    if(typeof id!=='string'||BigInt(id)!==CHAIN_ID)
      throw Error('Wallet network switched. Reconnect on Sepolia.');
    const accounts=await eth.request({method:'eth_accounts'});
    if(!Array.isArray(accounts)||typeof accounts[0]!=='string'
      ||getAddress(accounts[0])!==userAddress)
      throw Error('Selected wallet account changed. Reconnect.');
  }
  async function txSucceeded(submit:()=>Promise<any>){
    // A pending Promise would initiate eth_sendTransaction BEFORE this guard.
    // Pass a deferred submitter so wallet identity is checked immediately
    // before the provider can display a signing prompt.
    await assertWalletStable();
    const transaction=await submit();
    const receipt=await transaction.wait(1);
    if(!receipt||Number(receipt.status)!==1)throw Error('Sepolia transaction did not succeed.');
    return {hash:transaction.hash as string,receipt};
  }
  function eventIn(receipt:any,name:string){
    for(const log of receipt.logs){
      if(getAddress(log.address)!==contractAddress)continue;
      try{const parsed=contract.interface.parseLog(log);
        if(parsed?.name===name)return parsed;
      }catch{/* ignore unmatched event signatures */}
    }
    throw Error('Missing signed transaction event '+name);
  }
  async function encryptedSquad(plans:FighterPlan[],formation:number){
    await assertWalletStable();
    const values=encodeSquadInputs(plans,formation)
      .map(value=>({value,type:'euint8' as const}));
    const result=await sdk.encrypt({
      contractAddress:contractAddress as `0x${string}`,
      userAddress:userAddress as `0x${string}`,
      values
    });
    if(result.encryptedValues.length!==10||!result.inputProof||result.inputProof==='0x')
      throw Error('Zama SDK did not return ten encrypted values and input proof.');
    return result;
  }
  async function readSquad(squadId:bigint){
    if(squadId<=0n)throw Error('Squad ID must be positive.');
    await assertWalletStable();
    const s=await contract.squadStatus(squadId);
    const status={owner:getAddress(s.owner),allowedOpponent:getAddress(s.allowedOpponent),
      active:Boolean(s.active),claimed:Boolean(s.claimed)};
    validateSquadStatus(status);
    return status;
  }
  async function readDuel(duelId:bigint){
    if(duelId<=0n)throw Error('Duel ID must be positive.');
    await assertWalletStable();
    const d=await contract.duelStatus(duelId);
    return {squadId:BigInt(d.squadId),challenger:String(d.challenger),
      submitted:Boolean(d.submitted),resolved:Boolean(d.resolved),
      finalized:Boolean(d.finalized),expired:Boolean(d.expired),
      packedScore:BigInt(d.packedScore),openedAt:BigInt(d.openedAt)};
  }
  async function nextDuelStep(duelId:bigint){
    const duel=await readDuel(duelId);
    const latest=await provider.getBlock('latest');
    if(!latest)throw Error('Unable to read confirmed Sepolia block timestamp.');
    return {duel,step:squadDuelStep(duel,userAddress,BigInt(latest.timestamp))};
  }
  async function sealSquad(allowed:string,plans:FighterPlan[],formation:number){
    await assertWalletStable();
    const allowedOpponent=getAddress(allowed);
    if(allowedOpponent===userAddress||allowedOpponent===ZeroAddress)
      throw Error('Invite a different nonempty challenger wallet.');
    const encrypted=await encryptedSquad(plans,formation);
    await assertWalletStable();
    const tx=await txSucceeded(()=>contract.sealSquad(allowedOpponent,
      encrypted.encryptedValues,encrypted.inputProof));
    const evt=eventIn(tx.receipt,'SquadSealed');
    const squadId=BigInt(evt.args.squadId);
    if(getAddress(evt.args.owner)!==userAddress||
       getAddress(evt.args.allowedOpponent)!==allowedOpponent)
      throw Error('Unexpected onchain squad invite event.');
    const state=await readSquad(squadId);
    if(state.owner!==userAddress||state.allowedOpponent!==allowedOpponent||
      !state.active||state.claimed)
      throw Error('Sealed squad state mismatch.');
    return {squadId,transactionHash:tx.hash};
  }
  async function closeSquad(squadId:bigint){
    const state=await readSquad(squadId);
    if(state.owner!==userAddress||!state.active||state.claimed)
      throw Error('Only the owner may close an unused active squad.');
    await assertWalletStable();
    const tx=await txSucceeded(()=>contract.closeSquad(squadId));
    if((await readSquad(squadId)).active)throw Error('Squad was not closed onchain.');
    return {transactionHash:tx.hash};
  }
  async function openDuel(squadId:bigint){
    const squad=await readSquad(squadId);
    if(!canOpenSquad(squad,userAddress))
      throw Error('This squad is not available to the invited challenger.');
    await assertWalletStable();
    const tx=await txSucceeded(()=>contract.openDuel(squadId));
    const evt=eventIn(tx.receipt,'DuelOpened');
    const duelId=BigInt(evt.args.duelId);
    if(BigInt(evt.args.squadId)!==squadId||
      getAddress(evt.args.challenger)!==userAddress)
      throw Error('Unexpected challenge identity.');
    const status=await readDuel(duelId);
    if(status.squadId!==squadId||getAddress(status.challenger)!==userAddress
      ||(await contract.duelForSquad(squadId))!==duelId)
      throw Error('Recovered duel identity mismatch.');
    return {duelId,transactionHash:tx.hash};
  }
  async function recoverDuelId(squadId:bigint){
    await readSquad(squadId);
    const duelId=BigInt(await contract.duelForSquad(squadId));
    if(duelId===0n)return null;
    const duel=await readDuel(duelId);
    if(duel.squadId!==squadId)throw Error('Recovery index points to another squad.');
    return duelId;
  }
  async function submitDuel(duelId:bigint,plans:FighterPlan[],formation:number){
    const {step}=await nextDuelStep(duelId);
    if(step!=='submit')throw Error('Duel is not awaiting an invited squad submission.');
    const input=await encryptedSquad(plans,formation);
    if((await nextDuelStep(duelId)).step!=='submit')
      throw Error('Onchain duel changed or expired during encryption.');
    await assertWalletStable();
    const tx=await txSucceeded(()=>contract.submitDuel(duelId,input.encryptedValues,input.inputProof));
    const e=eventIn(tx.receipt,'DuelSubmitted');
    if(BigInt(e.args.duelId)!==duelId)throw Error('Submission event ID mismatch.');
    const d=await readDuel(duelId);
    if(!d.submitted||d.expired||d.finalized)throw Error('Submission state mismatch.');
    return {transactionHash:tx.hash};
  }
  async function verifiedResult(duelId:bigint):Promise<SquadResult>{
    const d=await readDuel(duelId);
    if(squadDuelStep(d,userAddress)!=='verified')
      throw Error('No independently finalized onchain score exists.');
    const score=decodePackedSquadScore(d.packedScore);
    return {squadId:d.squadId,duelId,
      pointsChallenger:score.challenger,pointsDefender:score.defender,
      outcome:score.outcome as 0|1|2,authenticated:true,
      evidence:'contract-state',explorerUrl:'https://sepolia.etherscan.io/address/'+contractAddress,
      resolutionTx:'',finalizationTx:''};
  }
  /**
   * Exactly ONE authorized resolution transaction per call. Finalization is
   * deliberately a different user action, with a different wallet signature.
   */
  async function resolveDuel(duelId:bigint){
    const {step}=await nextDuelStep(duelId);
    if(step!=='resolve')throw Error('Duel is not awaiting encrypted resolution.');
    await assertWalletStable();
    const tx=await txSucceeded(()=>contract.resolveDuel(duelId));
    const evt=eventIn(tx.receipt,'DuelReady');
    if(BigInt(evt.args.duelId)!==duelId)
      throw Error('Resolution event references another duel.');
    const handle=evt.args.resultHandle as string;
    if(!/^0x[a-fA-F0-9]{64}$/.test(handle))
      throw Error('Invalid encrypted result handle.');
    const onchain=await contract.publicResultHandle(duelId) as string;
    if(onchain.toLowerCase()!==handle.toLowerCase())
      throw Error('Resolution event and canonical contract handle disagree.');
    const after=await nextDuelStep(duelId);
    if(after.step!=='finalize'||!after.duel.resolved)
      throw Error('Confirmed resolution is not finalizable onchain.');
    return {transactionHash:tx.hash,resultHandle:handle};
  }

  /**
   * Exactly ONE finalization transaction per call. KMS public decryption
   * occurs before signing. Never implicitly resolve or retransmit a duel.
   */
  async function finalizeDuel(duelId:bigint):Promise<SquadResult>{
    const {duel,step}=await nextDuelStep(duelId);
    if(step==='verified')return verifiedResult(duelId);
    if(step!=='finalize'||!duel.resolved||duel.finalized)
      throw Error('Resolve the duel first; finalization is a separate transaction.');
    const handle=await contract.publicResultHandle(duelId) as `0x${string}`;
    if(!/^0x[a-fA-F0-9]{64}$/.test(handle))
      throw Error('Invalid encrypted result handle.');
    const proof=await sdk.decryption.decryptPublicValues([handle as `0x${string}`]);
    const value=proof.clearValues[handle];
    const parsed=decodePackedSquadScore(value);
    if(!proof.decryptionProof||proof.decryptionProof==='0x')
      throw Error('Signed Zama KMS decryption proof missing.');
    if((await nextDuelStep(duelId)).step==='verified')
      return verifiedResult(duelId);
    if((await nextDuelStep(duelId)).step!=='finalize')
      throw Error('Duel changed during KMS decryption; refusing to finalize.');
    await assertWalletStable();
    const tx=await txSucceeded(()=>contract.finalizeDuel(duelId,parsed.packed,proof.decryptionProof));
    const evt=eventIn(tx.receipt,'DuelFinalized');
    if(BigInt(evt.args.duelId)!==duelId||
       Number(evt.args.pointsChallenger)!==parsed.challenger||
       Number(evt.args.pointsDefender)!==parsed.defender||
       Number(evt.args.outcome)!==parsed.outcome)
      throw Error('Onchain finalization event disagrees with authenticated FHE score.');
    const after=await readDuel(duelId);
    if(!after.finalized||after.squadId!==duel.squadId||
       Number(after.packedScore)!==parsed.packed)
      throw Error('Finalized onchain score disagrees with signed KMS proof.');
    return {squadId:duel.squadId,duelId,
      pointsChallenger:parsed.challenger,pointsDefender:parsed.defender,
      outcome:parsed.outcome as 0|1|2,authenticated:true,evidence:'transaction',
      explorerUrl:'https://sepolia.etherscan.io/tx/'+tx.hash,
      resolutionTx:'',finalizationTx:tx.hash};
  }
  return {contractAddress,userAddress,
    readSquad,readDuel,nextDuelStep,sealSquad,closeSquad,
    openDuel,recoverDuelId,submitDuel,verifiedResult,resolveDuel,finalizeDuel};
}
