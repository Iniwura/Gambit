# Five-round GAMBIT activation information sensitivity

Research only. No human match, live FHE, equilibrium, or privacy proof. Use actual v3 0..7 scoring (not historical charged-sector experiment). Reproduce: node scripts/study-arena-five-round.mjs. The fast scoring mirror is checked against the existing canonical cleartext reducer and commitment rule with 10,000 seeded pairs; CI execution pending at publication.

## Experiment
All 111,132 canonical own round choices searched per scenario (21 distinct plans per role, 3 formations, inactive or three stake sectors). Finite known 48-squad rival distributions per activation state. Rival activates exactly once on a uniformly sampled round; both responding policies activate exactly on round 3. Each responder maximizes expected **current round** point margin under its information. Both see prior public activation status; informed additionally sees the current activation bit before choosing orders. No target or actual rival plan is revealed. Independent and activation-correlated pools are hypothetical, not learned human policies. Paired common random draws; 10,000 five-round trajectories per scenario, 60,000 paired trajectories total (120,000 matches, 600,000 round resolutions). Not a full dynamic game solution.

| Seed | Activation-correlated pools | Mean informed minus blind final margin |
| --- | --- | ---: |
| 1785553513 | no | -0.0073 |
| 1785553513 | yes | 0.6591 |
| 1234567 | no | 0 |
| 1234567 | yes | 0.7427 |
| 3735928559 | no | 0.0366 |
| 3735928559 | yes | 0.4950 |

Exact same experiment logic executed in JS in chat. Committed module adds canonical parity checks and a deterministic regression; those are not claimed passing until the CI result is inspected. Very high absolute responder win rates (98–99%+) reflect exhaustive best response to a small assumed known pool; not player strength or a prediction. Finite sampling and tie-breaking can explain small independent-pool differences. The observed correlated gains support addressing the disclosure, not claiming a fixed real-player advantage.

## Candidate
ArenaV4ConfidentialActivationResearch is isolated from the pinned v3 deployment. Same eleven encrypted input count, selector 0..2 requests use, all others inactive; encrypted spent bits and fixed encrypted resolution path; repeated requests silently no-op. This is a deliberate protocol change: no public spent booleans or public activation argument. Owner-only spent recovery UX/ACL, end-to-end information leakage, gas/side channels and live HCU are still open. No deployment or integration approval.
