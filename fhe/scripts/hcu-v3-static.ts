/**
 * GAMBIT ArenaV3Research — source-locked, hand-reviewed static HCU inventory.
 *
 * NOT coprocessor instrumentation, NOT an approved Sepolia HCU quote, and NOT
 * permission to deploy. Counts represent worst case when BOTH players use
 * their one public GAMBIT activation in the same round. Branches controlled
 * by public booleans change which symbolic operations are executed.
 *
 * References: https://docs.zama.org/protocol/solidity-guides/development-guide/hcu
 * Table entries are NON-SCALAR euint8/ebool costs; intentionally avoid
 * applying cheaper scalar costs when unsure. The guide's limits are DEVNET
 * examples and must NOT be called authoritative Sepolia deployment limits.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

// Git blob SHA is pinned to the audited exact source bytes.
const REVIEWED_V3_GIT_BLOB_SHA='97d5459f8d3197500c93fe24495d52cec8c36004';
const content=readFileSync(resolve(process.cwd(),'contracts/ArenaV3Research.sol'));
const gitBlobSha=createHash('sha1')
  .update('blob '+content.length+String.fromCharCode(0))
  .update(content)
  .digest('hex');
if(gitBlobSha!==REVIEWED_V3_GIT_BLOB_SHA){
  console.error('ARENA_V3_HCU_SOURCE_DRIFT: update of ArenaV3Research.sol invalidated the hand-reviewed FHE operation inventory. Expected '+
    REVIEWED_V3_GIT_BLOB_SHA+' actual '+gitBlobSha+
    '. Re-audit loops, FHE expressions, public conditional branches and proof handling first.');
  process.exit(1);
}

const cost={
  eq:55_000,boolAnd:25_000,boolOr:24_000,boolNot:2,
  select:55_000,add:88_000,sub:91_000,shl:92_000,
  lt:59_000
} as const;
type Op=keyof typeof cost;
type Counts=Record<Op,number>;
const empty=():Counts=>({
  eq:0,boolAnd:0,boolOr:0,boolNot:0,
  select:0,add:0,sub:0,shl:0,lt:0
});
const add=(...groups:Counts[]):Counts=>{
  const result=empty();
  for(const group of groups)for(const key of Object.keys(cost) as Op[])
    result[key]+=group[key];
  return result;
};
const multiply=(count:number,group:Counts):Counts=>{
  const out=empty();
  for(const key of Object.keys(cost) as Op[])out[key]=count*group[key];
  return out;
};
const weighted=(counts:Counts)=>Object.keys(cost)
  .reduce((sum,key)=>sum+counts[key as Op]*cost[key as Op],0);

// resolveRound: encrypted same-formation + three encrypted comparisons for
// each cyclic relative formation shift (6 eq / 3 and / 2 or).
const formation={...empty(),eq:7,boolAnd:3,boolOr:2};
// _lane once: _rotate three enemy tactics => six FHE.select;
// two conditional actions => two eq/two select; draw=>one eq;
// three win comparisons => six eq/three and/two or;
// opponent win = not(draw) and not(win) => two not and one and.
const lane={...empty(),eq:9,boolAnd:4,boolOr:2,boolNot:2,select:8};
// Defender role re-order = two select expressions per role.
const defenderReorder={...empty(),select:6};
// _points with no wager (per player):
// 3 base-point add/select; breach select; Scout mark and/select/add;
// opposing Guardian block and/select/sub; aggregate add.
const basePoints={...empty(),boolAnd:2,select:6,add:5,sub:1};
// _stakeHit, executed only if useGambit public flag true:
// 3 formation eq + 3 sector eq + initial false eq;
// each of 3 roles: three and and two or target checks,
// one and / one or combining that role's win.
const sectorHit={...empty(),eq:7,boolAnd:12,boolOr:9};
// _points wager bonus: add 2 on win; compare score==0;
// max(0,score-1), choose success or loss.
const wagerAdjustment={...empty(),eq:1,select:2,add:1,sub:1};
// Final packed = (pointsA << 3) + pointsB.
const packing={...empty(),shl:1,add:1};

// Each sealRound normalizes formation and three triples: 10 values.
// If GAMBIT used, the secret sector is the 11th normalized value.
// Normalization is lt(3) followed by select; fromExternal input proof,
// FHE.allowThis, ACL and public decryption are NOT represented by this table.
const normalizeOne={...empty(),lt:1,select:1};
const normalSeal=multiply(10,normalizeOne);
const stakedSeal=multiply(11,normalizeOne);

const baselineResolve=add(
  formation,multiply(3,lane),defenderReorder,
  multiply(2,basePoints),packing
);
const twoStakeResolve=add(
  baselineResolve,multiply(2,add(sectorHit,wagerAdjustment))
);
const report={
  identity:'ArenaV3Research.sol static source inventory',
  reviewedContractGitBlobSha:REVIEWED_V3_GIT_BLOB_SHA,
  sourceDriftGuard:'PASS',
  inputPerParticipantPerRound:11,
  circuits:{
    withoutGambit:{operations:baselineResolve,tableWeightedHcu:weighted(baselineResolve)},
    bothGambits:{operations:twoStakeResolve,tableWeightedHcu:weighted(twoStakeResolve)}
  },
  submissionNormalization:{
    noStake:{operations:normalSeal,tableWeightedHcu:weighted(normalSeal)},
    stake:{operations:stakedSeal,tableWeightedHcu:weighted(stakedSeal)}
  },
  publishedDevnetExample:{
    complexityHcu:20_000_000,depthHcu:5_000_000,
    caveat:'THESE ARE DEVNET GUIDE VALUES, NOT VERIFIED SEPOLIA LIMITS'
  },
  unmeasured:[
    'actual Sepolia HCU and sequential-operation depth',
    'fromExternal/input-proof overhead','ACL permission bookkeeping',
    'public-decryption preparation','actual coprocessor scheduling',
    'real relayer and KMS proof latency'
  ],
  approval:'RESEARCH_ONLY_NO_DEPLOYMENT_APPROVAL',
  liveHcuMeasured:false,
  depthHcuMeasured:false
};
if(weighted(twoStakeResolve)<weighted(baselineResolve))
  throw Error('Invalid HCU bookkeeping');
console.log('GAMBIT_ARENA_V3_STATIC_HCU '+JSON.stringify(report));
