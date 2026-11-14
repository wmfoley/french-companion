# FC-005 — Parent Review and Approval Architecture Specification

## FC-005 development-milestone acceptance - 2026-11-14

The owner accepts FC-005 for the current development milestone. Physical Android results are **5A: 9/9 passed; 5B: 6/6 passed; 6A: 6 passed, 1 skipped; total: 21 passed, 1 skipped**. No functional defects were reported. **Physical TalkBack accessibility testing was intentionally skipped and remains unverified**, deferred to prepublication accessibility testing. Automated activity tests and browser checks do not establish TalkBack correctness or publication readiness.

The accepted implementation includes protected assignment reads, transactional review/correction/approval commands, the existing Parent Area interface, FC-005-06 authorization boundaries, FC-005-07 selective review preservation and the three Increment 6A corrections. Approval, field review, household practice eligibility and source fidelity remain separate. Historical increment records below describe their original delivery status; this dated acceptance supersedes earlier pending-acceptance or unimplemented-capability wording for completed FC-005 work. No new product scope is authorized by acceptance.


**Status:** Accepted by the owner on 2026-11-14 for the current development milestone; physical TalkBack verification is deferred and unverified. See the acceptance record below.
**Date:** 2026-11-11.  
**Inspected baseline:** `feec227` — `feat: randomize vocabulary practice session presentation`.  
**Authority:** Confirmed owner decisions FC-005-01 through FC-005-05 and subsequent explicit approval of method-aware validation, write revisions, incomplete-content limits, supplementary correction provenance and security-first unsaved-edit handling. These approved FC-005 decisions supersede conflicting older review invariants for the future implementation; no application code is changed by this document.  
**Terminology:** “Existing” describes inspected code at feec227. “Specified” or “proposed” describes authorized design for future code, not an implemented capability. D-* entries record resolved decisions, not outstanding requests to approve them again.

## 1. Purpose, scope and exclusions

**FC-005-07 — owner-approved 2026-11-12:** Selective review preservation supersedes all earlier reset-all wording, including historical increment records below. Reset only fields with materially changed text, correction explanation or correction origin. Preserve exact unchanged field metadata/status, including no-op entries in a mixed batch. Clear whole-assignment approval of either method, set assignment pending and increment both revisions once per material batch. A true no-op changes nothing. No semantic dependency tracking, schema migration or historical review reconstruction. Fresh explicit whole-assignment approval binds the new content revision; old receipts are never reused. Increment 5A physical Android UX acceptance is owner-reported 9/9 passed. Increment 5B physical acceptance is owner-reported 6/6 passed. Increment 6A is now owner-accepted for the development milestone, with physical TalkBack verification deferred and unverified.

**Current implementation status:** FC-005 through Increment 6A is implemented and owner-accepted for development. All changes remain uncommitted pending separate commit authorization. Physical Android: 21 passed, 1 skipped (TalkBack). Earlier implementation records are historical.

**FC-005-06 (owner-confirmed):** Check authorization at entry and within the synchronous transaction callback immediately before write issuance. Reject queued work after capability expiry/revocation/replacement. A validly issued write may complete atomically after subsequent authorization loss; do not cancel it for that reason. Suppress protected results after loss, and never revoke, renew or otherwise change a newer session from old work. On authorized re-entry reread persisted content/write revisions. This confirms Section 8's existing persistence boundary and is recorded in ADR-0006.

Provide a parent-authorized local workflow for reviewing all supplied educational fields, correcting existing interpreted text, and accepting a whole assignment for practice. Preserve three independent concepts: parent review/acceptance, household-controlled practice eligibility, and source fidelity.

Confirmed operations are distinct:

1. **Mark All Reviewed:** explicit parent declaration covering supplied fields; does not create approval evidence or claim independent inspection.
2. **Approve Reviewed Assignment:** complete review coverage and no unresolved known gaps; creates `reviewed` evidence for the current content revision.
3. **Approve Without Detailed Review:** initially unchecked risk acknowledgement plus confirmation; creates `bulk_risk_acknowledged` evidence without marking unreviewed fields reviewed.

Include protected parent list/detail reads, individual review progress, correction saves, revision checks, durable transactions, and web/Android acceptance. Keep review within `/parent`. Keep the six-digit PIN, five-minute inactivity session, strict default and explicitly enabled independent practice unchanged.

Exclude new educational fields/translations, content creation/deletion/reordering, append-only history, parent accounts, PIN recovery, persistent student performance, new exercise types, AI/OCR/camera, cloud services and dependencies. Source-verification actions are excluded: neither approval path certifies the worksheet. Do not add a generalized authorization, repository or migration framework.

## 2. Existing architecture and reusable code

| Repository reference | Existing responsibility and boundary |
|---|---|
| [ASSIGNMENT_MODEL.md](ASSIGNMENT_MODEL.md) | Schema v1, preserved sources, provenance and review lifecycle. |
| [validateAssignment.js](../../src/core/assignments/validateAssignment.js) | Known-field/type/ID/reference validation; nonblank supplied educational text; currently requires all supplied fields approved whenever assignment status is approved. |
| [normalizeAssignment.js](../../src/core/assignments/normalizeAssignment.js) | Validated independent JSON copy and absent-collection defaults; preserves exact text and Unicode. |
| [practiceEligibility.js](../../src/core/assignments/practiceEligibility.js) | Strict/independent policy and revision-bound evidence checks; production development-sample exclusion. |
| [householdService.js](../../src/services/householdService.js) | Opaque parent capability, inactivity expiry, protected policy/sample commands, pending student submissions and eligible practice reads. No review/edit/approval command or protected parent assignment read exists. |
| [indexedDbStore.js](../../src/services/storage/indexedDbStore.js) | Web v1 `local` store, single `installation` record, transactional synchronous mutations. |
| [sqliteStore.js](../../src/services/storage/sqliteStore.js) | Native queued exclusive transactions; one installation row; SecureStore binding remains separate. |
| [localHousehold.js](../../src/services/localHousehold.js), [localHousehold.web.js](../../src/services/localHousehold.web.js) | Platform composition sharing the service; monotonic session clock; native SQLite/SecureStore versus web IndexedDB/WebCrypto. |
| [parent.js](../../app/parent.js), [parentOperations.js](../../src/services/parent/parentOperations.js) | Setup/unlock/policy UI; explicit authenticated activity, busy guards, stale focus/operation suppression, exit/background locking. Capability stays in a ref, not route parameters. |
| [Screen.js](../../src/components/Screen.js) | Scrollable single-column layout, 640px maximum content width, interaction callback. |
| [vocabularyMultipleChoice.js](../../src/core/exercises/vocabularyMultipleChoice.js) | Eligible teacher/parent-corrected term-definition pairs, conservative duplicate/leakage checks, three options, at most five questions, stable-ID grading. |
| [practice.js](../../app/practice.js), [practiceRun.js](../../src/core/sessions/practiceRun.js), [randomizePresentation.js](../../src/core/sessions/randomizePresentation.js) | Independent content snapshot; authorized session-only randomization; two-second eligibility polling, resume/transition/revision checks; responses memory-only. |
| [assignment.test.js](../../tests/assignment.test.js), [household.test.js](../../tests/household.test.js), [nativeHousehold.test.js](../../tests/nativeHousehold.test.js) | Existing schema, evidence, authorization, rollback, stale-policy and native binding coverage. |
| [ADR-0002](../decisions/ADR-0002.md), [ADR-0003](../decisions/ADR-0003.md), [ADR-0005](../decisions/ADR-0005.md) | Policy separation, native persistence/lifecycle, Android provider PIN implementation. Later approved native decisions supersede older Expo Go/native-disabled descriptions. |

Existing educational statuses are exactly `draft`, `pending_review`, `approved`. Origins are `teacher`, `parent_corrected`, `ai_generated`, `illustrative`. Source fidelity is `reported_teacher_content`, `unverified_transcription`, `verified_transcription`, or `illustrative`. Do not add status values implicitly.

IDs are lowercase ASCII words/digits separated by hyphens. Assignment/item IDs are unique in one content namespace; sources have a separate namespace. Educational text has `text` and `provenance`; `sourceIds` resolve locally. Some educational fields, including example sentences, have no independent ID. Their existing array positions therefore matter. No translation or exclusion property exists.

The original `sources[].originalText` is preserved evidence; structured educational fields are the current interpretation. Generated definitions, answer positions and learner responses are derived. The original worksheet is not present merely because a source reference or approved status exists.

## 3. Parent journeys and state transitions

Use internal views in the existing route: locked/setup -> policy/home -> assignment list -> assignment detail -> field editor or confirmation. These are UI modes, not new persisted educational statuses. Moving between these views remains inside Parent Area; leaving `/parent` still locks.

### Detailed review

1. Unlock; list all supported local assignments, including those unavailable to student practice.
2. Open one protected detail snapshot with its content and write revisions.
3. Read prominent interpreted text; expand source excerpts; correct existing text if needed.
4. Mark a field or item reviewed. An item control covers exactly its enumerated supplied educational fields; grammar examples and optional supplied fields must not be omitted.
5. Alternatively choose **Mark All Reviewed**, then confirm “I declare that I reviewed all supplied content.” This is a declaration, not evidence that the app observed inspection. It grants no assignment approval.
6. When coverage is complete and the detailed-approval readiness check has no known gap, explicitly choose **Approve Reviewed Assignment** and confirm acceptance of interpreted content, not source authenticity.

### Approval without detailed review

Open a fresh confirmation for the current saved revision. Start with risk acknowledgement unchecked. Explain that transcription/interpretation errors and safe unresolved gaps may remain. Require the checkbox and a separate final confirmation. Persist only assignment acceptance/evidence, retaining actual field review progress unchanged. Show **Accepted without detailed review** afterward, not **Fully reviewed**.

### Correction and renewed approval

Save a correction and explanation. Under FC-005-07, reset only materially changed fields to `pending_review`, retain every unchanged field's metadata/status, set assignment to `pending_review`, clear `approval`, and increment content/write revisions atomically. Corrected fields require subsequent explicit review; related but unchanged fields are not automatically reset. The parent may review the affected fields and explicitly approve again, or choose fresh risk-acknowledged approval.

| Operation | Field review progress | Assignment/evidence | Revisions |
|---|---|---|---|
| Mark field/item reviewed | Selected supplied fields become `approved` | No new approval | Write only |
| Mark All Reviewed | All supplied fields become `approved` | No new approval; existing bulk method is not silently upgraded | Write only |
| Approve Reviewed | Complete current review retained | Assignment `approved`; method `reviewed` | Write only |
| Approve Without Detailed Review | Unchanged | Assignment `approved`; method `bulk_risk_acknowledged` | Write only |
| Material correction | Only materially changed fields reset to `pending_review`; unchanged fields retained | Assignment pending; `approval: null` for either method | Content and write |
| Failed/denied/stale operation | Unchanged | Unchanged | Neither |

Individual review changes must never leave a detailed receipt claiming complete coverage when a field is no longer reviewed. If such a change is supported, clear detailed evidence and return the assignment to pending in the same write. Bulk acceptance never depends on detailed review progress. Increment 1 implements marking review and correction-driven reset; a separate manual-unmark UI is not required or added by that increment.

## 4. Field review versus assignment approval: required compatibility amendment

**Existing incompatibility:** `validateAssignment.js` emits `unreviewed_content` whenever an approved assignment contains any field whose provenance review status is not approved. Existing bulk-shaped eligibility consequently cannot accept pending fields. Marking those fields approved as a workaround would misrepresent review and contradict FC-005-01.

**Approved resolution, D-1:** retain schema field names/version and enum values, but relocate the cross-level approval invariant into method-aware document validation/eligibility:

- Assignment `reviewStatus: approved` means parent acceptance through either valid method.
- Field `provenance.reviewStatus: approved` records declared review of that field, whether through individual controls or confirmed Mark All Reviewed. It is not independent source verification.
- Content validation remains strict about supplied text, provenance, IDs and valid status values, but no longer rejects approved assignment plus pending fields solely on that combination.
- Strict eligibility continues to require a valid approved assignment **and** valid revision-bound evidence. A status alone must never authorize practice.
- Detailed evidence additionally requires every supplied field to be approved and complete field-path coverage. This replaces the guarantee previously supplied by the content validator.
- Bulk evidence requires acknowledgement and matching revision, but leaves pending field review states pending. A malformed receipt must not satisfy strict eligibility.
- No changes to how household independent policy grants eligibility. Preserve existing structural/exercise safety checks; do not accidentally add a per-assignment approval gate to independent practice.

This validation-contract amendment is now owner-approved. Record the approved decision in an ADR/amendment and reconcile ASSIGNMENT_MODEL.md when implementing Increment 1; do not ask for the same product decision again. It remains unimplemented at the inspected baseline. Update the `unreviewed_content` test deliberately, replacing the removed cross-level assertion with method-aware strict-eligibility tests. Retain tests proving detailed approval cannot bypass unreviewed fields and legacy `approved` alone stays insufficient. The validator and eligibility changes must ship in the same increment, never with an intermediate weakened strict gate.

### Field enumeration and evidence

Enumerate only schema-recognized educational text: instruction content; vocabulary term, definition and example sentences; grammar label, explanation and each example's adjective/feminine/adverb; supporting-material content. Metadata such as title, grade and source excerpt is not a review field.

Keep existing receipt property names. Example proposed service-created receipts:

```json
{
  "method": "reviewed",
  "contentRevision": 2,
  "acceptedAt": "2026-11-11T12:00:00.000Z",
  "reviewedFieldPaths": ["/vocabulary/0/term", "/vocabulary/0/definitionFr"]
}
```

The short path list is illustrative only: a real receipt must cover **all** supplied educational fields. Paths match the existing JSON-pointer-style format. Generate them from the current stored document, not arbitrary client coverage claims. Use exact membership in a whitelisted field map; never evaluate input paths or traverse arbitrary object keys. No reordering means these paths are stable within the content revision. Keep item IDs unchanged; do not invent sentence IDs in this milestone.

```json
{
  "method": "bulk_risk_acknowledged",
  "contentRevision": 2,
  "acceptedAt": "2026-11-11T12:00:00.000Z",
  "riskAcknowledgementVersion": 1
}
```

The service supplies timestamps, method and revision. Parent confirmation declares acceptance, not proof of human inspection. Existing timestamps use the service wall clock; local clock tampering remains outside the gate's guarantees.

## 5. Proposed service contracts and errors

All names below are proposed additions to the existing shared service, not present APIs. No raw storage access from screens and no generalized new storage layer.

| Command | Input after `capability` | Result |
|---|---|---|
| `listParentAssignments` | none | Minimal assignment metadata, review/acceptance method, revision and readiness summaries; no credential material. |
| `readParentAssignment` | `{ assignmentId }` | Independent document snapshot, effective write revision, recognized field descriptors and derived readiness diagnostics. |
| `setFieldReview` | `{ assignmentId, expectedWriteRevision, fieldPaths, reviewed }` | Committed updated document. Exact whitelisted fields only; item controls supply that item's fields. |
| `markAllReviewed` | `{ assignmentId, expectedWriteRevision, confirmReviewDeclaration }` | Committed review progress; no new receipt. Require boolean `true`. |
| `saveParentCorrections` | `{ assignmentId, expectedWriteRevision, corrections: [{ fieldPath, text, correctionExplanation }] }` | One atomic correction batch and reset; no intermediate approved snapshot. |
| `approveReviewedAssignment` | `{ assignmentId, expectedWriteRevision, confirmAcceptance, confirmNoKnownGaps }` | Committed document with detailed receipt, only after coverage/readiness checks. |
| `approveWithoutDetailedReview` | `{ assignmentId, expectedWriteRevision, acknowledgeRisk, confirmAcceptance }` | Committed document with distinct bulk receipt; both booleans must be true. |

Whole-assignment approval only: individual review does not authorize a subset under strict policy. The two approval commands accept only saved content; unsaved editor values cannot be implicitly included.

Parent reads: authorize before the asynchronous read and again before returning any protected result. Writes: authorize at entry and inside the synchronous `store.update` mutator, then validate installation, document and expected revision. Do not permit clients to replace a whole envelope, mint receipts, assign arbitrary IDs/purpose, alter policy or change sources via these commands.

Proposed stable errors: `parent_locked`, `assignment_not_found`, `unsupported_document`, `stale_document`, `invalid_field`, `invalid_correction`, `confirmation_required`, `review_incomplete`, `known_gaps`, `persistence_failed`. Use a small error-code convention compatible with existing Error-based handling, not a new framework. Report field-specific validation problems accessibly; never expose raw credential/native errors or dump content/PINs to logs.

After a stale error, clear transient edit/confirmation buffers, reread saved content and revisions while authorized, and require the parent to reconsider/reapply the change; do not silently merge. This is the accepted security-first stale recovery implemented by the controller. Denial/storage failure must not change accepted status in UI. Repeated approval taps use the existing synchronous UI operation guard and expected write revision; an extra command cannot create a second silent approval.

## 6. Correction transformation, provenance and validation

Resolve each supplied field path against the current recognized-field map. Reject missing/duplicate/unknown paths, changed IDs, absent-field creation, blank/whitespace-only supplied text and blank explanation. Do not trim, normalize Unicode or silently correct stored text. Exact source excerpts, source references, source fidelity, collection lengths/order and IDs are immutable to correction commands.

For teacher or existing parent-corrected fields, set origin to `parent_corrected`, preserve source IDs and record the parent's explanation. Require the same non-illustrative source references as the current validator. For supplementary AI/illustrative fields, retain their original supplementary origin and authorship markers, and store the parent's explanation separately in the already supported `provenance.correctionExplanation`. Do not change the origin to `parent_corrected`, relabel the material teacher-origin or make it generator-eligible. This implements approved D-4 without adding a parentCorrection object or changing the assignment shape. Parent correction metadata and original origin are distinct properties; the field's review status is reset independently.

The explanation represents the current parent correction assertion, not a full history or proof of identity. Preserve existing authorship flags, including AI-assistance flags, rather than rewriting them as exclusively human. Existing schema cannot express a complete multi-author history, actor registry or multiple prior explanations; these are intentionally deferred. A later protected-service increment must reject correctionExplanation claims in new student submissions, alongside existing parent-corrected/approved/source-verification restrictions. Pure helpers do not authenticate who supplied a string. Do not mistake schema-valid explanation text for service authorization.

Any changed educational wording, correction explanation or correction origin is conservatively material to that field. A batch increments content revision once, clears whole-assignment evidence and resets only materially changed field-review statuses (FC-005-07). Re-saving identical text/explanation/provenance is a no-op, even within an otherwise material batch: no field reset or metadata rewrite. Review-only commands never rewrite wording. No-op handling must not skip authorization/stale checks.

Build the new document from the latest transaction snapshot, apply only allowed patches, perform resets and full content/document validation, then commit once. Validation happens after resetting any old approval so a correction cannot produce an inconsistent approved intermediate document. Never return writable references into service/store internals.

Only the current corrected text/explanation/provenance is retained, plus immutable original evidence. Do not claim prior interpretations or earlier explanations are retained in an append-only history. Preserve a clean field-enumeration/transformation boundary so selective resets remain confined to materially changed fields without changing IDs or source handling.

## 7. Content revision versus document write revision

**Existing:** document `contentRevision` starts at 1; current code has no assignment edit command or document write counter. Policy has its own independent revision.

**Approved D-2:** add `writeRevision` to the assignment-document envelope, not inside assignment schema v1 or household policy.

- Positive safe integer for new documents, initially 1.
- Every actual document mutation increments it: review progress, approval-method changes and educational corrections.
- `contentRevision` increments only for material correction batches; review/status/approval-only writes leave it unchanged.
- Every parent write compares `expectedWriteRevision` inside the transaction, even when the client intends a no-op. Reject unsafe integers and counter overflow.
- Policy changes, cooldown reservations, parent unlock and read-only access do not increment assignment revisions.
- Approval receipts bind `contentRevision`, not `writeRevision`: reviewing another field or changing acceptance method does not change the content accepted.
- Practice continues to compare `contentRevision`. Strict eligibility also rechecks approval; independent practice is not unnecessarily restarted by review progress alone.

Keep revision ownership centralized. A late approval against an older content/write revision cannot overwrite a correction; a late correction cannot erase a newer approval silently. Two concurrent review writes against the same revision yield one winner and one stale error rather than a lost update.

## 8. Persistence envelope and legacy compatibility

Proposed shape; only `writeRevision` is a new persisted property:

```js
{
  storageVersion: 1,
  contentRevision: 2,
  writeRevision: 4, // approved envelope addition; not yet implemented
  purpose: 'household_assignment', // or existing development_sample
  assignment: { /* existing schema v1; sources preserved */ },
  approval: null // or existing method-specific receipt shape
}
```

**Approved compatibility rule D-2:** an otherwise valid legacy v1 document with no own `writeRevision` property has effective revision 0. Reads derive this value without writing storage. Its first successful parent mutation compares 0 and stores 1. Explicit 0, undefined, null, negative, noninteger or unsafe values are errors, not legacy defaults. New submissions/sample documents store 1. An expected revision of 0 is valid only when comparing against an actually absent legacy writeRevision. Never infer approval or detailed inspection from missing fields or old status flags.

Do not bump SQL table or IndexedDB database version merely to add a JSON-envelope counter. Record this additive v1 envelope extension explicitly and test it. Unsupported content/storage versions or invalid documents remain unavailable; protected list reads may show a minimal unavailable-record indicator without exposing fabricated review controls. Do not rewrite or delete damaged records as recovery.

Existing native schema is `installation(id INTEGER PRIMARY KEY CHECK (id = 1), phase TEXT NOT NULL, payload TEXT NOT NULL)`. The payload has native storage version, credential ID and shared installation state. Assignment updates use the existing queued `withExclusiveTransactionAsync`; web uses one readwrite transaction on the installation record. Mutators must remain synchronous; no dialogs, promises, crypto or external calls inside them.

Return success only after adapter transaction completion. Quota, lock, serialization, validation and write failures roll back. Reauthorize immediately before mutation after asynchronous access; if authorization expires/leaving occurs before that point, reject. Once a durable write is issued it may complete despite navigation; do not promise cancellation after commit. Never publish that late completion to a locked/new view. Re-entry rereads the persisted truth. No SecureStore or credential-binding changes are needed for ordinary document edits.

No migration framework exists today. This proposal is an additive envelope compatibility rule, not a claim of implemented migration support. No destructive data reset, eager rewrite or fallback store.

## 9. Incomplete content and explicit exclusions

Existing structural validation allows omitted optional definitions/examples/explanations and even empty collections. Supplied blank text is invalid; missing required terms/adverbs is invalid. Exercise generation separately skips unusable content and requires three safe term-definition options. Neither a valid schema nor approval guarantees playable questions.

**Existing exclusion support: none.** There is no excluded status/flag, omissions ledger or missing-content issue list. `draft` is not an exclusion flag. Deletion, source rewriting, changing teacher origin to illustrative, or hiding a field from the review enumerator would be unsafe substitutes.

**Approved narrow option D-3:** defer explicit exclusion and missing-field creation. For detailed approval, deterministically report a missing `definitionFr` for an existing vocabulary item as a known vocabulary-practice gap. Do not interpret every absent optional example, grammar explanation, instruction or supporting collection as a known gap: the schema permits those omissions and there is no evidence they were required. Empty educational content also cannot obtain detailed approval. Show derived generator diagnostics separately from review coverage. These diagnostics are calculated results, not new persisted gap states or schema fields.

Require parent confirmation that there are no other known omissions before detailed approval. This is an attestation, not automatic detection; there is no persisted parent issue registry in this scope. A missing definition cannot be filled through an existing-field correction command, so detailed approval of that incomplete assignment remains blocked pending a future approved completion/exclusion workflow. Present that limitation clearly rather than silently approving it.

Risk-acknowledged approval may accept structurally valid incomplete content after the explicit risk confirmation. It does not repair omissions or mark fields reviewed. “Practice-safe” means existing provenance, ambiguity, leakage and option-count checks remain mandatory for every emitted question, not that approval manufactures enough material for an exercise. If fewer than three safe options remain, practice is unavailable through the existing no-exercise state; no unsafe question is emitted. Generator skips still apply. Independent policy continues to follow its existing eligibility/safety rules, not detailed-review readiness rules. No pure evidence checker should call the generator, which already depends on eligibility; this avoids a dependency cycle and keeps acceptance separate from exercise availability.

The owner has explicitly approved deferring exclusion, missing-field creation and structural editing. This limitation is not an unresolved blocker: a missing definition may keep detailed approval unavailable while risk acceptance or household-independent practice remains subject to structural and exercise safety. Semantic omissions not represented in the model cannot be detected automatically. Introducing future exclusions will require a separate representation/coverage/generator design, not an ad hoc flag in FC-005.

## 10. Development sample compatibility

Keep the checked-in `grade4-reference-001` fixture unchanged, pending and development-only. The separately persisted `fc004n-development-sample` / `development_sample` copy may be corrected, reviewed and accepted inside an authenticated development Parent Area. It remains clearly labelled and excluded by production service reads/listing and exercise generation, regardless of approval or policy.

Existing `loadDevelopmentSample` is idempotent only while the stored copy exactly matches the pending original and has null approval; after editing it currently throws. Proposed behaviour: if a valid record with the exact sample ID and development purpose already exists, return that ID without changing any content, review, revision or receipt. Show **Open existing development sample** / **Sample already present**. Do not compare against or restore the original pending text to make loading succeed. Wrong-purpose/corrupt ID collisions reject without overwrite. New sample creation remains parent-authorized and development-only; initialize proposed writeRevision to 1.

Never convert the sample to `household_assignment`. Production parent APIs must also reject development sample detail/commands, not merely hide list entries. Parent approval of the local copy is not permission to promote the bundled fixture or a production assignment.

## 11. UI, accessibility and lifecycle

Reuse `Screen`, existing pressable/action styling, native `TextInput`, English parent guidance, busy/live feedback and `parentOperations`. Small presentational review/editor components may live under `src/components/parent/`; commands stay in the shared service and pure transformations under `src/core/assignments/`. Do not move credentials into React Context or route params for this milestone.

Single-column detail order: title/development label; assignment acceptance method; field-review progress; separate source-fidelity explanation; known-gap/practice-readiness notices; item sections; three distinctly labelled bulk/review actions. Show interpreted text prominently. Expand sources read-only using local text, never fetch `source.reference` URLs. Explain when evidence is PRD-reported rather than an original worksheet.

Use accessible headings, expanded/checked/disabled state, explicit input/error labels and text indicators independent of colour. Touch targets at least the existing approximately 48px minimum; ensure keyboard navigation, scrolling around the Android keyboard and readable French accents. Confirmation controls and acknowledgement start unselected each time the target revision changes or the dialog is reopened. Do not reuse the household-policy acknowledgement for assignment acceptance.

Local edits remain unsaved until explicit Save. Guard ordinary internal Parent Area navigation/Android back with Save/Discard/Stay when dirty. A route exit that revokes parent access must immediately lock and clear protected content; an unsaved-change prompt must not postpone or reverse that revocation. If locking/backgrounding/expiry occurs, security wins: cancel confirmations, clear protected views and transient buffers, discard unsaved text without silently saving, then require unlock and fresh reads. Tell the parent up front that unsaved work is discarded when access locks. No permanent drafts in this milestone (approved D-5).

Only genuine authenticated user actions refresh inactivity. Wire editor input changes and accessibility-invoked actions explicitly, since wrapper touch/scroll events alone may miss keyboard activity. Polling, initial reads, rerenders and save completion never renew the session. Operation/focus IDs suppress late reads, errors, saves and finally blocks. A stale confirmation cannot act on a newly loaded assignment/revision.

## 12. Threat model and failure scenarios

The local PIN gate protects supported child-facing paths, not a device owner, modified application, browser devtools, offline storage tampering or proven parent identity. Approval receipts are local assertions, not cryptographic signatures or an audit trail. SQLite lesson data remains unencrypted by the app; keep credential protections unchanged.

| Scenario | Required result |
|---|---|
| Route bypass or forged/expired capability | Protected reads and writes reject; no content or approval granted. |
| Exit/background during pending read or save | Lock immediately; authorize at transaction mutation; suppress stale UI; reread on return. |
| Two tabs edit/review/approve one document | Compare write revision inside transaction; one succeeds, stale peer reloads. |
| Content correction races with approval | Never approve the wrong revision or lose a newer correction. |
| Bulk approval with unchecked/old confirmation | Reject; fields stay as actually reviewed/unreviewed. |
| Malformed receipt, unsupported version, corrupt record | No strict authorization; no automatic reset or receipt fabrication. |
| Failed write/rollback | Preserve prior document/revisions/evidence; do not show saved/approved success. |
| Parent edits during independent practice | Content-revision mismatch stops the old snapshot on existing poll/resume/transition checks; restart resolves new IDs/text. |
| Review progress changes during independent practice | No content-revision change; no unnecessary reshuffle/restart. |
| Detailed acceptance removed while strict practice active | Existing eligibility checks deny continuation. |
| Duplicate or ambiguous corrected vocabulary | Structural validation plus generator diagnostics; never promise approval makes a question safe or available. |
| Edited/approved development sample loaded again | Return/open existing sample without mutation; production still excludes it. |

Practice authorization remains snapshot/transition-based. A concurrent parent commit just after a practice read does not retroactively undo that already-authorized transition; polling/resume/subsequent transitions detect the new state. Do not claim instantaneous cross-process revocation or introduce a new authorization system to eliminate this existing bounded race.

## 13. Independently testable implementation increments

All five design decisions are approved. Implementation of any increment still requires explicit authorization; this specification update does not begin it.

1. **Pure review/document contracts (first increment):** whitelisted educational-field enumeration; content/write revision validation and legacy defaults; method-aware approval checks; immutable correction/reset transformations; detailed-readiness diagnostics. Test without screens or persistent writes. The exact file/API/test plan is in section 16. No new SQL/credential work.
2. **Protected parent assignment access (current Increment 2 authorization):** shared parent list/detail reads only, capability/expiry checks before and after asynchronous storage, defensive snapshots, legacy counters, fail-closed malformed records and production sample exclusion. No review/correction/approval write, new counter persistence or UI. The earlier combined read/write plan is narrowed by the owner's explicit Increment 2 request; transaction write work requires later authorization.
3. **Sample and compatibility integration:** non-overwriting existing-sample load; new-document revision initialization; legacy round trips; production sample exclusion at all parent/student/generator entry points. No fixture mutation.
4. **Parent review UI within `/parent`:** list/detail, source expansion, editor/explanations, progress, explicit Mark All declaration and two approval methods; unsaved-navigation/lock handling. Preserve policy controls and PIN behaviour.
5. **End-to-end practice/regressions and governance:** detailed/bulk strict practice; independent pending use; correction invalidation; active revision/revocation checks; FC-003A replay/stability and two-attempt outcomes; web and physical Android results. Update approved documents and development log without calling exports physical verification.

Likely files: new small `src/core/assignments/` review/document helpers and focused tests; existing `validateAssignment.js`, `practiceEligibility.js`, `householdService.js`, `app/parent.js`; small parent presentational components; relevant browser script/tests and governance docs. Storage adapters, canonical assignment fixture, question/session model, native crypto and package manifests should not need functional changes. Reassess rather than silently expand if they do.

## 14. Acceptance criteria and verification

### Pure and service tests

- Enumerate all recognized supplied educational fields, including optional examples, grammar and supporting content; reject arbitrary paths and incomplete detail receipts.
- Mark All requires confirmation, updates only review status/write revision and creates no receipt. Individual review cannot authorize a partial strict assignment.
- Detailed approval fails on missing coverage/known gap/no confirmation. Bulk approval needs independent acknowledgement/confirmation, leaves field review unchanged and persists the distinct method.
- Approved assignment with pending fields is structurally permitted only under the approved D-1 contract; strict eligibility still fails without valid receipt. Detailed method still requires all fields reviewed. Legacy approved-only status fails closed.
- Frozen-input transformations preserve exact source excerpts, Unicode, stable IDs, collection order, source fidelity and supplementary origin; reject blanks, unknown paths and attempts to create/delete fields.
- Material correction resets only changed fields, clears whole-assignment evidence and increments content/write revisions once; review-only writes increment write revision only; no-op behaviour is safe and authorized.
- Unauthorized direct reads/commands, expiry while queued, lock races, stale concurrent writes, counter overflow, failed reads/saves, transaction abort and legacy absent-versus-invalid write revisions behave as specified.
- Idempotent sample load preserves edited/approved records; wrong-purpose collision rejects; production cannot access/promote samples.
- Existing strict/independent and source/approval separation regressions remain. Corrected text may reduce question pool without inventing content. FC-003A presentation and all three two-attempt outcomes remain unchanged.

### Browser verification

Use an isolated profile with real IndexedDB/WebCrypto. Exercise protected pending reads; item/Mark All review; both approval methods; correction/reset; clear method/source labels; saved/error states; two-tab stale writes and active-practice invalidation; reload persistence; dirty-editor navigation, background/expiry lock and stale completion. Verify keyboard labels/focus, narrow layout, French accents and acknowledgement reset. Production excludes the sample/demo even if accepted.

### Physical Android acceptance

On the existing French Companion Dev app, retain real credentials/data. Verify unlock and parent-area navigation; small-tablet editing/keyboard/source expansion; Save/Discard/Stay; Mark All without automatic assignment acceptance; both acceptance methods; initially unchecked risk acknowledgement; restart persistence; material edit resetting changed-field review and whole-assignment approval; strict blocking until reapproval; independent-policy use without approval fabrication; active practice invalidation and fresh restart; rapid taps and late navigation; five-minute inactivity and real typing renewal; immediate background/exit locking. Check labelled sample load does not reset its accepted/edited state. Recheck randomized replay, stable retries, celebration and outcomes. Fault injection uses disposable scoped data only.

Run full `npm.cmd test`, `npm.cmd run lint`, `npx.cmd expo install --check`, `npm.cmd run export:web`, existing browser regressions plus FC-005 additions. Pure tests/simulated native adapters and exports are not Android bridge or device acceptance. JavaScript-only changes should use Metro; any discovered native/config need requires separate approval, not an automatic APK build.

## 15. Decisions, deferred work and governance

| Decision | Approved resolution | Implementation consequence |
|---|---|---|
| D-1: bulk acceptance versus current approved-field invariant | Method-aware document validation/eligibility; pending fields retained under bulk acceptance. | Owner-approved; update validator and strict evidence checks together. Mark All Reviewed never mints approval. |
| D-2: write revision and legacy records | Envelope writeRevision; absent legacy value maps to 0, first mutation to 1, new documents start at 1. | Owner-approved additive envelope contract; no SQL migration or new assignment field. |
| D-3: known gaps and exclusions | Derived known-gap checks; defer exclusions/missing-field creation; safe incomplete bulk acceptance retains generator safeguards. | Owner-approved limitation; no persisted gap flag or new exclusion state. |
| D-4: supplementary corrections | Preserve origin/authorship/source IDs; separate existing correctionExplanation records current parent assertion. | Owner-approved; no extra provenance field or full history; protect service entry points in a later increment. |
| D-5: unsaved text on lock | Warn on ordinary internal navigation; revocation immediately clears protected content/buffers. | Owner-approved; prompts never override expiry/background/route-exit locks. |

Confirmed product decisions themselves are not reopened: three distinct operations, selective review preservation after corrections (FC-005-07), immutable source, no full history, whole-assignment strict approval, existing-field editing, single Parent Area, protected service commands and no cloud/dependencies remain governing requirements.

Deferred: semantic dependency tracking, stable IDs for currently positional text fields, full correction history, explicit exclusion/known-gap registry, missing-content entry, translation fields, add/delete/reorder, import/camera/OCR/AI, persistent student progress, additional exercise types and generalized recovery. Optional curriculum enrichment remains future, parent-controlled and disabled by default.

The eight SDK 58 patch recommendations already recorded in TODO are separate maintenance. FC-003A accepted the unchanged-baseline dependency-check exception; do not upgrade dependencies or suppress that check in FC-005 without separate authorization. Reassess current recommendations during implementation validation and report their actual result.

During implementation record the already approved validation/revision decisions in an ADR and reconcile authoritative model/architecture/PRD wording. Do not silently leave conflicting old invariants in force or solicit repeat approval for settled product decisions. During delivery update TODO, TEST_PLAN and development log with exact results and device limitations. This documentation revision does not itself modify those files, application code or storage, and does not authorize implementation.

## 16. Increment 1 — implementation-ready file and API plan

**Boundary:** pure JavaScript contracts and their necessary existing pure-validator/eligibility integration only. No React UI, parent commands, persistent writes, credential/session code, sample-loader changes, dependencies or database migrations. No approval command or production approval receipt creator is introduced. Dates and expected revisions are explicit inputs; no clock, randomness, browser or native imports.

### Exact proposed source files

| Action and file | Exports / expected contract |
|---|---|
| Create `src/core/assignments/educationalFields.js` | `enumerateEducationalFields(assignment)` returns ordered independent descriptors `{ path, ownerId, kind, text, provenance }` for recognized supplied fields only. Validate input, omit absent optional fields, retain exact text/Unicode, and use the nearest existing item/example ID as ownerId without inventing new IDs. Paths distinguish positional sentences and all grammar fields. Invalid input throws TypeError with validation details. |
| Create `src/core/assignments/assignmentDocument.js` | `validateAssignmentDocument(document)` returns `{ valid, errors }` for envelope/content shape and safe revisions. `getWriteRevision(document)` returns 0 only for absent legacy property, otherwise a positive safe integer or throws. `assertWriteRevision(document, expected)` rejects malformed/stale/overflowing mutations. `validateApprovalEvidence(document)` returns `{ valid, errors }`, independently of household policy. `assessDetailedReviewReadiness(assignment)` returns field coverage and derived known-gap diagnostics without creating state. |
| Create `src/core/assignments/assignmentReview.js` | `applyFieldReview(document, { expectedWriteRevision, fieldPaths })`, `applyMarkAllReviewed(document, { expectedWriteRevision, confirmReviewDeclaration })`, and `applyParentCorrections(document, { expectedWriteRevision, corrections })` return `{ document, changed }` using independent copies. They do not authenticate parents or persist results. Field review/Mark All never creates a receipt or upgrades a bulk method to detailed. Corrections implement the FC-005-07 selective reset rule. |
| Modify `src/core/assignments/validateAssignment.js` | Remove only the assignment-approved-implies-all-fields-approved assertion; preserve all structural, provenance, source, ID, nonblank and enum validation. No new schema keys. |
| Modify `src/core/assignments/practiceEligibility.js` | Replace the private generic receipt traversal with shared method-aware evidence checks and compatible pure envelope validation. Preserve policy defaults, independent-practice semantics, notices, draft blocking and production fixture/sample guards. No dependency on React, storage or generator. |

Dependency direction: content validator -> field enumeration -> document/evidence helpers -> immutable review transforms. Eligibility consumes document/evidence helpers. The existing generator consumes eligibility, so document/readiness helpers must not import generation. `normalizeAssignment.js`, canonical fixtures, generator/grader and FC-003A session modules remain functionally unchanged.

### Envelope and evidence validation details

- Preserve storageVersion 1, supported purpose, positive safe contentRevision and schema-v1 assignment validation. Existing documents lacking writeRevision retain effective revision 0 without mutation. Explicit undefined/0/null/unsafe writeRevision is not an absent legacy value.
- Envelope shape validation and acceptance-evidence validity are separate results. A legacy approved-only assignment with no receipt may remain structurally valid but has no accepted evidence; strict policy denies it. Independent policy must not acquire an accidental approval prerequisite. Missing legacy approval is treated as no evidence, never fabricated as a receipt or written on read.
- Receipts use existing exact method/version/property names. Reject unknown methods, malformed dates/revisions, duplicate/unknown coverage paths, missing required acknowledgement and stale content revision. Do not infer detailed review from a bulk receipt or statuses alone.
- Detailed evidence requires assignment approved, nonempty full supplied-field coverage, all fields declared reviewed, and no reliably detected known gaps. Bulk evidence requires assignment approved and the matching receipt/acknowledgement, not reviewed fields. Structural validity and safe generation remain independent mandatory boundaries. The helper is not service authorization and does not verify source authenticity.
- The new document validator may diagnose an invalid receipt separately; eligibility must continue to distinguish invalid content/revision from absent or invalid acceptance evidence. Do not block otherwise eligible independent practice solely because detailed review/evidence is incomplete. Any unsupported or malformed structural envelope remains unavailable.

### Transformation rules

- Check expected write revision and all field paths before constructing any result; reject duplicate/unknown paths, empty correction batches, malformed input and blank replacement text/explanation. No partially applied batch.
- Return an independent copy even for a no-op, with changed false and unchanged revisions; no persistence is required later for that result. Reject stale expected revision even when values would be unchanged.
- A real field-review mutation increments writeRevision once only. Mark All requires confirmReviewDeclaration exactly true, preserves wording, origins, sources, contentRevision and any already valid receipt/method, and grants no new assignment approval. Already reviewed selections are no-ops after validation. A receipt-free pending assignment remains pending.
- A material correction batch increments both revisions once, clears approval, resets only materially changed field-review statuses and assignment status to pending_review. Preserve sources, IDs, order and supplementary classification exactly. A changed explanation/provenance is material; an exactly unchanged current correction is not.
- Avoid incrementing contentRevision for review metadata. Reject arithmetic overflow before returning a transformed document. No timestamps or receipt authorship are invented.
- The reset logic is isolated from enumeration and copy/patch application. FC-005-07 retains unchanged field reviews but never whole-assignment approval after a material correction.

### Exact proposed tests and documentation

Create `tests/educationalFields.test.js`, `tests/assignmentDocument.test.js`, `tests/assignmentReview.test.js`. Modify `tests/assignment.test.js` to replace the superseded cross-level invariant and `tests/household.test.js` to extend method-aware eligibility regressions. Only adjust existing fixture expectations in other tests if directly required by the approved contract; no fixture source editing or broad test rewrites.

Update `docs/architecture/ASSIGNMENT_MODEL.md`, `docs/architecture/ARCHITECTURE.md`, `docs/requirements/PRD_v0.1.md`, `docs/development/TEST_PLAN.md`, `docs/development/TODO.md` and `docs/development/DEVELOPMENT_LOG.md` during the authorized increment. Create `docs/decisions/ADR-0006.md` for the approved method-aware validation and write-revision contract after confirming that number remains unused. These are planned future edits, not changes made by this specification finalization.

Deterministic acceptance tests must cover:

1. Complete enumeration of instructions, vocabulary/examples, grammar/examples and supporting content; empty/missing optional collections; all paths/owner IDs; no metadata/source excerpt misclassified as an educational field.
2. All valid legacy/current envelopes; absent-versus-present malformed writeRevision; safe expected revisions; stale comparisons; counter overflow; missing/stale/malformed receipts; no mutation on validation.
3. Detailed complete coverage versus missing/duplicate/unknown paths; pending fields under detailed versus bulk acceptance; Mark All without assignment acceptance; distinct method/acknowledgement; source fidelity independent of either method.
4. Missing vocabulary definitions as reliably known gaps, empty educational content, permitted optional omissions and safe zero-question generation. No new persisted gap flags or invented definitions. Existing three-option/leakage/provenance filters still govern generation.
5. Frozen input and independent output arrays/objects; exact raw source/Unicode preservation; stable IDs and collection order; parent-corrected source requirements and explanation; AI/illustrative origin/authorship retained with separate explanation; no-op/stale/all-or-nothing batches.
6. Selective changed-field reset, cleared whole-assignment evidence and one increment per material batch; review-only write increments; legacy first-mutation revision 1; no receipts minted by transforms; existing bulk receipt not silently upgraded by review progress.
7. Strict acceptance requires revision-bound valid evidence; independent policy still permits valid pending content; malformed policy remains strict; drafts and production demo/sample remain blocked; no change to FC-003A ordering/replay/attempt outcomes or FC-004N service authorization tests.

Run the full Node test suite and lint at completion; use existing Expo dependency/export/browser checks as regression gates when integrating the pure eligibility changes. Report the known dependency-check exception honestly and do not upgrade/suppress it. Physical parent-editor acceptance belongs to later UI increments, not a claim made by pure-helper tests.

## 17. Final consistency review and readiness

All five approved decisions can be represented with the existing assignment fields/statuses/receipt properties and the explicitly approved envelope writeRevision addition. No additional educational field, origin enum, gap/exclusion flag, parentCorrection object, actor account or audit-history schema is needed. Existing correctionExplanation stores the current parent assertion separately from immutable origin/source evidence; later service commands establish the authorization boundary for writing it.

The necessary compatibility amendment is explicit: approved assignment no longer proves all fields were reviewed; valid detailed evidence does. Bulk acceptance leaves field progress intact. Legacy defaults do not create evidence. Material corrections require renewed assignment approval, but household independent practice may still permit the new pending content; the old content-revision session is invalidated. Review-only progress does not reset content revision or FC-003A presentation. Development sample mutation remains development-only and the loader must not overwrite it in later increments.

No unresolved product decision blocks Increment 1. Its risks are implementation details to verify through the stated tests: accidentally weakening strict eligibility when moving validation, conflating malformed revisions with legacy absence, introducing a generator dependency cycle, and conflating review progress with acceptance. Later service/UI work must enforce parent-only correction metadata, atomic writes, sample idempotence and security-first buffer clearing; those capabilities are not created by Increment 1.

**Historical planning checkpoint:** Increment 1 was ready for implementation authorization when this specification was finalized. The owner subsequently authorized Increment 1 only; its implementation status is recorded below. No later increment is authorized.

## Increment 1 implementation record — 2026-11-11

The three section-16 modules, content/evidence integration, three focused tests, assignment/household regressions and ADR-0006 are implemented. Only pure transforms are callable; no new protected command, UI or persistent write is available. Review progress preserves already valid evidence but clears an invalid pre-existing receipt and returns assignment to pending rather than repairing it into acceptance. This enforces the approved no-implicit-approval rule, including inconsistent legacy snapshots. Timestamp checks accept ISO date-times with timezone and reject malformed/calendar-invalid values. Non-JSON approval data is invalid envelope shape; ordinary invalid/missing receipt evidence remains separate from valid independent-practice eligibility.

The existing browser regression script's test-only module list includes the two new pure eligibility dependencies. No application debug hook or dependency was added. Full validation and acceptance status are recorded in TODO and development log. The earlier readiness/future-tense sections describe the approved implementation baseline, not authorization to proceed to Increment 2.
## Increment 2 implementation record — protected read-only access

Increment 1 is owner-accepted and preserved uncommitted. Increment 2 adds only the following public methods to the existing shared household service; no route or Parent Area UI calls them yet:

```js
listParentAssignments(capability)
// -> Array<{
//   id, title, purpose, reviewStatus,
//   reviewProgress: { reviewed, total },
//   approvalMethod, approvalValid, contentRevision, writeRevision
// }>

readParentAssignment(capability, { assignmentId })
// -> { document, writeRevision, fields, review, approvalValidation }
```

`writeRevision` in responses is the effective counter (0 for legacy absence). Detail `document` is an independent copy of the exact stored document; it does not gain a persisted/default counter or normalized collections during the read. `fields` uses Increment 1 descriptors; `review` contains the existing derived field paths, review coverage, known gaps and readiness; `approvalValidation` contains validity and safe path/code diagnostics. Original excerpts, source fidelity, provenance, review declarations and receipts remain distinct within that snapshot.

Listing contains metadata/counts only, not educational text, source excerpts, a full receipt, household policy or credentials. It includes valid household assignments regardless of strict student eligibility, including draft records if stored. `reviewStatus` is the stored status; `approvalMethod` is null unless evidence is actually valid, and `approvalValid` explicitly distinguishes acceptance from declared review or an unsupported/stale receipt. Mark All review progress therefore cannot be misreported as assignment acceptance. Detail may expose structurally valid but invalid/missing evidence to the authorized parent for future review; it grants no student permission.

Both methods check capability/expiry before store access, after asynchronous read and immediately before returning. They capture the lock generation and compare exact capability identity. Revoked, expired, replaced or native-unavailable sessions receive no protected result; a stale old read must not call the existing authorizer in a way that locks a newer valid parent session. Reads/polling do not renew inactivity. Existing route/background locking, credentials and policy logic are unchanged.

Documents are validated with Increment 1 helpers. Lists reject atomically with unsupported_document when stored records are structurally invalid/unsupported or duplicate IDs make them ambiguous; no partial list or unvalidated raw metadata is returned, and no record is reset/deleted. Detail validates the uniquely selected record; duplicate matches reject. Safe errors use code/message only: parent_locked, persistence_failed, unsupported_document, invalid_field and assignment_not_found. Storage exceptions are sanitized. Stale-session storage failures prefer parent_locked and do not disclose the original error.

The exact persisted development sample ID/purpose is visible only in development. Production listing omits it and direct detail access returns assignment_not_found. Wrong-purpose/reserved-ID collisions reject; original bundled fixture is never promoted. Sample loader and fixture are unchanged.

These commands call store.read only, never store.update; they neither mutate documents nor return storage-owned references. Native adapter read-time binding recovery remains its pre-existing FC-004N protocol, not a new Increment 2 write path. No correction/review/approval commands, schema change, new-document revision persistence, migration or write transaction is introduced. Increment 3 and all later work remain unstarted pending authorization.
Increment 2 validation: 143 automated tests, lint, web export and existing/extended browser regressions passed. The Expo dependency check reports the same eight deferred SDK 58 patches; no upgrade or suppression. Ready for Increment 2 acceptance; Increment 3 is not authorized. See the development log for commands, scope checks and limitations.

## Increment 3 implementation record — transactional correction and review progress

Implemented `setFieldReview(capability, { assignmentId, expectedWriteRevision, fieldPaths, reviewed: true })`, `markAllReviewed(capability, { assignmentId, expectedWriteRevision, confirmReviewDeclaration: true })`, and `saveParentCorrections(capability, { assignmentId, expectedWriteRevision, corrections: [{ fieldPath, text, correctionExplanation }] })`. Each returns an independent committed document only after adapter completion and final authorization. Manual unmark remains out of scope. No approval command or UI is added.

Commands snapshot request arrays/patch records before queuing, validate the uniquely selected document and development visibility, apply Increment 1 pure transforms against the latest transaction snapshot, and recheck capability/generation immediately before returning the synchronous mutation to the adapter. Stale/no-op requests still undergo authorization and revision checks. Review changes increment writeRevision only; material corrections increment both counters once, clear evidence and reset all supplied review statuses. No-op documents retain counters. Existing legacy absence stays effective 0 until mutation; existing creation paths remain unchanged.

## Increment 4 implementation record — protected whole-assignment approval

`approveReviewedAssignment(capability, { assignmentId, expectedWriteRevision, confirmAcceptance: true, confirmNoKnownGaps: true })` requires full supplied-field review coverage and no derived known gaps. It creates `reviewed` evidence with the exact enumerated paths, current contentRevision and service-clock ISO acceptedAt.

`approveWithoutDetailedReview(capability, { assignmentId, expectedWriteRevision, acknowledgeRisk: true, confirmAcceptance: true })` creates only `bulk_risk_acknowledged` evidence with riskAcknowledgementVersion 1, current contentRevision and service-clock ISO acceptedAt. Field review states remain unchanged. Neither method changes sources, provenance or source fidelity. Both set assignment status approved, increment writeRevision once without changing contentRevision, validate generated evidence with the existing shared checker, and return a defensive committed snapshot only while authorized. Caller-supplied receipt/timestamp/coverage fields are rejected. Repeating an explicit approval with the current revision records a new acceptance/write revision.

Both reuse Increment 3's synchronous transaction and FC-005-06 guards, safe errors, document validation, legacy effective revision 0, overflow rejection and development-only sample visibility. Missing/false confirmations, incomplete coverage, known gaps, malformed documents, stale revisions or failed saves leave the document unchanged. No eligibility/generator changes are needed: strict practice requires valid evidence, independent practice retains household policy behaviour, and later corrections clear approval. Per Section 9, risk acceptance may retain safe omissions; approval does not guarantee playable questions. Existing provenance/ambiguity/leakage/three-option generation checks remain mandatory and may produce the no-exercise state. No dependency cycle or generator-based approval rule is added.

No Parent Area UI or new route exists. Physical Android approval-command acceptance is not claimed. Increment 5 and FC-005 overall remain incomplete.

## Increment 5 implementation record — Parent Area review interface

The existing `/parent` route now contains internal household-home, list, detail and editor views, plus explicit confirmation and unsaved-discard states. `AssignmentReviewPanel` renders metadata-only cards, grouped supplied educational fields, persisted review progress, distinct acceptance methods, missing-definition/no-content limitations and expandable read-only original source excerpts/references (both all sources and per-field links). Origin and correction explanations remain separate; no source URLs are fetched or supplementary material presented as verified school text. Existing PIN fields/handlers and policy controls remain; sample loading now accurately explains preservation of existing reviews/corrections/acceptance.

`assignmentReviewController` is a small memory-only presentation controller, not a new authorization layer. It invokes only approved protected service commands. It snapshots command targets/revisions, serializes UI requests, suppresses results using operation/epoch plus exact capability identity, and rereads saved detail after successful mutations. Confirmation checkboxes start unchecked on every opening/revision refresh. Detailed acceptance requires current readiness and separate acceptance/no-known-gaps declarations. Risk acceptance requires an unchecked risk declaration followed by explicit confirmation. Mark All is a separate declaration with no approval. On stale writes, discard edit buffers, reload saved content/revisions and require reconsideration; never merge or overwrite automatically.

Dirty internal navigation offers Keep Editing or Discard Unsaved Changes. Security locking bypasses that prompt: route exit, backgrounding, expiry detection, explicit lock and service authorization rejection clear controller content, confirmations and editor buffers, invalidate outstanding UI operations and retain the existing service lock boundary. Already-issued writes follow FC-005-06; late completion cannot publish into a newer authorized view. Genuine editor typing counts as activity; reads/renders/polling do not. Parent Area uses handled keyboard taps without changing other screens' keyboard behaviour. Single-column 52px actions, readable French text, labels, checkbox/expanded/disabled state and live feedback reuse existing visual conventions.

No new routes, dependencies, native code, persistence schema, educational fields or service contracts. Physical tablet scrolling/keyboard/screen-reader and full workflow acceptance remain manual gates. The subsequent Increment 6 audit/6A corrections and final owner development acceptance are recorded above; physical TalkBack is deferred and unverified.

## Increment 5A — reversible review and stable inline workflow (2026-11-12)

The existing setFieldReview(capability, { assignmentId, expectedWriteRevision, fieldPaths, reviewed }) now accepts boolean true/false. False sets selected supplied fields to pending_review. Review-only changes increment writeRevision once, never contentRevision; matching no-op requests retain counters after authorization/CAS checks. Withdrawing detailed coverage clears detailed approval and returns the assignment pending; valid bulk_risk_acknowledged evidence is preserved. Invalid pre-existing evidence cannot become approved implicitly. No new statuses, fields, schema, storage or authorization mechanism.

Routine mutation success no longer publishes detail:null: keep the existing detail mounted while saving and during the authorized reread, then atomically publish the refreshed snapshot. Cards use assignment.id plus field.path as stable keys, so review revisions do not remount source expansions. A permanently reserved compact feedback area avoids adding/removing banners above fields for normal review. Do not use manual scroll restoration. Stale-write recovery retains its reload/reconsideration semantics and security locking still immediately clears protected content, editors, confirmations and operation identities. Failed writes never show optimistic persisted checkbox changes.

Each field has a persisted Reviewed checkbox and Edit action. Edit opens one compact inline correction editor inside that card, keeping all other cards visible/mounted. Save still requires replacement text and a nonblank explanation and uses the existing protected correction command. At Increment 5A delivery, material corrections reset all review and approval; FC-005-07 supersedes that historical rule with selective field reset and whole-assignment approval invalidation. Cancel, internal navigation and switching editors protect dirty buffers with Keep/Discard; review/approval writes are disabled while an editor is open. No arbitrary structural or source editing. Switching between fields does not bypass unsaved protection.

Approval buttons read **Approve reviewed content** and **Approve all without checking each item**. Existing service/evidence contracts and explicit confirmations are unchanged; Mark All Reviewed still needs the declaration and grants no acceptance itself. Individual checkbox changes need no extra confirmation. Existing source/provenance and risk explanations remain, with shorter routine feedback. Physical Android keyboard/viewport behaviour needs verification; normal editor expansion/collapse can naturally change layout and is not a promise of fixed pixel offsets while the keyboard opens.

Storage failures reject without exposing backend messages. Validation errors roll back through existing adapters. A write validly issued before locking may commit, but its protected result is withheld; re-entry must read persisted truth. Commands do not refresh inactivity. Existing valid development samples reopen without overwrite, preserving review/corrections/revisions; malformed or ambiguous samples reject. Student submissions now reject correctionExplanation declarations, including supplementary-origin claims, as required by Section 6. Original sources, fixture, practice/session modules, storage adapters, native code and dependencies remain unchanged. Whole-assignment approval is implemented by Increment 4 and the review UI by Increment 5 above; final development acceptance is recorded at the top of this specification, with physical TalkBack deferred and unverified.


## Increment 6A - acceptance-audit corrections (2026-11-13)

Policy reads capture the current capability epoch and authorize before/after asynchronous storage access, including failure paths. Stale reads reject without disclosing data, locking or renewing a newer session. The Parent Area polling rejection also checks token identity before clearing the UI. Current expired or unavailable credentials still lock. Reads remain passive.

Both submission and development-sample creation persist writeRevision 1. Valid legacy documents with no writeRevision still read as effective 0 without migration; the existing sample loader leaves stored samples unchanged. Subsequent protected mutations retain CAS and normal revision increments.

Every parent review button, checkbox, inline editor input and original-source toggle explicitly records genuine activity, including accessibility activation. Household policy/sample actions do likewise. Activity callbacks are bound to their rendered session and focus; stale/expired callbacks cannot renew a replacement session or execute their action. Duplicate genuine notifications are harmless. Renders, reads, polling and background work never renew the five-minute inactivity interval. Authorization loss still immediately clears protected controller state and buffers. No educational, approval, schema, storage-adapter or native changes.

At Increment 6A delivery, acceptance remained pending. The owner has now accepted FC-005 for the development milestone as recorded above; physical TalkBack remains unverified and deferred to prepublication testing. See TEST_PLAN.md and the development log for exact evidence.

6A local results: 190/190 automated tests, six focused regressions separately rerun, lint, 810-module web export and full browser rerun passed. Eight dependency patch recommendations remain deferred and unsuppressed. First cold Metro browser attempt timed out; warm rerun passed without application changes. Subsequent owner-reported physical results are 21 passed, 1 skipped; development-milestone acceptance is now recorded above. The skipped TalkBack test remains unverified.
