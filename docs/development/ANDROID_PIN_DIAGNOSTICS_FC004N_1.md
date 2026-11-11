# FC-004N.1 — Android setup diagnostic run

Root cause is **not established**. On the first physical Expo Go test, PIN creation displayed Working for several minutes, but navigation back to home remained responsive. Android acceptance remains blocked. This instrumentation measures the existing implementation; it does not reduce PBKDF2 cost or reset data.

## Launch

From the French Companion repository only, initialize its terminal-local Node environment:

```powershell
$fnmExe = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\fnm.exe'
& $fnmExe env --shell powershell | Out-String | Invoke-Expression
& $fnmExe use
npm.cmd start -- --lan
```

Open this same project in an SDK-58-compatible Expo Go on the tablet, on the same LAN. If Metro is already running for this project, stop/restart that server to load these changes. Do not clear Expo Go data, uninstall it, use a different project identity, or Fast Refresh/reload while capturing an active setup. No Android Studio, new dependencies, tunnel, build service or deployment is needed.

## Where to read messages

The reliable device-side location is **Parent Area -> Development setup diagnostics**, below the main controls; scroll down if needed. It displays the last 32 stage events for this JS runtime, including when you return after navigating away. Each line has operation number, stage, start/complete/failure/slow, stage duration and total elapsed milliseconds. Text is selectable. No PIN/credential material is recorded. This panel and recording are development-only; the buffer is memory-only and disappears on a full restart.

The same safe JSON events use `console.info` with prefix `[FC-004N.1 setup]`. If the Expo terminal forwards device JS logs, read them there. Some tooling does not forward console output: press `j` in Metro to open React Native DevTools for the connected device, then use Console and filter that prefix. The in-app panel works without terminal forwarding, DevTools or Android Studio. Do not enable remote JavaScript execution in another engine for a Hermes timing test.

## Safe reproduction

1. Record tablet model, Android/Expo Go versions and approximate elapsed wall time. Keep the app foregrounded for the first run.
2. Open Parent Area. If it shows setup, enter/confirm the intended six-digit PIN and tap Save once. Do not share that PIN.
3. Scroll to the diagnostic panel. Record start/complete events and warnings at approximately 10, 30 and 60 seconds from operation start. At most three warnings are emitted; silence after 60 seconds does not mean cancellation. Timers may run late if JS is occupied or the app is backgrounded.
4. After the 60-second observation, navigating home is safe. Returning must not show stale setup-success feedback or unlocked parent access. A still-running service setup cannot be duplicated; it may continue consuming CPU or awaiting persistence.
5. Capture the last stage events, whether navigation/scrolling stayed responsive, and any eventual completion/failure. Do not repeatedly tap, reload, clear storage or retry while an operation is unresolved.
6. If the existing installation instead shows Unlock, setup previously persisted; do not recreate it. If it shows a credential inconsistency/recovery error, capture only the message and stop. This ticket intentionally does not repair or erase that state.

| Last unfinished stage | Interpretation / next evidence |
|---|---|
| `randomness` | Expo Crypto randomness has not returned; PBKDF2 has not started. |
| `pbkdf2` | Derivation has not returned. Repeated slow warnings with responsive navigation support slow/yielding computation or a scheduler wait; they do not prove which. No household setup write has begun. |
| `storage_queue` | Setup is waiting for an earlier operation on this adapter, not currently deriving or writing. |
| `sqlite_init` | Opening/schema initialization or the cached opening promise has not returned. |
| `sqlite_transaction` | Native transaction acquisition, callback, commit or connection close has not completed; nested events may narrow this further. |
| `secure_read` | Credential-slot read/binding lookup is pending. |
| `secure_write` | Pending SQLite marker committed; SecureStore credential write has not returned. |
| `binding` / final `sqlite_transaction` | SecureStore write returned; verification/final transaction has not completed. |
| `setup complete` | All setup persistence calls returned. If the current screen still appears busy, report a UI lifecycle discrepancy. Completion never grants an unlocked session. |

Compare durations: a long `pbkdf2` followed by fast persistence identifies derivation latency; a completed PBKDF2 followed by an unfinished persistence stage points elsewhere. A finite capture cannot prove a promise will never settle. No speculative optimization is authorized by those events alone.

## Cancellation, retry and recovery

Leaving/backgrounding invalidates screen operations and clears visible busy/PIN fields. It does not kill a native promise or Noble computation. A service-wide setup guard lasts until the actual setup settles; no warning releases it. Before the first household INSERT, cancellation prevents initialization (including after async credential-ID creation). Once that INSERT is issued, the existing strict pending/credential/ready protocol finishes where possible even after leaving; UI completion is ignored and PIN unlock is still required.

After restarting, absent row **and** absent credential permits setup. A matching strict-empty pending row/credential can finalize. Pending without readable matching credentials, orphan credentials, corrupt state or mismatches remain locked with data preserved. No automatic PIN replacement/recovery is added. If an operation remains unresolved, capture diagnostics before considering a process restart; do not describe a restart as rollback of an already-issued native write.

Automated deferred-promise tests verify lifecycle/guard/protocol paths; Node SQLite and export tests do not establish physical Hermes, SecureStore or native transaction performance. The full Android acceptance checklist remains paused pending the diagnostic run and a separately reviewed root-cause correction.
