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
                displayLabel: `บรรทัดที่ ${extractedPhrases.length + 1} (เดี่ยว)`,
                tokens: sheetData[i].flat().join(" ")
              });
            } else if (rowTypes[i] === "double-right" && i + 1 < sheetData.length && rowTypes[i+1] === "double-left") {
              const rightHand = sheetData[i].slice(1).flat().join(" ");
              const leftHand = sheetData[i+1].slice(1).flat().join(" ");
              extractedPhrases.push({
                type: "double",
                displayLabel: `บรรทัดที่ ${extractedPhrases.length + 1} (คู่)`,
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
        alert("รูปแบบไฟล์ไม่ถูกต้อง");
      }
    };
    reader.readAsText(file);
  };

  const handleSelectPhrase = async (index) => {
    setSelectedIndex(index);
    setGeneratedRanat(null);
    setSkeleton(null);
    setDictionaryResults([]);
    
    const activePhrase = phrases[index];
    setIsExtracting(true); 

    try {
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
    }
    
    setIsExtracting(false); 
  };

  const generateRanat = async (levelToGenerate = selectedLevel) => {
    if (selectedIndex === null) return;
    
    if (!skeleton) {
      alert("รอสักครู่ ระบบกำลังถอดโครงสร้างทำนองหลักครับ");
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
        const randomIdx = Math.floor(Math.random() * allVariations.length);
        setGeneratedRanat(allVariations[randomIdx]);
      } else {
        setDictionaryResults([]);
        setGeneratedRanat(null);
        alert(`ยังไม่มีข้อมูลทางระนาด Level ${levelToGenerate} สำหรับโครงสร้าง '${skeleton}' ในพจนานุกรมครับ`);
      }
    } catch (error) {
      console.error("Generation error:", error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ หรือค้นหาข้อมูล");
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
    if (selectedIndex !== null && skeleton) {
      generateRanat(newLevel);
    }
  };

  const renderRow = (tokenString, label, isTopRow, isHighlight = false) => {
    let cleanStr = tokenString.replace("มือขวา ", "").replace("มือซ้าย ", "");
    const tokens = cleanStr.split(" ").slice(0, 16);
    while (tokens.length < 16) tokens.push("-");

    const rooms = [];
    for (let i = 0; i < 16; i += 4) {
      rooms.push(tokens.slice(i, i + 4));
    }
    
    return (
      <div className={`flex w-full ${isTopRow ? (isHighlight ? 'border-b border-indigo-200' : 'border-b border-slate-200') : ''}`}>
        <div className={`w-16 flex items-center justify-center border-r ${isHighlight ? 'border-indigo-200 text-indigo-500 bg-indigo-50/50' : 'border-slate-200 text-slate-400 bg-slate-100/50'} text-xs font-bold`}>
          {label}
        </div>
        <div className="flex-1 flex">
          {rooms.map((room, roomIndex) => (
            <div key={roomIndex} className={`flex-1 flex justify-evenly items-center py-4 ${isHighlight ? 'bg-indigo-50/20' : 'bg-slate-50/50'} ${roomIndex !== rooms.length - 1 ? (isHighlight ? 'border-r border-indigo-200' : 'border-r border-slate-200') : ''}`}>
              {room.map((note, noteIndex) => (
                <span key={noteIndex} className={`text-2xl font-medium w-8 text-center ${note !== '-' ? (isHighlight ? 'text-indigo-700' : 'text-slate-800') : (isHighlight ? 'text-indigo-300' : 'text-slate-300')}`}>
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
        <div className={`flex flex-col border rounded-xl overflow-hidden mb-4 shadow-sm ${isHighlight ? 'border-indigo-300' : 'border-slate-200 bg-white'}`}>
           {renderRow(phrase, "ทำนอง", false, isHighlight)}
        </div>
      );
    }

    return (
      <div className={`flex flex-col border rounded-xl overflow-hidden mb-4 shadow-sm ${isHighlight ? 'border-indigo-300' : 'border-slate-200 bg-white'}`}>
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
      <div className="max-w-7xl w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex h-[75vh]">
        
        {/* Sidebar */}
        <div className="w-80 bg-slate-50 border-r border-slate-200 p-6 flex flex-col relative z-10">
          <h1 className="text-lg font-bold text-slate-800 tracking-tight mb-6 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
            แปลงทางระนาด
          </h1>
          
          <label className="block mb-4 cursor-pointer group">
            <input type="file" accept=".tme,.json" onChange={handleFileUpload} className="hidden" />
            <div className="w-full py-3 px-4 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 text-center text-sm font-semibold text-indigo-600 group-hover:border-indigo-500 group-hover:bg-indigo-100 transition-all shadow-inner">
              + อัปโหลดทำนองหลัก
            </div>
          </label>

          <div className="flex-1 overflow-y-auto space-y-2 -mx-2 px-2 custom-scrollbar mb-4">
            {phrases.map((phrase, index) => (
              <button 
                key={index} 
                onClick={() => handleSelectPhrase(index)} 
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                  selectedIndex === index 
                    ? "bg-indigo-600 text-white font-medium shadow-md" 
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {phrase.displayLabel}
              </button>
            ))}
          </div>

          <div className="mb-6 pt-4 border-t border-slate-200">
            <label className="block mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
              เลือกระดับความยาก (Level)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3"].map((level) => (
                <button
                  key={level}
                  onClick={() => handleLevelChange(level)}
                  className={`py-2 rounded-lg text-sm font-bold transition-all ${
                    selectedLevel === level 
                      ? "bg-slate-800 text-white shadow-md" 
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  LV {level}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <button 
              onClick={() => generateRanat(selectedLevel)}
              disabled={selectedIndex === null || isLoading || isExtracting}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              )}
              {isLoading ? "กำลังค้นหา..." : "แปลงเป็นทางระนาด"}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 flex flex-col bg-white relative overflow-y-auto">
          {selectedIndex !== null ? (
            <div className="h-full flex flex-col max-w-4xl mx-auto w-full">
              
              <div className="mb-8">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-1">ทำนองหลัก (ฆ้องวงใหญ่)</h2>
                    <p className="text-sm text-slate-400">{phrases[selectedIndex].displayLabel}</p>
                  </div>
                  
                  {isExtracting ? (
                    <div className="px-4 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-sm font-medium text-slate-400 flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                      กำลังวิเคราะห์...
                    </div>
                  ) : skeleton && (
                    <div className="px-4 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100 text-sm font-semibold text-slate-600 flex items-center gap-2 shadow-sm">
                      โครงสร้าง: <span className="text-indigo-700 font-bold tracking-widest">{skeleton}</span>
                    </div>
                  )}
                </div>
                {renderNoteTable(phrases[selectedIndex])}
              </div>

              <div className="flex-1 bg-slate-50/50 rounded-3xl border border-slate-200 p-8 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-indigo-800">ทางระนาดเอก</h2>
                    <p className="text-sm text-indigo-500/80 mt-1">Level {selectedLevel}</p>
                  </div>
                  
                  {generatedRanat && dictionaryResults.length > 1 && (
                    <button 
                      onClick={handleRefresh}
                      className="px-4 py-2 bg-white border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold shadow-sm transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      สุ่มทางใหม่
                    </button>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-center relative">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-40">
                      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                      <span className="text-indigo-500 font-medium text-sm">กำลังค้นหาในพจนานุกรม...</span>
                    </div>
                  ) : generatedRanat ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {renderNoteTable(generatedRanat, true)}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                      <p className="text-sm font-medium">กดปุ่ม "แปลงเป็นทางระนาด" เพื่อสร้างทำนอง</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-300">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
              </div>
              <p className="text-sm font-medium">อัปโหลดไฟล์ทำนองหลักทางซ้ายมือ และเลือกบรรทัดเพื่อเริ่มต้น</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}