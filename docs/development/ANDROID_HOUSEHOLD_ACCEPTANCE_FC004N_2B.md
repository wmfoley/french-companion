# FC-004N.2B — updated APK and Android household acceptance

**Final status (2026-11-11): FC-004N.2B formally accepted by the owner following successful physical Android 12 authentication, persistence, session-management, household-policy and student-practice authorization tests.** Historical instructions and unchecked additional diagnostic scenarios below do not reopen the accepted milestone. No new build or device-data change is required.

## 1. Build boundary — separate approval required

FC-004N.2B adds native `derivePin` and availability methods; the existing proof APK does not contain them. **Metro alone cannot deliver this integration.** Until replaced, Parent Area must display an updated-APK/unavailable message and stay locked rather than execute the old JS KDF. The old proof screen remains usable.

No EAS build/upload is authorized by this acceptance document. After separate approval, in this repository's terminal-local fnm environment with the already linked intended Expo account/project, update the same development app:

```powershell
$env:APP_VARIANT = 'development'
npx.cmd expo config --type public
# Check French Companion Dev / com.frenchcompanion.dev / french-companion-dev
npx.cmd eas-cli@latest build --platform android --profile development
```

This build command uploads the included current worktree. Keep the existing development package and signing identity. Install the resulting APK **over the existing French Companion Dev installation**, without uninstalling it. On signing conflict, stop; do not erase data. Leave Expo Go installed and untouched. No migration between the two apps is implied. See the [original build/account/install procedure](NATIVE_PBKDF2_POC_FC004N_2A.md) for details.

## 2. Start updated code and rerun the proof

```powershell
$env:APP_VARIANT = 'development'
npx.cmd expo start --dev-client --lan --scheme french-companion-dev
```

- [ ] Open French Companion Dev on the same LAN. Record device/app revision and date.
- [ ] Native proof screen: run both public vectors, confirm PASS and background thread. Record cold/warm native and round-trip timings; the refactored shared helper now includes provider acquisition in native timing, so exact durations need not match earlier samples.
- [ ] Confirm scrolling and navigation remain responsive. Stop if output mismatches, native methods are unavailable or work remains pending unexpectedly. No parameters should be changed to make a failed test pass.

## 3. Inspect current state before attempting setup

- [ ] Parent Area loads actual existing state. If configured, use **Unlock** with the existing PIN; do not recreate the household.
- [ ] If a clear credential inconsistency/partial-setup error appears, capture only the safe message/diagnostic stages and stop. Existing recovery protocol remains locked; no automatic reset or deletion.
- [ ] Only if setup is offered for an empty installation, enter/confirm an intended six-digit PIN once (a leading-zero PIN is supported). Expect busy feedback during roughly the measured order of seconds, not a guaranteed deadline.
- [ ] Development stage panel reaches `pbkdf2 complete`, persistence/binding completion and `setup complete`. No PIN, salt or verifier appears in panel/logs. Policy starts strict. Setup does not unlock automatically.

## 4. Authenticate and verify lifecycle

**PIN visibility follow-up (2026-11-11):** Owner reports physical PIN setup and saved-PIN unlock now succeed without the previous prolonged delay. Secure-entry dots appeared invisible although the cursor advanced. Explicit dark text/placeholder/cursor/selection colours are now supplied in JavaScript; native secure entry remains unchanged. This styling correction needs only Metro refresh, not another APK.

- [ ] Refresh the existing development app from Metro; do not rebuild, reinstall or clear data for this styling fix.
- [ ] Unlock field: each entered digit has a visible masking indicator, backspace removes one, six-digit limit remains; actual PIN digits must not appear. Repeat in system light/dark mode and confirm placeholder/cursor remain visible.
- [ ] Setup and confirmation: perform the same visual check only on an already-empty disposable test installation when available. Do not reset the configured household to expose setup fields. All three use identical native secure-entry settings/colours.
- [ ] Existing PIN still unlocks after refresh; no credential or policy change. Record actual masking visibility on the tablet separately from browser contrast checks.

- [ ] Correct PIN unlocks; record development total unlock timing, including KDF/storage. Wrong PIN stays locked; cooldown applies. Do not share real PINs or storage dumps.
- [ ] Repeated taps cannot overlap unlock. Lock/leave/background during an unlock; returning must require a fresh PIN even if native work finished in the background.
- [ ] Leave/re-enter quickly during setup/verification: old completions cannot display success, clear a new input or unlock the new visit. Guard remains until underlying work settles.
- [ ] If setup was cancelled during derivation, no household initialization occurs afterward. If persistence had already started, a strict setup may safely finish; returning shows the actual persisted state, never an unlocked session.
- [ ] Five idle minutes lock. Genuine parent interaction refreshes inactivity; watching/polling does not.

## 5. Policy, practice and persistence regression

- [x] Load the explicit development sample from unlocked Parent Area; it remains pending review/unverified and labelled development-only.
- [x] Strict mode blocks pending practice. Enable independent mode only with risk acknowledgement; sample becomes playable without acquiring approval/fidelity claims.
- [x] Return policy to strict; existing pending practice pauses/blocks through resume/poll/transition checks.
- [ ] Close/reopen, then force-stop/relaunch the development app. PIN configuration, policy and assignments persist; parent unlock does not. Correct existing PIN works without setup being offered again.
- [ ] Recheck FC-003 first-attempt success, retry success and two misses. Preserve separate exercise/content/response state.
- [ ] Expo Go still launches supported standalone demo activities. Parent Area/normal household operations report native authentication unavailable; no JS fallback or data reset. Web authentication remains a separate verified platform path.

## Limits and results to report

Report PASS/FAIL per group, setup completion stages, correct/wrong-PIN outcome, total unlock timing, navigation/background/restart behaviour and policy revocation. Automated Node tests use a stand-in crypto backend and Node SQLite; no agent physical measurements or new Kotlin compilation are claimed. Process-kill fault injection and credential-loss scenarios are covered automatically but should only be tested manually with disposable scoped data; never clear Expo Go/real household data to simulate them.

Final milestone acceptance is recorded above. Remaining unchecked diagnostic, fault-injection and accessibility scenarios are additional coverage, not claims of completed physical tests.

## Owner-confirmed Android 12 results — 2026-11-11

These are owner-reported physical tests, not agent-executed measurements. They supersede earlier pending notes without claiming every checklist item passed.

- [x] Create/save a six-digit PIN; correct PIN unlocks; incorrect PIN is rejected and the correct PIN subsequently succeeds.
- [x] Credentials survive restart; parent authorization does not, and authentication is required again.
- [x] Leaving Parent Area revokes authorization.
- [x] Native masking indicators are visible following the JavaScript styling correction.
- [x] Approximately five minutes of inactivity expires access; authorized activity renews the session.
- [x] Android backgrounding revokes authorization.
- [x] Require Parent Approval persists through navigation and restart.
- [x] Allow Independent Practice persists through navigation and restart.
- [x] Development-client reconnection succeeds with the matching launch scheme, without reinstalling or clearing data.

Reconnection: start Metro with the explicit development variant and scheme shown above, keep tablet and computer on the same LAN, and scan the freshly generated QR. A stale QR or mismatched scheme can fail to open the installed client. Verify the current Metro address/port and Windows firewall/network reachability if needed. An old `Android Bundled` line does not establish a new connection. Preserve credentials/data; do not uninstall or reset storage as troubleshooting.

Additional unconfirmed physical scenarios: cancellation/concurrency during derivation or persistence, destructive-fault simulations on disposable data, and detailed accessibility/theme checks. Do not reset the configured household to exercise these scenarios.
## Final owner acceptance — 2026-11-11

The owner formally accepted FC-004N.2B and confirmed all previously reported authentication, persistence, session and policy tests, plus:

- [x] Development sample loads successfully.
- [x] Require Parent Approval blocks unapproved practice.
- [x] Allow Independent Practice permits practice.
- [x] Restoring Require Parent Approval revokes access to unapproved practice.
- [x] Assignment remains stored throughout policy changes.

These are owner-reported physical Android 12 results. They do not assert additional source verification, parent approval evidence or device fault-injection coverage. FC-005 review/correction/Approve All is still future work.