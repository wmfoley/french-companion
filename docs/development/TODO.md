# Development Backlog — v0.1

## Gate 0 — owner approvals
- [x] Approve ADR-0001 (Expo-first) and reconcile PRD architecture wording.
- [ ] Create private Git repository and dedicated VS Code window.
- [ ] Confirm no child identifiers are included in fixtures.

## FC-001 — Initialize Expo repository and quality gates
**Status:** Implemented; automated checks and headless web navigation passed. Android/human visual review untested; tooling advisories documented. Private remote repository and dedicated-window confirmation remain owner checks; no remote actions taken.
- [x] Inspect current repository before changes; report any existing files.
- [x] Scaffold supported JavaScript Expo + Expo Router app with version-pinned dependencies.
- [x] Create proposed `src/core`, `src/content/fixtures`, `src/components`, and `tests` structure.
- [x] Add scripts for lint, unit test, and app startup; document exact commands.
- [x] Add minimal home screen and placeholder practice screen with no fake backend calls.
- [x] Add one pure JS sample grader plus unit tests (including accent-sensitive failure).
- [x] Keep `.env` secrets ignored and add safe `.env.example` only if needed.
- [x] Run tests and launch web preview; document Android test status honestly.
- [x] Update development log and TODO.

**Exit:** App starts in web preview; test suite passes; code has no remote services, no secrets, and no references to the equipment platform.

## FC-002 — Reference assignment and schema
**Status:** Implemented; reference content remains `pending_review`, unverified against the original worksheet. See assignment model specification and final verification in development log.
- [x] Copy PRD section 5 reported content into an anonymous reference fixture without claiming verified worksheet transcription or inventing missing content.
- [x] Define schema version 1 and pure validation/normalization, with preserved sources separate from field-level provenance and interpreted content.
- [x] Document draft/pending_review/approved lifecycle, correction explanations, fidelity independence and renewed review after substantive edits.
- [x] Add deterministic fixture, malformed-content, Unicode, preservation and grader regression tests.
- [x] Update architecture, PRD source qualification, test plan, fixture README, root README and development log.

FC-002 handoff originally required parent acceptance before practice. ADR-0002/FC-004 now apply household policy separately: strict mode requires acceptance; independent mode permits eligible pending household content. Keep the checked-in fixture pending and development-only. No generator or review UI was implemented in FC-002.

## FC-003 — First interactive vocabulary exercise
**Status:** Implemented and web-verified; owner reported initial human acceptance for first-attempt success, retry success and two misses. Android/screen-reader validation remains outstanding; fixture stays pending review.
**Scope:** Owner-approved narrowing to vocabulary multiple choice; other exercise types retained below.
- [x] Versioned reference-based exercise representation and deterministic three-option generation.
- [x] Approved-content eligibility; explicitly labelled development-only pending reference demo.
- [x] Two-attempt ID grading, three response outcomes, progression guards and internal first-attempt scoring.
- [x] French-first playable session, retry encouragement, disabled repeated wrong option and participation-focused summary.
- [x] Pure core/session tests and documentation of assignment/exercise/response separation.
- [x] Final lint, tests, web export, browser development/production checks and development log report.

Recommended next milestone: plan local parent review/approved-lesson loading and Android household validation before adding another exercise type. Preserve the development demo exception separately from actual parent approval.

## FC-003A — Practice Randomization
**Status:** Implemented and owner-accepted on physical Android 12 (2026-11-11), including randomization, stable retries/background-resume, completion celebration, replay/reset and strict/independent policy revocation/re-entry. Final review: 108 tests, lint and web export pass; latest Expo dependency check fails because eight newer SDK 58 patches are recommended. Dependencies remain identical to accepted baseline 0c1cda7. Owner explicitly accepted this baseline dependency exception for FC-003A and authorized the milestone commit on 2026-11-11. Patch maintenance is deferred separately; do not upgrade or suppress the check here. Full results are in the development log.
- [x] Pure injectable Fisher–Yates presentation shuffle; copy definitions/options, preserve source ordering, IDs, target associations and distractor membership.
- [x] One authorized presentation per run; stable retries/rerenders/advancement, fresh replay and response reset for household and development demo paths.
- [x] Pending-action guard and visit/run identities; late authorization cannot publish after leaving or replace a newer run.
- [x] Deterministic permutation/immutability, lifecycle/outcome and household-policy regression tests; browser coverage expanded.
- [x] Execute full tests, lint, Expo dependency check, export and browser verification; preserve exact pass/fail results in the development log.
- [x] Owner explicitly accepted the unchanged-baseline Expo dependency-check exception; no dependency upgrade or suppression in FC-003A.
- [x] Owner physical Android acceptance: all planned scenarios passed; detailed results recorded in TEST_PLAN.md. No native APK/build required for FC-003A.
- [x] Owner authorized one local milestone commit after physical acceptance and final review; push remains unauthorized.

## Maintenance — deferred Expo SDK 58 patch alignment

- [ ] Review and plan the eight patch recommendations separately from FC-003A: expo 58.0.23 → ~58.0.24; expo-constants 58.0.15 → ~58.0.16; expo-crypto 58.0.7 → ~58.0.8; expo-dev-client 58.0.18 → ~58.0.19; expo-linking 58.0.16 → ~58.0.17; expo-router 58.0.30 → ~58.0.31; expo-secure-store 58.0.2 → ~58.0.3; expo-sqlite 58.0.15 → ~58.0.16.
- [ ] Obtain separate upgrade approval, reassess current compatible versions, native development-APK requirements and regression scope before installing anything. Retain the dependency check; FC-003A accepts its current failure because manifests match accepted baseline 0c1cda7.
## Remaining core exercise types — future tickets
- [ ] Matching pairs, spelling-error identification, fill-in-the-blank and grammar transformation.
- [ ] Per-exercise grading policies, reviewed keys and hints; plan one type at a time.

## FC-004 — Local Authorization, Persistence and Household Policy
**Status:** Web implementation verified; native household operations unavailable pending verified adapters. Approved ADR-0002 supersedes earlier milestone boundaries.
- [x] One local household/PIN, supervised first setup, salted verifier, persisted cooldown and short-lived opaque parent session.
- [x] Parent-only commands independently enforce authorization, expiry, lock and policy revision checks.
- [x] IndexedDB transactions persist configuration/documents; invalid policy falls back to strict and failed/stale writes cannot enable independence.
- [x] Explicit risk-acknowledged independent-practice opt-in, with strict default and review/fidelity separation.
- [x] Pending student submission interface rejects approvals, parent-correction/verification claims, overwrites and reference demo ID. No intake UI yet.
- [x] Normal practice uses persisted eligibility, unreviewed notice, transition checks and two-second revocation polling. Bundled reference remains development-only.
- [x] Unit/regression tests, repeatable real IndexedDB/two-tab browser checks, lint, export and governance reconciliation.
- [ ] Native adapter implementation and Android verification (required before enabling native household practice; not claimed complete by FC-004).

## FC-005 — Parent review, acceptance and student integration
FC-004N precedes this milestone and has now received formal owner acceptance on Android 12. Plan FC-005 separately before implementation.
- [ ] Detailed item review and provenance-preserving corrections; original source excerpts never overwritten.
- [ ] Reviewed approval plus separately labelled Approve All with explicit risk acknowledgement; both revision-bound, neither establishes source authenticity.
- [ ] Renew acceptance after substantive educational edits; parent guidance and household validation. Independent households must not require approval for each eligible assignment.
- [ ] Define minimal local intake/lesson-management UI separately; FC-004 exposes only a protected/narrow service foundation.
- [ ] Validate with at least two additional worksheets before AI/OCR.

## FC-004N — Android persistence and parent authorization
**Historical blocker (resolved by FC-004N.2B):** slow JavaScript PBKDF2 prompted diagnostics, native proof and validated Android provider integration. Household authentication and final practice-policy checks are now owner-accepted on Android 12.
**Status:** Complete and formally accepted by the owner on Android 12 through FC-004N.2B; automated and prior web regression results are recorded in the development log. Native authentication requires French Companion Dev, not Expo Go.
- [x] Expo SQLite adapter behind the shared storage interface; transaction rollback, revision checks and no credential verifier in SQLite.
- [x] SecureStore-bound salted verifier; Expo Crypto randomness and asynchronous Noble PBKDF2 with unchanged parameters.
- [x] Interrupted initialization/credential mismatch fail closed with retained data; no automatic reset.
- [x] True five-minute parent inactivity on both platforms; explicit interaction refresh, leaving/background lock and concurrent verification guard.
- [x] Parent-authorized, pending development sample; production service/generator exclusion and unchanged source model.
- [x] Native adapter/service tests, web regressions, dependency check, lint and both platform exports.
- [x] Complete owner-reported Android 12 development-client proof, household authentication, background/restart and policy/practice acceptance. Expo Go native authentication is deliberately unavailable; detailed proof timings remain in the log.
- [ ] Screen-reader/device accessibility acceptance remains a separate manual check.

### FC-004N.1 — PIN setup diagnostics and lifecycle safeguards
- [x] Development-only, bounded, secret-free stage timings; on-device panel and console capture instructions.
- [x] Service setup guard and focus/operation identity; cancellation before first household write; complete strict binding after persistence starts.
- [x] Deferred-promise, concurrency, late completion, diagnostic bounds and partial-initialization regression tests.
- [x] Owner captured operation-1 PBKDF2 slow warnings at 10/30/60 seconds with no completion; Android 12 confirmed. No credential-engine replacement implemented.

### FC-004N.2A — native PBKDF2 proof / development-build preparation
- [x] Verified pre-change local history/worktree checkpoint without committing; retain FC-004N/FC-004N.1 changes.
- [x] Separate explicit development identity, internal APK EAS profile and upload exclusions; SDK-compatible dev client.
- [x] Debug/API-26+ local Android module, platform PBKDF2 on a background dispatcher, fixed public vectors only; no credential/storage integration.
- [x] Storage-free test UI and automated vector/controller/config tests; local checks recorded in development log.
- [x] Account/build/install/device/recovery instructions prepared; no accounts/EAS project/build/upload created.
- [x] Owner subsequently built/installed the proof APK and reports both vectors passed four runs each on Android 12; native ~3.6–3.7 seconds, round trip comparable. These are owner-reported results.

### FC-004N.2B — household native PBKDF2 integration
**Final acceptance:** Owner formally accepts FC-004N.2B: authentication, credential/policy persistence, restart/navigation/background locking, masking, inactivity expiry/renewal, development sample loading, strict/independent practice, strict-policy revocation and assignment retention all passed on Android 12.
- [x] Owner reports physical setup and saved-PIN unlock succeed without prolonged PBKDF2 delay. PIN-dot visibility correction also passed physical acceptance.
- [x] Fixed-parameter native household method and capability probe; retained public proof shares the same worker helper.
- [x] Native credential adapter with no JS fallback; missing/old/unsupported native APIs fail closed with clear messaging.
- [x] Preserve hex format, randomness, binding/recovery, service concurrency/cancellation and parent focus guards; unchanged web composition.
- [x] Tests and local verification recorded in development log; physical acceptance procedure prepared.
- [x] Owner subsequently installed and physically tested the updated integration APK. No new build/upload is requested or authorized here.
- [x] Owner verified household creation, saved PIN, restart, lifecycle, masking and both policy persistence on Android; existing data retained.
- [x] Owner confirms sample loading, strict/independent practice eligibility, strict-policy revocation and assignment retention throughout policy changes; final milestone acceptance granted.

Owner reports FC-003 automated and human acceptance on web and a physical Android device, and FC-004 web human acceptance. Earlier milestone notes above describe verification available at their completion.

## Later — Dictation, mixed practice and progress
- [ ] Speech adapter and audio fallback; dictation answer hidden until submission.
- [ ] Mixed quiz assembly after enough exercise types exist; mistake review.
- [ ] Plan privacy-conscious persistent progress/retention/deletion separately. FC-004 responses remain memory-only.

## Future — only after POC exit gate
Android device hardening; camera/OCR; secure AI backend; Supabase; parent-managed profiles; privacy/legal review; distribution.

## CURR-001 — Optional BC Curriculum-Aligned Enrichment (future, not implemented)
- [ ] Parent-controlled, disabled by default; based on reviewed BC French Immersion curriculum references.
- [ ] Teacher-assigned work remains the primary learning pathway. Enrichment stays optional and distinguishable from assignment source material.
- [ ] Review scope and authoritative curriculum references before implementation; no curriculum claims or content generation authorized in FC-003.

## FC-001 final verification — 2026-11-10
- Node 22.23.4 / npm 10.9.9 through terminal-local fnm; no default alias remains.
- `npm.cmd test`: 8 passed, 0 failed; lint passed; `expo install --check` up to date; web export passed.
- Live Expo web preview and headless Edge home -> practice -> home passed with no runtime exceptions/console errors. Android and human visual/accessibility review untested.
- `npm.cmd audit --json`: 12 moderate, no high/critical advisories. ESLint 9 deprecated; compatible Expo plugin update needed before ESLint 10.
- At FC-001 completion, FC-002 was next and not started. No fixtures or child identifiers were included in FC-001; see FC-002 status above for subsequent progress.
