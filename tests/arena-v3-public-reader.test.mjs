import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,keccak256} from 'ethers';
import {
  ARENA_V3_READ_ONLY_ABI,ARENA_V3_PUBLIC_READER_VERSION,
  readArenaV3PublicMatch
} from '../src/arena/public-match-reader.mjs';

const iface=new Interface(ARENA_V3_READ_ONLY_ABI);
const ADDR='0x'+'1'.repeat(40),DEF='0x'+'2'.repeat(40);
const CODE='0x6080604052600080fd';
const HASH='0x'+'a'.repeat(64);
const MANIFEST={
  contract:'ArenaV3Research',version:1,chainId:11155111,
  address:ADDR,runtimeHash:keccak256(CODE)
};
const SCORE=(a,b)=>a*8+b;
const row=(extras={})=>({
  openedAt:100000,deadlineAt:186400,
  challengerSealed:false,defenderSealed:false,
  resolved:false,finalized:false,packedScore:0,...extras
});
function fixture(extra={}){
  return {
    timestamp:150000,chainId:11155111,blockTag:3000,
    blockHash:HASH,runtime:CODE,
    state:{
      challenger:ADDR,defender:DEF,currentRound:1,
      complete:false,abandoned:false,
      challengerGambitSpent:false,defenderGambitSpent:false,
      cumulativeChallenger:0,cumulativeDefender:0
    },
    rows:[row()],handle:'0x'+'b'.repeat(64),...extra
  };
}
function provider(fx){
  const calls=[];
  let blockReads=0;
  const p={
    calls,
    async getNetwork(){return {chainId:BigInt(fx.chainId)};},
    async getBlockNumber(){return fx.blockTag;},
    async getBlock(tag){
      assert.equal(tag,fx.blockTag);
      blockReads++;
      return {hash:fx.reorgOnSecondBlock&&blockReads>1?
        '0x'+'c'.repeat(64):fx.blockHash,timestamp:fx.timestamp};
    },
    async getCode(addr,tag){
      assert.equal(addr,ADDR);assert.equal(tag,fx.blockTag);
      return fx.runtime;
    },
    async call(tx){
      assert.equal(tx.to,ADDR,'read contract only at pinned address');
      assert.equal(tx.blockTag,fx.blockTag,'all eth_calls same canonical block');
      const call=iface.parseTransaction({data:tx.data});
      assert.ok(call);
      calls.push(call.name);
      if(call.name==='matchStatus'){
        assert.equal(Number(call.args[0]),1);
        const s=fx.state;
        return iface.encodeFunctionResult('matchStatus',[
          s.challenger,s.defender,s.currentRound,
          s.complete,s.abandoned,s.challengerGambitSpent,
          s.defenderGambitSpent,s.cumulativeChallenger,
          s.cumulativeDefender
        ]);
      }
      if(call.name==='roundStatus'){
        assert.equal(Number(call.args[0]),1);
        const index=Number(call.args[1])-1;
        assert.ok(index>=0&&index<fx.state.currentRound);
        const s=fx.rows[index];
        return iface.encodeFunctionResult('roundStatus',[
          s.openedAt,s.deadlineAt,s.challengerSealed,s.defenderSealed,
          s.resolved,s.finalized,s.packedScore
        ]);
      }
      if(call.name==='publicResultHandle'){
        assert.equal(Number(call.args[1]),fx.state.currentRound);
        return iface.encodeFunctionResult('publicResultHandle',[fx.handle]);
      }
      throw Error('Unexpected research ABI call '+call.name);
    },
    getSigner(){throw Error('READ_ONLY_READER MUST NOT OPEN A WALLET');},
    sendTransaction(){throw Error('READ_ONLY_READER MUST NEVER SEND A TRANSACTION');}
  };
  return p;
}
const get=(f,manifest=MANIFEST,options={})=>
  readArenaV3PublicMatch(provider(f),manifest,1,options);

test('read-only contract client accepts no ambient deployment or arbitrary network',async()=>{
  assert.equal(ARENA_V3_PUBLIC_READER_VERSION,1);
  for(const bad of [
    null,{}, {...MANIFEST,chainId:1},
    {...MANIFEST,address:'0x1234'},
    {...MANIFEST,contract:'SquadGambit'},
    {...MANIFEST,version:2},
    {...MANIFEST,runtimeHash:'0x55'}
  ])await assert.rejects(get(fixture(),bad),/ARENA_V3_READ_INVALID/);
  await assert.rejects(get(fixture({chainId:1})),/wrong network/);
  await assert.rejects(get(fixture({runtime:'0x'})),/nonempty contract runtime/);
  await assert.rejects(get(fixture({runtime:'0x6081'})),/runtime hash mismatch/);
  await assert.rejects(
    readArenaV3PublicMatch(provider(fixture()),MANIFEST,0),
    /match ID/
  );
});

test('new match returns only public waiting state; no chain victory or source trust claim',async()=>{
  const p=provider(fixture());
  const out=await readArenaV3PublicMatch(p,MANIFEST,1);
  assert.equal(out.mode,'arena-v3-readonly-research');
  assert.equal(out.status,'WAITING_FOR_BOTH');
  assert.equal(out.winner,null);
  assert.equal(out.resultHandle,null);
  assert.equal(out.cumulative.challenger,0);
  assert.equal(out.rounds.length,1);
  assert.equal(out.rounds[0].score,null);
  assert.equal(out.trustBoundary,'caller-manifest-must-be-independently-approved');
  assert.ok(Object.isFrozen(out)&&Object.isFrozen(out.rounds));
  assert.deepEqual(p.calls,['matchStatus','roundStatus']);
  for(const secret of ['plans','private','formation','sector','ciphertext',
    'secret','wallet','sourceVerified','transactionHash']){
    assert.equal(JSON.stringify(out).includes('"'+secret+'"'),false);
  }
});

test('single seal remains uns cored and both on-time seals remain resolvable after deadline',async()=>{
  const one=fixture({rows:[row({challengerSealed:true})]});
  const early=await get(one);
  assert.equal(early.status,'WAITING_FOR_OPPONENT');
  assert.equal(early.winner,null);
  const timed=await get({...one,timestamp:200000});
  assert.equal(timed.status,'EXPIRED_INCOMPLETE_NOT_CLOSED');
  assert.equal(timed.cumulative.challenger,0);
  const both=await get(fixture({
    timestamp:200000,
    rows:[row({challengerSealed:true,defenderSealed:true})]
  }));
  assert.equal(both.status,'READY_TO_RESOLVE');
  assert.equal(both.winner,null);
});

test('ready-to-resolve with exact trusted handle means pending KMS proof, not final score',async()=>{
  const x=fixture({
    rows:[row({challengerSealed:true,defenderSealed:true,resolved:true})]
  });
  const p=provider(x);
  const out=await readArenaV3PublicMatch(p,MANIFEST,1);
  assert.equal(out.status,'AWAITING_PROOF');
  assert.equal(out.resultHandle,x.handle);
  assert.equal(out.rounds[0].score,null);
  assert.equal(out.winner,null);
  assert.deepEqual(p.calls,['matchStatus','roundStatus','publicResultHandle']);
  await assert.rejects(get({...x,handle:'0x'+'0'.repeat(64)}),
    /missing public KMS result handle/);
});

test('five finalized authentic bounded aggregates produce one cumulative winner',async()=>{
  const pairs=[[3,1],[0,4],[7,0],[2,5],[1,1]];
  const rows=pairs.map(([a,b],i)=>row({
    openedAt:100000+87000*i,deadlineAt:186400+87000*i,
    challengerSealed:true,defenderSealed:true,
    resolved:true,finalized:true,packedScore:SCORE(a,b)
  }));
  const xa=pairs.reduce((v,[a])=>v+a,0);
  const xb=pairs.reduce((v,[,b])=>v+b,0);
  const out=await get(fixture({
    timestamp:1000000,rows,
    state:{...fixture().state,currentRound:5,complete:true,
      challengerGambitSpent:true,defenderGambitSpent:true,
      cumulativeChallenger:xa,cumulativeDefender:xb}
  }));
  assert.equal(out.status,'COMPLETE');
  assert.equal(out.winner,xa>xb?1:xa<xb?2:0);
  assert.equal(out.rounds.length,5);
  assert.equal(out.rounds.at(-1).score.outcome,0);
  assert.equal(out.cumulative.challenger,xa);
  assert.equal(out.cumulative.defender,xb);
  assert.equal(out.resultHandle,null);
  assert.equal(out.usedGambit.challenger,true);
});

test('abandoned incomplete game preserves earlier rounds without awarding a match winner',async()=>{
  const previous=row({resolved:true,finalized:true,
    challengerSealed:true,defenderSealed:true,packedScore:SCORE(5,2)});
  const current=row({openedAt:190000,deadlineAt:276400,
    challengerSealed:true});
  const out=await get(fixture({
    timestamp:300000,rows:[previous,current],
    state:{...fixture().state,currentRound:2,
      cumulativeChallenger:5,cumulativeDefender:2,abandoned:true}
  }));
  assert.equal(out.status,'ABANDONED_UNSCORED');
  assert.equal(out.complete,false);
  assert.equal(out.winner,null);
  assert.equal(out.cumulative.challenger,5);
  assert.equal(out.rounds[0].score.challenger,5);
  assert.equal(out.rounds[1].score,null);
});

test('malformed score and impossible round state are rejected rather than normalized',async()=>{
  const initial=fixture();
  const bad=[
    fixture({state:{...initial.state,cumulativeChallenger:1}}),
    fixture({rows:[row({resolved:true})]}),
    fixture({rows:[row({finalized:true})]}),
    fixture({rows:[row({packedScore:8})]}),
    fixture({rows:[row({openedAt:0})]}),
    fixture({rows:[row({deadlineAt:186399})]}),
    fixture({rows:[row({challengerSealed:true,defenderSealed:true,
      resolved:true,finalized:true,packedScore:40})]}),
    fixture({state:{...initial.state,complete:true}}),
    fixture({state:{...initial.state,currentRound:0}}),
    fixture({state:{...initial.state,currentRound:6}}),
    fixture({state:{...initial.state,defender:ADDR}}),
    fixture({state:{...initial.state,cumulativeChallenger:36}})
  ];
  for(const specimen of bad)await assert.rejects(get(specimen),
    /ARENA_V3_READ_INVALID/);
});

test('cannot forge finality from a previous round or false abandoned state',async()=>{
  const initial=fixture();
  const cases=[
    // Old round missing signed finalization
    fixture({timestamp:300000,rows:[row(),row({
      openedAt:190000,deadlineAt:276400
    })],state:{...initial.state,currentRound:2}}),
    // Unfinalized fifth cannot be complete
    fixture({timestamp:1000000,rows:Array(5).fill(row()),
      state:{...initial.state,currentRound:5,complete:true}}),
    // Expired abandoned after both accepted orders is contradictory
    fixture({timestamp:300000,rows:[row({
      challengerSealed:true,defenderSealed:true
    })],state:{...initial.state,abandoned:true}}),
    // Abandonment before deadline
    fixture({rows:[row()],state:{...initial.state,abandoned:true}})
  ];
  for(const specimen of cases)await assert.rejects(get(specimen),
    /ARENA_V3_READ_INVALID/);
});

test('single block read detects reorganization and caller abort; no wallet calls',async()=>{
  await assert.rejects(get(fixture({reorgOnSecondBlock:true})),
    /block changed during read/);
  const stop=new AbortController();stop.abort();
  await assert.rejects(get(fixture(),MANIFEST,{signal:stop.signal}),
    /ARENA_V3_READ_ABORTED/);
  const p=provider(fixture());
  const out=await readArenaV3PublicMatch(p,MANIFEST,1);
  assert.equal(out.blockTag,3000);
  assert.equal(out.blockHash,HASH);
  assert.equal(typeof p.getSigner,'function');
  assert.equal(p.calls.every(x=>['matchStatus','roundStatus'].includes(x)),true);
  console.log('GAMBIT_ARENA_V3_READ_ONLY_RESEARCH '+JSON.stringify({
    chain:11155111,source:'test fixture only',
    pinnedRuntime:true,blockCoherent:true,
    inventedWinners:0,privateTacticsExposed:false,
    realV3Deployment:false,walletTransactions:0,signatures:0
  }));
});
