/**
 * Maximum possible cost of ONE independently authorized resolveDuel call.
 * Gas quote is read-only. This ceiling is a SAFETY LIMIT, not authorization:
 * the user must separately approve the exact one-time onchain transaction.
 */
export const MAX_DUEL_RESOLVE_FEE_WEI=500000000n;
export function boundDuelResolveFee(gasEstimate,maxFeePerGas,
  maximumWei=MAX_DUEL_RESOLVE_FEE_WEI){
  if(typeof gasEstimate!=='bigint'||gasEstimate<=0n||
    typeof maxFeePerGas!=='bigint'||maxFeePerGas<=0n||
    typeof maximumWei!=='bigint'||maximumWei<=0n||
    maximumWei>MAX_DUEL_RESOLVE_FEE_WEI)
    throw Error('Invalid encrypted resolution fee ceiling');
  const gasLimit=(gasEstimate*120n+99n)/100n;
  const maximumQuotedFeeWei=gasLimit*maxFeePerGas;
  if(maximumQuotedFeeWei>maximumWei)
    throw Error('Encrypted resolution maximum quoted fee exceeds safety cap. No wallet prompt.');
  return Object.freeze({gasLimit,maximumQuotedFeeWei,maximumWei});
}
