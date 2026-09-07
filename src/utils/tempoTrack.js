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
  sheetData.forEach((row, rowIndex) => {
    const rowType = rowTypes[rowIndex] || 'single';
    if (!Array.isArray(row) || !isPlayableRow(rowType)) return;
    const firstMeasure = rowType.startsWith('double') ? 1 : 0;
    for (let measureIndex = firstMeasure; measureIndex < row.length; measureIndex += 1) {
      const cellCount = Math.max(1, row[measureIndex]?.length || 0);
      measures.push({
        index: measures.length,
        number: measures.length + 1,
        row: rowIndex,
        measure: measureIndex,
        cellCount,
        startBeat: beat,
        durationBeats: 4
      });
      beat += 4;
    }
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
      transition: point.transition === 'linear' ? 'linear' : 'step',
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
    if (point.transition !== 'linear' || point.beat <= previous.beat) return previous.bpm;
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
