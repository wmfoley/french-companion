const kinds = new Set(['action_enlarge', 'action_fit', 'js_dimensions', 'scroll',
  'viewport_layout', 'content_size', 'image_layout', 'image_load', 'image_error']);
const fields = ['x', 'y', 'viewportWidth', 'viewportHeight', 'contentWidth', 'contentHeight',
  'imageWidth', 'imageHeight'];

// Memory only. Never retain native events, source objects, error text or file identifiers.
function createPreviewDiagnostics(enabled, clock = () => performance.now()) {
  const start = clock();
  let sequence = 0;
  const events = [];
  return {
    record(kind, page, mode, metrics = {}) {
      if (!enabled || !kinds.has(kind) || !Number.isSafeInteger(page) || page < 1 ||
          page > 1000 || !['fit', 'enlarge'].includes(mode)) return;
      const event = { sequence: ++sequence, ms: Math.max(0, Math.round(clock() - start)),
        page, jsMode: mode, kind };
      for (const field of fields) {
        const value = metrics[field];
        if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000000) {
          event[field] = Math.round(value * 10) / 10;
        }
      }
      events.push(event);
      if (events.length > 200) events.shift();
    },
    snapshot() { return events.map(event => ({ ...event })); },
    clear() { events.length = 0; },
  };
}

function summarizePreviewDiagnostics(events) {
  if (!events.length) return 'No preview events recorded.';
  const summaries = [...new Set(events.map(e => e.page))].map(page => {
    const own = events.filter(e => e.page === page);
    const requested = own.filter(e => e.kind === 'js_dimensions').at(-1);
    const scroll = own.filter(e => e.kind === 'scroll').at(-1);
    const layout = own.filter(e => e.kind === 'image_layout').at(-1);
    const load = own.filter(e => e.kind === 'image_load' || e.kind === 'image_error').at(-1);
    const fitted = requested?.jsMode === 'fit' && scroll?.jsMode === 'fit' && scroll.sequence > requested.sequence;
    let status = 'No post-Fit native scroll sample; offset cause undetermined.';
    if (fitted && [scroll.x, scroll.y, scroll.contentWidth, scroll.contentHeight,
      scroll.viewportWidth, scroll.viewportHeight].every(Number.isFinite)) {
      const outside = scroll.x < -1 || scroll.y < -1 ||
        scroll.x > Math.max(0, scroll.contentWidth - scroll.viewportWidth) + 1 ||
        scroll.y > Math.max(0, scroll.contentHeight - scroll.viewportHeight) + 1;
      status = outside ? 'Native-reported fitted offset outside reported bounds.' :
        'Native-reported fitted offset within bounds; this does not prove image visibility.';
    }
    return `P${page}: requested ${requested?.jsMode ?? 'unknown'}; image layout ${layout ? `${layout.imageWidth}x${layout.imageHeight} at +${layout.ms}ms (JS:${layout.jsMode})` : 'unobserved'}; ${load?.kind ?? 'load unobserved'}. ${status}`;
  });
  const timeline = events.slice(-40).map(e => {
    const values = fields.filter(field => e[field] !== undefined).map(field => `${field}=${e[field]}`).join(' ');
    return `#${e.sequence} +${e.ms}ms P${e.page} JS:${e.jsMode} ${e.kind} ${values}`.trim();
  }).join('\n');
  return `${summaries.join('\n')}\nRecent events:\n${timeline}`;
}

module.exports = { createPreviewDiagnostics, summarizePreviewDiagnostics };
