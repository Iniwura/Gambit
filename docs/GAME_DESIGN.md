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

## Squad depth: prospective, NOT implemented
Three visually distinct combat roles with a meaningful purpose each:
- **Scout:** gathers a restricted clue or challenges deceptive routes.
- **Bulwark:** protects or reinforces a controlled objective.
- **Striker:** threatens contested territory with an offensive counterplay.

The finished game must prove these roles change choices and outcome — not simply show three sprites while one global RPS action decides everything.

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
