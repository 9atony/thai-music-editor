import React, { useState } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
// แก้ไข Path ชี้ไปยัง utils/firebase ในโปรเจกต์หลัก
import { db } from '../../utils/firebase'; 

export default function TunerDashboard() {
  const [songName, setSongName] = useState("");
  const [phrases, setPhrases] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  
  const [skeletonResult, setSkeletonResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [expectedNotes, setExpectedNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const mergeDoubleRow = (rightStr, leftStr) => {
    const right = rightStr.split(" ");
    const left = leftStr.split(" ");
    const merged = [];
    for (let i = 0; i < 16; i++) {
      if (right[i] && right[i] !== "-") {
        merged.push(right[i]); 
      } else if (left[i] && left[i] !== "-") {
        merged.push(left[i]); 
      } else {
        merged.push("-");
      }
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
        setSongName(json.songName || "ไม่ทราบชื่อเพลง");
        
        const extractedPhrases = [];
        const { sheetData, rowTypes } = json;

        if (sheetData && rowTypes) {
          for (let i = 0; i < sheetData.length; i++) {
            if (rowTypes[i] === "single" && sheetData[i].length === 4) {
              extractedPhrases.push({
                type: "single",
                displayLabel: `บรรทัดที่ ${extractedPhrases.length + 1} (เดี่ยว)`,
                tokens: sheetData[i].flat().join(" ")
              });
            } 
            else if (rowTypes[i] === "double-right" && i + 1 < sheetData.length && rowTypes[i+1] === "double-left") {
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
        }
          
        setPhrases(extractedPhrases);
        setSelectedIndex(null);
        setSkeletonResult(null);
      } catch (err) {
        alert("รูปแบบไฟล์ไม่ถูกต้อง");
      }
    };
    reader.readAsText(file);
  };

  const handleSelectPhrase = async (index) => {
    setSelectedIndex(index);
    setSkeletonResult(null);
    setIsLoading(true);

    const phrase = phrases[index];

    try {
      const response = await fetch("https://thai-music-api.onrender.com/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: phrase.tokens }) 
      });
      const data = await response.json();
      if (data.status === "success") {
        setSkeletonResult(data.skeleton);
      }
    } catch (error) {
      alert("ไม่สามารถเชื่อมต่อ Python ได้");
    }
    setIsLoading(false);
  };

  const saveToFirebase = async (status, finalExpected) => {
    setIsSaving(true);
    try {
      const phrase = phrases[selectedIndex];
      const originalData = phrase.type === 'single' 
        ? phrase.tokens 
        : `ขวา: ${phrase.rightTokens} | ซ้าย: ${phrase.leftTokens}`;

      await addDoc(collection(db, "tuning_dataset"), {
        originalPhrase: originalData,      
        mergedPhrase: phrase.tokens,       
        extractedSkeleton: skeletonResult.join(" "),
        expectedSkeleton: finalExpected,
        status: status,
        timestamp: new Date()
      });
      
      setShowModal(false);
      setExpectedNotes("");
      
      if (selectedIndex < phrases.length - 1) {
        handleSelectPhrase(selectedIndex + 1);
      } else {
        alert("ทดสอบครบทุกบรรทัดแล้วครับ!");
      }
    } catch (error) {
      console.error("Error saving document: ", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
    setIsSaving(false);
  };

  const exportDataset = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "tuning_dataset"));
      const dataset = querySnapshot.docs.map(doc => doc.data());
      
      if (dataset.length === 0) {
        alert("ยังไม่มีข้อมูลในฐานข้อมูลครับ");
        return;
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      
      const timestampStr = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
      const fileName = `thai_music_dataset_${timestampStr}.json`;

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataset, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", fileName);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
    } catch (error) {
      console.error("Export error:", error);
      alert("เกิดข้อผิดพลาดในการดึงข้อมูล");
    }
  };

  const renderRow = (tokenString, label, isTopRow) => {
    const tokens = tokenString.split(" ");
    const rooms = [];
    for (let i = 0; i < 16; i += 4) {
      rooms.push(tokens.slice(i, i + 4));
    }
    return (
      <div className={`flex w-full ${isTopRow ? 'border-b border-zinc-200 bg-white' : 'bg-zinc-50/50'}`}>
        <div className="w-16 flex items-center justify-center border-r border-zinc-200 text-xs font-bold text-zinc-400 bg-zinc-100/50">
          {label}
        </div>
        <div className="flex-1 flex">
          {rooms.map((room, roomIndex) => (
            <div key={roomIndex} className={`flex-1 flex justify-evenly items-center py-4 ${roomIndex !== rooms.length - 1 ? 'border-r border-zinc-200' : ''}`}>
              {room.map((note, noteIndex) => (
                <span key={noteIndex} className={`text-2xl font-medium w-8 text-center ${note !== '-' ? 'text-zinc-800' : 'text-zinc-300'}`}>
                  {note}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNoteTable = (phrase) => {
    if (!phrase) return null;
    return (
      <div className="flex flex-col border border-zinc-200 rounded-2xl overflow-hidden mt-2 mb-8 shadow-sm">
        {phrase.type === 'single' ? (
          renderRow(phrase.tokens, "ทำนอง", false)
        ) : (
          <>
            {renderRow(phrase.rightTokens, "ขวา", true)}
            {renderRow(phrase.leftTokens, "ซ้าย", false)}
          </>
        )}
      </div>
    );
  };

  return (
    // ปรับลดกรอบด้านนอก ให้พอดีกับการแทรกในหน้า Tools
    <div className="w-full h-full p-4 md:p-6 font-sans flex items-start justify-center">
      <div className="max-w-7xl w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex h-[75vh]">
        
        <div className="w-80 bg-slate-50 border-r border-slate-200 p-6 flex flex-col">
          <h1 className="text-lg font-bold text-slate-800 tracking-tight mb-6 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-800"></span>
            Music Tuner
          </h1>
          
          <label className="block mb-6 cursor-pointer group">
            <input type="file" accept=".tme,.json" onChange={handleFileUpload} className="hidden" />
            <div className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-300 bg-white text-center text-sm font-medium text-slate-500 group-hover:border-slate-500 group-hover:text-slate-700 transition-all">
              + อัปโหลดไฟล์ .tme
            </div>
          </label>

          {songName && <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">เพลง: {songName}</div>}
          
          <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2 custom-scrollbar">
            {phrases.map((phrase, index) => (
              <button 
                key={index} 
                onClick={() => handleSelectPhrase(index)} 
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                  selectedIndex === index 
                    ? "bg-slate-800 text-white font-medium shadow-md" 
                    : "text-slate-600 hover:bg-slate-200/50"
                }`}
              >
                {phrase.displayLabel}
              </button>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <button 
              onClick={exportDataset}
              className="w-full py-3 bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-all flex justify-center items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export Dataset
            </button>
          </div>
        </div>

        <div className="flex-1 p-8 flex flex-col bg-white overflow-y-auto">
          {selectedIndex !== null ? (
            <div className="h-full flex flex-col">
              <h2 className="text-xl font-bold text-slate-800 mb-1">
                ทดสอบข้อมูล <span className="font-medium text-slate-500 text-base">{phrases[selectedIndex].displayLabel}</span>
              </h2>
              <p className="text-sm text-slate-400 mb-6">โน้ตต้นฉบับทำนองหลักวงใหญ่</p>
              
              {renderNoteTable(phrases[selectedIndex])}

              <div className="flex-1 bg-slate-50/50 rounded-3xl border border-slate-100 flex flex-col items-center justify-center relative p-8 mt-2">
                <span className="absolute top-6 left-8 text-xs font-bold tracking-widest text-slate-400 uppercase">
                  Skeleton Output
                </span>
                
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
                    <div className="text-slate-500 text-sm font-medium">กำลังประมวลผล...</div>
                  </div>
                ) : skeletonResult ? (
                  <div className="flex flex-col items-center gap-10 w-full mt-4">
                    <div className="text-6xl font-bold tracking-[0.3em] text-slate-800 ml-[0.3em]">
                      {skeletonResult.join(" ")}
                    </div>
                    
                    <div className="flex gap-4">
                      <button 
                        onClick={() => saveToFirebase("correct", skeletonResult.join(" "))}
                        disabled={isSaving}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full text-sm font-medium shadow-md transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        โครงสร้างถูกต้อง
                      </button>
                      <button 
                        onClick={() => setShowModal(true)}
                        disabled={isSaving}
                        className="px-6 py-3 bg-white border border-slate-200 hover:border-slate-400 text-slate-700 rounded-full text-sm font-medium shadow-sm transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        ต้องแก้ไขใหม่
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
              </div>
              <p className="text-sm font-medium">กรุณาอัปโหลดและเลือกบรรทัดทางซ้ายมือเพื่อเริ่มต้น</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md transform transition-all border border-slate-100">
            <h3 className="text-xl font-bold text-slate-800 mb-2">ระบุโครงสร้างที่ถูกต้อง</h3>
            <p className="text-sm text-slate-500 mb-6">
              ระบบวิเคราะห์ได้: <span className="font-semibold text-rose-500">{skeletonResult?.join(" ")}</span><br/>
              โปรดพิมพ์โครงสร้างที่ต้องการ (เว้นวรรคระหว่างโน้ต)
            </p>
            <input 
              type="text" 
              placeholder="ตัวอย่าง: ร ม ฟ"
              value={expectedNotes}
              onChange={(e) => setExpectedNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xl font-medium tracking-[0.2em] text-slate-800 mb-8 focus:border-slate-400 focus:ring-0 focus:outline-none text-center transition-all"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-full text-sm font-medium transition-all"
              >
                ยกเลิก
              </button>
              <button 
                onClick={() => saveToFirebase("incorrect", expectedNotes)}
                disabled={!expectedNotes.trim() || isSaving}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-full text-sm font-medium disabled:opacity-50 transition-all"
              >
                {isSaving ? "กำลังบันทึก..." : "ยืนยันการแก้ไข"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}