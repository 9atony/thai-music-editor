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
const About = React.lazy(() => import('./pages/About'));

import { onAuthStateChanged } from 'firebase/auth';
// ⭐ นำเข้า getUserProfile จาก firebase.js
import { auth, getUserProfile } from './utils/firebase'; 
import { MusicContext } from './contexts/MusicContext'; 
import { useFeatureAccess } from './contexts/FeatureAccessContext';
import { primeAudioEngine } from './utils/audioEngine';
import { recordSystemEvent, setAnalyticsPage, startSystemAnalytics } from './utils/systemAnalytics';

import { doc, updateDoc } from 'firebase/firestore';
import { db } from './utils/firebase';

const VIEW_SESSION_KEY = 'thaiMusicEditorCurrentView';
const PREVIOUS_VIEW_SESSION_KEY = 'thaiMusicEditorPreviousView';
const EDITOR_MODE_SESSION_KEY = 'thaiMusicEditorEditorMode';
const ACTIVE_TOOL_SESSION_KEY = 'thaiMusicEditorActiveTool';
const validViews = new Set(['home', 'my-projects', 'templates', 'samples', 'tools', 'settings', 'admin-users', 'editor']);

const getStoredView = (key, fallback) => {
  const storedView = sessionStorage.getItem(key);
  return validViews.has(storedView) ? storedView : fallback;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // ⭐ State สำหรับเก็บข้อมูลโปรไฟล์และยศ (Role)
  const [userProfile, setUserProfile] = useState(null); 
  
 // State สำหรับควบคุมการแสดงหน้า Login เมื่อยังไม่ได้ล็อกอิน
  const [showLogin, setShowLogin] = useState(false);
  
  const [currentView, setCurrentView] = useState(() => getStoredView(VIEW_SESSION_KEY, 'home'));
  
  // State สำหรับจดจำหน้าก่อนหน้าที่จะเข้า Editor
  const [previousView, setPreviousView] = useState(() => getStoredView(PREVIOUS_VIEW_SESSION_KEY, 'home'));

  const { isMobile } = useDevice();
  const { applyTemplate, loadProjectFromFirebase } = useContext(MusicContext);
  const [editorMode, setEditorMode] = useState(() => sessionStorage.getItem(EDITOR_MODE_SESSION_KEY) || 'normal');
  const [toolsVisit, setToolsVisit] = useState(0);
  const isAdmin = userProfile?.role === 'admin';
  const { canAccess } = useFeatureAccess();
  const isAboutRoute = typeof window !== 'undefined' && window.location.pathname === '/about';

  // Keep the current workspace open after a browser refresh in this tab.
  useEffect(() => {
    sessionStorage.setItem(VIEW_SESSION_KEY, currentView);
    sessionStorage.setItem(PREVIOUS_VIEW_SESSION_KEY, previousView);
    sessionStorage.setItem(EDITOR_MODE_SESSION_KEY, editorMode);
  }, [currentView, previousView, editorMode]);

  useEffect(() => {
    setAnalyticsPage(currentView);
  }, [currentView]);

  // This is a UI deterrent only; access to admin data is enforced by
  // Firestore Rules and the API's verified Firebase token on the server.
  useEffect(() => {
    if (isAdmin) return undefined;
    const blockContextMenu = (event) => event.preventDefault();
    const blockInspectorShortcuts = (event) => {
      const key = event.key.toLowerCase();
      const isInspectorShortcut = event.key === 'F12'
        || ((event.ctrlKey || event.metaKey) && event.shiftKey && ['i', 'j', 'c', 'k'].includes(key))
        || ((event.ctrlKey || event.metaKey) && key === 'u');
      if (isInspectorShortcut) event.preventDefault();
    };
    window.addEventListener('contextmenu', blockContextMenu);
    window.addEventListener('keydown', blockInspectorShortcuts, true);
    return () => {
      window.removeEventListener('contextmenu', blockContextMenu);
      window.removeEventListener('keydown', blockInspectorShortcuts, true);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (userProfile && !isAdmin && currentView === 'admin-users') {
      setCurrentView('home');
    }
  }, [currentView, isAdmin, userProfile]);

  useEffect(() => {
    if (!isAuthenticated || !auth.currentUser?.uid) return undefined;
    return startSystemAnalytics(auth.currentUser.uid);
  }, [isAuthenticated]);

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
    if (isAboutRoute) {
      return <Suspense fallback={<LoadingScreen />}><About onLoginClick={() => { window.history.replaceState({}, '', '/'); setShowLogin(true); }} /></Suspense>;
    }
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

  if (isAboutRoute) {
    return <Suspense fallback={<LoadingScreen />}><About onLoginClick={() => { window.location.href = '/'; }} /></Suspense>;
  }

  // การกดเมนู “เครื่องมือ” เป็นการกลับไปหน้ารวมเสมอ แม้กำลังอยู่ในเครื่องมือย่อย
  // ส่วนการรีเฟรชหน้ายังคงเปิดเครื่องมือเดิมได้ เพราะไม่ได้เรียก handler นี้
  const handlePageChange = (page) => {
    if (page === 'admin-users' && !isAdmin) {
      setCurrentView('home');
      return;
    }
    if (page === 'tools') {
      sessionStorage.removeItem(ACTIVE_TOOL_SESSION_KEY);
      setToolsVisit((current) => current + 1);
    }
    const featureByPage = {
      'my-projects': 'projects', templates: 'templates', samples: 'samples', tools: 'metronome', settings: 'settings', editor: 'editor',
    };
    if (featureByPage[page] && !canAccess(featureByPage[page], userProfile?.role)) {
      setCurrentView('home');
      return;
    }
    setCurrentView(page);
  };

  const handleOpenEditor = (projectId = null, projectData = null, options = {}) => {
    if (!canAccess('editor', userProfile?.role)) return;
    if (projectId || projectData) recordSystemEvent('projectOpens', { feature: 'openProject', projectId: projectId || projectData?.id });
    // Sample songs are a listening-only experience for regular users. Admins
    // open the same song in the full editor so they can maintain its content.
    const isSampleView = options?.readOnly === true && userProfile?.role !== 'admin';
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

  const handleOpenArrangerProjects = () => {
    if (!canAccess('arranger', userProfile?.role)) return;
    sessionStorage.setItem(ACTIVE_TOOL_SESSION_KEY, 'arranger-projects');
    setPreviousView(currentView);
    setToolsVisit((current) => current + 1);
    setCurrentView('tools');
  };

  if (currentView === 'editor') {
    if (!canAccess('editor', userProfile?.role)) return <FeatureUnavailable />;
    const isSampleListeningMode = editorMode === 'sample-readonly' && userProfile?.role !== 'admin';
    if (isMobile || isSampleListeningMode) {
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
          onPageChange={handlePageChange}
        />
      )}
      
      {currentView === 'my-projects' && (
        canAccess('projects', userProfile?.role) ? <MyProjects
          userProfile={userProfile}
          onOpenArrangerProjects={handleOpenArrangerProjects}
          onNewProject={(...args) => {
            setEditorMode('normal');
            handleOpenEditor(...args);
          }} 
        /> : <FeatureUnavailable />
      )}

      {currentView === 'templates' && (
        canAccess('templates', userProfile?.role) ? <Templates
          userProfile={userProfile}
          onNewProject={(templateData) => {
            setEditorMode('normal');
            applyTemplate(templateData);
            handleOpenEditor(); 
          }} 
        /> : <FeatureUnavailable />
      )}

      {currentView === 'samples' && (
        canAccess('samples', userProfile?.role) ? <Samples userProfile={userProfile} onOpenProject={handleOpenEditor} /> : <FeatureUnavailable />
      )}

      {currentView === 'tools' && (
        canAccess('metronome', userProfile?.role) || canAccess('arranger', userProfile?.role)
          ? <Tools key={toolsVisit} userProfile={userProfile} /> : <FeatureUnavailable />
      )}

      {currentView === 'settings' && (
        canAccess('settings', userProfile?.role) ? <Settings userProfile={userProfile} /> : <FeatureUnavailable />
      )}

      {/* ⭐ เพิ่มการแสดงผลหน้า Admin Dashboard */}
      {currentView === 'admin-users' && (
        <AdminDashboard userProfile={userProfile} />
      )}
    </>
  );

  if (isMobile) {
    return (
      <MobileLayout currentPage={currentView} onPageChange={handlePageChange} userProfile={userProfile}>
        <Suspense fallback={<LoadingScreen />}>{renderContent()}</Suspense>
      </MobileLayout>
    );
  }

  return (
    <DesktopLayout currentPage={currentView} onPageChange={handlePageChange}>
      <Suspense fallback={<LoadingScreen />}>{renderContent()}</Suspense>
    </DesktopLayout>
  );
}

const LoadingScreen = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-500 font-medium">
    กำลังโหลด...
  </div>
);

const FeatureUnavailable = () => (
  <div className="m-4 rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
    <h2 className="text-lg font-black text-slate-800">ฟังก์ชันนี้ยังไม่เปิดให้ใช้ในแผนของคุณ</h2>
    <p className="mt-2 text-sm text-slate-500">กรุณาติดต่อผู้ดูแลระบบเพื่อสอบถามสิทธิ์การใช้งาน</p>
  </div>
);

export default App;
