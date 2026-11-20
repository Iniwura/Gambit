# Issue #6 — mobile combat animation evidence

## Root cause

The failure was environment-sensitive: the local runner used Node 20.19.5 even
though the maintained Zama SDK and the repository CI use Node 22. The browser
test itself was not weakened. GAMBIT now declares Node 22+ in both workspaces
and pins the local development runtime with `.nvmrc`.

The Phaser combat clock was also instrumented through the existing DOM test
state. `roleEffectStarts` increments only when `playRoleEffect` begins for a
lane; `lastRoleEffects` remains set only after all three effect routines have
been invoked. The browser assertion requires both values to reach `3`, then
requires the round to return to `ready` or `finished` with a public debrief.

## Evidence

- Node `v22.20.0`, npm `11.6.2`, clean `npm ci` in root and `fhe`.
- Root typecheck and 34 tests passed.
- FHE typecheck, compile, and 18 Hardhat mock tests passed.
- Production Vite build passed.
- `tests/squad-browser-check.mjs` passed in three consecutive runs at both
  1440×900 desktop and 390×844 mobile viewports.
- `tests/mobile-deck-browser-check.mjs` passed at 390×844.
- A temporary Playwright diagnostic captured RAF samples, page visibility,
  DOM phase/effect state, screenshot and trace. The failing boundary had no
  page errors or console errors; successful diagnostics showed continuous RAF
  progress and all three effects starting. Temporary artifacts were removed
  after inspection and are not treated as committed evidence.

The test remains strict: no timeout was increased, no effect marker was moved
earlier, and no assertion was bypassed.
