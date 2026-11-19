# GAMBIT — verified engineering status

Updated 2026-11-19. Engineering work is on **draft PR #5** (`build/verified-first-slice`), not merged to main.

## Independently verified Ethereum Sepolia deployment

- **SealedGambit address:** `0x12adc9f3860FB20E9655197386CDFc1DD78FF0c0`
- **Chain:** Ethereum Sepolia, chain ID `11155111`
- **Deployer:** `0x7d567Fa1d5fe35737BbF045f47667e13298Ee176`
- **Transaction:** `0x0d58f80bf197e705c5ef702e4d9de0f4d822813c6b19e31c711123de2c12a95b`
- **Block:** `12167782`; **receipt status:** success
- **Gas used:** `12452573`; **fee:** `236598887` wei (0.000000000236598887 Sepolia ETH)
- **Runtime code present:** 7700 bytes.
- **Compiled executable code:** all 7647 bytes match an independent Hardhat recompile. The 53-byte Solidity metadata trailer differs; the full runtime does **not** byte-for-byte match. Do not overclaim byte-for-byte identity.
- **Grounded deployment record:** [fhe/deployments/sepolia.json](../fhe/deployments/sepolia.json)
- **Explorer:** https://sepolia.etherscan.io/tx/0x0d58f80bf197e705c5ef702e4d9de0f4d822813c6b19e31c711123de2c12a95b

## Local tests and browser verification
- Phaser game, desktop/mobile local practice match and rematch passed real browser tests on the verified CI branch.
- Zama FHEVM Solidity compiled; 9 Hardhat mock contract tests passed, including sealed strategies, replay/tamper rejection and public decryption proof.
- Root TypeScript/Vite build and Hardhat typechecks were green before the new CLI seal script; the new script requires a **fresh** CI run to establish readiness.
- The Zama SDK browser adapter has passed static typecheck, not a real funded-wallet journey.

## Prepared for the first actual encrypted test

- [fhe/scripts/seal-policy-sepolia.ts](../fhe/scripts/seal-policy-sepolia.ts): one known synthetic policy `(base=0, trigger=1, response=2)` encrypted with the official Node SDK and sealed via the pre-existing wallet.
- **Requires fresh explicit approval:** `GAMBIT_APPROVE_ONE_SEAL=YES_SEPOLIA_TEST_ONLY` and the dedicated command `npm run seal:sepolia` from the `fhe` directory. No script runs automatically in CI.
- Strict Sepolia chain, owner, contract-code, estimated gas and 0.0005 Sepolia ETH maximum fee checks.
- Approval for the contract deployment does NOT authorize further testnet policy transactions.

## Critical outstanding gates

1. **First real encrypted seal:** not yet signed or confirmed. Its SDK runtime requires real Sepolia verification, not a mock-only claim.
2. **Second wallet and real challenge:** not yet completed. Need independent challenger funding/signatures; encrypted submit, compute, SDK/KMS signed public decrypt, onchain finalize, explorer evidence.
3. **Confidentiality caveat:** the test policy above is intentionally public; it proves encryption plumbing only, not player secrecy. The production policy space is low entropy and repeatable policy querying creates inference risk.
4. **Gameplay depth:** current sprites are mainly visual; 3v3 role differentiation and counterplay must be developed before first-place release.
5. **Original art and QA:** full approved art assets absent from the production repo, browser wallet not validated and beginner playtesting not complete.

**Quality verdict:** deployment gate PASSED. Actual encrypted game and first-place-quality release NOT YET VERIFIED. No fake receipts, no mainnet transactions, no unapproved signing.

## 19 November: challenge-recovery and verified-duel UI hardening

- Recovery controller is now driven by actual `challengeStatus` and recognizes `submit`, `resolve`, `finalize`, and `verified` stages. Unknown/expired challenges and wrong challenger accounts fail closed.
- Browser wallet address and Sepolia network are rechecked before transactions; changes require reconnecting. The client refuses an unexpected contract address or missing/mismatched deployed runtime length.
- The Phaser intro now labels its primary choice as a **combat move** (STRIKE/GUARD/FLANK), consistent with the FHE contract and deterministic reference engine; it was previously incorrectly labeled as a route.
- Only authenticated finalized onchain outcomes may enter the verified-duel renderer. No opponent's hidden choice is reconstructed; onchain UI is a **single duel**, not a claimed five-round match.
- `tests/chain-lifecycle.test.mjs` exercises the failure and recovery paths. The GitHub quality gates (rules, TypeScript + Vite build, Hardhat FHE tests, desktop/mobile browser practice) passed at `e20ea5ba`: https://github.com/Iniwura/Gambit/actions/runs/44518557488
- Preview build `e20ea5ba` was reported READY by Vercel; this does **not** demonstrate an actual browser wallet signature: https://gambit-arena-bc7jyc4wg-iniwura-akurus-projects.vercel.app

**Still P0:** No real Sepolia encrypted strategy seal has been authorized or executed; no second-wallet challenge, KMS-verified game receipt, or complete onchain round exists. The first test strategy is publicly known. Do not present the current game as fully confidential multiplayer or finished 3v3.

## Nov 19 — formation tactics research candidate

Local practice added **HOLD, PIVOT, FEINT** squad formations and role-versus-role matchups. The undeployed `SquadGambit.sol` candidate now takes ten encrypted `euint8` inputs per squad (nine tactics plus private formation), selects opponent ciphertext by encrypted relative deployment, and computes role-specific bonuses without decrypting either squad formation. This change does not modify `SealedGambit` or any deployed contract. Compilation, Hardhat mock tests, performance/HCU benchmarking and independent replay proof verification are required before this candidate can be treated as validated.
