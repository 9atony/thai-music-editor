import { hasNathapLeadingLabel } from './sheetUtils.js';

export const A4_HEIGHT_PX = 1122.5197;
export const PRINT_FOOTER_SPACE_PX = 1.5 * 37.795275;
export const MAIN_STAFF_MEASURE_COUNT = 8;

const COMPANION_TYPES = new Set(['annotation', 'nathap']);

const numberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getMargins = (rowMargins, index) => ({
  top: numberOr(rowMargins?.[index]?.top),
  bottom: numberOr(rowMargins?.[index]?.bottom)
});

export const getMarginPx = (value, unit = 'px') => {
  const numericValue = numberOr(value);
  if (unit === 'cm') return numericValue * 37.795275;
  if (unit === 'in') return numericValue * 96;
  return numericValue;
};

export const areMeasurementsEquivalent = (left = {}, right = {}, threshold = 0.5) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => (
      Object.hasOwn(right, key)
      && Math.abs(numberOr(left[key]) - numberOr(right[key])) < threshold
    ));
};

export const getLogicalElementHeight = ({
  rectWidth,
  rectHeight,
  offsetWidth,
  marginTop = 0,
  marginBottom = 0
}) => {
  const scale = numberOr(offsetWidth) > 0 ? numberOr(rectWidth) / numberOr(offsetWidth) : 1;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return (numberOr(rectHeight) / safeScale) + numberOr(marginTop) + numberOr(marginBottom);
};

export const getPageAssignmentKey = (pages = []) => pages
  .map((page) => (page.rowIndices || []).join(','))
  .join('|');

export const waitForFonts = (fontSet) => {
  try {
    return Promise.resolve(fontSet?.ready).catch(() => undefined);
  } catch {
    return Promise.resolve();
  }
};

export const getMeasureCountForRowType = (row = [], rowType = '') => {
  if (!Array.isArray(row)) return 0;
  if (rowType && (rowType.startsWith('double') || hasNathapLeadingLabel(row, rowType))) {
    return Math.max(0, row.length - 1);
  }
  return row.length;
};

const getVisualLines = (row, rowType) => Math.max(
  1,
  Math.ceil(getMeasureCountForRowType(row, rowType) / MAIN_STAFF_MEASURE_COUNT)
);

const getTextHtml = (row) => (
  row && row[0] && typeof row[0][0] === 'string' ? row[0][0] : ''
);

export const estimateTextLineCount = (html, approximateCharactersPerLine = 82) => {
  const value = String(html || '');
  const explicitBreaks = (value.match(/<br\s*\/?>/gi) || []).length;
  const blocks = value.match(/<(?:div|p)(?:\s[^>]*)?>[\s\S]*?<\/(?:div|p)>/gi) || [];
  const blockLines = blocks.reduce((total, block) => {
    const innerBreaks = (block.match(/<br\s*\/?>/gi) || []).length;
    const text = block
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ');
    const wrappedLines = text.split('\n').reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(line.length / approximateCharactersPerLine)),
      0
    );
    return total + Math.max(innerBreaks + 1, wrappedLines);
  }, 0);

  if (blocks.length > 0) return Math.max(1, blockLines);

  const plainText = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ');
  const wrappedLines = plainText.split('\n').reduce(
    (sum, line) => sum + Math.max(1, Math.ceil(line.length / approximateCharactersPerLine)),
    0
  );
  return Math.max(1, explicitBreaks + 1, wrappedLines);
};

export const estimateHeaderHeight = ({ layoutConfig = {}, headerDetails = [] } = {}) => {
  const songNameSize = numberOr(layoutConfig.songNameSize, 48);
  const authorSize = numberOr(layoutConfig.authorSize, 16);
  const detailsRows = layoutConfig.detailsAlign === 'between'
    ? Math.ceil(headerDetails.length / 2)
    : headerDetails.length;
  const titleHeight = songNameSize * 1.5;
  const titleBottomMargin = headerDetails.length > 0 ? 8 : 0;
  const detailsHeight = detailsRows > 0
    ? (detailsRows * authorSize * 1.2) + (Math.max(0, detailsRows - 1) * 4)
    : 0;

  // Header padding, its 2px border, and mb-3 are all outside the title/details.
  return titleHeight
    + titleBottomMargin
    + detailsHeight
    + numberOr(layoutConfig.headerBottomSpacing, 8)
    + 2
    + 12;
};

const getLabelExtents = (labels = []) => labels.reduce((extents, label) => {
  if (!label || !String(label.text || '').replace(/<[^>]*>/g, '').trim()) return extents;
  const height = numberOr(label.fontSize, 18);
  const offset = Math.abs(numberOr(label.offsetY, 6));
  if (String(label.position || '').includes('top')) {
    extents.top = Math.max(extents.top, height + offset);
  } else {
    extents.bottom = Math.max(extents.bottom, height + offset);
  }
  return extents;
}, { top: 0, bottom: 0 });

export const buildLogicalBlocks = ({ sheetData = [], rowTypes = [], sectionLabels = {} } = {}) => {
  const blocks = [];
  let visualIndex = 0;
  let index = 0;

  while (index < sheetData.length) {
    const rowType = rowTypes[index] || 'single';

    if (rowType === 'page-break') {
      blocks.push({
        id: `page-break-${index}`,
        kind: 'page-break',
        manualBreak: true,
        rowIndices: [index],
        segments: [{ kind: 'page-break', rowIndices: [index], startIndex: index }]
      });
      index += 1;
      continue;
    }

    if (rowType === 'text') {
      blocks.push({
        id: `text-${index}`,
        kind: 'text',
        rowIndices: [index],
        segments: [{ kind: 'text', rowIndices: [index], startIndex: index }]
      });
      index += 1;
      continue;
    }

    const isMainStaff = rowType === 'single' || rowType === 'double-right';
    const blockVisualIndex = isMainStaff ? visualIndex : null;
    const mainRowIndices = [index];
    let cursor = index + 1;

    if (rowType === 'double-right' && rowTypes[cursor] === 'double-left') {
      mainRowIndices.push(cursor);
      cursor += 1;
    }

    const segments = [{
      kind: mainRowIndices.length === 2 ? 'double-pair' : rowType,
      rowIndices: mainRowIndices,
      startIndex: index,
      visualIndex: blockVisualIndex,
      labels: blockVisualIndex === null ? [] : (sectionLabels?.[blockVisualIndex] || [])
    }];

    if (isMainStaff) {
      while (cursor < sheetData.length && COMPANION_TYPES.has(rowTypes[cursor])) {
        segments.push({
          kind: rowTypes[cursor],
          rowIndices: [cursor],
          startIndex: cursor
        });
        cursor += 1;
      }
      visualIndex += 1;
    }

    const rowIndices = segments.flatMap((segment) => segment.rowIndices);
    blocks.push({
      id: `staff-${index}-${rowIndices[rowIndices.length - 1]}`,
      kind: isMainStaff ? 'staff-group' : rowType,
      visualIndex: blockVisualIndex,
      rowIndices,
      segments
    });
    index = cursor;
  }

  return blocks;
};

const calculateSegmentHeight = (segment, context) => {
  const {
    sheetData,
    rowTypes,
    rowMargins,
    layoutConfig,
    measuredRowHeights
  } = context;
  const measuredHeight = numberOr(measuredRowHeights?.[segment.startIndex], NaN);
  if (Number.isFinite(measuredHeight) && measuredHeight >= 0) return measuredHeight;

  const measureHeight = numberOr(layoutConfig.measureHeight, 48);
  const rowGap = numberOr(layoutConfig.rowGap, 20);
  const index = segment.startIndex;
  const row = sheetData[index] || [];
  const rowType = rowTypes[index] || segment.kind;

  if (segment.kind === 'page-break') return 0;

  if (segment.kind === 'text') {
    const margins = getMargins(rowMargins, index);
    const lineHeight = Math.max(
      20,
      numberOr(layoutConfig.textFontSize, 16) * numberOr(layoutConfig.textLineHeight, 1.5)
    );
    return Math.max(24, lineHeight * estimateTextLineCount(getTextHtml(row)))
      + margins.top
      + margins.bottom;
  }

  if (segment.kind === 'double-pair') {
    const leftIndex = segment.rowIndices[1];
    const leftRow = sheetData[leftIndex] || [];
    const chunks = Math.max(getVisualLines(row, rowType), getVisualLines(leftRow, rowTypes[leftIndex]));
    const nextType = rowTypes[leftIndex + 1];
    const paddingBottom = COMPANION_TYPES.has(nextType) ? 0 : rowGap;
    const rightMargins = getMargins(rowMargins, index);
    const leftMargins = getMargins(rowMargins, leftIndex);
    const labelExtents = getLabelExtents(segment.labels);

    // The DOM renders right+left inside each chunk and only one gap between chunks.
    return (chunks * measureHeight * 2)
      + (Math.max(0, chunks - 1) * rowGap)
      + paddingBottom
      + rightMargins.top
      + leftMargins.bottom
      + labelExtents.top
      + labelExtents.bottom;
  }

  if (rowType === 'double-left') return 0;

  const lines = getVisualLines(row, rowType);
  const rowHeight = COMPANION_TYPES.has(rowType) ? measureHeight * 0.75 : measureHeight;
  const nextType = rowTypes[index + 1];
  const paddingBottom = COMPANION_TYPES.has(nextType) ? 0 : rowGap;
  const margins = getMargins(rowMargins, index);
  const labelExtents = getLabelExtents(segment.labels);

  return (lines * rowHeight)
    + (Math.max(0, lines - 1) * rowGap)
    + paddingBottom
    + margins.top
    + margins.bottom
    + labelExtents.top
    + labelExtents.bottom;
};

export const calculateBlockHeight = (block, context) => {
  const segments = block.segments.map((segment) => ({
    ...segment,
    height: calculateSegmentHeight(segment, context)
  }));
  return {
    ...block,
    segments,
    height: segments.reduce((sum, segment) => sum + segment.height, 0)
  };
};

const pageHasContent = (page) => page.rowIndices.length > 0;

export const paginateBlocks = ({ blocks = [], sheetData = [], getPageCapacity }) => {
  const pages = [];
  let current = { rowIndices: [], usedHeight: 0, logicalBlockIds: [] };

  const capacity = () => Math.max(0, numberOr(getPageCapacity(pages.length), 0));
  const flush = () => {
    if (!pageHasContent(current)) return;
    const rowIndices = current.rowIndices;
    pages.push({
      rows: rowIndices.map((index) => sheetData[index]),
      startIndex: rowIndices[0],
      rowIndices: [...rowIndices],
      usedHeight: current.usedHeight,
      logicalBlockIds: [...current.logicalBlockIds]
    });
    current = { rowIndices: [], usedHeight: 0, logicalBlockIds: [] };
  };

  const append = (rowIndices, height, blockId) => {
    current.rowIndices.push(...rowIndices);
    current.usedHeight += height;
    if (!current.logicalBlockIds.includes(blockId)) current.logicalBlockIds.push(blockId);
  };

  for (const block of blocks) {
    if (block.manualBreak) {
      flush();
      append(block.rowIndices, 0, block.id);
      continue;
    }

    const remaining = capacity() - current.usedHeight;
    if (block.height <= remaining) {
      append(block.rowIndices, block.height, block.id);
      continue;
    }

    if (pageHasContent(current) && current.usedHeight > 0) flush();

    if (block.height <= capacity()) {
      append(block.rowIndices, block.height, block.id);
      continue;
    }

    // Only oversized logical blocks are split. Segments keep double pairs atomic
    // and provide a deterministic boundary between a staff and its companions.
    for (const segment of block.segments) {
      if (
        segment.height > capacity() - current.usedHeight
        && pageHasContent(current)
        && current.usedHeight > 0
      ) flush();
      append(segment.rowIndices, segment.height, block.id);
      if (current.usedHeight >= capacity()) flush();
    }
  }

  flush();
  return pages;
};

export const paginateSheet = ({
  sheetData = [],
  rowTypes = [],
  rowMargins = [],
  sectionLabels = {},
  layoutConfig = {},
  headerDetails = [],
  measuredHeaderHeight,
  measuredRowHeights = {},
  pageHeight = A4_HEIGHT_PX,
  footerSpace = PRINT_FOOTER_SPACE_PX
} = {}) => {
  const marginUnit = layoutConfig.marginUnit || 'px';
  const verticalPadding = getMarginPx(layoutConfig.marginTop ?? 48, marginUnit)
    + getMarginPx(layoutConfig.marginBottom ?? 48, marginUnit);
  const headerHeight = Number.isFinite(measuredHeaderHeight)
    ? measuredHeaderHeight
    : estimateHeaderHeight({ layoutConfig, headerDetails });
  const blocks = buildLogicalBlocks({ sheetData, rowTypes, sectionLabels })
    .map((block) => calculateBlockHeight(block, {
      sheetData,
      rowTypes,
      rowMargins,
      layoutConfig,
      measuredRowHeights
    }));

  return paginateBlocks({
    blocks,
    sheetData,
    getPageCapacity: (pageIndex) => pageHeight
      - verticalPadding
      - footerSpace
      - (pageIndex === 0 ? headerHeight : 0)
  });
};
