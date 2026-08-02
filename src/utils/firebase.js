import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { 
  getFirestore, collection, query, orderBy, limit, getDocs, 
  addDoc, doc, updateDoc, serverTimestamp 
} from 'firebase/firestore'; 
import { getStorage } from "firebase/storage";

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
const analytics = getAnalytics(app);

// 3. Export Auth และ DB (เอาไว้ใช้ที่อื่น)
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 4. ฟังก์ชันต่างๆ
export const fetchRecentProjects = async (uid) => {
  try {
    const projectsRef = collection(db, `users/${uid}/projects`);
    const q = query(projectsRef, orderBy('updatedAt', 'desc'), limit(5));
    const querySnapshot = await getDocs(q);
    
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

// ⭐ [แก้ไขแล้ว] ฟังก์ชันสำหรับดึงข้อมูลทุกโปรเจกต์ของ User สำหรับ Backup
export const fetchAllProjects = async (uid) => {
  try {
    const projectsRef = collection(db, `users/${uid}/projects`);
    // ✅ เอา orderBy ออก สั่ง getDocs ดึงข้อมูลจาก collection ตรงๆ เลยเพื่อกวาดมาทั้งหมด
    const querySnapshot = await getDocs(projectsRef);
    
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

export const saveProjectToDB = async (uid, projectId, projectData) => {
  try {
    const dataToSave = {
      ...projectData,
      sheetData: JSON.stringify(projectData.sheetData), 
      updatedAt: serverTimestamp()
    };

    if (projectId) {
      const projectRef = doc(db, `users/${uid}/projects`, projectId);
      await updateDoc(projectRef, dataToSave);
      return projectId;
    } else {
      const projectsRef = collection(db, `users/${uid}/projects`);
      const newDocRef = await addDoc(projectsRef, { ...dataToSave, createdAt: serverTimestamp() });
      return newDocRef.id;
    }
  } catch (error) {
    console.error("บันทึกไม่สำเร็จ:", error);
    throw error;
  }
};