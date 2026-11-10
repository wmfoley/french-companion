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

Teacher-provided text -> parent-reviewed structured assignment -> exercise definitions -> local student attempts -> local progress summary. Supplementary AI practice must be tagged separately. FC-003's minimal versioned vocabulary definition references assignment/item IDs and resolves prompt, correct term, provenance and fidelity from an independent assignment snapshot rather than duplicating them. See [EXERCISE_MODEL.md](EXERCISE_MODEL.md). Future exercise types may add explicit prompt/accepted-answer fields when required.

Approved [ADR-0002](../decisions/ADR-0002.md) separates review status, practice eligibility and source fidelity. Normal generation applies the persisted household policy: strict by default, or explicitly parent-enabled independent practice with eligible unreviewed content. Parent-only policy commands validate in-memory capabilities independently of routes. IndexedDB transactions persist configuration and versioned assignment envelopes on web; native operations fail closed pending verified adapters. The pending reference fixture remains explicitly development-demo-only (`__DEV__`). Exercise definitions, content and responses remain separate; no persisted performance records or adaptation yet.

## Grading
Pure functions, with explicit policies for accents, capitalization, whitespace, and punctuation. Never normalize away a learning target by default. Record mistake categories without exposing answers before submission.

## Later integrations
On-device OCR with human review; secure server-side AI generation with schema validation; optional parent-managed Supabase auth/storage and local cache. All remote calls must be authorized and privacy-reviewed before launch.

## Operational separation
Independent Git repository, environment variables, Supabase project reference, and terminal. Do not connect to any existing equipment-planning Supabase project.
