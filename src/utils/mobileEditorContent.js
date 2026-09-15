export const escapeMobileTextRowHtml = (value = '') => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')
  .replace(/\r?\n/g, '<br>');

export const escapeMobileLabel = (value = '') => escapeMobileTextRowHtml(value).replaceAll('<br>', ' ');

export const resolveMobileTextRowHtml = ({ originalHtml = '', originalPlainText = '', draft = '' }) => (
  String(draft) === String(originalPlainText)
    ? String(originalHtml)
    : escapeMobileTextRowHtml(draft)
);

export const getMobileTextTarget = ({ rowType, row, measureIndex = 0 }) => {
  if (rowType === 'text') {
    return { kind: 'row', html: String(row?.[0]?.[0] ?? '') };
  }

  const measure = row?.[measureIndex];
  if (!Array.isArray(measure)) return null;
  const marker = measure[0];
  if (typeof marker === 'string' && marker.startsWith('@TEXT_SPAN_')) {
    return { kind: rowType === 'annotation' ? 'annotation' : 'measure', html: String(measure[1] ?? '') };
  }
  if (rowType === 'annotation' && marker !== '@HIDDEN') {
    return { kind: 'annotation', html: marker === '-' ? '' : String(marker ?? '') };
  }
  return null;
};
