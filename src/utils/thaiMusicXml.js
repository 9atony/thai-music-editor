import { INSTRUMENT_CONFIG } from './instrumentConfig.js';
import { normalizeCellToken, splitThaiNoteToken } from './sheetUtils.js';

export const THAI_MUSIC_XML_VERSION = '1.0';
const NAMESPACE = 'https://thaimusicxml.anan.ovh/ns/1';
// The editor's legacy tempo treats one full measure as one BPM pulse. In
// ThaiMusicXML v1.0, a measure contains two BPM pulses, so conversion is
// required to preserve the audible tempo when sharing files with other apps.
const editorBpmToThaiMusicXmlBpm = (value) => Math.max(1, Math.round((Number(value) || 80) * 2));
const thaiMusicXmlBpmToEditorBpm = (value) => {
  const bpm = Number(value);
  // BPM ที่ขาดหายหรือไม่ใช่ตัวเลขไม่ควรถูกแปลงจากค่า fallback 80 ของ
  // ThaiMusicXML จนกลายเป็น 40 BPM ในหน้าแก้ไข
  return Number.isFinite(bpm) && bpm > 0 ? Math.max(1, Math.round(bpm / 2)) : 80;
};

const htmlToText = (value = '') => {
  const element = document.createElement('div');
  element.innerHTML = value;
  return element.textContent || element.innerText || '';
};
const getChildren = (parent, name) => Array.from(parent?.children || []).filter((child) => child.localName === name);
const getChildText = (parent, name) => getChildren(parent, name)[0]?.textContent?.trim() || '';
const getInstrument = (idOrName) => INSTRUMENT_CONFIG[idOrName] || Object.values(INSTRUMENT_CONFIG).find((instrument) => instrument.name === idOrName);
const detailValue = (details, names) => {
  const detail = (details || []).find((item) => names.some((name) => String(item.label || '').includes(name)));
  return detail ? htmlToText(detail.value) : '';
};
const makeElement = (documentXml, name, text) => {
  const node = documentXml.createElementNS(NAMESPACE, name);
  if (text !== undefined) node.textContent = text;
  return node;
};

const appendBeat = (documentXml, measure, token, isUnpitched) => {
  const notes = splitThaiNoteToken(normalizeCellToken(token));
  if (!notes.length) { measure.appendChild(makeElement(documentXml, 'rest')); return; }
  const parent = notes.length === 1 ? measure : makeElement(documentXml, 'group');
  notes.forEach((noteToken) => {
    const note = makeElement(documentXml, 'note');
    if (isUnpitched) note.setAttribute('sound', noteToken);
    // \u200B เป็นส่วนหนึ่งของรูปแบบระดับเสียงต่ำในข้อมูลเดิมของ editor
    // จึงต้องเก็บไว้เพื่อให้ Export → Import คืนระดับเสียงเดิมได้ครบ
    else note.setAttribute('pitch', noteToken);
    parent.appendChild(note);
  });
  if (parent !== measure) measure.appendChild(parent);
};

/** Serializes the editor's basic score model as ThaiMusicXML v1.0. */
export const toThaiMusicXml = ({ songName, headerDetails, layoutConfig, currentInstrument, sheetData, rowTypes, sectionLabels, playbackSequence }) => {
  const documentXml = document.implementation.createDocument(NAMESPACE, 'thai-score', null);
  const root = documentXml.documentElement;
  root.setAttribute('version', THAI_MUSIC_XML_VERSION);
  const header = makeElement(documentXml, 'header');
  header.appendChild(makeElement(documentXml, 'title', htmlToText(songName)));
  const composer = detailValue(headerDetails, ['ผู้ประพันธ์', 'ผู้แต่ง', 'Composer']);
  if (composer) { const node = makeElement(documentXml, 'composer'); node.appendChild(makeElement(documentXml, 'text', composer)); header.appendChild(node); }
  const tuningReference = detailValue(headerDetails, ['บันไดเสียง', 'การตั้งเสียง', 'ทาง']);
  if (tuningReference) { const tuning = makeElement(documentXml, 'tuning'); tuning.setAttribute('reference', tuningReference); header.appendChild(tuning); }
  root.appendChild(header);

  const visualRows = (sheetData || []).flatMap((row, rowIndex) => {
    const rowType = rowTypes?.[rowIndex] || 'single';
    const visualIndex = (rowTypes || []).slice(0, rowIndex + 1).filter((type) => type === 'single' || type === 'double-right').length - 1;
    const label = (sectionLabels?.[visualIndex] || []).find((item) => item.text?.trim())?.text;
    if (rowType === 'single') return [{ rightRow: row, leftRow: null, rowType, label }];
    if (rowType === 'double-right') {
      const leftRow = rowTypes?.[rowIndex + 1] === 'double-left' ? sheetData[rowIndex + 1] : null;
      return [{ rightRow: row, leftRow, rowType, label }];
    }
    return [];
  });
  const sections = [];
  visualRows.forEach((visualRow) => {
    const name = visualRow.label ? htmlToText(visualRow.label) : '';
    if (name || sections.length === 0) sections.push({ id: `s${sections.length + 1}`, name: name || 'ท่อน 1', rows: [] });
    sections.at(-1).rows.push(visualRow);
  });
  const structure = makeElement(documentXml, 'structure');
  const direction = makeElement(documentXml, 'direction');
  direction.appendChild(makeElement(documentXml, 'bpm', String(editorBpmToThaiMusicXmlBpm(layoutConfig?.bpm))));
  structure.appendChild(direction);
  const sectionByName = new Map(sections.map((section) => [section.name, section]));
  const sequence = (playbackSequence || []).map((item) => ({ ...item, name: htmlToText(item.label).trim() }))
    .filter((item) => sectionByName.has(item.name));
  const orderedSections = sequence.length ? sequence : sections.map((section) => ({ name: section.name, loops: 1 }));
  const declared = new Set();
  orderedSections.forEach((item) => {
    const scoreSection = sectionByName.get(item.name);
    const container = Number(item.loops) > 1 ? makeElement(documentXml, 'repeat') : structure;
    if (container !== structure) container.setAttribute('times', String(Number(item.loops)));
    const node = makeElement(documentXml, declared.has(scoreSection.id) ? 'play' : 'section');
    if (node.localName === 'play') node.setAttribute('section', scoreSection.id);
    else { node.setAttribute('id', scoreSection.id); node.setAttribute('name', scoreSection.name); declared.add(scoreSection.id); }
    container.appendChild(node);
    if (container !== structure) structure.appendChild(container);
  });
  sections.filter((section) => !declared.has(section.id)).forEach((scoreSection) => {
    const node = makeElement(documentXml, 'section'); node.setAttribute('id', scoreSection.id); node.setAttribute('name', scoreSection.name); structure.appendChild(node);
  });
  root.appendChild(structure);

  const instrument = currentInstrument || {};
  const hasDoubleRows = visualRows.some((visualRow) => visualRow.leftRow);
  const ensemble = makeElement(documentXml, 'ensemble');
  const appendPartDefinition = (id, name, row = null) => {
    const part = makeElement(documentXml, 'part');
    part.setAttribute('id', id);
    if (instrument.type === 'percussion') part.setAttribute('type', 'unpitched');
    if (row !== null) {
      part.setAttribute('stack', 'two-hands');
      part.setAttribute('row', String(row));
    }
    part.appendChild(makeElement(documentXml, 'instrument-name', name));
    ensemble.appendChild(part);
  };
  appendPartDefinition('P1', hasDoubleRows ? `${instrument.name || 'เครื่องดนตรีไทย'} - มือขวา` : (instrument.name || ''), hasDoubleRows ? 1 : null);
  if (hasDoubleRows) appendPartDefinition('P2', `${instrument.name || 'เครื่องดนตรีไทย'} - มือซ้าย`, 2);
  root.appendChild(ensemble);

  const appendPartData = (id, hand) => {
    const partData = makeElement(documentXml, 'part-data');
    partData.setAttribute('part', id);
    sections.forEach((scoreSection) => {
      const sectionRef = makeElement(documentXml, 'section-ref'); sectionRef.setAttribute('section', scoreSection.id);
      scoreSection.rows.forEach((visualRow, lineIndex) => {
        const row = hand === 'left' ? visualRow.leftRow : visualRow.rightRow;
        if (!row) return;
        const line = makeElement(documentXml, 'line'); line.setAttribute('number', String(lineIndex + 1));
        row.forEach((measureData, measureIndex) => {
          if (visualRow.rowType.startsWith('double') && measureIndex === 0) return;
          const measure = makeElement(documentXml, 'measure'); measure.setAttribute('number', String(measureIndex + 1));
          (measureData || []).forEach((cell) => appendBeat(documentXml, measure, cell, instrument.type === 'percussion'));
          line.appendChild(measure);
        });
        sectionRef.appendChild(line);
      });
      if (getChildren(sectionRef, 'line').length) partData.appendChild(sectionRef);
    });
    root.appendChild(partData);
  };
  appendPartData('P1', 'right');
  if (hasDoubleRows) appendPartData('P2', 'left');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(documentXml)}`;
};

const readBeat = (beat) => {
  if (beat.localName === 'rest') return '-';
  const notes = beat.localName === 'group' ? getChildren(beat, 'note') : [beat];
  return normalizeCellToken(notes.map((note) => note.getAttribute('pitch') || note.getAttribute('sound') || '').join(''));
};

/** Parses the basic pitched/unpitched ThaiMusicXML v1.0 score model into the existing editor grid. */
export const fromThaiMusicXml = (xmlText) => {
  let xml;
  try {
    xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  } catch {
    throw new Error('ไฟล์ XML ไม่ถูกต้อง');
  }
  if (xml.querySelector?.('parsererror') || xml.getElementsByTagName?.('parsererror')?.length) throw new Error('ไฟล์ XML ไม่ถูกต้อง');
  const root = xml.documentElement;
  if (root?.localName !== 'thai-score') throw new Error('ไม่พบเอกสาร ThaiMusicXML');
  if (root.namespaceURI !== NAMESPACE) throw new Error('ไม่ใช่เอกสาร ThaiMusicXML v1.0 ที่ถูกต้อง');
  if (root.getAttribute('version') !== THAI_MUSIC_XML_VERSION) throw new Error('รองรับเฉพาะ ThaiMusicXML v1.0');
  const header = getChildren(root, 'header')[0];
  const structure = getChildren(root, 'structure')[0];
  const ensemble = getChildren(root, 'ensemble')[0];
  const partDefinitions = getChildren(ensemble, 'part');
  const leftPartDefinition = partDefinitions.find((part) => getChildText(part, 'instrument-name').includes('มือซ้าย'));
  const partDefinition = partDefinitions.find((part) => part !== leftPartDefinition) || partDefinitions[0];
  const partId = partDefinition?.getAttribute('id');
  const partData = getChildren(root, 'part-data').find((item) => item.getAttribute('part') === partId) || getChildren(root, 'part-data')[0];
  const leftPartData = leftPartDefinition
    ? getChildren(root, 'part-data').find((item) => item.getAttribute('part') === leftPartDefinition.getAttribute('id'))
    : null;
  if (!partDefinition || !partData) throw new Error('ไม่พบข้อมูลเครื่องดนตรีหรือแนวบรรเลง');
  const sectionNames = new Map();
  const playOrder = [];
  const collectStructure = (nodes) => Array.from(nodes).forEach((node) => {
    if (node.localName === 'section') { sectionNames.set(node.getAttribute('id'), node.getAttribute('name') || ''); playOrder.push(node.getAttribute('id')); }
    else if (node.localName === 'play') playOrder.push(node.getAttribute('section'));
    else if (node.localName === 'repeat') {
      const children = Array.from(node.children);
      const times = Math.max(2, Number.parseInt(node.getAttribute('times'), 10) || 2);
      for (let index = 0; index < times; index += 1) collectStructure(children);
    }
  });
  collectStructure(structure?.children || []);
  const readLine = (line) => getChildren(line, 'measure').map((measure) => Array.from(measure.children)
    .filter((beat) => ['note', 'rest', 'group'].includes(beat.localName))
    .map(readBeat));
  const sheetData = [], rowTypes = [], sectionLabels = {};
  let visualIndex = 0;
  getChildren(partData, 'section-ref').forEach((sectionRef) => getChildren(sectionRef, 'line').forEach((line, lineIndex) => {
    const row = readLine(line);
    if (!row.length) return;
    const sectionId = sectionRef.getAttribute('section');
    const leftSection = getChildren(leftPartData, 'section-ref').find((item) => item.getAttribute('section') === sectionId);
    const leftLine = getChildren(leftSection, 'line').find((item) => item.getAttribute('number') === line.getAttribute('number'));
    if (leftLine) {
      sheetData.push([['มือขวา'], ...row], [['มือซ้าย'], ...readLine(leftLine)]);
      rowTypes.push('double-right', 'double-left');
    } else {
      sheetData.push(row);
      rowTypes.push('single');
    }
    // A ThaiMusicXML section may contain several lines. The editor recognizes a
    // section boundary from its first label, so applying this label to every
    // line would incorrectly split one section into many sections.
    const sectionName = sectionNames.get(sectionRef.getAttribute('section'));
    if (sectionName && lineIndex === 0) sectionLabels[visualIndex] = [{ id: Date.now() + visualIndex, text: sectionName, position: 'top-left', fontSize: 18, isBold: true, offsetY: 6 }];
    visualIndex += 1;
  }));
  if (!sheetData.length) throw new Error('ไม่พบห้องเพลงที่นำเข้าได้');
  const direction = getChildren(structure, 'direction')[0];
  const composerElement = getChildren(header, 'composer')[0];
  const composer = getChildText(composerElement, 'text') || composerElement?.textContent?.trim() || '';
  const playbackSequence = playOrder.reduce((sequence, sectionId) => {
    const label = sectionNames.get(sectionId);
    if (!label) return sequence;
    const previous = sequence.at(-1);
    if (previous?.label === label) previous.loops += 1;
    else sequence.push({ id: Date.now() + sequence.length, label, loops: 1 });
    return sequence;
  }, []);
  const instrumentName = getChildText(partDefinition, 'instrument-name').replace(/\s*-\s*มือขวา\s*$/, '');
  return { songName: getChildText(header, 'title') || 'เพลงที่นำเข้า', composer, key: getChildren(header, 'tuning')[0]?.getAttribute('reference') || '', bpm: thaiMusicXmlBpmToEditorBpm(Number.parseInt(getChildText(direction, 'bpm'), 10)), currentInstrument: getInstrument(instrumentName)?.id, sheetData, rowTypes, sectionLabels, playbackSequence, rowMargins: sheetData.map(() => ({ top: 0, bottom: 0, left: 0 })) };
};
