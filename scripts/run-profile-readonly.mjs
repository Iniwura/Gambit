// Executes only the existing no-wallet, no-write verification scripts.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runReadOnlyProviderPolicy} from './readonly-provider-policy.mjs';
const allowed=new Set(['verify-profile-duel1-readonly.mjs','verify-profile-discovery-readonly.mjs','verify-commander-public-history-readonly.mjs']);
const script=process.argv[2];
if(process.argv.length!==3||!allowed.has(script))throw Error('Unsupported read-only verification script');
const result=runReadOnlyProviderPolicy((endpoint,index)=>{
 console.log('GAMBIT_READONLY_PROVIDER_ATTEMPT '+(index+1));
 const child=spawnSync(process.execPath,[fileURLToPath(new URL(script,import.meta.url))],{
  env:{...process.env,GAMBIT_SEPOLIA_RPC_READONLY:endpoint},
  encoding:'utf8',timeout:70000,maxBuffer:4*1024*1024
 });
 const output=(child.stdout??'')+'\n'+(child.stderr??'');
 process.stdout.write(child.stdout??'');process.stderr.write(child.stderr??'');
 if(child.error){console.error('Read-only subprocess failed: '+child.error.code);return {status:1,output:''};}
 return {status:child.status,output};
},process.env.GAMBIT_SEPOLIA_RPC_READONLY);
console.log('GAMBIT_READONLY_PROVIDER_RESULT '+JSON.stringify(result));
if(!result.ok)process.exitCode=1;
