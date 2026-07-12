// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";       // ⭐ เพิ่มบรรทัดนี้
import { getFirestore } from "firebase/firestore"; // ⭐ เพิ่มบรรทัดนี้

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBMW-AKd2p41qin2KmHi7skooNsKI2v_kI",
  authDomain: "thai-music-editor.firebaseapp.com",
  projectId: "thai-music-editor",
  storageBucket: "thai-music-editor.firebasestorage.app",
  messagingSenderId: "481298501401",
  appId: "1:481298501401:web:1ff4986d75e31816a0ff88",
  measurementId: "G-V1WXV1KMN0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// ⭐ ส่งออก (export) auth และ db เพื่อให้ไฟล์อื่นใช้งานได้
export const auth = getAuth(app);
export const db = getFirestore(app);