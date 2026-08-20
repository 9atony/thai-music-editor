import React, { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../utils/firebase';

export default function RanatGenerator() {
  const [phrases, setPhrases] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState("1");
  
  const [skeleton, setSkeleton] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false); 
  
  const [generatedRanat, setGeneratedRanat] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dictionaryResults, setDictionaryResults] = useState([]);

  const mergeDoubleRow = (rightStr, leftStr) => {
    const right = rightStr.split(" ");
    const left = leftStr.split(" ");
    const merged = [];
    for (let i = 0; i < 16; i++) {
      if (right[i] && right[i] !== "-") merged.push(right[i]);
      else if (left[i] && left[i] !== "-") merged.push(left[i]);
      else merged.push("-");
    }
    return merged.join(" ");
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        const { sheetData, rowTypes } = json;
        
        if (sheetData && rowTypes) {
          const extractedPhrases = [];
          
          for (let i = 0; i < sheetData.length; i++) {
            if (rowTypes[i] === "single" && sheetData[i].length === 4) {
              extractedPhrases.push({
                type: "single",
                displayLabel: `วลีที่ ${extractedPhrases.length + 1} (บรรทัดเดี่ยว)`,
                tokens: sheetData[i].flat().join(" ")
              });
            } else if (rowTypes[i] === "double-right" && i + 1 < sheetData.length && rowTypes[i+1] === "double-left") {
              const rightHand = sheetData[i].slice(1).flat().join(" ");
              const leftHand = sheetData[i+1].slice(1).flat().join(" ");
              extractedPhrases.push({
                type: "double",
                displayLabel: `วลีที่ ${extractedPhrases.length + 1} (บรรทัดคู่)`,
                rightTokens: rightHand,
                leftTokens: leftHand,
                tokens: mergeDoubleRow(rightHand, leftHand)
              });
              i++; 
            }
          }

          setPhrases(extractedPhrases);
          setSelectedIndex(null);
          setGeneratedRanat(null);
          setSkeleton(null);
        }
      } catch (err) {
        alert("รูปแบบไฟล์ไม่ถูกต้อง กรุณาอัปโหลดไฟล์ .tme หรือ .json ที่ถูกต้อง");
      }
    };
    reader.readAsText(file);
    // รีเซ็ตค่า input เพื่อให้อัปโหลดไฟล์เดิมซ้ำได้
    event.target.value = null; 
  };

  const handleSelectPhrase = async (index) => {
    setSelectedIndex(index);
    setGeneratedRanat(null);
    setSkeleton(null);
    setDictionaryResults([]);
    
    const activePhrase = phrases[index];
    setIsExtracting(true); 

    try {
      // เรียกใช้งาน API เพื่อสกัดโครงสร้าง (Skeleton)
      const response = await fetch("https://thai-music-api.onrender.com/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: activePhrase.tokens })
      });
      const data = await response.json();
      
      if (data.status === "success") {
        setSkeleton(data.skeleton.join(" "));
      }
    } catch (error) {
      console.error("Extraction error:", error);
      alert("ไม่สามารถติดต่อ AI Service ได้ กรุณาลองใหม่อีกครั้ง");
    }
    
    setIsExtracting(false); 
  };

  const generateRanat = async (levelToGenerate = selectedLevel) => {
    if (selectedIndex === null) return;
    
    if (!skeleton) {
      alert("รอสักครู่ ระบบกำลังประมวลผลโครงสร้างหลักครับ");
      return;
    }

    setIsLoading(true);
    try {
      const q = query(
        collection(db, "ranat_dictionary"), 
        where("skeleton", "==", skeleton) 
      );
      const querySnapshot = await getDocs(q);
      
      let allVariations = [];
      querySnapshot.forEach((doc) => {
        const dictData = doc.data();
        const matchedLevel = dictData.variations.find(v => v.level === levelToGenerate);
        if (matchedLevel && matchedLevel.phrases) {
          allVariations = [...allVariations, ...matchedLevel.phrases];
        }
      });

      if (allVariations.length > 0) {
        setDictionaryResults(allVariations);
        // สุ่มเลือกผลลัพธ์แรกมาแสดง
        const randomIdx = Math.floor(Math.random() * allVariations.length);
        setGeneratedRanat(allVariations[randomIdx]);
      } else {
        setDictionaryResults([]);
        setGeneratedRanat(null);
        alert(`ไม่พบรูปแบบการตีระดับ ${levelToGenerate} สำหรับโครงสร้าง '${skeleton}' ในฐานข้อมูลครับ`);
      }
    } catch (error) {
      console.error("Generation error:", error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล");
    }
    
    setIsLoading(false);
  };

  const handleRefresh = () => {
    if (dictionaryResults.length > 0) {
      const randomIdx = Math.floor(Math.random() * dictionaryResults.length);
      setGeneratedRanat(dictionaryResults[randomIdx]);
    }
  };

  const handleLevelChange = (newLevel) => {
    setSelectedLevel(newLevel);
    // สร้างอัตโนมัติถ้ามีข้อมูลพร้อมแล้ว
    if (selectedIndex !== null && skeleton) {
      generateRanat(newLevel);
    }
  };

  // คอมโพเนนต์สำหรับแสดงตารางโน้ต 1 บรรทัด
  const renderRow = (tokenString, label, isTopRow, isHighlight = false) => {
    let cleanStr = tokenString.replace("มือขวา ", "").replace("มือซ้าย ", "");
    const tokens = cleanStr.split(" ").slice(0, 16);
    while (tokens.length < 16) tokens.push("-");

    const rooms = [];
    for (let i = 0; i < 16; i += 4) {
      rooms.push(tokens.slice(i, i + 4));
    }
    
    return (
      <div className={`flex w-full ${isTopRow ? 'border-b border-slate-200/60' : ''}`}>
        <div className={`w-16 flex items-center justify-center border-r border-slate-200/60 text-[11px] font-semibold tracking-wide ${isHighlight ? 'bg-sky-50/50 text-sky-700' : 'bg-slate-50 text-slate-500'}`}>
          {label}
        </div>
        <div className="flex-1 flex">
          {rooms.map((room, roomIndex) => (
            <div key={roomIndex} className={`flex-1 flex justify-evenly items-center py-3.5 ${isHighlight ? 'bg-sky-50/20' : 'bg-white'} ${roomIndex !== rooms.length - 1 ? 'border-r border-slate-200/60' : ''}`}>
              {room.map((note, noteIndex) => (
                <span key={noteIndex} className={`text-[17px] font-medium w-6 text-center leading-none ${note !== '-' ? (isHighlight ? 'text-sky-800' : 'text-slate-800') : (isHighlight ? 'text-sky-200' : 'text-slate-200')}`}>
                  {note}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNoteTable = (phrase, isHighlight = false) => {
    if (!phrase) return null;
    
    if (typeof phrase === 'string') {
      return (
        <div className={`flex flex-col border rounded-xl overflow-hidden shadow-sm ${isHighlight ? 'border-sky-300 ring-1 ring-sky-100' : 'border-slate-200'}`}>
           {renderRow(phrase, "ทำนอง", false, isHighlight)}
        </div>
      );
    }

    return (
      <div className={`flex flex-col border rounded-xl overflow-hidden shadow-sm ${isHighlight ? 'border-sky-300 ring-1 ring-sky-100' : 'border-slate-200'}`}>
        {phrase.type === 'single' ? (
          renderRow(phrase.tokens, "ทำนอง", false, isHighlight)
        ) : (
          <>
            {renderRow(phrase.rightTokens, "ขวา", true, isHighlight)}
            {renderRow(phrase.leftTokens, "ซ้าย", false, isHighlight)}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full p-4 md:p-6 font-sans flex items-start justify-center">
      <div className="max-w-7xl w-full bg-white rounded-[20px] shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-slate-200 overflow-hidden flex h-[75vh]">
        
        {/* ⭐ Sidebar แบบคลีนๆ */}
        <div className="w-[320px] bg-slate-50/80 border-r border-slate-200 p-6 flex flex-col relative z-10">
          <div className="mb-6">
            <h1 className="text-sm font-bold text-slate-400 tracking-widest uppercase mb-1 flex items-center gap-2">
              <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              AI Generator
            </h1>
            <h2 className="text-xl font-extrabold text-slate-800">สร้างทางระนาดเอก</h2>
          </div>
          
          <label className="block mb-5 cursor-pointer group">
            <input type="file" accept=".tme,.json" onChange={handleFileUpload} className="hidden" />
            <div className="w-full py-3.5 px-4 rounded-xl border-2 border-dashed border-slate-300 bg-white text-center flex flex-col items-center justify-center gap-1 group-hover:border-sky-400 group-hover:bg-sky-50/30 transition-all">
              <svg className="w-5 h-5 text-slate-400 group-hover:text-sky-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <span className="text-[13px] font-semibold text-slate-600 group-hover:text-sky-600">อัปโหลดทำนองหลัก</span>
            </div>
          </label>

          {/* รายการวลี */}
          <div className="flex-1 overflow-y-auto space-y-1.5 -mx-2 px-2 custom-scrollbar mb-4">
            {phrases.length === 0 && (
              <div className="text-center py-10 text-[12px] text-slate-400 font-medium px-4">
                ยังไม่มีข้อมูลทำนอง<br/>โปรดอัปโหลดไฟล์ด้านบน
              </div>
            )}
            {phrases.map((phrase, index) => (
              <button 
                key={index} 
                onClick={() => handleSelectPhrase(index)} 
                className={`w-full text-left px-4 py-2.5 rounded-xl text-[13px] transition-all flex items-center justify-between ${
                  selectedIndex === index 
                    ? "bg-slate-800 text-white font-medium shadow-md" 
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300"
                }`}
              >
                <span>{phrase.displayLabel}</span>
                {selectedIndex === index && <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>}
              </button>
            ))}
          </div>

          <div className="mb-6 pt-5 border-t border-slate-200/80">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                ความยาก (Level)
              </label>
              <span className="text-[11px] font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md">LV {selectedLevel}</span>
            </div>
            
            <div className="bg-slate-200/50 p-1 rounded-xl flex gap-1">
              {["1", "2", "3"].map((level) => (
                <button
                  key={level}
                  onClick={() => handleLevelChange(level)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedLevel === level 
                      ? "bg-white text-slate-800 shadow-sm" 
                      : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
                  }`}
                >
                  Level {level}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <button 
              onClick={() => generateRanat(selectedLevel)}
              disabled={selectedIndex === null || isLoading || isExtracting}
              className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-[13px] font-bold shadow-[0_4px_14px_rgba(14,165,233,0.3)] transition-all disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              )}
              {isLoading ? "กำลังประมวลผล..." : "สร้างทางระนาด (Generate)"}
            </button>
          </div>
        </div>

        {/* ⭐ Main Content แบบหน้าจอ Professional */}
        <div className="flex-1 p-8 flex flex-col bg-slate-50/30 relative overflow-y-auto">
          {selectedIndex !== null ? (
            <div className="h-full flex flex-col max-w-[850px] mx-auto w-full gap-6">
              
              {/* ทำนองหลัก */}
              <div>
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Source Melody</h2>
                    <h3 className="text-lg font-bold text-slate-800">ทำนองหลัก (ฆ้องวงใหญ่)</h3>
                  </div>
                  
                  {isExtracting ? (
                    <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-[11px] font-medium text-slate-400 flex items-center gap-2 shadow-sm">
                      <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                      กำลังวิเคราะห์...
                    </div>
                  ) : skeleton && (
                    <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-500 flex items-center gap-2 shadow-sm">
                      โครงสร้าง <span className="w-px h-3 bg-slate-300"></span> <span className="text-slate-800 font-bold tracking-widest">{skeleton}</span>
                    </div>
                  )}
                </div>
                {renderNoteTable(phrases[selectedIndex])}
              </div>

              {/* เส้นแบ่ง */}
              <div className="flex items-center gap-4 py-2 opacity-60">
                <div className="h-px bg-slate-200 flex-1"></div>
                <div className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-300 shadow-sm">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                </div>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              {/* ทางระนาดที่สร้าง */}
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-[13px] font-bold text-sky-500 uppercase tracking-widest mb-1">Generated Result</h2>
                    <h3 className="text-xl font-bold text-slate-800">ทางระนาดเอก</h3>
                  </div>
                  
                  {generatedRanat && dictionaryResults.length > 1 && (
                    <button 
                      onClick={handleRefresh}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-600 hover:text-sky-700 rounded-lg text-[12px] font-bold shadow-sm transition-all flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      สุ่มทางเลือกอื่น
                    </button>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-center relative">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-48 bg-white border border-slate-200 rounded-2xl shadow-sm">
                      <div className="w-8 h-8 border-4 border-slate-100 border-t-sky-500 rounded-full animate-spin mb-4"></div>
                      <span className="text-slate-500 font-medium text-[13px]">กำลังค้นหาข้อมูลใน Database...</span>
                    </div>
                  ) : generatedRanat ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {renderNoteTable(generatedRanat, true)}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 text-slate-300">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                      </div>
                      <p className="text-[13px] font-medium text-slate-500">กดปุ่มสร้างทางระนาดด้านซ้ายมือ เพื่อดูผลลัพธ์</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 opacity-80">
              <div className="w-20 h-20 rounded-3xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 shadow-sm">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
              </div>
              <p className="text-sm font-medium">รอการเลือกทำนองหลักเพื่อเริ่มต้นการทำงาน</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}