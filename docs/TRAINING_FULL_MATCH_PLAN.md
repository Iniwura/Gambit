# GAMBIT — Full Five-Round Tactical Academy Plan

**Status: FUNCTIONAL IMPLEMENTATION COMMITTED; FRESH CI, FULL BROWSER QA AND HUMAN PLAYER VALIDATION PENDING.**  
**Date:** 21 November 2026 · **Implementation order:** canonical local rules → actual player interactions → real match evidence → responsive QA → human comprehension → final art/audio.  
**Source of truth:** [master game scope](GAMBIT_MASTER_SCOPE.md), [complete architecture](GAME_ARCHITECTURE_V1.md), and existing [five-round deterministic engine](../src/squad.mjs).

**Implementation and exact acceptance:** [Five-round Academy acceptance](TRAINING_FULL_MATCH_ACCEPTANCE.md). The local-match reducer, accepted command bridge, responsive continuation, adversarial tests and desktop/mobile browser test paths are now present. The original first-round Academy remains independently tested; do not confuse a committed test with a passing CI run. No graphics work.**

## Why this phase exists

The initial [verified first-round Academy](TRAINING_GUIDED_ROUND_ACCEPTANCE.md) teaches one **authentic** local encounter. It does not yet carry a novice through a complete game, make all three roles meaningfully distinct, explain adaptive strategy, or validate the actual match review. The full Training pillar requires a game-based five-round curriculum, not additional modal descriptions or fake objectives.

**Player learning promise:** players must experience the strategic cost of their choices, learn how the same action changes outcome against a counter, and understand why confidential tactics matter to real multiplayer. None of these milestones may be satisfied by autoplay, synthetic outcomes, pre-scripted scores or direct mutation of canonical match state.

## Proposed actual five-round curriculum

| Actual match round | Taught skill | Evidence required from real gameplay | Pass condition must NOT require |
| --- | --- | --- | --- |
| 1 | Striker opening and conditional response | Current 9-stage guide: choose Striker; FLANK if enemy STRIKE then GUARD; choose FEINT; commit; wait real three-lane result | A guaranteed win |
| 2 | Scout role as a synergy opportunity | Player actually selects Scout and edits its independent opening/trigger/counter; commits full squad; receives public after-action report | Scout automatically winning, opponent revealing next plans |
| 3 | Guardian defense and denial | Player actually changes Guardian's committed tactic; receives verified local round result; observe/publicly explain whether enemy breach bonus was blocked | Invented Guardian block when no block happened |
| 4 | Formation as a matchup variable | Player intentionally changes formation from preceding round; commits; sees full three-lane results and genuine score adjustment | Claiming the formation change *caused* a win without counterfactual evidence |
| 5 | Independent squad control | Player programs all three roles for the final round without tutorial-prescribed values; commits; receives actual round-5 final match debrief and real role performance | Victory requirement, fixed score, fake profile achievement |

If the player deviates or is defeated, the coach still explains what **actually** happened. It must not block legitimate gameplay or rewrite the bot to force a successful educational narrative.

## Source-of-truth rules

1. A versioned pure training reducer observes **accepted** Phaser commands and real public practice reports. It does not run the game engine a second time or compute secret opponent data.
2. Round numbers must be bound to the exact committed match turn. A delayed callback or duplicate event from another round cannot advance mastery.
3. To credit round-5 practice, consume the actual `match.finished` and canonical [local match debrief](../src/practice-match-debrief.mjs); neither local training nor BLACKSITE results can be mislabelled as an onchain win.
4. The current first-round guide is optional and the five-round mode must remain opt-in. Aborting mid-match cannot quietly award completion. Navigation, rematch, screenshots, mobile/keyboard focus and errors have explicit recovery states.
5. Compare actual available local feedback: a bonus only exists when the public scorer says it exists. Do not assert the player activated a counter that did not trigger. Private onchain fighter plans remain excluded from the tutorial analytics.
6. Design consented checkpoint persistence separately. Until explicitly implemented and verified, all coach state is session-only; reload does not imply an authenticated restore.
7. Keep confidential Arena result playback separate: no tutorial events may be accepted while the user watches an independently verified FHE encounter.

## Delivery gates

Implementation has been submitted on the build branch. The new five-round browser scenarios, independent novice evaluation and accessibility sign-off are **not** marked verified until their evidence is available.

- A coherent five-round finite-state machine and explicit event protocol with step rollback/recovery.
- Deterministic adversarial tests: duplicate/forged events, wrong fighter, wrong round, changed formation, early match finish, rematch, uncompleted objectives and mismatched score.
- Real desktop, tablet and mobile browser E2E performing all five actual rounds and confirming the final game-over debrief; no forced clicks or synthetic scores.
- Newcomer usability evaluation by someone not involved in development: can they explain the opening/trigger/response loop, all three roles, formation and why the score changed? Record measured findings, not an imagined retention metric.
- Accessibility: keyboard, touch, reduced motion, visible focus, sensible screen-reader announcements, mode-exit recovery and no stolen wallet focus.
- Continue retaining [GitHub verification evidence](BUILD_LOG.md) and the pre-graphics quality bar. The PR remains draft while the overall product is incomplete.

**Scope boundary:** this plan does not authorize new Sepolia transactions, migrations, contract deployments or graphics work. A complete Training curriculum is one of several open product gates alongside competitive BLACKSITE, full Arena multiplayer and persistent Commander Profile.
