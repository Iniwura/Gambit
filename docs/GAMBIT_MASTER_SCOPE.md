# GAMBIT: Sealed Orders — Master Product Scope and Build Roadmap

**Status:** AUTHORITATIVE PRODUCT VISION — **NOT** an implementation/completion claim.  
**Recorded:** 21 November 2026.  
**Project:** [GAMBIT](../README.md) · [Evidence and technical status](STATUS.md) · [Production acceptance gates](PRODUCTION_CHARTER.md) · [Game mechanics](GAME_DESIGN.md).  
**Branch/release boundary:** Active build on `build/verified-first-slice`, draft PR #5. Keep historical plans, demo code and a single proven testnet encounter distinct from the future product.

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
- **Signature GAMBIT commitment (target differentiator):** a *proposed* high-risk, once-per-match hidden intervention with a meaningful opportunity cost and bluff. **Not implemented.** Paper-playtest, balance-simulate and review FHE cost before changing deployed contracts.
- **Multi-round competitive experience:** an evolving tactical match with adaptation and rematch; five rounds is the preferred design direction, **not** the current onchain implementation. Evaluate viable onchain protocol, latency, cost, player attention and settlement fairness before implementing a versioned upgrade. Preserve the verified single-encounter version while iterating.
- **Full human PVP:** discover/coordinate a match, Create/Join, invite a distinct opponent, plan, commit, wait, recover, resolve, prove finality, view result and rematch. Every state should be understandable without knowledge of blockchain transaction internals.
- **Presentation:** one cohesive arena world, intentional camera and combat staging, understandable reactor-control feedback, character identity, hit responses, transitions and satisfying victory/defeat. Do **not** reconstruct secret per-fighter results from an aggregate encrypted score.

**CURRENT STATUS:** playable deterministic three-role/five-round *local practice* and one authentic *single-encounter* confidential 3v3 duel on Sepolia, including independently verified final score. Full multi-round onchain Arena, signature commitment, polished lobby/matchmaking, independent human balance validation, high-end art/audio, and repeated real matches remain unfinished.

### B. BLACKSITE — confidential missions and codebreaking

**Planned expanded game mode — NOT built or FHE-validated.** This is a separate long-term product experience, not proof contained in the existing `SquadGambit` deployment.

- Tactical infiltration into a sci-fi security facility, limited information and hard choices.
- Confidential decisions, clues, vault-code/codebreaking mechanics and meaningful tradeoffs; puzzle solutions and hidden data should not be exposed before the rules permit.
- Original mission environments, progression, tension, clear win/lose conditions and rewarding replay.
- Design the exact secrecy/fairness model, interaction loop, verification mechanism, privacy boundaries, HCU budget and anti-bruteforce limits **before** implementing or describing a playable encrypted mission.

**CURRENT STATUS:** product concept only. No BLACKSITE game mechanics, mission content, FHE contract, playable mission or real receipt has been verified.

### C. TRAINING — serious game onboarding and tactical mastery

- Wallet-free, approachable first session in under 30 seconds to a meaningful decision (target; measure with newcomers).
- Steady, Reactive and Volatile opponents, a clear fighter/formation tutorial, real consequence feedback, annotated local after-action review and a rematch worth playing.
- Progress from first move → first counter → complete squad tactic → formation decision → understanding confidentiality → voluntary onchain match.
- Later: scenarios, mastery exercises and difficulty appropriate to actual skill, not only increased enemy stats.
- **Never** present local bot results or local per-lane reports as encrypted onchain evidence.

**CURRENT STATUS:** a working local practice match exists, with three roles, formations, bot styles, five-round simulation, role effects, mobile controls and rematch tests. A deliberately designed tutorial, measured newcomer usability, meaningful mastery progression and premium audiovisual feedback are not yet demonstrated.

### D. COMMANDER PROFILE — persistent identity and reasons to return

- Player identity, verifiable public match record, history, statistics, milestones/achievements and rematches.
- Later: appropriate progression for Arena and BLACKSITE, session continuity, optional opt-in notifications and social comparison only where it does not distort fairness or privacy.
- Read history from authentic verified receipts/events; **do not seed fictional past opponents or outcomes**.
- Protect private tactics, wallet addresses and personal data; no speculative rankings without fair repeated matches.

**CURRENT STATUS:** one publicly verifiable match and a wallet-free result viewer; no complete persistent profile, trustworthy cross-match history, achievement system, progression or player dashboard.

## 3. The premium product experience we expect

A real game home screen; playable practice/tutorial; Create Match and Join Match; squad configuration; opponent invitation and lobby; readable waiting/chain progress; animated authentic reactor result; rematch and real history; eventually BLACKSITE missions and Commander Profile.

**Art/game feel:** original character silhouettes and sprite/animation states (idle, selecting, moving, attacking, taking damage, winning/losing), cohesive connected arena, layered lighting/VFX, original or licensed sound/music with mute, responsive input, clear mobile controls and reduced-motion support. Procedural Phaser characters are a *temporary development layer*, not final art approval.

**Engineering:** explicit errors and fee limits; wallet rejection and wrong-chain handling; real state recovery; interrupted proof/relayer failures; reproducible CI; adversarial FHE/privacy/fairness checks; accessible keyboard/touch interaction; careful performance testing; no invented chain metrics or production claims.

## 4. What has actually shipped or been proven (21 Nov 2026)

| Evidence / component | Status | Boundary |
| --- | --- | --- |
| Phaser/TypeScript web build, basic arena, role-specific procedural visuals | **Built; quality not finally approved** | Working early presentation, not premium production sprite/audio pack |
| Cleartext 3-role practice, role-specific rules, three formations, bot styles, five-round matches and rematch | **Built and browser-tested** | Training game only; not five encrypted onchain rounds |
| Public `SquadGambit` FHE contract on Sepolia, separate wallets, ten inputs per side | **Deployed / demonstrated** | Single encrypted encounter, not complete Arena roadmap |
| `sealSquad` → `openDuel` → `submitDuel` → `resolveDuel` → public KMS decryption → `finalizeDuel` | **Verified ONCHAIN for Duel #1** | One example; not proof of repeatable production-scale multiplayer |
| Authenticated first result (Cyan 0 : 1 Violet), receipt and public recovery | **Verified** | Onchain aggregate only; hidden fighter plans remain secret |
| No-wallet spectator / first-screen proof shortcut and result view | **Built and Chromium-tested** | Judge-friendly evidence route; not full Create/Join product |
| Latest CI at `2607827264e6acbc55b07952e49b96331351db50` | **Four quality jobs PASS**, rules checks PASS, spectator PASS, GitHub Pages PASS | Tests do not approve art quality, human gameplay or security |
| Full multi-round confidential Arena, signature GAMBIT intervention, matchmaking and smooth end-to-end UX | **Not yet built / verified** | Requires design, actual implementation and separate live evidence |
| BLACKSITE | **Not built** | Concept, distinct mode |
| Commander Profile, persistent verified history/progression | **Not built** | One match is not a complete system |
| Premium original sprite art, audio, accessible UX and independent playtesting/security review | **Incomplete / not established** | No 90+/100 or release-ready claim |

### Real-chain evidence for the completed first duel

- Contract: [`SquadGambit` on Sepolia](https://sepolia.etherscan.io/address/0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134), chain 11155111.
- Defender [sealed Squad #1](https://sepolia.etherscan.io/tx/0x65b1fde92ff899718f4febcdc1597cc9fb05c681b1e05996f306d2a3bae41e0b).
- Challenger [opened Duel #1](https://sepolia.etherscan.io/tx/0x632c8eca45b6c4881112ee11516252d20a85cef4fa0507a981766e1c4b4548fe), [submitted ten encrypted inputs](https://sepolia.etherscan.io/tx/0x00562be6f918e33a5781ce9c2ff9bcb4516d4c5e6d5a8cb25e485a17ddf2a8d4).
- Contract [resolved encrypted match](https://sepolia.etherscan.io/tx/0xe91ba8ba3af4ce9666871752974b5b2168f4ccac4a6a8157df93d27fe79696ac), authentic public [KMS proof preflight](https://github.com/Iniwura/Gambit/actions/runs/44913989691), [finalized 0:1 Violet](https://sepolia.etherscan.io/tx/0x57a19f25a234eca7db206781a18cc965a09818a04b87a9f30d8d659562a9bdad).
- Independent [final receipt verifier](https://github.com/Iniwura/Gambit/actions/runs/44914775566), [real browser no-wallet spectator](https://github.com/Iniwura/Gambit/actions/runs/44917771468), [four quality gates](https://github.com/Iniwura/Gambit/actions/runs/44917777173), [published game](https://iniwura.github.io/Gambit/).

**Permanent progress record:** [BUILD_LOG.md](BUILD_LOG.md) is mandatory for every substantial milestone, with exact evidence, failures, unfinished systems and next action.

**Current Phase-1 game/system specification:** [GAME_ARCHITECTURE_V1.md](GAME_ARCHITECTURE_V1.md), with an executable, fail-closed shell contract in [`src/architecture/game-shell.mjs`](../src/architecture/game-shell.mjs). The [Arena five-round feasibility / signature GAMBIT decision record](ARENA_V3_FEASIBILITY.md) is under research; its pure stake candidate has 432 symmetric/bounded test cases, **not** competitive validation or onchain deployment. Architecture status is **in progress**, not signed off. The BLACKSITE local research engine exists but has no UI or onchain deployment.

## 5. Locked build order — architecture and working game BEFORE graphics

**This section is a direct statement of the owner's original plan and overrides any older phase language that mixes artwork into the systems build. Do not skip or reorder.**

> **1. Finish game architecture and design → 2. Build and test a fully working, responsive greybox game → 3. Validate end-to-end behaviour, game feel and reliability → 4. ONLY THEN begin final game graphics, animation, visual polish and audio.**

The existing provisional Phaser arena, vector characters and basic UI are debugging scaffolds. They may remain usable while we work, but **no premium art pass, sprite replacement, cinematic overhaul or cosmetic-first redesign is authorized as the next production phase**. Fix UI only where necessary to expose or test functional game states and user actions. This is a work-sequencing rule, not permission to ship an inaccessible or unusable test interface.

### Phase 1 — Lock full game plan, design and architecture (CURRENT PRIMARY TASK)

Produce reviewable specifications and architecture for **all four** product pillars before production graphics:

- **ARENA:** complete rules, match loop, three classes/roles, three sectors, conditional tactics, formations, intended multi-round format, high-stakes GAMBIT commitment hypothesis, fair win/lose conditions, ability interactions, matchmaking/invite/rematch, async turn timing and privacy disclosures. Decide explicitly which features are already verifiable on `SquadGambit` and which require a versioned contract change. Resolve ambiguities in design before calling the game architecture finished.
- **BLACKSITE:** mission loop, playable objective, puzzles/codes, clues, secrecy model, success/failure, progression, adversarial/brute-force limits, why FHE adds a meaningful mechanic, lifecycle and user navigation. It is **a planned mode**, not working yet.
- **TRAINING:** guided tutorial steps and unlock/progression logic, practice bot behaviour, valid/invalid moves, deterministic teaching outcomes, onboarding-to-PVP transition, session resets.
- **COMMANDER PROFILE:** explicit user identity and privacy, authoritative match/missions history and achievements, derived statistics, storage and chain verification, progress/recovery states; no synthetic matches or fake wins.
- **Shared systems:** separate deterministic game rules from Phaser renderer; application/scene navigation and screens; state machines for matchmaking, missions and progression; data schemas; service boundaries; storage and chain adapter contracts; responsive input event model; error/retry/restore; threat model; performance/latency/HCU assumptions. Specify every supported action's input, output, failure and observed state.

**Exit gate:** approved, coherent gameplay specification and architectural state/data-flow diagram; module and API contracts; list of all interactions and failure states; milestone acceptance tests and risks. All product pillars have a design/architecture definition. No artist-quality mockup is an exit requirement.

### Phase 2 — Implement the full functional, responsive greybox

- Build actual stateful playable actions and real navigation for each planned experience (Arena, Training, BLACKSITE and Commander Profile) according to the agreed staged release scope. **When a pillar is not implemented, mark it incomplete; never create a fake clickable placeholder and call it working.**
- Arena must handle role selection, programming, formations, counters, multiple intended gameplay states, outcome/replay, full actual opponent journey, and reliable no-wallet practice; if multi-round confidential play requires a new contract, retain the honest single-encounter mode until that extension is verified.
- BLACKSITE must have a mechanically complete mission from entry to win/fail/retry before it receives art.
- Training must onboard a novice through a working action → consequence → learning loop; Commander Profile must display only genuinely sourced identity, history and progression.
- Verify the UI **responds correctly** to every action at desktop and mobile sizes: visible acknowledgment, correct transitions, no dead buttons, usable touch targets, correct keyboard focus, loading and cancel states, restart and recovery. Functional responsiveness means user feedback and technical reliability, not merely responsive layout.
- Automated deterministic rules, browser E2E, error-state, performance and fairness checks are mandatory. Crypto actions stay user-approved and authenticated; do not simulate onchain claims.

**Exit gate:** each in-scope feature is actually playable/clickable and survives navigation, refresh, rematch, invalid input and network failure as appropriate. Rules, UI and data agree; desktop/mobile browser evidence passes; no known critical functional blockers; open items explicitly listed. No final assets required.

### Phase 3 — Prove game responsiveness, stability and real player experience

- Test completed functional flows with uncoached users, measure where they hesitate and which choices feel consequential. Verify opponent behaviour and dominant strategies with reproducible match simulations.
- Audit input latency, animation-independent state changes, network/KMS waits, match recovery, reproducibility, privacy and exception handling, plus repeated actual Sepolia matches with **fresh individual approval** if required.
- Repair design and implementation failures **before** polishing visuals. Any rule/mechanic redesign goes through the same deterministic and integration tests.
- Independently check that four game pillars and navigation fit together as one understandable product.

**Exit gate to visual production:** functional game design is stable, critical paths play correctly, input and results respond reliably across devices, and there is a documented design/architecture freeze for visual asset production. A single real duel alone does **not** satisfy this gate.

### Phase 4 — Only after the earlier gates: make it LOOK and FEEL like a finished game

- Replace provisional vector silhouettes with **original approved game characters**, sprite/animation sets and cohesive 2.5D environments.
- Add combat movement, role-specific reactions, mission scenes, UI presentation, lighting, transitions, feedback VFX and original/licensed sound/music with mute/reduced-motion controls.
- Polish across the **entire game**, not only the landing page or one results modal; preserve game logic, accessibility, information confidentiality and browser performance.
- Run actual visual acceptance, playtests, mobile/accessibility checks and performance regressions.

### Phase 5 — Independent release audit and hackathon submission

Adversarial security/privacy review, repeated complete match evidence, objective screenshot and performance QA, actual external players, story-driven demo walkthrough, clean repo and official submission. Any real-person pitch requirement must be respected. Do not call a demo, CI run, or two-player proof a complete shipped product.

**Hackathon scheduling:** Submission is an intermediate deadline; do not misrepresent BLACKSITE, Profile, multi-round Arena or the planned signature mechanic as shipped when they are not. Document deferrals without silently deleting them from this master scope.

**Current position (21 Nov 2026):** the architecture and full game plan are **not locked**. Training's local practice and one single-encounter Arena FHE vertical slice are implemented and verified, but that is not a finished four-pillar functional game. **Resume Phase 1 immediately. Do not start the premium graphics pass yet.**

## 6. Anti-forgetting rules for every subsequent build session

1. Read **this file before choosing next work**. The README is the public entry, `docs/STATUS.md` is the evidence log, the charter sets acceptance gates and this file defines **full scope**.
2. Before coding, name the product pillar **and the current build-order phase**. Prioritize architecture/game mechanics and complete functional behaviour. **Do not begin aesthetic-first redesign, final artwork, custom sprites, audio or cinematic polish until Phases 1–3 have passed.**
3. After coding, update the matrix above or `docs/STATUS.md` with verified changes and links; label all unproven work **planned** or **in progress**.
4. Preserve **Duel #1** as finalized. Never automatically replay or send transactions. New deployments and onchain writes require specific explicit permission.
5. Maintain distinction between a finished **encrypted core proof**, a working **practice prototype**, a genuinely polished **Arena product** and the four-pillar **GAMBIT platform**.
6. Do not start the final submission/demo solely because CI is green. A strict review should still find a reason for players to love and replay the game.

## 7. Current decision

**We have completed one encrypted technical vertical slice, not the game architecture or complete product.** The next task is to lock the detailed four-pillar game design and system architecture (Phase 1), then implement and test all agreed functional interactions and responsiveness (Phases 2–3). **Final graphics, audio and aesthetic production begin only after those gates pass.**

For status that might change after this document, consult live GitHub Actions and [`docs/STATUS.md`](STATUS.md), not an old percentage or obsolete checklist.
