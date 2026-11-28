# Architecture and gameplay contract

## Locked build order
Full architecture/game plan → responsive functional greybox → functional/recovery tests and human gameplay validation → final art, animation and audio. Do not begin final graphics just because CI or a contract test passes.

## Boundaries
- Simulation/domain: deterministic serializable rules, legal commands, scoring, progression and replay. No wallet, DOM or Phaser authority.
- Phaser: scenes, fighters, world, camera, effects and animation. Render state; never choose an onchain winner.
- UI/application: accessible HUD, menus, onboarding, wallet/network states, consent, recovery and capability gates.
- FHE/chain: Solidity + official Zama Hardhat plugin + current @zama-fhe/sdk; Sepolia. Encrypt inputs, enforce ACL, compute authorized outcomes, authenticate public aggregate decryption/finalization.
- Adapters: distinguish LOCAL_CLEAR_TEXT, SIGNED_SEPOLIA, VERIFIED_PUBLIC_SEPOLIA, RESEARCH_ONLY and PLANNED. Local results never masquerade as chain evidence.

## Arena
Player loop: choose squad, coordinate/invite opponent, program private conditional orders and formation, seal asynchronously, wait for authenticated aggregate outcomes, adapt, finish and rematch. Intended competitive experience is five rounds.

Roles: Scout (information/marking), Guardian (protection/denial), Striker (breach/offensive pressure). Each must create distinct tactical decisions, not just three skins around one RPS button.

Local practice: three role-specific plans and five rounds; cleartext and deterministic. Academy is separate onboarding/mastery. Never describe local bot results as confidential multiplayer.

Arena V4 research candidate:
- Contract fhe/contracts/ArenaV4ConfidentialActivationResearch.sol
- Address 0x5F9e0030233370a913780EC9CCb58183C4672c13
- Chain Sepolia 11155111
- Evidence fhe/deployments/sepolia-arena-v4-live-validation.json
- Recorded test: 21 unique transactions (create, ten seals, five resolves, five authenticated finalizations); round score values 40,56,40,40,40; cumulative 27:0; complete true, abandoned false.
- Three RPC providers agreed on recorded receipts/calldata/canonical blocks/runtime/final state.
- 11 encrypted inputs per seal: three fighter triplets, formation and sector/activation selector. Activation effective once via private spent state. Sector activation affects aggregate score. Aggregate inference risk remains. Controlled test, not a balance study.

Preserve Arena v3 historical five-round 6:4 Match #1; do not conflate it with V4.

## BLACKSITE
Keep original four-glyph local tutorial intact. Neutral five-glyph candidate:
- Contract fhe/contracts/NeutralBlacksiteResearch.sol
- Address 0x33c062aebeB425b53A25E0b370732Cee5f7F97F9
- Evidence fhe/deployments/sepolia-neutral-blacksite-mission-1.json
- Five encrypted glyphs, four attempts, encrypted guess/approach, contract ACL, route-specific feedback/heat, KMS-authenticated finalization, expiry/recovery.
- STEALTH: exact-count/lower heat; PROBE: exact+misplaced; BREACH: higher heat and only five exact opens vault.
- Mission #1 ended BREACHED, score 35, heat 5, four attempts, 12 canonical writes.
- Advanced local rehearsal uses same oracle but is wallet-free, cleartext and unranked.

## Training and Commander
Academy is five-round local onboarding. Independent novice comprehension/rematch remains untested. Arena v3 history is receipt-derived. No fictional history. BLACKSITE progression, ranking, paid rewards and token economy remain disabled/planned.

## Safety
No automatic prompts/signatures/deployments/retries/finalization. Explicit review before dispatch; bounded fee and fresh actor/state/calldata checks. Ambiguous dispatch blocks duplicates until independent recovery. Receipt success alone is not final gameplay. Require canonical receipt, exact event, contract/runtime identity and authenticated state. Read-only debrief uses pinned allowlists and two-provider agreement. Never log private tactics, ciphertexts, proofs, keys or seed phrases. Testnet evidence is not a production security audit.
