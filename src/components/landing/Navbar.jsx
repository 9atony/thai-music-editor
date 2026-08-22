import React from 'react';
import { Globe } from 'lucide-react';
import logo from '../../assets/logo wep.png';

const Navbar = ({ onLoginClick }) => {
  return (
    <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-md z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <img src={logo} alt="TME Logo" className="h-14 w-auto drop-shadow-sm" /> 
          </div>

          {/* Desktop Menu (ปรับให้เรียบง่ายและตรงประเด็น) */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">
              คุณสมบัติ
            </a>
            <a href="#guide" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">
              วิธีใช้งาน
            </a>
            <a href="#contact" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">
              ติดต่อเรา
            </a>
          </div>

          {/* Right Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <button className="text-gray-500 hover:text-gray-800" title="เปลี่ยนภาษา (เร็วๆ นี้)">
              <Globe className="w-5 h-5" />
            </button>
            <button 
              onClick={onLoginClick}
              className="px-5 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition"
            >
              เข้าสู่ระบบ
            </button>
            <button 
              onClick={onLoginClick}
              className="px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 font-medium transition shadow-lg shadow-blue-200"
            >
              เริ่มสร้างฟรี
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;