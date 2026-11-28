# GAMBIT: Sealed Orders

**Your strategy is the secret, not your hand.**

GAMBIT is a sci-fi 3v3 tactical game powered by Zama FHE. Program three independent conditional orders, secretly deploy your squad, risk a once-per-match GAMBIT, and fight for reactor pressure over five rounds. A compromised command channel makes sealed orders essential: a rival must commit without inspecting your tactics.

**Pre-release.** Verified encrypted match infrastructure and playable training exist; the redesigned full-game presentation is a separate internal candidate, not an integrated hosted release.

[Complete project handoff](HANDOFF/README.md) · [Current hosted engineering build](https://iniwura.github.io/Gambit/) · [Full product roadmap](docs/GAMBIT_MASTER_SCOPE.md) · [Verified engineering status](docs/STATUS.md) · [Build history](docs/BUILD_LOG.md) · [R36 visual/disclosure checkpoint](https://github.com/Iniwura/Gambit/blob/design/arena-visual-track/docs/R36_DISCLOSURE_UX_AND_REVIEW.md)

## What is real today

| Component | Evidence and boundary |
| --- | --- |
| Arena v3 encrypted competition | One completed two-wallet five-round Sepolia match, 6:4; 20 gameplay transactions, verified read-only through three RPC providers. See [STATUS](docs/STATUS.md). Repeatability and redesigned frontend integration remain open. |
| Earlier SquadGambit v2 | One independently verified encrypted 3v3 encounter, 0:1; separate legacy protocol. |
| Academy | Playable cleartext training; no wallet or cryptographic claims. |
| Blacksite | Local codebreaking; separate encrypted mission contract mock-tested, not deployed. |
| Commander | Verified Arena history, XP, level and achievements from authenticated receipts. Expanded reward and cosmetic system planned. |
| R36 design track | Three animated textured operator models, live 3D Arena/Academy/Blacksite/studio, local progression and disclosure UX, tested offline; source archives supplied separately. Not merged into this engineering branch or hosted as the new game. |

**Arena v3 proof:** [Sepolia contract](https://sepolia.etherscan.io/address/0xBF56087EFF029594beeFf1B57B47b1419bCDF16b) · [Match #1 creation](https://sepolia.etherscan.io/tx/0x4d64c77325c1fbff9cef31383b59f141172cad5a5163623c0de1e044c1297a0c) · [all round receipts and timings](docs/BUILD_LOG.md). The older deployment manifest and contract comments are historical; current evidence in STATUS supersedes their pre-deployment labels.

## The sealed-orders experience

| Stage | What is public | What remains confidential |
| --- | --- | --- |
| Lock | Participants, seal status, timing, GAMBIT activation | Nine tactical values, formation, selected GAMBIT sector |
| Resolve | Both seals, resolution status and aggregate result handle | Individual plans, actions and lane outcomes |
| Reveal | KMS-authenticated aggregate pressure points and cumulative score after finalization | Private orders, formation and selected target; no automatic end-of-match disclosure |

Public results may enable strategic inference. No absolute privacy guarantee or independent security audit is claimed. The deployed contract permits incomplete-round expiry without awarding a win; both timely seals can still resolve after expiry. The new UI must reflect actual transaction/proof state, not fabricated decryption or individual attacks. R36 includes a labeled offline protocol illustration only.

## Rewards and replayability — planned expansion

Progression is earned, not purchased. Commander XP, mastery badges, medals, titles and cosmetic operator/equipment unlocks reward real activity without changing competitive power. Local practice and Academy mastery are separate from receipt-verified online achievements; Blacksite earns verified rewards only after its own approved live mission. Claim rewards idempotently from canonical event identities; handle duplicate/reorganized receipts, abandoned rounds and self-farming. Ranked divisions and public leaderboards require fair repeated live matches and abuse review. No new token, paid loot boxes, wagering, cash payouts or pay-to-win features. Confidential challenges are a later research candidate, not a shipped proof feature.

## Design and release direction

Reference standards: Vesperfall (world, art and HUD), Tactical Breach Wizards (tactical choices), Gears Tactics (cinematic presentation), XCOM: Chimera Squad (squad identity), Into the Breach (outcome clarity). Original or appropriately licensed assets only; no copied game identity. Complete all modes, not just Arena. Use honest local-versus-online labels, accessible faction markers, clear order summaries, useful wait/recovery states and a no-wallet spectator path. Measure newcomer comprehension, replay desire, strategic balance and real hardware performance. Target 90+/100 internal whole-game quality, with no category under 80% of its maximum; independent review and live integration are separate release gates. No score or win guaranteed.

The sections below retain the engineering build's existing play instructions and v2 proof route; they do not describe a hosted R36 release.

## Play, train and verify

### Practice — learn the strategy, no wallet

1. Open the [game](https://iniwura.github.io/Gambit/). Enter **Practice** by choosing a bot (**Steady**, **Reactive** or **Volatile**) and selecting **Enter Arena**.
2. Program your **Scout**, **Guardian** and **Striker** independently. Give each fighter an opening action (**Strike**, **Guard** or **Flank**), an opponent-action trigger and the counter to use when it activates.
3. Choose **Hold**, **Pivot** or **Feint** formation; these change which opposing roles your squad faces.
4. Lock all three plans and watch the three practice duels resolve. Review reactor pressure and tactical feedback; adjust across five practice rounds. You can rematch after the final score.

Practice is **cleartext and deterministic**. The per-fighter reports in this mode are educational and **must not** be represented as onchain decrypted tactics.

Desktop keys: **4/5/6** choose a fighter, **7/8/9** choose formation, **1/2/3** choose the opener, **Q/W/E** the trigger, **A/S/D** the response and **Enter** locks the turn. Mobile uses the on-screen command deck.

### Tactical Academy — optional full five-round guided training

Choose **TRAINING · TACTICAL ACADEMY** on desktop or mobile. Program Striker's FLANK opening, enemy STRIKE trigger and GUARD response, select FEINT and lock a real local 3v3 round. After reading the real scoreboard, use **CONTINUE FULL MATCH** to program Scout, change Guardian's tactic, adapt formation and independently command all three fighters in the fifth round. Only accepted commands, matching committed plans and genuine settled game events advance the lesson. A defeat or draw still qualifies for genuine local training completion.

**Verified:** [4/4 quality gates](https://github.com/Iniwura/Gambit/actions/runs/44938866411), including actual five-round desktop/mobile gameplay (15 lanes and a genuine **3 : 10 defeat**), 710px/820px tablet navigation, zero browser exceptions or wallet actions. **Boundary:** local cleartext Training, not encrypted five-round multiplayer, persistent mastery or independently observed novice comprehension. [Full acceptance](docs/TRAINING_FULL_MATCH_ACCEPTANCE.md).

### BLACKSITE — playable local codebreaking training, no wallet

Open the game and select **BLACKSITE · LOCAL MISSION** from the desktop header or **BLACKSITE · LOCAL TRAINING** inside the mobile command deck. Start a mission, enter four ordered glyphs (0–3), and use the actual **exact-position** and **misplaced** feedback to deduce the secret within **five guesses**. Duplicate guesses do not consume another attempt. Finish, review the transcript and start a fresh local mission; returning to Arena preserves your current practice session.

**Scope boundary:** this is a functional, wallet-free **cleartext training greybox**. It is not the planned encrypted BLACKSITE competitive mission, not an onchain result and not player ranking/progression. [Architecture and browser acceptance gates](docs/BLACKSITE_GREYBOX_ACCEPTANCE.md) · [Competitive mission research](docs/BLACKSITE_V2_PROTOCOL_DECISION.md).

### COMMANDER — opt-in read-only match records

Choose **COMMANDER · PUBLIC RECORDS** from the game (desktop header or mobile command deck). Enter a public Ethereum wallet address voluntarily to scan the approved GAMBIT Sepolia contract. The app checks canonical `DuelFinalized` receipts, current contract state and the exact pinned runtime **before** counting a win. A partial RPC scan is labeled partial; failed lookups never invent results. You can close the viewer without changing your current Practice or BLACKSITE session. No wallet connection, transaction, private key or local profile storage is required.

The first [real wallet history workflow](https://github.com/Iniwura/Gambit/actions/runs/44927551505) passed 23/23 focused tests, verified **one actual Duel #1 defender victory** from eight bounded Sepolia log pages, and made no writes. **This is not yet a persistent full Commander Profile:** verified cross-session indexing, nicknames/opt-in identity, achievements and progression remain to be built. [Functional viewer acceptance](docs/PROFILE_GREYBOX_ACCEPTANCE.md).

### View a genuinely completed encrypted match — no wallet

Open [Duel #1](https://iniwura.github.io/Gambit/?squad=1&duel=1), choose **Encrypted Squad Lab** and click **Recover verified match result · no wallet**. You can read the canonical finalized score and open **View Authenticated Reactor Result**. No extension, gas or signing is needed.

**Official first result:** **Cyan 0 : 1 Violet**. The Violet defender won the first genuine encrypted match. The verifier checks the exact chain ID, contract runtime fingerprint, finalized state, one-use duel linkage and legal aggregate. It doesn't infer hidden per-fighter tactics.

### Play an encrypted Sepolia duel — wallet required

A squad owner selects three secret plans and a formation, connects a Sepolia wallet, invites a *specific distinct* second wallet and signs one `sealSquad` transaction. The invited player opens the one-use duel, independently encrypts their ten tactical inputs, and signs `submitDuel`. Separate wallet approvals are required to `resolveDuel` and to verify the public KMS proof and `finalizeDuel`. The contract exposes aggregate scores, not the private tactical decisions. Each action is explicitly fee-capped; no transaction is automatically retried.

**Do not repeat transactions for Duel #1:** it is already finalized. Create a new squad and fresh invitation for any new match. Onchain matchmaking, automations and public opponent discovery are not implemented; players coordinate invitations themselves.

## Why confidentiality is essential

If every onchain opening action, contingency and formation were public, an opponent could inspect and counter your squad before submitting. GAMBIT's strategy relies on simultaneous *hidden* conditional plans, not a hidden animation over public decisions. With Zama FHE, the contract evaluates encrypted plans onchain while revealing only the authorized aggregate result. A public signed decryption proof enables verification of that result.

The one-use invitation limits simple repeated-query attacks on the same sealed squad. It does **not** prevent strategic inference or collusion across separately sealed squads. No general privacy guarantee or independent audit is claimed.

The v2 SquadGambit evidence is one confidential 3v3 encounter. Arena v3 separately proves one complete five-round encrypted match; the local five-round practice and R36 design candidate remain separate. Public score verification must never be passed off as disclosure of private lane outcomes.

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

Receipt-based checks validate the exact signer, contract, method, event, runtime fingerprint, stored state, and consistency with the signed aggregate. This table proves the v2 encounter only; see the separate v3 evidence above. Neither is evidence of exhaustive multiplayer reliability or a third-party security audit.

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

GAMBIT has verified v2 and v3 encrypted match evidence, not a finished award-winning game. Remaining release criteria: an independent security/privacy and gameplay review; repeated full live matches with a new pair of users; first-time-player playtests and measurable session experience; approved original production sprites, sound and motion; accessibility and responsive visual QA; and the official pitch/submission materials.

Zama's **Confidential Gaming** competition evaluates *fun and intuitive gameplay*, confidentiality design, fairness, real Sepolia functionality, demo quality and code quality. The [program page](https://www.zama.org/post/zama-developer-program-mainnet-season-5-confidential-gaming) and [submission form](https://forms.zama.org/zama-developer-program-mainnet-season-5-confidential-gaming) require a functioning deployed game, clear documentation, an X introduction, and a **three-minute pitch presented by a real person**. AI-generated pitch video or voice will not be considered. **Applications close 14 December 2026 at 23:59 AOE.**

**Project rule:** no invented onchain results, no simulated user transaction proof, no hidden tactical disclosure, and no unsupported claim of production readiness.
