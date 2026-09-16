import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

const useDevice = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const isNativeApp = Capacitor.isNativePlatform();
      // เช็กความกว้างหน้าจอ ถ้าต่ำกว่า 768px (ขนาดมาตรฐานมือถือ/แท็บเล็ตแนวตั้ง) ให้มองว่าเป็น Mobile
      // แอป Android ใช้ Mobile Editor เสมอ แม้ WebView จะรายงาน viewport แบบเดสก์ท็อป
      setIsMobile(isNativeApp || window.innerWidth < 768);
    };

    // เช็กครั้งแรกทันทีที่เปิดเว็บ
    handleResize();

    // ดักจับตลอดเวลา เผื่อผู้ใช้ย่อ/ขยายหน้าต่างเบราว์เซอร์บนคอมพิวเตอร์
    window.addEventListener('resize', handleResize);
    
    // ทำความสะอาด Event เมื่อปิดคอมโพเนนต์
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isMobile };
};

export default useDevice;
