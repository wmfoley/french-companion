// Strict vocabulary only: this module never accepts credential values or exceptions.
const STAGES = new Set(['setup', 'randomness', 'pbkdf2', 'storage_queue', 'sqlite_init', 'sqlite_transaction', 'secure_read', 'secure_write', 'binding']);
const CATEGORIES = new Set(['cancelled', 'credential', 'storage', 'derivation', 'validation']);
const silent = { span: async (stage, action) => action(), finish() {} };
function createSetupDiagnostics({ enabled = false, emit = () => {}, now = Date.now, schedule = setTimeout, cancel = clearTimeout } = {}) {
  let sequence = 0;
  const events = []; const listeners = new Set();
  return {
    snapshot: () => events.map(event => ({ ...event })),
    subscribe(listener) { if (!enabled) return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
    start() {
      if (!enabled) return silent;
      const operation = ++sequence;
      const began = now();
      let current = 'setup'; let currentStart = began; let ended = false; let count = 0;
      function report(stage, event, started, category) {
        if (count++ >= 48) return;
        const safe = { operation, stage, event, elapsedMs: Math.max(0, Math.round(now() - began)),
          durationMs: Math.max(0, Math.round(now() - started)), ...(CATEGORIES.has(category) ? { category } : {}) };
        events.push(safe); if (events.length > 32) events.shift();
        try { emit({ ...safe }); } catch { /* Diagnostics cannot affect setup. */ }
        for (const listener of listeners) { try { listener(); } catch { /* Observers cannot affect setup. */ } }
      }
      report('setup', 'start', began);
      const timers = [10000, 30000, 60000].map(delay => schedule(() => {
        if (!ended) report(current, 'slow', currentStart);
      }, delay));
      return {
        async span(stage, action) {
          if (!STAGES.has(stage)) throw new Error('Unknown diagnostic stage.');
          const previous = current; const previousStart = currentStart;
          current = stage; currentStart = now(); const started = currentStart;
          report(stage, 'start', started);
          try { const result = await action(); report(stage, 'complete', started); return result; }
          catch (error) { report(stage, 'failure', started, ['randomness', 'pbkdf2'].includes(stage) ? 'derivation' : 'storage'); throw error; }
          finally { current = previous; currentStart = previousStart; }
        },
        finish(category) {
          if (ended) return;
          ended = true; timers.forEach(cancel);
          report('setup', category ? 'failure' : 'complete', began, category);
        },
      };
    },
  };
}
module.exports = { createSetupDiagnostics };
