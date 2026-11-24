# GAMBIT — Parallel Visual Production Plan

24 November 2026 · Proposed visual direction, not final art approval.
Branch: design/arena-visual-track. Base: 9cc1d66cbf46a7942e615ef8396fc189f4fbd09e.

## Production boundary

Codex continues live Arena verification on build/verified-first-slice. This branch isolates presentation and art from the live test. Do not change contracts, wallet execution, encryption, result calculations, public-state readers, or fee/approval controls. No automatic merge. Use real existing game controllers when integrating; label any isolated design sandbox as such. Preserve stable controls and accessibility selectors; rebase only after coordination. Never portray private opponent orders or fabricated lane outcomes as verified. Existing full four-pillar roadmap remains authoritative. Competitive BLACKSITE and persistent COMMANDER remain unfinished until actually implemented.

## Art direction

Original premium 2.5D isometric sci-fi tactics: a contested industrial reactor chamber, dark graphite architecture, restrained cold cyan and warm amber opponent signals, readable silhouettes, purposeful lighting, minimal UI. No generic crypto dashboard, glass-card maze, neon overload, copied game assets, or mandatory wallet on entry. Retain the existing three fighters and tactical vocabulary. Scout: agile narrow silhouette; Guardian: armored defensive silhouette; Striker: heavier breach silhouette. Give each original identifiable equipment and pose. Use a consistent sprite/animation rig, camera, scale and palette. One outstanding arena first rather than many mediocre maps.

## Screen hierarchy and interaction

- Home / command deck: title, immediate Play Arena and Training, Blacksite and Commander entrances. Actual availability labels, no invented statistics. Optional public proof viewer.
- Arena lobby: Create or Join, player readiness, invite, reconnect. Account and network details as contextual controls rather than page centerpiece.
- Arena play: arena and three reactor sectors central; top compact round tracker, public cumulative score, opponent readiness and deadline; player squad selection and tactical editor at bottom; one primary next action. Current role's base, trigger and response choices; formation preview and once-per-match GAMBIT with clearly disclosed public activation. Opponent orders never rendered. Clear encryption, wallet review, pending receipt, opponent waiting, resolution and verified result states. Preserve exact fee/approval review. Animations consume only authorized public data; no inferred hit sequence or individual lane outcome for confidential rounds. Local training may display real local lane outcomes, explicitly labeled local.
- Training: same visual language and tactical controls with step-by-step contextual coaching, bots and actual post-match lesson results.
- Blacksite: distinct original security-facility scene, tactical glyph terminal, attempt/clue feedback and debrief. Render existing local mode honestly, add competitive controls only after real FHE mission exists.
- Commander: identity, authentic match record and verified result links; earned medals/progression only once their real data model exists. Empty states, no seeded fake records.
- Mobile: preserve playfield and round status, bottom command drawer with large touch targets, minimal horizontal scroll, responsive orientation. Keyboard focus, color-independent team cues, reduced motion and mute.

## Delivery sequence (target, not a time guarantee)

1. One approved art-direction frame, palette, type and icon system; character turnaround/sprite plan and reactor environment.
2. Implement responsive shell and battle HUD on isolated presentation branch; build component/state matrix from actual gameplay adapters, no fake live states.
3. Deliver arena environment, three character art sets and meaningful feedback; use optimized textures, movement, particles and sound, with an explicit asset provenance manifest. Verify game readability at phone scale.
4. Apply reusable system to Training, Blacksite and Commander; only connect working features, integrate remaining real controllers when functional track delivers them.
5. Merge presentation with latest verified functional branch after coordinated review. Full desktop/mobile/tablet browser playthrough, real live match regression, accessibility, performance profiling, and independent player feedback; then capture demo.

## Acceptance

A new player can reach a meaningful training decision quickly, know which role/round they control, understand lock/wait/final states, recover after navigation, distinguish local and confidential outcomes, and finish a match without needing chain expertise. Verify at 360/390/768/1280/1440 widths, keyboard/touch, reduced-motion mode, no clipping, console errors, phantom wallet writes or misleading onchain visuals. Aim for 60 fps on reasonable desktop hardware and usable mobile frame pacing; measure rather than claim. All final art original or appropriately licensed and documented. Existing functional QA and live protocol correctness are hard release gates. Never claim a polished frame is a working feature.

Status: planning checkpoint only. No rendered assets, UI implementation, player tests or final art approval claimed.
