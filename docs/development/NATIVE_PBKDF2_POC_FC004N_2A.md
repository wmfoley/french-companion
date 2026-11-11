# FC-004N.2A — first Android native PBKDF2 proof

**2026-11-11 status update:** Owner subsequently built/installed the proof and reports both vectors passed four runs each on Android 12 (~3.6–3.7 seconds). FC-004N.2B now adds household integration locally; see [updated acceptance/new-APK requirement](ANDROID_HOUSEHOLD_ACCEPTANCE_FC004N_2B.md). The preparation/no-build statements below record the original FC-004N.2A handoff, not current owner activity. No further cloud build/upload has been initiated by this integration.

**Prepared locally; no cloud build, upload, account creation or device run performed.** The owner confirmed Android 12 (API 31), satisfying the API 26 minimum. Physical evidence from FC-004N.1 showed operation 1 still inside PBKDF2 at 10/30/60 seconds. This proof does not change household PIN creation/verification or repair existing data.

## Local checkpoint and scope

Before configuration changes, saved `.expo/checkpoints/FC-004N.2A-20261110-131140/`: verified full-history `history.bundle` at `ace54dc0ee6e8b2b922d34eaf28934d5159dc103`, a 56-file `worktree.zip` including pre-existing uncommitted/untracked FC-004N and FC-004N.1 files, staged/unstaged binary patches and a hash/status manifest. No commit or stash was created. The ZIP preserves the worktree bytes; the patches preserve Git diff context. Keep this ignored checkpoint locally and copy it to a private backup if desired; it is excluded from EAS uploads.

Recovery is deliberate: inspect/extract the archive into a separate recovery directory and compare first; do not blindly overwrite the current tree or run reset/clean. The history bundle can reconstruct committed history, then the snapshot restores the saved files. It does not contain node_modules; dependencies can be restored from its lockfile. There is no automated destructive rollback.

One new dependency: `expo-dev-client` **58.0.18**, selected by SDK 58 and exactly pinned. The local module uses the installed Expo Modules Gradle plugin, core/coroutines and Android's platform cryptographic provider; no Quick Crypto, generalized authentication layer or handwritten cryptographic primitive. App code remains JavaScript; the approved narrow Android binding is Kotlin.

## What is prepared

- `app.config.js` preserves the base `app.json`/web/Expo Go config unless `APP_VARIANT=development`. Development uses package **com.frenchcompanion.dev**, installed label **French Companion Dev**, launch scheme **french-companion-dev**, and no generated competing dev-client scheme. The slug stays `french-companion`.
- `eas.json` has only `development`: `developmentClient: true`, `distribution: internal`, `android.buildType: apk`, `env.APP_VARIANT: development`. `cli.requireCommit: false` permits the approved uncommitted worktree; no automatic commit needed. No production profile, updates/channel/publication or EAS project UUID is configured.
- `modules/fc-native-pbkdf2/` is automatically discovered under Expo's default local-modules directory. It uses the established module API, not optional Expo Modules v2. Debug builds only; API 26+; Kotlin `withContext(Dispatchers.Default)` runs the platform `PBKDF2WithHmacSHA256` calculation in a background coroutine, with a native guard held through real completion.
- Its only exposed method is `runProof(vectorId)`. Fixed public synthetic vectors are packaged as a read-only APK asset; there is no arbitrary PIN/salt/iteration entry point. Both use six ASCII digits (one tests leading zeros), 600,000 iterations, 16-byte salt and 32-byte output. Expected values were generated with Node `crypto.pbkdf2Sync` and checked using WebCrypto. These are public test fixtures, not real credentials or claimed published standard vectors.
- Native comparison occurs internally. Only vector ID, pass/fail, duration, Android API and background-thread confirmation return to JavaScript. No key bytes/hex or exception objects are logged/displayed. The JS controller validates and whitelists results. No SQLite, SecureStore, household service or credential operations are invoked by the test screen/module.
- Android development home links to `/native-pbkdf2`. Expo Go shows module-unavailable; no fallback computation. Web/production cannot run it, including direct routes; release native code also rejects calls. Household auth remains on the existing implementation and must not be tested as a native fix yet.

## Next steps — only after separate build/upload approval

No Android Studio/JDK/USB debugging is required for the EAS route. You need an Expo account, internet on PC/tablet, and a shared LAN for Metro. No Google Play account or paid plan is required for internal APK installation. Expo's currently advertised Free plan includes 15 Android builds/month in a low-priority queue; recheck pricing before starting. Do not upgrade/pay automatically.

1. If needed, create an account at <https://expo.dev/signup> in your browser, verify the email, and keep the password out of source/terminal messages. This is developer tooling, not student authentication.
2. Open PowerShell **at this repository root** and initialize only this terminal's Node:

```powershell
$fnmExe = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\fnm.exe'
& $fnmExe env --shell powershell | Out-String | Invoke-Expression
& $fnmExe use
node --version
npm.cmd --version
Get-Command node
```

Dependencies are already installed here. On another checkout use `npm.cmd ci`.

3. After approval, authenticate and link/create **only a new French Companion Expo project** under the intended personal account. These commands contact Expo; they have not been executed:

```powershell
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest whoami
$env:APP_VARIANT = 'development'
npx.cmd eas-cli@latest init
```

`npx` may first download EAS CLI. Select the intended account and French Companion project, not an unrelated project. `init` registers/links remote project metadata. Because app config is dynamic, CLI may ask you to insert the returned project UUID manually. Put the **actual** UUID in `app.json` as `expo.extra.eas.projectId` (merge with existing extra); `app.config.js` preserves it. Do not use a fabricated/placeholder UUID or replace the dynamic config. Record this local change before building. There is deliberately no UUID yet.

4. Confirm the resolved public config displays the requested identity and real project UUID:

```powershell
npx.cmd expo config --type public
```

5. Start the separately approved build:

```powershell
npx.cmd eas-cli@latest build --platform android --profile development
```

Do not run `build:configure` over the prepared profile unless a specific compatibility issue requires it. If asked about signing, allow the normal development signing setup and retain the resulting identity for subsequent updates. Stop on any request for unrelated projects, production submission or paid upgrade.

**Upload boundary:** `build` archives the current working tree (including the uncommitted new local module) and uploads it to Expo's build infrastructure. Builds fetch dependencies and generate the Android project remotely. `.easignore` excludes `.git`, dependencies, `.expo` checkpoint/cache, exports, local tool directories, `.env*` except the example, keystores/credentials and APK/AAB files. Source/config/docs/public fixtures that are not excluded are uploaded. No tablet database/SecureStore content is read/uploaded. Inspect the source set before approval; do not rely on “not committed” to exclude a file. No EAS Update/Submit command is needed.

## Install and launch

1. Open the successful build's installation URL/QR on the Android tablet. Download the **APK**, not an AAB. Allow that browser/file source to install this APK when Android asks; the permission can be disabled afterward.
2. Install **French Companion Dev** alongside Expo Go. Do not uninstall Expo Go or clear its data. It is a separate package and storage sandbox: no migration, shared PIN, approval or policy is implied. If a future update has a signing conflict, stop; do not uninstall as a workaround.
3. In the same project PowerShell terminal:

```powershell
$env:APP_VARIANT = 'development'
npx.cmd expo start --dev-client --lan --scheme french-companion-dev
```

Open French Companion Dev and use the Metro QR/URL for the same LAN. Allow the project's local Metro port through Windows firewall if needed; no public tunnel is required. Developer changes in JS use Metro. Kotlin, module config or native dependency changes require another APK build/install.

For limited original Expo Go testing in a separate terminal, initialize fnm, `Remove-Item Env:APP_VARIANT -ErrorAction SilentlyContinue`, then `npx.cmd expo start --go --lan` (use a different free port if both previews run). The original Expo Go identity/data stay intact. Do not use it for this native proof or repeat the slow household setup during benchmarking.

## Physical proof — gate before integration

Use home -> **Native PBKDF2 development proof**. Confirm module available and Hermes runtime reported. There is no PIN entry field. Run `digits` once, `leading-zero` once, then repeat for warm measurements. Buttons prevent overlap; leaving/returning does not release the native guard while work is active.

| Run | Vector | PASS/FAIL | Native derivation ms | Round trip ms | Scroll/navigation responsiveness |
|---|---|---|---|---|---|
| Cold | digits | Pending | | | |
| Warm | leading-zero | Pending | | | |
| Warm | digits | Pending | | | |
| Warm | leading-zero | Pending | | | |

Native duration measures only `generateSecret`, after obtaining the provider. JS round trip includes module/asset/provider overhead, bridge delivery and any scheduling delay; record both. Results are bounded to six rows, selectable and memory-only, and are not uploaded as telemetry. Note tablet model, Android/Expo Go/dev-app versions, debug/Hermes conditions and date. Do not claim release performance from a debug run.

PASS requires both independent expected outputs to match, background execution confirmed, acceptable latency and responsive navigation. Any FAIL, module absence, persistent pending state or poor responsiveness blocks integration. Native missing/unsupported errors are explicit, not permissive fallbacks. Bring physical results back for review **before changing household credential creation/verification**. No timeout releases the native guard; exiting a screen is not cancellation of platform work.

## Verification limits and rollback

Node tests verify vector correctness, controller guarding/sanitization/availability, explicit development identity and EAS profile. Expo autolinking resolution verifies discovery/class registration; JS/Hermes exports verify bundling only. No Kotlin compilation, native APK build, installation or physical performance is established until the approved build/device steps run. Kotlin/provider/Gradle compatibility remains a first-build risk.

If unsuitable, stop using the proof, keep both installations/data, and compare against the checkpoint before deliberately reverting these POC files/dependency changes. Restore earlier web/Expo Go workflows; native household acceptance stays blocked rather than weakening PBKDF2. A future production identity, signed updates, migration and household integration require separate plans/approval.

Official references: [development builds](https://docs.expo.dev/develop/development-builds/introduction/), [app variants](https://docs.expo.dev/build-reference/variants/), [local modules](https://docs.expo.dev/modules/get-started/), [APK installation](https://docs.expo.dev/build-reference/apk/), [pricing](https://expo.dev/pricing), [Android provider](https://developer.android.com/reference/javax/crypto/SecretKeyFactory).
