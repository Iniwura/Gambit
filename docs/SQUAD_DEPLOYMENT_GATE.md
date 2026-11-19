# GAMBIT — SquadGambit v2 Deployment and Live-Proof Gate

**Status: BLOCKED ON LIVE DEPLOYMENT AUTHORIZATION.** This document is an implementation and verification guide. It does not authorize spending testnet ETH, deploying, signing, or using a private key.

## Immutable compatibility boundary

- **Current live Sepolia v1:** `SealedGambit`, `0x12adc9f3860FB20E9655197386CDFc1DD78FF0c0`, *one* tactic per player, deployed but no two-wallet finalized match verified.
- **New v2:** `SquadGambit`, **UNDEPLOYED**, accepts ten encrypted `euint8` inputs per side (nine per-fighter action values + encrypted formation).
- There is deliberately **no** fallback from v2 to v1, and the v2 wallet panel remains absent unless *both* `VITE_GAMBIT_SQUAD_CONTRACT_ADDRESS` and `VITE_GAMBIT_SQUAD_RUNTIME_HASH` are populated with values from a real v2 deployment.
- Only the public packed score (`8*challengerPoints + defenderPoints`) gets a KMS-signed public decryption. Individual lanes and hidden formations must not be reconstructed for an onchain replay.

## Autonomous verification (no user wallet required)

- `node --test tests/*.test.mjs` validates squad-input encoding, stages, role matchups, score decoding, replay and bad actor/wrong-address states.
- `npm run build` compiles the v2 FHE candidate and checks that every ABI input, output and event used by `src/chain/squad-sepolia.ts` matches actual Solidity artifacts.
- `cd fhe && npm test` runs mock FHE one-use invitations, encrypted formation parity, wrong-final-score / bad-proof rejection and cross-duel KMS proof replay.
- Playwright separately checks that **the v2 UI is hidden by default**, and that synthetic bad-network/no-wallet cases never sign or claim to be verified.
- Hardhat test prints `GAMBIT_FHE_LOCAL_MOCK_METRICS` (creation, seal, open, submit, resolve, finalize EVM gas). **These are NOT HCU numbers and do NOT predict actual Sepolia total fees, settlement duration or throughput.**

## Read-only Sepolia gas preflight

Use the secured workspace with the owner's existing signer; the repo contains **no** private keys or mnemonic. Command:

```bash
cd fhe
npm run check:squad:sepolia
```

The script checks chain 11155111, the public signer, the wallet balance and a fresh unsigned deployment gas estimate. **Default execution does not transmit a transaction.** No signing is authorized by running preflight.

## Required separate approval for one actual v2 contract deployment

Only after the user explicitly approves the public deployment signer and a **maximum Sepolia test ETH fee**, the operator may set the deliberately strict one-use environment controls:

```bash
GAMBIT_APPROVE_SQUAD_DEPLOY=YES_SEPOLIA_SQUAD_DEPLOY_ONCE
GAMBIT_EXPECTED_SQUAD_DEPLOYER=<PUBLIC_ADDRESS_APPROVED_BY_OWNER>
GAMBIT_MAX_SQUAD_DEPLOY_FEE_WEI=<EXPLICIT_WEI_BUDGET_APPROVED_BY_OWNER>
npm run deploy:squad:sepolia
```

The deployment script refuses mainnet, a wrong signer, missing/malformed approval values, an insufficient balance and quotes above the explicit approved budget or hard 0.002 Sepolia ETH emergency ceiling. It rechecks quoted fee parameters immediately before signing and pins them into the transaction. This is **not** prior permission to deploy.

After an authorized successful transaction, save the emitted `deployments/sepolia-squad.json` artifact with explorer proof, deployed runtime bytes and `runtimeKeccak256`. Do not commit wallet credentials. Set the new Vercel v2 address and hash **only after checking them against Sepolia chain state**, then verify the browser panel loads.

## Final live proof (additional signed actions)

1. Defender signs and encrypts one squad, specifying an entirely different invited challenger address; verify `SquadSealed`, contract status and ten-value proof.
2. Challenger signs `openDuel`. The contract permanently consumes the sealed policy. Recovery uses `duelForSquad(squadId)` and immutable `openedAt` (expiry one day if unsubmitted).
3. Challenger signs `submitDuel` with its own ten encrypted values. Account and chain are rechecked before signing.
4. An operator authorizes `resolveDuel`. Check `DuelReady` handle equals the canonical `publicResultHandle`.
5. Public SDK decryption obtains a signed KMS proof. An authorized signer calls `finalizeDuel`, the contract rejects incorrect/replayed proofs, and the final `DuelFinalized` event, stored packed score and returned public score all agree.
6. Reload between each stage and verify recovery without duplicate writes. Show **aggregate-only** result animation in the Phaser scene after onchain verification.
7. Publish a verifiable record of exact transaction hashes, addresses, blocks, gas used, decryption proof verification and **measured HCU/latency** when obtainable, without private strategies.

## Outstanding release blockers

- No v2 deployed contract address / runtime hash exists yet.
- No real two-wallet nine-orders-plus-formation encrypted submission has been observed.
- Live HCU usage, gas, SDK proof size and latency are unmeasured; local mock gas is not a substitute.
- Single-use invites can be griefed by an invited player who never submits; this remains an acknowledged tradeoff.
- No independent privacy audit, original production art / sound or external beginner playtest has passed.

**Verdict: KEEP DRAFT.** Do not present the 3v3 game as live encrypted multiplayer or a production-ready winner until these gates have evidence.
