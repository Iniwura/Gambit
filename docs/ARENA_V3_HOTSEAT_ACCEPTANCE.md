# Arena v3 — Two-Commander LOCAL Hotseat Acceptance

**Date:** 22 November 2026 (Lagos).  
**Branch:** `build/verified-first-slice` · draft PR #5.  
**Status:** **VERIFIED functional same-device five-round local multiplayer**, [4/4 CI run 44962022483](https://github.com/Iniwura/Gambit/actions/runs/44962022483).  
**Product boundary:** real two-commander *local cleartext reference gameplay*, NOT encrypted online multiplayer, deployed Arena v3 or user-authenticated competition.

## Player journey

The optional **ARENA · LOCAL HOTSEAT** launcher is available on desktop and inside the real mobile command deck. It opens a dedicated modal without restarting the underlying Phaser local-practice game. Both players see the same public score and five-round history.

1. Begin a **LOCAL, wallet-free** match, without transaction, wallet, RPC or contract.
2. Challenger chooses an independent three-role policy: three base actions, three triggers, three conditional responses, a formation, and an optional once-per-match secret visual-lane GAMBIT.
3. Challenger explicitly locks. The form controls are physically removed from the DOM before the handoff screen appears. The defender must acknowledge the handoff rather than receiving a fake auto-submission.
4. Defender independently chooses and locks another three-role plan. If GAMBIT was already used in a previous round, the stake field is disabled.
5. A separate explicit action settles the actual v3 local research reference with both submitted plans, real formation/role effects, per-side aggregate points and a true cumulative score. Only the **public aggregate** is shown; individual lane results, the other player’s tactics and hidden sectors are not.
6. After an explicit after-action review, the next round begins with two new decisions. At round five the real final score and winner or draw appear. The user can rematch from a new local session.
7. Close/Escape restores control of the existing game. Reopening the same tab resumes a sealed handoff or match. Refresh discards the local session; no secret order or wallet address is persisted.

**Privacy warning:** the browser retains sealed cleartext tactics in in-memory JavaScript for calculation. Removing HTML controls during a same-device handoff protects only the *ordinary screen*, **not** against browser developer tools, the device owner or malicious scripts. This is not cryptographic privacy.

## Code and invariants

- [Immutable handoff controller](../src/arena/hotseat-controller.mjs): wraps the existing five-round [v3 reference domain](../src/research/arena-v3-match.mjs); prevents skipped handoff, forged settlement action, duplicate submit and auto-settling.
- [Accessible modal/player forms](../src/arena/hotseat-ui.ts), [responsive CSS](../src/arena/hotseat.css). Controls use native buttons and selects, visible focus, Escape, bounded two-confirmation discard, active overlay isolation and no private-plan serialization.
- [Game shell](../src/architecture/game-shell.mjs): explicitly enables **arena-v3-hotseat** with authority **local-two-player-cleartext**; **arena-competitive** remains disabled.
- [Pure adversarial tests](../tests/arena-hotseat-contract.test.mjs): real five-round play; separate authentic submissions; once-only GAMBIT; committed input immutability; public allowlist; refusal of duplicates, skipped steps, unsupported wallet actions and forged result progression.
- [Native desktop/mobile/tablet Chromium E2E](../tests/arena-hotseat-browser-check.mjs): two authentic submitted orders per round, one activation per player, removed prior DOM controls, close/reopen recovery, honest aggregate score, full five-round endgame, unchanged original Phaser game and no wallet.
- CI prioritizes the new Hotseat browser test **before** the longer pre-existing flows, then runs the full game, BLACKSITE, Profile, Academy, 710px/820px launcher and wallet-safety regression checks.

## Exact acceptance

[GitHub run 44962022483](https://github.com/Iniwura/Gambit/actions/runs/44962022483):

- **Four of four full quality jobs SUCCESS:** Node deterministic rules, Phaser/TypeScript build, FHEVM compilation and Hardhat mocks, actual desktop/mobile Chromium UI.
- **203/203 deterministic Node tests PASS**; **25/25 existing FHE mock tests PASS** (including 81 independent encrypted formation/sector oracle checks); static source-pinned HCU model also passed. These FHE checks do not encrypt the LOCAL Hotseat session.
- **1280×850 desktop and 390×844 mobile:** each completed **five genuine local rounds**, two separately accepted squad decisions per round, **3 : 17 actual local match score**, one-use Challenger and Defender GAMBIT, no scripted victory, no wallet transactions or uncaught page errors.
- **820px and 710px tablet:** launcher had a real unoccluded hit target, opened and closed correctly with zero page errors. The existing Academy launcher also remained unobstructed.
- **Regression suite:** five-round Tactical Academy completed correctly on desktop/mobile, BLACKSITE and Commander read-only flows passed, existing v2 wallet negative paths remained safe.

**Failure retained:** [first run 44961476676](https://github.com/Iniwura/Gambit/actions/runs/44961476676) FAILED tablet QA because the new Hotseat launcher at top 61px overlapped Academy at 55px. [CSS fix](../src/arena/hotseat.css) placed Hotseat on a separate **110px row** from 701–950px. The [corrected run 44962022483](https://github.com/Iniwura/Gambit/actions/runs/44962022483) then passed every job and the new native tablet hit tests. The existing regression test was not relaxed.

## Not built / next gate

- **No real online invitation, wallet-bound challenger/defender authority, remote order transport, actual FHE multiplayer contract deployment, 5-round KMS receipts, real HCU/depth, wallet fee/latency measurement or remote session recovery.**
- Same-device training can be inspected and spoofed by its operator, so it is not a competitive proof and cannot award public achievements.
- Optional independent playtesting is still needed for ease of learning and strategy balance, especially one-use GAMBIT’s second-mover timing.
- The isolated [ArenaV3Research Solidity contract](../fhe/contracts/ArenaV3Research.sol) is a distinct, local-mock-tested prototype, not deployed or approved for Sepolia. Current deployed v2 still proves only **one** real confidential 3v3 encounter.
- Full competitive BLACKSITE, persistent Commander Profile and original visual/audio production remain outside this milestone.

**Next:** implement a fail-closed **v3 public match read/recovery adapter and explicit wallet-action intent model** against the exact compiled research ABI (no arbitrary RPC runtime claims), then verify local Hardhat FHE execution end to end. Any deployment or transaction requires new explicit authorization. Graphics remain frozen.

## Live integration update — 24 November 2026

The document above remains the acceptance contract for the local cleartext reference. The separate online path is now mounted in the same responsive briefing and is pinned to the independently verified ArenaV3Research Sepolia deployment recorded in [`docs/BUILD_LOG.md`](BUILD_LOG.md).

- Match creation is reviewed before the wallet opens; the mined receipt is the only source of the match ID. Invitation tokens contain only the canonical creation transaction hash and can be shared or recovered by either invited seat after three confirmations.
- Both seats use the existing Zama SDK preparation path for encrypted eleven-value tactical orders. Resolution, KMS proof preparation, finalization, public score refresh and five-round completion all remain round-bound and contract-authenticated.
- Every write is an explicit, one-action wallet review. Pending hashes are reconciled before another review; account/network changes, stale rounds, reorgs, failed RPC reads and uncertain wallet responses fail closed. No automatic retry or secret plan/proof persistence is allowed.
- Browser readiness passes at desktop, mobile and both tablet widths with zero wallet writes. A complete live five-round match is intentionally not claimed here because it requires separate user-authorized gameplay transactions and an available opponent.
