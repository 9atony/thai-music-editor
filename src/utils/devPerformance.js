const DEV_ENABLED = Boolean(import.meta.env?.DEV);
const counters = new Map();
let editorOpenMeasurement = null;

const now = () => globalThis.performance?.now?.() ?? Date.now();

export const startDevTiming = (name, details = {}) => {
  if (!DEV_ENABLED) return () => {};
  const startedAt = now();
  return (result = {}) => {
    const durationMs = Number((now() - startedAt).toFixed(1));
    console.debug(`[perf] ${name}`, { durationMs, ...details, ...result });
  };
};

export const countDevEvent = (name, amount = 1, details = {}) => {
  if (!DEV_ENABLED) return;
  const count = (counters.get(name) || 0) + amount;
  counters.set(name, count);
  console.debug(`[perf] ${name}`, { count, amount, ...details });
};

export const recordFirestoreRead = (request, documentCount) => {
  countDevEvent('firestore.requests', 1, { request });
  countDevEvent('firestore.documentsRead', documentCount, { request, documentCount });
};

export const markEditorOpenStart = (details = {}) => {
  if (!DEV_ENABLED) return;
  editorOpenMeasurement = { startedAt: now(), details };
};

export const markEditorUsable = (editor) => {
  if (!DEV_ENABLED || typeof requestAnimationFrame !== 'function') return () => {};
  const startedAt = editorOpenMeasurement?.startedAt ?? now();
  const details = editorOpenMeasurement?.details || {};
  let secondFrame = 0;
  const firstFrame = requestAnimationFrame(() => {
    secondFrame = requestAnimationFrame(() => {
      console.debug('[perf] editor.firstUsablePaint', {
        durationMs: Number((now() - startedAt).toFixed(1)),
        editor,
        ...details
      });
      editorOpenMeasurement = null;
    });
  });
  return () => {
    cancelAnimationFrame(firstFrame);
    if (secondFrame) cancelAnimationFrame(secondFrame);
  };
};
