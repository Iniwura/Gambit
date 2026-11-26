# R19 — armor and rendering acceptance candidate (not approved)

Continued from exact R18 source, preserving game rules, fallback presentation and production engineering. No wallet actions, deployments or production merge.

## Artifacts
- GAMBIT-R19-preview.html SHA256 c8040aa77f424b937669b5d17a152d55d2b979ff1651c3462f7c634161dbed83
- GAMBIT-R19-source.zip SHA256 4d08b31b4a3b9997c58038dba8c3a6f5a44d86f89d36858d8820bb634a00d3f8
- Complete editable source, tests, screenshots and logs are conversation artifacts, not committed bytes.

## Implemented
Revised material palette across six original rig instances (graphite armor, restrained faction accents, emissive optics, roughness/metalness). Added authored reactor substation behind the tactical deck; no gameplay collision or score change. Lowered the landmark after visual clipping review. Batched 23 static mesh pieces into three material batches plus one light using Three.js BufferGeometryUtils. In the same synthetic capture-frame check, render calls declined 293 to 253 with 196,076 triangles unchanged. Experimental reflection map removed following timeout. Original character meshes, portraits and fallback unchanged.

## Evidence
PASS test-r19-frame.py: actual headed Chromium SwiftShader WebGL2 planning and sample capture frames; 6 rigs, capture flags true/false/true from validated synthetic local trace; no GL error. Captures are isolated scene renders, not UI screenshots. PASS test-r14-regression.py: five-round score 3:12, all four routes, six viewports, guest, vault, audio and reduced motion before geometry merge. Continuous headed match test timed out on next-round click, and full-page screenshot timed out; no physical-device FPS or continuous real-time match pass. Screenshots and failed logs retained. No fresh overall score or 90+ claim. Art improvement limited; coherent higher-fidelity character rigs and a genuinely immersive world still needed. Keep R18 rollback.
