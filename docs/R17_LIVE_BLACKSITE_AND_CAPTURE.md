# R17 — live Blacksite and capture feedback (candidate, NOT approved)

Continued from exact R16. No game rules, production merge, wallet actions or deployment changes.

## Deliverables
- GAMBIT-R17-preview.html SHA256 e00b13ab5649fc3f6961c51cda54572ad267e17a3d64510228d35fb0bc70aa64
- GAMBIT-R17-source.zip SHA256 0a961d13065c51ac9ebfa1c7743e8d8e2140a09dbef401737fc5102884700eb0
- Complete offline preview and source, runtime assets, licenses, tests and logs are conversation artifacts, not committed asset bytes.

## Changes
Exported R16 chamber and authored mechanical door as 17 Three.js geometry batches (64,560 vertices). Separate moving door opens only after local breach, colored security lighting follows validated puzzle status, invalid attempt/status combinations reject, new mission closes immediately, reduced motion snaps. The recess is a visual element, not an explorable facility. Opt-in 3D VAULT with fallback; persistent canvas across puzzle rerenders and teardown on navigation. Arena adds pooled shader capture columns and rising rings tied exclusively to actual local sector ownership; draws do not animate, effects clean up and respect motion opt-out. MengTo VFX pooling, authoritative feedback and reduced-motion guidance applied. No new external asset or dependency.

## Evidence
Eight suites passed: test-r17.py (geometry, state transitions, seven inconsistent states rejected in final rerun, effect colors, expiry, pool stability, fallback), test-r16.py, test-r14.py, test-r14-regression.py (five-round fixture 3:12, four routes), test-r15.py (six modes × six viewport sizes), test-formation.py, test-lessons.py, test-audio.py. Browser WebGL2 remains unavailable. CPU scene/animation state tested, GPU shader compilation, physical visual appearance, actual device performance and live canvas behavior on supported hardware not verified. No human playtest or 90+ assessment. Arena geometry and character rigs unchanged; premium art gap and production integration remain. Preserve R16 rollback.
