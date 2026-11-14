// Called only by genuine UI events (including accessibility activation), never by reads or rendering.
function parentInteraction(noteActivity, action) {
  return (...args) => {
    if (noteActivity() === false) return;
    return action(...args);
  };
}

function recordParentActivity(capability, { isCurrent, noteActivity, onLocked }) {
  if (!capability || !isCurrent(capability)) return false;
  try { noteActivity(capability); return true; }
  catch { onLocked(); return false; }
}

module.exports = { parentInteraction, recordParentActivity };
