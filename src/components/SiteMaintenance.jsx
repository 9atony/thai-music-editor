import React, { useEffect, useState } from 'react';
import { Clock3, ShieldCheck, Wrench } from 'lucide-react';

const formatRemaining = (milliseconds) => {
  if (milliseconds <= 0) return 'กำลังเปิดระบบอีกครั้ง...';
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    days > 0 ? `${days} วัน` : null,
    hours > 0 || days > 0 ? `${hours} ชม.` : null,
    `${minutes} นาที`,
    `${seconds} วินาที`,
  ].filter(Boolean).join(' ');
};

const SiteMaintenance = ({ maintenance, isAuthenticated, onAdminAccess }) => {
  const [now, setNow] = useState(() => Date.now());
  const endsAt = maintenance?.endsAt?.toDate?.() || null;
  const endsAtMs = endsAt?.getTime?.() || 0;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedEnd = endsAt?.toLocaleString('th-TH', {
    dateStyle: 'full',
    timeStyle: 'short',
  }) || 'เร็ว ๆ นี้';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-10 text-white" style={{ fontFamily: 'Prompt, sans-serif' }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.24),transparent_42%)]" />
      <section className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 text-center shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20">
          <Wrench size={36} />
        </span>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.25em] text-amber-300">Scheduled maintenance</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">เว็บไซต์กำลังปรับปรุง</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
          {maintenance?.message || 'เรากำลังปรับปรุงระบบเพื่อให้ใช้งานได้ดียิ่งขึ้น กรุณากลับมาอีกครั้งเมื่อครบเวลาที่กำหนด'}
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400"><Clock3 size={15} /> เปิดให้ใช้งานอีกครั้ง</div>
            <p className="mt-2 text-sm font-bold text-white">{formattedEnd}</p>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
            <p className="text-xs font-bold text-amber-200">เวลาที่เหลือโดยประมาณ</p>
            <p className="mt-2 text-sm font-black text-amber-300">{formatRemaining(endsAtMs - now)}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAdminAccess}
          className="mx-auto mt-7 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/15 hover:text-white"
        >
          <ShieldCheck size={15} />
          {isAuthenticated ? 'เปลี่ยนบัญชีเพื่อเข้าสู่ระบบผู้ดูแล' : 'เข้าสู่ระบบสำหรับผู้ดูแล'}
        </button>
      </section>
    </main>
  );
};

export default SiteMaintenance;
