/**
 * Arena v3 invitation lifecycle — unsigned creation review and canonical
 * receipt recovery for the app-pinned deployment. This module still has no
 * signer, transaction broadcast, URL-derived deployment pin or automatic retry.
 */
import {Interface,getAddress,keccak256,toUtf8Bytes,formatEther} from 'ethers';
import {normalizeArenaV3FeeQuote} from './transaction-intent.mjs';
import {readArenaV3PublicMatch} from './public-match-reader.mjs';

export const ARENA_V3_INVITATION_ABI=Object.freeze([
  'function createMatch(address invitedDefender) returns(uint256 id)',
  'function nextMatchId() view returns(uint256)',
  'event MatchCreated(uint256 indexed matchId,address indexed challenger,address indexed defender)'
]);
const ABI=new Interface(ARENA_V3_INVITATION_ABI);
const HASH=/^0x[0-9a-fA-F]{64}$/;
const ZERO='0x'+'0'.repeat(40);
const fail=(ok,label)=>{if(!ok)throw Error('ARENA_V3_INVITE_INVALID '+label);};
const digest=x=>keccak256(toUtf8Bytes(JSON.stringify(x)));
function address(x){
  let a;
  try{a=getAddress(x);}catch{throw Error('ARENA_V3_INVITE_INVALID address');}
  fail(a.toLowerCase()!==ZERO,'zero address');return a;
}
function hash(x){fail(typeof x==='string'&&HASH.test(x),'hash');return x.toLowerCase();}
function integer(x){
  const n=typeof x==='bigint'?Number(x):x;
  fail(Number.isSafeInteger(n)&&n>=0,'integer');return n;
}
function exact(x,keys,label){
  fail(x&&typeof x==='object'&&!Array.isArray(x)&&
    Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k)),label);
}
function manifest(x){
  fail(x&&x.version===1&&x.contract==='ArenaV3Research'&&x.chainId===11155111,
    'approved manifest required');
  return Object.freeze({chainId:11155111,address:address(x.address),
    runtimeHash:hash(x.runtimeHash),contract:'ArenaV3Research',version:1});
}
function abort(signal){if(signal?.aborted)throw Error('ARENA_V3_INVITE_ABORTED');}
async function checkedBlock(p,n,signal){
  abort(signal);const b=await p.getBlock(n);abort(signal);
  fail(b&&typeof b.hash==='string'&&HASH.test(b.hash)&&
    Number.isSafeInteger(b.timestamp)&&b.timestamp>0,'canonical block');
  return {number:n,hash:hash(b.hash),timestamp:b.timestamp};
}
async function checkRuntime(p,m,n,signal){
  abort(signal);const code=await p.getCode(m.address,n);abort(signal);
  fail(typeof code==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(code)&&
    keccak256(code).toLowerCase()===m.runtimeHash,'runtime mismatch');
}
async function head(p,m,signal){
  abort(signal);const net=await p.getNetwork();abort(signal);
  fail(integer(net.chainId)===m.chainId,'wrong chain');
  const n=integer(await p.getBlockNumber());
  const b=await checkedBlock(p,n,signal);await checkRuntime(p,m,n,signal);
  const raw=await p.call({to:m.address,blockTag:n,data:ABI.encodeFunctionData('nextMatchId')});
  abort(signal);
  const [counter]=ABI.decodeFunctionResult('nextMatchId',raw);
  const again=await checkedBlock(p,n,signal);
  fail(again.hash===b.hash,'block changed during read');
  return {...b,counter:integer(counter)};
}
function createFields(m,b,actor,defender,fee){
  const data=ABI.encodeFunctionData('createMatch',[defender]);
  return {mode:'arena-v3-create-unsigned-research',version:1,
    action:'CREATE_MATCH',chainId:m.chainId,contract:m.address,runtimeHash:m.runtimeHash,
    actor,defender,observedBlock:b.number,observedBlockHash:b.hash,
    observedCounter:b.counter,calldataHash:keccak256(data),fee,
    consentText:'Create ONE match on Sepolia, from '+actor+' to invited defender '+defender+
      '; contract '+m.address+'; maximum EIP-1559 budget '+formatEther(BigInt(fee.maximumTotalFeeWei))+
      ' ETH ('+fee.maximumTotalFeeWei+' wei); transfer 0 ETH. The defender has not accepted yet. '+
      'Match ID comes from the mined receipt, not a predicted counter.'};
}
/** Read-only preparation; manifest must be independently pinned by the app. */
export async function stageArenaV3Create(p,approvedManifest,request,{signal}={}){
  exact(request,['actor','defender','feeQuote'],'exact create request');
  const m=manifest(approvedManifest),actor=address(request.actor),defender=address(request.defender);
  fail(actor!==defender,'self invitation');
  const fee=normalizeArenaV3FeeQuote(request.feeQuote);
  const b=await head(p,m,signal);
  const fields=createFields(m,b,actor,defender,fee);
  return Object.freeze({...fields,id:digest(fields)});
}
/** New read + original block check; does not consume consent or send anything. */
export async function revalidateArenaV3Create(p,approvedManifest,intent,approvedId,{signal}={}){
  const m=manifest(approvedManifest);
  fail(intent&&intent.mode==='arena-v3-create-unsigned-research'&&intent.version===1&&
    intent.action==='CREATE_MATCH','create intent');
  const actor=address(intent.actor),defender=address(intent.defender);
  fail(actor!==defender,'self invitation');
  const fee=normalizeArenaV3FeeQuote(intent.fee);
  const b={number:integer(intent.observedBlock),hash:hash(intent.observedBlockHash),
    counter:integer(intent.observedCounter)};
  const fields=createFields(m,b,actor,defender,fee);
  fail(digest(fields)===intent.id&&approvedId===intent.id&&
    digest(Object.fromEntries(Object.keys(fields).map(k=>[k,intent[k]])))===intent.id,
    'changed intent or missing exact approval');
  const fresh=await head(p,m,signal);
  const old=await checkedBlock(p,b.number,signal);
  fail(old.hash===b.hash&&fresh.number>=b.number&&fresh.counter>=b.counter,
    'stale or reorganized creation state');
  return Object.freeze({mode:'arena-v3-unsigned-transaction-proposal',
    intentId:intent.id,action:'CREATE_MATCH',from:actor,to:m.address,chainId:m.chainId,
    data:ABI.encodeFunctionData('createMatch',[defender]),value:0n,
    gasLimit:BigInt(fee.gasLimit),maxFeePerGas:BigInt(fee.maxFeePerGasWei),
    maxPriorityFeePerGas:BigInt(fee.maxPriorityFeePerGasWei),
    signed:false,sent:false,expectedMatchId:null});
}
/** Public invitation token contains ONLY a receipt locator. It grants no authority. */
export function arenaV3InviteToken(transactionHash){return 'gambit-v3:'+hash(transactionHash);}
export function parseArenaV3InviteToken(token){
  fail(typeof token==='string'&&/^gambit-v3:0x[0-9a-fA-F]{64}$/.test(token),'invitation token');
  return hash(token.slice('gambit-v3:'.length));
}
/**
 * Verify direct creation transaction, successful receipt, unique exact event,
 * canonical block, minimum confirmations, historical runtime, current match
 * identity and first-round timestamp. expectedParticipant is a supplied
 * public address, NOT evidence of wallet control. No local match IDs or
 * caller-supplied event objects accepted.
 */
export async function recoverArenaV3Invitation(p,approvedManifest,token,expectedParticipant,{signal}={}){
  const m=manifest(approvedManifest),txHash=parseArenaV3InviteToken(token);
  const participant=address(expectedParticipant);
  const latest=await head(p,m,signal);
  const tx=await p.getTransaction(txHash);abort(signal);
  const receipt=await p.getTransactionReceipt(txHash);abort(signal);
  fail(tx&&receipt&&hash(tx.hash)===txHash&&hash(receipt.hash)===txHash&&
    receipt.status===1&&integer(tx.chainId)===m.chainId&&
    address(tx.to)===m.address&&address(receipt.to)===m.address&&
    address(tx.from)===address(receipt.from)&&tx.value===0n,'direct successful creation');
  const blockNumber=integer(receipt.blockNumber);
  const blockHash=hash(receipt.blockHash);
  fail(integer(tx.blockNumber)===blockNumber&&hash(tx.blockHash)===blockHash&&
    latest.number-blockNumber>=2,'minimum three confirmations');
  const block=await checkedBlock(p,blockNumber,signal);
  fail(block.hash===blockHash,'receipt block reorganized');
  await checkRuntime(p,m,blockNumber,signal);
  let call;
  try{call=ABI.parseTransaction({data:tx.data,value:tx.value});}
  catch{throw Error('ARENA_V3_INVITE_INVALID creation calldata');}
  fail(call?.name==='createMatch','exact creation method');
  const challenger=address(tx.from),defender=address(call.args[0]);
  fail(challenger!==defender&&
    tx.data.toLowerCase()===ABI.encodeFunctionData('createMatch',[defender]).toLowerCase(),
    'exact creation arguments');
  fail(participant===challenger||participant===defender,'not invited participant');
  const topic=ABI.getEvent('MatchCreated').topicHash.toLowerCase();
  fail(Array.isArray(receipt.logs),'receipt logs');
  const matches=receipt.logs.filter(l=>l.address?.toLowerCase()===m.address.toLowerCase()&&
    l.topics?.[0]?.toLowerCase()===topic);
  fail(matches.length===1,'unique MatchCreated event');
  const event=matches[0];
  fail(event.removed!==true&&hash(event.transactionHash)===txHash&&
    hash(event.blockHash)===blockHash&&integer(event.blockNumber)===blockNumber&&
    event.topics.length===4&&event.data==='0x','canonical event identity');
  const args=ABI.decodeEventLog('MatchCreated',event.data,event.topics);
  const matchId=integer(args.matchId);
  fail(matchId>0&&matchId<=latest.counter&&address(args.challenger)===challenger&&
    address(args.defender)===defender,'creation event participants or counter');
  const view=await readArenaV3PublicMatch(p,m,matchId,{signal});
  fail(view.blockTag>=latest.number&&view.challenger===challenger&&view.defender===defender&&
    view.rounds[0].openedAt===block.timestamp,'receipt and current match disagree');
  const after=await checkedBlock(p,blockNumber,signal);
  const atView=await checkedBlock(p,view.blockTag,signal);
  fail(after.hash===blockHash&&atView.hash===view.blockHash.toLowerCase(),
    'reorganization during invitation recovery');
  return Object.freeze({mode:'arena-v3-invitation-readonly-research',
    trustBoundary:'caller-manifest-must-be-independently-approved',
    matchId,transactionHash:txHash,createdBlock:blockNumber,createdBlockHash:blockHash,
    challenger,defender,requestedParticipant:participant,
    seat:participant===challenger?'challenger':'defender',
    walletControlVerified:false,defenderAcceptanceVerified:false,view});
}
