import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Build-time sanitization. Compiled contract ABI/creation bytecode are public.
// NEVER export Hardhat settings, accounts or node configuration to the site.
const artifactPath=resolve('fhe/artifacts/contracts/SealedGambit.sol/SealedGambit.json');
const raw=JSON.parse(await readFile(artifactPath,'utf8'));
if(raw.contractName!=='SealedGambit'||!Array.isArray(raw.abi)
   ||typeof raw.bytecode!=='string'||!/^(0x[\da-fA-F]+)$/.test(raw.bytecode))
  throw new Error('Invalid compiled SealedGambit artifact');
if((raw.bytecode.length-2)/2<1500)throw new Error('Unexpectedly short contract creation bytecode');
const links=raw.linkReferences||{};
if(Object.keys(links).length)throw new Error('Contract requires unlinked libraries. Refusing wallet deployment');
for(const name of ['seal','openChallenge','submit','resolve','finalize','publicResultHandle']){
  if(!raw.abi.some((item)=>item.type==='function'&&item.name===name))
    throw new Error('SealedGambit artifact missing required '+name+' function');
}
const data={
  name:'GAMBIT SealedGambit',
  chainId:11155111,
  abi:raw.abi,
  bytecode:raw.bytecode,
  bytecodeSha256:createHash('sha256').update(Buffer.from(raw.bytecode.slice(2),'hex')).digest('hex'),
  source:'contracts/SealedGambit.sol',
  warning:'Research contract. Live matches and security are NOT verified by compilation alone.'
};
await mkdir(resolve('public/chain'),{recursive:true});
await writeFile(resolve('public/chain/sealed-gambit.json'),JSON.stringify(data,null,2)+'\n');
console.log('Prepared public SealedGambit ABI + creation code',data.bytecodeSha256,
  'bytes',((raw.bytecode.length-2)/2));
