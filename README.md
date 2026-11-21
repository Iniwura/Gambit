# GAMBIT

**A confidential squad tactics game powered by Zama FHE.**

**Production direction:** [GAMBIT: Sealed Orders — Production Charter](docs/PRODUCTION_CHARTER.md). This is a full-game product standard with explicit acceptance gates; the current public build remains pre-alpha and does not yet satisfy those gates.

**Play the public pre-alpha:** https://iniwura.github.io/Gambit/ — free browser practice, no wallet needed. This is not a verified encrypted multiplayer release.

Program three fighters, choose a hidden deployment and outthink an opponent. The final reactor score is independently verifiable without publishing either squad's encrypted orders.

> **Release status: pre-alpha.** The 3v3 practice match is playable in Phaser, and both experimental contracts have been deployed to Sepolia. The full encrypted squad contract was deployed on 20 Nov 2026. On 21 Nov, Squad #1 was genuinely sealed on Sepolia and independently receipt/contract-state verified (ten encrypted squad inputs accepted). No complete two-wallet FHE duel, result resolution or signed KMS finalization has yet been verified. **A real two-wallet encrypted 3v3 match is NOT yet verified.** Production visuals and external user testing are outstanding.

## Play

Practice needs no wallet. It is a deterministic **cleartext** match, not a claim of encrypted live multiplayer.

1. Choose a practice opponent: **Steady** (learnable), **Reactive** (adjusts to prior lane results), or **Volatile** (varies tactics and deployment). Enter the arena and select **Scout**, **Guardian** or **Striker**.
2. Give each fighter an opening move, an enemy-move trigger and the response to that trigger.
3. Select **HOLD**, **PIVOT** or **FEINT** to change which opposing fighter each role faces.
4. Lock the squad. Watch **three individually staged** encounters, reactor score changes and an explanation of which conditional counter actually executed.
5. Reprogram your team across five full practice rounds. The highest cumulative reactor pressure wins; the capped reactor-control meter only reflects momentum. The final screen identifies a standout fighter and a weaker role to rethink; rematch against a different seeded opponent.

**Controls:** 4/5/6 select a fighter, 7/8/9 select formation, 1/2/3 the opening move, Q/W/E the trigger, A/S/D the counter and Enter to lock. Mobile has a separate large-touch command deck.

## Why encryption matters

The experimental **SquadGambit** design uses ten independent encrypted `euint8` inputs per player: three conditional actions for each of three fighter roles, plus a hidden formation. Each player can commit their private tactics while the contract calculates the matchup through FHE. A final Zama KMS-signed public decryption reveals **only the aggregate reactor score**, not the three private plans, formations or individual lane outcomes.

A defender invites a specified opponent for a **single-use** challenge. This limits simple repeated-result oracle attacks against the same sealed squad, but cannot eliminate collusion or inference across separately sealed squads. No formal secrecy claim or independent audit has been completed.

The playable practice mode reveals each public lane result for learning. **The encrypted mode cannot honestly replay per-lane winners, because those results are not publicly decrypted.** Its authenticated viewer shows the final reactor totals only.

**Spectator verification, without a wallet:** Once a real duel has been finalized on Sepolia, open the [public game](https://iniwura.github.io/Gambit/?duel=1) with `?duel=<finalized ID>`, select **Encrypted Squad Lab → View finalized score · no wallet**. The reader independently checks Sepolia chain ID, the exact v2 contract runtime hash, the one-use invitation, canonical duel linkage and finalized aggregate score. It fails closed for pending or invalid results. **No real finalized 3v3 match has yet been produced**, so this feature is currently prepared rather than demonstrated with a genuine duel.

## What actually exists

| Component | Status | Evidence |
| --- | --- | --- |
| 3v3 playable practice | Implemented | Phaser browser tests, deterministic transcript verification, 3 distinct local bot styles and staged combat |
| Scout / Guardian / Striker tactics | Implemented | Independent plans, role bonuses, formation matchup tests |
| Desktop / mobile controls | Implemented | Real Chromium actions across both screen sizes, visible fighter tactics and post-match role analysis |
| One-fighter `SealedGambit` | **Deployed, NOT live-match-verified** | Sepolia `0x12adc9f3860FB20E9655197386CDFc1DD78FF0c0` |
| Encrypted 3v3 `SquadGambit` | **Deployed, NOT live-match-verified** | Sepolia `0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134`; [deployment receipt](https://sepolia.etherscan.io/tx/0x058a2e70401e5cd685895c4ef1cc6ee86d9aeaa8ad93f30fb39832d58f3da00a) |
| First real 3v3 encrypted squad seal | **Verified on Sepolia; no duel yet** | Squad #1 owner `0x7d567F…8Ee176`, invited challenger `0x70d086…dcDD5`; [seal receipt](https://sepolia.etherscan.io/tx/0x65b1fde92ff899718f4febcdc1597cc9fb05c681b1e05996f306d2a3bae41e0b); [independent public-RPC verifier](https://github.com/Iniwura/Gambit/actions/runs/44904055643) confirmed exact event, active/unclaimed state and 74,851,940 wei fee |
| Versioned encrypted squad browser adapter | Prepared, **gated** | Exact Sepolia address and independently verified runtime code hash required |
| No-wallet finalized-score inspector | Implemented, **no real final match to inspect** | Public RPC + runtime fingerprint + finalized state/linkage checks; negative tests |
| Zama SDK ten-value encryption probe | **Passed, read-only** | Public relayer produced 10 ciphertext handles plus input proof; CI run [44725183567](https://github.com/Iniwura/Gambit/actions/runs/44725183567); no signature or chain write |
| Real two-wallet 3v3 proof | **Not complete** | Separate signatures, ten-input FHE flow, public KMS decryption, finalization and recovery still required |
| Production-grade character art and audio | **Not complete** | Original procedural stand-ins only |
| External playtest / security review | **Not complete** | Mandatory before submission-ready claim |

The previous one-fighter deployment transaction is [visible on Etherscan](https://sepolia.etherscan.io/tx/0x0d58f80bf197e705c5ef702e4d9de0f4d822813c6b19e31c711123de2c12a95b). Its deployment alone does not prove a completed match.

## Run locally

Requires Node.js 22 or later.

```bash
npm install
npm run typecheck
npm test
npm run dev
```

The browser build also compiles both Solidity contracts and verifies that the versioned TypeScript squad ABI matches the actual compiled `SquadGambit` methods, argument types and events.

```bash
npm run build
cd fhe
npm install
npm run typecheck
npm test
```

The Hardhat FHE suite uses **local mock encryption and decryption**. Green tests are reproducibility evidence, not real Sepolia HCU, latency or signature evidence. See [GitHub Actions](../../actions/workflows/validate.yml) for browser screenshots, deterministic tests and mock contract checks.

## Source map

- `src/main.ts` — Phaser practice game and authenticated-result rendering
- `src/squad.mjs` — deterministic local reference, role scoring, formation rules and replay verification
- `src/tactical-report.mjs`, `src/practice-insight.mjs`, `src/practice-match-debrief.mjs` — practice-only tactical coaching and match review
- `src/visual/` — original procedural environment and fighter silhouettes
- `src/chain/sepolia.ts` — deployed **one-fighter** client
- `src/chain/squad-sepolia.ts` — deployed but **not yet live-match-verified** 3v3 wallet client; exact Sepolia runtime hash required
- `src/chain/squad-public-reader.ts` — wallet-free verification of finalized 3v3 score from exact deployed contract state
- `fhe/contracts/` — Solidity FHE candidates, including `SealedGambit.sol` and `SquadGambit.sol`
- `fhe/test/` — adversarial, parity and proof-replay mock tests
- `fhe/scripts/seal-squad-sepolia.ts` — guarded real v2 ten-input seal; **executed once successfully for Squad #1 on 21 Nov**; see [live handoff](docs/LIVE_SQUAD_SEAL_HANDOFF.md)

Detailed design and constraints: [GAME_DESIGN](docs/GAME_DESIGN.md), [FHE Squad Protocol](docs/CONFIDENTIAL_SQUAD_V2.md), [Visual QA](docs/VISUAL_ACCEPTANCE.md), and [Deployment Gate](docs/SQUAD_DEPLOYMENT_GATE.md).

## What's next

1. The first real ten-input `sealSquad` succeeded and was independently reverified using public Sepolia RPC. **Next: the invited second wallet must separately authorize `openDuel(1)`.** The [live verification checklist](https://github.com/Iniwura/Gambit/issues/8) tracks the rest of the match. No further transaction is authorized by the spent one-seal approval.
2. Proceed only with one-shot, owner-controlled, **fee-capped testnet transaction flags**. Verify a real two-wallet ten-value encrypted duel, signed aggregate KMS result and recovery. Do not rely on deployment approval or reuse a transaction flag indiscriminately.
3. Record actual Sepolia gas, HCU if observable, relayer/KMS latency, canonical receipts and user-facing verified results.
4. Replace provisional fighter graphics with final original sprites and animations, perform beginner playtests, and conduct an independent privacy / gameplay audit.

**Design rule:** no fake signatures, no simulated chain receipts, no unverified onchain victories.
