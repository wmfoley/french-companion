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
- [ ] Transcribe reviewed anonymous worksheet content from PRD section 5.
- [ ] Define schema and validation for teacher content vs extra practice.
- [ ] Add deterministic fixture-based tests.

## FC-003 — Core exercises
- [ ] Matching, spelling error, fill-blank, grammar transformation.
- [ ] Per-exercise grading policies and hints.

## FC-004 — Dictation and mixed session
- [ ] Speech adapter and audio fallback; answer hidden until submission.
- [ ] Mixed quiz assembly and mistake review.

## FC-005 — Parent guide and household validation
- [ ] English parent explanation and privacy-conscious local progress.
- [ ] Validate with at least two additional worksheets before AI/OCR.

## Future — only after POC exit gate
Android device hardening; camera/OCR; secure AI backend; Supabase; parent-managed profiles; privacy/legal review; distribution.

## FC-001 final verification — 2026-11-10
- Node 22.23.4 / npm 10.9.9 through terminal-local fnm; no default alias remains.
- `npm.cmd test`: 8 passed, 0 failed; lint passed; `expo install --check` up to date; web export passed.
- Live Expo web preview and headless Edge home -> practice -> home passed with no runtime exceptions/console errors. Android and human visual/accessibility review untested.
- `npm.cmd audit --json`: 12 moderate, no high/critical advisories. ESLint 9 deprecated; compatible Expo plugin update needed before ESLint 10.
- FC-002 is next, not started. No fixtures or child identifiers included in FC-001.
