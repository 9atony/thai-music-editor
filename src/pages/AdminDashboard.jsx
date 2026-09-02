import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  BarChart3,
  BookOpenText,
  Clock3,
  Crown,
  Database,
  Download,
  FileMusic,
  FolderKanban,
  HardDrive,
  LayoutTemplate,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db, upgradeUserToPremium } from '../utils/firebase';
import PageHeader from '../components/layout/PageHeader';
import SystemAnalyticsPanel from '../components/admin/SystemAnalyticsPanel';

const GIB = 1024 * 1024 * 1024;
const PREMIUM_BYTES = 5 * 1024 * 1024;
const BUILT_IN_TEMPLATE_COUNT = 4;

const SYSTEM_COLLECTIONS = [
  { id: 'samples', label: 'เพลงตัวอย่าง', Icon: FileMusic, color: 'text-sky-600 bg-sky-50' },
  { id: 'updates', label: 'ข่าวและประกาศ', Icon: Activity, color: 'text-emerald-600 bg-emerald-50' },
  { id: 'system_rhythms', label: 'คลังจังหวะกลาง', Icon: SlidersHorizontal, color: 'text-orange-600 bg-orange-50' },
  { id: 'ranat_dictionary', label: 'พจนานุกรมระนาด', Icon: BookOpenText, color: 'text-violet-600 bg-violet-50' },
  { id: 'tuning_dataset', label: 'ชุดข้อมูลจูน AI', Icon: Sparkles, color: 'text-fuchsia-600 bg-fuchsia-50' },
  { id: 'templates', label: 'เทมเพลตบน Cloud', Icon: LayoutTemplate, color: 'text-indigo-600 bg-indigo-50' },
];

const utf8Size = (value) => new TextEncoder().encode(String(value)).length + 1;

const firestoreFieldsSize = (value) => Object.entries(value || {}).reduce(
  (sum, [key, fieldValue]) => sum + utf8Size(key) + firestoreValueSize(fieldValue),
  0,
);

const firestoreValueSize = (value) => {
  if (value == null) return 1;
  if (typeof value === 'boolean') return 1;
  if (typeof value === 'number') return 8;
  if (typeof value === 'string') return utf8Size(value);
  if (value instanceof Date || typeof value?.toDate === 'function') return 8;
  if (value instanceof Uint8Array) return value.byteLength;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + firestoreValueSize(item), 0);
  if (typeof value === 'object') return firestoreFieldsSize(value) + 32;
  return utf8Size(value);
};

const firestoreDocumentNameSize = (path) => (
  String(path || '').split('/').filter(Boolean).reduce((sum, segment) => sum + utf8Size(segment), 16)
);

const estimateDocumentBytes = (snapshot) => (
  firestoreDocumentNameSize(snapshot.ref.path) + firestoreFieldsSize(snapshot.data()) + 32
);

const summarizeSnapshot = (snapshot) => {
  let bytes = 0;
  snapshot.docs.forEach((documentSnapshot) => { bytes += estimateDocumentBytes(documentSnapshot); });
  return { count: snapshot.size, bytes };
};

const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < GIB) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / GIB).toFixed(2)} GB`;
};

const formatDate = (timestamp) => {
  const date = typeof timestamp?.toDate === 'function'
    ? timestamp.toDate()
    : timestamp?.seconds
      ? new Date(timestamp.seconds * 1000)
      : null;
  if (!date) return 'ไม่ระบุ';
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const calculateTimeLeft = (premiumUntil, now) => {
  if (!premiumUntil || typeof premiumUntil.toDate !== 'function') return null;
  const diffTime = premiumUntil.toDate().getTime() - now.getTime();
  if (diffTime <= 0) return { expired: true };
  return {
    expired: false,
    days: Math.floor(diffTime / 86400000),
    hours: Math.floor((diffTime / 3600000) % 24),
    minutes: Math.floor((diffTime / 60000) % 60),
  };
};

const roleStyle = {
  admin: 'border-violet-200 bg-violet-50 text-violet-700',
  premium: 'border-amber-200 bg-amber-50 text-amber-700',
  user: 'border-slate-200 bg-slate-50 text-slate-600',
};

const StatCard = ({ label, value, detail, Icon, iconClass }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
      </div>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}>
        {React.createElement(Icon, { size: 20 })}
      </span>
    </div>
  </div>
);

const AdminDashboard = ({ userProfile }) => {
  const [usersData, setUsersData] = useState([]);
  const [systemCollections, setSystemCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('latest');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeSection, setActiveSection] = useState('analytics');
  const [selectedUser, setSelectedUser] = useState(null);
  const [now, setNow] = useState(new Date());

  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setLoadError('');

    try {
      const [usersSnapshot, ...collectionResults] = await Promise.all([
        getDocs(collection(db, 'users')),
        ...SYSTEM_COLLECTIONS.map(async (definition) => {
          try {
            const snapshot = await getDocs(collection(db, definition.id));
            return { ...definition, ...summarizeSnapshot(snapshot), available: true };
          } catch (error) {
            console.warn(`อ่าน collection ${definition.id} ไม่สำเร็จ:`, error);
            return { ...definition, count: 0, bytes: 0, available: false };
          }
        }),
      ]);

      const nextUsers = [];
      const batchSize = 20;
      for (let index = 0; index < usersSnapshot.docs.length; index += batchSize) {
        const userBatch = usersSnapshot.docs.slice(index, index + batchSize);
        const batchResults = await Promise.all(userBatch.map(async (userSnapshot) => {
          const [editorSnapshot, arrangerSnapshot] = await Promise.all([
            getDocs(collection(db, `users/${userSnapshot.id}/projects`)),
            getDocs(collection(db, `users/${userSnapshot.id}/arrangerProjects`)),
          ]);
          const editorProjects = editorSnapshot.docs.map((projectSnapshot) => {
            const bytes = estimateDocumentBytes(projectSnapshot);
            return { id: projectSnapshot.id, kind: 'editor', bytes, ...projectSnapshot.data() };
          });
          const arrangerProjects = arrangerSnapshot.docs.map((projectSnapshot) => {
            const bytes = estimateDocumentBytes(projectSnapshot);
            return { id: projectSnapshot.id, kind: 'arranger', bytes, ...projectSnapshot.data() };
          });
          const profileBytes = estimateDocumentBytes(userSnapshot);
          const editorBytes = editorProjects.reduce((sum, project) => sum + project.bytes, 0);
          const arrangerBytes = arrangerProjects.reduce((sum, project) => sum + project.bytes, 0);
          return {
            id: userSnapshot.id,
            ...userSnapshot.data(),
            profileBytes,
            editorBytes,
            arrangerBytes,
            editorProjectCount: editorProjects.length,
            arrangerProjectCount: arrangerProjects.length,
            projectCount: editorProjects.length + arrangerProjects.length,
            storageUsed: profileBytes + editorBytes + arrangerBytes,
            projects: [...editorProjects, ...arrangerProjects],
          };
        }));
        nextUsers.push(...batchResults);
      }

      setUsersData(nextUsers);
      setSystemCollections(collectionResults);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('โหลดข้อมูล Admin Dashboard ไม่สำเร็จ:', error);
      setLoadError('ไม่สามารถโหลดข้อมูลภาพรวมจาก Firebase ได้ กรุณาตรวจสอบสิทธิ์ Admin และ Firestore Rules');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const totals = useMemo(() => {
    const userProfileBytes = usersData.reduce((sum, user) => sum + user.profileBytes, 0);
    const editorBytes = usersData.reduce((sum, user) => sum + user.editorBytes, 0);
    const arrangerBytes = usersData.reduce((sum, user) => sum + user.arrangerBytes, 0);
    const systemBytes = systemCollections.reduce((sum, item) => sum + item.bytes, 0);
    const editorProjects = usersData.reduce((sum, user) => sum + user.editorProjectCount, 0);
    const arrangerProjects = usersData.reduce((sum, user) => sum + user.arrangerProjectCount, 0);
    const systemDocuments = systemCollections.reduce((sum, item) => sum + item.count, 0);
    return {
      userProfileBytes,
      editorBytes,
      arrangerBytes,
      systemBytes,
      totalBytes: userProfileBytes + editorBytes + arrangerBytes + systemBytes,
      editorProjects,
      arrangerProjects,
      totalProjects: editorProjects + arrangerProjects,
      systemDocuments,
      totalDocuments: usersData.length + editorProjects + arrangerProjects + systemDocuments,
    };
  }, [usersData, systemCollections]);

  const roleCounts = useMemo(() => ({
    all: usersData.length,
    user: usersData.filter((user) => (user.role || 'user') === 'user').length,
    premium: usersData.filter((user) => user.role === 'premium').length,
    admin: usersData.filter((user) => user.role === 'admin').length,
  }), [usersData]);

  const displayedUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return usersData
      .filter((user) => {
        const role = user.role || 'user';
        const matchesRole = roleFilter === 'all' || role === roleFilter;
        const searchable = `${user.displayName || ''} ${user.email || ''} ${user.id}`.toLowerCase();
        return matchesRole && searchable.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortOrder === 'storage') return b.storageUsed - a.storageUsed;
        if (sortOrder === 'projects') return b.projectCount - a.projectCount;
        if (sortOrder === 'name') return String(a.displayName || a.email || '').localeCompare(String(b.displayName || b.email || ''), 'th');
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
  }, [usersData, searchQuery, roleFilter, sortOrder]);

  const storageSegments = useMemo(() => [
    { label: 'โปรเจกต์ Editor', bytes: totals.editorBytes, className: 'bg-blue-500' },
    { label: 'โปรเจกต์จัดวง', bytes: totals.arrangerBytes, className: 'bg-violet-500' },
    { label: 'ข้อมูลระบบ', bytes: totals.systemBytes, className: 'bg-emerald-500' },
    { label: 'บัญชีผู้ใช้', bytes: totals.userProfileBytes, className: 'bg-slate-400' },
  ], [totals]);

  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`ยืนยันการเปลี่ยนสิทธิ์เป็น ${newRole}?`)) return;
    setIsUpdating(true);
    try {
      if (newRole === 'premium') {
        await upgradeUserToPremium(userId, 1);
        await fetchDashboardData();
      } else {
        await updateDoc(doc(db, 'users', userId), { role: newRole });
        setUsersData((current) => current.map((user) => (
          user.id === userId ? { ...user, role: newRole } : user
        )));
      }
    } catch (error) {
      console.error('เปลี่ยนสิทธิ์ไม่สำเร็จ:', error);
      alert('ไม่สามารถเปลี่ยนสิทธิ์ผู้ใช้ได้');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExtendPremium = async (userId) => {
    if (!window.confirm('ยืนยันการต่ออายุ Premium เพิ่ม 1 เดือน?')) return;
    setIsUpdating(true);
    try {
      await upgradeUserToPremium(userId, 1);
      await fetchDashboardData();
    } catch (error) {
      console.error('ต่ออายุ Premium ไม่สำเร็จ:', error);
      alert('ไม่สามารถต่ออายุ Premium ได้');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadProject = (project) => {
    const projectData = { ...project };
    delete projectData.bytes;
    delete projectData.kind;
    if (typeof projectData.sheetData === 'string') {
      try { projectData.sheetData = JSON.parse(projectData.sheetData); } catch { /* keep source data */ }
    }
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = project.kind === 'arranger'
      ? `${project.name || 'arranger-project'}.arranger.json`
      : `${project.name || 'project'}.tme`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-500">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"><ShieldCheck size={30} /></span>
        <h3 className="mt-5 text-xl font-bold text-slate-800">ไม่มีสิทธิ์เข้าถึง</h3>
        <p className="mt-2 text-sm">หน้านี้สงวนไว้สำหรับผู้ดูแลระบบเท่านั้น</p>
      </div>
    );
  }

  return (
    <div className="app-page-shell animate-fadeIn text-slate-800" style={{ fontFamily: 'Prompt, sans-serif' }}>
      <PageHeader
        icon={ShieldCheck}
        badge="Admin Console"
        title="System Analytics"
        subtitle="ติดตามผู้ใช้งาน กิจกรรมระบบ และ Firebase quota จากศูนย์กลางเดียว"
      >
        <button type="button" onClick={fetchDashboardData} disabled={isLoading} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          รีเฟรชข้อมูล
        </button>
      </PageHeader>

      {loadError && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{loadError}</div>}

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/70 p-1.5">
        {[
          ['analytics', 'System Analytics', Activity],
          ['overview', 'ภาพรวม', BarChart3],
          ['users', 'จัดการผู้ใช้', Users],
          ['database', 'ข้อมูล Firebase', Database],
        ].map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setActiveSection(id)} className={`flex min-w-36 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${activeSection === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {React.createElement(Icon, { size: 15 })} {label}
          </button>
        ))}
      </div>

      {activeSection === 'analytics' && (
        <SystemAnalyticsPanel
          users={usersData}
          totalProjects={totals.totalProjects}
          estimatedStorageBytes={totals.totalBytes}
        />
      )}

      {activeSection === 'overview' && (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="ผู้ใช้งานทั้งหมด" value={usersData.length.toLocaleString()} detail={`Premium ${roleCounts.premium} · Admin ${roleCounts.admin}`} Icon={Users} iconClass="bg-sky-50 text-sky-600" />
            <StatCard label="โปรเจกต์ทั้งหมด" value={totals.totalProjects.toLocaleString()} detail={`Editor ${totals.editorProjects} · จัดวง ${totals.arrangerProjects}`} Icon={FolderKanban} iconClass="bg-violet-50 text-violet-600" />
            <StatCard label="เอกสารบน Firebase" value={totals.totalDocuments.toLocaleString()} detail="รวมเอกสารผู้ใช้และข้อมูลระบบ" Icon={Archive} iconClass="bg-emerald-50 text-emerald-600" />
            <StatCard label="ขนาดข้อมูลโดยประมาณ" value={formatBytes(totals.totalBytes)} detail="ตามสูตรเอกสาร Firestore ไม่รวมดัชนี" Icon={HardDrive} iconClass="bg-orange-50 text-orange-600" />
          </section>

          <section className="mb-6 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900"><Database size={18} className="text-blue-600" /> พื้นที่ข้อมูล Firebase</div>
                  <p className="mt-1 text-xs text-slate-500">คำนวณจากข้อมูลทุกเอกสารที่ Dashboard อ่านได้</p>
                </div>
                <div className="text-right">
                  <strong className="block text-2xl font-black text-blue-600">{formatBytes(totals.totalBytes)}</strong>
                  <span className="text-[10px] text-slate-400">จากโควตา Firestore 1 GiB</span>
                </div>
              </div>

              <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-slate-100">
                {storageSegments.map((segment) => (
                  <div key={segment.label} className={segment.className} style={{ width: totals.totalBytes ? `${Math.max((segment.bytes / totals.totalBytes) * 100, segment.bytes ? 1 : 0)}%` : '0%' }} title={`${segment.label}: ${formatBytes(segment.bytes)}`} />
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {storageSegments.map((segment) => (
                  <div key={segment.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-600"><i className={`h-2.5 w-2.5 rounded-full ${segment.className}`} />{segment.label}</span>
                    <strong className="text-xs text-slate-800">{formatBytes(segment.bytes)}</strong>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-[11px] leading-5 text-blue-800">
                ตัวเลขนี้รวมขนาดชื่อเอกสาร ชื่อฟิลด์ และค่าข้อมูลตามสูตร Firestore แต่ไม่รวมพื้นที่ดัชนี หากต้องการตัวเลขสำหรับการเรียกเก็บเงินจริง ให้ตรวจหน้า Usage/Billing ใน Firebase Console
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-slate-900">สัดส่วนสมาชิก</h2>
                  <p className="mt-1 text-xs text-slate-500">สถานะบัญชีปัจจุบัน</p>
                </div>
                <Users size={20} className="text-slate-400" />
              </div>
              <div className="mt-6 space-y-4">
                {[
                  ['สมาชิกทั่วไป', roleCounts.user, 'bg-sky-500', UserRound],
                  ['สมาชิก Premium', roleCounts.premium, 'bg-amber-500', Crown],
                  ['ผู้ดูแลระบบ', roleCounts.admin, 'bg-violet-500', ShieldCheck],
                ].map(([label, count, color, Icon]) => {
                  const percent = usersData.length ? (count / usersData.length) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="mb-1.5 flex items-center justify-between text-xs"><span className="flex items-center gap-2 font-semibold text-slate-600">{React.createElement(Icon, { size: 14 })}{label}</span><strong>{count} คน</strong></div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4 text-[10px] text-slate-400"><Clock3 size={13} />อัปเดตล่าสุด {lastUpdated ? lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="text-sm font-black text-slate-900">ข้อมูลระบบ</h2><p className="mt-1 text-xs text-slate-500">Collection ส่วนกลางที่แอปใช้งาน</p></div>
              <button type="button" onClick={() => setActiveSection('database')} className="text-xs font-bold text-blue-600 hover:text-blue-700">ดูทั้งหมด</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {systemCollections.map((item) => <CollectionCard key={item.id} item={item} />)}
            </div>
          </section>
        </>
      )}

      {activeSection === 'users' && (
        <section>
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
              {[
                ['all', 'ทั้งหมด'],
                ['user', 'ทั่วไป'],
                ['premium', 'Premium'],
                ['admin', 'Admin'],
              ].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setRoleFilter(id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${roleFilter === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{label} ({roleCounts[id]})</button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm sm:w-72">
                <Search size={15} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none" placeholder="ค้นหาชื่อ อีเมล หรือ UID..." />
              </label>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none">
                <option value="latest">สมัครล่าสุด</option>
                <option value="storage">ใช้พื้นที่มากสุด</option>
                <option value="projects">โปรเจกต์มากสุด</option>
                <option value="name">เรียงตามชื่อ</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
                  <tr><th className="px-5 py-3.5">ผู้ใช้งาน</th><th className="px-5 py-3.5">โปรเจกต์</th><th className="px-5 py-3.5">พื้นที่ข้อมูล</th><th className="px-5 py-3.5">สมาชิก</th><th className="px-5 py-3.5 text-right">จัดการสิทธิ์</th></tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan="5" className="px-5 py-14 text-center text-sm text-slate-500">กำลังรวบรวมข้อมูลจาก Firebase...</td></tr>
                  ) : displayedUsers.length === 0 ? (
                    <tr><td colSpan="5" className="px-5 py-14 text-center text-sm text-slate-500">ไม่พบผู้ใช้งานที่ตรงกับเงื่อนไข</td></tr>
                  ) : displayedUsers.map((user) => {
                    const role = user.role || 'user';
                    const timeLeft = calculateTimeLeft(user.premiumUntil, now);
                    return (
                      <tr key={user.id} onClick={() => setSelectedUser(user)} className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-blue-50/40">
                        <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">{String(user.displayName || user.email || 'U')[0].toUpperCase()}</span><div className="min-w-0"><p className="max-w-64 truncate text-sm font-bold text-slate-800">{user.displayName || 'ไม่ระบุชื่อ'}</p><p className="max-w-64 truncate text-[11px] text-slate-400">{user.email || user.id}</p></div></div></td>
                        <td className="px-5 py-4"><p className="text-sm font-bold text-slate-800">{user.projectCount}</p><p className="text-[10px] text-slate-400">Editor {user.editorProjectCount} · จัดวง {user.arrangerProjectCount}</p></td>
                        <td className="px-5 py-4"><p className="text-sm font-bold text-slate-800">{formatBytes(user.storageUsed)}</p><p className="text-[10px] text-slate-400">รวมข้อมูลบัญชี</p></td>
                        <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${roleStyle[role]}`}>{role}</span>{role === 'premium' && <p className={`mt-1 text-[9px] font-semibold ${timeLeft?.expired ? 'text-rose-500' : 'text-amber-600'}`}>{timeLeft?.expired ? 'หมดอายุแล้ว' : timeLeft ? `เหลือ ${timeLeft.days} วัน ${timeLeft.hours} ชม.` : 'ไม่ระบุวันหมดอายุ'}</p>}</td>
                        <td className="px-5 py-4 text-right" onClick={(event) => event.stopPropagation()}><div className="inline-flex items-center gap-2"><select value={role} onChange={(event) => handleRoleChange(user.id, event.target.value)} disabled={isUpdating} className={`rounded-lg border px-2.5 py-2 text-xs font-bold outline-none ${roleStyle[role]}`}><option value="user">Free</option><option value="premium">Premium</option><option value="admin">Admin</option></select>{role === 'premium' && <button type="button" onClick={() => handleExtendPremium(user.id)} disabled={isUpdating} className="rounded-lg bg-amber-500 px-3 py-2 text-[10px] font-bold text-white hover:bg-amber-600">ต่ออายุ</button>}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeSection === 'database' && (
        <section className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-base font-black text-slate-900">รายการข้อมูล Firebase</h2><p className="mt-1 text-xs text-slate-500">แยกตามประเภทข้อมูลที่ระบบใช้งานจริง</p></div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-600">{totals.totalDocuments} เอกสาร · {formatBytes(totals.totalBytes)}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <CollectionCard item={{ id: 'users', label: 'บัญชีผู้ใช้งาน', Icon: Users, color: 'text-slate-700 bg-slate-100', count: usersData.length, bytes: totals.userProfileBytes, available: true }} />
              <CollectionCard item={{ id: 'projects', label: 'โปรเจกต์ Editor', Icon: FileMusic, color: 'text-blue-600 bg-blue-50', count: totals.editorProjects, bytes: totals.editorBytes, available: true }} />
              <CollectionCard item={{ id: 'arrangerProjects', label: 'โปรเจกต์จัดวง', Icon: SlidersHorizontal, color: 'text-violet-600 bg-violet-50', count: totals.arrangerProjects, bytes: totals.arrangerBytes, available: true }} />
              {systemCollections.map((item) => <CollectionCard key={item.id} item={item} />)}
              <CollectionCard item={{ id: 'built-in-templates', label: 'เทมเพลตที่มากับเว็บ', Icon: LayoutTemplate, color: 'text-indigo-600 bg-indigo-50', count: BUILT_IN_TEMPLATE_COUNT, bytes: 0, available: true, local: true }} />
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs leading-6 text-amber-900">
            เทมเพลตมาตรฐาน {BUILT_IN_TEMPLATE_COUNT} แบบในหน้าผู้ใช้เป็นไฟล์ภายในตัวเว็บ จึงไม่กินพื้นที่ Firestore ส่วน “เทมเพลตบน Cloud” จะแสดงเฉพาะเอกสารใน collection <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono">templates</code>
          </div>
        </section>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div><h3 className="text-lg font-black text-slate-900">{selectedUser.displayName || selectedUser.email || 'ผู้ใช้งาน'}</h3><p className="mt-1 text-xs text-slate-500">Editor {selectedUser.editorProjectCount} · จัดวง {selectedUser.arrangerProjectCount} · {formatBytes(selectedUser.storageUsed)}</p></div>
              <button type="button" onClick={() => setSelectedUser(null)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={17} /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {selectedUser.projects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">ผู้ใช้นี้ยังไม่มีโปรเจกต์</div>
              ) : selectedUser.projects.map((project) => (
                <div key={`${project.kind}-${project.id}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${project.kind === 'arranger' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'}`}>{project.kind === 'arranger' ? <SlidersHorizontal size={18} /> : <FileMusic size={18} />}</span>
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h4 className="truncate text-sm font-bold text-slate-800">{project.name || 'โปรเจกต์ไม่มีชื่อ'}</h4><span className="rounded-full bg-white px-2 py-0.5 text-[8px] font-black uppercase text-slate-500">{project.kind}</span></div><p className="mt-1 text-[10px] text-slate-400">แก้ไข {formatDate(project.updatedAt)} · {formatBytes(project.bytes)}</p></div>
                  <button type="button" onClick={() => handleDownloadProject(project)} className="flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-3 text-[10px] font-bold text-white hover:bg-slate-700"><Download size={14} />ดาวน์โหลด</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CollectionCard = ({ item }) => {
  const Icon = item.Icon || Database;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.color}`}><Icon size={18} /></span>
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{item.label}</p><p className="mt-1 text-[10px] text-slate-400">{item.local ? 'ทรัพยากรภายในเว็บ' : item.available ? `${item.count} เอกสาร · ${formatBytes(item.bytes)}` : 'ไม่มีสิทธิ์อ่านข้อมูล'}</p></div>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.available ? 'bg-emerald-400' : 'bg-rose-400'}`} title={item.available ? 'พร้อมใช้งาน' : 'อ่านข้อมูลไม่ได้'} />
    </div>
  );
};

export default AdminDashboard;
