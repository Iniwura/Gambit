# Independent review remediation — 26 November 2026

## Blacksite F-01 and F-02
Patched undeployed BlacksiteMission.sol: BREACH_BASE 64, disjoint STEALTH 0..4, PROBE 16..48 (bounded counts), BREACH 64..68. Encrypted multiplicity-aware intersection uses per-glyph counts and encrypted min via lt/select. No plaintext code/guess disclosure. Approach is confidential before resolution and decodable from public feedback afterward. Existing Arena deployment unchanged.

Old membership-only algorithm mismatched independent occurrence-elimination oracle on 30,072 of 65,536 ordered pairs. New cleartext mirror and existing reference agree with independent oracle on all pairs. 24 reachable packet meanings have no cross-approach collisions; tests cover invalid bounds. FHE mock adds perfect PROBE vs zero-match BREACH and heat/proof validation, seven repeated-glyph fixtures. Full CI at f08d0e633429fadbeae2048eb5e6e1dce7eeac0e: https://github.com/Iniwura/Gambit/actions/runs/45861330157 — deterministic 257/257, TypeScript/build/compile passed, Hardhat 32 passing including both new cases. Browser job still in progress when recorded. No exhaustive 65,536 FHE executions, live HCU measurement or deployment claimed. Blacksite remains deployment-blocked pending cost, privacy, collusion and live acceptance.

## Arena F-03 preliminary activation information study
Reproduce: node scripts/study-arena-activation-information.mjs
Mirrors deployed 0..7 v3 scoring, not older charged-sector 0..10 research. 21 distinct conditional triples (collapse only irrelevant trigger when response equals base), 27,783 squad/formation choices, four own stake possibilities = 111,132 distinct own orders. For each of 6 scenarios, 48 rival draws per activation state, equally weighted; 10,668,672 order/state evaluations per scenario. Optimize expected single-round score margin with and without seeing public activation. No knowledge of actual secret order or target. Same-pool means bit independent of opponent tactics; different pools model a hypothetical known correlation, not actual human behavior. Results in points:
| Seed | Different pools | Value of bit | Value if own stake spent |
| --- | --- | ---: | ---: |
| 1785553513 | no | 0 | 0 |
| 1785553513 | yes | 0.312500 | 0.364583 |
| 1234567 | no | 0 | 0 |
| 1234567 | yes | 0.385417 | 0.229167 |
| 3735928559 | no | 0.010417 | 0.010417 |
| 3735928559 | yes | 0.302083 | 0.270833 |

These results establish possible value of advance activation knowledge under the chosen distributions, not real-world win-rate advantage, minimax equilibrium, or full match balance. The independent fast mirror has not yet been exhaustively compared to FHE outputs. No changed Arena rules or deployment. Next: cross-check against canonical reducer, five-round adaptive studies and compare confidential activation circuit vs explicitly symmetric declaration (HCU, latency, disclosure, one-use accounting). Do not modify the pinned deployed contract without versioned review and approval. Preserve actual public activation in current UI.

## Release boundaries
No new wallet signatures, chain actions, production integration or visual score change. Continue full-game design and integration concurrently; repeat live play and independent playtesting still required.
