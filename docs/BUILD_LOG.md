# GAMBIT — Permanent Build Progress Log

This is the **append-only work history** for GAMBIT. Read it alongside
[Master Product Scope](GAMBIT_MASTER_SCOPE.md),
[Game Architecture](GAME_ARCHITECTURE_V1.md) and
[Verified Evidence](STATUS.md).

**Required after every substantial build session:**
1. Record date, exact files/branch, phase/pillar, what *actually* changed.
2. Link the exact CI/chain evidence that proves the claim.
3. Mark each item **VERIFIED**, **IMPLEMENTED / NOT YET TESTED**, **RESEARCH**, **BLOCKED**, or **NOT BUILT**.
4. State what is **not** done; never silently replace unfinished four-pillar work with cosmetic polish.
5. Record the next highest-value architecture/functional gate, and preserve any failed test and subsequent fix.

**Locked build order:** full four-pillar architecture/game plan → complete responsive functional greybox → adversarial and player QA → **only then** final original graphics, animation and sound. No automatic wallet signatures or deployment.

## 2026-11-21 — Phase 1: BLACKSITE mission + authenticated Profile evidence boundaries

**Branch:** `build/verified-first-slice`; draft [PR #5](https://github.com/Iniwura/Gambit/pull/5). **No blockchain writes, wallet signature, deployments, new graphics or media.**

### Implemented and unit-tested

- **BLACKSITE local mission controller:** `src/blacksite/mission.mjs` wraps the existing four-symbol codebreaker with briefing → active → breached/locked → debrief and a fresh-ID retry. Five bounded attempts; repeated and invalid guesses rejected. Local secret is held outside exported public state in a module-private WeakMap, but **a cleartext browser client is not confidential FHE**. `tests/blacksite-mission-contract.test.mjs` checks all **256** possible codes, invalid actions, retries, state immutability and secret-field redaction.
- **Commander Profile authenticated evidence boundary:** `src/profile/verified-arena-record.mjs` reads **canonical public Sepolia** contract runtime, the `DuelFinalized` log, mined transaction and KMS-proof calldata, receipt/hash, current contract status and one-use invite linkage. Only successfully verified records are branded within the module. `deriveCommanderArenaProfile` refuses arbitrary JSON, foreign player records and contradictory duplicates; computes actual win/loss/draw totals without local practice results. `tests/profile-evidence-contract.test.mjs` covers forged history, wrong chain/runtime, invalid finality, reorg and owner attribution.
- **Unit evidence:** [Rules checks run 44921330784](https://github.com/Iniwura/Gambit/actions/runs/44921330784) passed **158/158** root tests on the initial version of this milestone. The focused contract tests also passed in the first [Phase-1 workflow](https://github.com/Iniwura/Gambit/actions/runs/44921435163). All tests are local or mocked RPC unless explicitly identified as a live Sepolia check.

### Live read-only Profile proof — verification in progress

- Added `scripts/verify-profile-duel1-readonly.mjs` and [focused workflow](https://github.com/Iniwura/Gambit/actions/workflows/game-systems-contracts.yml) to verify **actual Duel #1** and attribute its **0:1 Violet** result to both real wallets without signing.
- **First attempted live run FAILED** ([run 44921435163](https://github.com/Iniwura/Gambit/actions/runs/44921435163)): the public Sepolia RPC rejected a historical-block `eth_call` with missing revert data. Do not misreport this as a verified profile; the local tests passed but the live probe did not.
- Corrected architecture: use the successful **canonical mined receipt/event** for historical finalization and independently check **current** onchain status through latest-state RPC, avoiding an unnecessary archive-node requirement while still refusing missing or inconsistent proof. The correction is implemented in `src/profile/verified-arena-record.mjs`. **The new live run must pass before changing this entry to VERIFIED.**

### Still NOT built / approved

- No BLACKSITE playable Phaser scene, infiltration mission content, encrypted vault contract or proven anti-bruteforce secrecy.
- No Commander Profile screen, opt-in identity system, persistent cross-match indexer or real player-facing achievements.
- No five-round v3 FHE contract, production multi-round Arena lobby or user-validated signature GAMBIT balance.
- Full four-pillar greybox, multiplayer repeatability and polished graphics are not approved as complete.

**Next:** verify the actual Profile chain record, capture the exact passing workflow, then finish BLACKSITE's secure mission protocol threat model and connect properly gated **functional** game controllers (still temporary presentation). Never unlock unfinished modes by changing a feature flag alone.

## 2026-11-21 — Phase 1 baseline: full game architecture and Arena mechanics

- Locked the full game and order of operations in [GAMBIT Master Scope](GAMBIT_MASTER_SCOPE.md), [AGENTS.md](../AGENTS.md) and [Production Plan](PRODUCTION_PLAN.md).
- Added [Game Architecture v1](GAME_ARCHITECTURE_V1.md), the headless [capability/state shell](../src/architecture/game-shell.mjs) and a passing [architecture CI run](https://github.com/Iniwura/Gambit/actions/runs/44920658729).
- Added the headless [five-round Arena research reducer](../src/research/arena-v3-match.mjs), one-use risk-stake proposal and [v3 tradeoff record](ARENA_V3_FEASIBILITY.md). The proposed mechanics are **local research only**; the current deployed v2 remains a one-encounter game. [147/147 rules](https://github.com/Iniwura/Gambit/actions/runs/44920658968) passed before the BLACKSITE/Profile additions.
- One complete two-wallet FHE Duel #1 has genuine verified Sepolia seal/open/submit/resolve/KMS/finalization evidence. [Canonical final receipt](https://sepolia.etherscan.io/tx/0x57a19f25a234eca7db206781a18cc965a09818a04b87a9f30d8d659562a9bdad). **This is one completed encounter, not complete multiplayer or the full game.**

## 2026-11-18 to 2026-11-21 — Historical prototype and first real onchain milestone

- Built local deterministic three-role practice, the early Phaser presentation, encrypted `SquadGambit` v2, wallet SDK integration and a public witness path. Recorded real two-wallet testnet evidence in [STATUS.md](STATUS.md).
- Prior technical notes stating that `SquadGambit` is undeployed are superseded by verified 21 November receipts. Do not call the old solo `SealedGambit` a full 3v3 match.
