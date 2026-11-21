# ADR-004 — Persistent Arena Match Protocol: Transition Model and FHE Boundary
Status: **research model passes deterministic tests; NOT implemented onchain**
Date: 2026-11-21
Depends on: [ADR-003](ADR-003-ARENA-V3-RULES-AND-MATCH-PROTOCOL.md), [Issue #8](https://github.com/Iniwura/Gambit/issues/8), [Issue #11](https://github.com/Iniwura/Gambit/issues/11)

## Problem this solves

A compelling five-round competitive match needs an authoritative session that can be recovered after disconnects, enforces turn order, permits no repeated use of stale encrypted commitments, and cannot invent a winner from an incomplete FHE computation. Without this model, merely putting five one-encounter smart contracts behind a lobby would be expensive and fragile.

The rules-only [Arena v3 prototype](../src/research/arena-v3-rules.mjs) gives scores; this separate [protocol model](../src/research/arena-v3-protocol.mjs) defines how the live game will collect and authenticate those scores. It does not perform FHE, sign transactions or verify genuine KMS output.

## Protocol states

| Current state | Allowed transition | Preconditions | Next state |
| --- | --- | --- | --- |
| `collecting` | Submit private squad commitment | Exactly one of two approved participants; unique handle; one submit per participant; before round expiry | `collecting` or `ready` |
| `ready` | Begin FHE resolution | Both commitments present, current round still active | `resolving` |
| `resolving` | Record result ciphertext handle | Fresh valid handle, no alias to prior/active handles | `awaiting-proof` |
| `awaiting-proof` | Finalize with verified public score | Exact match ID, round index, result handle and 4-bit score encoding; externally verified proof | `collecting` for next round, or `finished` after round five |
| `collecting` | Expire incomplete round | Deadline elapsed, round not fully committed | `aborted` with **no fabricated winner** |
| `ready`, `resolving`, `awaiting-proof` | Recover/retry | Public state drives recovery; no silent resubmission or cancellation of two sealed orders | Same state until canonical transition |
| `finished` or `aborted` | None | Terminal, immutable result/abort | New match required |

**Important:** An in-memory model has no defense against a malicious party that directly mutates its state. Production guarantees must be enforced by Solidity storage/authorization, real FHE access control and cryptographic proof validation. The model and tests demonstrate consistency properties only.

## Research implementation

- `src/research/arena-v3-protocol.mjs` models two distinct participants, one persistent match ID, five rounds, source-controlled deadlines, one order ciphertext handle per side per round, exact used-handle lineage and a terminal win/abort distinction.
- `tests/arena-v3-protocol.test.mjs` covers duplicate/wrong-player input, stale clock, cross-role and cross-round handle replay, mismatched proof handle, forged packed score, premature finality, timeouts while partially submitted, no cancellation after two committed inputs, public-state sanitization and 110 simulated five-round sessions generated from the current deterministic Arena v3 scoring model.
- The injected test verifier uses string equality against **explicitly labeled OFFLINE-MOCK-ONLY proofs**; never copy it into a deployed verifier or label any output “onchain verified.”
- The initial CI run correctly caught a constructor accepting missing timestamps through a default argument. That implicit default was removed. Subsequent deterministic CI passed 92/92 tests on commit `3f8e3a338c1b9af55c5a7854b1f0626694c25652`.
- No revisions to `fhe/contracts/SquadGambit.sol`, live public deployment metadata, application UI or transaction path were made.

## FHE-specific security questions that remain unanswered

1. **How is a gambit spent secretly only once?** A plaintext `bool gambitUsed` would disclose whether the wager occurred. An encrypted stateful flag and encrypted conditional application need independent design; no one can claim v3 is confidential until its dataflow and ACLs are audited.
2. **Where does match/round binding happen?** Public packed-score proof must be bound to the precise stored current result ciphertext and corresponding canonical match round. Merely passing a client-provided `matchId` is not cryptographic binding.
3. **How do stale ciphertexts fail?** FHE `fromExternal` input validation, sender/contract binding, fresh per-round commitments, no input replay across owners, permissions and expiry behavior require Solidity and actual chain tests.
4. **How does a match recover from an unreleased FHE result?** If a result is never finalized, there must be an explicit no-fake-victory failure state and recovery path that cannot let an opponent indefinitely hold winning stakes. Deadline and fairness policy must be independently designed.
5. **What is the actual HCU and fee cost?** The currently deployed v2 static inventory estimates 5,013,012 HCU for one aggregate encounter. V3 adds sector and encrypted GAMBIT logic as well as repeated proof rounds. Neither multiplying the static estimate by five nor using mock gas numbers is a reliable live measurement.
6. **What are the actual wallet interactions?** The persistent sequential design could require two encrypted submissions plus resolution plus proof finalization per round. Measure real RPC, SDK, HCU, KMS, fees and failure recovery before promising fast matches.
7. **What is deliberately made public?** Public score and match phases are intentional outputs. No per-fighter winner, formation, triggered counter or stake target is proven by the current protocol. Some wagers may be inferred from high aggregate scores even if concealed during planning.

## Definition of done before upgrading from research to v3 smart contract

- [ ] A real complete v2 two-wallet signed Sepolia match reaches public KMS-verified finality. Exact evidence: explorer links and canonical final score.
- [ ] Clock, repeated match identity, expiration, stale round proofs, private wager state and FHE handle ACLs are threat-modeled with counterexamples.
- [ ] Offline prototype shows meaningful adaptive five-round competition and human willingness to rematch.
- [ ] Separate Solidity contract v3 is written without modifying deployed v2; independently compiled, property/mock-tested, HCU-inventoried and security-reviewed.
- [ ] **One-shot approved** testnet v3 run proves live latency, fees, recovery and public verified score against a compiled independent oracle.
- [ ] Only after those gates, create a full in-game lobby/combat experience around real authenticated protocol events.

## Decision

**Keep v2 as the real FHE validation base. Keep v3 as an evidence-backed, isolated architecture candidate.** Do not treat 92 passing Node tests as proof of secure live multiplayer, and do not convert this research model into UI-driven authority.
