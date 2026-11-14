# Assignment model — schema version 1

## FC-005 development-milestone acceptance - 2026-11-14

The owner accepts FC-005 for the current development milestone. Physical Android results are **5A: 9/9 passed; 5B: 6/6 passed; 6A: 6 passed, 1 skipped; total: 21 passed, 1 skipped**. No functional defects were reported. **Physical TalkBack accessibility testing was intentionally skipped and remains unverified**, deferred to prepublication accessibility testing. Automated activity tests and browser checks do not establish TalkBack correctness or publication readiness.

The accepted implementation includes protected assignment reads, transactional review/correction/approval commands, the existing Parent Area interface, FC-005-06 authorization boundaries, FC-005-07 selective review preservation and the three Increment 6A corrections. Approval, field review, household practice eligibility and source fidelity remain separate. Historical increment records below describe their original delivery status; this dated acceptance supersedes earlier pending-acceptance or unimplemented-capability wording for completed FC-005 work. No new product scope is authorized by acceptance.


Approved FC-002 scope: local deterministic JavaScript data and utilities, no new dependencies. Implementation lives in `src/core/assignments/`; JSON fixtures live in `src/content/fixtures/`. This document specifies assignment data, not exercise instances or learner results.

## Shape

Required assignment fields: `schemaVersion: 1`, stable `id`, nonblank `title`, integer `grade` (2–5), `language` (`fr-CA` or `fr`), and `reviewStatus`.

Optional collections default to empty arrays during normalization:

| Collection | Entry fields |
|---|---|
| `sources` | `id`, nonblank `reference`, `fidelity`, `originalText` |
| `instructions` | `id`, educational-text `content` |
| `vocabulary` | `id`, educational-text `term`; optional `definitionFr`, `exampleSentences` |
| `grammarConcepts` | `id`, educational-text `label`; optional `explanationFr`, `examples` |
| grammar `examples` | `id`, educational-text `adjective`, `adverb`; optional `feminine` |
| `supportingMaterial` | `id`, `kind` (`note` or `local_asset`), educational-text `content`; `assetPath` required only for local assets |

Optional `week` has optional nonblank `label` and valid ISO calendar `startDate`/`quizDate` (`YYYY-MM-DD`). No quiz weekday or current date is inferred. Title and week label are application metadata, not teacher quotations; teacher wording belongs in provenance-bearing fields.

IDs use lowercase ASCII words/digits joined by hyphens. Content IDs are unique across the assignment, instructions, vocabulary, grammar concepts/examples and supporting material; source IDs have a separate namespace. Source references resolve within the assignment. Unknown object fields, explicit undefined/null values for supplied optional fields, wrong types and sparse collection entries are rejected. Missing educational content is allowed; a supplied educational text must be nonblank. Missing definitions and examples must never be inferred during normalization.

Example educational text:

```json
{
  "text": "un négociateur",
  "provenance": {
    "origin": "teacher",
    "sourceIds": ["source-negociateur"],
    "reviewStatus": "pending_review"
  }
}
```

Each text field has its own provenance. Terms, definitions, example sentences, explanations and notes can have different origins. Source arrays must be present (empty is allowed for supplementary material) and cannot contain duplicate references.

## Provenance and evidence

- `teacher`: requires at least one non-illustrative source.
- `parent_corrected`: requires at least one non-illustrative source and a nonblank `correctionExplanation`. Corrected text is stored in the structured field; original text stays in `sources[].originalText`. Optional `authorship` records `human` or `ai` assistance without replacing correction provenance.
- `ai_generated`: always supplementary, even after approval. Optional `authorship`, if supplied, must be `ai`.
- `illustrative`: synthetic fixture content, never teacher material; `authorship` (`human` or `ai`) is required so assistant-written supplementary wording cannot lose AI attribution.

Source fidelity is independent: `reported_teacher_content`, `unverified_transcription`, `verified_transcription`, or `illustrative`. A verified-transcription claim requires external human evidence; the validator only checks its shape and cannot authenticate it. `reference` identifies a document/location; utilities never read or fetch it. `originalText` preserves the captured excerpt exactly, including blank values, whitespace, accents and Unicode representation. Empty excerpts are structurally valid evidence records, not proof of adequate educational evidence.

The Grade 4 fixture uses PRD section 5 as its evidence. Its source excerpts occur verbatim in that PRD, but the original worksheet is unavailable here. `teacher` means the PRD reports teacher origin; `reported_teacher_content` explicitly prevents claiming an independently verified worksheet transcription. No teacher instructions, missing definitions or example sentences were invented. The grammar label is the PRD's `-emment` excerpt; the fixture has the three reported adjective/feminine/adverb transformations, without a reconstructed teacher explanation.

## Review lifecycle and corrections

Assignment and text provenance use exactly `draft`, `pending_review`, `approved`:

1. `draft`: content is being assembled or edited.
2. `pending_review`: content awaits parent acceptance.
3. Assignment `approved`: parent accepts interpreted content through valid detailed or risk-acknowledged evidence. Field provenance `approved` records declared field review. Under approved FC-005 Increment 1, bulk acceptance may leave fields pending; detailed evidence requires every supplied field reviewed. Content validation alone never grants practice permission.

Approval does **not** establish independent worksheet verification or change any source fidelity/origin. The reference fixture remains pending review. Structural validity alone is not permission to generate practice. Approved ADR-0002 supersedes the earlier mandatory-approval rule: strict mode requires revision-bound parent acceptance; parent-enabled independent mode permits eligible pending content without altering review or fidelity. Exercise completeness requirements apply in both. An empty approved assignment supplies nothing to practise.

The current document envelope wraps schema version 1 without changing it: `{ storageVersion: 1, contentRevision, writeRevision, purpose: 'household_assignment', assignment, approval: null }`. New submitted and development-sample documents start at writeRevision 1; genuine legacy absence reads as effective 0 without mutation or migration. Approval evidence is a separate revision-bound record for FC-005 (`reviewed` with educational field paths or `bulk_risk_acknowledged` with acknowledgement version). No FC-004 command creates approval. Household policy is stored separately in the installation record, never inside educational source material. Student submission preserves source text, requires pending status and rejects parent approval/correction/verified-transcription claims. Existing documents cannot be overwritten by that API.

FC-005-07 supersedes Increment 1's reset-all correction rule. Material corrections reset the assignment and **only materially changed educational fields** to `pending_review`, clear approval evidence of either method, and increment contentRevision/writeRevision once per batch. Unchanged fields retain exact review metadata/status, including no-op correction entries. Text, explanation and correction-origin changes are material to that field; no semantic dependency tracking or historical review reconstruction is required. Parent corrections preserve source excerpts, source IDs and explanations. Fresh explicit assignment approval is required; retained field review does not revive old evidence. The immutable helper is persisted through existing protected transactions, without a schema migration. Full history remains deferred; snapshot validation alone cannot detect undisclosed external edits.

## Pure APIs and normalization

- `validateAssignment(value)` returns `{ valid, errors: [{ path, code }] }`, does not mutate data, and checks structure/references/provenance consistency, not truth, historical accuracy or pedagogical suitability.
- `normalizeAssignment(value)` first validates, throws `TypeError` with `.errors` for invalid input, and returns an independent JSON data copy. It defaults omitted top-level collections, vocabulary example sentences and grammar examples to `[]`. It never changes wording, Unicode, source fidelity, origin or review status. Normalization is idempotent.
- `normalizeTextForComparison(text)` returns NFC text without changing accents, case, punctuation or whitespace. Use derived comparison values only; never replace source text with them. Existing exercise grading keeps its separate case/whitespace policy unchanged.

Local asset paths must be relative beneath `assets/`, without traversal, URL schemes or Windows absolute paths. Validation does not read files or establish asset existence. No student identifiers, performance records, exercise prompts, grading keys or generator implementation belong in assignments. Future exercise instances reference stable content IDs and remain separate, as do student attempts/results.

## FC-005 implemented contracts

See [ADR-0006](../decisions/ADR-0006.md) and the approved [FC-005 specification](FC005_PARENT_REVIEW_APPROVAL_SPEC.md). The pure foundations originated in Increment 1; subsequently authorized service commands and Parent Area UI now persist review, corrections and approval through existing adapters, without a schema migration.

- `educationalFields.js`: `enumerateEducationalFields(assignment)` returns independent `{ path, ownerId, kind, text, provenance }` descriptors for supplied schema-defined fields. JSON-pointer-style evidence paths match existing receipts; metadata and source excerpts are not review fields.
- `assignmentDocument.js`: envelope shape validation is separate from `validateApprovalEvidence`. Legacy missing writeRevision reads as 0 without mutation; an explicitly supplied counter must be a positive safe integer. Expected revision 0 compares only against absent legacy metadata. Content revisions stay positive safe integers. Unsupported storage/purpose, unknown envelope properties and non-JSON supplied approval values are invalid structural records.
- Approval evidence is local, method-aware and content-revision-bound. Detailed evidence needs complete nonduplicate recognized paths, approved field-review states and no derived known gaps. Bulk evidence needs riskAcknowledgementVersion 1, leaves field states unchanged and cannot carry fabricated reviewedFieldPaths. Both require assignment acceptance and a valid ISO timestamp. Legacy approved-only status never satisfies strict eligibility. Invalid/missing receipt evidence does not independently block household-policy-authorized practice of structurally valid content.
- `assessDetailedReviewReadiness` reports missing definitions for existing vocabulary and empty educational content as known gaps; absent optional explanations/examples are not invented as gaps. Safe question generation remains separate; acceptance does not guarantee a playable pool.
- `assignmentReview.js`: `applyFieldReview`, `applyMarkAllReviewed`, `applyParentCorrections` take an expected write revision and return `{ document, changed }` without mutation, authentication or storage. Mark All requires explicit declaration, never creates a receipt and cannot revive an invalid detailed receipt into acceptance. A changed review operation clears any invalid pre-existing receipt, preserving only already valid acceptance evidence. No-ops return copies and do not consume revisions; stale/overflowing mutations reject.
- Actual review mutations increment writeRevision only. Material correction batches increment both counters once, clear approval and reset review only on changed fields (FC-005-07). Unchanged metadata/status remains exact. Teacher corrections become parent_corrected with explanation and unchanged source references; supplementary AI/illustrative origin/authorship stays intact with the explanation stored separately. Exact source excerpts, Unicode, IDs and ordering are preserved.
- Subsequent accepted increments implement new-counter persistence, protected parent reads/writes, parent-only metadata enforcement for student submissions, non-overwriting edited-sample loading and security-first editor buffer clearing. Only approveReviewedAssignment and approveWithoutDetailedReview create fresh service-generated approval evidence, never field review alone. The fixture remains unchanged and pending; production sample guards remain enforced.

Review-only mutations increment writeRevision without changing contentRevision. A material correction batch increments both once, clears either approval receipt and resets only changed fields. No-op batches retain counters and exact unchanged field metadata; authorization and CAS still apply. UI saves reread durable state while preserving mounted field/source context; stale-write recovery clears transient buffers and requires reconsideration. Persisted samples retain their development-only classification regardless of review, approval or household policy.
