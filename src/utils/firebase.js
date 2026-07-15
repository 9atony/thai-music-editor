import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { 
  getFirestore, collection, query, orderBy, limit, getDocs, 
  addDoc, doc, updateDoc, serverTimestamp 
} from 'firebase/firestore'; // ⭐ รวมการ import ไว้ที่เดียว

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

// 4. ฟังก์ชันต่างๆ (เขียนไว้หลังประกาศ db และ auth แล้ว จึงใช้งานได้ปกติ)
// ใน src/utils/firebase.js
export const fetchRecentProjects = async (uid) => {
  try {
    const projectsRef = collection(db, `users/${uid}/projects`);
    const q = query(projectsRef, orderBy('updatedAt', 'desc'), limit(5));
    const querySnapshot = await getDocs(q);
    
    // ⭐ ปรับตรงนี้ครับ
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // แปลงกลับเป็น Array ถ้ามี sheetData
        sheetData: data.sheetData ? JSON.parse(data.sheetData) : []
      };
    });
  } catch (error) {
    console.error("ดึงข้อมูลไม่สำเร็จ:", error);
    return [];
  }
};

export const loginUser = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logoutUser = () => signOut(auth);

export const saveProjectToDB = async (uid, projectId, projectData) => {
  try {
    // ⭐ แปลงข้อมูลที่มี Array ซ้อนกันให้เป็น String ก่อนเซฟ
    const dataToSave = {
      ...projectData,
      sheetData: JSON.stringify(projectData.sheetData), // แปลงเป็น JSON String
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

