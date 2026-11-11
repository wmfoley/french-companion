# French Companion

**Status:** FC-004N adds Android SQLite persistence and SecureStore-backed PIN credentials to the shared local household service. Web retains IndexedDB. Automated checks and exports are separate from pending physical Android acceptance. The reference fixture remains development-only, pending review and unverified against the original worksheet. No remote resources created.

## Current Android development-client acceptance

Owner-reported Android 12 testing confirms PIN creation, correct/incorrect PIN handling, restart persistence, fresh authentication after restart, navigation/background locking, visible PIN masking, inactivity expiration/renewal, and persistence of both household policies. Earlier pending notes below describe historical milestone status. See the [current acceptance checklist](docs/development/ANDROID_HOUSEHOLD_ACCEPTANCE_FC004N_2B.md) for remaining device checks.

In this repository's terminal-local Node environment, reconnect to the installed development APK with:

```powershell
$env:APP_VARIANT = 'development'
npx.cmd expo start --dev-client --lan --scheme french-companion-dev
```

The Metro URL scheme must match the installed French Companion Dev APK. Use the newly generated QR on the same LAN; check the current IP/port and Windows firewall if connection fails. A previous `Android Bundled` entry is not evidence of a current connection. The owner resolved the launch issue without reinstalling or clearing data. JavaScript changes use Metro; native changes require separately approved APK builds.
## FC-004N Android / Expo Go

**FC-004N.2B integration:** Owner reports eight successful native proof runs on Android 12 at approximately 3.6–3.7 seconds. Android household derivation now requires the extended native module; there is no JS fallback. The old proof-only APK/Expo Go stays launchable but cannot authenticate. A new development APK needs separate build/upload approval; preserve the same package/signing identity and update without clearing data. Follow the [exact household acceptance sequence](docs/development/ANDROID_HOUSEHOLD_ACCEPTANCE_FC004N_2B.md). Web WebCrypto and the stored credential format are preserved. Earlier proof-only notes below describe their milestone boundary.

**FC-004N.2A proof prepared:** Android 12 is confirmed. A separate **French Companion Dev** APK profile and storage-free native PBKDF2 proof are ready locally, but no EAS build/upload or native runtime verification has occurred. Household PIN code remains unchanged. See [exact account, build, APK install and test steps](docs/development/NATIVE_PBKDF2_POC_FC004N_2A.md). Build/upload and later household integration each need separate approval. Expo Go/data stay intact.

**FC-004N.1 diagnostic status:** Physical PIN setup remained busy for several minutes while navigation worked. Root cause is unknown; Android acceptance is paused. Use the [safe diagnostic run instructions](docs/development/ANDROID_PIN_DIAGNOSTICS_FC004N_1.md) to launch, read the development-only on-device stage panel/console and capture the next run. No cryptographic parameters or existing data are changed by this diagnostic correction.

See [ADR-0003](docs/decisions/ADR-0003.md) and the [physical tablet acceptance checklist](docs/development/ANDROID_ACCEPTANCE_FC004N.md). Expo SQLite, SecureStore and Crypto support Expo Go; no SQLCipher or biometrics are enabled. After terminal-local fnm initialization and `npm.cmd ci`, run `npm.cmd start` and scan its QR code in a compatible Expo Go installation on the same network. Household data belongs to that installation/project; web and Android do not sync.

Supervise first setup. The six-digit PIN is derived using asynchronous PBKDF2-SHA256 (600,000 iterations); only salt/parameters/verifier are stored in SecureStore, never plaintext. Unlock shows a busy message and rejects concurrent verification. Development builds display total successful unlock duration (PIN derivation plus storage): record cold/warm tablet timings rather than relying on desktop measurements. Five minutes of parent inactivity, leaving Parent Area or backgrounding locks access; polling does not renew it.

Use **Load development sample** inside the unlocked Parent Area to explicitly load pending, unverified reference content. Strict mode blocks it. A parent may explicitly acknowledge risk and enable independent practice to test the labelled sample; practice never approves it or upgrades fidelity. Production service/generator paths reject this sample. No assignment intake or FC-005 review UI exists yet.

SQLite writes are transactional and revision checked. Missing/mismatched credentials or interrupted setup remain locked with data preserved. There is no PIN reset/recovery UI; do not clear all Expo Go data as a repair. SQLite content is not encrypted by this app. Device administrators, modified code or developer tools can bypass a local child-facing gate; this is not account authentication. Earlier FC-004/FC-001 results below describe those milestones at completion; ADR-0003 governs the current native implementation.

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

Normal **Commencer à pratiquer** lists persisted household assignments and applies the saved household policy. The strict default requires revision-bound parent acceptance; explicit parent-enabled independent mode allows eligible unreviewed assignments, with a French notice. Neither mode changes review status or source fidelity. Production builds have no reference demo entry; adding `?mode=demo` cannot promote the bundled fixture. Leaving practice clears its in-memory responses; assignments/policy persist.

## Local parent setup and household policy (web)

1. Open **Parent Area** with a parent present. Create and confirm one six-digit PIN. The installation starts in **Require parent approval before practice** mode.
2. Unlock using the PIN. To permit independent learning, select **Allow independent practice**, read the explanation, explicitly tick the risk acknowledgement, then save. Selecting an option alone does not save anything.
3. Return to student home. Parent access locks on leaving/backgrounding or after a maximum five-minute unlock session. The independent policy stays saved across visits/reloads; the parent need not unlock for each student session.
4. Normal practice can use stored pending assignments when independent mode is saved. Switching to strict mode pauses unreviewed active practice on the next eligibility check; checks occur before transitions and every two seconds. Storage failures also stop practice.

An empty installation has no household assignments. FC-004 supplies a narrow pending-assignment submission service for future intake, but intentionally adds no import/camera/assignment-entry UI and no detailed review/correction/Approve All workflow. Those review operations belong to FC-005. The reference fixture is never seeded into household storage automatically.

Settings are local to this browser profile and origin (including port). Keep using the same preview port for normal use. PIN verifiers are salted PBKDF2, not plaintext; browser data is not encrypted by this application. Developer tools/device control can bypass a local gate. Supervise initial setup. There is no in-app forgotten-PIN reset: clearing site data loses local configuration and assignments. No accounts/cloud recovery. Android household operations deliberately fail closed until native adapters are implemented and verified. See [ADR-0002](docs/decisions/ADR-0002.md).

FC-004 verification: `npm.cmd test` passed 59 tests; lint, Expo dependency validation and web export passed. Real IndexedDB/browser checks covered setup, default strict mode, risk acknowledgement, reload/leave/background locking, protected direct calls, write rollback, serialized updates, stale revisions and policy revocation from a separate browser tab. Mobile-width Parent Area screenshot inspected; no runtime/console errors. Android and screen-reader behavior remain unverified.

To repeat the dependency-free browser check with installed Edge/Chromium:

```powershell
# Terminal 1, after initializing project Node:
npm.cmd run web -- --localhost --port 8083
# Terminal 2, after initializing project Node:
npm.cmd run export:web
node scripts/verify-household-web.cjs
```

The script uses an isolated test browser profile under ignored `.expo/`, a localhost:8082 static export server and debugging port 9333. Set `$env:FC_BROWSER_PATH` for a different installed Chromium executable. It tests synthetic household data via injected test-only module instances, not application debug hooks, and never modifies your normal browser data. Local ports must be free; no upload/deployment occurs.

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
