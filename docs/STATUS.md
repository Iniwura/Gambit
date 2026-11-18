# GAMBIT — verified engineering status

Updated 2026-11-18. Work is on **draft PR #5** (`build/verified-first-slice`), not merged to main.

## Verified by real GitHub CI

Run: https://github.com/Iniwura/Gambit/actions/runs/44357755768

- **Phaser web:** dependency install, TypeScript typecheck and Vite production build pass.
- **Real Chromium browser:** complete 5-round local-practice match, result and rematch on 1440×900 desktop AND 390×844 mobile; browser harness detected no page errors. Screenshot artifacts available on workflow run.
- **Reference engine:** deterministic rules and arena checks pass.
- **FHEVM:** eight Solidity files compile successfully, **nine Hardhat mock tests pass**, including encrypted outcomes, tamper rejection, repeated sealed-defense matches without owner re-signing, finalization, expiry and interrupted-proof recovery.
- **Security:** the Sepolia Hardhat config no longer uses the public default dev mnemonic, and deployment requires an explicitly configured funded signer.
- **Client:** maintained `@zama-fhe/sdk` v3.8 adapter typechecks and is mounted conditionally only after actual `VITE_GAMBIT_CONTRACT_ADDRESS` is configured. No fake chain receipts.

## Actual Vercel state
- `gambit-arena` project on the owner's Vercel hobby team.
- Protected build reached READY using feature branch source; this is a **practice/game-engine preview**, not official release or onchain verification.

## Still UNVERIFIED / blockers
1. **No real Sepolia contract deployment or signed testnet confrontation.** Required funded Sepolia signer and explicit signing approval, then two-wallet end-to-end transaction evidence.
2. Current three role sprites are still mostly decorative; fight logic resembles a simple 3-action duel. A genuine differentiated 3v3 rules layer is required to meet first-place ambition.
3. Original approved character art and detailed station binaries have **not** been imported into the remote production branch; current Phaser scene uses temporary vector stand-ins. Graphics stay frozen until core onchain works.
4. Persistent secrets have low entropy (27 possible policies); repeated public win/loss queries may infer defender behavior. Must treat as a gameplay/security-design risk and improve policy richness and adversarial balance before release.
5. Wallet UI has been typechecked but not exercised with an actual funded wallet or deployed contract. Browser tests cover **practice** only.

## Gate decision

- **Local game and mock crypto:** PASS.
- **Actual Zama Sepolia game:** NO-GO pending funded transaction + proof.
- **First-place-quality release:** NO-GO until advanced squad gameplay, real FHE end-to-end, genuine player testing and final art integration.

**No fabricated transactions, misleading gameplay screenshot, or unverified 10/10 claims.**
