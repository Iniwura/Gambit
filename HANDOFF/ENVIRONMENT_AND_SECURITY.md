# Environment setup and transaction security

## Clone
git clone https://github.com/Iniwura/Gambit.git
cd Gambit
git checkout build/verified-first-slice
git pull --ff-only
git status --short --branch

Read AGENTS.md and handoff before package installation or scripts.

## Web build
Node.js >=22. Use committed lockfile:
npm ci
npm run typecheck
npm test
npm run build
npm run dev

Vite prints local URL. Open in modern browser. Serve static artifacts over HTTP; do not open index.html via file://.

## Contract project
Hardhat/FHE project is under fhe/. Read fhe/package.json, lockfile, workflows and scripts. Use exact pinned commands/compiler. Never run deployment scripts as tests. Distinguish local mock tests, read-only RPC, preflight simulations and write/deployment scripts.

## Secrets
Never commit .env, mnemonic, seed phrase, private key, wallet export, API token, RPC credential, browser profile or signed transaction payload. Do not paste secrets into ChatGPT/Codex, logs or shell history. Keep owner-controlled signing environment separate from code-review/build environment. Use public read-only RPCs where possible. No wallet action or chain write is authorized by this handoff.

## Exact approval
Before any write, show exact chain, contract, function, parameters, sender, value, max fee, nonce/replay guard and purpose. Obtain explicit owner approval for that action. Never infer approval from old transactions. Never retry ambiguous dispatch automatically. Preserve unknown/pending state until canonical two-provider reconciliation. No deployment, new match/mission transaction or gas spend is part of this handoff.

## Windows/WSL
Earlier work used Windows + WSL and an isolated LF worktree because CRLF conversion changed Solidity metadata hashes. .gitattributes is committed; respect line endings. Old worktree paths are machine-specific. Former WSL environment used Hardhat variables; do not recover/copy mnemonic values. Recreate only non-secret tooling; owner enters credentials locally if an approved action requires them.

Prior static artifact: Actions run 45985715085, artifact 15190988268. Default signing disabled. Inspect contents before assuming structure. Repository branch remains source of truth.
