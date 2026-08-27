import { INSTRUMENT_CONFIG } from './instrumentConfig';

export const NATHAP_LABEL_DEFAULT = 'เครื่องประกอบ';

export const getVisualIndex = (rowIndex, rowTypesArray) => {
  let vIdx = 0;
  for (let i = 0; i < rowIndex; i++) {
    if (rowTypesArray[i] === 'single' || rowTypesArray[i] === 'double-right') {
      vIdx++;
    }
  }
  if (rowTypesArray[rowIndex] === 'double-left') {
    return Math.max(0, vIdx - 1);
  }
  return vIdx;
};

export const getFlattenedCol = (row, rType, targetM, targetC) => {
  if (!row || rType === 'text' || rType === 'page-break') return 0;
  let col = 0;
  for (let m = 0; m < row.length; m++) {
    if (rType && (rType.startsWith('double') || rType === 'nathap') && m === 0) continue;
    if (m === targetM) return col + targetC;
    col += row[m].length;
  }
  return col;
};

export const createEmptyMeasureRow = (measureCount = 8, cellCount = 4) => 
  Array.from({ length: measureCount }, () => Array(cellCount).fill('-'));

export const normalizeNathapRowData = (row, isUnderDouble = false) => {
  const emptyMeasures = createEmptyMeasureRow();
  
  if (!Array.isArray(row) || row.length === 0) {
      return isUnderDouble ? [[NATHAP_LABEL_DEFAULT], ...emptyMeasures] : emptyMeasures;
  }

  const normalizedRow = row.map((measure) => {
    if (Array.isArray(measure)) return [...measure];
    if (typeof measure === 'string') return [measure];
    return ['-'];
  });

  const hasLeadingLabel = normalizedRow[0].length === 1 && typeof normalizedRow[0][0] === 'string';
  
  const rawMeasures = hasLeadingLabel ? normalizedRow.slice(1) : normalizedRow;
  
  const measures = Array.from({ length: 8 }, (_, index) => {
    const source = rawMeasures[index];
    return Array.isArray(source) && source.length > 0 ? [...source] : ['-', '-', '-', '-'];
  });

  if (isUnderDouble) {
      const labelText = hasLeadingLabel ? normalizedRow[0][0] : NATHAP_LABEL_DEFAULT;
      return [[labelText], ...measures];
  } else {
      return measures;
  }
};

export const getPercussionWords = () => {
  const words = ['มือขวา', 'มือซ้าย'];
  Object.values(INSTRUMENT_CONFIG).forEach(inst => {
    if (inst.type === 'percussion') {
      inst.keys.forEach(k => words.push(k.thai));
    }
  });
  return Array.from(new Set(words)).sort((a, b) => b.length - a.length);
};

export const PERC_PATTERN = getPercussionWords().join('|');
export const NOTE_PATTERN = '[ก-ฮA-Za-z0-9][ั-๎\\u200B]*';
export const TOKEN_REGEX = new RegExp(`(${PERC_PATTERN}|${NOTE_PATTERN})`, 'g');

export const normalizeCellToken = (value) => {
  if (typeof value !== 'string') return value && value !== '-' ? String(value) : '-';
  const compact = value.replace(/\s+/g, '').trim();
  return compact === '' ? '-' : compact;
};

export const splitThaiNoteToken = (token) => {
  const normalized = normalizeCellToken(token);
  if (!normalized || normalized === '-') return [];
  return normalized.match(TOKEN_REGEX) || [];
};

export const parseCellToken = (token, sabatStyle = 'crescendo', customVels = []) => {
  const notes = splitThaiNoteToken(token);
  if (notes.length === 0) return [];
  if (notes.length === 1) return [{ note: notes[0], ratio: 0, emphasis: 1 }];

  return notes.map((note, index) => {
    let emp = 1;
    if (sabatStyle === 'custom' && customVels.length === notes.length) {
       emp = customVels[index] / 100;
    } else if (sabatStyle === 'flat') {
       emp = 1;
    } else if (sabatStyle === 'accent') {
       emp = index === 0 ? 0.5 : 1;
    } else {
       emp = index === notes.length - 1 ? 1 : Math.max(0.55, 0.88 - (index * 0.08));
    }
    return { note, ratio: index / notes.length, emphasis: emp };
  });
};

export const formatInstrumentNote = (key) => {
  if (!key.eng) return key.thai;
  const numMatch = key.eng.match(/\d+/);
  if (!numMatch) return key.thai; 
  
  const octave = parseInt(numMatch[0], 10);
  if (octave >= 5) return key.thai + '\u0E4D';
  if (octave === 2) return key.thai + '\u0E3A\u200B';
  if (octave === 3) return key.thai + '\u0E3A';
  return key.thai;
};

export const getIntervalPair = (instrument, noteStr, intervalModeVal) => {
  if (!instrument?.keys || !noteStr || noteStr === '-' || intervalModeVal === 'off') {
    return { left: noteStr, right: noteStr };
  }

  const dist = parseInt(intervalModeVal, 10) - 1;
  const idx = instrument.keys.findIndex(k => formatInstrumentNote(k) === noteStr);
  
  if (idx === -1) return { left: noteStr, right: noteStr };

  let rightIdx = idx;
  let leftIdx = idx - dist;

  if (leftIdx < 0) leftIdx = 0; 

  return {
    left: formatInstrumentNote(instrument.keys[leftIdx]),
    right: formatInstrumentNote(instrument.keys[rightIdx])
  };
};

export const shiftNoteObject = (keyObj, steps) => {
  const engPitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const thaiPitches = ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท'];
  const pitch = keyObj.eng.replace(/\d/g, '');
  const octave = parseInt(keyObj.eng.replace(/\D/g, ''), 10);
  const idx = engPitches.indexOf(pitch);
  if (idx === -1) return keyObj;

  const newIdx = idx + steps;
  const newOctave = octave + Math.floor(newIdx / 7);
  const newPitchIdx = ((newIdx % 7) + 7) % 7;
  
  return {
    thai: thaiPitches[newPitchIdx],
    eng: engPitches[newPitchIdx] + newOctave
  };
};

export const shiftNoteString = (noteStr, steps) => {
  if (!noteStr || noteStr === '-') return noteStr;
  let thaiChar = noteStr.replace(/[\u0E3A\u200B\u0E4D]/g, '');
  let octave = 4;
  if (noteStr.includes('\u0E4D')) octave = 5;
  else if (noteStr.includes('\u0E3A\u200B')) octave = 2;
  else if (noteStr.includes('\u0E3A')) octave = 3;

  const thaiPitches = ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท'];
  const engPitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const idx = thaiPitches.indexOf(thaiChar);
  if (idx === -1) return noteStr;
  
  const mockEng = engPitches[idx] + octave;
  const shifted = shiftNoteObject({ thai: thaiChar, eng: mockEng }, steps);
  
  let finalNote = shifted.thai;
  const newOctave = parseInt(shifted.eng.replace(/\D/g, ''));
  if (newOctave >= 5) finalNote += '\u0E4D';
  else if (newOctave === 2) finalNote += '\u0E3A\u200B';
  else if (newOctave === 3) finalNote += '\u0E3A';
  
  return finalNote;
};

export const DEFAULT_INSTRUMENT = INSTRUMENT_CONFIG["khong-wong-yai"] || INSTRUMENT_CONFIG["ranat-ek"] || Object.values(INSTRUMENT_CONFIG)[0];

export const createDefaultSheetData = () => Array(4).fill().map(() => Array(8).fill().map(() => Array(4).fill('-')));

export const createDefaultRowTypes = () => Array(4).fill('single');

export const createDefaultRowMargins = (length = 4) => Array.from({ length }, () => ({ top: 0, bottom: 0, left: 0 }));

export const createDefaultHeaderDetails = () => ([
  { id: 1, label: "อัตราจังหวะ", value: "๒ ชั้น" },
  { id: 2, label: "เครื่องประกอบ", value: "สองไม้" },
  { id: 3, label: "บันไดเสียง", value: "ทางเพียงออ" },
  { id: 4, label: "ผู้บันทึก", value: "9atony" }
]);

export const createDefaultLayoutConfig = () => ({
  fontSize: 20, isBold: false, isItalic: false, measureHeight: 48,
  rowGap: 32, songNameSize: 48, authorSize: 16, detailsAlign: 'between',
  borderWidth: 2, innerBorderWidth: 1, borderColor: '#1e293b', borderRadius: 0,
  bpm: 80, volume: 100,
  sabatColor: '#1e293b', sabatStrokeWidth: 2.5, sabatCurve: 20, sabatOffset: 4, sabatStyle: 'crescendo',
  kroColor: '#3b82f6', kroStrokeWidth: 2.5, kroOffset: 30, kroSpeed: 65, kroStartHand: 'right',
  activeSymbol: 'sabat', symbolColor: '#1e293b', symbolStrokeWidth: 2.5, symbolHeight: 20,
  marginTop: 48, marginBottom: 48, marginLeft: 48, marginRight: 48,
  marginUnit: 'px', textLineHeight: 1.5, textFontSize: 16,
  customStyles: {}
});