/**
 * Reproducible predeployment HCU accounting for SquadGambit.
 *
 * These are published-table estimates, not coprocessor instrumentation. The
 * script intentionally fails closed if the modeled resolve total exceeds the
 * documented devnet limits; unknown protocol overhead is reported separately.
 */
const LIMIT_TOTAL=20_000_000;
const LIMIT_DEPTH=5_000_000;
const cost={
  boolAnd:25_000,boolOr:24_000,boolNot:2,boolSelect:55_000,
  eq:55_000,select:55_000,add:88_000,sub:91_000,shl:92_000,
  lt:59_000
} as const;

const resolve={eq:25,boolAnd:16,boolOr:8,boolNot:6,select:36,add:9,sub:2,shl:1};
const normalize={lt:10,select:10};
const weighted=(counts:Record<string,number>)=>Object.entries(counts)
  .reduce((sum,[name,count])=>sum+count*(cost[name as keyof typeof cost]??0),0);

const resolveHcu=weighted(resolve);
const normalizeHcu=weighted(normalize);
// Critical-path model: two encrypted rotation selects, conditional action
// selection, winner predicate, three serial score accumulations, bonus path,
// and final packing. This is deliberately conservative and not a protocol
// meter; FHE DAG scheduling may differ from this source-level model.
const modeledDepthHcu=1_100_000;
const result={
  source:'SquadGambit.sol static source inventory',
  table:'Zama HCU guide published non-scalar euint8/ebool costs',
  limits:{totalHcu:LIMIT_TOTAL,sequentialDepthHcu:LIMIT_DEPTH},
  counts:{resolve,sealOrSubmitNormalization:normalize},
  estimates:{resolveHcu,sealOrSubmitNormalizationHcu:normalizeHcu,modeledResolveSequentialDepthHcu:modeledDepthHcu},
  headroom:{resolveTotalHcu:LIMIT_TOTAL-resolveHcu,resolveDepthHcu:LIMIT_DEPTH-modeledDepthHcu},
  unknownNotMeasured:['FHE.fromExternal input-proof validation','ACL permission bookkeeping','public-decryption preparation','live coprocessor scheduling'],
  status:resolveHcu<LIMIT_TOTAL&&modeledDepthHcu<LIMIT_DEPTH?'STATIC_ESTIMATE_WITHIN_PUBLISHED_DEVNET_LIMITS':'STATIC_ESTIMATE_EXCEEDS_PUBLISHED_LIMIT',
  liveHcuMeasured:false
};
console.log('SQUAD_STATIC_HCU '+JSON.stringify(result));
if(resolveHcu>=LIMIT_TOTAL||modeledDepthHcu>=LIMIT_DEPTH)process.exitCode=1;
