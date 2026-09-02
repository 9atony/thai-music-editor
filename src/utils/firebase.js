import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { 
  getFirestore, collection, query, orderBy, limit, getDocs, 
  addDoc, doc, updateDoc, deleteDoc, serverTimestamp,
  setDoc, getDoc, Timestamp 
} from 'firebase/firestore'; 
import { getStorage } from "firebase/storage";
import { configureSystemAnalytics, recordSystemEvent } from './systemAnalytics';

// 1. Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBMW-AKd2p41qin2KmHi7skooNsKI2v_kI",
  authDomain: "thai-music-editor.firebaseapp.com",
  projectId: "thai-music-editor",
  storageBucket: "thai-music-editor.firebasestorage.app",
  messagingSenderId: "481298501401",
  appId: "1:481298501401:web:1ff4986d75e31816a0ff88",
  measurementId: "G-V1WXV1KMN0"
};

// 2. Initialize
const app = initializeApp(firebaseConfig);
getAnalytics(app);

// 3. Export Auth และ DB
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
configureSystemAnalytics({ db, auth });

// ==========================================
// 🌟 ระบบสมัครสมาชิกและจัดการยศ
// ==========================================

export const registerUser = async (email, password, displayName = "") => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: displayName,
      role: "user", 
      createdAt: serverTimestamp()
    });

    return user;
  } catch (error) {
    console.error("สมัครสมาชิกไม่สำเร็จ:", error);
    throw error;
  }
};

// ⭐ อัปเดตฟังก์ชันดึงโปรไฟล์ ให้เช็กวันหมดอายุและลดระดับอัตโนมัติ
export const getUserProfile = async (uid) => {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const userData = docSnap.data();
      
      // ตรวจสอบว่าถ้าเป็น premium แล้วเลยวันหมดอายุหรือยัง
      if (userData.role === 'premium' && userData.premiumUntil) {
          const expirationDate = userData.premiumUntil.toDate();
          if (new Date() > expirationDate) {
              console.log(`บัญชี Premium ของ ${uid} หมดอายุแล้ว ระบบกำลังลดระดับเป็น user ทั่วไป...`);
              
              // สิทธิ์หมดอายุจะแสดงเป็นผู้ใช้ทั่วไปใน client
              // การแก้ role ในฐานข้อมูลสงวนไว้ให้ Admin ผ่าน Firestore Rules
              return { ...userData, role: 'user' }; 
          }
      }
      return userData; 
    } else {
      console.log("ไม่พบข้อมูลผู้ใช้");
      return { role: "user" }; 
    }
  } catch (error) {
    console.error("ดึงข้อมูลประวัติไม่สำเร็จ:", error);
    return null;
  }
};

// ==========================================
// 🌟 ระบบจัดการ Premium โดย Admin
// ==========================================

export const upgradeUserToPremium = async (uid, months = 1) => {
  try {
    const userRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userRef);
    
    let currentExpiration = new Date(); 
    
    if (docSnap.exists()) {
       const userData = docSnap.data();
       if (userData.role === 'premium' && userData.premiumUntil) {
           const existingExpiration = userData.premiumUntil.toDate();
           if (existingExpiration > new Date()) {
               currentExpiration = existingExpiration;
           }
       }
    }

    currentExpiration.setDate(currentExpiration.getDate() + (months * 30));

    await updateDoc(userRef, {
      role: 'premium',
      premiumUntil: Timestamp.fromDate(currentExpiration)
    });
    
    console.log(`อัปเกรด UID: ${uid} เป็น Premium สำเร็จ ถึงวันที่ ${currentExpiration.toLocaleDateString()}`);
    return true;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการอัปเกรด Premium:", error);
    throw error;
  }
};

// ==========================================
// ส่วนจัดการโปรเจกต์
// ==========================================

export const fetchRecentProjects = async (uid) => {
  try {
    const projectsRef = collection(db, `users/${uid}/projects`);
    const q = query(projectsRef, orderBy('updatedAt', 'desc'), limit(5));
    const querySnapshot = await getDocs(q);
    recordSystemEvent('projectListLoads', { feature: 'projectList', reads: querySnapshot.size });
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        sheetData: data.sheetData ? JSON.parse(data.sheetData) : []
      };
    });
  } catch (error) {
    console.error("ดึงข้อมูลไม่สำเร็จ:", error);
    return [];
  }
};

export const fetchAllProjects = async (uid) => {
  try {
    const projectsRef = collection(db, `users/${uid}/projects`);
    const querySnapshot = await getDocs(projectsRef);
    
    recordSystemEvent('projectListLoads', { feature: 'projectList', reads: querySnapshot.size });
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        sheetData: data.sheetData ? JSON.parse(data.sheetData) : []
      };
    });
  } catch (error) {
    console.error("ดึงข้อมูลโปรเจกต์ทั้งหมดไม่สำเร็จ:", error);
    throw error;
  }
};

export const loginUser = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logoutUser = () => signOut(auth);

export const FREE_PROJECT_LIMIT = 10;
export const PREMIUM_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

export const getUserStorageUsage = async (uid) => {
  if (!uid) throw new Error('USER_ID_REQUIRED');

  const [userProfile, projectsSnapshot] = await Promise.all([
    getUserProfile(uid),
    getDocs(collection(db, `users/${uid}/projects`))
  ]);
  const role = userProfile?.role || 'user';
  let usedBytes = 0;
  projectsSnapshot.forEach((projectDoc) => {
    usedBytes += new Blob([JSON.stringify(projectDoc.data())]).size;
  });

  const projectCount = projectsSnapshot.size;
  if (role === 'admin') {
    return { role, usedBytes, projectCount, unlimited: true };
  }
  if (role === 'premium') {
    return {
      role,
      usedBytes,
      projectCount,
      maxBytes: PREMIUM_STORAGE_LIMIT_BYTES,
      remainingBytes: Math.max(PREMIUM_STORAGE_LIMIT_BYTES - usedBytes, 0)
    };
  }
  return {
    role,
    usedBytes,
    projectCount,
    maxProjects: FREE_PROJECT_LIMIT,
    remainingProjects: Math.max(FREE_PROJECT_LIMIT - projectCount, 0)
  };
};

export const saveProjectToDB = async (uid, projectId, projectData) => {
  try {
    const userProfile = await getUserProfile(uid);
    const role = userProfile?.role || "user"; 
    const isAdmin = role === "admin";
    const isPremium = role === "premium";

    if (!isAdmin) {
      const projectsRef = collection(db, `users/${uid}/projects`);
      const querySnapshot = await getDocs(projectsRef);
      
      let totalBytes = 0;
      let projectCount = 0;

      querySnapshot.docs.forEach(docSnap => {
        if (docSnap.id !== projectId) { 
          const docData = docSnap.data();
          totalBytes += new Blob([JSON.stringify(docData)]).size;
          projectCount++;
        }
      });

      if (!isPremium) { 
        if (!projectId && projectCount >= FREE_PROJECT_LIMIT) {
          throw new Error("STORAGE_LIMIT_EXCEEDED");
        }
      } 
      else if (isPremium) {
        const dataToSaveForSize = {
          ...projectData,
          sheetData: JSON.stringify(projectData.sheetData), 
          updatedAt: new Date() 
        };
        const newProjectBytes = new Blob([JSON.stringify(dataToSaveForSize)]).size;
        const maxLimitBytes = PREMIUM_STORAGE_LIMIT_BYTES;

        if (totalBytes + newProjectBytes > maxLimitBytes) {
          throw new Error("STORAGE_LIMIT_EXCEEDED");
        }
      }
    }

    const dataToSave = {
      ...projectData,
      sheetData: JSON.stringify(projectData.sheetData), 
      updatedAt: serverTimestamp()
    };

    if (projectId) {
      const projectRef = doc(db, `users/${uid}/projects`, projectId);
      await updateDoc(projectRef, dataToSave);
      recordSystemEvent('projectSaves', { feature: 'autosave', writes: 1, projectId });
      return projectId;
    } else {
      const projectsRef = collection(db, `users/${uid}/projects`);
      const newDocRef = await addDoc(projectsRef, { ...dataToSave, createdAt: serverTimestamp() });
      recordSystemEvent('projectsCreated', { feature: 'createProject', writes: 1, projectId: newDocRef.id });
      recordSystemEvent('projectSaves');
      return newDocRef.id;
    }
  } catch (error) {
    if (error.message !== "STORAGE_LIMIT_EXCEEDED") {
      console.error("บันทึกไม่สำเร็จ:", error);
    }
    throw error;
  }
};

// Arranger projects live in their own collection so timeline/mixer data never
// mixes with the sheet projects used by the notation editor.
export const fetchArrangerProjects = async (uid) => {
  if (!uid) return [];
  const projectsRef = collection(db, `users/${uid}/arrangerProjects`);
  const snapshot = await getDocs(query(projectsRef, orderBy('updatedAt', 'desc')));
  recordSystemEvent('projectListLoads', { feature: 'projectList', reads: snapshot.size });
  return snapshot.docs.map((projectDoc) => ({ id: projectDoc.id, ...projectDoc.data() }));
};

export const getArrangerProject = async (uid, projectId) => {
  if (!uid || !projectId) return null;
  const snapshot = await getDoc(doc(db, `users/${uid}/arrangerProjects`, projectId));
  recordSystemEvent('projectOpens', { feature: 'openProject', reads: 1, projectId });
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
};

export const createArrangerProject = async (uid, name = 'โปรเจกต์จัดวงใหม่') => {
  if (!uid) throw new Error('USER_ID_REQUIRED');
  const data = {
    name,
    bpm: 120,
    snapGrid: 1,
    zoomLevel: 100,
    trackLaneHeight: 100,
    masterVolume: 100,
    tracks: [],
    projectType: 'arranger',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const projectRef = await addDoc(collection(db, `users/${uid}/arrangerProjects`), data);
  recordSystemEvent('projectsCreated', { feature: 'createProject', writes: 1, projectId: projectRef.id });
  return { id: projectRef.id, ...data };
};

export const saveArrangerProject = async (uid, projectId, workspace) => {
  if (!uid || !projectId) throw new Error('ARRANGER_PROJECT_REQUIRED');
  const data = {
    ...workspace,
    projectType: 'arranger',
    trackCount: Array.isArray(workspace.tracks) ? workspace.tracks.length : 0,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, `users/${uid}/arrangerProjects`, projectId), data);
  recordSystemEvent('projectSaves', { feature: 'autosave', writes: 1, projectId });
};

export const renameArrangerProject = async (uid, projectId, name) => {
  if (!uid || !projectId) throw new Error('ARRANGER_PROJECT_REQUIRED');
  await updateDoc(doc(db, `users/${uid}/arrangerProjects`, projectId), { name, updatedAt: serverTimestamp() });
};

export const deleteArrangerProject = async (uid, projectId) => {
  if (!uid || !projectId) throw new Error('ARRANGER_PROJECT_REQUIRED');
  await deleteDoc(doc(db, `users/${uid}/arrangerProjects`, projectId));
  recordSystemEvent('projectsDeleted', { feature: 'deleteProject', deletes: 1 });
};
