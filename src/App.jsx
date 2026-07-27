import React, { useState, useEffect, useContext } from 'react'; // ⭐ เพิ่ม useContext
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
import { MusicContext } from './contexts/MusicContext'; // ⭐ นำเข้า MusicContext

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // State สำหรับควบคุมการแสดงหน้า Login เมื่อยังไม่ได้ล็อกอิน
  const [showLogin, setShowLogin] = useState(false);
  
  const [currentView, setCurrentView] = useState('home'); 
  
  // ⭐ เพิ่ม State สำหรับจดจำหน้าก่อนหน้าที่จะเข้า Editor
  const [previousView, setPreviousView] = useState('home'); 

  const { isMobile } = useDevice();

  // ⭐ ดึงฟังก์ชัน applyTemplate ออกมาใช้งาน
  const { applyTemplate } = useContext(MusicContext);

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

  // ⭐ สร้างฟังก์ชันตัวช่วยสำหรับเปิด Editor และจดจำหน้าปัจจุบันไว้
  const handleOpenEditor = () => {
    setPreviousView(currentView); // จำไว้ว่ามาจากหน้าไหน (เช่น templates, my-projects)
    setCurrentView('editor');     // เปลี่ยนหน้าไปเป็น editor
  };

  if (currentView === 'editor') {
    if (isMobile) {
      // ⭐ เปลี่ยนจาก 'home' เป็น previousView ที่เราบันทึกไว้
      return <MobileEditor onBack={() => setCurrentView(previousView)} />;
    }
    // ⭐ เปลี่ยนจาก 'home' เป็น previousView ที่เราบันทึกไว้
    return <DesktopEditor onBack={() => setCurrentView(previousView)} />;
  }

  const renderContent = () => (
    <>
      {currentView === 'home' && (
        <Home 
          onNewProject={handleOpenEditor} // ⭐ เรียกใช้ฟังก์ชันที่สร้างไว้
          onPageChange={(page) => setCurrentView(page)} 
        />
      )}
      
      {currentView === 'my-projects' && (
        <MyProjects onNewProject={handleOpenEditor} /> // ⭐ เรียกใช้ฟังก์ชันที่สร้างไว้
      )}

      {currentView === 'templates' && (
        <Templates onNewProject={(templateData) => {
          // ⭐ เมื่อเลือกเทมเพลต ให้อัปเดตข้อมูลลงกระดาษก่อนสลับหน้า
          applyTemplate(templateData);
          handleOpenEditor(); // ⭐ เรียกใช้ฟังก์ชันที่สร้างไว้
        }} />
      )}

      {currentView === 'samples' && (
        <Samples onOpenProject={handleOpenEditor} /> // ⭐ เรียกใช้ฟังก์ชันที่สร้างไว้
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