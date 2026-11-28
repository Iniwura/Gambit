# BLACKSITE FHE mission acceptance

Recorded 25 November 2026 on `build/verified-first-slice`.

## Verified implementation

`fhe/contracts/BlacksiteMission.sol` is an isolated Arena-adjacent mission candidate. It does not change or redeploy the approved Arena v3 contract. A warden opens a mission with an encrypted four-glyph vault code. An operative submits an encrypted four-glyph guess and an encrypted approach:

- `STEALTH` exposes exact-count feedback only and adds no heat.
- `PROBE` exposes a packed exact/misplaced packet and adds one heat.
- `BREACH` exposes an exact-count packet and adds two heat; an exact four-glyph breach completes the mission.

The feedback remains an encrypted handle until `resolveAttempt` makes it publicly decryptable and `finalizeAttempt` authenticates the KMS proof. Public state exposes only the bounded attempt/heat/score/outcome state. The contract contains no plaintext vault or guess reader, enforces five attempts, rejects duplicate/stale/unauthorized actions and expires inactive missions.

## Evidence

`fhe/test/BlacksiteMission.ts` passes four Hardhat mock-FHE tests covering:

1. a genuine stealth/probe/breach strategic sequence, including route tradeoffs and final score;
2. forged/stale/duplicate/unauthorized action rejection;
3. five-attempt lockout and timeout behavior;
4. all 24 distinct four-glyph permutations through the encrypted breach path, with no plaintext code reads.

The focused output records `GAMBIT_BLACKSITE_FHE_MISSION` and `GAMBIT_BLACKSITE_CODESPACE_AUDIT` with `deployedToSepolia:false` and `walletTransactions:0`. The local player-facing greybox remains separately tested on desktop and mobile and is explicitly labeled local training, not encrypted mission evidence.

## Release boundary

This is a mechanically complete, locally verified protocol candidate, not a live BLACKSITE release. It still requires an approved deployment plan, independent compiled/runtime/HCU review, a separately authorized Sepolia deployment, real two-party mission receipts, KMS verification, adversarial live recovery testing and content/UX acceptance. No deployment or blockchain transaction was performed in this milestone. Until that gate is approved, Commander BLACKSITE progression remains zero.
