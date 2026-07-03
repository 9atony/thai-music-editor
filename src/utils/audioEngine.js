import { INSTRUMENT_CONFIG } from './instrumentConfig';

// สร้าง AudioContext (ถ้าบราวเซอร์บล็อก จะถูกกระตุ้นตอนเริ่มเล่น)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// กล่องเก็บข้อมูลเสียงที่แปลงเป็น Buffer ไว้ใน RAM เรียบร้อยแล้ว
const audioBufferCache = {};

const getFormattedNote = (note, eng) => {
  const octave = parseInt(eng.replace(/\D/g, ''));
  if (octave >= 5) return note + '\u0E4D';
  if (octave === 2) return note + '\u0E3A\u200B';
  if (octave === 3) return note + '\u0E3A';
  return note;
};

// ⭐ ระบบ Preload แบบใหม่: โหลดไฟล์มาเก็บเป็น Buffer ใน RAM
export const preloadSounds = async (instrumentId) => {
  const instrument = INSTRUMENT_CONFIG[instrumentId];
  if (!instrument) return;
  
  if (!audioBufferCache[instrumentId]) {
    audioBufferCache[instrumentId] = {};
  }

  // ใช้ Promise.all เพื่อโหลดทุกไฟล์พร้อมกันให้เร็วที่สุด
  const loadPromises = instrument.keys.filter(k => k.audio).map(async (key) => {
    const finalNoteStr = getFormattedNote(key.thai, key.eng);
    
    if (!audioBufferCache[instrumentId][finalNoteStr]) {
      try {
        const response = await fetch(`/sounds/${instrumentId}/${key.audio}`);
        const arrayBuffer = await response.arrayBuffer();
        // แปลงไฟล์เสียงให้เป็น AudioBuffer ที่ Web Audio API ใช้งานได้
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioBufferCache[instrumentId][finalNoteStr] = audioBuffer;
      } catch (err) {
        console.error("โหลดเสียงไม่สำเร็จ:", key.audio, err);
      }
    }
  });

  await Promise.all(loadPromises);
  console.log(`เครื่องดนตรี ${instrumentId} โหลดลง RAM เรียบร้อยแล้ว!`);
};

// ⭐ สั่งเล่นเสียงแบบ Web Audio API (รัวได้ไม่มีดีเลย์)
export const playNote = (instrumentId, noteChar, volumeLevel = 100) => {
  if (!noteChar || noteChar === '-') return;
  
  // ตรวจสอบสถานะของ AudioContext (บราวเซอร์ต้องการให้ผู้ใช้คลิกก่อนถึงจะเล่นเสียงได้)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const cleanNote = noteChar.trim();
  const buffer = audioBufferCache[instrumentId]?.[cleanNote];
  
  if (buffer) {
    // สร้าง Source Node ใหม่ทุกครั้งที่เล่น (เล่นทับกันได้อิสระ)
    const source = audioCtx.createBufferSource();
    const gainNode = audioCtx.createGain(); // ใช้สำหรับคุมความดัง
    
    source.buffer = buffer;
    gainNode.gain.value = Math.max(0, Math.min(100, volumeLevel)) / 100;
    
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    source.start(0);
  }
};