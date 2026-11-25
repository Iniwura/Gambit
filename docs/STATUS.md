# GAMBIT — verified engineering status

Updated 2026-11-25. Engineering work is in **draft PR #5** (`build/verified-first-slice`), not merged to main.

## Current verified snapshot - Arena v3 Match #1 and four-pillar progress

The approved Arena v3 deployment is preserved and unchanged: [`ArenaV3Research` at `0xBF56087EFF029594beeFf1B57B47b1419bCDF16b`](https://sepolia.etherscan.io/address/0xBF56087EFF029594beeFf1B57B47b1419bCDF16b), Ethereum Sepolia chain `11155111`, runtime hash `0xf4f31fff6b4ec7f90e573bba95362a49d43ffeb12d971f515cef6301afbde8a9`. No redeployment occurred in this build.

Arena Match #1 is complete and independently read-only verified through PublicNode, ethPandaOps and Tenderly. The canonical players were challenger `0xEa0C73e7a8D7149e641805e7Eb4eC0D4195C403C` and defender `0xC3e1CE842aDB49FC7B3e0fA5Cc6A0684fFd5D0c2`; creation transaction [`0x4d64c77325c1fbff9cef31383b59f141172cad5a5163623c0de1e044c1297a0c`](https://sepolia.etherscan.io/tx/0x4d64c77325c1fbff9cef31383b59f141172cad5a5163623c0de1e044c1297a0c). All five rounds finalized with scorelines `0:1`, `2:0`, `2:1`, `0:1`, `2:1`, cumulative `6:4`, `complete=true`, and `abandoned=false`. The complete receipt/fee table remains in [`docs/BUILD_LOG.md`](BUILD_LOG.md).

Commander now has a public persistent identity layer and an evidence-derived Arena v3 profile. The read-only verifier rejects unapproved deployments and unbranded/local evidence, independently authenticates the five-round history, and derives level 2, 150 XP, and `ARENA_FIRST_MATCH`, `ARENA_FIVE_ROUND`, and `ARENA_VICTORY` for the challenger. BLACKSITE progress remains zero until a separately approved deployed mission receipt exists.

BLACKSITE now has an isolated `BlacksiteMission` FHE candidate with encrypted vault code, encrypted guesses and approaches, hidden feedback handles, authenticated KMS finalization, route tradeoffs, heat, score, expiry and five-attempt limits. Hardhat mock tests cover genuine strategies, tamper/replay/authorization failures and all 24 code permutations. It is **not deployed**, has no live mission receipts, and has generated no transactions. The local greybox remains the only player-facing BLACKSITE mode.

Measured live Arena v3 Match #1 latency is preserved in the build log: challenger encryption average 89,515 ms, defender encryption average 85,252 ms, resolution review average 7,188 ms, and KMS finalization average 22,703 ms. The online lobby now reuses an SDK session across compatible rounds while retaining fresh state, fee and calldata review for each write. New live encryption measurements require a separately authorized match because Match #1 is complete.

Graphics remain frozen pending functional acceptance. No unauthorized blockchain transaction, deployment, retry, or secret material was introduced by the current work.

## First real encrypted 3v3 duel — COMPLETED on Sepolia

- **Contract deployed:** `SquadGambit` at [`0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134`](https://sepolia.etherscan.io/address/0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134) on Ethereum Sepolia (chain `11155111`). [Deployment tx](https://sepolia.etherscan.io/tx/0x058a2e70401e5cd685895c4ef1cc6ee86d9aeaa8ad93f30fb39832d58f3da00a) succeeded in block 12174655. Runtime 10,183 bytes; pinned keccak `0x94754bf634ba275b7a2f047483854553cbdfad51b15209477b467220b576f419`.
- **Defender sealed Squad #1:** [`sealSquad` tx](https://sepolia.etherscan.io/tx/0x65b1fde92ff899718f4febcdc1597cc9fb05c681b1e05996f306d2a3bae41e0b), block 12181816; exact owner, invited challenger, receipt and event are independently checked by `scripts/verify-first-squad-seal-readonly.mjs`.
- **Challenger opened Duel #1:** [`openDuel(1)` tx](https://sepolia.etherscan.io/tx/0x632c8eca45b6c4881112ee11516252d20a85cef4fa0507a981766e1c4b4548fe), block 12182024; canonical event, sender and state verified by `scripts/recover-first-duel-readonly.mjs`.
- **Challenger submitted Duel #1 — independently confirmed:** [`submitDuel(1)` tx](https://sepolia.etherscan.io/tx/0x00562be6f918e33a5781ce9c2ff9bcb4516d4c5e6d5a8cb25e485a17ddf2a8d4), block **12182287**, receipt SUCCESS; exactly 10 encrypted handles + nonempty input proof, real `DuelSubmitted(1)` event and canonical stored state, no duplicate event. Actual fee **54,786,128 wei**, gas **3,424,133**, under the separately authorized 500,000,000 wei cap. Independently verified by [this read-only workflow](https://github.com/Iniwura/Gambit/actions/runs/44911934524); four evidence-failure tests passed. This closes the original missing Rabby submission gate. Do not submit again.
- **Duel #1 challenger submission deadline:** 22 November 2026, 13:07:48 UTC (14:07:48 Lagos). This 24-hour *duel* expiry is distinct from the official Zama submission deadline (14 December 2026).
- **Live unsigned challenger quote passed:** [workflow](https://github.com/Iniwura/Gambit/actions/runs/44909988544) encrypted ten synthetic inputs with the official SDK, estimated exactly 4,142,942 gas and a buffered maximum quote of 159,088,992 wei as of block 12182183, under the separate 500,000,000 wei transaction ceiling. It used a `VoidSigner`; no wallet, private plan, signature or broadcast. This does not prove real Rabby signing.
- **Browser pre-sign integration had passed prior to real signing:** [dedicated Chromium job](https://github.com/Iniwura/Gambit/actions/runs/44910136360) exercised the synthetic 10-input SDK path with every send intercepted; separate [invitation UI test](https://github.com/Iniwura/Gambit/actions/runs/44911048646) confirmed Intro → balanced squad → one blocked wallet request. **The actual human-signed encrypted submission is now verified above**; the earlier Rabby missing-popup gate is closed.
- **Resolution now independently confirmed:** [`resolveDuel(1)` tx](https://sepolia.etherscan.io/tx/0xe91ba8ba3af4ce9666871752974b5b2168f4ccac4a6a8157df93d27fe79696ac), block **12182385**, gas 3,059,375, actual fee **45,890,625 wei**. [Independent public verification](https://github.com/Iniwura/Gambit/actions/runs/44913900191) confirms the exact contract/runtime, invited challenger, `DuelReady(1)` event, one unique receipt, canonical public encrypted handle and `resolved=true,finalized=false`. Do not resolve again.
- **Zama public KMS proof confirmed before successful onchain finalization:** [KMS probe](https://github.com/Iniwura/Gambit/actions/runs/44913989691) received a publicly decryptable aggregate **challenger 0, defender 1**, authentic signed proof and passed `eth_call` simulation of `finalizeDuel(1)` with that proof. A newer [exact proof-dependent gas quote](https://github.com/Iniwura/Gambit/actions/runs/44914121750) estimates 586,546 gas, buffers to 703,856, and quotes **21,115,680 wei** maximum at 30 wei/gas. Both preflight checks used VoidSigner and public RPC: no wallet signature or broadcast. The subsequent successful finalization receipt is documented below.
- **Finalization independently confirmed:** [`finalizeDuel(1)` tx](https://sepolia.etherscan.io/tx/0x57a19f25a234eca7db206781a18cc965a09818a04b87a9f30d8d659562a9bdad), block **12182444**, gas **483,782**, actual fee **7,740,512 wei**. The authentic `DuelFinalized(1)` event and canonical `duelStatus` confirm **finalized=true, packedScore=1, challenger=0, defender=1, outcome=2 (Violet wins)**. Public KMS proof exactly agrees; canonical runtime, sender, calldata and nonempty signed proof were checked. [Independent readonly receipt/event verifier](https://github.com/Iniwura/Gambit/actions/runs/44914775566). **No further transactions needed; do not finalize again.**
- **Browser post-finalization error investigated:** a real user saw `Finalized onchain score disagrees with signed KMS proof` after the wallet action. The chain disproves the mismatch: event, stored result and public KMS agree. The UI now performs safe independent read-only recovery when a post-receipt wallet read errs, and exposes a top-of-dialog **Recover verified match result · no wallet** control. [Real Chromium wallet-free result regression](https://github.com/Iniwura/Gambit/actions/runs/44914916209) displayed **0:1 Violet** and the authenticated reactor without signing or sending. This is a frontend recovery fix, not a chain correction.
- **Unsigned resolution fee preflight passed:** [read-only workflow](https://github.com/Iniwura/Gambit/actions/runs/44912017011) at block 12182299 quoted 3,084,819 gas, 3,701,783 buffered gas and 103,649,924 wei maximum fee. Live FHE HCU is not yet measured. The browser client now enforces a **new, independent 500,000,000 wei resolution safety ceiling**, checks state/runtime and fresh EIP-1559 fees before any wallet request, and never auto-retries or automatically finalizes. This is a software limit, **not user authorization**.
- **Full chain lifecycle now verified:** the seal, duel opening, encrypted challenger submission, encrypted computation, public KMS proof, and finalized score all have authentic independent Sepolia evidence. Live HCU (distinct from EVM gas) is **not separately metered**. Local/mock tests alone were not used to claim the result.

**Release verdict: LIVE FHE MATCH LIFECYCLE VERIFIED, PRODUCT REVIEW STILL DRAFT.** Duel #1 is final on Sepolia and independently inspectable. UI/UX, repeatability, security review, demo and official submission readiness require a separate release audit. No mainnet writes, invented proof, or additional wallet transactions.

The sections below are historical work-in-progress notes from before this v2 deployment. Where they describe `SquadGambit` as undeployed, the deployment record above supersedes them.

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

## Nov 19 — encrypted 3v3 integration staging (pre-alpha)

The compiled v2 contract now exposes `duelForSquad` for abandoned receipt recovery and `openedAt` in duel status. A separate ten-input browser wallet adapter verifies Sepolia, public account, deployed bytecode hash and signed final KMS proof. Its UI is **not mounted in current previews** because no real v2 contract/runtime fingerprint has been provided. Synthetic browser negative tests reject missing/wrong-network wallets. A read-only-by-default deployment handoff and explicit sign-off gate are documented in `docs/SQUAD_DEPLOYMENT_GATE.md`. Additional Hardhat mock cross-duel proof-replay tests and EVM-only local gas numbers are under CI review. A successful mock gas result cannot establish Sepolia HCU viability.
