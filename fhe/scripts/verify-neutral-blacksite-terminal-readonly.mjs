import {Interface,JsonRpcProvider,getAddress,keccak256} from 'ethers';

// Read-only terminal reconciliation. This helper must not sign, send, retry,
// decrypt, or expose confidential mission inputs.
const RPC=process.env.SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com';
const CHAIN=11155111;
const CONTRACT=getAddress('0x33c062aebeB425b53A25E0b370732Cee5f7F97F9');
const OPERATIVE=getAddress('0x7d567Fa1d5fe35737BbF045f47667e13298Ee176');
const RUNTIME='0x8b17d9514b5cce1220afc3428b5a51fd93198786f501755aa10d9d540572665e';
const ABI=new Interface([
 'function missionStatus(uint256) view returns(address,uint64,uint64,uint64,uint8,uint8,uint8,uint8)',
 'function activeMission(address) view returns(uint256)'
]);
const provider=new JsonRpcProvider(RPC,CHAIN,{staticNetwork:false});
const block=await provider.getBlock('latest');
if(!block?.hash)throw Error('missing canonical head');
const runtime=await provider.getCode(CONTRACT,block.number);
if(keccak256(runtime)!==RUNTIME)throw Error('runtime mismatch');
const mission=ABI.decodeFunctionResult('missionStatus',await provider.call({
 to:CONTRACT,data:ABI.encodeFunctionData('missionStatus',[1]),blockTag:block.number
}));
const active=ABI.decodeFunctionResult('activeMission',await provider.call({
 to:CONTRACT,data:ABI.encodeFunctionData('activeMission',[OPERATIVE]),blockTag:block.number
}))[0];
const outcome=Number(mission[7]);
const activeMission=Number(active);
const terminalSlotMatches=outcome===0?activeMission===1:activeMission===0;
if(!terminalSlotMatches)throw Error('terminal active slot mismatch');
console.log('GAMBIT_BLACKSITE_TERMINAL_READONLY '+JSON.stringify({
 chainId:CHAIN,contract:CONTRACT,operative:OPERATIVE,missionId:1,
 blockNumber:block.number,blockHash:block.hash,runtimeHash:keccak256(runtime),
 outcome,activeMission,terminalSlotMatches,transactionSent:false
}));
