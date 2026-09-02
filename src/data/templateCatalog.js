import previewBlank from '../assets/templates/preview-blank.png';
import previewStandard from '../assets/templates/preview-standard.png';
import previewWorksheet from '../assets/templates/preview-worksheet.png';
import previewFormal from '../assets/templates/preview-formal.png';

export const TEMPLATE_CATALOG = [
  {
    id: 'blank',
    name: 'กระดาษเปล่า',
    shortName: 'เริ่มจากกระดาษเปล่า',
    desc: 'หน้ากระดาษเปล่าสำหรับเริ่มต้นเขียนโน้ตทันที',
    badge: 'พื้นฐาน',
    borderColor: 'hover:border-slate-400 hover:shadow-slate-200/50',
    previewImg: previewBlank,
    defaultSongName: 'เพลงใหม่',
    detailsAlign: 'between',
    headerDetails: [],
  },
  {
    id: 'standard',
    name: 'มาตรฐาน (Standard)',
    shortName: 'เพลงทั่วไป',
    desc: 'หัวกระดาษสำหรับโน้ตเพลงทั่วไป ระบุจังหวะ เครื่องประกอบ และทางเสียง',
    badge: 'แนะนำ',
    borderColor: 'hover:border-emerald-400 hover:shadow-emerald-200/50',
    previewImg: previewStandard,
    defaultSongName: 'ชื่อเพลง',
    detailsAlign: 'between',
    headerDetails: [
      { id: '1', label: 'อัตราจังหวะ', value: '..........' },
      { id: '2', label: 'เครื่องประกอบ', value: '..........' },
      { id: '3', label: 'บันไดเสียง', value: '..........' },
      { id: '4', label: 'ผู้บันทึก', value: '................' },
    ],
  },
  {
    id: 'worksheet',
    name: 'ใบงาน / แบบฝึกหัด',
    shortName: 'ใบงานดนตรีไทย',
    desc: 'แบบฟอร์มที่มีพื้นที่จุดไข่ปลาสำหรับกรอก ชื่อ-สกุล ชั้น เลขที่ และคะแนน',
    badge: 'การศึกษา',
    borderColor: 'hover:border-amber-400 hover:shadow-amber-200/50',
    previewImg: previewWorksheet,
    defaultSongName: 'ใบงานทฤษฎีดนตรีไทย',
    detailsAlign: 'between',
    headerDetails: [
      { id: '1', label: 'ชื่อ-สกุล', value: '................................................' },
      { id: '2', label: 'ชั้น', value: '................' },
      { id: '3', label: 'เลขที่', value: '............' },
      { id: '4', label: 'คะแนน', value: '............' },
    ],
  },
  {
    id: 'formal',
    name: 'เอกสารวิชาการ',
    shortName: 'เอกสารวิชาการ',
    desc: 'หัวกระดาษแบบทางการ ระบุรายละเอียดที่มาและผู้ถ่ายทอดชัดเจน จัดวางสมดุลซ้าย-ขวา',
    badge: 'มืออาชีพ',
    borderColor: 'hover:border-purple-400 hover:shadow-purple-200/50',
    previewImg: previewFormal,
    defaultSongName: 'ชื่อเพลง',
    detailsAlign: 'between',
    headerDetails: [
      { id: '1', label: 'อัตราจังหวะ', value: '....................................' },
      { id: '2', label: 'ผู้ประพันธ์ทำนอง', value: '....................................' },
      { id: '3', label: 'เครื่องประกอบ', value: '....................................' },
      { id: '4', label: 'ผู้ถ่ายทอด', value: '....................................' },
      { id: '5', label: 'ทางเสียง', value: '....................................' },
      { id: '6', label: 'ผู้บันทึกโน้ต', value: '....................................' },
    ],
  },
];
