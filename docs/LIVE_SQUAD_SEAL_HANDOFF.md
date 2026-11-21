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

For a read-only check of a *specific* invited challenger, set `GAMBIT_SQUAD_CHALLENGER_ADDRESS` in the trusted shell before running that last command. The preflight validates that the address is nonzero and different from the deployed owner; **it does not query either wallet balance**. Supply the user-chosen address at runtime; do not commit it as a project default.

Without the explicit opt-in environment flag, this last command reads chain ID, deployed runtime hash, current squad/duel counters and the configured public signer, plus an optionally provided challenger address. It **does not encrypt or send a transaction**. Record the reported `nextSquadId`. An address alone does **not** establish that someone controls its signing key.

A genuine seal fee estimate is only available after the official SDK creates the exact ten encrypted inputs and gas estimation succeeds; the existing 0.0005 Sepolia ETH hard ceiling is **not a live quote or a spending authorization**.

## New: unsigned exact-input quote, no wallet or balance check

To obtain a **read-only, real-encrypted-input** `sealSquad` fee estimate before requesting transaction approval, use the separate `quote:squad:sepolia` script. In the original GAMBIT workspace, with Node 22+ and the `fhe` dependencies installed:

```bash
cd fhe
GAMBIT_SQUAD_CHALLENGER_ADDRESS=0xYOUR_DISTINCT_CHALLENGER_ADDRESS npm run quote:squad:sepolia
```

For PowerShell, set the equivalent environment variable in that terminal:

```powershell
cd fhe
$env:GAMBIT_SQUAD_CHALLENGER_ADDRESS = '0xYOUR_DISTINCT_CHALLENGER_ADDRESS'
npm run quote:squad:sepolia
```

The script uses an ethers `VoidSigner`, not the local mnemonic or wallet key. It checks the Sepolia chain ID and pinned v2 runtime, encrypts ten **known synthetic** values via the public Zama SDK, estimates `sealSquad` using a public `from` account, and reports gas plus a fresh indicative maximum fee and next squad ID. **It does not call `getBalance`, sign, send or save raw input proofs**. The user can fund their wallets independently. A quote can still fail if the RPC/relayer is unavailable.

**Important:** The output is *not* an authorization to spend. Real signing necessarily generates fresh ciphertexts, re-estimates gas and enforces the separately approved maximum fee. The signing script does **not** perform an explicit balance query; insufficient funds instead lead to a provider/network rejection. Never treat a successful quote as proof of funding. The script hard ceiling is 0.0005 Sepolia ETH but a smaller fee cap must be explicitly approved based on the fresh quote. If chain state changes or the estimated maximum exceeds the permitted cap, stop and request another quote. Do not set `GAMBIT_APPROVE_ONE_SQUAD_SEAL` during the quote stage.

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

The live Node SDK encrypts exactly ten **public synthetic** `euint8` values: three independent `(base, trigger, response)` fighter orders plus a formation. The script requires a **separately owner-approved public signer and explicit maximum fee in wei** for this seal; a hard-coded emergency ceiling alone is not an authorization. It checks the v2 bytecode, chain, account, challenger identity, expected ID, exact-ciphertext gas estimate and fresh fee quote. It refuses a maximum quoted fee above **0.0005 Sepolia ETH**, even with an approval flag, and refuses any quote exceeding the narrower user-approved cap. It does **not** read either wallet balance; the provider/network may reject an insufficient-funds attempt without creating a valid transaction. It rechecks network, signer, bytecode, current ID and a fresh fee quote immediately before the only signature.

An accepted receipt must contain `SquadSealed` for the exact owner, challenger and new squad ID. The script then checks `squadStatus` and counter increment, and saves a **public evidence-only** local JSON at `fhe/deployments/sepolia-squad-seal-proof.json`. Never commit keys, RPC secrets, raw Zama input proof or private tactics. No challenge is automatically opened.

## After the signed seal

Before claiming a playable match, run the separate **invited challenger** wallet through `openDuel`, encrypted ten-input `submitDuel`, `resolveDuel`, a genuine SDK signed public KMS decrypt and `finalizeDuel`. Preserve receipts and verify one-use, expiry, proof replay, wallet-switch and recovery. Follow [Issue #8](https://github.com/Iniwura/Gambit/issues/8) and [deployment gate](SQUAD_DEPLOYMENT_GATE.md).

## Authorization and current execution boundary

**The existing deployment permission alone does not authorize game transactions.** A later, separate explicit authorization can cover **only one specified** SquadGambit seal, with its exact sender, challenger, squad ID and fee cap; that approval cannot be reused for additional seals, challenger transactions, resolution or deployment. Confirm the permission in the current conversation before setting the one-shot signing flag. No mainnet interactions are permitted. The GitHub-connected chat cannot access or operate the private Hardhat signer and **has not broadcast** this transaction. Execute only in the owner's already-authorized secure CLI workspace. Do not substitute a different wallet, import secrets to a chat, or fabricate success.

A failed encrypted-input SDK attempt or proof acceptance is a **P0 integration blocker**; record the failure stage without disclosing credentials and resolve it before investing in visual polish.
