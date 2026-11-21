# BLACKSITE v2 — Confidential Mission Protocol and Fairness Decision

**GAMBIT Phase 1 architecture research · 21 November 2026**  
**Status:** CANDIDATE ONLY. No player-facing v2 mission, FHE contract, public encrypted codes, deployment, mission receipts or fee measurements exist.

**Non-negotiable production order:** game design + architecture → working responsive greybox → gameplay/security verification → final graphics. [Master Scope](GAMBIT_MASTER_SCOPE.md) · [Full Architecture](GAME_ARCHITECTURE_V1.md) · [Dated Build Log](BUILD_LOG.md).

## Executive decision

The original four-slot, four-symbol BLACKSITE tutorial has `4^4 = 256` possibilities (~8 bits). Exhaustive tests show a perfect deduction solver can crack any one of them within four scored queries. Five available attempts therefore make it unsuitable as a credible, high-stakes confidential multiplayer challenge. **It remains the introductory local training puzzle; we do not call it encrypted or secure.**

A separate [v2 headless research rule set](../src/research/blacksite-v2-feasibility.mjs) explores:
- **Five** ordered glyphs from **six** possible symbols; repeats allowed (`6^5=7776`, ~12.925 bits).
- **Six total turns/actions** across guesses and optional intelligence scans.
- **Up to five** code guesses; **up to two** scans that each cost an action. Scans count how many glyphs fall into one of three two-symbol classes; they reveal a *count*, not positions or the secret.
- A guess returns aggregate exact-position and correct-but-misplaced totals. A successful guess ends the mission immediately. Six spent actions without success lock it. Repeated guesses/scans and malformed, impossible or contradictory hints are refused.
- The headless deduction filter enumerates all 7,776 codes against visible aggregate hints to measure what an ideal solver could infer.

**We have NOT demonstrated** that this is fun, human-solvable, appropriately difficult, economically feasible on Zama, or safe from strategic inference. 13 bits remains entirely brute-forceable offline. No hash of a short secret may be published as a "secure commitment": a dictionary attack would recover it.

## The game design hypothesis

The player is an infiltrator who must decide between **spending a turn learning about the vault** and **spending a turn attempting the actual combination**. Scans cost the same scarce action resource as guesses. Rather than an arbitrary quick Mastermind clone, good play should combine early information, constrained deduction and deliberate risk. A future mission layer adds environmental pressure, objectives and consequences, but no such layer is implemented yet.

The current six-action prototype creates a possible bad outcome: if players need too many scans just to understand the code, the mission is not fair or fun. More symbols are **not** proof of quality. We must measure the percentage of secrets a strategic solver can finish, median action count, how much scans actually help, whether there is a dominant sequence of scans/guesses and whether humans can interpret every clue. Reject or redesign the rules if the results are poor.

The earlier four-glyph codebreaker remains an honest, wallet-free tutorial experience with a tested [local mission lifecycle](../src/blacksite/mission.mjs). Do **not** silently swap it for the v2 model or pretend both are encrypted.

## Intended actors, authority and privacy

| Actor / system | May do | Must NOT do |
| --- | --- | --- |
| Mission creator/operator (future) | Create one mission with an approved unique ID, bounded difficulty and mission policy | Choose a code after seeing solver guesses; reset secret mid-mission; inspect a solver's private guess |
| Infiltrator/player | Inspect public rules, authorize an attempt/scan, recover canonical status | Submit multiple queries for one allowance; bypass rate limits; privately read secret; force a victory |
| FHE mission contract (future) | Store encrypted secret, validate solver and mission state, perform bounded encrypted equality/count operations, enforce permanent attempt consumption | Reveal cleartext secret or location clues; decrypt private combinations; silently mint results |
| Zama public-decryption/KMS proof (future) | Authenticate deliberately disclosed aggregate hint or terminal outcome | Serve as permission to decrypt the secret or to treat unauthenticated browser text as an onchain result |
| Client interface (future) | Show mission/action progress and only explicitly verified aggregate clues/results | Authoritatively update onchain success without actual receipts; publish private plan values or proof material |

**Unresolved creator fairness issue:** a creator who knows the code can collude, sell the answer or exploit the solver. Contract deployment and FHE do not resolve secret-generation fairness. We must choose a credible secret-sourcing protocol (e.g. independently verifiable unpredictable randomness with confidential generation) and review its compatibility with the chosen Zama environment. No claims of trustless mission generation before it is demonstrated.

### Required onchain state (future versioned proposal, not a compiled schema)

```text
missionId: unique, never reusable
rulesVersion + rulesHash: bound at creation
creator: approved mission owner
solver: explicit distinct participant
encryptedSecret: FHE ciphertext; plaintext NEVER stored or logged
secretGenerationEvidence: verification of unpredictability/fairness (not designed)
actionBudget: 6
guessesUsed: 0..5
scansUsed: 0..2
actionNonce: monotonically consumed per solver action
lastActionType: guess or scan
pendingCiphertextHandle: single pending action; no double spending
openedAt + deadline: immutable bounded timeline
status: CREATED / ACTIVE / PENDING_RESULT / BREACHED / LOCKED / EXPIRED
publicHintHistory: ONLY canonical aggregate hints with signed KMS proof
terminalResult: publicly authenticated outcome, no secret or hidden per-position data
```

## Proposed state machine

```text
CREATED
 → ACTIVE (solver accepts one-use invitation; rules fixed)
 → PENDING_RESULT (one guess or paid scan reserved, nonce consumed)
 → ACTIVE (unique authentic KMS public aggregate received and accepted)
 → BREACHED (correct full guess) OR LOCKED (budget consumed)
OR → EXPIRED (deadline, no invented victory)
```

The pending-result state is vital. Once an attempt reaches the chain, a browser timeout or wallet/RPC failure cannot permit the player to repeat it and gain an extra query. Recovery reads authentic contract logs and state. Signed proof must be bound to the mission ID, attempt nonce, action type and the correct FHE handle. No unverified local transcript may grant a competitive victory.

We must resolve abandonment fairness: whether an expired mission is a loss, no-contest or compensated attempt. This decision requires user research and measurable incentives, not a hidden arbitrary rule.

## Security / abuse review checklist

**S1 — Offline enumeration:** even 7,776 possibilities can be enumerated cheaply if the public artifact reveals a secret-derived hash or reversible hint. Never publish a weak hash or plaintext seed. Protect with ciphertext AND game-level per-mission query controls, and recognize that owner/creator knowledge is a separate trust problem.

**S2 — Unlimited oracle / cross-mission inference:** one secret must never be queryable by arbitrary wallets across different mission IDs. Prevent multiple simultaneous solvers or colluding accounts from multiplying the hint allowance. Use fresh, independent secret material each mission. Enforce one-use/action nonce in the contract, not a browser counter.

**S3 — Front-running and replay:** bind each encrypted action to its mission, player, rules hash, nonce, deadline and chain; refuse duplicates, reordered hints, submit-after-lock and refunds that accidentally recreate spent allowance.

**S4 — FHE proof binding:** external KMS signature validates the specifically permitted encrypted aggregate or terminal result. Replaying a proof for a different mission/nonce/handle must fail closed. Review FHE ACLs and ciphertext ownership before deployment.

**S5 — Partial leakage:** an aggregate hint intentionally leaks information. Assess whether cumulative public histories reveal the code to spectators before the mission ends, including through adaptive scans. Reject per-position/secret reveals in the public outcome. Distinguish an exposed puzzle clue from unintended leakage.

**S6 — Service unreliability / cost:** estimate FHE per-query HCU, depth, ciphertext and proof lifetime, transaction gas and worst-case end-to-end latency separately. Abort and recover on proof timeout; never fabricate progress or silently retry a signed transaction.

**S7 — Fairness/balance:** analyze bot-optimal and human outcomes. The mission should feel learnable but nontrivial; secret entropy alone is not difficulty tuning. If budget is impossible, increase useful intel; if deterministic optimal solvers win every time, add a strategic mission objective beyond pure code deduction without undermining confidentiality.

## Acceptance tests before moving past architecture

1. Mathematical reference and aggregate scans pass exhaustive domain checks, malformed and contradictory evidence rejection, duplicate-query rejection, action caps and terminal immutability.
2. A playable **functional greybox** provides briefing → meaningful intel choice → attempt → visible feedback → breach/lock → debrief/restart with keyboard, mouse and touch, proper failure/recovery states and no synthetic victory.
3. Independently evaluate optimal and heuristic solver success across the full state space; measure human playtests with uncoached participants and revise the rule budget as needed.
4. Specify and independently review unbiased secret creation, access control, cross-wallet collusion/abuse, nonce/replay protection, expiry and disclosure policy.
5. Prototype a **versioned mock FHE** contract and compare output to the reference without calling mock success a Sepolia achievement.
6. Measure actual Zama dev/testnet HCU and round-trip latency before any production deployment. **No new chain writes/deployments without separately explicit authorization.**
7. Only after functionality and security acceptance should final BLACKSITE graphics and sound begin.

## Decision register

| Decision | State |
| --- | --- |
| Keep original 4^4 vault as transparent beginner training | LOCKED |
| Consider 5×6 code + six-action/scan economy for competitive BLACKSITE | **RESEARCH ONLY** |
| Publish aggregate hints only, never per-position secret data | DESIGN REQUIREMENT |
| Make attempts/identities/mission expiry and KMS proof authoritative onchain | DESIGN REQUIREMENT |
| Fair confidential secret generation, creator incentive model | OPEN / BLOCKING |
| Difficulty balance, solver success rates and game feel | OPEN / BLOCKING |
| Zama circuit/HCU/runtime for multiple encrypted oracle queries | OPEN / BLOCKING |
| Make BLACKSITE available in production navigation | **NO: not implemented** |

**Next:** use the research reference to quantify solver action strategies and code-space reduction, then choose the actual BLACKSITE difficulty and mission economy. In parallel, finish Commander Profile's trusted source and honest persistence/reorg architecture. Neither activity authorizes final graphics.
