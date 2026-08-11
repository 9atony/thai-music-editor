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

// นำเข้าหน้า Tools และ Admin Dashboard 
import Tools from './pages/Tools';
import AdminDashboard from './pages/AdminDashboard'; // ⭐ นำเข้าหน้าแอดมิน

import { onAuthStateChanged } from 'firebase/auth';
// ⭐ นำเข้า getUserProfile จาก firebase.js
import { auth, getUserProfile } from './utils/firebase'; 
import { MusicContext } from './contexts/MusicContext'; 

import { doc, updateDoc } from 'firebase/firestore';
import { db } from './utils/firebase';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // ⭐ State สำหรับเก็บข้อมูลโปรไฟล์และยศ (Role)
  const [userProfile, setUserProfile] = useState(null); 
  
  // State สำหรับควบคุมการแสดงหน้า Login เมื่อยังไม่ได้ล็อกอิน
  const [showLogin, setShowLogin] = useState(false);
  
  const [currentView, setCurrentView] = useState('home'); 
  
  // State สำหรับจดจำหน้าก่อนหน้าที่จะเข้า Editor
  const [previousView, setPreviousView] = useState('home'); 

  // ==========================================
  // ⭐ ระบบรหัสผ่านชั่วคราวกั้นหน้าเว็บ (บังคับกรอกทุกครั้งที่เปิดเว็บ)
  // ==========================================
  const SITE_PASSWORD = "327085"; 
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
  const { applyTemplate, loadProjectFromFirebase } = useContext(MusicContext);
  const [editorMode, setEditorMode] = useState('normal');

  // 2. ปรับแก้ส่วน useEffect เดิม เป็นแบบนี้ครับ
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        
        // ดึงข้อมูลโปรไฟล์จาก Firestore
        const profileData = await getUserProfile(user.uid);
        
        // ⭐ เพิ่มระบบดึงชื่อจาก Gmail มาเซฟลงฐานข้อมูลอัตโนมัติ
        if (profileData && !profileData.displayName && user.displayName) {
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              displayName: user.displayName // เอาชื่อจาก Google/Gmail มาเซฟทับ
            });
            profileData.displayName = user.displayName; // อัปเดตใน State ด้วย
          } catch (error) {
            console.error("อัปเดตชื่ออัตโนมัติไม่สำเร็จ:", error);
          }
        }

        setUserProfile(profileData);
        setCurrentView('home');
      } else {
        setIsAuthenticated(false);
        setUserProfile(null); 
      }
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // ดักจับปุ่ม Back ของเบราว์เซอร์/มือถือ
  useEffect(() => {
    window.history.pushState(null, null, window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, null, window.location.href);

      if (currentView === 'editor') {
        setCurrentView(previousView);
      } 
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

  if (!isAuthenticated) {
    if (showLogin) {
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
    return <Landing onLoginClick={() => setShowLogin(true)} />;
  }

  const handleOpenEditor = (projectId = null, projectData = null, options = {}) => {
    const isSampleView = options?.readOnly === true;
    setEditorMode(isSampleView ? 'sample-readonly' : 'normal');

    if (projectData && loadProjectFromFirebase) {
      try {
        const parsedData = typeof projectData === 'string' ? JSON.parse(projectData) : projectData;
        const payload = isSampleView
          ? parsedData
          : { ...(parsedData || {}), ...(projectId ? { id: projectId } : {}) };

        loadProjectFromFirebase(payload, true, isSampleView); 
      } catch (e) {
        console.error("รูปแบบข้อมูลไม่ถูกต้อง แปลง JSON ไม่สำเร็จ:", e);
      }
    }

    setPreviousView(currentView); 
    setCurrentView('editor');     
  };

  if (currentView === 'editor') {
    if (isMobile) {
      return <MobileEditor onBack={() => setCurrentView(previousView)} readOnly={editorMode === 'sample-readonly'} />;
    }
    return <DesktopEditor onBack={() => setCurrentView(previousView)} readOnly={editorMode === 'sample-readonly'} />;
  }

  // ⭐ ส่ง userProfile เข้าไปในแต่ละหน้า (Pages)
  const renderContent = () => (
    <>
      {currentView === 'home' && (
        <Home 
          userProfile={userProfile}
          onNewProject={(...args) => {
            setEditorMode('normal');
            handleOpenEditor(...args);
          }} 
          onPageChange={(page) => setCurrentView(page)} 
        />
      )}
      
      {currentView === 'my-projects' && (
        <MyProjects 
          userProfile={userProfile}
          onNewProject={(...args) => {
            setEditorMode('normal');
            handleOpenEditor(...args);
          }} 
        /> 
      )}

      {currentView === 'templates' && (
        <Templates 
          userProfile={userProfile}
          onNewProject={(templateData) => {
            setEditorMode('normal');
            applyTemplate(templateData);
            handleOpenEditor(); 
          }} 
        />
      )}

      {currentView === 'samples' && (
        <Samples userProfile={userProfile} onOpenProject={handleOpenEditor} /> 
      )}

      {currentView === 'tools' && (
        <Tools userProfile={userProfile} onPageChange={(page) => setCurrentView(page)} />
      )}

      {currentView === 'settings' && (
        <Settings userProfile={userProfile} />
      )}

      {/* ⭐ เพิ่มการแสดงผลหน้า Admin Dashboard */}
      {currentView === 'admin-users' && (
        <AdminDashboard userProfile={userProfile} />
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