# Current state — 2026-11-28 snapshot

Re-fetch branch HEAD, PR, CI and files before editing. This snapshot is not a substitute for Git history.

## Product
GAMBIT is an original browser-first sci-fi tactical game. Players program conditional squad tactics, protect strategy with Zama FHE, fight over reactor pressure, complete BLACKSITE codebreaking missions and build Commander identity. Target is a first-place-caliber Zama Season 5 entry; winning and 90+/100 are goals, not claims.

## Work recorded as verified
- Phaser 4.2.1 + TypeScript + Vite game and deterministic local practice.
- Five-round Tactical Academy curriculum and local training.
- Arena v3 Sepolia Match #1: five rounds, 6:4, independently verified.
- Arena V4 research deployment 0x5F9e0030233370a913780EC9CCb58183C4672c13; controlled five-round match, 21 canonical writes, 27:0. Evidence: fhe/deployments/sepolia-arena-v4-live-validation.json.
- Neutral BLACKSITE research deployment 0x33c062aebeB425b53A25E0b370732Cee5f7F97F9; Mission #1 BREACHED, score 35, heat 5, four attempts, 12 canonical writes. Evidence: fhe/deployments/sepolia-neutral-blacksite-mission-1.json.
- Read-only two-provider public debriefs for Arena V4 and neutral BLACKSITE.
- Provisional confidential controls: create/recover, tactical planning, encrypted preparation, exact review, guarded dispatch and receipt recovery. Default signing disabled. Not accepted as a complete real-wallet gameplay loop.
- Advanced local BLACKSITE rehearsal follows five-glyph/four-attempt rules without wallet/network/ranking.
- Commander profile derives Arena v3 public history from authentic evidence; broader progression remains scoped.
- Preserve older SquadGambit v2 and Arena v3 evidence.

## Last fully recorded clean automated acceptance
Build log entry 2026-11-27 records run 45985715085 on commit 0bafcdaaf5cad52ea1fa0beeefe204ece49f134e: four jobs passed; 339/339 deterministic, 44/44 FHE, 7/7 compiled-runtime wallet/receipt fixtures. Browser logs included synthetic-wallet Arena/BLACKSITE fixtures, live two-provider debrief checks, advanced local rehearsal and regressions. Public preflight 45985715024 passed. Re-check newer Actions before calling this latest.
Artifact: https://github.com/Iniwura/Gambit/actions/runs/45985715085/artifacts/15190988268. Default signing disabled; serve over HTTP, not file://.

## Open
Real wallet gameplay and current SDK acceptance; browser-side private spent-state recovery; independent novice comprehension/rematch tests; tactical balance/fun; complete responsive UX/recovery; all four pillars; independent security/gameplay review. Final art/audio only after functional acceptance. Do not mark Stage 1 complete or claim 90+ until evidence supports it. A controlled 27:0 is not proof of competitive balance.
