import React, { useState, useEffect } from 'react';
import useDevice from './hooks/useDevice';
import DesktopEditor from './views/DesktopEditor';
import Login from './pages/Login'; 

// ⭐ 1. นำเข้า Layout และหน้าต่างๆ สำหรับทั้งสองแพลตฟอร์ม
import DesktopLayout from './components/layout/DesktopLayout';
import MobileLayout from './components/mobile/MobileLayout'; 
import Home from './pages/Home';
import MyProjects from './pages/MyProjects'; 

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

  // ⭐ 2. จัดการหน้า Editor (แยกคอม/มือถืออย่างชัดเจน)
  if (currentView === 'editor') {
    if (isMobile) {
      // หน้า MobileEditor ที่เราจะทำกันในอนาคต (ตอนนี้ใส่หน้าแจ้งเตือนไว้ก่อน)
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center" style={{ fontFamily: 'Prompt, sans-serif' }}>
          <div className="text-5xl mb-4">🚧</div>
          <h2 className="text-xl font-bold mb-2 text-slate-800">หน้า Editor สำหรับมือถือ</h2>
          <p className="text-slate-500 mb-8 text-sm">กำลังอยู่ในขั้นตอนการพัฒนาครับ อดใจรออีกนิดนะ</p>
          <button 
            onClick={() => setCurrentView('home')}
            className="px-6 py-3 bg-[#EF4444] hover:bg-red-600 transition-colors text-white rounded-xl font-bold text-sm shadow-sm"
          >
            กลับสู่หน้าหลัก
          </button>
        </div>
      );
    }
    // หากเป็นคอมพิวเตอร์ ให้แสดง DesktopEditor ปกติ
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
    </>
  );

  // ⭐ 4. สลับ Layout อัตโนมัติตามขนาดหน้าจอ (พระเอกของงานนี้)
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