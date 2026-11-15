# Vocabulary exercises and sessions — version 1

Current FC-006 implementation supports exactly vocabulary definition-to-term Multiple Choice (default) and Typed Vocabulary Recall (Spelling Practice). Assignment schema version 1 and the original string grader remain unchanged. All generation, grading and session transitions are pure JavaScript without React, network, time, storage or new dependencies. The original multiple-choice contract and increment delivery notes below retain their historical scope; the FC-006 sections specify the added typed contracts.

## FC-006D verification and closure preparation - 2026-11-15

The owner reports 12 physical Android tests passed, 0 failed, 0 skipped and 0 outstanding, with no observations or defects. Coverage includes French text entry, cursor editing, keyboard visibility, grading, retries, Replay, navigation, background/resume and authorization/content correction. Physical TalkBack is separately deferred/unverified, not a passed or skipped test within these twelve. Final local validation is recorded in the test plan/development log; commit remains explicitly gated. Earlier A/B/C statements about future authorization or unverified Android describe their delivery-time boundaries, not current milestone status.

## Exercise definition

```json
{
  "schemaVersion": 1,
  "id": "vocabulary-mc-vocab-negociateur",
  "type": "vocabulary_multiple_choice",
  "assignmentId": "grade4-reference-001",
  "targetItemId": "vocab-negociateur",
  "optionItemIds": ["vocab-dirigeant", "vocab-negociateur", "vocab-crise"],
  "gradingPolicy": "multiple-choice-two-attempts-v1"
}
```

Definitions contain references, not copied teacher wording, provenance or learner answers. `targetItemId` supplies both the French definition prompt and correct term. Options resolve to exact term text from the assignment. Provenance/fidelity remain on the referenced assignment fields. Generic French UI instructions and encouragement are application copy, not teacher material. Matching multiple choice necessarily displays the correct term among the options; it is not identified until question completion. This is separate from dictation's answer-hiding rule.

The app takes an independent normalized assignment snapshot when entering practice. Definitions are generated against that snapshot, and responses remain in separate state. Stable assignment/item IDs survive permitted corrections; active runs are bound to contentRevision and invalidated when that revision changes. Questions, presentations and responses are not persisted. Content hashes and a full revision-history system remain deferred.

## Eligibility and generation

`generateVocabularyQuestions(assignment, options)` validates and clones the assignment first, then returns `{ questions, diagnostics }`. Invalid assignments/options throw `TypeError`; ineligible normal-practice content returns no questions and `approval_required`. FC-004 adds pure eligibility using `householdPolicy`, `approval`, `contentRevision` and `purpose` options. Missing/invalid policy uses strict mode; approved status alone is not acceptance evidence. Explicitly parent-enabled independent policy permits pending content without modifying review/fidelity. Only teacher/parent-corrected term and definition pairs participate; absent definitions and supplementary AI/illustrative pairs are skipped, not completed or relabelled.

Options: `mode` defaults to `practice`, `development` defaults to false, integer `seed` defaults to 42. The development demo requires explicit `mode: demo`, `development: true`, reference assignment ID `grade4-reference-001`, and `pending_review` status. The pure module trusts the application-supplied build capability; it is not a security boundary against modified JavaScript. The application passes `__DEV__`, not a query-supplied development flag, and always supplies the actual bundled fixture. A production query cannot enable the exception. Fixture statuses and source fidelity never change.

Candidate terms/definitions are compared using derived NFC, surrounding-whitespace trimming and French case folding, preserving accent distinctions. Every member of duplicate-term or duplicate-definition groups is excluded. Items are ordered by stable IDs; a small deterministic seeded shuffle chooses two distractors and the option order. At most five questions are emitted, each with exactly three distinct eligible options. No fabricated distractors, definitions, historical details or sentences.

Any option term appearing literally in a definition under the derived comparison is excluded from that question; an exposed correct term or fewer than three safe options skips the question. Diagnostics identify ineligible/ambiguous content, insufficient safe options or no questions. This is conservative literal checking, not semantic ambiguity detection or grammatical analysis. Human educational review is still necessary.

`validateVocabularyQuestion` checks version/type/policy, references and option integrity against a validated normalized assignment. `resolveVocabularyQuestion` returns exact prompt/option text and completion pairing. `gradeVocabularyChoice` accepts only offered stable IDs. It does not invoke the spelling grader or ignore accents in submitted strings. Normal eligibility is enforced at generation/application entry, not by the text resolver.

## Session state and policy

`createSession(questions)` stores only ordered question IDs, current index, responses and finished state. The app retains definitions and the assignment snapshot separately. Each response has `attempts: [{ selectedItemId, isCorrect }]` and an `outcome`:

- `correct_first_attempt`: completes immediately and earns one first-attempt point in the internal summary.
- `correct_second_attempt`: completes after one miss and earns no first-attempt point.
- `incorrect_after_two_attempts`: completes after two distinct misses.
- `null`: incomplete, including after the first miss.

Selection precedes explicit **Vérifier** submission. After a first miss, gentle French feedback does not identify the correct answer; that incorrect option is disabled and labelled **Déjà essayé**. A repeated wrong choice is also ignored by the core. After the second attempt, regardless of correctness, the exact correct term-definition pairing appears. First-attempt success also shows the pairing.

`submitAnswer` returns new state for accepted attempts, rejects invalid offered IDs without consuming attempts, and ignores stale/completed/repeated events. `advanceSession` requires completion and an expected question ID so duplicate next events cannot skip questions. `summarizeSession` derives completed/total and the three outcome counts without storing redundant score. Empty sessions finish safely. No adaptation, timers, penalties, student identities or persistent performance history.

The child sees question progress and a participation-focused completion message, not a numerical score or leaderboard. Demo labelling appears on introduction, question and summary. Restart clears responses; leaving/blurring practice clears the session. FC-004 normal practice lists persisted household lessons, shows an unreviewed notice for independently eligible content and rechecks policy before transitions plus a two-second poll. Failures/revocation pause the session. FC-005 implements protected parent review/correction/approval; no assignment intake UI exists yet. An empty installation has no normal lessons. The reference fixture never enters the household list automatically.

## FC-003A session presentation

Authoritative assignment ordering and deterministic question generation remain unchanged. On each successful Start or Replay authorization, `randomizePresentation(questions, random)` copies the question array, every question object and every option-ID array, shuffles each option array with separate Fisher–Yates draws, then shuffles question order. IDs, correct targets, source references, distractor membership, five-question cap and grading policy are preserved. No source text is copied into responses or rewritten.

The application injects `Math.random`; tests inject deterministic functions. Each new session performs a fresh shuffle, but a coincidentally identical arrangement is valid. Randomness is presentation-only, not a security primitive. The existing seeded generator still determines eligible questions/distractors; FC-003A does not randomize lesson selection or introduce adaptation.

`practiceRun.js` is a small React-independent, in-memory lifecycle coordinator. It retains `{ questions, session }`: presentation definitions remain separate from response/progress state. Start/Replay authorizes first and constructs one presentation/session snapshot outside render and React state-updater callbacks. Retry, feedback, advance, summary and rerenders reuse that presentation. Replay resets responses and draws again from the original generated definitions.

A synchronous pending-operation guard prevents repeated Start/Replay/Submit/Next taps from overlapping authorization. Focus-visit and run identities reject late completions after leaving, re-entry or replacement; old finalizers cannot clear a newer operation guard. Authorization failure does not publish a new run or draw randomness. Household practice also checks visit identity before applying delayed content reads or policy errors. No authorization decision, credentials or persistence implementation moves into the coordinator.

Existing household eligibility checks remain before start/replay/submit/advance, on resume and in revocation polling. Losing eligibility or changing content revision removes playable practice through the existing screen path. The labelled development demo uses the same presentation lifecycle; its build-only exception is unchanged. Presentations and responses are never persisted. Leaving clears the run. Android uses Metro for this JavaScript-only change; no new native APK is required.
## Verification boundaries

Node tests cover deterministic generation, eligibility/demo gating, duplicate/absent/unsafe content, ID grading, three outcome types, progression guards, scoring and nonmutation. Browser verification exercises the real UI and the production export's demo blocking. Web screenshots/keyboard checks do not establish Android or screen-reader behavior. Original worksheet authenticity and semantic ambiguity remain human-review concerns.

## FC-006A - pure Typed Vocabulary Recall contracts

Student-facing name: **Spelling Practice**. Historical Increment A delivered only the pure module and tests, without UI/session integration. B/C subsequently added the integration described below under separate authorization. Multiple-choice exercise modules and gradeAnswer remain unchanged; no persistence or parent preparation was added.

`src/core/exercises/typedVocabularyRecall.js` accepts a full document envelope plus options `{ mode: 'practice' | 'demo', development: boolean, householdPolicy }`. Defaults are practice/non-development/strict fallback. Existing detailed/bulk evidence or independent policy is sufficient; no new review or parent configuration. The exact pending reference ID requires explicit build/demo flags. Persisted development samples retain ID/purpose checks and production exclusion. Build capability must not come from a route parameter.

```js
generateTypedVocabularyQuestions(document, options) // -> { questions, diagnostics }
validateTypedVocabularyQuestion(question, document, options) // undefined or TypeError
resolveTypedVocabularyQuestion(question, document, options) // -> { definition } only
gradeTypedVocabularyAnswer(question, document, response, options) // gradeAnswer result
createTypedVocabularyResponse(question, document, options) // -> { questionId, attempts: [], outcome: null }
submitTypedVocabularyAnswer(state, question, document, response, options) // immutable state
resolveTypedVocabularyFeedback(state, question, document, options) // null, or terminal { correctTerm, definition }
```

Questions have exactly `{ schemaVersion: 1, id: 'vocabulary-recall-' + targetItemId, type: 'typed_vocabulary_recall', assignmentId, targetItemId, gradingPolicy: 'typed-vocabulary-two-attempts-v1' }`. They contain references, not copied answers/source text/approval. Generate at most five, sorted by stable item ID; a single eligible pair suffices. The authorized Start/Replay integration shuffles question order, not source content.

Only teacher/parent-corrected terms and French definitions participate. Missing optional definitions and supplementary content are skipped. Malformed supplied educational fields invalidate the whole document and throw rather than being silently repaired or partially accepted. Exclude every member of duplicate term/definition groups using gradeAnswer equivalence. Diagnostics contain IDs/fixed codes only: approval_required, ineligible_content, ambiguous_content, answer_leakage and no_questions.

Both provisional policies were checked against the existing contracts and five reference pairs before implementation; no conflict was found. Blank submissions and grading-equivalent wrong retries are identical-state no-ops. Case-only, surrounding-whitespace-only and canonical-Unicode edits consume no second attempt. Accent, punctuation and internal-spacing edits are significant. Non-string submissions reject; the direct grading wrapper also rejects blank strings. Preserve the complete term including articles, raw response and existing incorrect_spelling category; no new accent diagnosis or scoring.

Literal leakage checks normalize NFC/case/surrounding whitespace, escape regex metacharacters and require boundaries outside Unicode letters/marks/numbers/underscore. Check full term and a derived headword, stripping only initial un/une/le/la plus whitespace or elided l' / l’ (U+2019). This never changes expected grading text. No stemming, accent removal, synonyms or partial-name/semantic inference. Plurals/unaccented variants need not match a singular/accented target; these checks do not prove absence of every possible hint.

Response state binds questionId and stores up to two `{ response, isCorrect, mistake }` attempts. Histories are revalidated against the snapshot; malformed/sparse/stale-question/impossible histories reject. Outcomes are correct_first_attempt, correct_second_attempt and incorrect_after_two_attempts. Terminal string submissions are ignored. First wrong text remains in the attempt; editable-draft retention belongs to FC-006C. Feedback exposes the exact term/definition only after completion. This is a student-presentation contract, not encryption of locally inspectable assignment content.

Pure eligibility validates supplied snapshots, not live authorization. FC-006B/C retain service-policy/contentRevision checks and visit/run/pending guards before transitions, with minimal exercise-specific grading/presentation dispatch. No session integration or live revocation guarantee comes from FC-006A alone.

Parent effort is a first-class quality measure: zero new preparation, configuration, editing, review or approval steps. Skip unsuitable items without generating parent tasks. Future capture -> review exceptions -> ready-to-practice intake targets approximately two minutes of parent involvement per typical worksheet; this is a future usability target, not an implemented capability.


## FC-006B - explicit two-type session and presentation integration

FC-006A pure contracts remain unchanged. The shared session modules support exactly vocabulary_multiple_choice (default) and typed_vocabulary_recall. Increment B added no registry, plugin mechanism, new service, parent step, persistence, draft state or UI. C subsequently implemented selection/input on these session contracts.

The public session context is `{ exerciseType, document, options }`. Options use the existing A contract (householdPolicy, development, mode). createSession(questions, context) validates typed questions against that snapshot, rejects mixed types and returns the existing questionIds/index/responses/finished shape. submitAnswer(session, question, answer, context) dispatches typed answers to A's immutable transitions. Typed responses retain questionId, raw attempts and the three existing outcomes; blank/equivalent retries return the exact prior session. advanceSession and summarizeSession retain their existing contracts; no new scores or student records are introduced. Legacy multiple-choice calls without context remain valid.

randomizePresentation(questions, random, exerciseType = 'vocabulary_multiple_choice') preserves the original multiple-choice draw order and copied choice arrays. Typed questions have a closed reference-only shape, are copied individually, and only their order is shuffled (N-1 draws); unknown/mixed/answer-bearing typed shapes reject. No render/attempt/resolution read draws randomness. Source question definitions and assignment content remain unchanged.

FC-006C constructs one coordinator per loaded lesson/type with:

```js
const controls = createPracticeRun({
  questions,
  exerciseType: 'typed_vocabulary_recall',
  document: authorized.document,
  options: { householdPolicy: authorized.policy, development: buildDevelopment },
  verify, // current service eligibility AND contentRevision === loaded baseline
  random: Math.random,
  onChange: receiveRun,
});
controls.enter();
await controls.start(); // also Replay after completion
// With the current onChange snapshot and its actual current question object:
const view = controls.present(run, question); // { definition, feedback: null | { correctTerm, definition } }
await controls.submit(run, question, draftText); // explicit submission only
await controls.advance(run, question.id);
controls.leave();
```

The coordinator defensively copies document/options and never publishes grading context with `{ questions, session }`. Its existing synchronous pending guard, visit identity and expected-run checks cover Start/Replay/Submit/Next; Submit additionally requires the actual current presentation question object. Typed blank/repeated/completed submissions and incomplete/stale advancement return false without publishing a replacement run. Successful transitions return true. Multiple-choice state, ID grading, option shuffle and retry outcomes remain unchanged. present returns null for stale/inactive run or question identity; otherwise it is a synchronous read that consumes no attempt, performs no live storage read and never renews parent activity. Completion feedback alone exposes the expected term. Multiple-choice present also needs a supplied document; its options necessarily include the correct term, without identifying it before completion. Existing UI resolution is unchanged.

Live authorization is the supplied verify callback, not the retained snapshot. app/practice.js retains service-backed checks before Start/Replay/Submit/Next plus current-policy/contentRevision polling and resume handling, clearing playable UI on failure. B tests use actual household commands to reproduce policy revocation and parent corrections with that verifier. The coordinator does not create a new authorization service or add its own timer/AppState listener. An obsolete content snapshot cannot be made current merely by restarting the same coordinator. Reload content/create a new coordinator after correction. Parent PIN expiry alone is not loss of student eligibility under an otherwise permitted household policy.

Reference demo mode must retain explicit build-only options and the existing full document/ID/purpose restrictions. Production cannot turn on the persisted sample through household policy or a route option. No new parent review/approval/preparation is required.

Historical B verification: tests/typedPracticeRun.test.js added 16 focused cases; 226 automated tests and lint passed. These verified session/presentation contracts, not a typed screen or physical input. C/D UI, final local validation and owner-reported Android results supersede this delivery-time verification boundary. Physical TalkBack remains unverified.


## FC-006C - Spelling Practice student interface

The existing practice introduction and completion views now offer Multiple Choice (default) and Spelling Practice. Selection is student-only, with accessible selected/pressed button state; no new parent workflow, approval, configuration or preparation. Type changes remount the exercise-specific coordinator before starting a new session. Start/Replay remain disabled until its focus effect has entered the coordinator, and route exit clears readiness. Active-question views do not offer type switching. The existing multiple-choice prompts, three options, retries, feedback and celebration remain.

Household loading retains the full authorized document envelope and current policy, rather than discarding approval/revision metadata. Both activities receive the same existing live verify callback, with current eligibility/contentRevision checks before Start/Replay/Submit/Next and existing two-second polling/resume checks. Policy loss or a material parent correction unmounts playable content and discards draft state; re-entry reloads saved content and starts fresh. Reference demo is still gated by __DEV__ and the exact bundled reference; persisted samples retain their development purpose/banner and production exclusion. A route parameter cannot grant development capability.

TypedVocabularyQuestion receives only the coordinator's present(run, question) result, the submitted response state and guarded callbacks. The prompt contract contains definition/feedback only; no expected term in input value, placeholder, accessibility label, hint or precompletion feedback. Draft state belongs solely to that keyed component, is never automatically normalized and is not passed to grading on edit. Keyboard and on-screen Submit call the same handler, guarded synchronously against overlap; late finalizers cannot update unmounted components. The core still enforces blank/equivalent no-ops, two meaningful attempts and stale-run checks. The first incorrect draft remains editable; correct or second-miss completion locks editing and shows the exact term/definition with supportive feedback. Next/remount clears the draft; Replay draws a new authorized presentation. Existing participation-focused completion is reused without numerical scoring.

canSubmitTypedDraft in src/components/typedVocabularyInput.js compares a draft only to the student's previous submitted response through the unchanged gradeAnswer contract, never to the hidden expected answer. Empty/whitespace, equivalent retries, busy and completed states disable Submit. Disabling the control complements, and does not replace, the core transition guards.

The standard text input disables app-controlled autocorrect, capitalization, spellcheck and autofill where supported, with generic French labels and minimum control height 56. It has no autoFocus, forced selection or draft replacement after a miss. Native submitBehavior plus web-compatible blurOnSubmit=false avoid deliberate blur on keyboard submission. Spelling-only KeyboardAvoidingView and the existing scroll container with handled keyboard taps keep content scrollable in the reduced viewport. The owner subsequently reported physical Android text/cursor/keyboard and lifecycle acceptance as recorded above; browser cursor checks alone did not establish those native behaviours. Physical TalkBack remains unverified. No native configuration, dependency or APK change.

Earlier A/B/C delivery boundaries remain historical. C implements UI on the existing contracts; D now reconciles the owner-reported Android acceptance and final verification without new features. Parent effort remains zero additional steps. The eight SDK patch recommendations and prepublication physical TalkBack verification remain separate deferred work. No commit or capture work is authorized by this record.
