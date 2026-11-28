/**
 * Risk ceiling for ONE encrypted SquadGambit challenger submission.
 * This guards the browser before requesting a wallet signature.
 * It is NOT consent or authority to send a transaction.
 */
export const MAX_DUEL_SUBMIT_FEE_WEI=500000000n;

export function boundDuelSubmitFee(gasEstimate,maxFeePerGas,
  approvedMaximumWei=MAX_DUEL_SUBMIT_FEE_WEI){
  if(typeof gasEstimate!=='bigint'||gasEstimate<=0n||
    typeof maxFeePerGas!=='bigint'||maxFeePerGas<=0n||
    typeof approvedMaximumWei!=='bigint'||approvedMaximumWei<=0n||
    approvedMaximumWei>MAX_DUEL_SUBMIT_FEE_WEI)
    throw Error('Invalid one-time encrypted submission fee ceiling');
  const gasLimit=(gasEstimate*120n+99n)/100n;
  const maximumFeeWei=gasLimit*maxFeePerGas;
  if(maximumFeeWei>approvedMaximumWei)
    throw Error('Encrypted submission maximum quoted fee exceeds cap; no wallet prompt.');
  return Object.freeze({gasLimit,maximumFeeWei,approvedMaximumWei});
}
