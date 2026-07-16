import React, { useState } from 'react';
import logoImg from '../assets/logo wep.png';
// ⭐ 1. นำเข้ารูปภาพพื้นหลังใหม่จากโฟลเดอร์ assets
import bgImg from '../assets/bgtme.png'; 
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile 
} from 'firebase/auth';

import { auth } from '../utils/firebase';

const Login = ({ onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); 
  const [rememberMe, setRememberMe] = useState(true); 
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (isSignUp && password !== confirmPassword) {
      setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      setIsLoading(false);
      return;
    }

    try {
      const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistenceType);

      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        const autoAvatarURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&rounded=true&bold=true`;
        
        await updateProfile(userCredential.user, {
          displayName: displayName,
          photoURL: autoAvatarURL
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ');
      } else if (err.code === 'auth/weak-password') {
        setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else {
        setError('เกิดข้อผิดพลาด: ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    
    try {
      await signInWithPopup(auth, provider);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      console.error(err);
      setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-slate-50 overflow-hidden antialiased text-slate-800">
      
      {/* ⭐ 1. ปรับ Animation ให้เลื่อนแค่แกน Y (เพราะเราหมุนตัวกรอบแทนแล้ว) */}
      <style>
        {`
          @keyframes slide-tilted {
            0% { background-position: 0 0; }
            /* สไลด์รูปขึ้นไป 500px (เท่ากับขนาดรูป 1 บล็อก) เพื่อให้รอยต่อเนียนพอดี */
            100% { background-position: 0 -500px; } 
          }
          .animate-bg-slide {
            /* ปรับความเร็วตรงนี้ได้เลย (25s กำลังลื่นๆ ไม่ปวดตา) */
            animation: slide-tilted 25s linear infinite; 
          }
        `}
      </style>

      {/* ⭐ 2. เลเยอร์รูปภาพ: ขยายกว้าง/สูง 200% กันขอบแหว่ง แล้วจับหมุน (rotate) */}
      <div 
        className="absolute z-0 opacity-[0.06] pointer-events-none animate-bg-slide"
        style={{
          width: '200vw',
          height: '200vh',
          top: '-50vh',
          left: '-50vw',
          transform: 'rotate(-45deg)', /* องศาความเฉียง: เปลี่ยนเป็น 45deg ได้ถ้าอยากให้เฉียงไปอีกฝั่ง */
          backgroundImage: `url(${bgImg})`, 
          backgroundSize: '800px', 
          backgroundRepeat: 'repeat', 
        }}
      />
      
      {/* ⭐ 3. เลเยอร์เส้นตาราง: ยังคงเหมือนเดิม ไม่ได้ถูกหมุนตาม */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-16">
        
        <div className="flex-1 flex flex-col items-center text-center">
          <img 
            src={logoImg} 
            alt="Thai Music Editor Logo" 
            className="w-full max-w-[450px] mb-10 drop-shadow-sm" 
          />
          <p className="text-slate-800 font-bold leading-relaxed max-w-md text-lg">
            เครื่องมือสร้างสรรค์ดนตรีไทยยุคใหม่ <br/>
            เพื่อการเรียนรู้ แก้ไข และถ่ายทอดศิลปะทางดนตรีไทย
          </p>
        </div>

        <div className="w-full max-w-md relative">
          
          <div className="absolute -right-2 top-12 bottom-12 w-1 flex flex-col justify-between py-12 z-0">
            <div className="w-1 h-6 bg-[#EF4444] rounded-r-md"></div>
            <div className="w-1 h-6 bg-[#3B82F6] rounded-r-md"></div>
            <div className="w-1 h-6 bg-[#F59E0B] rounded-r-md"></div>
          </div>

          <div className="relative z-10 bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-3xl p-10 w-full">
            <h2 className="text-3xl font-bold text-slate-900 mb-2 text-center">
                {isSignUp ? 'สร้างบัญชีผู้ใช้' : 'ยินดีต้อนรับกลับมา'}
            </h2>
                <p className="text-slate-500 text-sm mb-8 font-medium text-center">
                {isSignUp ? 'สมัครสมาชิกเพื่อเริ่มต้นใช้งาน Thai Music Editor' : 'เข้าสู่ระบบเพื่อใช้งาน Thai Music Editor'}
              </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              {isSignUp && (
                <div className="animate-fadeIn">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">ชื่อผู้ใช้</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    </div>
                    <input 
                      type="text" 
                      required={isSignUp}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="ชื่อที่ต้องการแสดง"
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">อีเมล</label>
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
                <label className="block text-sm font-bold text-slate-700 mb-1.5">รหัสผ่าน</label>
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

              {isSignUp && (
                <div className="animate-fadeIn">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">ยืนยันรหัสผ่าน</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                    </div>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-11 pr-11 py-2.5 rounded-xl border border-slate-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm font-medium tracking-wider placeholder:tracking-normal placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}

              {!isSignUp && (
                <div className="flex items-center justify-between mt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-slate-600">จดจำการเข้าสู่ระบบ</span>
                  </label>
                </div>
              )}

              {error && <div className="text-red-500 text-sm font-bold text-center bg-red-50 py-2 rounded-lg">{error}</div>}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-[#111827] hover:bg-[#1f2937] text-white py-3 rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-70 group"
              >
                {isLoading ? (isSignUp ? 'กำลังสร้างบัญชี...' : 'กำลังเข้าสู่ระบบ...') : (isSignUp ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ')}
                {!isLoading && (
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                )}
              </button>
            </form>

            <div className="flex items-center gap-4 my-6 opacity-60">
              <div className="flex-1 h-px bg-slate-300"></div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">หรือใช้งานด้วย</span>
              <div className="flex-1 h-px bg-slate-300"></div>
            </div>

            <button 
              onClick={handleGoogleLogin} 
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors bg-white/50 text-sm font-bold text-slate-600"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>เข้าสู่ระบบด้วย Google</span>
            </button>

            <p className="text-center text-sm font-bold text-slate-500 mt-8">
              {isSignUp ? "มีบัญชีอยู่แล้วใช่ไหม?" : "ยังไม่มีบัญชีใช่ไหม?"} {' '}
              <button 
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(''); 
                  setPassword('');
                  setConfirmPassword('');
                  setDisplayName(''); 
                }} 
                className="text-[#3B82F6] hover:underline font-bold"
              >
                {isSignUp ? 'เข้าสู่ระบบ' : 'สร้างบัญชีใหม่'}
              </button>
            </p>

          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-8 py-6 flex items-center justify-between text-xs font-bold text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 rounded-full bg-[#EF4444]"></div>
          <div className="w-6 h-1 rounded-full bg-[#3B82F6]"></div>
          <div className="w-6 h-1 rounded-full bg-[#F59E0B]"></div>
        </div>
        <div className="flex items-center gap-3">
          <span>THAI MUSIC EDITOR</span>
          <span className="w-1 h-1 rounded-full bg-[#EF4444]"></span>
          <span>เวอร์ชัน 1.0.0</span>
          <span className="w-1 h-1 rounded-full bg-[#3B82F6]"></span>
          <span>© 2026 Rattanachai Sakchai</span>
        </div>
      </div>
    </div>
  );
};

export default Login;