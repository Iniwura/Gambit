/**
 * Independent read-only verification of SquadGambit v2's FIRST actual seal.
 *
 * Grounding: expected values transcribed from the owner's 21 Nov 2026
 * confirmed local receipt. Only the Sepolia RPC may confirm them.
 *
 * No signer, wallet API, balance query, private proof, decryption or writes.
 * The public receipt is proof of ten-input encrypted seal acceptance only:
 * it is NOT proof of a completed duel, FHE compute or KMS finalization.
 */
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Interface,JsonRpcProvider,getAddress,keccak256,formatEther} from 'ethers';

export const FIRST_SEAL=Object.freeze({
  chainId:11155111,
  transactionHash:'0x65b1fde92ff899718f4febcdc1597cc9fb05c681b1e05996f306d2a3bae41e0b',
  owner:'0x7d567Fa1d5fe35737BbF045f47667e13298Ee176',
  challenger:'0x70d086988706e4f27A53c484570B2a41897dcDD5',
  squadId:1n,block:12181816,gasUsed:3742597n,
  gasPriceWei:20n,actualFeeWei:74851940n,
  approvedMaximumFeeWei:2000000000n
});
const ABI=new Interface([
 'function sealSquad(address allowedOpponent,bytes32[10] encryptedPlans,bytes inputProof) returns (uint256)',
 'function squadStatus(uint256) view returns (address owner,address allowedOpponent,bool active,bool claimed)',
 'function nextSquadId() view returns (uint256)',
 'event SquadSealed(uint256 indexed squadId,address indexed owner,address indexed allowedOpponent)'
]);

const sameAddress=(a,b)=>typeof a==='string'&&typeof b==='string'&&
  getAddress(a)===getAddress(b);
const requireTruth=(condition,message)=>{
  if(!condition)throw Error('FIRST_SQUAD_SEAL_READONLY_INVALID '+message);
};

export async function verifyFirstSquadSealReadOnly(provider,manifest,expected=FIRST_SEAL){
  requireTruth(manifest?.contract==='SquadGambit'&&
    manifest.chainId===expected.chainId,'deployment manifest');
  const address=getAddress(manifest.contractAddress);
  requireTruth(sameAddress(manifest.deployer,expected.owner),'deployer');
  requireTruth(BigInt(await provider.send('eth_chainId',[]))===BigInt(expected.chainId),'chain');
  const [tx,receipt,code]=await Promise.all([
    provider.getTransaction(expected.transactionHash),
    provider.getTransactionReceipt(expected.transactionHash),
    provider.getCode(address)
  ]);
  requireTruth(!!tx&&!!receipt&&!!code&&code!=='0x','public transaction, receipt, code');
  requireTruth(sameAddress(tx.from,expected.owner),'tx sender');
  requireTruth(sameAddress(tx.to,address),'tx target');
  requireTruth(tx.hash.toLowerCase()===expected.transactionHash.toLowerCase(),'tx hash');
  requireTruth(tx.value===0n,'nonzero ETH value');
  requireTruth(tx.data?.startsWith(ABI.getFunction('sealSquad').selector),'function selector');
  requireTruth(receipt.status===1,'receipt status');
  requireTruth(receipt.hash.toLowerCase()===expected.transactionHash.toLowerCase(),'receipt hash');
  requireTruth(sameAddress(receipt.from,expected.owner),'receipt sender');
  requireTruth(sameAddress(receipt.to,address),'receipt target');
  requireTruth(receipt.blockNumber===expected.block,'receipt block');
  requireTruth(receipt.gasUsed===expected.gasUsed,'gas used');
  requireTruth(receipt.gasPrice===expected.gasPriceWei,'effective gas price');
  const actualFeeWei=receipt.gasUsed*receipt.gasPrice;
  requireTruth(actualFeeWei===expected.actualFeeWei,'actual transaction fee');
  requireTruth(actualFeeWei<=expected.approvedMaximumFeeWei,'approved fee cap');
  requireTruth((code.length-2)/2===manifest.runtimeBytes,'runtime byte count');
  requireTruth(keccak256(code).toLowerCase()===manifest.runtimeKeccak256.toLowerCase(),
    'runtime code hash');

  const matchingEvents=receipt.logs.filter(log=>{
    if(!sameAddress(log.address,address))return false;
    try{return ABI.parseLog({topics:log.topics,data:log.data})?.name==='SquadSealed';}
    catch{return false}
  });
  requireTruth(matchingEvents.length===1,'exactly one authentic SquadSealed event');
  const event=ABI.parseLog({
    topics:matchingEvents[0].topics,
    data:matchingEvents[0].data
  });
  requireTruth(BigInt(event.args.squadId)===expected.squadId,'squadId in event');
  requireTruth(sameAddress(event.args.owner,expected.owner),'owner in event');
  requireTruth(sameAddress(event.args.allowedOpponent,expected.challenger),
    'challenger in event');

  const current=async(fn,args=[])=>{
    const raw=await provider.call({to:address,data:ABI.encodeFunctionData(fn,args)});
    return ABI.decodeFunctionResult(fn,raw);
  };
  const [status,counters]=await Promise.all([
    current('squadStatus',[expected.squadId]),
    current('nextSquadId')
  ]);
  requireTruth(sameAddress(status.owner,expected.owner),'stored owner');
  requireTruth(sameAddress(status.allowedOpponent,expected.challenger),'stored opponent');
  requireTruth(status.active===true,'squad unexpectedly inactive');
  requireTruth(BigInt(counters[0])>=expected.squadId,'counter behind confirmed squad');

  return Object.freeze({
    scope:'PUBLIC SEPOLIA RECEIPT AND STATE VERIFICATION; NO SIGNER OR TRANSACTION',
    chainId:expected.chainId,contract:address,
    transactionHash:expected.transactionHash,
    receiptStatus:'SUCCESS',
    blockNumber:receipt.blockNumber,
    squadId:expected.squadId.toString(),
    owner:getAddress(expected.owner),
    allowedOpponent:getAddress(expected.challenger),
    active:status.active,claimed:status.claimed,
    gasUsed:receipt.gasUsed.toString(),
    effectiveGasPriceWei:receipt.gasPrice.toString(),
    actualFeeWei:actualFeeWei.toString(),
    actualFeeSepoliaETH:formatEther(actualFeeWei),
    withinApprovedCap:true,
    nextSquadId:BigInt(counters[0]).toString(),
    encryptedSquadAccepted:true,
    duelResolved:false,kmsProofVerified:false,
    balanceChecked:false,signed:false,transactionSent:false
  });
}

async function main(){
  const manifest=JSON.parse(await readFile(
    new URL('../fhe/deployments/sepolia-squad.json',import.meta.url),'utf8'));
  const url=process.env.GAMBIT_SEPOLIA_RPC_READONLY||
    'https://ethereum-sepolia-rpc.publicnode.com';
  const provider=new JsonRpcProvider(url);
  try{
    const result=await verifyFirstSquadSealReadOnly(provider,manifest);
    console.log('FIRST_SQUAD_SEAL_LIVE_VERIFIED '+JSON.stringify(result));
  }finally{provider.destroy()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{
    // No RPC URL, user input proofs or authentication material in CI logs.
    console.error('FIRST_SQUAD_SEAL_LIVE_VERIFY_FAILED '+
      (error instanceof Error?error.message:'unknown'));
    process.exitCode=1;
  });
