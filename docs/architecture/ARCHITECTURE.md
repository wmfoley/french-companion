# Architecture Baseline — v0.1

## FC-007-UX2 contextual handoff

studentAssignmentList projects reviewRequired only from eligible === false plus reason === approval_required. /assignments renders an Ask a Parent link with a single assignmentId parameter; all study access remains governed by the existing service. /parent treats the optional ID as untrusted context. Its keyed screen instance resets on context changes, preserving existing route-exit lock/operation invalidation. After successful unlock and authorized policy read, assignmentReviewController.open performs the existing service-authorized current document read. No content is loaded from context before unlock and no parent capability is put in navigation or storage.

Existing controller epochs/capability checks and service authorization before/after asynchronous reads suppress obsolete selections after lock/re-entry. Missing or malformed IDs receive a safe unavailable message with existing list/household navigation; other errors keep existing handling. No review, correction, approval or storage contract changes. Five-minute inactivity and background locking remain unchanged; a new unlock rereads the requested assignment rather than reusing its snapshot.

Contextual Return to Assignments calls the existing lock function before router.replace('/assignments'). It clears protected editing state even during pending work; already-issued durable writes retain existing atomic-completion semantics and cannot publish late protected results. The assignment-list focus refresh remains authoritative; no run or typed draft is restored. Android Back re-entry must authenticate again. Capture/preparation enforcement/history are not implemented here. The owner accepts UX2 on physical Android 18 PASS, 0 FAIL, 1 NOT VERIFIED plus targeted unit/browser passes for nonexistent, empty, missing and malformed IDs. Physical results remain 18/0/1; the channels are not combined into a device pass count. FC-007B camera, FC-007C native OCR proof, later preparation/trusted enforcement and FC-008 history remain deferred; physical TalkBack is unverified and eight Expo patches remain separate maintenance.

## FC-007-UX1 navigation implementation

The existing Expo Router stack now includes `/assignments`, `/add-assignment` and `/grades`. Home has two dominant student links plus secondary My Progress/Parent Area and quieter development links. Assignment selection moved out of `/practice`; its no-ID entry redirects to `/assignments`, while selected-assignment and development-demo routes retain the existing practice engine and guards.

`src/services/studentAssignmentList.js` is a small memory-only presentation controller around `listPracticeAssignments()`, not a new authorization or persistence service. It maps only existing service eligibility/reason/unreviewed-notice metadata, clears stale availability during refresh/failure, and rejects late results using active/request identities. Focus, Android AppState resume and web visibility return refresh the list; leaving/backgrounding invalidates outstanding reads. Cards do not infer preparation, safety or correction-history facts. Deep links still use readPractice and existing run eligibility/contentRevision checks. Parent routes, capabilities, storage and approval/correction commands are unchanged.

Add Assignment and My Progress are honest informational destinations only. UX1 added no capture, recorded passes or contextual parent handoff. Existing Screen, typography and touch patterns are reused; no global session store, dependency or native change. Owner-reported UX1 physical Android acceptance is complete: 18/18 PASS, no defects or observations. UX2's subsequently authorized handoff is described above; FC-007B and FC-008 remain future, separately authorized work. TalkBack remains deferred/unverified; UX1 acceptance changes no other implementation boundary.

## Future student navigation and learning-history boundaries

Student-first navigation is planned, not implemented by FC-007A: primary Study an Assignment / Add New Assignment actions; a local assignment list with visible ineligibility explanations; unobtrusive secondary Parent Area access. Starting practice must retain existing strict/independent policy enforcement rather than using approval status alone. Parent-only operations remain PIN-protected at the service boundary. Student-initiated capture must not require parent unlock or confer parent capabilities; capture integration remains future work.

Provisionally FC-008 will separately design local persistence of completed practice passes by assignment, exercise type and assignment content revision. Interrupted/abandoned sessions must not appear as completed grades. A completed pass should support individual vocabulary review with the existing three terminal outcomes, retaining sufficient revision-aware historical information after corrections. Do not persist raw typed mistakes by default. Historical representation, retention and storage contracts require later design; FC-007A adds no schema or persistence. Presentation remains supportive, without competitive ranking. Targeted practice from missed/second-attempt vocabulary is a further future feature requiring explicit implementation authorization. See the PRD and TODO for the product requirements.

## FC-007A preparation boundary - 2026-11-15

FC-006 is committed and synchronized at 0248cfbbc19f4ed0b797600055e53fda99f9ca0f. FC-007A adds only an unconnected pure version-1 preparation/evidence contract, a synthetic test corpus and deterministic tests. See [PREPARATION_MODEL.md](PREPARATION_MODEL.md) and draft [ADR-FC-007-001](../decisions/ADR-FC-007-001.md). Exact source spans, explicit pair associations, exclusions, partial disclosure and independent reliability/safety declarations are checked without changing assignment schema, approval, student eligibility or storage. Contract readiness is not approval or authorization. The future mandatory service-level suitability gate, trusted assessment production and partial-acceptance integration remain unimplemented; current submission is unchanged. No camera, OCR, AI, network, permission, dependency or UI work is included.

## FC-006 current practice architecture - 2026-11-15

Exactly two exercise types are implemented: vocabulary_multiple_choice (the backward-compatible default) and typed_vocabulary_recall, presented as Spelling Practice. Both use reference-only question definitions, the existing in-memory practiceRun coordinator, authorized assignment snapshots and the same live eligibility/contentRevision verifier. Start/Replay/Submit/Next, resume and existing polling retain household-policy enforcement; route exit and invalidated content discard the active run and drafts. No generalized exercise registry or persisted student-performance model was introduced.

Spelling Practice resolves the French definition from the referenced vocabulary item and grades the complete stored term, including articles, through unchanged gradeAnswer semantics. Blank or grading-equivalent incorrect resubmissions consume no attempt. There are at most two meaningful attempts and five eligible questions; the expected term is withheld from typed prompt/feedback until completion. Multiple Choice necessarily includes the correct term among unlabelled choices. Grading context stays separate from student presentation; locally inspectable assignment data is not encrypted or hidden from device developers.

No new parent preparation/configuration/approval, assignment schema, storage, dependency or native changes. Existing detailed/bulk acceptance and independent household policy remain sufficient. Development sample/reference production exclusions remain. See [EXERCISE_MODEL.md](EXERCISE_MODEL.md) for exact contracts.

Owner-reported physical Android acceptance, recorded 2026-11-15: 12 passed, 0 failed, 0 skipped, 0 outstanding; no observations or defects reported. Physical TalkBack is separate, deferred and unverified. These JavaScript changes use Metro with the existing development APK; household authentication still requires the accepted native module and cannot run in Expo Go. Commit authorization and assignment capture remain separate gates. Earlier increment/platform descriptions below are historical where superseded by this current state.

## FC-005 development-milestone acceptance - 2026-11-14

The owner accepts FC-005 for the current development milestone. Physical Android results are **5A: 9/9 passed; 5B: 6/6 passed; 6A: 6 passed, 1 skipped; total: 21 passed, 1 skipped**. No functional defects were reported. **Physical TalkBack accessibility testing was intentionally skipped and remains unverified**, deferred to prepublication accessibility testing. Automated activity tests and browser checks do not establish TalkBack correctness or publication readiness.

The accepted implementation includes protected assignment reads, transactional review/correction/approval commands, the existing Parent Area interface, FC-005-06 authorization boundaries, FC-005-07 selective review preservation and the three Increment 6A corrections. Approval, field review, household practice eligibility and source fidelity remain separate. Historical increment records below describe their original delivery status; this dated acceptance supersedes earlier pending-acceptance or unimplemented-capability wording for completed FC-005 work. No new product scope is authorized by acceptance.


Expo-first runtime approved through ADR-0001 on 2026-11-10; future integrations remain deferred.

## FC-004N current platform boundary

[ADR-0003](../decisions/ADR-0003.md) supersedes native deferral in the earlier FC-004 descriptions below. Native composes the same household service with transactional Expo SQLite and a SecureStore-bound credential record; web retains IndexedDB/Web Crypto. SQLite contains existing versioned assignment envelopes, policy and revisions, not PIN credentials. Interrupted initialization and missing/mismatched credentials remain locked without resetting data. No assignment schema change.

Both platforms use five-minute inactivity expiration, refreshed only by authenticated parent interaction; leaving Parent Area or backgrounding locks and cancels pending unlocks. Practice rechecks persisted policy on resume, transitions and polling. A parent-only development sample command preserves pending review/source fidelity and is excluded by production service and generator checks. Native export/adapter tests do not substitute for physical Android development-client acceptance; FC-004N and FC-003A are already owner-accepted, and FC-005 is accepted as recorded above. Android household authentication requires French Companion Dev; Expo Go supports only activities that do not require the native module. Mixed sprints and optional parent-controlled, disabled-by-default CURR-001 remain future work.

## Runtime
FC-004N.2B/[ADR-0005](../decisions/ADR-0005.md) now connects Android household creation/verification to the platform PBKDF2 module on a background dispatcher, with fixed parameters and no JS fallback. Missing/new-method-unavailable binaries fail closed before household reads/writes; protected commands recheck availability. Web remains WebCrypto. Storage protocol, parent lifecycle and assignment schema are unchanged. That native integration required a separately approved development APK and subsequently passed owner-reported Android household acceptance under FC-004N; proof success alone did not complete the gate.
FC-004N.2A adds an isolated Android proof module, not a household credential engine replacement. [ADR-0004](../decisions/ADR-0004.md) defines the opt-in development identity, EAS preparation boundary and physical correctness/performance gate. Web uses its existing credential implementation. The later separately approved build, native proof and household acceptance completed the FC-004N gate on Android 12; this proof paragraph records the original transition boundary.
Expo + React Native + Expo Router (JavaScript); web for early interactive validation, Android target. Prefer minimal dependencies. Use the built-in Node test runner for pure JS modules; see ADR-0001 for exact version selections. Select Node 22 with the repository's `.node-version` and a terminal-local fnm environment.

## Proposed directories after scaffolding
```text
app/                   Expo Router screens
src/components/        Reusable accessible UI
src/core/exercises/    Schemas, graders, generators (pure JS)
src/core/review/       Mistake categorization and local review rules
src/content/fixtures/  Anonymous reference fixtures with explicit review/provenance
src/content/rules/     Reviewed French grammar rules
src/services/speech/   Platform speech adapter
src/services/ai/       Future server-only AI interface (no client secrets)
src/services/ocr/      Future OCR interface
supabase/              Future migrations/functions (not required for FC-001)
tests/                 Automated unit and integration tests
docs/                  Product governance
```

## Data boundaries
Schema version 1 is specified in [ASSIGNMENT_MODEL.md](ASSIGNMENT_MODEL.md) and implemented by pure JavaScript utilities in `src/core/assignments/`. Preserved source excerpts and field-level interpreted content/provenance remain separate. Assignment approval accepts interpreted content for practice; it never upgrades source fidelity. Substantive edits to approved educational content require renewed review. FC-002 documents this policy without implementing revision history or an editing workflow.

Teacher-provided text -> parent-reviewed structured assignment -> exercise definitions -> local student attempts -> local progress summary. Supplementary AI practice must be tagged separately. FC-003's minimal versioned vocabulary definition references assignment/item IDs and resolves prompt, correct term, provenance and fidelity from an independent assignment snapshot rather than duplicating them. See [EXERCISE_MODEL.md](EXERCISE_MODEL.md). Future exercise types may add explicit prompt/accepted-answer fields when required.

Approved [ADR-0002](../decisions/ADR-0002.md) separates review status, practice eligibility and source fidelity. Normal generation applies the persisted household policy: strict by default, or explicitly parent-enabled independent practice with eligible unreviewed content. Parent-only policy commands validate in-memory capabilities independently of routes. IndexedDB transactions persist configuration and versioned assignment envelopes on web; native operations use the accepted SQLite/SecureStore/native-PBKDF2 composition and fail closed on unavailable or inconsistent credentials. The pending reference fixture remains explicitly development-demo-only (`__DEV__`). Exercise definitions, content and responses remain separate; no persisted performance records or adaptation yet.

## Grading
Pure functions, with explicit policies for accents, capitalization, whitespace, and punctuation. Never normalize away a learning target by default. Record mistake categories without exposing answers before submission.

## Later integrations
On-device OCR with human review; secure server-side AI generation with schema validation; optional parent-managed Supabase auth/storage and local cache. All remote calls must be authorized and privacy-reviewed before launch.

## Operational separation
Independent Git repository, environment variables, Supabase project reference, and terminal. Do not connect to any existing equipment-planning Supabase project.

## FC-005 Increment 1 — pure parent-review foundations

**Current correction rule, FC-005-07 (2026-11-12):** selective review preservation supersedes the historical reset-all descriptions. Only materially changed fields require renewed review; unchanged field metadata stays exact. Whole-assignment evidence always clears after material correction, and content/write revisions increment once per batch. Existing paths/IDs suffice without structural edits or a migration. Fresh explicit approval is required. The shared service, storage adapters, authorization and FC-003A presentation remain unchanged. Owner reports Increment 5A Android UX acceptance 9/9 passed; Increment 5B physical Android acceptance is owner-reported 6/6 passed; FC-005 is accepted for the current development milestone, with physical TalkBack verification deferred and unverified.

Approved [ADR-0006](../decisions/ADR-0006.md) implements the method-aware assignment/document boundary from [FC005_PARENT_REVIEW_APPROVAL_SPEC.md](FC005_PARENT_REVIEW_APPROVAL_SPEC.md). Content validation no longer equates whole-assignment approval with detailed field review; strict eligibility requires matching detailed or bulk-risk evidence. Independent policy and safe vocabulary generation retain their existing boundaries. Pure field enumeration, envelope/revision validation and immutable review/correction transforms are implemented; later protected commands and Parent Area UI are not.

The document's additive writeRevision is separate from contentRevision. Legacy absence has effective revision 0 without a read migration. Real mutations consume a write revision; material corrections also increment content revision and reset changed-field review and clear whole-assignment acceptance (FC-005-07). No SQLite, IndexedDB, SecureStore, PIN, question-generation or FC-003A session implementation change is included. Existing service-created documents remain valid legacy records until a later authorized persistence increment supplies the new counter.

FC-005 Increment 6A also guards policy reads/polling by capability identity and epoch, initializes new writeRevision counters to 1 while retaining legacy effective 0, and explicitly records genuine session-bound parent UI activity. No credential, native, database-schema or practice-session change is part of FC-005. Local authorization protects the child-facing application boundary, not a compromised device or direct data tampering. No publication/accessibility claim follows from development acceptance.
