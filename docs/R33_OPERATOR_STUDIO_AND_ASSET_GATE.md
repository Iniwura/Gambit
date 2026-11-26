# R33 — Operator studio (internal, not approved)
Continues exact R32. Dedicated 3D inspection bay using exact Arena rigs, native clips and weighted armor. Three roles and nine action selections, orbit by 45 degrees, replay dispatch, retained canvas across selections, automatic capability-based entry, reduced-motion redraw and compatibility fallback. Guard remains the existing idle stance. Authored maintenance bay, improved camera/framing, real shadow and mobile-first model placement. Arena and scoring unchanged.

PASS final test-r33-studio.py under SwiftShader WebGL2 with forced capability and reduced motion; all three roles, nine selections, orbit/replay dispatch, shared canvas, five viewport sizes and teardown. PASS test-r27-regression.py (complete five-round fixture 3:12, four routes, six viewports, no page errors); PASS test-r29-rooms.py (three dossiers, nine fallback poses, Academy/vault state art and six viewports). No physical GPU FPS or normal-motion playback verification.

A separate procedural full-body shell experiment rendered and passed the isolated selection tests, but was rejected on visual grounds. Not imported by accepted build. Preserved as experiments/r34-sculpt in source ZIP. No fresh score inflation; retain previous provisional 78/100. Art still below reference.

External candidate research: RamonLinares/atlas-09 ASSET-LICENSE.md confirms CC0 models, rigs, textures and animations. Candidate files aether-02.glb, vanguard-07.glb and ronin-04.glb identified from source repository metadata. Binary downloads failed (DNS/inaccessible); no external asset integration or visual approval. The DamagedHelmet sample in supplied Three.js archive is noncommercial and excluded. Do not assume assets will be sufficient before inspection.

Source ZIP SHA256 7ee1ec8bd6620db30b05ebc9700ccd0ac87dd2952cd29aee56e937424dc2ad64 (416 files, CRC passed).
Standalone HTML SHA256 e0d62fc31e6229a91ae16684a834e6949fa8b6d2d5b1753263335f40c73b23c6.
Source/asset bytes are conversation artifacts, not committed by this documentation record. R32 rollback preserved. No production merge, deployment, wallet or chain actions. No next-phase approval.