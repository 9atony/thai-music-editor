import React, { useState, useEffect, useContext } from 'react'; 
import useDevice from './hooks/useDevice';
import DesktopEditor from './views/DesktopEditor';
import MobileEditor from './views/MobileEditor'; 
import Login from './pages/Login'; 

// นำเข้าหน้า Landing
import Landing from './pages/Landing';

import DesktopLayout from './components/layout/DesktopLayout';
import MobileLayout from './components/mobile/MobileLayout'; 
import Home from './pages/Home';
import MyProjects from './pages/MyProjects'; 
import Settings from './pages/Settings'; 

// นำเข้าหน้า Templates และ Samples 
import Templates from './pages/Templates';
import Samples from './pages/Samples';

// นำเข้าหน้า Tools ที่เพิ่งสร้างใหม่
import Tools from './pages/Tools';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './utils/firebase'; 
import { MusicContext } from './contexts/MusicContext'; 

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // State สำหรับควบคุมการแสดงหน้า Login เมื่อยังไม่ได้ล็อกอิน
  const [showLogin, setShowLogin] = useState(false);
  
  const [currentView, setCurrentView] = useState('home'); 
  
  // State สำหรับจดจำหน้าก่อนหน้าที่จะเข้า Editor
  const [previousView, setPreviousView] = useState('home'); 

  // ==========================================
  // ⭐ ระบบรหัสผ่านชั่วคราวกั้นหน้าเว็บ (บังคับกรอกทุกครั้งที่เปิดเว็บ)
  // ==========================================
  const SITE_PASSWORD = "327085"; // 👈 เปลี่ยนรหัสผ่านตรงนี้ได้ตามต้องการครับ
  const [isSiteUnlocked, setIsSiteUnlocked] = useState(() => {
    return sessionStorage.getItem('tme_site_unlocked') === 'true';
  });
  const [sitePassInput, setSitePassInput] = useState("");
  const [passError, setPassError] = useState(false);

  const handleSiteLogin = (e) => {
    e.preventDefault();
    if (sitePassInput === SITE_PASSWORD) {
      sessionStorage.setItem('tme_site_unlocked', 'true');
      setIsSiteUnlocked(true);
      setPassError(false);
    } else {
      setPassError(true);
      setSitePassInput("");
    }
  };
  // ==========================================
  // ==========================================

  const { isMobile } = useDevice();

  // ⭐ ดึงฟังก์ชัน applyTemplate และฟังก์ชันโหลดข้อมูลโปรเจกต์จาก Context
  const { applyTemplate, loadProjectFromFirebase } = useContext(MusicContext);

  // โหมดการเปิด Editor: ปกติ / ดูตัวอย่างแบบอ่านอย่างเดียว
  const [editorMode, setEditorMode] = useState('normal');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        // รีเซ็ตหน้ากลับเป็น home เสมอเมื่อเข้าสู่ระบบสำเร็จ
        setCurrentView('home');
      } else {
        setIsAuthenticated(false);
      }
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

// ⭐ ดักจับปุ่ม Back ของเบราว์เซอร์/มือถือ (ป้องกันกดแล้วหลุดออกจากเว็บ)
  useEffect(() => {
    window.history.pushState(null, null, window.location.href);

    const handlePopState = () => {
      // ดันประวัติหลอกไว้ซ้ำเรื่อยๆ เพื่อดักปุ่ม Back ไม่ให้หลุดเว็บ
      window.history.pushState(null, null, window.location.href);

      // ถ้าตอนนี้อยู่หน้า Editor ให้กด Back แล้วเด้งกลับหน้าก่อนหน้า (เช่น home หรือ my-projects)
      if (currentView === 'editor') {
        setCurrentView(previousView);
      } 
      // ถ้าไม่ได้อยู่หน้า Editor แต่เป็นหน้าเมนูย่อยอื่นๆ ให้กด Back แล้วกลับมาหน้า home
      else if (currentView !== 'home' && currentView !== 'landing') {
        setCurrentView('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentView, previousView]);

  if (isCheckingAuth) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-500 font-medium">กำลังตรวจสอบข้อมูล...</div>;
  }

  // ⭐ ถ้ายังไม่ได้ปลดล็อกรหัสผ่านหน้าเว็บ ให้แสดงหน้าจอกรอกรหัสก่อนเป็นอันดับแรกสุด
  if (!isSiteUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans" style={{ fontFamily: 'Prompt, sans-serif' }}>
        <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
          <div className="w-16 h-16 bg-sky-100 text-sky-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-1">กรอกรหัสผ่านเข้าเว็บไซต์</h2>
          <p className="text-xs text-slate-400 mb-6">โปรดระบุรหัสผ่านเพื่อเข้าใช้งานระบบ</p>
          
          <form onSubmit={handleSiteLogin} className="space-y-4">
            <input 
              type="password"
              placeholder="รหัสผ่านเว็บไซต์"
              value={sitePassInput}
              onChange={(e) => setSitePassInput(e.target.value)}
              autoFocus
              className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm font-bold text-center outline-none transition-all ${passError ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 focus:border-sky-400'}`}
            />
            {passError && <p className="text-xs text-rose-500 font-bold">รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง</p>}
            
            <button 
              type="submit"
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-sky-500/20 active:scale-[0.98]"
            >
              เข้าสู่เว็บไซต์
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ปรับโลจิกจัดการหน้าก่อนเข้าสู่ระบบ
  if (!isAuthenticated) {
    if (showLogin) {
      // หน้า Login พร้อมส่งฟังก์ชันปิดหน้าเพื่อกลับไป Landing ได้
      return (
        <Login 
          onLoginSuccess={() => {
            setIsAuthenticated(true);
            setShowLogin(false); 
          }} 
          onBackToLanding={() => setShowLogin(false)} 
        />
      );
    }
    // แสดงหน้า Landing เป็นค่าเริ่มต้น
    return <Landing onLoginClick={() => setShowLogin(true)} />;
  }

  // ===== ส่วนด้านล่างนี้คือหน้าสำหรับผู้ใช้ที่ล็อกอินแล้ว =====

  // ⭐ ปรับให้ handleOpenEditor รับค่า id, ข้อมูลโปรเจกต์ และ option เพิ่มเติม
  const handleOpenEditor = (projectId = null, projectData = null, options = {}) => {
    const isSampleView = options?.readOnly === true;
    setEditorMode(isSampleView ? 'sample-readonly' : 'normal');

    // ถ้ามีการส่งข้อมูล projectData มาด้วย (เช่น จากหน้า Samples)
    if (projectData && loadProjectFromFirebase) {
      try {
        // แปลงข้อมูล Text ให้เป็น JSON Object ก่อนส่งให้ Editor ทำงาน
        const parsedData = typeof projectData === 'string' ? JSON.parse(projectData) : projectData;

        // ถ้าเป็น sample แบบดูอย่างเดียว ไม่ต้องผูก projectId เดิมไว้ ป้องกันการเซฟทับต้นฉบับ
        const payload = isSampleView
          ? parsedData
          : { ...(parsedData || {}), ...(projectId ? { id: projectId } : {}) };

        loadProjectFromFirebase(payload, true, isSampleView); // ⭐ skipWarning + readOnly
      } catch (e) {
        console.error("รูปแบบข้อมูลไม่ถูกต้อง แปลง JSON ไม่สำเร็จ:", e);
      }
    }

    setPreviousView(currentView); // จำไว้ว่ามาจากหน้าไหน 
    setCurrentView('editor');     // เปลี่ยนหน้าไปเป็น editor
  };

  if (currentView === 'editor') {
    if (isMobile) {
      return <MobileEditor onBack={() => setCurrentView(previousView)} readOnly={editorMode === 'sample-readonly'} />;
    }
    return <DesktopEditor onBack={() => setCurrentView(previousView)} readOnly={editorMode === 'sample-readonly'} />;
  }

  const renderContent = () => (
    <>
      {currentView === 'home' && (
        <Home 
          onNewProject={(...args) => {
            setEditorMode('normal');
            handleOpenEditor(...args);
          }} 
          onPageChange={(page) => setCurrentView(page)} 
        />
      )}
      
      {currentView === 'my-projects' && (
        <MyProjects onNewProject={(...args) => {
          setEditorMode('normal');
          handleOpenEditor(...args);
        }} /> 
      )}

      {currentView === 'templates' && (
        <Templates onNewProject={(templateData) => {
          setEditorMode('normal');
          applyTemplate(templateData);
          handleOpenEditor(); 
        }} />
      )}

      {/* ⭐ ส่ง handleOpenEditor ไปที่ Samples */}
      {currentView === 'samples' && (
        <Samples onOpenProject={handleOpenEditor} /> 
      )}

      {currentView === 'tools' && (
        <Tools onPageChange={(page) => setCurrentView(page)} />
      )}

      {currentView === 'settings' && (
        <Settings />
      )}
    </>
  );

  if (isMobile) {
    return (
      <MobileLayout currentPage={currentView} onPageChange={(page) => setCurrentView(page)}>
        {renderContent()}
      </MobileLayout>
    );
  }

  return (
    <DesktopLayout currentPage={currentView} onPageChange={(page) => setCurrentView(page)}>
      {renderContent()}
    </DesktopLayout>
  );
}

export default App;