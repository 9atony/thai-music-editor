export const INSTRUMENT_CONFIG = {
  "ranat-ek": {
    id: "ranat-ek",
    name: "ระนาดเอก",
    keys: [
      // 4 ลูกแรก: เสียงต่ำทุ้มพิเศษ (อ็อกเทฟ 2)
      { thai: 'ฟ', eng: 'F2', audio: '1.wav' }, 
      { thai: 'ซ', eng: 'G2', audio: '2.wav' }, 
      { thai: 'ล', eng: 'A2', audio: '3.wav' }, 
      { thai: 'ท', eng: 'B2', audio: '4.wav' }, 
      
      // 7 ลูกต่อมา: เสียงต่ำ (อ็อกเทฟ 3)
      { thai: 'ด', eng: 'C3', audio: '5.wav' }, 
      { thai: 'ร', eng: 'D3', audio: '6.wav' }, 
      { thai: 'ม', eng: 'E3', audio: '7.wav' }, 
      { thai: 'ฟ', eng: 'F3', audio: '8.wav' },
      { thai: 'ซ', eng: 'G3', audio: '9.wav' }, 
      { thai: 'ล', eng: 'A3', audio: '10.wav' }, 
      { thai: 'ท', eng: 'B3', audio: '11.wav' },
      
      // 7 ลูกต่อมา: เสียงกลาง (อ็อกเทฟ 4)
      { thai: 'ด', eng: 'C4', audio: '12.wav' }, 
      { thai: 'ร', eng: 'D4', audio: '13.wav' }, 
      { thai: 'ม', eng: 'E4', audio: '14.wav' }, 
      { thai: 'ฟ', eng: 'F4', audio: '15.wav' },
      { thai: 'ซ', eng: 'G4', audio: '16.wav' }, 
      { thai: 'ล', eng: 'A4', audio: '17.wav' }, 
      { thai: 'ท', eng: 'B4', audio: '18.wav' },
      
      // 4 ลูกสุดท้าย: เสียงสูง (อ็อกเทฟ 5)
      { thai: 'ด', eng: 'C5', audio: '19.wav' }, 
      { thai: 'ร', eng: 'D5', audio: '20.wav' }, 
      { thai: 'ม', eng: 'E5', audio: '21.wav' }, 
      { thai: 'ฟ', eng: 'F5', audio: '22.wav' } 
    ]
  },
  "khong-wong-yai": {
    id: "khong-wong-yai",
    name: "ฆ้องวงใหญ่",
    // ฆ้องวงใหญ่ 16 ลูก เริ่มที่ เร (D3)
    keys: [
      // เสียงต่ำ (จุดเดียว) - ลูกที่ 1 ถึง 6
      { thai: 'ร', eng: 'D3', audio: '1.wav' }, 
      { thai: 'ม', eng: 'E3', audio: '2.wav' }, 
      { thai: 'ฟ', eng: 'F3', audio: '3.wav' },
      { thai: 'ซ', eng: 'G3', audio: '4.wav' }, 
      { thai: 'ล', eng: 'A3', audio: '5.wav' }, 
      { thai: 'ท', eng: 'B3', audio: '6.wav' },
      
      // เสียงกลาง (ไม่มีจุด) - ลูกที่ 7 ถึง 13
      { thai: 'ด', eng: 'C4', audio: '7.wav' }, 
      { thai: 'ร', eng: 'D4', audio: '8.wav' }, 
      { thai: 'ม', eng: 'E4', audio: '9.wav' }, 
      { thai: 'ฟ', eng: 'F4', audio: '10.wav' },
      { thai: 'ซ', eng: 'G4', audio: '11.wav' }, 
      { thai: 'ล', eng: 'A4', audio: '12.wav' }, 
      { thai: 'ท', eng: 'B4', audio: '13.wav' },
      
      // เสียงสูง (วงกลมโปร่ง) - ลูกที่ 14 ถึง 16
      { thai: 'ด', eng: 'C5', audio: '14.wav' }, 
      { thai: 'ร', eng: 'D5', audio: '15.wav' }, 
      { thai: 'ม', eng: 'E5', audio: '16.wav' }
    ]
  },
  "ranat-tum": {
    id: "ranat-tum",
    name: "ระนาดทุ้ม",
    keys: [
      // เสียงต่ำ (เริ่มที่ เร ต่ำ มีจุดด้านล่าง)
      { thai: 'ร', eng: 'D3', audio: '1.wav' }, 
      { thai: 'ม', eng: 'E3', audio: '2.wav' }, 
      { thai: 'ฟ', eng: 'F3', audio: '3.wav' },
      { thai: 'ซ', eng: 'G3', audio: '4.wav' }, 
      { thai: 'ล', eng: 'A3', audio: '5.wav' }, 
      { thai: 'ท', eng: 'B3', audio: '6.wav' },
      
      // เสียงกลาง (เริ่มที่ โด กลาง ไม่มีจุด)
      { thai: 'ด', eng: 'C4', audio: '7.wav' }, 
      { thai: 'ร', eng: 'D4', audio: '8.wav' }, 
      { thai: 'ม', eng: 'E4', audio: '9.wav' }, 
      { thai: 'ฟ', eng: 'F4', audio: '10.wav' },
      { thai: 'ซ', eng: 'G4', audio: '11.wav' }, 
      { thai: 'ล', eng: 'A4', audio: '12.wav' }, 
      { thai: 'ท', eng: 'B4', audio: '13.wav' },
      
      // เสียงสูง (มีเครื่องหมายวงกลมด้านบน)
      { thai: 'ด', eng: 'C5', audio: '14.wav' }, 
      { thai: 'ร', eng: 'D5', audio: '15.wav' }, 
      { thai: 'ม', eng: 'E5', audio: '16.wav' },
      { thai: 'ฟ', eng: 'F5', audio: '17.wav' }
    ]
  },
  "khong-wong-lek": {
    id: "khong-wong-lek",
    name: "ฆ้องวงเล็ก",
    keys: [
      // เสียงต่ำ 8 ลูก (เริ่มที่ ที ต่ำสุด)
      { thai: 'ท', eng: 'B2', audio: '1.wav' }, 
      { thai: 'ด', eng: 'C3', audio: '2.wav' }, 
      { thai: 'ร', eng: 'D3', audio: '3.wav' }, 
      { thai: 'ม', eng: 'E3', audio: '4.wav' }, 
      { thai: 'ฟ', eng: 'F3', audio: '5.wav' },
      { thai: 'ซ', eng: 'G3', audio: '6.wav' }, 
      { thai: 'ล', eng: 'A3', audio: '7.wav' }, 
      { thai: 'ท', eng: 'B3', audio: '8.wav' },
      
      // เสียงกลาง 7 ลูก
      { thai: 'ด', eng: 'C4', audio: '9.wav' }, 
      { thai: 'ร', eng: 'D4', audio: '10.wav' }, 
      { thai: 'ม', eng: 'E4', audio: '11.wav' }, 
      { thai: 'ฟ', eng: 'F4', audio: '12.wav' },
      { thai: 'ซ', eng: 'G4', audio: '13.wav' }, 
      { thai: 'ล', eng: 'A4', audio: '14.wav' }, 
      { thai: 'ท', eng: 'B4', audio: '15.wav' },
      
      // เสียงสูง 3 ลูก
      { thai: 'ด', eng: 'C5', audio: '16.wav' }, 
      { thai: 'ร', eng: 'D5', audio: '17.wav' }, 
      { thai: 'ม', eng: 'E5', audio: '18.wav' }
    ]
  },
  "klong-khaek": {
    id: "klong-khaek",
    name: "กลองแขก",
    type: "percussion", // ⭐ ตัวแปรสำคัญที่บอกระบบว่านี่คือเครื่องประกอบจังหวะ
    keys: [
      { thai: 'ทัง', eng: 'THANG', audio: 'thang.wav' },
      { thai: 'ติง', eng: 'TING', audio: 'ting.wav' },
      { thai: 'โจ๊ะ', eng: 'JOH', audio: 'joh.wav' },
      { thai: 'จ๊ะ', eng: 'JA', audio: 'ja.wav' },
    ]
  },
  "ching": { // ⭐ เปลี่ยน key ตรงนี้เป็น ching
    id: "ching", // ⭐ เปลี่ยน id ตรงนี้เป็น ching
    name: "ฉิ่ง",
    type: "percussion",
    keys: [
      { thai: 'ฉิ่ง', eng: 'CHING', audio: 'ching.wav' },
      { thai: 'ฉับ', eng: 'CHAB', audio: 'chab.wav' }
    ]
  }
};



