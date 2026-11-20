# GAMBIT — first real Sepolia duel acceptance playbook

**Current release gate: BLOCKED ON EXPLICIT WALLET AUTHORIZATION.**

This guide describes what must be independently executed and recorded before we claim playable onchain confidentiality. It does not authorize any signatures. The deployed contract is the experimental one-strategy-per-side `SealedGambit`, **not** a full three-role or five-round game.

## Locked environment
- Chain: Ethereum Sepolia, `11155111`.
- Contract: `0x12adc9f3860FB20E9655197386CDFc1DD78FF0c0`.
- Defender deployment wallet: `0x7d567Fa1d5fe35737BbF045f47667e13298Ee176`.
- First synthetic test policy: `(base=0, trigger=1, response=2)`. These clear values are public in the source. This test establishes encrypted-input plumbing, **not secrecy**.
- Fresh approval for exactly one defender seal is required. Maximum estimated transaction fee enforced by `fhe/scripts/seal-policy-sepolia.ts`: **0.0005 Sepolia ETH**. Previous deployment permission is not transferable.

## Acceptance sequence

1. **Defender preflight (read only)** — from the existing secure CLI environment, check chain, expected signer, deployed code, balance, and configured cap. Never copy, print or share wallet private keys. If any check fails, stop.
2. **Defender seal (one approved transaction)** — only after a fresh approval, use `cd fhe && GAMBIT_APPROVE_ONE_SEAL=YES_SEPOLIA_TEST_ONLY npm run seal:sepolia`. Record actual `PolicySealed` event, policy ID, receipt success, owner and active state. Do not spend without approval.
3. **Second wallet** — a *different* funded Sepolia address must connect in the browser preview. Owner cannot challenge themself. This is a separate permission and funding decision.
4. **Open** — second wallet signs `openChallenge(policyId)`. Record `ChallengeOpened`, returned ID and onchain challenger identity. If cancelled after opening, save challenge ID.
5. **Submit** — challenger encrypts their own selected three-action tactic with maintained `@zama-fhe/sdk` and signs `submit`. Check `challengeStatus.submitted`. Missing or wrong-wallet proof must fail.
6. **Compute** — authorize a transaction to `resolve` and compare `publicResultHandle` with `ChallengeReady` event. Opponent's private values must not be revealed.
7. **Decrypt and finalize** — obtain signed public decryption from Zama's KMS and call `finalize`. Confirm `ChallengeFinalized` event, `finalized=true`, onchain `finalOutcome` and replay rejection. Invalid outcome/proof must be rejected.
8. **Resume and watch** — reload the browser at each stage. Confirm the existing challenge continues without double submission or double resolution, and the Phaser verified-duel view appears only after authenticated finalization.

## Evidence required

The publicly shareable record must include exact sender addresses, policy and challenge IDs, successful transaction hashes, blocks, event topics, result handle, final result, timestamp, and explorer links. Do not publish raw wallet secrets or sensitive strategy plaintexts. A successful mock test or READY Vercel preview is **not** evidence of these live calls.

## Do not conflate the stages

- **Deployment proof:** already complete.
- **First encrypted seal:** still awaiting explicit transaction approval.
- **Two-wallet encrypted duel:** NOT complete.
- **Multi-round gameplay and meaningful 3-role combat:** NOT complete.
- **Production privacy:** NOT established; repeated-result queries against 27-policy possibilities are a strategy-inference risk.

The first live seal uses one defender signature. Every additional challenger, compute, and finalize transaction requires its own explicit authorization in the relevant wallet or secure environment.
