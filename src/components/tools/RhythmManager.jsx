import React, { useState, useEffect } from 'react';
import { db } from '../../utils/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const RhythmManager = () => {
  const [activeTab, setActiveTab] = useState('ching');
  const [allRhythms, setAllRhythms] = useState([]);
  const [extractedRhythms, setExtractedRhythms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);

  const [editingItem, setEditingItem] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const INSTRUMENT_TABS = [
    { id: 'ching', name: 'ฉิ่ง', icon: '🪘', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
    { id: 'klong-khaek', name: 'กลองแขก', icon: '🥁', badgeColor: 'bg-rose-100 text-rose-800 border-rose-200' },
    { id: 'krub', name: 'กรับ', icon: '🪵', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
  ];

  const fetchAllRhythms = async () => {
    setIsLoading(true);
    try {
      const docRef = doc(db, "system_rhythms", "master");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setAllRhythms(docSnap.data().patterns || []);
      }
    } catch (error) {
      console.error("Error fetching rhythms:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRhythms();
  }, []);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setExtractedRhythms([]);
    setUploadStatus(null);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        if (jsonData.sheetData) {
          processRhythms(jsonData);
        } else {
          alert("ไฟล์ไม่ถูกต้อง ไม่พบโครงสร้างข้อมูล (sheetData)");
        }
      } catch (error) {
        alert("ไม่สามารถอ่านไฟล์ได้ โปรดตรวจสอบว่าเป็นไฟล์ .tme ที่ถูกต้อง");
      }
    };
    reader.readAsText(file);
    event.target.value = null; 
  };

  const processRhythms = (jsonData) => {
    const newRhythms = [];
    const sheetData = jsonData.sheetData || [];
    const sectionLabels = jsonData.sectionLabels || {};
    const rowTypes = jsonData.rowTypes || [];

    let skipNextRow = false;
    let currentRhythm = null;

    const pushCurrentRhythm = () => {
      if (currentRhythm) {
        const hasNotes = currentRhythm.pattern.some(cell => cell && cell.trim() !== '' && cell.trim() !== '-');
        if (hasNotes) {
          // ตัดห้องว่าง (ทั้งหมดเป็น '-') ท้ายแพทเทิร์นทิ้งออกอัตโนมัติ
          while (currentRhythm.pattern.length >= 4) {
            const last4 = currentRhythm.pattern.slice(-4);
            const allEmpty = last4.every(c => !c || c === '-');
            if (allEmpty) {
              currentRhythm.pattern.splice(-4, 4);
              if (currentRhythm.patternRight) currentRhythm.patternRight.splice(-4, 4);
              if (currentRhythm.patternLeft) currentRhythm.patternLeft.splice(-4, 4);
            } else {
              break;
            }
          }

          delete currentRhythm.isDoubleTemp;
          newRhythms.push(currentRhythm);
        }
        currentRhythm = null;
      }
    };

    sheetData.forEach((row, rowIndex) => {
      if (skipNextRow) {
        skipNextRow = false;
        return;
      }

      let vIdx = 0;
      for (let i = 0; i < rowIndex; i++) {
        if (rowTypes[i] === 'single' || rowTypes[i] === 'double-right') vIdx++;
      }

      let hasNewLabel = false;
      let rowName = `จังหวะที่ ${rowIndex + 1}`;
      
      if (rowTypes[rowIndex] !== 'double-left' && sectionLabels[vIdx] && sectionLabels[vIdx].length > 0) {
        const rawText = sectionLabels[vIdx][0].text;
        rowName = rawText.replace(/<[^>]*>?/gm, '').trim();
        hasNewLabel = true;
      } else if (!Array.isArray(row) && (row.label || row.name)) {
        rowName = row.label || row.name;
        hasNewLabel = true;
      }

      if (hasNewLabel && currentRhythm) {
        pushCurrentRhythm();
      }

      let patternArray = [];
      let isDouble = false;
      let pRight = [];
      let pLeft = [];

      if (rowTypes[rowIndex] === 'double-right' && sheetData[rowIndex + 1]) {
        isDouble = true;
        const rightMeasures = (row.length > 0 && row[0].length === 1) ? row.slice(1) : row;
        const leftMeasures = (sheetData[rowIndex + 1].length > 0 && sheetData[rowIndex + 1][0].length === 1) ? sheetData[rowIndex + 1].slice(1) : sheetData[rowIndex + 1];
        
        const rightRow = Array.isArray(rightMeasures) ? rightMeasures.flat() : [];
        const leftRow = Array.isArray(leftMeasures) ? leftMeasures.flat() : [];
        
        const maxLength = Math.max(rightRow.length, leftRow.length);
        for (let i = 0; i < maxLength; i++) {
          const rNote = rightRow[i] && rightRow[i] !== '-' ? rightRow[i].trim() : '';
          const lNote = leftRow[i] && leftRow[i] !== '-' ? leftRow[i].trim() : '';
          
          pRight.push(rNote || '-');
          pLeft.push(lNote || '-');

          const combined = rNote + lNote;
          patternArray.push(combined === '' ? '-' : combined);
        }
        skipNextRow = true;
      } else {
        let singleMeasures = row;
        if (Array.isArray(row) && row.length > 0 && row[0].length === 1) {
          singleMeasures = row.slice(1);
        }
        if (Array.isArray(singleMeasures)) {
          patternArray = singleMeasures.flat(); 
        } else if (singleMeasures.cells || singleMeasures.pattern) {
          patternArray = singleMeasures.cells || singleMeasures.pattern; 
        }
      }

      if (!currentRhythm) {
        currentRhythm = {
          id: `${activeTab}_${Date.now()}_${rowIndex}`, 
          instrumentId: activeTab, 
          name: rowName,
          pattern: [...patternArray],
          patternRight: isDouble ? [...pRight] : undefined,
          patternLeft: isDouble ? [...pLeft] : undefined,
          isDoubleTemp: isDouble
        };
      } else {
        currentRhythm.pattern.push(...patternArray);
        
        if (isDouble && !currentRhythm.isDoubleTemp) {
          currentRhythm.isDoubleTemp = true;
          const oldLength = currentRhythm.pattern.length - patternArray.length;
          currentRhythm.patternRight = [...currentRhythm.pattern.slice(0, oldLength)];
          currentRhythm.patternLeft = Array(oldLength).fill('-');
        }

        if (currentRhythm.isDoubleTemp) {
          if (isDouble) {
            currentRhythm.patternRight.push(...pRight);
            currentRhythm.patternLeft.push(...pLeft);
          } else {
            currentRhythm.patternRight.push(...patternArray);
            currentRhythm.patternLeft.push(...Array(patternArray.length).fill('-'));
          }
        }
      }
    });

    pushCurrentRhythm();

    if (newRhythms.length > 0) {
      setExtractedRhythms(newRhythms);
      setUploadStatus(null);
    } else {
      alert("ไม่พบข้อมูลจังหวะที่มีตัวโน้ตในบรรทัดใดเลยครับ");
      setExtractedRhythms([]);
    }
  };

  const handleDeployRhythms = async () => {
    if (extractedRhythms.length === 0) return;
    setIsUploading(true);
    setUploadStatus("กำลังบันทึกข้อมูลขึ้นระบบ...");

    try {
      const otherInstruments = allRhythms.filter(r => r.instrumentId !== activeTab);
      const currentTabItems = [...allRhythms.filter(r => r.instrumentId === activeTab)];

      extractedRhythms.forEach(newItem => {
        const existingIdx = currentTabItems.findIndex(item => item.name === newItem.name);
        if (existingIdx >= 0) {
          currentTabItems[existingIdx] = newItem;
        } else {
          currentTabItems.push(newItem);
        }
      });

      const updatedAll = [...otherInstruments, ...currentTabItems];

      await setDoc(doc(db, "system_rhythms", "master"), {
        updatedAt: serverTimestamp(),
        patterns: updatedAll
      });

      setAllRhythms(updatedAll);
      setUploadStatus("✅ บันทึกข้อมูลสำเร็จ!");
      
      setTimeout(() => {
        setExtractedRhythms([]);
        setUploadStatus(null);
      }, 2500);

    } catch (error) {
      console.error("Error saving:", error);
      setUploadStatus("❌ เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteRhythm = async (idToDelete, name) => {
    if (!window.confirm(`ยืนยันการลบ "${name}" ออกจากระบบ?`)) return;

    const updated = allRhythms.filter(r => r.id !== idToDelete);
    try {
      await setDoc(doc(db, "system_rhythms", "master"), {
        updatedAt: serverTimestamp(),
        patterns: updated
      });
      setAllRhythms(updated);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setIsSavingEdit(true);

    const isDouble = editingItem.patternRight !== undefined;
    let newCombined = [];
    let pRight = null;
    let pLeft = null;

    if (isDouble) {
      pRight = editingItem.patternStr.split(/\s+/).filter(Boolean);
      pLeft = editingItem.patternLeftStr.split(/\s+/).filter(Boolean);
      const max = Math.max(pRight.length, pLeft.length);
      for(let i=0; i<max; i++) {
        const r = pRight[i] && pRight[i] !== '-' ? pRight[i] : '';
        const l = pLeft[i] && pLeft[i] !== '-' ? pLeft[i] : '';
        const combined = r + l;
        newCombined.push(combined === '' ? '-' : combined);
      }
    } else {
      newCombined = editingItem.patternStr.split(/\s+/).filter(Boolean);
    }

    const updated = allRhythms.map(r => 
      r.id === editingItem.id 
        ? { 
            ...r, 
            name: editingItem.name, 
            pattern: newCombined,
            ...(isDouble && { patternRight: pRight, patternLeft: pLeft })
          }
        : r
    );

    try {
      await setDoc(doc(db, "system_rhythms", "master"), {
        updatedAt: serverTimestamp(),
        patterns: updated
      });
      setAllRhythms(updated);
      setEditingItem(null);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการแก้ไข");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const activeTabItems = allRhythms.filter(r => r.instrumentId === activeTab);
  const currentTabConfig = INSTRUMENT_TABS.find(t => t.id === activeTab);

  const renderExactRowPattern = (item) => {
    const isDouble = item.patternRight && item.patternLeft;
    const topArr = isDouble ? item.patternRight : item.pattern;
    const botArr = isDouble ? item.patternLeft : null;

    const totalMeasures = Math.ceil(topArr.length / 4);
    const totalLines = Math.ceil(totalMeasures / 8);

    return (
      <div className="w-full overflow-x-auto custom-scrollbar pb-2">
        <div className="flex flex-col gap-3 w-max mt-1">
          
          {Array.from({ length: totalLines }).map((_, lineIdx) => {
            const measuresInThisLine = Math.min(8, totalMeasures - lineIdx * 8);

            return (
              <div key={lineIdx} className="flex border border-slate-800 rounded-[2px] bg-white shadow-sm overflow-hidden">
                
                <div className="flex flex-col shrink-0 border-r border-slate-800 bg-slate-50/50">
                  <div className="h-9 flex items-center justify-center px-4 text-[11px] font-bold text-slate-700">
                    {isDouble ? 'มือขวา' : (item.instrumentId === 'ching' ? 'ฉิ่ง/ฉับ' : 'จังหวะ')}
                  </div>
                  {isDouble && (
                    <div className="h-9 flex items-center justify-center px-4 text-[11px] font-bold text-slate-700 border-t border-slate-800">
                      มือซ้าย
                    </div>
                  )}
                </div>

                <div className="flex">
                  {Array.from({ length: measuresInThisLine }).map((_, mIdxLocal) => {
                    const globalMIdx = lineIdx * 8 + mIdxLocal;
                    const topMeasure = topArr.slice(globalMIdx * 4, (globalMIdx + 1) * 4);
                    const botMeasure = botArr ? botArr.slice(globalMIdx * 4, (globalMIdx + 1) * 4) : null;
                    
                    const paddedTop = [...topMeasure, ...Array(4 - topMeasure.length).fill('-')];
                    const paddedBot = botMeasure ? [...botMeasure, ...Array(4 - botMeasure.length).fill('-')] : null;

                    return (
                      <div key={mIdxLocal} className="flex flex-col border-r border-slate-800 last:border-r-0">
                        <div className="flex h-9">
                          {paddedTop.map((note, cIdx) => {
                            const isEmpty = !note || note === '-';
                            return (
                              <div key={cIdx} className="w-8 flex items-center justify-center text-[12px] font-bold border-r border-slate-300 last:border-r-0">
                                 {isEmpty ? <span className="text-slate-300">-</span> : <span className="text-slate-800">{note}</span>}
                              </div>
                            );
                          })}
                        </div>
                        {isDouble && (
                          <div className="flex h-9 border-t border-slate-800">
                            {paddedBot.map((note, cIdx) => {
                              const isEmpty = !note || note === '-';
                              return (
                                <div key={cIdx} className="w-8 flex items-center justify-center text-[12px] font-bold border-r border-slate-300 last:border-r-0">
                                   {isEmpty ? <span className="text-slate-300">-</span> : <span className="text-slate-800">{note}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}

        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 bg-[#f8fafc] text-slate-800 overflow-y-auto w-full h-full custom-scrollbar">
      {/* ⭐ ขยายความกว้างสูงสุดของหน้าจอให้กว้างขึ้น */}
      <div className="max-w-[1536px] w-full mx-auto p-6 md:p-10 font-sans min-h-full flex flex-col">
        
        <div className="mb-8 border-b border-slate-200 pb-6">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 flex items-center gap-3 mb-2">
            <span className="text-3xl bg-white p-2 rounded-2xl shadow-sm border border-slate-100">🥁</span> 
            จัดการหน้าทับเครื่องประกอบจังหวะ
          </h2>
          <p className="text-sm text-slate-500 font-medium mb-6">
            เลือกแท็บเครื่องดนตรี แล้วอัปโหลดไฟล์ <code className="bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-mono text-xs font-bold border border-sky-100">.tme</code> เพื่อนำเข้าจังหวะเข้าสู่หมวดนั้นโดยตรง
          </p>

          <div className="flex gap-2 p-1.5 bg-slate-200/60 rounded-2xl w-fit">
            {INSTRUMENT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-800 shadow-sm shadow-slate-300/50 scale-[1.02]'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.name}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ml-1 ${
                  activeTab === tab.id ? 'bg-slate-100 text-slate-700' : 'bg-slate-300/50 text-slate-500'
                }`}>
                  {allRhythms.filter(r => r.instrumentId === tab.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ⭐ ปรับ Grid เป็น 4 ส่วน เพื่อให้ฝั่งขวากว้างขึ้น */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-12">
          
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{currentTabConfig?.icon}</span>
                <h3 className="font-bold text-slate-800 text-base">
                  อัปโหลดไฟล์สำหรับ "{currentTabConfig?.name}"
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                ระบบจะนำทุกบรรทัดในไฟล์นี้ เข้าไปเป็นหน้าทับของ <strong className="text-slate-700">{currentTabConfig?.name}</strong> ทั้งหมดโดยอัตโนมัติ
              </p>
              
              <label className="relative flex flex-col items-center justify-center w-full h-36 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-[#f8fafc] hover:bg-sky-50 hover:border-sky-300 transition-all group overflow-hidden mb-4">
                <div className="relative flex flex-col items-center justify-center gap-2 z-10 p-4 text-center">
                  <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400 group-hover:text-sky-500 group-hover:scale-110 transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700 group-hover:text-sky-700">คลิก หรือลากไฟล์ .tme มาวาง</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">นำเข้าจังหวะ{currentTabConfig?.name}</p>
                  </div>
                </div>
                <input type="file" accept=".tme" className="hidden" onChange={handleFileUpload} />
              </label>

              {uploadStatus && (
                <div className={`p-3.5 rounded-xl text-xs font-bold text-center border ${
                  uploadStatus.includes('✅') ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                  uploadStatus.includes('❌') ? 'bg-rose-50 text-rose-600 border-rose-200' :
                  'bg-sky-50 text-sky-600 border-sky-200'
                }`}>
                  {uploadStatus}
                </div>
              )}
            </div>

            {extractedRhythms.length > 0 && (
              <div className="bg-sky-50 rounded-3xl p-6 border border-sky-100 animate-slideUp">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sky-900 text-sm">อ่านพบ {extractedRhythms.length} หน้าทับ</h3>
                  <span className="text-[11px] font-bold text-sky-600 bg-white px-2 py-0.5 rounded-lg border border-sky-100">
                    เตรียมบันทึกลง {currentTabConfig?.name}
                  </span>
                </div>
                
                <div className="space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar pr-1 mb-4">
                  {extractedRhythms.map((item, index) => (
                    <div key={index} className="bg-white border border-sky-100 rounded-2xl p-3.5 shadow-sm">
                      <div className="font-bold text-slate-800 text-xs mb-2">{item.name}</div>
                      {renderExactRowPattern(item)}
                    </div>
                  ))}
                </div>

                <button 
                  onClick={handleDeployRhythms} 
                  disabled={isUploading} 
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md shadow-sky-500/20 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                >
                  {isUploading ? 'กำลังบันทึก...' : `บันทึกหน้าทับ${currentTabConfig?.name}ขึ้นระบบ`}
                </button>
              </div>
            )}
          </div>

          {/* ⭐ ขยายฝั่งขวาให้กว้างขึ้นเป็น 3 ส่วน */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 h-full">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <span>{currentTabConfig?.icon}</span>
                    <span>รายการหน้าทับ {currentTabConfig?.name} ในระบบ</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">จังหวะทั้งหมดที่จะแสดงในตัวเลือกของ {currentTabConfig?.name}</p>
                </div>
                <div className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg self-start sm:self-auto">
                  {activeTabItems.length} รูปแบบ
                </div>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <svg className="animate-spin h-8 w-8 mb-4 text-sky-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <p className="text-sm font-bold">กำลังโหลดข้อมูล...</p>
                </div>
              ) : activeTabItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 p-6 text-center">
                  <span className="text-4xl mb-3">{currentTabConfig?.icon}</span>
                  <p className="text-sm font-bold text-slate-600">ยังไม่มีข้อมูลหน้าทับสำหรับ {currentTabConfig?.name}</p>
                  <p className="text-xs text-slate-400 mt-1">อัปโหลดไฟล์ .tme ทางฝั่งซ้ายเพื่อเพิ่มจังหวะของ {currentTabConfig?.name}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {activeTabItems.map((rhythm) => (
                    <div key={rhythm.id} className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-4 hover:border-sky-200 transition-all group">
                      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-200/60">
                        <span className="font-bold text-slate-800 text-sm">
                          {rhythm.name}
                        </span>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingItem({ 
                              ...rhythm, 
                              patternStr: rhythm.patternRight ? rhythm.patternRight.join(' ') : rhythm.pattern.join(' '),
                              patternLeftStr: rhythm.patternLeft ? rhythm.patternLeft.join(' ') : ''
                            })} 
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" 
                            title="แก้ไข"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button 
                            onClick={() => handleDeleteRhythm(rhythm.id, rhythm.name)} 
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" 
                            title="ลบ"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                      
                      {renderExactRowPattern(rhythm)}
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl scale-100 animate-slideUp">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="bg-sky-100 text-sky-600 p-1.5 rounded-lg">✏️</span> แก้ไขหน้าทับ
            </h3>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ชื่อหน้าทับ</label>
                <input 
                  type="text" 
                  value={editingItem.name} 
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  แพทเทิร์นจังหวะ {editingItem.patternRight !== undefined && "(มือขวา)"} <span className="text-[10px] text-slate-400 font-normal">(เว้นวรรคเพื่อแยกช่อง)</span>
                </label>
                <textarea 
                  value={editingItem.patternStr} 
                  onChange={(e) => setEditingItem({ ...editingItem, patternStr: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 resize-none leading-relaxed"
                  placeholder="เช่น: - ทัง - - - - - จ๊ะ"
                ></textarea>
              </div>

              {editingItem.patternRight !== undefined && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    แพทเทิร์นจังหวะ (มือซ้าย) <span className="text-[10px] text-slate-400 font-normal">(เว้นวรรคเพื่อแยกช่อง)</span>
                  </label>
                  <textarea 
                    value={editingItem.patternLeftStr} 
                    onChange={(e) => setEditingItem({ ...editingItem, patternLeftStr: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 resize-none leading-relaxed"
                    placeholder="เช่น: - - - ติง - โจ๊ะ - -"
                  ></textarea>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors text-sm"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl transition-colors shadow-md shadow-sky-500/20 active:scale-95 flex items-center justify-center text-sm disabled:opacity-50"
              >
                {isSavingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RhythmManager;