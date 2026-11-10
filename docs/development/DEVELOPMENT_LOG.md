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
