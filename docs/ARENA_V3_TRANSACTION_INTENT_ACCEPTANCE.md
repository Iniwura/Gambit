# Arena v3 — Explicit Wallet Action Intent and Fresh-State Guard

**Recorded:** 24 November 2026.  
**Branch:** `build/verified-first-slice`, PR #5 DRAFT.  
**Status:** research implementation committed; GitHub quality run for final copy-integrity tightening pending. **Not a wallet connector and not authorization to deploy or transact.**

## Why this layer exists

The local five-round Hotseat is playable but cleartext and same-device only. The separate five-round FHE contract is Hardhat-mock verified but **not deployed**. The future online Arena must never turn a displayed control or historic public snapshot into an unbounded signing action.

This layer moves the next risk boundary from "construct some wallet calldata" to **"can we make the exact next method, actor, round, ciphertext/proof, fee ceiling and human-readable promise explicit, then revalidate actual public state before offering an unsigned transaction?"**

## Implemented, no wallet side effects

[src/arena/transaction-intent.mjs](../src/arena/transaction-intent.mjs) exports a versioned, fail-closed research intent. It deliberately contains **no injected wallet, signer, personal account request, relayer, contract deployer, transaction broadcast, automatic retry or stale-state fallback**.

It supports exactly **four existing-match operations** in the *undeployed* research contract:

| Intent | Preconditions | Scope of any future unsigned proposal |
| --- | --- | --- |
| `SEAL_ROUND` | Exact invited participant, 11 encrypted bytes32 handles and validated encoded input proof, unsealed seat, open entry window, unused GAMBIT if activated | Participant signs their own private squad only; public activation timing/Boolean displayed, private target sector never rendered |
| `RESOLVE_ROUND` | Both participants have submitted on time; round unresolved | One explicit permissionless resolve, with **no** invented winner |
| `FINALIZE_ROUND` | Exact current round is resolved and not finalized; supplied handle equals the publicly stored handle; bounded packed 0..7 + 0..7 aggregate and a KMS proof | One explicit finalize candidate; **only the Solidity contract** can validate that KMS signature and score |
| `EXPIRE_INCOMPLETE` | Entry deadline passed and one/both participants did not seal; no resolution/finalization | Close the match as **abandoned and UNSCORED**, not a forfeit or free win |

For conservatism the client only lets **invited participants** stage even otherwise permissionless resolve/finalize/expire calls. A future relayer needs a different explicit security review.

**Match creation is not implemented in this policy yet.** That requires a separate approved deployment pin, invited defender address and `nextMatchId`/receipt-binding flow rather than reusing an existing match ID. No fake local `research-...` ID is accepted as an onchain ID.

## Trust and approval semantics

1. `stageArenaV3TransactionIntent` only accepts the reader's versioned public-state shape and a strict request with exactly action, actor, ciphertext/proof payload and **bounded EIP-1559 quote**. Quotes are supplied by an eventual real wallet/fee estimator: **we do not claim to estimate live network gas or HCU here**.
2. The staged **public intent contains NO calldata, private fighter plans, ciphertext handles or input/KMS proofs**. It contains their keccak256 calldata digest, current chain ID, actor, match ID/round, pinned runtime hash, exact original block identity, a public-state fingerprint, maximum fee parameters and explicit review text. The intent ID binds the human-facing summary/warnings/budget text too.
3. The fee rules require canonical decimal-wei strings, no ETH value transfer, gas limit no higher than 20M (a local research cap, **not** an estimated Sepolia allowance), `maxPriorityFeePerGas <= maxFeePerGas`, and `gasLimit * maxFeePerGas <= maximumTotalFeeWei`. An actual wallet screen must independently preserve the cap and display its fee.
4. `revalidateArenaV3UnsignedTransaction` requires the **exact approved intent fingerprint** and fresh re-read via [source/runtime-pinned public reader](../src/arena/public-match-reader.mjs). It checks the originally observed block remains canonical and rejects chain state, participant, round, stake, aggregate or result-handle changes, changed encrypted input/KMS proof, and changed calldata/fingerprint.
5. A later empty chain block is acceptable if the original block stays canonical and the match's **full relevant public state has not changed**. An intervening match update invalidates the previous proposal.
6. Success returns **only an unsigned EIP-1559 transaction request** with fixed from/to/chain/fee/value/data and `signed:false`, `sent:false`. A future wallet adapter must independently gate it behind a genuine user gesture, selected account, wallet chain check, method/cap display, and user-approved signature. **A JavaScript string matching an intent fingerprint is not cryptographic proof that a human consented.**
7. Contract state can change again after preflight and before mining. The contract must always enforce its own participant/deadline/proof/state invariants. The preflight is **not atomic finality**, nor an externally approved manifest or trustless light client.

## Compiled ABI parity

[scripts/check-arena-v3-client-abi.mjs](../scripts/check-arena-v3-client-abi.mjs) compares the **actual compiled ArenaV3Research artifact** with the handwritten client selectors/argument and output types for four write methods and three public readers. It rejects a view/write mismatch or wrong 11-input encrypted payload signature. It is wired as a mandatory step in the Phaser build quality job after contract artifact generation.

**Still unknown:** actual v3 HCU/depth, privacy against a live adversary, real second-wallet signature UX, KMS proof delivery/finality, recovery across page refresh, second-mover stake fairness, 21-signature match friction, fee quoting/rates and independent audit.

## Exact QA evidence and failures

[Adversarial Node suite](../tests/arena-v3-transaction-intent.test.mjs) uses a fake ABI-coded read-only provider and covers all four operations, exact ciphertext and KMS proof binding, unauthorized actors, duplicate seal, used GAMBIT, expired incomplete rounds, fee-cap violations, malformed data, stale public match, original block reorg, blank intervening block, mutated human approval text, absent consent fingerprint and no signing/network writes.

The **first CI run** was red from a test expecting the longer phrase "exact encrypted seal payload" while the code correctly refused an extra private field as "encrypted seal payload"; test and message are now aligned. The state-safety condition was never bypassed. [First run 45320074365](https://github.com/Iniwura/Gambit/actions/runs/45320074365). Final evidence link and counts must be added only after the latest run is complete.

## Next meaningful functional gates

- Specify the **match creation / real invited-player authorization** path using a separately approved deployment manifest, fresh `nextMatchId`, receipt/event linkage and no impersonation.
- Integrate explicit selected-wallet UI approval, account and chain rechecks, fee estimate and bounds **without any automatic signing**. No network write without a new explicit transaction scope and authorization.
- Test real FHE encrypted input preparation, public relayer KMS signatures, and canonical receipts in an approved testnet deployment before calling this real multiplayer.
- Refine second-mover advantage, one-use GAMBIT timing privacy, cancelled invites and 21-write pacing; preserve entire four-pillar architecture and keep graphics frozen.

**Current privacy boundary:** the local Hotseat retains plain tactics in same-device JS memory; the intent guard only accepts opaque ciphertext and proof bytes. Neither is a real encrypted two-wallet live game yet.
