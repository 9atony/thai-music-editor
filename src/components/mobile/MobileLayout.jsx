import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import BottomNav from './BottomNav';
import MobileTopBar from './MobileTopBar';
import { auth, getUserStorageUsage } from '../../utils/firebase';

const APP_VERSION = '1.0.0';

const MobileLayout = ({ children, currentPage, onPageChange, userProfile }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [activePanel, setActivePanel] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [isStorageLoading, setIsStorageLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleMenuSelect = (page) => {
    setIsSidebarOpen(false);
    onPageChange?.(page);
  };

  const openPanel = (panel) => {
    setIsSidebarOpen(false);
    setActivePanel(panel);
  };

  const openSidebar = async () => {
    setIsSidebarOpen(true);
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setIsStorageLoading(true);
    try {
      setStorageInfo(await getUserStorageUsage(uid));
    } catch (error) {
      console.error('Error loading storage usage:', error);
      setStorageInfo({ error: true });
    } finally {
      setIsStorageLoading(false);
    }
  };

  const formatBytes = (bytes = 0) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getStoragePercentage = () => {
    if (!storageInfo || storageInfo.error || storageInfo.unlimited) return 0;
    if (storageInfo.maxBytes) return Math.min((storageInfo.usedBytes / storageInfo.maxBytes) * 100, 100);
    return Math.min((storageInfo.projectCount / storageInfo.maxProjects) * 100, 100);
  };

  return (
    <div
      className="flex flex-col h-[100dvh] bg-[#F8FAFC] antialiased text-slate-800 relative overflow-hidden"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      <MobileTopBar
        currentPage={currentPage}
        onPageChange={onPageChange}
        onMenuClick={openSidebar}
      />

      <main className="flex-1 overflow-y-auto w-full relative z-10 pb-[76px] hide-scrollbar">
        {children}
      </main>

      <BottomNav currentPage={currentPage} onPageChange={onPageChange} />

      {isSidebarOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <button
            type="button"
            aria-label="ปิดเมนู"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />

          <aside className="relative w-[280px] h-full bg-white shadow-2xl flex flex-col animate-slideRight">
            <button
              type="button"
              onClick={() => handleMenuSelect('settings')}
              className="w-full p-6 border-b border-slate-100 bg-slate-50/50 pt-safe-top text-left transition-colors hover:bg-slate-100/70"
            >
              <div className="flex items-center gap-4">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-14 h-14 rounded-full border-2 border-white shadow-sm object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center border-2 border-white shadow-sm shrink-0">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                )}
                <div className="min-w-0 overflow-hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">{userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'ผู้ใช้งาน'}</p>
                  <p className="text-[11px] font-semibold text-[#3B82F6] mt-0.5 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                    {userProfile?.role === 'admin' ? 'ผู้ดูแลระบบ' : userProfile?.role === 'premium' ? 'สมาชิกพรีเมียม' : 'นักดนตรีไทย'}
                  </p>
                </div>
              </div>
            </button>

            <nav className="flex-1 overflow-y-auto py-3 px-3">
              <button
                type="button"
                onClick={() => handleMenuSelect('home')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${currentPage === 'home' ? 'bg-sky-50 text-[#3B82F6] font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                หน้าหลัก
              </button>

              <button
                type="button"
                onClick={() => handleMenuSelect('settings')}
                className={`mt-1 w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${currentPage === 'settings' ? 'bg-sky-50 text-[#3B82F6] font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                โปรไฟล์และการตั้งค่า
              </button>

              <div className="mx-1 mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <svg className="h-4 w-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                  <span className="text-xs font-bold text-slate-700">พื้นที่บันทึกโน้ต</span>
                  {isStorageLoading && <span className="ml-auto h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />}
                </div>

                {!isStorageLoading && storageInfo?.error && (
                  <p className="text-[11px] text-rose-500">ไม่สามารถตรวจสอบพื้นที่ได้ในขณะนี้</p>
                )}

                {!isStorageLoading && storageInfo && !storageInfo.error && (
                  <>
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-slate-400">ใช้จริง {formatBytes(storageInfo.usedBytes)}</p>
                        <p className="mt-0.5 text-xs font-extrabold text-slate-700">
                          {storageInfo.unlimited
                            ? 'บันทึกได้ไม่จำกัด'
                            : storageInfo.maxBytes
                              ? `เหลือ ${formatBytes(storageInfo.remainingBytes)}`
                              : `เหลือ ${storageInfo.remainingProjects} โปรเจกต์`}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        {storageInfo.unlimited
                          ? `${storageInfo.projectCount} โปรเจกต์`
                          : storageInfo.maxBytes
                            ? `จาก ${formatBytes(storageInfo.maxBytes)}`
                            : `${storageInfo.projectCount}/${storageInfo.maxProjects}`}
                      </span>
                    </div>
                    {!storageInfo.unlimited && (
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full transition-all ${getStoragePercentage() >= 90 ? 'bg-rose-500' : 'bg-sky-500'}`}
                          style={{ width: `${Math.max(getStoragePercentage(), 1)}%` }}
                        />
                      </div>
                    )}
                  </>
                )}

                {!storageInfo && !isStorageLoading && <p className="text-[11px] text-slate-400">เปิดเมนูใหม่เพื่ออัปเดตข้อมูล</p>}
              </div>

              {userProfile?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => handleMenuSelect('admin-users')}
                  className={`mt-1 w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${currentPage === 'admin-users' ? 'bg-violet-50 text-violet-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  จัดการผู้ใช้งาน
                </button>
              )}

              <div className="px-4 pb-1 pt-5 text-[10px] font-bold uppercase tracking-wider text-slate-400">ช่วยเหลือ</div>

              <button type="button" onClick={() => openPanel('help')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors font-medium text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253" /></svg>
                คู่มือการใช้งาน
              </button>

              <button type="button" onClick={() => openPanel('contact')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors font-medium text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z" /></svg>
                แจ้งปัญหาและติดต่อ
              </button>

              <button type="button" onClick={() => openPanel('about')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors font-medium text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                เกี่ยวกับแอป
                <span className="ml-auto text-[10px] font-bold text-slate-400">v{APP_VERSION}</span>
              </button>
            </nav>

            <div className="p-4 border-t border-slate-100 pb-safe">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors text-sm font-bold active:scale-[0.98]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                ออกจากระบบ
              </button>
            </div>
          </aside>
        </div>
      )}

      {activePanel && (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-900/45 backdrop-blur-sm" onClick={() => setActivePanel(null)}>
          <section
            className="w-full max-h-[82dvh] overflow-y-auto rounded-t-3xl bg-white px-5 pb-8 pt-4 shadow-2xl animate-slideUp"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-800">
                {activePanel === 'help' ? 'คู่มือการใช้งาน' : activePanel === 'contact' ? 'แจ้งปัญหาและติดต่อ' : 'เกี่ยวกับแอป'}
              </h2>
              <button type="button" onClick={() => setActivePanel(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-label="ปิดหน้าต่าง">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {activePanel === 'help' && (
              <div className="space-y-3">
                {[
                  ['1', 'สร้างหรือเปิดโปรเจกต์', 'เลือกสร้างไฟล์ใหม่ เปิดไฟล์จากเครื่อง หรือเลือกโปรเจกต์ล่าสุดจากหน้าหลัก'],
                  ['2', 'เขียนและแก้ไขโน้ต', 'แตะช่องบนกระดาษเพื่อเลือกโน้ต แล้วใช้คีย์บอร์ดเครื่องดนตรีด้านล่าง'],
                  ['3', 'ตั้งจังหวะและหน้าทับ', 'เปิดเมนูเครื่องประกอบจังหวะเพื่อเลือกฉิ่ง กลองแขก กรับ และกำหนด BPM'],
                  ['4', 'เล่นและติดตามโน้ต', 'กดเล่นเพื่อฟังเสียง เคอร์เซอร์สีเขียวจะแสดงตำแหน่งที่กำลังเล่น'],
                  ['5', 'บันทึกและส่งออก', 'บันทึกโปรเจกต์ไว้ในบัญชีและส่งออกไฟล์ .tme เพื่อเปิดบนอุปกรณ์อื่น']
                ].map(([number, title, description]) => (
                  <div key={number} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-black text-sky-600">{number}</div>
                    <div><h3 className="text-sm font-bold text-slate-800">{title}</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p></div>
                  </div>
                ))}
              </div>
            )}

            {activePanel === 'contact' && (
              <div className="space-y-3">
                <p className="mb-4 text-sm leading-relaxed text-slate-500">หากพบข้อผิดพลาด กรุณาแจ้งชื่ออุปกรณ์ เบราว์เซอร์ และขั้นตอนที่ทำให้เกิดปัญหา เพื่อให้ตรวจสอบได้เร็วขึ้นครับ</p>
                <a href="mailto:hunmnum@gmail.com?subject=แจ้งปัญหา Thai Music Editor" className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sky-700">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl">✉️</span>
                  <div><div className="text-sm font-bold">ส่งอีเมลแจ้งปัญหา</div><div className="text-xs text-sky-500">hunmnum@gmail.com</div></div>
                </a>
                <a href="https://www.facebook.com/ratn.chay.sakdi.cay/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-indigo-700">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl">💬</span>
                  <div><div className="text-sm font-bold">ติดต่อผู้พัฒนา</div><div className="text-xs text-indigo-500">เปิด Facebook</div></div>
                </a>
                <a href="https://www.facebook.com/share/g/1D1FvNehDM/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-violet-700">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl">👥</span>
                  <div><div className="text-sm font-bold">ชุมชน Thai Music Editor</div><div className="text-xs text-violet-500">เข้าร่วมกลุ่ม Facebook</div></div>
                </a>
              </div>
            )}

            {activePanel === 'about' && (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 text-2xl font-black text-white shadow-lg">TME</div>
                <h3 className="text-xl font-extrabold text-slate-800">Thai Music Editor</h3>
                <p className="mt-1 text-xs font-bold text-sky-600">เวอร์ชัน {APP_VERSION}</p>
                <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-slate-500">เครื่องมือสร้าง แก้ไข บันทึก และแบ่งปันโน้ตดนตรีไทย เพื่อช่วยให้การเรียน การสอน และการอนุรักษ์ดนตรีไทยสะดวกยิ่งขึ้น</p>
                <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs text-slate-400">© {new Date().getFullYear()} Thai Music Editor</div>
              </div>
            )}
          </section>
        </div>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes slideRight {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slideRight {
          animation: slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default MobileLayout;
