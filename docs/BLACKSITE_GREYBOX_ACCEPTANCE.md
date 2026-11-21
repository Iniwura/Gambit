# BLACKSITE — Functional Local Greybox Acceptance

**GAMBIT build sequence:** architecture/rules → functional greybox → browser and gameplay verification → final graphics/audio.  
**Milestone:** Phase 2 first playable BLACKSITE local-training slice, 21 November 2026.  
**Implementation boundary:** this is the original four-glyph cleartext tutorial, **NOT** the proposed competitive 5-glyph encrypted BLACKSITE protocol.

## Actual functional experience

- A **BLACKSITE · LOCAL MISSION** control is mounted into the existing Phaser Arena's real web page by [`src/blacksite/greybox.ts`](../src/blacksite/greybox.ts).
- Only [`blacksite-training`](../src/architecture/game-shell.mjs) is enabled by the shared fail-closed scene reducer. The separate `blacksite-mission` competitive mode remains **unavailable** until it has a real FHE implementation and acceptance evidence.
- The implementation wraps the existing [bounded local mission controller](../src/blacksite/mission.mjs). No duplicate scoring rules exist in the UI. Only `publicBlacksiteLocalMission()` is used to render a mission's visible state and clues.
- A mission goes **briefing → active → breached/locked → debrief → retry**. The player selects four glyphs from `0..3`, receives exact/misplaced aggregate hints for a genuine submitted guess, and has at most five attempts.
- Duplicate guesses, malformed actions and actions after a terminal state are rejected by the domain controller, not optimistic UI logic.
- `Restart` creates a fresh local mission ID and another training code. `Return to Arena` closes the functional mode without resetting the current Phaser practice seed or match, and reopening resumes the local in-memory mission.
- A browser reload intentionally begins a fresh *local training* run; it must not invent persistence or imply a resume-from-chain feature.

## Interaction and privacy policy

| Concern | Actual behavior and test gate |
| --- | --- |
| Labels | Clearly **LOCAL TRAINING · NOT ENCRYPTED · NO WALLET**, including after victory |
| Confidentiality | Training secret held outside exported public mission snapshot; not in DOM attributes or history; **client-side memory is not cryptographic security** |
| Result | Authenticated by local deterministic training rules only; **never** a ranked or Zama onchain victory |
| Input | Four native labelled selects with keyboard and touch support; visible submission/error state |
| Response | Accepted guesses visibly append a numbered attempt and aggregate clue; duplicates show a specific error without spending a turn |
| Terminal | Correct four-position guess breaches; five unsuccessful attempts lock; no submission after either |
| Focus | Dialog semantics, focus on first active action, keyboard Escape to return, Tab containment, focus restoration on close |
| Concurrent wallet UI | Local mission launcher refuses to open over an active `gambit-squad-dialog`; opened local mode inerts underlying Arena and wallet entry controls |
| Session continuity | Close/reopen keeps local mission in memory; Arena seed and gameplay state remain unchanged |
| Mobile | Dedicated scrollable full-screen functional mission view; 44+px controls, usable at 390×844 |
| Offline | Once game assets are loaded, local guesses require no RPC, no wallet and no transaction |
| Failure/recovery | Invalid/duplicate actions leave the canonical mission state unchanged; browser errors must not be swallowed |

## Test plan

**Domain test:** [`tests/blacksite-mission-contract.test.mjs`](../tests/blacksite-mission-contract.test.mjs) already covers 256 secret combinations, duplicate guesses, terminal lock, briefing, breach, retry, immutability and public-field redaction.

**Shared navigation test:** [`tests/game-architecture-contract.test.mjs`](../tests/game-architecture-contract.test.mjs) must allow `blacksite-training` as `local-training` but reject `blacksite-mission` and `commander-profile` as unfinished.

**Browser E2E:** [`tests/blacksite-greybox-browser-check.mjs`](../tests/blacksite-greybox-browser-check.mjs) runs in Chromium at desktop **1280×850** and mobile **390×844**, checking launch and mode registration, real attempt feedback, duplicate rejection, nonresetting Arena, reopening, terminal result, debrief and fresh retry. The test allows either a real first-attempt breach or an eventual lock because the local secret is deliberately random; it never silently seeds a fake fixed win.

The full [GAMBIT quality suite](https://github.com/Iniwura/Gambit/actions/workflows/validate.yml) invokes this test after existing Arena browser coverage. **Do not mark this browser gate passed until an exact run actually completes.** A successful TypeScript/Phaser build alone does not verify the player interaction.

## Explicitly NOT delivered by this milestone

No encrypted BLACKSITE contract, no secure entropy source for competitive vaults, no creator/solver protocol or anti-collusion guarantees, no balanced v2 optional scans, no mission world/infiltration mechanics, no cross-reload mission saving, no player progress unlocks, no final character/arena/mission art, and no audio production.

The proposed 7,776-code competitive puzzle still has a [recorded rejected scanner design](BLACKSITE_V2_PROTOCOL_DECISION.md). This local training slice is a functional proof of input, consequence and recovery while we redesign the competitive mission's economics and security.

**Next acceptance decision:** after the browser gate passes, evaluate uncoached player comprehension and BLACKSITE strategic difficulty, then decide on a v2 mission objective that makes encrypted, bounded choices genuinely meaningful before spending time on a Zama contract or graphics.
