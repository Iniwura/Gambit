# ADR-001 — Choose the smallest honest production-quality competitive loop
Status: Accepted for design validation; not implementation complete
Date: 2026-11-21
Owner goal: build a serious long-lived competitive game on Zama, not a one-off demo
Related: [Production Charter](PRODUCTION_CHARTER.md), [Live testnet tracker](https://github.com/Iniwura/Gambit/issues/8), [Visual QA tracker](https://github.com/Iniwura/Gambit/issues/9), [Production milestone](https://github.com/Iniwura/Gambit/issues/10)

## The decision

**Develop GAMBIT: Sealed Orders as a high-trust asynchronous competitive mind game.** Start with one genuinely encrypted, independently verifiable **3v3 encounter** and build a complete player experience around it. Extend to strategic multi-round ranked matches only after the single-encounter protocol is demonstrated on Sepolia and blind testers choose to replay.

The game shall have a clear objective, consequential tactics, a readably distinct trio of fighters, an explicit prediction/bluffing decision, genuine encrypted resolution and a result that contains only information the onchain protocol can truthfully certify.

We will *not* build a sprawling 3D action title, introduce a generic card deck, construct token economies or add decorative screens to conceal a weak decision model.

## Why this is the best current decision, not a guarantee

| Design alternative | What it offers | Fatal or expensive drawback | Decision |
| --- | --- | --- | --- |
| Polish the existing five-round local solo loop | Reuses all current code | Does not prove a human mind game; differs from onchain one-round protocol | Keep only as a truthful training mode |
| Real-time 3D tactical arena | Strong visual spectacle | Animation/network costs, hidden-order readability, async FHE latency and build complexity | Reject as core product architecture |
| Confidential card battler | Familiar progression and collectibles | Expands content/economy surface and abandons useful squad engine | Reject unless playtests invalidate squad tactics |
| Asymmetric stealth/heist | Distinct hidden information | New rules and onchain protocol; larger implementation and fairness risk | Preserve as future research candidate |
| Asynchronous sealed-orders 3v3 mind game | Strong FHE rationale and an existing role/formation engine | Must prove meaningful decisions, privacy and two-wallet completion | **Choose, under explicit validation gates** |

No single option can be established as the objectively greatest game from theory alone. We will reject this direction if actual playtesting and security evidence falsify the assumptions below.

## Product rules that should be debated BEFORE writing contract v3

1. **The decision:** Every round has a public reactor objective and hidden three-fighter tactical orders. Players can see the classes/choices available but cannot inspect an opponent's selected current orders.
2. **The information asymmetry:** FHE is required because each player can commit secrets before the resolution without allowing a contract observer or challenger to see or front-run those orders.
3. **The stakes:** Role bonuses are meaningful but not overwhelming. Scout, Guardian and Striker must have distinct payoff effects. Formation changes matchups without creating an always-best arrangement.
4. **The readable outcome:** v2 reveals aggregate score only. We may animate squad-level pressure or verified victory, but must **never fabricate lane winners, secret tactics, individual attacks or opponent mistakes** as authenticated onchain details. Local practice may teach actual lane outcomes because its data is intentionally cleartext.
5. **The learning:** After v2 online play, show score, verified state, role selection *the player themselves submitted* if preserved privately on that device with informed consent, and strategic suggestions that do not assume unseen enemy plans. No false tactical replay.
6. **The flagship risk choice:** A proposed once-per-match “GAMBIT” commitment is an experiment. It must be modeled with pure rules first and evaluated for dominance, information leakage, HCU, and clarity. If it fails blind tests, reject or change it without touching the deployed v2 contract.
7. **Sessions:** Onchain actions and signed public decryption can be asynchronous. The UI must explicitly model waiting, timeouts, reminders, recovery and cancellation states. Do not promise sub-second real-time fights without live measured latency.
8. **Progression:** Verified match history and optional rematches before artificial rank, currencies, cosmetics or token incentives.

## Critical path to the first authenticated match

1. Verify production branch version, exact Sepolia 11155111 chain, v2 runtime hash, available owner and invited **distinct** wallet public addresses, and real test ETH fee capacity.
2. Signed owner seal with explicit scope, bounded fees, and an *existing trusted signing environment*. No private keys or seed phrases in GitHub, chat, logs or analytics.
3. Verify SquadSealed receipt and canonical squad invitation state.
4. Invite, open and submit challenger squad with distinct wallet; verify onchain ownership and fresh signed cipher inputs.
5. Execute encrypted resolve, verify public result handle and network computation; capture actual gas/HCU/decryption timing where observable.
6. Obtain Zama signed public decryption proof; finalize in a distinct consented transaction.
7. Read canonical finalization and independently verify the same result in a wallet-free browser.
8. Intentionally test failures: wrong wallet, wrong network, lost receipt, RPC outage, expired/claimed invitation, duplicate submission, inconsistent or malformed proof, browser refresh.
9. Run the entire path again from a second real match before calling the workflow repeatable.

**Current blocker:** the live two-wallet seal/open/submit/resolve/finalize has not been executed. Green mock tests and the presence of a deployed bytecode hash do not satisfy this gate.

## Make gameplay compelling before buying visual complexity

Design test for the **first 60 seconds** of play:
- What is the single visible objective?
- What do I know about my opponent, and what remains hidden?
- What do I predict they will do?
- What risk am I taking by trusting that prediction?
- What feedback is safe to show after a result?
- Why would I rematch?

A player must be able to answer these from the UI, not from a lengthy explanation or jargon.

Validate with independent blind players. Targets:
- At least 4 of 5 explain the objective and make their first decision without live coaching.
- At least 3 of 5 voluntarily request a rematch.
- Tactics and formations produce meaningful, reproducible variation and no trivially dominant fixed strategy in adversarial search.
- No one believes a fabricated lane event or simulated result was genuine onchain evidence.
- Observe and report actual interaction, abandonment and network wait times instead of declaring a 60-FPS or 2-minute match from a mock.

These are internal acceptance targets, not proof of market retention or official Zama requirements.

## Deliberate architecture

**Rules engine:** pure deterministic battle function; no visuals, wallet or RPC dependency. Versioned golden vectors shared with Solidity parity tests.

**FHE contract:** minimal encrypted input/transform/output boundary, signed public score proof, clear onchain state machine, anti-replay/expiry invariants. Avoid v3 contract changes until live v2 is exercised and signature mechanic passes a rules-only study.

**Client/gameplay:** Phaser for combat and 2.5D presentation, native accessible UI for complex forms, multiplayer lobby and settings; strict state separation for local practice / onchain pending / verified match. No HTML overlay to fake battle events.

**Data:** only public match IDs and immutable verified outcome recorded publicly. Never persist or transmit private tactics to telemetry. Local drafts, if later supported, require an intentional privacy/storage design and explicit consent.

**Operations:** reproducible build, exact deployed contract manifest, rollback, error redaction, mobile performance and accessibility checks, real transaction recovery tests, independent code/security review.

## Decision gates

**D0 — stop feature inflation:** no extra maps, skins, rewards, ranked ladder or voiceovers while onchain match and gameplay enjoyment remain unproven.

**D1 — full cryptographic proof:** one real finalized result with both-wallet evidence, followed by a repeatable match and wallet-free verification.

**D2 — rules quality:** gameplay tests show non-dominant strategies, understandable counterplay and deliberate risk. Only then experiment with the one-use GAMBIT mechanic.

**D3 — production visual system:** original, consistently modeled and animated fighters plus professional game audio, legibility, responsiveness, touch and keyboard navigation; professional manual review of screenshots, not CI alone.

**D4 — operational readiness:** safe recovery, audit/threat model, telemetry privacy, privacy notice, provenance, performance and accessible UX.

**D5 — external proof:** blind player evidence, independent security feedback and verified real user-to-user testnet games. The public game must stand alone without a judge explanation.

## Stop/continue criteria

Stop and reassess the game design if people fail to understand the goal, if rematches are not wanted, if a single tactic dominates, if revealed aggregate results make play incomprehensible, or if real FHE latency makes the chosen synchronous loop unusable.

If FHE becomes an expensive add-on to a game whose fundamental mechanic could work equally well as public rock-paper-scissors, reconsider the hidden-information design before adding more UI.

## Accountability

For every substantive change: record hypothesis, alternatives rejected, threat to fun/privacy/reliability, tests performed, screenshot/play evidence, what remains unknown and whether it ships. Preserve user agency: **no transaction or fee is authorized by this ADR**. No guarantee of a prize or perfection is possible; production quality is an evidence gate, not an adjective.
