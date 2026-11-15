# FC-007A synthetic evidence corpus

All examples in `tests/fixtures/preparation/corpus.json` are invented, non-identifying test data. They are not original teacher worksheets, transcriptions, captured images, real OCR outputs or measurements of extraction accuracy. The source text is exact **fixture evidence**, not verified school material. Corpus data is not imported by the application or sample loader.

| Case | Contract evidence |
|---|---|
| printed-list | Labelled printed vocabulary pairs |
| printed-table | Pipe-separated term-definition rows with explicit row links |
| accents-articles | French accents, apostrophe and complete articles |
| multi-word | Complete multi-word terms |
| missing-definition | Exclusion without invented content |
| ambiguous-association | Exclusion despite supplied term/definition text |
| duplicates | Every duplicate term excluded |
| partial-sheet | Supported pair, missing definition and preserved unsupported grammar |
| grammar-only | Grammar retained but no vocabulary manufactured |
| technical-document | Unrelated technical text retained as unsupported |
| unsafe-material | Mock blocked-safety assessment over benign vocabulary; tests the safety/readiness boundary, not detection of dangerous language |
| embedded-instructions | Hostile instruction strings remain inert unsupported evidence |

Confidence is deliberately absent in corpus examples, so tests must not treat it as certainty. Reliability/safety statuses are test declarations. Focused tests additionally cover unknown statuses, null/out-of-range confidence, malformed references, fabricated assessment fields, Unicode composition, immutable input and existing policy/approval boundaries. No fixture demonstrates a safety detector, visual association recognition, handwriting recognition or the 120-second parent preparation target.
