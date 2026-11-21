# GAMBIT 3v3 FHE audit

Updated 2026-11-20 after the `EncryptedGambit3v3` implementation and local
Hardhat mock verification.

## Verified implementation

- `EncryptedGambit3v3` accepts three encrypted tactics per player.
- Each lane resolves from the two original encrypted base actions; no private
  tactic or lane result is exposed.
- Only the aggregate squad outcome is marked publicly decryptable.
- Finalization accepts only a KMS public-decryption proof checked against the
  stored outcome handle.
- Participant checks, one-commit-per-player, replay protection, expiry, proof
  rejection, handle recovery, and finalized-state checks are covered by tests.
- The browser adapter uses `@zama-fhe/sdk` 3.8.0 `encrypt` and
  `decryptPublicValues`, not the retired Relayer SDK API.

## HCU feasibility

The official Zama HCU guide lists a current devnet global limit of 20,000,000
HCU and a sequential depth limit of 5,000,000 HCU. Using the published scalar
operation costs, a conservative hand estimate for this fixed three-lane
`resolve` path is approximately 3.3M HCU, below both published ceilings. The
three-lane commitment normalization is approximately 1.1M HCU per player.

These are design estimates, not a live coprocessor HCU measurement. A real
Sepolia 3v3 deployment and two-wallet match remain required to validate actual
HCU scheduling, relayer latency, calldata size, and confirmation behavior.

## Remaining blockers

1. The new contract has not been deployed; the existing Sepolia address is the
   previously deployed `SealedGambit` contract and must not be presented as
   3v3.
2. The current Phaser practice renderer still presents a five-round local
   practice loop and is not yet driven by the new 3v3 onchain state machine.
3. Browser E2E with two real wallets, public decryption latency, and finalizer
   recovery cannot be claimed without an explicitly approved future deployment
   and two-wallet test.
4. The current production build has large encrypted-worker/game chunks and
   emits a non-fatal Rollup annotation warning; code splitting and asset
   budgeting remain polish work.
