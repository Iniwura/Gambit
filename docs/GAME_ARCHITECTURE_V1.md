# GAMBIT — Phase 1 Game Architecture and Mechanics Specification

**Draft architecture baseline v1 · 21 November 2026 · FUNCTION FIRST · NO GRAPHICS WORK**  
**Owner's mandatory sequence:** full game plan/architecture → correctly working, responsive greybox → reliability and fun validation → only then premium graphics/audio.

This specification implements the architecture phase of the [master scope](GAMBIT_MASTER_SCOPE.md). It describes the **target complete four-pillar game** and explicitly marks decisions that remain hypotheses. A spec or headless state contract is *not* a feature implementation. The repo's [status log](STATUS.md) and authentic receipts are the evidence source for actual completed work.

## 1. Design objectives and product boundary

**Player fantasy:** command Scout, Guardian and Striker, secretly program conditional orders, anticipate an opponent's formation, control the reactor, attempt confidential BLACKSITE missions and grow a commander identity across real, verifiable achievements.

**Product pillars:**
- **ARENA:** flagship competitive tactical game. Target evolving multi-round confidential PVP; presently one authentic single-encounter FHE match exists.
- **TRAINING:** first-use tutorial, deterministic five-round local practice and tactical mastery. Presently a five-round practice core exists.
- **BLACKSITE:** distinct limited-information codebreaking/infiltration missions. Presently a tested **headless local research reference** exists, not a playable mode.
- **COMMANDER PROFILE:** persistent account identity, verified match/missions history and earned achievements. Not implemented.

**Prohibition:** do not imply that displaying a scene, possessing a reducer, or passing mock/CI checks means the feature is live. All user-facing claims must distinguish `LOCAL CLEAR-TEXT`, `SIGNED SEPOLIA TRANSACTION`, `ONCHAIN VERIFIED` and `PLANNED`.

The official Season 5 judging emphasises gameplay/UX, confidentiality that materially shapes the game, fairness, actual Sepolia functionality, demo and code quality. Evidence: https://www.zama.org/post/zama-developer-program-mainnet-season-5-confidential-gaming . Graphics are a later production phase, not a substitute for functioning rules.

## 2. Architectural boundaries (decisions)

| Layer | Owns | Must NEVER own |
| --- | --- | --- |
| **Game domain** (`src/squad.mjs`, `src/engine.mjs`, future mode rule modules) | Deterministic rule transitions, scoring, legal commands, mode state and verified local transcripts | Wallet signing, Phaser animation, public blockchain finality |
| **Application orchestrator** (new `src/architecture/` + future feature controllers) | Scene availability, input commands, state transitions, read-only recovery and explicit capability gating | Secret tactics in telemetry, fabricated chain states, direct DOM control inside rule reducers |
| **Game renderer** (Phaser scenes) | Input presentation, action feedback, stage motion, scene transitions and accessible mirrored UI | Recomputing sealed outcomes, decrypting private enemy moves, marking unmined transactions final |
| **FHE adapter** (`src/chain/squad-sepolia.ts`, Solidity v2 + current SDK) | User-signed bounded actions, encrypted input creation, RPC receipt and KMS proof validation | Automatically signing/retrying/finalizing, pretending one encounter contains five rounds |
| **Public verification** (`src/chain/squad-public-reader.ts`) | Chain identity, immutable runtime hash, canonical finalized status/score, one-use invitation linkage | Calling `eth_sendTransaction`, decrypting private lane results, trusting an arbitrary URL as proof |
| **Persistence** (future data adapter) | Versioned local tutorial preferences/continuation; immutable indexed public receipts for profile | Storing cleartext player secrets, inventing opponents or achievements |
| **Accessible UI surface** (DOM command deck and dialogs) | Input focus, visible wait/errors, touch targets, retry guidance, screen-reader feedback | Bypassing authoritative rule validation or merging local practice with onchain evidence |

**Immediate source contract:** `src/architecture/game-shell.mjs` exports a pure, deterministic, immutable scene model with named available/unavailable scenes. It deliberately refuses to navigate to unfinished Competitive Arena, BLACKSITE Mission or Commander Profile. This is **architectural scaffolding**, not a functional multi-screen game. See `tests/game-architecture-contract.test.mjs`.

**Dependency rule:** UI → application/command handlers → domain and adapters; renderer observes validated public state. The Solidity contract is the authoritative source for real FHE match status and outcomes. Pure domain modules must import neither renderer nor wallet SDK.

### Target module boundaries (planned, not all created)

```text
src/
  architecture/
    game-shell.mjs                 # BUILT: fail-closed capability model; not mounted as UI yet
    input-router.mjs               # PLANNED: action → domain command
    state-store.mjs                # PLANNED: scoped state + versioned restoration
  arena/
    rules.mjs                      # PLANNED: adapter to existing squad.mjs reference
    match-controller.mjs           # PLANNED: local vs encrypted match flow
    lobby-controller.mjs           # PLANNED: Create/Join/Wait/Recover
    round-policy.mjs               # PLANNED: versioned multi-round expansion
  training/
    tutorial.mjs                   # PLANNED: guided first actions and mastery
  blacksite/
    mission.mjs                    # BUILT: headless local mission; NOT playable or FHE
    private-mission-adapter.mjs    # PLANNED: entirely separate FHE protocol, after feasibility approval
  profile/
    verified-arena-record.mjs      # BUILT: trusted receipt reader; NOT a Profile UI
    approved-event-discovery.mjs   # BUILT: bounded canonical log candidate indexer, NOT ranked history
    progression.mjs                # PLANNED: validate earned achievements
  chain/                            # EXISTS: squad-lifecycle, Sepolia adapters, proof reader
  research/blacksite-cipher.mjs     # EXISTS: local deduction reference only
  squad.mjs, engine.mjs             # EXISTS: deterministic cleartext reference
  main.ts, mobile-deck.ts, visual/  # EXISTS: early Phaser/input renderer, provisional art
```

### System truth/information flow

```text
PLAYER INPUT (keyboard/touch/optional wallet)
  → input router checks scene + allowed command + field validation
  → pure domain reducer for TRAINING / local BLACKSITE; no chain or secrets escape
  → semantic public event → accessible UI + Phaser renderer
                    OR
  → encrypted Arena controller checks canonical Sepolia state/roles/fee cap
  → Zama SDK encryption + one explicitly approved wallet action
  → mined receipt + event + subsequent onchain state (no optimistic finality)
  → FHE computation → public encrypted result handle → signed KMS public score
  → separately approved finalization transaction → canonical finalized state
  → VERIFIED PUBLIC RESULT (aggregate only) → renderer and profile evidence index
```

Only a **verified finalized** chain record may become a scored competitive result in Commander Profile. A local practice event is a separate `practice` record, not a competitive victory. No private plan, encrypted-input proof or wallet signer is passed into scene navigation/history.

## 3. Global game shell, navigation and feature gating

The shell is implemented as a pure reference in `src/architecture/game-shell.mjs`:
- `home`: public home (available); `training`: current local practice (available); `arena-spectate`: wallet-free verified result (available); `arena-wallet-lab`: experimental real Sepolia challenge interface (available).
- `arena-competitive`: planned full competitive mode (disabled); `blacksite-mission`: planned mission (disabled); `commander-profile`: planned persistent profile (disabled).
- Allowed commands: `OPEN(scene)`, `BACK`, `HOME`. Illegal scenes, forged fields, invalid navigation states or unfinished modes are **rejected**, never silently converted into working screens.
- Current experimental wallet lab remains isolated; enabling a full new screen requires a real controller, tests and a new capability decision, never simply changing a boolean.

**Future game UI entry:** home → Training / Competitive Arena / BLACKSITE / Profile / verified spectator. Only implemented modes may be interactive. If not ready, explain the reason or leave the feature explicitly labelled upcoming. Do not ship inert navigation buttons.

## 4. ARENA rules specification (as implemented vs planned)

### Existing deterministic three-fighter rules (verified local reference)

- Roles: **Scout, Guardian, Striker**. Each has three integers `base`, `trigger`, `response`, values `0 STRIKE`, `1 GUARD`, `2 FLANK`.
- Simultaneous conditional action: if opponent's **base** equals own `trigger`, execute `response`; else execute `base`. Both sides evaluate against their opponent's original base, not the adjusted action.
- Outcomes: draw for equal actions; `STRIKE > FLANK`, `GUARD > STRIKE`, `FLANK > GUARD`.
- Formation numbers: `HOLD=0` [Scout, Guardian, Striker], `PIVOT=1` [Guardian, Striker, Scout], `FEINT=2` [Striker, Scout, Guardian]. Formations permute **role-to-sector assignment**, not the role's identity.
- Each role wins one base reactor point. Winning **Striker** gains +1 breach; if Scout **and** Striker win, +1 mark; a winning *opposing* Guardian subtracts one extra Striker-related bonus, never the base win point. Per-team score is 0–5.
- Local practice: five complete rounds; cumulative reactor pressure chooses winner; capped [-3,+3] momentum is **display feedback**, not an alternate early-win condition. Bot seeded deterministic, only public previous results inform adaptation. This is *not* onchain randomness.
- Current live v2 onchain: each player encrypts **10 euint8 values** (3 × base/trigger/response plus one formation), one invited distinct challenger, one-use squad, submission deadline 24 hours after opening. The contract computes **one** encounter. Only the 3-bit-per-team **packed aggregate** (`8*challengerPoints+defenderPoints`) is publicly decrypted with KMS proof. No individual lane outcomes, tactical programs or formations may be published.
- Live v2 result proof: `SquadGambit` at `0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134` on Sepolia; Duel #1 authentic aggregate was 0:1 Violet. See [evidence](STATUS.md). This is **one verified example**, not complete reliability or a finished multiplayer product.

### Human-vs-human future rules (DESIGN CANDIDATES, NOT DEPLOYED)

**Competitive match structure:** [Arena v3 feasibility and stake research](ARENA_V3_FEASIBILITY.md) compares the real multi-round options and explicitly leaves the final contract design unapproved. Target a best-of-five/five-round match where players can react to public prior-round pressure between confidential turns. A prior private plan must remain secret; revealing a signed aggregate from each round may still enable inference, so rate-limit each sealed policy to one query. A real multi-round protocol requires explicit per-round identities, each player's fresh orders, per-round expiry/resolution, tie handling, season result, interruption recovery and measured HCU/latency. **We have not chosen and approved a v3 contract design.** A batched precommit of five rounds would remove adaptation; a separate round per transaction adds real signing/latency cost. Test the tradeoff before choosing.

**Signature GAMBIT commitment:** a headless, unshipped [research candidate](../src/research/gambit-commitment-v0.mjs) explores secretly staking one reactor sector (+2 pressure if won, -1 if not, clamped at zero). The separate [five-round local research reducer](../src/research/arena-v3-match.mjs) now enforces once-per-match usage, duplicate refusal and aggregate-only public history in reference state; **not onchain or connected to player UI**. [Feasibility decision record](ARENA_V3_FEASIBILITY.md). Exact trigger, reward, penalty, information leakage, score bounds, tie handling and FHE cost are **OPEN**. No client or contract change until strategy simulations and player tests show the mechanic beats a cosmetic bluff.

**Full Arena acceptance test:**
1. Two real players can create/join an authentic match, choose valid and private plans, inspect progress and recover on page refresh.
2. Every UI action has immediate readable feedback, wrong-role/wrong-network/rejected-signature/expired-match behaviours and no silent duplicate transactions.
3. Local deterministic reference matches deployed FHE scoring; a full match never reveals per-role results from an encrypted aggregate.
4. Multi-round and signature mechanics pass independent balance tests and audited-enough onchain feasibility before deployment.
5. A second authentic full session demonstrates repeatability, with each new write separately approved.

## 5. BLACKSITE rules specification (playable local greybox; competitive FHE mode not built)

The existing `src/research/blacksite-cipher.mjs` and `tests/blacksite-cipher.test.mjs` already define a mathematical reference:
- Four ordered symbols in `0–3`, repeats allowed: **4^4=256** possible secret codes.
- A local training mission allows **five guesses** (reference constructor also permits 4–6 for research).
- A guess receives only **exact-position count** and **correct-but-misplaced count**, correctly accounting for duplicate symbols. Valid total 0–4, with exact+misplaced ≤ 4.
- Repeated guesses are rejected; a correct four-exact answer ends in `breached`; running out of attempts ends in `locked`. Feedback history is immutable and the public snapshot explicitly excludes the local secret.
- Reference exhaustive tests show a perfect offline minimax solver can find all 256 codes in at most four feedback queries. **That is a mathematical observation, NOT a fun game, human skill result, or encrypted proof.**

**Local mission controller plus browser greybox IMPLEMENTED:** [`src/blacksite/mission.mjs`](../src/blacksite/mission.mjs) enforces briefing → active → at most five guesses → breached/locked → debrief → restart with a distinct local ID. [`src/blacksite/greybox.ts`](../src/blacksite/greybox.ts) mounts real keyboard/touch controls, visible clue feedback and error states over the existing Arena, with no reset to its local practice seed; it enters the explicitly authorized [`blacksite-training`](../src/architecture/game-shell.mjs) shell scene. The training secret stays out of public snapshots via WeakMap, **but this is not cryptographic browser secrecy**. [Domain tests](../tests/blacksite-mission-contract.test.mjs) cover all 256 secrets; [desktop/mobile browser E2E](../tests/blacksite-greybox-browser-check.mjs) is part of the full quality suite. [Detailed greybox acceptance contract](BLACKSITE_GREYBOX_ACCEPTANCE.md). **The competitive BLACKSITE FHE mission, mission worlds, secure creator/solver protocol and actual encrypted contract remain unbuilt.**

**Additional Phase-1 competitive research:** [BLACKSITE v2 Security and Balance Decision](BLACKSITE_V2_PROTOCOL_DECISION.md) tests a distinct 7,776-code rule set with paid aggregate class scans. An exact exhaustive information audit found two fixed guesses significantly more informative than a scan+guess in the tested opening; **competitive scans are NOT APPROVED as currently designed**. The local original tutorial remains 256 codes. This does **not** demonstrate human solvability, strong cryptographic entropy or a real FHE mission.

**Critical feasibility decision:** 256 codes ≈ 8 bits of entropy, and five attempts plus aggregate clues may leak enough to solve the puzzle predictably. Do not assert robust secrecy, uniqueness or resistance to brute-force. Before making a Zama contract: design one-use mission IDs, creator versus solver authority, cryptographically acceptable secret sourcing/commitment, FHE comparison and hint budget, anti-grief/anti-replay, HCU/latency, public reveal policy and recovery. Never emit or locally log a hidden mission code in onchain mode. The local training prototype is cleartext only.

**Blacksite gates:** local training is now implemented with stateful controls and responsive styling; **do not mark cross-device browser acceptance verified without a completed passing run**. Competitive BLACKSITE remains explicitly blocked until a fair secret protocol, meaningful gameplay/economy, contract, complete browser flow and authentic encrypted receipts are independently tested. No local win can be ranked.

## 6. TRAINING rules specification

The current TRAINING baseline is `makeSquadMatch` + `commitSquadTurn` + Phaser/DOM command deck, **five deterministic cleartext rounds** and three bot styles (steady, reactive, volatile).

**Target tutorial state machine (PLANNED):**
```text
NOT_STARTED → FIRST_MOVE → CONDITIONAL_COUNTER → ROLE_COMPOSITION
            → FORMATION_MASTERY → FULL_PRACTICE_MATCH → REVIEW → COMPLETE
```
- Every step has one required player choice and a visible result. Prevent accidental skipping unless optional, and preserve valid progress in a versioned local preference record.
- Explain Scout mark, Guardian denial and Striker breach using **actual local public lane evidence**; never derive educational examples from a genuine FHE opponent's sealed plans.
- Uncoached beginner goal: first meaningful action in ≤30 seconds (target, not measured); understand objective and turn submission; voluntarily replay. Record tested outcomes, not asserted engagement.
- Local bot uses deterministic seeded reference logic. No bot is a human onchain opponent. On reboot, only safe tutorial checkpoint and preferences persist, not secret tactics.

**Failure/exit cases:** invalid move, trying to lock while resolving, navigating away mid-turn, phone layout changes, rematch reset, keyboard focus, timeouts. Clear feedback without altering authoritative simulation.

## 7. COMMANDER PROFILE specification (PLANNED; no invented history)

**Public identity model (future):** `{version,identityId,displayName?,linkedWallets[],verifiedGameRecords[],practiceMilestones[],achievements[]}`. Player names/profile links are opt-in; a wallet address alone is not a game achievement.

**Verified Arena record — INITIAL READER BUILT:** [Profile Trust and Recovery Architecture](PROFILE_TRUST_AND_RECOVERY.md) now pins the exact approved contract/deployment and independently verifies canonical block consistency. Generic mocked research records are incapable of minting ranked public wins.  [`src/profile/verified-arena-record.mjs`](../src/profile/verified-arena-record.mjs) checks the caller-supplied trusted deployment manifest, Sepolia chain, matching runtime, mined canonical receipt/event and signed KMS-proof calldata, current contract status, one-use identity and ≥12 confirmations. A module-branded record is required to derive win/loss/draw; arbitrary JSON fails closed. Avoids archival-state RPC dependence while checking canonical receipts and latest status. Record includes chain/contract/runtime, squad/duel IDs, tx/block hash, participants, aggregate, confirmations and evidence/version. Reverify after reorgs. **Duel #1 live read-only verification passed:** [CI](https://github.com/Iniwura/Gambit/actions/runs/44921548615). Complete trusted deployment registry, persistent multi-match indexing, opt-in identity and player-facing Profile remain unfinished.

**BLACKSITE record:** until a real confidential mission contract exists, only label results `LOCAL TRAINING`. Future onchain mission proofs must be independently verified against their own contract and disclosure policy; do not convert local success into public rank.

**Derived achievements:** win counts, participation, streaks and mastery must be computed from verified records with deterministic rules; local practice milestones kept separate. No synthetic opponents, dummy rank, fabricated leaderboard or hidden information in analytics.

**Persistence plan:** read-only chain index (public logs + runtime/code/receipt verification), versioned local UI preferences, optional public profiles only with appropriate consent. No passwords, wallet keys, private ciphertext proofs or decrypted strategy in storage. A disconnected wallet can view a verified public match but cannot write on behalf of the player.

**Profile gate:** an approved-contract [read-only candidate discovery indexer](../src/profile/approved-event-discovery.mjs) and one actual signed Sepolia match are now independently verified. The [focused seven-page live discovery test](https://github.com/Iniwura/Gambit/actions/runs/44924064176) passed 17/17 focused checks; the discovery result is **NOT** itself a verified win. **Profile remains disabled** until durable multi-match history/cursor reconciliation, account privacy and opt-in identity, true restart/reorg invalidation, honest empty/error UI states, and responsive browser QA have passed.

## 8. Shared state machines and interaction contract

| Mode | Proposed state progression | Source of truth |
| --- | --- | --- |
| Shell | HOME → TRAINING / ARENA / BLACKSITE / PROFILE; BACK/HOME; unavailable modes rejected | Pure `game-shell.mjs`; only present implemented scenes |
| Local Arena practice | INTRO → READY → RESOLVING → READY ×5 → FINISHED → REMATCH | `src/squad.mjs` (not animation timestamps) |
| Live v2 Arena | SQUAD_SEALED → INVITATION_OPEN → CHALLENGER_SUBMITTED → RESOLVED → KMS_PROVEN → FINALIZED; optional CLOSE/EXPIRE | Actual `SquadGambit` contract receipts + public views; KMS proven is a transient client proof, **not a separate contract flag** |
| Future multi-round Arena | MATCH_CREATED → ROUND_1…ROUND_N → MATCH_FINALIZED or EXPIRED/ABORTED | New versioned protocol, not the existing v2 |
| BLACKSITE local research | ACTIVE → BREACHED or LOCKED | Local `blacksite-cipher.mjs`; not implemented as UI |
| Future BLACKSITE onchain | CREATED → ACTIVE → ATTEMPTED → SOLVED / LOCKED / EXPIRED | New independently reviewed confidential protocol |
| Training | NOT_STARTED → guided steps → REVIEW → COMPLETE | Versioned local tutorial checkpoint + deterministic reference |
| Profile | EMPTY → LOADING → VERIFIED_RECORDS or ERROR → RECOVERABLE | Canonical public receipts/indexer; never a fabricated profile |

**Common interaction rule:** every action follows `intent → validate → accepted / refused → state transition → user-visible acknowledgement`. Async actions additionally show `waiting`, `receipt uncertain`, `verified` or `recoverable error`. **Never recommend re-signing based only on a lagging RPC response after a successful receipt**. Refresh must reconstruct state from the right authority.

## 9. Test obligations and explicit Phase-1 decisions

**Contracts written now:**
- `src/architecture/game-shell.mjs`: actual pure navigation + truthful feature availability; no DOM/wallet/network.
- `tests/game-architecture-contract.test.mjs`: refuses future features, tampered state and unknown actions; checks navigation/reversibility without private inputs.

**Architecture exit still requires:**
1. Resolve which full Arena multi-round protocol balances hidden plan secrecy, meaningful adaptation, user experience and actual Sepolia fees/HCU; prove feasibility in tests.
2. Choose and balance a meaningful once-per-match GAMBIT commitment, or reject the design hypothesis with evidence.
3. Define Blacksite mission objective, owner/solver authority, anti-bruteforce and sound encrypted secrecy, then write independent deterministic acceptance tests.
4. Finalize Profile provenance/index rules and opt-in identity/privacy model, including reorg/duplicate behaviour.
5. Complete cross-pillar input/state/restore API contracts, with independent reviewer acceptance and no contradictory dependencies.
6. Then implement actual responsive greybox flows for the four product pillars, without starting the production art pass.

**Current verdict:** Phase 1 is **IN PROGRESS**. We have a substantive architectural baseline and an executable fail-closed shell contract. We have **not** finished designing or building every promised game system.

## 10. Decision log and sources

| Decision | Rationale | Status |
| --- | --- | --- |
| Preserve proven `SquadGambit` v2 as immutable baseline | One real Sepolia game has already completed and is verifiable | LOCKED |
| Keep local 5-round practice distinct from 1-encounter FHE | Avoid inventing rounds, lane reveals or onchain match claims | LOCKED |
| Do not use final production sprites/arena/audio until functional greybox and responsiveness pass | Owner's original explicit build order | LOCKED |
| BLACKSITE four-symbol reference is useful research, not a secure full game | 256 low-entropy codes, solver bound, no real contract/UI | LOCKED boundary |
| Full multi-round v3 and signature GAMBIT | Strategic potential, unmeasured FHE cost and privacy risk | OPEN, must test |
| Personal account, season stats and verified achievements | Requires durable authenticated event indexing + privacy rules | OPEN |
| No auto wallet transactions; one signature per separately approved action | Player ownership and safety | LOCKED |
| No artificial gameplay outcomes or leaderboards | Integrity of product and hackathon evidence | LOCKED |

Official references: [Zama competition](https://www.zama.org/post/zama-developer-program-mainnet-season-5-confidential-gaming), [Zama HCU](https://docs.zama.org/protocol/solidity-guides/development-guide/hcu), [Zama ACL](https://docs.zama.org/protocol/solidity-guides/smart-contract/acl), [Zama public decryption](https://docs.zama.org/protocol/solidity-guides/smart-contract/oracle).

**Next engineering build:** finalize Phase-1 decisions and testable contracts, especially multi-round Arena economics/fairness and BLACKSITE mission protocol. Don't start graphics.
