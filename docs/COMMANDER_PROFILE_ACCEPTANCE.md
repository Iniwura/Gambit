# COMMANDER profile acceptance

Recorded 25 November 2026 on `build/verified-first-slice`.

## Verified implementation

`src/profile/arena-v3-history.mjs` is a bounded, read-only verifier pinned to the approved Arena v3 deployment, chain `11155111`, creation receipt and runtime fingerprint. It checks the canonical `MatchCreated`, every `RoundFinalized`, and `MatchCompleted` receipt/event, current public match state, confirmation depth, actor/contract/value/status and duplicate-free history. The scan is compared across PublicNode, ethPandaOps and Tenderly.

`src/profile/commander-profile.mjs` stores only a public call sign keyed by the lowercase wallet address. It rejects malformed identities, wrong-wallet identities, unapproved history and unbranded/local evidence. Progression is derived from verified receipts rather than local practice: wins, losses, draws, completed five-round matches, XP, level and Arena achievements. BLACKSITE progress is intentionally zero until a deployed mission receipt is independently approved.

## Live evidence

The read-only verifier authenticated Arena Match #1 on all three providers:

- approved contract `0xBF56087EFF029594beeFf1B57B47b1419bCDF16b`;
- runtime hash `0xf4f31fff6b4ec7f90e573bba95362a49d43ffeb12d971f515cef6301afbde8a9`;
- challenger `0xEa0C73e7a8D7149e641805e7Eb4eC0D4195C403C` and defender `0xC3e1CE842aDB49FC7B3e0fA5Cc6A0684fFd5D0c2`;
- five finalized rounds, cumulative `6:4`, complete and not abandoned;
- challenger profile: one match, one win, level 2, 150 XP, `ARENA_FIRST_MATCH`, `ARENA_FIVE_ROUND`, `ARENA_VICTORY`.

The browser profile regression passes desktop and mobile negative/consent/recovery checks. The positive live result is produced by the no-wallet three-provider verifier; the UI does not fabricate a wallet connection or public history.

## Release boundary

This completes the evidence-backed Arena portion of Commander. It does not claim a universal account backend, private-key custody, synthetic history, or BLACKSITE progression. The public identity is deliberately local and non-secret; authenticated history remains chain-derived and read-only.
