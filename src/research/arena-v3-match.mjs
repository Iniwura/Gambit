/**
 * GAMBIT ARENA v3 — LOCAL RESEARCH MATCH STATE MACHINE (NOT ONCHAIN).
 *
 * Five sequential encrypted-match DESIGN rounds are modelled using the
 * proven cleartext reference. This is architecture/test research ONLY.
 *
 * The internal state contains private PLAN DATA, so it must NEVER be
 * serialized to public logs or profile records. Call publicArenaV3Snapshot
 * for allowlisted aggregate results. An eventual FHE contract must receive
 * ciphertext instead of this local prototype's plaintext plans.
 *
 * NO wallet, RPC, signer, KMS, contract, private key or automatic action.
 */
import {
  validateSquadPlans,validateFormation,resolvePositionedSquadTurn
} from '../squad.mjs';
import {scoreGambitCommitment} from './gambit-commitment-v0.mjs';

export const ARENA_V3_RESEARCH_ROUNDS=5;
const SIDES=['challenger','defender'];
const isSide=side=>SIDES.includes(side);
const cleanScore=s=>Number.isInteger(s)&&s>=0&&s<=7;
const freezeOrders=(plans,formation,stakeSector)=>{
  const normalized=validateSquadPlans(plans)
    .map(plan=>Object.freeze({...plan}));
  validateFormation(formation);
  if(stakeSector!==null&&
    (!Number.isInteger(stakeSector)||stakeSector<0||stakeSector>2))
    throw Error('Invalid GAMBIT research commitment sector');
  return Object.freeze({
    plans:Object.freeze(normalized),formation,stakeSector
  });
};
function validateState(state){
  if(!state||state.mode!=='arena-v3-local-research'||state.version!==1||
    !Number.isInteger(state.round)||state.round<1||
    state.round>ARENA_V3_RESEARCH_ROUNDS||
    !['planning','ready-to-settle','finished'].includes(state.status)||
    !Number.isInteger(state.scoreA)||state.scoreA<0||state.scoreA>35||
    !Number.isInteger(state.scoreB)||state.scoreB<0||state.scoreB>35||
    !Array.isArray(state.history)||state.history.length>ARENA_V3_RESEARCH_ROUNDS||
    !state.pending||!state.usedGambit)
    throw Error('Invalid v3 local research match');
  if(state.status==='finished'&&
     (state.history.length!==ARENA_V3_RESEARCH_ROUNDS||
      state.round!==ARENA_V3_RESEARCH_ROUNDS))
    throw Error('Incomplete v3 local research result');
}
const snapshot=(state)=>Object.freeze({
  ...state,
  pending:Object.freeze({...state.pending}),
  usedGambit:Object.freeze({...state.usedGambit}),
  history:Object.freeze([...state.history])
});
export function makeArenaV3ResearchMatch(matchId){
  if(typeof matchId!=='string'||!/^research-[a-z0-9-]{1,48}$/.test(matchId))
    throw Error('Research match requires a non-empty research-only ID');
  return snapshot({
    mode:'arena-v3-local-research',version:1,matchId,round:1,
    status:'planning',scoreA:0,scoreB:0,winner:null,
    pending:{challenger:null,defender:null},
    usedGambit:{challenger:false,defender:false},history:[]
  });
}
export function submitArenaV3ResearchOrder(state,side,order){
  validateState(state);
  if(state.status!=='planning'||!isSide(side))
    throw Error('Not accepting that v3 research order');
  if(state.pending[side]!==null)
    throw Error('Duplicate order for current round');
  if(!order||typeof order!=='object'||Array.isArray(order))
    throw Error('Missing local research order');
  const packed=freezeOrders(order.plans,order.formation,order.stakeSector??null);
  if(packed.stakeSector!==null&&state.usedGambit[side])
    throw Error('GAMBIT once-per-match stake already consumed');
  const usedGambit={...state.usedGambit,
    [side]:state.usedGambit[side]||packed.stakeSector!==null};
  const pending={...state.pending,[side]:packed};
  return snapshot({...state,pending,usedGambit,
    status:pending.challenger&&pending.defender?'ready-to-settle':'planning'});
}
export function settleArenaV3ResearchRound(state){
  validateState(state);
  if(state.status!=='ready-to-settle'||
    !state.pending.challenger||!state.pending.defender)
    throw Error('Both private research orders are required');
  const {challenger,defender}=state.pending;
  const resolved=resolvePositionedSquadTurn(
    challenger.plans,defender.plans,
    challenger.formation,defender.formation);
  const scored=scoreGambitCommitment(
    resolved,challenger.stakeSector,defender.stakeSector);
  if(!cleanScore(scored.pointsA)||!cleanScore(scored.pointsB))
    throw Error('Invalid bounded v3 candidate round score');
  const scoreA=state.scoreA+scored.pointsA;
  const scoreB=state.scoreB+scored.pointsB;
  const event=Object.freeze({
    round:state.round,pointsA:scored.pointsA,pointsB:scored.pointsB,
    packed:scored.packed,outcome:scored.outcome,
    cumulativeA:scoreA,cumulativeB:scoreB
  });
  const history=[...state.history,event];
  const done=history.length===ARENA_V3_RESEARCH_ROUNDS;
  return snapshot({...state,
    scoreA,scoreB,round:done?state.round:state.round+1,
    status:done?'finished':'planning',
    winner:done?(scoreA===scoreB?0:scoreA>scoreB?1:2):null,
    pending:{challenger:null,defender:null},history
  });
}
/**
 * Only aggregate public fields: never return plans, sectors, hidden
 * formation, wallet material or intermediate lane outcomes.
 */
export function publicArenaV3Snapshot(state){
  validateState(state);
  return Object.freeze({
    mode:'arena-v3-aggregate-research',
    version:1,
    matchId:state.matchId,round:state.round,status:state.status,
    scoreA:state.scoreA,scoreB:state.scoreB,
    winner:state.winner,
    history:Object.freeze(state.history.map(e=>Object.freeze({
      round:e.round,pointsA:e.pointsA,pointsB:e.pointsB,
      packed:e.packed,outcome:e.outcome,
      cumulativeA:e.cumulativeA,cumulativeB:e.cumulativeB
    })))
  });
}
