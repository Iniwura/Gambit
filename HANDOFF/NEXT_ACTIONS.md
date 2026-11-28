# Next actions — ordered execution plan

## Gate 0: re-establish source of truth
- Fetch current branch HEAD, PR #5, open workflow runs and recent failed/superseded jobs.
- Inspect changes since last documented green commit.
- Verify run 45985715085 still corresponds to current artifact; check newer Actions.
- Confirm visual branch and separately supplied source archive are accessible.
- Verify prior chat claims in GitHub before relying on them.

## Gate 1: finish functional Stage 1
1. Audit Arena V4 and BLACKSITE controls against real ABIs and current Zama SDK.
2. Finish browser-side Arena V4 private spent-state recovery with participant ACL and no public plaintext/rival access.
3. Exercise real wallet UX with owner-controlled wallet, exact review-before-sign, no automatic transactions. Synthetic-wallet tests are insufficient.
4. Complete canonical transaction/reload/replacement/timeout recovery and two-provider consistency tests.
5. Complete local five-round gameplay and BLACKSITE rehearsal on desktop/tablet/phone; inspect console/network errors.
6. Conduct novice playtests using docs/STAGE_1_PLAYER_ACCEPTANCE_PROTOCOL.md. Record consented comprehension, time-to-first-choice, completion, confusion and voluntary rematch. Do not coach during measured runs.
7. Review balance with self-play, exploit search and independent players. 27:0 is not a balance benchmark.
8. Complete all four pillars; keep planned systems labelled planned.
9. Close P0/P1 defects, update docs and run full CI on exact candidate commit.
10. Obtain independent adversarial technical/gameplay review.

## Gate 2: freeze mechanics and UX
Only after Gate 1: freeze rules/state contracts, end-to-end UI and responsive interaction; approve art direction and asset list; define audio/accessibility; establish visual regression baselines.

## Gate 3: premium production
Integrate original character sprites/models and environments; build state-driven animation/VFX; replace provisional controls with polished contextual controls/HUD; add rights-cleared sound/music; profile loading/FPS/input latency/mobile; preserve privacy disclosures.

## Gate 4: submission
Re-check official rules/deadline. Obtain independent security/privacy/gameplay review. Produce real human live demo (~2 minutes) with clear narration and verifiable onchain flow. Prepare README, deployments, receipts, source, tests and honest limitations. Submit only with evidence.

## Stop conditions
Stop at first confirmed blocker: SDK/ABI mismatch, privacy leak, irreconcilable receipt/state, unknown possibly broadcast transaction, P0 gameplay defect, unavailable/unlicensed essential asset archive. Do not replace functional gates with another documentation tweak.
