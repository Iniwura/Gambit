/**
 * Actual Sepolia verification of bounded approved-contract log discovery.
 * Verifies only candidate Duel #1 through the separately trusted receipt
 * reader before deriving one real win/loss. No signer, wallet or writes.
 */
import {JsonRpcProvider} from 'ethers';
import {discoverApprovedFinalizedDuels}
  from '../src/profile/approved-event-discovery.mjs';
import {
  verifyArenaProfileRecord,deriveCommanderArenaProfile
} from '../src/profile/verified-arena-record.mjs';
import {TRUSTED_SQUAD_GAMBIT_SEPOLIA as PIN}
  from '../src/profile/trusted-deployments.mjs';

const provider=new JsonRpcProvider(
  process.env.GAMBIT_SEPOLIA_RPC_READONLY||
    'https://ethereum-sepolia-rpc.publicnode.com',
  PIN.chainId,{staticNetwork:true}
);
try{
  const discovered=[];
  let cursor=null,complete=false,pages=0;
  for(;pages<24;pages++){
    const result=await discoverApprovedFinalizedDuels(provider,{
      cursor,maxBlocks:1200
    });
    discovered.push(...result.candidates);
    cursor=result.nextCursor;
    if(result.complete){complete=true;pages++;break;}
  }
  if(!complete)throw Error('Read-only discovery scan did not complete within 24 pages');
  const discovered1=discovered.filter(d=>d.duelId==='1');
  if(discovered1.length!==1)
    throw Error('Canonical Duel #1 not uniquely discovered from public logs');
  if(discovered1[0].transactionHash!==
    '0x57a19f25a234eca7db206781a18cc965a09818a04b87a9f30d8d659562a9bdad')
    throw Error('Duel #1 discovery returned an unexpected transaction');
  const trusted=await verifyArenaProfileRecord(provider,1n,PIN);
  if(trusted.transactionHash.toLowerCase()!==
      discovered1[0].transactionHash||
     trusted.blockHash.toLowerCase()!==discovered1[0].blockHash||
     trusted.pointsChallenger!==0||
     trusted.pointsDefender!==1)
    throw Error('Discovered log and independently verified receipt disagree');
  const defender=deriveCommanderArenaProfile(trusted.defender,[trusted]);
  const challenger=deriveCommanderArenaProfile(trusted.challenger,[trusted]);
  if(defender.wins!==1||challenger.losses!==1)
    throw Error('Trusted results failed participant attribution');
  console.log('GAMBIT_PROFILE_DISCOVERY_LIVE_READONLY '+JSON.stringify({
    chainId:PIN.chainId,approvedContract:PIN.contractAddress,
    pages,discoveredCandidates:discovered.length,
    canonicalDuelId:'1',
    finalizationTransaction:trusted.transactionHash,
    defenderWins:defender.wins,challengerLosses:challenger.losses,
    verifiedProfileRecords:1,
    persistentPlayerHistoryBuilt:false,
    proof:'pinned deployment + canonical event + receipt + live state',
    walletConnected:false,transactionSent:false,signatureMade:false
  }));
}finally{provider.destroy();}
