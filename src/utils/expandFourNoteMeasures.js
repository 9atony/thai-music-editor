import { getFlattenedCol } from './sheetUtils.js';

export const expandFourNoteMeasures = (sheetData, rowTypes, selectionRange) => {
  if (!selectionRange?.start || !selectionRange?.end || selectionRange.labelOnly) return sheetData;
    const { start: [sr, sm, sc], end: [er, em, ec] } = selectionRange;
    const minCol = Math.min(getFlattenedCol(sheetData[sr], rowTypes[sr], sm, sc), getFlattenedCol(sheetData[er], rowTypes[er], em, ec));
    const maxCol = Math.max(getFlattenedCol(sheetData[sr], rowTypes[sr], sm, sc), getFlattenedCol(sheetData[er], rowTypes[er], em, ec));
    let changed = false;
    const newData = sheetData.map((row, r) => {
      if (r < Math.min(sr, er) || r > Math.max(sr, er) || !['single', 'double-right', 'double-left'].includes(rowTypes[r])) return row;
      return row.map((measure, m) => {
        if ((rowTypes[r].startsWith('double') && m === 0) || measure.length !== 4 || measure.some(token => typeof token === 'string' && token.startsWith('@'))) return measure;
        const firstCol = getFlattenedCol(row, rowTypes[r], m, 0);
        const lastCol = getFlattenedCol(row, rowTypes[r], m, measure.length - 1);
        if (lastCol < minCol || firstCol > maxCol) return measure;
        changed = true;
        return [...measure, '-', '-', '-', '-'];
      });
    });
  return changed ? newData : sheetData;
};
