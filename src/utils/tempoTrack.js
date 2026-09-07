export const MIN_TEMPO_BPM = 20;
export const MAX_TEMPO_BPM = 300;

export const clampTempoBpm = (value, fallback = 80) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return clampTempoBpm(fallback, 80);
  return Math.min(MAX_TEMPO_BPM, Math.max(MIN_TEMPO_BPM, Math.round(parsed)));
};

const isPlayableRow = (type) => !['page-break', 'text', 'annotation', 'nathap', 'double-left'].includes(type);

export const getPlayableMeasures = (sheetData = [], rowTypes = []) => {
  const measures = [];
  let beat = 0;
  let staffLine = 1;
  sheetData.forEach((row, rowIndex) => {
    const rowType = rowTypes[rowIndex] || 'single';
    if (!Array.isArray(row) || !isPlayableRow(rowType)) return;
    const firstMeasure = rowType.startsWith('double') ? 1 : 0;
    for (let measureIndex = firstMeasure; measureIndex < row.length; measureIndex += 1) {
      const cellCount = Math.max(1, row[measureIndex]?.length || 0);
      measures.push({
        index: measures.length,
        number: measures.length + 1,
        lineNumber: staffLine + (rowType.startsWith('double') ? Math.floor((measureIndex - firstMeasure) / 8) : 0),
        row: rowIndex,
        measure: measureIndex,
        cellCount,
        startBeat: beat,
        durationBeats: 4
      });
      beat += 4;
    }
    staffLine += rowType.startsWith('double') ? Math.max(1, Math.ceil((row.length - firstMeasure) / 8)) : 1;
  });
  return measures;
};

export const positionToBeat = (position, measures) => {
  if (!position || !measures?.length) return 0;
  const measure = measures.find((entry) => entry.row === Number(position.row) && entry.measure === Number(position.measure));
  if (!measure) return 0;
  const cell = Math.min(measure.cellCount - 1, Math.max(0, Number(position.cell) || 0));
  return measure.startBeat + ((cell / measure.cellCount) * measure.durationBeats);
};

// Expand source measures into the finite playlist, including each repeat.
export const getPlaybackMeasures = (sheetData = [], rowTypes = [], sectionLabels = {}, sequence = []) => {
  const source = getPlayableMeasures(sheetData, rowTypes);
  const sections = [];
  let visualIndex = -1;
  let currentSections = [];
  let previousRow = null;
  source.forEach(measure => {
    if (measure.row !== previousRow) {
      visualIndex++;
      const labels = (sectionLabels[visualIndex] || []).filter(label => label.position === 'top-left' && label.text?.trim());
      if (labels.length) {
        currentSections = labels.map(label => ({ label: label.text.trim(), measures: [] }));
        sections.push(...currentSections);
      }
      previousRow = measure.row;
    }
    currentSections.forEach(section => section.measures.push(measure));
  });
  if (!sequence.length) return source;
  const result = [];
  sequence.forEach((item, sequenceIndex) => {
    const section = sections.find(entry => entry.label === item.label?.trim());
    if (!section) return;
    const loops = Math.max(1, Math.floor(Number(item.loops) || 1));
    for (let loop = 1; loop <= loops; loop++) {
      section.measures.forEach((measure, localIndex) => result.push({
        ...measure, index: result.length, number: result.length + 1,
        sourceNumber: measure.number, sequenceIndex, loop, sectionName: section.label,
        startsSection: localIndex === 0
      }));
    }
  });
  return result;
};

export const positionToMeasureIndex = (position, measures) => {
  if (!position || !measures?.length) return 0;
  const index = measures.findIndex((entry) => entry.row === Number(position.row) && entry.measure === Number(position.measure));
  return index < 0 ? 0 : index;
};

export const measureToPosition = (measure, cell = 0) => ({
  row: measure?.row ?? 0,
  measure: measure?.measure ?? 0,
  cell: Math.min(Math.max(0, Number(cell) || 0), Math.max(0, (measure?.cellCount || 1) - 1))
});

export const normalizeTempoTrack = (points = [], sheetData = [], rowTypes = [], baseBpm = 80) => {
  const measures = getPlayableMeasures(sheetData, rowTypes);
  const byPosition = new Map();
  points.forEach((point, index) => {
    const measureIndex = measures.findIndex((entry) => entry.row === Number(point.position?.row) && entry.measure === Number(point.position?.measure));
    const measure = measures[measureIndex];
    if (!measure) return;
    const position = measureToPosition(measure, point.position?.cell);
    const beat = positionToBeat(position, measures);
    byPosition.set(`${position.row}:${position.measure}:${position.cell}`, {
      id: point.id || `tempo-${Date.now()}-${index}`,
      position,
      bpm: clampTempoBpm(point.bpm, baseBpm),
      // Tempo automation is one continuous timeline; points are always
      // connected in chronological order without a per-node transition mode.
      transition: 'linear',
      beat
    });
  });
  return [...byPosition.values()].sort((a, b) => a.beat - b.beat).map((entry) => {
    const point = { ...entry };
    delete point.beat;
    return point;
  });
};

export const getTempoAtBeat = (targetBeat, points = [], baseBpm = 80, measures = []) => {
  const fallback = clampTempoBpm(baseBpm);
  const ordered = points
    .map((point) => ({ ...point, beat: positionToBeat(point.position, measures), bpm: clampTempoBpm(point.bpm, fallback) }))
    .sort((a, b) => a.beat - b.beat);
  if (!ordered.length) return fallback;

  let previous = { beat: 0, bpm: fallback };
  for (const point of ordered) {
    if (targetBeat >= point.beat) {
      previous = point;
      continue;
    }
    if (point.beat <= previous.beat) return previous.bpm;
    const progress = Math.min(1, Math.max(0, (targetBeat - previous.beat) / (point.beat - previous.beat)));
    return previous.bpm + ((point.bpm - previous.bpm) * progress);
  }
  return previous.bpm;
};

export const getTempoAtPosition = (position, points, baseBpm, sheetData, rowTypes) => {
  const measures = getPlayableMeasures(sheetData, rowTypes);
  return getTempoAtBeat(positionToBeat(position, measures), points, baseBpm, measures);
};

export const getCellDurationMs = (position, points, baseBpm, sheetData, rowTypes) => {
  const measures = getPlayableMeasures(sheetData, rowTypes);
  const measure = measures.find((entry) => entry.row === position.row && entry.measure === position.measure);
  if (!measure) return 0;
  const bpm = getTempoAtBeat(positionToBeat(position, measures), points, baseBpm, measures);
  return (15000 / bpm) * (4 / measure.cellCount);
};

export const getPlaybackMeasureOffsetMs = (playlist, targetIndex, points, baseBpm, sourceMeasures) => {
  let elapsed = 0;
  for (const measure of playlist.slice(0, targetIndex)) {
    for (let cell = 0; cell < measure.cellCount; cell++) {
      const bpm = getTempoAtBeat(measure.startBeat + cell * 4 / measure.cellCount, points, baseBpm, sourceMeasures);
      elapsed += (15000 / bpm) * (4 / measure.cellCount);
    }
  }
  return elapsed;
};
