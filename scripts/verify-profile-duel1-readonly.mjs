/**
 * No-wallet, no-write real Sepolia probe for the first Commander Profile
 * evidence record. Uses public chain state and authentic finalization
 * receipt, not local practice or an uploaded JSON history.
 *
 * This is an architecture validation, not a shipped profile UI, account
 * system, real leaderboard, or permission to send any transaction.
 */
import {JsonRpcProvider} from 'ethers';
import {readFile} from 'node:fs/promises';
import {verifyArenaProfileRecord,deriveCommanderArenaProfile}
  from '../src/profile/verified-arena-record.mjs';

async function main(){
  const manifest=JSON.parse(await readFile(new URL(
    '../fhe/deployments/sepolia-squad.json',import.meta.url),'utf8'));
  if(manifest.chainId!==11155111||manifest.contract!=='SquadGambit')
    throw Error('Wrong public contract deployment manifest');
  const provider=new JsonRpcProvider(
    process.env.GAMBIT_SEPOLIA_RPC_READONLY||
      'https://ethereum-sepolia-rpc.publicnode.com',
    11155111,{staticNetwork:true});
  try{
    const record=await verifyArenaProfileRecord(provider,1n,{
      contractAddress:manifest.contractAddress,
      runtimeHash:manifest.runtimeKeccak256,
      fromBlock:manifest.blockNumber,
      minimumConfirmations:12
    });
    if(record.transactionHash.toLowerCase()!==
       '0x57a19f25a234eca7db206781a18cc965a09818a04b87a9f30d8d659562a9bdad'||
       record.pointsChallenger!==0||record.pointsDefender!==1||
       record.outcome!==2)
      throw Error('Real Duel 1 score or receipt does not match prior proof');
    const defender=deriveCommanderArenaProfile(record.defender,[record]);
    const challenger=deriveCommanderArenaProfile(record.challenger,[record]);
    if(defender.matches!==1||defender.wins!==1||
       challenger.matches!==1||challenger.losses!==1)
      throw Error('Actual signed match is not attributable to both players');
    console.log('GAMBIT_PROFILE_DUEL1_READONLY '+JSON.stringify({
      chainId:record.chainId,contractAddress:record.contractAddress,
      duelId:record.duelId,transactionHash:record.transactionHash,
      verifiedBlock:record.blockNumber,
      confirmations:record.confirmations,
      challenger:record.challenger,defender:record.defender,
      challengerPoints:record.pointsChallenger,
      defenderPoints:record.pointsDefender,
      defenderWins:defender.wins,challengerLosses:challenger.losses,
      scope:'One verified public Arena record, not persistent profile UI',
      historySource:record.evidence,
      walletConnected:false,signatureMade:false,transactionSent:false
    }));
  }finally{provider.destroy()}
}
main().catch(error=>{
  console.error('GAMBIT_PROFILE_DUEL1_READONLY_STOPPED '+
    (error instanceof Error?error.message.split('\n')[0]:'UnknownError'));
  process.exitCode=1;
});
