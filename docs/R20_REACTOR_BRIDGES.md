# R20 — Reactor Bridges (candidate, not approved)

Continued from R19 during the user's active chat. No production merge, deployment, or blockchain actions.

## Artifacts
- GAMBIT-R20-preview.html SHA256 e4a1c46efb0a4efd4f80290db3525759922564b304362eaa09d6cafc75d75635
- GAMBIT-R20-source.zip SHA256 5a4c7ee1a73b3258e5a883a13f4548ba04e554582f52920ddef8cf93e7b52184
- Arena UI screenshot SHA256 96a908aafab327cd2ba41be30c630e820a400e684ce82ebf33315ff489da69ba
- HQ UI screenshot SHA256 58f97249958c97b2c6b6f6579ecf697feca23bad9f6635ddd6cd363bd365c903
Artifact bytes and complete editable source are conversation files, not committed by this record.

## Actual changes
Replaced old deck and peripheral facility with 28 material batches / 136,122 vertices from supplied CC0 modular kit: three elevated tactical bridges, lower maintenance floor, rear chamber, side guard rails, reactor landmark. Existing six canonical tactical positions remain. Replaced two robot rig families with variants of the existing licensed humanoid robot skeleton, including authored shoulder armor, scout recon pack and visor, guardian forearm shield, striker sword/armor; native rig animations. Six formation plates, six extra idle frames, three isolated portraits and nine pose studies rendered from the actual new WebGL world, integrated into normal game UI, with matching projected labels. Fallback idle is a two-frame loop and action pose previews are static. HQ role-label clipping corrected.

## Verification
PASS test-r20-frame.py: actual SwiftShader WebGL2 planning and synthetic settled capture frames; six equipped rigs; capture flags true/false/true; 290 calls, 190,200 triangles in final sample. Initial missing sanitized bone name fixed. PASS render-r20-art.py: all six formation views and isolated portraits/poses, corrected portrait visibility bug. PASS test-r20-regression.py on final CSS and art: five rounds 3:12, all four routes, six viewports, guest, vault clue/duplicate checks, audio, reduced motion, desktop HQ labels within viewport, no page errors. Local HTTP access blocked; used self-contained preview. No continuous hardware match, FPS, independent playtest or production integration established.

## Boundary
Substantive art direction candidate, not reference-grade. Human-shaped robot base is still low-poly and shared, not independently sourced premium models. More cinematic combat, immersive art and production readiness remain open. No score inflation or 90+ claim. R19 is rollback. User's deadline is today; prioritize actual playability and visibly better art over documentation-only work.