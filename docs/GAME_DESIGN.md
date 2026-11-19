# GAMBIT — Game Design Document (working)

## One-sentence player fantasy
Outthink another commander by programming secret conditional squad tactics that run without exposing the strategy.

## Audience and session shape
Browser-first, short-attention-span-friendly, strategic yet understandable to new players. Target 15 seconds to first tactical choice, 2–4 minutes per match in local practice; benchmark actual Zama settlement timing before promising onchain match length.

## Three pillars
1. **Readable tactics**: a player can tell what they chose, what changed, and who controls the reactor.
2. **Hidden intelligence**: players may see battle consequences but cannot inspect opponent's conditional program just by reading public chain data.
3. **Skill over lottery**: actions, route, counters and composition produce real, testable choices; do not insert arbitrary random damage.

## Current reference engine — explicitly limited
- One base combat move, one contingency trigger and one response per commander. The base is STRIKE/GUARD/FLANK, **not** a physical engagement lane. Local practice and SealedGambit use the same encoding.
- Three actions: strike, guard, flank; rock-paper-scissors style resolution.
- Deterministic local bot and reactor control/score.
- This is NOT a fully implemented 3v3 tactical game; the three fighters have mostly visual representations in the reference prototype.

## Target first releasable loop (subject to gameplay proof)
1. **Enter** — press Practice or Wallet Challenge; intro shows reactor objective and available squad.
2. **Plan** — choose one primary order plus a hidden conditional response; select engagement lane. One initial meaningful choice should be obvious.
3. **Commit** — the local practice adapter resolves deterministically, or real players encrypt their independent tactics for the current match.
4. **Resolve** — no reveal of private conditional plans; Zama FHE computes authorized outcome.
5. **Witness** — an authenticated round result triggers meaningful squad animation and updated objective state.
6. **Adapt** — learn from observable consequence; change plans for next round, keeping strategy secret.
7. **Finish** — first to 3 reactor-control points or best at five rounds (finalize exact fairness rule after tests), with verified final outcome, replay and rematch.

## New solo-practice squad prototype (19 November 2026)

Three independent fighter plans per turn: Scout, Guardian and Striker each have a separate primary move, trigger and response. Select the fighter (4/5/6 keyboard or on-canvas tabs) and edit its tactic, then lock the entire squad. The deterministic opponent also has one plan per role. All three duels animate independently. This layer is implemented as `src/squad.mjs`, with exhaustive parity, role-impact and anti-symmetry tests in `tests/squad.test.mjs`.

Each lane victory gives +1 reactor pressure. A winning Striker receives +1 breach; a winning allied Scout adds +1 mark to the Striker's bonus, while a winning opposing Guardian blocks 1 point of that bonus. Scout's mark and Guardian's protection are meaningful interactions rather than cosmetic effects. Five rounds maximum, with early control at +/-3; results depend only on actions and deterministic bot rules.

**Scope restriction:** This is CLEAR-TEXT local practice. The Sepolia `SealedGambit` contract still accepts one (base, trigger, response) tuple per side; it does NOT run the 3-role practice rules. The opt-in browser wallet explicitly sends only the currently selected fighter tactic. Completing a real FHE three-role match requires a new versioned Solidity contract and a fresh independent deployment/validation gate. No assertion of production privacy or secure multiplayer is warranted.

**Longer-term gameplay risks:** role-bonus balance with real players, reaction to a living opponent, exploitably small encrypted policy space, accessible mobile planning UI, and judge playtests need evidence.

## UX design rules
- Show a visible goal (control reactor) and a single primary action button.
- No cryptocurrency explanations before the player has played a local round.
- State why a result happened in player language without leaking hidden tactics.
- Separate `LOCAL PRACTICE`, `SEPOLIA PENDING`, `ONCHAIN VERIFIED` clearly.
- Show real progress during waiting/decryption; never fake completion or animate a result not yet authenticated.
- Desktop mouse and mobile touch both supported; short readable labels, accessible focus and keyboard controls.

## Red flags that force a redesign
- Blind testers need explanations to understand their first move.
- Two options are equivalent in practically every match.
- Match outcome is dominated by seeded or unverified chance instead of strategy.
- FHE adds only a marketing sticker: if commit-reveal is equivalent without strategic impact, the mechanic needs a better confidential use case.
- Actual settlement time makes matches unpleasant without a meaningful async flow.
- The game depends on asset polish to disguise a shallow core loop.

## Instrumentation
Track match start-to-complete, input-to-outcome time, aborted/failed transaction counts, rematch requests, first-click delay, network error recovery, and practice-to-chain conversion. Collect no private decrypted opponent plan.

## Mobile command deck

- Touch-specific DOM controls for 390px screens: large fighter selectors, three accessible move groups and a single LOCK ALL THREE TACTICS primary action.
- Mobile starts the arena via a native ENTER ARENA button, with rematch controls after completion. The fixed 16:9 Phaser world remains above the controls so it is not shrunk into the central part of a tall screen.
- Commands dispatch to the SAME Phaser state and `src/squad.mjs` rules as desktop. They do not emit transactions or reveal onchain secrets.
- Browser QA: `tests/mobile-deck-browser-check.mjs`, which verifies the mobile workflow, independent plan persistence and three-lane resolution.

## Role-specific 2D combat feedback

The practice scene uses Phaser, not HTML gameplay, for staged three-role encounters. Scout generates radar pulses/mark VFX, Guardian projects a transient energy shield, and Striker generates staggered energy slashes. Winner color follows public lane outcome (cyan, violet, draw gold). The winning actor gets a brief impact emphasis; draws do not show a winner. These short-lived GameObjects are destroyed after the tween to avoid buildup and do **not** reconstruct encrypted opponent tactics.

Browser QA asserts all three role animations trigger during a real local round. This is interim procedural art, not a replacement for approved original character sheets or the rejected arena environment.

## Reactor Deck visual iteration (19 November)

- Replaced six disconnected rounded rooms with one original connected orbital ship hull, three navigational-looking role lanes, illustrated docking bays, power conduits and a layered reactor core. This is **visual staging**, not a claim of genuine spatial collision or pathfinding.
- Replaced placeholder oval-headed fighters with role-specific original vector suit silhouettes: Scout antenna and compact chassis, Guardian heavy shoulder armor, Striker assault plates. No Among Us art or third-party sprite assets are copied.
- All scenery and characters are native Phaser objects in `src/visual/`. Rule evaluation, wallet flow, and FHE contract remain untouched. Existing practice role selection tests must still pass.
- This remains procedural placeholder art, not final production sprite art. Do not represent it as approved artist-quality character animation. The remaining art gate is custom high-resolution sprite sheets and full animation states after beginner UX validation.
