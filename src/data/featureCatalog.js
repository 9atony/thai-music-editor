import { INSTRUMENT_CONFIG } from '../utils/instrumentConfig';

const FEATURE_GROUPS = [
  { id: 'editor', name: 'ตัวแก้ไขโน้ตเพลง', description: 'สร้างและแก้ไขโน้ตเพลงไทย', free: true, premium: true, group: 'workspace' },
  { id: 'projects', name: 'โครงการของฉัน', description: 'บันทึกและจัดการโครงการโน้ต', free: true, premium: true, group: 'workspace' },
  { id: 'templates', name: 'เทมเพลต', description: 'เริ่มงานจากแบบฟอร์มสำเร็จรูป', free: true, premium: true, group: 'workspace' },
  { id: 'samples', name: 'เพลงตัวอย่าง', description: 'เปิดดูและฟังเพลงตัวอย่าง', free: true, premium: true, group: 'workspace' },
  { id: 'settings', name: 'การตั้งค่าบัญชี', description: 'ตั้งค่าการใช้งานส่วนตัว', free: true, premium: true, group: 'workspace' },
  { id: 'metronome', name: 'เครื่องประกอบจังหวะ', description: 'เมโทรโนมและ Speed Trainer', free: true, premium: true, group: 'tools' },
  { id: 'arranger', name: 'จัดวงดนตรี (Arranger)', description: 'สร้างไทม์ไลน์และมิกซ์วงดนตรี', free: false, premium: true, group: 'tools' },
  { id: 'export-pdf', name: 'ส่งออก PDF', description: 'พิมพ์หรือบันทึกโน้ตเป็น PDF', free: true, premium: true, group: 'exports' },
  { id: 'export-txml', name: 'ส่งออก ThaiMusicXML', description: 'ดาวน์โหลดไฟล์ .txml', free: true, premium: true, group: 'exports' },
  { id: 'export-musicxml', name: 'ส่งออก MusicXML', description: 'ดาวน์โหลดไฟล์สำหรับ MuseScore', free: false, premium: true, group: 'exports' },
];

export const FEATURE_GROUP_DETAILS = {
  workspace: { label: 'พื้นที่ทำงานและเนื้อหา', description: 'หน้าหลักสำหรับสร้าง จัดการ และเรียนรู้เพลง' },
  tools: { label: 'เครื่องมือฝึกซ้อมและจัดวง', description: 'เครื่องมือเฉพาะทางสำหรับการฝึกและเรียบเรียง' },
  exports: { label: 'การส่งออกไฟล์', description: 'สิทธิ์ในการดาวน์โหลดและนำผลงานไปใช้งานต่อ' },
  instruments: { label: 'คลังเครื่องดนตรี', description: 'กำหนดสิทธิ์รายเครื่องดนตรีได้อย่างอิสระ' },
};

const INSTRUMENT_FEATURES = Object.values(INSTRUMENT_CONFIG).map((instrument) => ({
  id: `instrument:${instrument.id}`,
  name: instrument.name,
  description: `${instrument.type === 'percussion' ? 'เครื่องประกอบจังหวะ' : 'เครื่องดำเนินทำนอง'}${instrument.tier === 'premium' ? ' · ค่าเริ่มต้น Premium' : ''}`,
  free: instrument.tier !== 'premium',
  premium: true,
  group: 'instruments',
}));

export const FEATURE_CATALOG = [...FEATURE_GROUPS, ...INSTRUMENT_FEATURES];

export const DEFAULT_FEATURE_ACCESS = Object.fromEntries(
  FEATURE_CATALOG.map((feature) => [feature.id, { free: feature.free, premium: feature.premium }]),
);
