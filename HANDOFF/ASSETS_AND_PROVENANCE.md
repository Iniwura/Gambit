# Assets and provenance inventory

This folder contains context and links, not a duplicate binary asset pack. It does not claim to include every sprite, model, texture, archive, audio file or local-only asset.

## Engineering branch entry points
- Browser game: index.html and src/main.ts
- Phaser visual modules imported by entrypoint: src/visual/arena and src/visual/characters
- Mode/UI code: src/blacksite/, src/training/, src/profile/, src/arena/, src/architecture/
- Contracts/evidence: fhe/contracts/, fhe/scripts/, fhe/deployments/
- Tests: tests/ and fhe/test/ (inspect actual tree and scripts).

Inspect repository tree and Git LFS pointers before assuming any binary is present. Source code is authority for what the build loads.

## R36 candidate
Branch design/arena-visual-track. Disclosure/UX review docs/R36_DISCLOSURE_UX_AND_REVIEW.md. README reports three animated textured operator models, 3D Arena/Academy/BLACKSITE/studio, local progression and disclosure UX tested offline. README says source archives were supplied separately; candidate is not merged into engineering branch or hosted as new game.

Before reuse, enumerate files and commit history; locate external archives; verify model formats, textures, animation clips, fonts, sound and licenses; compare with engineering branch; obtain explicit integration decision. Do not assume three models cover all six approved fighters or that 3D is final art direction.

Lurais/Verris, game references, screenshots and public skills are external references, not assets. Do not copy wholesale.

For each approved asset record path, format/dimensions, creator/provider, license/commercial permission, editable source/export command, game usage, animation metadata, hash/version and visual QA. Never add secrets, copyrighted music, copied art, unlicensed packs or assets that leak tactics.
