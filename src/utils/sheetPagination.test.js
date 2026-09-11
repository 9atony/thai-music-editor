import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  areMeasurementsEquivalent,
  buildLogicalBlocks,
  calculateBlockHeight,
  estimateTextLineCount,
  getLogicalElementHeight,
  getPageAssignmentKey,
  paginateBlocks,
  paginateSheet,
  waitForFonts
} from './sheetPagination.js';

const fixturePath = new URL('../test/fixtures/pagination-regression.tme', import.meta.url);
const regressionProject = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const blankMeasure = () => ['-', '-', '-', '-'];
const staffRow = (measureCount = 8, label = null) => [
  ...(label === null ? [] : [[label]]),
  ...Array.from({ length: measureCount }, blankMeasure)
];

const paginationContext = (overrides = {}) => ({
  sheetData: [],
  rowTypes: [],
  rowMargins: [],
  layoutConfig: { measureHeight: 48, rowGap: 20, textFontSize: 16, textLineHeight: 1.5 },
  measuredRowHeights: {},
  ...overrides
});

const fixedBlock = (id, rowIndices, segmentHeights) => ({
  id,
  rowIndices,
  height: segmentHeights.reduce((sum, height) => sum + height, 0),
  segments: segmentHeights.map((height, index) => ({
    kind: 'segment',
    rowIndices: [rowIndices[index]],
    startIndex: rowIndices[index],
    height
  }))
});

const paginateFixed = (blocks, capacity = 100) => paginateBlocks({
  blocks,
  sheetData: Array.from({ length: 20 }, (_, index) => [`row-${index}`]),
  getPageCapacity: () => capacity
});

test('A: exact .tme regression fixture keeps the third double staff with all three nathap rows', () => {
  const originalProject = structuredClone(regressionProject);
  assert.equal(regressionProject.sheetData.length, 11);
  assert.deepEqual(regressionProject.rowTypes, [
    'double-right', 'double-left',
    'double-right', 'double-left',
    'double-right', 'double-left',
    'nathap', 'nathap', 'nathap',
    'double-right', 'double-left'
  ]);

  const blocks = buildLogicalBlocks(regressionProject);
  assert.deepEqual(blocks.map((block) => block.rowIndices), [
    [0, 1], [2, 3], [4, 5, 6, 7, 8], [9, 10]
  ]);

  const pages = paginateSheet(regressionProject);
  assert.deepEqual(pages.map((page) => page.rowIndices), [
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
    [9, 10]
  ]);
  assert.deepEqual(pages.map((page) => page.startIndex), [0, 9]);
  assert.deepEqual(regressionProject, originalProject);
});

test('B: a block ending exactly at the available height stays on the current page', () => {
  const pages = paginateFixed([
    fixedBlock('first', [0], [60]),
    fixedBlock('exact-tail', [1], [40])
  ]);
  assert.deepEqual(pages.map((page) => page.rowIndices), [[0, 1]]);
});

test('C: a block that is slightly too tall for the tail moves whole to the next page', () => {
  const pages = paginateFixed([
    fixedBlock('first', [0], [60.01]),
    fixedBlock('move-whole', [1, 2], [20, 20])
  ]);
  assert.deepEqual(pages.map((page) => page.rowIndices), [[0], [1, 2]]);
});

test('D: double-right and double-left form one indivisible segment with one inter-chunk gap', () => {
  const project = {
    sheetData: [staffRow(9, 'มือขวา'), staffRow(9, 'มือซ้าย')],
    rowTypes: ['double-right', 'double-left'],
    sectionLabels: {}
  };
  const [block] = buildLogicalBlocks(project);
  const calculated = calculateBlockHeight(block, paginationContext(project));

  assert.deepEqual(calculated.segments[0].rowIndices, [0, 1]);
  assert.equal(calculated.height, 212 + 20);
});

test('E: annotation and nathap companions are attached to their owning staff', () => {
  const project = {
    sheetData: [staffRow(), staffRow(), staffRow()],
    rowTypes: ['single', 'annotation', 'nathap'],
    sectionLabels: {}
  };
  const [block] = buildLogicalBlocks(project);
  assert.deepEqual(block.rowIndices, [0, 1, 2]);
  assert.deepEqual(block.segments.map((segment) => segment.kind), ['single', 'annotation', 'nathap']);
});

test('F: a section heading belongs to its staff block and contributes vertical extent', () => {
  const base = {
    sheetData: [staffRow()],
    rowTypes: ['single'],
    sectionLabels: {}
  };
  const labelled = {
    ...base,
    sectionLabels: { 0: [{ id: 'heading', text: 'ขึ้นต้น', position: 'top-left', fontSize: 20, offsetY: 7 }] }
  };
  const plainHeight = calculateBlockHeight(buildLogicalBlocks(base)[0], paginationContext(base)).height;
  const labelledBlock = buildLogicalBlocks(labelled)[0];
  const labelledHeight = calculateBlockHeight(labelledBlock, paginationContext(labelled)).height;

  assert.equal(labelledBlock.visualIndex, 0);
  assert.equal(labelledBlock.segments[0].labels[0].id, 'heading');
  assert.equal(labelledHeight - plainHeight, 27);
});

test('G: an oversized block splits deterministically between segments, never inside a double pair', () => {
  const oversized = {
    id: 'oversized',
    rowIndices: [0, 1, 2],
    height: 120,
    segments: [
      { kind: 'double-pair', rowIndices: [0, 1], startIndex: 0, height: 70 },
      { kind: 'nathap', rowIndices: [2], startIndex: 2, height: 50 }
    ]
  };
  const pages = paginateFixed([oversized]);
  assert.deepEqual(pages.map((page) => page.rowIndices), [[0, 1], [2]]);

  const tallerThanPage = paginateFixed([fixedBlock('one-huge-segment', [0], [120])]);
  assert.deepEqual(tallerThanPage.map((page) => page.rowIndices), [[0]]);
});

test('H: a manual page break starts a new page and retains its source row index', () => {
  const project = {
    sheetData: [staffRow(), staffRow(), staffRow()],
    rowTypes: ['single', 'page-break', 'single'],
    rowMargins: [{}, {}, {}],
    sectionLabels: {},
    layoutConfig: { measureHeight: 20, rowGap: 0, marginTop: 0, marginBottom: 0 },
    headerDetails: []
  };
  const pages = paginateSheet({ ...project, pageHeight: 500, footerSpace: 0, measuredHeaderHeight: 0 });
  assert.deepEqual(pages.map((page) => page.rowIndices), [[0], [1, 2]]);
  assert.deepEqual(pages.map((page) => page.startIndex), [0, 1]);
});

test('I: text wrapping is estimated and a measured DOM height takes precedence', () => {
  assert.equal(estimateTextLineCount('บรรทัดหนึ่ง<br>บรรทัดสอง<br/>บรรทัดสาม'), 3);
  assert.ok(estimateTextLineCount('x'.repeat(170)) >= 3);

  const project = {
    sheetData: [[['x'.repeat(170)]]],
    rowTypes: ['text'],
    sectionLabels: {}
  };
  const [block] = buildLogicalBlocks(project);
  const estimated = calculateBlockHeight(block, paginationContext(project));
  const measured = calculateBlockHeight(block, paginationContext({ ...project, measuredRowHeights: { 0: 73.25 } }));
  assert.ok(estimated.height >= 72);
  assert.equal(measured.height, 73.25);
});

test('J: pagination supports one-page, two-page, and multi-page results', () => {
  const onePage = paginateFixed([fixedBlock('a', [0], [100])]);
  const twoPages = paginateFixed([fixedBlock('a', [0], [60]), fixedBlock('b', [1], [60])]);
  const manyPages = paginateFixed([
    fixedBlock('a', [0], [60]), fixedBlock('b', [1], [60]), fixedBlock('c', [2], [60])
  ]);

  assert.equal(onePage.length, 1);
  assert.equal(twoPages.length, 2);
  assert.equal(manyPages.length, 3);
});

test('K: page assignment is independent of editor zoom at 70, 100, and 125 percent', () => {
  const assignments = [70, 100, 125].map((zoom) => paginateSheet({
    ...regressionProject,
    zoom
  }).map((page) => page.rowIndices));
  assert.deepEqual(assignments[0], assignments[1]);
  assert.deepEqual(assignments[1], assignments[2]);
});

test('L: print pagination at logical zoom 1 matches editor pagination', () => {
  const editorPages = paginateSheet({ ...regressionProject, zoom: 125 });
  const printPages = paginateSheet({ ...regressionProject, zoom: 1 });
  assert.deepEqual(
    editorPages.map((page) => ({ startIndex: page.startIndex, rows: page.rowIndices })),
    printPages.map((page) => ({ startIndex: page.startIndex, rows: page.rowIndices }))
  );
});

test('runtime measurement normalization is stable at 70, 100, and 125 percent zoom', () => {
  const logicalHeight = 116;
  const logicalWidth = 640;
  const heights = [0.7, 1, 1.25].map((scale) => getLogicalElementHeight({
    rectWidth: logicalWidth * scale,
    rectHeight: logicalHeight * scale,
    offsetWidth: logicalWidth,
    marginTop: 3,
    marginBottom: -3
  }));

  heights.forEach((height) => assert.ok(Math.abs(height - logicalHeight) < 1e-9));
});

test('viewport resize inputs do not affect fixed A4 page assignment', () => {
  const assignments = [
    { viewportWidth: 390, viewportHeight: 844 },
    { viewportWidth: 1280, viewportHeight: 720 },
    { viewportWidth: 2560, viewportHeight: 1440 }
  ].map((viewport) => paginateSheet({
    ...regressionProject,
    ...viewport
  }).map((page) => page.rowIndices));

  assert.deepEqual(assignments[0], assignments[1]);
  assert.deepEqual(assignments[1], assignments[2]);
});

test('font readiness supports immediate, delayed, rejected, unavailable, and throwing font sets', async () => {
  await waitForFonts({ ready: Promise.resolve() });
  await waitForFonts(undefined);
  await waitForFonts({ ready: Promise.reject(new Error('font load failed')) });
  await waitForFonts({ get ready() { throw new Error('font API failed'); } });

  let releaseFont;
  let delayedResolved = false;
  const delayed = new Promise((resolve) => { releaseFont = resolve; });
  const waiting = waitForFonts({ ready: delayed }).then(() => { delayedResolved = true; });
  await Promise.resolve();
  assert.equal(delayedResolved, false);
  releaseFont();
  await waiting;
  assert.equal(delayedResolved, true);
});

test('measurement threshold converges and late font metrics never recreate the original split', () => {
  const stableHeights = { 0: 116, 2: 116, 4: 212, 6: 92, 7: 92, 8: 112, 9: 116 };
  const subpixelNoise = Object.fromEntries(
    Object.entries(stableHeights).map(([key, value]) => [key, value + 0.49])
  );
  assert.equal(areMeasurementsEquivalent(stableHeights, subpixelNoise), true);
  assert.equal(areMeasurementsEquivalent(stableHeights, { ...stableHeights, 8: 112.5 }), false);

  const stablePages = paginateSheet({
    ...regressionProject,
    measuredHeaderHeight: 154,
    measuredRowHeights: stableHeights
  });
  assert.deepEqual(stablePages.map((page) => page.rowIndices), [
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
    [9, 10]
  ]);

  const tallHeaderPages = paginateSheet({
    ...regressionProject,
    measuredHeaderHeight: 240,
    measuredRowHeights: stableHeights
  });
  assert.deepEqual(tallHeaderPages.map((page) => page.rowIndices), [
    [0, 1, 2, 3],
    [4, 5, 6, 7, 8, 9, 10]
  ]);
  assert.equal(
    tallHeaderPages.some((page) => page.rowIndices.includes(8) && !page.rowIndices.includes(4)),
    false
  );
});

test('observer assignment key changes when rows move but page count stays the same', () => {
  const before = getPageAssignmentKey([
    { rowIndices: [0, 1] },
    { rowIndices: [2, 3] }
  ]);
  const after = getPageAssignmentKey([
    { rowIndices: [0] },
    { rowIndices: [1, 2, 3] }
  ]);
  assert.notEqual(before, after);
});

test('operation-shaped project updates keep every source row contiguous and unique', () => {
  const createProject = (types) => ({
    sheetData: types.map((type) => (
      type === 'text' ? [['ข้อความทดสอบ']] : staffRow(8, type.startsWith('double') ? type : null)
    )),
    rowTypes: types,
    rowMargins: types.map(() => ({ top: 0, bottom: 0, left: 0 })),
    sectionLabels: { 0: [{ id: 'section', text: 'ท่อน 1', position: 'top-left' }] },
    layoutConfig: { measureHeight: 48, rowGap: 20, marginTop: 48, marginBottom: 48 },
    headerDetails: []
  });
  const variants = [
    createProject(['single', 'single']),
    createProject(['single', 'single', 'single']),
    createProject(['single']),
    createProject(['single', 'page-break', 'single']),
    createProject(['double-right', 'double-left', 'nathap', 'annotation', 'single']),
    createProject(['single', 'text', 'single']),
    {
      ...createProject(['single', 'nathap', 'single']),
      layoutConfig: { measureHeight: 64, rowGap: 32, marginTop: 72, marginBottom: 72 }
    }
  ];

  for (const project of variants) {
    const pages = paginateSheet(project);
    const mappedRows = pages.flatMap((page) => page.rowIndices);
    assert.deepEqual(mappedRows, Array.from({ length: project.sheetData.length }, (_, index) => index));
    assert.equal(new Set(mappedRows).size, project.sheetData.length);
    pages.forEach((page) => assert.equal(page.startIndex, page.rowIndices[0]));
  }
});

test('playback boundary rows and symbols retain source order across pages', () => {
  const project = structuredClone(regressionProject);
  project.symbols = [{ id: 'boundary-symbol', start: [8, 1, 0], end: [9, 1, 0] }];
  const pages = paginateSheet(project);
  const pageForRow = (rowIndex) => pages.findIndex((page) => page.rowIndices.includes(rowIndex));

  assert.deepEqual([7, 8, 9].map(pageForRow), [0, 0, 1]);
  assert.deepEqual(pages.flatMap((page) => page.rowIndices), Array.from({ length: 11 }, (_, index) => index));
  assert.deepEqual(project.symbols[0], {
    id: 'boundary-symbol',
    start: [8, 1, 0],
    end: [9, 1, 0]
  });
});
