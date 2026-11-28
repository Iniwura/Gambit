/**
 * GAMBIT Commander Profile deployment trust root (Phase 1).
 *
 * A hash supplied by an arbitrary web caller is NOT a trusted deployment.
 * Only independently verified and explicitly approved GAMBIT deployments may
 * contribute public ranked match history. Versioned upgrades need review,
 * onchain evidence, a new immutable registry entry and matching tests.
 *
 * This is not dynamic discovery, not a permissionless leaderboard and not
 * an authorization for any wallet or transaction.
 */
import {getAddress} from 'ethers';

export const TRUSTED_SQUAD_GAMBIT_SEPOLIA=Object.freeze({
  chainId:11155111,
  contractAddress:getAddress('0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134'),
  runtimeHash:'0x94754bf634ba275b7a2f047483854553cbdfad51b15209477b467220b576f419',
  fromBlock:12174655,
  minimumConfirmations:12,
  deploymentTransaction:'0x058a2e70401e5cd685895c4ef1cc6ee86d9aeaa8ad93f30fb39832d58f3da00a',
  contract:'SquadGambit',
  version:'v2'
});
const allowed=[TRUSTED_SQUAD_GAMBIT_SEPOLIA];
const equalAddress=(a,b)=>typeof a==='string'&&
  getAddress(a)===getAddress(b);
const equalHash=(a,b)=>typeof a==='string'&&
  /^0x[0-9a-fA-F]{64}$/.test(a)&&a.toLowerCase()===b.toLowerCase();

/**
 * Explicitly reject arbitrary address/hash/fromBlock pairs, even when
 * the unapproved contract has perfectly consistent mock event/state data.
 * User may request more confirmations (not fewer than registry minimum).
 */
export function approveGambitProfileDeployment(config){
  if(!config||typeof config!=='object'||Array.isArray(config))
    throw Error('PROFILE_UNTRUSTED_DEPLOYMENT missing pin');
  const matches=allowed.filter(item=>{
    try{
      return equalAddress(config.contractAddress,item.contractAddress)&&
        equalHash(config.runtimeHash,item.runtimeHash)&&
        config.fromBlock===item.fromBlock&&
        (config.chainId===undefined||config.chainId===item.chainId);
    }catch{return false}
  });
  if(matches.length!==1)
    throw Error('PROFILE_UNTRUSTED_DEPLOYMENT unrecognized GAMBIT deployment');
  const pin=matches[0];
  const confirmations=config.minimumConfirmations??pin.minimumConfirmations;
  if(!Number.isSafeInteger(confirmations)||
    confirmations<pin.minimumConfirmations||confirmations>5000)
    throw Error('PROFILE_UNTRUSTED_DEPLOYMENT unsafe confirmation policy');
  return Object.freeze({
    chainId:pin.chainId,
    contractAddress:pin.contractAddress,
    runtimeHash:pin.runtimeHash,
    fromBlock:pin.fromBlock,
    minimumConfirmations:confirmations
  });
}
export function listApprovedGambitDeployments(){
  return Object.freeze(allowed.map(d=>Object.freeze({...d})));
}
