# Reference acceptance gate — 2026-11-26

Owner target: surpass Vesperfall by a wide margin; overall >=90/100, not an official judge score. R21 internal build is not approved. This is research and execution criteria, not a gameplay implementation claim.

## Source-backed findings
- Vesperfall asset catalog https://vesperfall.mengto.chatgpt.site/asset-catalog : 180 entries, 35 generated images, two imported FBX. Explicit separation of portrait reference, runtime models, art, material maps, world interaction, VFX, audio and fallbacks. Connected five-zone estate, visible lamps motivating light, floor and wall texture consistency. Owner's five screenshots directly show full-bleed world, illustration-grade character selection, restrained corner HUD and prominent outcome state.
- Vesperfall HUD gallery https://vesperfall.mengto.chatgpt.site/hud-gallery : ten deterministic fixtures for ready/equipped/locked/guarding/cooldown/empty/interactions/controller/touch/missing art; 12 CSS px typography floor. Use equivalent GAMBIT fixtures, not copied art or typography.
- Tactical Breach Wizards https://store.steampowered.com/app/1043810/Tactical_Breach_Wizards/ and https://www.gamedeveloper.com/design/tactical-breach-wizards-shows-how-strategy-games-can-tickle-the-funny-bone : compact authored spaces, flat polygon art, role-specific actions and reversible drafting. GAMBIT can preview/edit own unsealed orders only; never infer or reveal opponent secrets.
- Gears Tactics https://www.unrealengine.com/developer-interviews/gears-tactics-uses-the-gears-formula-brilliantly-to-offer-a-fresh-tactical-experience?lang=en : deliberate camera framing and seamless presentation between isometric gameplay and cinematics. Apply to settlement clips, not every click.
- XCOM Chimera Squad https://newsroom.2k.com/news/xcomr-chimera-squad-coming-to-windows-pc-on-april-24-2020 : distinctive agents, breach presentation and interleaved sequence; https://www.youtube.com/watch?v=39fhpegVBQQ identified as official Gameplay Overview. No video playback claimed.
- Into the Breach https://www.subsetgames.com/itb.html : clear consequence language and intentional minimalism; GAMBIT must not copy revealed enemy intents since confidentiality is central. Video ID vw30dENVR2Y associated with Into the Breach by third-party index, not directly played. GnyZegJA61g and 7xEp4bmkJHc could not be identified confidently in this pass. All four direct YouTube watch/short links failed to fetch; do not claim viewing them.

## R21 visual gap and prioritized work
1. Arena art: original industrial facility with distinct architectural silhouettes, meaningful landmarks, textured materials and motivated lights. No exposed diorama edges; protect character and sector readability. Inspect actual planning/settlement frames against owner's Vesperfall screenshots.
2. Operator art: original role-specific silhouettes and equipment, matching portraits and runtime assets. Replace generic iconography with equipment-specific artwork, not merely colored geometric shields. Consistent design language across HQ/Academy/Blacksite/Commander.
3. HUD: icon + concise label + real state; 12 CSS px desktop minimum for essential text, adequate touch hit targets, distinguish selected/ready/locked/disabled/spent/settled; test no-asset fallback and keyboard. Keep game world visible. Only display actions or state that truly exist.
4. Combat: selection -> own order preview -> sealed -> authoritative reveal -> actual action animation -> sector result -> next round; clear sequencing, optional skip/reduced motion, synchronized audio. Never fabricate damage/health or leak hidden choices.
5. Production: merge approved presentation only after regression, local and public-chain integration verification and hardware review. No new transactions without applicable approval.

## Licensed asset sources to evaluate (not yet downloaded/integrated by this record)
- Supplied Quaternius packs, original license files; https://quaternius.itch.io/sci-fi-essentials-kit (CC0).
- https://polyhaven.com/a/metal_plate_03 (CC0 floor material); https://polyhaven.com/a/metal_plate_02 (CC0 wear material).
- https://kenney.nl/assets/modular-space-kit (CC0 modular geometry); use only if coherent with visual target.
- Supplied Sakuga VFX source and MengTo Skills archives: inspect exact licenses and use targeted effects only; do not confuse separate similarly named VFX libraries.

## Proposed 100-point internal rubric
Art/environment 25; operators and equipment 15; HUD and UX 15; combat animation/audio 15; tactical gameplay and FHE integration 20; performance/accessibility/reliability 10. Require >=90 overall and no category below 80% of its own maximum, actual visual evidence and a complete tested match. No score assigned here. Hardware FPS and continuous live WebGL match remain unverified. R21 remains an internal rollback checkpoint.
