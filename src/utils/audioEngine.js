import { INSTRUMENT_CONFIG } from './instrumentConfig';

let audioCtx = null;
let masterGainNode = null;
let masterCompressorNode = null;
const audioBufferCache = {};
const audioBufferPromiseCache = {};
const activeSources = new Set();
const trackGainNodes = {};
const clipGainNodes = {};
const DEFAULT_START_LEAD_TIME = 0.015;

const getAudioContext = () => {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  audioCtx = new Ctx({ latencyHint: 'playback' });

  masterGainNode = audioCtx.createGain();
  masterGainNode.gain.value = 1;

  masterCompressorNode = audioCtx.createDynamicsCompressor();
  masterCompressorNode.threshold.value = -18;
  masterCompressorNode.knee.value = 18;
  masterCompressorNode.ratio.value = 3;
  masterCompressorNode.attack.value = 0.003;
  masterCompressorNode.release.value = 0.18;

  masterGainNode.connect(masterCompressorNode);
  masterCompressorNode.connect(audioCtx.destination);

  return audioCtx;
};

const getOutputNode = () => {
  const ctx = getAudioContext();
  return masterGainNode || ctx.destination;
};

const getFormattedNote = (note, eng) => {
  const octave = parseInt(eng.replace(/\D/g, ''), 10);
  if (octave >= 5) return note + '\u0E4D';
  if (octave === 2) return note + '\u0E3A\u200B';
  if (octave === 3) return note + '\u0E3A';
  return note;
};

const safeAudioNow = () => {
  const ctx = getAudioContext();
  return ctx.currentTime;
};

// ⭐ หา key ของโน้ตจากชื่อโน้ตที่จัดรูปแบบแล้ว (ใช้กรณี buffer ยังไม่ถูกโหลด)
const findKeyByFormattedNote = (instrumentId, noteStr) => {
  const instrument = INSTRUMENT_CONFIG[instrumentId];
  if (!instrument?.keys) return null;
  return instrument.keys.find((k) => getFormattedNote(k.thai, k.eng) === noteStr) || null;
};

const normalizeScheduledTime = (whenSec) => {
  const ctx = getAudioContext();
  const minWhen = ctx.currentTime + DEFAULT_START_LEAD_TIME;
  if (typeof whenSec !== 'number' || Number.isNaN(whenSec)) return minWhen;
  return Math.max(minWhen, whenSec);
};

const createBufferedSource = (buffer, volumeLevel, whenSec, destination) => {
  const ctx = getAudioContext();
  const startAt = normalizeScheduledTime(whenSec);

  const source = ctx.createBufferSource();
  const gainNode = ctx.createGain();
  source.buffer = buffer;

  const normalizedGain = Math.max(0, Math.min(100, volumeLevel)) / 100;
  gainNode.gain.cancelScheduledValues(startAt);
  gainNode.gain.setValueAtTime(0.0001, Math.max(0, startAt - 0.004));
  gainNode.gain.linearRampToValueAtTime(normalizedGain, startAt + 0.003);

  source.connect(gainNode);
  gainNode.connect(destination || getOutputNode());

  activeSources.add(source);
  source.onended = () => {
    activeSources.delete(source);
    try { source.disconnect(); } catch (_) {}
    try { gainNode.disconnect(); } catch (_) {}
  };

  source.start(startAt);
  return source;
};

const loadSoundBuffer = async (instrumentId, key) => {
  const instrument = INSTRUMENT_CONFIG[instrumentId];
  if (!instrument || !key?.audio) return null;

  const finalNoteStr = getFormattedNote(key.thai, key.eng);

  if (!audioBufferCache[instrumentId]) audioBufferCache[instrumentId] = {};
  if (!audioBufferPromiseCache[instrumentId]) audioBufferPromiseCache[instrumentId] = {};

  if (audioBufferCache[instrumentId][finalNoteStr]) {
    return audioBufferCache[instrumentId][finalNoteStr];
  }

  if (!audioBufferPromiseCache[instrumentId][finalNoteStr]) {
    audioBufferPromiseCache[instrumentId][finalNoteStr] = (async () => {
      const ctx = getAudioContext();
      const response = await fetch(`/sounds/${instrumentId}/${key.audio}`, { cache: 'force-cache' });
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      audioBufferCache[instrumentId][finalNoteStr] = audioBuffer;
      return audioBuffer;
    })().catch((err) => {
      delete audioBufferPromiseCache[instrumentId][finalNoteStr];
      console.error('โหลดเสียงไม่สำเร็จ:', key.audio, err);
      return null;
    });
  }

  return audioBufferPromiseCache[instrumentId][finalNoteStr];
};

export const initAudioContext = async () => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
};

export const getAudioCurrentTime = () => safeAudioNow();

// ⭐ Gain ต่อ Track: ให้ Mute/Solo ควบคุมระดับเสียงของแต่ละ Track ได้จริง (รวมถึงตอนกำลังเล่น)
export const getTrackGainNode = (trackId) => {
  const ctx = getAudioContext();
  if (!trackGainNodes[trackId]) {
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(getOutputNode());
    trackGainNodes[trackId] = g;
  }
  return trackGainNodes[trackId];
};

export const setTrackGain = (trackId, value) => {
  const g = trackGainNodes[trackId];
  if (g) {
    const ctx = getAudioContext();
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(v, ctx.currentTime);
  }
};

// ⭐ Gain ต่อแทรก (clip): ให้ระดับเสียงของแต่ละแทรกควบคุมได้จริง (รวมถึงตอนกำลังเล่น)
export const getClipGainNode = (clipId) => {
  const ctx = getAudioContext();
  if (!clipGainNodes[clipId]) {
    const g = ctx.createGain();
    g.gain.value = 1;
    clipGainNodes[clipId] = g;
  }
  return clipGainNodes[clipId];
};

export const setClipGain = (clipId, value) => {
  const g = clipGainNodes[clipId];
  if (g) {
    const ctx = getAudioContext();
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(v, ctx.currentTime);
  }
};

// ⭐ เชื่อม Gain แทรกเข้ากับ Gain ของ Track (กันเชื่อมซ้ำ → เสียงไม่เพี้ยน)
export const connectClipGain = (clipId, trackGain) => {
  const g = clipGainNodes[clipId];
  if (!g) return;
  if (g._dest !== trackGain) {
    if (g._dest) {
      try { g.disconnect(g._dest); } catch (_) {}
    }
    g.connect(trackGain);
    g._dest = trackGain;
  }
};

export const preloadSounds = async (instrumentId) => {
  const instrument = INSTRUMENT_CONFIG[instrumentId];
  if (!instrument) return;

  const loadPromises = instrument.keys
    .filter((key) => key.audio)
    .map((key) => loadSoundBuffer(instrumentId, key));

  await Promise.all(loadPromises);
  console.log(`เครื่องดนตรี ${instrumentId} โหลดลง RAM เรียบร้อยแล้ว!`);
};

export const preloadAllSounds = async () => {
  const instrumentIds = Object.keys(INSTRUMENT_CONFIG || {});
  await Promise.allSettled(instrumentIds.map((instrumentId) => preloadSounds(instrumentId)));
};

// ⭐ ตัวเลข generation ใช้กันเสียงหลุดหลังกดหยุด: ถ้ากำลังโหลด buffer อยู่แล้วมีคำสั่งหยุดแทรกเข้ามา ให้ยกเลิกการเล่นโน้ตนั้นทิ้ง
let noteGeneration = 0;

// ⭐ scheduleNote เวอร์ชันใหม่: ถ้า buffer ยังไม่ถูกโหลด/ถอดรหัส จะโหลดให้อัตโนมัติแล้วค่อยเล่นตามเวลาที่กำหนด
//    ทำให้ไม่มีโน้ตหลุด (dropped note) แม้กดเล่นครั้งแรกทันที
const scheduleNote = async (instrumentId, noteChar, whenSec, volumeLevel = 100, destination) => {
  if (!noteChar || noteChar === '-') return null;
  const cleanNote = noteChar.trim();
  if (!INSTRUMENT_CONFIG[instrumentId]) return null;

  let buffer = audioBufferCache[instrumentId]?.[cleanNote];
  if (!buffer) {
    const myGen = noteGeneration;
    const key = findKeyByFormattedNote(instrumentId, cleanNote);
    buffer = key ? await loadSoundBuffer(instrumentId, key) : null;
    if (myGen !== noteGeneration) return null; // หยุดเล่นไปแล้วระหว่างโหลด
    if (!buffer) return null;
  }

  return createBufferedSource(buffer, volumeLevel, whenSec, destination);
};

export { scheduleNote };

export const playNote = (instrumentId, noteChar, volumeLevel = 100) => {
  const now = safeAudioNow();
  return scheduleNote(instrumentId, noteChar, now + DEFAULT_START_LEAD_TIME, volumeLevel);
};

export const stopAllScheduledNotes = () => {
  noteGeneration += 1;
  const ctx = getAudioContext();
  const stopAt = ctx.currentTime;
  Array.from(activeSources).forEach((source) => {
    try {
      source.stop(stopAt);
    } catch (_) {
      // ignore already-ended sources
    }
  });
  activeSources.clear();
};

// ⭐ ระบบ "เจ้าของเสียงเพียงหนึ่งเดียว" (single-owner playback)
//    ตัวเล่น 2 ตัว (Music Editor กับ Arranger) ใช้ AudioEngine ตัวเดียวกัน
//    ถ้าตัวไหนเริ่มเล่น ตัวก่อนหน้าต้องถูกสั่งหยุดทันที กันเสียงซ้อนจากโปรเจกต์อื่น
let playbackOwnerStop = null;

export const claimPlaybackOwnership = (stopFn) => {
  if (playbackOwnerStop && playbackOwnerStop !== stopFn) {
    try { playbackOwnerStop(); } catch (_) {}
  }
  playbackOwnerStop = stopFn;
};

export const releasePlaybackOwnership = (stopFn) => {
  if (playbackOwnerStop === stopFn) playbackOwnerStop = null;
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      initAudioContext().catch(() => {});
    }
  });
}
