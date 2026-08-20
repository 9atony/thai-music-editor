import React, { useEffect, useMemo, useState } from 'react';
import { useWorkspace, MIN_TRACK_LANE_HEIGHT, MAX_TRACK_LANE_HEIGHT, DEFAULT_TRACK_LANE_HEIGHT, COLLAPSED_TRACK_HEIGHT } from '../../../contexts/WorkspaceContext';
import { INSTRUMENT_CONFIG } from '../../../utils/instrumentConfig';
import { auth, fetchAllProjects } from '../../../utils/firebase';

const getClipInstrumentName = (clip, fallbackInstrumentId) => {
  const clipInstrumentId = clip?.sourceMeta?.currentInstrument || clip?.sourceInstrumentId || fallbackInstrumentId;
  return clip?.sourceMeta?.currentInstrumentName
    || clip?.instrumentLabel
    || INSTRUMENT_CONFIG[clipInstrumentId]?.name
    || INSTRUMENT_CONFIG[fallbackInstrumentId]?.name
    || 'ไม่ระบุเครื่องดนตรี';
};

const BLACK_SCROLLBAR_STYLE = `
  .track-panel-scroll,
  .track-sequence-scroll {
    scrollbar-width: thin;
    scrollbar-color: #000000 transparent;
  }
  .track-panel-scroll::-webkit-scrollbar,
  .track-sequence-scroll::-webkit-scrollbar {
    width: 12px;
    height: 12px;
    background: transparent;
  }
  .track-panel-scroll::-webkit-scrollbar-track,
  .track-sequence-scroll::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.4);
  }
  .track-panel-scroll::-webkit-scrollbar-thumb,
  .track-sequence-scroll::-webkit-scrollbar-thumb {
    background-color: #000000;
    border: 2px solid #11151a;
    border-radius: 6px;
  }
  .track-panel-scroll::-webkit-scrollbar-thumb:hover,
  .track-sequence-scroll::-webkit-scrollbar-thumb:hover {
    background-color: #1a1a1a;
  }
  .track-panel-scroll::-webkit-scrollbar-corner,
  .track-sequence-scroll::-webkit-scrollbar-corner {
    background: #000000;
  }
  aside.toolbar-area input[type="range"] { accent-color: #000000; }
`;

export default function TrackPanel() {
  const {
    tracks,
    toggleMute,
    toggleSolo,
    toggleTrackCollapse,
    toggleTrackLock,
    addTrack,
    renameTrack,
    duplicateTrack,
    removeTrack,
    reorderTracks,
    reorderTrackClips,
    importTmeToTrack,
    importProjectFromWeb,
    setTrackInstrument,
    setTrackVolume,
    removeClipById,
    trackLaneHeight,
    setTrackCustomHeight,
  } = useWorkspace();

  const [trackMenu, setTrackMenu] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggableTrackId, setDraggableTrackId] = useState(null);
  const [expandedSeqTracks, setExpandedSeqTracks] = useState([]);
  const [draggedClip, setDraggedClip] = useState({ id: null, trackId: null });
  const [dragOverClipId, setDragOverClipId] = useState(null);
  const [webImportOpen, setWebImportOpen] = useState(false);
  const [webProjects, setWebProjects] = useState([]);
  const [webImportLoading, setWebImportLoading] = useState(false);
  const [webImportError, setWebImportError] = useState('');

  // ⭐ ใช้ค่าเดียวกับ Timeline/Context — เลิกสูตร Math.max(50, ...) แบบ ad-hoc
  const expandedTrackHeight = useMemo(
    () => Math.max(MIN_TRACK_LANE_HEIGHT, Math.min(MAX_TRACK_LANE_HEIGHT, Number(trackLaneHeight) || DEFAULT_TRACK_LANE_HEIGHT)),
    [trackLaneHeight],
  );

  const [panelWidth, setPanelWidth] = useState(320);

  const handlePanelWidthDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX; const startW = panelWidth;
    const onMouseMove = (moveEvent) => {
      requestAnimationFrame(() => {
        setPanelWidth(Math.max(240, Math.min(600, startW + (moveEvent.clientX - startX))));
      });
    };
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
  };

  const handleTrackHeightDrag = (e, trackId, startHeight) => {
    e.preventDefault(); e.stopPropagation();
    const startY = e.clientY;
    const onMouseMove = (moveEvent) => {
      requestAnimationFrame(() => {
        if (setTrackCustomHeight) {
          // ⭐ clamp ด้วย min/max ตัวเดียวกันกับ Toolbar/Context (ไม่มี magic number ลอย)
          const next = startHeight + (moveEvent.clientY - startY);
          setTrackCustomHeight(trackId, next);
        }
      });
    };
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
  };

  // ⭐ เพิ่มฟังก์ชันดักจับการเลื่อน แล้วส่งไปบังคับให้ Timeline เลื่อนตาม
  const handleScroll = (e) => {
    const timelineScroll = document.getElementById('timeline-scroll');
    if (timelineScroll && timelineScroll.scrollTop !== e.target.scrollTop) {
      timelineScroll.scrollTop = e.target.scrollTop;
    }
  };

  const toggleSequence = (trackId) => {
    setExpandedSeqTracks(prev => prev.includes(trackId) ? prev.filter(id => id !== trackId) : [...prev, trackId]);
  };

  const handleTrackDrop = (track, index, event) => {
    event.preventDefault();
    setDragOverIndex(null);
    setDraggableTrackId(null);
    if (track.isLocked) return;
    try {
      const dataStr = event.dataTransfer.getData('application/json');
      if (dataStr) {
        const data = JSON.parse(dataStr);
        if (data.type === 'track') {
          if (data.index !== index) reorderTracks(data.index, index);
          setDraggedIndex(null);
          return;
        }
      }
    } catch (err) {}
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      if (!/\.(tme|json|thai)$/i.test(file.name)) {
        alert('รองรับไฟล์ .tme, .thai และ .json');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => importTmeToTrack(track.id, e.target?.result, file.name);
      reader.readAsText(file);
    }
    setDraggedIndex(null);
  };

  const handleTrackContextMenu = (trackId, e) => {
    e.preventDefault();
    setTrackMenu({ trackId, x: e.clientX, y: e.clientY });
  };

  // ⭐ เพิ่มตัวแปรสำหรับจดจำว่าก๊อปปี้ Track ไหนเอาไว้
  const [copiedTrackId, setCopiedTrackId] = useState(null);

  const closeTrackMenu = () => setTrackMenu(null);
  const handleCopyTrack = () => { if (trackMenu) setCopiedTrackId(trackMenu.trackId); closeTrackMenu(); };
  const handlePasteTrack = () => { if (copiedTrackId) duplicateTrack(copiedTrackId); closeTrackMenu(); };
  const handleDeleteTrack = () => { if (trackMenu) removeTrack(trackMenu.trackId); closeTrackMenu(); };

  const loadWebProjects = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setWebImportError('กรุณาเข้าสู่ระบบก่อนใช้งาน Import จากเว็บ');
      return;
    }

    setWebImportLoading(true);
    setWebImportError('');
    try {
      const projects = await fetchAllProjects(uid);
      setWebProjects(Array.isArray(projects) ? projects : []);
    } catch (error) {
      console.error('โหลดโปรเจกต์จากเว็บไม่สำเร็จ:', error);
      setWebImportError('โหลดรายการโปรเจกต์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setWebImportLoading(false);
    }
  };

  const openWebImportModal = async () => {
    setWebImportOpen(true);
    if (webProjects.length === 0) {
      await loadWebProjects();
    }
  };

  const handleImportFromWeb = (project) => {
    importProjectFromWeb(project, `${project?.name || 'โปรเจกต์จากเว็บ'}.json`);
    setWebImportOpen(false);
  };

  return (
    <aside
      className="shrink-0 bg-[#11151a] border-r border-white/10 flex flex-col select-none relative z-20"
      style={{ width: `${panelWidth}px` }}
    >
      <style>{BLACK_SCROLLBAR_STYLE}</style>

      <div
        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize z-[60] hover:bg-sky-500/20 transition-colors flex items-center justify-end"
        onMouseDown={handlePanelWidthDrag}
        title="ลากเพื่อปรับความกว้างของแผงเครื่องมือ"
      />
      {/* ⭐ เปลี่ยนความสูงให้เป็น 54px เท่ากับฝั่ง Timeline */}
      <div className="h-[54px] shrink-0 border-b border-white/10 flex items-center justify-between px-4 text-center">
        <div className="flex flex-col items-start">
          <div className="text-[12px] font-semibold tracking-[0.08em] text-white/88">Track Panel</div>
          <div className="text-[9px] text-white/45 mt-0.5">ส่วนควบคุมแทร็ก</div>
        </div>
        
        {/* ⭐ ดึงปุ่ม + เพิ่ม Track กลับมาไว้ด้านบนเพื่อประหยัดพื้นที่ */}
        <button onClick={addTrack} className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-lg hover:bg-blue-500/30 hover:text-white transition-colors" title="เพิ่มแทร็กใหม่">
          +
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <div id="track-panel-scroll" className="track-panel-scroll h-full overflow-y-auto" onScroll={handleScroll}>
          {tracks.map((track, index) => {
            // ⭐ ใช้ customHeight ที่ถูก clamp แล้วเสมอ (ไม่มีค่าเพี้ยน)
            const currentTrackHeight = Math.max(MIN_TRACK_LANE_HEIGHT, Math.min(MAX_TRACK_LANE_HEIGHT, track.customHeight || expandedTrackHeight));
            // ⭐ collapsed = track header เล็กพิเศษ (44px) แยกจาก MIN_TRACK_LANE_HEIGHT (54px)
            const rowHeight = track.isCollapsed ? COLLAPSED_TRACK_HEIGHT : currentTrackHeight;
            const trackVolume = track.volume == null ? 100 : track.volume;
            const isLocked = track.isLocked;
            const sortedClips = [...track.clips].sort((a,b)=>a.start-b.start);

            return (
              <div
                key={track.id}
                draggable={draggableTrackId === track.id && !isLocked}
                onDragStart={(e) => {
                  if (draggedClip.id || isLocked) { e.preventDefault(); return; }
                  setDraggedIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('application/json', JSON.stringify({ type: 'track', index }));
                }}
                onDragOver={(e) => {
                  if (draggedClip.id) return;
                  e.preventDefault();
                  if (draggedIndex !== null && dragOverIndex !== index) setDragOverIndex(index);
                }}
                onDragLeave={() => { if (!draggedClip.id) setDragOverIndex(null); }}
                onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); setDraggableTrackId(null); }}
                onDrop={(e) => {
                  if (draggedClip.id) return;
                  handleTrackDrop(track, index, e);
                }}
                onContextMenu={(e) => handleTrackContextMenu(track.id, e)}
                // ⭐ ลด padding บน/ล่างเป็น 0 (ใช้ flex gap แทน) เพื่อให้ความสูงตรงเป๊ะกับ slider
                className={`relative border-b border-white/[0.06] transition-colors overflow-hidden box-border ${
                  track.isMuted ? 'bg-black/40 opacity-60' : 'hover:bg-white/[0.02]'} ${draggedIndex === index ? 'opacity-40 grayscale bg-white/5' : ''} ${dragOverIndex === index ? 'border-t-2 border-t-sky-400 bg-sky-500/10' : ''}`}
                style={{
                  height: `${rowHeight}px`,
                  minHeight: `${rowHeight}px`,
                  boxSizing: 'border-box',
                  paddingTop: 0,
                  paddingBottom: 0,
                  paddingLeft: 0,
                  paddingRight: 8,
                }}
              >
                {/* ⭐ แถบยืดหดระหว่างแทร็ก — สูงแค่ h-1 (4px) ลดลงเท่าตัวเดิม — และใช้ bg-black/70 เป็นสีดำเข้าธีม */}
                <div
                  className="absolute -bottom-px left-0 right-0 h-[3px] cursor-row-resize z-[60] hover:bg-cyan-500/40 transition-colors group"
                  onMouseDown={(e) => handleTrackHeightDrag(e, track.id, currentTrackHeight)}
                  title={`ลากเพื่อยืดหด (${MIN_TRACK_LANE_HEIGHT}-${MAX_TRACK_LANE_HEIGHT}px)`}
                >
                  <div className="h-full w-full bg-black/70 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="flex h-full items-stretch gap-1.5">
                  <div
                    className={`w-4 flex flex-col justify-center items-center opacity-30 transition-opacity shrink-0 ${isLocked ? 'cursor-not-allowed text-rose-500' : 'cursor-grab hover:opacity-100 active:cursor-grabbing'}`}
                    onMouseDown={() => !isLocked && setDraggableTrackId(track.id)}
                    onMouseUp={() => setDraggableTrackId(null)}
                    onMouseLeave={() => setDraggableTrackId(null)}
                    title={isLocked ? 'ปลดล็อคก่อนเพื่อเลื่อน' : 'คลิกค้างเพื่อเลื่อนลำดับ Track'}
                  >
                    {isLocked ? (
                      <span className="text-[10px]">🔒</span>
                    ) : (
                      <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none">
                        <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                        <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                      </svg>
                    )}
                  </div>

                  <div className={`w-0.5 rounded-full self-stretch my-0.5 ${track.isMuted || isLocked ? 'grayscale opacity-50' : ''}`} style={{ backgroundColor: track.color }} />

                  <div className={`flex-1 min-w-0 flex flex-col h-full transition-opacity ${isLocked ? 'opacity-60 pointer-events-none' : ''}`}>

                    <div className="flex justify-between items-start w-full pt-1.5">
                      <div className="flex flex-col min-w-0 flex-1 mr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/30 font-mono shrink-0">{String(track.id).padStart(2, '0')}</span>
                          <input
                            type="text"
                            value={track.name}
                            onChange={(e) => renameTrack(track.id, e.target.value)}
                            disabled={isLocked}
                            className={`bg-transparent border-none outline-none text-sm font-medium truncate w-full ${track.isMuted ? 'text-white/40 line-through' : 'text-white/90'}`}
                            title="คลิกเพื่อเปลี่ยนชื่อ"
                          />
                        </div>
                        {!track.isCollapsed && (
                          <div className="text-[9px] text-white/40 mt-0.5 truncate pl-5">{track.type}</div>
                        )}
                      </div>

                      <div className="flex gap-1 shrink-0 pointer-events-auto">
                        <button onClick={() => toggleTrackCollapse(track.id)} className={`w-6 h-6 rounded-md text-[11px] font-bold transition-all ${track.isCollapsed ? 'bg-white/10 text-white/70' : 'text-white/40 hover:bg-white/10 hover:text-white'}`} title={track.isCollapsed ? 'ขยายแทร็ก' : 'ย่อแทร็ก'}>{track.isCollapsed ? '▸' : '▾'}</button>
                        <button onClick={() => toggleMute(track.id)} className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all ${track.isMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-white/30 hover:bg-white/10 hover:text-white'}`} title="ปิดเสียง">M</button>
                        <button onClick={() => toggleSolo(track.id)} className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all ${track.isSolo ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]' : 'text-white/30 hover:bg-white/10 hover:text-white'}`} title="เล่นเดี่ยว">S</button>

                        {!isLocked && (
                          <label
                            title="นำเข้าจากเครื่อง (Local)"
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer w-6 h-6 flex items-center justify-center rounded-md text-white/30 hover:text-sky-400 hover:bg-white/5 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            <input type="file" accept=".tme,.json,.thai" className="hidden" onChange={(e) => { e.stopPropagation(); const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => importTmeToTrack(track.id, evt.target?.result, file.name); reader.readAsText(file); e.target.value = null; }} />
                          </label>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); toggleTrackLock(track.id); }}
                          title={isLocked ? 'ปลดล็อคแทร็กนี้' : 'ล็อคแทร็กนี้ (ป้องกันการแก้ไข)'}
                          className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${isLocked ? 'text-rose-400 bg-rose-500/10 hover:bg-rose-500/20' : 'text-white/30 hover:text-white hover:bg-white/5'}`}
                        >
                          {isLocked ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* ⭐ ถ้า collapsed ให้แสดงแค่ชื่อ + ปุ่ม เลิกแสดงอย่างอื่น */}
                    {!track.isCollapsed && (
                      <div className="flex flex-col flex-1 pl-3 min-h-0 pt-1.5 pb-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={track.instrumentId || 'ranat-ek'}
                            onChange={(e) => setTrackInstrument(track.id, e.target.value)}
                            disabled={isLocked}
                            className="flex-1 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 transition-colors rounded px-2 py-1 text-[11px] text-white/80 outline-none min-w-0 cursor-pointer"
                          >
                            {Object.values(INSTRUMENT_CONFIG).map((instrument) => (
                              <option key={instrument.id} value={instrument.id} className="text-black">
                                {instrument.name}
                              </option>
                            ))}
                          </select>

                          <div className="w-[90px] shrink-0 rounded border border-black/50 bg-[#090c0f] px-2 py-1 flex flex-col justify-center">
                            <div className="flex items-center justify-between text-[9px] text-white/40 mb-0.5 leading-none">
                              <span className="uppercase tracking-wider">Vol</span>
                              <span className="font-mono text-emerald-400">{trackVolume}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="200"
                              value={trackVolume}
                              onChange={(e) => setTrackVolume(track.id, Number(e.target.value))}
                              disabled={isLocked}
                              className="w-full h-0.5 accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                              title="ระดับเสียงของแทร็ก"
                            />
                          </div>
                        </div>

                        <div className="mt-1.5 flex flex-col flex-1 min-h-0">
                          <button
                            onClick={() => toggleSequence(track.id)}
                            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-white/40 hover:text-white/80 transition-colors w-fit pb-0.5 pointer-events-auto"
                          >
                            <span className="w-2.5 text-center text-[10px]">{expandedSeqTracks.includes(track.id) ? '▾' : '▸'}</span>
                            ลำดับ ({sortedClips.length})
                          </button>

                          {expandedSeqTracks.includes(track.id) && (
                            <div className="bg-black/20 rounded p-1.5 border border-white/5 flex-1 flex flex-col min-h-0 pointer-events-auto">
                              <div
                                className="track-sequence-scroll flex flex-wrap content-start gap-1 overflow-y-auto pr-0.5 flex-1"
                                onDragOver={(e) => e.stopPropagation()}
                                onDrop={(e) => e.stopPropagation()}
                              >
                                {sortedClips.length === 0 && (
                                  <span className="text-[9px] text-white/30 italic w-full text-center py-1">ยังไม่มีแทรกเสียง</span>
                                )}
                                {sortedClips.map((clip, idx) => {
                                  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                                  const letter = alphabet[idx % alphabet.length];
                                  const isDraggingMe = draggedClip.id === clip.id;
                                  const isDragOverMe = dragOverClipId === clip.id;
                                  return (
                                    <div
                                      key={clip.id}
                                      draggable={!isLocked}
                                      onDragStart={(e) => {
                                        if (isLocked) return;
                                        e.stopPropagation();
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'clip', trackId: track.id, index: idx }));
                                        setTimeout(() => setDraggedClip({ id: clip.id, trackId: track.id }), 0);
                                      }}
                                      onDragOver={(e) => {
                                        if (isLocked) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (draggedClip.id && draggedClip.trackId === track.id && dragOverClipId !== clip.id) {
                                          setDragOverClipId(clip.id);
                                        }
                                      }}
                                      onDragLeave={(e) => { if (!isLocked) { e.stopPropagation(); setDragOverClipId(null); } }}
                                      onDragEnd={(e) => { if (!isLocked) { e.stopPropagation(); setDraggedClip({ id: null, trackId: null }); setDragOverClipId(null); } }}
                                      onDrop={(e) => {
                                        if (isLocked) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDragOverClipId(null);
                                        setDraggedClip({ id: null, trackId: null });
                                        try {
                                          const data = JSON.parse(e.dataTransfer.getData('application/json'));
                                          if (data.type === 'clip' && data.trackId === track.id && data.index !== idx) {
                                            reorderTrackClips(track.id, data.index, idx);
                                          }
                                        } catch(err) {}
                                      }}
                                      className={`group shrink-0 flex items-center gap-1 px-1.5 py-0.5 bg-white/10 border border-white/5 rounded transition-all duration-200 ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-grab'} ${isDraggingMe ? 'opacity-30 scale-95' : 'hover:bg-white/20 hover:border-white/20'} ${isDragOverMe && !isDraggingMe ? 'border-sky-400 bg-sky-500/20 scale-105 shadow-md shadow-sky-500/10' : ''}`}
                                      title={isLocked ? 'แทร็กล็อคอยู่' : `${clip.name} • ลากเพื่อสลับลำดับ`}
                                    >
                                      <span className="text-[9px] font-black text-sky-400 opacity-80">{letter}</span>
                                      <span className="text-[10px] text-white/90 truncate max-w-[60px] font-medium pointer-events-none">{clip.name}</span>
                                      {!isLocked && (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); removeClipById(track.id, clip.id); }}
                                          className="w-3.5 h-3.5 rounded-full bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors text-[10px] opacity-0 hover:opacity-100 group-hover:opacity-100"
                                          title="ลบแทรกนี้"
                                        >×</button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ⭐ ปรับใหม่ให้มี 2 ปุ่มอยู่คู่กัน (Cloud และ Local) */}
      <div className="shrink-0 border-t border-white/10 p-3 bg-[#11151a] flex gap-2">
        <button
          onClick={openWebImportModal}
          className="flex-1 h-[42px] rounded-xl border border-sky-500/30 bg-sky-500/10 text-[11px] font-medium text-sky-400 hover:bg-sky-500/20 hover:text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          title="นำเข้าจากโปรเจกต์ที่บันทึกไว้บนเว็บ"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          จากเว็บ (Cloud)
        </button>
        
        <label
          title="นำเข้าจากไฟล์ .tme ในเครื่องคอมพิวเตอร์"
          className="cursor-pointer flex-1 h-[42px] rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20 hover:text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          จากเครื่อง (Local)
          {/* สร้าง Track ใหม่เสมอเมื่อนำเข้าจากเครื่องตรงนี้ */}
          <input 
            type="file" 
            accept=".tme,.json,.thai" 
            className="hidden" 
            onChange={(e) => { 
              const file = e.target.files?.[0]; 
              if (!file) return; 
              // หา ID ของแทร็กใหม่ (บวก 1 จากค่ามากสุด)
              const nextId = tracks.length > 0 ? Math.max(...tracks.map(t => t.id)) + 1 : 1;
              // 1. เพิ่มแทร็กใหม่ก่อน
              addTrack();
              // 2. นำเข้าไฟล์ไปใส่ในแทร็กที่เพิ่งสร้าง
              const reader = new FileReader(); 
              reader.onload = (evt) => importTmeToTrack(nextId, evt.target?.result, file.name); 
              reader.readAsText(file); 
              e.target.value = null; 
            }} 
          />
        </label>
      </div>

      {webImportOpen && (
        <>
          <div className="fixed inset-0 z-[98] bg-black/40" onClick={() => setWebImportOpen(false)} />
          <div className="fixed z-[101] left-1/2 top-1/2 w-[min(560px,calc(100vw-32px))] max-h-[75vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#161b22] shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                  นำเข้าจากเว็บ (Cloud)
                </div>
                <div className="text-[11px] text-white/45 mt-0.5">ดาวน์โหลดโปรเจกต์ออนไลน์มาเป็นแทร็กใหม่</div>
              </div>
              <button
                onClick={() => setWebImportOpen(false)}
                className="w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                title="ปิด"
              >×</button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">รายการโปรเจกต์บนเว็บ</div>
                <button
                  onClick={loadWebProjects}
                  className="h-8 px-3 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  รีเฟรช
                </button>
              </div>

              {webImportLoading ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/55">กำลังโหลดโปรเจกต์จากเว็บ...</div>
              ) : webImportError ? (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">{webImportError}</div>
              ) : webProjects.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/50">ยังไม่พบโปรเจกต์บนเว็บ</div>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                  {webProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleImportFromWeb(project)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:bg-white/[0.06] hover:border-sky-400/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white/90">{project.name || 'โปรเจกต์ไม่มีชื่อ'}</div>
                          <div className="mt-1 truncate text-[11px] text-white/45">{project.songName || 'พร้อมนำเข้าเป็นแท็กใหม่'}</div>
                        </div>
                        <div className="shrink-0 text-xs text-sky-300">นำเข้า</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}


      {/* ⭐ เมนูคลิกขวาดีไซน์ใหม่สไตล์มินิมอล */}
      {trackMenu && (
        <>
          <div className="fixed inset-0 z-[99]" onClick={closeTrackMenu} onContextMenu={(e) => { e.preventDefault(); closeTrackMenu(); }} />
          <div 
            className="fixed z-[100] min-w-[170px] rounded-xl border border-white/10 bg-[#1a1f26]/95 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-1.5 flex flex-col gap-0.5"
            style={{ left: trackMenu.x, top: trackMenu.y }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button 
              onClick={handleCopyTrack} 
              className="w-full text-left px-2.5 py-2 rounded-lg text-[11px] font-medium text-white/75 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2.5"
            >
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy Track
            </button>
            
            <button 
              onClick={handlePasteTrack} 
              disabled={!copiedTrackId}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-2.5 ${copiedTrackId ? 'text-white/75 hover:text-white hover:bg-white/10' : 'text-white/30 cursor-not-allowed'}`}
            >
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              Paste Track
            </button>

            <div className="h-px bg-white/10 my-0.5 mx-1" />

            <button 
              onClick={handleDeleteTrack} 
              className="w-full text-left px-2.5 py-2 rounded-lg text-[11px] font-medium text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/15 transition-colors flex items-center gap-2.5"
            >
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Delete Track
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
