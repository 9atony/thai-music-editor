import packageJson from '../../package.json';
import { THAI_MUSIC_XML_VERSION } from '../utils/thaiMusicXml.js';

export const APP_METADATA = {
  name: 'Thai Music Editor',
  version: packageJson.version,
  thaiMusicXmlVersion: THAI_MUSIC_XML_VERSION,
  // กำหนดวันที่เผยแพร่จริงได้จาก environment โดยไม่ต้องแก้ข้อความในหลายหน้า
  lastUpdated: import.meta.env.VITE_APP_LAST_UPDATED || 'ยังไม่ได้ระบุ'
};

// ตั้งใจใช้ placeholder เพราะยังไม่มีข้อมูลติดต่อที่ยืนยันแล้ว
export const DEVELOPER_CONTACTS = [
  { label: 'ชื่อผู้พัฒนา', value: '[รอระบุชื่อผู้พัฒนา]' },
  { label: 'ช่องทางติดต่อ', value: '[รอระบุช่องทางติดต่อ]' }
];

export const THAI_MUSIC_XML_LINKS = [
  { label: 'เว็บไซต์ ThaiMusicXML', href: 'https://thaimusicxml.anan.ovh/th/' },
  { label: 'GitHub', href: 'https://github.com/Nopparuj-an/ThaiMusicXML' },
  { label: 'Apache License 2.0', href: 'https://github.com/Nopparuj-an/ThaiMusicXML/blob/main/LICENSE.txt' },
  { label: 'NOTICE', href: 'https://github.com/Nopparuj-an/ThaiMusicXML/blob/main/NOTICE' }
];
