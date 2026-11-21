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

## 2026-11-21 — Phase 1: bounded, reorg-aware Commander Profile event discovery

**Verified end-to-end public read-only discovery (no signer, new chain transaction or UI).**

- Implemented [`src/profile/approved-event-discovery.mjs`](../src/profile/approved-event-discovery.mjs) with the immutable approved deployment pin, 12-confirmation minimum, capped **1,800-block pages**, **450-block RPC subwindows**, canonical event/block checks and a cursor bound to the last scanned block's canonical hash. Reorganisation/counterfeit RPC evidence fails closed.
- **Security split:** discovery yields `UNVERIFIED_CANDIDATES_ONLY`, never a ranked win. Each matching duel must still pass [`verifyArenaProfileRecord`](../src/profile/verified-arena-record.mjs), including approved runtime, canonical receipt/proof, onchain score and correct participants. Adversarial [unit tests](../tests/profile-discovery-contract.test.mjs) refuse forged contracts, duplicate events, tampered cursors, wrong networks, orphaned blocks and oversized event batches.
- **Real Sepolia confirmation:** [focused workflow 44924064176](https://github.com/Iniwura/Gambit/actions/runs/44924064176) passed **17/17** targeted tests; [`scripts/verify-profile-discovery-readonly.mjs`](../scripts/verify-profile-discovery-readonly.mjs) scanned **7 actual read-only pages**, discovered unique genuine Duel #1, matched the exact mined receipt and attributed **one defender win / one challenger loss** only after authenticated verification. Zero signing or writes.
- Detailed [profile trust/recovery specification](PROFILE_TRUST_AND_RECOVERY.md) updated. **Still unbuilt:** persistent index/cursor across sessions, performant wallet history queries, consent-based identity, reorg invalidation after restart, functional Profile UI, achievements and progression.
- **Next:** produce the actual functional Profile greybox driven by trustworthy read-only evidence and explicit empty/error states, with no final graphics. Continue evaluating BLACKSITE alternatives where scans provide a genuine tactical choice instead of a dominated action.

## 2026-11-21 — Phase 1: verified deployment trust, reorg safety and BLACKSITE difficulty study

**Branch:** `build/verified-first-slice`; draft PR #5. **Graphics frozen. No blockchain writes, new contracts, or wallet signatures.**

### Commander Profile security — VERIFIED, not a shipped profile

- **P0 vulnerability corrected:** previous `verifyArenaProfileRecord` could accept an arbitrary caller-supplied contract address and a matching user-supplied runtime hash, then treat those self-consistent logs as ranked evidence. Added exact [approved deployment registry](../src/profile/trusted-deployments.mjs); the production verifier now **rejects unknown deployments before reading results**. Mock research receipts use a separate trust brand and cannot become real player victories.
- **Reorg consistency hardened:** real verification pins contract runtime and state reads to one block, checks the receipt's canonical event block hash and reconfirms that same head before minting a trusted record. Source: [Profile verifier](../src/profile/verified-arena-record.mjs). [Adversarial tests](../tests/profile-evidence-contract.test.mjs) cover wrong chain/hash/runtime, counterfeit self-pinning, competing receipts, head reorg and orphaned blocks.
- **Regression repaired transparently:** the initial head-reorg mutation test [failed](https://github.com/Iniwura/Gambit/actions/runs/44923275731) because its fixture changed the simulated hash only on a second numeric head read. The fixture was corrected to mutate the *first* canonical recheck. No production validation was weakened.
- **Independent live Sepolia verification PASSED after fix:** [focused run 44923354217](https://github.com/Iniwura/Gambit/actions/runs/44923354217) passed **13/13** focused tests, independently authenticated Duel #1 on the **approved** pinned deployment and correctly attributed one Violet defender win and one Cyan challenger loss. Read-only snapshot reported 475 confirmations. This is **one verifiable record**, not durable player history or a profile UI.
- Architecture decision: [Profile Trust and Recovery](PROFILE_TRUST_AND_RECOVERY.md) documents bounded indexing, opt-in privacy, confirmation/reorg policy, honest empty/error states and release acceptance. Persistence and user-facing Profile remain **NOT BUILT**.

### BLACKSITE difficulty research — VERIFIED math, competitive policy NOT approved

- [v2 research rules](../src/research/blacksite-v2-feasibility.mjs): separate 5-glyph/6-symbol model (`6^5=7776`), six total actions, five guess cap, two optional class scans, duplicate/terminal/contradiction refusal. The original easy `4^4=256` tutorial remains unchanged. **Neither is currently encrypted onchain.**
- [Exact information benchmark](../src/research/blacksite-v2-information.mjs) exhaustively evaluates all 7,776 secrets rather than estimating from a handful of samples. [Passing rules CI 44923522404](https://github.com/Iniwura/Gambit/actions/runs/44923522404): **167/167** root tests, including transcript, action-budget, candidate and clue-information invariants.
- **Negative result retained:** one reference guess gives 3.324 bits (973 expected remaining codes), a class scan 2.091 bits (2,044 remaining), scan+guess 5.245 bits (277 remaining), and two fixed guesses 6.250 bits (139 remaining). **As designed, the scan is NOT accepted for the competitive mode** because it appears inefficient against another guess in the tested opening; global dominance and actual player win rates are not yet proven.
- [BLACKSITE Protocol and Threat Model](BLACKSITE_V2_PROTOCOL_DECISION.md) defines mission identity, anti-replay, solver/creator privilege, finite query budget, privacy leakage, KMS-proof binding, expiry, collusion risks and FHE/HCU feasibility. A secret chosen or known by a creator is **not** fairness-proof; an 7,776-code space is not cryptographic entropy. **No competitive mode, encrypted mission or graphics approved.**

**Remaining blockers:** resolve BLACKSITE game difficulty and fair secret generation, implement actual local mission player interactions, design/verify persistent Profile indexing and opt-in identity, settle Arena v3 game rules and evaluate actual FHE costs. The four-pillar functional greybox is incomplete. **Next:** test better BLACKSITE action/mission policies with game-balance evidence, then implement state-driven functional BLACKSITE greybox and true Profile history/controller under verified feature gates.

## 2026-11-21 — Phase 1: BLACKSITE mission + authenticated Profile evidence boundaries

**Branch:** `build/verified-first-slice`; draft [PR #5](https://github.com/Iniwura/Gambit/pull/5). **No blockchain writes, wallet signature, deployments, new graphics or media.**

### Implemented and unit-tested

- **BLACKSITE local mission controller:** `src/blacksite/mission.mjs` wraps the existing four-symbol codebreaker with briefing → active → breached/locked → debrief and a fresh-ID retry. Five bounded attempts; repeated and invalid guesses rejected. Local secret is held outside exported public state in a module-private WeakMap, but **a cleartext browser client is not confidential FHE**. `tests/blacksite-mission-contract.test.mjs` checks all **256** possible codes, invalid actions, retries, state immutability and secret-field redaction.
- **Commander Profile authenticated evidence boundary:** `src/profile/verified-arena-record.mjs` reads **canonical public Sepolia** contract runtime, the `DuelFinalized` log, mined transaction and KMS-proof calldata, receipt/hash, current contract status and one-use invite linkage. Only successfully verified records are branded within the module. `deriveCommanderArenaProfile` refuses arbitrary JSON, foreign player records and contradictory duplicates; computes actual win/loss/draw totals without local practice results. `tests/profile-evidence-contract.test.mjs` covers forged history, wrong chain/runtime, invalid finality, reorg and owner attribution.
- **Unit evidence:** [Rules checks run 44921330784](https://github.com/Iniwura/Gambit/actions/runs/44921330784) passed **158/158** root tests on the initial version of this milestone. The [corrected focused workflow](https://github.com/Iniwura/Gambit/actions/runs/44921548615) passed **11/11 targeted contract tests** and a separate actual Sepolia check. Unit tests use local/mock RPC unless explicitly identified as the live Sepolia probe.

### Live read-only Profile proof — VERIFIED for Duel #1

- Added `scripts/verify-profile-duel1-readonly.mjs` and [focused workflow](https://github.com/Iniwura/Gambit/actions/workflows/game-systems-contracts.yml) to verify **actual Duel #1** and attribute its **0:1 Violet** result to both real wallets without signing.
- **First attempted live run FAILED** ([run 44921435163](https://github.com/Iniwura/Gambit/actions/runs/44921435163)): the public Sepolia RPC rejected a historical-block `eth_call` with missing revert data. This failure is retained in the log rather than hidden.
- **Correction:** verify the mined canonical receipt/event and independently check current onchain status through latest-state RPC instead of assuming an archive node, while still rejecting missing/contradictory evidence. Committed in `src/profile/verified-arena-record.mjs`.
- **Re-run PASSED:** [GAMBIT Phase-1 live evidence workflow 44921548615](https://github.com/Iniwura/Gambit/actions/runs/44921548615) completed **11/11 focused contract tests** and independently verified real `finalizeDuel(1)` transaction `0x57a19f25a234eca7db206781a18cc965a09818a04b87a9f30d8d659562a9bdad` on Sepolia, block **12182444**, **375 confirmations at the checked snapshot**. The public contract identifies challenger `0x70d086...dcDD5` (**0:1 loss**) and defender `0x7d567...Ee176` (**1 win**). No wallet connection, signing or writes. **This proves one read-only verified profile record, not a persistent profile or season history.**

### Still NOT built / approved

- No BLACKSITE playable Phaser scene, infiltration mission content, encrypted vault contract or proven anti-bruteforce secrecy.
- No Commander Profile screen, opt-in identity system, persistent cross-match indexer or real player-facing achievements.
- No five-round v3 FHE contract, production multi-round Arena lobby or user-validated signature GAMBIT balance.
- Full four-pillar greybox, multiplayer repeatability and polished graphics are not approved as complete.

**Next:** finish BLACKSITE's secure mission protocol threat model, finish Commander Profile's durable provenance/reorg and opt-in identity decisions, then connect properly gated **functional** game controllers (still temporary presentation). Never unlock unfinished modes by changing a feature flag alone.

## 2026-11-21 — Phase 1 baseline: full game architecture and Arena mechanics

- Locked the full game and order of operations in [GAMBIT Master Scope](GAMBIT_MASTER_SCOPE.md), [AGENTS.md](../AGENTS.md) and [Production Plan](PRODUCTION_PLAN.md).
- Added [Game Architecture v1](GAME_ARCHITECTURE_V1.md), the headless [capability/state shell](../src/architecture/game-shell.mjs) and a passing [architecture CI run](https://github.com/Iniwura/Gambit/actions/runs/44920658729).
- Added the headless [five-round Arena research reducer](../src/research/arena-v3-match.mjs), one-use risk-stake proposal and [v3 tradeoff record](ARENA_V3_FEASIBILITY.md). The proposed mechanics are **local research only**; the current deployed v2 remains a one-encounter game. [147/147 rules](https://github.com/Iniwura/Gambit/actions/runs/44920658968) passed before the BLACKSITE/Profile additions.
- One complete two-wallet FHE Duel #1 has genuine verified Sepolia seal/open/submit/resolve/KMS/finalization evidence. [Canonical final receipt](https://sepolia.etherscan.io/tx/0x57a19f25a234eca7db206781a18cc965a09818a04b87a9f30d8d659562a9bdad). **This is one completed encounter, not complete multiplayer or the full game.**

## 2026-11-18 to 2026-11-21 — Historical prototype and first real onchain milestone

- Built local deterministic three-role practice, the early Phaser presentation, encrypted `SquadGambit` v2, wallet SDK integration and a public witness path. Recorded real two-wallet testnet evidence in [STATUS.md](STATUS.md).
- Prior technical notes stating that `SquadGambit` is undeployed are superseded by verified 21 November receipts. Do not call the old solo `SealedGambit` a full 3v3 match.
