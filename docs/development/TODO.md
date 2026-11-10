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
- [ ] Detailed item review and provenance-preserving corrections; original source excerpts never overwritten.
- [ ] Reviewed approval plus separately labelled Approve All with explicit risk acknowledgement; both revision-bound, neither establishes source authenticity.
- [ ] Renew acceptance after substantive educational edits; parent guidance and household validation. Independent households must not require approval for each eligible assignment.
- [ ] Define minimal local intake/lesson-management UI separately; FC-004 exposes only a protected/narrow service foundation.
- [ ] Validate with at least two additional worksheets before AI/OCR.

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
