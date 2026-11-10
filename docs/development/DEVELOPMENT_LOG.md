# Development Log

## 2026-11-10 — Bootstrap prepared
- Codex governance and proposed architecture prepared.
- No repository scaffolding, database linkage, migrations, or app code executed.
- Awaiting approval of ADR-0001 and FC-001 implementation.

## 2026-11-10 — FC-001 partial implementation
- Owner approved ADR-0001 and FC-001 with explicit Node approval gate. Marked ADR approved; reconciled PRD architecture, POC scope and sequence; aligned architecture baseline and README.
- Verified official SDK 58 stable announcement (2026-10-15), compatibility reference and Router reference. Selected SDK 58, React Native 0.88, React 19.3.0, React Native Web 0.21.0 and Router 58.0.30; exact remaining patches await compatible tooling. SDK index lags the release announcement.
- Installed Node is 20.13.1, below Expo's 22.13.x minimum. No dependency installation, system Node changes or version-manager installation performed. Recommended terminal-local fnm setup for concurrent VS Code projects; awaiting owner approval.
- Added independent CommonJS sample grader and eight built-in Node tests. Case-insensitive, surrounding-whitespace-insensitive, accent-sensitive, NFC-normalized comparison; original response retained. Internal whitespace/punctuation preserved; invalid types rejected.
- Added `.gitignore` for environment secrets and generated artifacts. No fixture transcription or source-text changes.
- `node --test tests/gradeAnswer.test.js`: initial sandbox run failed with EPERM resolving the user directory; approved outside-sandbox retry exited 0, 8 passed, 0 failed.
- Lint, Expo install checks, web export, browser preview and Android testing not run. No package configuration or app scaffold yet; FC-001 incomplete. No commits, pushes, deployments or remote integrations. Complete FC-001 after Node approval; FC-002 follows.

## 2026-11-10 — FC-001 implemented and verified
- Owner approved fnm setup. `winget install --id Schniz.fnm --exact --accept-source-agreements --accept-package-agreements --disable-interactivity` installed fnm 1.39.0; winget registered its alias/user PATH entry. No system Node replacement or PowerShell profile edit. fnm first-install default alias was detected and removed with `fnm unalias default`; final list has no default.
- Each execution terminal explicitly initialized fnm and selected Node 22.23.4. Verified `node --version` (v22.23.4), `npm.cmd --version` (10.9.9) and resolved executable under `C:\Users\wmtfo\AppData\Local\fnm_multishells\70976_1794326340703\node.exe` before dependency installation. Initial command-name discovery and blocked npm.ps1 attempts were corrected using the explicit fnm path and npm.cmd, without execution-policy changes.
- Added `.node-version` (22), package manifest/lockfile, Expo config and flat ESLint config; installed only essential Expo Router/web runtime packages and approved lint tooling. Exact pins documented in ADR-0001. Node tests need no third-party test runner; transitive TypeScript lint tooling does not change the JavaScript application architecture.
- Added `app/_layout.js`, `app/index.js`, `app/practice.js`, `src/components/Screen.js` and `src/content/fixtures/README.md`. French-first home and placeholder practice navigation; no learner data, assignment transcription, service calls or feature integrations.
- `npm.cmd test`: exit 0, 8 passed, 0 failed.
- `npm.cmd run lint`: passed with no diagnostics.
- `npx.cmd expo install --check`: dependencies up to date.
- `npm.cmd run export:web`: exit 0, bundled 785 modules and exported dist.
- `npm.cmd run web -- --localhost --port 8081`: preview launched and bundled 855 modules. One-off `node .expo/browser-check.cjs` used installed headless Edge with isolated ignored profile; passed home -> practice -> home, no Runtime exceptions or console errors. Browser then closed. No browser automation dependency added.
- `npm.cmd ls --depth=0`: exit 0, all direct dependencies valid. `npm.cmd audit --json`: 12 moderate advisories, 0 high/critical, through Expo CLI/fingerprint and lint chains. Forced major downgrades not applied. ESLint 9.39.5 deprecated; current React lint plugin peer range excludes 10. These are known tooling follow-ups.
- Android and human visual/accessibility checks remain untested. README, ADR, architecture and TODO updated. FC-001 acceptance checks pass within web scope. FC-002 not started; no commits, pushes, deployments, Supabase connections or sibling-repository access.
- Final source scan found no remote calls, secret-key markers or unrelated-platform references in app/src/tests/config. Local preview stopped with Ctrl+C after verification. Generated dist and one-off browser/audit artifacts remain ignored.

## 2026-11-10 — FC-002 assignment model and reference fixture
- Implemented the owner-approved schema version 1 with refinements: draft/pending_review/approved lifecycle, parent acceptance distinct from source verification, strict supplied educational text, permissive absent content, and preservation-first normalization.
- Added pure CommonJS utilities `src/core/assignments/validateAssignment.js` and `normalizeAssignment.js`. Validation returns path/code errors, checks known fields/types, unique IDs, dates, local asset references, field provenance and reference integrity. Parent corrections require source references and an explanation; approved assignments require approved supplied text. Normalization clones JSON data, defaults collections, preserves wording/source fidelity/status, and offers separate NFC-only comparison.
- Added `src/content/fixtures/grade4-reference.json`: five PRD section 5.1 terms/definitions and three section 5.2 adjective/feminine/adverb examples. All preserved excerpts occur in the PRD. Source fidelity is reported_teacher_content; assignment and fields remain pending_review. No original worksheet verification, invented teacher instructions, definitions or example sentences; no child identifiers.
- Added `tests/assignment.test.js` and `tests/referenceFixture.test.js`: malformed/optional/nested data, provenance, corrections, approval/fidelity independence, Unicode, exact source preservation, normalization nonmutation/copy/idempotence, fixture accuracy and grader compatibility.
- Documented schema/lifecycle/boundaries in `docs/architecture/ASSIGNMENT_MODEL.md`; updated architecture, PRD source qualification (educational source wording unchanged), TODO, test plan, root README and fixture README. Substantive educational changes require renewed review; no revision history, change detector, editing UI or generation system implemented.
- Initial `npm.cmd test`: 27 passed. Initial `npm.cmd run lint` failed on a test-only __dirname reference; replaced with require.resolve. Added three additional validation tests.
- Final verification with terminal-local fnm Node 22.23.4: `npm.cmd test` exit 0 (30 passed, 0 failed, including all 8 FC-001 tests); `npm.cmd run lint` exit 0 with no diagnostics; `npx.cmd expo install --check` exit 0 (dependencies up to date); `npm.cmd run export:web` exit 0 (785 modules, exported dist). Commands run outside sandbox to use the established fnm runtime; no installations or dependency changes.
- Screens, existing grader, package manifest and lockfile unchanged. No new browser/Android test: no UI changes. No external services, Supabase/OCR/AI implementation, commits, pushes or deployment. Existing FC-001 tooling advisories not re-audited or changed.
- FC-002 complete within authorized scope. Before actual practice, parent acceptance of interpreted content is still required; verification against the original worksheet remains a separate human task. FC-003 requires its own approved exercise schema/generation plan, explicit grading policies, source-ID linkage and approved-content eligibility. FC-003 has not started.
