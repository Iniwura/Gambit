# R15 — mode-specific presentation (candidate, not approved)

Continues exact R14 and owner hardware review. No production integration or chain changes.

## Deliverables
- GAMBIT-R15-preview.html SHA256 4781e508a5968e03e5cadcbc1e331b151cf6c43c1272bb9957b37d90289d6e28
- GAMBIT-R15-source.zip SHA256 ab95acf45d78b15be97cd4644dd1976172fd76589546aaad515cc88f14165a97
- Complete playable offline preview and editable sources, licenses, test logs, screenshots; artifact bytes in conversation, not GitHub.

## Implemented
- Dedicated HQ operator lineup, separate Arena lobby map, Academy counter display linked to exercise state, Blacksite SVG security console linked to real attempts/outcome, all five clues visible, Commander service record (no fabricated progression), compact Settings/Account and live volume labels.
- Corrected horizontal overflow at six viewport sizes and the R13 edition label. Separated graphics control/status from phase display; vault history header restored after visual inspection.
- Higher-resolution existing portraits; Three.js material roughness/metalness, key/fill lighting and soft floor contact cues revised, original six rigs/24 environment batches, formation anchors and Anime.js motion preserved. Followed supplied MengTo camera/readability and combat-feedback guidance; no new package or asset license.

## Executed verification
Six suites PASS: test-r15.py (six modes × six viewport sizes; no horizontal overflow, vault state/attempts/clues, settings percentages), test-r14.py (actual scene asset loading, six skinned rigs, mixer and formation tween, camera parity and fallback), test-r14-regression.py (5-round score 3:12, four routes, six viewports, guest, vault and controls), test-formation.py (18 checks, local outcome effects and score breakdown), test-lessons.py (three exercises and keyboard vault), test-audio.py (four original MP3 loops, mute/volume). Zero observed page errors in passing runs. Actual hardware GPU visuals/FPS unverified due to sandbox WebGL2 unavailable.

## Boundary
Arena geometry and character models unchanged; Blacksite security console is vector UI, not an explorable 3D facility. The art quality gap against Vesperfall remains substantial. R15 is not a final design or 90+ assessment; preserve R14 rollback. Prior offline renderer scripts lack source scene-data.js, but current baked runtime assets and WebGL sources are included. No wallet transactions or real account changes.
