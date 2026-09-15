export const CUSTOM_KEYBOARD_FEATURE_ID = 'custom-keyboard';
export const CUSTOM_KEYBOARD_MAX_KEYS = 20;
export const CUSTOM_KEYBOARD_MAX_LABEL_LENGTH = 24;
export const CUSTOM_CELL_MAX_LENGTH = 96;

const CUSTOM_TOKEN_PREFIX = '@TME_CUSTOM:';

export const normalizeCustomText = (value, maxLength = CUSTOM_KEYBOARD_MAX_LABEL_LENGTH) => (
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
);

export const encodeCustomCellToken = (value) => {
  const text = normalizeCustomText(value, CUSTOM_CELL_MAX_LENGTH);
  return text ? `${CUSTOM_TOKEN_PREFIX}${encodeURIComponent(text)}` : '-';
};

export const decodeCustomCellToken = (value) => {
  if (typeof value !== 'string' || !value.startsWith(CUSTOM_TOKEN_PREFIX)) return null;
  try {
    return normalizeCustomText(
      decodeURIComponent(value.slice(CUSTOM_TOKEN_PREFIX.length)),
      CUSTOM_CELL_MAX_LENGTH,
    );
  } catch {
    return '';
  }
};

export const isCustomCellToken = (value) => decodeCustomCellToken(value) !== null;

export const getCellDisplayText = (value) => decodeCustomCellToken(value) ?? value;

export const normalizeCustomKeyboardKeys = (keys) => {
  if (!Array.isArray(keys)) return [];
  const seenIds = new Set();

  return keys.flatMap((key, index) => {
    const label = normalizeCustomText(typeof key === 'string' ? key : key?.label);
    if (!label) return [];
    let id = normalizeCustomText(typeof key === 'object' ? key?.id : '', 80)
      .replace(/[^A-Za-z0-9_-]/g, '');
    if (!id || seenIds.has(id)) id = `custom-${index + 1}`;
    while (seenIds.has(id)) id = `${id}-${index + 1}`;
    seenIds.add(id);
    return [{ id, label }];
  }).slice(0, CUSTOM_KEYBOARD_MAX_KEYS);
};
