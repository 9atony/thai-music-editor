import React, { useState } from 'react';
import NowPlaying from '../components/player/NowPlaying';
import MobileQueue from '../components/player/MobileQueue';

const MobilePlayer = () => {
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  return (
    <div className="h-[100dvh] w-full bg-slate-900 overflow-hidden relative font-sans">
      <div className={`absolute inset-0 transition-transform duration-500 ease-in-out ${isQueueOpen ? '-translate-x-1/3 opacity-30 pointer-events-none' : 'translate-x-0 opacity-100'}`}>
        <NowPlaying onOpenQueue={() => setIsQueueOpen(true)} />
      </div>
      <div className={`absolute inset-0 transition-transform duration-500 ease-in-out shadow-[-20px_0_40px_rgba(0,0,0,0.1)] ${isQueueOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <MobileQueue onClose={() => setIsQueueOpen(false)} />
      </div>
    </div>
  );
};

export default MobilePlayer;