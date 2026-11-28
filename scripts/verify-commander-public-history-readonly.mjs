/**
 * Positive LIVE Sepolia acceptance for the opt-in Commander Profile loader.
 * No wallet plugin, signer, transaction, private plan or fabricated match.
 */
import {JsonRpcProvider} from 'ethers';
import {loadApprovedCommanderPublicHistory}
  from '../src/profile/public-history.mjs';
import {TRUSTED_SQUAD_GAMBIT_SEPOLIA as PIN}
  from '../src/profile/trusted-deployments.mjs';

const provider=new JsonRpcProvider(
  process.env.GAMBIT_SEPOLIA_RPC_READONLY||
    'https://ethereum-sepolia-rpc.publicnode.com',
  PIN.chainId,{staticNetwork:true}
);
try{
  let lastProgress=null;
  const result=await loadApprovedCommanderPublicHistory(provider,
    '0x7d567Fa1d5fe35737BbF045f47667e13298Ee176',{
      maxPages:12,onProgress:state=>{lastProgress=state;}
    });
  if(!result.fullHistoryObserved||result.status!=='COMPLETE_RPC_SCAN')
    throw Error('Do not claim full history: bounded public scan incomplete');
  if(result.matches!==1||result.wins!==1||
     result.losses!==0||result.draws!==0||
     result.verifiedHistory.length!==1)
    throw Error('Expected one authentic defender victory, no fabricated others');
  const record=result.verifiedHistory[0];
  if(record.duelId!=='1'||record.pointsChallenger!==0||
     record.pointsDefender!==1||record.transactionHash.toLowerCase()!==
       '0x57a19f25a234eca7db206781a18cc965a09818a04b87a9f30d8d659562a9bdad')
    throw Error('Trusted live profile receipt disagrees with Duel #1');
  if(!lastProgress?.completed||
     lastProgress.playerRecordsVerified!==1)
    throw Error('Authentic public discovery progress unavailable');
  console.log('GAMBIT_COMMANDER_PUBLIC_HISTORY_LIVE '+JSON.stringify({
    status:result.status,approvedContract:result.contractAddress,
    pagesScanned:result.pagesScanned,
    candidatesChecked:result.candidatesChecked,
    verifiedRecords:result.matches,wins:result.wins,losses:result.losses,
    duel:record.duelId,receipt:record.transactionHash,
    chainId:result.chainId,consentedWallet:result.wallet,
    persistedPlayerProfile:false,realIdentitySystem:false,
    source:'canonical approved contract and authenticated finalization receipt',
    walletConnected:false,signatureMade:false,transactionSent:false
  }));
}finally{provider.destroy();}
