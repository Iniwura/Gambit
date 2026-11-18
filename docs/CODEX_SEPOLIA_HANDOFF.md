# GAMBIT — Local Codex Sepolia wallet handoff

**Purpose:** Take the already tested GAMBIT `build/verified-first-slice` branch through wallet-readiness inspection to a **user-approved** first onchain deployment. Work autonomously until the exact signing gate. Do not ask for guidance for routine coding, dependency installs or debugging.

## Environment and scope

- Run in the **user's existing Ubuntu/WSL local CLI**, where Hardhat variables from prior Sepolia development may already exist. Do **not** use Codex Cloud: the cloud runner does not have the user's local wallet or encrypted keystore.
- Repo: `https://github.com/Iniwura/Gambit`. Clone to `~/gambit` if absent; otherwise fetch safely. Work on `build/verified-first-slice`; do not force-reset, discard local changes, or edit another repository.
- Existing prior wallet work may be under `~/veil/veil`, but do not read wallet files, print secrets or modify that project. Hardhat vars might be scoped to this Ubuntu installation; verify only the **presence** of needed variable names, never their values.
- This is **Ethereum Sepolia chain 11155111 only**. Never attempt deployment on Ethereum mainnet, Arc, Robinhood or another chain.
- Read `AGENTS.md`, `docs/PRODUCTION_PLAN.md`, `docs/STATUS.md` and `fhe/README.md`.

## Strict secret and signing rules

1. Never view, retrieve, cat, echo, print, log, upload, commit, or send the mnemonic, seed phrase, private key, .env contents, encrypted keystore contents or RPC credentials to an LLM or GitHub. Do not call `hardhat vars get MNEMONIC` or parse secret files. Use `hardhat vars list` only for variable *names*, or `vars.has('MNEMONIC')` to test presence without output.
2. Do not create new wallets, switch to a different wallet, move funds, sweep balances, or request real ETH. Do not use any previously funded **mainnet** wallet without the owner explicitly choosing it.
3. Never use `--yolo`, `--dangerously-bypass-approvals-and-sandbox`, unsafe file permissions, cloud secrets, or commits to capture the wallet.
4. A signer may be used **only through the legitimate local Hardhat provider/keystore** inside a transaction script. Keep key-handling in the local wallet/CLI, not in the Codex prompt or transcript. The agent should inspect public address and onchain balance only.
5. **Stop immediately BEFORE the first signed transaction**, present the public deployer address, Sepolia chain ID, available Sepolia test ETH, source commit, contract bytecode fingerprint, estimated gas (in Sepolia ETH) and the exact deploy command. Request the user's explicit approval in the local Codex session. Do not broadcast until approved.
6. Once approved for one testnet deployment, deploy only `SealedGambit`. Validate the transaction receipt, chain ID, bytecode at address, explorer URL, and save public manifest. Never invent receipt or pass status.

## Execution plan

1. Verify repository, branch, clean worktree, source and CI state. The last known green GitHub Actions run includes game/browser and FHE mock tests; rerun locally rather than assuming.
2. Check tool versions, then `cd fhe`, install dependencies, run typecheck, compile and FHE mock tests. In project root install and run the reference rules, game typecheck and production build. Fix any real failures on a new feature commit.
3. Inspect Hardhat variable **names only** in the local CLI, especially `MNEMONIC`, `SEPOLIA_RPC_URL`, and `INFURA_API_KEY`, and check Sepolia RPC connectivity without exposing endpoints containing credentials.
4. Use `fhe/scripts/deploy-sepolia.ts` to confirm network and deployer account after reviewing it. Run the committed **read-only** command `cd fhe && npm run check:sepolia` (implemented in `fhe/scripts/check-signer.ts`), which prints only `chainId`, `network name`, `public address`, `Sepolia test ETH balance` and `ready/not-ready`, plus a Sepolia deployment gas estimate; never print mnemonic or provider URL. Check that the address controls Sepolia test ETH.
5. Calculate estimated deployment gas/cost for the exact compiled contract without broadcasting. Compare contract SHA/ABI with `fhe/artifacts/contracts/SealedGambit.sol/SealedGambit.json`. Confirm no unlinked libraries. Verify `SealedGambit` source matches the remote branch.
6. **Stop at the signing gate** with a minimal summary the user can approve. If signer is missing, explain the exact local command needed to set Hardhat vars via its private interactive prompt; do not expose the value to Codex or chat. If test ETH is missing, provide the public address and Sepolia faucet instructions.
7. After an explicit local approval, run one testnet deployment, validate the receipt and manifest, commit only public deployment metadata, and prepare the separate client integration. A second distinct wallet and real encrypted challenge remain follow-up gates.
8. Run GitHub CI/review and report exact success/failure evidence; do not merge an unverified draft or claim the game is production-ready.

## Current known state

- Repo branch `build/verified-first-slice`, draft PR https://github.com/Iniwura/Gambit/pull/5.
- Browser practice and Hardhat mock contract checks passed; **no live Sepolia deployment was verified yet**.
- Sealed strategy architecture is experimental. Low-entropy policies need privacy and inference-risk mitigation before public gameplay.
- Existing prepared scripts: `fhe/scripts/deploy-sepolia.ts`, `fhe/contracts/SealedGambit.sol`; user-signed alternative: `/deploy.html` on protected Vercel preview.

**A successful wallet check is not a deployed contract. A successful deployment is not a working two-player encrypted match. Keep each gate distinct.**
