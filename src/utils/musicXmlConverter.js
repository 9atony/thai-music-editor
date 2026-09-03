// Conversion policy adapted for Thai Music Editor from the ThaiMusicXML
// project's ThaiMusicXML -> MusicXML converter documentation.
// ThaiMusicXML Copyright 2026 Nopparuj Ananvoranich, Apache-2.0.
// This file is a new, reduced browser implementation for the MVP and does
// not copy the upstream converter source. See THIRD_PARTY_NOTICES.md.

const THAI_MUSIC_XML_NAMESPACE = 'https://thaimusicxml.anan.ovh/ns/1';
const THAI_DEGREES = ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท'];
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PITCH_CLASSES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const FIFTHS_BY_TONIC = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
const MIDI_PROGRAM_BY_NAME = [
  ['ระนาด', 14],
  ['ฆ้อง', 12],
  ['ขิม', 16],
  ['จะเข้', 108],
  ['ซอด้วง', 41],
  ['ซออู้', 43]
];

const escapeXml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const gcd = (a, b) => {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) [left, right] = [right, left % right];
  return left || 1;
};
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
const fraction = (numerator, denominator = 1) => {
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
};
const addFractions = (left, right) => fraction((left.numerator * right.denominator) + (right.numerator * left.denominator), left.denominator * right.denominator);
const subtractFractions = (left, right) => fraction((left.numerator * right.denominator) - (right.numerator * left.denominator), left.denominator * right.denominator);
const compareFractions = (left, right) => (left.numerator * right.denominator) - (right.numerator * left.denominator);
const multiplyFraction = (value, multiplier) => fraction(value.numerator * multiplier, value.denominator);
const fractionNumber = (value) => value.numerator / value.denominator;
// MuseScore's internal tick grid reliably supports down to a 128th note.
// Quantizing only performance-generated fractions to this grid avoids invalid
// 256th/512th tuplets while keeping timing error below one 128th-note step.
const EXPORT_TICKS_PER_QUARTER = 32;

export const parseStartingPitch = (value) => {
  const match = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(value || '').trim());
  if (!match) throw new Error('กรุณาระบุเสียงตั้งต้น เช่น C4 หรือ Bb3');
  const step = match[1].toUpperCase();
  const accidental = match[2];
  const octave = Number(match[3]);
  const alter = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  const midi = (octave + 1) * 12 + NATURAL_PITCH_CLASSES[step] + alter;
  if (midi < 0 || midi > 127) throw new Error('เสียงตั้งต้นอยู่นอกช่วงที่รองรับ');
  return { step, alter, octave, midi, name: `${step}${accidental}${octave}` };
};

const buildMajorScale = (startingPitch) => {
  const startLetterIndex = LETTERS.indexOf(startingPitch.step);
  return MAJOR_INTERVALS.map((interval, degree) => {
    const letterIndex = startLetterIndex + degree;
    const step = LETTERS[letterIndex % LETTERS.length];
    const midi = startingPitch.midi + interval;
    // MusicXML octave follows the written pitch name, so Cb4 remains octave 4
    // even though its sounding MIDI pitch is the same as B3.
    const octave = startingPitch.octave + Math.floor(letterIndex / LETTERS.length);
    const naturalMidi = (octave + 1) * 12 + NATURAL_PITCH_CLASSES[step];
    return { step, alter: midi - naturalMidi, octave, midi };
  });
};

export const resolveThaiPitch = (pitch, octaveAttribute, startingPitch = 'C4') => {
  const tuning = typeof startingPitch === 'string' ? parseStartingPitch(startingPitch) : startingPitch;
  const normalized = String(pitch || '').replace(/\u200B/g, '');
  const hasUpperMark = normalized.includes('ํ');
  const hasLowerMark = normalized.includes('ฺ');
  const barePitch = normalized.replace(/[ํฺ]/g, '');
  const degree = THAI_DEGREES.indexOf(barePitch);
  if (degree < 0) throw new Error(`ไม่รู้จักโน้ตไทย “${pitch}”`);
  const octaveShift = hasUpperMark ? 1 : hasLowerMark ? -1 : Number(octaveAttribute || 0);
  const base = buildMajorScale(tuning)[degree];
  const midi = base.midi + (octaveShift * 12);
  return { ...base, octave: base.octave + octaveShift, midi };
};

const directChildren = (node, localName) => Array.from(node?.children || []).filter((child) => child.localName === localName);
const childText = (node, localName) => directChildren(node, localName)[0]?.textContent?.trim() || '';
const TRUE_VALUES = new Set(['true', '1', 'yes']);
const hasXmlFlag = (node, names) => names.some((name) => TRUE_VALUES.has(String(node?.getAttribute?.(name) || '').toLowerCase()));
const CADENCE_ATTRIBUTES = ['isCadence', 'isLukTok', 'is-cadence', 'is-luk-tok'];
const SUSTAIN_ATTRIBUTES = ['sustain', 'continuesPrevious', 'continues-previous'];

const applyBeatPerformance = (group, beat) => {
  if (beat.getAttribute('ornament') === 'sabat') {
    group.ornament = 'sabat';
    group.ornamentId = beat.getAttribute('ornament-id') || 'sabat';
    group.ornamentStart = hasXmlFlag(beat, ['ornament-start']);
    group.ornamentEnd = hasXmlFlag(beat, ['ornament-end']);
  }
  return group;
};

const parseMeasure = (measure) => {
  const beats = Array.from(measure.children || []).filter((child) => ['note', 'rest', 'group'].includes(child.localName));
  return beats.map((beat) => {
    if (beat.localName === 'rest') {
      const group = [{ rest: true, sustain: hasXmlFlag(beat, SUSTAIN_ATTRIBUTES) }];
      group.isLukTok = hasXmlFlag(beat, CADENCE_ATTRIBUTES);
      return applyBeatPerformance(group, beat);
    }
    const notes = beat.localName === 'group'
      ? Array.from(beat.children || []).filter((child) => ['note', 'rest'].includes(child.localName))
      : [beat];
    const group = notes.map((note) => note.localName === 'rest' ? ({
      rest: true,
      sustain: hasXmlFlag(note, SUSTAIN_ATTRIBUTES)
    }) : ({
      pitch: note.getAttribute('pitch'),
      sound: note.getAttribute('sound'),
      octave: note.hasAttribute('octave') ? Number(note.getAttribute('octave')) : 0,
      isCadence: hasXmlFlag(note, CADENCE_ATTRIBUTES)
    }));
    group.isLukTok = hasXmlFlag(beat, CADENCE_ATTRIBUTES) || group.some((event) => event.isCadence);
    return applyBeatPerformance(group, beat);
  });
};

export const parseThaiMusicXmlForMusicXml = (source) => {
  let xml;
  try {
    xml = new DOMParser().parseFromString(source, 'application/xml');
  } catch {
    throw new Error('ไฟล์ ThaiMusicXML ไม่ถูกต้อง');
  }
  if (xml.querySelector?.('parsererror') || xml.getElementsByTagName?.('parsererror')?.length) throw new Error('ไฟล์ ThaiMusicXML ไม่ถูกต้อง');
  const root = xml.documentElement;
  if (root?.localName !== 'thai-score' || root.namespaceURI !== THAI_MUSIC_XML_NAMESPACE || root.getAttribute('version') !== '1.0') {
    throw new Error('รองรับเฉพาะ ThaiMusicXML v1.0');
  }

  const header = directChildren(root, 'header')[0];
  const structure = directChildren(root, 'structure')[0];
  const ensemble = directChildren(root, 'ensemble')[0];
  const definitions = directChildren(ensemble, 'part');
  const sectionNames = new Map();
  const playOrder = [];
  const walkStructure = (parent) => Array.from(parent?.children || []).forEach((node) => {
    if (node.localName === 'repeat') {
      const times = Math.max(2, Number.parseInt(node.getAttribute('times'), 10) || 2);
      for (let index = 0; index < times; index += 1) walkStructure(node);
    } else if (node.localName === 'section') {
      const id = node.getAttribute('id');
      sectionNames.set(id, node.getAttribute('name') || id);
      playOrder.push(id);
    } else if (node.localName === 'play') {
      playOrder.push(node.getAttribute('section'));
    }
  });
  walkStructure(structure);

  const referencePartData = directChildren(root, 'part-data').find((item) => item.getAttribute('part') === definitions[0]?.getAttribute('id'));
  const parts = definitions.map((definition, partIndex) => {
    const id = definition.getAttribute('id');
    const partData = directChildren(root, 'part-data').find((item) => item.getAttribute('part') === id);
    const sections = new Map();
    directChildren(referencePartData, 'section-ref').forEach((referenceSection) => {
      const sectionId = referenceSection.getAttribute('section');
      const ownSection = directChildren(partData, 'section-ref').find((sectionRef) => sectionRef.getAttribute('section') === sectionId);
      const ownLines = directChildren(ownSection, 'line');
      const measures = directChildren(referenceSection, 'line').flatMap((referenceLine) => {
        const lineNumber = referenceLine.getAttribute('number');
        const ownLine = partIndex === 0
          ? referenceLine
          : ownLines.find((line) => line.getAttribute('number') === lineNumber);
        if (ownLine) return directChildren(ownLine, 'measure').map(parseMeasure);
        // A second hand may omit lines that belong to ordinary one-hand rows.
        // Keep both MusicXML parts aligned by mirroring their rhythmic grid as rests.
        return directChildren(referenceLine, 'measure').map((measure) => parseMeasure(measure).map((group) => group.map(() => ({ rest: true, forceRest: true }))));
      });
      sections.set(sectionId, measures);
    });
    return {
      id,
      name: childText(definition, 'instrument-name') || 'เครื่องดนตรีไทย',
      unpitched: definition.getAttribute('type') === 'unpitched',
      stack: definition.getAttribute('stack') || null,
      row: Number.parseInt(definition.getAttribute('row'), 10) || null,
      sections
    };
  });
  if (!parts.length || parts.every((part) => part.sections.size === 0)) throw new Error('ไม่พบข้อมูลโน้ตที่แปลงได้');

  const direction = directChildren(structure, 'direction')[0];
  const bpm = Math.max(1, Number.parseInt(childText(direction, 'bpm'), 10) || 160);
  const composerNode = directChildren(header, 'composer')[0];
  return {
    title: childText(header, 'title') || 'Thai Music Score',
    composer: childText(composerNode, 'text') || composerNode?.textContent?.trim() || '',
    bpm,
    playOrder: playOrder.length ? playOrder : [...new Set(parts.flatMap((part) => [...part.sections.keys()]))],
    sectionNames,
    parts
  };
};

const durationType = (duration) => {
  const standard = new Map([[4, 'whole'], [2, 'half'], [1, 'quarter'], [0.5, 'eighth'], [0.25, '16th'], [0.125, '32nd'], [0.0625, '64th'], [0.03125, '128th']]);
  const value = duration.numerator / duration.denominator;
  if (standard.has(value)) return { type: standard.get(value), dots: 0, tuplet: null };
  for (const [base, type] of standard) {
    if (value === base * 1.5) return { type, dots: 1, tuplet: null };
  }
  // Arbitrary sabat spacing is represented as an exact ratio against one
  // quarter note. This keeps MusicXML's visual type and sounding duration in
  // agreement (for n/d quarter notes: d actual notes in the time of n).
  return {
    type: 'quarter',
    dots: 0,
    tuplet: { actual: duration.denominator, normal: duration.numerator, normalType: 'quarter' }
  };
};

const pitchXml = (event, tuning) => {
  const pitch = resolveThaiPitch(event.pitch, event.octave, tuning);
  return `<pitch><step>${pitch.step}</step>${pitch.alter ? `<alter>${pitch.alter}</alter>` : ''}<octave>${pitch.octave}</octave></pitch>`;
};

const renderSingleNote = (event, duration, divisions, tuning, unpitched, instrumentId) => {
  const ticks = (duration.numerator * divisions) / duration.denominator;
  const notation = event.tupletNotation || durationType(duration);
  const timeModification = notation.tuplet ? `<time-modification><actual-notes>${notation.tuplet.actual}</actual-notes><normal-notes>${notation.tuplet.normal}</normal-notes><normal-type>${notation.tuplet.normalType || notation.type}</normal-type></time-modification>` : '';
  const ties = event.rest ? [] : [event.tieStop ? 'stop' : null, event.tieStart ? 'start' : null].filter(Boolean);
  const tieElements = ties.map((type) => `<tie type="${type}"/>`).join('');
  const notationElements = ties.map((type) => `<tied type="${type}"/>`);
  const notations = notationElements.length ? `<notations>${notationElements.join('')}</notations>` : '';
  const head = event.rest
    ? '<rest/>'
    : unpitched || event.sound
      ? `<unpitched><display-step>B</display-step><display-octave>4</display-octave></unpitched><instrument id="${instrumentId}"/>`
      : pitchXml(event, tuning);
  return `<note>${head}<duration>${ticks}</duration>${tieElements}<type>${notation.type}</type>${'<dot/>'.repeat(notation.dots)}${timeModification}${notations}</note>`;
};

const splitPrintableDuration = (duration) => {
  let units = Math.round(fractionNumber(duration) * EXPORT_TICKS_PER_QUARTER);
  const pieces = [];
  const values = [128, 64, 32, 16, 8, 4, 2, 1];
  values.forEach((unitsPerNote) => {
    while (units >= unitsPerNote) {
      pieces.push(fraction(unitsPerNote, EXPORT_TICKS_PER_QUARTER));
      units -= unitsPerNote;
    }
  });
  return pieces.length ? pieces : [fraction(1, EXPORT_TICKS_PER_QUARTER)];
};

const renderNote = (event, duration, divisions, tuning, unpitched, instrumentId) => {
  const pieces = splitPrintableDuration(duration);
  return pieces.map((piece, index) => renderSingleNote({
    ...event,
    tieStop: !event.rest && (event.tieStop || index > 0),
    tieStart: !event.rest && (event.tieStart || index < pieces.length - 1),
    tupletStart: false,
    tupletStop: false,
    tupletNotation: null
  }, piece, divisions, tuning, unpitched, instrumentId)).join('');
};

const quantizeMeasureEvents = (events, measureDuration) => {
  if (!events.length) return events;
  const totalUnits = Math.round(fractionNumber(measureDuration) * EXPORT_TICKS_PER_QUARTER);
  let exactCursor = fraction(0);
  let assignedUnits = 0;
  return events.map((event, index) => {
    exactCursor = addFractions(exactCursor, event.duration);
    const remainingEvents = events.length - index - 1;
    const desiredEnd = index === events.length - 1
      ? totalUnits
      : Math.round(fractionNumber(exactCursor) * EXPORT_TICKS_PER_QUARTER);
    const endUnits = Math.max(assignedUnits + 1, Math.min(desiredEnd, totalUnits - remainingEvents));
    const durationUnits = Math.max(1, endUnits - assignedUnits);
    assignedUnits = endUnits;
    return {
      ...event,
      duration: fraction(durationUnits, EXPORT_TICKS_PER_QUARTER),
      tupletId: null,
      tupletStart: false,
      tupletStop: false,
      tupletNotation: null
    };
  });
};

const allMeasureDenominators = (model) => model.parts.flatMap((part) => [...part.sections.values()].flatMap((measures) => measures.flatMap((beats) => {
  const beatCount = Math.max(1, beats.length);
  return beats.map((group) => fraction(2, beatCount * Math.max(1, group.length)).denominator);
})));

const groupIsCadence = (group) => Boolean(
  group?.isCadence
  || group?.isLukTok
  || group?.some?.((event) => event?.isCadence || event?.isLukTok)
);

/**
 * Resolves Thai slots onto one continuous timeline, then cuts Western bars at
 * cadence onsets. A cadence flag wins; the last slot is the v1.0 fallback.
 */
const buildWesternTimeline = (part, orderedSections, sectionNames) => {
  const events = [];
  const slots = [];
  const sectionMarkers = [];
  const cadenceBoundaries = [];
  let cursor = fraction(0);
  let thaiMeasure = 0;

  orderedSections.forEach((sectionId) => {
    const sectionMeasures = part.sections.get(sectionId) || [];
    sectionMeasures.forEach((sourceBeats, sectionMeasureIndex) => {
      thaiMeasure += 1;
      const beats = sourceBeats.length ? sourceBeats : [[{ rest: true }]];
      const slotDuration = fraction(2, beats.length);
      const explicitCadence = beats.findIndex(groupIsCadence);
      const cadenceSlot = explicitCadence >= 0 ? explicitCadence : beats.length - 1;
      cadenceBoundaries.push({ onset: addFractions(cursor, multiplyFraction(slotDuration, cadenceSlot)), thaiMeasure, thaiSlot: cadenceSlot + 1 });
      if (sectionMeasureIndex === 0) sectionMarkers.push({ onset: cursor, name: sectionNames.get(sectionId) || sectionId });

      let previousAttack = null;
      beats.forEach((sourceGroup, slotIndex) => {
        const group = sourceGroup.length ? sourceGroup : [{ rest: true }];
        const slotOnset = addFractions(cursor, multiplyFraction(slotDuration, slotIndex));
        slots.push({ onset: slotOnset, thaiMeasure, thaiSlot: slotIndex + 1, isLukTok: slotIndex === cadenceSlot });
        const eventDuration = fraction(slotDuration.numerator, slotDuration.denominator * group.length);
        group.forEach((sourceEvent, eventIndex) => {
          const onset = addFractions(slotOnset, multiplyFraction(eventDuration, eventIndex));
          if (sourceEvent.rest) {
            // ThaiMusicXML rests after an attack extend that attack. Leading
            // rests (and explicitly forced rests) remain real silence.
            if (previousAttack && !sourceEvent.forceRest) {
              previousAttack.duration = addFractions(previousAttack.duration, eventDuration);
            } else {
              events.push({ ...sourceEvent, rest: true, onset, duration: eventDuration });
              previousAttack = null;
            }
          } else {
            const attack = { ...sourceEvent, onset, duration: eventDuration };
            events.push(attack);
            previousAttack = attack;
          }
        });
      });
      cursor = addFractions(cursor, fraction(2));
    });
  });

  const firstCadence = cadenceBoundaries[0]?.onset;
  if (!firstCadence) return { measures: [], debugRows: [] };
  const ranges = [];
  if (compareFractions(firstCadence, fraction(0)) > 0) ranges.push({ start: fraction(0), end: firstCadence, number: 0, implicit: true, pickup: true });
  cadenceBoundaries.forEach((boundary, index) => {
    const end = cadenceBoundaries[index + 1]?.onset || cursor;
    if (compareFractions(end, boundary.onset) > 0) ranges.push({ start: boundary.onset, end, number: index + 1, implicit: false, pickup: false });
  });

  const measures = ranges.map((range) => {
    const measureEvents = [];
    events.forEach((event) => {
      const eventEnd = addFractions(event.onset, event.duration);
      const start = compareFractions(event.onset, range.start) < 0 ? range.start : event.onset;
      const end = compareFractions(eventEnd, range.end) > 0 ? range.end : eventEnd;
      if (compareFractions(start, end) >= 0) return;
      measureEvents.push({
        ...event,
        onset: subtractFractions(start, range.start),
        duration: subtractFractions(end, start),
        tieStop: !event.rest && compareFractions(event.onset, range.start) < 0,
        tieStart: !event.rest && compareFractions(eventEnd, range.end) > 0
      });
    });
    const markers = sectionMarkers
      .filter((marker) => compareFractions(marker.onset, range.start) >= 0 && compareFractions(marker.onset, range.end) < 0)
      .map((marker) => ({ ...marker, onset: subtractFractions(marker.onset, range.start) }));
    return { ...range, events: measureEvents, markers, duration: subtractFractions(range.end, range.start) };
  });

  const debugRows = slots.map((slot) => {
    const cadenceIndex = cadenceBoundaries.reduce((found, boundary, index) => compareFractions(boundary.onset, slot.onset) <= 0 ? index : found, -1);
    const westernStart = cadenceIndex >= 0 ? cadenceBoundaries[cadenceIndex].onset : fraction(0);
    return {
      'Thai measure': slot.thaiMeasure,
      'Thai slot': slot.thaiSlot,
      'Is Luk Tok': slot.isLukTok,
      'Western measure': cadenceIndex >= 0 ? cadenceIndex + 1 : 'pickup',
      'Western beat': 1 + fractionNumber(subtractFractions(slot.onset, westernStart))
    };
  });
  return { measures, debugRows };
};

// Export playback must preserve the editor grid exactly. Re-barring the last
// Thai slot as a Western downbeat creates an implicit pickup; several MusicXML
// players pad that pickup before playback and shift notes around the first bar
// line. Keeping one editor measure as one 2/4 MusicXML measure avoids that
// ambiguity while retaining equal subdivisions for compact note groups.
const buildEditorPlaybackTimeline = (part, orderedSections, sectionNames) => {
  const ranges = [];
  const slots = [];
  let cursor = fraction(0);

  orderedSections.forEach((sectionId) => {
    const sectionMeasures = part.sections.get(sectionId) || [];
    sectionMeasures.forEach((sourceBeats, sectionMeasureIndex) => {
      const beats = sourceBeats.length ? sourceBeats : [[{ rest: true }]];
      const slotDuration = fraction(2, beats.length);
      beats.forEach((sourceGroup, slotIndex) => {
        const group = sourceGroup.length ? sourceGroup : [{ rest: true }];
        slots.push({
          onset: addFractions(cursor, multiplyFraction(slotDuration, slotIndex)),
          duration: slotDuration,
          measureIndex: ranges.length,
          group,
          ornament: group.ornament,
          ornamentId: group.ornamentId
        });
      });
      const end = addFractions(cursor, fraction(2));
      ranges.push({
        start: cursor,
        end,
        number: ranges.length + 1,
        implicit: false,
        pickup: false,
        markers: sectionMeasureIndex === 0
          ? [{ onset: cursor, name: sectionNames.get(sectionId) || sectionId }]
          : [],
        duration: fraction(2)
      });
      cursor = end;
    });
  });

  const events = [];
  let previousAttack = null;
  let previousMeasureIndex = -1;
  for (let slotIndex = 0; slotIndex < slots.length;) {
    const slot = slots[slotIndex];
    if (slot.measureIndex !== previousMeasureIndex) previousAttack = null;
    if (slot.ornament === 'sabat') {
      let finalSlotIndex = slotIndex;
      while (finalSlotIndex + 1 < slots.length && slots[finalSlotIndex + 1].ornament === 'sabat' && slots[finalSlotIndex + 1].ornamentId === slot.ornamentId) finalSlotIndex += 1;
      const ornamentSlots = slots.slice(slotIndex, finalSlotIndex + 1);
      const notes = ornamentSlots.flatMap((item) => item.group.filter((event) => !event.rest));
      const ornamentStart = slot.onset;
      const finalSlot = ornamentSlots.at(-1);
      const ornamentEnd = addFractions(finalSlot.onset, finalSlot.duration);
      const isSingleSlotOrnament = finalSlotIndex === slotIndex;
      const finalAttackOnset = isSingleSlotOrnament ? ornamentEnd : finalSlot.onset;
      const onsetDivisor = isSingleSlotOrnament ? notes.length : Math.max(1, notes.length - 1);

      notes.forEach((sourceEvent, noteIndex) => {
        const onset = notes.length <= 1
          ? ornamentStart
          : addFractions(ornamentStart, fraction(
            (finalAttackOnset.numerator * ornamentStart.denominator - ornamentStart.numerator * finalAttackOnset.denominator) * noteIndex,
            finalAttackOnset.denominator * ornamentStart.denominator * onsetDivisor
          ));
        const nextOnset = noteIndex === notes.length - 1
          ? ornamentEnd
          : addFractions(ornamentStart, fraction(
            (finalAttackOnset.numerator * ornamentStart.denominator - ornamentStart.numerator * finalAttackOnset.denominator) * (noteIndex + 1),
            finalAttackOnset.denominator * ornamentStart.denominator * onsetDivisor
          ));
        events.push({
          ...sourceEvent,
          onset,
          duration: subtractFractions(nextOnset, onset),
          ...((isSingleSlotOrnament || noteIndex < notes.length - 1) && notes.length > 1
            ? { tupletId: `${slot.ornamentId}:${slotIndex}` }
            : {})
        });
      });
      if (!notes.length) events.push({ rest: true, onset: ornamentStart, duration: subtractFractions(ornamentEnd, ornamentStart) });
      previousAttack = notes.length ? events.at(-1) : null;
      previousMeasureIndex = finalSlot.measureIndex;
      slotIndex = finalSlotIndex + 1;
      continue;
    }

    const eventDuration = fraction(slot.duration.numerator, slot.duration.denominator * slot.group.length);
    slot.group.forEach((sourceEvent, eventIndex) => {
      const onset = addFractions(slot.onset, multiplyFraction(eventDuration, eventIndex));
      if (sourceEvent.rest) {
        if (previousAttack && !sourceEvent.forceRest) previousAttack.duration = addFractions(previousAttack.duration, eventDuration);
        else {
          events.push({ ...sourceEvent, rest: true, onset, duration: eventDuration });
          previousAttack = null;
        }
      } else {
        const attack = { ...sourceEvent, onset, duration: eventDuration };
        events.push(attack);
        previousAttack = attack;
      }
    });
    previousMeasureIndex = slot.measureIndex;
    slotIndex += 1;
  }

  const measures = ranges.map((range) => ({
    ...range,
    events: events.flatMap((event) => {
      const eventEnd = addFractions(event.onset, event.duration);
      const start = compareFractions(event.onset, range.start) < 0 ? range.start : event.onset;
      const end = compareFractions(eventEnd, range.end) > 0 ? range.end : eventEnd;
      if (compareFractions(start, end) >= 0) return [];
      return [{
        ...event,
        onset: subtractFractions(start, range.start),
        duration: subtractFractions(end, start),
        tieStop: !event.rest && compareFractions(event.onset, range.start) < 0,
        tieStart: !event.rest && compareFractions(eventEnd, range.end) > 0
      }];
    }),
    markers: range.markers.map((marker) => ({ ...marker, onset: subtractFractions(marker.onset, range.start) }))
  }));

  return { measures, debugRows: [] };
};

// First resolve web-only performance timing (such as sabat), then re-cut that
// audible timeline at Thai cadence onsets. This preserves what users hear in
// the editor while still placing each luk tok on beat one of the next Western
// measure.
const buildSabatCadenceTimeline = (part, orderedSections, sectionNames) => {
  const editorTimeline = buildEditorPlaybackTimeline(part, orderedSections, sectionNames);
  const globalEvents = editorTimeline.measures.flatMap((measure, index) => measure.events.map((event) => ({
    ...event,
    onset: addFractions(fraction(index * 2), event.onset)
  })));
  const globalMarkers = editorTimeline.measures.flatMap((measure, index) => measure.markers.map((marker) => ({
    ...marker,
    onset: addFractions(fraction(index * 2), marker.onset)
  })));
  const cadenceBoundaries = [];
  let cursor = fraction(0);

  orderedSections.forEach((sectionId) => {
    const sectionMeasures = part.sections.get(sectionId) || [];
    sectionMeasures.forEach((sourceBeats) => {
      const beats = sourceBeats.length ? sourceBeats : [[{ rest: true }]];
      const slotDuration = fraction(2, beats.length);
      const explicitCadence = beats.findIndex(groupIsCadence);
      const cadenceSlot = explicitCadence >= 0 ? explicitCadence : beats.length - 1;
      cadenceBoundaries.push(addFractions(cursor, multiplyFraction(slotDuration, cadenceSlot)));
      cursor = addFractions(cursor, fraction(2));
    });
  });

  const firstCadence = cadenceBoundaries[0];
  if (!firstCadence) return editorTimeline;
  const ranges = [];
  if (compareFractions(firstCadence, fraction(0)) > 0) ranges.push({ start: fraction(0), end: firstCadence, number: 0, implicit: true, pickup: true });
  cadenceBoundaries.forEach((start, index) => {
    const end = cadenceBoundaries[index + 1] || cursor;
    if (compareFractions(end, start) > 0) ranges.push({ start, end, number: index + 1, implicit: false, pickup: false });
  });

  const measures = ranges.map((range) => ({
    ...range,
    duration: subtractFractions(range.end, range.start),
    events: globalEvents.flatMap((event) => {
      const eventEnd = addFractions(event.onset, event.duration);
      const start = compareFractions(event.onset, range.start) < 0 ? range.start : event.onset;
      const end = compareFractions(eventEnd, range.end) > 0 ? range.end : eventEnd;
      if (compareFractions(start, end) >= 0) return [];
      return [{
        ...event,
        onset: subtractFractions(start, range.start),
        duration: subtractFractions(end, start),
        tieStop: !event.rest && (event.tieStop || compareFractions(event.onset, range.start) < 0),
        tieStart: !event.rest && (event.tieStart || compareFractions(eventEnd, range.end) > 0)
      }];
    }),
    markers: globalMarkers
      .filter((marker) => compareFractions(marker.onset, range.start) >= 0 && compareFractions(marker.onset, range.end) < 0)
      .map((marker) => ({ ...marker, onset: subtractFractions(marker.onset, range.start) }))
  }));

  measures.forEach((measure) => {
    measure.events = quantizeMeasureEvents(measure.events, measure.duration);
  });

  return { measures, debugRows: buildWesternTimeline(part, orderedSections, sectionNames).debugRows };
};

export const buildCadenceDebugTable = (model) => {
  const orderedSections = model.playOrder.length ? model.playOrder : [...model.sectionNames.keys()];
  const firstPart = model.parts[0];
  return firstPart ? buildWesternTimeline(firstPart, orderedSections, model.sectionNames).debugRows : [];
};

export const thaiMusicXmlModelToMusicXml = (model, options = {}) => {
  const tuning = parseStartingPitch(options.startingPitch || 'C4');
  const fifths = FIFTHS_BY_TONIC[`${tuning.step}${tuning.alter === 1 ? '#' : tuning.alter === -1 ? 'b' : ''}`] ?? 0;
  const orderedSections = model.playOrder.length ? model.playOrder : [...model.sectionNames.keys()];
  const timelines = new Map(model.parts.map((part) => [part.id, buildSabatCadenceTimeline(part, orderedSections, model.sectionNames)]));
  const generatedDenominators = [...timelines.values()].flatMap((timeline) => timeline.measures.flatMap((measure) => measure.events.map((event) => event.duration.denominator)));
  const divisions = [...allMeasureDenominators(model), ...generatedDenominators].reduce((value, denominator) => lcm(value, denominator), 1);
  if (options.debug && typeof console !== 'undefined' && typeof console.table === 'function') console.table(buildCadenceDebugTable(model));
  const partList = model.parts.map((part, index) => {
    const instrumentId = `${part.id}-I1`;
    const midiProgram = MIDI_PROGRAM_BY_NAME.find(([name]) => part.name.includes(name))?.[1] || 14;
    return `<score-part id="${escapeXml(part.id)}"><part-name>${escapeXml(part.name)}</part-name><score-instrument id="${escapeXml(instrumentId)}"><instrument-name>${escapeXml(part.name)}</instrument-name></score-instrument><midi-instrument id="${escapeXml(instrumentId)}"><midi-channel>${part.unpitched ? 10 : Math.min(index + 1, 16)}</midi-channel>${part.unpitched ? '<midi-unpitched>39</midi-unpitched>' : `<midi-program>${midiProgram}</midi-program>`}</midi-instrument></score-part>`;
  }).join('');

  const parts = model.parts.map((part) => {
    const instrumentId = `${part.id}-I1`;
    const timeline = timelines.get(part.id);
    const measures = timeline.measures.map((measure, measureIndex) => {
      let contents = '';
      if (measureIndex === 0) {
        contents += `<attributes><divisions>${divisions}</divisions><key><fifths>${fifths}</fifths></key><time><beats>2</beats><beat-type>4</beat-type></time><clef><sign>${part.unpitched ? 'percussion' : 'G'}</sign><line>2</line></clef></attributes>`;
        contents += `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${model.bpm}</per-minute></metronome></direction-type><sound tempo="${model.bpm}"/></direction>`;
      }
      const markers = [...measure.markers];
      measure.events.forEach((event) => {
        while (markers.length && compareFractions(markers[0].onset, event.onset) <= 0) {
          contents += `<direction placement="above"><direction-type><rehearsal>${escapeXml(markers.shift().name)}</rehearsal></direction-type></direction>`;
        }
        contents += renderNote(event, event.duration, divisions, tuning, part.unpitched, instrumentId);
      });
      markers.forEach((marker) => { contents += `<direction placement="above"><direction-type><rehearsal>${escapeXml(marker.name)}</rehearsal></direction-type></direction>`; });
      return `<measure number="${measure.number}"${measure.implicit ? ' implicit="yes"' : ''}>${contents}</measure>`;
    });
    return `<part id="${escapeXml(part.id)}">${measures.join('')}</part>`;
  }).join('');

  const work = `<work><work-title>${escapeXml(model.title)}</work-title></work>`;
  const identification = model.composer ? `<identification><creator type="composer">${escapeXml(model.composer)}</creator><encoding><software>Thai Music Editor</software></encoding></identification>` : '<identification><encoding><software>Thai Music Editor</software></encoding></identification>';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n<score-partwise version="4.0">${work}${identification}<part-list>${partList}</part-list>${parts}</score-partwise>`;
};

export const thaiMusicXmlToMusicXml = (source, options = {}) => thaiMusicXmlModelToMusicXml(parseThaiMusicXmlForMusicXml(source), options);
