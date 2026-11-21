# GAMBIT

**Sealed Orders. Real strategy. No exposed tactics.**

GAMBIT is a playable 3v3 squad-tactics game with a confidential, asynchronous head-to-head match powered by the **Zama Protocol** on Ethereum Sepolia. Three fighters each have a private conditional order. Each commander also selects a hidden formation. The contract computes a match without publishing either squad's tactics, and a Zama KMS-signed proof authenticates the **aggregate reactor score**.

**Master product plan:** [Full four-pillar game scope, roadmap and progress](docs/GAMBIT_MASTER_SCOPE.md) — ARENA, BLACKSITE, TRAINING and COMMANDER PROFILE. This governs what we're building beyond the first verified duel.

**Release status:** a genuine two-wallet encrypted match has been completed and independently verified on Sepolia. The game remains a **pre-release candidate** pending newcomer playtests, full product/visual polish and independent security review. We do not claim production readiness or a security audit.

[Play GAMBIT](https://iniwura.github.io/Gambit/) · [Inspect real Duel #1](https://iniwura.github.io/Gambit/?squad=1&duel=1) · [Public Sepolia finalization](https://sepolia.etherscan.io/tx/0x57a19f25a234eca7db206781a18cc965a09818a04b87a9f30d8d659562a9bdad) · [Engineering evidence](docs/STATUS.md)

## Play in two ways

### Practice — learn the strategy, no wallet

1. Open the [game](https://iniwura.github.io/Gambit/). Enter **Practice** by choosing a bot (**Steady**, **Reactive** or **Volatile**) and selecting **Enter Arena**.
2. Program your **Scout**, **Guardian** and **Striker** independently. Give each fighter an opening action (**Strike**, **Guard** or **Flank**), an opponent-action trigger and the counter to use when it activates.
3. Choose **Hold**, **Pivot** or **Feint** formation; these change which opposing roles your squad faces.
4. Lock all three plans and watch the three practice duels resolve. Review reactor pressure and tactical feedback; adjust across five practice rounds. You can rematch after the final score.

Practice is **cleartext and deterministic**. The per-fighter reports in this mode are educational and **must not** be represented as onchain decrypted tactics.

Desktop keys: **4/5/6** choose a fighter, **7/8/9** choose formation, **1/2/3** choose the opener, **Q/W/E** the trigger, **A/S/D** the response and **Enter** locks the turn. Mobile uses the on-screen command deck.

### View a genuinely completed encrypted match — no wallet

Open [Duel #1](https://iniwura.github.io/Gambit/?squad=1&duel=1), choose **Encrypted Squad Lab** and click **Recover verified match result · no wallet**. You can read the canonical finalized score and open **View Authenticated Reactor Result**. No extension, gas or signing is needed.

**Official first result:** **Cyan 0 : 1 Violet**. The Violet defender won the first genuine encrypted match. The verifier checks the exact chain ID, contract runtime fingerprint, finalized state, one-use duel linkage and legal aggregate. It doesn't infer hidden per-fighter tactics.

### Play an encrypted Sepolia duel — wallet required

A squad owner selects three secret plans and a formation, connects a Sepolia wallet, invites a *specific distinct* second wallet and signs one `sealSquad` transaction. The invited player opens the one-use duel, independently encrypts their ten tactical inputs, and signs `submitDuel`. Separate wallet approvals are required to `resolveDuel` and to verify the public KMS proof and `finalizeDuel`. The contract exposes aggregate scores, not the private tactical decisions. Each action is explicitly fee-capped; no transaction is automatically retried.

**Do not repeat transactions for Duel #1:** it is already finalized. Create a new squad and fresh invitation for any new match. Onchain matchmaking, automations and public opponent discovery are not implemented; players coordinate invitations themselves.

## Why confidentiality is essential

If every onchain opening action, contingency and formation were public, an opponent could inspect and counter your squad before submitting. GAMBIT's strategy relies on simultaneous *hidden* conditional plans, not a hidden animation over public decisions. With Zama FHE, the contract evaluates encrypted plans onchain while revealing only the authorized aggregate result. A public signed decryption proof enables verification of that result.

The one-use invitation limits simple repeated-query attacks on the same sealed squad. It does **not** prevent strategic inference or collusion across separately sealed squads. No general privacy guarantee or independent audit is claimed.

The encrypted onchain game is **one confidential 3v3 encounter**. The local **five-round practice** is a separate training experience. Public score verification must never be passed off as disclosure of private lane outcomes.

## Genuine Sepolia match: independently verifiable evidence

Contract: [`SquadGambit`](https://sepolia.etherscan.io/address/0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134) (`0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134`) · chain **11155111** · exact runtime keccak `0x94754bf634ba275b7a2f047483854553cbdfad51b15209477b467220b576f419`.

| Milestone | Real onchain evidence | Verified outcome |
| --- | --- | --- |
| Deploy encrypted SquadGambit | [Deployment transaction](https://sepolia.etherscan.io/tx/0x058a2e70401e5cd685895c4ef1cc6ee86d9aeaa8ad93f30fb39832d58f3da00a) | Deployed v2 runtime, block 12174655 |
| Defender seal | [`sealSquad` transaction](https://sepolia.etherscan.io/tx/0x65b1fde92ff899718f4febcdc1597cc9fb05c681b1e05996f306d2a3bae41e0b) | Squad #1, ten encrypted inputs, canonical receipt |
| Challenger opens | [`openDuel(1)` transaction](https://sepolia.etherscan.io/tx/0x632c8eca45b6c4881112ee11516252d20a85cef4fa0507a981766e1c4b4548fe) | Duel #1, one-use invitation |
| Challenger submits | [`submitDuel(1)` transaction](https://sepolia.etherscan.io/tx/0x00562be6f918e33a5781ce9c2ff9bcb4516d4c5e6d5a8cb25e485a17ddf2a8d4) · [independent check](https://github.com/Iniwura/Gambit/actions/runs/44911934524) | Ten encrypted challenger inputs, input proof, unique event |
| Confidential resolution | [`resolveDuel(1)` transaction](https://sepolia.etherscan.io/tx/0xe91ba8ba3af4ce9666871752974b5b2168f4ccac4a6a8157df93d27fe79696ac) · [independent check](https://github.com/Iniwura/Gambit/actions/runs/44913900191) | Genuine `DuelReady` event, canonical encrypted result handle |
| KMS proof | [Public decryption + exact `eth_call` preflight](https://github.com/Iniwura/Gambit/actions/runs/44913989691) | Aggregate **0:1**, proof accepted without signing |
| Finalization | [`finalizeDuel(1)` transaction](https://sepolia.etherscan.io/tx/0x57a19f25a234eca7db206781a18cc965a09818a04b87a9f30d8d659562a9bdad) · [independent check](https://github.com/Iniwura/Gambit/actions/runs/44914775566) | Block **12182444**, stored packed score **1**, authentic `DuelFinalized` event, **Violet wins** |
| Public browser recovery | [Chromium verification](https://github.com/Iniwura/Gambit/actions/runs/44915491170) | Real score and authenticated reactor view displayed with **no wallet, signing or broadcast** |

Receipt-based checks validate the exact signer, contract, method, event, runtime fingerprint, stored state, and consistency with the signed aggregate. This is evidence of **one completed real match**, not evidence of exhaustive multiplayer reliability or a third-party security audit.

### Cost evidence

The genuine challenger submission consumed **3,424,133 gas** (54,786,128 wei actual fee). Encrypted resolution consumed **3,059,375 gas** (45,890,625 wei). The finalization consumed **483,782 gas** (7,740,512 wei). These are actual Sepolia receipt values, not a guaranteed price quote. Zama HCU is distinct from EVM gas and has **not** been independently metered here. Full latency across the user journey has not been professionally benchmarked.

## Engineering and reproduction

- Web game: **Phaser 4**, **TypeScript** and **Vite**, deterministic gameplay rules in `src/squad.mjs` and a separate Phaser presentation in `src/main.ts`.
- Confidential chain: `fhe/contracts/SquadGambit.sol`, the official **`@zama-fhe/sdk`**, the Solidity FHE integration, and a pinned Sepolia runtime manifest.
- Wallet and recovery: `src/chain/squad-sepolia.ts`, `src/chain/squad-panel.ts`, `src/chain/squad-public-reader.ts`. No-wallet spectator verification fails closed on unknown or unfinished duels.
- Tests: deterministic rules, adversarial contract/mock tests, exact gas-fee ceilings and duplicate-action protections, real browser desktop/mobile checks, and independent public RPC receipt probes.

Requirements: Node.js 22+.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

FHE mocks and compile:

```bash
cd fhe
npm ci
npm run typecheck
npm run compile
npm test
```

Mock FHE tests are **not** substitutes for live decryption or authentic chain receipts. See [full engineering status](docs/STATUS.md), [production charter](docs/PRODUCTION_CHARTER.md) and [CI](https://github.com/Iniwura/Gambit/actions). The experimental legacy `SealedGambit` is a different one-fighter contract and must not be counted as proof of this 3v3 match.

## What's not finished

GAMBIT has one proven encrypted vertical slice, not a finished award-winning game. Remaining release criteria: an independent security/privacy and gameplay review; repeated full live matches with a new pair of users; first-time-player playtests and measurable session experience; approved original production sprites, sound and motion; accessibility and responsive visual QA; and the official pitch/submission materials.

Zama's **Confidential Gaming** competition evaluates *fun and intuitive gameplay*, confidentiality design, fairness, real Sepolia functionality, demo quality and code quality. The [program page](https://www.zama.org/post/zama-developer-program-mainnet-season-5-confidential-gaming) and [submission form](https://forms.zama.org/zama-developer-program-mainnet-season-5-confidential-gaming) require a functioning deployed game, clear documentation, an X introduction, and a **three-minute pitch presented by a real person**. AI-generated pitch video or voice will not be considered. **Applications close 14 December 2026 at 23:59 AOE.**

**Project rule:** no invented onchain results, no simulated user transaction proof, no hidden tactical disclosure, and no unsupported claim of production readiness.
