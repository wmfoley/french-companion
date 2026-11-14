const REVIEW_STATUSES = ['draft', 'pending_review', 'approved'];
const ORIGINS = ['teacher', 'parent_corrected', 'ai_generated', 'illustrative'];
const FIDELITIES = ['reported_teacher_content', 'unverified_transcription', 'verified_transcription', 'illustrative'];

/** Validate JSON-compatible assignment content without modifying it or judging its accuracy. */
function validateAssignment(value) {
  const errors = [];
  const ids = new Set();
  const sourceIds = new Set();
  const references = [];
  const error = (path, code) => errors.push({ path, code });
  const object = (v, path, keys) => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) {
      error(path, 'expected_object');
      return false;
    }
    for (const key of Object.keys(v)) {
      if (!keys.includes(key)) error(`${path}.${key}`, 'unknown_field');
      if (v[key] === undefined) error(`${path}.${key}`, 'expected_json_value');
    }
    return true;
  };
  const text = (v, path) => {
    if (typeof v !== 'string' || !v.trim()) error(path, 'expected_nonblank_text');
  };
  const choice = (v, path, options) => {
    if (!options.includes(v)) error(path, 'invalid_value');
  };
  const id = (v, path, set = ids) => {
    if (typeof v !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) error(path, 'invalid_id');
    else if (set.has(v)) error(path, 'duplicate_id');
    else set.add(v);
  };
  const list = (v, path, visit, required = false) => {
    if (v === undefined && !required) return;
    if (!Array.isArray(v)) { error(path, 'expected_array'); return; }
    for (let index = 0; index < v.length; index++) visit(v[index], `${path}[${index}]`);
  };
  const educationalText = (v, path) => {
    if (!object(v, path, ['text', 'provenance'])) return;
    text(v.text, `${path}.text`);
    const p = v.provenance;
    if (!object(p, `${path}.provenance`, ['origin', 'sourceIds', 'reviewStatus', 'correctionExplanation', 'authorship'])) return;
    choice(p.origin, `${path}.provenance.origin`, ORIGINS);
    choice(p.reviewStatus, `${path}.provenance.reviewStatus`, REVIEW_STATUSES);
    // Assignment acceptance and declared field review are checked by method-aware document evidence.
    const seen = new Set();
    list(p.sourceIds, `${path}.provenance.sourceIds`, (ref, refPath) => {
      text(ref, refPath);
      if (seen.has(ref)) error(refPath, 'duplicate_reference');
      seen.add(ref);
      references.push({ ref, path: refPath, origin: p.origin });
    }, true);
    if (['teacher', 'parent_corrected'].includes(p.origin) && Array.isArray(p.sourceIds) && !p.sourceIds.length) error(`${path}.provenance.sourceIds`, 'source_required');
    if (p.origin === 'parent_corrected' || p.correctionExplanation !== undefined) text(p.correctionExplanation, `${path}.provenance.correctionExplanation`);
    if (p.authorship !== undefined) choice(p.authorship, `${path}.provenance.authorship`, ['human', 'ai']);
    if (p.origin === 'illustrative' && p.authorship === undefined) error(`${path}.provenance.authorship`, 'required');
    if (p.origin === 'ai_generated' && p.authorship !== undefined && p.authorship !== 'ai') error(`${path}.provenance.authorship`, 'invalid_value');
  };
  const optionalText = (v, key, path) => { if (v[key] !== undefined) educationalText(v[key], `${path}.${key}`); };
  const date = (v, path) => {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) error(path, 'invalid_date');
  };

  if (!object(value, '$', ['schemaVersion', 'id', 'title', 'grade', 'language', 'week', 'reviewStatus', 'sources', 'instructions', 'vocabulary', 'grammarConcepts', 'supportingMaterial'])) return { valid: false, errors };
  if (value.schemaVersion !== 1) error('$.schemaVersion', 'unsupported_schema_version');
  id(value.id, '$.id');
  text(value.title, '$.title');
  if (!Number.isInteger(value.grade) || value.grade < 2 || value.grade > 5) error('$.grade', 'invalid_grade');
  choice(value.language, '$.language', ['fr-CA', 'fr']);
  choice(value.reviewStatus, '$.reviewStatus', REVIEW_STATUSES);
  if (value.week !== undefined && object(value.week, '$.week', ['label', 'startDate', 'quizDate'])) {
    if (value.week.label !== undefined) text(value.week.label, '$.week.label');
    for (const key of ['startDate', 'quizDate']) if (value.week[key] !== undefined) date(value.week[key], `$.week.${key}`);
  }
  const sources = new Map();
  list(value.sources, '$.sources', (s, path) => {
    if (!object(s, path, ['id', 'reference', 'fidelity', 'originalText'])) return;
    id(s.id, `${path}.id`, sourceIds);
    text(s.reference, `${path}.reference`);
    choice(s.fidelity, `${path}.fidelity`, FIDELITIES);
    // Raw excerpts may be empty or whitespace-only: never trim, repair or normalize evidence.
    if (typeof s.originalText !== 'string') error(`${path}.originalText`, 'expected_string');
    sources.set(s.id, s);
  });
  list(value.instructions, '$.instructions', (item, path) => {
    if (!object(item, path, ['id', 'content'])) return;
    id(item.id, `${path}.id`);
    educationalText(item.content, `${path}.content`);
  });
  list(value.vocabulary, '$.vocabulary', (item, path) => {
    if (!object(item, path, ['id', 'term', 'definitionFr', 'exampleSentences'])) return;
    id(item.id, `${path}.id`);
    educationalText(item.term, `${path}.term`);
    optionalText(item, 'definitionFr', path);
    list(item.exampleSentences, `${path}.exampleSentences`, educationalText);
  });
  list(value.grammarConcepts, '$.grammarConcepts', (item, path) => {
    if (!object(item, path, ['id', 'label', 'explanationFr', 'examples'])) return;
    id(item.id, `${path}.id`);
    educationalText(item.label, `${path}.label`);
    optionalText(item, 'explanationFr', path);
    list(item.examples, `${path}.examples`, (example, examplePath) => {
      if (!object(example, examplePath, ['id', 'adjective', 'feminine', 'adverb'])) return;
      id(example.id, `${examplePath}.id`);
      educationalText(example.adjective, `${examplePath}.adjective`);
      optionalText(example, 'feminine', examplePath);
      educationalText(example.adverb, `${examplePath}.adverb`);
    });
  });
  list(value.supportingMaterial, '$.supportingMaterial', (item, path) => {
    if (!object(item, path, ['id', 'kind', 'content', 'assetPath'])) return;
    id(item.id, `${path}.id`);
    choice(item.kind, `${path}.kind`, ['note', 'local_asset']);
    educationalText(item.content, `${path}.content`);
    if (item.kind === 'local_asset' || item.assetPath !== undefined) {
      if (typeof item.assetPath !== 'string' || !/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(item.assetPath) || item.assetPath.split('/').some(part => part === '.' || part === '..')) error(`${path}.assetPath`, 'invalid_local_asset_path');
      if (item.kind !== 'local_asset') error(`${path}.assetPath`, 'unexpected_asset_path');
    }
  });
  for (const { ref, path, origin } of references) {
    if (!sourceIds.has(ref)) error(path, 'unknown_source');
    else if (['teacher', 'parent_corrected'].includes(origin) && sources.get(ref).fidelity === 'illustrative') error(path, 'invalid_teacher_source');
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { validateAssignment };
