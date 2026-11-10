# Test and Acceptance Plan — v0.1

## FC-001
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
Parent checks source transcription and answer keys. Observe whether a Grade 4 child can complete a short session independently; note confusing interactions without storing identifying details. Do not treat one household's experience as market validation.
