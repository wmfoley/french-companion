# Assignment model — schema version 1

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
3. `approved`: parent accepts the interpreted educational content for practice. Every supplied text field must also be approved.

Approval does **not** establish independent worksheet verification or change any source fidelity/origin. The reference fixture remains pending review. Structural validity alone is not permission to generate practice. Approved ADR-0002 supersedes the earlier mandatory-approval rule: strict mode requires revision-bound parent acceptance; parent-enabled independent mode permits eligible pending content without altering review or fidelity. Exercise completeness requirements apply in both. An empty approved assignment supplies nothing to practise.

FC-004 wraps schema version 1 without changing it: `{ storageVersion: 1, contentRevision, purpose: 'household_assignment', assignment, approval: null }`. Approval evidence is a separate revision-bound record for FC-005 (`reviewed` with educational field paths or `bulk_risk_acknowledged` with acknowledgement version). No FC-004 command creates approval. Household policy is stored separately in the installation record, never inside educational source material. Student submission preserves source text, requires pending status and rejects parent approval/correction/verified-transcription claims. Existing documents cannot be overwritten by that API.

Substantive educational changes to an approved assignment must reset assignment status to `pending_review` (or `draft` during editing) and changed text status accordingly. Parent corrections preserve source excerpts, source IDs and a correction explanation. A future editing workflow must apply this policy; FC-002 has no editing UI, automatic change detector, revision chain or audit-history system. Validation of one snapshot cannot detect an undisclosed change from an earlier snapshot.

## Pure APIs and normalization

- `validateAssignment(value)` returns `{ valid, errors: [{ path, code }] }`, does not mutate data, and checks structure/references/provenance consistency, not truth, historical accuracy or pedagogical suitability.
- `normalizeAssignment(value)` first validates, throws `TypeError` with `.errors` for invalid input, and returns an independent JSON data copy. It defaults omitted top-level collections, vocabulary example sentences and grammar examples to `[]`. It never changes wording, Unicode, source fidelity, origin or review status. Normalization is idempotent.
- `normalizeTextForComparison(text)` returns NFC text without changing accents, case, punctuation or whitespace. Use derived comparison values only; never replace source text with them. Existing exercise grading keeps its separate case/whitespace policy unchanged.

Local asset paths must be relative beneath `assets/`, without traversal, URL schemes or Windows absolute paths. Validation does not read files or establish asset existence. No student identifiers, performance records, exercise prompts, grading keys or generator implementation belong in assignments. Future exercise instances reference stable content IDs and remain separate, as do student attempts/results.
