import {
  AudioLines,
  BookOpenText,
  BrainCircuit,
  Database,
  SlidersHorizontal,
  WandSparkles,
} from 'lucide-react';

export const PUBLIC_TOOL_CATALOG = [
  {
    id: 'workspace',
    name: 'จัดวงดนตรี (Arranger)',
    shortName: 'จัดวงดนตรี',
    desc: 'จัดการวงดนตรี ไทม์ไลน์ และผูกเนื้อร้องเข้ากับโครงสร้างดนตรี',
    Icon: SlidersHorizontal,
    iconClass: 'bg-rose-50 text-rose-600 ring-rose-100',
    accentClass: 'from-rose-500 to-orange-400',
    hoverClass: 'hover:border-rose-200 hover:shadow-rose-100/70',
    requiresPremium: true,
  },
  {
    id: 'metronome',
    name: 'เครื่องประกอบจังหวะ',
    shortName: 'เครื่องประกอบจังหวะ',
    desc: 'เปิดหน้าทับฉิ่ง กลองแขก และกรับสำหรับฝึกซ้อม ปรับความเร็วและระดับเสียงได้',
    Icon: AudioLines,
    iconClass: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
    accentClass: 'from-indigo-500 to-sky-400',
    hoverClass: 'hover:border-indigo-200 hover:shadow-indigo-100/70',
    requiresPremium: false,
  },
];

export const ADMIN_TOOL_CATALOG = [
  {
    id: 'generator',
    name: 'AI สร้างทางระนาด',
    shortName: 'AI สร้างทางระนาด',
    desc: 'แปลงทำนองหลักจากฆ้องวงใหญ่เป็นทางระนาดเอกอัตโนมัติ',
    Icon: WandSparkles,
    iconClass: 'bg-sky-50 text-sky-600',
    hoverClass: 'hover:border-sky-200 hover:shadow-sky-100/70',
  },
  {
    id: 'dictionary',
    name: 'พจนานุกรมทางระนาด',
    shortName: 'พจนานุกรมทางระนาด',
    desc: 'จัดการฐานข้อมูลวลีเพลง กลุ่มระดับความยาก และโครงสร้างเป้าหมาย',
    Icon: BookOpenText,
    iconClass: 'bg-teal-50 text-teal-600',
    hoverClass: 'hover:border-teal-200 hover:shadow-teal-100/70',
  },
  {
    id: 'tuner-ai',
    name: 'AI จูนโครงสร้าง',
    shortName: 'AI จูนโครงสร้าง',
    desc: 'วิเคราะห์ความถูกต้องของสัดส่วนและจัดการ Dataset สำหรับสอนระบบ',
    Icon: BrainCircuit,
    iconClass: 'bg-violet-50 text-violet-600',
    hoverClass: 'hover:border-violet-200 hover:shadow-violet-100/70',
  },
  {
    id: 'rhythm-manager',
    name: 'จัดการหน้าทับจังหวะ',
    shortName: 'จัดการหน้าทับจังหวะ',
    desc: 'นำเข้าข้อมูลจังหวะฉิ่ง กลอง และกรับเข้าสู่ระบบส่วนกลาง',
    Icon: Database,
    iconClass: 'bg-emerald-50 text-emerald-600',
    hoverClass: 'hover:border-emerald-200 hover:shadow-emerald-100/70',
  },
];
