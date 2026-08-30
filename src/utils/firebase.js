import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { 
  getFirestore, collection, query, orderBy, limit, getDocs, 
  addDoc, doc, updateDoc, serverTimestamp, 
  setDoc, getDoc, Timestamp 
} from 'firebase/firestore'; 
import { getStorage } from "firebase/storage";

// 1. Firebase Config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// 2. Initialize
const app = initializeApp(firebaseConfig);
getAnalytics(app);

// 3. Export Auth และ DB
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

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
        if (!projectId && projectCount >= 10) {
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
        const maxLimitBytes = 5 * 1024 * 1024; 

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
