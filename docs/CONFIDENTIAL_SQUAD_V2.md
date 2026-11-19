# GAMBIT FHE 3-role candidate — research only

## Compatibility boundary

- **Deployed:** `SealedGambit` at `0x12adc9f3860FB20E9655197386CDFc1DD78FF0c0` on Sepolia. One plan per side, current browser preview.
- **Undeployed candidate:** `fhe/contracts/SquadGambit.sol`. Three conditional plans per squad, one per Scout/Guardian/Striker, accepting a single Zama input proof for nine encrypted `euint8` values per party.
- **No new signing, no Sepolia deployment, no web wallet config change.**

## Rules parity

Scout, Guardian and Striker each resolve their own conditional (base, trigger, response) against the corresponding opposing role. Independent base wins score one. Striker bonus +1 for a win, Scout bonus +1 if both Scout and Striker win, and an opposing Guardian lane victory subtracts one Striker bonus. The only decrypted public output is an aggregate 3-bit per-team packed score `8 * pointsA + pointsB`, values 0 to 45. It does NOT publicly reveal individual role results or encrypted strategies.

A mock reference test should establish identical scores against `src/squad.mjs` and reject tampered KMS plaintext/proofs.

## Privacy and abuse model

- The defending player specifies a **single invited challenger address** when sealing. A sealed policy is consumed by one challenge, including if the challenge expires. This prevents arbitrary strangers from asking unlimited result-oracle questions against one policy and rejects sender substitution.
- It does NOT prevent players from comparing separate defender squads, Sybil collusion, or information leakage through aggregate scores. Formal strategy confidentiality is not proven.
- The defender must be able to invite and hand off a specific opponent; matchmaking is a later problem.
- Unsubmitted challenges expire in one day and cannot be renewed on the same policy. The invitee can deliberately grief by opening and refusing to submit; a future anti-grief policy should address that.
- Public decryption is limited to one packed score ciphertext. The contract stores only encrypted tactics. The public signed proof is checked against the result handle recorded during `resolveDuel`.

## Ship gates

1. Hardhat compiles and FHE mock tests pass.
2. Benchmark code size, gas, input proof size and actual Sepolia relayer compatibility before any deployment.
3. Validate a real nine-value SDK input and KMS proof in a read-only/simulated environment. Require a separate explicit testnet deployment approval.
4. Browser strategy UI, selected opponent invitation, stage recovery and proof verification must use `SquadGambit` ABI, not the currently deployed one-plan ABI.
5. Public privacy and fairness review, repeated-query stress tests, user playtests and accessibility review before production claims.

**Verdict at authoring:** candidate, not deployed or verified live. The current 3v3 game is local-only.
