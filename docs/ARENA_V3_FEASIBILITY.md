# ARENA v3 — Multiround + signature GAMBIT feasibility record

**Phase:** architecture/research only (not a deployment approval).  
**Recorded:** 21 November 2026.  
**Status:** DESIGN OPTIONS UNDER TEST. The existing v2 deployed contract and Duel #1 are unchanged.  
**Parent:** [Game Architecture v1](GAME_ARCHITECTURE_V1.md) · [Full scope](GAMBIT_MASTER_SCOPE.md).

## 1. Problem to solve

The current production goal is a **genuinely strategic, evolving multiplayer Arena**. The existing `SquadGambit` v2 demonstrates a single encrypted 3v3 encounter, ten inputs per side, one-use invited opponent, FHE-derived aggregate result, public KMS signature and verifiable 0:1 finalization. The five-round loop in local TRAINING **does not make the live contract a five-round game**.

For a future human match we want: adapt across public prior-round outcomes; secretly program fresh tactics each round; allow a once-per-match high-risk GAMBIT; finish with an honest cumulative objective; recover unfinished sessions; keep all private lane outcomes and formations confidential.

## 2. Candidate options

| Candidate | Benefits | Main failure / tradeoff | Decision |
| --- | --- | --- | --- |
| A — Five independent v2 duels with manually re-created squad invites | Reuses one verified contract with no new protocol; playable reference for user research | Each v2 duel takes seal/open/submit/resolve/finalize. **Five repeated encounters imply 25 separate onchain actions**, not counting UI work; no native shared season/match and hard to link results fairly. Every write still requires user approval. | **Research/reference only**, not a finished best-of-five |
| B — Versioned v3 match with five independently signed, sequential rounds and public aggregate result after each | Preserves honest adaptation, match identity, one-use strategy per round and cumulative scoring | Requires new contract, per-round roles/ACL/deadlines, FHE computation and signed proof; multiple signing/wait cycles risk boring users; HCU/latency/privacy unknown | **Leading DESIGN CANDIDATE** pending measurements |
| C — Commit all five secret rounds in one batch | Might reduce UX friction and onchain transactions | If tactics are locked before results, players cannot react/adapt across rounds; may require excessive FHE compute depth/complexity | Reject as an *adaptive five-round* claim unless redesigned |
| D — Offchain trusted server calculates turns | Fast and easy to animate | Breaks central verifiability/privacy model if it learns hidden orders or fabricates match outcomes | **Reject** as authority for sealed match resolution |

**Not yet selected for implementation.** Need genuine design review and measurable acceptance criteria. A "five-round match" must mean *five authenticated tactical decisions*, not five plays of the same final score.

## 3. Candidate v3 state model (not implemented)

```text
MATCH_CREATED
 → ROUND_n_WAITING_FOR_BOTH (both distinct players commit encrypted plans)
 → ROUND_n_BOTH_COMMITTED (locked, no editing)
 → ROUND_n_RESOLVED (encrypted result handle, no plaintext lane disclosures)
 → ROUND_n_KMS_READY (signed public aggregate acquired by client; NOT an onchain phase)
 → ROUND_n_FINALIZED (proof checked in contract, total scores updated)
 → ROUND_(n+1)_WAITING_FOR_BOTH [until n = 5]
 → MATCH_FINALIZED (winner determined by accumulated public aggregate scores)
```

For any round, a terminal `EXPIRED`/unavailable state must have an explicit fairness policy: opponent abandonment, timeout after one submission, cancel/restart, and whether stake can be reused. **Never silently assign a win to a player without a published, approved rule.**

**Immutable contract invariants:**
1. Match identifies two distinct verified addresses, agreed version, season/match ID, round index and rules hash.
2. Each player can submit one encrypted action bundle for a given round. Round scores are computed only after both bundles are accepted.
3. No editing after seal; replay across matches or rounds is rejected. The protocol never reads private opponent plans in the browser.
4. Public output only includes the signed aggregate score for each round, cumulative score and final winner. No per-role or sector revelation.
5. A public aggregate proof must match the exact immutable result handle. Missing/invalid KMS signature, mismatched handle or score bounds → fail closed.
6. Scores and match winner follow the deterministic reference rules. Timeout/abandonment outcomes require explicit fairness design, not an invented victory.
7. Every onchain state transition survives refresh/lost receipt and can be read without signing; transaction action requires user consent with capped fee.

**Transaction budget is not yet confirmed.** A simple v3 implementation with one match creation and four per-round write actions (two input submissions, one FHE resolve, one finalize) would entail up to **21 writes for a complete five-round session**. This is an architectural *counting example*, not a promise that a deployable v3 will use that count. Each action may have very different gas/HCU and SDK wait times. Explore batching/authorization only if it remains explicit, secure and user-approved.

## 4. Signature GAMBIT — bounded local candidate

See `src/research/gambit-commitment-v0.mjs` and `tests/gambit-commitment-research.test.mjs`. The additional [`arena-v3-match.mjs`](../src/research/arena-v3-match.mjs) headless research state machine and [tests](../tests/arena-v3-research.test.mjs) now enforce exactly one local stake per player over five rounds, double-submission refusal, immutable progression and aggregate-only public history. **Neither research model is a deployed FHE match or player-facing feature.** This model explores a once-per-match secret stake in one of three reactor sectors.

**Candidate action:** player chooses one private reactor sector or does not stake. If the side **wins** that sector in the selected round, increase that round's reactor pressure by **2**. If the side **loses or draws**, decrease that round's pressure by **1** (floor at 0). Each player may use the stake only once per future match; enforcement by a new round/match state machine remains **NOT IMPLEMENTED**.

- The local reference uses public test lanes to evaluate a private selection, but only emits `pointsA`, `pointsB`, `packed`, `outcome`. No sector, plan or lane result is included in the output.
- Baseline 0..5 per-team score becomes candidate 0..7; three bits per team would still pack a result, but **deployed v2 explicitly rejects scores greater than 5**. This is a new **v3 scoring/validation rule** and is not wire-compatible with existing v2.
- Test 27 lane-outcome patterns × 16 combinations of unused/three-sector stakes, check symmetry and bounds, compare winning versus losing wager and ensure no sector leaks into the aggregate object. These are **mathematical checks**, not a proven balanced or attractive human game.
- One-use is now enforced in a **local headless state machine**; the versioned **onchain** state machine is still unimplemented. Role/sector indices must be transformed correctly through encrypted formations. Prevent last-second stake decisions after learning opponent information.
- The extra FHE conditions, scoring arithmetic and risk of score-based inference must be measured and threat-modelled.

**Unanswered game-design question:** Is +2/-1 a meaningful but fair risk, or can optimal policies exploit it? Require cross-formation adversarial simulation, player testing, and simple “why did I win/lose?” explanation that does not reveal private sector outcomes.

## 5. Cost and Zama feasibility evidence boundary

Zama's [HCU guide](https://docs.zama.org/protocol/solidity-guides/development-guide/hcu) explains that homomorphic operations are separately metered from EVM gas and both per-transaction complexity and sequential-operation depth can force a revert. The guide quotes **20,000,000 complexity HCU and 5,000,000 depth HCU for its current devnet**; **these must not be assumed to be identical to the measured Sepolia limits**. For comparison it lists euint8 `add`, `eq` and `select` costs, but any v3 implementation must compile and measure *the real circuit and deployment network*, not just sum conceptual operations.

We have authentic Sepolia **EVM gas** for one deployed v2 submit, resolve and finalize and a valid public KMS proof. We **do not have independently measured actual HCU/depth or end-to-end multi-round human latency**. Thus:
- No unsupported claims of “five rounds under X seconds” or a fixed fee.
- No “gas-only” proof that v3 fits Zama's HCU budget.
- No assumption that an FHE secret can be used across independent matches without new ACL checks.
- Do not deploy or broadcast a v3 contract to run a feasibility study without new explicit transaction authorization.

## 6. Required tests before locking the candidate

1. Use the existing pure reference to run large strategy samples across formations and adaptivity. Record skill sensitivity, ties, stake exploitation and role balance.
2. **Partially completed:** the independent headless five-round reducer now tests exactly-once stakes, ordered commits, tied/final score bounds, duplicate refusal and public redaction. **Still open:** aborts, deadlines, human balance and a real encrypted round implementation.
3. Build a mock FHE Solidity research contract in a new namespace/version, prove exact parity against reference, assess bytecode/HCU estimates and privacy leakage. **Mock FHE is not Sepolia proof.**
4. Human-playtest the no-art greybox with new players; compare one-round versus five-round sessions, measure attention and comprehension.
5. If outcomes warrant it, request separate approval for a new testnet deployment and real two-wallet journey. Record authentic fees, latency, HCU if available, receipts and recovery.
6. Explicitly accept/reject the candidate in this decision record. Until then, leave real v2 unchanged and the premium graphics phase blocked.

## Current verdict

**Option B is the strongest design hypothesis**, not a deployed or fully approved architecture. Our current real milestone remains one finalized confidential 3v3 encounter. The next task is **headless fairness/cost analysis, exact round-state contracts and acceptance tests**, *not final character art or a new UI redesign*.
