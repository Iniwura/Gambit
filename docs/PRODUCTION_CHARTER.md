# GAMBIT — production game charter
Status: adopted production direction, not a claim of completed implementation.
Last revised: 2026-11-21.
Product: GAMBIT: Sealed Orders — a full, persistent competitive game built with Zama FHE.
This document defines quality gates independent of any hackathon deadline.

**Full product scope and phase roadmap:** [GAMBIT Master Scope](GAMBIT_MASTER_SCOPE.md). This charter defines production acceptance gates; the master scope records the entire four-pillar vision and current implementation status.

**Functional architecture specification:** [Game Architecture and Mechanics v1](GAME_ARCHITECTURE_V1.md) documents four pillars, source-of-truth boundaries, canonical onchain constraints, gameplay states and unfinished Phase-1 decisions.

## Product promise

**Play as a commander, outthink another human, keep your orders secret, and trust the result.**

A match should be enjoyable even for a player who does not know Zama, FHE, EVM, or crypto. Cryptography is the rules engine that makes hidden tactics credible, not the headline feature that carries an otherwise uninteresting game. The visual target is a complete, legible, polished 2.5D strategy game, not a website, card dashboard, contract console or decorative animation.

The non-negotiable design test: take away the art and the blockchain branding. Are the decisions understandable, strategically meaningful and worth repeating? If not, repair the game rules first.

## Product pillars

1. **Mind game first.** Players make predictions about another human, choose a deployment and secret conditional commands, and deliberately risk counterplay. No arbitrary luck in the tactical outcome.
2. **Tactical readability.** Exactly three fighter roles, three reactor sectors, clearly labeled commands, strong anticipation, satisfying action and honest outcome feedback.
3. **True confidentiality.** The opponent cannot browse encrypted submitted orders; contract code cannot reveal them through events or client debug data. Only the authorized public aggregate outcome is shown.
4. **Authentic ownership.** Two distinct wallets can complete a real onchain game. The UI recovers from refresh, pending transactions, account switches and interrupted cryptographic operations.
5. **Production game feel.** Custom recognizable characters, expressive animation, sound, responsive controls, seamless onboarding, accessibility, reliable session recovery.
6. **Verifiable fairness.** One canonical deterministic scoring specification shared by reference engine, FHE contract parity tests and public independent verification. No fake results.

## Locked core direction

**GAMBIT: Sealed Orders** is a head-to-head, asynchronous, three-role tactical duel. The pilot format is **one authentic encrypted 3v3 encounter**, not five simulated onchain rounds. A player chooses three independent opening/conditional tactics and one formation; the opponent independently does the same. The contract computes an aggregate score in FHE; the public game animates only information actually authenticated onchain. Neither wallet is promised a view of the other player's secret lane-by-lane decisions.

The *future* signature mechanic is a **once-per-match secret GAMBIT commitment**, a high-risk intervention on one fighter or reactor sector. It should create a meaningful bluff with an explicit tradeoff. This mechanic is a design hypothesis, not shipped code, and requires paper prototype, adversarial balance simulation, FHE cost estimate, new versioned Solidity implementation, security review and testnet proof before being advertised as playable.

### What not to confuse

- The current deterministic local 3v3 practice game is **cleartext** and can show per-lane tactical teaching.
- The existing deployed `SquadGambit` contract computes **one encrypted 3v3 encounter** and publicly finalizes **aggregate reactor points** only. It does not support the full 5-round practice match or the proposed once-per-match GAMBIT commitment.
- The earlier `SealedGambit` contract is a separate, smaller, one-plan protocol; it should not appear in production game onboarding.
- Zama encrypted operations are asynchronous and constrained by network compute limits (HCU), ACLs and verified public decryption. The client must present honest pending states, never fake real-time certainty or per-fighter onchain reveals.
- A verified deployment and green mock CI are not a signed two-wallet match.

## Player experiences (game before wallet)

### 1. Arrival
- Single primary action **Play GAMBIT**. Supporting actions: Practice, How to Play, Matches.
- Under 30 seconds to first meaningful practice decision for a first-time player (measure, do not assume).
- Explain: "Choose three secret orders. Outsmart their formation. Control the reactor." Never require crypto knowledge up front.

### 2. Practice
- A complete, responsive, no-wallet tutorial battle with a readable objective, choice preview, one real consequence and a clear next-step explanation.
- Steady, Reactive and Volatile bots use the same tested game rules; no peeking at current hidden plans and no exploitable pure repeated tactic.
- Show three fighter classes, distinct purposes and the possibility of countering another player.
- Result screen teaches a useful next decision; **Play again** is unmistakable.

### 3. Competitive play
- Choose **Create Match** or **Join Match**.
- Create: connect wallet only when necessary, verify network/runtime, enter distinct invited opponent address or obtain an approved invite identity, seal orders with exactly one user-confirmed transaction.
- Share a link containing only the public onchain squad ID. Never embed ciphertext input proofs, private tactics, seed phrases, session tokens or credentials in URLs.
- Join: load a public invite link, inspect inviter/availability, connect the actual invited wallet, submit own encrypted squad by explicit actions.
- Lobby has real canonical states: **invited → opened → submitted → resolving → finalizing → verified**. State names may be displayed as friendly language but must map to the contract.
- Display exact transaction status and recover it after browser refresh or tab loss; never claim opponent ready from local storage.
- Asynchrony: visible wait states, clear retry and recovery rules, no blind automatic transaction resends or repeated decrypt requests.
- Verified match: authenticated aggregate scores only, earned result animation, public explorer and replay/rematch link, not fabricated tactical evidence.
- No production matchmaking server unless it can avoid leaking private plans and can degrade safely when unavailable.

### 4. Long-lived product
- Match history from independently verified chain records, real invitations, recovery, rematches, opt-in notifications, basic player identity, localization-ready copy and cross-device UX.
- **Not Phase 1:** purchasable skins, NFTs, token economy, wagering, arbitrary ranked ladders, many arenas, sprawling campaigns. Add only after repeat play is demonstrated.

## Engineering architecture

**Core rules:** `src/squad.mjs` and a strictly versioned deterministic specification; explicit golden test vectors against `SquadGambit` reference execution and adversarial property/fuzz tests.

**Onchain:** versioned `SquadGambit` deployments with published source, immutable code fingerprint, correct FHE input validation, ACL and proof binding, scoped approvals and bounded expiry/one-use semantics. No silent contract upgrades or legacy ABI fallback.

**Browser:** Phaser game presentation separated from chain transport; signed-wallet flow separated from no-wallet practice; UI state driven by canonical chain state. The browser can cache public IDs for convenience but must revalidate onchain.

**Operations:** reproducible CI, contract/static check, real-browser screenshots, accessibility and mobile audits, documented rollback, deployment provenance, error telemetry that redacts wallet/signature/ciphertext/private-tactic payloads, privacy notice, outage and degraded-state UX.

**Privacy threat model:** chain analytics, private-order inference from repeated oracle queries and aggregate score, opponent collusion, abandoned invitations/griefing, RPC failures, malicious invites, stale wallets, session replay, wrong-chain signatures, ciphertext/proof mismatches, data leakage in events/logs, misconfigured env variables, and unsafe copy/share links.

**Rule:** every new feature must protect UX, developer reliability and encrypted-state correctness simultaneously.

## Measurable production acceptance gates

A feature is not "done" merely because it compiles. All applicable gates need evidence.

### G0 — Honest existing product baseline
- [x] Playable practice mode and responsive desktop/mobile controls.
- [x] A versioned encrypted v2 contract deployed on Sepolia and checked against runtime hash.
- [x] FHE mock compilation, rules checks, TypeScript build, real Chromium E2E checks green on PR #5 head `0e390e953ebc8040e51d5ba5da4038e8fdbedafd`.
- [x] First real v2 encrypted session completed and independently verified on Sepolia (Duel #1, final receipt and KMS proof). See [evidence](STATUS.md). **One match is not a repeatability or security audit.**
- [ ] Premium original art/audio, first-time-player usability, independent review.

### G1 — Authentic encrypted session (blocker for production claims)
- [x] One **distinct-wallet** seal → open → submit → resolve → KMS-proof finalization, real Sepolia receipts and exact event/state identity. Completed for Duel #1 only; [independent evidence](STATUS.md).
- [ ] Measure real encryption, RPC, FHE processing and KMS wait time plus fees/HCU when observable. Set UI expectations from real evidence.
- [ ] Test recovery after refresh, failed RPC, wrong wallet, chain switch, expired invitation, cancelled signing, reorg/ambiguous receipt, duplicate attempt.
- [ ] Verify no private plan or per-lane data in public score reports, events, logs, share links or telemetry.
- [ ] Independent third party reproduces public aggregate score verification.

### G2 — Engaging strategic game
- [ ] Three roles each create a meaningful non-redundant decision; formations interact fairly.
- [ ] Broad simulation across fixed choices, adversarial search and mixed policies; reject dominant no-thought play.
- [ ] Blind first-play tests: at least 4/5 people understand objective and command basics without coaching, 3/5 want a voluntary rematch. These are OUR targets, not official judging thresholds.
- [ ] Newly proposed GAMBIT commitment passes gameplay test before any contract change.
- [ ] Never make the public encrypted match less intelligible than its honest information model allows.

### G3 — Polished player-facing production
- [ ] Custom character system, readable class silhouettes, idle/selection/attack/recoil/win/lose states, clear VFX, original or licensed audio with mute controls.
- [ ] No overlapping UI at 320, 390, 768, 1024, 1440, 1920px and standard mobile landscape sizes; no excessive tiny board on portrait.
- [ ] Maintain responsive input, high-quality motion, reduced-motion option, keyboard and touch accessibility, understandable contrast, legible typography.
- [ ] Professional lobby/invite, reconnect, score and history screens; screenshot and human visual review required beyond passing Playwright.
- [ ] Performance targets tested on modest mobile hardware; no unmeasured claim of 60 FPS.

### G4 — Production reliability/security
- [ ] Explicit network/account/contract version checks; no transactions without deliberate user approval.
- [ ] Adversarial contract tests, property checks, replay/front-running/griefing model, ACL proof review and independent code/security review.
- [ ] Incident/error handling, RPC fallback strategy, monitoring without secrets, documented recovery and versioned rollbacks.
- [x] Wallet-free read-only verification of Duel #1, verified public deployment metadata, provenance and reproducible build. Additional matches and external audits remain open.
- [ ] No payments/billing/production promotion without the owner's explicit authorization.

### G5 — Real-world release quality
- [ ] Repeatable human-vs-human Sepolia sessions: **one complete verified match exists**; another independent complete session is still required to demonstrate repeatability.
- [ ] Five-round aspirations are either supported by verified onchain protocol or clearly labeled as separate practice; not conflated.
- [ ] Product copy, documentation and demo reflect actual features and tested constraints.
- [ ] Submission materials meet Zama's current official requirements; 3-minute REAL-PERSON pitch (not AI voice). The hackathon is a milestone, not the definition of the product.

## Priority order — ARCHITECTURE FIRST, GRAPHICS LAST

**First — game design and architecture:** lock rules, four-pillar feature scope, states, interface contracts, schemas, functional specifications and testable acceptance criteria. Current source includes a verified Duel #1, but the **whole game architecture is not complete**.

**Second — make the game actually WORK and RESPOND:** implement the planned functional greybox with correct controls, navigation, gameplay states, tactical consequences, mission and profile logic, create/join/recovery, meaningful feedback, persistent state and reliable failure handling. Keep provisional visuals.

**Third — functional evidence:** deterministic and adversarial tests, responsiveness across mobile/desktop, meaningful playtests, fairness checks, repeatable authentic Sepolia flows under separate per-transaction approvals and recovery from failures. Do not move to visual production with known core gameplay defects.

**Fourth — graphics and production feel:** only when prior gates pass, replace provisional art and create original high-quality fighters, arenas, animations, VFX, sound and final UI. Maintain full responsiveness, security and playability.

**Last — release audit and submission:** end-to-end game, accessibility, performance, security, real user playtests and authentic demo.

This owner-approved sequence is locked in [GAMBIT Master Scope](GAMBIT_MASTER_SCOPE.md), section 5. Earlier mentions of premium vertical-slice art do **not** authorize cosmetic work before the greybox functional gate.

## Release discipline

- Use draft PRs and reviewable vertical slices; never knowingly merge failed checks.
- Treat the first real user session, wallet signature, chain timing and test feedback as evidence.
- Never claim production readiness, human competitive balance, private encrypted replays or 10/10 quality based solely on mocks, screenshots, design concepts or anecdote.
- Do not invent an expected release date or guarantee a competition result.
- Keep the project independently valuable if the event result is disappointing.

## External standards consulted

- Zama Developer Program Season 5 official rules: https://www.zama.org/post/zama-developer-program-mainnet-season-5-confidential-gaming
- Zama FHEVM HCU limits: https://docs.zama.org/protocol/solidity-guides/development-guide/hcu
- Zama encrypted input validation: https://docs.zama.org/protocol/solidity-guides/smart-contract/inputs
- Zama FHEVM ACL: https://docs.zama.org/protocol/solidity-guides/smart-contract/acl
- Zama authenticated decryption: https://docs.zama.org/protocol/solidity-guides/smart-contract/oracle
