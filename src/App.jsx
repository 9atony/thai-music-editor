import React, { useState, useEffect } from 'react';
import useDevice from './hooks/useDevice';
import DesktopEditor from './views/DesktopEditor';
import MobilePlayer from './views/MobilePlayer';
import Login from './pages/Login'; 

// ⭐ นำเข้า Layout และหน้าต่างๆ
import DesktopLayout from './components/layout/DesktopLayout';
import Home from './pages/Home';
import MyProjects from './pages/MyProjects'; // ⭐ 1. นำเข้าหน้า MyProjects เข้ามา

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './utils/firebase'; 

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // State สำหรับคุมหน้าจอ (home, my-projects, editor)
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

  // ระบบแยกหน้าจอมือถือ
  if (isMobile) {
    return <MobilePlayer />;
  }

  // ⭐ 2. ถ้าเป็นหน้า Editor ให้แสดงแบบเต็มจอไปเลย (ไม่แสดงเมนูด้านซ้าย)
  if (currentView === 'editor') {
    return <DesktopEditor onBack={() => setCurrentView('home')} />;
  }

  // ⭐ 3. สำหรับหน้าอื่นๆ ให้แสดงผ่าน DesktopLayout (มีเมนูด้านซ้าย)
  return (
    <DesktopLayout 
      currentPage={currentView} 
      onPageChange={(page) => setCurrentView(page)} // ส่งคำสั่งเปลี่ยนหน้าไปให้เมนูซ้าย
    >
      
      {/* สลับการแสดงผลตามค่า currentView */}
      {currentView === 'home' && (
        <Home onNewProject={() => setCurrentView('editor')} />
      )}
      
      {currentView === 'my-projects' && (
        <MyProjects onNewProject={() => setCurrentView('editor')} />
      )}

    </DesktopLayout>
  );
}

export default App;