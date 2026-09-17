const COMPANION_ROW_TYPES = new Set(['annotation', 'nathap']);

export const getSheetRowBorderVisibility = ({
  rowType,
  previousRowType,
  nextRowType,
} = {}) => {
  const isCompanion = COMPANION_ROW_TYPES.has(rowType);

  return {
    top: !isCompanion
      || previousRowType == null
      || COMPANION_ROW_TYPES.has(previousRowType),
    bottom: rowType !== 'double-right'
      && !(isCompanion && COMPANION_ROW_TYPES.has(nextRowType)),
  };
};
