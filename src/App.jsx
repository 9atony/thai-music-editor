import React, { useState, useEffect } from 'react';
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

// ⭐ 1. นำเข้าหน้า Tools ที่เพิ่งสร้างใหม่
import Tools from './pages/Tools';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './utils/firebase'; 

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // State สำหรับควบคุมการแสดงหน้า Login เมื่อยังไม่ได้ล็อกอิน
  const [showLogin, setShowLogin] = useState(false);
  
  const [currentView, setCurrentView] = useState('home'); 

  const { isMobile } = useDevice();

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

  if (currentView === 'editor') {
    if (isMobile) {
      return <MobileEditor onBack={() => setCurrentView('home')} />;
    }
    return <DesktopEditor onBack={() => setCurrentView('home')} />;
  }

  const renderContent = () => (
    <>
      {currentView === 'home' && (
        <Home 
          onNewProject={() => setCurrentView('editor')} 
          onPageChange={(page) => setCurrentView(page)} 
        />
      )}
      
      {currentView === 'my-projects' && (
        <MyProjects onNewProject={() => setCurrentView('editor')} />
      )}

      {currentView === 'templates' && (
        <Templates onNewProject={() => setCurrentView('editor')} />
      )}

      {currentView === 'samples' && (
        <Samples onOpenProject={() => setCurrentView('editor')} />
      )}

      {/* ⭐ 2. เพิ่มเงื่อนไขให้แสดงหน้า Tools เมื่อ currentView เป็น 'tools' */}
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