# R27 — Rear operator identity and adaptive resolution (internal, not approved)
Continues R26. Added role-specific rear armor on the existing licensed skeleton: Scout paired sensor cells/antenna, Guardian reinforced power canisters, Striker angular spine plate and energy channel; rear helmet, arm and shin plates. Same two batched weighted armor meshes per operator. Regenerated six formation stills, six two-frame idle loops, three portraits and nine action-pose images. Existing geometry, tactical positions, game rules and faction mapping unchanged.

Adaptive pixel ratio 0.65–1.25 with sustained frame-interval hysteresis, not GPU timing. Unchanged reduced-motion frames skip rendering; selection, formation, result, resize and visibility changes redraw. Actual graphics panel reports resolution and ratio. No physical-device FPS claim.

PASS armor attachment: 480 samples, max deviation 1.4731e-7; PASS adaptive budget floor/ceiling/reset; PASS final full five-round local regression 3:12, four routes, six viewports, no page errors; PASS actual controlled WebGL2 mount test 400×225 (stable paused frames skipped, selection/formation/visibility redraw); PASS isolated WebGL2 combat frame, 334 draws, 271198 triangles, six effects, GL error zero. Planning renders retained 293 draw calls, triangle count increased from 252746 to 262410.

Internal HTML SHA256 125fc6af7d43f8badd1e5edc287d9e761ff45e25f07fc1f5f747f180daa63222
Source ZIP SHA256 a624ecff843929222cfcf746ad99671f0a2e83032788b125446e4fef0bf5ec8e
ZIP CRC clean; source bytes are conversation artifacts, not committed by this documentation record. R26 preserved. No 90+ approval; runtime art remains below target, production integration and sustained hardware match unverified. No wallet actions or deployment.