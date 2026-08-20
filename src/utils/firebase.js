import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// 1. [เพิ่ม] นำเข้า createUserWithEmailAndPassword สำหรับการสมัครสมาชิก
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { 
  getFirestore, collection, query, orderBy, limit, getDocs, 
  addDoc, doc, updateDoc, serverTimestamp, 
  setDoc, getDoc // 2. [เพิ่ม] นำเข้า setDoc และ getDoc เพื่อจัดการแฟ้มประวัติผู้ใช้
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

// ==========================================
// 🌟 [ส่วนที่เพิ่มใหม่] ระบบสมัครสมาชิกและจัดการยศ
// ==========================================

// ฟังก์ชันสมัครสมาชิก พร้อมตั้งยศเริ่มต้นเป็น "user"
export const registerUser = async (email, password, displayName = "") => {
  try {
    // 1. สร้างบัญชีใน Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. สร้างแฟ้มประวัติใน Firestore (Collection: users, Document: UID)
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: displayName,
      role: "user", // <-- กำหนดยศเริ่มต้นที่นี่
      createdAt: serverTimestamp()
    });

    return user;
  } catch (error) {
    console.error("สมัครสมาชิกไม่สำเร็จ:", error);
    throw error;
  }
};

// ฟังก์ชันสำหรับเช็กว่าผู้ใช้คนนี้มียศอะไร (ใช้ตอนหน้าเว็บโหลดเสร็จ)
export const getUserProfile = async (uid) => {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data(); // จะคืนค่ากลับมาเป็น { role: "user", email: ... }
    } else {
      console.log("ไม่พบข้อมูลผู้ใช้");
      return { role: "user" }; // ป้องกัน Error ให้มองเป็นผู้ใช้ทั่วไปไว้ก่อน
    }
  } catch (error) {
    console.error("ดึงข้อมูลประวัติไม่สำเร็จ:", error);
    return null;
  }
};

// ==========================================
// ส่วนเดิมของคุณ
// ==========================================

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

export const fetchAllProjects = async (uid) => {
  try {
    const projectsRef = collection(db, `users/${uid}/projects`);
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
    // ⭐ 1. ดึงข้อมูล Profile เพื่อเช็กยศ
    const userProfile = await getUserProfile(uid);
    const role = userProfile?.role || "user"; // ถ้าไม่มียศให้ถือว่าเป็นสายฟรี
    const isAdmin = role === "admin";
    const isPremium = role === "premium";

    // ⭐ 2. ด่านตรวจโควตา (ทำงานเฉพาะคนที่ ไม่ใช่ Admin)
    if (!isAdmin) {
      const projectsRef = collection(db, `users/${uid}/projects`);
      const querySnapshot = await getDocs(projectsRef);
      
      let totalBytes = 0;
      let projectCount = 0;

      querySnapshot.docs.forEach(docSnap => {
        if (docSnap.id !== projectId) { // ไม่นับไฟล์เดิมที่กำลังจะเซฟทับ
          const docData = docSnap.data();
          totalBytes += new Blob([JSON.stringify(docData)]).size;
          projectCount++;
        }
      });

      // 🚦 กฎข้อที่ 1: สายฟรี (User) สร้างได้สูงสุด 10 โปรเจกต์
      if (role === "user") {
        // เช็กเฉพาะตอน "สร้างไฟล์ใหม่" (ถ้าไม่มี projectId แปลว่าสร้างใหม่)
        if (!projectId && projectCount >= 10) {
          throw new Error("STORAGE_LIMIT_EXCEEDED");
        }
      } 
      // 🚦 กฎข้อที่ 2: สายเปย์ (Premium) สร้างกี่ไฟล์ก็ได้ แต่รวมกันห้ามเกิน 5 MB
      else if (isPremium) {
        const dataToSaveForSize = {
          ...projectData,
          sheetData: JSON.stringify(projectData.sheetData), 
          updatedAt: new Date() 
        };
        const newProjectBytes = new Blob([JSON.stringify(dataToSaveForSize)]).size;
        const maxLimitBytes = 5 * 1024 * 1024; // ลิมิต 5 MB

        if (totalBytes + newProjectBytes > maxLimitBytes) {
          throw new Error("STORAGE_LIMIT_EXCEEDED");
        }
      }
    }

    // ⭐ 3. บันทึกข้อมูลลงฐานข้อมูลตามปกติ
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
    if (error.message !== "STORAGE_LIMIT_EXCEEDED") {
      console.error("บันทึกไม่สำเร็จ:", error);
    }
    throw error;
  }
};