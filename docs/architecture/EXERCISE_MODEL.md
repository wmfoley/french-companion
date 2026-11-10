# Vocabulary exercises and sessions — version 1

FC-003 implements only vocabulary definition-to-term multiple choice. Assignment schema version 1 and the original string grader remain unchanged. All generation, ID grading and session transitions are pure JavaScript without React, network, time, storage or new dependencies.

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

The app takes an independent normalized assignment snapshot when entering practice. Definitions are generated against that snapshot, and responses remain in separate state. No persisted IDs are reused across assignment edits; content version hashes/revision history are deferred.

## Eligibility and generation

`generateVocabularyQuestions(assignment, options)` validates and clones the assignment first, then returns `{ questions, diagnostics }`. Invalid assignments/options throw `TypeError`; nonapproved normal-practice content returns no questions and `approval_required`. Normal practice is the default and requires the assignment and its supplied educational fields to be approved. Only teacher/parent-corrected term and definition pairs participate; absent definitions and supplementary AI/illustrative pairs are skipped, not completed or relabelled.

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

The child sees question progress and a participation-focused completion message, not a numerical score or leaderboard. Demo labelling appears on introduction, question and summary. Restart clears responses; leaving/blurring practice clears the session. No parent approval editor or approved-assignment loader is implemented yet; with the current pending fixture, normal practice deliberately shows an awaiting-parent-validation message.

## Verification boundaries

Node tests cover deterministic generation, eligibility/demo gating, duplicate/absent/unsafe content, ID grading, three outcome types, progression guards, scoring and nonmutation. Browser verification exercises the real UI and the production export's demo blocking. Web screenshots/keyboard checks do not establish Android or screen-reader behavior. Original worksheet authenticity and semantic ambiguity remain human-review concerns.
