# Development Backlog — v0.1

## FC-007B Gate 4B.3B-1 — native household foundation

- [x] Gate 4B.3B-1A targeted verification: six additional tests (coordination25, combined78/78, full434/434), lint and hygiene passed. Verified current authorization for replay, final pre-INSERT guard, first-write rollback, all request fingerprint fields, private reads and increasing sequence after restart. No production correction needed. Internal guard injection remains a trusted composition boundary; Android-native verification and coordinator wiring remain deferred.
- [x] Implemented opt-in internal parent ticket bridge, ready/SecureStore-verified credentialId accessor, additive versioned receipt sidecar and atomic receipt/target-payload API. Public household/store API and web composition unchanged. No actual image binding/fence/coordinator wiring.
- [x] New19 foundation tests; combined household/authorization72/72, full428/428, lint passed. Real isolated Node SQLite/close-reopen with fake SecureStore/credential engine; not Android-native evidence. Legacy writeRevision0, receipt-only exact payload preservation and post-issuance revocation semantics verified.
- [ ] Gates 4B.3B-2/3 remain unauthorized: consume foundation for scope bootstrap, reservations/fences, reference completeness, cross-store recovery and saved-source workflows only after approval. Android transaction/SecureStore/lifecycle verification and any build/install remain separate.

## FC-007B Gate 4B.3A — trusted coordinator design

- [x] Gate 4B.3A.1 design refinement maps actual setup/submission/sample/review/correction/approval writers and confirms no production image binding/import/deletion writer. Defines native credentialId reuse, private epoch-aware auth bridge, exact receipt/coordinator fields, all-writer completeness and restart-protective fences. Current synchronous update API needs additive receipt support; web has no native installation identity. Recommend native-first, fail-closed nonempty-unbound scope, no assignment payload migration.
- [ ] Gate 4B.3B-1 now implements the approved private household sidecar/bridge foundation. Remaining coordinator schema/all-writer enforcement, scope bootstrap and native verification need future approval; Gates 4B.3B-2/3 remain unauthorized. Lease timeout must never release unresolved fences. The earlier refinement itself made no code/schema/data changes.

- [x] Design-only review documents constructor-bound scope ownership, proposed household epoch/auth bridge, immutable/historical binding union, complete writer protocol, capture-side fences/reservations and proposed household-side operation receipts. Cross-store writes are recoverable, not atomic. See current FC007B_CAPTURE_PROOF.md section.
- [ ] Gate 4B.3B remains unauthorized. Owner review required for scope bootstrap/rebinding, narrow auth bridge/household sidecar write interface, coordinator schema, all-writer fencing, stale-confirmation/recovery rules and native evidence. No caller completeness flag/object or route household ID is authority. Deletion/production integration/builds require separate authorization.

## FC-007B Gate 4B.2B-2 — isolated adoption/integrity

- [x] Gate 4B.2B-2A targeted verification: final-file process-stop state retains digest/ID, active lease blocks, recovery hashes existing bytes without recopy/overwrite, stale/corrupt recovery exposes no asset. Five new tests; adoption21 + SQLite22 =43/43 focused, full409/409, lint passed. Internal-only duplicate scope limitation explicit: no multi-household partition/auth implementation; trusted constructor must bind correct store/live parent scope. Untrusted request scope fields reject; unscoped saved findings off.

- [x] Injected private-file adapter and adoption service implemented with capacity/path checks, bounded SHA-256, exclusive staging/finalization, durable IDs/checkpoints/leases and atomic core/journal completion. Capture DB v1->v2 migration is isolated from household DB. No UI/native driver binding or installed-app integration.
- [x] Real isolated filesystem/SQLite tests plus injected decoder/capacity/faults:16 adoption tests,22 metadata tests, combined102/102, full404/404, lint passed. Native decoding, permission/absence semantics, storage capacity/durability and main-Dev compatibility remain unverified.
- [ ] Separately authorize Expo filesystem-driver implementation and isolated Android verification, trusted scope/parent wiring, cross-repository coordination and backup exclusions. No saved-image deletion, automatic cleanup, production integration, build/install or Git publication authorized.

## FC-007B Gate 4B.2B-1 — metadata and recovery journal

- [x] Authorized isolated metadata adapter implemented with canonical SQLite authority, transactional initialization/version checks, database CAS, atomic completed metadata journal, idempotent replay and generation-checked external-operation recovery records. Not wired to app or household storage. New20 real-SQLite tests; combined84/84, full386/386, lint passed. See current proof notes for limits/API.
- [ ] Gate 4B.2B-2 requires separate authorization: file adoption/hash/capacity, actual deletion/cleanup, coordinator/fences, parent confirmation/authorization and native verification. External journal entries do not establish physical success or permission. No production integration/build authorized.
- [x] CAP-002 exact SHA-256/byte-size findings implemented in isolated adoption: current other pages and authorized saved-scope category/count only; no automatic rejection/merge/deletion. Real parent-scope integration remains deferred. Visual similarity remains a later enhancement; not implemented.

## FC-007B Gate 4B.2A — storage/recovery design

- [x] Gate 4B.2A.1 adds pure beginDraftCleanup/completeDraftCleanup: exact expiry/revision/protection checks, frozen pending target, retained metadata/tombstone receipt and idempotent completion. Six new tests; core23/23, full366/366, lint passed. Trusted coordinator contract documented; completeness flags remain untrusted external facts until supplied by that future service.
- [ ] Durable coordinator/SQLite/file implementation remains unauthorized. Earlier missing cleanup-transition prerequisite is resolved; reference-writer fencing, cross-store reconciliation, real absence/hash/capacity checks and native verification remain outstanding.

- [x] Owner accepts Gate 4B.1. Gate 4B.2A documents separate capture SQLite authority/projections, operation journal, copy/hash/finalize adoption, complete shared-reference confirmation, recoverable deletion, observations, 24-hour retention checks and failure-point/test matrix. See current section in FC007B_CAPTURE_PROOF.md.
- [ ] Gate 4B.2B NOT authorized. Review prerequisites: durable integration of the new cleanup transitions, trusted cross-store binding/conversion reconciliation, parent capability integration, clock anomaly/free-space margins, bounded file hashing and real SQLite/native durability/backup tests. No production storage/UI/build/dependency changes authorized.

## FC-007B Gate 4A finalized / Gate 4B.1 pure repository core

- RET-001 approved: saved images remain until explicit authorized-parent deletion; review/approval never triggers deletion.
- DEL-001 approved: confirmed parent image deletion preserves assignment/practice material, source text/fidelity, approval and existing eligibility; retain source-unavailable metadata. Separate available/intentionally_deleted/unexpectedly_missing states proposed in capture repository, not assignment schema.
- [x] Owner approves RET-002 (24-hour recoverable unsaved sessions with retention checks), CAP-001 (20 pages, warning at 10), STO-001 (no fixed quota; space checks/warnings), AUTH-001 (saved originals Parent Area-only), DEL-002 (complete shared impact confirmation) and INT-001 (SHA-256 adoption/selective integrity verification).
- [x] Gate 4B.1 pure versioned core implemented: IDs/immutable assets, ordering/retakes, manifest CAS, historical bindings, separate availability/integrity, deletion intent/tombstone, impact/expiry/capacity validation and deterministic serialization. 17 new tests; combined focused/worklet 58/58, full360/360, lint passed. No adapters or production integration. See current contract in FC007B_CAPTURE_PROOF.md.
- [ ] Gate 4B.2 requires separate authorization: durable SQLite/file adapters, hashing/capacity/native verification, crash recovery, retention rechecks, complete-reference discovery and protected service enforcement. No file operations, parent-auth changes, UI, schema migration, build or Git publication authorized in 4B.1.

## FC-007-UX2 — contextual student-to-parent handoff

**Accepted by the owner on combined evidence:** physical Android **18 PASS, 0 FAIL, 1 NOT VERIFIED**; nonexistent, empty, missing and malformed ID cases each PASS in targeted unit/browser verification. Do not count these as additional device passes. TalkBack remains deferred/unverified. Final documentation and commit-readiness verification are authorized; staging, commit and push require separate approval.

- [x] Ask a Parent only for service-derived blocked approval_required assignments; ID-only route context, not a practice bypass or generic unavailable-content workaround.
- [x] Reuse PIN flow, protected current read and review controller after unlock; safe missing/invalid context, context-change reset and stale-response suppression.
- [x] Explicit locked Return to Assignments with focus refresh; no auto-approval, policy mutation, exercise launch or retained practice answers. Existing approval/correction, inactivity/background lock and issued-write transaction rules remain intact.
- [x] Focused unit coverage: 16 combined handoff/list tests (8 newly added); full suite 272/272 and lint passed. Web export/browser results recorded in the log.
- [x] UX2 milestone accepted: 18 Android passes, no failures; the one non-device-verified scenario is covered by four targeted automated/browser passes, preserving PIN/navigation/session protections and assignment/policy state. Physical tally remains 18/0/1.
- [ ] FC-007B camera capture; FC-007C native OCR proof; subsequent preparation and trusted service-level enforcement increments remain separately scoped and unauthorized here.
- [ ] FC-008 persistent Grades, physical TalkBack verification and eight Expo patch recommendations remain deferred. No staging/commit/push authorized.


## FC-007-UX1 — student-first navigation (not implemented in FC-007A)

**Accepted:** owner-reported physical Android **18/18 PASS**: Student Home 3/3; Assignment Navigation 3/3; Household Policy 3/3; Practice Regression 4/4; Other Screens and Layout 5/5. No defects or observations reported. TalkBack remains deferred/unverified. Final documentation and commit-readiness verification are authorized; staging, commit and push still require explicit authorization.

- [x] Student-focused landing page: Study an Assignment and Add New Assignment as primary actions; My Progress and Parent Area as secondary navigation, with PIN-protected parent-only operations and quieter development links.
- [x] Study opens `/assignments`; distinguish ineligible assignments with text explanations. Strict/independent eligibility follows the existing service, not approval status alone. Refresh on focus/resume; stale reads suppressed; loading/empty/error/retry states.
- [x] Preserve selected practice and demo routes; redirect no-ID `/practice` to the list. Add honest camera/history informational destinations without persistence or new parent handoff.
- [x] Local verification: 8 focused / 264 total automated tests, lint, web export and cleaned full browser regressions passed. Scope remains JavaScript/navigation plus tests/docs; no persistence, authorization, schema, dependency or native change.
- [x] Owner completed physical Android acceptance: 18/18 PASS in the five categories above. No defects/observations reported; TalkBack is not included as passed.
- [x] UX1 did not implement contextual parent handoff; subsequently authorized UX2 status is recorded above. FC-007B capture integration, FC-008 history, TalkBack verification and eight Expo patches remain deferred separately.
- [ ] Permit students to initiate worksheet capture without first unlocking the Parent Area; no parent privileges or approval granted by capture. Requires separately authorized capture/UI implementation.

## FC-008 (provisional) — Persistent Grades and vocabulary-level review

- [ ] Separately design/implement local completed-pass history by assignment and exercise type, preserving the associated assignment content revision. Interrupted/abandoned sessions are not completed grades; keep the experience supportive rather than competitive.
- [ ] Let students open a completed pass and review individual vocabulary outcomes: correct_first_attempt, correct_second_attempt, incorrect_after_two_attempts. Preserve sufficient revision-aware historical information for accurate review after assignment corrections; do not persist raw typed mistakes by default.
- [ ] Future targeted practice may use missed/second-attempt vocabulary, but is not authorized for implementation now. No history persistence, schema or practice-behaviour change in FC-007A.

## FC-007A - Preparation contracts and evidence corpus

**Current status (2026-11-15):** Product owner accepts the implementation and architecture verification findings; final documentation reconciliation and commit-readiness verification are authorized. No FC-007B work or commit authorization. FC-006 is committed and synchronized at 0248cfbbc19f4ed0b797600055e53fda99f9ca0f; its earlier commit-preparation notes below are historical.

- [x] Draft ADR-FC-007-001 with explicit unresolved confidence, trusted assessment, partial-acceptance, privacy/retention and future cloud decisions.
- [x] Version-1 evidence/preparation validation, exact source spans, explicit pair associations, deterministic exclusions, suitability/reliability/safety separation and partial disclosure; no assignment or authorization changes.
- [x] Twelve synthetic non-identifying corpus cases; focused tests plus existing regression suite. No real OCR performance or safety-classification claim.
- [x] Owner accepts FC-007A implementation and architecture verification findings. ADR remains preserved as drafted; no staging/commit/push authorized.
- [ ] Later increment: trusted/current assessment and mandatory service-level suitability enforcement, including the existing raw submission boundary and partial-acceptance integration. Contract readiness alone cannot authorize submission or practice.
- [ ] Capture increment decisions: permissions, local images, retention/deletion/backup/privacy, resource bounds and original-image links. No camera/OCR/cloud/storage integration in A.
- [ ] Measure the approximately 120-second parent active preparation target on supported worksheets; generated-question inspection stays optional. No new parent action in A.

## FC-006 - Typed Vocabulary Recall / Spelling Practice

**Current status (2026-11-15):** FC-006A/B/C are implemented; FC-006D final verification and documentation reconciliation are authorized. The owner reports physical Android acceptance: 12 passed, 0 failed, 0 skipped, 0 outstanding; no observations or defects. TalkBack remains separately deferred/unverified. No dependency, native, schema, household-service, Parent Area or persistence changes. One coherent milestone commit requires explicit owner authorization; no staging, commit or push yet.

- [x] Confirm both provisional policies are compatible before coding: grading-equivalent incorrect retries consume no attempt; narrowly defined whole-term/article-stripped-headword literal leakage exclusions.
- [x] Full-envelope eligibility, reference-only questions, deterministic ID order and maximum five; existing detailed/bulk approvals and independent policy reused without extra parent steps.
- [x] Pure grading/immutable attempt transitions, question-bound response states, two attempts/three existing outcomes, blank/repeated no-ops and completion-only answer feedback.
- [x] Twenty focused tests and full automated suite 210/210 passed; lint passed. Existing multiple-choice/FC-003A, household/FC-004N and FC-005 regressions remain passing.
- [x] FC-006B: owner-authorized explicit two-type session/presentation dispatch, private grading snapshots, completion-only feedback and existing policy/contentRevision verifier/concurrency/stale-operation safeguards.
- [x] FC-006B local tests: 16 focused integration tests and full 226/226 suite; lint passed. Existing multiple-choice defaults and option draw ordering preserved. Web results are in the log.
- [x] FC-006C: owner-authorized student activity selection and typed input, retained first-miss draft, meaningful-edit Submit guard and completion feedback, existing policy/revision/lifecycle checks; no parent changes.
- [x] Owner-reported physical Android acceptance: 12 passed, 0 failed, 0 skipped, 0 outstanding; French entry, cursor, keyboard visibility, grading, retries, Replay, navigation, background/resume and authorization/content correction. No observations/defects reported. TalkBack is a separate unverified prepublication item.
- [x] FC-006D final verification: 231/231 tests, lint, web export (814 modules), full browser regressions and Git scope/whitespace checks passed; documentation reconciled. Ready for one coherent milestone commit, pending explicit authorization. No feature implementation.
- [ ] Future intake quality target: capture -> review exceptions -> ready to practise with approximately two minutes of typical parent involvement. Measure active time/interactions/correction burden; preserve policy/provenance distinctions. Not implemented by FC-006A.

Physical TalkBack verification remains unverified/deferred to prepublication testing. The eight Expo SDK 58 patch recommendations remain separate maintenance; no upgrade or check suppression.

## FC-005 development-milestone acceptance - 2026-11-14

The owner accepts FC-005 for the current development milestone. Physical Android results are **5A: 9/9 passed; 5B: 6/6 passed; 6A: 6 passed, 1 skipped; total: 21 passed, 1 skipped**. No functional defects were reported. **Physical TalkBack accessibility testing was intentionally skipped and remains unverified**, deferred to prepublication accessibility testing. Automated activity tests and browser checks do not establish TalkBack correctness or publication readiness.

The accepted implementation includes protected assignment reads, transactional review/correction/approval commands, the existing Parent Area interface, FC-005-06 authorization boundaries, FC-005-07 selective review preservation and the three Increment 6A corrections. Approval, field review, household practice eligibility and source fidelity remain separate. Historical increment records below describe their original delivery status; this dated acceptance supersedes earlier pending-acceptance or unimplemented-capability wording for completed FC-005 work. No new product scope is authorized by acceptance.


## Gate 0 — owner approvals
- [x] Approve ADR-0001 (Expo-first) and reconcile PRD architecture wording.
- [ ] Create private Git repository and dedicated VS Code window.
- [ ] Confirm no child identifiers are included in fixtures.

## FC-001 — Initialize Expo repository and quality gates
**Status:** Implemented; automated checks and headless web navigation passed. Android/human visual review untested; tooling advisories documented. Private remote repository and dedicated-window confirmation remain owner checks; no remote actions taken.
- [x] Inspect current repository before changes; report any existing files.
- [x] Scaffold supported JavaScript Expo + Expo Router app with version-pinned dependencies.
- [x] Create proposed `src/core`, `src/content/fixtures`, `src/components`, and `tests` structure.
- [x] Add scripts for lint, unit test, and app startup; document exact commands.
- [x] Add minimal home screen and placeholder practice screen with no fake backend calls.
- [x] Add one pure JS sample grader plus unit tests (including accent-sensitive failure).
- [x] Keep `.env` secrets ignored and add safe `.env.example` only if needed.
- [x] Run tests and launch web preview; document Android test status honestly.
- [x] Update development log and TODO.

**Exit:** App starts in web preview; test suite passes; code has no remote services, no secrets, and no references to the equipment platform.

## FC-002 — Reference assignment and schema
**Status:** Implemented; reference content remains `pending_review`, unverified against the original worksheet. See assignment model specification and final verification in development log.
- [x] Copy PRD section 5 reported content into an anonymous reference fixture without claiming verified worksheet transcription or inventing missing content.
- [x] Define schema version 1 and pure validation/normalization, with preserved sources separate from field-level provenance and interpreted content.
- [x] Document draft/pending_review/approved lifecycle, correction explanations, fidelity independence and renewed review after substantive edits.
- [x] Add deterministic fixture, malformed-content, Unicode, preservation and grader regression tests.
- [x] Update architecture, PRD source qualification, test plan, fixture README, root README and development log.

FC-002 handoff originally required parent acceptance before practice. ADR-0002/FC-004 now apply household policy separately: strict mode requires acceptance; independent mode permits eligible pending household content. Keep the checked-in fixture pending and development-only. No generator or review UI was implemented in FC-002.

## FC-003 — First interactive vocabulary exercise
**Status:** Implemented and web-verified; owner reported initial human acceptance for first-attempt success, retry success and two misses. Android functional acceptance was subsequently owner-confirmed; physical TalkBack verification remains unverified/deferred to prepublication testing. The fixture stays pending review.
**Scope:** Owner-approved narrowing to vocabulary multiple choice; other exercise types retained below.
- [x] Versioned reference-based exercise representation and deterministic three-option generation.
- [x] Approved-content eligibility; explicitly labelled development-only pending reference demo.
- [x] Two-attempt ID grading, three response outcomes, progression guards and internal first-attempt scoring.
- [x] French-first playable session, retry encouragement, disabled repeated wrong option and participation-focused summary.
- [x] Pure core/session tests and documentation of assignment/exercise/response separation.
- [x] Final lint, tests, web export, browser development/production checks and development log report.

Historical FC-003 handoff: local parent review/approved-lesson loading and Android household validation were recommended next and have now been implemented/accepted through FC-004N and FC-005. Preserve the development demo exception separately from actual parent approval.

## FC-003A — Practice Randomization
**Status:** Implemented and owner-accepted on physical Android 12 (2026-11-11), including randomization, stable retries/background-resume, completion celebration, replay/reset and strict/independent policy revocation/re-entry. Final review: 108 tests, lint and web export pass; latest Expo dependency check fails because eight newer SDK 58 patches are recommended. Dependencies remain identical to accepted baseline 0c1cda7. Owner explicitly accepted this baseline dependency exception for FC-003A and authorized the milestone commit on 2026-11-11. Patch maintenance is deferred separately; do not upgrade or suppress the check here. Full results are in the development log.
- [x] Pure injectable Fisher–Yates presentation shuffle; copy definitions/options, preserve source ordering, IDs, target associations and distractor membership.
- [x] One authorized presentation per run; stable retries/rerenders/advancement, fresh replay and response reset for household and development demo paths.
- [x] Pending-action guard and visit/run identities; late authorization cannot publish after leaving or replace a newer run.
- [x] Deterministic permutation/immutability, lifecycle/outcome and household-policy regression tests; browser coverage expanded.
- [x] Execute full tests, lint, Expo dependency check, export and browser verification; preserve exact pass/fail results in the development log.
- [x] Owner explicitly accepted the unchanged-baseline Expo dependency-check exception; no dependency upgrade or suppression in FC-003A.
- [x] Owner physical Android acceptance: all planned scenarios passed; detailed results recorded in TEST_PLAN.md. No native APK/build required for FC-003A.
- [x] Owner authorized one local milestone commit after physical acceptance and final review; push remains unauthorized.

## Maintenance — deferred Expo SDK 58 patch alignment

- [ ] Review and plan the eight patch recommendations separately from FC-003A: expo 58.0.23 → ~58.0.24; expo-constants 58.0.15 → ~58.0.16; expo-crypto 58.0.7 → ~58.0.8; expo-dev-client 58.0.18 → ~58.0.19; expo-linking 58.0.16 → ~58.0.17; expo-router 58.0.30 → ~58.0.31; expo-secure-store 58.0.2 → ~58.0.3; expo-sqlite 58.0.15 → ~58.0.16.
- Latest unsuppressed check (2026-11-13) still flags eight packages; current targets are expo ~58.0.25, expo-constants ~58.0.16, expo-crypto ~58.0.8, expo-dev-client ~58.0.20, expo-linking ~58.0.17, expo-router ~58.0.31, expo-secure-store ~58.0.3 and expo-sqlite ~58.0.17. Earlier targets above are historical. No upgrade or suppression in FC-005.
- [ ] Obtain separate upgrade approval, reassess current compatible versions, native development-APK requirements and regression scope before installing anything. Retain the dependency check; FC-003A accepts its current failure because manifests match accepted baseline 0c1cda7.
## Remaining core exercise types — future tickets
- [ ] Matching pairs, spelling-error identification, fill-in-the-blank and grammar transformation.
- [ ] Per-exercise grading policies, reviewed keys and hints; plan one type at a time.

## FC-004 — Local Authorization, Persistence and Household Policy
**Status:** Web implementation verified; native household operations subsequently implemented and owner-accepted in FC-004N (the native-deferral notes below describe original FC-004 scope). Approved ADR-0002 supersedes earlier milestone boundaries.
- [x] One local household/PIN, supervised first setup, salted verifier, persisted cooldown and short-lived opaque parent session.
- [x] Parent-only commands independently enforce authorization, expiry, lock and policy revision checks.
- [x] IndexedDB transactions persist configuration/documents; invalid policy falls back to strict and failed/stale writes cannot enable independence.
- [x] Explicit risk-acknowledged independent-practice opt-in, with strict default and review/fidelity separation.
- [x] Pending student submission interface rejects approvals, parent-correction/verification claims, overwrites and reference demo ID. No intake UI yet.
- [x] Normal practice uses persisted eligibility, unreviewed notice, transition checks and two-second revocation polling. Bundled reference remains development-only.
- [x] Unit/regression tests, repeatable real IndexedDB/two-tab browser checks, lint, export and governance reconciliation.
- [x] Native adapter implementation and Android verification subsequently completed and owner-accepted under FC-004N; not part of original FC-004 delivery.

## FC-005 — Parent review, acceptance and student integration
**Current status:** Accepted by the owner on 2026-11-14 for the current development milestone and subsequently committed/pushed at 696550c202e54eb9ce89746c9b8ee52d29857541, the FC-006 baseline. Physical Android: 5A 9/9 passed; 5B 6/6 passed; 6A 6 passed, 1 skipped; total 21 passed, 1 skipped. Physical TalkBack was intentionally skipped and remains unverified, deferred to prepublication accessibility testing. No functional defects reported. Eight SDK 58 patch recommendations remain separate maintenance work. Earlier per-increment uncommitted/status notes below are historical.
- [x] Enumerate supplied schema-defined educational fields with independent descriptors and existing evidence paths.
- [x] Validate legacy/current envelopes, separate write/content revisions and method-aware acceptance evidence.
- [x] Immutable field-review/confirmed Mark All and correction/reset transformations; no receipt creation or persistence.
- [x] Focused unit tests and strict/independent regression coverage; source/ID/Unicode preservation and no implicit approval.
- [x] Complete Increment 1 validation and record exact results for acceptance; known SDK patch exception remains deferred and unsuppressed.
- [x] Owner accepted Increment 1 and authorized Increment 2 read-only parent access; all changes remain uncommitted.
- [x] Increment 2: protected read-only parent assignment metadata/detail commands; defensive snapshots, pre/post authorization and development-only visibility.
- [x] Increment 2 validation: 143 tests, lint, web export and browser regressions passed; unchanged eight-patch Expo exception reported separately.
- [x] Owner accepted Increment 2 and authorized Increment 3; FC-005-06 confirms pre-write authorization and atomic issued-write completion with protected-result suppression.
- [x] Increment 3: protected transactional corrections, individual/confirmed all-field review, write-revision CAS, source-preserving reset and development sample retention; no approval or UI.
- [x] Increment 3 validation: 156 tests, lint, web export and browser/real IndexedDB regressions passed; same eight-patch Expo exception remains unsuppressed. Physical Android command verification not claimed.
- [x] Owner accepted Increment 3 and authorized Increment 4; all FC-005 changes remain uncommitted.
- [x] Increment 4: protected detailed and explicit risk-acknowledged assignment approval, revision-bound evidence, atomic write revision and unchanged field/source fidelity under bulk acceptance.
- [x] Increment 4 validation: 168 tests, lint, web export and browser/IndexedDB regressions passed; same eight deferred Expo patch recommendations reported without suppression or upgrade.
- [x] Owner accepted Increment 4 and authorized Increment 5; all earlier uncommitted work preserved.
- [x] Increment 5 implemented: internal Parent Area list/detail/edit workflow, source inspection, review/correction/acceptance confirmations, unsaved protection and security-first lifecycle clearing.
- [x] Owner-reported final functional Android acceptance completed; exact totals and intentionally skipped TalkBack test are recorded in TEST_PLAN.md.
- [x] Final owner development-milestone acceptance of FC-005, subject to documentation/Git readiness review; physical TalkBack is explicitly deferred and unverified.
- [x] Increment 5A owner-approved refinements implemented after physical UX feedback: mounted detail/authorized refresh, stable card keys/source state, reversible Reviewed checkboxes and compact inline editor with protected switching.
- [x] Owner-reported Increment 5A physical Android UX acceptance: all nine tests passed (9/9).
- [x] Increment 5B / FC-005-07: immutable selective correction reset; exact unaffected reviews retained, either whole-assignment approval cleared, one content/write increment per material batch; no-op preservation and unchanged auth/storage contracts.
- [x] Increment 5B local verification: 184 tests, lint, web export and full browser regressions passed; same eight deferred Expo patch recommendations reported separately.
- [x] Owner-reported targeted Android acceptance of Increment 5B: 6/6 passed.
- [x] Increment 6A: epoch-aware policy reads and polling; new-document writeRevision 1 with legacy 0 retained; explicit session-bound accessible parent activity.
- [x] Increment 6A local validation: 190 tests plus focused six-test rerun, lint, web export and full browser rerun passed; eight deferred patch recommendations remain unsuppressed.
- [x] Increment 6A physical Android: 6 passed, 1 intentionally skipped; overall 21 passed, 1 skipped, no reported functional defects.
- [ ] Prepublication accessibility: physical TalkBack navigation, labels/states, activation, feedback and inactivity renewal/expiry remain unverified; see TEST_PLAN.md.
FC-004N is owner-accepted on Android 12. The following original FC-005 implementation objectives are implemented and development-milestone accepted; publication and Git actions remain separate gates.
- [x] Detailed item review and provenance-preserving corrections; original source excerpts never overwritten.
- [x] Reviewed approval plus separately labelled Approve All with explicit risk acknowledgement; both revision-bound, neither establishes source authenticity.
- [x] Renew acceptance after substantive educational edits; parent guidance and household validation. Independent households must not require approval for each eligible assignment.
- [ ] Define minimal local intake/lesson-management UI separately; FC-004 exposes only a protected/narrow service foundation.
- [ ] Validate with at least two additional worksheets before AI/OCR.

## FC-004N — Android persistence and parent authorization
**Historical blocker (resolved by FC-004N.2B):** slow JavaScript PBKDF2 prompted diagnostics, native proof and validated Android provider integration. Household authentication and final practice-policy checks are now owner-accepted on Android 12.
**Status:** Complete and formally accepted by the owner on Android 12 through FC-004N.2B; automated and prior web regression results are recorded in the development log. Native authentication requires French Companion Dev, not Expo Go.
- [x] Expo SQLite adapter behind the shared storage interface; transaction rollback, revision checks and no credential verifier in SQLite.
- [x] SecureStore-bound salted verifier and Expo Crypto randomness; accepted FC-004N.2B uses native Android PBKDF2 with unchanged parameters and no JavaScript fallback. Web retains WebCrypto.
- [x] Interrupted initialization/credential mismatch fail closed with retained data; no automatic reset.
- [x] True five-minute parent inactivity on both platforms; explicit interaction refresh, leaving/background lock and concurrent verification guard.
- [x] Parent-authorized, pending development sample; production service/generator exclusion and unchanged source model.
- [x] Native adapter/service tests, web regressions, dependency check, lint and both platform exports.
- [x] Complete owner-reported Android 12 development-client proof, household authentication, background/restart and policy/practice acceptance. Expo Go native authentication is deliberately unavailable; detailed proof timings remain in the log.
- [ ] Physical TalkBack/device accessibility verification remains unverified and deferred to prepublication testing; not passed by FC-005 development acceptance.

### FC-004N.1 — PIN setup diagnostics and lifecycle safeguards
- [x] Development-only, bounded, secret-free stage timings; on-device panel and console capture instructions.
- [x] Service setup guard and focus/operation identity; cancellation before first household write; complete strict binding after persistence starts.
- [x] Deferred-promise, concurrency, late completion, diagnostic bounds and partial-initialization regression tests.
- [x] Owner captured operation-1 PBKDF2 slow warnings at 10/30/60 seconds with no completion; Android 12 confirmed. No credential-engine replacement implemented.

### FC-004N.2A — native PBKDF2 proof / development-build preparation
- [x] Verified pre-change local history/worktree checkpoint without committing; retain FC-004N/FC-004N.1 changes.
- [x] Separate explicit development identity, internal APK EAS profile and upload exclusions; SDK-compatible dev client.
- [x] Debug/API-26+ local Android module, platform PBKDF2 on a background dispatcher, fixed public vectors only; no credential/storage integration.
- [x] Storage-free test UI and automated vector/controller/config tests; local checks recorded in development log.
- [x] Account/build/install/device/recovery instructions prepared; no accounts/EAS project/build/upload created.
- [x] Owner subsequently built/installed the proof APK and reports both vectors passed four runs each on Android 12; native ~3.6–3.7 seconds, round trip comparable. These are owner-reported results.

### FC-004N.2B — household native PBKDF2 integration
**Final acceptance:** Owner formally accepts FC-004N.2B: authentication, credential/policy persistence, restart/navigation/background locking, masking, inactivity expiry/renewal, development sample loading, strict/independent practice, strict-policy revocation and assignment retention all passed on Android 12.
- [x] Owner reports physical setup and saved-PIN unlock succeed without prolonged PBKDF2 delay. PIN-dot visibility correction also passed physical acceptance.
- [x] Fixed-parameter native household method and capability probe; retained public proof shares the same worker helper.
- [x] Native credential adapter with no JS fallback; missing/old/unsupported native APIs fail closed with clear messaging.
- [x] Preserve hex format, randomness, binding/recovery, service concurrency/cancellation and parent focus guards; unchanged web composition.
- [x] Tests and local verification recorded in development log; physical acceptance procedure prepared.
- [x] Owner subsequently installed and physically tested the updated integration APK. No new build/upload is requested or authorized here.
- [x] Owner verified household creation, saved PIN, restart, lifecycle, masking and both policy persistence on Android; existing data retained.
- [x] Owner confirms sample loading, strict/independent practice eligibility, strict-policy revocation and assignment retention throughout policy changes; final milestone acceptance granted.

Owner reports FC-003 automated and human acceptance on web and a physical Android device, and FC-004 web human acceptance. Earlier milestone notes above describe verification available at their completion.

## Later — Dictation, mixed practice and progress
- [ ] Speech adapter and audio fallback; dictation answer hidden until submission.
- [ ] Mixed quiz assembly after enough exercise types exist; mistake review.
- [ ] Plan privacy-conscious persistent progress/retention/deletion separately. FC-004 responses remain memory-only.

## Future — only after POC exit gate
Android device hardening; camera/OCR; secure AI backend; Supabase; parent-managed profiles; privacy/legal review; distribution.

## CURR-001 — Optional BC Curriculum-Aligned Enrichment (future, not implemented)
- [ ] Parent-controlled, disabled by default; based on reviewed BC French Immersion curriculum references.
- [ ] Teacher-assigned work remains the primary learning pathway. Enrichment stays optional and distinguishable from assignment source material.
- [ ] Review scope and authoritative curriculum references before implementation; no curriculum claims or content generation authorized in FC-003.

## FC-001 final verification — 2026-11-10
- Node 22.23.4 / npm 10.9.9 through terminal-local fnm; no default alias remains.
- `npm.cmd test`: 8 passed, 0 failed; lint passed; `expo install --check` up to date; web export passed.
- Live Expo web preview and headless Edge home -> practice -> home passed with no runtime exceptions/console errors. Android and human visual/accessibility review untested.
- `npm.cmd audit --json`: 12 moderate, no high/critical advisories. ESLint 9 deprecated; compatible Expo plugin update needed before ESLint 10.
- At FC-001 completion, FC-002 was next and not started. No fixtures or child identifiers were included in FC-001; see FC-002 status above for subsequent progress.
# FC-007B development capture proof (not production capture)

- [x] Cache-only Android comparison code, SDK-compatible camera/filesystem dependencies, route guard and deterministic tests.
- [x] Stage 1 isolated captureproof configuration, permission removal directives, native generation/autolinking and SecureStore resource inspection; 8 focused/280 full tests and lint pass.
- [x] EAS Gate 1 (2026-11-16): isolated captureproof profile, SDK 58 Linux image verified against official inventory, upload exclusions and configuration regression coverage. Existing development profile/project identity preserved; no authentication, signing, upload or build.
- [x] Local Windows build troubleshooting stopped after app-level Gesture Handler codegen path failure. Subsequent authorized EAS gates verified account/archive, built e7949cef-7ed1-40c2-9584-32502a5b7b33 once, inspected the APK and installed only com.frenchcompanion.captureproof through owner interaction. Never replace the existing development app; further builds/installs require separate approval.
- [x] Gate 6A installed/connected separate Capture Proof app; camera preview and scanner entry point verified. Gate 6B owner observed good photo/scanner quality, three-page scan with reorder/retakes and successful initialized offline scanning. Exact metrics/taps and first-use offline availability remain unrecorded/unverified. See current decision review in FC007B_CAPTURE_PROOF.md.
- [x] FC-007B.2 diagnostic implementation authorized: memory-only bounded per-page action/layout/scroll/image-event recorder, privacy allowlist and on-demand summary in existing proof. No reset, remount, clipping change or visual fix. Automated checks and Android evidence recorded in proof notes.
- [ ] CAP-PREVIEW-01: Gate 2B and Gate 2C.2 accepted; new Gesture Preview passed all nine reported Android categories on Lenovo TB-J616F Android 12. Disappearing-image defect validated as addressed in Capture Proof under tested conditions only; production closure pending. Original CameraView ScrollView comparison reported failed, precise symptom unconfirmed. Gate 3A documentation/design review records reusable geometry/viewer boundaries, missing production capture host/durable page contract, unverified main-Dev native runtime and staged integration/acceptance/rollback plan. Retain original fallback; production integration, removal and builds require separate approval. Prior automation 53/53 focused,343/343 full,lint; not rerun for this documentation review. Capture, files, order/cleanup and household behaviour unchanged. See FC007B_CAPTURE_PROOF.md.
- [ ] CAP-CONSOLIDATE-3B: Owner accepts Gate 3A. Gate 3B documentation proposes one coherent 25-path Capture Proof milestone (no staging/commit authorized), with path-by-path purpose/privacy/dependency inventory. Proposed durable capture/page IDs, separate revisioned SQLite/file ownership, recovery and viewer/host/Parent Review boundaries require product approval before implementation. Development camera plugin addition and Android-development-only route scope are explicitly recorded; no main-Dev native compatibility claim. See Gate 3B in FC007B_CAPTURE_PROOF.md.
- [ ] Required production preview follow-on: validated proof geometry/viewer needs separately approved production host, durable page contract and presentation adaptation. Gesture Handler 3.5.0/Reanimated 4.7.1/Worklets 0.13.1 runtime verified in Capture Proof only; main Dev remains unverified. No production integration, fallback removal or native build authorized. See Gate 3B sequence in FC007B_CAPTURE_PROOF.md.
- [ ] CAP-SCANNER-01: landscape access-notice panel reduces subsequent-page framing; waiting does not help. Owner verified portrait shrinks the notice and keeps subsequent pages usable on Lenovo TB-J616F. Portrait is a device-specific workaround, not an SDK fix; landscape remains unresolved. No orientation lock, notice suppression or native change.
- [ ] Production decision DEFERRED: scanner leading primary candidate, CameraView fallback candidate; resolve preview and assess scanner framing before selection. OCR suitability remains unverified. Production repository, backup exclusions and preparation remain separate; no OCR or trust-state changes.
