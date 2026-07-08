import React, { useContext } from 'react';
import { MusicContext } from '../../contexts/MusicContext';

const MobileHome = ({ hasSong = false, onProjectPicked, onContinue }) => {
  const { loadProject, songName } = useContext(MusicContext) || {};

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      loadProject?.(file);
      onProjectPicked?.();
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-slate-50 flex flex-col items-center justify-center p-8">
      <div className="mb-12 text-center">
        <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 mx-auto border border-slate-100">
          <span className="text-4xl font-black text-slate-800 tracking-tighter">
            T<span className="text-sky-600">M</span>
            <span className="text-amber-500">E</span>
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-800">ยินดีต้อนรับ</h1>
        <p className="text-slate-400 font-bold text-sm mt-1">
          เลือกไฟล์เพลงของคุณเพื่อเริ่มซ้อม
        </p>
      </div>

      <div className="w-full max-w-[280px] space-y-3">
        <label className="block w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-center shadow-lg active:scale-95 transition-transform cursor-pointer">
          <input
            type="file"
            accept=".tme,.thai"
            className="hidden"
            onChange={handleFileChange}
          />
          เลือกไฟล์ .tme และ .thai
        </label>

        {hasSong && (
          <button
            onClick={onContinue}
            className="w-full bg-white text-slate-700 py-4 rounded-2xl font-bold text-center shadow-sm border border-slate-200 active:scale-95 transition-transform"
          >
            กลับไปหน้ากำลังเล่น
          </button>
        )}
      </div>

      {songName && (
        <div className="mt-8 bg-white p-4 rounded-2xl border border-slate-100 w-full max-w-[280px] shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
            เพลงล่าสุด
          </p>
          <p className="text-slate-700 font-bold truncate">{songName}</p>
        </div>
      )}
    </div>
  );
};

export default MobileHome;
