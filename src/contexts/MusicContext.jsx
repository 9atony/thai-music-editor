import React, { createContext, useState, useMemo, useEffect, useRef } from 'react';
import { INSTRUMENT_CONFIG } from '../utils/instrumentConfig';
import { primeAudioEngine, playNote } from '../utils/audioEngine'; 
import { auth, saveProjectToDB, getUserProfile } from '../utils/firebase';

import {
  getFlattenedCol, createDefaultLayoutConfig, createDefaultHeaderDetails,
  DEFAULT_INSTRUMENT, shiftNoteObject, shiftNoteString, normalizeNathapRowData
} from '../utils/sheetUtils';
import { useSheetEditor } from '../hooks/useSheetEditor';
import { useAudioPlayback } from '../hooks/useAudioPlayback';

export const MusicContext = createContext();

// เก็บเฉพาะค่าที่เป็นของโปรเจกต์ ไม่บันทึกรายการหน้าทับทั้งหมดซึ่งโหลดจากระบบกลาง
const getMetronomeProjectSettings = (config) => ({
  masterVolume: config.masterVolume,
  ching: { active: config.ching.active, pattern: config.ching.pattern, volume: config.ching.volume },
  klong: { active: config.klong.active, pattern: config.klong.pattern, volume: config.klong.volume },
  krub: { active: config.krub.active, pattern: config.krub.pattern, volume: config.krub.volume }
});

const applyMetronomeProjectSettings = (current, saved) => {
  if (!saved || typeof saved !== 'object') return current;
  const mergeInstrument = (key) => ({
    ...current[key],
    ...(saved[key] && typeof saved[key] === 'object' ? saved[key] : {})
  });
  return {
    ...current,
    ...(typeof saved.masterVolume === 'number' ? { masterVolume: saved.masterVolume } : {}),
    ching: mergeInstrument('ching'),
    klong: mergeInstrument('klong'),
    krub: mergeInstrument('krub')
  };
};

export const MusicProvider = ({ children }) => {
  const [currentInstrument, setCurrentInstrument] = useState(DEFAULT_INSTRUMENT);
  const [songName, setSongName] = useState("เพลงลาวดวงเดือน");
  const [projectName, setProjectName] = useState("โปรเจกต์ไม่มีชื่อ");
  const [projectId, setProjectId] = useState(null);
  
  // ⭐ เพิ่ม State สำหรับเก็บยศของผู้ใช้
  const [userRole, setUserRole] = useState("user");

  const [intervalMode, setIntervalMode] = useState('off');
  const [isReduceMode, setIsReduceMode] = useState(false);
  const [isShowPlayMode, setIsShowPlayMode] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [toolbarMode, setToolbarMode] = useState('default');
  
  const [isLoopAll, setIsLoopAll] = useState(false);
  const [isLoopOne, setIsLoopOne] = useState(false);
  const [selectedSymbolId, setSelectedSymbolId] = useState(null);

  const [pendingAction, setPendingAction] = useState({ isOpen: false, type: null, payload: null });
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const isImportingRef = useRef(false);

  const [layoutConfig, setLayoutConfig] = useState(createDefaultLayoutConfig);
  const [headerDetails, setHeaderDetails] = useState(createDefaultHeaderDetails);

  const isReadOnlyRef = useRef(false);
  const setReadOnlyMode = (readOnly) => {
    isReadOnlyRef.current = readOnly;
    setIsReadOnly(readOnly);
    if (readOnly) setProjectId(null); 
  };

  const layoutConfigRef = useRef(layoutConfig);
  const currentInstrumentRef = useRef(currentInstrument);
  const intervalModeRef = useRef(intervalMode);
  const isReduceModeRef = useRef(isReduceMode);
  const isShowPlayModeRef = useRef(isShowPlayMode);
  const isLoopAllRef = useRef(isLoopAll);
  const isLoopOneRef = useRef(isLoopOne);

  useEffect(() => { layoutConfigRef.current = layoutConfig; }, [layoutConfig]);
  useEffect(() => { currentInstrumentRef.current = currentInstrument; }, [currentInstrument]);
  useEffect(() => { intervalModeRef.current = intervalMode; }, [intervalMode]);
  useEffect(() => { isReduceModeRef.current = isReduceMode; }, [isReduceMode]);
  useEffect(() => { isShowPlayModeRef.current = isShowPlayMode; }, [isShowPlayMode]);
  useEffect(() => { isLoopAllRef.current = isLoopAll; }, [isLoopAll]);
  useEffect(() => { isLoopOneRef.current = isLoopOne; }, [isLoopOne]);

  // ⭐ ดึงยศ (Role) ทันทีที่มีการล็อคอิน
  useEffect(() => {
    const fetchRole = async () => {
      if (auth.currentUser?.uid) {
        try {
          const profile = await getUserProfile(auth.currentUser.uid);
          setUserRole(profile?.role || 'user');
        } catch (error) {
          console.error("ดึงข้อมูล Role ไม่สำเร็จ", error);
        }
      }
    };
    
    fetchRole();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchRole();
      } else {
        setUserRole("user");
      }
    });

    return () => unsubscribe();
  }, []);

  const onPreviewToken = (token, volume) => {
     playNote(currentInstrumentRef.current.id, token, volume);
  };

  const sheetEditor = useSheetEditor({
    isReadOnlyRef,
    currentInstrument,
    intervalModeRef,
    isReduceModeRef,
    layoutConfigRef,
    onPreviewToken
  });

  const sheetDataRef = useRef(sheetEditor.sheetData);
  const rowTypesRef = useRef(sheetEditor.rowTypes);
  const sectionLabelsRef = useRef(sheetEditor.sectionLabels);
  const symbolsRef = useRef(sheetEditor.symbols);

  useEffect(() => { sheetDataRef.current = sheetEditor.sheetData; }, [sheetEditor.sheetData]);
  useEffect(() => { rowTypesRef.current = sheetEditor.rowTypes; }, [sheetEditor.rowTypes]);
  useEffect(() => { sectionLabelsRef.current = sheetEditor.sectionLabels; }, [sheetEditor.sectionLabels]);
  useEffect(() => { symbolsRef.current = sheetEditor.symbols; }, [sheetEditor.symbols]);

  const audioPlayback = useAudioPlayback({
    sheetDataRef,
    rowTypesRef,
    sectionLabelsRef,
    symbolsRef,
    layoutConfigRef,
    currentInstrumentRef,
    intervalModeRef,
    isReduceModeRef,
    isShowPlayModeRef,
    isLoopAllRef,
    isLoopOneRef,
    selectedCellRef: sheetEditor.selectedCellRef,
    setSelectedCell: sheetEditor.setSelectedCell
  });

  useEffect(() => {
     // ⭐ แก้ไขการกำหนดค่า Ref ให้ถูกต้อง
     if (sheetEditor.isPlayingRef) {
       sheetEditor.isPlayingRef.current = audioPlayback.isPlayingRef.current;
     }
     sheetEditor.stopPlayback = audioPlayback.stopPlayback;
  }, [audioPlayback.isPlayingRef, audioPlayback.stopPlayback, sheetEditor]);

  useEffect(() => {
    primeAudioEngine().catch(() => {});
  }, []);

  const handleSetSongName = (newName) => {
    if (isReadOnlyRef.current) return;
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = newName;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    
    // บังคับให้ชื่อ Project และชื่อ Song ตรงกันเสมอ
    setProjectName(plainText);
    setSongName(newName);
  };

  const addDetail = () => { if (isReadOnlyRef.current) return; setHeaderDetails([...headerDetails, { id: headerDetails.length > 0 ? Math.max(...headerDetails.map(d => d.id)) + 1 : 1, label: "หัวข้อใหม่", value: "ระบุข้อมูล" }]); };
  const removeDetail = (id) => { if (isReadOnlyRef.current) return; setHeaderDetails(headerDetails.filter(detail => detail.id !== id)); };
  const updateDetail = (id, key, newValue) => { if (isReadOnlyRef.current) return; setHeaderDetails(headerDetails.map(detail => detail.id === id ? { ...detail, [key]: newValue } : detail)); };

  const changeInstrument = (instrumentId) => {
    if (isReadOnlyRef.current) return;
    
    let isBlockSelection = false;
    if (sheetEditor.selectionRange && sheetEditor.selectionRange.start && sheetEditor.selectionRange.end) {
      const { start: [sr, sm, sc], end: [er, em, ec] } = sheetEditor.selectionRange;
      if (sr !== er || sm !== em || sc !== ec) isBlockSelection = true;
    }
    
    if (isBlockSelection) {
      const { start: [sr, sm, sc], end: [er, em, ec] } = sheetEditor.selectionRange;
      const minR = Math.min(sr, er), maxR = Math.max(sr, er);
      const startCol = getFlattenedCol(sheetEditor.sheetData[sr], sheetEditor.rowTypes[sr], sm, sc);
      const endCol = getFlattenedCol(sheetEditor.sheetData[er], sheetEditor.rowTypes[er], em, ec);
      const minCol = Math.min(startCol, endCol), maxCol = Math.max(startCol, endCol);

      const newLayoutConfig = { ...layoutConfig };
      const newCustomStyles = { ...(newLayoutConfig.customStyles || {}) };
      let hasChanges = false;

      for (let r = minR; r <= maxR; r++) {
        if (sheetEditor.rowTypes[r] === 'page-break' || sheetEditor.rowTypes[r] === 'text') continue;
        let currentCol = 0;
        for (let m = 0; m < sheetEditor.sheetData[r].length; m++) {
          if (sheetEditor.rowTypes[r].startsWith('double') && m === 0) continue;
          for (let c = 0; c < sheetEditor.sheetData[r][m].length; c++) {
            if (currentCol >= minCol && currentCol <= maxCol) {
              const cellKey = `${r}_${m}_${c}`;
              newCustomStyles[cellKey] = { ...(newCustomStyles[cellKey] || {}), instrumentId };
              if (sheetEditor.rowTypes[r] === 'double-right') {
                 newCustomStyles[`${r+1}_${m}_${c}`] = { ...(newCustomStyles[`${r+1}_${m}_${c}`] || {}), instrumentId };
              } else if (sheetEditor.rowTypes[r] === 'double-left') {
                 newCustomStyles[`${r-1}_${m}_${c}`] = { ...(newCustomStyles[`${r-1}_${m}_${c}`] || {}), instrumentId };
              }
              hasChanges = true;
            }
            currentCol++;
          }
        }
      }

      if (hasChanges) {
        newLayoutConfig.customStyles = newCustomStyles;
        setLayoutConfig(newLayoutConfig);
        sheetEditor.commitChange(sheetEditor.sheetData, sheetEditor.rowTypes, sheetEditor.sectionLabels, sheetEditor.symbols, sheetEditor.rowMargins);
        sheetEditor.setSelectionRange(null); 
      }
    } else {
      const activeCell = sheetEditor.selectedCellRef.current || sheetEditor.selectedCell;
      const [r] = activeCell || [];
      const isNathapRow = Number.isInteger(r) && sheetEditor.rowTypes[r] === 'nathap';

      if (isNathapRow) {
        const newLayoutConfig = { ...layoutConfig };
        const newCustomStyles = { ...(newLayoutConfig.customStyles || {}) };
        
        for (let meas = 0; meas < sheetEditor.sheetData[r].length; meas++) {
          for (let cell = 0; cell < sheetEditor.sheetData[r][meas].length; cell++) {
            const cellKey = `${r}_${meas}_${cell}`;
            newCustomStyles[cellKey] = { ...(newCustomStyles[cellKey] || {}), instrumentId };
          }
        }
        newLayoutConfig.customStyles = newCustomStyles;
        setLayoutConfig(newLayoutConfig);

        const newData = sheetEditor.sheetData.map(row => row.map(meas => [...meas]));
        if (newData[r].length === 9) { 
          newData[r][0][0] = INSTRUMENT_CONFIG[instrumentId]?.name || 'เครื่องประกอบ';
        }
        sheetEditor.commitChange(newData, sheetEditor.rowTypes, sheetEditor.sectionLabels, sheetEditor.symbols, sheetEditor.rowMargins);
      }
      setCurrentInstrument(INSTRUMENT_CONFIG[instrumentId]);
    }
  };

  const resetProjectScopedState = ({ keepProjectId = false } = {}) => {
    const { defaultSheet, defaultTypes, defaultMargins } = sheetEditor.resetSheetState();
    setLayoutConfig(createDefaultLayoutConfig());
    setHeaderDetails(createDefaultHeaderDetails());
    setCurrentInstrument(DEFAULT_INSTRUMENT);
    audioPlayback.setPlaybackSequence([]);
    audioPlayback.setMetronomeConfig((current) => ({
      ...current,
      masterVolume: 80,
      ching: { ...current.ching, active: true, pattern: '', volume: 80 },
      klong: { ...current.klong, active: true, pattern: '', volume: 80 },
      krub: { ...current.krub, active: false, pattern: '', volume: 80 }
    }));
    setIsLoopAll(false);
    setIsLoopOne(false);
    setIntervalMode('off');
    setIsReduceMode(false);
    setIsShowPlayMode(false);
    setIsAutoScroll(true);
    setToolbarMode('default');
    setSelectedSymbolId(null);
    if (!keepProjectId) setProjectId(null);

    return { defaultSheet, defaultTypes, defaultMargins };
  };

  const executeAction = (type, payload) => {
    if (type === 'NEW') performNewProject();
    else if (type === 'LOAD_LOCAL') performLoadProject(payload);
    else if (type === 'LOAD_FIREBASE') performLoadProjectFromFirebase(payload);
    setPendingAction({ isOpen: false, type: null, payload: null });
  };
  
  const checkUnsavedAndPrompt = (type, payload, skipWarning = false) => {
    if (isReadOnlyRef.current) { executeAction(type, payload); return; }
    const isFreshProject = !projectId && sheetEditor.historyIndex <= 0 && projectName === "โปรเจกต์ไม่มีชื่อ";
    if (skipWarning || isFreshProject) executeAction(type, payload);
    else setPendingAction({ isOpen: true, type, payload });
  };

  const performNewProject = () => {
    isImportingRef.current = true;
    const { defaultSheet, defaultTypes, defaultMargins } = resetProjectScopedState();
    setSongName("เพลงใหม่");
    setProjectName("โปรเจกต์ไม่มีชื่อ");
    localStorage.removeItem('thaiMusicEditorAutoSave');
    sheetEditor.commitChange(defaultSheet, defaultTypes, {}, [], defaultMargins);
    setTimeout(() => { isImportingRef.current = false; }, 1000);
  };

  const performLoadProject = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      isImportingRef.current = true;
      try {
        const data = JSON.parse(e.target.result);
        const fileNameWithoutExt = file.name ? file.name.replace(/\.[^/.]+$/, "") : "";
        const targetProjectName = data.name || fileNameWithoutExt || "โปรเจกต์ไม่มีชื่อ";
        
        const { defaultSheet, defaultTypes, defaultMargins } = resetProjectScopedState();
        setProjectName(targetProjectName);
        setSongName(data.songName || targetProjectName);

        let parsedSheetData = data.sheetData;
        if (data.sheetData) {
          parsedSheetData = typeof data.sheetData === 'string' ? JSON.parse(data.sheetData) : data.sheetData;
          const migrateRowTypes = data.rowTypes || defaultTypes;
          if (Array.isArray(parsedSheetData)) {
            parsedSheetData = parsedSheetData.map((row, rIdx) => {
              if (migrateRowTypes[rIdx] === 'nathap') {
                let parentRIdx = rIdx - 1;
                while (parentRIdx >= 0 && (migrateRowTypes[parentRIdx] === 'annotation' || migrateRowTypes[parentRIdx] === 'nathap')) parentRIdx--;
                const isUnderDouble = parentRIdx >= 0 && migrateRowTypes[parentRIdx]?.startsWith('double');
                return Array.isArray(row) ? normalizeNathapRowData(row, isUnderDouble) : row;
              }
              return row;
            });
          }
        } else {
          parsedSheetData = defaultSheet;
        }

        const loadedRowTypes = data.rowTypes || defaultTypes;
        const loadedMargins = Array.isArray(data.rowMargins) ? data.rowMargins : Array(parsedSheetData?.length || defaultMargins.length).fill({ top: 0, bottom: 0, left: 0 });
        
        // ⭐ ใช้ฟังก์ชัน commitChange หรือตั้งค่าผ่าน sheetEditor แทน
        setLayoutConfig({ ...createDefaultLayoutConfig(), ...(data.layoutConfig || {}) });
        setHeaderDetails(data.headerDetails || createDefaultHeaderDetails());
        setCurrentInstrument((data.currentInstrument && INSTRUMENT_CONFIG[data.currentInstrument]) ? INSTRUMENT_CONFIG[data.currentInstrument] : DEFAULT_INSTRUMENT);
        audioPlayback.setPlaybackSequence(data.playbackSequence || []);
        audioPlayback.setMetronomeConfig((current) => applyMetronomeProjectSettings(current, data.metronomeSettings));
        setIsLoopAll(data.isLoopAll !== undefined ? data.isLoopAll : false);
        setIsLoopOne(data.isLoopOne !== undefined ? data.isLoopOne : false);
        setIntervalMode(data.intervalMode !== undefined ? data.intervalMode : (data.isOctaveMode ? '8' : 'off'));
        setIsReduceMode(data.isReduceMode !== undefined ? data.isReduceMode : false);
        setIsShowPlayMode(data.isShowPlayMode !== undefined ? data.isShowPlayMode : false);

        // ส่ง loadedRowTypes เข้าไปพร้อมกันตอน commitChange ตรงนี้เลย
        sheetEditor.commitChange(parsedSheetData, loadedRowTypes, data.sectionLabels || {}, data.symbols || [], loadedMargins);
      } catch (error) {
        console.error("Load project error:", error);
        alert("ไฟล์ไม่ถูกต้อง หรือไฟล์เสียหายครับ!"); 
      } finally {
        setTimeout(() => { isImportingRef.current = false; }, 1000);
      }
    };
    reader.readAsText(file);
  };

  const performLoadProjectFromFirebase = (projectData) => {
    isImportingRef.current = true;
    try {
      const parsedFromSource = typeof projectData.sheetData === 'string' ? JSON.parse(projectData.sheetData) : projectData.sheetData;
      const { defaultSheet, defaultTypes, defaultMargins } = resetProjectScopedState({ keepProjectId: true });
      const parsedSheetData = parsedFromSource || defaultSheet;

      if (projectData.id) setProjectId(projectData.id);
      
      // ⭐ ใช้ระบบบังคับชื่อให้ตรงกันเสมอ
      const loadName = projectData.name || projectData.songName || "โปรเจกต์ไม่มีชื่อ";
      setProjectName(loadName);
      setSongName(projectData.songName || loadName);

      const migrateRowTypes = projectData.rowTypes || defaultTypes;
      const migratedSheetData = Array.isArray(parsedSheetData) ? parsedSheetData.map((row, rIdx) => {
        if (migrateRowTypes[rIdx] === 'nathap') {
          let parentRIdx = rIdx - 1;
          while (parentRIdx >= 0 && (migrateRowTypes[parentRIdx] === 'annotation' || migrateRowTypes[parentRIdx] === 'nathap')) parentRIdx--;
          const isUnderDouble = parentRIdx >= 0 && migrateRowTypes[parentRIdx]?.startsWith('double');
          return normalizeNathapRowData(row, isUnderDouble);
        }
        return row;
      }) : parsedSheetData;

      const loadedMargins = Array.isArray(projectData.rowMargins) ? projectData.rowMargins : Array(parsedSheetData?.length || defaultMargins.length).fill({ top: 0, bottom: 0, left: 0 });
      setLayoutConfig({ ...createDefaultLayoutConfig(), ...(projectData.layoutConfig || {}) });
      setHeaderDetails(projectData.headerDetails || createDefaultHeaderDetails());
      setCurrentInstrument((projectData.currentInstrument && INSTRUMENT_CONFIG[projectData.currentInstrument]) ? INSTRUMENT_CONFIG[projectData.currentInstrument] : DEFAULT_INSTRUMENT);
      audioPlayback.setPlaybackSequence(projectData.playbackSequence || []);
      audioPlayback.setMetronomeConfig((current) => applyMetronomeProjectSettings(current, projectData.metronomeSettings));
      setIsLoopAll(projectData.isLoopAll !== undefined ? projectData.isLoopAll : false);
      setIsLoopOne(projectData.isLoopOne !== undefined ? projectData.isLoopOne : false);
      setIntervalMode(projectData.intervalMode !== undefined ? projectData.intervalMode : (projectData.isOctaveMode ? '8' : 'off'));
      setIsReduceMode(projectData.isReduceMode !== undefined ? projectData.isReduceMode : false);
      setIsShowPlayMode(projectData.isShowPlayMode !== undefined ? projectData.isShowPlayMode : false);

      sheetEditor.commitChange(migratedSheetData, migrateRowTypes, projectData.sectionLabels || {}, projectData.symbols || [], loadedMargins);
    } catch (error) {
      console.error("โหลดโปรเจกต์ไม่สำเร็จ:", error);
      alert("ไม่สามารถโหลดข้อมูลจาก Firebase ได้!");
    } finally {
      setTimeout(() => { isImportingRef.current = false; }, 1000);
    }
  };

  const saveProject = () => {
    const projectData = { 
      name: projectName, songName, 
      sheetData: sheetEditor.sheetData, rowTypes: sheetEditor.rowTypes, sectionLabels: sheetEditor.sectionLabels, symbols: sheetEditor.symbols, rowMargins: sheetEditor.rowMargins, 
      layoutConfig, headerDetails, currentInstrument: currentInstrument.id, playbackSequence: audioPlayback.playbackSequence,
      metronomeSettings: getMetronomeProjectSettings(audioPlayback.metronomeConfig),
      isLoopAll, isLoopOne, intervalMode, isReduceMode, isShowPlayMode 
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${projectName || 'my-song'}.tme`; a.click(); URL.revokeObjectURL(url);
  };

  const autoSaveToFirebase = async (data, currentProjectId) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const id = await saveProjectToDB(uid, currentProjectId, data);
      if (!currentProjectId && id) setProjectId(id);
    } catch (err) {
      if (err.message === "STORAGE_LIMIT_EXCEEDED") {
        setReadOnlyMode(true); 
        setPendingAction({ isOpen: true, type: 'STORAGE_LIMIT', payload: null });
      } else console.error("Auto-save failed:", err);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('thaiMusicEditorAutoSave');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const restoredId = data.projectId || data.id || null;
        if (restoredId) setProjectId(restoredId);
        
        // ⭐ ซิงค์ชื่อตอนโหลด LocalStorage
        const loadName = data.name || data.songName || "โปรเจกต์ไม่มีชื่อ";
        setProjectName(loadName);
        setSongName(data.songName || loadName);
        
        const restoredRowTypes = data.rowTypes || createDefaultRowTypes();
        const restoredSheetData = Array.isArray(data.sheetData) ? data.sheetData.map((row, rIdx) => {
            if (restoredRowTypes[rIdx] === 'nathap') {
              let parentRIdx = rIdx - 1;
              while (parentRIdx >= 0 && (restoredRowTypes[parentRIdx] === 'annotation' || restoredRowTypes[parentRIdx] === 'nathap')) parentRIdx--;
              const isUnderDouble = parentRIdx >= 0 && restoredRowTypes[parentRIdx]?.startsWith('double');
              return Array.isArray(row) ? normalizeNathapRowData(row, isUnderDouble) : row;
            }
            return row;
          }) : data.sheetData;

        setLayoutConfig({ ...createDefaultLayoutConfig(), ...(data.layoutConfig || {}) });
        if (data.headerDetails) setHeaderDetails(data.headerDetails);
        if (data.currentInstrument && INSTRUMENT_CONFIG[data.currentInstrument]) setCurrentInstrument(INSTRUMENT_CONFIG[data.currentInstrument]);
        if (data.playbackSequence) audioPlayback.setPlaybackSequence(data.playbackSequence);
        audioPlayback.setMetronomeConfig((current) => applyMetronomeProjectSettings(current, data.metronomeSettings));
        if (data.isLoopAll !== undefined) setIsLoopAll(data.isLoopAll);
        if (data.isLoopOne !== undefined) setIsLoopOne(data.isLoopOne);
        setIntervalMode(data.intervalMode !== undefined ? data.intervalMode : (data.isOctaveMode ? '8' : 'off'));
        if (data.isReduceMode !== undefined) setIsReduceMode(data.isReduceMode);
        if (data.isShowPlayMode !== undefined) setIsShowPlayMode(data.isShowPlayMode); 

        const loadedMargins = data.rowMargins || Array(restoredSheetData?.length || 4).fill({ top: 0, bottom: 0, left: 0 });
        sheetEditor.commitChange(restoredSheetData || sheetEditor.sheetData, data.rowTypes || sheetEditor.rowTypes, data.sectionLabels || sheetEditor.sectionLabels, data.symbols || sheetEditor.symbols, loadedMargins);
      } catch (error) {
        sheetEditor.commitChange(sheetEditor.sheetData, sheetEditor.rowTypes, sheetEditor.sectionLabels, sheetEditor.symbols, sheetEditor.rowMargins);
      }
    } else {
      sheetEditor.commitChange(sheetEditor.sheetData, sheetEditor.rowTypes, sheetEditor.sectionLabels, sheetEditor.symbols, sheetEditor.rowMargins);
    }
    setIsLoaded(true);
  }, []); 

  useEffect(() => {
    if (!isLoaded || isImportingRef.current || isReadOnly) return; 
    const isFreshProject = !projectId && sheetEditor.historyIndex <= 0 && projectName === "โปรเจกต์ไม่มีชื่อ" && songName === "เพลงใหม่";

    const projectData = { 
      projectId: projectId, id: projectId, 
      name: projectName, songName, 
      sheetData: sheetEditor.sheetData, rowTypes: sheetEditor.rowTypes, sectionLabels: sheetEditor.sectionLabels, symbols: sheetEditor.symbols, rowMargins: sheetEditor.rowMargins,
      layoutConfig, headerDetails, currentInstrument: currentInstrument.id, playbackSequence: audioPlayback.playbackSequence,
      metronomeSettings: getMetronomeProjectSettings(audioPlayback.metronomeConfig),
      isLoopAll, isLoopOne, intervalMode, isReduceMode, isShowPlayMode 
    };
    
    localStorage.setItem('thaiMusicEditorAutoSave', JSON.stringify(projectData));

    if (!isFreshProject) {
      const debounceTimer = setTimeout(() => autoSaveToFirebase(projectData, projectId), 2000);
      return () => clearTimeout(debounceTimer);
    }
  }, [isLoaded, projectName, songName, sheetEditor.sheetData, sheetEditor.rowTypes, sheetEditor.sectionLabels, sheetEditor.symbols, layoutConfig, headerDetails, currentInstrument, sheetEditor.rowMargins, audioPlayback.playbackSequence, audioPlayback.metronomeConfig, isLoopAll, isLoopOne, intervalMode, isReduceMode, isShowPlayMode, projectId, sheetEditor.historyIndex, isReadOnly]);

  const actionsRef = useRef({});
  useEffect(() => {
    actionsRef.current = {
      undo: sheetEditor.undo, redo: sheetEditor.redo, 
      copySelection: sheetEditor.copySelection, pasteSelection: sheetEditor.pasteSelection, cutSelection: sheetEditor.cutSelection, 
      togglePlay: audioPlayback.togglePlay, 
      inputNote: sheetEditor.inputNote, 
      removeSymbol: sheetEditor.removeSymbol, removeSymbolByCell: sheetEditor.removeSymbolByCell, 
      addRow: sheetEditor.addRow, addDoubleRow: sheetEditor.addDoubleRow, removeRow: sheetEditor.removeRow, 
      setSelectionRange: sheetEditor.setSelectionRange, setSelectedCell: sheetEditor.setSelectedCell,
      setSelectedSymbolId
    };
  });

  useEffect(() => {
    let isCtrlCombination = false; 

    const handleKeyDown = (e) => {
      // ⭐ สกัดกั้นตรงนี้: ถ้าหน้าจัดวง (Arranger) เปิดอยู่ ให้ตัดจบคำสั่งทันที! ป้องกันเสียงซ้อน
      if (document.getElementById('workspace-overlay')) return;

      const tag = e.target?.tagName;
      const isEditable = e.target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      
      if (e.code === 'Space') {
        if (!isEditable) {
          e.preventDefault(); e.stopPropagation();  
          if (document.activeElement && document.activeElement.tagName !== 'BODY') document.activeElement.blur();
          actionsRef.current.togglePlay(); return;
        }
      }
      if (isEditable) return; 

      if (e.ctrlKey && e.key !== 'Control') isCtrlCombination = true;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (isReadOnlyRef.current) { e.preventDefault(); return; } 
        e.preventDefault();
        
        if (selectedSymbolId) {
          actionsRef.current.removeSymbol(selectedSymbolId);
          actionsRef.current.setSelectedSymbolId(null);
        } else if (sheetEditor.selectedCellRef.current) {
          if (e.key === 'Backspace') {
             actionsRef.current.removeSymbolByCell(sheetEditor.selectedCellRef.current);
             actionsRef.current.inputNote('BACKSPACE');
          } else {
             actionsRef.current.removeRow(); 
          }
        }
        return;
      }

      if (e.key === 'Insert') {
        if (isReadOnlyRef.current) { e.preventDefault(); return; }
        e.preventDefault();
        if (sheetEditor.selectedCellRef.current) {
          const [rIdx] = sheetEditor.selectedCellRef.current;
          const currentType = sheetEditor.rowTypes[rIdx]; 
          if (currentType && currentType.startsWith('double')) actionsRef.current.addDoubleRow(); 
          else actionsRef.current.addRow(); 
        }
        return;
      }

      if (e.key.startsWith('Arrow')) {
        e.preventDefault(); 
        if (!sheetEditor.selectedCellRef.current) return;
        
        let [r, m, c] = sheetEditor.selectedCellRef.current;
        const sheet = sheetEditor.sheetData;
        const rTypes = sheetEditor.rowTypes;
        
        if (e.key === 'ArrowRight') {
          if (c < sheet[r][m].length - 1) c++;
          else if (m < sheet[r].length - 1) { m++; c = 0; }
          else {
             let nextR = r + 1;
             while (nextR < sheet.length && (rTypes[nextR] === 'page-break' || rTypes[nextR] === 'text')) nextR++;
             if (nextR < sheet.length) { r = nextR; m = (rTypes[r].startsWith('double') || (rTypes[r] === 'nathap' && sheet[r].length === 9)) ? 1 : 0; c = 0; }
          }
        } else if (e.key === 'ArrowLeft') {
          if (c > 0) c--;
          else if (m > ((rTypes[r].startsWith('double') || (rTypes[r] === 'nathap' && sheet[r].length === 9)) ? 1 : 0)) { m--; c = sheet[r][m].length - 1; }
          else {
             let prevR = r - 1;
             while (prevR >= 0 && (rTypes[prevR] === 'page-break' || rTypes[prevR] === 'text')) prevR--;
             if (prevR >= 0) { r = prevR; m = sheet[r].length - 1; c = sheet[r][m].length - 1; }
          }
        } else if (e.key === 'ArrowDown') {
          let nextR = r + 1;
          while (nextR < sheet.length && (rTypes[nextR] === 'page-break' || rTypes[nextR] === 'text')) nextR++;
          if (nextR < sheet.length) {
             r = nextR;
             if (m >= sheet[r].length) m = sheet[r].length - 1;
             if ((rTypes[r].startsWith('double') || (rTypes[r] === 'nathap' && sheet[r].length === 9)) && m === 0) m = 1;
             if (c >= sheet[r][m].length) c = sheet[r][m].length - 1;
          }
        } else if (e.key === 'ArrowUp') {
          let prevR = r - 1;
          while (prevR >= 0 && (rTypes[prevR] === 'page-break' || rTypes[prevR] === 'text')) prevR--;
          if (prevR >= 0) {
             r = prevR;
             if (m >= sheet[r].length) m = sheet[r].length - 1;
             if ((rTypes[r].startsWith('double') || (rTypes[r] === 'nathap' && sheet[r].length === 9)) && m === 0) m = 1;
             if (c >= sheet[r][m].length) c = sheet[r][m].length - 1;
          }
        }
        
        actionsRef.current.setSelectedCell([r, m, c]);
        actionsRef.current.setSelectionRange(null);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ') { e.preventDefault(); if (!isReadOnlyRef.current) actionsRef.current.undo(); } 
        else if (e.code === 'KeyR' || e.code === 'KeyY') { e.preventDefault(); if (!isReadOnlyRef.current) actionsRef.current.redo(); } 
        else if (e.code === 'KeyC') { e.preventDefault(); actionsRef.current.copySelection(); }
        else if (e.code === 'KeyV') { e.preventDefault(); if (!isReadOnlyRef.current) actionsRef.current.pasteSelection(); }
        else if (e.code === 'KeyX') { e.preventDefault(); if (!isReadOnlyRef.current) actionsRef.current.cutSelection(); }
        else if (e.code === 'KeyA') {
          e.preventDefault(); 
          const sheet = sheetEditor.sheetData;
          const rTypes = sheetEditor.rowTypes;
          let firstCell = null, lastCell = null;
          
          for (let r = 0; r < sheet.length; r++) {
            if (rTypes[r] === 'page-break' || rTypes[r] === 'text') continue;
            const startM = (rTypes[r].startsWith('double') || (rTypes[r] === 'nathap' && sheet[r].length === 9)) ? 1 : 0;
            if (!firstCell && sheet[r] && sheet[r].length > startM) firstCell = [r, startM, 0];
            if (sheet[r] && sheet[r].length > 0) {
               const lastM = sheet[r].length - 1;
               const lastC = sheet[r][lastM].length - 1;
               lastCell = [r, lastM, lastC];
            }
          }
          if (firstCell && lastCell) {
             actionsRef.current.setSelectionRange({ start: firstCell, end: lastCell });
             actionsRef.current.setSelectedCell(lastCell); 
          }
        }
      }
    };

    const handleKeyUp = (e) => {
      const tag = e.target?.tagName;
      const isEditable = e.target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (isEditable) return; 
      if (e.code === 'ControlRight') {
        if (!isReadOnlyRef.current && !isCtrlCombination && sheetEditor.selectedCellRef.current) actionsRef.current.inputNote('-');
      }
      if (e.key === 'Control') isCtrlCombination = false;
    };
    
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true); 
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true); 
    };
  }, [selectedSymbolId, sheetEditor]); 

  const availableSections = useMemo(() => {
    const labels = new Set();
    Object.values(sheetEditor.sectionLabels).forEach(arr => {
      arr.forEach(l => { if (l.text && l.text.trim() !== '') labels.add(l.text.trim()); });
    });
    return Array.from(labels);
  }, [sheetEditor.sectionLabels]);

  const visualRowCount = useMemo(() => sheetEditor.rowTypes.filter(type => type === 'single' || type === 'double-right').length, [sheetEditor.rowTypes]);

  return (
    <MusicContext.Provider value={{ 
      currentInstrument, changeInstrument, 
      songName, setSongName: handleSetSongName, 
      projectName, setProjectName,
      layoutConfig, setLayoutConfig, 
      headerDetails, addDetail, removeDetail, updateDetail,
      selectedSymbolId, setSelectedSymbolId,
      intervalMode, setIntervalMode,
      isReduceMode, setIsReduceMode, 
      isShowPlayMode, setIsShowPlayMode,
      isAutoScroll, setIsAutoScroll, 
      toolbarMode, setToolbarMode,
      isLoopAll, setIsLoopAll,
      isLoopOne, setIsLoopOne,
      isReadOnly,
      userRole, // ⭐ ปล่อยตัวแปร userRole ให้ Keyboard ใช้งาน

      ...sheetEditor,
      canUndo: sheetEditor.historyIndex > 0, 
      canRedo: sheetEditor.historyIndex < sheetEditor.history.length - 1,
      
      ...audioPlayback,
      
      shiftNoteObject, shiftNoteString,
      visualRowCount, availableSections,
      INSTRUMENT_CONFIG,
      
      saveProject, 
      loadProject: (file, skipWarning) => checkUnsavedAndPrompt('LOAD_LOCAL', file, skipWarning || isReadOnlyRef.current), 
      loadProjectFromFirebase: (data, skipWarning, readOnly) => { setReadOnlyMode(readOnly); checkUnsavedAndPrompt('LOAD_FIREBASE', data, skipWarning || (isReadOnlyRef.current && !readOnly)); }, 
      newProject: (skipWarning) => checkUnsavedAndPrompt('NEW', null, skipWarning || isReadOnlyRef.current),
      applyTemplate: (templateData) => {
        resetProjectScopedState();
        setSongName(templateData.defaultSongName || "เพลงใหม่");
        setProjectName("โปรเจกต์ไม่มีชื่อ");
        setHeaderDetails(templateData.headerDetails || createDefaultHeaderDetails());
        if (templateData.detailsAlign) setLayoutConfig(prev => ({ ...prev, detailsAlign: templateData.detailsAlign }));
      }
    }}>
      
      {pendingAction.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl scale-100 animate-slideUp text-center" style={{ fontFamily: 'Prompt, sans-serif' }}>
            
            {pendingAction.type === 'STORAGE_LIMIT' ? (
              <>
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">พื้นที่จัดเก็บเต็มแล้ว!</h3>
                <p className="text-sm text-slate-500 mb-6">
                  ระบบไม่สามารถบันทึกอัตโนมัติได้และได้ทำการ <strong className="text-red-500">ล็อกการแก้ไข (Read-only)</strong> เพื่อป้องกันข้อมูลสูญหาย<br/><br/>
                  กรุณา <strong>ส่งออก (Export)</strong> ไฟล์ลงเครื่องคอมพิวเตอร์ของคุณ จากนั้นกลับไปลบโปรเจกต์เก่าที่หน้าแรกครับ
                </p>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => { saveProject(); setPendingAction({ isOpen: false, type: null, payload: null }); }} 
                    className="w-full py-3 font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.98]"
                  >
                    📥 ส่งออกไฟล์ .tme ลงเครื่อง
                  </button>
                  <button 
                    onClick={() => setPendingAction({ isOpen: false, type: null, payload: null })} 
                    className="w-full py-3 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors active:scale-[0.98]"
                  >
                    ปิดแจ้งเตือน (ดูโน้ตได้อย่างเดียว)
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">คุณมีงานที่ค้างอยู่</h3>
                <p className="text-sm text-slate-500 mb-6">หากเปิดโปรเจกต์ใหม่ตอนนี้ ข้อมูลบนหน้าจอที่ยังไม่ได้บันทึกจะหายไป ต้องการบันทึกก่อนหรือไม่?</p>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={async () => {
                      const projectData = { 
                        name: projectName, songName, sheetData: sheetEditor.sheetData, rowTypes: sheetEditor.rowTypes, sectionLabels: sheetEditor.sectionLabels, 
                        symbols: sheetEditor.symbols, layoutConfig, headerDetails, currentInstrument: currentInstrument.id, 
                        rowMargins: sheetEditor.rowMargins, playbackSequence: audioPlayback.playbackSequence,
                        metronomeSettings: getMetronomeProjectSettings(audioPlayback.metronomeConfig)
                      };
                      await autoSaveToFirebase(projectData, projectId);
                      executeAction(pendingAction.type, pendingAction.payload);
                    }} 
                    className="w-full py-3 font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-xl transition-all shadow-md shadow-sky-500/20 active:scale-[0.98]"
                  >
                    บันทึกลงฐานข้อมูล
                  </button>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setPendingAction({ isOpen: false, type: null, payload: null })} 
                      className="flex-1 py-3 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors active:scale-[0.98]"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      onClick={() => executeAction(pendingAction.type, pendingAction.payload)} 
                      className="flex-1 py-3 font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors active:scale-[0.98]"
                    >
                      ไม่บันทึก (ทิ้งงาน)
                    </button>
                  </div>
                </div>
              </>
            )}
            
          </div>
        </div>
      )}
      {children}
    </MusicContext.Provider>
  );
};
