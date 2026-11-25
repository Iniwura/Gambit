# R11 — The Foundry renderer feasibility study (NOT APPROVED)

25 November 2026. Isolated visual study; R10 and verified engineering checkpoint d93ea444 untouched. No wallet operations, network calls, new score or release. Do not substitute this experiment for the full game.

## Deliverable
- [Standalone renderer source](../experiments/r11/foundry-preview.html), commit a495331311b02598e6e0400af69c1de781ef4e9f; local Git blob bb5ef1c1058c75cb423a7095f4cb7870bcd83032 and SHA256 774b5a9b7842e7d7b405df45cb7fa984b82af760233f004272fe5e57b70bc337.
- Conversation artifact GAMBIT-R11-source.zip includes editable split HTML/JS, exact standalone HTML, tests, test-results.json and desktop/mobile screenshots.
- Original procedural geometry: six stylized operators, three sectors, reactor markers, role-specific silhouettes, live camera rotation/zoom/reset, selected operator ring, animated formation repositioning, reduced motion and responsive controls. Formation slots checked against production src/squad.mjs at d93ea444. Enemy positions are illustrative; no score simulation or encrypted outcome display.

## Verification and blockers
- npm and git clone failed DNS; Three.js not installed, R10 ZIP could not be located. Native WebGL implementation is present, but this Chromium host returned no WebGL context. Actual WebGL shader/runtime and GPU performance are UNVERIFIED. Canvas software fallback projects same geometry; layer-sorted occlusion is approximate. No actual mobile device test.
- Chromium fallback tests passed at 1440x900, 1024x768, 768x900, 390x844, 320x740: all three formations (15 checks), role selection, camera rotation/zoom/reset, reduced motion, no horizontal overflow or page errors. Animated formation settles and motion toggle passed. 455 object draw calls are not FPS evidence. Desktop/mobile screenshots inspected; this is still greybox-quality art.
- User-supplied references: https://github.com/MengTo/Skills , https://vesperfall.mengto.chatgpt.site/asset-catalog , https://github.com/mrdoob/three.js , https://github.com/blender/blender , https://sakuga-vfx.vercel.app/gallery/ . No external assets copied or redistributed.

## Gate
Do not merge. 90+ not established; no fresh numerical rating. Next: obtain actual Three.js/GLB and rigged assets under appropriate licenses, GPU/device benchmark, connect canonical game-state adapters, preserve R10 audio/routes, and validate real aggregate-only online display. Do not regress verified functional gameplay or claim this study is a complete match. No production changes.
