# FC-004N — physical Android Expo Go acceptance

Status: prepared; not executed by the implementation agent. Do not mark Android verified until this checklist is completed on the tablet.

**Current acceptance path (2026-11-11):** Owner's FC-004N.2A native proof passed eight runs on Android 12. FC-004N.2B integration is locally prepared; follow [updated APK/household acceptance](ANDROID_HOUSEHOLD_ACCEPTANCE_FC004N_2B.md). Another cloud build/upload is not yet approved. Earlier blocked Expo Go setup notes below remain historical; native household operations now require the updated development binary.

**Acceptance paused:** Owner's first physical PIN setup test remained busy for several minutes while home navigation worked. Root cause remains unknown. Follow [FC-004N.1 diagnostics](ANDROID_PIN_DIAGNOSTICS_FC004N_1.md) before resuming this checklist; do not clear existing data.

Record device model, Android version, Expo Go version, app revision and date. Use an Expo Go version supporting SDK 58. Initialize terminal-local Node 22, then run `npm.cmd start -- --lan` and open this project's QR code on the same local network. No cloud tunnel/build/deployment is required. Keep other projects' terminal/Node environments unchanged.

## Normal workflow

- [ ] Confirm existing FC-003 demo outcomes still work: first success, retry success and two misses; no source wording changes.
- [ ] Parent Area: set and confirm a six-digit PIN once. Saved policy defaults to requiring parent acceptance. Busy feedback appears; repeated taps cannot start concurrent verification.
- [ ] Wrong PIN does not unlock; repeated guesses are delayed. Correct PIN unlocks. No PIN appears in logs or ordinary text.
- [ ] In development only, choose **Load development sample**. Repeating it does not duplicate or approve the sample. The original reference fixture is unchanged.
- [ ] In strict mode, sample practice is blocked. Enable independent practice only after ticking risk acknowledgement and saving.
- [ ] Student home -> practice -> labelled sample. Confirm pending/unreviewed notice, five-question completion and retry behavior. Review/fidelity are not upgraded.
- [ ] Close/reopen project and force-stop/restart Expo Go: settings/sample persist, parent access does not. No repeated setup is requested.
- [ ] Change policy back to strict: pending practice becomes unavailable. Background/resume practice rechecks eligibility; no old permission survives indefinitely.

## Inactivity and lifecycle

- [ ] Leave Parent Area via app link, Android Back and navigation header; reopening requires PIN.
- [ ] Background using Home/app switch and screen lock; returning requires PIN. An unlock begun before backgrounding must not grant a session after returning.
- [ ] Leave unlocked and idle for five minutes: access locks.
- [ ] Unlock, interact at four minutes, then confirm access remains available before five minutes from that interaction. Let another five idle minutes pass: access locks. Polling and merely watching the screen must not keep it unlocked.

## PIN responsiveness (do not change PBKDF2 settings)

- [ ] Record the development **last unlock took ... ms** value for three successful unlocks. This is total unlock latency, including local storage, not isolated KDF time.
- [ ] Record cold/warm runs, debug/Hermes conditions, and whether typing/scrolling/backgrounding stays responsive while **Working… please wait** is shown.
- [ ] If latency is unsuitable, report measurements before proposing parameter changes. Desktop timings are not tablet evidence.

| Run | Total unlock ms | Cold/warm and responsiveness notes |
|---|---|---|
| 1 | Pending | |
| 2 | Pending | |
| 3 | Pending | |

## Failure checks — disposable project test data only

Automated fault-injection tests cover these paths. Physical fault/kill checks are optional until project-scoped diagnostic tooling is available; do not edit real household data or clear all Expo Go storage to simulate them.

- [ ] Kill during an ordinary save: restart shows either the old or committed policy, never a partial/permissive fallback.
- [ ] If initialization is interrupted, either matching strict empty setup completes or a clear locked-state explanation appears. Existing data is never erased automatically.
- [ ] Missing/inconsistent credentials or unavailable storage remain locked. No fresh-PIN screen silently replaces an existing household.
- [ ] Production behavior is covered by production web export/service tests: sample loading unavailable and stored sample excluded. Expo Go is a development runtime; it cannot by itself prove production exclusion.

Known boundaries: local gate cannot resist rooted/device-level control, modified code or storage tampering. Expo Go is a shared development host, not a separately installed production app. Standalone backup/restore behavior needs later validation. FC-005 review/correction/Approve All and intake/camera/OCR remain deferred.
