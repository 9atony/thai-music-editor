import { MAIN_STAFF_MEASURE_COUNT } from './sheetPagination.js';
import { hasNathapLeadingLabel } from './sheetUtils.js';

const MAIN_ROW_TYPES = new Set(['single', 'double-right']);
const COMPANION_ROW_TYPES = new Set(['annotation', 'nathap']);
const EMPTY_MARGIN = Object.freeze({ top: 0, bottom: 0, left: 0 });

const cloneSheetData = (sheetData) => sheetData.map((row) => (
  Array.isArray(row) ? row.map((measure) => [...measure]) : row
));

const getMeasureOffset = (row, rowType) => (
  rowType?.startsWith('double') || hasNathapLeadingLabel(row, rowType) ? 1 : 0
);

const splitRowAtCapacity = (row, rowType, capacity) => {
  const offset = getMeasureOffset(row, rowType);
  const label = offset === 1 ? row[0] : null;
  const measures = row.slice(offset);
  const chunks = [];

  for (let index = 0; index < measures.length; index += capacity) {
    const chunk = measures.slice(index, index + capacity);
    chunks.push(offset === 1 ? [[...label], ...chunk] : chunk);
  }

  if (chunks.length === 0) {
    chunks.push(offset === 1 ? [[...label]] : []);
  }
  return { chunks, offset };
};

const remapSectionLabels = (sectionLabels, insertionVisualIndex, insertedVisualRows) => {
  if (insertedVisualRows === 0) return { ...sectionLabels };

  const sourceVisualIndex = insertionVisualIndex - 1;
  const remapped = {};
  Object.entries(sectionLabels).forEach(([key, labels]) => {
    const visualIndex = Number(key);
    if (visualIndex === sourceVisualIndex) {
      const topLabels = labels.filter((label) => !label.position?.includes('bottom'));
      const bottomLabels = labels.filter((label) => label.position?.includes('bottom'));
      if (topLabels.length > 0) remapped[visualIndex] = topLabels;
      if (bottomLabels.length > 0) remapped[visualIndex + insertedVisualRows] = bottomLabels;
      return;
    }
    const nextIndex = visualIndex >= insertionVisualIndex
      ? visualIndex + insertedVisualRows
      : visualIndex;
    remapped[nextIndex] = labels;
  });
  return remapped;
};

const positionToArray = (position) => [position.row, position.measure, position.cell];

/**
 * Inserts one blank measure and normalizes only the affected staff group so a
 * logical row never exceeds the fixed editor line capacity. Existing projects
 * are otherwise left untouched until the user performs this edit.
 */
export const insertMeasureWithLogicalRowSplit = ({
  sheetData = [],
  rowTypes = [],
  rowMargins = [],
  sectionLabels = {},
  symbols = [],
  targetCell,
  capacity = MAIN_STAFF_MEASURE_COUNT
}) => {
  if (!Array.isArray(targetCell) || !Number.isInteger(targetCell[0])) return null;
  if (!Number.isInteger(capacity) || capacity < 1) return null;

  const [requestedRowIndex, requestedMeasureIndex = 0] = targetCell;
  if (!sheetData[requestedRowIndex] || ['page-break', 'text'].includes(rowTypes[requestedRowIndex])) return null;

  let parentRowIndex = requestedRowIndex;
  while (parentRowIndex >= 0 && ['annotation', 'nathap', 'text'].includes(rowTypes[parentRowIndex])) {
    parentRowIndex -= 1;
  }
  if (rowTypes[parentRowIndex] === 'double-left') parentRowIndex -= 1;
  if (parentRowIndex < 0 || !MAIN_ROW_TYPES.has(rowTypes[parentRowIndex])) return null;

  const parentType = rowTypes[parentRowIndex];
  const isDouble = parentType === 'double-right';
  const firstCompanionIndex = parentRowIndex + (isDouble ? 2 : 1);
  let groupEndIndex = firstCompanionIndex;
  while (groupEndIndex < rowTypes.length && COMPANION_ROW_TYPES.has(rowTypes[groupEndIndex])) {
    groupEndIndex += 1;
  }

  const nextSheetData = cloneSheetData(sheetData);
  const nextRowTypes = [...rowTypes];
  const nextRowMargins = rowMargins.map((margin) => ({ ...(margin || EMPTY_MARGIN) }));
  while (nextRowMargins.length < sheetData.length) nextRowMargins.push({ ...EMPTY_MARGIN });

  const affectedRowIndices = [parentRowIndex];
  if (isDouble) affectedRowIndices.push(parentRowIndex + 1);
  for (let rowIndex = firstCompanionIndex; rowIndex < groupEndIndex; rowIndex += 1) {
    if (rowTypes[rowIndex] === 'nathap') affectedRowIndices.push(rowIndex);
  }

  const parentOffset = getMeasureOffset(nextSheetData[parentRowIndex], parentType);
  const parentLength = nextSheetData[parentRowIndex].length;
  const insertIndex = Math.min(
    parentLength,
    Math.max(parentOffset, Number(requestedMeasureIndex) + 1)
  );
  const insertIndexBySourceRow = new Map();
  affectedRowIndices.forEach((rowIndex) => {
    const row = nextSheetData[rowIndex];
    if (!Array.isArray(row)) return;
    const rowInsertIndex = Math.min(insertIndex, row.length);
    insertIndexBySourceRow.set(rowIndex, rowInsertIndex);
    row.splice(rowInsertIndex, 0, Array(4).fill('-'));
  });

  const splitBySourceRow = new Map();
  affectedRowIndices.forEach((rowIndex) => {
    splitBySourceRow.set(
      rowIndex,
      splitRowAtCapacity(nextSheetData[rowIndex], rowTypes[rowIndex], capacity)
    );
  });

  const mainChunkCount = splitBySourceRow.get(parentRowIndex).chunks.length;
  if (
    (isDouble && splitBySourceRow.get(parentRowIndex + 1).chunks.length !== mainChunkCount)
    || affectedRowIndices.some((rowIndex) => (
      rowTypes[rowIndex] === 'nathap'
      && splitBySourceRow.get(rowIndex).chunks.length > mainChunkCount
    ))
  ) {
    return null;
  }
  affectedRowIndices.forEach((rowIndex) => {
    nextSheetData[rowIndex] = splitBySourceRow.get(rowIndex).chunks[0];
    if (mainChunkCount > 1) {
      nextRowMargins[rowIndex] = { ...nextRowMargins[rowIndex], bottom: 0 };
    }
  });

  const continuationRows = [];
  const continuationTypes = [];
  const continuationMargins = [];
  const outputRowsBySource = new Map(affectedRowIndices.map((rowIndex) => [rowIndex, [rowIndex]]));

  for (let chunkIndex = 1; chunkIndex < mainChunkCount; chunkIndex += 1) {
    const appendContinuation = (sourceRowIndex) => {
      const split = splitBySourceRow.get(sourceRowIndex);
      if (!split?.chunks[chunkIndex]) return;
      const nextRowIndex = groupEndIndex + continuationRows.length;
      continuationRows.push(split.chunks[chunkIndex]);
      continuationTypes.push(rowTypes[sourceRowIndex]);
      const sourceMargin = rowMargins[sourceRowIndex] || EMPTY_MARGIN;
      continuationMargins.push({
        top: 0,
        bottom: chunkIndex === split.chunks.length - 1 ? (sourceMargin.bottom || 0) : 0,
        left: sourceMargin.left || 0
      });
      outputRowsBySource.get(sourceRowIndex).push(nextRowIndex);
    };

    appendContinuation(parentRowIndex);
    if (isDouble) appendContinuation(parentRowIndex + 1);
    affectedRowIndices
      .filter((rowIndex) => rowTypes[rowIndex] === 'nathap')
      .forEach(appendContinuation);
  }

  nextSheetData.splice(groupEndIndex, 0, ...continuationRows);
  nextRowTypes.splice(groupEndIndex, 0, ...continuationTypes);
  nextRowMargins.splice(groupEndIndex, 0, ...continuationMargins);

  const rowIndexMap = new Map(sheetData.map((_, rowIndex) => [
    rowIndex,
    rowIndex < groupEndIndex ? rowIndex : rowIndex + continuationRows.length
  ]));

  const mapPosition = (position) => {
    const sourceRow = Number(position?.row);
    const sourceMeasure = Number(position?.measure);
    const sourceCell = Number(position?.cell) || 0;
    const split = splitBySourceRow.get(sourceRow);

    if (!split || sourceMeasure < split.offset) {
      return {
        ...position,
        row: rowIndexMap.get(sourceRow) ?? sourceRow,
        measure: sourceMeasure,
        cell: sourceCell
      };
    }

    const sourceInsertIndex = insertIndexBySourceRow.get(sourceRow);
    const shiftedMeasure = sourceMeasure >= sourceInsertIndex ? sourceMeasure + 1 : sourceMeasure;
    const logicalMeasure = shiftedMeasure - split.offset;
    const chunkIndex = Math.floor(logicalMeasure / capacity);
    const outputRows = outputRowsBySource.get(sourceRow);
    return {
      ...position,
      row: outputRows[chunkIndex],
      measure: split.offset + (logicalMeasure % capacity),
      cell: sourceCell
    };
  };

  const nextSymbols = symbols.map((symbol) => ({
    ...symbol,
    start: positionToArray(mapPosition({
      row: symbol.start[0],
      measure: symbol.start[1],
      cell: symbol.start[2]
    })),
    end: positionToArray(mapPosition({
      row: symbol.end[0],
      measure: symbol.end[1],
      cell: symbol.end[2]
    }))
  }));

  let insertionVisualIndex = 0;
  for (let rowIndex = 0; rowIndex < groupEndIndex; rowIndex += 1) {
    if (MAIN_ROW_TYPES.has(rowTypes[rowIndex])) insertionVisualIndex += 1;
  }
  const insertedVisualRows = Math.max(0, mainChunkCount - 1);

  const requestedSourceRow = affectedRowIndices.includes(requestedRowIndex)
    ? requestedRowIndex
    : parentRowIndex;
  const requestedSplit = splitBySourceRow.get(requestedSourceRow);
  const requestedInsertIndex = insertIndexBySourceRow.get(requestedSourceRow);
  const insertedLogicalMeasure = requestedInsertIndex - requestedSplit.offset;
  const insertedChunkIndex = Math.floor(insertedLogicalMeasure / capacity);
  const selectedCell = [
    outputRowsBySource.get(requestedSourceRow)[insertedChunkIndex],
    requestedSplit.offset + (insertedLogicalMeasure % capacity),
    0
  ];

  return {
    sheetData: nextSheetData,
    rowTypes: nextRowTypes,
    rowMargins: nextRowMargins,
    sectionLabels: remapSectionLabels(sectionLabels, insertionVisualIndex, insertedVisualRows),
    symbols: nextSymbols,
    rowIndexMap,
    mapPosition,
    selectedCell,
    insertedVisualRows,
    insertedPhysicalRows: continuationRows.length
  };
};
