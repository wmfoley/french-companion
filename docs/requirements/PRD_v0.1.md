# French Immersion Study Companion
## MVP Product Requirements Document — v0.1

**Status:** Initial development baseline / proposed, not yet approved  
**Architecture reconciliation:** 2026-11-10 — owner-approved ADR-0001 supersedes the separate web/mobile prototype architecture; educational requirements remain proposed.
**Household policy reconciliation:** 2026-11-10 — approved ADR-0002 separates assignment review, practice eligibility and source fidelity; supersedes mandatory per-assignment approval wording for households explicitly allowing independent practice.
**Date:** 2026-11-09  
**Primary audience:** Canadian elementary French Immersion students (initial test: Grade 4; design range Grades 2–5) and their English-speaking parents  
**Target platform:** Android  
**Document purpose:** Define a focused educational proof of concept (POC), followed by a controlled Android MVP.

---

## 1. Executive summary

French Immersion Study Companion helps elementary students practise the spelling, vocabulary, phrases and grammar from their *actual weekly school assignments*. A parent photographs the worksheet, reviews the extracted material, and approves a generated weekly study set. The student then completes short, age-appropriate practice sessions using dictation, spelling-error identification, fill-in-the-blank, matching, grammatical transformation and mixed review. A separate English-language parent guide explains the lesson and how to help without speaking French.

**Positioning:** More guided and comprehensive than a basic dictation app, but less complex than a general AI study platform. It is a study companion, not a homework-answer generator.

**Validation premise:** Initial informal checks of Dictee Fun and Lexie did not match the intended user experience. This is a motivation for testing a differentiated experience, not evidence of established commercial demand.

## 2. Problem and goals

### 2.1 Problem

- Children may struggle with French spelling, grammar and pronunciation when preparing for weekly quizzes.
- Weekly tests can vary: spoken dictation, finding misspellings, missing words, definition matching and grammar application.
- English-speaking parents cannot reliably pronounce the French content or explain the grammar.
- Generic study apps can be too limited or too advanced for elementary students.

### 2.2 Goals

1. Convert a photographed weekly worksheet into an accurate, parent-reviewed structured study set.
2. Let a Grade 4 child practise independently in 5–15-minute sessions.
3. Support multiple assessment formats from the same source material.
4. Provide accurate French pronunciation and actionable, English-language parent support.
5. Review missed items without excessive repetition or unnecessary AI calls.
6. Keep source material distinguishable from AI-created extra practice.

### 2.3 Non-goals for POC/MVP

- Completing the student's homework or generating final assignment answers.
- Open-ended AI chatbot for children.
- Speech-recognition-based pronunciation scoring.
- Teacher/classroom management, school integrations, leaderboards, social features or ads.
- Automatic assessment of handwritten student responses.
- iOS release, subscriptions and payment processing.
- Full curriculum coverage or a universal language-learning engine.

## 3. Users and scenarios

**Student:** Grade 4 French Immersion learner who needs spelling and grammar practice and can navigate a simple Android interface.  
**Parent:** English-speaking caregiver who uploads/approves material and wants practical guidance.  
**Later stakeholders:** Teachers and other parents providing pilot feedback; not administrative users in MVP.

**Primary weekly scenario:** Parent photographs a worksheet containing French vocabulary, definitions and a grammar rule. App extracts and organizes the content, displays any uncertain text for correction, creates a study set, and presents short daily practice sessions. The student practises through the week and takes a mixed review quiz before the classroom assessment.

## 4. Source-of-truth and content policy

- The **teacher's worksheet** is the preserved source for *Study My Assignment*. Interpretations and parent corrections remain separate. Parent review/acceptance, practice permission and verification against the worksheet are independent concepts.
- AI may classify and organize the worksheet but must not silently alter the teacher's definitions, spelling or examples.
- The application clearly labels **Teacher material** and **Extra practice (AI-generated)**.
- Grammar explanations must be grounded in a reviewed rule set; AI-generated exercises and keys are checked before release to the child.
- When OCR confidence or grammar interpretation is uncertain, request parent review or omit the uncertain exercise.
- AI-generated practice is not presented as an official teacher expectation or an exact prediction of the school quiz.
- Household practice defaults to requiring parent acceptance. A parent may explicitly enable independent practice with eligible, structurally valid unreviewed assignments after acknowledging interpretation/transcription risks. Independent practice does not approve assignments or verify sources. It does not automatically enable AI supplementary content.

## 5. Reference assignment: Grade 4 vocabulary and grammar

**FC-002 source qualification:** The local reference fixture copies the vocabulary/definitions and grammar examples reported here. It remains `pending_review` and unverified against the original worksheet. Parent approval accepts interpreted content for practice; it does not independently verify the worksheet or upgrade source fidelity. Missing teacher instructions and example sentences are not reconstructed. Preserved source excerpts remain separate from corrections, which require provenance and an explanation. Substantive educational edits to approved assignments require renewed review.

**Worksheet title:** Vocab/grammar quiz.

### 5.1 Vocabulary (preserve original French definitions)

| Term | Teacher-provided definition | Optional parent-facing English |
|---|---|---|
| un dirigeant | une personne qui dirige un groupe ou un pays | a leader |
| un négociateur | une personne qui essaie de trouver un accord | a negotiator |
| une crise | une période difficile ou dangereuse | a crisis |
| Chef Maquinna | une personne importante chez les Nuu-chah-nulth | Chief Maquinna; historical Nuu-chah-nulth leader |
| pacifique | qui favorise la paix et évite la violence | peaceful |

**Cultural accuracy:** Preserve the spelling and respectful context of Nuu-chah-nulth and Chief Maquinna; do not invent historical claims from the worksheet's short definition.

### 5.2 Grammar

Worksheet introduces adverbs ending in **-emment** from adjectives ending in **-ent**, including:

- prudent → prudente → prudemment
- fréquent → fréquente → fréquemment
- patient → patiente → patiemment

Parent explanation: these examples form adverbs by replacing the ending **-ent** with **-emment**; the spoken ending may sound like **-amment**, making spelling practice particularly useful. Do not generalize the pattern to all adjectives without review; French contains exceptions and other adverb-formation patterns.

### 5.3 Required generated exercise examples

1. **Definition matching:** “une personne qui essaie de trouver un accord” → “un négociateur”.
2. **Spelling-error detection:** “une crize” is incorrect; correction “une crise”.
3. **Fill-in-the-blank:** “Un négociateur essaie de trouver un ____.” → “accord”.
4. **Grammar transformation:** “patient → ?” → “patiemment”.
5. **Dictation:** play “négociateur” without displaying the answer; accept correctly spelled input, including accents where applicable.
6. **Mixed review:** include source vocabulary and grammar, with extra generated questions clearly labeled.

## 6. Student experience

### 6.1 Home

Three primary actions: **My Weekly Lesson**, **Start Practice**, **Add a Lesson**. A small, visually distinct **Parent Area** is available behind a simple parent gate. Avoid a dense dashboard.

### 6.2 Study session

1. Show one question at a time with large touch targets and clear French instructions.
2. Provide optional replay and slower French audio where available.
3. Allow retry before revealing an answer; do not shame or punish mistakes.
4. Show a brief French explanation; offer English support in parent mode.
5. Record the result and revisit missed items later in the week.
6. End with a short summary rather than a competitive leaderboard.

### 6.3 Weekly plan (editable default)

- Monday: listen and review vocabulary/grammar.
- Tuesday: spelling and definition matching.
- Wednesday: grammar and targeted correction.
- Thursday: mixed practice focused on missed items.
- Friday: practice quiz resembling several teacher assessment formats.

No assumption that school quizzes always occur on Friday; parent can change test day or session schedule.

## 7. Exercise engine — functional requirements

| ID | Type | Input | Evaluation | MVP acceptance criterion |
|---|---|---|---|---|
| EX-01 | Dictation | French TTS word/phrase | Deterministic normalized string comparison, with explicit accent/punctuation policy | Answer hidden until submission; replay works; accent errors identifiable |
| EX-02 | Find the mistake | Original word plus generated plausible misspelling | Exact keyed target | Only one unambiguous error in single-answer mode; show correction |
| EX-03 | Fill in the blank | Source definition/sentence with a removed word | Exact answer plus reviewed accepted variants | Blank is unambiguous and answer is not visible elsewhere |
| EX-04 | Matching | Teacher terms and definitions | Deterministic keyed pairs | Correct source terms and definitions preserved |
| EX-05 | Grammar transformation | Adjective/rule and expected adverb | Deterministic answer checking | Correct transformation and explanation verified |
| EX-06 | Mixed practice quiz | Combination of approved exercise instances | Aggregated local scoring | Includes at least three distinct types and a review summary |

**Answer checking:** Preserve the original response for feedback. Normalize harmless whitespace and optionally case when pedagogically appropriate; **do not silently ignore accents**, word endings or other target spelling distinctions. Punctuation and capitalization rules must be exercise-specific. For multi-word answers, present a useful error location rather than only a red X. Avoid exposing target answers in hints.

**Difficulty:** Grade-aware settings, but initially tune against Grade 4 examples. Do not automatically increase difficulty simply because a student finishes quickly.

**Mistake tracking:** Record question type, concept, attempt count, answer, correctness, accent error and repeat performance where applicable. Keep the learner's data minimal and parent-accessible.

## 8. Parent experience

- Capture or import worksheet image.
- Review OCR text side-by-side with the photo; correct spelling and segmentation.
- Approve extracted vocabulary, phrases, definitions and grammar rules before publishing the study set.
- Read an English summary: what is being taught, likely difficulties and how to help.
- Select or disable exercise types and optional extra practice.
- View a concise weekly progress summary and common mistakes.
- Delete the weekly assignment and associated student results.

**Local Parent Area (ADR-0002):** One household per installation and one parent PIN; protected service commands enforce settings independently of navigation. FC-004 implements web persistence, strict-by-default policy and explicit independent-practice opt-in. FC-005 adds reviewed approval/corrections and separate Approve All with risk acknowledgement. Both acceptance methods can authorize strict-mode practice and retain their distinction; neither verifies the original worksheet. Student setup/use must not require repeated parent intervention after policy configuration. No accounts or cloud authentication in these milestones.

**Parent guidance example:** “This week's grammar focuses on the -ent → -emment pattern. Ask your child to explain the rule and spell *prudemment*, *fréquemment* and *patiemment* after hearing them. The spoken ending can sound like -amment.”

## 9. AI and content-generation contract

### 9.1 AI tasks

- Interpret corrected OCR text into structured categories (vocabulary, definitions, phrases, rules, examples).
- Generate a small set of additional, age-appropriate exercises when explicitly requested.
- Produce parent-facing English explanations and short child-facing French hints.
- Flag ambiguous material for review rather than guessing.

### 9.2 Non-AI tasks

- Camera capture, local text editing, audio playback, question rendering, deterministic scoring, study scheduling and basic error categorization.

### 9.3 Structured output (conceptual)

This earlier conceptual generation example is not the local assignment schema. FC-002's approved schema version 1 is documented in `docs/architecture/ASSIGNMENT_MODEL.md`; assignment content, exercise instances and student performance records remain separate.

```json
{
  "study_set_id": "example-id",
  "grade": 4,
  "source_status": "parent_approved",
  "language": "fr-CA",
  "vocabulary": [
    {
      "term": "un négociateur",
      "definition_fr": "une personne qui essaie de trouver un accord",
      "source": "teacher"
    }
  ],
  "grammar_rules": [
    {
      "id": "adverb-ent-emment",
      "summary_fr": "Les adjectifs en -ent forment souvent des adverbes en -emment.",
      "examples": [{"input":"patient","answer":"patiemment"}],
      "source": "teacher"
    }
  ],
  "exercises": [
    {
      "id": "ex-001",
      "type": "grammar_transform",
      "prompt_fr": "Transforme l'adjectif patient en adverbe.",
      "answer": "patiemment",
      "source": "teacher",
      "source_reference": "adverb-ent-emment"
    }
  ]
}
```

### 9.4 Validation gates

- JSON schema validation and allowed exercise-type validation.
- Source references for every teacher-based question.
- No unintended answer leakage in displayed prompts or hints. In FC-003 definition-to-term multiple choice, the correct term is necessarily among the answer options; do not identify it before question completion. Dictation continues to hide its target answer before submission.
- Check that each question has an unambiguous correct answer; generated spelling errors must be plausible and unique.
- Validate grammar examples against an approved rule/exemplar set; reject uncertain outputs.
- Enforce small response size, cost limits, and retries with safe fallback.
- Apply household eligibility policy before practice: parent acceptance is required in strict mode; eligible unreviewed assignments may be practised in independent mode. Content structure and exercise validation remain mandatory in both. Consider sampling teacher review during pilot.

## 10. Technical architecture

### 10.1 Recommended stack

| Layer | POC | Android MVP |
|---|---|---|
| UI | Expo + React Native, JavaScript; Expo web preview | React Native + Expo, JavaScript |
| Shared logic | Framework-independent JavaScript package for exercise types/scoring | Reuse same package |
| Navigation | Expo Router | Expo Router |
| Camera | Manual upload of reference photo | Expo Camera |
| OCR | Manually transcribed/reference dataset first | Google ML Kit on-device OCR via compatible native integration; verify Expo dev-build support |
| Audio | Platform speech adapter for Expo web; audio work deferred beyond FC-001 | Android device TTS, compare with fr-CA cloud TTS |
| AI | Server-side API call with schema validation | Supabase Edge Function or other secured backend |
| Persistence | Local JSON/SQLite as appropriate | Local SQLite, optional Supabase sync |
| Authentication | None; single test household | Parent-managed account only if required for sync |
| Deployment | Local browser/test URL | Expo EAS Android build and Google Play distribution |

**Security:** Never embed provider API keys in the Android client. Server-side authorization and rate limiting precede AI calls. Separate parent/child roles in the application; avoid public sharing of assignments.

### 10.2 Suggested code boundaries

- `src/core/`: framework-independent question schema, grading, review scheduling and validation.
- `src/content/`: approved reference fixtures and grammar rules.
- `app/`: one JavaScript Expo Router application, validated on web first and Android thereafter.
- Future backend: secure study-set generation and optional persistence; excluded from FC-001.

Per approved ADR-0001, use a single Expo project; no separate web prototype or monorepo tooling is required.

## 11. Privacy, safety and accessibility

- Design for child use with a parent-controlled setup and no unrestricted child-to-AI chat.
- Prefer on-device OCR; send only necessary reviewed text to the AI service, not full worksheet photos by default.
- Detect and allow removal of student names, school names and other identifiers.
- Establish consent, data-retention, deletion and provider-data-use policies before external pilot or release.
- Review applicable Canadian privacy requirements and Google Play Families policies with current guidance before publication.
- Provide readable type, high contrast, large targets, accessible audio controls and non-punitive feedback.
- Do not treat a model's answer as authoritative for culturally sensitive or historically specific material.

## 12. Milestones, estimates and exit gates

### POC — educational experience (30–50 hours, indicative)

**Scope:** Use the supplied Grade 4 worksheet as a hardcoded, reviewed fixture. Build an Expo/React Native student interface validated through Expo web with matching, spelling-error identification, fill-in-the-blank, grammar transformation, basic dictation playback and mixed review. Include a static parent guide. No camera integration or cloud persistence is necessary.

**Exit gate:** Child can complete a 10-minute session independently; parent understands the lesson; questions are accurate and feedback helpful; no significant confusion from UI. Repeat with at least two additional real worksheets before committing to Android MVP.

### Android MVP — additional 90–140 hours, indicative

**Scope:** Extend the existing Expo/React Native app with camera/OCR, parent correction screen, server-side AI study-set creation, real fr-CA voice evaluation, locally saved weekly sessions, review logic, parent guide, and error handling.

**Exit gate:** At least three differently formatted worksheets are processed reliably; parent can correct OCR; study-set generation and validation are robust; child can finish a session without assistance; test on representative Android devices. Conduct privacy review before broader pilot.

**Total indicative engineering effort:** 120–190 hours for POC + Android MVP, excluding extensive educational validation, commercialization, subscriptions, and app-store compliance work.

### Later phases — not authorized by this PRD

Pronunciation scoring, teacher portal, curriculum library, adaptive difficulty beyond basic missed-item review, multi-child analytics, subscriptions, iOS and additional languages.

## 13. Acceptance test cases

1. **OCR fidelity:** Parent can correct “négociateur” or “Nuu-chah-nulth” before content generation.
2. **Source integrity:** Original definition of “une crise” remains unchanged in Study My Assignment.
3. **Dictation:** The spoken word is not displayed before submission; correctly accented answer is recognized.
4. **Spelling errors:** “crize” is flagged as an incorrect spelling of “crise”, with a clear explanation.
5. **Grammar:** “patient” accepts “patiemment” and does not accept “patiament”.
6. **Matching:** “un dirigeant” maps to its teacher-supplied French definition.
7. **Parent guide:** English explanation accurately describes the -ent/-emment rule without claiming universal application.
8. **Offline reuse:** Previously generated, locally saved questions can be practised without another AI call.
9. **Privacy:** Student name accidentally visible in a photo can be removed from extracted text before transmission.
10. **Failure:** OCR/API failures show understandable retry/edit options and never silently publish guessed content.
11. **Extra practice:** AI-created examples are labeled and never overwrite teacher examples.
12. **Mixed quiz:** Results identify which question types and words need more practice.

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| OCR mistakes in accents/proper nouns | Parent correction before approval; keep original image locally |
| AI creates invalid grammar or ambiguous questions | Schema checks, reviewed grammar exemplars, discard uncertain items |
| Device voice lacks natural Canadian French | Test devices and compare cloud fr-CA voices; optional audio cache |
| Child overwhelmed by too many choices | One-question-at-a-time interface; default short sessions |
| Parent burden from correcting scans | Good OCR UX, highlight uncertain spans, reuse previous edits |
| Excessive AI usage cost | Generate once per assignment, cache, rate limits, local scoring |
| Privacy exposure | Minimize uploads, redact personal details, parental controls |
| Product-market uncertainty | Validate with household first, then small consent-based family pilot |

## 15. Open decisions (not blockers for POC)

1. Default weekly quiz day and whether parents configure it.
2. Whether child receives hints in French only or can request simplified English support.
3. How strictly punctuation/capitalization is graded in phrase dictation.
4. Which Canadian French voice is most understandable on representative Android devices.
5. Whether the first Android release is offline-first with optional cloud sync, or requires a parent account.
6. Appropriate pilot measures: session completion, child independence, parent time saved, and teacher-quiz preparation confidence.

## 16. Recommended immediate development sequence

0. Initialize the JavaScript Expo app, minimal navigation, sample pure grader and quality gates (FC-001; ADR-0001).
1. Create a small reviewed JSON fixture for the uploaded worksheet.
2. Implement a reusable exercise schema and deterministic grading functions with unit tests.
3. Build one-screen-at-a-time practice UI for four core exercise types.
4. Add dictation playback and mixed-quiz assembly.
5. Add a static English parent guide and simple mistake review.
6. Test with the child, observe friction, revise before adding OCR/AI.
7. Test two more weekly worksheets to check generality.
8. Only then start Android camera/OCR and server-side AI integration.

---

**Document governance:** This is a draft baseline. New requirements should be classified as POC, Android MVP or Post-MVP; avoid silently expanding the first two milestones. Record substantive educational or architectural decisions as explicit revisions.
