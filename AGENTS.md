# Codex Instructions — French Companion

## Scope and authority
Operate ONLY within the currently opened French Companion repository. Never inspect, modify, migrate, or deploy the equipment-planning platform or any sibling directory. Do not assume access to any other repository or Supabase project.

Read in order: `docs/charter/PROJECT_CHARTER.md`, `docs/requirements/PRD_v0.1.md`, `docs/decisions/ADR-0001.md`, `docs/architecture/ARCHITECTURE.md`, then `docs/development/TODO.md`. Approved newer ADRs supersede older implementation choices; flag conflicts rather than silently reconciling them.

## Implementation discipline
- Work on one ticket at a time; first propose files, changes, tests, and risks.
- Prefer JavaScript (no TypeScript without approval), Expo Router, React Native, and small pure-JS exercise modules.
- Keep the exercise engine independent of React, Supabase, AI, and OCR.
- No unapproved dependency, schema change, cloud resource, paid service, or production deployment.
- Do not alter approved educational source text. Teacher material and generated extra practice must remain distinct.
- Avoid hardcoded answer leakage in dictation UI. Grade accent-sensitive answers according to exercise-specific policies.
- No unrestricted AI chat for children; never send personal student information to an external model.
- Never embed API secrets or service-role keys in mobile/web bundles. Keep `.env*` secrets out of git.
- Never run `supabase db push`, `supabase migration up` against remote, destructive SQL, or project linking without explicit approval and confirmation of target project ref.
- No autonomous commits/pushes or branch merges without permission.
- Run relevant tests and report exact commands/results; distinguish untested work from passing work.
- Update TODO and development log for completed tickets; propose edits to authoritative documents when decisions change.

## Completion report
Summarize changed files, acceptance criteria, commands/tests, known limitations, and next ticket. Stop if repository root, Supabase target, or user intent is ambiguous.
