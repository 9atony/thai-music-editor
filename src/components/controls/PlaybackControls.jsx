import React, { useContext } from 'react';
import { MusicContext } from '../../contexts/MusicContext';

const PlaybackControls = () => {
  const { 
    isPlaying, startPlayback, stopPlayback, 
    layoutConfig, setLayoutConfig, selectedCell, 
    symbols, selectedSymbolId, setSelectedSymbolId, updateSymbol, removeSymbol, removeSymbolByCell 
  } = useContext(MusicContext);

  const handleBpmChange = (e) => {
    let val = parseInt(e.target.value);
    setLayoutConfig({ ...layoutConfig, bpm: isNaN(val) ? "" : val });
  };

  const handleBpmBlur = () => {
    let val = parseInt(layoutConfig.bpm);
    if (isNaN(val) || val < 20) val = 20; 
    if (val > 300) val = 300; 
    setLayoutConfig({ ...layoutConfig, bpm: val });
  };

  const handleVolumeChange = (e) => {
    setLayoutConfig({ ...layoutConfig, volume: parseInt(e.target.value) });
  };

  const activeSym = symbols.find(s => s.id === selectedSymbolId);
  const isEditingMode = !!activeSym;

  const handlePropChange = (configKey, symKey, value) => {
    if (isEditingMode) {
      updateSymbol(selectedSymbolId, { [symKey]: value });
    } else {
      setLayoutConfig({ ...layoutConfig, [configKey]: value });
    }
  };

  return (
    // ⭐ ใช้ Grid แบ่ง 3 ส่วนเท่าๆ กัน เพื่อให้ปุ่ม Play อยู่ตรงกลางเป๊ะ 
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center w-full py-1">
      
      {/* ⬅️ โซนซ้าย: ควบคุมเสียงและความเร็ว (Sound & Tempo) */}
      <div className="flex items-center gap-6 justify-center lg:justify-start">
        
        {/* ปรับระดับเสียง */}
        <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <input 
            type="range" min="0" max="100" 
            value={layoutConfig.volume !== undefined ? layoutConfig.volume : 100} 
            onChange={handleVolumeChange}
            className="w-20 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
            title="ระดับเสียง"
          />
        </div>

        {/* ปรับ BPM */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">BPM</span>
          <input 
            type="number" min="20" max="300"
            value={layoutConfig.bpm !== undefined ? layoutConfig.bpm : 80}
            onChange={handleBpmChange}
            onBlur={handleBpmBlur}
            className="w-14 text-center text-sm font-bold text-slate-700 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
            title="ความเร็วของจังหวะ"
          />
        </div>
      </div>

      {/* ⏺️ โซนกลาง: ปุ่มเครื่องเล่น (Playback Center) */}
      <div className="flex items-center justify-center">
        <button 
          onClick={isPlaying ? stopPlayback : startPlayback} 
          className={`flex items-center justify-center gap-2 w-36 py-2 rounded-full font-bold shadow-sm transition-all hover:shadow-md active:scale-95 text-white ${isPlaying ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
        >
          {isPlaying ? (
            <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd"/></svg> หยุดเล่น</>
          ) : (
            <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg> เล่นดนตรี</>
          )}
        </button>
      </div>

      {/* ➡️ โซนขวา: เครื่องมือสัญลักษณ์ (Toolbox) */}
      <div className="flex items-center justify-center lg:justify-end">
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-xl border transition-all duration-300 ${isEditingMode ? 'border-amber-300 bg-amber-50 shadow-inner' : 'border-slate-200 bg-white shadow-sm'}`}>
           
           {isEditingMode && (
             <div className="flex items-center gap-1.5 px-2">
               <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
               </span>
               <span className="text-xs font-extrabold text-amber-600 tracking-wide">กำลังแก้ไขเส้น</span>
             </div>
           )}

           {!isEditingMode && (
             <select 
               value={layoutConfig.activeSymbol || 'sabat'} 
               onChange={(e) => handlePropChange('activeSymbol', 'type', e.target.value)}
               className="text-xs font-semibold text-slate-600 border border-slate-200 rounded-md px-2 py-1 bg-slate-50 cursor-pointer focus:outline-none hover:border-sky-300 transition-colors"
             >
                <option value="sabat">สะบัด/สะเดาะ</option>
                <option value="kwat">กวาด (รอก่อน)</option>
             </select>
           )}

           {/* ตัวเลือกสี - ซ่อนขอบให้กลืนไปกับพื้น */}
           <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
           
           <input 
             type="color" 
             value={isEditingMode ? activeSym.color : (layoutConfig.symbolColor || '#1e293b')}
             onChange={(e) => handlePropChange('symbolColor', 'color', e.target.value)}
             className="w-6 h-6 rounded-md cursor-pointer border-none p-0 bg-transparent"
             title="เลือกสีสัญลักษณ์"
           />
           
           <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md overflow-hidden px-1" title="ความหนาของเส้น">
             <span className="text-[10px] font-bold text-slate-400 pl-1 uppercase">หนา</span>
             <input 
               type="number" min="1" max="10" step="0.5"
               value={isEditingMode ? activeSym.strokeWidth : (layoutConfig.symbolStrokeWidth || 2.5)}
               onChange={(e) => handlePropChange('symbolStrokeWidth', 'strokeWidth', parseFloat(e.target.value))}
               className="w-10 text-xs font-bold text-slate-700 bg-transparent border-none text-center focus:ring-0 p-1"
             />
           </div>

           <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md overflow-hidden px-1" title="ความโค้ง/ความสูง">
             <span className="text-[10px] font-bold text-slate-400 pl-1 uppercase">โค้ง</span>
             <input 
               type="number" min="0" max="100"
               value={isEditingMode ? activeSym.height : (layoutConfig.symbolHeight !== undefined ? layoutConfig.symbolHeight : 20)}
               onChange={(e) => handlePropChange('symbolHeight', 'height', parseInt(e.target.value))}
               className="w-10 text-xs font-bold text-slate-700 bg-transparent border-none text-center focus:ring-0 p-1"
             />
           </div>

           <button 
             onClick={() => {
               if (isEditingMode) {
                 removeSymbol(selectedSymbolId);
                 setSelectedSymbolId(null);
               } else {
                 removeSymbolByCell(selectedCell);
               }
             }}
             className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors ml-1"
             title="ลบสัญลักษณ์"
           >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
           </button>
        </div>
      </div>

    </div>
  );
};

export default PlaybackControls;