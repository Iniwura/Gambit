# Stage 1 architecture and gameplay acceptance — review 01
Date: 26 Nov 2026. Baseline engineering commit 09183791dff8f4fb36d7fa0a7e504a5f36a2591e; visual baseline R36. Owner requested step-by-step closure before further stages. No production promotion, contract changes or transactions.

## Correct gate
PRODUCTION_PLAN.md Stage 1 = architecture + game plan, including full game specification, mechanics, flows, data boundaries, state/error/recovery contracts and feasibility. The revised MASTER_SCOPE permits isolated visual work but does not waive this architecture gate. Stage 1 is NOT complete simply because a local match or Sepolia match runs. Stage 2 functional greybox and subsequent stability, graphics and release gates remain distinct. This review uses canonical deployed-v3 0..7 scoring; older charged-sector 0..10 research remains historical, not a live rule.

## Arena: exact squad baseline study, executed in this session
21 distinct conditional plans per role (27 syntactic triples with redundant no-op triggers removed), three formations, inactive or three selected stake sectors: 111,132 choices. Opponent independently draws each role from the existing nine-entry BALANCED_OPPONENT_PLANS repertoire and uniformly selects a formation. Two conditions: rival inactive or rival activation with uniform sector. Exhaustive factorized integer-weight calculation; 100 independently brute-enumerated distribution cross-checks passed in local Node. Separate direct execution of the pinned repo engine.mjs, squad.mjs and gambit-commitment-v0.mjs in JS, with imports/exports removed solely to load functions, passed 32,805 squad/formation cases and all sixteen stake combinations per case (524,880 checks). No live FHE invocation.

| Rival condition | Best own inactive margin | Best own active margin |
|---|---:|---:|
| Inactive | 324/2187 = +0.1481 | 1788/2187 = +0.8176 |
| Activates | -504/6561 = -0.0768 | 3888/6561 = +0.5926 |

Best example (HOLD): Scout and Guardian (base Strike, trigger Guard, response Guard), Striker (base Strike, trigger Strike, response Guard). Active stake sector 2. 2,025 inactive choices yield positive expectation against the inactive independent mixture. This disproves using the single-lane minimax guarantee as a squad-level guarantee. Does not show a dominant strategy, equilibrium, human balance or superiority against actual adaptive bots. Existing activation information study remains relevant. Next: richer correlated/adaptive distributions, full match policies and human playtest, not arbitrary score changes.

## Blacksite: candidate route score/difficulty study, executed in this session
Based on BlacksiteMission.sol finalizeAttempt: exact count for STEALTH (S, zero heat) and BREACH (B, +2 heat); exact + misplaced for PROBE (P, +1 heat). Only exact BREACH wins. Five attempts, score max(0,100 - 10*heat - 5*(attempts-1)); lock = 0. Enumerated all 256 synthetic codes and all 81 four-route schedules with final forced breach, earlier breach if only one candidate remains. Guess policy uses only candidate set: minimizes maximum posterior bucket, then squared bucket sizes, prefers a possible secret, then lexicographic index. Breach terminal hits excluded from future buckets. 20,736 trajectories executed.

| Schedule | Breaches/256 | Mean score | Worst score |
|---|---:|---:|---:|
| PSSSB | 250 | 50.8789 | 0 |
| PSSPB | 256 | 45.3711 | 40 |
| PPPPB | 256 | 37.1680 | 35 |
| SSSSB | 155 | 36.6992 | 0 |
| BBBBB | 155 | 1.9141 | 0 |

There is a real information/heat tradeoff, but deterministic guaranteed breach using a known policy is an explicit competitive difficulty concern. Not a proof of an optimal solver or human skill; uniform distribution is assumed, candidate code creator fairness is unresolved. No actual secret, wallet, FHE or live mission involved. Keep existing local tutorial. Do not deploy/approve candidate as competitive until difficulty and warden/operative fairness reviewed. Evaluate revised mechanics before implementing any cryptographic change; retain prior 7,776-code research and rejected scan decision.

## Remaining Stage 1 closure
- Arena: adaptive squad/five-round strategy, GAMBIT timing and information leakage, explicit balance acceptance and novice comprehension evidence.
- Blacksite: settle competitive difficulty, secret generation/creator fairness, route scoring and mission progression, while keeping local tutorial separate.
- Commander shared progression: existing verified formula 50 XP per completed match +100 per win, level 1+floor(XP/100); design eligible canonical identities/deduplication, local vs verified achievements, cosmetic-only unlocks, reorg rollback, self-farming and incomplete/expired handling. No staking, ranking, fabricated records or Blacksite rewards before verified mission.
- Academy: preserve full five-round curriculum, define actual beginner learning gates and test with uncoached players. Master scope targets first meaningful choice <30s, 4/5 understand basics and 3/5 want rematch.
- Resolve versioned rules and recovery/authority matrix across pillars; review foundational decisions before moving stage. Existing implementation evidence does not establish player fun or independent review.
- Current decision: Stage 1 OPEN. Visual phase paused as current priority. No artificial score or completion claim.

Executed standalone scripts and JSON results preserved in conversation artifacts. This commit is a record, not an assertion that those scripts are part of the repository test suite or that CI passed. No onchain writes.