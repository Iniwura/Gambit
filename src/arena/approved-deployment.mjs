/**
 * Independently verified Arena v3 Sepolia deployment.
 *
 * This is a source-pinned public manifest, not a wallet credential and not
 * proof that a live match has been completed. Any change requires a fresh
 * receipt, block, and runtime review before the lobby can use it.
 */
export const APPROVED_ARENA_V3_DEPLOYMENT=Object.freeze({
  contract:'ArenaV3Research',
  version:1,
  chainId:11155111,
  address:'0xBF56087EFF029594beeFf1B57B47b1419bCDF16b',
  runtimeHash:'0xf4f31fff6b4ec7f90e573bba95362a49d43ffeb12d971f515cef6301afbde8a9'
});

export function approvedArenaV3Deployment(){
  return APPROVED_ARENA_V3_DEPLOYMENT;
}
