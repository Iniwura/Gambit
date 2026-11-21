# Arena v3 — Strict Read-Only Public Match Recovery Adapter

**Date:** 22 November 2026 (Lagos) · **Branch:** `build/verified-first-slice`, PR #5 DRAFT.  
**Status:** **VERIFIED source-level/fixture-backed research**, [4/4 full quality run 44962888818](https://github.com/Iniwura/Gambit/actions/runs/44962888818), 212/212 Node tests. **No v3 deployment exists in this repo; no live v3 match was inspected.**

## Purpose

The eventual two-wallet Arena requires a reliable way to re-open its exact public round state after losing a receipt or closing the game. A UI must not accept an arbitrary match ID, RPC JSON or unsigned data as proof of a competitive win.

The [public match reader](../src/arena/public-match-reader.mjs) works *only* when its caller supplies an approved `ArenaV3Research` deployment manifest with Ethereum Sepolia chain ID 11155111, one exact contract address and expected keccak256 runtime hash. **There is intentionally no built-in default v3 address.** The reader verifies data *against the provided manifest*, but cannot prove that a manifest provided by the caller is legitimate. Before release, pin a reviewed manifest inside the application using a real signed deployment record, never rely on an arbitrary address chosen in a URL or form.

## Fail-closed read contract

- The adapter only accepts a read-only ethers-compatible provider. It has **no signer, wallet connect, encryption, upload, transaction creation, automatic retry or onchain write**.
- It checks chain ID, nonempty runtime at the exact address, and byte-for-byte runtime **hash** at one selected block.
- It reads `matchStatus(matchId)` and every `roundStatus(matchId,round)` using `eth_call` at that same block tag. It verifies the block hash again at the end, so a changed block during a read is refused.
- Rejects invalid distinct participant addresses, impossible round numbers, bad round timestamps and non-24-hour entry windows, resolved status without two seals, finalized without resolve, a nonzero *unfinalized* score, unfinalized historical rounds and sums inconsistent with the contract's cumulative totals.
- A full result is allowed only if the contract reports **all five rounds finalized**, correctly bounded v3 0..7 per-team scores, and a consistent cumulative winner/draw. A partial, expired or abandoned match has **winner = null** even when prior rounds are genuinely finalized.
- If both players sealed and resolution occurred, the read-only exact stored KMS result handle is available for a future *separately authorized* proof recovery. No public round score is inferred from an encrypted handle before finalization.
- An incomplete expired match is **EXPIRED_INCOMPLETE_NOT_CLOSED**, not final. Contract-confirmed abandonment is **ABANDONED_UNSCORED**; never automatically a forfeit win.
- The returned immutable public allowlist includes only the validated block identity, participants, round flags/times, non-secret one-use wager activation flags, finalized aggregates and cumulative totals. No role orders, hidden target sector, private formation, calldata, wallet key or invented transaction receipt.

**Trust boundary:** A single RPC and caller-supplied manifest are not a trustless light-client verification. A genuine v3 release needs an independently approved immutable deployment pin, receipt/event checks, confirmations/reorg policies, and a public independent verifier. This module is one **read-only architectural component**, not a production-grade achievement oracle.

## Exact tests

[Adversarial Node tests](../tests/arena-v3-public-reader.test.mjs) use a simulated ethers-compatible provider that returns exact ABI-coded contract data. They cover the initial waiting stage, single player seal, expired unscored round, dual seal after deadline, proof-ready handle, five valid finalized aggregates, incomplete abandonment, invalid score/flags/participants, runtime mismatch, wrong chain, reorged block, caller AbortSignal and no wallet methods.

**[CI 44962888818](https://github.com/Iniwura/Gambit/actions/runs/44962888818) PASSED 4/4:** **212/212 deterministic Node tests**, **25/25 FHE Hardhat mock tests**, Phaser/TypeScript compilation, source-locked HCU inventory, actual desktop/mobile local Hotseat and prior Academy/BLACKSITE/Profile/tablet/wallet negative browser regressions. The new v3 public-reader tests are fixture-backed, NOT actual Sepolia v3 contract reads.

## Next required engineering milestones

1. Define a versioned, minimal **explicit transaction intent** and signing guard after fresh runtime/hash/round checks: never automatically perform create/seal/resolve/finalize/expire; no private tactics leave the browser before encrypted payload construction.
2. Connect a real **two-wallet, human-in-the-loop** lobby with fee bounds, invitation consent, signer identity, round-specific order encryption, asynchronous KMS proof retrieval and transparent recovery. No simulated opponent or silent replay.
3. Independently measure Sepolia **HCU/depth, EVM costs, latency and 21-action game friction**; do security and second-mover fairness review. Only then request separate authorization for any v3 deployment or transactions.
4. Integrate canonical signed receipts and confirmed finality into a durable opt-in Commander Profile without turning local training into a ranked achievement.

**Still open:** real five-round encrypted multiplayer, competitive BLACKSITE, persistent identity/profile, outside-player UX validation and premium game art/sound. Current deployed SquadGambit v2 remains unchanged. No network write was made in this milestone.
