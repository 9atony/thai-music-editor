import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebase'; 
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const AdminDashboard = ({ userProfile }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // ตรวจสอบสิทธิ์อีกชั้น ป้องกันคนพิมพ์ URL เข้ามาตรงๆ
  const isAdmin = userProfile?.role === 'admin';

  // ฟังก์ชันดึงรายชื่อผู้ใช้ทั้งหมดจาก Firestore
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // เรียงลำดับตามวันที่สมัคร (ใหม่สุดขึ้นก่อน)
      usersList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setUsers(usersList);
    } catch (error) {
      console.error("ดึงข้อมูลผู้ใช้ไม่สำเร็จ:", error);
      alert("เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  // ฟังก์ชันอัปเดตยศ (Role)
  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนยศผู้ใช้นี้เป็น ${newRole}?`)) return;

    setIsUpdating(true);
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        role: newRole
      });
      
      // อัปเดตข้อมูลใน State เพื่อให้หน้าจอเปลี่ยนตามทันทีโดยไม่ต้องรีเฟรช
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      
      alert("✅ เปลี่ยนยศสำเร็จ!");
    } catch (error) {
      console.error("อัปเดตยศไม่สำเร็จ:", error);
      alert("เกิดข้อผิดพลาดในการเปลี่ยนยศ");
    } finally {
      setIsUpdating(false);
    }
  };

  // ถ้ายศไม่ใช่ Admin ให้เตะออกหรือโชว์หน้าห้ามเข้า
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <div className="text-6xl mb-4">⛔</div>
        <h3 className="text-xl font-bold text-slate-800">ไม่มีสิทธิ์เข้าถึง</h3>
        <p>หน้านี้สงวนไว้สำหรับผู้ดูแลระบบเท่านั้น</p>
      </div>
    );
  }

  return (
    <div 
      className="max-w-6xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-12"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      <div className="mb-6 md:mb-8 px-1">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1 md:mb-2">จัดการผู้ใช้งาน 🛡️</h2>
        <p className="text-xs md:text-sm text-slate-500 font-medium">ดูรายชื่อผู้ใช้งานทั้งหมด และกำหนดสิทธิ์การเข้าถึง (User, Premium, Admin)</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="px-6 py-4 font-bold">ชื่อผู้ใช้ / อีเมล</th>
                <th className="px-6 py-4 font-bold">ยศปัจจุบัน (Role)</th>
                <th className="px-6 py-4 font-bold text-center">จัดการสิทธิ์</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="3" className="px-6 py-10 text-center text-slate-500 font-medium">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-10 text-center text-slate-500 font-medium">
                    ไม่พบข้อมูลผู้ใช้งาน
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{user.displayName || user.email?.split('@')[0] || 'ผู้ใช้งาน'}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                      <div className="text-[10px] text-slate-300 mt-1 uppercase">ID: {user.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        user.role === 'admin' ? 'bg-violet-100 text-violet-700 border border-violet-200' :
                        user.role === 'premium' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {user.role || 'user'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <select 
                        value={user.role || 'user'}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={isUpdating}
                        className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5 outline-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="user">Free User</option>
                        <option value="premium">Premium</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;