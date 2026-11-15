# Preparation contract v1 — FC-007A

Implemented as a pure, unconnected contract under `src/core/preparation/preparationContract.js`. See [ADR-FC-007-001](../decisions/ADR-FC-007-001.md), still a draft for review. No camera, OCR, interpretation, storage, UI or production suitability gate exists in this increment. Assignment schema v1 is unchanged.

## Public interfaces

- `validatePreparation(input) -> {valid, errors}`: checks strict property sets, versions, identities, statuses, confidence, exact spans and explicit pairing references. Errors contain fixed paths/categories, not source text.
- `assessPreparation(input) -> assessment`: throws a generic TypeError for invalid input; otherwise derives deterministic exclusions, suitability, readiness, issues and disclosure. Does not mutate input. Ordering follows supplied candidate/region order; no shuffling or array-position pairing.
- `validatePreparationAssessment(input, assessment) -> {valid, errors}`: recomputes and compares every output property, rejecting forged, stale or extra result fields. This is consistency checking, **not authentication** of the producer or a security receipt.

## Input

Required envelope: `{schemaVersion: 1, capture: {id, revision}, preparation: {id, revision}, sources, regions, candidates, reliability, safety}`. IDs are lowercase hyphen-separated ASCII groups; revisions are positive safe integers. These revisions are not assignment contentRevision/writeRevision, and this pure module implements no persistence/CAS.

Future producers must advance the relevant revision when evidence or preparation changes. Recomputing the result detects inconsistent derived properties and changed revision identities, but cannot detect a dishonest producer reusing an identity for different evidence with otherwise identical derived results. Trusted revision ownership belongs to the later service boundary.

- Sources: `{id, text}`. Exact provided extraction text, not independently verified worksheet truth. Never normalized or corrected. An empty evidence set is structurally valid but unsupported/not ready.
- Regions: `{id, sourceId, start, end, kind, support}`. Offsets are half-open JavaScript UTF-16 offsets into the source string. Kinds: vocabulary_pair, vocabulary_list, grammar, instructions, other. Support: supported, unsupported, unresolved. All non-whitespace source content must have region coverage; unreferenced or unsupported regions remain disclosed. Region grouping is a producer declaration, not visual-layout proof.
- Fields: `{text, regionId, start, end}`. Supplied educational text must be nonblank and exactly equal the referenced source slice within the region. No absent field is synthesized. Interpretation/paraphrase, correction and assignment conversion are not implemented here.
- Candidates: `{id, kind, origin, fields, association?, confidence?}`. Kind vocabulary has term and optional definitionFr; instruction has content; grammar has label and optional explanationFr. Origin source or supplementary records candidate origin separately from any future parent review. All fields have individual source links. Source is not a teacher-authenticity claim; supplementary stays excluded. No assignment provenance or source-fidelity value is manufactured.
- Vocabulary association: required `{kind: explicit_pair|ambiguous|unknown, regionId?}`. An explicit pair requires both fields in the same vocabulary_pair evidence region. Merely being in matching arrays or adjacent rows is insufficient. Missing definitions use unknown/ambiguous association, not a false explicit pair.
- Reliability: `{status: unknown|needs_review|sufficient, confidence?}`. Safety: `{status: unknown|clear|blocked, confidence?}`. Optional confidence is null or a finite number in [0,1]. Missing/null is unknown; numbers never override status or imply calibrated certainty. No numeric threshold is selected.

Every object rejects unexpected properties, including authorization, approval and executable-command metadata. Literal hostile strings remain inert evidence. Validation cannot recognize misleading semantic claims within otherwise allowed values.

## Assessment and exclusions

Version 1 returns capture/preparation identity snapshots, suitability, unchanged reliability/safety declarations, ready, eligibleCandidateIds, excludedCandidateIds, unsupportedRegions, issues and disclosure. Eligible means **structurally usable candidate vocabulary**, not approved or practice-authorized content. Safety-blocked content may be structurally supported while ready is false; do not conflate these independent axes.

Only source-origin, complete, explicitly paired vocabulary in supported regions is usable. Exclude all members of NFC/case/surrounding-whitespace-equivalent duplicate term or definition groups; preserve original spelling. Missing definitions, ambiguous/unknown associations, supplementary fields and other exercise content remain excluded. No invented definitions, semantic association inference or grammar-to-vocabulary conversion. FC-006 retains its own stricter exercise-specific checks, such as literal answer leakage; usable preparation content need not produce every exercise type or a minimum number of multiple-choice choices.

Suitability is unsupported if no usable candidates, partial if usable candidates coexist with excluded candidates/regions, otherwise supported. Ready additionally requires explicit sufficient reliability and clear safety. This only states contract consistency: the future service must enforce trusted/current assessment and suitability before intake. Current submitAssignment and approval commands are deliberately untouched and must not be described as enforcing this new gate.

Partial disclosure is `{required: true, excludedCandidateIds, regionIds}`. Unsupported regions are defensive snapshots referencing retained exact source evidence. No partial-acceptance receipt exists, no parent action is added, and no approval is implied. How acceptance integrates with existing detailed-review gap rules remains an explicit deferred decision.

Fixed issue codes/severity:

| Severity | Codes |
|---|---|
| info | unknown_candidate_confidence, unknown_reliability_confidence, unknown_safety_confidence |
| warning | unsupported_content, supplementary_content, missing_definition, unresolved_association, duplicate_or_ambiguous_pair, unsupported_region, excluded_region |
| error | missing_evidence, reliability_unresolved, safety_blocked, safety_unknown |

Issues contain code, severity, nullable candidateId and regionId; no arbitrary generated messages or executable actions. There is no safety classifier, injection detector, calibrated OCR confidence, image identity verification or assessment producer authentication in FC-007A.

## Evidence and compatibility

`tests/fixtures/preparation/corpus.json` contains twelve entirely synthetic non-identifying cases. Their reliability/safety labels are explicit test declarations, not detector results. They establish deterministic contract behaviour, not real-world OCR accuracy, safety coverage or the 120-second parent target. The corpus is test-only and is never loaded as a household assignment.

Existing FC-005 approval evidence, source excerpts/fidelity, selective review preservation, household strict/independent policies, development-only boundaries and FC-006 reference-based exercises remain unchanged. There is no new parent configuration or preparation. Any future conversion must retain original evidence and provenance, never upgrade transcription fidelity, and use existing approval workflows. Privacy/retention, resource bounds, capture permissions, trusted assessment production and optional separately approved cloud processing remain future decisions.
