import React from 'react';
import { Crown, Database, ShieldCheck, UserRound } from 'lucide-react';

const formatStorageSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const ROLE_CONFIG = {
  admin: {
    label: 'ผู้ดูแลระบบ',
    detail: 'สิทธิ์ Admin',
    Icon: ShieldCheck,
    badgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    iconClass: 'bg-violet-600 text-white',
    progressClass: 'bg-violet-500',
  },
  premium: {
    label: 'สมาชิกพรีเมียม',
    detail: 'สิทธิ์ Premium',
    Icon: Crown,
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    iconClass: 'bg-amber-500 text-white',
    progressClass: 'bg-amber-500',
  },
  user: {
    label: 'สมาชิกทั่วไป',
    detail: 'สิทธิ์ Free',
    Icon: UserRound,
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    iconClass: 'bg-sky-500 text-white',
    progressClass: 'bg-sky-500',
  },
};

export default function ProjectStatusBar({
  role = 'user',
  itemCount = 0,
  usedBytes = 0,
  itemLabel = 'ไฟล์',
}) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.user;
  const { Icon } = config;
  const isAdmin = role === 'admin';
  const isPremium = role === 'premium';
  const maxBytes = 5 * 1024 * 1024;
  const maxItems = 10;
  const percentage = isAdmin
    ? 100
    : isPremium
      ? Math.min((usedBytes / maxBytes) * 100, 100)
      : Math.min((itemCount / maxItems) * 100, 100);
  const usageText = isAdmin
    ? `พื้นที่ ${formatStorageSize(usedBytes)} · ไม่จำกัด`
    : isPremium
      ? `พื้นที่ ${formatStorageSize(usedBytes)} จาก 5 MB`
      : `สร้างแล้ว ${itemCount} จาก ${maxItems} ${itemLabel}`;
  const remainingText = isAdmin
    ? 'ใช้งานได้ไม่จำกัด'
    : isPremium
      ? `เหลือ ${formatStorageSize(Math.max(maxBytes - usedBytes, 0))}`
      : `เหลือ ${Math.max(maxItems - itemCount, 0)} ${itemLabel}`;

  return (
    <div className="pointer-events-none fixed bottom-20 left-4 right-4 z-40 md:bottom-4 md:left-[calc(16rem+2rem)] md:right-8">
      <div className="pointer-events-auto mx-auto flex w-full max-w-[1480px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-[0_16px_45px_rgba(15,23,42,0.14)] backdrop-blur-xl md:px-4">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${config.iconClass}`}>
          <Icon size={17} strokeWidth={2.2} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-xs font-bold text-slate-800">{config.label}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${config.badgeClass}`}>{config.detail}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 md:text-xs">
              <span>ทั้งหมด {itemCount} {itemLabel}</span>
              <span className="text-slate-300">•</span>
              <span>{usageText}</span>
            </div>
          </div>

          {!isAdmin && (
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all duration-500 ${percentage >= 100 ? 'bg-rose-500' : config.progressClass}`} style={{ width: `${Math.max(percentage, 1)}%` }} />
              </div>
              <span className={`whitespace-nowrap text-[9px] font-bold md:text-[10px] ${percentage >= 100 ? 'text-rose-600' : 'text-slate-500'}`}>{remainingText}</span>
            </div>
          )}
        </div>

        <Database className="hidden shrink-0 text-slate-300 sm:block" size={17} />
      </div>
    </div>
  );
}
