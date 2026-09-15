import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unexpected application error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5" style={{ fontFamily: 'Prompt, sans-serif' }}>
        <section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-2xl">!</div>
          <h1 className="mt-5 text-xl font-black text-slate-900">ระบบพบข้อผิดพลาดที่ไม่คาดคิด</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">ข้อมูลกู้คืนในเครื่องจะยังคงอยู่ กรุณาโหลดหน้าใหม่ หากยังพบปัญหาให้กลับหน้าหลักแล้วแจ้งผู้ดูแลระบบ</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => window.location.reload()} className="flex-1 rounded-xl bg-sky-500 px-4 py-3 text-xs font-bold text-white hover:bg-sky-600">โหลดหน้าใหม่</button>
            <button type="button" onClick={() => { window.location.href = '/'; }} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200">กลับหน้าหลัก</button>
          </div>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
