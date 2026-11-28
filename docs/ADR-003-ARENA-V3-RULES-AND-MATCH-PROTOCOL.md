# ADR-003 — Arena v3 sector objectives, secret GAMBIT and the five-round protocol question
Status: **RULES-CANDIDATE ONLY** (game-theoretic tests passed; no contract, wallet, UI or human playtests)
Date: 2026-11-21
Sources: [Production Charter](PRODUCTION_CHARTER.md), [ADR-001](ADR-001-CORE-GAME.md), [Squad HCU evaluation](SQUAD_HCU_FEASIBILITY.md), [Issue #11](https://github.com/Iniwura/Gambit/issues/11)

## User-facing problem

A few seconds of combat feels anticlimactic; simply padding animations or chaining five identical encounters is not sufficient. Every round must present a consequential decision, a readable change in battlefield stakes, and a reason to think about the opponent. This is an ENGINE problem before an animation problem.

## Experimental rules (not current deployed code)

Source: `src/research/arena-v3-rules.mjs`, independently tested with:
- `tests/arena-v3-rules.test.mjs`
- `tests/arena-v3-strategy.test.mjs`
- `tests/arena-v3-information.test.mjs`

Five rounds. Both human commanders secretly program three independent fighter plans, one formation and optionally choose a fighter for a **GAMBIT**. The GAMBIT is a one-use-per-match commitment, validated by the research match state.

**Public charged reactor sector** rotates predictably by round `[0,1,2,0,1]`. A victory in that sector earns one additional pressure point. Existing Scout mark, Guardian block and Striker breach remain role-dependent, preserving core rule identity. This is intentionally deterministic: no hidden game RNG manipulates combat.

**GAMBIT risk decision**:
- If chosen fighter wins its encounter, its commander earns two extra pressure points.
- If chosen fighter loses, the *other* commander earns two extra pressure points.
- If chosen fighter draws, neither side earns wager points, but the one-use chance is spent.
- Both sides may risk their chosen fighter in the same round; outcomes are composable.
- Wager target and whether it has already been played must be modeled with encrypted match state in any future contract; local research state is NOT private cryptography.

The match winner is the higher cumulative reactor score after exactly five rounds; ties are legitimate draws until a separately designed tiebreak rule proves better.

**v3 score encoding is NOT compatible with v2**. A team may earn up to 10 pressure points in a single round, requiring four bits per side instead of v2's three-bit `scoreA*8+scoreB`. A new protocol would need `scoreA*16+scoreB`, with an independently verified handle, schema and decryption proof. Never reinterpret v2 ciphertext bytes or deployed ABI as v3 rules.

## What the experiments actually measured

All figures below are deterministic tests of the **cleartext rules candidate**, not onchain or human playtest results.

| Study | Observed result | Interpretation/limit |
| --- | --- | --- |
| v3 vs v2 parity | All 27×27 identical-role tactic pairs × 9 formation pairings × 3 charged sectors reproduce v2 scores plus exactly one public-sector point | Existing role and formation scoring preserved in the proposed extension; not FHE parity |
| Side-swap and score bounds | 18,000 sampled encounters swap scores exactly; per-team score stays within 0–10 | No obvious player-ID asymmetry in sampled rules |
| Absolute formation rotation | 7,038/10,800 tests (65.17%) change aggregate pressure when both formations rotate on a fixed charged sector | New objective makes absolute position relevant, not visual-only |
| Formation contest with fixed basic moves | In 2,064/2,187 cases (94.38%) formation choice changes score margin; each formation is uniquely best in some contexts (522, 555, 606) | No universal best formation across this restricted 27×27 class model, **not** proven for full conditional strategies/humans |
| GAMBIT one-fighter fairness | Tested all 27 conditional choices against reviewed nine-slot minimax opponent mixture; no fixed one-fighter tactic yields positive average wager margin | Does not show there is no exploit in the complete 3v3 match |
| Five-round progression | 400 seeded two-human deterministic simulations; no double-spending a GAMBIT; score determines victory after five full rounds | Cleartext reference only; no wallet, adversarial network or proof |
| Disclosure study | v2 reference published 21 aggregate score pairs, entropy 3.711 bits under a uniform model; v3 sector premium 26, 3.926 bits; v3 with unknown defender wager 46, 4.628 bits | More tactical feedback increases information disclosed. Uniformly sampled defender behavior classes are **not a human behavior model** |
| Wager visibility caveat | In 17.28% of four-choice modeled v3 cases, a score above 6 on at least one side necessarily implies wager usage | A wager is never guaranteed permanently secret after public decryption; preserve target confidentiality only to extent justified by actual protocol |
| Existing BLACKSITE codebreaking | 256 code options; offline minimax finds every one in at most four guesses | A rules viability test, not human difficulty or FHE feasibility |

Evidence: GitHub Actions `Rules checks` for the respective commits and inline deterministic study logs. These figures are *sample/test-domain dependent*; they cannot be marketed as quantified human fun or a security/privacy guarantee.

## Critical five-round online architecture options

### A — five independent v2 one-use encounters
Advantages: reuse deployed contract and single-encounter proof workflow for each round.
Drawbacks: each round requires sealing, duel opening, submission, resolution and KMS-backed finalization. **About 25 distinct writes across five rounds** before any profile or lobby overhead; real wait times and fees unknown. Opening and sealing a new squad each round complicates rematch identity and strategic recovery. Useful as a conservative integration experiment only, **not the chosen production match design**.

### B — persistent v3 match with five separately resolved rounds (PREFERRED CONDITIONAL DIRECTION)
A match contract stores participants and round index, one-use GAMBIT availability as encrypted state, active encrypted commitments, cumulative verified public scores and strict round transitions.

Each round must independently collect two encrypted choices, run FHE, await public KMS proof and finalize before revealing the next round's authentic aggregate result. Roughly **four state-changing transactions per round** (two submissions, resolve, finalize) plus creation or invite administration, pending batching and sponsorship design. Actual wallet signature count can differ if a narrowly scoped relayer/user-operation design is later implemented; do not advertise gasless transactions without signed proofs of funding and safety.

Advantages: real adaptation between every round, recoverable match identity, one persistent opponent, clear league scoring and proper one-use GAMBIT enforcement.

Cost: up to 20+ blockchain state transitions for a five-round game and multiple asynchronous waits. We must FIRST measure v2 live FHE/relayer/KMS latency, fee, HCU, wallet friction and recovery to know whether this is tolerable. If it feels tedious, change the interaction design, not the truthfulness of the results.

### C — submit all five rounds up front and resolve together
Advantages: fewer blockchain interactions if batching is feasible.
Fatal gameplay risk: no adjustment to another human after seeing public round scores. It becomes an automatic five-scene tactical simulation rather than an interactive multi-round competition.

Technical risk: roughly five times v2's estimated encrypted resolution work (v2 static model 5.013M HCU), which may exceed published 20M total HCU if done in one synchronous FHE circuit, even before extra sector/GAMBIT operations. This multiplication is **not** a measured v3 estimate, and splitting circuits changes the result. Do not implement before a measured architecture study.

### D — two or three preprogrammed batches with adaptation in between
Potential fallback if network cost dominates. Preserve some between-batch decisions but reduces immediate tactical responsiveness. Needs a rules-only and HCU feasibility study before choosing.

**Decision:** Do not lock A/B/C/D as shipping protocol before **one complete real two-wallet v2 Sepolia encrypted session**, with actual timings, fees and failure recovery. Prefer B for player agency only if real performance permits. No visual commitment or v3 contract deployment yet.

## v3 onchain security requirements before an implementation attempt

- Validate EVM account and chain identity, lobby participants, one-use invitation, active round index, two fresh independent encrypted orders, deadlines and duplicate submissions.
- Any private GAMBIT target/use flag must be encrypted and stored with correct ACL grants. A plaintext bool would reveal usage while planning. Design allow/permission lifetime before writing Solidity.
- No rolling over an old sealed tactic to probe it repeatedly; each round uses a fresh encrypted commitment tied to match ID, round, caller and deployed contract.
- Bind public KMS decryption proof to EXACT ONE stored round-score handle. Finalization must reject proof for a different round, session or ciphertext.
- Support canonical receipt recovery, stalled relayer, KMS delay, timeout, dropped transaction, reorg, abandoned game and nonresponsive opponent.
- After decryption, expose only the authenticated aggregate score; no fabricated lane winner, formation or gambling target reveal. Distinguish crypto confidentiality from information inferred by the score.
- Avoid onchain arbitrary score caps, sum packing or FHE operation estimates based only on local mock testing; prove on real Sepolia and review HCU sequential depth.
- Production multiplayer should not demand a seed phrase, unattended spender approval or hidden auto-signing. Each transaction must be deliberate or use a separately reviewed narrowly scoped account-abstraction authorization.

## Decision gates

1. Full v2 real two-wallet encryption→resolution→KMS proof→finalization→public verification. (issue #8)
2. Confirm one encounter's actual delays/fees/HCU where exposed, and establish an explicit maximum tolerable end-to-end match time.
3. Run blind human playtests of v3 research decisions with a minimal text/greybox interface before expensive art.
4. Independent game-theoretic review for best responses, degenerate roles, exploitability across five rounds and confidential gamble signaling.
5. Choose protocol B or alternate based on the actual data, then separately version the new Solidity contract, tests and deployment. NEVER silently mutate already deployed v2.
6. Validate production narration against only the public data authorized by the chosen protocol, and separately design 20–30-second skippable combat staging once the game engine is accepted.

Until all gates pass, Arena v3 is a **promising but unapproved experimental rules candidate**, not a game players can use online.
