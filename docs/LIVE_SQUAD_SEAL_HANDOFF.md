# GAMBIT — live SquadGambit v2 encrypted input acceptance

Updated 2026-11-20. **Status: SCRIPT IMPLEMENTED; LIVE SEAL NOT EXECUTED IN THIS HANDOFF.** This replaces the old v1 policy-seal handoff as the next functional integration target. Do not infer blockchain success from a TypeScript build or local FHE mocks.

## Verified baseline and target

- Ethereum Sepolia chain ID `11155111`.
- **v2 3v3 `SquadGambit`**: `0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134`.
- Expected existing local signer (public): `0x7d567Fa1d5fe35737BbF045f47667e13298Ee176`.
- Exact runtime hash pinned by `fhe/deployments/sepolia-squad.json`.
- No live squad seal, second-wallet challenge, KMS decrypt or finalization is yet evidenced. Do **not** send the old three-input `seal:sepolia` command: that is for the different v1 `SealedGambit` contract.

## Safe read-only preflight

From the **existing trusted workspace containing the owner-configured Hardhat mnemonic**, without exporting keys to ChatGPT, CI, GitHub, terminal logs or third-party services:

```bash
cd fhe
npm ci
npm run typecheck
npm run compile
npm test
npm run seal:squad:sepolia
```

Without the explicit opt-in environment flag, this last command reads chain ID, deployed runtime hash, current squad/duel counters and the configured public signer. It **does not encrypt or send a transaction**. Record the reported `nextSquadId`.

## One bounded v2 signing attempt

Only with an owner-controlled, distinct real challenger public wallet address and the checked **exact next squad ID**:

```bash
cd fhe
GAMBIT_SQUAD_CHALLENGER_ADDRESS=0xYOUR_DISTINCT_CHALLENGER_ADDRESS \
GAMBIT_EXPECTED_SQUAD_SEAL_SIGNER=0x7d567Fa1d5fe35737BbF045f47667e13298Ee176 \
GAMBIT_MAX_SQUAD_SEAL_FEE_WEI=YOUR_FRESHLY_APPROVED_AMOUNT_IN_WEI \
GAMBIT_EXPECTED_NEXT_SQUAD_ID=1 \
GAMBIT_APPROVE_ONE_SQUAD_SEAL=YES_SEPOLIA_SQUAD_SEAL_ONCE \
npm run seal:squad:sepolia
```

Replace `1` with the **fresh preflight value**, never assume it. The challenger address cannot equal the deployed owner's wallet. This is a single opt-in transaction attempt; re-running may create another squad if the expected ID is updated, so do not retry after ambiguous network errors without checking chain state first.

The live Node SDK encrypts exactly ten **public synthetic** `euint8` values: three independent `(base, trigger, response)` fighter orders plus a formation. The script requires a **separately owner-approved public signer and explicit maximum fee in wei** for this seal; a hard-coded emergency ceiling alone is not an authorization. It checks the v2 bytecode, chain, account, challenger identity, expected ID, exact-ciphertext gas estimate and fresh fee quote. It refuses a maximum quoted fee above **0.0005 Sepolia ETH**, even with an approval flag, or insufficient sender balance. It rechecks network, signer, bytecode, current ID and a fresh fee quote immediately before the only signature.

An accepted receipt must contain `SquadSealed` for the exact owner, challenger and new squad ID. The script then checks `squadStatus` and counter increment, and saves a **public evidence-only** local JSON at `fhe/deployments/sepolia-squad-seal-proof.json`. Never commit keys, RPC secrets, raw Zama input proof or private tactics. No challenge is automatically opened.

## After the signed seal

Before claiming a playable match, run the separate **invited challenger** wallet through `openDuel`, encrypted ten-input `submitDuel`, `resolveDuel`, a genuine SDK signed public KMS decrypt and `finalizeDuel`. Preserve receipts and verify one-use, expiry, proof replay, wallet-switch and recovery. Follow [Issue #8](https://github.com/Iniwura/Gambit/issues/8) and [deployment gate](SQUAD_DEPLOYMENT_GATE.md).

## Authorization and current execution boundary

**The only transaction previously authorized was the one completed SquadGambit deployment. It does not authorize this seal or any other gameplay transaction.** Before setting the one-shot signing flag and the exact fee budget, obtain fresh explicit owner consent for the specified signer, challenger and maximum fee. No mainnet interactions are permitted. The GitHub-connected chat cannot access or operate the private Hardhat signer and **has not broadcast** this transaction. Execute only in the owner's already-authorized secure CLI workspace. Do not substitute a different wallet, import secrets to a chat, or fabricate success.

A failed encrypted-input SDK attempt or proof acceptance is a **P0 integration blocker**; record the failure stage without disclosing credentials and resolve it before investing in visual polish.
