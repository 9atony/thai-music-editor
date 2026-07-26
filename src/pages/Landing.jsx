import React from 'react';
// นำเข้าโลโก้จากโฟลเดอร์ assets
import logo from '../assets/logo wep.png'; 
import { 
  Globe, Play, CheckCircle2, Cloud, Lock, 
  FileText, Gamepad2, Music, Briefcase, Heart, 
  Monitor, Smartphone , ChevronDown
} from 'lucide-react';

// ⭐ รับ onLoginClick เป็น prop
const Landing = ({ onLoginClick }) => {
  return (
    <div className="min-h-screen font-sans bg-white text-gray-800 overflow-x-hidden">
      
      {/* 1. Navigation Bar */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-2">
              {/* เปลี่ยน h-10 เป็น h-12 หรือ h-14 */}
              <img src={logo} alt="TME Logo" className="h-14 w-auto drop-shadow-sm" /> 
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="group flex items-center text-slate-600 hover:text-blue-600 font-medium transition-colors">
                คุณสมบัติ 
                <ChevronDown className="ml-1.5 w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-transform duration-300 group-hover:rotate-180" />
              </a>
              <a href="#learn" className="group flex items-center text-slate-600 hover:text-blue-600 font-medium transition-colors">
                เรียนรู้ 
                <ChevronDown className="ml-1.5 w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-transform duration-300 group-hover:rotate-180" />
              </a>
              <a href="#community" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">ชุมชน</a>
              <a href="#pricing" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">ราคา</a>
              <a href="#download" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">ดาวน์โหลด</a>
            </div>

            {/* Right Actions */}
            <div className="hidden md:flex items-center space-x-4">
              <button className="text-gray-500 hover:text-gray-800">
                <Globe className="w-5 h-5" />
              </button>
              {/* ⭐ เพิ่ม onClick ให้ปุ่มเข้าสู่ระบบ */}
              <button 
                onClick={onLoginClick}
                className="px-5 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition"
              >
                เข้าสู่ระบบ
              </button>
              {/* ⭐ เพิ่ม onClick ให้ปุ่มเริ่มสร้างฟรี */}
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

      {/* 2. Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
          
          {/* Left Text */}
          <div className="w-full lg:w-1/2 space-y-8 z-10">
            <h1 className="text-5xl lg:text-7xl font-bold leading-tight text-slate-900 tracking-tight">
              สร้างสรรค์<br />
              <span className="text-amber-500 drop-shadow-sm">ดนตรีไทย</span><br />
              ได้ทุกที่ ทุกอุปกรณ์
            </h1>
            <p className="text-lg text-slate-600 max-w-lg leading-relaxed">
              Thai Music Editor คือเครื่องมือสร้าง แก้ไข และจัดการโน้ตดนตรีไทย ออกแบบมาเพื่อการเรียนรู้ การสอน และการสร้างสรรค์ดนตรีไทยยุคใหม่
            </p>
            
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {/* Primary Button */}
              <button 
                onClick={onLoginClick}
                className="group px-8 py-3.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 font-semibold flex items-center gap-2 transition-all duration-300 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:scale-95"
              >
                เริ่มสร้างฟรี 
                <span className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
              </button>
              
              {/* Secondary Button */}
              <button className="group px-7 py-3.5 rounded-full border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-semibold flex items-center gap-3 transition-all duration-300 hover:-translate-y-0.5 active:scale-95">
                <div className="bg-white shadow-sm p-1.5 rounded-full group-hover:scale-110 transition-transform duration-300 text-slate-700">
                  <Play className="w-4 h-4 fill-current" />
                </div> 
                ดูวิธีการทำงาน
              </button>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-x-8 gap-y-4 pt-8 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 border border-slate-100 text-slate-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="text-sm">
                  <p className="font-bold text-slate-700">ใช้งานง่าย</p>
                  <p className="text-slate-500 text-xs">ออกแบบมาเพื่อทุกคน</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 border border-slate-100 text-slate-400">
                  <Cloud className="w-5 h-5" />
                </div>
                <div className="text-sm">
                  <p className="font-bold text-slate-700">ใช้งานได้ทุกที่</p>
                  <p className="text-slate-500 text-xs">บนทุกอุปกรณ์</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 border border-slate-100 text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="text-sm">
                  <p className="font-bold text-slate-700">ปลอดภัย</p>
                  <p className="text-slate-500 text-xs">ข้อมูลของคุณปลอดภัย</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Image/Mockup Placeholder (ยังคงใช้กล่องเทาไปก่อน) */}
          <div className="w-full lg:w-1/2 relative mt-8 lg:mt-0">
            <div className="aspect-video bg-slate-100 rounded-2xl border-8 border-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] flex items-center justify-center relative overflow-hidden transition-transform duration-700 hover:scale-[1.02]">
                <div className="text-slate-400 text-center flex flex-col items-center">
                    <Monitor className="w-16 h-16 mb-3 opacity-40" />
                    <p className="font-medium text-sm">พื้นที่สำหรับใส่รูปภาพ Mockup</p>
                </div>
            </div>
            
            {/* เอฟเฟกต์วงกลมพื้นหลัง (ตกแต่งให้ดูมีมิติ) */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-400/10 rounded-full blur-3xl -z-10"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl -z-10"></div>
          </div>

        </div>
      </section>

      {/* 3. Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-4">
              <span className="text-red-500 text-2xl">•</span>
              <span className="text-blue-500 text-2xl">•</span>
              ครบทุกเครื่องมือสำหรับดนตรีไทย
              <span className="text-blue-500 text-2xl">•</span>
              <span className="text-yellow-500 text-2xl">•</span>
            </h2>
            <p className="text-gray-500">ออกแบบมาเพื่อพัฒนานักเรียน ครู และนักดนตรีไทยโดยเฉพาะ</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 text-left">
            {/* Card 1 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition">
              <div className="w-14 h-14 bg-red-100 text-red-500 rounded-xl flex items-center justify-center mb-6">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">เขียนและแก้ไขโน้ตดนตรีไทย</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">เครื่องมือเขียนโน้ตที่ครบครัน รองรับเครื่องดนตรีไทยทุกชนิด</p>
              <a href="#" className="font-semibold text-gray-800 hover:text-blue-600 flex items-center gap-1 text-sm">ดูเพิ่มเติม <span>→</span></a>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition">
              <div className="w-14 h-14 bg-blue-100 text-blue-500 rounded-xl flex items-center justify-center mb-6">
                <Gamepad2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">เรียนรู้ผ่านเกมเพลง</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">ฝึกทักษะการอ่านโน้ตไทยด้วยเกมที่สนุกและท้าทาย</p>
              <a href="#" className="font-semibold text-gray-800 hover:text-blue-600 flex items-center gap-1 text-sm">ดูเพิ่มเติม <span>→</span></a>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition">
              <div className="w-14 h-14 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center mb-6">
                <Music className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">คลังเพลงและตัวอย่างเพลง</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">ค้นหาและเปิดดูโน้ตเพลงไทยมากมายจากคลังเพลงคุณภาพ</p>
              <a href="#" className="font-semibold text-gray-800 hover:text-blue-600 flex items-center gap-1 text-sm">ดูเพิ่มเติม <span>→</span></a>
            </div>

            {/* Card 4 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition">
              <div className="w-14 h-14 bg-purple-100 text-purple-500 rounded-xl flex items-center justify-center mb-6">
                <Briefcase className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">เครื่องมืออัจฉริยะ</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">แปลงไฟล์ ส่งออก PDF, MIDI, MP3 และเครื่องมืออื่นๆ อีกมากมาย</p>
              <a href="#" className="font-semibold text-gray-800 hover:text-blue-600 flex items-center gap-1 text-sm">ดูเพิ่มเติม <span>→</span></a>
            </div>

            {/* Card 5 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition">
              <div className="w-14 h-14 bg-green-100 text-green-500 rounded-xl flex items-center justify-center mb-6">
                <Heart className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">บันทึกและจัดการโปรเจกต์</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">จัดการผลงานของคุณได้อย่างง่ายดาย ปลอดภัยบนระบบคลาวด์</p>
              <a href="#" className="font-semibold text-gray-800 hover:text-blue-600 flex items-center gap-1 text-sm">ดูเพิ่มเติม <span>→</span></a>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Cross-Platform Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="w-full lg:w-1/3">
              <h2 className="text-3xl font-bold mb-4">ใช้งานได้ทุกอุปกรณ์</h2>
              <p className="text-gray-500 mb-8">รองรับ Windows, macOS, Android และ iOS</p>
              <div className="grid grid-cols-2 gap-6">
                 <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl">
                   <div className="w-12 h-12 bg-blue-500 text-white rounded-lg flex items-center justify-center mb-2">W</div>
                   <span className="font-medium text-sm">Windows</span>
                 </div>
                 <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl">
                   <div className="w-12 h-12 bg-gray-800 text-white rounded-lg flex items-center justify-center mb-2">M</div>
                   <span className="font-medium text-sm">macOS</span>
                 </div>
                 <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl">
                   <div className="w-12 h-12 bg-green-500 text-white rounded-lg flex items-center justify-center mb-2">A</div>
                   <span className="font-medium text-sm">Android</span>
                 </div>
                 <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl">
                   <div className="w-12 h-12 bg-black text-white rounded-lg flex items-center justify-center mb-2">i</div>
                   <span className="font-medium text-sm">iOS</span>
                 </div>
              </div>
            </div>
            
            <div className="w-full lg:w-2/3">
               <div className="aspect-[16/9] bg-gray-100 rounded-3xl relative overflow-hidden flex items-center justify-center shadow-xl border-4 border-gray-200">
                    {/* ใส่รูปภาพ Mockup อุปกรณ์ 3 หน้าจอตรงนี้ */}
                    <div className="text-gray-400 text-center flex gap-4">
                        <Monitor className="w-20 h-20 opacity-50" />
                        <Smartphone className="w-12 h-12 opacity-50 mt-8" />
                    </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Bottom CTA Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gray-50 rounded-3xl p-8 lg:p-12 flex flex-col lg:flex-row gap-12 items-center">
          <div className="w-full lg:w-1/3">
            <h2 className="text-2xl font-bold mb-4">พร้อมเริ่มสร้างสรรค์ดนตรีไทยหรือยัง?</h2>
            <p className="text-gray-500 mb-8 text-sm">เข้าร่วมกับครู นักเรียน และนักดนตรีไทยกว่า 1,000+ คน ที่ใช้งาน Thai Music Editor</p>
            {/* ⭐ เพิ่ม onClick ให้ปุ่มเริ่มสร้างฟรีด้านล่าง */}
            <button 
              onClick={onLoginClick}
              className="px-8 py-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 font-medium flex items-center gap-2 transition w-fit"
            >
              เริ่มสร้างฟรีเลย <span>→</span>
            </button>
          </div>
          
          <div className="w-full lg:w-2/3 grid grid-cols-1 md:grid-cols-3 gap-8 border-t lg:border-t-0 lg:border-l border-gray-200 lg:pl-12 pt-8 lg:pt-0">
            <div className="flex gap-4">
               <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex-shrink-0 flex items-center justify-center">
                 <Briefcase className="w-6 h-6" />
               </div>
               <div>
                 <h4 className="font-bold text-gray-800 mb-1">สำหรับครูและนักเรียน</h4>
                 <p className="text-xs text-gray-500">เครื่องมือที่ช่วยให้การเรียนรู้และการสอนดนตรีไทยง่ายขึ้น</p>
               </div>
            </div>
            <div className="flex gap-4">
               <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex-shrink-0 flex items-center justify-center">
                 <Globe className="w-6 h-6" />
               </div>
               <div>
                 <h4 className="font-bold text-gray-800 mb-1">ชุมชนที่เติบโต</h4>
                 <p className="text-xs text-gray-500">แชร์ผลงาน แลกเปลี่ยนความรู้ และแรงบันดาลใจกับเพื่อนนักดนตรี</p>
               </div>
            </div>
            <div className="flex gap-4">
               <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex-shrink-0 flex items-center justify-center">
                 <Lock className="w-6 h-6" />
               </div>
               <div>
                 <h4 className="font-bold text-gray-800 mb-1">ปลอดภัยและเชื่อถือได้</h4>
                 <p className="text-xs text-gray-500">ระบบคลาวด์ที่ปลอดภัยและสำรองข้อมูลอัตโนมัติ</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="border-t border-gray-100 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-16">
            <div className="col-span-2 md:col-span-1">
              <img src={logo} alt="TME Logo" className="h-12 w-auto mb-4" />
              <p className="text-xs text-gray-500">เครื่องมือสร้าง แก้ไข และจัดการโน้ตดนตรีไทย เพื่อการเรียนรู้ การสอน และการสร้างสรรค์ดนตรีไทยยุคใหม่</p>
            </div>
            
            <div>
              <h4 className="font-bold mb-4 text-gray-800">ผลิตภัณฑ์</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-blue-600">คุณสมบัติ</a></li>
                <li><a href="#" className="hover:text-blue-600">ดาวน์โหลด</a></li>
                <li><a href="#" className="hover:text-blue-600">ราคา</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4 text-gray-800">เรียนรู้</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-blue-600">คู่มือการใช้งาน</a></li>
                <li><a href="#" className="hover:text-blue-600">วิดีโอสอน</a></li>
                <li><a href="#" className="hover:text-blue-600">บทความ</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4 text-gray-800">ชุมชน</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-blue-600">ฟอรัม</a></li>
                <li><a href="#" className="hover:text-blue-600">ผลงานจากผู้ใช้</a></li>
                <li><a href="#" className="hover:text-blue-600">กิจกรรม</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4 text-gray-800">บริษัท</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-blue-600">เกี่ยวกับเรา</a></li>
                <li><a href="#" className="hover:text-blue-600">ติดต่อเรา</a></li>
                <li><a href="#" className="hover:text-blue-600">นโยบายความเป็นส่วนตัว</a></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center border-t border-gray-100 pt-8">
            <p className="text-xs text-gray-400 mb-4 md:mb-0">© 2026 Rattanachai Sakchai. All rights reserved.</p>
            
            <div className="flex gap-4 items-center">
              <span className="text-sm font-semibold text-gray-800 mr-2">ติดตามเรา</span>
              {/* Facebook Icon */}
              <a href="#" className="text-gray-400 hover:text-blue-600 transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              {/* YouTube Icon */}
              <a href="#" className="text-gray-400 hover:text-red-600 transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              {/* Twitter (X) Icon */}
              <a href="#" className="text-gray-400 hover:text-blue-400 transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
      
    </div>
  );
};

export default Landing;