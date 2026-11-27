import {getAddress,keccak256} from 'ethers';

const CHAIN=11155111;
const CONTRACT=getAddress('0x5F9e0030233370a913780EC9CCb58183C4672c13');
const FROM=getAddress('0x7d567Fa1d5fe35737BbF045f47667e13298Ee176');
const CREATION='0x9e760de916b8e097c25ff79a7e6c103e79f1009b088f4883d1d20db45bd8b07c';
const RUNTIME='0x6f58a369687239e1398f8f5d943825b59a1c47326fd450171ec78e150408544d';
const TX_HASH='0xc8725e44231395e0cf19e15300f5c1f6a8792867d3dc12204cb7fd2ddd86b4bb';
const EXPECTED_NONCE=1807;
const EXPECTED_GAS_LIMIT='30683919';
const EXPECTED_MAX_FEE='526274';
const EXPECTED_PRIORITY='2';
const BUDGET=5_000_000_000_000_000n;
const RPCS=[
 ['PublicNode','https://ethereum-sepolia-rpc.publicnode.com',true],
 ['Tenderly','https://gateway.tenderly.co/public/sepolia',false]
];
async function rpc(url,method,params){
 const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});
 const json=await response.json();
 if(json.error)throw Error(method+':'+json.error.code);
 return json.result;
}
function check(ok,reason){if(!ok)throw Error(reason);}
async function verify(name,url,fullTx){
 const receipt=await rpc(url,'eth_getTransactionReceipt',[TX_HASH]);
 check(receipt&&receipt.transactionHash.toLowerCase()===TX_HASH.toLowerCase(),name+' receipt');
 const tx=fullTx?await rpc(url,'eth_getTransactionByHash',[TX_HASH]):null;
 if(fullTx)check(tx,name+' transaction');
 const block=await rpc(url,'eth_getBlockByNumber',[receipt.blockNumber,false]);
 const historical=await rpc(url,'eth_getCode',[CONTRACT,receipt.blockNumber]);
 const current=await rpc(url,'eth_getCode',[CONTRACT,'latest']);
 const actualFee=BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice||receipt.gasPrice);
 check(parseInt(receipt.status,16)===1,name+' status');
 check(block.hash.toLowerCase()===receipt.blockHash.toLowerCase(),name+' canonical block');
 check(receipt.contractAddress?.toLowerCase()===CONTRACT.toLowerCase(),name+' address');
 check(keccak256(historical)===RUNTIME&&keccak256(current)===RUNTIME,name+' runtime');
 check(actualFee<=BUDGET,name+' fee');
 const row={provider:name,transactionHash:TX_HASH,receiptStatus:parseInt(receipt.status,16),
  blockNumber:parseInt(receipt.blockNumber,16),blockHash:receipt.blockHash,gasUsed:BigInt(receipt.gasUsed).toString(),
  effectiveGasPriceWei:BigInt(receipt.effectiveGasPrice||receipt.gasPrice).toString(),actualFeeWei:actualFee.toString(),
  historicalRuntimeHash:keccak256(historical),currentRuntimeHash:keccak256(current),canonical:true};
 if(tx){
  check(getAddress(tx.from)===FROM,name+' sender');
  check(tx.to===null,name+' creation destination');
  check(parseInt(tx.nonce,16)===EXPECTED_NONCE,name+' nonce');
  check(BigInt(tx.value)==0n,name+' value');
  check(BigInt(tx.gas).toString()===EXPECTED_GAS_LIMIT,name+' gas limit');
  check(BigInt(tx.maxFeePerGas).toString()===EXPECTED_MAX_FEE,name+' max fee');
  check(BigInt(tx.maxPriorityFeePerGas).toString()===EXPECTED_PRIORITY,name+' priority fee');
  check(keccak256(tx.input)===CREATION,name+' creation bytecode');
  row.from=getAddress(tx.from);row.to=tx.to;row.nonce=parseInt(tx.nonce,16);
  row.valueWei=BigInt(tx.value).toString();row.gasLimit=BigInt(tx.gas).toString();
  row.maxFeePerGasWei=BigInt(tx.maxFeePerGas).toString();row.maxPriorityFeePerGasWei=BigInt(tx.maxPriorityFeePerGas).toString();
  row.creationCodeHash=keccak256(tx.input);
 }
 return row;
}
const providers=await Promise.all(RPCS.map(([name,url,fullTx])=>verify(name,url,fullTx)));
console.log('GAMBIT_ARENA_V4_DEPLOYMENT_INDEPENDENTLY_VERIFIED '+JSON.stringify({
 chainId:CHAIN,contract:CONTRACT,deployer:FROM,creationCodeHash:CREATION,runtimeHash:RUNTIME,
 transactionHash:TX_HASH,providers
}));
