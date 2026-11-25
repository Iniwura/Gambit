# R13 — Reactor presentation pass (candidate, not approved)

Continues the recovered R12 playable source. R11 remains rejected. No changes to the verified production engineering branch or deployed contracts.

## Actual deliverables
- GAMBIT-R13-preview.html SHA256 5feb671eeef40d041405d3b9697b723e4f37614613505895cc722a902915ed90
- GAMBIT-R13-source.zip SHA256 68ed2b8e1ef4e7d7dc2c420c83e7921919c3a12a41e5bfcad9996a11414e0d60
- Full editable source, rendering and build scripts, all runtime assets/audio, screenshots, browser tests, logs and 42-entry runtime asset ledger. These bytes are conversation artifacts, not checked into this GitHub commit. Preserve them before the next iteration.

## Changes
- Rebuilt R12 industrial stage with layered rear architectural elements, extended frame, vents, structural supports, brighter cyan floor channels and motivated lighting; selective glow and updated camera. Rejected first clipped-column and distracting lower deck render and revised it.
- Scout uses the CC0 Enemy_2Legs_Gun rig, Guardian and Striker retained with adjusted proportions; portraits, Headquarters, Academy and formation variants regenerated together.
- Nine native rig-animation pose previews across three operators and moves, sampled from Shoot/Sword_Slash, Run/Roll and idle/neutral clips. Guard is a stance preview, not a custom guard clip. Desktop operator view, reactive input bursts, staged charge/impact/recovery effects, motion opt-out. Actual local lane outcomes only; no inferred enemy orders or online per-lane results.
- Preserved all four routes, local five-round scoring, existing soundtracks, guest and vault behavior. First regression caught scoreboard positioning intercepting the menu; corrected before final test runs.

## Applied references
- https://github.com/MengTo/Skills/blob/main/agent-skills/game-development/author-game-levels/SKILL.md : architectural purpose, landmarks, motivated lighting and readability.
- https://github.com/MengTo/Skills/blob/main/agent-skills/game-development/design-action-combat/SKILL.md : intent and feedback separation.
- https://github.com/MengTo/Skills/blob/main/agent-skills/game-development/build-hybrid-game-assets/SKILL.md : compatible source assets and fallback pipeline.
- https://github.com/finktheartist/sakuga-vfx : short input-reactive bursts and spring-like response, independently implemented in native CSS/SVG/JS.
- https://vesperfall.mengto.chatgpt.site/asset-catalog : runtime asset ledger with exact file provenance and hashes.

## Executed tests
PASS test.py: 5-round local match 3:12 identical to R12 fixture; all four routes, six viewport sizes, guest profile and vault checks.
PASS test-formation.py: 18 formation/viewport checks, exact role anchors, six-frame animation plates, local scoring breakdown and outcome effects.
PASS test-lessons.py: all three exercises, mobile navigation and keyboard vault.
PASS test-audio.py: four decoded original MP3 loops, cue cleanup, mute and volume.
PASS test-r13.py: nine decoded pose clips, correct role/move selection, input effects and cleanup, game and OS motion reduction, scene isolation. Zero observed browser errors.

## Remaining quality gap
The render is still an offline baked 3D presentation, not Three.js or real-time GPU. The npm registry probe timed out; no Blender, Anime.js, Quixel or new external runtime packages/assets were imported. Browser QA is not real-device FPS or human art acceptance. Character fidelity and environment still below Vesperfall reference standard; full combat animation, realtime rendering, account integration and independent playtest remain open. No fresh numeric score or 90+ claim. Keep R12 as rollback and do not merge this design candidate.
