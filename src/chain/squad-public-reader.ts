import {Contract,JsonRpcProvider,ZeroAddress,getAddress,keccak256} from 'ethers';
import {verifyFinalizedSquadSnapshot} from './squad-public-verify.mjs';
import type {SquadResult} from './squad-sepolia';

/**
 * Read finalized encrypted 3v3 scores without requesting a wallet account.
 * The only data this accepts is canonical finalized contract state from an
 * Ethereum Sepolia RPC AND the exact deployed v2 bytecode fingerprint.
 * It never signs, decrypts tactics, or creates a new outcome.
 */
const ABI=[
  'function duelStatus(uint256 id) view returns(uint256 squadId,address challenger,bool submitted,bool resolved,bool finalized,bool expired,uint8 packedScore,uint64 openedAt)',
  'function squadStatus(uint256 id) view returns(address owner,address allowedOpponent,bool active,bool claimed)',
  'function duelForSquad(uint256 id) view returns(uint256)'
];
const DEFAULT_RPC='https://ethereum-sepolia-rpc.publicnode.com';
const LEGACY='0x12adc9f3860FB20E9655197386CDFc1DD78FF0c0';

export async function readVerifiedSquadPublic(
  duelId:bigint,contractAddress:string,expectedRuntimeHash:string
):Promise<SquadResult>{
  if(typeof duelId!=='bigint'||duelId<=0n)
    throw Error('Duel ID must be a positive integer.');
  if(!/^0x[0-9a-fA-F]{64}$/.test(expectedRuntimeHash))
    throw Error('Missing verified SquadGambit runtime hash.');
  const address=getAddress(contractAddress);
  if(address===ZeroAddress||address.toLowerCase()===LEGACY.toLowerCase())
    throw Error('Wrong SquadGambit contract.');
  const provider=new JsonRpcProvider(DEFAULT_RPC);
  try{
    const network=await provider.getNetwork();
    if(network.chainId!==11155111n)throw Error('Public RPC is not Ethereum Sepolia.');
    const code=await provider.getCode(address);
    if(code==='0x'||keccak256(code).toLowerCase()!==expectedRuntimeHash.toLowerCase())
      throw Error('Public contract runtime does not match audited deployment.');
    const contract=new Contract(address,ABI,provider);
    const d=await contract.duelStatus(duelId);
    const squadId=BigInt(d.squadId);
    if(squadId<=0n)throw Error('No recorded duel under that ID.');
    const [s,linked]=await Promise.all([
      contract.squadStatus(squadId),contract.duelForSquad(squadId)
    ]);
    const verified=verifyFinalizedSquadSnapshot(duelId,{
      squadId,challenger:getAddress(d.challenger),
      submitted:Boolean(d.submitted),resolved:Boolean(d.resolved),
      finalized:Boolean(d.finalized),expired:Boolean(d.expired),
      packedScore:BigInt(d.packedScore),openedAt:BigInt(d.openedAt)
    },{
      owner:getAddress(s.owner),allowedOpponent:getAddress(s.allowedOpponent),
      active:Boolean(s.active),claimed:Boolean(s.claimed)
    },BigInt(linked));
    return {
      ...verified,
      outcome:verified.outcome as 0|1|2,
      authenticated:true,evidence:'contract-state',
      explorerUrl:'https://sepolia.etherscan.io/address/'+address,
      resolutionTx:'',finalizationTx:''
    };
  }finally{
    provider.destroy();
  }
}
