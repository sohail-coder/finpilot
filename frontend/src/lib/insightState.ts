// Lightweight in-memory flag to track when transaction data has changed,
// so credit-card / AI insights know they need a refresh.
let _dirty = false;

export const insightState = {
  markDirty: () => { _dirty = true; },
  isDirty: () => _dirty,
  clear: () => { _dirty = false; },
};
