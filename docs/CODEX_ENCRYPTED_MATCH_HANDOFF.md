# GAMBIT — First live encrypted-policy gate (Codex CLI handoff)

## Verified baseline

- Branch: `build/verified-first-slice`; PR: https://github.com/Iniwura/Gambit/pull/5
- Ethereum Sepolia chain ID: `11155111`
- Authenticated wallet public address: `0x7d567Fa1d5fe35737BbF045f47667e13298Ee176`
- Deployed `SealedGambit`: `0x12adc9f3860FB20E9655197386CDFc1DD78FF0c0`
- Deployment transaction: https://sepolia.etherscan.io/tx/0x0d58f80bf197e705c5ef702e4d9de0f4d822813c6b19e31c711123de2c12a95b
- Successful deployment receipt verified independently. Executable runtime code matches independent Hardhat compilation; compiler metadata differs.
- This contract is experimental. The same public demo policy is known to anyone reading the code and must NOT be represented as a private production strategy.

## Exact goal

Prove **one real encrypted onchain policy seal** using the existing local Hardhat signer and maintained `@zama-fhe/sdk` Node transport. This is a NEW blockchain transaction, so the previous deployment approval does not apply.

## Autonomous preparation (no transaction)

1. Work only in the GAMBIT repository. Safely fetch and fast-forward `build/verified-first-slice`, never force reset user work.
2. Read `AGENTS.md`, `docs/STATUS.md`, `fhe/deployments/sepolia.json`.
3. From `fhe/`, install dependencies, typecheck, compile and run all Hardhat FHE mock tests.
4. Run `npm run check:sepolia` **without approval variables**. Verify chain, configured public signer, balance and fee estimate.
5. Run `npm run seal:sepolia` **without** the approval variable. The script must stop after read-only checks and print `transactionSent:false`. Do not print, retrieve, export, log, upload or commit wallet secrets.
6. Before any signing, explain the source branch/commit, contract address, test plan, potential gas cost, and require explicit user approval in the Codex conversation.
7. **STOP** if any validation fails or you lack an explicit new policy-seal approval. Do not use unsafe Codex flags to bypass this restriction.

## Only after an explicit human approval for one testnet policy seal

From the exact GAMBIT `fhe/` directory:
```bash
GAMBIT_APPROVE_ONE_SEAL=YES_SEPOLIA_TEST_ONLY npm run seal:sepolia
```

The script encrypts known synthetic values `base=0, trigger=1, response=2`, ensures the expected owner, verifies the deployed contract has runtime code, estimates exact input-proof gas, checks a **0.0005 Sepolia ETH maximum fee** and wallet balance, then authorizes **one single policy seal**. This is an onchain plumbing test, not proof of secrecy (the chosen test plan is already public in source).

## After confirmation

- Inspect transaction receipt, `PolicySealed` event, policy owner, `active=true` and incremented policy counter.
- Save only public evidence (`fhe/deployments/sepolia-seal-proof.json`), not raw encrypted inputs, mnemonics, proof credentials or RPC keys.
- Add only evidence-backed assertions to GitHub; do not claim private gameplay until an independent second wallet submits a challenge and the KMS-authenticated public result finalizes onchain.
- Stop again at the **distinct challenger wallet signature**. Do not reuse the defender account for the challenger (contract prohibits self-challenge), create new funded wallets without permission, or initiate more than one transaction under this sign-off.

## Prohibited shortcuts

No mainnet interactions, no simulated contract receipts, no made-up explorer URLs, no skipped contract bytecode checks, no overstatement of 3v3 functionality. Continue respecting the internal GAMBIT quality bar and mark anything unverified as open.
