import { INSTRUMENT_CONFIG } from './instrumentConfig';

let audioCtx = null;
let masterGainNode = null;
let masterCompressorNode = null;
let masterAnalyserNode = null;
const audioBufferCache = {};
const audioBufferPromiseCache = {};
const activeSources = new Set();
const trackGainNodes = {};
const trackPanNodes = {};
const trackAnalyserNodes = {};
const clipGainNodes = {};
const DEFAULT_START_LEAD_TIME = 0.015;
const MAX_TIMELINE_LATENESS = 0.01;
let primeAudioPromise = null;
let audioResumeTimer = null;

const requestAudioResume = () => {
  if (!audioCtx || audioCtx.state === 'running' || audioCtx.state === 'closed') return;
  if (audioResumeTimer) clearTimeout(audioResumeTimer);
  audioResumeTimer = setTimeout(() => {
    audioResumeTimer = null;
    if (audioCtx && audioCtx.state !== 'running' && audioCtx.state !== 'closed') {
      audioCtx.resume().catch(() => {});
    }
  }, 25);
};

const getAudioContext = () => {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  // ⭐ เน้นตอบสนองตอนกดเล่น/กดโน้ตให้เร็วที่สุด ลดอาการรอ output path ตื่นตัว
  audioCtx = new Ctx({ latencyHint: 'interactive' });
  // Chrome/Edge may suspend or interrupt Web Audio when a window is minimized.
  // Once the context has been unlocked by playback, immediately request a
  // resume whenever the browser changes it away from the running state.
  audioCtx.addEventListener?.('statechange', requestAudioResume);

  masterGainNode = audioCtx.createGain();
  masterGainNode.gain.value = 1;

  masterCompressorNode = audioCtx.createDynamicsCompressor();
  masterCompressorNode.threshold.value = -18;
  masterCompressorNode.knee.value = 18;
  masterCompressorNode.ratio.value = 3;
  // ⭐ แก้ทรานเซียนต์เพี้ยน: attack เดิม 0.003 วินาที + ratio 3 → compressor ตอบสนองแรงเกินไป
  //    โน้ต percussion (กลอง/ฉิ่ง) ที่มี transient แรงจะถูกบีบจนเสียงแหลม/ขาดรายละเอียด
  //    ปรับ attack ให้ช้าลงเล็กน้อย compressor จะ "ปล่อยผ่าน" transient สั้นๆ แล้วค่อยบีบส่วนต่อเนื่อง
  masterCompressorNode.attack.value = 0.008;
  masterCompressorNode.release.value = 0.22;

  masterAnalyserNode = audioCtx.createAnalyser();
  masterAnalyserNode.fftSize = 256;
  masterAnalyserNode.smoothingTimeConstant = 0.72;

  masterGainNode.connect(masterCompressorNode);
  masterCompressorNode.connect(masterAnalyserNode);
  masterAnalyserNode.connect(audioCtx.destination);

  return audioCtx;
};

const getOutputNode = () => {
  // ⭐ แก้บั๊ก fall-through ไป destination ตรง (ข้าม compressor):
  //    เรียก getAudioContext() ก่อนเสมอ เพื่อให้ masterGainNode ถูกสร้างแน่นอน
  //    แล้วค่อยใช้ masterGainNode ตรงๆ ไม่มี fallback → สัญญาณทุกเส้นทางผ่าน compressor ตามที่ออกแบบ
  const ctx = getAudioContext();
  if (!masterGainNode) {
    // safety net: ถ้าด้วยเหตุผลบางอย่าง masterGainNode ยังไม่ถูกสร้าง ให้สร้างตอนนี้
    masterGainNode = ctx.createGain();
    masterGainNode.gain.value = 1;
    masterGainNode.connect(masterCompressorNode || ctx.destination);
  }
  return masterGainNode;
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
  const ATTACK = 0.003;          // ⭐ ramp ขึ้นตอนเริ่มโน้ต กันคลิก
  const RELEASE = 0.012;         // ⭐ ระยะ ramp ลงตอนหยุด กันเสียงช็อต

  gainNode.gain.cancelScheduledValues(startAt);
  gainNode.gain.setValueAtTime(0.0001, Math.max(0, startAt - 0.004));
  gainNode.gain.linearRampToValueAtTime(normalizedGain, startAt + ATTACK);

  source.connect(gainNode);
  gainNode.connect(destination || getOutputNode());

  // ⭐ จำเวลาที่โน้ตจะเริ่มเล่นไว้ เพื่อให้คำสั่งหยุด (stopAllScheduledNotes)
  //    หยุดโน้ตที่ยังไม่ทันเริ่ม (จองไว้ในอนาคต) ได้อย่างถูกต้อง
  source._startAt = startAt;
  source._gainNode = gainNode;
  source._release = RELEASE;
  source._normalizedGain = normalizedGain;

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
      // ⭐ แก้บั๊ก cache buster: เดิมใส่ ?v=${Date.now()} + cache: 'no-store' ทำให้ browser ไม่ cache ไฟล์เลย
      //    โหลดซ้ำทุกครั้ง แม้จะเป็นโน้ตเดิม → เปลือง bandwidth (เคสโหลดหลายร้อย buffer)
      //    ใช้ HTTP cache ปกติ: เบราว์เซอร์จะเก็บไฟล์ไว้เอง + ส่ง If-Modified-Since ตอนไฟล์ไม่เปลี่ยน (304 Not Modified)
      //    ถ้าต้องการบังคับโหลดใหม่ตอน dev ให้ผู้ใช้ hard-refresh หรือเคลียร์ cache เอง
      const response = await fetch(`/sounds/${instrumentId}/${key.audio}`, { cache: 'default' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      // ⭐ ใช้ arrayBuffer ตรงๆ ไม่ slice(0) เพื่อลดการคัดลอก memory (decodeAudioData รองรับโดยตรง)
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
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
  // Mobile Safari can report `interrupted` after locking the screen, switching
  // apps, or routing audio to another device. Resume every non-running context,
  // not only the standard `suspended` state.
  if (ctx.state !== 'running' && ctx.state !== 'closed') {
    await ctx.resume();
  }
  // ⭐ แก้เสียงกระตุกตอนกดเล่น: warm up output node ด้วย BufferSource เงียบ ๆ ตัวสั้น ๆ
  //    เพื่อบังคับให้ browser เปิด audio output path ก่อน — ลด latency spike ตอนโน้ตแรก
  try {
    if (ctx.state === 'running' && !ctx._warmed) {
      const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const warmSrc = ctx.createBufferSource();
      warmSrc.buffer = silentBuf;
      const warmGain = ctx.createGain();
      warmGain.gain.value = 0;
      warmSrc.connect(warmGain);
      warmGain.connect(ctx.destination);
      warmSrc.start(0);
      ctx._warmed = true;
    }
  } catch (_) {}
  return ctx;
};

export const getAudioCurrentTime = () => safeAudioNow();

// ⭐ Gain ต่อ Track: ให้ Mute/Solo ควบคุมระดับเสียงของแต่ละ Track ได้จริง (รวมถึงตอนกำลังเล่น)
export const getTrackGainNode = (trackId) => {
  const ctx = getAudioContext();
  if (!trackGainNodes[trackId]) {
    const g = ctx.createGain();
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : ctx.createGain();
    const analyser = ctx.createAnalyser();
    g.gain.value = 1;
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    g.connect(panner);
    panner.connect(analyser);
    analyser.connect(getOutputNode());
    trackGainNodes[trackId] = g;
    trackPanNodes[trackId] = panner;
    trackAnalyserNodes[trackId] = analyser;
  }
  return trackGainNodes[trackId];
};

export const setTrackPan = (trackId, value) => {
  getTrackGainNode(trackId);
  const panner = trackPanNodes[trackId];
  if (!panner?.pan) return;
  const ctx = getAudioContext();
  const v = Math.max(-1, Math.min(1, Number(value) || 0));
  panner.pan.cancelScheduledValues(ctx.currentTime);
  panner.pan.setValueAtTime(v, ctx.currentTime);
};

export const setMasterGain = (value) => {
  const ctx = getAudioContext();
  const v = Math.max(0, Math.min(2, Number(value) || 0));
  masterGainNode.gain.cancelScheduledValues(ctx.currentTime);
  masterGainNode.gain.setValueAtTime(v, ctx.currentTime);
};

const readAnalyserLevel = (analyser) => {
  if (!analyser) return 0;
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = (samples[i] - 128) / 128;
    sum += sample * sample;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 2.8);
};

export const getTrackLevel = (trackId) => readAnalyserLevel(trackAnalyserNodes[trackId]);
export const getMasterLevel = () => readAnalyserLevel(masterAnalyserNode);

export const setTrackGain = (trackId, value) => {
  const g = trackGainNodes[trackId];
  if (g) {
    const ctx = getAudioContext();
    const v = Math.max(0, Math.min(2, Number(value) || 0));
    // ⭐ แก้บั๊กดีเลขณะปรับระดับเสียง (เร็วขึ้น + ไม่มีคลิก):
    //    รูปแบบเดิม: anchor + linearRampToValueAtTime(0.010s = 10ms)
    //      - slider ส่ง onChange ~60Hz ขณะลาก → ทุก event ยกเลิก ramp เก่าและเริ่ม ramp ใหม่ 10ms
    //      - gain วิ่งไล่ตาม UI ตลอด → รู้สึก "ดีเล" (โดยเฉพาะลากเร็ว)
    //    รูปแบบใหม่ (ใช้กันใน DAW ชั้นนำ เช่น Logic/Pro Tools):
    //      - cancelScheduledValues กัน ramp เก่าค้าง
    //      - setValueAtTime แบบ snap - gain เปลี่ยนทันทีตาม UI ไม่มีดีเล
    //      - ลาก slider: gain เปลี่ยนทีละน้อยตาม pixel → ไม่คลิก (คลิกเกิดจากการกระโดดค่าครั้งเดียวเยอะๆ)
    //      - กรณีอยากป้องกันคลิกจากการกระโดดค่า (เช่น mute toggle 0<->1): เรียก fadeTrackGain() แทน
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(v, now);
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
    // ⭐ เหมือน setTrackGain: snap ทันที ไม่ ramp เพื่อกำจัดดีเลขณะลาก slider
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(v, now);
  }
};

// ⭐ สำหรับกรณีกระโดดค่าครั้งใหญ่ (toggle mute on/off, fade in/out) — ใช้ ramp สั้นๆ 5ms กันคลิก
//    เรียกจาก UI ตอนกด mute/solo หรือ fade track เข้า/ออก
export const fadeTrackGain = (trackId, value, rampSec = 0.005) => {
  const g = trackGainNodes[trackId];
  if (g) {
    const ctx = getAudioContext();
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    const currentVal = (typeof g.gain.value === 'number') ? g.gain.value : 1;
    g.gain.setValueAtTime(currentVal, now);
    g.gain.linearRampToValueAtTime(v, now + rampSec);
  }
};

export const fadeClipGain = (clipId, value, rampSec = 0.005) => {
  const g = clipGainNodes[clipId];
  if (g) {
    const ctx = getAudioContext();
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    const currentVal = (typeof g.gain.value === 'number') ? g.gain.value : 1;
    g.gain.setValueAtTime(currentVal, now);
    g.gain.linearRampToValueAtTime(v, now + rampSec);
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

// โหลดเฉพาะโน้ตที่ต้องใช้ทันที เช่น โน้ตแรกตอนกด Play
// ช่วยให้เริ่มได้สะอาดโดยไม่ต้องรอโหลดทั้งเครื่องดนตรี
export const preloadNote = async (instrumentId, noteChar) => {
  if (!noteChar || noteChar === '-' || !INSTRUMENT_CONFIG[instrumentId]) return null;
  const cleanNote = String(noteChar).trim();
  const cached = audioBufferCache[instrumentId]?.[cleanNote];
  if (cached) return cached;
  const key = findKeyByFormattedNote(instrumentId, cleanNote);
  return key ? loadSoundBuffer(instrumentId, key) : null;
};

export const preloadAllSounds = async () => {
  const instrumentIds = Object.keys(INSTRUMENT_CONFIG || {});
  await Promise.allSettled(instrumentIds.map((instrumentId) => preloadSounds(instrumentId)));
};

export const primeAudioEngine = async () => {
  if (primeAudioPromise) return primeAudioPromise;

  primeAudioPromise = (async () => {
    // เริ่มดาวน์โหลด/ถอดรหัสเสียงทันทีตั้งแต่หน้าเว็บเปิด แม้ AudioContext ยังรอ user gesture
    // เดิม await resume() ก่อน ทำให้ preload ทั้งหมดเพิ่งเริ่มหลังผู้ใช้กดเข้า Editor
    const resumeTask = initAudioContext().catch(() => null);
    const preloadTask = preloadAllSounds();
    await Promise.allSettled([resumeTask, preloadTask]);
    return true;
  })().catch((err) => {
    primeAudioPromise = null;
    throw err;
  });

  return primeAudioPromise;
};

// ⭐ ตัวเลข generation ใช้กันเสียงหลุดหลังกดหยุด: ถ้ากำลังโหลด buffer อยู่แล้วมีคำสั่งหยุดแทรกเข้ามา ให้ยกเลิกการเล่นโน้ตนั้นทิ้ง
// ⭐ แก้ race condition ของ noteGeneration:
//    เดิม: ตรวจ noteGeneration แค่จุดเดียว (หลัง await loadSoundBuffer) →
//      ถ้า generation เปลี่ยนระหว่างนั้น return null แต่ promise การโหลด buffer ยัง resolve อยู่และถูก cache ไว้
//      ตอนกดเล่นครั้งใหม่ทันที อาจได้ buffer เก่า (จากการโหลดครั้งก่อน) มา schedule ทับกับ generation ปัจจุบัน
//    วิธีแก้: เก็บ in-flight tasks เป็น "generation token" — สร้าง token ตอนเริ่มโน้ต ถ้า token ถูก invalidate ก็ drop note นั้นทั้งเส้นทาง
//    ส่วนการ cache buffer ยังเก็บไว้ตามเดิม (เป็น asset ที่ไม่ขึ้นกับ playback)
const noteGenerations = new Map();  // ⭐ generation counter ต่อ token id ใช้เช็คทุก stage
let tokenCounter = 0;

const createToken = (groupId = null) => {
  tokenCounter += 1;
  const id = tokenCounter;
  noteGenerations.set(id, { active: true, groupId });
  return id;
};

const discardToken = (id) => {
  noteGenerations.delete(id);
};

const invalidateToken = (id) => {
  const t = noteGenerations.get(id);
  if (t) t.active = false;
};

const isTokenActive = (id) => {
  const t = noteGenerations.get(id);
  return !!(t && t.active);
};

// ⭐ scheduleNote เวอร์ชันปรับปรุง: ใช้ generation token
//    - ตรวจ token ทุก stage (ก่อน await, หลัง await, ก่อน create source)
//    - ถ้า token ถูก invalidate ทุก stage คืน null → โน้ตนั้นไม่เล่นเด็ดขาด
//    - token ถูก invalidate ใน stopAllScheduledNotes()
const scheduleNote = async (instrumentId, noteChar, whenSec, volumeLevel = 100, destination, allowLateStart = false, groupId = null) => {
  if (!noteChar || noteChar === '-') return null;
  const cleanNote = noteChar.trim();
  if (!INSTRUMENT_CONFIG[instrumentId]) return null;

  const tokenId = createToken(groupId);

  let buffer = audioBufferCache[instrumentId]?.[cleanNote];
  if (!buffer) {
    const key = findKeyByFormattedNote(instrumentId, cleanNote);
    if (!key) { discardToken(tokenId); return null; }
    buffer = await loadSoundBuffer(instrumentId, key);
    if (!isTokenActive(tokenId)) { discardToken(tokenId); return null; } // หยุดเล่นไปแล้วระหว่างโหลด
    if (!buffer) { discardToken(tokenId); return null; }
  }

  // ตรวจ token อีกครั้งหลัง await ทั้งหมดก่อนสร้าง source
  if (!isTokenActive(tokenId)) { discardToken(tokenId); return null; }

  // โน้ตของ timeline ที่โหลดไม่ทันต้องถูกทิ้ง ห้ามเลื่อนไปดังในเวลาปัจจุบัน
  // ไม่เช่นนั้นโน้ตเก่าจะปะปนกับจังหวะใหม่ตอนเริ่มเล่นหรือหลัง seek
  const now = safeAudioNow();
  if (!allowLateStart && typeof whenSec === 'number' && whenSec < now - MAX_TIMELINE_LATENESS) {
    discardToken(tokenId);
    return null;
  }

  const src = createBufferedSource(buffer, volumeLevel, whenSec, destination);
  // ผูก token เข้ากับ source เพื่อให้ stopAllScheduledNotes invalidate token ได้ด้วย
  if (src) {
    src._tokenId = tokenId;
    src._groupId = groupId;
    const previousOnEnded = src.onended;
    src.onended = () => {
      discardToken(tokenId);
      previousOnEnded?.();
    };
  } else {
    discardToken(tokenId);
  }
  return src;
};

export { scheduleNote };

export const playNote = (instrumentId, noteChar, volumeLevel = 100) => {
  const now = safeAudioNow();
  return scheduleNote(instrumentId, noteChar, now + DEFAULT_START_LEAD_TIME, volumeLevel, undefined, true);
};

export const stopAllScheduledNotes = ({ excludeGroupId = null } = {}) => {
  // ⭐ invalidate token ของทุก source ที่กำลังเล่น/รอเล่นอยู่ — แก้ race condition
  //    ตอนกดหยุดทุก token ที่ยังไม่จบ promise จะถูก mark inactive → scheduleNote() return null ทันที
  // ยกเลิกทั้ง source ที่เริ่มแล้วและคำขอโหลด buffer ที่ยังค้างอยู่
  // พร้อมคืน token ทันที เพื่อไม่ให้ Map โตขึ้นตามจำนวนโน้ตที่เล่น
  noteGenerations.forEach((token, tokenId) => {
    if (excludeGroupId && token.groupId === excludeGroupId) return;
    token.active = false;
    noteGenerations.delete(tokenId);
  });
  const ctx = getAudioContext();
  const stopAt = ctx.currentTime;
  Array.from(activeSources).forEach((source) => {
    if (excludeGroupId && source._groupId === excludeGroupId) return;
    if (source._tokenId) invalidateToken(source._tokenId);
    try {
      // ⭐ แก้บั๊กเสียงช็อต (click) ตอนหยุดเล่น:
      //    ปัญหาเดิมคือ stop() ที่ gain ~ค่าปกติทันที → เกิด DC discontinuity → หูได้ยินเป็นเสียงช็อต
      //    วิธีแก้: ramp gain ลงเป็น 0 ก่อนในเวลา RELEASE (~12ms) แล้วค่อย stop source
      //    - ถ้าโน้ตยังไม่ทันเริ่ม (start ในอนาคต) → ตั้ง gain ตอน start เป็น 0 ทันที แล้ว stop แบบไม่มี ramp
      //    - ถ้าโน้ตกำลังเล่นอยู่ → ramp ลงแล้วค่อย stop หลัง release จบ
      const s = source._startAt || stopAt;
      const release = source._release || 0.012;
      const gainNode = source._gainNode;

      const startTime = Math.max(stopAt, s);              // เวลาที่เริ่มมีผลกับ gain
      const endStopTime = startTime + release + 0.005;    // เวลาที่จะสั่ง stop จริง

      if (gainNode && typeof gainNode.gain !== 'undefined') {
        const currentValue = (typeof source._normalizedGain === 'number')
          ? source._normalizedGain
          : 1;
        try {
          gainNode.gain.cancelScheduledValues(startTime);
          if (s > stopAt) {
            // โน้ตยังไม่เริ่ม → กันไม่ให้มันดังขึ้นมาตอน start
            gainNode.gain.setValueAtTime(0.0001, s);
          } else {
            // โน้ตกำลังเล่น → ramp ลง smooth
            const nowVal = (typeof gainNode.gain.value === 'number') ? gainNode.gain.value : currentValue;
            gainNode.gain.setValueAtTime(nowVal, startTime);
            gainNode.gain.linearRampToValueAtTime(0.0001, startTime + release);
          }
        } catch (_) {}
      }

      // ⭐ แก้บั๊กเสียงปนกัน: scheduler จองโน้ตล่วงหน้า ~1.5 วิ (lookahead)
      //    ถ้าโน้ตยังไม่ทันเริ่ม (start ในอนาคต) แล้วเรียก stop(stopAt) จะ throw
      //    ทำให้โน้ตนั้นไม่ถูกยกเลิก แล้วยังเล่นต่อเมื่อกดเล่นใหม่ → เสียงซ้อนกัน
      //    วิธีแก้: หยุดที่เวลาหลัง start เสมอ (s + 0.001) เพื่อให้หยุดได้จริง
      source.stop(endStopTime);
    } catch (_) {
      // ignore already-ended sources
    }
    activeSources.delete(source);
  });
};

// หยุดเฉพาะกลุ่มเสียง เช่น metronome อิสระ โดยไม่กระทบโน้ตบนกระดาษ
export const stopScheduledNotesByGroup = (groupId) => {
  if (!groupId) return;
  noteGenerations.forEach((token, tokenId) => {
    if (token.groupId !== groupId) return;
    token.active = false;
    noteGenerations.delete(tokenId);
  });

  const ctx = getAudioContext();
  const now = ctx.currentTime;
  Array.from(activeSources).forEach((source) => {
    if (source._groupId !== groupId) return;
    const startAt = source._startAt || now;
    const release = source._release || 0.012;
    const gainNode = source._gainNode;
    try {
      if (gainNode) {
        const fadeAt = Math.max(now, startAt);
        gainNode.gain.cancelScheduledValues(fadeAt);
        if (startAt > now) gainNode.gain.setValueAtTime(0.0001, startAt);
        else {
          gainNode.gain.setValueAtTime(gainNode.gain.value, now);
          gainNode.gain.linearRampToValueAtTime(0.0001, now + release);
        }
      }
      source.stop(startAt > now ? startAt + 0.001 : now + release + 0.005);
    } catch {
      // Source may already have ended while the group is being stopped.
    }
    activeSources.delete(source);
  });
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
  const wakeAudioOutput = () => initAudioContext().catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wakeAudioOutput();
    else requestAudioResume();
  });
  window.addEventListener('focus', wakeAudioOutput);
  window.addEventListener('pageshow', wakeAudioOutput);
}
