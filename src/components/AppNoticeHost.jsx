import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { APP_NOTICE_EVENT } from '../utils/appNotice';

const toneStyles = {
  success: { Icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-600' },
  error: { Icon: AlertTriangle, className: 'border-rose-200 bg-rose-600' },
  warning: { Icon: AlertTriangle, className: 'border-amber-200 bg-amber-500' },
  info: { Icon: Info, className: 'border-sky-200 bg-sky-600' },
};

const AppNoticeHost = () => {
  const [notice, setNotice] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleNotice = (event) => {
      window.clearTimeout(timerRef.current);
      const nextNotice = event.detail || {};
      setNotice(nextNotice);
      timerRef.current = window.setTimeout(
        () => setNotice(null),
        nextNotice.duration || (nextNotice.tone === 'error' ? 5000 : 3200),
      );
    };
    window.addEventListener(APP_NOTICE_EVENT, handleNotice);
    return () => {
      window.removeEventListener(APP_NOTICE_EVENT, handleNotice);
      window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!notice) return null;
  const style = toneStyles[notice.tone] || toneStyles.info;
  const Icon = style.Icon;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[12000] flex justify-center px-4" role={notice.tone === 'error' ? 'alert' : 'status'} aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}>
      <div className={`pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-white shadow-2xl ${style.className}`} style={{ fontFamily: 'Prompt, sans-serif' }}>
        <Icon className="shrink-0" size={19} aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm font-bold leading-5">{notice.message}</p>
        <button type="button" onClick={() => setNotice(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white" aria-label="ปิดข้อความแจ้งเตือน">
          <X size={17} />
        </button>
      </div>
    </div>
  );
};

export default AppNoticeHost;
