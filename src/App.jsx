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

  if (isCheckingAuth) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-500 font-medium">กำลังตรวจสอบข้อมูล...</div>;
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