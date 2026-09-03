import React from 'react';
import logo from '../../assets/logo wep.png';

const Footer = () => {
  return (
    <footer id="contact" className="border-t border-gray-100 pt-16 pb-8 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
          
          {/* Logo & Description */}
          <div className="col-span-1 md:col-span-2 pr-0 md:pr-8">
            <img src={logo} alt="TME Logo" className="h-12 w-auto mb-4" />
            <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
              เครื่องมือสร้าง แก้ไข และจัดการโน้ตดนตรีไทย เพื่อการเรียนรู้ การสอน และการสร้างสรรค์ดนตรีไทยยุคใหม่ ใช้งานง่ายได้ทุกที่
            </p>
          </div>
          
          {/* Menu 1 */}
          <div>
            <h4 className="font-bold mb-4 text-gray-800">ระบบของเรา</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li><a href="#features" className="hover:text-blue-600 transition-colors">คุณสมบัติเด่น</a></li>
              <li><a href="#guide" className="hover:text-blue-600 transition-colors">วิธีใช้งานเบื้องต้น</a></li>
              <li><a href="/about" className="hover:text-blue-600 transition-colors">เกี่ยวกับ</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">อัปเดตล่าสุด</a></li>
            </ul>
          </div>
          
          {/* Menu 2 */}
          <div>
            <h4 className="font-bold mb-4 text-gray-800">ติดต่อและคอมมูนิตี้</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li>
                <a href="https://www.facebook.com/share/g/1D1FvNehDM/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                  เข้าร่วมกลุ่ม Facebook
                </a>
              </li>
              <li>
                <a href="https://www.facebook.com/ratn.chay.sakdi.cay/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                  ติดต่อผู้พัฒนา (Facebook)
                </a>
              </li>
              <li>
                <a href="mailto:hunmnum@gmail.com" className="hover:text-blue-600 transition-colors">
                  ติดต่อผ่านอีเมล
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center border-t border-gray-100 pt-8">
          <p className="text-xs text-gray-400 mb-4 md:mb-0">
            © {new Date().getFullYear()} Rattanachai Sakchai. All rights reserved.
          </p>
          
          <div className="flex gap-4 items-center">
            <span className="text-sm font-semibold text-gray-800 mr-2">ติดตามเรา</span>
            {/* Facebook Group Icon */}
            <a href="https://www.facebook.com/share/g/1D1FvNehDM/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition transform hover:scale-110" title="เข้าร่วมกลุ่ม Facebook">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
            </a>
            {/* YouTube Icon */}
            <a href="https://www.youtube.com/@ThaiMusicEditor" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-red-600 transition transform hover:scale-110" title="ช่อง YouTube ของ Thai Music Editor">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
