# GAMBIT Training — Real First-Round Academy Acceptance

**Milestone:** Phase 2 first guided local practice encounter, 21 November 2026.  
**Status: VERIFIED functional first-round training greybox** — [full quality run 44934706796](https://github.com/Iniwura/Gambit/actions/runs/44934706796) completed 4/4 jobs successfully; 182/182 deterministic tests passed, including real complete desktop and mobile Academy gameplay.  
**Order of work:** architecture and rules → real responsive interaction → adversarial/browser QA → premium audiovisual production.

## Actual gameplay, not a tour of disconnected mock cards

[Pure lesson reducer](../src/training/coach.mjs) · [non-modal Academy UI](../src/training/coach-ui.ts) · [current local Arena](../src/main.ts) · [E2E](../tests/training-coach-browser-check.mjs)

A player optionally starts **TRAINING · GUIDED ROUND** on desktop or in the in-flow mobile command deck. The coach shows one instruction at a time and **observes accepted actions inside the existing Phaser practice scene**. It does not control the squad, forge a score, fire a wallet action, hide enemy encrypted data or modify the canonical rule engine.

The lesson is **one genuine tactical round**, not a complete multi-round onboarding campaign:

| Step | Required actual player action | Reason |
| --- | --- | --- |
| 1 | Enter the LOCAL PRACTICE Arena | Start a real offline match, no signing |
| 2 | Select STRIKER | Learn one role's reactor-pressure advantage |
| 3 | For STRIKER, select FLANK opening | FLANK beats GUARD |
| 4 | Program STRIKE as an enemy trigger | A conditional response requires an enemy action match |
| 5 | Program GUARD as conditional response | GUARD beats STRIKE |
| 6 | Choose FEINT formation | Alter all three role matchups |
| 7 | Actually lock the full 3v3 squad | Validate the currently committed STRIKER plan and FEINT, not merely the player's prior clicks |
| 8 | Wait for the real three-lane practice report | Confirm the **same round ID** that was committed |
| 9 | Read the actual match scoreboard and continue | No predetermined victory or local win portrayed as an FHE result |

The authoritative engine still resolves the bot match according to the user's full three-role squad. The coach must never select actions or alter the opponent. Changing the instructed STRIKER plan after receiving tutorial credit makes the subsequent commit **ineligible**; a descriptive retry instruction appears, and the player may correct their plan in the next round.

## Failure/UX gates

- Every step requires a matching authentic UI/Phaser observation. Wrong role, early lock, wrong action, pre-commit result or mismatched round does **not** mark the tutorial complete.
- Invalid events are rejected by the reducer; an event-only test cannot mint ranked wins, NFTs or a chain result.
- A full-scene restart resets the guide to the start, and starting the guide after entering practice begins with role selection.
- Optional guide may be closed without affecting match state or changing the actual practice round/seed.
- The desktop coach stays non-modal so keyboard and Phaser canvas work; mobile coach lives **inside the command deck** and scrolls with the actual controls. Buttons have visible focus, touch targets and Escape is handled by other active dialogs.
- The guide remains **LOCAL ONLY** and automatically closes upon verified encrypted result playback. No onchain tactics, secret formations, signer, RPC or browser storage are used to advance training.
- One real 3-lane practice report must exist before graduation. A committed-but-resolving encounter does **not** count as completion.
- Browser validation must exercise the entire 9-stage sequence on desktop **1280×850** and mobile **390×844** via **actual buttons and keyboard**. No direct injection of tutorial events is accepted as browser E2E proof.

## Evidence required before verification

1. `node --test tests/training-coach-contract.test.mjs` passes immutable progression, wrong-plan, wrong-round, reset and forged-event cases.
2. `node tests/training-coach-browser-check.mjs` passes at both screen sizes, demonstrating real STRIKER, actual conditional input, FEINT, commit, resolved match score and no uncaught browser errors.
3. Existing Arena, BLACKSITE, Commander Profile, signed-wallet safety and FHE compilation regressions still pass in the same [full four-job quality gate](https://github.com/Iniwura/Gambit/actions/workflows/validate.yml). Retain failed attempts in [the permanent build log](BUILD_LOG.md).

## Actual verified run

[GitHub Actions run 44934706796](https://github.com/Iniwura/Gambit/actions/runs/44934706796) shows real **1280×850 desktop** and **390×844 mobile** Chromium journeys. Each executed the nine sequential accepted actions against actual Phaser local practice, committed STRIKER `FLANK / if STRIKE / then GUARD` with FEINT, waited for match round 1 to settle, and read the true **2 : 1** public score. Both reported no skipped steps, scripted wins, wallet actions, lost Arena state or uncaught browser errors. The full suite passed deterministic rules, Phaser/typecheck/build, FHE mock compile/tests and desktop/mobile browser checks.

**Proof boundary:** this establishes functional deterministic/local tutorial behavior and preserved regression gates, not full curriculum quality, human newcomer comprehension or Zama onchain multiplayer.

## Still not built

A complete newcomer curriculum through all five local rounds and final match review; role-by-role mastery missions; onboarding retention or human comprehension measurement; saved consented training checkpoints; rewards/achievements; competitive matchmaking; and final game art/animation/audio. This is a first genuine tutorial vertical slice, not proof the complete TRAINING pillar is done.

**Next after this gate:** grow training into a full match with real goal-based skill checks and final debrief, then conduct uncoached human usability testing. Maintain separate evidence for all four product pillars before declaring the functional build complete.
