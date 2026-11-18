# GAMBIT — Production Research and Skills

## Verified process

A serious game-production pipeline goes pre-production → prototype of core fun → vertical slice including the real art, code, audio, UI and interactions → production → repeated playtests/QA → release candidate. A vertical slice proves that the gameplay can actually be delivered at target quality; a prototype only asks whether the mechanics could work. Among Us was a three-person Unity project initially released with local multiplayer and then improved over time. GAMBIT must use the same disciplined iteration, not mimic its assets.

### Primary sources
- Innersloth official history: https://www.innersloth.com/press-kit-among-us/
- MIT Press — A Playful Production Process: https://mitpress.ublish.com/book/a-playful-production-process-for-game-designers-and-everyone
- Phaser v4.2.1 release list: https://phaser.io/download/phaser4
- Phaser architecture/scenes: https://docs.phaser.io/phaser/concepts/scenes
- Phaser tilemaps and object-layer collisions: https://docs.phaser.io/api-documentation/class/tilemaps-tilemap
- Zama SDK 3.x quick start: https://github.com/zama-ai/sdk/blob/main/docs/gitbook/src/tutorials/quick-start.md\n- Zama official setup: https://docs.zama.org/protocol/solidity-guides/getting-started/setup
- Zama public decryption guide: https://docs.zama.org/protocol/solidity-guides/smart-contract/oracle
- Zama ACL: https://docs.zama.org/protocol/solidity-guides/smart-contract/acl
- Zama competition rules: https://www.zama.org/post/zama-developer-program-mainnet-season-5-confidential-gaming

## Skills discovered and evaluated

### OpenAI public Game Studio skill pack — Recommended for Codex
https://github.com/openai/plugins/tree/main/plugins/game-studio/skills

Specialized guidance:
- `game-studio`: routes game requests, game fantasy and implementation workflow.
- `web-game-foundations`: simulation/render boundaries, inputs, assets, performance.
- `phaser-2d-game`: Phaser + TS + Vite, thin scenes, external deterministic state, DOM HUD.
- `sprite-pipeline`: consistent original characters/animations and sprite atlases.
- `game-ui-frontend`: low-chrome HUD and readable decisions.
- `game-playtest`: real browser QA and visual/playability review.

These are public source references. Do NOT claim the plugin or skills have been installed on a user's machine or ChatGPT unless confirmed.

### Available to this chat
- Installed Vercel skill: `verification`, for true browser → API → data → UI evidence and stop on broken boundaries.
- Installed Vercel skill: `deployments-cicd`, for preview, builds, CI evidence and rollout.
- No installed specialist game-development skill was available in the currently connected skill catalog at the time of this research.

### Other public options (review before installing)
- https://www.skills.sh/github/awesome-copilot/game-engine
- https://github.com/kessriga/game-studio/blob/main/skills/vertical-slice/SKILL.md

Do not install arbitrary code or copy unverified third-party skill directives into a credential-bearing environment. Use official docs as the technical source of truth.

## GAMBIT recommended working disciplines
- **Producer**: game scope, milestone gates, risk board, candid no-go decisions.
- **Systems/gameplay designer**: explicit rules, balance simulation, onboarding, playtests.
- **Phaser developer**: scene, input, sprite animation, map/collision, responsive HUD, profiling.
- **Smart contract / FHE engineer**: encrypted computation, permissions, signed result verification, adversarial security.
- **QA reviewer**: cross-device, accessibility, negative paths, fresh-player testing, evidence.
One person/agent may cover multiple roles, but each role has distinct sign-off evidence.

## Avoid these common mistakes
- Polishing mockups ahead of a runnable game loop.
- Claiming graphics, tests or FHE work based on code that has not run.
- Allowing the Phaser scene to choose the winner.
- Building six decorative sprites without three meaningful tactical roles.
- Treating a generated map as a walkable collision-checked level.
- Mistaking test counts for balance, fun or security assurance.
- Submitting a rehearsed AI-generated video when the competition requires a human pitch.

**Decision principle:** Cut peripheral features before cutting quality of the one complete loop.
