# Architecture Baseline — v0.1

Expo-first runtime approved through ADR-0001 on 2026-11-10; future integrations remain deferred.

## Runtime
Expo + React Native + Expo Router (JavaScript); web for early interactive validation, Android target. Prefer minimal dependencies. Use the built-in Node test runner for pure JS modules; see ADR-0001 for exact version selections. Select Node 22 with the repository's `.node-version` and a terminal-local fnm environment.

## Proposed directories after scaffolding
```text
app/                   Expo Router screens
src/components/        Reusable accessible UI
src/core/exercises/    Schemas, graders, generators (pure JS)
src/core/review/       Mistake categorization and local review rules
src/content/fixtures/  Reviewed anonymous teacher-assignment fixtures
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

Teacher-provided text -> parent-reviewed structured assignment -> approved exercise instances -> local student attempts -> local progress summary. Supplementary AI practice must be tagged separately. Each question includes `id`, `type`, `sourceItemIds`, `prompt`, `correctAnswer`/`acceptedAnswers`, `gradingPolicy`, `explanation`, `origin` and `reviewStatus` where applicable.

## Grading
Pure functions, with explicit policies for accents, capitalization, whitespace, and punctuation. Never normalize away a learning target by default. Record mistake categories without exposing answers before submission.

## Later integrations
On-device OCR with human review; secure server-side AI generation with schema validation; optional parent-managed Supabase auth/storage and local cache. All remote calls must be authorized and privacy-reviewed before launch.

## Operational separation
Independent Git repository, environment variables, Supabase project reference, and terminal. Do not connect to any existing equipment-planning Supabase project.
