import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Database,
  FilePlus2,
  FolderOpen,
  Gauge,
  HardDrive,
  LogIn,
  RefreshCw,
  Save,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
} from 'lucide-react';
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../utils/firebase';

const LIMITS = {
  reads: 50000,
  writes: 20000,
  deletes: 20000,
  storage: 1024 * 1024 * 1024,
};
const DEFAULT_ANALYTICS_API_URL = 'https://thai-music-api.onrender.com';

const dateKey = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const recentDateKeys = (days) => Array.from({ length: days }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - (days - index - 1));
  return dateKey(date);
});
const sum = (items, field) => items.reduce((total, item) => total + Number(item[field] || 0), 0);
const formatNumber = (value) => Number(value || 0).toLocaleString('th-TH');
const formatBytes = (bytes = 0) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const quotaState = (percentage) => {
  if (percentage >= 90) return { label: 'Critical', bar: 'bg-rose-500', text: 'text-rose-600', panel: 'border-rose-200 bg-rose-50' };
  if (percentage >= 80) return { label: 'High', bar: 'bg-orange-500', text: 'text-orange-600', panel: 'border-orange-200 bg-orange-50' };
  if (percentage >= 60) return { label: 'Warning', bar: 'bg-amber-500', text: 'text-amber-600', panel: 'border-amber-200 bg-amber-50' };
  return { label: 'Normal', bar: 'bg-emerald-500', text: 'text-emerald-600', panel: 'border-emerald-200 bg-emerald-50' };
};

const MetricCard = ({ label, value, detail, Icon, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[11px] font-semibold text-slate-500">{label}</p><strong className="mt-2 block text-2xl font-black text-slate-900">{value}</strong><p className="mt-1 text-[10px] text-slate-400">{detail}</p></div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{React.createElement(Icon, { size: 18 })}</span>
      </div>
    </div>
  );
};

const QuotaCard = ({ label, used, limit, format = formatNumber, source }) => {
  const percentage = limit ? Math.min((used / limit) * 100, 100) : 0;
  const state = quotaState(percentage);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold text-slate-800">{label}</p><p className="mt-1 text-[10px] text-slate-400">{source}</p></div>
        <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${state.panel} ${state.text}`}>{state.label}</span>
      </div>
      <div className="mt-4 flex items-end justify-between"><strong className="text-lg text-slate-900">{format(used)}</strong><span className="text-[10px] text-slate-400">/ {format(limit)}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${state.bar}`} style={{ width: `${Math.max(percentage, used ? 1 : 0)}%` }} /></div>
      <p className={`mt-2 text-right text-[10px] font-bold ${state.text}`}>{percentage.toFixed(1)}%</p>
    </div>
  );
};

const BarChart = ({ data, field, color = 'bg-blue-500', formatter = formatNumber }) => {
  const max = Math.max(...data.map((item) => Number(item[field] || 0)), 1);
  return (
    <div className="flex h-52 items-end gap-1.5 pt-8">
      {data.map((item, index) => {
        const value = Number(item[field] || 0);
        return (
          <div key={item.date} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="relative flex flex-1 items-end">
              <div className={`w-full min-h-[2px] rounded-t-md ${color} opacity-80 transition-opacity group-hover:opacity-100`} style={{ height: `${Math.max((value / max) * 100, value ? 3 : 1)}%` }} />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[9px] text-white group-hover:block">{formatter(value)}</span>
            </div>
            {(data.length <= 7 || index % Math.ceil(data.length / 7) === 0 || index === data.length - 1) && <span className="mt-2 truncate text-center text-[8px] text-slate-400">{item.date.slice(5)}</span>}
          </div>
        );
      })}
    </div>
  );
};

export default function SystemAnalyticsPanel({ users = [], totalProjects = 0, estimatedStorageBytes = 0 }) {
  const [range, setRange] = useState(7);
  const [daily, setDaily] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [cloudMetrics, setCloudMetrics] = useState(null);
  const [cloudError, setCloudError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [chartMetric, setChartMetric] = useState('activeUsers');

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setCloudError('');
    try {
      const keys = recentDateKeys(Math.max(range, 30));
      const rows = [];
      for (let index = 0; index < keys.length; index += 10) {
        const batch = keys.slice(index, index + 10);
        const results = await Promise.all(batch.map(async (key) => {
          const snapshot = await getDocs(collection(db, 'analytics_daily', key, 'activity'));
          const items = snapshot.docs.map((entry) => entry.data());
          const projectIds = new Set(items.flatMap((item) => item.activeProjectIds || []));
          const featureUsage = {};
          items.forEach((item) => Object.entries(item).forEach(([field, value]) => {
            const match = field.match(/^feature_(.+)_(reads|writes|deletes)$/);
            if (!match) return;
            featureUsage[match[1]] ||= { reads: 0, writes: 0, deletes: 0 };
            featureUsage[match[1]][match[2]] += Number(value || 0);
          }));
          return {
            date: key,
            activeUsers: items.length,
            sessions: sum(items, 'sessions'),
            projectOpens: sum(items, 'projectOpens'),
            projectsCreated: sum(items, 'projectsCreated'),
            projectSaves: sum(items, 'projectSaves'),
            loginSuccess: sum(items, 'loginSuccess'),
            loginFailure: sum(items, 'loginFailure'),
            trackedReads: sum(items, 'trackedReads'),
            trackedWrites: sum(items, 'trackedWrites'),
            trackedDeletes: sum(items, 'trackedDeletes'),
            activeProjects: projectIds.size,
            userIds: items.map((item) => item.uid),
            featureUsage,
          };
        }));
        rows.push(...results);
      }
      setDaily(rows);

      const presenceSnapshot = await getDocs(collection(db, 'analytics_presence'));
      const onlineCutoff = Date.now() - (7 * 60 * 1000);
      setOnlineUsers(presenceSnapshot.docs.reduce((result, entry) => {
        const presence = entry.data();
        const lastSeenMs = presence.lastSeenAt?.toMillis?.()
          ?? (presence.lastSeenAt?.seconds ? presence.lastSeenAt.seconds * 1000 : 0);
        if (lastSeenMs >= onlineCutoff) {
          result.push({ id: entry.id, ...presence, lastSeenMs });
        }
        return result;
      }, []));

      const today = rows.at(-1);
      if (today) {
        await setDoc(doc(db, 'analytics_daily', today.date), {
          date: today.date,
          activeUsers: today.activeUsers,
          sessions: today.sessions,
          projectOpens: today.projectOpens,
          projectsCreated: today.projectsCreated,
          projectSaves: today.projectSaves,
          firestoreReads: today.trackedReads,
          firestoreWrites: today.trackedWrites,
          firestoreDeletes: today.trackedDeletes,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      const apiUrl = import.meta.env.VITE_ANALYTICS_API_URL || DEFAULT_ANALYTICS_API_URL;
      if (apiUrl && auth.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken();
          const response = await fetch(`${apiUrl.replace(/\/$/, '')}/admin/system-analytics?days=${range}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error(await response.text());
          setCloudMetrics(await response.json());
        } catch (error) {
          console.error('โหลด Cloud Monitoring ไม่สำเร็จ:', error);
          setCloudMetrics(null);
          setCloudError('เชื่อมต่อ Cloud Monitoring ไม่สำเร็จ กำลังแสดงตัวเลขที่แอปติดตามแทน');
        }
      } else {
        setCloudMetrics(null);
        setCloudError('ยังไม่พบผู้ใช้ที่ยืนยันตัวตน จึงแสดงตัวเลขที่แอปติดตามแทน');
      }
    } catch (error) {
      console.error('โหลด System Analytics ไม่สำเร็จ:', error);
      setCloudError('ยังไม่มีสิทธิ์อ่าน Analytics กรุณา deploy Firestore Rules รุ่นล่าสุด');
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const selectedDaily = useMemo(() => daily.slice(-range), [daily, range]);
  const today = daily.at(-1) || {};
  const newUsersTodayFallback = users.filter((user) => {
    const createdDate = user.createdAt?.toDate?.();
    return createdDate && dateKey(createdDate) === dateKey();
  }).length;
  const newUsersToday = cloudMetrics?.authentication?.newUsersToday ?? newUsersTodayFallback;
  const totalAuthUsers = cloudMetrics?.authentication?.totalUsers ?? users.length;
  const wau = new Set(daily.slice(-7).flatMap((item) => item.userIds || [])).size;
  const mau = new Set(daily.slice(-30).flatMap((item) => item.userIds || [])).size;
  const returningUsers = Math.max(Number(today.activeUsers || 0) - newUsersToday, 0);
  const actualToday = cloudMetrics?.today;
  const usage = {
    reads: actualToday?.reads ?? today.trackedReads ?? 0,
    writes: actualToday?.writes ?? today.trackedWrites ?? 0,
    deletes: actualToday?.deletes ?? today.trackedDeletes ?? 0,
    storage: cloudMetrics?.storageBytes || estimatedStorageBytes,
  };
  const metricSource = cloudMetrics ? 'Cloud Monitoring · รอบวัน Pacific' : 'App tracked · ยังไม่ใช่ยอดบิล';
  const alerts = ['reads', 'writes', 'deletes'].filter((key) => (usage[key] / LIMITS[key]) >= 0.7);
  const featureTotals = useMemo(() => {
    const result = {};
    selectedDaily.forEach((day) => Object.entries(day.featureUsage || {}).forEach(([feature, values]) => {
      result[feature] ||= { reads: 0, writes: 0, deletes: 0 };
      result[feature].reads += values.reads;
      result[feature].writes += values.writes;
      result[feature].deletes += values.deletes;
    }));
    return Object.entries(result).sort(([, a], [, b]) => (b.reads + b.writes + b.deletes) - (a.reads + a.writes + a.deletes));
  }, [selectedDaily]);
  const activeUsers = Math.max(Number(today.activeUsers || 0), 1);
  const averages = {
    reads: usage.reads / activeUsers,
    writes: usage.writes / activeUsers,
    deletes: usage.deletes / activeUsers,
    opens: Number(today.projectOpens || 0) / activeUsers,
  };
  const estimatedCapacity = Math.floor(Math.min(
    averages.reads ? LIMITS.reads / averages.reads : Infinity,
    averages.writes ? LIMITS.writes / averages.writes : Infinity,
    averages.deletes ? LIMITS.deletes / averages.deletes : Infinity,
  ));

  const chartData = selectedDaily.map((item, index) => ({
    ...item,
    reads: cloudMetrics?.history?.reads?.[index]?.value ?? item.trackedReads,
    writes: cloudMetrics?.history?.writes?.[index]?.value ?? item.trackedWrites,
    deletes: cloudMetrics?.history?.deletes?.[index]?.value ?? item.trackedDeletes,
  }));
  const chartOptions = [
    ['activeUsers', 'ผู้ใช้งาน', 'bg-blue-500'],
    ['reads', 'Reads', 'bg-violet-500'],
    ['writes', 'Writes', 'bg-emerald-500'],
    ['deletes', 'Deletes', 'bg-rose-500'],
    ['projectOpens', 'เปิดโปรเจกต์', 'bg-cyan-500'],
    ['projectsCreated', 'สร้างโปรเจกต์', 'bg-amber-500'],
  ];
  const chartConfig = chartOptions.find(([id]) => id === chartMetric) || chartOptions[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-black text-slate-900">System Analytics</h2><p className="mt-1 text-xs text-slate-500">กิจกรรมผู้ใช้และสถานะ Firebase quota</p></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">{[7, 30, 90].map((days) => <button key={days} type="button" onClick={() => setRange(days)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${range === days ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{days} วัน</button>)}</div>
          <button type="button" onClick={loadAnalytics} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {alerts.length > 0 && <div className={`flex gap-3 rounded-2xl border px-4 py-3 ${alerts.some((key) => usage[key] / LIMITS[key] >= 0.9) ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><AlertTriangle size={18} className="mt-0.5 shrink-0" /><div><p className="text-xs font-black">Firebase quota ใกล้ถึงขีดจำกัด</p><p className="mt-1 text-[10px]">ตรวจพบ {alerts.join(', ')} ใช้งานตั้งแต่ 70% ขึ้นไป</p></div></div>}
      {cloudError && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[10px] text-blue-800">{cloudError}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Active Users วันนี้" value={formatNumber(today.activeUsers)} detail={`WAU ${wau} · MAU ${mau}`} Icon={Users} />
        <MetricCard label="กำลังออนไลน์" value={formatNumber(onlineUsers.length)} detail="พบสัญญาณใน 7 นาทีล่าสุด" Icon={Wifi} tone="emerald" />
        <MetricCard label="ผู้ใช้ใหม่วันนี้" value={formatNumber(newUsersToday)} detail={`Returning ${returningUsers} คน`} Icon={FilePlus2} tone="amber" />
        <MetricCard label="Session วันนี้" value={formatNumber(today.sessions)} detail={`Login สำเร็จ ${formatNumber(today.loginSuccess)}`} Icon={LogIn} tone="violet" />
        <MetricCard label="เปิดโปรเจกต์วันนี้" value={formatNumber(today.projectOpens)} detail={`สร้างใหม่ ${formatNumber(today.projectsCreated)}`} Icon={FolderOpen} tone="slate" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="text-sm font-black text-slate-900">Firebase Authentication</h3><p className="mt-1 text-[10px] text-slate-500">ยอดผู้ใช้จาก Firebase Auth เมื่อเชื่อม API · กิจกรรม Login จากระบบติดตามของแอป</p></div>
            <UserCheck size={18} className="text-blue-600" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['ผู้ใช้ทั้งหมด', totalAuthUsers],
              ['ผู้ใช้ใหม่วันนี้', newUsersToday],
              ['Login วันนี้', today.loginSuccess],
              ['Active วันนี้', today.activeUsers],
              ['Login สำเร็จ', today.loginSuccess],
              ['Login ล้มเหลว', today.loginFailure],
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold text-slate-500">{label}</p><strong className="mt-1 block text-lg text-slate-900">{formatNumber(value)}</strong></div>)}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><div><h3 className="text-sm font-black text-slate-900">ผู้ใช้งานออนไลน์</h3><p className="mt-1 text-[10px] text-slate-500">แสดงชื่อและหน้าที่กำลังใช้งาน โดยไม่เก็บข้อมูลส่วนตัวเพิ่มเติม</p></div><Wifi size={18} className="text-emerald-500" /></div>
          <div className="mt-4 max-h-52 space-y-2 overflow-y-auto">
            {onlineUsers.length ? onlineUsers.map((presence) => {
              const profile = users.find((user) => user.id === presence.uid);
              const displayName = profile?.displayName || profile?.name || profile?.firstName || `ผู้ใช้ ${presence.uid.slice(0, 6)}`;
              return <div key={presence.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"><span className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" /><span className="truncate text-xs font-bold text-slate-700">{displayName}</span></span><span className="shrink-0 text-[9px] text-slate-400">{presence.page || 'กำลังใช้งาน'}</span></div>;
            }) : <div className="rounded-xl bg-slate-50 px-3 py-8 text-center text-[10px] text-slate-400">ยังไม่พบผู้ใช้งานใน 7 นาทีล่าสุด</div>}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-black text-slate-900">Firebase Quota Usage</h3><p className="mt-1 text-[10px] text-slate-500">{metricSource}</p></div><Gauge size={19} className="text-slate-400" /></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuotaCard label="Document Reads" used={usage.reads} limit={LIMITS.reads} source={metricSource} />
          <QuotaCard label="Document Writes" used={usage.writes} limit={LIMITS.writes} source={metricSource} />
          <QuotaCard label="Document Deletes" used={usage.deletes} limit={LIMITS.deletes} source={metricSource} />
          <QuotaCard label="Firestore Storage" used={usage.storage} limit={LIMITS.storage} format={formatBytes} source={cloudMetrics ? 'Cloud metric · รวมดัชนี' : 'ประมาณจากเอกสาร'} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-500"><UserPlus size={13} className="text-slate-400" /><span>Data Transfer: {cloudMetrics?.dataTransferBytes == null ? 'Cloud Monitoring ไม่ส่งค่าที่เทียบกับยอด Billing ได้โดยตรง' : formatBytes(cloudMetrics.dataTransferBytes)}</span></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-black text-slate-900">Usage History</h3><p className="mt-1 text-[10px] text-slate-500">สถิติย้อนหลัง {range} วัน</p></div><select value={chartMetric} onChange={(event) => setChartMetric(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600">{chartOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
          <BarChart data={chartData} field={chartMetric} color={chartConfig[2]} />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black text-slate-900">Project Analytics วันนี้</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">{[[Database, 'ทั้งหมด', totalProjects], [FilePlus2, 'สร้างใหม่', today.projectsCreated], [FolderOpen, 'เปิด', today.projectOpens], [Save, 'บันทึก', today.projectSaves], [Activity, 'Active', today.activeProjects]].map(([Icon, label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><span className="flex items-center gap-2 text-[10px] text-slate-500">{React.createElement(Icon, { size: 13 })}{label}</span><strong className="mt-1 block text-lg text-slate-900">{formatNumber(value)}</strong></div>)}</div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-black text-slate-900">Feature Usage</h3><p className="mt-1 text-[10px] text-slate-500">การใช้งาน Firestore ที่แอปติดตาม แยกตาม Feature</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-slate-50 text-[10px] text-slate-500"><tr><th className="px-5 py-3">Feature</th><th className="px-5 py-3">Reads</th><th className="px-5 py-3">Writes</th><th className="px-5 py-3">Deletes</th></tr></thead><tbody>{featureTotals.length ? featureTotals.map(([feature, values]) => <tr key={feature} className="border-t border-slate-100"><td className="px-5 py-3 font-bold text-slate-700">{feature}</td><td className="px-5 py-3">{formatNumber(values.reads)}</td><td className="px-5 py-3">{formatNumber(values.writes)}</td><td className="px-5 py-3">{formatNumber(values.deletes)}</td></tr>) : <tr><td colSpan="4" className="px-5 py-10 text-center text-slate-400">ข้อมูลจะเริ่มสะสมหลัง deploy ระบบ Analytics</td></tr>}</tbody></table></div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><HardDrive size={17} className="text-blue-600" /><h3 className="text-sm font-black text-slate-900">Estimated Usage Per User</h3></div>
          <div className="mt-4 space-y-2">{[['Reads / Active User', averages.reads], ['Writes / Active User', averages.writes], ['Deletes / Active User', averages.deletes], ['Project Opens / Active User', averages.opens]].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-[10px] font-semibold text-slate-500">{label}</span><strong className="text-xs text-slate-800">{value.toFixed(1)}</strong></div>)}</div>
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-[10px] text-blue-700">Spark Plan รองรับโดยประมาณ</p><strong className="mt-1 block text-xl text-blue-800">{Number.isFinite(estimatedCapacity) ? formatNumber(estimatedCapacity) : 'ยังประเมินไม่ได้'} ผู้ใช้/วัน</strong><p className="mt-1 text-[9px] leading-4 text-blue-600">ประมาณจากค่าเฉลี่ยวันนี้และ quota ที่ตึงที่สุด</p></div>
        </div>
      </section>
    </div>
  );
}
