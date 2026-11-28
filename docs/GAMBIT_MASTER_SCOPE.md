# GAMBIT: Sealed Orders — Master Product Scope and Build Roadmap

**Status:** AUTHORITATIVE PRODUCT VISION — **NOT** an implementation/completion claim.  
**Recorded:** 25 November 2026. **Revised:** 27 November 2026 to reconcile verified live contracts and provisional integration; overall acceptance remains OPEN.
**Project:** [GAMBIT](../README.md) · [Evidence and technical status](STATUS.md) · [Production acceptance gates](PRODUCTION_CHARTER.md) · [Game mechanics](GAME_DESIGN.md).  
**Branch/release boundary:** Active build on `build/verified-first-slice`, draft PR #5. Keep the verified v2 and v3 testnet evidence, the separate R36 design candidate, and future product features distinct.

> **Non-negotiable:** We are building a genuinely compelling, polished, original, persistent sci-fi tactics **game** powered by Zama FHE. Not a contract console, not a static web UI, not a one-off encrypted-duel proof, and not a throwaway hackathon demo. Do not quietly shrink the intended scope when one technical slice works.

This file is the long-term north star. Before starting each phase, compare the proposed work against it. If scope changes, write down the reason, gameplay tradeoff, cost/technical constraints and explicit product decision. **Passing CI, winning one duel or publishing a README does not mark the game complete.**

## 1. Player fantasy and quality standard

Take command of three distinct fighters, outthink real human opponents with secret conditional orders, fight for a contested reactor, complete confidential missions, and grow a recognizable commander identity. The FHE layer protects the integrity of hidden choices and reveals only the public outcome authorized by the rules.

- **Experience:** memorable premium 2.5D/isometric-feeling sci-fi tactics presentation; proper characters, world, movement and feedback. Build a *game*, not a dashboard with animated decoration.
- **Quality bar:** standout game with coherent original visual art, high-quality motion and sound, clear hierarchy and accessibility, skillful mechanics and reliable multiplayer. Aim for a serious first-place-caliber submission, but never promise victory or assert a 90+/100 score without independent evidence.
- **Design discipline:** game mechanics and fun first, then original graphics and audiovisual finishing. If the fun loop fails without good art, repair the game design.
- **Honesty:** never invent live opponents, match histories, private tactics, lane outcomes, signed proofs, additional matches or successful transactions. Separate local cleartext training from real confidential onchain play.
- **Architecture:** deterministic canonical rules; Phaser presentation; independent read-only chain verification; user-approved, fee-bounded writes. No automatic extra wallet actions.

## 2. The COMPLETE game we are building

### A. ARENA — flagship competitive experience

**Target player loop:** choose a squad → inspect an opponent/match invitation → program secret conditional orders and a formation → enter an asynchronous confidential match → witness publicly verifiable consequences → adapt in subsequent rounds where supported → finish, review and rematch.

- **Three distinct fighter roles:** Scout (marking/scouting advantage), Guardian (protection/denial), Striker (breach/attack). Roles must have meaningfully different decisions, readable silhouettes and animated behavior, not three skins for the same RPS button.
- **Private plans:** each fighter chooses an opening action, a trigger/prediction and a counter. A separate private formation configures matchups across three reactor sectors. Winning requires anticipation, strategy and counterplay rather than luck.
- **Signature GAMBIT commitment:** deployed v3 remains historical evidence (public activation, encrypted sector). The independently live-validated V4 candidate encrypts activation timing and selected visual sector, enforces one effective activation through private spent state, adds two points for winning that sector and otherwise subtracts one (floor zero). Aggregate results can still leak information by inference; repeated human strategy balance and browser own-spent recovery remain open.
- **Multi-round competitive experience:** five independently sealed and resolved rounds; one complete Sepolia match is documented. Repeated human matches, redesigned UI integration and measured latency remain open.
- **Full human PVP:** discover/coordinate a match, Create/Join, invite a distinct opponent, plan, commit, wait, recover, resolve, prove finality, view result and rematch. Every state should be understandable without knowledge of blockchain transaction internals.
- **Presentation:** one cohesive arena world, intentional camera and combat staging, understandable reactor-control feedback, character identity, hit responses, transitions and satisfying victory/defeat. Do **not** reconstruct secret per-fighter results from an aggregate encrypted score.

**CURRENT STATUS:** Arena V3 Match #1 (6:4, five rounds) remains unchanged. Arena V4 at `0x5F9e0030233370a913780EC9CCb58183C4672c13` completed a controlled five-round confidential match, 27:0, 21 canonical writes, three independent RPC providers, encrypted activation/sector and participant-only spent recovery. [Pinned manifest](../fhe/deployments/sepolia-arena-v4-live-validation.json). Provisional game panels implement create/recover, private three-role orders, public aggregate scoring, exact reviewed dispatch and recovery. Real Chromium synthetic wallet dispatch/reload and actual wallet-free live debrief passed desktop/mobile (run 45983280727 browser log; later regressions superseded). Signing disabled by default; real browser wallet/SDK full gameplay, own-spent private recovery in browser, peer UX, persistent progression and ranked fairness not accepted. Local practice remains separate. Final art/audio not approved.

### B. BLACKSITE — confidential missions and codebreaking

**Local training and advanced rehearsal remain separate wallet-free greyboxes.** The neutral five-slot confidential candidate is deployed and has a completed live mission. Competitive ranking remains unavailable.

- Tactical infiltration into a sci-fi security facility, limited information and hard choices.
- Confidential decisions, clues, vault-code/codebreaking mechanics and meaningful tradeoffs; puzzle solutions and hidden data should not be exposed before the rules permit.
- Original mission environments, progression, tension, clear win/lose conditions and rewarding replay.
- The selected neutral candidate uses five bounded encrypted RNG glyphs, four attempts, encrypted guess and approach, contract-only secret ACL, route-specific feedback and heat, expiry/recovery and KMS-authenticated finalization. STEALTH exact count/0 heat; PROBE exact+misplaced/+1; BREACH exact/+2 and only five exact opens the vault. The earlier authored four-slot candidate remains historical research. Live HCU measurements, human difficulty, content and ranking fairness remain gated.

**CURRENT STATUS:** The original four-glyph local tutorial is unchanged. New advanced rehearsal uses the same five-glyph/four-attempt neutral scoring oracle without FHE or wallet. Neutral BLACKSITE at `0x33c062aebeB425b53A25E0b370732Cee5f7F97F9` completed Mission #1: BREACHED, score 35, heat 5, four attempts, 12 canonical gameplay writes; [manifest](../fhe/deployments/sepolia-neutral-blacksite-mission-1.json). Provisional in-game open/recover/prepare/review controls, synthetic wallet dispatch and live wallet-free debrief have evidence as described above. New rehearsal and UX guidance still need combined CI. Real wallet gameplay and independent human difficulty tests remain. No ranking or new verified XP enabled.

### C. TRAINING — serious game onboarding and tactical mastery

- Wallet-free, approachable first session in under 30 seconds to a meaningful decision (target; measure with newcomers).
- Steady, Reactive and Volatile opponents, a clear fighter/formation tutorial, real consequence feedback, annotated local after-action review and a rematch worth playing.
- Progress from first move → first counter → complete squad tactic → formation decision → understanding confidentiality → voluntary onchain match.
- Later: scenarios, mastery exercises and difficulty appropriate to actual skill, not only increased enemy stats.
- **Never** present local bot results or local per-lane reports as encrypted onchain evidence.

**CURRENT STATUS:** complete [five-round Tactical Academy local-training curriculum](TRAINING_FULL_MATCH_ACCEPTANCE.md) is **verified** by [4/4 full CI jobs and actual desktop/mobile five-round gameplay, with tablet navigation (run 44938866411)](https://github.com/Iniwura/Gambit/actions/runs/44938866411). The lesson trains Striker/Scout/changed Guardian tactics, formation adaptation and three independent final-round openings, then reports a genuine **3 : 10 local defeat** and canonical role statistics. This is strictly cleartext local practice, not encrypted multiplayer or ranked progress. **Independent novice comprehension, consented saved mastery and final audiovisual feedback remain unverified/unbuilt.**

### D. COMMANDER PROFILE — persistent identity and reasons to return

- Player identity, verifiable public match record, history, statistics, milestones/achievements and rematches.
- Later: appropriate progression for Arena and BLACKSITE, session continuity, optional opt-in notifications and social comparison only where it does not distort fairness or privacy.
- Read history from authentic verified receipts/events; **do not seed fictional past opponents or outcomes**.
- Protect private tactics, wallet addresses and personal data; no speculative rankings without fair repeated matches.

**CURRENT STATUS:** [`src/profile/arena-v3-history.mjs`](../src/profile/arena-v3-history.mjs) independently authenticates the approved Arena v3 deployment, creation receipt, all five round finalizations and completion state across three public Sepolia RPC providers. [`src/profile/commander-profile.mjs`](../src/profile/commander-profile.mjs) persists only a public call sign keyed to the wallet address and derives authentic Arena history, XP, level and achievements; the player-facing greybox consumes that verified profile. Match #1 produces level 2, 150 XP and three Arena achievements for the challenger. BLACKSITE progression is deliberately unchanged at zero until a deployed mission receipt is approved. No private keys, mnemonics, tactics or fabricated history are stored.

### E. SHARED PROGRESSION — earned rewards across the four pillars

This is a shared system, not a fifth disconnected game mode. **Planned expansion**, not an assertion of shipped rewards. Existing receipt-derived Commander XP and achievements are the engineering foundation.

| Reward | Earn condition | Trust boundary |
| --- | --- | --- |
| Commander XP and levels | Completed eligible matches/missions | Distinct local and verified tracks |
| Academy mastery badges | Actual exercise completion | Local, explicitly unranked |
| Medals and titles | Defined tactical milestones | Only public/proven facts for verified awards |
| Operator/equipment cosmetics | Earned progression milestones | Cosmetic only; no gameplay advantage |
| Blacksite classified cosmetics | Completed missions | Verified track only after live authorized deployment |
| Ranked divisions and streaks | Repeatable competitive results | Later, after ranking/abuse review |

Design deterministic, idempotent reward derivation using chain ID, approved contract, match/mission ID, canonical receipt/event identity, and participant. Account for reorgs, duplicate claims, expired unscored rounds, incomplete sessions and self-farming; no fake activity or private tactics in public profile. Define XP thresholds, unlock table and accessibility before implementation; do not arbitrarily inflate progression. Cosmetic rewards cannot change abilities, damage, score, or secret information. No paid rewards, tokens, wagering, loot boxes or pay-to-win. Confidential challenge proofs remain a later candidate requiring a privacy review; never disclose orders to award badges. Local progress may be reset and is not competitive evidence.

## 3. The premium product experience we expect

A real game home screen; playable practice/tutorial; Create Match and Join Match; squad configuration; opponent invitation and lobby; readable waiting/chain progress; animated authentic reactor result; rematch and real history; eventually BLACKSITE missions and Commander Profile.

**Art/game feel:** original character silhouettes and sprite/animation states (idle, selecting, moving, attacking, action reactions, winning/losing), cohesive connected arena, layered lighting/VFX, original or licensed sound/music with mute, responsive input, clear mobile controls and reduced-motion support. Procedural Phaser characters are a *temporary development layer*, not final art approval.

**Engineering:** explicit errors and fee limits; wallet rejection and wrong-chain handling; real state recovery; interrupted proof/relayer failures; reproducible CI; adversarial FHE/privacy/fairness checks; accessible keyboard/touch interaction; careful performance testing; no invented chain metrics or production claims.

## 4. What has actually shipped or been proven (21 Nov 2026)

| Evidence / component | Status | Boundary |
| --- | --- | --- |
| Phaser/TypeScript web build, basic arena, role-specific procedural visuals | **Built; quality not finally approved** | Working early presentation, not premium production sprite/audio pack |
| Cleartext 3-role practice, role-specific rules, three formations, bot styles, five-round matches and rematch | **Built and browser-tested** | Training game only; not five encrypted onchain rounds |
| Complete real-action five-round Tactical Academy | **Verified 4/4 jobs, desktop/mobile five actual rounds, 15 lanes each, true 3 : 10 defeat** | Local training only; no uncoached novice study, saved mastery or encrypted multi-round match |
| Public `SquadGambit` FHE contract on Sepolia, separate wallets, ten inputs per side | **Deployed / demonstrated** | Single encrypted encounter, not complete Arena roadmap |
| `sealSquad` → `openDuel` → `submitDuel` → `resolveDuel` → public KMS decryption → `finalizeDuel` | **Verified ONCHAIN for Duel #1** | One example; not proof of repeatable production-scale multiplayer |
| Authenticated first result (Cyan 0 : 1 Violet), receipt and public recovery | **Verified** | Onchain aggregate only; hidden fighter plans remain secret |
| No-wallet spectator / first-screen proof shortcut and result view | **Built and Chromium-tested** | Judge-friendly evidence route; not full Create/Join product |
| Verified first-round Academy and four-pillar greybox regression | [**4/4 full quality jobs PASS, 182/182 rules tests, actual desktop/mobile browser**](https://github.com/Iniwura/Gambit/actions/runs/44934706796) | [710px/820px tablet navigation hit-tests also passed 4/4](https://github.com/Iniwura/Gambit/actions/runs/44935438197); CI does not prove human gameplay fun, security audit or final art quality |
| Arena v3 deployment and five-round Arena Match #1 | **Verified live on Sepolia; three-provider read-only history proof; 20 gameplay receipts** | One bounded match; no automatic repeat, no signature GAMBIT intervention or broad matchmaking claim |
| Full multi-round confidential Arena product and smooth end-to-end UX | **Core match evidence complete; product surface still in progress** | Invitation/lobby/recovery paths are implemented and tested; repeated live acceptance requires explicit wallet approvals |
| BLACKSITE | **FHE mission candidate compiled and mock/adversarial tested; local greybox browser-tested** | Not deployed or HCU-measured; no live mission receipt/ranking progress |
| Commander Profile, persistent verified history/progression | **Verified Arena v3 history, public identity, XP/level/achievements and browser surface implemented** | BLACKSITE progress remains zero; no private credential storage or synthetic history |
| Premium original sprite art, audio, accessible UX and independent playtesting/security review | **Incomplete / not established** | No 90+/100 or release-ready claim |

### Real-chain evidence for the completed first duel

- Contract: [`SquadGambit` on Sepolia](https://sepolia.etherscan.io/address/0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134), chain 11155111.
- Defender [sealed Squad #1](https://sepolia.etherscan.io/tx/0x65b1fde92ff899718f4febcdc1597cc9fb05c681b1e05996f306d2a3bae41e0b).
- Challenger [opened Duel #1](https://sepolia.etherscan.io/tx/0x632c8eca45b6c4881112ee11516252d20a85cef4fa0507a981766e1c4b4548fe), [submitted ten encrypted inputs](https://sepolia.etherscan.io/tx/0x00562be6f918e33a5781ce9c2ff9bcb4516d4c5e6d5a8cb25e485a17ddf2a8d4).
- Contract [resolved encrypted match](https://sepolia.etherscan.io/tx/0xe91ba8ba3af4ce9666871752974b5b2168f4ccac4a6a8157df93d27fe79696ac), authentic public [KMS proof preflight](https://github.com/Iniwura/Gambit/actions/runs/44913989691), [finalized 0:1 Violet](https://sepolia.etherscan.io/tx/0x57a19f25a234eca7db206781a18cc965a09818a04b87a9f30d8d659562a9bdad).
- Independent [final receipt verifier](https://github.com/Iniwura/Gambit/actions/runs/44914775566), [real browser no-wallet spectator](https://github.com/Iniwura/Gambit/actions/runs/44917771468), [four quality gates](https://github.com/Iniwura/Gambit/actions/runs/44917777173), [published game](https://iniwura.github.io/Gambit/).

**Permanent progress record:** [BUILD_LOG.md](BUILD_LOG.md) is mandatory for every substantial milestone, with exact evidence, failures, unfinished systems and next action.

**Current system specification:** [GAME_ARCHITECTURE_V1.md](GAME_ARCHITECTURE_V1.md), with an executable, fail-closed shell contract in [`src/architecture/game-shell.mjs`](../src/architecture/game-shell.mjs). Arena v3 Match #1 is the first live competitive evidence. The FHE BLACKSITE candidate is isolated and undeployed. Architecture and product acceptance remain in progress; isolated visual implementation is authorized under the revised roadmap, not production integration.

## 5. Current execution roadmap — full-game design, integration and release

The historical architecture-first gates remain mandatory for production. The owner has subsequently authorized a separate visual-development track, with no production merge until the complete game is accepted. This section supersedes obsolete graphics-freeze language in older documents for **isolated design work only**. Do not treat design acceptance as production acceptance.

### Phase A — Full-game design acceptance (CURRENT)
- Use R36 as the verified internal baseline. Build, test, visually inspect, judge against references and iterate across HQ, Arena, Academy, Blacksite, Commander, Settings, audio and transitions. Vesperfall is the minimum visual benchmark; Tactical Breach Wizards, Gears Tactics, XCOM: Chimera Squad and Into the Breach guide tactics, cinematics, identity and clarity. Do not copy their assets.
- Improve coherent original/appropriately licensed runtime art, faction identification (shape/text plus color), HUD hierarchy and keyboard/touch accessibility. Resolve third-party silhouette and license concerns. Maintain real state, not decorative fake interactions.
- Make sealed orders the signature experience: visible lock, public rival commitment status, honest wait-state choreography, aggregate-only reveal, clear conditional plans and local-only detailed tactical reports. The R36 walkthrough is illustrative, not connected to transactions.
- Design and implement the earned progression system above; local and verified achievements must remain distinct. Prioritize meaningful rewards over new game modes.
- Exit: rigorous whole-game internal assessment >=90/100, no category below 80% of its own maximum (art/world 25, characters 15, HUD/UX 15, animation/audio 15, gameplay/FHE 20, performance/reliability 10). Actual screenshots, complete local match, mode-by-mode interactions, accessibility/responsiveness, reference comparison and explicit limitations. No score inflation, deadline shortcuts, or approval based on tests alone. Independent review and physical-device validation remain necessary.

### Phase B — Gameplay depth, balance and onboarding (parallel research; gate before release)
- Expand from 729 single-operator plan comparisons to reproducible squad and five-round strategy analysis: roles, formations, conditional plans, GAMBIT timing, adaptive opponents, exploitability and aggregate information leakage. Compare mixed strategies, adversarial best responses and sensitivity to opponent behavior. Avoid claiming random simulation proves equilibrium or fun.
- Measure time to first meaningful choice (<30s target), short no-wallet guided exercise, first-match comprehension and voluntary rematch. Preserve full Academy curriculum. Target at least four of five uncoached players understanding basics and three of five wanting to rematch; project targets, not judge criteria.
- Three-to-five-minute matches are an aspiration, not a measured live result. Existing encryption averages about 85–90s per player per round in Match #1; measure SDK improvements and wait experience before imposing a timer. Do not replace the deployed one-day submission expiry with an invented countdown.

### Phase C — Authentic production integration
- Integrate accepted art/UI with the existing engineering branch and pinned Arena v3 deployment. Map every state to authoritative account, receipt, round, result handle and proof. No simulated online reveal, fake opponents or automatic transaction retries. Verify live create/join, seal, resolve, KMS proof, finalize, resume and rematch. Preserve user approval and fee caps.
- Add read-only spectator experience with aggregate-only reveal and explorer evidence; no wallet required to inspect an existing match. Make practice and online entry distinct. Explain network, faucet, rejected signature, pending/unknown state, expiry and proof failures.
- Deploy Blacksite only with separately explicit approval after compiled/runtime/HCU and adversarial review; prove a real two-party mission and verified reward eligibility. No fake Blacksite ranking while local-only.
- Integrate verified Commander history and reward derivation. Only after enough verified matches and abuse review consider ranked divisions or leaderboard. Do not expand roster or add staking before balance and core release.

### Phase D — Release verification and competition package
- Repeat authentic live matches under separate approvals; measure real encryption/settlement latency, hardware FPS/load time, normal-motion playback, mobile usability and actual reload recovery. Audit ACL/proof binding, replay/wrong-match/wrong-round, reorg, expired/unscored outcomes, public/private data separation and reward farming. Independent security and gameplay review are required; mock tests are not a security audit.
- Publish an accessible working game URL with exact release commit, clean repository, licenses, commands, contract links and receipts. Reviewer must distinguish old hosted engineering UI from the offline candidate.
- Three-minute real-person pitch, X thread/article and official submission requirements. Do not substitute AI voice/video. Official deadline Dec 14 2026 23:59 AOE per program records; verify rules again before submitting.
- Winning is the objective; do not rush because of subscription expiry or claim a guaranteed ranking.

## 6. Anti-forgetting rules for every subsequent build session

1. Read **this file before choosing next work**. The README is the public entry, `docs/STATUS.md` is the evidence log, the charter sets acceptance gates and this file defines **full scope**.
2. Before coding, identify pillar, phase, reference or evidence, and testable acceptance criteria. Isolated design iteration is authorized; preserve functional and security gates before production integration.
3. After coding, update the matrix above or `docs/STATUS.md` with verified changes and links; label all unproven work **planned** or **in progress**.
4. Preserve **Duel #1** as finalized. Never automatically replay or send transactions. New deployments and onchain writes require specific explicit permission.
5. Maintain distinction between a finished **encrypted core proof**, a working **practice prototype**, a genuinely polished **Arena product** and the four-pillar **GAMBIT platform**.
6. Do not start the final submission/demo solely because CI is green. A strict review should still find a reason for players to love and replay the game.

## 7. Current decision

One verified five-round encrypted Arena match and multiple functioning pillar slices exist. R36 is a separate internal design checkpoint, not a hosted release or approved 90+ design. Continue full-game reference-driven development and independent review; then integrate, verify and submit. Rewards are planned expansion, not yet implemented. No blockchain writes, deployment, or production promotion is authorized by this roadmap update.

Consult [STATUS](STATUS.md), [R36 checkpoint](https://github.com/Iniwura/Gambit/blob/design/arena-visual-track/docs/R36_DISCLOSURE_UX_AND_REVIEW.md) and exact CI/receipts for evidence.
