import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { getMasterLevel, getTrackLevel } from '../../../utils/audioEngine';

const levelToDb = (value) => {
  if (value <= 0) return '-∞';
  return `${(20 * Math.log10(value / 100)).toFixed(1)}`;
};

function Meter({ level = 0, activeColor = '#22c55e' }) {
  const percent = Math.max(0, Math.min(100, level * 100));
  return (
    <div className="flex h-full min-h-[42px] max-h-[108px] w-3 gap-[2px] rounded-sm bg-black/50 p-[2px]" aria-label={`ระดับสัญญาณ ${Math.round(percent)} เปอร์เซ็นต์`}>
      {[0, 1].map((channel) => (
        <div key={channel} className="relative h-full flex-1 overflow-hidden rounded-[1px] bg-white/[0.06]">
          <div
            className="absolute inset-x-0 bottom-0 transition-[height] duration-75"
            style={{
              height: `${percent}%`,
              background: percent > 88
                ? 'linear-gradient(to top, #16a34a 0%, #eab308 72%, #ef4444 100%)'
                : `linear-gradient(to top, ${activeColor}, #eab308)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function PanControl({ value, onChange }) {
  const label = value === 0 ? 'C' : value < 0 ? `L${Math.abs(value)}` : `R${value}`;
  return (
    <div className="w-full px-2">
      <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wider text-white/35">
        <span>Pan</span><span className="font-mono text-white/65">{label}</span>
      </div>
      <input
        type="range"
        min="-100"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onDoubleClick={() => onChange(0)}
        className="h-1 w-full cursor-pointer accent-sky-400"
        aria-label="แพนซ้ายขวา"
      />
    </div>
  );
}

function ChannelStrip({ track, level, onMute, onSolo, onPan, onVolume }) {
  const volume = track.volume ?? 100;
  const pan = track.pan ?? 0;
  const isSilent = track.isMuted;

  return (
    <section className="flex h-full w-[112px] shrink-0 flex-col border-r border-white/[0.07] bg-[#11161c]">
      <div className="flex h-9 items-center gap-2 border-b border-white/[0.07] px-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: track.color }} />
        <span className="truncate text-[11px] font-semibold text-white/80" title={track.name}>{track.name}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden py-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onMute}
            className={`h-6 w-7 rounded border text-[9px] font-bold transition-colors ${track.isMuted ? 'border-amber-400/60 bg-amber-400 text-black' : 'border-white/10 bg-white/[0.04] text-white/45 hover:text-white'}`}
            title="Mute"
          >M</button>
          <button
            type="button"
            onClick={onSolo}
            className={`h-6 w-7 rounded border text-[9px] font-bold transition-colors ${track.isSolo ? 'border-sky-400/60 bg-sky-400 text-black' : 'border-white/10 bg-white/[0.04] text-white/45 hover:text-white'}`}
            title="Solo"
          >S</button>
        </div>
        <PanControl value={pan} onChange={onPan} />
        <div className="flex min-h-0 flex-1 items-center justify-center gap-3">
          <Meter level={isSilent ? 0 : level} activeColor={track.color} />
          <input
            type="range"
            min="0"
            max="200"
            value={volume}
            onChange={(event) => onVolume(Number(event.target.value))}
            onDoubleClick={() => onVolume(100)}
            className="h-full min-h-[42px] max-h-[108px] w-4 cursor-pointer accent-emerald-400"
            style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
            aria-label={`ระดับเสียง ${track.name}`}
          />
        </div>
        <div className="font-mono text-[9px] text-white/55">{levelToDb(volume)} dB</div>
      </div>
    </section>
  );
}

function MasterStrip({ volume, level, onVolume }) {
  return (
    <section className="flex h-full w-[126px] shrink-0 flex-col border-l border-sky-400/20 bg-[#151b22] shadow-[-8px_0_18px_rgba(0,0,0,0.28)]">
      <div className="flex h-9 items-center justify-between border-b border-white/[0.07] px-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300">Master</span>
        <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-hidden py-2">
        <div className="flex min-h-0 flex-1 items-center gap-4">
          <Meter level={level} activeColor="#38bdf8" />
          <input
            type="range"
            min="0"
            max="150"
            value={volume}
            onChange={(event) => onVolume(Number(event.target.value))}
            onDoubleClick={() => onVolume(100)}
            className="h-full min-h-[42px] max-h-[108px] w-4 cursor-pointer accent-sky-400"
            style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
            aria-label="ระดับเสียงมาสเตอร์"
          />
        </div>
        <div className="font-mono text-[9px] text-sky-200/70">{levelToDb(volume)} dB</div>
      </div>
    </section>
  );
}

export default function MixerPanel() {
  const {
    tracks,
    toggleMute,
    toggleSolo,
    setTrackVolume,
    setTrackPan,
    masterVolume,
    setMasterVolume,
  } = useWorkspace();
  const [isOpen, setIsOpen] = useState(true);
  const [height, setHeight] = useState(250);
  const [levels, setLevels] = useState({ tracks: {}, master: 0 });
  const animationRef = useRef(null);

  const trackIds = useMemo(() => tracks.map((track) => track.id), [tracks]);

  useEffect(() => {
    let lastUpdate = 0;
    const update = (time) => {
      if (time - lastUpdate >= 50) {
        const nextTracks = {};
        trackIds.forEach((trackId) => { nextTracks[trackId] = getTrackLevel(trackId); });
        setLevels({ tracks: nextTracks, master: getMasterLevel() });
        lastUpdate = time;
      }
      animationRef.current = requestAnimationFrame(update);
    };
    animationRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationRef.current);
  }, [trackIds]);

  const startResize = (event) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;
    const onMove = (moveEvent) => {
      const maxHeight = Math.max(220, Math.floor(window.innerHeight * 0.55));
      setHeight(Math.max(190, Math.min(maxHeight, startHeight + startY - moveEvent.clientY)));
    };
    const stop = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', stop);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', stop);
  };

  return (
    <div className="relative min-h-0 shrink-0 overflow-hidden border-t border-white/10 bg-[#0d1116]" style={{ height: isOpen ? height : 36 }}>
      {isOpen && (
        <button
          type="button"
          onMouseDown={startResize}
          className="absolute inset-x-0 top-0 z-20 h-1 cursor-row-resize bg-transparent hover:bg-sky-400/50"
          aria-label="ลากเพื่อปรับความสูงมิกเซอร์"
        />
      )}
      <div className="flex h-9 items-center justify-between border-b border-white/[0.08] bg-[#11161c] px-3">
        <div className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-sky-400" aria-hidden="true">
            <path d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3" />
            <path d="M1 14h6M9 8h6M17 16h6" />
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">Mixer</span>
          <span className="text-[9px] text-white/30">{tracks.length} channels</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="flex h-6 w-7 items-center justify-center rounded text-white/40 hover:bg-white/[0.06] hover:text-white"
          title={isOpen ? 'พับมิกเซอร์' : 'เปิดมิกเซอร์'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d={isOpen ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="flex min-h-0" style={{ height: 'calc(100% - 36px)' }}>
          <div className="mixer-scroll flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
            {tracks.map((track) => (
              <ChannelStrip
                key={track.id}
                track={track}
                level={levels.tracks[track.id] || 0}
                onMute={() => toggleMute(track.id)}
                onSolo={() => toggleSolo(track.id)}
                onPan={(value) => setTrackPan(track.id, value)}
                onVolume={(value) => setTrackVolume(track.id, value)}
              />
            ))}
          </div>
          <MasterStrip volume={masterVolume} level={levels.master} onVolume={setMasterVolume} />
        </div>
      )}
    </div>
  );
}
