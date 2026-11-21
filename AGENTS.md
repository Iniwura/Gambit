# GAMBIT — Studio operating rules

> This is a real game project, not a UI mockup. We aim for the strongest credible first-place Zama Developer Program Season 5 entry. Winning cannot be guaranteed. Never sacrifice truth or working software for a score claim.

## Source of truth
- Read `docs/PRODUCTION_PLAN.md`, `docs/GAME_DESIGN.md`, and `docs/RESEARCH_AND_SKILLS.md` before implementing.
- Name: **GAMBIT**. Style: original premium cartoon / top-down 2D sci-fi tactical arena. Existing six fighter characters are approved. **Graphics frozen until end-to-end play works.**
- Use Phaser 4.2.1 + TypeScript + Vite for the browser game, with scene/render/UI separated from deterministic authoritative rules. Use the official Zama Hardhat plugin, Solidity, and current `@zama-fhe/sdk` (not deprecated Relayer SDK) for confidential onchain decisions. Chain: Sepolia.
- Do not silently replace Phaser with handmade HTML, Canvas, or procedural WebGL demos. Local practice may use a deterministic cleartext reference engine, visibly labeled local/simulated.

## Studio workflow for every feature
1. Define player story, acceptance criteria, failure cases, and verification evidence.
2. Implement smallest complete end-to-end change; update types, state transitions, UI, and logs together.
3. Add deterministic unit/property tests plus the applicable E2E / chain tests.
4. Run `npm ci && npm run typecheck && npm test && npm run build` for web when lockfile exists. Run `cd fhe && npm ci && npm run compile && npm test` for contracts when lockfile exists.
5. Test in a real browser at desktop and mobile, capture screenshots/console; for onchain, record transaction hashes, block/explorer URLs, proof and exact contract/chain.
6. Review UX and counterexamples independently; no feature is 'done' until its acceptance evidence exists.
7. Commit coherent changes in a branch or PR. Keep main clean and continuously testable.

## Core boundaries
- `Simulation`: serializable deterministic match state, legal moves, rules, round progression, history, replay.
- `Game`: Phaser scenes, characters, animations, camera, effects; **never authoritative**.
- `UI`: DOM HUD, accessible menus, network/wallet/retry and source-of-truth statuses.
- `Chain`: Zama encrypted strategy input, access control, computation, proof verification and finalization.
- `Adapter`: explicit `practice` versus `sepolia` modes; no dummy receipt masquerading as chain finality.

## Non-negotiable security and quality rules
- Keep confidential strategy ciphertext private by default. Review every FHE allowance. No event, log, UI state or browser data may reveal an opponent's unauthorized plan.
- No invented transaction hashes, live deployments, tested versions or sample sizes. Do not claim compiled contracts or passing E2E unless verified in that run.
- Fail closed: invalid sender, replays, wrong match, illegal ciphertext, unauthorized decryption, stale results, mismatched proof, out-of-order action, timeout.
- Do not add cosmetics, extra maps, ranking, token economics, or promotional flourishes before the testnet loop is end-to-end.
- Visual quality does not substitute for fun, fairness, or verified privacy.
- Stop and report the earliest confirmed broken integration boundary; do not paper it over.
- No private keys, seed phrases or API tokens in code, env examples, commits, screenshots or logs.

## Deadline and exit rule
Internal target: **Sunday 2026-11-22**, before the next working week. Official Zama submission deadline: **2026-12-14**. The internal target is a stretch quality gate, not authorization to ship defective or fabricated functionality. If an essential P0 fails, report it plainly rather than calling the project complete.

## Helpful source references (guidance, not executable dependencies)
- OpenAI public Game Studio skills: https://github.com/openai/plugins/tree/main/plugins/game-studio/skills
  - `game-studio`, `web-game-foundations`, `phaser-2d-game`, `sprite-pipeline`, `game-ui-frontend`, `game-playtest`
- Phaser official: https://docs.phaser.io/
- Zama official: https://docs.zama.org/protocol/
- Release requirements: https://www.zama.org/post/zama-developer-program-mainnet-season-5-confidential-gaming
