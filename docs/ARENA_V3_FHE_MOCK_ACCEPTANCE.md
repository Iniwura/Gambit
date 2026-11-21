# Arena v3 — Isolated encrypted match research

**Build:** 21 November 2026
**Branch:** build/verified-first-slice · draft PR #5
**Status:** an independent Solidity FHE prototype has compiled and completed its initial 5-mock-test run. The later cross-round proof replay and mock EVM gas acceptance checks have been committed and require their own CI confirmation. **No v3 contract is deployed.**

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

The first five test cases passed in [initial FHE job](https://github.com/Iniwura/Gambit/actions/runs/44941549509) after fixing a Solidity reserved-word compile error. Confirm the later tests in their own run before marking the full prototype verified. Existing project deterministic, browser and v2 mock gates must also stay green.

## Critical unresolved issues before any live multiplayer

- **No measured Sepolia HCU or sequential depth.** Zama's [HCU reference](https://docs.zama.org/protocol/solidity-guides/development-guide/hcu) publishes *devnet* budgets, which are not proof of the exact Sepolia limit or actual cost of this circuit.
- There is no second-human wallet E2E, real input proof acceptance on Sepolia, actual inclusion latency, wallet-rejection recovery or production contract audit.
- Candidate transaction count is **21 writes for a five-round match**: one match creation + two seals, one resolve and one finalize per round. This excludes consent-free RPC reads, proof retrieval and retries; too much wallet friction remains a live UX risk.
- Although the selected GAMBIT sector is encrypted, activation timing is public and the second sealer can observe it. Analyze second-mover advantage, gas griefing, information inference and possible encrypted-flag alternatives.
- Deadlines, chain clocks, expired-match funds, optional match cancellation, invitation spam and future stake economics require formal rules. A match with incomplete rounds is **not** a victory for anyone.
- The current prototype normalizes out-of-range encrypted tactics to legal values. Validate this policy against intentional malformed encrypted inputs and threat-model one-use inference.
- Model and compare human match lengths and alternative bundling only if adaptation is preserved. No optimistic claim of 90+/100, formal secrecy or ready-for-public release.

**Next acceptance gate:** verify new mock tests and runtime/gas evidence; calculate a clearly labeled static v3 HCU inventory before evaluating real HCU on an authorized deployment. Keep PR #5 draft and graphics frozen.
