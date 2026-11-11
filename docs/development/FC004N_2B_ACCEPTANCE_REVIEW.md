# FC-004N.2B acceptance review — 2026-11-11

## Recommendation and evidence

FC-004N.2B is formally accepted by the owner after physical Android 12 testing, including the final student-practice authorization workflow. No known critical blocker remains within this bounded milestone. The owner has authorized one local commit of the complete FC-004N changes; no push, build, upload, data reset or application-behaviour change is authorized by this finalization. This is milestone acceptance, not production-release certification.

The owner confirms physical Android 12 setup, correct/wrong PIN handling, restart credential persistence with fresh authentication, navigation/background locks, native masking, approximately five-minute inactivity expiry, authorized renewal, and persistence of both household policies. The development-client launch issue resolved with the explicit development variant and `french-companion-dev` Metro scheme, without reinstall/data clearing. See the updated Android checklist and README.

Fresh checks: `npm.cmd test` passed 93/93; `npm.cmd run lint` passed, exit 0, using terminal-local fnm Node 22.23.4. No dependencies installed. Earlier web browser/export checks are recorded in the development log and were not rerun for documentation-only finalization. Final checks also passed: Expo dependency compatibility, asserted development app name/package/scheme, and Android autolinking of FcNativePbkdf2Module. The final development-log entry records exact commands. All 53 intended files matched this inventory and passed forbidden-artifact/secret-pattern checks; public vectors and simulated test credentials are intentional fixtures. No new physical measurements were made by the agent.

## Automated coverage reviewed

- `tests/household.test.js`: opaque-capability enforcement, expiry, authorization rechecks inside writes, explicit risk acknowledgement, stale revisions, failed persistence, strict invalid-policy fallback, revision-bound approval, source preservation and policy revocation.
- `tests/nativeHousehold.test.js`: SQL rollback, corrupted/unsupported policy, interrupted initialization on either side of SecureStore, credential loss/mismatch/orphans, protected policy/sample commands, production exclusions, inactivity renewal and concurrent unlock/cancellation.
- `tests/nativePinIntegration.test.js`: native availability failures, unchanged credentials/parameters, sanitized errors, no storage access when unavailable, held concurrency guards and cancellation/late completion.
- `tests/setupLifecycle.test.js`: deferred derivation/persistence, navigation cancellation before writes, guards held until settlement, stale focus/operation completion and bounded secret-free diagnostics.

Native adapter tests use Node SQLite and injected native/SecureStore stand-ins. They do not prove Android bridge, provider, Keystore or process-kill behaviour. The owner's device tests supply independent runtime evidence for the successful paths above.

## Remaining acceptance gaps

The final owner-reported physical smoke test passed: development sample loading, strict blocking of unapproved practice, independent practice opt-in, revocation when strict policy is restored, and assignment retention throughout policy changes. All previously reported authentication/persistence/session/policy tests also passed. No outstanding acceptance blocker remains for FC-004N.2B.

Desirable additional device coverage: rapid repeated taps and navigation during native derivation, cancellation during persistence, dark/light theme and screen-reader checks, and safe interrupted-write/credential-loss fault injection using disposable data only. Automated tests cover these state-machine/failure paths; real-device failure injection remains unverified. No recovery/reset UI is implemented. Do not erase the existing household for testing.

## Implemented and future workflows

Implemented: supervised one-time household/PIN setup, service-authorized policy changes and development sample loading, strict default, explicit risk-acknowledged independent policy, eligibility checks at practice reads/transitions/resume/polling, and production exclusion of development fixtures. A narrow pending-assignment submission service exists; there is no intake UI. Review status, eligibility and source fidelity remain separate; independent practice creates no approval evidence.

Strict eligibility already recognizes revision-bound reviewed or risk-acknowledged bulk approval evidence. Creating that evidence through detailed review, provenance-preserving corrections or Approve All belongs to FC-005 and is not implemented. Assignment intake/management needs separate planning. Responses remain in memory. FC-003A randomization, mixed sprints, additional exercise types, camera/OCR/AI and curriculum enrichment are out of scope; CURR-001 remains future, parent-controlled and disabled by default.

## Working tree

Pre-commit inventory relative to `ace54dc` (FC-004 baseline): the following 23 modified tracked and 30 new files comprise the approved FC-004N/diagnostic/native-proof/integration work and acceptance documentation. The final commit hash and clean-tree result are reported after committing rather than embedded in this commit itself. No unrelated changes were identified; existing owner-created EAS identity/link metadata in `app.json` is part of the development-build work and was preserved. Ignored checkpoints, generated outputs and local files are not included in this tracked/untracked source inventory.

Modified tracked files (23):

- `.gitignore`
- `README.md`
- `app.json`
- `app/_layout.js`
- `app/index.js`
- `app/parent.js`
- `app/practice.js`
- `docs/architecture/ARCHITECTURE.md`
- `docs/decisions/ADR-0002.md`
- `docs/development/DEVELOPMENT_LOG.md`
- `docs/development/TEST_PLAN.md`
- `docs/development/TODO.md`
- `docs/requirements/PRD_v0.1.md`
- `package-lock.json`
- `package.json`
- `scripts/verify-household-web.cjs`
- `src/components/Screen.js`
- `src/core/assignments/practiceEligibility.js`
- `src/core/exercises/vocabularyMultipleChoice.js`
- `src/services/householdService.js`
- `src/services/localHousehold.js`
- `src/services/localHousehold.web.js`
- `src/services/parent/pinCredential.js`

New source/documentation files (30, including this report):

- `.easignore`
- `app.config.js`
- `app/native-pbkdf2.js`
- `docs/decisions/ADR-0003.md`
- `docs/decisions/ADR-0004.md`
- `docs/decisions/ADR-0005.md`
- `docs/development/ANDROID_ACCEPTANCE_FC004N.md`
- `docs/development/ANDROID_HOUSEHOLD_ACCEPTANCE_FC004N_2B.md`
- `docs/development/ANDROID_PIN_DIAGNOSTICS_FC004N_1.md`
- `docs/development/NATIVE_PBKDF2_POC_FC004N_2A.md`
- `eas.json`
- `modules/fc-native-pbkdf2/android/build.gradle`
- `modules/fc-native-pbkdf2/android/src/main/AndroidManifest.xml`
- `modules/fc-native-pbkdf2/android/src/main/assets/fc-pbkdf2-vectors.json`
- `modules/fc-native-pbkdf2/android/src/main/java/expo/modules/fcpbkdf2/FcNativePbkdf2Module.kt`
- `modules/fc-native-pbkdf2/expo-module.config.json`
- `modules/fc-native-pbkdf2/package.json`
- `src/content/developmentSample.js`
- `src/services/development/nativePbkdf2Proof.js`
- `src/services/development/pbkdf2Proof.js`
- `src/services/parent/nativePinCredential.js`
- `src/services/parent/nativePinEngine.js`
- `src/services/parent/parentOperations.js`
- `src/services/parent/setupDiagnostics.js`
- `src/services/storage/sqliteStore.js`
- `tests/nativeHousehold.test.js`
- `tests/nativePbkdf2Proof.test.js`
- `tests/nativePinIntegration.test.js`
- `tests/setupLifecycle.test.js`
- `docs/development/FC004N_2B_ACCEPTANCE_REVIEW.md`
