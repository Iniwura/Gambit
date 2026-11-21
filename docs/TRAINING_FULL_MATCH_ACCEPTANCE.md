# GAMBIT — Five-Round Tactical Academy Acceptance

**Phase:** TRAINING · full local match · **21 November 2026**
**Branch:** build/verified-first-slice · **PR:** #5 (DRAFT)
**Status:** VERIFIED four quality jobs and real desktop/mobile five-round Academy browser journeys in [run 44938866411](https://github.com/Iniwura/Gambit/actions/runs/44938866411). Independent novice/human acceptance remains pending.

## Evidence chain (must stay in order)

1. Existing first-round reducer requires a real STRIKER plan, FEINT and actual three-lane result, with original score. Nothing bypasses the existing verified nine-stage lesson.
2. The player explicitly chooses CONTINUE FULL MATCH on the same active round-1 practice session. This action cannot mint a new score or simulate a turn. It refuses to continue if the match already moved beyond round 1.
3. The new full-match reducer observes only accepted Phaser role, choose, formation, commit and settled messages. Round 2 requires real Scout opening/trigger/response and matching committed plan. Round 3 requires the same for Guardian and rejects a nominal command sequence that leaves Guardian's prior committed plan unchanged.
4. Round 4 requires a formation different from the prior committed formation. Its committed formation must match the new selection.
5. Round 5 requires an independent opening choice for Scout, Guardian and Striker. The submitted squad must match all three choices.
6. A complete lesson requires five actual local practice receipts, the exact five-round cumulative score, the genuine finished-match signal and the canonical buildPracticeMatchDebrief role breakdown. A defeat or draw still qualifies.
7. The student may exit at any time without resetting practice. A restart returns the tutorial to its first-round lesson; unfinished education never becomes a profile win or onchain achievement.

## Implementation

| Layer | Source | Boundary |
| --- | --- | --- |
| Round-1 coach | src/training/coach.mjs | Existing nine stages still independent |
| Rounds 2–5 controller | src/training/full-match.mjs | Immutable, versioned, step and round bound; no engine import |
| Gameplay event bridge | src/main.ts | Observes submitted cleartext local plans and real scorer/debrief after final game-over |
| Player view | src/training/coach-ui.ts, coach.css | Optional two-phase education; responsive/keyboard; no chain calls |
| Pure acceptance | tests/training-full-match-contract.test.mjs | Real squad engine integration, mismatched commit, early commit, malformed evidence, forged final result, duplicate commit |
| Browser acceptance | tests/training-coach-browser-check.mjs | Native desktop/mobile full five-round input sequence and final exact scoreboard; tablet launcher regression |

## Negative requirements

- A button click alone cannot earn an outcome. New coach events cannot change commitSquadTurn or match state.
- Settled event from another round, duplicate accepted commit, missing committed role data, wrong formation, incomplete five-round debrief, decreasing scores, and premature lock must not award completion.
- No synthetic winner, forced enemy loss, fake profile achievement, private onchain tactic reveal, new Sepolia transaction or new wallet signature.
- Training does NOT replace future competitive encrypted multiplayer Arena or a confidential BLACKSITE mission.

## Acceptance status and remaining work

**Verified in-process (not a CI release claim):** Fetched repository rules and reducer were exercised together. The genuine seeded five-round local simulator ended **3 : 10 (defeat)** with five receipts, matching canonical role debrief, and correct course graduation. A separate pure-event simulation reached the same final state transitions.

**Verified 4/4 full quality gates [run 44938866411](https://github.com/Iniwura/Gambit/actions/runs/44938866411):** deterministic tests, Phaser/TypeScript build, FHE compilation and desktop/mobile Playwright. Each real five-round journey resolved 15 lanes, finished with a **3 : 10 local defeat**, showed canonical role debrief and reported zero page errors or wallet actions. Tablet 710px/820px native hit-tests also passed. Previous [failed run 44938061007](https://github.com/Iniwura/Gambit/actions/runs/44938061007) and [diagnostic run 44938383394](https://github.com/Iniwura/Gambit/actions/runs/44938383394) exposed the missing native Continue click; stable DOM placement and event delegation fixed it. This does not measure uncoached human understanding or prove onchain multiplayer.

**Still outstanding:** Measured newcomer usability, accessibility audit of the complete five-round lesson, persistent profile progression, full competitive BLACKSITE, encrypted multi-round Arena and original artwork/audio.

**Owner-approved order:** working architecture → functional complete greybox → regression/stability and real player testing → graphics. PR #5 stays DRAFT.
