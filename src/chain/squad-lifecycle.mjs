/**
 * Fail-closed read-only state helpers for the UNDEPLOYED SquadGambit v2.
 * These functions never sign, encrypt, reveal plans or infer finality from a
 * pending wallet popup. Contract state is the only source of authority.
 */
const ZERO='0x0000000000000000000000000000000000000000';
export const SQUAD_INPUT_COUNT=10;
export const SQUAD_EXPIRY_SECONDS=86400n;
const address=value=>typeof value==='string'&&/^0x[0-9a-fA-F]{40}$/.test(value)&&value.toLowerCase()!==ZERO;
const same=(a,b)=>address(a)&&address(b)&&a.toLowerCase()===b.toLowerCase();
const uint=value=>typeof value==='bigint'&&value>=0n;

export function encodeSquadInputs(plans,formation){
  if(!Array.isArray(plans)||plans.length!==3)
    throw Error('Exactly three encrypted fighter plans are required.');
  if(!Number.isInteger(formation)||formation<0||formation>2)
    throw Error('Squad formation must be HOLD, PIVOT or FEINT.');
  const inputs=[];
  for(const plan of plans){
    if(!plan||typeof plan!=='object')throw Error('Invalid fighter plan');
    for(const name of ['base','trigger','response']){
      const value=plan[name];
      if(!Number.isInteger(value)||value<0||value>2)
        throw Error('Invalid '+name+' for encrypted fighter plan');
      inputs.push(BigInt(value));
    }
  }
  inputs.push(BigInt(formation));
  if(inputs.length!==SQUAD_INPUT_COUNT)throw Error('Incorrect encrypted squad length');
  return inputs;
}

export function decodePackedSquadScore(packed){
  if(typeof packed==='bigint'){
    if(packed<0n||packed>255n)throw Error('Invalid packed FHE score');
    packed=Number(packed);
  }
  if(!Number.isInteger(packed)||packed<0||packed>255)
    throw Error('Invalid packed FHE score');
  const challenger=packed>>3,defender=packed&7;
  if(challenger>5||defender>5)
    throw Error('Impossible authenticated squad score');
  return {packed,challenger,defender,outcome:challenger===defender?0:challenger>defender?1:2};
}

export function validateSquadStatus(squad){
  if(!squad||!address(squad.owner)||!address(squad.allowedOpponent)||same(squad.owner,squad.allowedOpponent)
    ||typeof squad.active!=='boolean'||typeof squad.claimed!=='boolean')
    throw Error('Invalid or unknown squad onchain');
  if(squad.active===false&&squad.claimed===false)return 'closed';
  if(squad.claimed===true)return 'consumed';
  return 'inviting';
}

export function canOpenSquad(squad,connectedAddress){
  if(validateSquadStatus(squad)!=='inviting')return false;
  return same(squad.allowedOpponent,connectedAddress);
}

export function squadDuelStep(duel,connectedAddress,nowSeconds){
  if(!duel||!uint(duel.squadId)||duel.squadId===0n||!address(duel.challenger)
    ||!uint(duel.openedAt)||duel.openedAt===0n
    ||typeof duel.submitted!=='boolean'||typeof duel.resolved!=='boolean'
    ||typeof duel.finalized!=='boolean'||typeof duel.expired!=='boolean')
    throw Error('Unknown or invalid squad duel.');
  if((duel.resolved&&!duel.submitted)||(duel.finalized&&!duel.resolved)
      ||(duel.expired&&(duel.submitted||duel.resolved||duel.finalized)))
    throw Error('Contradictory onchain squad state.');
  if(duel.expired)return 'expired';
  if(duel.finalized){
    decodePackedSquadScore(duel.packedScore);
    return 'verified';
  }
  if(duel.resolved)return 'finalize';
  if(duel.submitted)return 'resolve';
  if(typeof nowSeconds!=='undefined'){
    if(!uint(nowSeconds))throw Error('Invalid chain timestamp');
    if(nowSeconds>duel.openedAt+SQUAD_EXPIRY_SECONDS)return 'expired';
  }
  if(!same(duel.challenger,connectedAddress))
    throw Error('Only the invited challenger may submit this squad duel.');
  return 'submit';
}
