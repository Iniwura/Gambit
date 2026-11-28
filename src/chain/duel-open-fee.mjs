/**
 * Upper bound for one interactive SquadGambit v2 challenge opening.
 * This is a programmatic SAFETY CEILING, not a user authorization.
 * All amounts are Sepolia wei; the real wallet must separately approve.
 */
export const MAX_DUEL_OPEN_FEE_WEI=200000000n;

export function boundDuelOpenFee(estimatedGas,maxFeePerGas,maximumFeeWei=MAX_DUEL_OPEN_FEE_WEI){
  if(typeof estimatedGas!=='bigint'||estimatedGas<=0n||
     typeof maxFeePerGas!=='bigint'||maxFeePerGas<=0n||
     typeof maximumFeeWei!=='bigint'||maximumFeeWei<=0n||
     maximumFeeWei>MAX_DUEL_OPEN_FEE_WEI)
    throw Error('Invalid or unsafe one-duel opening fee limit.');
  const gasLimit=(estimatedGas*120n+99n)/100n;
  const maxQuotedFeeWei=gasLimit*maxFeePerGas;
  if(maxQuotedFeeWei>maximumFeeWei)
    throw Error('The maximum quoted duel-opening gas fee exceeds the safety cap; no wallet prompt.');
  return Object.freeze({gasLimit,maxQuotedFeeWei,maximumFeeWei});
}
