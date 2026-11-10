# French Companion

**Status:** FC-003 adds playable French vocabulary multiple choice to the FC-001/FC-002 baseline. The reference fixture remains pending parent review and unverified against the original worksheet. No remote resources created.

## Quick start
1. Create a **new, empty private GitHub repository** `french-companion` and clone it to a separate local folder. Do not open the equipment-planning repository in this VS Code window.
2. Copy this package's files into the new repository, preserving paths. Review `docs/requirements/PRD_v0.1.md` and `docs/decisions/ADR-0001.md`.
3. Open only this repository folder in a dedicated VS Code window and start Codex there.
4. Paste `docs/development/CODEX_START_PROMPT.md` into the new Codex session. Ask Codex for a plan and review it before authorizing changes.
5. Complete FC-001 and its checks before any database integration or remote deployment.

**Project separation:** distinct Git repository, VS Code window, environment variables, Supabase project reference, and build artifacts. Never copy credentials between projects.

**Architecture:** ADR-0001 is approved and the PRD architecture is reconciled: one JavaScript Expo app, web validation first, Android thereafter.

## Available verification

Run `node --test tests/gradeAnswer.test.js`. No third-party dependencies are needed for these tests. The sample grader ignores case and surrounding whitespace, normalizes Unicode to NFC, and preserves accents, punctuation and internal whitespace.

Run `npm.cmd test` for the full grader/assignment suite. Assignment schema version 1, provenance rules, lifecycle and API details are in [ASSIGNMENT_MODEL.md](docs/architecture/ASSIGNMENT_MODEL.md). The pure utilities validate data and default omitted collections without changing source excerpts or structured wording. NFC comparison is a separate helper.

The [Grade 4 fixture](src/content/fixtures/grade4-reference.json) preserves the five PRD-reported terms/definitions and three grammar transformations. It invents no teacher instructions or example sentences. Approval accepts interpreted content for practice; it never establishes independent worksheet verification. Substantive changes after approval require renewed review. Editing/revision history remain deferred; FC-003 generation resolves exact assignment text by stable IDs.

## Vocabulary practice

Start the development preview with `npm.cmd run web -- --localhost`. Choose **Démo — contenu en attente de validation** on the home screen, then **C’est parti !**. The label remains visible throughout the five-question session. Each definition has three word choices. Select one, then **Vérifier**. A first miss gives encouragement without identifying the answer and disables the attempted option. After the second attempt the exact term-definition pairing appears, regardless of correctness. **Suivant** advances; **Terminer** shows an encouraging participation summary; **Rejouer** clears attempts.

Normal **Commencer à pratiquer** requires approved content. Because the current fixture is still pending review, it shows an awaiting-parent-validation message. Production builds have no demo entry; adding `?mode=demo` cannot enable pending content. No approval UI or approved-assignment loader exists yet. No storage is used; leaving practice clears the session.

The pure core preserves three outcomes for future practice planning: first-attempt success, second-attempt success, and incorrect after two attempts. Internal first-attempt counts are not shown as a prominent student score. No adaptation is implemented. See [EXERCISE_MODEL.md](docs/architecture/EXERCISE_MODEL.md) for schema, generation, eligibility and session policy. Remaining exercise types and optional parent-controlled BC curriculum enrichment (CURR-001) stay in the backlog.

FC-003 verification: `npm.cmd test` passed all 47 tests, `npm.cmd run lint` passed, `npx.cmd expo install --check` reported dependencies up to date, and `npm.cmd run export:web` passed. Headless Edge verified both retry outcomes, first-attempt success, wrong-option disabling, full completion/restart, Space/Enter/arrow selection, reset after leaving, and production demo blocking. Mobile-width question and desktop introduction screenshots were inspected. No JavaScript exceptions or console errors were observed. Browser verification used a one-off ignored `.expo/browser-check.cjs` script and local static export server, without installing dependencies or deploying. Android and screen-reader behavior remain unverified.

Dependencies are pinned exactly in `package.json` and `package-lock.json`. Do not run a scaffold generator over this repository.

## Windows PowerShell setup

Expo SDK 58 requires Node 22.13.x or newer. This project uses Node 22 through fnm, selected by `.node-version`. Initialize only the French Companion terminal; leave system Node, your PowerShell profile and other project terminals unchanged. See https://github.com/Schniz/fnm for installation and shell setup.

fnm 1.39.0 was installed with `winget install --id Schniz.fnm --exact`. Winget adds fnm itself to the user PATH; it does not replace system Node. In each future terminal opened at this repository root:

```powershell
# The explicit path also works in terminals opened before fnm installation.
$fnmExe = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\fnm.exe'
& $fnmExe env --shell powershell | Out-String | Invoke-Expression
& $fnmExe use
node --version
npm.cmd --version
Get-Command node
```

If Node 22 is missing, run `& $fnmExe install 22` before `use`. Verified runtime: Node 22.23.4, npm 10.9.9; Node resolves beneath the terminal's `fnm_multishells` directory. Use `npm.cmd`/`npx.cmd` because PowerShell execution policy can block the `.ps1` wrappers; no policy change is needed. Do not run `fnm default` or change the PowerShell profile.

After dependencies are available:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run lint
npx.cmd expo install --check
npm.cmd run export:web
npm.cmd run web -- --localhost
```

The web preview serves locally; use Ctrl+C to stop. `npm.cmd start` starts Expo and `npm.cmd run android` requests an available Android device/emulator. Android behavior requires separate device validation.

fnm provides per-shell environments. Avoid nvm-windows switching for this concurrent-project workflow because its shared Node symlink changes the version used by other terminals for subsequently launched commands. No sibling project inspection is necessary.

## FC-001 verification and limitations

Verified on 2026-11-10 with Node 22.23.4 and npm 10.9.9:
- `npm.cmd test`: 8 passed, 0 failed.
- `npm.cmd run lint`: passed without errors or warnings.
- `npx.cmd expo install --check`: dependencies up to date.
- `npm.cmd run export:web`: passed; output in ignored `dist/`.
- `npm.cmd run web -- --localhost --port 8081`: launched and bundled successfully.
- Headless Edge via its debugging protocol: home -> practice -> home; no runtime exceptions or console errors. The one-off verification script/profile live in ignored `.expo/`; no browser dependency was added.
- `npm.cmd ls --depth=0`: passed, no missing/invalid direct dependencies.

Android and a human visual/accessibility review have not been performed. The practice screen is deliberately a placeholder. `npm.cmd audit --json` reports 12 moderate advisories, no high/critical advisories, involving Expo CLI/fingerprint and lint dependency chains. Forced fixes propose incompatible major downgrades and were not applied. ESLint 9.39.5 is deprecated but retained for compatibility with Expo's current React lint plugin (which excludes ESLint 10). These tooling issues remain for follow-up; lint, dependency validation and bundling pass.

fnm automatically created a default alias on first installation; it was removed with `fnm unalias default`. Final `fnm list` shows Node 22.23.4 and system, with no default alias. No system Node replacement or profile modification was performed.
