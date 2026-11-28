# ARENA v3 — Deadline and Interrupted-Round Recovery Policy

**Date:** 21 November 2026
**Status:** PURE LOCAL RESEARCH IMPLEMENTED. Not a deployed contract, working two-player lobby, chain event verifier or signed match.
**Parent:** [Arena v3 feasibility](ARENA_V3_FEASIBILITY.md) · [Master scope](GAMBIT_MASTER_SCOPE.md).

## Narrow purpose

The proposed five-round encrypted Arena needs precise behavior when one player never submits, proof delivery takes longer than expected, or a wallet disconnects. Rewarding the first submitter with an invented victory would create unfair griefing incentives. An incomplete round must remain **unscored** until an explicit future cancellation or resumption protocol exists.

[Pure round policy](../src/research/arena-v3-round-policy.mjs) accepts a hypothetical trusted public round snapshot, validates identity, timing, score bounds and settlement consistency, and derives allowlisted labels. It has **no network, wallet, encryption, RPC or signing functions**.

| Public round evidence | Read-only status | Interpretation |
| --- | --- | --- |
| Neither player submitted, still before deadline | WAITING_FOR_BOTH | Normal planning |
| One order on time, still before deadline | WAITING_FOR_OPPONENT | Wait without awarding pressure |
| At least one missing after deadline | EXPIRED_UNSCORED | No invented winner or public final score |
| Both on time, even if deadline subsequently passes | READY_TO_RESOLVE | Valid committed round remains eligible for resolution |
| Both on time, resolved but not finalized | AWAITING_SIGNED_PROOF | No score until final proof and canonical settlement |
| Finalized with valid bounded score | FINALIZED | Public aggregate only |

## Candidate invariants

- Distinct nonzero Ethereum participants; versioned research match ID and round 1–5; candidate Sepolia chain 11155111.
- Entry window greater than zero and no more than 24 hours. This bound is research-only, not a verified deployed rule.
- A submitted order's timestamp must fall between the opened-at timestamp and deadline inclusive, and must not appear in a future state snapshot.
- The deadline closes **new entries**, not the settlement of two already-accepted orders.
- No resolved state without both orders; no finalized state without resolved state. Unfinalized states cannot claim scores.
- Proposed v3 score range 0–7 per side, packed as challenger*8+defender. **Not compatible** with deployed v2's 0–5 scoring.
- Strict public output omits plans, hidden wager sector, addresses, private keys, ciphertext and any invented onchain win.
- Action labels are read-only advice. No cancellation, wallet permission, transaction or onchain auto-retry is authorized or executed.

## Verification and remaining work

[Adversarial tests](../tests/arena-v3-round-policy.test.mjs) cover exact deadlines, one/no seal without awarded win, both seals followed by late resolution, resolved versus finalized, impossible scores, wrong chain or addresses, early/late timestamps, secret redaction and all five rounds. The new source tests passed 8/8 in an in-process replay; GitHub Actions remains a separate acceptance gate until verified.

Still required: contract-enforced v3 state transitions, consensus timestamp source, fair mutually authorized cancellation or expiry, locked stake policy, genuine two-wallet five-round encryption, KMS proof and receipt recovery, measured gas/HCU/latency, griefing analysis and outside-player UX. **No real v3 protocol is deployed.**

**Decision boundary:** do not infer a win from silence or timeout. Preserve the authentic SquadGambit v2 result and keep final art/audio frozen until competitive gameplay is proven.
