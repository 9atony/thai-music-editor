import React, { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import logoImg from '../../assets/logo wep.png';
import { db } from '../../utils/firebase';

const MobileTopBar = ({ currentPage, onPageChange, onMenuClick }) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [isUnread, setIsUnread] = useState(false);

  useEffect(() => {
    if (currentPage !== 'home') return undefined;

    const latestUpdateQuery = query(
      collection(db, 'updates'),
      orderBy('date', 'desc'),
      limit(1)
    );

    return onSnapshot(latestUpdateQuery, (snapshot) => {
      if (snapshot.empty) {
        setLatestUpdate(null);
        setIsUnread(false);
        return;
      }

      const update = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };
      setLatestUpdate(update);
      setIsUnread(localStorage.getItem('lastSeenUpdateId') !== update.id);
    }, (error) => {
      console.error('Error loading mobile notifications:', error);
    });
  }, [currentPage]);

  const closeNotifications = () => {
    setIsNotifOpen(false);
    if (latestUpdate) {
      localStorage.setItem('lastSeenUpdateId', latestUpdate.id);
      setIsUnread(false);
    }
  };

  const formatUpdateDate = (timestamp) => {
    const date = timestamp?.toDate?.()
      || (timestamp?.seconds ? new Date(timestamp.seconds * 1000) : null);
    if (!date) return 'ประกาศล่าสุด';
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderCenterContent = () => {
    if (currentPage === 'home') {
      return <img src={logoImg} alt="TME Logo" className="h-8 w-auto object-contain drop-shadow-sm mt-1" />;
    }
    if (currentPage === 'my-projects') return <h1 className="text-lg font-bold text-slate-800">โปรเจกต์ของฉัน</h1>;
    if (currentPage === 'settings') return <h1 className="text-lg font-bold text-slate-800">การตั้งค่า</h1>;
    if (currentPage === 'tools') return <h1 className="text-lg font-bold text-slate-800">เครื่องมือ</h1>;
    if (currentPage === 'admin-users') return <h1 className="text-lg font-bold text-violet-700">จัดการผู้ใช้งาน</h1>;
    return <h1 className="text-lg font-bold text-slate-800">Thai Music Editor</h1>;
  };

  const renderContextIcon = () => {
    if (currentPage === 'home') {
      return (
        <button
          type="button"
          onClick={() => setIsNotifOpen(true)}
          className="p-2 relative text-slate-600 hover:text-slate-900 transition-colors"
          aria-label="เปิดการแจ้งเตือน"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          {isUnread && <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full" />}
        </button>
      );
    }

    if (currentPage === 'my-projects') {
      return (
        <button type="button" className="p-2 text-slate-600 hover:text-slate-900 transition-colors" aria-label="ค้นหาโปรเจกต์">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>
      );
    }
    return null;
  };

  return (
    <>
      <header className="flex items-center justify-between px-4 h-16 bg-white/95 backdrop-blur-md border-b border-slate-100/80 sticky top-0 z-40 transition-all pt-safe">
        <button type="button" onClick={onMenuClick} className="p-2 -ml-2 text-slate-600 hover:text-slate-900 transition-colors" aria-label="เปิดเมนู">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        <div className="flex-1 flex justify-center">{renderCenterContent()}</div>

        <div className="flex items-center justify-end gap-0.5 -mr-2">
          {renderContextIcon()}
          <button
            type="button"
            onClick={() => onPageChange?.('settings')}
            className={`p-2 rounded-full transition-colors ${currentPage === 'settings' ? 'bg-rose-50 text-[#EF4444]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            aria-label="เปิดการตั้งค่า"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </header>

      {isNotifOpen && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col animate-fadeIn">
          <div className="px-4 h-16 border-b border-slate-100 flex items-center bg-white shrink-0">
            <button type="button" onClick={closeNotifications} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-full transition-colors mr-2" aria-label="ปิดการแจ้งเตือน">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              การแจ้งเตือน
              {isUnread && <span className="text-[10px] bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full font-bold mt-0.5">1 ใหม่</span>}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto pb-8 bg-slate-50/30">
            {latestUpdate ? (
              <article className={`p-5 border-b border-slate-100 flex gap-4 ${isUnread ? 'bg-sky-50/50' : 'bg-white'}`}>
                <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-500 flex items-center justify-center shrink-0 mt-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h4 className="text-sm font-bold text-slate-800 mb-2">{latestUpdate.title}</h4>
                  <div className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-line break-words">
                    {latestUpdate.content || 'มีประกาศอัปเดตใหม่จาก Thai Music Editor'}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-3 block font-medium">{formatUpdateDate(latestUpdate.date)}</span>
                </div>
              </article>
            ) : (
              <div className="p-10 text-center text-slate-400 text-sm">ยังไม่มีการแจ้งเตือน</div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MobileTopBar;
