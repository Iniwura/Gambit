/**
 * Build-time ABI compatibility gate for the UNDEPLOYED SquadGambit client.
 * No wallet, network, private data, or transaction is involved.
 * A stale TypeScript ABI must never reach a browser production build.
 */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Interface} from 'ethers';
const output=JSON.parse(await readFile(resolve('fhe/artifacts/contracts/SquadGambit.sol/SquadGambit.json'),'utf8'));
if(output.contractName!=='SquadGambit'||!Array.isArray(output.abi))
  throw Error('Missing compiled SquadGambit candidate ABI');
const source=await readFile(resolve('src/chain/squad-sepolia.ts'),'utf8');
const body=source.match(/const abi=\[([\s\S]*?)\];/);
if(!body)throw Error('Unable to inspect versioned SquadGambit client ABI');
const fragments=[...body[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
if(fragments.length<12)throw Error('Client contract ABI is incomplete');
const actual=new Interface(output.abi),client=new Interface(fragments);
const functions=['sealSquad','closeSquad','openDuel','submitDuel','resolveDuel',
  'finalizeDuel','expireUnsubmitted','squadStatus','duelForSquad','duelStatus','publicResultHandle'];
for(const name of functions){
  const a=actual.getFunction(name),b=client.getFunction(name);
  if(!a||!b||a.selector!==b.selector||a.inputs.length!==b.inputs.length||
    a.outputs.length!==b.outputs.length)
    throw Error('Squad client ABI mismatch for '+name);
  for(let i=0;i<a.inputs.length;i++)
    if(a.inputs[i].format('sighash')!==b.inputs[i].format('sighash'))
      throw Error('Squad client input ABI mismatch for '+name+' argument '+i);
  for(let i=0;i<a.outputs.length;i++)
    if(a.outputs[i].format('sighash')!==b.outputs[i].format('sighash'))
      throw Error('Squad client output ABI mismatch for '+name+' result '+i);
}
for(const name of ['SquadSealed','DuelOpened','DuelSubmitted','DuelReady','DuelFinalized']){
  const a=actual.getEvent(name),b=client.getEvent(name);
  if(!a||!b||a.topicHash!==b.topicHash)throw Error('Squad client event mismatch '+name);
}
const byteLength=(output.deployedBytecode.length-2)/2;
console.log('SquadGambit client ABI matches compiled candidate:',functions.length,
  'methods and 5 event signatures. Mock runtime bytes:',byteLength,
  '(NOT live Sepolia gas/HCU evidence).');
