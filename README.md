# French Companion

**Status:** FC-001 implemented and verified on web. JavaScript Expo scaffold, minimal navigation, pure grader and automated tests. No remote resources created. FC-002 has not started.

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
