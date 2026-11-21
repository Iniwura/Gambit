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

## 5. Production sequence (do not skip game-design proof)

**P0 — Independent baseline audit and gameplay lock.** Strict uncoached playtest of current practice and first-slice judge journey; benchmark choice quality, dominant strategies, opponent behavior, confusion points, performance and FHE security assumptions. Define exact target Arena rules, including whether and how a five-round confidential session and hidden GAMBIT intervention can work without excessive HCU or delays. Record scored visual gameplay evidence, not just CI. **Priority now.**

**P1 — Premium core ARENA vertical slice.** Make the moment-to-moment tactical loop genuinely fun and readable, deliver coherent original characters, environment, responsive controls, VFX/sound and compelling consequence feedback. First-time onboarding must be direct; no technical modal as the core game. Re-run human playtests.

**P2 — Finished Create/Join/Recover/Verify experience and repeatability.** Productize the complete asynchronous two-player journey, real match lobby/history and rematch handling; run additional *distinct* full Sepolia matches when individually approved; measure user time/cost and verify failure recovery, privacy and fairness. Only upgrade the onchain rules after acceptance tests and explicit authorization for new deployments/writes.

**P3 — Competitive Arena expansion.** Validate and implement the high-stakes GAMBIT commitment and evolving multi-round gameplay through a versioned, audited-enough FHE rule set; add richer human competition and secure match identity/recovery. Avoid claiming one encounter is an entire five-round onchain battle.

**P4 — BLACKSITE.** Specify and implement a genuinely different confidential mission/codebreaking gameplay loop, with verified win/failure, replay and bounded secrecy mechanics. This is *not* part of the already proven first onchain slice.

**P5 — COMMANDER PROFILE and longevity.** Verified receipts/history, stats, achievements, progression, missions and appropriately private identity; polished mobile UX and long-term motivation.

**P6 — Professional release and hackathon package.** Independent adversarial security/privacy audit, several newcomer playtests, visual/audio production acceptance, performance/accessibility QA, compelling live walkthrough, clean GitHub docs, authentic receipt evidence, X post, and the required real-person Zama pitch. Avoid AI voice for a real-person-required pitch. Do not label the full product complete before these gates.

**Hackathon discipline:** the competition is an intermediate milestone, **not** permission to discard the full product. Prioritize credible, strong playable Arena and a polished self-contained submission by the official deadline. If all four pillars cannot be responsibly finished by then, keep them on the published roadmap rather than misrepresent them as shipped.

## 6. Anti-forgetting rules for every subsequent build session

1. Read **this file before choosing next work**. The README is the public entry, `docs/STATUS.md` is the evidence log, the charter sets acceptance gates and this file defines **full scope**.
2. Before coding, say which product pillar and production stage the change advances. Avoid isolated UI/README tweaks when core gameplay and full-product gaps are still unsolved.
3. After coding, update the matrix above or `docs/STATUS.md` with verified changes and links; label all unproven work **planned** or **in progress**.
4. Preserve **Duel #1** as finalized. Never automatically replay or send transactions. New deployments and onchain writes require specific explicit permission.
5. Maintain distinction between a finished **encrypted core proof**, a working **practice prototype**, a genuinely polished **Arena product** and the four-pillar **GAMBIT platform**.
6. Do not start the final submission/demo solely because CI is green. A strict review should still find a reason for players to love and replay the game.

## 7. Current decision

**We have completed the confidential foundation, not the complete game.** Start with P0: rigorous gameplay/experience audit, then deliver a production-quality Arena vertical slice before treating secondary pages as substitutes for building the full game. Maintain BLACKSITE and Commander Profile as explicit future pillars.

For status that might change after this document, consult live GitHub Actions and [`docs/STATUS.md`](STATUS.md), not an old percentage or obsolete checklist.
