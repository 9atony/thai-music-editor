const TEXT_MEASURE_EDITOR_SELECTOR = '[data-text-measure-editor="true"]';

const isValidPendingTextMeasureSelection = (pending) => (
  pending !== null
  && typeof pending === 'object'
  && Number.isInteger(pending.rowIndex)
  && Number.isInteger(pending.measureIndex)
);

const isMouseUpForPendingEditor = (pending, target) => {
  if (!isValidPendingTextMeasureSelection(pending)) return false;
  if (!target || typeof target.closest !== 'function') return false;

  const editor = target.closest(TEXT_MEASURE_EDITOR_SELECTOR);
  return editor?.dataset.rowIndex === String(pending.rowIndex)
    && editor?.dataset.measureIndex === String(pending.measureIndex);
};

/**
 * Creates the capture-phase handler that closes an in-progress Sheet selection.
 * A mouseup in the same text editor is deferred to that editor's React handler;
 * every other mouseup safely ends the global selection session.
 */
export const createSheetMouseUpHandler = ({
  getPendingInteraction,
  clearPendingInteraction,
  endSelection
}) => (event) => {
  const pending = getPendingInteraction();

  if (isMouseUpForPendingEditor(pending, event?.target)) return false;

  if (pending !== null && pending !== undefined) {
    clearPendingInteraction();
  }
  if (endSelection) endSelection();
  return true;
};

/** Register the global end events once and return an idempotent cleanup. */
export const registerSheetMouseUpListeners = (eventTarget, handler) => {
  eventTarget.addEventListener('mouseup', handler, true);
  eventTarget.addEventListener('pointerup', handler, true);
  eventTarget.addEventListener('pointercancel', handler, true);
  eventTarget.addEventListener('blur', handler);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    eventTarget.removeEventListener('mouseup', handler, true);
    eventTarget.removeEventListener('pointerup', handler, true);
    eventTarget.removeEventListener('pointercancel', handler, true);
    eventTarget.removeEventListener('blur', handler);
  };
};
