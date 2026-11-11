// Focus and operation identity prevent an old async task from changing a new screen visit.
function createParentOperations() {
  let focus = 0; let operation = 0; let active = false; let running = null;
  return {
    enter() { active = true; return ++focus; },
    leave() { active = false; focus++; running = null; },
    invalidate() { focus++; running = null; },
    isFocus(id) { return active && id === focus; },
    focusId() { return focus; },
    begin() {
      if (!active || running) return null;
      running = { focus, operation: ++operation };
      return running;
    },
    isCurrent(token) { return active && running === token && token.focus === focus; },
    finish(token) {
      if (!active || running !== token || token.focus !== focus) return false;
      running = null; return true;
    },
  };
}
module.exports = { createParentOperations };
