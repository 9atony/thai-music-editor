import React, { useContext, useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BadgeInfo, Check, ChevronDown, CircleUserRound, Cloud, Crown, Download, FilePenLine, HardDrive, Keyboard, Music2, Settings2, ShieldCheck, Volume2 } from 'lucide-react';
import { MusicContext } from '../contexts/MusicContext';
import { APP_METADATA } from '../config/appMetadata';
import { auth, fetchAllProjects, getUserStorageUsage } from '../utils/firebase';
import PageHeader from '../components/layout/PageHeader';

const sections = [
  { id: 'account', label: 'บัญชีและแผน', description: 'สมาชิกและพื้นที่ใช้งาน', Icon: CircleUserRound },
  { id: 'editor', label: 'การเขียนโน้ต', description: 'รูปแบบเริ่มต้นของตัวแก้ไข', Icon: FilePenLine },
  { id: 'audio', label: 'เสียงและการเล่น', description: 'ระดับเสียงสำหรับฝึกซ้อม', Icon: Volume2 },
  { id: 'data', label: 'ข้อมูลและการสำรอง', description: 'สำเนาโครงการทั้งหมด', Icon: HardDrive },
  { id: 'shortcuts', label: 'คีย์ลัดและข้อมูลแอป', description: 'คำสั่งและเวอร์ชัน', Icon: Keyboard },
];

const shortcuts = [
  ['Space', 'เล่นหรือหยุดเพลง'], ['Backspace', 'ลบโน้ตทีละตัว'], ['Delete', 'ลบบรรทัดหรือสัญลักษณ์'],
  ['Insert', 'เพิ่มบรรทัดใหม่'], ['↑ ↓ ← →', 'เลื่อนตำแหน่งในตาราง'], ['Ctrl + Z', 'เลิกทำ'],
  ['Ctrl + Y', 'ทำซ้ำ'], ['Ctrl + C / X / V', 'คัดลอก ตัด และวาง'],
];

const formatBytes = (bytes = 0) => bytes < 1024 * 1024
  ? `${(bytes / 1024).toFixed(1)} KB`
  : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const roleDetails = {
  user: { label: 'Free', className: 'border-slate-200 bg-slate-100 text-slate-600', Icon: Music2 },
  premium: { label: 'Premium', className: 'border-amber-200 bg-amber-50 text-amber-700', Icon: Crown },
  admin: { label: 'Admin', className: 'border-violet-200 bg-violet-50 text-violet-700', Icon: ShieldCheck },
};

const SettingHeader = ({ title, description }) => (
  <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
    <h2 className="text-base font-black text-slate-900">{title}</h2>
    <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
  </div>
);

const Settings = ({ userProfile }) => {
  const { layoutConfig, setLayoutConfig } = useContext(MusicContext);
  const [activeSection, setActiveSection] = useState('account');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);
  const [storageError, setStorageError] = useState('');
  const role = userProfile?.role || 'user';
  const roleInfo = roleDetails[role] || roleDetails.user;
  const RoleIcon = roleInfo.Icon;
  const currentSection = sections.find((section) => section.id === activeSection) || sections[0];

  useEffect(() => {
    let active = true;
    if (!auth.currentUser?.uid) return undefined;
    getUserStorageUsage(auth.currentUser.uid)
      .then((result) => { if (active) setStorageInfo(result); })
      .catch(() => { if (active) setStorageError('ไม่สามารถอ่านข้อมูลพื้นที่ใช้งานได้'); });
    return () => { active = false; };
  }, []);

  const storagePercent = useMemo(() => {
    if (!storageInfo || storageInfo.unlimited) return 0;
    if (storageInfo.maxBytes) return Math.min((storageInfo.usedBytes / storageInfo.maxBytes) * 100, 100);
    if (storageInfo.maxProjects) return Math.min((storageInfo.projectCount / storageInfo.maxProjects) * 100, 100);
    return 0;
  }, [storageInfo]);

  const setLayoutValue = (key, value) => setLayoutConfig((current) => ({ ...current, [key]: value }));

  const handleExportAllData = async () => {
    if (!auth.currentUser) return;
    setIsExporting(true);
    try {
      const projects = await fetchAllProjects(auth.currentUser.uid);
      if (!projects.length) return window.alert('ยังไม่มีโครงการที่บันทึกไว้สำหรับสำรองข้อมูล');
      const zip = new JSZip();
      projects.forEach((project) => {
        const safeName = (project.name || project.songName || 'โครงการไม่มีชื่อ').replace(/[^a-zA-Z0-9ก-๙\s]/g, '_').trim();
        zip.file(`${safeName}_${project.id.slice(0, 5)}.tme`, JSON.stringify(project, null, 2));
      });
      saveAs(await zip.generateAsync({ type: 'blob' }), 'ThaiMusicEditor_Backup.zip');
    } catch (error) {
      console.error('สำรองข้อมูลทั้งหมดไม่สำเร็จ:', error);
      window.alert('ไม่สามารถสร้างไฟล์สำรองได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="app-page-shell animate-fadeIn text-slate-800" style={{ fontFamily: 'Prompt, sans-serif' }}>
      <PageHeader icon={Settings2} badge="Preferences" title="การตั้งค่า" subtitle="จัดการบัญชี รูปแบบการเขียนโน้ต เสียง และข้อมูลของคุณจากที่เดียว" />
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
        <aside className="self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24 lg:rounded-3xl">
          <div className="hidden border-b border-slate-100 bg-gradient-to-br from-slate-50 to-indigo-50/60 p-4 lg:block">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 font-black text-white">{String(userProfile?.displayName || userProfile?.email || 'U')[0].toUpperCase()}</span>
              <div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{userProfile?.displayName || 'ผู้ใช้งาน'}</p><p className="truncate text-[10px] text-slate-500">{userProfile?.email || auth.currentUser?.email || '—'}</p></div>
            </div>
            <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${roleInfo.className}`}><RoleIcon size={12} />{roleInfo.label}</span>
          </div>
          <div className="p-2 lg:hidden">
            <button type="button" onClick={() => setIsMobileMenuOpen((open) => !open)} aria-expanded={isMobileMenuOpen} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-indigo-700 transition active:scale-[0.99]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{React.createElement(currentSection.Icon, { size: 19 })}</span>
              <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold text-slate-400">หมวดการตั้งค่า</span><strong className="block truncate text-sm font-black">{currentSection.label}</strong></span>
              <ChevronDown size={19} className={`mr-1 shrink-0 text-slate-400 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isMobileMenuOpen && (
              <nav className="mt-2 grid gap-2 border-t border-slate-100 pt-2 sm:grid-cols-2">
                {sections.map(({ id, label, description, Icon }) => (
                  <button key={id} type="button" onClick={() => { setActiveSection(id); setIsMobileMenuOpen(false); }} className={`flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.99] ${activeSection === id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100' : 'bg-slate-50 text-slate-600'}`}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${activeSection === id ? 'bg-white text-indigo-600 shadow-sm' : 'bg-white text-slate-500'}`}>{React.createElement(Icon, { size: 18 })}</span>
                    <span className="min-w-0 flex-1"><strong className="block text-xs font-black">{label}</strong><span className="mt-0.5 block truncate text-[9px] font-medium opacity-70">{description}</span></span>
                    {activeSection === id && <Check size={16} className="shrink-0" />}
                  </button>
                ))}
              </nav>
            )}
          </div>
          <nav className="hidden p-2 lg:block lg:space-y-1">
            {sections.map(({ id, label, description, Icon }) => (
              <button key={id} type="button" onClick={() => setActiveSection(id)} className={`flex min-w-[190px] items-center gap-3 rounded-2xl px-3 py-3 text-left transition lg:w-full lg:min-w-0 ${activeSection === id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${activeSection === id ? 'bg-white text-indigo-600 shadow-sm' : 'bg-slate-100 text-slate-500'}`}>{React.createElement(Icon, { size: 17 })}</span>
                <span className="min-w-0"><strong className="block text-xs font-black">{label}</strong><span className="mt-0.5 block truncate text-[9px] font-medium opacity-70">{description}</span></span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          {activeSection === 'account' && (
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <SettingHeader title="บัญชีและแผนสมาชิก" description="ตรวจสอบข้อมูลบัญชี สิทธิ์ และพื้นที่จัดเก็บที่กำลังใช้งาน" />
              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">ชื่อที่แสดง</p><p className="mt-2 text-sm font-black text-slate-800">{userProfile?.displayName || 'ยังไม่ได้ระบุชื่อ'}</p><p className="mt-1 truncate text-xs text-slate-500">{userProfile?.email || auth.currentUser?.email}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">แผนปัจจุบัน</p><span className={`mt-2 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${roleInfo.className}`}><RoleIcon size={15} />{roleInfo.label}</span><p className="mt-2 text-[10px] text-slate-500">สิทธิ์การใช้งานควบคุมโดยผู้ดูแลระบบ</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
                  <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Cloud size={16} className="text-sky-500" /><p className="text-xs font-black text-slate-700">พื้นที่จัดเก็บและโครงการ</p></div><span className="text-[10px] font-bold text-slate-500">{storageInfo?.unlimited ? 'ไม่จำกัด' : storageInfo?.maxBytes ? `${formatBytes(storageInfo.usedBytes)} / ${formatBytes(storageInfo.maxBytes)}` : storageInfo ? `${storageInfo.projectCount} / ${storageInfo.maxProjects} โครงการ` : 'กำลังตรวจสอบ...'}</span></div>
                  {!storageInfo?.unlimited && <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${storagePercent >= 90 ? 'bg-rose-500' : 'bg-sky-500'}`} style={{ width: `${Math.max(storagePercent, storageInfo ? 1 : 0)}%` }} /></div>}
                  {storageError && <p className="mt-2 text-[10px] font-semibold text-rose-600">{storageError}</p>}
                </div>
              </div>
            </section>
          )}

          {activeSection === 'editor' && (
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <SettingHeader title="การเขียนโน้ต" description="กำหนดรูปแบบเริ่มต้นที่ใช้ในพื้นที่แก้ไขโน้ตเพลง" />
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-slate-800">ขนาดตัวโน้ตเริ่มต้น</p><p className="mt-1 text-xs text-slate-500">ปรับความหนาแน่นของโน้ตบนหน้ากระดาษ</p></div><div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">{[['เล็ก', 24], ['กลาง', 30], ['ใหญ่', 36]].map(([label, value]) => <button key={value} type="button" onClick={() => setLayoutValue('fontSize', value)} className={`rounded-lg px-4 py-2 text-xs font-black transition ${Number(layoutConfig.fontSize || 30) === value ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div></div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-emerald-700"><Check size={16} /><p className="text-xs font-black">บันทึกอัตโนมัติเปิดอยู่</p></div><p className="mt-1 pl-6 text-[11px] leading-5 text-emerald-700/80">ระบบบันทึกการแก้ไขหลังหยุดพิมพ์ประมาณ 2 วินาทีเมื่อโครงการมีรหัสแล้ว</p></div>
              </div>
            </section>
          )}

          {activeSection === 'audio' && (
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <SettingHeader title="เสียงและการเล่น" description="ควบคุมระดับเสียงหลักที่ใช้เล่นและทดลองโน้ต" />
              <div className="p-5 sm:p-6"><div className="rounded-2xl border border-slate-200 p-4 sm:p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-black text-slate-800">ระดับเสียงหลัก</p><p className="mt-1 text-xs text-slate-500">มีผลกับตัวแก้ไขโน้ตและการทดลองเสียง</p></div><span className="rounded-xl bg-indigo-50 px-3 py-1.5 text-sm font-black tabular-nums text-indigo-600">{layoutConfig.volume ?? 100}%</span></div><input type="range" min="0" max="100" value={layoutConfig.volume ?? 100} onChange={(event) => setLayoutValue('volume', Number(event.target.value))} className="mt-5 h-2 w-full accent-indigo-500" aria-label="ระดับเสียงหลัก" /><div className="mt-2 flex justify-between text-[9px] font-bold text-slate-400"><span>เงียบ</span><span>ดังสุด</span></div></div></div>
            </section>
          )}

          {activeSection === 'data' && (
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <SettingHeader title="ข้อมูลและการสำรอง" description="เก็บสำเนาโครงการทั้งหมดไว้นอกระบบเพื่อความปลอดภัย" />
              <div className="p-5 sm:p-6"><div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Download size={18} /></span><div><p className="text-sm font-black text-slate-800">ดาวน์โหลดข้อมูลทั้งหมด</p><p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">รวมโครงการ Editor ทั้งหมดเป็น ZIP โดยแต่ละโครงการอยู่ในรูปแบบ .tme</p></div></div><button type="button" onClick={handleExportAllData} disabled={isExporting} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-xs font-black text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-wait disabled:bg-slate-300"><HardDrive size={15} />{isExporting ? 'กำลังสร้างไฟล์...' : 'สร้างไฟล์สำรอง'}</button></div></div>
            </section>
          )}

          {activeSection === 'shortcuts' && (
            <div className="space-y-4">
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><SettingHeader title="คีย์ลัดในตัวแก้ไข" description="คำสั่งที่ใช้บ่อยสำหรับการเขียนและจัดการโน้ต" /><div className="grid gap-2 p-5 sm:grid-cols-2 sm:p-6">{shortcuts.map(([key, description]) => <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"><span className="text-[11px] font-medium text-slate-600">{description}</span><kbd className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-700 shadow-sm">{key}</kbd></div>)}</div></section>
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><SettingHeader title="เกี่ยวกับแอป" description="ข้อมูลเวอร์ชันและมาตรฐานไฟล์ที่ระบบรองรับ" /><div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">{[['แอปพลิเคชัน', APP_METADATA.name], ['เวอร์ชัน', `v${APP_METADATA.version}`], ['ThaiMusicXML', `v${APP_METADATA.thaiMusicXmlVersion}`]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><BadgeInfo size={16} className="text-indigo-500" /><p className="mt-3 text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-black text-slate-800">{value}</p></div>)}</div></section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Settings;
