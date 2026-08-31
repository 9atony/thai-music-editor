import React, { Suspense, useState, useEffect, useContext } from 'react';
import useDevice from './hooks/useDevice';
import Login from './pages/Login'; 
import Landing from './pages/Landing';
import DesktopLayout from './components/layout/DesktopLayout';
import MobileLayout from './components/mobile/MobileLayout'; 
import Home from './pages/Home';

const DesktopEditor = React.lazy(() => import('./views/DesktopEditor'));
const MobileEditor = React.lazy(() => import('./views/MobileEditor'));
const MyProjects = React.lazy(() => import('./pages/MyProjects'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Templates = React.lazy(() => import('./pages/Templates'));
const Samples = React.lazy(() => import('./pages/Samples'));
const Tools = React.lazy(() => import('./pages/Tools'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));

import { onAuthStateChanged } from 'firebase/auth';
// ⭐ นำเข้า getUserProfile จาก firebase.js
import { auth, getUserProfile } from './utils/firebase'; 
import { MusicContext } from './contexts/MusicContext'; 
import { primeAudioEngine } from './utils/audioEngine';

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

  useEffect(() => {
    let armed = true;
    const triggerPrime = () => {
      if (!armed) return;
      armed = false;
      window.removeEventListener('pointerdown', triggerPrime);
      window.removeEventListener('touchstart', triggerPrime);
      window.removeEventListener('keydown', triggerPrime);
      primeAudioEngine().catch(() => {});
    };

    window.addEventListener('pointerdown', triggerPrime, { passive: true });
    window.addEventListener('touchstart', triggerPrime, { passive: true });
    window.addEventListener('keydown', triggerPrime);

    return () => {
      armed = false;
      window.removeEventListener('pointerdown', triggerPrime);
      window.removeEventListener('touchstart', triggerPrime);
      window.removeEventListener('keydown', triggerPrime);
    };
  }, []);

  if (isCheckingAuth) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-500 font-medium">กำลังตรวจสอบข้อมูล...</div>;
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
      return <Suspense fallback={<LoadingScreen />}><MobileEditor onBack={() => setCurrentView(previousView)} readOnly={editorMode === 'sample-readonly'} /></Suspense>;
    }
    return <Suspense fallback={<LoadingScreen />}><DesktopEditor onBack={() => setCurrentView(previousView)} readOnly={editorMode === 'sample-readonly'} /></Suspense>;
  }

  // ⭐ ส่ง userProfile เข้าไปในแต่ละหน้า (Pages)
  const renderContent = () => (
    <>
      {currentView === 'home' && (
        <Home 
          userProfile={userProfile}
          isMobile={isMobile}
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
      <MobileLayout currentPage={currentView} onPageChange={(page) => setCurrentView(page)} userProfile={userProfile}>
        <Suspense fallback={<LoadingScreen />}>{renderContent()}</Suspense>
      </MobileLayout>
    );
  }

  return (
    <DesktopLayout currentPage={currentView} onPageChange={(page) => setCurrentView(page)}>
      <Suspense fallback={<LoadingScreen />}>{renderContent()}</Suspense>
    </DesktopLayout>
  );
}

const LoadingScreen = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-500 font-medium">
    กำลังโหลด...
  </div>
);

export default App;
