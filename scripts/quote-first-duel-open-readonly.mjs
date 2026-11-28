/**
 * No-wallet Sepolia quotation for opening exactly the first sealed squad.
 * All calls are public/read-only. This is NOT a signed transaction and
 * does NOT authorize opening an irreversible one-use invitation.
 */
import {JsonRpcProvider,Interface,getAddress,keccak256,formatEther} from 'ethers';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {FIRST_SEAL} from './verify-first-squad-seal-readonly.mjs';
const ABI=new Interface([
  'function squadStatus(uint256 id) view returns (address owner,address allowedOpponent,bool active,bool claimed)',
  'function duelForSquad(uint256 squadId) view returns (uint256)',
  'function nextDuelId() view returns (uint256)',
  'function openDuel(uint256 squadId) returns (uint256 duelId)'
]);
export async function quoteFirstDuelOpen(provider,manifest,expected=FIRST_SEAL){
  if(manifest?.chainId!==11155111||manifest.contract!=='SquadGambit')
    throw Error('Invalid expected Sepolia SquadGambit deployment');
  const address=getAddress(manifest.contractAddress);
  const chain=await provider.send('eth_chainId',[]);
  if(BigInt(chain)!==11155111n)throw Error('Not Ethereum Sepolia');
  const code=await provider.getCode(address);
  if(code==='0x'||(code.length-2)/2!==manifest.runtimeBytes||
    keccak256(code).toLowerCase()!==manifest.runtimeKeccak256.toLowerCase())
    throw Error('Wrong deployed runtime fingerprint');

  async function view(name,args=[]){
    const bytes=await provider.call({to:address,data:ABI.encodeFunctionData(name,args)});
    return ABI.decodeFunctionResult(name,bytes);
  }
  const [status,used,latestDuel]=await Promise.all([
    view('squadStatus',[expected.squadId]),
    view('duelForSquad',[expected.squadId]),
    view('nextDuelId')
  ]);
  if(getAddress(status.owner)!==getAddress(expected.owner)||
    getAddress(status.allowedOpponent)!==getAddress(expected.challenger)||
    !status.active||status.claimed||
    BigInt(used[0])!==0n)
    throw Error('Squad #1 is not an active unused invitation to the expected challenger');

  const tx={
    from:getAddress(expected.challenger),to:address,
    data:ABI.encodeFunctionData('openDuel',[expected.squadId]),
    value:0n
  };
  const gas=await provider.estimateGas(tx);
  if(gas<=0n)throw Error('Unable to estimate invitation opening gas');
  const bufferedGas=(gas*120n+99n)/100n;
  const fees=await provider.getFeeData();
  const maxPerGas=fees.maxFeePerGas??fees.gasPrice;
  if(!maxPerGas||maxPerGas<=0n)throw Error('No current fee quote');
  const maxFee=bufferedGas*maxPerGas;
  // Refuse to present a stale quote if the one-use invitation was claimed.
  const [stillOpen,stillUnused,nextDuel]=await Promise.all([
    view('squadStatus',[expected.squadId]),
    view('duelForSquad',[expected.squadId]),
    view('nextDuelId')
  ]);
  if(!stillOpen.active||stillOpen.claimed||BigInt(stillUnused[0])!==0n||
    BigInt(nextDuel[0])!==BigInt(latestDuel[0]))
    throw Error('One-use invitation changed during the gas quotation');
  return Object.freeze({
    scope:'PUBLIC READ-ONLY openDuel(1) GAS QUOTE; NO SIGNER, NO BALANCES, NO TRANSACTION',
    chainId:11155111,contract:address,
    squadId:expected.squadId.toString(),
    challenger:getAddress(expected.challenger),
    owner:getAddress(expected.owner),
    expectedNextDuelId:(BigInt(latestDuel[0])+1n).toString(),
    estimatedGas:gas.toString(),
    bufferedGasLimit:bufferedGas.toString(),
    maxFeePerGasWei:maxPerGas.toString(),
    maximumQuotedFeeWei:maxFee.toString(),
    maximumQuotedFeeSepoliaETH:formatEther(maxFee),
    warning:'Indicative quote only. Opening claims Squad #1 irreversibly. Do not sign before fresh explicit approval. Challenger must submit encrypted plans before the 1-day deadline.',
    balanceChecked:false,transactionSigned:false,transactionSent:false
  });
}
async function main(){
  const manifest=JSON.parse(await readFile(
    new URL('../fhe/deployments/sepolia-squad.json',import.meta.url),'utf8'));
  const provider=new JsonRpcProvider(process.env.GAMBIT_SEPOLIA_RPC_READONLY||
    'https://ethereum-sepolia-rpc.publicnode.com');
  try{
    console.log('FIRST_DUEL_OPEN_UNSIGNED_QUOTE '+
      JSON.stringify(await quoteFirstDuelOpen(provider,manifest)));
  }finally{provider.destroy()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{
    console.error('FIRST_DUEL_OPEN_UNSIGNED_QUOTE_FAILED '+
      (error instanceof Error?error.message:'Unknown error'));
    process.exitCode=1;
  });
