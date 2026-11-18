# GAMBIT — Game Studio Production Plan

**Created:** 2026-11-18  
**Internal stretch target:** 2026-11-22 (Sunday)  
**Official submission deadline:** 2026-12-14 (verify before submitting)  
**Status:** PRE-ALPHA. No verified Phaser release, no compiled FHE contract, no verified Sepolia match.

## Goal
Release one small but outstanding top-down confidential tactics game. Do not confuse source code with a functioning game, local RNG with onchain randomness, or a visual sample with playable product.

## Professional production stages and evidence gates

| Stage | Work | Acceptance evidence |
| --- | --- | --- |
| 0. Pre-production | One-page GDD, player fantasy, core loop, audience, match length, technical risk register | Locked rules, written why FHE is essential, testable win/fail cases |
| 1. Greybox + systems | Phaser world scene, action input, one authoritative deterministic simulation, two game adapters | Browser loads; complete practice match; restart, replay, no JS errors |
| 2. Confidential proof | Official Zama Hardhat template, encrypted counter-conditional logic, ACL review, parity tests | Contract compiles; negative tests and parity tests green; signed public-decryption verification |
| 3. Full vertical slice | Browser wallet, 2 players / asynchronous match, secret inputs, FHE resolve, authenticated public result, animation and match summary | Real two-wallet Sepolia match, chain links, capture of complete flow |
| 4. Production + polish | Responsive HUD, clear tactical feedback, stable animations, sound, accessibility, reconnect/retry, error states | Blind playtest, desktop/mobile browser QA, performance evidence |
| 5. RC audit and submission | Independent gameplay/security/code review, README, video, X post, official form | No known critical defects; working live URL; real-person three-minute pitch; artifact links |

## Scope for this week (four days remaining)

| Day | Hard priority | Proof needed |
| --- | --- | --- |
| Wed Nov 18 | Audit and repair repo structure, pull in the real Phaser source/assets, pin dependencies, launch CI | `npm ci`, typecheck, build, engine tests, real browser boot |
| Thu Nov 19 | Contract compile against current official template; 729-plan parity against reference + adversarial tests | Genuine Hardhat logs, rejected bad permissions/replay, public-decrypt test |
| Fri Nov 20 | Wire browser wallet/new Zama SDK (`@zama-fhe/sdk`) to match lifecycle and deploy to Sepolia | Two wallets submit encrypted plans, transaction hashes and verified outcome |
| Sat Nov 21 | Join chain result to match renderer; timeout/error/reconnect workflows; full rematch loop | 3 complete real matches and negative-path evidence |
| Sun Nov 22 | Independent QA, newcomer playtests, final blocker triage, freeze credible RC only if gates pass | Evidence matrix complete, no P0/P1 failures, documented release verdict |

The user requested completion before next week. This is an aggressive internal production target; NOT a guarantee that an advanced game and FHE integration can be finished to competition quality in four days. Protect the quality gate even when the date is missed.

## Current audited gaps (as of plan authoring)

- GitHub repository contains README, rules reference, layout and tests, **but not the full Phaser game source / binary art pack**; there is no verified production build.
- Current reference engine reduces an encounter to one ternary base/trigger/response pair per side. Three character drawings are not three autonomous gameplay units. A deeper squad layer must be designed and tested before asserting 'advanced 3v3'.
- FHE candidate is a research draft; NOT compiled, security-audited or deployed. Its APIs and decryption proof structure must be checked against the latest official Zama template.
- No wallet or current Zama SDK integration, signed finalization, canonical Sepolia receipt, lobby/challenge lifecycle, reconnect, or proof-driven replay.
- Existing visuals are illustrations and local browser experiments, not a shipped or browser-verified Phaser 4 release.
- Repo is currently **PUBLIC** as created by the owner; do not commit secrets.

## Highest-risk architectural decision

**Never process every movement or animation frame onchain.** The source of truth for decisions is the FHE contract; Phaser only visualizes the authenticated result. Use asynchronous planning / commit / resolve / finalize stages so decryption latency does not destroy game pacing.

**Match state machine:** `CREATED -> A_SUBMITTED -> BOTH_SUBMITTED -> RESOLVED -> PROOF_RECEIVED -> FINALIZED -> ANIMATED -> COMPLETE`, plus `EXPIRED` and `FAILED_RECOVERABLE`. Explicit retry/timeout semantics required.

## Release checklist
- Functional gameplay: first meaningful input quickly; match complete; replay/restart; genuine strategy affects win rates.
- Cryptography: encrypted inputs, per-match permissions, correct FHE operations, allowed disclosure, proof verification, rejection of forged results.
- Fairness: deterministic rule parity, no late edits, no double submissions, no strategic peeking. If chance added, use verifiable onchain encrypted RNG, not `Math.random()`.
- UX: casual player understands goal and next step, smooth transition from practice to onchain, no wallet needed for initial practice.
- Reliability: desktop/mobile, slow network, rejected signature, dropped RPC, stale proof, page refresh, pending finality.
- Submission: real person explains gameplay + FHE necessity in three minutes, public repository, demo URL and Sepolia evidence.

## Decision at Sunday gate
- `GO`: all P0 gates actually verified. Proceed to independent audit, demo polishing and submission packaging.
- `NO-GO`: report precise blocker and remaining work, no claim of production-readiness. Continue toward official Dec 14 deadline with quality protected.

## Important SDK version decision (18 Nov 2026)

Zama ended maintenance of the **legacy** `@zama-fhe/relayer-sdk` on **6 November 2026**. New GAMBIT integrations must use `@zama-fhe/sdk` (core SDK) plus a wallet adapter (ethers/viem), not the obsolete `initSDK/createInstance` approach. Official guide: https://github.com/zama-ai/sdk/blob/main/docs/gitbook/src/tutorials/quick-start.md

Current npm package checked on 18 Nov: `@zama-fhe/sdk` **3.8.0**. Actual custom FHE contract input/public-decrypt method integration remains unverified and requires SDK-specific tests. Do not assume the new SDK uses identical low-level APIs as the old Relayer SDK.
