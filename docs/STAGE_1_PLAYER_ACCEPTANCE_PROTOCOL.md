# GAMBIT — Stage 1 player acceptance protocol (27 Nov 2026)

Status: READY FOR HUMAN TESTING AFTER LOCAL PREFLIGHT; NOT ACCEPTED.

## A. Preconditions and evidence

- Use the engineering branch, pinned commit from the final clean CI run. Preserve all existing local changes; do not reset the working copy or redeploy contracts.
- Run production typecheck/build and existing deterministic/browser checks. The signed mode is opt-in for controlled testing only; use a separately started local Vite instance with VITE_GAMBIT_CONFIDENTIAL_WRITES=true. The default release remains unsigned.
- Never ask for a private key, mnemonic, decrypted opponent tactic or proof bytes. No financial rewards or ranking. Record actual observations, including failed or incomplete sessions.
- The recorded CLI live matches, synthetic Chromium wallet fixture, and live read-only browser checks are distinct evidence. None establishes actual human fun or a real browser extension's signing UX.

## B. Independent beginner session (wallet-free)

Recruit five independent first-time players, with consent. Record anonymous tester ID, device type and whether they have prior tactics-game experience; no names, addresses or account data. Start on the real game HQ, with no advance coaching. Measure elapsed time from visible HQ to first meaningful order selection. Ask the tester to play the Academy and one full local match; do not substitute a scripted victory. Ask whether they would voluntarily rematch, before suggesting it.

Score each answer correct/incorrect without coaching:
1. Which direct move beats Strike? (Guard.)
2. What does the trigger inspect? (Rival's original opening, not final action.)
3. What does formation change? (The fighter-sector matchup.)
4. What wins the match? (Highest cumulative reactor pressure after five rounds.)
5. Does local practice encrypt orders; do online aggregate scores expose rival plans? (No; no direct disclosure of plans.)

Pass: >=4/5 testers answer all five correctly, >=3/5 voluntarily choose rematch, record individual first-choice latency and number below 30 seconds, report median. Keep raw anonymized observations. Do not invent missing results.

## C. Advanced BLACKSITE difficulty

After the above, open BLACKSITE > Advanced local rehearsal. Let each tester learn the five-glyph/four-attempt objective from the in-game UI. Have them attempt one whole mission, then optionally another. Record actual route sequence, success/lock, heat, score, time to first choice, whether exact/misplaced and BREACH requirement were understood, whether the player felt decisions mattered, and voluntary retry. No secret codes or wallet data. Difficulty is an exploratory result, not a prespecified guaranteed win rate.

## D. Real browser extension acceptance (controlled Sepolia)

Only after automated preflight passes. User must personally control real testnet wallet approval. Before requesting any onchain write, present exact deployment, selected account, action and budget and obtain approval; prior CLI approvals have been consumed. No automatic transactions or retries. Test actual wallet select/authorize/account/network changes, prepare without signing, inspect review, discard, reprepare, then user-approved send if authorized. Verify receipt independently and read new public state. Exercise one real encrypted attempt/order preparation and one real authenticated public proof if the state permits; record actual encryption/proof wait time. Do not claim complete new browser match from a partial run. If own-spent private user decryption is unavailable in browser, state it explicitly; no opponent-spent read and no broad typed-data signing permission.

## E. Raw record template

| Tester | Device | First choice s | Academy finished | Local match result | Q1 | Q2 | Q3 | Q4 | Q5 | Voluntary rematch | BLACKSITE result / heat / score | Retry | Observed friction |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| T1 | | | | | | | | | | | | | |
| T2 | | | | | | | | | | | | | |
| T3 | | | | | | | | | | | | | |
| T4 | | | | | | | | | | | | | |
| T5 | | | | | | | | | | | | | |

## F. Acceptance decision

Stage 1 cannot be marked complete solely because the code builds or the recorded live contracts are functional. Remaining actual human evidence, full signed browser gameplay, own-spent recovery, player experience/balance, and final integrated regression must be reconciled against the authoritative master scope. No final art or demo promotion until this decision. An unsuccessful player session is valuable evidence, not a reason to hide the result.
