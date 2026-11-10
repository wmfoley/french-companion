# Project Charter — v0.1 (Proposed)

## Mission
Help Canadian elementary French Immersion students practise their actual weekly spelling words, phrases and grammar while enabling English-speaking parents to support learning.

## Audience
Grades 2–5, with Grade 4 as the initial validation case; parent-guided onboarding and child-independent short sessions.

## Principles
1. Preserve original teacher source material verbatim, separately from interpretations and parent corrections. Parent acceptance and source fidelity remain distinct.
2. Practice teaches, not completes homework.
3. French-first student experience; concise English parent guidance.
4. Small, predictable activities; accessible controls and gentle feedback.
5. AI generates/organizes content, not routine scoring; validated answer keys.
6. Privacy by design, data minimization, no child public profiles or advertising in MVP.
7. Test educational usefulness before cloud architecture or monetization.
8. Encourage independent student learning under parent-controlled household policy. Parents may permit eligible unreviewed assignments; practice must not imply review or source verification (approved ADR-0002).

## In scope for POC
Local reviewed worksheet fixture; deterministic exercise schema/scoring; spelling error, fill-blank, matching, grammar transformations, dictation with speech where available, mixed review; static parent guide.

## Out of scope for POC
Production OCR, live AI, authentication, cloud sync, subscriptions, teacher portal, speech assessment, public launch.

## Success gate
Child can independently finish a short mixed session based on real teacher material; parent can understand the learning objective; no misleading answer keys; test suite passes. Pilot feedback is required before claiming educational efficacy or market demand.
