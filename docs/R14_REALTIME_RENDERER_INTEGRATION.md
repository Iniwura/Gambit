# R14 — real-time renderer integration candidate (not approved)

User supplied Three.js, Anime.js, Sakuga VFX and MengTo Skills archives. Recovered exact R13 source and original CC0 Quaternius packs. R13 remains the default; no engine/rules migration, production merge or wallet activity.

## Actual deliverables
- GAMBIT-R14-preview.html SHA256 f3fc7c386e9944bd36269778654d6e2ebf02635c93b045218405911403f92dd2
- GAMBIT-R14-source.zip SHA256 db507a3c32fb380697152bcdc2a4475479eaed3e6c1005bef0eb92df72237a82
- Source archive includes editable renderer, exact vendor modules, license files, original glTF rigs, stage geometry, embedded offline build, build/test scripts, hashes and logs. Artifact bytes remain in conversation; this commit is the record, not the renderer source.

## Actual changes
Three.js 0.187.0 dev snapshot and GLTFLoader/SkeletonUtils are vendored locally, with 24 authored R13 environment batches and 131,583 vertices. Six skinned instances of three original rigs, independent skeletal mixers, actual idle/strike/flank clips, guard stance previews, role palette, point/directional lights, shadows, camera projection calibrated against R13 markers. Anime.js 4.5.0 actually drives formation tween and order-preview feedback. Sakuga and MengTo supplied sources informed the approach; not runtime dependencies. Standalone import map embeds modules/assets; no install/network required. Opt-in 3D PREVIEW, fail-safe fallback, reduced-motion behavior, no fabricated enemy outcomes.

## Executed tests
PASS: browser loaded all 6 skinned instances (skin counts 7,7,9,9,10,10), clip counts 7,7,8,8,22,22; actual mixer idle/action time advance; 3 canonical formations, completed Anime.js tween; desktop/mobile camera anchor max difference 2.22e-16 normalized. Anime input feedback and cleanup passed. Actual 3D toggle fell back to original scene on unavailable WebGL2. Default five-round regression 3:12, all four routes, six viewport sizes, guest, vault, audio/reduced motion passed, no observed page errors. Initial screenshot-heavy regression timed out; reran same interaction checks without screenshots and passed.

## Release boundary
Chromium cannot create WebGL2 even with explicit SwiftShader; actual GPU appearance, frame rate, hardware context-loss behavior and device compatibility unverified. Localhost navigation restricted; standalone tested via Playwright set_content. No claim of visual superiority, 90+ or production readiness. Next: test standalone on user's Chrome/Edge hardware, inspect actual 3D output before any replacement, then optimize and refine character/environment/animation quality. Keep R13 intact.
