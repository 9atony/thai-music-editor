import React, { useState, useContext, useEffect } from 'react';
import { MusicContext } from '../contexts/MusicContext';
import NowPlaying from '../components/player/NowPlaying';
import MobileQueue from '../components/player/MobileQueue';
import MobileHome from '../components/player/MobileHome';

const MobilePlayer = () => {
  const { sheetData, songName } = useContext(MusicContext) || {};
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  
  // ให้หน้า Home เป็น Default เริ่มต้นถ้ายังไม่มีเพลง
  const [isHomeOpen, setIsHomeOpen] = useState(true);

  const hasSong =
    Array.isArray(sheetData) &&
    sheetData.length > 0 &&
    Array.isArray(sheetData[0]) &&
    Array.isArray(sheetData[0][0]) &&
    sheetData[0][0][0] !== '-' &&
    songName !== "เพลงใหม่" && 
    songName !== "Untitled Project";

  // เมื่อมีเพลงแล้ว ให้ปิดหน้า Home อัตโนมัติ
  useEffect(() => {
    if (hasSong) {
      setIsHomeOpen(false);
    }
  }, [hasSong]);

  if (isHomeOpen) {
    return (
      <MobileHome
        hasSong={hasSong}
        onProjectPicked={() => {
          setIsHomeOpen(false);
          setIsQueueOpen(false);
        }}
        onContinue={() => setIsHomeOpen(false)}
      />
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-slate-900 overflow-hidden relative font-sans">
      <div
        className={`absolute inset-0 transition-transform duration-500 ease-in-out ${
          isQueueOpen
            ? '-translate-x-1/3 opacity-30 pointer-events-none'
            : 'translate-x-0 opacity-100'
        }`}
      >
        <NowPlaying
          onOpenQueue={() => setIsQueueOpen(true)}
          onBack={() => {
            setIsHomeOpen(true);
            setIsQueueOpen(false);
          }}
        />
      </div>
      <div
        className={`absolute inset-0 transition-transform duration-500 ease-in-out shadow-[-20px_0_40px_rgba(0,0,0,0.1)] ${
          isQueueOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <MobileQueue onClose={() => setIsQueueOpen(false)} />
      </div>
    </div>
  );
};

export default MobilePlayer;