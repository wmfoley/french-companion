# Architecture Baseline — v0.1

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
