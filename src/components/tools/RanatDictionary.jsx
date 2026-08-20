import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../utils/firebase'; 

// ⭐ ฟังก์ชันกำจัด HTML Tags และช่องว่างส่วนเกินออกจากข้อความ
const stripHtml = (value = '') => String(value || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/ig, ' ').trim();

export default function RanatDictionary() {
  const [songName, setSongName] = useState("");
  const [targetSkeleton, setTargetSkeleton] = useState(""); 
  const [groupedPhrases, setGroupedPhrases] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const [savedDicts, setSavedDicts] = useState([]);
  const [activeView, setActiveView] = useState('preview'); 
  const [viewingDict, setViewingDict] = useState(null); 
  
  // ⭐ State สำหรับเปิด/ปิด Sidebar บนมือถือ
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fetchDictionaries = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "ranat_dictionary"));
      const dicts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      dicts.sort((a, b) => b.timestamp - a.timestamp);
      setSavedDicts(dicts);
    } catch (error) {
      console.error("Error fetching dictionaries: ", error);
    }
  };

  useEffect(() => {
    fetchDictionaries();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation(); 
    if(window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบทางระนาดชุดนี้ออกจากฐานข้อมูล?")) {
      try {
        await deleteDoc(doc(db, "ranat_dictionary", id));
        fetchDictionaries();
        if (viewingDict && viewingDict.id === id) {
          setViewingDict(null); 
        }
      } catch (error) {
        console.error("Error deleting document: ", error);
        alert("เกิดข้อผิดพลาดในการลบข้อมูล");
      }
    }
  };

  const handleSkeletonChange = (e) => {
    const val = e.target.value;
    const matched = val.replace(/\s+/g, '').match(/(ด|ร|ม|ฟ|ซ|ล|ท)[ํฺ]?|-/g);
    
    if (matched) {
      setTargetSkeleton(matched.join(' '));
    } else if (val === "") {
      setTargetSkeleton("");
    } else {
      setTargetSkeleton(val);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        const { sheetData, sectionLabels, songName } = json;
        
        let currentLevel = "ทั่วไป"; 
        const groups = {};

        if (sheetData) {
          for (let i = 0; i < sheetData.length; i++) {
            if (sectionLabels && sectionLabels[i] && sectionLabels[i][0]) {
              currentLevel = stripHtml(sectionLabels[i][0].text) || "ทั่วไป"; 
            }
            if (!groups[currentLevel]) {
              groups[currentLevel] = [];
            }
            const notes = sheetData[i].flat().join(" ");
            groups[currentLevel].push(notes);
          }
        }
        
        const parsedGroups = Object.keys(groups).map(level => ({
          level: level,
          phrases: groups[level]
        }));
          
        setGroupedPhrases(parsedGroups);
        setSongName(stripHtml(songName) || "ไม่ทราบชื่อเพลง");
        switchView('preview');
        setIsSidebarOpen(false); // ปิดเมนูบนมือถือเมื่ออัปโหลดเสร็จ
      } catch (err) {
        alert("รูปแบบไฟล์ไม่ถูกต้อง หรือไม่พบข้อมูล");
      }
    };
    reader.readAsText(file);
    event.target.value = null; 
  };

  const saveToDictionary = async () => {
    if (!targetSkeleton.trim()) {
      alert("กรุณาระบุ 'โครงสร้างทำนองหลัก' ก่อนบันทึกครับ");
      return;
    }
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, "ranat_dictionary"), {
        skeleton: targetSkeleton.trim(),
        sourceFile: songName,
        variations: groupedPhrases,
        timestamp: new Date()
      });
      
      alert("✅ บันทึกทางระนาดลงพจนานุกรมสำเร็จ!");
      setGroupedPhrases([]);
      setTargetSkeleton("");
      setSongName("");
      
      fetchDictionaries();
      switchView('database');
      setIsSidebarOpen(false); // ปิดเมนูเมื่อบันทึกเสร็จ
    } catch (error) {
      console.error("Error saving document: ", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
    setIsSaving(false);
  };

  const switchView = (view) => {
    setActiveView(view);
    setViewingDict(null); 
  };

  const renderNoteTable = (phraseString, index) => {
    const tokens = phraseString.split(" ");
    const rooms = [];
    for (let i = 0; i < 16; i += 4) {
      rooms.push(tokens.slice(i, i + 4));
    }
    return (
      // ⭐ เพิ่ม min-w-[600px] เพื่อให้บนมือถือเลื่อนซ้ายขวาได้ ไม่บีบตารางพัง
      <div key={index} className="flex w-full min-w-[600px] md:min-w-0 border border-slate-200/60 rounded-xl overflow-hidden bg-white mb-3 shadow-sm hover:border-teal-300 transition-colors">
        <div className="w-16 shrink-0 flex items-center justify-center border-r border-slate-200/60 text-[11px] font-semibold tracking-wide bg-slate-50 text-slate-500">
          ทำนอง
        </div>
        <div className="flex-1 flex">
          {rooms.map((room, roomIndex) => (
            <div key={roomIndex} className={`flex-1 flex justify-evenly items-center py-3.5 bg-white ${roomIndex !== rooms.length - 1 ? 'border-r border-slate-200/60' : ''}`}>
              {room.map((note, noteIndex) => (
                <span key={noteIndex} className={`text-[15px] md:text-[17px] font-medium w-6 text-center leading-none ${note !== '-' ? 'text-slate-800' : 'text-slate-200'}`}>
                  {note}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-[calc(100vh-64px)] md:h-full p-2 md:p-6 font-sans flex flex-col items-center justify-start">
      
      {/* ⭐ ปุ่มเปิด/ปิด Sidebar บนมือถือ */}
      <div className="w-full max-w-7xl mb-2 flex md:hidden justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
          Ranat Dictionary
        </h1>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>

      <div className="max-w-7xl w-full bg-white rounded-[20px] shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-slate-200 overflow-hidden flex flex-col md:flex-row h-full md:h-[75vh]">
        
        {/* ⭐ Sidebar (จะซ่อนบนมือถือถ้าไม่ได้กดเปิด) */}
        <div className={`w-full md:w-[320px] bg-slate-50/80 border-b md:border-b-0 md:border-r border-slate-200 p-5 md:p-6 flex-col relative z-10 ${isSidebarOpen ? 'flex' : 'hidden md:flex'}`}>
          <div className="hidden md:block mb-6">
            <h1 className="text-sm font-bold text-slate-400 tracking-widest uppercase mb-1 flex items-center gap-2">
              <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              Dictionary
            </h1>
            <h2 className="text-xl font-extrabold text-slate-800">พจนานุกรมทางระนาด</h2>
          </div>
          
          <label className="block mb-5 cursor-pointer group shrink-0">
            <input type="file" accept=".tme,.json" onChange={handleFileUpload} className="hidden" />
            <div className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-slate-300 bg-white text-center flex flex-col items-center justify-center gap-1 group-hover:border-teal-400 group-hover:bg-teal-50/30 transition-all">
              <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <span className="text-[13px] font-semibold text-slate-600 group-hover:text-teal-600">อัปโหลดไฟล์ทางระนาด</span>
            </div>
          </label>

          {songName && (
            <div className="mb-4 p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 animate-fadeIn shrink-0">
              <div className="w-8 h-8 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ไฟล์ปัจจุบัน</div>
                <div className="text-[12px] font-medium text-slate-700 truncate">{songName}</div>
              </div>
            </div>
          )}
          
          <div className="hidden md:block flex-1 overflow-y-auto space-y-4 -mx-2 px-2 custom-scrollbar"></div>

          <div className="mt-auto pt-4 md:pt-6 border-t border-slate-200/80 shrink-0">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  ระบุโครงสร้างทำนองหลัก
                </label>
              </div>
              <div className="bg-slate-200/50 p-1.5 rounded-xl">
                <input 
                  type="text" 
                  placeholder="เช่น ทลซ"
                  value={targetSkeleton}
                  onChange={handleSkeletonChange}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 md:p-3 text-lg font-black tracking-[0.2em] text-teal-700 text-center focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none transition-all shadow-sm uppercase placeholder:font-medium placeholder:tracking-normal placeholder:text-sm placeholder:text-slate-300"
                />
              </div>
            </div>
            
            <button 
              onClick={saveToDictionary}
              disabled={isSaving || groupedPhrases.length === 0}
              className="w-full py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-[13px] font-bold shadow-[0_4px_14px_rgba(20,184,166,0.3)] transition-all disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2"
            >
              {isSaving ? (
                 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              )}
              {isSaving ? "กำลังบันทึก..." : "บันทึกลง Database"}
            </button>
          </div>
        </div>

        {/* ⭐ Main Content */}
        <div className={`flex-1 p-4 md:p-8 flex-col bg-slate-50/30 overflow-y-hidden ${isSidebarOpen ? 'hidden md:flex' : 'flex'}`}>
          
          <div className="bg-slate-200/50 p-1 rounded-xl flex gap-1 w-full md:w-fit mb-4 md:mb-6 shrink-0">
            <button
              onClick={() => switchView('preview')}
              className={`flex-1 md:flex-none justify-center px-4 py-2 rounded-lg text-[12px] md:text-[13px] font-bold transition-all flex items-center gap-1 md:gap-2 ${activeView === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
            >
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              พรีวิวอัปโหลด
            </button>
            <button
              onClick={() => switchView('database')}
              className={`flex-1 md:flex-none justify-center px-4 py-2 rounded-lg text-[12px] md:text-[13px] font-bold transition-all flex items-center gap-1 md:gap-2 ${activeView === 'database' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
            >
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
              ฐานข้อมูล <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeView === 'database' ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'}`}>{savedDicts.length}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar md:pr-4 pb-10 md:pb-0">
            {activeView === 'preview' ? (
              groupedPhrases.length > 0 ? (
                <div className="max-w-[850px] mx-auto w-full animate-fadeIn">
                  <h2 className="text-lg font-bold text-slate-800 mb-1">ตรวจสอบทางระนาด</h2>
                  <p className="text-[12px] md:text-[13px] text-slate-400 mb-6 md:mb-8">ระบบจัดกลุ่มตามตัวเลขกำกับบรรทัด (Level) อัตโนมัติ</p>

                  {groupedPhrases.map((group, groupIdx) => (
                    <div key={groupIdx} className="mb-8 md:mb-10 bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm relative">
                      <span className="absolute -top-3 left-4 md:left-6 px-4 py-1 bg-slate-800 text-white text-[10px] md:text-[11px] font-bold rounded-full uppercase tracking-wider shadow-sm">
                        Level {group.level}
                      </span>
                      {/* ⭐ ครอบตารางด้วย overflow-x-auto ให้บนมือถือเลื่อนซ้ายขวาได้ */}
                      <div className="mt-3 md:mt-4 overflow-x-auto custom-scrollbar pb-2">
                        {group.phrases.map((phrase, phraseIdx) => renderNoteTable(phrase, phraseIdx))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 opacity-80 min-h-[300px]">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 shadow-sm">
                    <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </div>
                  <p className="text-[12px] md:text-[13px] font-medium text-center">กรุณาอัปโหลดไฟล์ทางระนาด<br className="md:hidden"/>เพื่อพรีวิวข้อมูล</p>
                </div>
              )
            ) : (
              <div className="max-w-[850px] mx-auto w-full">
                {viewingDict ? (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <button 
                      onClick={() => setViewingDict(null)}
                      className="mb-4 md:mb-6 flex items-center gap-2 text-[11px] md:text-[12px] font-bold text-slate-500 hover:text-slate-800 transition-colors bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm w-fit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                      ย้อนกลับไปหน้าฐานข้อมูล
                    </button>
                    
                    <h2 className="text-base md:text-lg font-bold text-slate-800 mb-1 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                      เช็กทางระนาดโครงสร้าง: 
                      <span className="font-black text-teal-600 tracking-widest bg-teal-50 px-3 py-1 rounded-lg border border-teal-100 w-fit">{viewingDict.skeleton}</span>
                    </h2>
                    <p className="text-[12px] md:text-[13px] text-slate-400 mb-6 md:mb-8 flex items-center gap-2 break-all">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <span className="truncate">บันทึกจากไฟล์: {stripHtml(viewingDict.sourceFile)}</span>
                    </p>

                    {viewingDict.variations?.map((group, groupIdx) => (
                      <div key={groupIdx} className="mb-8 md:mb-10 bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm relative">
                        <span className="absolute -top-3 left-4 md:left-6 px-4 py-1 bg-teal-500 text-white text-[10px] md:text-[11px] font-bold rounded-full uppercase tracking-wider shadow-sm">
                          Level {stripHtml(group.level)}
                        </span>
                        <div className="mt-3 md:mt-4 overflow-x-auto custom-scrollbar pb-2">
                          {group.phrases.map((phrase, phraseIdx) => renderNoteTable(phrase, phraseIdx))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="animate-fadeIn">
                    <h2 className="text-lg font-bold text-slate-800 mb-1">ข้อมูลในพจนานุกรม</h2>
                    <p className="text-[12px] md:text-[13px] text-slate-400 mb-4 md:mb-6">คลิกที่รายการเพื่อดูรายละเอียดทางระนาดทั้งหมด</p>
                    
                    {savedDicts.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {savedDicts.map(dict => (
                          <div 
                            key={dict.id} 
                            onClick={() => setViewingDict(dict)} 
                            className="bg-white border border-slate-200 p-3 md:p-4 rounded-2xl shadow-sm flex items-center justify-between hover:border-teal-400 hover:shadow-md cursor-pointer transition-all group"
                          >
                            <div className="flex items-center gap-3 md:gap-4 min-w-0">
                              <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-xl flex items-center justify-center text-teal-600 border border-slate-100 group-hover:scale-110 transition-transform shrink-0">
                                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 mb-1.5">
                                  <span className="text-[14px] md:text-[15px] font-bold text-slate-800 tracking-[0.1em]">{dict.skeleton}</span>
                                  <span className="text-[10px] md:text-[11px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md truncate max-w-[150px] md:max-w-[250px]" title={stripHtml(dict.sourceFile)}>
                                    {stripHtml(dict.sourceFile)}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {dict.variations?.map((v, i) => (
                                    <span key={i} className="text-[9px] md:text-[10px] font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md border border-teal-100 truncate max-w-[100px] md:max-w-[150px]">
                                      LV {stripHtml(v.level)} <span className="font-normal opacity-70">({v.phrases.length})</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => handleDelete(dict.id, e)} 
                              className="p-2 md:p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-100 md:opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 ml-2"
                              title="ลบข้อมูลนี้"
                            >
                              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-slate-400 mt-10 md:mt-20 opacity-80 flex flex-col items-center gap-3 min-h-[200px]">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 shadow-sm">
                           <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                        </div>
                        <p className="text-[12px] md:text-[13px] font-medium">ยังไม่มีข้อมูลในพจนานุกรมครับ</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}