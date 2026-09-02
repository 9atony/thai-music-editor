import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Folder,
  Grid2X2,
  List,
  MoreHorizontal,
  Music2,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  auth,
  createArrangerProject,
  deleteArrangerProject,
  fetchArrangerProjects,
} from '../../utils/firebase';
import { ARRANGER_PROJECT_SESSION_KEY } from '../../contexts/WorkspaceContext';
import ProjectStatusBar from '../projects/ProjectStatusBar';

const PROJECT_COLORS = [
  'from-rose-500 to-orange-400',
  'from-cyan-500 to-blue-500',
  'from-emerald-500 to-green-400',
  'from-violet-600 to-fuchsia-500',
  'from-amber-500 to-orange-500',
  'from-indigo-500 to-blue-400',
];

const timestampToMillis = (timestamp) => {
  if (typeof timestamp?.toMillis === 'function') return timestamp.toMillis();
  if (timestamp?.seconds) return timestamp.seconds * 1000;
  const parsed = Date.parse(timestamp || '');
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatUpdatedAt = (timestamp) => {
  const millis = timestampToMillis(timestamp);
  if (!millis) return 'ยังไม่ได้บันทึก';
  return new Date(millis).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTrackCount = (project) => project.trackCount ?? project.tracks?.length ?? 0;

const getProjectDuration = (project) => {
  const longestMeasure = (project.tracks || []).reduce((trackMax, track) => (
    Math.max(trackMax, ...(track.clips || []).map((clip) => Number(clip.start || 0) + Number(clip.width || 0)))
  ), 0);
  if (!longestMeasure) return '00:00';
  const seconds = Math.round(longestMeasure * (60 / Math.max(20, Number(project.bpm) || 120)));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

const getProjectInitial = (name) => {
  const value = String(name || '').trim();
  if (!value) return 'M';
  return /^[A-Za-z]/.test(value) ? value[0].toUpperCase() : 'M';
};

export default function ArrangerProjectManager({ onOpen, userRole = 'user' }) {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [viewMode, setViewMode] = useState('grid');
  const [openMenuId, setOpenMenuId] = useState(null);

  const loadProjects = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setProjects(await fetchArrangerProjects(uid));
    } catch (error) {
      console.error('โหลดรายการโปรเจกต์จัดวงไม่สำเร็จ:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('th-TH');
    const filtered = projects.filter((project) => (
      !normalizedQuery || String(project.name || '').toLocaleLowerCase('th-TH').includes(normalizedQuery)
    ));

    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'th');
      if (sortBy === 'tracks') return getTrackCount(b) - getTrackCount(a);
      return timestampToMillis(b.updatedAt) - timestampToMillis(a.updatedAt);
    });
  }, [projects, query, sortBy]);

  const totalTracks = useMemo(
    () => projects.reduce((total, project) => total + getTrackCount(project), 0),
    [projects],
  );

  const usedBytes = useMemo(
    () => projects.reduce((total, project) => total + new Blob([JSON.stringify(project)]).size, 0),
    [projects],
  );

  const latestProject = useMemo(() => (
    [...projects].sort((a, b) => timestampToMillis(b.updatedAt) - timestampToMillis(a.updatedAt))[0]
  ), [projects]);

  const openProject = (projectId) => {
    sessionStorage.setItem(ARRANGER_PROJECT_SESSION_KEY, projectId);
    onOpen?.();
  };

  const createProject = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || isCreating) return;
    setIsCreating(true);
    try {
      const project = await createArrangerProject(uid);
      openProject(project.id);
    } catch (error) {
      console.error('สร้างโปรเจกต์จัดวงไม่สำเร็จ:', error);
      alert('ไม่สามารถสร้างโปรเจกต์จัดวงได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsCreating(false);
    }
  };

  const removeProject = async (event, projectId) => {
    event.stopPropagation();
    setOpenMenuId(null);
    if (!window.confirm('ลบโปรเจกต์จัดวงนี้อย่างถาวรใช่หรือไม่?')) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await deleteArrangerProject(uid, projectId);
      setProjects((current) => current.filter((project) => project.id !== projectId));
    } catch (error) {
      console.error('ลบโปรเจกต์จัดวงไม่สำเร็จ:', error);
      alert('ไม่สามารถลบโปรเจกต์จัดวงได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f7faff] px-5 pb-28 pt-7 text-slate-800 md:px-8 lg:px-10 2xl:px-12">
      <div className="mx-auto w-full max-w-[1536px]">
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">
              <SlidersHorizontal size={14} /> Arranger projects
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">โปรเจกต์ของฉัน</h1>
            <p className="mt-2 text-sm text-slate-500">เก็บแทร็ก Timeline, Mixer และโน้ตสำหรับการจัดวง แยกจากโปรเจกต์ Editor</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex h-12 min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-slate-400 shadow-sm sm:w-72">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="ค้นหาโปรเจกต์..."
              />
            </label>
            <button
              type="button"
              onClick={createProject}
              disabled={isCreating}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
            >
              <Plus size={17} /> {isCreating ? 'กำลังสร้าง...' : 'สร้างโปรเจกต์ใหม่'}
            </button>
          </div>
        </div>

        <section className="relative mb-9 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-sky-100 px-6 py-6 shadow-sm md:px-8">
          <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-blue-300/25 blur-3xl" />
          <Folder className="pointer-events-none absolute -bottom-7 right-10 hidden text-blue-400/15 md:block" size={150} strokeWidth={1.2} />
          <div className="relative grid gap-6 sm:grid-cols-3">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600"><Folder size={23} /></span>
              <div><p className="text-xs text-slate-500">โปรเจกต์ทั้งหมด</p><strong className="text-2xl text-slate-900">{projects.length}</strong><span className="ml-2 text-xs text-slate-500">โปรเจกต์</span></div>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><Music2 size={23} /></span>
              <div><p className="text-xs text-slate-500">แทร็กทั้งหมด</p><strong className="text-2xl text-slate-900">{totalTracks}</strong><span className="ml-2 text-xs text-slate-500">แทร็ก</span></div>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600"><Clock3 size={23} /></span>
              <div><p className="text-xs text-slate-500">แก้ไขล่าสุด</p><strong className="block max-w-40 truncate text-sm text-slate-900">{latestProject?.name || 'ยังไม่มีข้อมูล'}</strong><span className="text-xs text-slate-500">{latestProject ? formatUpdatedAt(latestProject.updatedAt) : '—'}</span></div>
            </div>
          </div>
        </section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">โปรเจกต์ล่าสุด</h2>
            {query && <p className="mt-1 text-xs text-slate-500">พบ {visibleProjects.length} รายการจากคำค้นหา “{query}”</p>}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-blue-300"
            >
              <option value="latest">เรียงล่าสุด</option>
              <option value="name">เรียงตามชื่อ</option>
              <option value="tracks">จำนวนแทร็ก</option>
            </select>
            <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button type="button" onClick={() => setViewMode('grid')} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-700'}`} title="มุมมองกริด"><Grid2X2 size={15} /></button>
              <button type="button" onClick={() => setViewMode('list')} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-700'}`} title="มุมมองรายการ"><List size={16} /></button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">กำลังโหลดโปรเจกต์...</div>
        ) : visibleProjects.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Music2 size={27} /></span>
            <h2 className="mt-4 text-lg font-bold text-slate-900">{query ? 'ไม่พบโปรเจกต์ที่ค้นหา' : 'ยังไม่มีโปรเจกต์จัดวง'}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{query ? 'ลองค้นหาด้วยชื่ออื่น หรือล้างข้อความในช่องค้นหา' : 'สร้างพื้นที่ทำงานสำหรับแต่ละวง แล้วนำโน้ตจาก Editor เข้ามาจัดเรียงได้เลย'}</p>
            {!query && <button type="button" onClick={createProject} disabled={isCreating} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500">สร้างโปรเจกต์แรก</button>}
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
            {visibleProjects.map((project, index) => {
              const trackCount = getTrackCount(project);
              const isLatest = project.id === latestProject?.id;
              return (
                <article
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openProject(project.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openProject(project.id); }}
                  className={`group relative cursor-pointer border border-slate-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg ${viewMode === 'grid' ? 'rounded-2xl p-5' : 'flex items-center gap-4 rounded-xl px-4 py-3'}`}
                >
                  <span className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-black text-white shadow-sm ${PROJECT_COLORS[index % PROJECT_COLORS.length]} ${viewMode === 'grid' ? 'h-14 w-14 text-xl' : 'h-11 w-11 text-base'}`}>
                    {getProjectInitial(project.name)}
                  </span>
                  <div className={`min-w-0 flex-1 ${viewMode === 'grid' ? 'mt-4' : ''}`}>
                    <div className="flex min-w-0 items-center gap-2 pr-8">
                      <h3 className="truncate text-sm font-bold text-slate-900 md:text-base">{project.name || 'โปรเจกต์จัดวงไม่มีชื่อ'}</h3>
                      {isLatest && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-600">แก้ไขล่าสุด</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">แก้ไขล่าสุด: {formatUpdatedAt(project.updatedAt)}</p>
                    <div className={`flex items-center gap-5 border-slate-100 text-xs text-slate-500 ${viewMode === 'grid' ? 'mt-5 border-t pt-4' : 'mt-2'}`}>
                      <span className="flex items-center gap-1.5"><Music2 size={14} /> {trackCount} แทร็ก</span>
                      <span className="flex items-center gap-1.5"><Clock3 size={14} /> {getProjectDuration(project)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); setOpenMenuId((current) => current === project.id ? null : project.id); }}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="ตัวเลือกโปรเจกต์"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {openMenuId === project.id && (
                    <div className="absolute right-3 top-12 z-20 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={(event) => removeProject(event, project.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"><Trash2 size={14} /> ลบโปรเจกต์</button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
      <ProjectStatusBar
        role={userRole}
        itemCount={projects.length}
        usedBytes={usedBytes}
        itemLabel="โปรเจกต์"
      />
    </div>
  );
}
