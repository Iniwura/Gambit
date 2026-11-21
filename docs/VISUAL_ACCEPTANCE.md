# GAMBIT visual acceptance gate

**Status: NOT APPROVED.** These are objective release checks, not a claim that visual quality has been achieved.

## Source of evidence

The browser CI captures real Chromium images after Phaser starts, without an intro overlay:
- `desktop-arena-ready.png` and `mobile-arena-ready.png`
- `desktop-after-first-round.png` and `mobile-after-first-round.png`
- `mobile-command-deck.png`

Download the `gambit-browser-evidence` artifact from the latest green `GAMBIT quality gates` GitHub Actions run. CI checking pixel output or no runtime errors does **not** certify appealing art, sound, animation or polished UX. A human must review actual screenshots and record failures.

## Scoreboard

Use a harsh independent 0-5 score. A public release requires **at least 4/5 in every category**, not just a good weighted average.

| Criterion | 0/5 to 5/5 check |
| --- | --- |
| First-glance purpose | Player instantly knows that a 3-fighter squad battles over the reactor |
| Readable environment | Single coherent orbital deck, silhouette hierarchy, readable contrast, no false collision cues |
| Character distinction | Scout, Guardian, Striker silhouette/armor differences visible at normal zoom |
| Motion and feedback | Clear lane outcome, role-specific response, readable reactor pressure and no movement drift |
| Plan controls | Player can change each independent tactic, with selected fighter unmistakable |
| Responsiveness | 390px touch deck has 44px+ targets; 1440px desktop no overlaps/cutoffs |
| Game feel | The match is strategically interesting after three rounds, not a deterministic-looking RPS slideshow |
| Accessibility | Keyboard/mouse/touch, readable text, error recovery and reduction of motion where needed |
| Honesty | Local 3v3 clearly separate from one-plan deployed Sepolia FHE contract |

## Current known deficiencies

- The characters are vector placeholders. Original designed sprite sheets, complete directional idle/walk/attack/hit animation and sound are not yet implemented.
- The battlefield still uses presentational lanes. There is no collision, genuine navigation, or real-time positional combat.
- Full squad FHE contract is an undeployed research candidate and wallet UI is a separate single-tactic experiment.
- No external beginner playtest, subjective screenshot review, or production privacy/fairness audit has passed.
- Animation should account for reduced-motion preferences before release.

**Release guard:** don't mark this PR ready or advertise production-quality game visuals until a human screenshot review and real gameplay testing meet these criteria.
