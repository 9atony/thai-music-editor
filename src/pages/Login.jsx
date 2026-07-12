import React, { useState } from 'react';
// นำเข้าไฟล์รูปภาพโลโก้
import logoImg from '../assets/logo wep.png';
// ⭐ ต้องมีบรรทัดนี้เพิ่มเข้าไปครับ เพื่อดึงคำสั่งล็อกอินจาก Firebase
import { signInWithEmailAndPassword } from 'firebase/auth'; 
import { auth } from '../utils/firebase';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

 const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      // ⭐ แก้เป็นบรรทัดนี้ครับ:
      setError('Error: ' + err.message); 
      setIsLoading(false);
    }
  };

  

  const handleGoogleLogin = async () => {
    /* ⭐ โค้ดสำหรับ Google Login
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google');
    }
    */
    alert("ระบบ Google Login จะพร้อมใช้งานเมื่อเชื่อมต่อ Firebase ครับ");
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-slate-50 overflow-hidden font-sans text-slate-800">
      
      {/* ⭐ พื้นหลัง (ภาพระนาดจางๆ) คุณหนุ่มสามารถเอาภาพระนาดมาใส่ในโฟลเดอร์ public แล้วเปลี่ยน url ได้เลยครับ */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url('/path-to-your-ranat-bg.png')`, // <-- เปลี่ยนตรงนี้
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      
      {/* Decorative Grid/Lines (จำลองลวดลายพื้นหลัง) */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      {/* สวิตช์ Light/Dark Mode (ตกแต่งให้เหมือนในรูป) */}
      <div className="absolute top-8 right-8 z-20 flex items-center bg-white/80 backdrop-blur px-1 py-1 rounded-full shadow-sm border border-slate-100">
        <button className="flex items-center gap-2 px-4 py-1.5 bg-white rounded-full shadow-sm text-sm font-semibold">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          Light
        </button>
        <button className="flex items-center gap-2 px-4 py-1.5 text-slate-400 hover:text-slate-600 rounded-full text-sm font-semibold transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
          Dark
        </button>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-16">
        
       {/* คอลัมน์ฝั่งซ้าย (ต้องใช้ flex-col และ items-center เพื่อคุมให้ทุกอย่างอยู่กลาง) */}
<div className="flex-1 flex flex-col items-center text-center">
  
  {/* โลโก้ */}
  <img 
    src={logoImg} 
    alt="Thai Music Editor Logo" 
    className="w-full max-w-[450px] mb-10 drop-shadow-sm" 
  />

  {/* ข้อความ */}
  <p className="text-slate-800 font-bold leading-relaxed max-w-md text-lg">
    เครื่องมือสร้างสรรค์ดนตรีไทยยุคใหม่ <br/>
    เพื่อการเรียนรู้ แก้ไข และถ่ายทอดศิลปะทางดนตรีไทย
  </p>
  
</div>

        {/* ฝั่งขวา: Glassmorphism Login Card */}
        <div className="w-full max-w-md relative">
          {/* แถบสีด้านข้าง (กิมมิคเล็กๆ จากในรูป) */}
          <div className="absolute -right-2 top-12 bottom-12 w-1 flex flex-col justify-between py-12 z-0">
            <div className="w-1 h-6 bg-[#EF4444] rounded-r-md"></div>
            <div className="w-1 h-6 bg-[#3B82F6] rounded-r-md"></div>
            <div className="w-1 h-6 bg-[#F59E0B] rounded-r-md"></div>
          </div>

          <div className="relative z-10 bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-3xl p-10 w-full">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h2>
            <p className="text-slate-500 text-sm mb-8">Sign in to continue to Thai Music Editor</p>

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  </div>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-11 pr-11 py-2.5 rounded-xl border border-slate-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm font-medium tracking-wider placeholder:tracking-normal placeholder:text-slate-400"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900" defaultChecked />
                  <span className="text-sm text-slate-600 font-medium">Remember me</span>
                </label>
                <a href="#" className="text-sm text-[#3B82F6] font-medium hover:underline">Forgot password?</a>
              </div>

              {error && <div className="text-red-500 text-sm font-medium text-center">{error}</div>}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-[#111827] hover:bg-[#1f2937] text-white py-3 rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-70 group"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
                {!isLoading && (
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                )}
              </button>
            </form>

            <div className="flex items-center gap-4 my-6 opacity-60">
              <div className="flex-1 h-px bg-slate-300"></div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">or continue with</span>
              <div className="flex-1 h-px bg-slate-300"></div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button onClick={handleGoogleLogin} className="flex items-center justify-center py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors bg-white/50">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              </button>
              <button className="flex items-center justify-center py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors bg-white/50">
                <svg className="w-5 h-5" viewBox="0 0 21 21"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#00a4ef" d="M11 1h9v9h-9z"/><path fill="#7fba00" d="M1 11h9v9H1z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>
              </button>
              <button className="flex items-center justify-center py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors bg-white/50">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.34-.84 3.79-.69 1.48.16 2.65.74 3.41 1.8-3.16 1.83-2.65 6.07.41 7.23-.74 1.81-1.75 3.8-2.69 3.83M12.03 7.26c-.1-1.58.6-3.05 1.7-4.1.99-1.06 2.45-1.66 4.02-1.57.17 1.63-.58 3.19-1.68 4.2-1.01 1.04-2.58 1.64-4.04 1.47"/></svg>
              </button>
            </div>

            <p className="text-center text-sm font-medium text-slate-500 mt-8">
              Don't have an account? <a href="#" className="text-[#3B82F6] hover:underline">Create account</a>
            </p>

          </div>
        </div>
      </div>

      {/* Footer สีสันด้านล่าง */}
      <div className="absolute bottom-0 left-0 right-0 px-8 py-6 flex items-center justify-between text-xs font-semibold text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 rounded-full bg-[#EF4444]"></div>
          <div className="w-6 h-1 rounded-full bg-[#3B82F6]"></div>
          <div className="w-6 h-1 rounded-full bg-[#F59E0B]"></div>
        </div>
        <div className="flex items-center gap-3">
          <span>THAI MUSIC EDITOR</span>
          <span className="w-1 h-1 rounded-full bg-[#EF4444]"></span>
          <span>Version 1.0.0</span>
          <span className="w-1 h-1 rounded-full bg-[#3B82F6]"></span>
          <span>© 2026 Rattanachai Sakchai</span>
        </div>
      </div>

    </div>
  );
};

export default Login;