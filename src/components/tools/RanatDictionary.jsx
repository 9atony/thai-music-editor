import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../utils/firebase'; 

export default function RanatDictionary() {
  const [songName, setSongName] = useState("");
  const [targetSkeleton, setTargetSkeleton] = useState(""); 
  const [groupedPhrases, setGroupedPhrases] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const [savedDicts, setSavedDicts] = useState([]);
  const [activeView, setActiveView] = useState('preview'); 
  const [viewingDict, setViewingDict] = useState(null); 

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
              currentLevel = sectionLabels[i][0].text;
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
        setSongName(songName || "ไม่ทราบชื่อเพลง");
        switchView('preview');
      } catch (err) {
        alert("รูปแบบไฟล์ไม่ถูกต้อง หรือไม่พบข้อมูล");
      }
    };
    reader.readAsText(file);
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
      <div key={index} className="flex border border-slate-200 rounded-xl overflow-hidden bg-white mb-2 shadow-sm transition-all hover:border-slate-300">
        {rooms.map((room, roomIndex) => (
          <div key={roomIndex} className={`flex-1 flex justify-evenly items-center py-3 bg-slate-50/50 ${roomIndex !== rooms.length - 1 ? 'border-r border-slate-200' : ''}`}>
            {room.map((note, noteIndex) => (
              <span key={noteIndex} className={`text-xl font-medium w-6 text-center ${note !== '-' ? 'text-slate-800' : 'text-slate-300'}`}>
                {note}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full h-full p-4 md:p-6 font-sans flex items-start justify-center">
      <div className="max-w-7xl w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex h-[75vh]">
        
        {/* Sidebar */}
        <div className="w-80 bg-slate-50 border-r border-slate-200 p-6 flex flex-col relative z-10">
          <h1 className="text-lg font-bold text-slate-800 tracking-tight mb-6 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-teal-500"></span>
            Ranat Dictionary
          </h1>
          
          <label className="block mb-6 cursor-pointer group">
            <input type="file" accept=".tme,.json" onChange={handleFileUpload} className="hidden" />
            <div className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-300 bg-white text-center text-sm font-medium text-slate-500 group-hover:border-slate-500 group-hover:text-slate-700 transition-all">
              + อัปโหลดไฟล์ทางระนาด
            </div>
          </label>

          {songName && (
            <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">ไฟล์ปัจจุบัน</div>
              <div className="text-sm font-medium text-slate-700">{songName}</div>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto space-y-4 -mx-2 px-2 custom-scrollbar"></div>

          <div className="mt-4 pt-6 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
              ระบุโครงสร้างทำนองหลัก
            </label>
            <input 
              type="text" 
              placeholder="ไม่ต้องเว้นวรรค (เช่น ทลซ)"
              value={targetSkeleton}
              onChange={handleSkeletonChange}
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-lg font-medium tracking-[0.2em] text-slate-800 mb-4 focus:border-teal-500 focus:ring-0 focus:outline-none text-center transition-all"
            />
            <button 
              onClick={saveToDictionary}
              disabled={isSaving || groupedPhrases.length === 0}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              {isSaving ? "กำลังบันทึก..." : "บันทึกลง Database"}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 flex flex-col bg-white overflow-y-hidden">
          
          <div className="flex gap-4 mb-6 border-b border-slate-100 pb-4">
            <button
              onClick={() => switchView('preview')}
              className={`px-5 py-2.5 font-bold text-sm rounded-xl transition-all ${activeView === 'preview' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
            >
              พรีวิวไฟล์อัปโหลด
            </button>
            <button
              onClick={() => switchView('database')}
              className={`px-5 py-2.5 font-bold text-sm rounded-xl transition-all ${activeView === 'database' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'} flex items-center gap-2`}
            >
              ฐานข้อมูล <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-xs">{savedDicts.length}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
            {activeView === 'preview' ? (
              groupedPhrases.length > 0 ? (
                <div className="max-w-4xl mx-auto w-full">
                  <h2 className="text-xl font-bold text-slate-800 mb-1">ตรวจสอบทางระนาด</h2>
                  <p className="text-sm text-slate-400 mb-8">ระบบจัดกลุ่มตามตัวเลขกำกับบรรทัดอัตโนมัติ</p>

                  {groupedPhrases.map((group, groupIdx) => (
                    <div key={groupIdx} className="mb-10 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 relative">
                      <span className="absolute -top-3 left-6 px-4 py-1 bg-slate-800 text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-sm">
                        Level {group.level}
                      </span>
                      <div className="mt-4">
                        {group.phrases.map((phrase, phraseIdx) => renderNoteTable(phrase, phraseIdx))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </div>
                  <p className="text-sm font-medium">กรุณาอัปโหลดไฟล์ทางระนาดเพื่อพรีวิวข้อมูล</p>
                </div>
              )
            ) : (
              <div className="max-w-4xl mx-auto w-full">
                {viewingDict ? (
                  <div className="animate-in fade-in duration-300">
                    <button 
                      onClick={() => setViewingDict(null)}
                      className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                      ย้อนกลับไปหน้าฐานข้อมูล
                    </button>
                    
                    <h2 className="text-xl font-bold text-slate-800 mb-1">
                      เช็กทางระนาดโครงสร้าง: <span className="font-black text-teal-600 tracking-widest ml-2">{viewingDict.skeleton}</span>
                    </h2>
                    <p className="text-sm text-slate-500 mb-8">บันทึกจากไฟล์: {viewingDict.sourceFile}</p>

                    {viewingDict.variations?.map((group, groupIdx) => (
                      <div key={groupIdx} className="mb-10 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 relative">
                        <span className="absolute -top-3 left-6 px-4 py-1 bg-teal-500 text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-sm">
                          Level {group.level}
                        </span>
                        <div className="mt-4">
                          {group.phrases.map((phrase, phraseIdx) => renderNoteTable(phrase, phraseIdx))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-slate-800 mb-1">ข้อมูลในพจนานุกรม</h2>
                    <p className="text-sm text-slate-400 mb-8">คลิกที่รายการเพื่อดูรายละเอียดทางระนาด</p>
                    
                    {savedDicts.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {savedDicts.map(dict => (
                          <div 
                            key={dict.id} 
                            onClick={() => setViewingDict(dict)} 
                            className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:border-teal-400 hover:shadow-md cursor-pointer transition-all group"
                          >
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-xl font-bold text-teal-600 tracking-[0.2em]">{dict.skeleton}</span>
                                <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-1 rounded-md">
                                  ไฟล์: {dict.sourceFile}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {dict.variations?.map((v, i) => (
                                  <span key={i} className="text-xs font-bold bg-teal-50 text-teal-600 px-2 py-1 rounded-md border border-teal-100">
                                    Level {v.level} <span className="font-normal opacity-70">({v.phrases.length} ทาง)</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button 
                              onClick={(e) => handleDelete(dict.id, e)} 
                              className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="ลบข้อมูลนี้"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-slate-400 mt-20">
                        <p className="text-sm">ยังไม่มีข้อมูลในพจนานุกรมครับ</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}