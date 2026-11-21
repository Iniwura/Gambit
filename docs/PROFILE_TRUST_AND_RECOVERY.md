# Commander Profile — Approved Evidence, History and Recovery Architecture

**Phase 1 · 21 November 2026 · AUTHENTICITY FIRST · GRAPHICS FROZEN**  
**Status:** first trust-pinned read-only Sepolia record VERIFIED, persistent UI and multi-duel history NOT BUILT.  
Parent: [Full GAMBIT scope](GAMBIT_MASTER_SCOPE.md) · [Game architecture](GAME_ARCHITECTURE_V1.md) · [Dated work log](BUILD_LOG.md).

## 1. Core invariant

No commander should receive a public Arena win, rank, achievement, streak, season record or match statistic from an **unverified event, caller-provided contract hash, simulated/local battle, wallet UI notification, cached claim or unfinalized transaction**.

A verified receipt from some arbitrary contract is not proof that GAMBIT approved that contract. We therefore enforce **two independent gates**:

1. **Approved deployment root:** `src/profile/trusted-deployments.mjs` explicitly pins the real `SquadGambit` v2 Sepolia contract address, deployment block, chain ID and exact runtime hash. The caller may request MORE confirmations, never an unapproved address/runtime or fewer than 12. Any future contract upgrade requires an intentionally reviewed registry entry.
2. **Canonical finalization evidence:** `src/profile/verified-arena-record.mjs` checks chain identity, pinned runtime, a unique authentic `DuelFinalized` event from the approved contract, receipt success, exact transaction/hash/block/zero ETH/selector, nonempty proof in the transaction, event score and calldata agreement, one-use squad/duel linkage and current finalized contract state.

**The signing proof isn't cryptographically reverified offchain by the Profile module.** The trusted deployed contract accepted the KMS proof when it finalized onchain; Profile independently authenticates the contract, receipt and resulting score, rather than claiming to implement another KMS signature verifier.

## 2. Research boundary versus actual eligible history

The generic deterministic mock backend can prove that our verifier catches false receipts, but any test fixture can invent a matching runtime and event. To prevent this from becoming a false ranked result:

- `verifyResearchArenaProfileRecord(...)` brands records with a private **RESEARCH** WeakSet. Only `deriveResearchArenaProfile(...)` accepts them, and its output source is explicitly `LOCAL_MOCK_RESEARCH_NOT_PLAYER_EVIDENCE`.
- `verifyArenaProfileRecord(...)` FIRST runs immutable approved deployment policy, then canonical onchain checks, and brands results with a separate private **TRUSTED** WeakSet.
- `deriveCommanderArenaProfile(...)` **only accepts TRUSTED branded records**. Pasted JSON, copied mocks and unknown contracts are rejected even when their numerical scores look believable.
- Both paths reject contradictory duplicate match IDs, unrelated player wallets and unsupported data shape. A wallet-free empty history is genuinely `0 matches`, not an invented onboarding victory.

Tests: [profile-evidence-contract.test.mjs](../tests/profile-evidence-contract.test.mjs). Live independent read-only check: [Duel #1](https://github.com/Iniwura/Gambit/actions/runs/44923354217), confirming an actual finalization transaction and its authentic 0:1 aggregate.

## 3. Canonical snapshot / reorganisation handling

Public RPC nodes may not support historical-block `eth_call`. The verifier does not require archival reads for the result: it uses the mined receipt/event as historical evidence and independently checks current canonical state.

To resist transient reorganisation mid-verification, it:
- Obtains a current **block number and hash** and pins runtime/state checks to that number.
- Requires the finalization event's block hash to match the receipt and the canonical event-block lookup.
- Verifies that the recorded finalization already has **≥12 confirmations** at the pinned head.
- Re-fetches the pinned head block hash before issuing a trusted record. If that block is no longer canonical, it rejects the result.
- Does not reuse records after uncertainty without a fresh read. Twelve confirmations lower but do not eliminate reorg risk, RPC dishonesty or eventual-chain-finality uncertainty.

**Outstanding:** no durable reorg watcher/canonical-index history store exists yet. A persisted record must be treated as a *candidate only* after restart and freshly verified before ranked display. No UI should label an old cache permanently verified without reconfirmation.

## 4. Trusted public history reader (bounded discovery now implemented; persistence still future)

A single verified duel is proven. **An initial bounded discovery indexer now works:** [`src/profile/approved-event-discovery.mjs`](../src/profile/approved-event-discovery.mjs) reads only the approved contract's `DuelFinalized` logs in capped windows, checks event/block canonical hashes, requires 12 confirmations and verifies cursor identity against the chain head to fail closed on reorganisation. Results are explicitly labeled **UNVERIFIED_CANDIDATES_ONLY** and cannot mint profile wins; each must separately pass `verifyArenaProfileRecord` before being attributed to a player. It does not yet store or revalidate a wallet's full history across sessions.

[Focused unit + live Sepolia workflow](https://github.com/Iniwura/Gambit/actions/runs/44924064176) passed **17/17** tests, scanned seven bounded pages on actual Sepolia, located the unique Duel #1 finalization, checked the matching receipt and confirmed defender one win/challenger one loss, with zero wallet actions. Public RPC provides read-only evidence, not a full independent light-client security guarantee.

Building a production history still requires durable indexing, efficient batch verification, honest partial-history behavior and opt-in account/identity handling.

Planned record identity:
```text
(chainId, approvedContractAddress, duelId)
→ exact finalization transaction + block hash + player roles + aggregated points
```

The `DuelFinalized` event indexes duel ID, not the participants. To build a wallet's history, the indexer must discover candidate events from an approved deployment block, then read identities from the canonical contract. Avoid scanning every historical log on every page load.

**Operational requirements before implementation:**
1. **Partially implemented:** a versioned cursor with last-scanned block/hash, pinned deployment, bounded max 1,800-block pages (450-block RPC subwindows) and explicit partial/complete status. **Not built:** durable cursor storage, request backoff and production rate-limit/error UX.
2. Only events from the immutable allowlist and canonical successful receipts count. Verify against live squad/duel statuses.
3. At least 12 confirmations; do not show recent unconfirmed records as victories.
4. On startup/resume/reorg, reconcile the cursor and stored block hashes. Roll back orphaned provisional records and revalidate before restoring a player win.
5. A verified record is identified by chain+contract+duelId. Exact repeated evidence deduplicates, contradictory transaction or block hash fails closed.
6. Wallet/privacy opt-in determines what identity or history is displayed. Public blockchain events are public, but the interface must not silently broadcast wallet/profile associations or submit analytics containing private plans.
7. Never store FHE input proof, plaintext tactical orders, secret recovery material, wallet keys or opponent private plans in profile history.

A trusted provider is an assumption. Do not describe a single public RPC node as an independently audited full Ethereum light client.

## 5. Commander state and UI contracts (read-only greybox implemented; full profile not shipped)

```text
NO_WALLET_SELECTED
  → PUBLIC_SPECTATOR (read-only verified matches allowed, no identity)
  → OPT_IN_PLAYER_WALLET (connect/consent; no signing for reading)
  → LOADING_PUBLIC_HISTORY
  → EMPTY_VERIFIED / VERIFIED_HISTORY / PARTIAL_HISTORY / RETRYABLE_RPC_ERROR
  → REFRESHING_ON_RECONNECT
  → VERIFIED_HISTORY or SUSPECT_REORG / UNVERIFIED
```

- Only derived authentic wins/losses/draws may be displayed with a `VERIFIED` label. Research mocks, local Training and future BLACKSITE practice are separate, clearly labeled counters.
- Start with no nickname, no trophy and no fabricated prior players. Players can opt to link a wallet and display a chosen name later.
- Achievements must be deterministic over verified immutable records with rule version hashes, no badges on an unauthenticated local event.
- Accessibility, small-screen history navigation, empty state, keyboard and retry behavior must be browser-tested before feature flag activation.
- Anonymity is not guaranteed simply because a wallet is pseudonymous. Public matches already reveal participants; make the profile visibility decision explicit.

## 6. Fail-closed acceptance matrix

| Incident | Required behaviour |
| --- | --- |
| Caller provides arbitrary contract/hash that self-match | **REJECT** before history derivation |
| A simulated record is copied to JSON or rebranded | **REJECT** as a ranked result |
| Contract address approved but runtime hash differs | **REJECT** |
| Finalization tx missing/reverted, event absent/duplicate | **REJECT** |
| Event score inconsistent with calldata/current contract state | **REJECT** |
| One-use squad linkage or challenger identity is inconsistent | **REJECT** |
| Pinned canonical head changes during verification | **REJECT**, retry read-only later |
| Record has fewer than 12 confirmations | **REJECT** |
| Same duel is returned twice with the same tx/block hash | **COUNT ONCE** |
| Same duel ID has a conflicting tx/block hash | **REJECT** |
| Unrelated wallet claims someone else's victory | **REJECT** |
| User disconnects, RPC unavailable | Show recoverable/partial state; **do not fabricate a win or request a signing retry** |

### Implemented functional opt-in public record viewer

[`src/profile/public-history.mjs`](../src/profile/public-history.mjs) now implements the bounded opt-in wallet history loader on the **approved contract only**. All discovered events are rechecked independently as trusted finalization records before attribution, with honest `COMPLETE_RPC_SCAN` / `PARTIAL_RPC_SCAN` status; cancellation stops further history progress. [`src/profile/greybox.ts`](../src/profile/greybox.ts) mounts the actual non-signing, non-persistent input/results/empty/error dialog over the existing game with responsive desktop/mobile launchers. It clears addresses on close and preserves Arena state. [Acceptance contract](PROFILE_GREYBOX_ACCEPTANCE.md) records precise feature and privacy gates.

**Positive real-chain evidence:** [run 44927551505](https://github.com/Iniwura/Gambit/actions/runs/44927551505) passed 23/23 focused tests and performed an eight-page real Sepolia scan, finding one genuine signed Duel #1 defender win and no synthetic other records. **The browser E2E gate must pass before release claims of a verified player-facing experience.**

Full durable Profile identity, cross-session history, achievements and progression remain unbuilt.

**Exit gate for full Commander Profile:** complete opt-in identity model, robust multi-record indexing and persistent reconciliation with reorg tests, honest empty UI, responsive interaction QA, consent and privacy review, and repeatable verified real matches. The backend authenticity baseline alone does not satisfy that gate.

**Next:** implement durable, opt-in indexed history and efficient revalidation on reconnect/reorg, with a functional Profile greybox. Candidate discovery and one real verified record alone **do not** authorize claiming a complete Profile.
