import React from 'react';

const PageHeader = ({ icon, title, subtitle, badge, children, hideActionsOnMobile = false }) => (
  <header className="relative mb-8 rounded-[28px] border border-slate-200/80 bg-white px-5 py-6 shadow-sm sm:px-7 md:px-9 md:py-8">
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
      <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-100/70 blur-3xl" />
      <div className="absolute -bottom-28 right-48 h-56 w-56 rounded-full bg-sky-100/50 blur-3xl" />
    </div>
    <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/15">
          {icon && React.createElement(icon, { size: 25, strokeWidth: 2.2 })}
        </span>
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">{title}</h1>
            {badge && <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-indigo-600">{badge}</span>}
          </div>
          <p className="max-w-2xl text-xs font-medium leading-6 text-slate-500 md:text-sm">{subtitle}</p>
        </div>
      </div>
      {children && <div className={`${hideActionsOnMobile ? 'hidden md:flex' : 'flex'} w-full shrink-0 items-center gap-3 self-start md:w-auto md:justify-end md:self-auto`}>{children}</div>}
    </div>
  </header>
);

export default PageHeader;
