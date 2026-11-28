/**
 * Pure, onchain-state-driven recovery logic. Never infer success from a tx
 * prompt, local storage, relayer response, or a remembered wallet session.
 */
export function challengeStep(status, connectedAddress) {
  if (!status || typeof status.policyId !== 'bigint' || status.policyId <= 0n ||
      typeof status.challenger !== 'string' ||
      !/^0x[0-9a-fA-F]{40}$/.test(status.challenger) ||
      /^0x0{40}$/i.test(status.challenger)) {
    throw new Error('Unknown challenge ID. Check the number on Sepolia.');
  }
  if (status.expired) throw new Error('This challenge has expired and cannot be continued.');
  if (status.finalized) return 'verified';
  if (status.resolved) return 'finalize';
  if (status.submitted) return 'resolve';
  if (!connectedAddress ||
      status.challenger.toLowerCase() !== connectedAddress.toLowerCase()) {
    throw new Error('Connect the wallet that opened this challenge to submit its tactic.');
  }
  return 'submit';
}
