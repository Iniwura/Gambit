/**
 * GAMBIT Arena v3 — proof the research client ABI matches compiled Solidity.
 * READ ONLY: local artifact validation, no signer, wallet or network.
 *
 * Called after the Hardhat compiler exports the actual ArenaV3Research ABI.
 * A future contract change is forbidden to leave old handwritten selectors
 * or mismatched return types silently in public recovery / signing proposals.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Interface} from 'ethers';
import {ARENA_V3_WRITE_ABI} from '../src/arena/transaction-intent.mjs';
import {ARENA_V3_READ_ONLY_ABI} from '../src/arena/public-match-reader.mjs';

const file=resolve(process.cwd(),
  'fhe/artifacts/contracts/ArenaV3Research.sol/ArenaV3Research.json');
const contract=JSON.parse(readFileSync(file,'utf8'));
assert.equal(contract.contractName,'ArenaV3Research');
assert.equal(contract.sourceName,'contracts/ArenaV3Research.sol');
assert.ok(Array.isArray(contract.abi));
const actual=new Interface(contract.abi);
const write=new Interface(ARENA_V3_WRITE_ABI);
const read=new Interface(ARENA_V3_READ_ONLY_ABI);
const expectedWrites=['sealRound','resolveRound','finalizeRound','expireIncomplete'];
const expectedReads=['matchStatus','roundStatus','publicResultHandle'];

function compare(name,client,writable){
  const real=actual.getFunction(name);
  const local=client.getFunction(name);
  assert.ok(real&&local,'Compiled or client function missing: '+name);
  assert.equal(real.selector,local.selector,
    'Selector mismatch for '+name);
  assert.equal(real.format('sighash'),local.format('sighash'),
    'Input types mismatch for '+name);
  assert.deepEqual(local.inputs.map(x=>x.type),real.inputs.map(x=>x.type),
    'Argument encoding drift for '+name);
  assert.deepEqual(local.outputs.map(x=>x.type),real.outputs.map(x=>x.type),
    'Return ABI drift for '+name);
  assert.equal(real.stateMutability,writable?'nonpayable':'view',
    'Unexpected Solidity write/view boundary: '+name);
}
for(const name of expectedWrites)compare(name,write,true);
for(const name of expectedReads)compare(name,read,false);
const sample=Array.from({length:11},(_,n)=>
  '0x'+(n+1).toString(16).padStart(64,'0'));
const encoded=write.encodeFunctionData('sealRound',[1,sample,'0x1234',true]);
const decoded=actual.decodeFunctionData('sealRound',encoded);
assert.equal(decoded[0],1n);
assert.deepEqual([...decoded[1]],sample);
assert.equal(decoded[2],'0x1234');
assert.equal(decoded[3],true);
const sealedArtifact=JSON.stringify(contract.abi);
assert.equal(sealedArtifact.includes('"stateMutability":"payable"'),false,
  'No payable methods are allowed in the v3 research interface');
console.log('GAMBIT_ARENA_V3_ABI_PARITY '+JSON.stringify({
  researchOnly:true,
  compiledContract:contract.contractName,
  writeSelectors:expectedWrites.map(name=>({
    method:name,selector:actual.getFunction(name).selector
  })),
  verifiedReadMethods:expectedReads,
  ciphertextArrayWidth:11,
  transactionSending:false,chainProof:false,
  deploymentApproved:false
}));
