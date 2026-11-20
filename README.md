# GAMBIT

**A confidential squad tactics game powered by Zama FHE.**

Program three fighters, choose a hidden deployment and outthink an opponent. The final reactor score is independently verifiable without publishing either squad's encrypted orders.

> **Release status: pre-alpha.** The 3v3 practice match is playable in Phaser, and both experimental contracts have been deployed to Sepolia. The full encrypted squad contract was deployed on 20 Nov 2026 and passes local mock tests, but no complete real FHE two-wallet match has been verified. **A real two-wallet encrypted 3v3 match is NOT yet verified.** Production visuals and external user testing are outstanding.

## Play

Practice needs no wallet. It is a deterministic **cleartext** match, not a claim of encrypted live multiplayer.

1. Enter the arena and select **Scout**, **Guardian** or **Striker**.
2. Give each fighter an opening move, an enemy-move trigger and the response to that trigger.
3. Select **HOLD**, **PIVOT** or **FEINT** to change which opposing fighter each role faces.
4. Lock the squad. Watch three encounters, reactor score changes and a post-round explanation.
5. Reprogram your team across up to five rounds, then rematch with a different opponent pattern.

**Controls:** 4/5/6 select a fighter, 7/8/9 select formation, 1/2/3 the opening move, Q/W/E the trigger, A/S/D the counter and Enter to lock. Mobile has a separate large-touch command deck.

## Why encryption matters

The experimental **SquadGambit** design uses ten independent encrypted `euint8` inputs per player: three conditional actions for each of three fighter roles, plus a hidden formation. Each player can commit their private tactics while the contract calculates the matchup through FHE. A final Zama KMS-signed public decryption reveals **only the aggregate reactor score**, not the three private plans, formations or individual lane outcomes.

A defender invites a specified opponent for a **single-use** challenge. This limits simple repeated-result oracle attacks against the same sealed squad, but cannot eliminate collusion or inference across separately sealed squads. No formal secrecy claim or independent audit has been completed.

The playable practice mode reveals each public lane result for learning. **The encrypted mode cannot honestly replay per-lane winners, because those results are not publicly decrypted.** Its authenticated viewer shows the final reactor totals only.

## What actually exists

| Component | Status | Evidence |
| --- | --- | --- |
| 3v3 playable practice | Implemented | Phaser browser tests, deterministic transcript verification |
| Scout / Guardian / Striker tactics | Implemented | Independent plans, role bonuses, formation matchup tests |
| Desktop / mobile controls | Implemented | Real Chromium actions across both screen sizes |
| One-fighter `SealedGambit` | **Deployed, NOT live-match-verified** | Sepolia `0x12adc9f3860FB20E9655197386CDFc1DD78FF0c0` |
| Encrypted 3v3 `SquadGambit` | **Deployed, NOT live-match-verified** | Sepolia `0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134`; [deployment receipt](https://sepolia.etherscan.io/tx/0x058a2e70401e5cd685895c4ef1cc6ee86d9aeaa8ad93f30fb39832d58f3da00a) |
| Versioned encrypted squad browser adapter | Prepared, **gated** | Exact Sepolia address and independently verified runtime code hash required |
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
- `src/tactical-report.mjs` — public-only post-round debrief and validation
- `src/visual/` — original procedural environment and fighter silhouettes
- `src/chain/sepolia.ts` — deployed **one-fighter** client
- `src/chain/squad-sepolia.ts` — deployed but **not yet live-match-verified** 3v3 client; exact Sepolia runtime hash required
- `fhe/contracts/` — Solidity FHE candidates, including `SealedGambit.sol` and `SquadGambit.sol`
- `fhe/test/` — adversarial, parity and proof-replay mock tests

Detailed design and constraints: [GAME_DESIGN](docs/GAME_DESIGN.md), [FHE Squad Protocol](docs/CONFIDENTIAL_SQUAD_V2.md), [Visual QA](docs/VISUAL_ACCEPTANCE.md), and [Deployment Gate](docs/SQUAD_DEPLOYMENT_GATE.md).

## What's next

1. Perform read-only checks of the deployed `SquadGambit` runtime, SDK initialization, and distinct challenger wallet readiness. The [live verification checklist](https://github.com/Iniwura/Gambit/issues/8) tracks the next evidence gate.
2. Obtain **separate explicit approval for each new transaction** and verify a real two-wallet ten-value encrypted duel, signed aggregate KMS result and recovery. Deployment authorization is exhausted and does not cover gameplay.
3. Record actual Sepolia gas, HCU if observable, relayer/KMS latency, canonical receipts and user-facing verified results.
4. Replace provisional fighter graphics with final original sprites and animations, perform beginner playtests, and conduct an independent privacy / gameplay audit.

**Design rule:** no fake signatures, no simulated chain receipts, no unverified onchain victories.
