/**
 * Safety ceiling for exactly ONE separately approved finalizeDuel(1) call.
 * Cost is buffered gas estimate × fresh maxFeePerGas before wallet request.
 * This is NOT authorization and never causes a transaction by itself.
 */
export const MAX_DUEL_FINALIZE_FEE_WEI=500000000n;
export function boundDuelFinalizeFee(estimatedGas,maxFeePerGas,
  maximumWei=MAX_DUEL_FINALIZE_FEE_WEI){
  if(typeof estimatedGas!=='bigint'||estimatedGas<=0n||
    typeof maxFeePerGas!=='bigint'||maxFeePerGas<=0n||
    typeof maximumWei!=='bigint'||maximumWei<=0n||
    maximumWei>MAX_DUEL_FINALIZE_FEE_WEI)
    throw Error('Invalid finalization fee ceiling');
  const gasLimit=(estimatedGas*120n+99n)/100n;
  const maximumQuotedFeeWei=gasLimit*maxFeePerGas;
  if(maximumQuotedFeeWei>maximumWei)
    throw Error('Finalization maximum quoted fee exceeds safety ceiling; no wallet prompt.');
  return Object.freeze({gasLimit,maximumQuotedFeeWei,maximumWei});
}
