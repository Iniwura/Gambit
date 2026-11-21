/**
 * Exact information audit of the proposed BLACKSITE v2 action economy.
 * Enumerates every one of 6^5=7776 possible hidden combinations.
 *
 * These are average PUBLIC hint-information metrics under a uniform secret.
 * They do NOT prove human solvability, optimal strategy, confidential
 * randomness, game balance or onchain FHE gas/HCU feasibility.
 */
import {
  allV2Codes,scoreV2Guess,scoreV2ClassScan,V2_CODE_SPACE
} from './blacksite-v2-feasibility.mjs';

function metrics(partitions){
  const total=[...partitions.values()].reduce((s,n)=>s+n,0);
  if(total!==V2_CODE_SPACE)
    throw Error('BLACKSITE information partition lost secret cases');
  let expectedRemaining=0,infoBits=0,maxRemaining=0;
  for(const n of partitions.values()){
    const p=n/total;
    expectedRemaining+=p*n;
    infoBits+=p*Math.log2(total/n);
    maxRemaining=Math.max(maxRemaining,n);
  }
  return Object.freeze({
    buckets:partitions.size,
    expectedRemaining:Number(expectedRemaining.toFixed(3)),
    worstCaseRemaining:maxRemaining,
    meanPublicInformationBits:Number(infoBits.toFixed(3))
  });
}
export function benchmarkBlacksiteV2Opening(){
  const codeSpace=allV2Codes();
  const fixedGuess=[0,1,2,3,4];
  const guess=new Map(),scan=new Map(),both=new Map();
  for(const secret of codeSpace){
    const hint=scoreV2Guess(secret,fixedGuess);
    const scanCount=scoreV2ClassScan(secret,'reactor');
    const g=hint.exact+':'+hint.misplaced;
    const z=String(scanCount);
    const combo=g+'|'+z;
    guess.set(g,(guess.get(g)||0)+1);
    scan.set(z,(scan.get(z)||0)+1);
    both.set(combo,(both.get(combo)||0)+1);
  }
  return Object.freeze({
    scope:'EXACT_LOCAL_RESEARCH_NO_FHE',
    codeSpace:V2_CODE_SPACE,
    guessExample:Object.freeze(fixedGuess),
    scanExample:'reactor (class 0/1)',
    guess:metrics(guess),
    scan:metrics(scan),
    scanPlusGuess:metrics(both),
    fairnessProven:false,optimalPlayerStrategyProven:false,
    signerUsed:false,chainTransactionSent:false
  });
}
