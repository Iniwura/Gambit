# Arena v3 — Invitation Recovery and Execution-Time Round Binding

**Date:** 24 November 2026  
**Branch:** `build/verified-first-slice` · draft PR #5  
**Status:** Invitation/creation source and updated client are **VERIFIED against deterministic fixtures** (235/235 tests). Execution-time Solidity guard implemented, with its new Hardhat regression and full regression gate pending at the time of this record. Not a live v3 deployment.

## Creation and invitations

[`src/arena/invitation.mjs`](../src/arena/invitation.mjs) stages a strictly scoped, unsigned `createMatch` proposal: independently approved deployment manifest, exact distinct challenger/defender addresses, runtime hash, observed canonical block, bounded EIP-1559 fees, zero ETH transfer, immutable review digest. Revalidation verifies the original block and current runtime. The public counter is informational, not a promised ID: other creators may advance it, and the actual ID must come from the receipt.

Invitation tokens contain only a canonical transaction hash (`gambit-v3:0x…`). They confer no wallet authority. Recovery checks the actual direct successful creation transaction and receipt, exact method/calldata, chain ID, sender/recipient, canonical block and minimum three confirmations, unique indexed MatchCreated event from the pinned contract, historical runtime, both participant addresses, current contract state, first-round timestamp and reorganization checks. The reader accepts only a caller-supplied independently approved manifest; no arbitrary URL defines a deployment. Requested participant must match one of the two actual addresses. This does not establish wallet ownership or acceptance by the defender.

[Eleven adversarial tests](../tests/arena-v3-invitation.test.mjs) include concurrent counter changes, invalid fee and review data, counterfeit or duplicate receipt events, nonparticipants, failed/pending transactions, malformed token, historical runtime mismatch, reorganization and expired match without winner. No fixture is live evidence.

## Deployment-blocking execution race and fix

Before this change, four state-changing round methods implicitly used the match's current round. A transaction prepared for round N could be delayed and mined after round N+1 opens. Client-side fresh reads alone cannot eliminate this race between approval and execution.

[`ArenaV3Research.sol`](../fhe/contracts/ArenaV3Research.sol) now requires an explicit `uint8 expectedRound` in all four methods:
- `sealRound(uint256,uint8,bytes32[11],bytes,bool)`
- `resolveRound(uint256,uint8)`
- `finalizeRound(uint256,uint8,uint8,bytes)`
- `expireIncomplete(uint256,uint8)`

The live-round modifier checks the actual current round before any method body, FHE input normalization or proof work. Existing unknown/closed-match guards are preserved. The round intent version is **2**, and the signed calldata (if a future user explicitly approves it) must contain the same round number as the reviewed intent. No previous draft ABI is supported by this new candidate.

The [compiled ABI gate](../scripts/check-arena-v3-client-abi.mjs) now checks creation, the public counter, indexed event and round-bound write signatures, including exact `expectedRound` parameter names/types. [Hardhat regression](../fhe/test/ArenaV3Research.ts) attempts a future-round seal, advances a genuine two-player local FHE mock match, rejects all four stale round writes, checks new-round state and the one-use GAMBIT flag are untouched, and then completes the legitimate next round. The previous five-round and 81-case scoring-oracle tests were updated to use the explicit round parameter. All 58 FHE-operation-containing source lines are unchanged; the [static HCU inventory](../fhe/scripts/hcu-v3-static.ts) is re-pinned to exact Solidity blob `34f13f4221ab5027f3d4b8406933df8acf16c3c6`. This does NOT measure Sepolia HCU, depth or latency.

## Evidence

- [Invitation-only CI run 45322086158](https://github.com/Iniwura/Gambit/actions/runs/45322086158): 235/235 deterministic tests and compiled creation/counter/event ABI check passed. Subsequent contract work superseded that source revision.
- [Round-bound source CI run 45322300119](https://github.com/Iniwura/Gambit/actions/runs/45322300119), code head `b6a0e6e943de4b1c3194887e418eaa27c602746c`: 235/235 deterministic tests passed, zero failures. Inspect this exact run for final Solidity/Hardhat, compiled-client, and browser job conclusions. Do not declare a complete four-job pass until all are successful.
- No deployment, signature, broadcast, actual v3 chain receipt, or live v3 wallet gameplay was attempted. Deployed SquadGambit v2 remains unchanged.

## Next release gate

Confirm the revised contract regression and all quality jobs. Then integrate an explicit selected-account/chain-aware wallet UI, invitation creation/recovery and the actual SDK encryption and KMS proof paths. Assess transaction pacing, live Sepolia HCU/depth and fairness before seeking fresh authorization for deployment. This source change eliminates one execution-time ambiguity but does not by itself establish live readiness. Preserve the four-pillar game roadmap; final graphics remain frozen.
