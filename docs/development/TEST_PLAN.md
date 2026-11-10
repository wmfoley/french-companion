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
Parent checks source transcription and answer keys. Observe whether a Grade 4 child can complete a short session independently; note confusing interactions without storing identifying details. Do not treat one household's experience as market validation.
