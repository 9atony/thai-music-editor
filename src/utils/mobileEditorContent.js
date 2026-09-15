export const escapeMobileTextRowHtml = (value = '') => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')
  .replace(/\r?\n/g, '<br>');

export const resolveMobileTextRowHtml = ({ originalHtml = '', originalPlainText = '', draft = '' }) => (
  String(draft) === String(originalPlainText)
    ? String(originalHtml)
    : escapeMobileTextRowHtml(draft)
);
