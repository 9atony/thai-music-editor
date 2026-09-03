import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCadenceDebugTable,
  parseStartingPitch,
  resolveThaiPitch,
  thaiMusicXmlModelToMusicXml
} from './musicXmlConverter.js';

const makeModel = ({ measures, sections, bpm = 120, playOrder = ['s1'] }) => ({
  title: 'เพลงทดสอบ',
  composer: 'ผู้แต่งทดสอบ',
  bpm,
  playOrder,
  sectionNames: new Map([['s1', 'ท่อน 1'], ['s2', 'ท่อน 2']]),
  parts: [{
    id: 'P1',
    name: 'ระนาดเอก',
    unpitched: false,
    sections: sections || new Map([['s1', measures]])
  }]
});

const score = (options) => thaiMusicXmlModelToMusicXml(makeModel(options), { startingPitch: options.startingPitch || 'C4' });
const measuresOf = (xml) => [...xml.matchAll(/<measure number="([^"]+)"([^>]*)>([\s\S]*?)<\/measure>/g)]
  .map((match) => ({ number: match[1], attributes: match[2], xml: match[3] }));
const notesOf = (measure) => [...measure.xml.matchAll(/<note>([\s\S]*?)<\/note>/g)].map((match) => ({
  step: match[1].match(/<step>([^<]+)<\/step>/)?.[1] || null,
  rest: match[1].includes('<rest'),
  duration: Number(match[1].match(/<duration>(\d+)<\/duration>/)?.[1]),
  tieStart: match[1].includes('<tie type="start"/>'),
  tieStop: match[1].includes('<tie type="stop"/>')
}));

test('moves every Thai luk tok to beat one and keeps the opening notes in an implicit pickup', () => {
  const model = makeModel({
    measures: [
      [[{ pitch: 'ด' }], [{ pitch: 'ร' }], [{ pitch: 'ม' }], [{ pitch: 'ฟ' }]],
      [[{ pitch: 'ซ' }], [{ pitch: 'ล' }], [{ pitch: 'ท' }], [{ pitch: 'ดํ' }]],
      [[{ pitch: 'รํ' }], [{ pitch: 'มํ' }], [{ pitch: 'ฟํ' }], [{ pitch: 'ซํ' }]]
    ]
  });
  const xml = thaiMusicXmlModelToMusicXml(model, { startingPitch: 'C4' });
  const measures = measuresOf(xml);

  assert.deepEqual(measures.map(({ number }) => number), ['0', '1', '2', '3']);
  assert.match(measures[0].attributes, /implicit="yes"/);
  assert.deepEqual(notesOf(measures[0]).map(({ step }) => step), ['C', 'D', 'E']);
  assert.deepEqual(notesOf(measures[1]).map(({ step }) => step), ['F', 'G', 'A', 'B']);
  assert.deepEqual(notesOf(measures[2]).map(({ step }) => step), ['C', 'D', 'E', 'F']);
  assert.deepEqual(notesOf(measures[3]).map(({ step }) => step), ['G']);

  const lukTokRows = buildCadenceDebugTable(model).filter((row) => row['Is Luk Tok']);
  assert.deepEqual(lukTokRows.map((row) => row['Thai measure']), [1, 2, 3]);
  assert.deepEqual(lukTokRows.map((row) => row['Western measure']), [1, 2, 3]);
  assert.deepEqual(lukTokRows.map((row) => row['Western beat']), [1, 1, 1]);
  assert.ok(measures.flatMap(notesOf).every((note) => note.duration === 1), 'slot durations stay unchanged');
});

test('preserves leading rests in the pickup and a rest at the start of the next Thai measure', () => {
  const xml = score({
    measures: [
      [[{ rest: true }], [{ rest: true }], [{ pitch: 'ร' }], [{ pitch: 'ม' }]],
      [[{ rest: true }], [{ pitch: 'ฟ' }], [{ pitch: 'ซ' }], [{ pitch: 'ล' }]]
    ]
  });
  const measures = measuresOf(xml);

  assert.deepEqual(notesOf(measures[0]).map(({ rest, step }) => rest ? 'rest' : step), ['rest', 'rest', 'D']);
  assert.deepEqual(notesOf(measures[1]).map(({ rest, step }) => rest ? 'rest' : step), ['E', 'rest', 'F', 'G']);
  assert.equal(notesOf(measures[2])[0].step, 'A');
});

test('splits and ties a luk tok sustained from the preceding slot across the new barline', () => {
  const xml = score({
    measures: [
      [[{ pitch: 'ด' }], [{ pitch: 'ร' }], [{ pitch: 'ม' }], [{ rest: true }]],
      [[{ rest: true }], [{ pitch: 'ฟ' }], [{ pitch: 'ซ' }], [{ pitch: 'ล' }]]
    ]
  });
  const measures = measuresOf(xml);
  const pickupLast = notesOf(measures[0]).at(-1);
  const firstDownbeat = notesOf(measures[1])[0];

  assert.deepEqual({ step: pickupLast.step, duration: pickupLast.duration, tieStart: pickupLast.tieStart }, { step: 'E', duration: 1, tieStart: true });
  assert.deepEqual({ step: firstDownbeat.step, duration: firstDownbeat.duration, tieStop: firstDownbeat.tieStop }, { step: 'E', duration: 1, tieStop: true });
});

test('keeps cadence alignment across multiple sections and playback order', () => {
  const sections = new Map([
    ['s1', [[[{ pitch: 'ด' }], [{ pitch: 'ร' }], [{ pitch: 'ม' }], [{ pitch: 'ฟ' }]]]],
    ['s2', [[[{ pitch: 'ซ' }], [{ pitch: 'ล' }], [{ pitch: 'ท' }], [{ pitch: 'ดํ' }]]]]
  ]);
  const model = makeModel({ sections, playOrder: ['s1', 's2', 's1'] });
  const lukTokRows = buildCadenceDebugTable(model).filter((row) => row['Is Luk Tok']);
  assert.deepEqual(lukTokRows.map((row) => row['Western measure']), [1, 2, 3]);
  assert.equal(measuresOf(thaiMusicXmlModelToMusicXml(model)).length, 4);
});

test('keeps compact notes evenly spaced across an editor barline', () => {
  const xml = score({
    measures: [
      [[{ pitch: 'ล' }], [{ pitch: 'ซ' }], [{ pitch: 'ฟ' }], [{ pitch: 'ล' }]],
      [[{ pitch: 'ซ' }, { pitch: 'ฟ' }], [{ pitch: 'ซ' }], [{ pitch: 'ฟ' }, { pitch: 'ม' }], [{ pitch: 'ล' }]]
    ]
  });
  const measures = measuresOf(xml);
  const durations = measures.flatMap(notesOf).map(({ duration }) => duration);
  assert.deepEqual(durations, [2, 2, 2, 2, 1, 1, 2, 1, 1, 2]);
  assert.match(measures[0].attributes, /implicit="yes"/);
});

test('gives mirrored single and compact-note cells equal total time around a barline', () => {
  const xml = score({
    measures: [
      [[{ pitch: 'ด' }], [{ pitch: 'ร' }], [{ pitch: 'ม' }, { pitch: 'ฟ' }], [{ pitch: 'ซ' }]],
      [[{ pitch: 'ล' }], [{ pitch: 'ท' }, { pitch: 'ดํ' }], [{ pitch: 'รํ' }], [{ pitch: 'มํ' }]]
    ]
  });
  const measures = measuresOf(xml);
  const durations = measures.flatMap(notesOf).map(({ duration }) => duration);
  const leftOfBar = durations.slice(2, 5);
  const rightOfBar = durations.slice(5, 8);

  // คู่ + เดี่ยว และ เดี่ยว + คู่ ต่างใช้เวลารวมสองช่องเท่ากัน
  assert.deepEqual(leftOfBar, [1, 1, 2]);
  assert.deepEqual(rightOfBar, [2, 1, 1]);
  assert.equal(leftOfBar.reduce((sum, duration) => sum + duration, 0), 4);
  assert.equal(rightOfBar.reduce((sum, duration) => sum + duration, 0), 4);
});

test('uses sabat timing across a barline without exporting the web-only symbol', () => {
  const lastCell = [{ pitch: 'ล' }];
  lastCell.ornament = 'sabat';
  lastCell.ornamentId = 'curve-1';
  const firstCell = [{ pitch: 'ซ' }, { pitch: 'ฟ' }];
  firstCell.ornament = 'sabat';
  firstCell.ornamentId = 'curve-1';
  const xml = score({
    measures: [
      [[{ pitch: 'ด' }], [{ pitch: 'ร' }], [{ pitch: 'ม' }], lastCell],
      [firstCell, [{ pitch: 'ซ' }], [{ pitch: 'ล' }], [{ pitch: 'ท' }]]
    ]
  });
  const measures = measuresOf(xml);
  const firstWesternBar = notesOf(measures[1]);

  assert.deepEqual(firstWesternBar.slice(0, 3).map(({ step, duration }) => [step, duration]), [['A', 1], ['G', 1], ['F', 2]]);
  assert.doesNotMatch(xml, /<slur\b/);
  assert.doesNotMatch(xml, /sabat|ornament-id|ornament-start|ornament-end/);
  assert.doesNotMatch(xml, /<time-modification>|<tuplet\b/);
});

test('exports right-hand and left-hand rows as separate synchronized MusicXML parts', () => {
  const rightMeasures = [[[{ pitch: 'ด' }], [{ pitch: 'ร' }], [{ pitch: 'ม' }], [{ pitch: 'ฟ' }]]];
  const leftMeasures = [[[{ pitch: 'ดฺ' }], [{ pitch: 'รฺ' }], [{ pitch: 'มฺ' }], [{ pitch: 'ฟฺ' }]]];
  const model = makeModel({ measures: rightMeasures });
  model.parts = [
    { id: 'P1', name: 'ระนาดเอก - มือขวา', unpitched: false, sections: new Map([['s1', rightMeasures]]) },
    { id: 'P2', name: 'ระนาดเอก - มือซ้าย', unpitched: false, sections: new Map([['s1', leftMeasures]]) }
  ];
  const xml = thaiMusicXmlModelToMusicXml(model, { startingPitch: 'C4' });
  const rightPart = xml.match(/<part id="P1">([\s\S]*?)<\/part>/)?.[1] || '';
  const leftPart = xml.match(/<part id="P2">([\s\S]*?)<\/part>/)?.[1] || '';

  assert.match(xml, /<score-part id="P1">/);
  assert.match(xml, /<score-part id="P2">/);
  assert.equal(measuresOf(rightPart).length, measuresOf(leftPart).length);
  assert.match(rightPart, /<step>C<\/step><octave>4<\/octave>/);
  assert.match(leftPart, /<step>C<\/step><octave>3<\/octave>/);
});

test('uses explicit isLukTok metadata before falling back to the final Thai slot', () => {
  const marked = [{ pitch: 'ร' }];
  marked.isLukTok = true;
  const model = makeModel({ measures: [[[{ pitch: 'ด' }], marked, [{ pitch: 'ม' }], [{ pitch: 'ฟ' }]]] });
  const rows = buildCadenceDebugTable(model);
  assert.equal(rows.find((row) => row['Is Luk Tok'])['Thai slot'], 2);
  assert.equal(rows.find((row) => row['Is Luk Tok'])['Western beat'], 1);
});

test('converts Bb3 tuning while preserving repeated-section playback order', () => {
  const xml = score({
    startingPitch: 'Bb3',
    playOrder: ['s1', 's1'],
    bpm: 96,
    measures: [[[{ pitch: 'ด' }], [{ pitch: 'ร' }], [{ pitch: 'ฟ' }], [{ pitch: 'ทฺ' }]]]
  });

  assert.deepEqual(resolveThaiPitch('ด', 0, 'Bb3'), { step: 'B', alter: -1, octave: 3, midi: 58 });
  assert.match(xml, /<key><fifths>-2<\/fifths><\/key>/);
  assert.match(xml, /<pitch><step>B<\/step><alter>-1<\/alter><octave>3<\/octave><\/pitch>/);
  assert.match(xml, /<pitch><step>A<\/step><octave>3<\/octave><\/pitch>/);
  assert.equal(measuresOf(xml).length, 3);
});

test('validates user-defined starting pitches', () => {
  assert.deepEqual(parseStartingPitch('F#4'), { step: 'F', alter: 1, octave: 4, midi: 66, name: 'F#4' });
  assert.deepEqual(resolveThaiPitch('ด', 0, 'Cb4'), { step: 'C', alter: -1, octave: 4, midi: 59 });
  assert.throws(() => parseStartingPitch('โดกลาง'), /C4 หรือ Bb3/);
});
