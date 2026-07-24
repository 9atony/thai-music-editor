import React, { useState, useEffect } from 'react';
import useDevice from './hooks/useDevice';
import DesktopEditor from './views/DesktopEditor';
// ⭐ 1. นำเข้า MobileEditor สำหรับมือถือ
import MobileEditor from './views/MobileEditor'; 
import Login from './pages/Login'; 

import DesktopLayout from './components/layout/DesktopLayout';
import MobileLayout from './components/mobile/MobileLayout'; 
import Home from './pages/Home';
import MyProjects from './pages/MyProjects'; 
import Settings from './pages/Settings'; 

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './utils/firebase'; 

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const [currentView, setCurrentView] = useState('home'); 

  const { isMobile } = useDevice();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setIsAuthenticated(true);
      else setIsAuthenticated(false);
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  if (isCheckingAuth) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-500 font-medium">กำลังตรวจสอบข้อมูล...</div>;
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // ⭐ 2. จัดการหน้า Editor 
  if (currentView === 'editor') {
    if (isMobile) {
      // ⭐ เรียกใช้งานหน้า MobileEditor ที่สร้างไว้
      return <MobileEditor onBack={() => setCurrentView('home')} />;
    }
    return <DesktopEditor onBack={() => setCurrentView('home')} />;
  }

  // ⭐ 3. ฟังก์ชันเตรียมเนื้อหาที่จะไปใส่ไว้ตรงกลางของ Layout
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

      {currentView === 'settings' && (
        <Settings />
      )}
    </>
  );

  // ⭐ 4. สลับ Layout อัตโนมัติตามขนาดหน้าจอ
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