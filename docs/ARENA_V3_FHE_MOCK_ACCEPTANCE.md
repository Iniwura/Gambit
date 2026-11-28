# Arena v3 — Isolated encrypted match research

**Build:** 21 November 2026
**Branch:** build/verified-first-slice · draft PR #5
**Status:** isolated v3 Solidity FHE mock contract COMPILED AND VERIFIED. [Hardhat FHE mock run 44941951287](https://github.com/Iniwura/Gambit/actions/runs/44941951287) passed 25/25 FHE tests, including 81/81 cross-formation and paired secret-sector oracle cases, all five encrypted rounds and signed-proof replay protection. **No v3 contract is deployed; HCU and live cost remain unmeasured.**

## Scope and precise security boundary

[Research Solidity source](../fhe/contracts/ArenaV3Research.sol) is a new contract, not a modification of the deployed SquadGambit v2. It uses the same pinned FHEVM Solidity configuration and EVM compiler. The goal is to test the actual encrypted round mechanics before any client or network release.

The full protocol candidate is five **sequential** rounds, not five invented animations of a single onchain duel. In each round both distinct players must submit new encrypted tactics (three role triples and one private formation, ten values per player). The eleventh encrypted input is the selected visual-sector GAMBIT target when used. A caller may publicly activate GAMBIT at most once per match; **the activation timing and Boolean are public**, while its 0–2 target sector is kept encrypted. That information-leakage tradeoff requires explicit acceptance before release.

The FHE circuit privately routes fighter matchups through the two formations, evaluates three conditional tactics, applies role-specific Scout/Guardian/Striker bonuses, and optionally adjusts a privately selected reactor lane by +2 on win or −1 on draw/loss (floored at 0). Only the new v3 aggregate 0–7 points per side becomes publicly decryptable as an encrypted packed result. The exact **stored per-round handle** must be authenticated by a KMS-signed proof before the public aggregate is allowed to finalize.

Each round publishes its bounded aggregate, cumulative scores and a terminal outcome only after all five rounds finalize. No caller can query per-role cleartext outcome, selected formation, underlying plans or stake sector. The reference cleartext five-round rules remain separate from the actual encrypted contract.

## State machine and interrupted flow

createMatch → round 1 opened (invitation by creator, defender only participates by sealing) → two signed encrypted seals → permissionless resolve once both are present → signed public-result proof → permissionless finalize → fresh round 2; repeat through 5 → match completed.

A round has a candidate 24-hour **entry** deadline. If fewer than two players sealed before deadline, anyone may explicitly expire the match without awarding a winner or fabricating pressure. If both submitted on time, they may resolve and finalize after the deadline. The creation of an unsolicited invitation neither forces the defender to participate nor awards anything to the creator.

No automated cancellation/signature/transaction occurs. The Solidity code is entirely unconnected to the current game UI and is not an approved Sepolia deployment.

## Verification plan

[Mock FHE contract tests](../fhe/test/ArenaV3Research.ts) cover:
1. Five independently encrypted 3v3 rounds, score accumulation and terminal state.
2. Role/visual lane formation routing for a hidden-sector GAMBIT; one activation per party.
3. A one-sided expired match ending unscored with immutable prior public totals.
4. Both on-time seals settling after the entry deadline.
5. Invalid participants, duplicate submits, invalid KMS proof/aggregate, repeated resolution.
6. A repeated **identical public score** in different rounds cannot reuse a previous round's KMS proof.
7. Compiled runtime and mock-only transaction gas measurements, explicitly not Sepolia/HCU results.
8. Independent cleartext oracle parity for all nine formation pairs crossed with nine (three-by-three) hidden-sector pairs: **81/81 cases passed**, including conditional counter-programs and both players staking.

**Verified latest mock run:** [GitHub Actions 44941951287](https://github.com/Iniwura/Gambit/actions/runs/44941951287), **25/25 Hardhat tests**, including the six v3 tests and 81 oracle combinations. The first attempt failed because a Solidity variable used the reserved word `sealed` ([run 44941481160](https://github.com/Iniwura/Gambit/actions/runs/44941481160)); renaming it to `submitted` restored compilation and mock tests. Separate desktop/mobile regression status is tracked in the build log.

## Measured local mock EVM and bytecode evidence

[Hardhat mock FHE log](https://github.com/Iniwura/Gambit/actions/runs/44941951287) reported:
- Optimized runtime: **11,851 bytes** (the research v3 contract, **not** the deployed v2 runtime).
- Deployment: **2,688,796 mock EVM gas**.
- First participant seal: **1,357,814 mock EVM gas**.
- Second participant seal: **1,357,958 mock EVM gas**.
- Resolution: **2,041,149 mock EVM gas**.
- Signed-proof finalization: **127,045 mock EVM gas**.
- 11 encrypted 8-bit inputs per side per round; 67-byte mock proof observed.

These are **local mock EVM operation costs**, not actual Sepolia deployment fees, not a measure of privacy/security and emphatically **NOT HCU**. The likely 21 signed actions and user-attention cost remain the central product risk. The mock run validates circuit correctness under the local FHE simulator only.

## Critical unresolved issues before any live multiplayer

- **No measured Sepolia HCU or sequential depth.** Zama's [HCU reference](https://docs.zama.org/protocol/solidity-guides/development-guide/hcu) publishes *devnet* budgets, which are not proof of the exact Sepolia limit or actual cost of this circuit.
- There is no second-human wallet E2E, real input proof acceptance on Sepolia, actual inclusion latency, wallet-rejection recovery or production contract audit.
- Candidate transaction count is **21 writes for a five-round match**: one match creation + two seals, one resolve and one finalize per round. This excludes consent-free RPC reads, proof retrieval and retries; too much wallet friction remains a live UX risk.
- Although the selected GAMBIT sector is encrypted, activation timing is public and the second sealer can observe it. Analyze second-mover advantage, gas griefing, information inference and possible encrypted-flag alternatives.
- Deadlines, chain clocks, expired-match funds, optional match cancellation, invitation spam and future stake economics require formal rules. A match with incomplete rounds is **not** a victory for anyone.
- The current prototype normalizes out-of-range encrypted tactics to legal values. Validate this policy against intentional malformed encrypted inputs and threat-model one-use inference.
- Model and compare human match lengths and alternative bundling only if adaptation is preserved. No optimistic claim of 90+/100, formal secrecy or ready-for-public release.

**Next acceptance gate:** verify new mock tests and runtime/gas evidence; calculate a clearly labeled static v3 HCU inventory before evaluating real HCU on an authorized deployment. Keep PR #5 draft and graphics frozen.
