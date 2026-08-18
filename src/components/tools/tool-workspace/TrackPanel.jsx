import React, { useMemo, useState } from 'react';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { INSTRUMENT_CONFIG } from '../../../utils/instrumentConfig';

const getClipInstrumentName = (clip, fallbackInstrumentId) => {
  const clipInstrumentId = clip?.sourceMeta?.currentInstrument || clip?.sourceInstrumentId || fallbackInstrumentId;
  return clip?.sourceMeta?.currentInstrumentName
    || clip?.instrumentLabel
    || INSTRUMENT_CONFIG[clipInstrumentId]?.name
    || INSTRUMENT_CONFIG[fallbackInstrumentId]?.name
    || 'ไม่ระบุเครื่องดนตรี';
};

export default function TrackPanel() {
  const {
    tracks,
    toggleMute,
    toggleSolo,
    toggleTrackCollapse,
    addTrack,
    renameTrack,
    duplicateTrack,
    removeTrack,
    reorderTracks,
    importTmeToTrack,
    setTrackInstrument,
    setTrackVolume,
    removeClipById,
    pasteClipAt,
    hasClipboard,
    trackLaneHeight,
  } = useWorkspace();

  const [trackMenu, setTrackMenu] = useState(null);
  
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const expandedTrackHeight = useMemo(() => Math.max(108, Number(trackLaneHeight) || 132), [trackLaneHeight]);

  const handleTrackDrop = (trackId, index, event) => {
    event.preventDefault();
    setDragOverIndex(null);

    try {
      const dataStr = event.dataTransfer.getData('application/json');
      if (dataStr) {
        const data = JSON.parse(dataStr);
        if (data.type === 'track') {
          if (data.index !== index) {
            reorderTracks(data.index, index);
          }
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
      reader.onload = (e) => importTmeToTrack(trackId, e.target?.result, file.name);
      reader.readAsText(file);
    }
    
    setDraggedIndex(null);
  };

  const handleTrackContextMenu = (trackId, e) => {
    e.preventDefault();
    setTrackMenu({ trackId, x: e.clientX, y: e.clientY });
  };

  const closeTrackMenu = () => setTrackMenu(null);
  const handleDuplicate = () => { if (trackMenu) duplicateTrack(trackMenu.trackId); closeTrackMenu(); };
  const handleRemoveTrack = () => { if (trackMenu) removeTrack(trackMenu.trackId); closeTrackMenu(); };

  return (
    <aside className="w-[320px] shrink-0 bg-[#11151a] border-r border-white/10 flex flex-col">
      <div className="h-[54px] shrink-0 border-b border-white/10 flex items-center px-4 justify-between gap-2">
        <button onClick={addTrack} className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
          <span className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-lg">+</span>
          เพิ่ม Track
        </button>
        <span className="text-[10px] text-white/35">ลากไฟล์ / สลับ Track ได้</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tracks.map((track, index) => { 
          const rowHeight = track.isCollapsed ? 44 : expandedTrackHeight;
          const trackVolume = track.volume == null ? 100 : track.volume;

          return (
            <div
              key={track.id}
              draggable={true} 
              onDragStart={(e) => {
                if (['INPUT', 'BUTTON', 'SELECT'].includes(e.target.tagName)) {
                  e.preventDefault();
                  return;
                }
                setDraggedIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('application/json', JSON.stringify({ type: 'track', index }));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && dragOverIndex !== index) {
                  setDragOverIndex(index);
                }
              }}
              onDragLeave={() => setDragOverIndex(null)}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onDrop={(e) => handleTrackDrop(track.id, index, e)}
              onContextMenu={(e) => handleTrackContextMenu(track.id, e)}
              // ⭐ ปรับ padding (py) ให้บางลงเมื่อกดย่อ Track เพื่อไม่ให้ข้อความโดนเบียดทับ
              className={`border-b border-white/[0.06] px-4 box-border transition-colors overflow-hidden ${
                track.isCollapsed ? 'py-1.5' : 'py-3' 
              } ${
                track.isMuted ? 'bg-black/40 opacity-60' : 'hover:bg-white/[0.02]'
              } ${
                draggedIndex === index ? 'opacity-40 grayscale' : '' 
              } ${
                dragOverIndex === index ? 'border-t-2 border-t-sky-400 bg-sky-500/10' : ''
              }`}
              style={{ height: `${rowHeight}px`, cursor: draggedIndex !== null ? 'grabbing' : 'grab' }}
            >
              <div className="flex h-full items-start gap-3">
                <div className={`w-1 rounded-full self-stretch ${track.isMuted ? 'grayscale' : ''}`} style={{ backgroundColor: track.color }} />

                <div className="flex-1 min-w-0 flex flex-col pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 font-mono">{String(track.id).padStart(2, '0')}</span>
                    <input
                      type="text"
                      value={track.name}
                      onChange={(e) => renameTrack(track.id, e.target.value)}
                      className={`bg-transparent border-none outline-none text-sm font-medium truncate w-full ${track.isMuted ? 'text-white/40 line-through' : 'text-white/90'}`}
                      title="คลิกเพื่อเปลี่ยนชื่อ"
                    />
                  </div>

                  <div className="text-[9px] text-white/40 mt-0.5 truncate">
                    {track.type} • {track.clips.length} คลิป
                  </div>

                  {!track.isCollapsed && (
                    <>
                      <div className="mt-3 flex items-center gap-2.5">
                        
                        {/* ⭐ ดีไซน์ช่องเลือกเครื่องดนตรีใหม่ ให้รับกับ Volume */}
                        <select
                          value={track.instrumentId || 'ranat-ek'}
                          onChange={(e) => setTrackInstrument(track.id, e.target.value)}
                          className="flex-1 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 transition-colors rounded-lg px-2.5 py-1.5 text-[11px] text-white/80 outline-none min-w-0 cursor-pointer shadow-sm"
                        >
                          {Object.values(INSTRUMENT_CONFIG).map((instrument) => (
                            <option key={instrument.id} value={instrument.id} className="text-black">
                              {instrument.name}
                            </option>
                          ))}
                        </select>

                        {/* ⭐ ดีไซน์กล่อง Volume แบบโปร (เจาะลึก Inner Shadow) */}
                        <div className="w-[110px] shrink-0 rounded-lg border border-black/50 bg-[#090c0f] shadow-inner px-2.5 py-1.5 flex flex-col justify-center transition-all hover:bg-[#0b0e12]">
                          <div className="flex items-center justify-between text-[9px] text-white/40 mb-1.5 leading-none">
                            <span className="uppercase tracking-wider font-medium">Vol</span>
                            <span className="font-mono text-emerald-400">{trackVolume}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="200"
                            value={trackVolume}
                            onChange={(e) => setTrackVolume(track.id, Number(e.target.value))}
                            className="w-full h-1 accent-emerald-500 cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                            title="ระดับเสียงของแทร็ก"
                          />
                        </div>
                      </div>

                      <div className="mt-2.5 flex flex-wrap gap-1.5 overflow-hidden max-h-[24px]">
                        {track.clips.length === 0 && (
                          <span className="text-[9px] bg-white/5 text-white/40 border border-dashed border-white/10 rounded-full px-2 py-0.5">
                            ยังไม่มีแท็กเสียง
                          </span>
                        )}

                        {track.clips.map((clip) => (
                          <div
                            key={clip.id}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-white/75 max-w-full"
                            title={`${clip.name} • ${getClipInstrumentName(clip, track.instrumentId)}`}
                          >
                            <span className="truncate max-w-[80px]">{clip.name}</span>
                            <span className="px-1 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/20 shrink-0 text-[8px]">
                              {getClipInstrumentName(clip, track.instrumentId)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeClipById(track.id, clip.id)}
                              className="w-3.5 h-3.5 rounded-full bg-white/10 text-white/55 hover:bg-rose-500/20 hover:text-rose-300 shrink-0 transition-colors flex items-center justify-center"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-1.5 ml-2 shrink-0 pt-0.5">
                  <button onClick={() => toggleTrackCollapse(track.id)} className={`w-7 h-7 rounded-md text-[12px] font-bold transition-all ${track.isCollapsed ? 'bg-white/10 text-white/70' : 'text-white/30 hover:bg-white/10 hover:text-white'}`} title={track.isCollapsed ? 'ขยายแทร็ก' : 'ย่อแทร็ก'}>{track.isCollapsed ? '▸' : '▾'}</button>
                  <button onClick={() => toggleMute(track.id)} className={`w-7 h-7 rounded-md text-[10px] font-bold transition-all ${track.isMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-white/30 hover:bg-white/10 hover:text-white'}`} title="ปิดเสียง">M</button>
                  <button onClick={() => toggleSolo(track.id)} className={`w-7 h-7 rounded-md text-[10px] font-bold transition-all ${track.isSolo ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]' : 'text-white/30 hover:bg-white/10 hover:text-white'}`} title="เล่นเดี่ยว">S</button>

                  <label
                    title="นำเข้าไฟล์โน้ต"
                    className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-md text-[12px] text-white/30 hover:bg-sky-500/20 hover:text-sky-400 border border-transparent hover:border-sky-500/30 transition-all"
                  >
                    📥
                    <input
                      type="file"
                      accept=".tme,.json,.thai"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (evt) => importTmeToTrack(track.id, evt.target?.result, file.name);
                        reader.readAsText(file);
                        e.target.value = null;
                      }}
                    />
                  </label>

                  <button
                    onClick={() => {
                      const endPos = track.clips.reduce((max, clip) => Math.max(max, (clip.start || 0) + (clip.width || 0)), 0);
                      pasteClipAt(track.id, endPos);
                    }}
                    disabled={!hasClipboard}
                    title={hasClipboard ? 'วางแทรกต่อท้าย Track' : 'ยังไม่มีแทรกที่ Copy ไว้'}
                    className={`w-7 h-7 flex items-center justify-center rounded-md text-[12px] border transition-all ${hasClipboard ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20' : 'text-white/20 border-transparent cursor-not-allowed'}`}
                  >
                    📌
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={addTrack} className="h-14 shrink-0 border-t border-white/10 text-xs text-white/40 hover:text-white hover:bg-white/[0.02] transition-colors">
        + เพิ่ม Track ใหม่
      </button>

      {trackMenu && (
        <>
          <div
            className="fixed inset-0 z-[99]"
            onClick={closeTrackMenu}
            onContextMenu={(e) => { e.preventDefault(); closeTrackMenu(); }}
          />
          <div
            className="fixed z-[100] min-w-[168px] rounded-xl border border-white/10 bg-[#161b22] shadow-2xl py-1.5 text-sm"
            style={{ left: trackMenu.x, top: trackMenu.y }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              onClick={handleDuplicate}
              className="w-full text-left px-3 py-2 text-sky-300 hover:bg-sky-500/10 flex items-center gap-2"
            >
              <span className="text-base leading-none">📋</span> Copy Track
            </button>
            <button
              onClick={handleRemoveTrack}
              className="w-full text-left px-3 py-2 text-rose-300 hover:bg-rose-500/10 flex items-center gap-2"
            >
              <span className="text-base leading-none">🗑</span> ลบ Track
            </button>
          </div>
        </>
      )}
    </aside>
  );
}