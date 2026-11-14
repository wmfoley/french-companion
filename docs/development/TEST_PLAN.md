# Test and Acceptance Plan — v0.1

## FC-005 development-milestone acceptance - 2026-11-14

The owner accepts FC-005 for the current development milestone. Physical Android results are **5A: 9/9 passed; 5B: 6/6 passed; 6A: 6 passed, 1 skipped; total: 21 passed, 1 skipped**. No functional defects were reported. **Physical TalkBack accessibility testing was intentionally skipped and remains unverified**, deferred to prepublication accessibility testing. Automated activity tests and browser checks do not establish TalkBack correctness or publication readiness.

The accepted implementation includes protected assignment reads, transactional review/correction/approval commands, the existing Parent Area interface, FC-005-06 authorization boundaries, FC-005-07 selective review preservation and the three Increment 6A corrections. Approval, field review, household practice eligibility and source fidelity remain separate. Historical increment records below describe their original delivery status; this dated acceptance supersedes earlier pending-acceptance or unimplemented-capability wording for completed FC-005 work. No new product scope is authorized by acceptance.

| Physical Android increment | Passed | Skipped |
|---|---:|---:|
| 5A | 9 | 0 |
| 5B | 6 | 0 |
| 6A | 6 | 1 |
| **Total** | **21** | **1** |

The skipped 6A test is physical TalkBack accessibility. It is not passed, and the 190 automated tests do not substitute for it. Prepublication accessibility testing must verify TalkBack navigation, labels/states, action activation, feedback and activity renewal/expiry on the physical tablet.



## FC-005 Increment 6A - acceptance-audit corrections

Owner-reported physical Android evidence: **5A 9/9 passed; 5B 6/6 passed**, with no additional usability concerns. Subsequent owner-reported 6A results are 6 passed and 1 skipped (physical TalkBack). FC-005 is accepted for the current development milestone as recorded above. Earlier per-increment results/checklists below are historical, not new device results.

Automated coverage: `parentAuditCorrections.test.js` adds deferred policy read success/failure after lock and replacement, expiry and unavailable-current-credential rechecks, no stale renewal/disclosure, new-document revision 1/CAS, separately constructed legacy sample revision 0 without migration or overwrite, and explicit activity activation/expiry/duplicate/stale-session checks. Existing controller/transaction/native-adapter/service tests cover late completion suppression, atomic issued writes, stale/failed writes, persisted approvals/corrections and strict/independent practice. Browser regressions exercise rendered controls, scroll/source preservation, confirmations, IndexedDB and randomized practice. Native-adapter tests use Node/mocks; they do not establish physical Android runtime correctness.

Local 6A validation: npm.cmd test passed 190/190 (zero failed/cancelled/skipped); node --test tests/parentAuditCorrections.test.js separately passed all six focused tests (already included in 190). npm.cmd run lint and npm.cmd run export:web passed (810 modules). node scripts/verify-household-web.cjs passed on rerun in isolated headless Edge with no runtime/console errors. The first browser run timed out at the initial development home page while Metro performed its first 44-second bundle; no application correction or timeout change was made for the successful warm-bundle rerun. Unsuppressed npx.cmd expo install --check exited 1 for eight deferred SDK 58 patches; dependencies are unchanged.

Archived final physical Android procedures (owner reports completion with the TalkBack test intentionally skipped; do not reset existing household data). TalkBack-dependent assertions in item 1 remain unverified and move to prepublication testing:

1. With TalkBack enabled, use review checkbox, source expand/collapse, correction Save and approval confirmation near five minutes; each genuine action renews inactivity. Then leave idle for five minutes: access expires despite polling; a stale action must not revive it.
2. With a dirty correction/confirmation open, background, leave Parent Area and allow expiry in separate runs: protected content and buffers clear immediately; re-entry needs PIN and rereads current persisted revisions. No unsaved prompt overrides locking.
3. Exercise both approval methods through strict practice, including withdrawing a review checkbox (detailed approval clears, valid risk approval stays). Material correction clears either receipt, retains unchanged reviews, requires fresh explicit approval; policy remains independent. Confirm strict-policy revocation stops an active unapproved practice session.
4. Cold restart after correction/review/approval: saved content, explanation, source excerpt/fidelity and policy persist, but parent authorization does not. Confirm current field/source context and two-attempt randomized practice remain correct. Prior 5A/5B results may be reused where the owner confirms they cover these steps; do not infer coverage from aggregate counts alone.

JavaScript-only update: use the existing development APK and Metro; no EAS build, reinstall or data reset is required. The owner has subsequently accepted this development milestone with the explicit TalkBack exception above; do not infer publication readiness.

## FC-005 Increment 5B — FC-005-07 selective review preservation

Local results: 184 automated tests passed, zero failures/cancellations/skips; lint, web export and full browser regressions passed. Expo dependency check exited 1 for the same eight accepted deferred SDK 58 patches. Subsequent owner-reported 5B physical acceptance: 6/6 passed; subsequent development-milestone acceptance is recorded above, with TalkBack deferred and unverified.

Owner-reported Increment 5A physical Android UX acceptance: **9/9 passed**. The owner separately confirmed 5B 6/6 passed. The selective rule below supersedes older reset-all correction expectations and checklists in this document; historical validation records are retained.

- Pure tests: one/multiple changed fields among reviewed content, mixed changed/no-op entries, explanation-only and correction-origin-only changes, exact unchanged pending/reviewed descriptors, frozen inputs, source/Unicode/ID and supplementary-origin preservation, no-op counters and stale/overflow/invalid-batch rejection.
- Service tests: material corrections invalidate both approval methods, preserve 19 unaffected reviews, consume one content/write revision each, roll back failed writes and reject stale peers. Recreated services must read persisted selective state. Detailed approval fails until changed fields are reviewed, review alone grants no acceptance, old content-revision receipts fail validation, and fresh explicit approval emits current evidence. Existing strict/independent eligibility and FC-005-06 regressions remain.
- Native adapter test: real Node SQLite with mocked Expo/SecureStore persists selective state and cleared evidence across adapter/service recreation. This is not physical Expo runtime acceptance.
- Controller/browser tests: keep detail mounted through correction/reread, preserve field keys/source expansions and current-field visibility; save a reviewed deep grammar field, see 19 retained reviews and no approval, review only that field, then explicitly reapprove. Keep existing deep checkbox scroll-offset and FC-003A practice/policy regressions.

Targeted physical Android 5B checklist (subsequently owner-reported 6/6 passed): review several fields, correct one and verify only it becomes unchecked while remaining in the current assignment/source context. Repeat from detailed and risk acceptance: both must lose whole-assignment approval. Review the changed field, explicitly approve again and verify strict practice resumes; independent household permission remains separate. Reopen/restart and verify saved reviews, source fidelity and explanations. No data reset, new APK, or historical review reconstruction; use the existing development client via Metro.

## FC-005 Increment 5A — reversible review and context preservation

**Subsequent physical result:** owner confirms all nine Android UX tests passed (9/9). Earlier pending-verification wording below reflects the original 5A delivery; 5B has now separately passed 6/6.

Local validation: 180 automated tests passed, zero failed/cancelled/skipped; lint and web export passed. Browser checks prove deep-field node/source/scroll preservation on web; physical Android verification remains pending. The same eight deferred SDK 58 patch recommendations remain the only dependency-check exception.

- Pure/service tests: true/false persisted review, no-op/stale rules, write-only revision, frozen source preservation, detailed receipt invalidation versus retained valid bulk receipt, strict eligibility consequences and unauthorized requests. Existing rollback, expiry, queued/late authorization and policy/session tests remain mandatory.
- Controller tests observe every notification while a successful review waits for authorized reread: detail must never be null and view stays detail. No optimistic check on failure; refreshed revisions only after read. Inline editor retains surrounding detail, requires explanation, protects switching via Keep/Discard, and remains subject to existing lock/stale recovery and duplicate guards.
- Browser regression: scroll to Grammar field 10, expand its source, check and uncheck. The same field/card DOM nodes must remain connected, source stays expanded, and scroll offset differs by less than two pixels. Inline editing/saving must retain other field nodes and source state. Existing risk/detailed confirmations, corrections/reset, Mark All, sample retention, lock/re-entry, 430px layout and FC-003A regressions remain.
- Physical Android 12 (pending): repeat deep-field check/uncheck several times and verify the current field stays visible with sources expanded. Edit inline, test keyboard and Save/Cancel, dirty editor switching and back navigation, required explanation and reset-all after save. After detailed acceptance, uncheck and verify strict practice blocks; after explicit risk acceptance, uncheck and verify acceptance is retained. Check background/expiry/route-exit immediately clear protected buffers and stale writes still require reconsideration. Editor/keyboard expansion may naturally change viewport layout; do not add manual scroll restoration without evidence it is needed.

JavaScript-only changes use the existing development APK through Metro; no reinstall, reset, new build or dependency change. Increment 6 audit and targeted 6A corrections are now authorized; subsequent development acceptance is recorded above, with physical TalkBack unverified.

## FC-005 Increment 5 — Parent Review and Approval interface

Local verification: 176 automated tests passed, zero failures/cancellations/skips; lint, web export and full browser regressions passed. Expo dependency check remains exit 1 for the accepted eight SDK 58 patch recommendations, with no dependency changes. These are local/automated results, not physical Android acceptance.

- `assignmentReviewController.test.js`: protected list/detail navigation, persisted individual/all review, initially unchecked/reopened confirmations, detailed dual confirmation, risk declaration, ordinary unsaved Keep/Discard, required explanations, saved revision refresh, stale edit reload/reconsideration, immediate buffer/content clearing on lock, repeated taps, stale/replaced-session reads, late committed approval response suppression, malformed/empty states. Existing service tests remain the authorization boundary coverage.
- Browser script exercises the rendered workflow with real IndexedDB: development sample inspection, immutable sources, individual review, risk acceptance without fabricated review, correction/reset, unsaved keep/discard, Mark All without acceptance, detailed acceptance, sample reload preservation, explicit lock/editor clearing and fresh authorized reread. Confirms unchecked acknowledgements, 430px width without horizontal overflow and all existing PIN/policy/practice/randomization regressions. No injected application debug API or browser/test dependency.

Physical Android 12 checklist (not yet performed for Increment 5):

1. Launch the existing French Companion Dev APK with `$env:APP_VARIANT = 'development'` then `npx.cmd expo start --dev-client --lan --scheme french-companion-dev`. JavaScript-only changes need Metro refresh, not a new APK. Do not reinstall or clear existing household data.
2. Unlock, load/reopen the development sample, open Review Assignments; confirm pending content remains visible under strict policy. Inspect all source excerpts/references and French accents. Check tablet scrolling, keyboard Save/Cancel taps, readable wrapping, touch targets and TalkBack labels/states.
3. Review one field; verify progress persists after reopening. Open/cancel/reopen risk acceptance: acknowledgement must be unchecked. Accept risk; confirm method says without detailed review, field review stays partial and source fidelity is unchanged. Strict practice should accept the assignment while development labelling remains.
4. Correct existing text with an explanation; cancel once with Keep Editing, then with Discard. Save a correction: sources unchanged, approval cleared, all review reset. Strict practice blocks until renewed acceptance; independent policy remains independently controlled. Do not alter the bundled fixture.
5. Mark All after explicit declaration: no assignment approval yet. Approve Reviewed only after coverage and both confirmations. Reopen/restart/sample reload: saved wording/review/method remain. Test a stale edit in two web tabs separately; current saved revisions must reload and the old edit must not be silently applied.
6. While editing unsaved text or viewing expanded sources, lock, leave `/parent`, background the app and separately wait five inactive minutes. Protected content/buffers must clear without an unsaved prompt overriding locking. Re-unlock and reread saved truth; no old request may restore an editor/confirmation. Rapid review/save/confirm taps must issue one action.

Increment 5 is not physical-device accepted by automated/browser results. Increment 6 audit and targeted 6A corrections were subsequently authorized; subsequent development acceptance is recorded above, with physical TalkBack unverified.

## FC-005 Increment 4 — whole-assignment approval commands

Verification: 168 automated tests passed, lint/web export/browser regressions passed; Expo dependency check exit 1 remains the accepted eight-patch maintenance exception. Owner acceptance of Increment 4 and authorization of Increment 5 remain separate gates.

- Test successful detailed approval only after complete review; explicit acceptance/no-known-gaps booleans; known missing definitions; complete exact receipt coverage; no approval from Mark All alone.
- Test explicit risk acknowledgement/acceptance (missing, false and truthy non-booleans reject), unchanged field review/source/provenance, matching content revision, one write increment and strict eligibility. Independent household policy is unchanged, including practice after correction resets approval.
- Test forged/expired/revoked/replaced capabilities; queued rejection; valid issued-write completion after locking with suppressed result; delayed response cannot lock or renew newer session; authorized reread of persisted revisions. Test stale revisions/overflow, forbidden receipt input, rollback, defensive snapshots, legacy effective revision 0 and service recreation.
- Real Node SQLite adapter verifies detailed approval durability and failed method-change rollback. Browser real IndexedDB checks persist both receipt methods and subsequent correction invalidation alongside all existing practice/policy/randomization regressions. Adapter tests mock Expo/SecureStore and do not establish physical Android runtime correctness. No parent review UI is included.

Current native acceptance is tracked separately in [ANDROID_ACCEPTANCE_FC004N.md](ANDROID_ACCEPTANCE_FC004N.md); earlier sections below retain their milestone scope.

## FC-005 Increment 2 — protected read-only parent access

- `tests/parentAssignmentAccess.test.js`: parent list/detail of strict-blocked pending assignments, valid detailed/bulk acceptance and review-only progress; minimal metadata, precise evidence labels, effective legacy revision 0 without migration, independent copies of document/sources/provenance/fields and no store.update calls during reads.
- Reject forged/missing/cross-session capability before storage; verify five-minute inactivity without read-based renewal. Deferred list/detail results must reject after lock, expiry, capability replacement, lock/reunlock or native unavailability. Late rejected storage reads must not leak errors or lock a newer session. Native, route-exit and background lock mechanisms remain the existing service/UI composition.
- Unsupported/malformed content/revisions/purpose and duplicate IDs fail closed without partial lists, reset or deletion. Structurally valid invalid acceptance evidence is visible honestly to parents, without authorizing strict student practice. Unknown/bad ID requests return safe errors. Production omits development samples and denies their direct detail; development reads preserve purpose, pending status and practice restrictions.
- Browser regressions additionally exercise the new commands with real IndexedDB: unauthorized calls denied, protected pending metadata/detail readable after unlock, source/provenance snapshot edits cannot affect stored data, and persisted installation JSON remains identical across reads. Revocation denies further access. Browser test-only service clients remain separate from application UI; no production debug hook added.
- Run full tests, lint, web export, browser regressions and scope/whitespace checks. Run the unsuppressed Expo dependency check and report the previously accepted eight-patch SDK 58 exception separately. No new Android UI flow exists to physically accept in this increment; Node stand-ins/browser checks do not establish new native bridge behaviour.
- No new Parent Area screen/route, correction/review/approval write, migration, sample-loader change or persisted revision default is included. Increment 1 work remains intact; Increment 3 is not started.
## FC-005 Increment 1 — pure review foundations

- `educationalFields.test.js`: complete supplied-field enumeration, nearest IDs and stable receipt paths, optional omission, metadata/source exclusion, independent/frozen provenance copies and invalid input diagnostics.
- `assignmentDocument.test.js`: valid legacy/current envelopes, absence-only revision 0, malformed/stale revisions, JSON shape, method-aware detailed/bulk receipts, review completeness, duplicates/unknown paths, explicit acknowledgement, mixed methods, timestamp/calendar checks and derived known gaps. Acceptance evidence is independent from structural validity and household-independent practice.
- `assignmentReview.test.js`: explicit Mark All declaration without approval; valid bulk receipt retained without relabelling; invalid detailed receipt cannot be resurrected by marking review; immutable all-or-nothing corrections, blank explanations, arbitrary path rejection, exact sources/Unicode/IDs, supplementary classification, no-ops, stale comparisons, revision overflow and all-field review reset.
- Existing assignment and household tests are reconciled with ADR-0006. Strict mode still requires valid evidence; independent mode still permits eligible pending content; correction invalidates strict acceptance without silently changing source fidelity. Existing FC-003A randomization/attempt outcomes and native authorization/storage regressions remain required.
- Run complete tests, lint, unsuppressed Expo dependency check, web export and existing browser regressions. Browser's isolated test-module source list includes educationalFields and assignmentDocument so real IndexedDB tests exercise current eligibility. No debug hook added to the application.
- Increment 1 does not add a protected parent command, database write, editor or sample overwrite path. Those remain later-increment acceptance. Tests do not establish actor identity/source authenticity; physical parent-editor verification is not claimed. Record dependency-check patch exceptions separately, with no upgrades/suppression.
## FC-003A — practice randomization

- `tests/randomizePresentation.test.js`: deterministic injectable randomness, frozen input/nonmutation and separate copies, complete question/choice permutations, correct-answer/source associations, independent per-question option draws, empty/single inputs and invalid RNG values.
- `tests/practiceRun.test.js`: authorization before randomness, once-per-run generation, stable retry/advance/completion presentation, unchanged three outcomes/scoring, new replay and cleared responses, rapid Start/Replay taps, denied/rejected authorization, unmount/re-entry and late start/replay/submit completion. Old finalizers must not release a newer pending guard.
- `tests/household.test.js`: exercise the coordinator with the real household service policy checks; strict start denial, independent start, strict revocation denying submission/advance, and preserved pending source/approval state. Retain all existing approval/fidelity, native, concurrency and failure regressions.
- Browser: actual demo and household paths, controlled browser-only randomness, complete five-question permutations, retry/feedback/viewport-rerender stability, all learning outcomes, replay reset/new ordering, rapid Start/Replay, leave reset, and existing strict/default/independent/revocation plus production-exclusion checks. No application debug hook or test dependency.
- Run `npm.cmd test`, `npm.cmd run lint`, `npx.cmd expo install --check`, `npm.cmd run export:web`, local web preview on port 8083 and `node scripts/verify-household-web.cjs`. Report actual results and Android separately.

Physical Android acceptance: **completed, owner-reported on 2026-11-11, Android 12 / French Companion Dev**. All planned scenarios passed. The procedure below is retained for future regression testing; Owner authorized the local FC-003A milestone commit on 2026-11-11; push remains unauthorized.

1. Reconnect the existing French Companion Dev APK with `$env:APP_VARIANT = 'development'` then `npx.cmd expo start --dev-client --lan --scheme french-companion-dev`; refresh JavaScript only, retaining stored household data.
2. In the labelled demo, rapidly tap Start; confirm one five-question run. Note definition/choice order; select/deselect and retry a wrong choice. Order must stay fixed and the wrong choice remain disabled.
3. Exercise first-attempt success, retry success and two misses; verify encouragement, exact completion pairing, progression and summary. No duplicate/omitted question; existing source text remains intact.
4. Rapidly tap Replay; confirm one fresh run with reset responses. Repeat several sessions to observe variation; occasional identical positions/orders are allowed. Leave/return to confirm reset, and background/resume to confirm no mid-session reshuffle.
5. With the already parent-loaded development sample, verify strict blocking, explicitly enable independent practice, play the labelled randomized sample, then restore strict mode and confirm unapproved access is revoked. Assignment remains stored and pending/unverified; do not reset credentials/data.
6. Navigate away immediately after Start/Replay and return: no late run should appear. Report any device-only errors before acceptance. Node/browser checks do not establish Hermes/tablet behaviour.

Final engineering recheck (2026-11-11): `npm.cmd test` passed 108/108, lint and web export passed. `npx.cmd expo install --check` now exits 1 with eight recommended SDK 58 patch updates; dependency manifests remain unchanged from 0c1cda7. The owner explicitly accepted this unchanged-baseline exception for the FC-003A commit on 2026-11-11; the check remains failed, unsuppressed and tracked as separate deferred maintenance. No upgrade is authorized here. Final isolated headless Edge browser regressions also passed without runtime exceptions or console errors; details are in the development log.

### FC-003A confirmed physical results — 2026-11-11

These are owner-reported physical tests, not agent-executed device measurements:

- [x] Rapid Start taps produce only one session.
- [x] Question order and answer-choice positions are randomized.
- [x] Replay resets responses and produces a fresh randomized presentation.
- [x] Choices remain stable through an incorrect first attempt and the second attempt.
- [x] Five-question completion displays the existing **Bravo pour tes efforts !** celebration and **Rejouer**. No per-question results screen is required or added; the earlier completion concern is resolved by this confirmation, without a code correction.
- [x] Leaving practice discards the active session and preserves the assignment.
- [x] Brief Android background/resume preserves the active question and option positions.
- [x] Strict parent approval blocks the unapproved development assignment.
- [x] Independent practice permits that assignment.
- [x] Restoring strict policy during active practice prevents continued unauthorized practice.
- [x] Restoring independent policy permits a fresh session without retained responses.

Additional screen-reader and broader usability checks remain separate; no claim of Android process-kill session restoration or guaranteed distinct permutations. No application correction was needed for this acceptance review.
## FC-004N verification boundary

FC-004N.2B adds native engine integration tests with a Node crypto stand-in, clearly not Android execution: old/missing/API-unsupported module, correct/wrong PIN, public and legacy/WebCrypto credential compatibility, strict input/output lengths, sanitized errors, concurrency, deferred setup/unlock cancellation, no storage access on unavailability, actual shared-credential serialization through Node SQLite/SecureStore simulation. Existing partial-initialization/focus/strict-policy tests remain. The retained public proof now shares the Kotlin derivation helper. Run [physical household acceptance](ANDROID_HOUSEHOLD_ACCEPTANCE_FC004N_2B.md) only after separately approved APK rebuild; native correctness is not established by Node tests or JS exports.

FC-004N.2A adds `tests/nativePbkdf2Proof.test.js`: full 600,000-iteration public vectors independently checked by Node PBKDF2 and WebCrypto, missing-module/web/production gates, concurrency through settlement, sanitized metadata/failures, explicit config identity and EAS upload ignore boundaries preserving native source. Expo autolinking must discover the module. Web and Android JS exports/lint/dependency checks remain required. No Kotlin/native correctness claim follows from Node/export tests: [physical proof checklist](NATIVE_PBKDF2_POC_FC004N_2A.md) and separately approved EAS APK build are the next gates. Household setup/verification files must match the pre-change checkpoint.

FC-004N.1 adds `tests/setupLifecycle.test.js` plus native deferred-ID/SecureStore tests: setup concurrency survives navigation/unresolved promises, pre-write cancellation rolls back, started persistence completes strict binding without unlock, retries wait for settlement, focus IDs suppress late success/failure/finally, diagnostic observers cannot affect setup, buffers/timers are bounded, production emits nothing, and derivation parameters remain unchanged. Follow [physical diagnostics](ANDROID_PIN_DIAGNOSTICS_FC004N_1.md); runtime compatibility remains unproven by these tests.

- Run `npm.cmd test`, `npm.cmd run lint`, `npx.cmd expo install --check`, `npm.cmd run export:web`, and `npx.cmd expo export --platform android --output-dir dist-android` under terminal-local Node 22.
- `tests/nativeHousehold.test.js` runs adapter SQL against Node SQLite using an Expo-shaped connection, with simulated SecureStore. Cover transaction rollback/failed saves, strict fallback for corrupt/unsupported policy, interrupted two-store initialization before/after secret save, orphan/missing/corrupt/mismatched credentials, recreation/restart lock, direct unauthorized commands, stale revisions, policy revocation and sample restrictions. These tests do not run Android native bridges or Keystore.
- Test authenticated activity extends expiry; polling does not; expired capabilities cannot refresh; explicit lock/background-equivalent cancellation rejects in-flight unlock and concurrent verification. Native UI lifecycle dispatch requires tablet acceptance.
- Execute actual asynchronous native JavaScript PBKDF2 at the approved 600,000 iterations against Web Crypto for correct/incorrect PINs and both credential directions. Desktop timing is diagnostic only; tablet timing is required separately.
- `node scripts/verify-household-web.cjs` checks real IndexedDB/Web Crypto, direct authorization, rollback, stale writes/two-tab revocation, setup/PIN/lifecycle and existing learning flows. Development checks add explicit protected sample loading, risk acknowledgement and labelled sample practice. Production excludes the demo/sample pathways.
- Physical checklist covers Expo Go module availability, setup/busy/concurrency, repeated unlock timings, sample strict/independent flow, restart persistence, background/leaving locks, five idle minutes and genuine interaction renewal. Record device/OS/Expo Go versions and all untested failure paths.
- Preserve assignment schema/source fixture, original accent-sensitive grader and FC-003 attempt/outcome behaviour. No FC-005 approval, correction or Approve All commands added.

## FC-001 historical checklist
1. Web preview launches without exceptions.
2. Pure JS grader accepts `crise` when expected `crise`.
3. Grader rejects `crize` and identifies incorrect spelling.
4. Accent-sensitive case: expected `négociateur`, input `negociateur` is not fully correct.
5. No child names, secrets, AI requests, or Supabase calls are present.
6. Lint and unit test commands complete successfully; report actual output.
7. Sample grader ignores case and surrounding whitespace, preserves accents/internal whitespace/punctuation, and treats canonically equivalent Unicode strings as equal. Preserve the original response.
8. Home -> practice -> home works in the live web preview, with no runtime exceptions or console errors; report headless and human visual verification separately.

## FC-002

- Validate schema version 1, required metadata, lifecycle enums, valid dates, stable unique IDs, source references and strict supplied-field types. Reject unknown fields, malformed nested content, sparse arrays and supplied blank educational text.
- Allow omitted educational fields and collection defaults without inventing wording. Preserve source excerpts exactly, including whitespace, empty strings and Unicode representation.
- Require field-level provenance; parent corrections retain source references and an explanation. AI/illustrative content cannot become teacher content through normalization or approval.
- Require all supplied text to be approved when assignment status is approved; approval does not upgrade source fidelity. Automatic review-reset/change detection is deferred to a future editing workflow.
- Verify normalization nonmutation, independent copies, idempotence and NFC-only comparison. Continue all FC-001 grader tests.
- Verify fixture definitions and source excerpts against the PRD, exact three grammar transformations, no invented instructions/examples, pending review and reported/unverified source fidelity.
- Run `npm.cmd test`, `npm.cmd run lint`, `npx.cmd expo install --check`, `npm.cmd run export:web`; report actual results. Screens are unchanged, so no new browser navigation test is required.

## FC-003

- Exercise schema/version/policy/reference integrity; deterministic three-option generation, varied answer positions, maximum five questions and exact source wording.
- Normal approved-content eligibility; explicit development demo only for pending reference fixture. No mutation or silent approval. Reject malformed assignments; skip absent definitions, supplementary content, duplicate terms/definitions and exposed answers. Empty/insufficient pools produce a graceful message.
- ID grading, invalid selection handling, first-attempt success, second-attempt success and incorrect-after-two-attempts. Repeated wrong options cannot consume attempts. Completed/stale submissions and repeated next events cannot alter scores or skip questions.
- Live browser: normal practice blocks pending content; labelled demo introduction/questions/summary; selection before submit, no answer identification after first miss, disabled/labelled wrong choice, pairing revealed after second attempt, completion, restart and return home.
- Production export: no demo entry and `/practice?mode=demo` cannot bypass approval. Check narrow-screen overflow and keyboard interactions; report Android/screen-reader testing separately.
- Run existing regression suite, lint, Expo dependency validation and web export. No added browser/test dependencies.

## FC-004

- Default strict policy; independent opt-in requires explicit risk acknowledgement and valid persisted revision. Missing, corrupt or unsupported policy is strict; unsupported native operations fail closed.
- One installation/PIN; mismatched setup, duplicate/racing setup, bad credentials and persisted cooldowns. Raw PIN never stored. Opaque capabilities, forged tokens, expiry, explicit lock and authorization loss during asynchronous writes.
- Direct protected commands cannot bypass the gate. Parent Area locks on leaving, backgrounding, reload and maximum session lifetime. Native lifecycle verification remains outstanding.
- Serialized persistence/CAS, failed reads/writes, corrupt state, no permissive memory fallback. Real browser IndexedDB transaction abort and clone-failure rollback, concurrent updates and two-tab policy revocation.
- Student submission rejects approval/correction/verification claims, duplicate overwrites and reference demo; retains exact pending content/source excerpts. Only eligible practice snapshots are returned.
- Strict acceptance evidence must bind content revision. Independent eligibility never changes review, approval or fidelity. Drafts, malformed/insufficient content and reference assets remain ineligible for normal practice.
- UI: once-only setup, risk explanation/checkbox, persistent policy, unreviewed student notice, active-session pause after strict revocation, production demo exclusion and development demonstration regression.
- Commands: `npm.cmd test`, `npm.cmd run lint`, `npx.cmd expo install --check`, `npm.cmd run export:web`; run localhost:8083 preview and `node scripts/verify-household-web.cjs` for actual browser/IndexedDB checks. No new dependencies.
- Owner reported FC-003 human acceptance for first-attempt success, success after retry and two incorrect attempts; record as reported evidence, without inferring Android/device testing or educational efficacy.

## Educational POC acceptance
- Teacher-provided vocabulary and definitions preserved exactly after review.
- `patient` -> `patiemment`; `patiament` rejected.
- Error spotting has one clear wrong spelling in single-answer mode.
- Dictation answer hidden until submitted; replay available on supported device.
- Mixed practice uses at least three question types.
- Child sees French-first guidance; parent receives accurate English explanation.
- Source and supplementary content are visually distinguishable.
- Incorrect answers can be revisited; no AI call needed for repeated sessions.

## Human validation

### FC-005 Increment 3 — protected transactional commands

Local verification: 156 automated tests passed, lint/web export/browser regressions passed; the unchanged eight-patch SDK 58 dependency exception is reported separately. New protected commands have no UI yet and were not physically exercised on Android. Owner acceptance and Increment 4 authorization remain separate gates.

Automated coverage includes authorized review/correction writes; forged, revoked, expired and replaced capabilities; queued pre-write denial; issued-write atomic completion after locking; protected-result suppression; preservation of a newer session without renewal; authorized reread of latest persisted revisions; competing stale writes; malformed documents; invalid/missing explanations and field paths; rollback; caller-input snapshots; source/ID preservation; supplementary origins; full correction review reset and acceptance invalidation; review-only counters/no implicit acceptance; sample reload retention/production exclusion; student correction-claim rejection. Native adapter regression uses real Node SQLite with mocked Expo/SecureStore interfaces; browser checks use real IndexedDB for review/correction/CAS durability alongside existing policy, PIN, randomization and two-attempt regressions. These checks do not establish physical Android runtime acceptance of new commands. No review UI or whole-assignment approval command exists in this increment.
Parent checks source transcription and answer keys. Observe whether a Grade 4 child can complete a short session independently; note confusing interactions without storing identifying details. Do not treat one household's experience as market validation.

## Prepublication accessibility gate - deferred, not passed

- [ ] Physical TalkBack verification on Android: labels, checkbox/expanded/disabled states, focus/navigation, announcement timing, native PIN security and genuine-action inactivity renewal versus idle expiry.
- [ ] Resolve any accessibility findings before making publication accessibility claims. Development-milestone acceptance is not a public release authorization.

The eight Expo SDK 58 patch recommendations remain separately tracked in TODO.md; no dependency upgrade or check suppression is part of FC-005 acceptance.
