import { INSTRUMENT_CONFIG } from './instrumentConfig';

// กล่องเก็บไฟล์เสียงที่โหลดเตรียมไว้ (Cache) จะได้ไม่กระตุกตอนเริ่มกด
const audioCache = {};

// ⭐ ฟังก์ชันช่วยเติมจุดล่าง/วงกลมบน ให้ตรงกับคีย์บอร์ด
const getFormattedNote = (note, eng) => {
  const octave = parseInt(eng.replace(/\D/g, ''));
  if (octave >= 5) return note + '\u0E4D'; // เสียงสูง เติมวงกลมบน
  if (octave === 2) return note + '\u0E3A\u200B'; // ⭐ เสียงต่ำพิเศษ เติมจุดล่าง + ตัวอักษรล่องหน (ZWS) ให้โปรแกรมแยกออก
  if (octave === 3) return note + '\u0E3A'; // เสียงต่ำปกติ เติมจุดล่าง
  return note; // เสียงกลาง ไม่ต้องเติม
};

// ⭐ โหลดเสียงล่วงหน้า (Preload) ดึงชื่อไฟล์จาก Config อัตโนมัติ
export const preloadSounds = (instrumentId) => {
  const instrument = INSTRUMENT_CONFIG[instrumentId];
  if (!instrument) return;
  
  if (!audioCache[instrumentId]) {
    audioCache[instrumentId] = {};
  }

  // วนลูปอ่านข้อมูลทุกปุ่ม
  instrument.keys.forEach(key => {
    // ถ้ามีการตั้งค่าไฟล์เสียงไว้ (เช่น audio: '1.wav')
    if (key.audio) {
      const finalNoteStr = getFormattedNote(key.thai, key.eng);
      
      // ถ้ายังไม่เคยโหลดไฟล์นี้ ให้โหลดมาเก็บไว้
      if (!audioCache[instrumentId][finalNoteStr]) {
        // อ้างอิงโฟลเดอร์ตามชื่อเครื่องดนตรี เช่น /sounds/khong-wong-yai/1.wav
        const audioPath = `/sounds/${instrumentId}/${key.audio}`;
        const audio = new Audio(audioPath);
        audio.preload = 'auto'; // สั่งให้เบราว์เซอร์โหลดรอเลย
        audioCache[instrumentId][finalNoteStr] = audio;
      }
    }
  });
};

// ⭐ สั่งเล่นเสียงเมื่อกดปุ่ม หรือตอนเพลงเล่น (เพิ่ม volumeLevel)
export const playNote = (instrumentId, noteChar, volumeLevel = 100) => {
  if (!noteChar || noteChar === '-') return;
  
  const cleanNote = noteChar.trim();
  const cache = audioCache[instrumentId];
  
  // ถ้าเจอไฟล์เสียงที่ตรงกับตัวโน้ต
  if (cache && cache[cleanNote]) {
    const audio = cache[cleanNote];
    // ใช้ cloneNode() ทำให้เล่นเสียงทับกันได้ (ตีรัวๆ ได้เสียงไม่ตัด)
    const soundClone = audio.cloneNode(); 
    
    // ⭐ กำหนดความดังของเสียง (0.0 ถึง 1.0)
    soundClone.volume = Math.max(0, Math.min(100, volumeLevel)) / 100;
    
    soundClone.play().catch(err => {
      console.log("บราวเซอร์รอให้คลิกหน้าเว็บก่อนเล่นเสียง:", err);
    });
  }
};