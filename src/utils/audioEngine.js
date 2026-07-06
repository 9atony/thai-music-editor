import { INSTRUMENT_CONFIG } from './instrumentConfig';

// สร้าง AudioContext
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

// ⭐ ฟังก์ชันใหม่: ใช้ปลุกและสแตนด์บาย AudioContext ให้ตื่นเต็มที่
export const initAudioContext = async () => {
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
};

export const preloadSounds = async (instrumentId) => {
  const instrument = INSTRUMENT_CONFIG[instrumentId];
  if (!instrument) return;
  
  if (!audioBufferCache[instrumentId]) {
    audioBufferCache[instrumentId] = {};
  }

  const loadPromises = instrument.keys.filter(k => k.audio).map(async (key) => {
    const finalNoteStr = getFormattedNote(key.thai, key.eng);
    
    if (!audioBufferCache[instrumentId][finalNoteStr]) {
      try {
        const response = await fetch(`/sounds/${instrumentId}/${key.audio}`);
        const arrayBuffer = await response.arrayBuffer();
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

export const playNote = (instrumentId, noteChar, volumeLevel = 100) => {
  if (!noteChar || noteChar === '-') return;
  
  // (ยังคงเก็บไว้เป็นระบบป้องกันเผื่อกรณีฉุกเฉิน)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const cleanNote = noteChar.trim();
  const buffer = audioBufferCache[instrumentId]?.[cleanNote];
  
  if (buffer) {
    const source = audioCtx.createBufferSource();
    const gainNode = audioCtx.createGain(); 
    
    source.buffer = buffer;
    gainNode.gain.value = Math.max(0, Math.min(100, volumeLevel)) / 100;
    
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    source.start(0);
  }
};