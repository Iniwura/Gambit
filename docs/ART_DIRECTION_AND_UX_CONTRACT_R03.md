# GAMBIT — Art direction & full-game design contract R03

**Review status: PROPOSED, not locked.** This is the creative production target for the Blender artist and UX designer. Owner approved the four benchmarks, not the finished art. Do not implement visual changes in Phaser before the owner approves the final preview. Preserve all functional work on build/verified-first-slice; no blockchain operations.

## 01. The game we are designing

GAMBIT: Sealed Orders. A competitive five-round game in which commanders program three operators' confidential orders to contest an orbital reactor. The art fantasy is an industrial orbital installation occupied by independent tactical crews: grounded, stylized, slightly worn, readable at a glance. A focused premium strategy game, not a generic military shooter, crypto console or dashboard.

Reference priorities:
- Tactical Breach Wizards: cutaway stage readability, stylized proportion, deliberate pose, compact compositions.
- Gears Tactics: believable material separation, environmental lighting and purposeful detail; aspiration, not a promise of AAA fidelity.
- XCOM: Chimera Squad: distinct playable characters with equipment, faces and strong role identity.
- Into the Breach: decisions and state take precedence over decoration.
No copied assets, maps, character likenesses, logos or UI skins. No generic neon hologram clutter.

## 02. Visual identity (proposed design direction)

Name treatment: GAMBIT in an uppercase tightly tracked condensed wordmark, not a chrome 3D text effect. Two interlocking angled wedges separated by a diagonal negative-space cut suggest opposing concealed orders. Mark works monochrome at 24 px. Secondary title SEALED ORDERS is only on boot/title, not repeated across every screen.
Typography: Barlow Condensed Bold display, Inter Medium/Regular controls and body, IBM Plex Mono for counters and proofs. Sizes at 1600x900: display 76–108, screen title 44–56, section 24–28, HUD number 34–48, buttons 15–17, body 16–18, metadata minimum 13. Target readable mobile body 14–16, touch targets >=44x44 CSS px. No font files bundled; obtain licensed fonts from their official sources.
Palette (sRGB): void #10161B, graphite #182127, panel #222D33, edge #45565D, paper #EEE9D9, muted #B3C0BD, primary gold #E7CC82, friendly cyan #7DCEC8, rival rust #DB8C69, verified #A7D6A0, error #EF9B88. Colors have roles, not decoration. Faction identification also uses a wedge versus a split chevron, labels, and patterns. Do not rely on red/green alone.
Shape grammar: square edges, short 45-degree chamfer on primary action, 1 px thin keyline only when needed, solid panels and matte translucent overlays. No website nav, pill storms, giant card grids or luminous outlines. Main menu text-led over the scene. Status HUD only relevant in gameplay.
Motion: 120 ms press/hover; 180 ms selection; 220 ms drawer; 350 ms dissolve; 700–1200 ms deployment/debrief scene beat. Reduced-motion variant: instant layout change + short opacity transition. No fake progress percentage. Real pending states remain visible.

## 03. World, camera, composition

World locations:
- HQ / Command deck: a lived-in orbital operations room. Three operators occupy left/middle scene near a tactical table; muted starfield through rear window, amber utility fixtures, cooled monitors, scuffed steel. Leave left 28% uncluttered for vertical menu or frame squad on right. Hero camera 35–50 mm equivalent, gentle angle, not extreme perspective.
- Arena / Reactor 01: modular cutaway industrial room with three visually separate contested sectors on the central axis. Two opposing deployment sides. Raised service catwalk at rear, machinery around perimeter, thick deck/floor structure, conduits and safe clear central lanes. Reactor at rear, not obscuring a sector. No maze of crates, random obstacles or claim of spatial collision/pathfinding.
- Training / simulation bay: same modular construction, cool soft ambient, neutral practice projections and clean markings; identical readable role placement. Reuse approved models.
- Blacksite / vault: compact security control room, one dominant sealed vault door centered behind the input terminal, physically believable locks and cables; heat feedback via light states, not random explosions. No claim of real-time infiltration movement.
- Commander: intimate operations desk, uniformed player avatar/role portraits and a physical wall/display for earned medals. Verified history remains accessible and honest.

Arena camera: orthographic 3/4 elevated view, target approximately 30°–38° elevation, 35°–45° azimuth, maintain fixed scale and screen-space composition throughout planning. Adjust camera only for readability. At 1600×900, stage occupies x=0..1600/y=104..690 with safe region x=130..1470/y=130..650; HUD covers top/bottom, not characters. Three control-sector centers target screen-normalized x=.28,.50,.72, at y=.46–.60; own crew visually distinguishable lower/left side, rivals upper/right. Exact player formation must not be visible to rival. Neutral standing arrangements only for hidden rival formation; never infer/reconstruct lane outcomes from aggregate FHE score. Decorative scenery may not imply selectable terrain or pathfinding.

Model details: silhouette first, blockout then bevels, material assignment, believable structural joins. Large architecture / medium props / small details at roughly 70/25/5 visual attention. Keep sector rims and characters brighter than walls. Distinct surfaces: desaturated painted steel, darker rubber, exposed copper/brass, frosted emissive glass, scratched edges, stencil marks, matte fabric. No indiscriminate surface noise. Use a cool broad key, warm practical rim, softer fill, contact shadows and restrained atmospheric haze. Avoid pitch black scenes, oversaturated emissive lighting, bloom that obscures controls. Render in Blender with AgX or comparable managed color, inspect both desktop and 390px phone scale. Maintain chosen camera after approval.

## 04. Character art contract

Original individual humans, not three identical robots. Proposed identities; names/costumes must be approved:
- Scout / Kestrel: lean athletic adult, agile silhouette, short asymmetrical field jacket, tapered light armor, compact sensor/bracer, head-mounted recon optic, visible expressive face in portrait. Cyan/neutral utility material. Gesture: forward lean and scanning, not permanently crouched.
- Guardian / Bastion: broad older adult with substantial shield and heavy chest/shoulder protection, squared stance, reinforced boots, distinguishable face and practical helmet. Bone ceramic armor over dark cloth. Large rounded-angular shield is readable in silhouette.
- Striker / Rook: medium muscular adult, asymmetrical breach armor, compact stylized energy tool, orange/copper utility trim, assertive pose, distinct facial structure and hair. Never rely solely on tint to differentiate.
Human portraits with personality, purposeful anatomy, visible faces, stylized but credible proportions. In-stage character height ~100–150px at desktop preview; identify class at 48px tall. Neutral faction palette tint only on equipment/base rings and role symbols. Each must have an identifiable pose, role prop and silhouette.
Required each: front/side/back turnaround at matched scale, 3/4 hero full body, portrait crop, silhouette check at small size, material sheet, separate editable model/rig, consistent floor anchor and camera. Animations: idle 2–3s, select 0.3s, ready 0.5s, local Strike/Guard/Flank reactions, mark/block/breach effect, aggregate-only online ready/celebration/defeat, 0.5–1.2s action clips. Do not show invented individual attack outcomes in confidential matches. Preview keyframes/storyboards before full animation work. No rig or spritesheet completion claim from still render.

## 05. Exact desktop composition (1600x900 base)

All coordinates are design targets in pixels, scalable within 16:9. No web page scrolling during core play. Reserve 32px outer safe margin. Game backdrop fills screen, overlay text and controls are editable, not baked into artwork.

| Screen | Scene / overlay arrangement | Primary action |
|---|---|---|
| 01 Boot | dark full screen; emblem centered (100px); wordmark centered below (84px); thin progress at x560 y680 w480; show actual asset stage, retry failure | Start only when assets ready |
| 02 Main command deck | HQ full bleed; wordmark top left x64 y54; vertical game menu x64 y270 w330, items 56h; characters on right; small settings and audio at bottom | Play Arena |
| 03 First-run | Training scene; short three-step coach at bottom x80 y690 w1440; one meaningful move; no wallet request | Make first choice / skip |
| 04 Mode / Arena lobby | Arena staging render left 920px, clear roster; right x1010 y130 w530: Create / Join / Resume; invitation state and network only when relevant | Create or join |
| 05 Create / invite | Same lobby; right overlay participant address, invite token after receipt, copy/share, recovery. No guessed opponent readiness | Review creation / Copy invite |
| 06 Squad preparation | Three full-body operator renders across center, role tabs bottom. Role details on right; formation examples shown visually. No equipment purchases or loadouts not in rules | Begin planning |
| 07 Deployment | Full Arena render with 600–1000ms camera staging; match/round title and target objective at top left; optional skip | Plan round |
| 08 Planning | Full scene. Top 96px HUD: left mode/exit; centered score + five round markers; right live deadline and opponent sealed status. Bottom y692..900 command deck: three role tabs x32..390, command editor x410..1060, formation/GAMBIT x1090..1370, action x1380..1568. Keep scene dominant | Seal orders |
| 09 GAMBIT activated | Same plan; three sector selectors numbered I/II/III, spent vs available; disclosure activation public and target private; show when valid under actual contract | Seal orders |
| 10 Review / wallet | Backdrop dimmed; centered 620x540 review panel, actor, network, contract, action, round, zero value, current max fee, privacy text, back/confirm. Never skip actual consent | Confirm in wallet |
| 11 Encrypt / pending | Arena retained; short status ribbon bottom, phase label and elapsed time, cancel before submission if safe; receipt hash after known dispatch, unknown-dispatch warning and reconciliation | Return to command / inspect |
| 12 Waiting for rival | Arena atmosphere/neutral idle. Top current round and known seal flags. Bottom waiting text, time remaining, exit to HQ / refresh/recover. No fake live presence. Actual encryption averages ~85–90s, KMS ~23s; no forced spinner lock | Return to command / check |
| 13 Resolve / finalize | Same view; both sealed, resolve review, then public-result proof review; exact state and known transaction only. No auto-sign or artificial countdown | Resolve / Finalize |
| 14 Round outcome | Full scene + central authenticated aggregate score, delta and five-round markers; abstract reactor pulse reflecting points only. No private enemy move, position or per-role outcome | Next round |
| 15 Victory / defeat / draw | Cinematic squad idle/celebration, central final score and outcome; round breakdown in bottom panel, proof entry secondary | Play again / command |
| 16 Match evidence | Clear scrollable overlay with 5 round results, verified receipt links, canonical match ID, explorer/source labels; no fake records | Back |
| 17 Tactical Academy | Same gameplay HUD in clean practice room, coach prompt/contextual highlight, local-only label, skip hints, lesson debrief with real local lane outcome | Make move / next |
| 18 Blacksite mode select | Vault scene; Local practice vs competitive only if verified available; Warden creates, Operative joins; clearly labeled mock/local if not deployed | Select role |
| 19 Warden setup | Four glyph slots and four glyph choices, encrypted code review; opponent identity and invitation; code visible only locally to warden | Seal code / invite |
| 20 Operative terminal | Vault in upper 60%; lower four glyph slots, four choices, attempt tracker 1..5, heat and verified clue log; Stealth/Probe/Breach choices with real tradeoff | Seal attempt |
| 21 Blacksite processing | Actual submitted/resolved/finalized status, review/receipt/recovery overlays; cannot reveal raw code or guesses publicly | Resolve / Finalize |
| 22 Blacksite debrief | Door open only after authenticated breach, locked/expired alternatives; actual score/heat/attempts; receipt when available | Retry / command |
| 23 Commander | Scene-backed identity left, verified record/history right, earned XP/level/medals only from valid verified records. Empty state for new player, public call sign edit | Inspect match |
| 24 Settings / pause | Darkened current scene, narrow list with volume sliders, mute, reduced motion, graphics preset, controls, accessibility. Preserve match and pending transaction state | Resume |
| 25 Recovery / errors | Same relevant scene; wrong chain/account, lost wallet, stale round, rejected signature, encryption failure, known pending, ambiguous dispatch, expiry; precise recovery text, no retries when unsafe | Context-specific safe action |

Prototype also includes mobile 390x844 and landscape 844x390. Portrait: 56px top HUD, world ~300–330px, role strip, bottom sheet command editor with independently scrollable controls if necessary, fixed primary action above safe area, no horizontal overflow. Buttons >=44px. Landscape: world centered, compact side drawer or bottom tray. Always retain match status. Responsive composition, not shrunken desktop.

## 06. Interaction contract & state coverage

Arena: actual STRIKE/GUARD/FLANK choices for opening, trigger, response per operator, HOLD/PIVOT/FEINT formation. Once-per-match GAMBIT only if live state allows; activation public and target private; no invented action names. Public round aggregate score only in encrypted mode. Do not invent health, ammo, movement, character death, K/D, cooldowns, combat log or spatial controls. Local Academy may show genuine lane outcomes. Clear separation local versus Sepolia.
Blacksite: four glyph slots, max five attempts; STEALTH exact only +0 heat; PROBE exact/misplaced counts +1 heat; BREACH exact +2 heat; only exact code with BREACH completes. After authenticated feedback approach can be inferred from packet/heat; do not claim approach permanently secret. Do not publicly expose guess/code. Score/heat/outcome from real verified records only. Warden/operative separate roles. Candidate may still require deployment and acceptance; no competitive verification claims until proven.
Commander: real Arena #1 example 6:4, five finalized rounds; record actual participant/score if preview explicitly labels sample or real evidence. No fictitious ranked history or badges. Profile progression derives from verified records.
Wallet: contextual only, no Web3 jargon on boot. Display exact transaction review and fee bounds; no hidden consent, automatic dispatch or retries. Unknown dispatch requires reconcile. Resume must restore public state; unsealed private orders may be lost intentionally, never persist secrets. A match may expire; do not fake win.
Component inventory: wordmark/mark, boot progress, mode menu item, button default/hover/focus/pressed/disabled/busy, icon button, role selector, action segmented selector, formation selector, sector selector, round tracker, score, seal-state marker, status ribbon, instruction coach, glyph key/slot, heat/attempt counter, dialog, invite input/copy, sliders/toggles, proof row, debrief result, accessible error banner, medals earned/locked. All keyboard focus and touch states.
Sound map: boot motif 0.8–1.2s; menu soft click; selection tick; seal success low confirmation pulse only after authentic state; encryption loop optional low ambient; reveal pulse tied to authenticated outcome; local role VFX sounds; Blacksite heat warning subtle; debrief motif. Separate music/SFX, default moderate volume, mute/volume settings, no loud surprise. Original or verified licensed sounds. Do not spend.

## 07. Blender render handoff & asset inventory

Continue existing v002 work, do not rebuild from scratch until actual preview reviewed. Codex log reports isolated Windows Store Blender workspace, first render and corrected portrait backdrop. Verify actual v002 .blend and images, resume missing renders; do not overwrite v001. Store isolated working directory until safe real Git checkout. Do not clone into/overwrite existing art outputs. If needed create clean checkout beside it and copy only reviewed files/specs. No keys, build credentials, proprietary game assets.
Proposed layout:
art-production/
  source/arena.blend, hq.blend, training.blend, blacksite.blend, commander.blend
  source/operators/{scout,guardian,striker}.blend
  scripts/ (Blender build/render scripts)
  previews/v003/{arena_clean,arena_units,arena_lighting,hq_title,training,blacksite,commander}.png
  previews/v003/operators/{role}_front,side,back,hero,portrait,silhouette.png
  previews/v003/motion/{role}_idle,select,local_action,online_reactor_feedback (storyboard or video)
  exports/environment/ (clean scene plates and separate occluding foreground/background layers, shadows if useful)
  exports/characters/ (transparent RGBA source frames/atlases, stable pivots)
  exports/ui/ (SVG mark, icons, tokens)
  manifest.json (source, version, dimensions, camera, material, license, review status, SHA256, dependencies)
  REVIEW.md (render contact sheets, benchmark comparison, issues, revisions)
First deliverables (before production integration): actual 1600x900 or 1920x1080 scene plates, no UI text baked; separate clean arena, neutral staging version, own/rival units, transparent sprites, portrait/turnaround sheets. HQ and mode scene plates may reuse reviewed modules but have distinctive lighting/composition. Preview shots use 1600x900; character renders 1024x1024 RGBA, turnarounds 1536x1024 or higher. Preserve source resolution. Later export atlases max 2048/4096 texture depending device memory, trim/pack with 2–4px padding and stable floor pivot; compressed background WebP/PNG with tested visual quality; 24fps preview for motion, performance-budget frame counts determined after review. Mobile target 30+ fps and desktop 60fps where practical, measure on real hardware rather than claim. Start compressed playable art budget <=15MB initial transfer proposed, lazy-load other modes. Do not degrade approved art to hit arbitrary budget; measure and revise.

## 08. Review gates (do not skip)

A. Inspect existing v002 images; record actual flaws against benchmarks, choose keep/refine/reject. Provide .blend paths, render paths and contact sheet. Check camera framing, no black sheets, all role models present.
B. Approve ONE Arena screenshot with real Blender render + editable game HUD, three character sheets, palette/type/brand sheet. Compare side-by-side with approved references; reject generic procedural quality. Do not expand low-quality art.
C. Compose all desktop and mobile screens using actual scene assets, all 25 screen families and their state variants. Connect Figma prototype from boot → menu → all four pillars → return; include round loop, state recovery, settings. Motion/audio previews and asset sheet. Sample data explicitly marked.
D. Owner approves visuals, UX, character identity, art asset manifest and animations. Only then create integration branch and implement with existing controllers. Regression and real player tests follow. A design proposal, local render, screenshot or passed code test does NOT equal design lock.

Design review workspace: https://www.figma.com/design/BFKGcmON6Gh6KQlRLI35Po
This specification defines exact creative and composition targets, not an assertion that Blender v002 or any Figma concept already meets the benchmarks.
