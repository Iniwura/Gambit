# GAMBIT — Commander Public Records Greybox Acceptance

**Date:** 21 November 2026 · **Milestone:** opt-in functional public-record viewer  
**Not the finished Commander Profile. No graphics/audio phase has begun.**  
[Master scope](GAMBIT_MASTER_SCOPE.md) · [Permanent progress log](BUILD_LOG.md) · [Trust/reorg architecture](PROFILE_TRUST_AND_RECOVERY.md)

## Player workflow implemented

The current [functional greybox](../src/profile/greybox.ts) offers a separate **COMMANDER · PUBLIC RECORDS** entry on desktop and inside the mobile command deck. It is a *read-only public evidence viewer*, not a profile account, wallet connection, registered identity or achievement system.

1. Open the viewer; underlying Phaser Arena/game inputs become inert. The game shell permits `profile-readonly` but still refuses unfinished `commander-profile`.
2. The player **explicitly enters a public Ethereum address**. Opening the viewer does not perform a lookup, connect a wallet or track an identity.
3. Invalid addresses produce an immediate input error and **no RPC call**. Valid addresses trigger a progress-labelled Sepolia scan.
4. [`src/profile/public-history.mjs`](../src/profile/public-history.mjs) checks the approved immutable `SquadGambit` contract runtime even before reporting an empty result. It pages [bounded canonical event discovery](../src/profile/approved-event-discovery.mjs), then separately verifies **every candidate finalization** with the [trusted receipt verifier](../src/profile/verified-arena-record.mjs) before attributing it to the entered wallet.
5. The result has distinct `COMPLETE_RPC_SCAN` and `PARTIAL_RPC_SCAN` statuses. **Partial totals are lower bounds**, never presented as a complete season rank. Missing/untrusted RPC evidence never becomes an invented zero-win profile.
6. Browser history lists genuine finalized match scores and canonical transaction links only. No hidden fighter tactics, guesses, private formation or unverified opponent lanes are exposed.
7. Close or Escape restores the Arena state/focus, aborts follow-up processing and clears the entered address. Nothing is placed in localStorage or sent to a game server by GAMBIT. The public RPC still learns the queried data required to service the request.

## Security and honesty gates

| Risk | Required behavior |
| --- | --- |
| Fake deployment with matching self-reported bytecode hash | **REJECT** against immutable approved registry |
| Invalid public Ethereum address | **REJECT before RPC** |
| Untrusted event, unmined receipt, mismatched score/contract/duel | **REJECT; cannot mint a profile win** |
| Wrong chain or wrong approved runtime | **REJECT** even when no events returned |
| Mid-query chain reorg | **FAIL CLOSED** on canonical hash mismatch |
| Duplicate duel | **COUNT ONCE or reject contradictory proof**, not two wins |
| RPC incomplete / paginated | **PARTIAL**, never claim a full history |
| RPC unavailable, aborted, browser closes | No speculative score or invented empty record |
| Unapproved private data in DOM | Never render ciphertext, plan, input proof, secret code or wallet keys |
| Mobile layout | Must have visible nonoverlapping in-flow touch launcher; cannot hide Sepolia button |
| Modes overlapping | Cannot open read-only Profile over BLACKSITE or active wallet dialogue |
| Achievements/rank | **NOT IMPLEMENTED**, never implied by a single verified record |

## Evidence

**Focused real Sepolia contract tests: VERIFIED.** [Run 44927551505](https://github.com/Iniwura/Gambit/actions/runs/44927551505) passed **23/23 tests** and completed a positive actual Sepolia history lookup for the defender address: eight bounded pages, one independently verified Duel #1, one authentic defender victory, zero wallet actions/signatures. Includes malformed address, wrong chain, counterfeit contract/runtime, abort and partial-scan policy tests.

**Browser acceptance:** [`tests/profile-greybox-browser-check.mjs`](../tests/profile-greybox-browser-check.mjs) is wired to the four-job [full quality suite](https://github.com/Iniwura/Gambit/actions/workflows/validate.yml); it checks desktop/mobile launch, invalid input without fake records, clear/close, Escape, restored Arena state and zero browser exceptions. **Do not claim this gate passed until the run finishes.**

**Already independently proven baseline:** one genuine two-wallet `SquadGambit` FHE 3v3 encounter finalized on Sepolia with 0:1 Cyan/Violet score. This history viewer simply authenticates the public finalized result. It does not generate a new encrypted match.

## Not yet built

Durable cross-session history indexing/reorg subscription; consented name/handle and identity linking; player achievements, progression, match creation, private-vault mission results, season stats across verified multiple matches, social discovery or production graphics. The game and UI need human usability review before any release approval.

**Next gate:** complete desktop/mobile real-browser verification, handle actual feedback/failure states, then plan durable consented identity and genuine achievements based only on verified events. Maintain the architecture → functional response → QA → graphics order.
