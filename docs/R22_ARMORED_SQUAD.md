# R22 — Armored squad (internal checkpoint, not approved)

Implements parts of the reference acceptance gate, continuing exact R21. No rules change, production merge, deployment or chain actions.

## Actual work
- Original generated menu-only squad concept art with separate mobile crop; explicitly labeled concept art, not actual runtime fidelity. Reference principle: Vesperfall's hybrid concept/runtime artwork pipeline.
- Three original equipment-style vector illustrations; desktop action rail, 12px supporting action labels, visible selected and disabled states and reversible own-order drafting (Tactical Breach Wizards principle).
- Authored segmented armor and helmet/visor attached to the existing licensed humanoid skeleton, then batched into two weighted meshes per actor. Original native clips and grounded feet retained. Six new formation views, six two-frame idle loops, three actual runtime portraits and nine action-pose images integrated into fallback view.

## Verification
PASS test-r22-hud.py, test-r22-regression.py (five rounds 3:12; four modes; six viewports; vault/guest/audio/reduced motion; no page errors), test-r22-armor.py (294 sampled positions across idle/action/formation, maximum world-unit deviation 1.48e-7), test-r21-playback.py. Actual SwiftShader WebGL2 sample: 280 calls, 238632 triangles; unbatched R22 458 calls, 239296 triangles. Isolated rerun completed timed-out desktop idle frame. No hardware FPS claim.

## Artifacts
GAMBIT-R22-internal.html SHA256 90ad0e3281f59ea3c0c8a70d014bef348245573b2324fa1873e69a5fb744ac1d
GAMBIT-R22-source.zip SHA256 82a22d72ed993d0c135be0185f31723f34b6867746f26fb917707ac39fd1e49c
Source and asset bytes are conversation artifacts, not committed by this record. R21 rollback remains intact.

## Remaining
Arena geometry unchanged from R21. Runtime low-poly armor is not the fidelity of the key art. Reference-grade environment, richer cinematics, consistent art across modes, sustained hardware match, independent playtest and production integration remain open. No new overall score or 90+ approval.