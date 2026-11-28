# Agents, roles and toolchain

These are recommended review responsibilities, not claims that separate autonomous agents are already configured.

1. Producer/release manager: scope, milestones, dependencies, risk register, honest release decision; maintain BUILD_LOG, STATUS and PR.
2. Systems/gameplay designer: rule contracts, role differentiation, strategy space, balance, onboarding and playtests; search dominant strategies.
3. Phaser engineer: scenes, inputs, camera, collision, state rendering, mobile UX and performance; keep rules out of scenes.
4. FHE/Solidity engineer: current Zama SDK, ACL, encrypted computation, authenticated decryption, fail-closed writes; review privacy/replay/timeouts.
5. UI/interaction designer: HUD, menus, control affordances, accessible states and responsive layout.
6. QA/adversarial reviewer: browser, wallet, recovery, mobile, keyboard, accessibility, contract invariants and evidence provenance.

## Toolchain intent
Node.js >=22; Phaser ^4.2.1; TypeScript ^5.8.3; Vite ^7.0.0; ethers ^6.16.0; @zama-fhe/sdk ^3.8.0; Solidity/Hardhat under fhe/; Ethereum Sepolia 11155111.

Main scripts: npm run dev, npm run typecheck, npm test, npm run build. Read fhe/package.json, lockfile, workflows and scripts before contract commands. Do not infer write behavior from script names.

## Specialist skill references
OpenAI public Game Studio skill pack: https://github.com/openai/plugins/tree/main/plugins/game-studio/skills
Areas: game-studio, web-game-foundations, phaser-2d-game, sprite-pipeline, game-ui-frontend, game-playtest. Public references, not proof they are installed in Codex/ChatGPT.

Official docs: https://docs.phaser.io/ ; https://docs.phaser.io/phaser/concepts/scenes ; https://docs.zama.org/protocol/ ; https://docs.zama.org/protocol/solidity-guides/getting-started/setup ; https://docs.zama.org/protocol/solidity-guides/smart-contract/acl ; https://docs.zama.org/protocol/solidity-guides/smart-contract/oracle ; https://www.zama.org/post/zama-developer-program-mainnet-season-5-confidential-gaming

Codex: clone repo, checkout engineering branch, read AGENTS.md and handoff, inspect git status/HEAD/PR/CI before editing. Use coherent commits and full gates. Never claim background work unless a real persistent task exists. Keep wallet secrets out of agent context.
