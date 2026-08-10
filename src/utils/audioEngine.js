import { INSTRUMENT_CONFIG } from './instrumentConfig';

let audioCtx = null;
let masterGainNode = null;
let masterCompressorNode = null;
const audioBufferCache = {};
const audioBufferPromiseCache = {};
const activeSources = new Set();
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

const normalizeScheduledTime = (whenSec) => {
  const ctx = getAudioContext();
  const minWhen = ctx.currentTime + DEFAULT_START_LEAD_TIME;
  if (typeof whenSec !== 'number' || Number.isNaN(whenSec)) return minWhen;
  return Math.max(minWhen, whenSec);
};

const createBufferedSource = (buffer, volumeLevel, whenSec) => {
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
  gainNode.connect(getOutputNode());

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

export const scheduleNote = (instrumentId, noteChar, whenSec, volumeLevel = 100) => {
  if (!noteChar || noteChar === '-') return null;
  const cleanNote = noteChar.trim();
  const buffer = audioBufferCache[instrumentId]?.[cleanNote];
  if (!buffer) return null;
  return createBufferedSource(buffer, volumeLevel, whenSec);
};

export const playNote = (instrumentId, noteChar, volumeLevel = 100) => {
  const now = safeAudioNow();
  return scheduleNote(instrumentId, noteChar, now + DEFAULT_START_LEAD_TIME, volumeLevel);
};

export const stopAllScheduledNotes = () => {
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

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      initAudioContext().catch(() => {});
    }
  });
}
