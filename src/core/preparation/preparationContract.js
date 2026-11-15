// Evidence consistency only: these functions do not perform OCR, safety detection,
// assignment conversion, approval or practice authorization.
const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const id = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const own = (value, key) => Object.hasOwn(value, key);
const comparison = value => value.normalize('NFC').trim().toLocaleLowerCase('fr-CA');

function validatePreparation(input) {
  const errors = [];
  function shape(value, keys, required, path) {
    if (!object(value)) { errors.push(`${path}: object_required`); return false; }
    if (Object.keys(value).some(key => !keys.includes(key)) || required.some(key => !own(value, key))) errors.push(`${path}: invalid_properties`);
    return true;
  }
  function identity(value, path) {
    if (shape(value, ['id', 'revision'], ['id', 'revision'], path) && (!id(value.id) || !positive(value.revision))) errors.push(`${path}: invalid_identity`);
  }
  function confidence(value, path) {
    if (own(value, 'confidence') && value.confidence !== null && (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1)) errors.push(`${path}: invalid_confidence`);
  }
  if (!shape(input, ['schemaVersion', 'capture', 'preparation', 'sources', 'regions', 'candidates', 'reliability', 'safety'], ['schemaVersion', 'capture', 'preparation', 'sources', 'regions', 'candidates', 'reliability', 'safety'], '$')) return { valid: false, errors };
  if (input.schemaVersion !== 1) errors.push('$: unsupported_version');
  identity(input.capture, 'capture'); identity(input.preparation, 'preparation');
  for (const [key, statuses] of [['reliability', ['unknown', 'needs_review', 'sufficient']], ['safety', ['unknown', 'clear', 'blocked']]]) {
    if (shape(input[key], ['status', 'confidence'], ['status'], key)) {
      if (!statuses.includes(input[key].status)) errors.push(`${key}: invalid_status`);
      confidence(input[key], key);
    }
  }
  const sources = new Map(); const regions = new Map(); const candidateIds = new Set();
  for (const key of ['sources', 'regions', 'candidates']) if (!Array.isArray(input[key])) errors.push(`${key}: array_required`);
  for (const source of Array.isArray(input.sources) ? input.sources : []) {
    if (!shape(source, ['id', 'text'], ['id', 'text'], 'source')) continue;
    if (!id(source.id) || sources.has(source.id) || typeof source.text !== 'string') errors.push('source: invalid_source');
    sources.set(source.id, source);
  }
  function bounds(value, source) {
    return source && typeof source.text === 'string' && Number.isSafeInteger(value.start) && Number.isSafeInteger(value.end) && value.start >= 0 && value.end > value.start && value.end <= source.text.length;
  }
  for (const region of Array.isArray(input.regions) ? input.regions : []) {
    if (!shape(region, ['id', 'sourceId', 'start', 'end', 'kind', 'support'], ['id', 'sourceId', 'start', 'end', 'kind', 'support'], 'region')) continue;
    if (!id(region.id) || regions.has(region.id) || !bounds(region, sources.get(region.sourceId)) || !['vocabulary_pair', 'vocabulary_list', 'grammar', 'instructions', 'other'].includes(region.kind) || !['supported', 'unsupported', 'unresolved'].includes(region.support)) errors.push('region: invalid_region');
    regions.set(region.id, region);
  }
  for (const source of sources.values()) {
    if (typeof source.text !== 'string') continue;
    let end = 0;
    const spans = [...regions.values()].filter(region => region.sourceId === source.id && bounds(region, source)).sort((a, b) => a.start - b.start);
    for (const span of spans) {
      if (source.text.slice(end, span.start).trim()) errors.push('source: uncovered_content');
      end = Math.max(end, span.end);
    }
    if (source.text.slice(end).trim()) errors.push('source: uncovered_content');
  }
  function field(value) {
    if (!shape(value, ['text', 'regionId', 'start', 'end'], ['text', 'regionId', 'start', 'end'], 'field')) return;
    const region = regions.get(value.regionId); const source = sources.get(region?.sourceId);
    if (typeof value.text !== 'string' || !value.text.trim() || !bounds(value, source) || !region || value.start < region.start || value.end > region.end || source.text.slice(value.start, value.end) !== value.text) errors.push('field: invalid_source_span');
  }
  for (const candidate of Array.isArray(input.candidates) ? input.candidates : []) {
    if (!shape(candidate, ['id', 'kind', 'origin', 'fields', 'association', 'confidence'], ['id', 'kind', 'origin', 'fields'], 'candidate')) continue;
    if (!id(candidate.id) || candidateIds.has(candidate.id)) errors.push('candidate: invalid_id');
    candidateIds.add(candidate.id);
    if (!['source', 'supplementary'].includes(candidate.origin)) errors.push('candidate: invalid_origin');
    const fieldKeys = candidate.kind === 'vocabulary' ? ['term', 'definitionFr'] : candidate.kind === 'instruction' ? ['content'] : candidate.kind === 'grammar' ? ['label', 'explanationFr'] : null;
    if (!fieldKeys) { errors.push('candidate: invalid_kind'); continue; }
    if (shape(candidate.fields, fieldKeys, [fieldKeys[0]], 'fields')) Object.values(candidate.fields).forEach(field);
    confidence(candidate, 'candidate');
    if (candidate.kind !== 'vocabulary' && own(candidate, 'association')) errors.push('candidate: unexpected_association');
    if (candidate.kind === 'vocabulary') {
      if (!shape(candidate.association, ['kind', 'regionId'], ['kind'], 'association')) continue;
      const association = candidate.association;
      if (!['explicit_pair', 'ambiguous', 'unknown'].includes(association.kind)) errors.push('association: invalid_kind');
      if (own(association, 'regionId') && !regions.has(association.regionId)) errors.push('association: unknown_region');
      if (association.kind === 'explicit_pair') {
        const region = regions.get(association.regionId);
        const fields = object(candidate.fields) ? Object.values(candidate.fields) : [];
        if (!region || region.kind !== 'vocabulary_pair' || fields.length !== 2 || fields.some(value => !object(value) || value.regionId !== region.id)) errors.push('association: missing_pair_evidence');
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

function assessPreparation(input) {
  if (!validatePreparation(input).valid) throw new TypeError('Invalid preparation contract.');
  const issues = []; const eligibleCandidateIds = []; const excludedCandidateIds = [];
  const regions = new Map(input.regions.map(region => [region.id, region]));
  const issue = (code, severity, candidateId = null, regionId = null) => issues.push({ code, severity, candidateId, regionId });
  // Remove every member of duplicate/ambiguous groups, never just the later row.
  const duplicates = new Set();
  for (const key of ['term', 'definitionFr']) {
    const groups = new Map();
    for (const candidate of input.candidates.filter(value => value.kind === 'vocabulary' && value.fields[key])) {
      const text = comparison(candidate.fields[key].text);
      groups.set(text, [...(groups.get(text) || []), candidate.id]);
    }
    for (const group of groups.values()) if (group.length > 1) group.forEach(value => duplicates.add(value));
  }
  for (const candidate of input.candidates) {
    const reasons = [];
    if (candidate.kind !== 'vocabulary') reasons.push('unsupported_content');
    if (candidate.origin !== 'source') reasons.push('supplementary_content');
    if (candidate.kind === 'vocabulary') {
      if (!candidate.fields.definitionFr) reasons.push('missing_definition');
      if (candidate.association.kind !== 'explicit_pair') reasons.push('unresolved_association');
      if (duplicates.has(candidate.id)) reasons.push('duplicate_or_ambiguous_pair');
    }
    if (Object.values(candidate.fields).some(field => regions.get(field.regionId).support !== 'supported')) reasons.push('unsupported_region');
    if (reasons.length) {
      excludedCandidateIds.push(candidate.id);
      reasons.forEach(code => issue(code, 'warning', candidate.id));
    } else eligibleCandidateIds.push(candidate.id);
    if (candidate.confidence == null) issue('unknown_candidate_confidence', 'info', candidate.id);
  }
  // Even a region declared supported cannot silently disappear from coverage.
  const coveredRegions = new Set(input.candidates.flatMap(candidate => Object.values(candidate.fields).map(field => field.regionId)));
  const unsupportedRegions = input.regions.filter(region => region.support !== 'supported' || !coveredRegions.has(region.id) || !['vocabulary_pair', 'vocabulary_list'].includes(region.kind));
  for (const region of unsupportedRegions) issue('excluded_region', 'warning', null, region.id);
  if (!input.sources.length || !input.regions.length) issue('missing_evidence', 'error');
  if (input.reliability.status !== 'sufficient') issue('reliability_unresolved', 'error');
  if (input.safety.status !== 'clear') issue(input.safety.status === 'blocked' ? 'safety_blocked' : 'safety_unknown', 'error');
  if (input.reliability.confidence == null) issue('unknown_reliability_confidence', 'info');
  if (input.safety.confidence == null) issue('unknown_safety_confidence', 'info');
  const suitability = !eligibleCandidateIds.length ? 'unsupported' : excludedCandidateIds.length || unsupportedRegions.length ? 'partial' : 'supported';
  return {
    schemaVersion: 1, capture: clone(input.capture), preparation: clone(input.preparation),
    suitability, reliability: clone(input.reliability), safety: clone(input.safety),
    ready: suitability !== 'unsupported' && input.reliability.status === 'sufficient' && input.safety.status === 'clear',
    eligibleCandidateIds, excludedCandidateIds, unsupportedRegions: clone(unsupportedRegions), issues,
    disclosure: { required: suitability === 'partial', excludedCandidateIds: [...excludedCandidateIds], regionIds: unsupportedRegions.map(region => region.id) },
  };
}

// Recompute rather than trusting producer-supplied readiness or eligible IDs.
// Still not a provenance signature: a future service must authenticate assessors.
function validatePreparationAssessment(input, assessment) {
  if (!validatePreparation(input).valid) return { valid: false, errors: ['invalid_preparation'] };
  function equal(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((value, index) => equal(value, b[index]));
    return object(a) && object(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => own(b, key) && equal(a[key], b[key]));
  }
  const valid = equal(assessPreparation(input), assessment);
  return { valid, errors: valid ? [] : ['assessment_mismatch'] };
}

module.exports = { validatePreparation, assessPreparation, validatePreparationAssessment };
