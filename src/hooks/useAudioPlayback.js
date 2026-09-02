import { useState, useRef, useEffect } from 'react';
import { db } from '../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { INSTRUMENT_CONFIG } from '../utils/instrumentConfig';
import { 
  preloadSounds, preloadNote, scheduleNote, initAudioContext,
  getAudioCurrentTime, stopAllScheduledNotes, stopScheduledNotesByGroup,
  claimPlaybackOwnership, releasePlaybackOwnership 
} from '../utils/audioEngine';
import { 
  getVisualIndex, shiftNoteString, getIntervalPair, 
  splitThaiNoteToken, parseCellToken 
} from '../utils/sheetUtils';

const INDEPENDENT_METRONOME_GROUP = 'editor-independent-metronome';
const LINKED_METRONOME_GROUP = 'editor-linked-metronome';
const BACKGROUND_SCHEDULE_AHEAD_SEC = 15 * 60;
const BACKGROUND_METRONOME_AHEAD_SEC = 30;

export const useAudioPlayback = ({
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
  selectedCellRef,
  setSelectedCell
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackCursor, setPlaybackCursor] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [playbackSequence, setPlaybackSequence] = useState([]);
  const [activeSequenceIdx, setActiveSequenceIdx] = useState(0);
  const [activeLoop, setActiveLoop] = useState(1);

  const [metronomeConfig, setMetronomeConfig] = useState({
    enabled: false,
    linked: true,
    masterVolume: 80,
    ching: { active: true, pattern: '', volume: 80 },
    klong: { active: true, pattern: '', volume: 80 },
    krub: { active: false, pattern: '', volume: 80 },
    rhythms: { ching: [], klong: [], krub: [] }
  });

  const isPlayingRef = useRef(false);
  
  const globalBeatCountRef = useRef(0);
  const playbackSequenceRef = useRef(playbackSequence);
  const activeSequenceIdxRef = useRef(0);
  const activeLoopRef = useRef(1);
  const playbackCursorRef = useRef(null);
  const metronomeConfigRef = useRef(metronomeConfig);
  
  const uiTimerRef = useRef(null);
  const playbackStartTimeRef = useRef(0);
  const seekOffsetRef = useRef(0);
  const playbackTimerRef = useRef(null);
  const schedulerIntervalRef = useRef(null);
  const schedulerStateRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const runAudioSchedulerRef = useRef(null);
  const isPageHiddenRef = useRef(typeof document !== 'undefined' ? document.hidden : false);
  const effectTimersRef = useRef(new Set());
  const mutedCellsRef = useRef(new Set());
  const pendingPlaybackCursorRef = useRef(null);
  const playbackCursorRafRef = useRef(null);
  const sheetMapRef = useRef([]);
  const independentMetronomeIntervalRef = useRef(null);
  const runIndependentMetronomeSchedulerRef = useRef(null);
  const mediaSessionActionsRef = useRef({});

  useEffect(() => { playbackSequenceRef.current = playbackSequence; }, [playbackSequence]);
  useEffect(() => { metronomeConfigRef.current = metronomeConfig; }, [metronomeConfig]);
  useEffect(() => { playbackCursorRef.current = playbackCursor; }, [playbackCursor]);

  useEffect(() => {
    const fetchRhythms = async () => {
      try {
        const docRef = doc(db, "system_rhythms", "master");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const allPatterns = data.patterns || [];
          const chingPatterns = allPatterns.filter(p => p.instrumentId === 'ching');
          const klongPatterns = allPatterns.filter(p => p.instrumentId === 'klong-khaek');
          const krubPatterns = allPatterns.filter(p => p.instrumentId === 'krub');

          setMetronomeConfig(prev => ({
            ...prev,
            rhythms: { ching: chingPatterns, klong: klongPatterns, krub: krubPatterns },
            // ใช้หน้าทับจากไฟล์โปรเจกต์ถ้ายังมีอยู่ในระบบกลาง; ไม่เช่นนั้นค่อยเลือกตัวแรก
            ching: { ...prev.ching, pattern: chingPatterns.some(p => p.id === prev.ching.pattern) ? prev.ching.pattern : (chingPatterns[0]?.id || '') },
            klong: { ...prev.klong, pattern: klongPatterns.some(p => p.id === prev.klong.pattern) ? prev.klong.pattern : (klongPatterns[0]?.id || '') },
            krub: { ...prev.krub, pattern: krubPatterns.some(p => p.id === prev.krub.pattern) ? prev.krub.pattern : (krubPatterns[0]?.id || '') }
          }));
        }
      } catch (error) {
        console.error("Error fetching rhythms:", error);
      }
    };
    fetchRhythms();
  }, []);

  useEffect(() => {
    const stopIndependentMetronome = () => {
      if (independentMetronomeIntervalRef.current) {
        clearInterval(independentMetronomeIntervalRef.current);
        independentMetronomeIntervalRef.current = null;
      }
      stopScheduledNotesByGroup(INDEPENDENT_METRONOME_GROUP);
    };

    if (!metronomeConfig.enabled) {
      stopIndependentMetronome();
      stopScheduledNotesByGroup(LINKED_METRONOME_GROUP);
      return undefined;
    }

    if (metronomeConfig.linked !== false) {
      stopIndependentMetronome();
      return undefined;
    }

    // Any linked beats already reserved by the sheet look-ahead must not overlap
    // the newly started independent loop.
    stopScheduledNotesByGroup(LINKED_METRONOME_GROUP);

    let cancelled = false;
    let nextBeatTime = 0;
    let beatIndex = 0;

    const playPatternToken = (instrumentId, token, volume) => {
      if (!token || token === '-') return;
      splitThaiNoteToken(token).forEach((note) => {
        if (!note || note === '-') return;
        scheduleNote(
          instrumentId,
          note,
          nextBeatTime,
          volume,
          undefined,
          false,
          INDEPENDENT_METRONOME_GROUP
        );
      });
    };

    const scheduleIndependentBeats = () => {
      if (cancelled) return;
      const now = getAudioCurrentTime();
      const lookAhead = isPageHiddenRef.current ? BACKGROUND_METRONOME_AHEAD_SEC : 0.25;
      if (!nextBeatTime || nextBeatTime < now - 0.05) nextBeatTime = now + 0.05;

      while (nextBeatTime < now + lookAhead) {
        const config = metronomeConfigRef.current;
        const masterVolume = Math.max(0, Math.min(100, Number(config.masterVolume) || 0)) / 100;
        const instruments = [
          ['ching', 'ching'],
          ['klong', 'klong-khaek'],
          ['krub', 'krub']
        ];

        instruments.forEach(([key, instrumentId]) => {
          const instrument = config[key];
          const patterns = config.rhythms?.[key] || [];
          if (!instrument?.active || patterns.length === 0) return;
          const pattern = patterns.find((item) => item.id === instrument.pattern) || patterns[0];
          if (!pattern?.pattern?.length) return;
          const volume = masterVolume * (Number(instrument.volume) || 0);
          if (volume > 0) playPatternToken(instrumentId, pattern.pattern[beatIndex % pattern.pattern.length], volume);
        });

        const bpm = Math.max(20, Number(layoutConfigRef.current.bpm) || 80);
        nextBeatTime += 15 / bpm;
        beatIndex += 1;
      }
    };

    runIndependentMetronomeSchedulerRef.current = scheduleIndependentBeats;

    initAudioContext()
      .then(async () => {
        if (cancelled) return;
        const config = metronomeConfigRef.current;
        const preloadIds = [];
        if (config.ching?.active) preloadIds.push('ching');
        if (config.klong?.active) preloadIds.push('klong-khaek');
        if (config.krub?.active) preloadIds.push('krub');
        await Promise.allSettled(preloadIds.map((id) => preloadSounds(id)));
        if (cancelled) return;
        scheduleIndependentBeats();
        independentMetronomeIntervalRef.current = setInterval(scheduleIndependentBeats, 50);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      runIndependentMetronomeSchedulerRef.current = null;
      stopIndependentMetronome();
    };
  }, [metronomeConfig.enabled, metronomeConfig.linked, layoutConfigRef]);

  useEffect(() => {
    const prepareBackgroundAudio = () => {
      if (!isPlayingRef.current) return;
      isPageHiddenRef.current = true;
      // Window minimization can fire blur before visibilitychange. Reserve the
      // long background queue at the earliest event, before timers are frozen.
      runAudioSchedulerRef.current?.();
      runIndependentMetronomeSchedulerRef.current?.();
      initAudioContext?.().catch(() => {});
    };

    const restoreForegroundAudio = () => {
      if (document.hidden) return;
      isPageHiddenRef.current = false;
      if (!isPlayingRef.current || !initAudioContext) return;
      initAudioContext()
        .then(() => {
          runAudioSchedulerRef.current?.();
          runIndependentMetronomeSchedulerRef.current?.();
        })
        .catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.hidden) prepareBackgroundAudio();
      else restoreForegroundAudio();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', prepareBackgroundAudio);
    window.addEventListener('focus', restoreForegroundAudio);
    window.addEventListener('pageshow', restoreForegroundAudio);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', prepareBackgroundAudio);
      window.removeEventListener('focus', restoreForegroundAudio);
      window.removeEventListener('pageshow', restoreForegroundAudio);
    };
  }, []);

  const getCellId = (r, m, c) => r * 100000 + m * 1000 + c;

  const schedulePlaybackCursorUpdate = (nextCursor) => {
    pendingPlaybackCursorRef.current = nextCursor;
    if (playbackCursorRafRef.current) return;
    playbackCursorRafRef.current = requestAnimationFrame(() => {
      playbackCursorRafRef.current = null;
      const pending = pendingPlaybackCursorRef.current;
      if (!pending) return;
      const prev = playbackCursorRef.current;
      if (!prev || prev[0] !== pending[0] || prev[1] !== pending[1] || prev[2] !== pending[2]) {
        playbackCursorRef.current = pending;
        setPlaybackCursor(pending);
      }
    });
  };

  // Keep only pending visual timers. On long songs the old implementation kept
  // every completed timer id until playback stopped, which gradually increased
  // memory/GC work on mobile devices.
  const scheduleManagedEffectTimer = (callback, delayMs) => {
    const timerId = setTimeout(() => {
      effectTimersRef.current.delete(timerId);
      callback();
    }, delayMs);
    effectTimersRef.current.add(timerId);
    return timerId;
  };

  const queuePlayModeEvent = (note, hand, whenSec = null) => {
    if (!isShowPlayModeRef.current || !note) return;
    const nowSec = getAudioCurrentTime ? getAudioCurrentTime() : 0;
    const delayMs = whenSec == null ? 0 : Math.max(0, Math.round((whenSec - nowSec) * 1000));
    const dispatchEvent = () => window.dispatchEvent(new CustomEvent('tme-note-played', { detail: { note, hand } }));
    if (delayMs <= 0) dispatchEvent();
    else scheduleManagedEffectTimer(dispatchEvent, delayMs);
  };

  const scheduleResolvedInstrumentNote = (noteStr, vol, whenSec, options = {}) => {
    if (!noteStr || noteStr === '-') return;
    const { bypassOctaveLayer = false, hand = 'single', overrideInstId = null } = options;
    const actualNoteToPlay = isReduceModeRef.current ? shiftNoteString(noteStr, -1) : noteStr;
    
    let inst = overrideInstId && INSTRUMENT_CONFIG[overrideInstId] ? INSTRUMENT_CONFIG[overrideInstId] : currentInstrumentRef.current;
    
    if (!overrideInstId) {
       const percInst = Object.values(INSTRUMENT_CONFIG).find(i => i.type === 'percussion' && i.keys.some(k => k.thai === actualNoteToPlay));
       if (percInst) inst = percInst;
    }
    
    const safeWhen = Math.max((getAudioCurrentTime ? getAudioCurrentTime() : 0) + 0.015, whenSec ?? 0);

    if (!bypassOctaveLayer && intervalModeRef.current !== 'off' && inst.type !== 'percussion') {
      const { left, right } = getIntervalPair(inst, actualNoteToPlay, intervalModeRef.current);
      if (left && right) {
        if (left === right) {
          scheduleNote(inst.id, left, safeWhen, vol);
          queuePlayModeEvent(left, hand, safeWhen);
        } else {
          scheduleNote(inst.id, left, safeWhen, vol);
          scheduleNote(inst.id, right, safeWhen, vol);
          queuePlayModeEvent(left, 'left', safeWhen);
          queuePlayModeEvent(right, 'right', safeWhen);
        }
        return;
      }
    }
    scheduleNote(inst.id, actualNoteToPlay, safeWhen, vol);
    queuePlayModeEvent(actualNoteToPlay, hand, safeWhen);
  };

  const stopPlayback = (options = {}) => {
    const { preserveSeek = false, clearScheduled = true } = options;

    setIsPlaying(false);
    isPlayingRef.current = false;
    pendingPlaybackCursorRef.current = null;

    if (playbackCursorRafRef.current) {
      cancelAnimationFrame(playbackCursorRafRef.current);
      playbackCursorRafRef.current = null;
    }

    playbackCursorRef.current = null;
    setPlaybackCursor(null);

    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (schedulerIntervalRef.current) {
      clearInterval(schedulerIntervalRef.current);
      schedulerIntervalRef.current = null;
    }

    runAudioSchedulerRef.current = null;
    schedulerStateRef.current = null;
    nextNoteTimeRef.current = 0;

    effectTimersRef.current.forEach(t => clearTimeout(t));
    effectTimersRef.current.clear();
    mutedCellsRef.current.clear();

    if (window.kroInterval) {
      clearInterval(window.kroInterval);
      window.kroInterval = null;
    }

    if (uiTimerRef.current) {
      clearInterval(uiTimerRef.current);
      uiTimerRef.current = null;
    }

    if (clearScheduled) {
      stopAllScheduledNotes?.({
        excludeGroupId: metronomeConfigRef.current.linked === false
          ? INDEPENDENT_METRONOME_GROUP
          : null
      });
    }
    releasePlaybackOwnership(stopPlayback);
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }

    if (!preserveSeek) {
      seekOffsetRef.current = 0;
      setCurrentTime(0);
    }
  };

  const startPlayback = async () => {
    if (isPlayingRef.current) return;
    claimPlaybackOwnership(stopPlayback);
    if (initAudioContext) await initAudioContext();

    const currentInstId = currentInstrumentRef.current?.id;
    const conf = metronomeConfigRef.current;
    const currentSheetData = sheetDataRef.current;
    const currentRowTypes = rowTypesRef.current;
    const currentSectionLabels = sectionLabelsRef.current;

    // เตรียมเฉพาะเสียงที่อาจดังในจังหวะแรกก่อน เพื่อไม่ให้โน้ตแรกมาช้าปะปนกับจังหวะถัดไป
    const startupNotes = new Map();
    const addStartupNote = (instrumentId, note) => {
      if (!instrumentId || !note || note === '-') return;
      startupNotes.set(`${instrumentId}:${note}`, { instrumentId, note });
    };
    const collectCellNotes = (r, m, c) => {
      const token = currentSheetData?.[r]?.[m]?.[c];
      const overrideInstId = layoutConfigRef.current.customStyles?.[`${r}_${m}_${c}`]?.instrumentId;
      parseCellToken(token, 'flat').forEach((event) => {
        const actualNote = isReduceModeRef.current ? shiftNoteString(event.note, -1) : event.note;
        let instrument = overrideInstId && INSTRUMENT_CONFIG[overrideInstId]
          ? INSTRUMENT_CONFIG[overrideInstId]
          : currentInstrumentRef.current;
        if (!overrideInstId) {
          const percussion = Object.values(INSTRUMENT_CONFIG).find(item => item.type === 'percussion' && item.keys.some(key => key.thai === actualNote));
          if (percussion) instrument = percussion;
        }
        if (intervalModeRef.current !== 'off' && instrument.type !== 'percussion') {
          const pair = getIntervalPair(instrument, actualNote, intervalModeRef.current);
          addStartupNote(instrument.id, pair.left);
          addStartupNote(instrument.id, pair.right);
        } else addStartupNote(instrument.id, actualNote);
      });
    };
    const initialCell = [...(selectedCellRef.current || [0, 0, 0])];
    // ใช้ตำแหน่งเริ่มจริงเดียวกับ scheduler กรณีเลือกบรรทัดคำอธิบาย/หน้าทับ/มือซ้าย
    if (currentRowTypes[initialCell[0]] === 'nathap' || currentRowTypes[initialCell[0]] === 'annotation') {
      let parentRow = initialCell[0] - 1;
      while (parentRow >= 0 && (currentRowTypes[parentRow] === 'nathap' || currentRowTypes[parentRow] === 'annotation')) parentRow -= 1;
      if (parentRow >= 0) initialCell[0] = currentRowTypes[parentRow] === 'double-left' ? parentRow - 1 : parentRow;
    }
    if (currentRowTypes[initialCell[0]] === 'double-left') initialCell[0] -= 1;
    if (currentRowTypes[initialCell[0]]?.startsWith('double') && initialCell[1] === 0) initialCell[1] = 1;

    collectCellNotes(initialCell[0], initialCell[1], initialCell[2]);
    if (currentRowTypes[initialCell[0]] === 'double-right') collectCellNotes(initialCell[0] + 1, initialCell[1], initialCell[2]);

    [['ching', 'ching'], ['klong', 'klong-khaek'], ['krub', 'krub']].forEach(([key, instrumentId]) => {
      if (!conf.enabled || conf.linked === false || !conf[key].active) return;
      const selectedPattern = conf.rhythms[key].find(pattern => pattern.id === conf[key].pattern) || conf.rhythms[key][0];
      (selectedPattern?.pattern || []).forEach(token => splitThaiNoteToken(token).forEach(note => addStartupNote(instrumentId, note)));
    });

    const startupPreload = Promise.allSettled([...startupNotes.values()].map(({ instrumentId, note }) => preloadNote(instrumentId, note)));
    // รอเฉพาะเสียงจังหวะแรกจริง ๆ เพื่อรับประกันว่าโน้ตแรกไม่ขาด
    // โดยปกติพร้อมอยู่แล้วจาก primeAudioEngine จึง resolve ทันที
    await startupPreload;

    // เริ่มโหลดเสียงทันที แต่ห้ามรอให้โหลดครบทุกโน้ตก่อนเล่น
    // การรอ Promise ทั้งชุดทำให้กดเล่นครั้งแรกช้าเป็นวินาที โดยเฉพาะไฟล์ที่ใช้หลายเครื่อง
    // scheduler มี look-ahead อยู่แล้ว จึงให้เสียงที่เหลือทยอยพร้อมในเบื้องหลังได้
    const instrumentsToPreload = new Set();
    if (currentInstId) instrumentsToPreload.add(currentInstId);
    if (conf.linked !== false && conf.ching.active) instrumentsToPreload.add('ching');
    if (conf.linked !== false && conf.klong.active) instrumentsToPreload.add('klong-khaek');
    if (conf.linked !== false && conf.krub.active) instrumentsToPreload.add('krub');
    Promise.allSettled([...instrumentsToPreload].map((id) => preloadSounds(id))).catch(() => {});

    setIsPlaying(true);
    isPlayingRef.current = true;
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }

    const sheetSections = [];
    let lastValidRow = 0;
    let lastProcessedVIdx = -1;

    for (let r = 0; r < currentSheetData.length; r++) {
      if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'annotation' || currentRowTypes[r] === 'nathap') continue; 
      const vIdx = getVisualIndex(r, currentRowTypes);
      const labels = currentSectionLabels[vIdx] || [];
      const validLabels = labels.filter(l => l.text && l.text.trim() !== '');

      if (validLabels.length > 0 && vIdx !== lastProcessedVIdx) {
        if (sheetSections.length > 0) sheetSections[sheetSections.length - 1].endRow = lastValidRow;
        sheetSections.push({ label: validLabels[0].text.trim(), startRow: r, endRow: currentSheetData.length - 1 });
        lastProcessedVIdx = vIdx;
      }
      lastValidRow = r;
      if (currentRowTypes[r] === 'double-right') lastValidRow = r + 1;
    }
    if (sheetSections.length > 0) sheetSections[sheetSections.length - 1].endRow = lastValidRow;
    sheetMapRef.current = sheetSections;

    let calcTotalMs = 0;
    const currentBpm = layoutConfigRef.current.bpm || 80;
    playbackSequenceRef.current.forEach(seqItem => {
      const section = sheetSections.find(s => s.label === seqItem.label.trim());
      if (section) {
        let sectionMs = 0;
        for (let r = section.startRow; r <= section.endRow; r++) {
          if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'double-left' || currentRowTypes[r] === 'annotation' || currentRowTypes[r] === 'nathap') continue;          
          for (let m = 0; m < currentSheetData[r].length; m++) {
            if (currentRowTypes[r].startsWith('double') && m === 0) continue;
            if (currentRowTypes[r] === 'nathap' && m === 0) continue;
            const cellCount = currentSheetData[r][m].length;
            if (cellCount > 0) sectionMs += (15000 / currentBpm) * 4;
          }
        }
        calcTotalMs += (sectionMs * seqItem.loops);
      }
    });

    const totalSeconds = Math.floor(calcTotalMs / 1000);
    setTotalTime(totalSeconds);
    setCurrentTime(Math.floor(seekOffsetRef.current));

    // ⭐ รีเซ็ตตัวนับจังหวะกลองให้สอดคล้องกับ Timeline ปัจจุบัน
    const standardMsPerCellInit = 15000 / (layoutConfigRef.current.bpm || 80);
    globalBeatCountRef.current = Math.round((seekOffsetRef.current * 1000) / standardMsPerCellInit);

    playbackStartTimeRef.current = performance.now() - (seekOffsetRef.current * 1000);
    if (uiTimerRef.current) clearInterval(uiTimerRef.current);
    uiTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((performance.now() - playbackStartTimeRef.current) / 1000);
      setCurrentTime(Math.min(elapsed, totalSeconds));
    }, 250);

    if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    if (schedulerIntervalRef.current) clearInterval(schedulerIntervalRef.current);
    effectTimersRef.current.forEach(t => clearTimeout(t));
    effectTimersRef.current.clear();
    mutedCellsRef.current.clear();
    schedulerStateRef.current = null;
    nextNoteTimeRef.current = 0;
    runAudioSchedulerRef.current = null;
    stopAllScheduledNotes?.({
      excludeGroupId: metronomeConfigRef.current.linked === false
        ? INDEPENDENT_METRONOME_GROUP
        : null
    });

    let currentCursor = [...selectedCellRef.current];
    let startR = currentCursor[0];

    if (currentRowTypes[startR] === 'nathap' || currentRowTypes[startR] === 'annotation') {
      let findMainR = startR;
      while (findMainR >= 0 && (currentRowTypes[findMainR] === 'nathap' || currentRowTypes[findMainR] === 'annotation')) {
        findMainR -= 1;
      }
      if (findMainR >= 0) {
        if (currentRowTypes[findMainR] === 'double-left') findMainR -= 1;
        startR = findMainR;
        currentCursor[0] = startR;
      }
    }

    if (currentRowTypes[startR] === 'double-left') { startR -= 1; currentCursor[0] = startR; }
    if (currentRowTypes[startR]?.startsWith('double') && currentCursor[1] === 0) currentCursor[1] = 1;
    if (currentRowTypes[startR] === 'nathap' && currentCursor[1] === 0) currentCursor[1] = 1;

    let startSeqIdx = 0;
    const currentMappedSection = sheetSections.find(s => startR >= s.startRow && startR <= s.endRow);
    if (currentMappedSection) {
      const foundIdx = playbackSequenceRef.current.findIndex(seq => seq.label.trim() === currentMappedSection.label);
      if (foundIdx !== -1) startSeqIdx = foundIdx;
    }

    if (seekOffsetRef.current > 0) {
      setActiveSequenceIdx(activeSequenceIdxRef.current);
      setActiveLoop(activeLoopRef.current);
    } else {
      activeSequenceIdxRef.current = startSeqIdx;
      activeLoopRef.current = 1;
      setActiveSequenceIdx(startSeqIdx);
      setActiveLoop(1);
    }

    const scheduleUiChange = (cb, whenSec) => {
      const nowSec = getAudioCurrentTime ? getAudioCurrentTime() : 0;
      const delayMs = Math.max(0, Math.round((whenSec - nowSec) * 1000));
      scheduleManagedEffectTimer(() => {
        if (isPlayingRef.current) cb();
      }, delayMs);
    };

    const getCellVolume = (r, m, c, subIdx, baseVol) => {
      const customStyles = layoutConfigRef.current.customStyles || {};
      const cellStyle = customStyles[`${r}_${m}_${c}_${subIdx}`] || customStyles[`${r}_${m}_${c}`];
      if (cellStyle && cellStyle.velocity !== undefined) {
        return Math.round(baseVol * (cellStyle.velocity / 100));
      }
      return baseVol;
    };

    const scheduleTokenPlayback = (tokenStr, baseVol, cellDurationMs, baseDelayMs = 0, options = {}, targetR, targetM, targetC, cellStartSec) => {
      const tokenEvents = parseCellToken(tokenStr, 'flat');
      if (tokenEvents.length === 0) return;

      const customStyles = layoutConfigRef.current.customStyles || {};
      const overrideInstId = customStyles[`${targetR}_${targetM}_${targetC}`]?.instrumentId || null;

      tokenEvents.forEach((event, subIdx) => {
        const eventDelayMs = Math.max(0, Math.floor(baseDelayMs + (cellDurationMs * (event.ratio ?? 0))));
        const eventVolume = getCellVolume(targetR, targetM, targetC, subIdx, baseVol);
        if (eventVolume > 0) {
          scheduleResolvedInstrumentNote(event.note, eventVolume, cellStartSec + (eventDelayMs / 1000), { ...options, overrideInstId });
        }
      });
    };

    const scheduleSymbolPlayback = (sym, events, timeUntilEnd, cellStartSec) => {
      if (sym.type === 'kro') {
        let noteRightStr = null;
        let noteLeftStr = null;
        const firstColNotes = events[0] || [];

        let overrideInstId = null;
        if (firstColNotes.length > 0) {
           const customStyles = layoutConfigRef.current.customStyles || {};
           overrideInstId = customStyles[`${firstColNotes[0].r}_${firstColNotes[0].m}_${firstColNotes[0].c}`]?.instrumentId || null;
        }

        if (firstColNotes.length >= 2) {
          noteRightStr = firstColNotes[0].note && firstColNotes[0].note !== '-' ? firstColNotes[0].note : null;
          noteLeftStr = firstColNotes[1].note && firstColNotes[1].note !== '-' ? firstColNotes[1].note : null;
          if (!noteRightStr && noteLeftStr) noteRightStr = noteLeftStr;
          if (!noteLeftStr && noteRightStr) noteLeftStr = noteRightStr;
        } else if (firstColNotes.length === 1) {
          const noteA = firstColNotes[0].note && firstColNotes[0].note !== '-' ? firstColNotes[0].note : null;
          if (noteA) {
            const actualA = isReduceModeRef.current ? shiftNoteString(noteA, -1) : noteA;
            const inst = currentInstrumentRef.current;
            const intervalVal = intervalModeRef.current !== 'off' ? intervalModeRef.current : '8';
            const { left, right } = getIntervalPair(inst, actualA, intervalVal);
            noteLeftStr = isReduceModeRef.current ? shiftNoteString(left, 1) : left;
            noteRightStr = isReduceModeRef.current ? shiftNoteString(right, 1) : right;
          }
        }

        if (noteRightStr && noteLeftStr) {
          const kroSpeed = Math.max(20, sym.speed ?? layoutConfigRef.current.kroSpeed ?? 65);
          const startHand = sym.starthand ?? layoutConfigRef.current.kroStartHand ?? 'right';
          for (let offsetMs = 0, beatIdx = 0; offsetMs <= timeUntilEnd; offsetMs += kroSpeed, beatIdx++) {
            const currentHand = beatIdx % 2 === 0
              ? (startHand === 'left' ? 'left' : 'right')
              : (startHand === 'left' ? 'right' : 'left');
            const noteToPlay = currentHand === 'right' ? noteRightStr : noteLeftStr;
            scheduleResolvedInstrumentNote(noteToPlay, layoutConfigRef.current.volume ?? 100, cellStartSec + (offsetMs / 1000), { bypassOctaveLayer: true, hand: currentHand, overrideInstId });
          }
        }
        return;
      }

      const totalDurationMs = timeUntilEnd > 0 ? timeUntilEnd : 1;
      const stepCount = events.length;

      if (stepCount === 1) {
        events[0].forEach(nData => {
          const vol = getCellVolume(nData.r, nData.m, nData.c, nData.subIdx, layoutConfigRef.current.volume ?? 100);
          const customStyles = layoutConfigRef.current.customStyles || {};
          const overrideInstId = customStyles[`${nData.r}_${nData.m}_${nData.c}`]?.instrumentId || null;
          if (vol > 0) scheduleResolvedInstrumentNote(nData.note, vol, cellStartSec, { hand: 'single', overrideInstId });
        });
      } else if (stepCount > 1) {
        const intervalMs = totalDurationMs / (stepCount - 1);
        events.forEach((chord, stepIdx) => {
          const playTimeMs = stepIdx * intervalMs;
          chord.forEach(nData => {
            const vol = getCellVolume(nData.r, nData.m, nData.c, nData.subIdx, layoutConfigRef.current.volume ?? 100);
            const customStyles = layoutConfigRef.current.customStyles || {};
            const overrideInstId = customStyles[`${nData.r}_${nData.m}_${nData.c}`]?.instrumentId || null;
            if (vol > 0) scheduleResolvedInstrumentNote(nData.note, vol, cellStartSec + (playTimeMs / 1000), { hand: 'single', overrideInstId });
          });
        });
      }
    };

    const scheduleCell = (r, m, c, cellStartSec) => {
      if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'annotation' || currentRowTypes[r] === 'nathap') return 0;

      const cellCountInMeasure = currentSheetData[r][m].length;
      const standardMsPerCell = 15000 / (layoutConfigRef.current.bpm || 80);
      const msPerCell = Math.floor(standardMsPerCell * (4 / cellCountInMeasure));

      scheduleUiChange(() => schedulePlaybackCursorUpdate([r, m, c]), cellStartSec);

      // ดึงค่าความยาวห้องแบบปลอดภัย
      const safeCellCount = cellCountInMeasure > 0 ? cellCountInMeasure : 4;

      const firstItem = currentSheetData[r][m][0];
      if (typeof firstItem === 'string' && (firstItem.startsWith('@TEXT_SPAN_') || firstItem === '@HIDDEN')) {
        globalBeatCountRef.current += (4 / safeCellCount); // ⭐ นับจังหวะเดินหน้าแม้จะเป็นช่องผสาน
        return msPerCell; 
      }

      // ⭐ [ส่วนที่ 1]: เล่นเสียง Metronome ด้วยระบบ Timeline (ไม่สนใจการกระโดดของโน้ต)
      const metronomeConf = metronomeConfigRef.current;
      const masterVol = metronomeConf.masterVolume / 100;

      // ดึงค่าจังหวะปัจจุบัน และปัดเศษเพื่อแก้ปัญหาทศนิยม (ป้องกันตีกระตุก)
      const currentGlobalBeat = Math.round(globalBeatCountRef.current * 1000) / 1000;
      const isMetronomeBeat = Number.isInteger(currentGlobalBeat);
      const globalBeatIndex = Math.floor(currentGlobalBeat);

      const playMetronomeNote = (instrument, noteStr, baseVol) => {
        if (!noteStr || noteStr === '-' || noteStr.trim() === '') return;
        const notesToPlay = splitThaiNoteToken(noteStr);
        notesToPlay.forEach(n => {
          if (n && n !== '-') {
            const finalVol = masterVol * baseVol;
            if (finalVol > 0) scheduleNote(instrument, n, cellStartSec, finalVol, undefined, false, LINKED_METRONOME_GROUP);
          }
        });
      };

      // ตีกลองเฉพาะตอนที่จังหวะลงล็อกเป๊ะๆ เท่านั้น
      if (metronomeConf.enabled && metronomeConf.linked !== false && isMetronomeBeat) {
        if (metronomeConf.ching.active) {
          const chingP = metronomeConf.rhythms.ching.find(p => p.id === metronomeConf.ching.pattern) || metronomeConf.rhythms.ching[0];
          if (chingP && chingP.pattern.length > 0) {
            playMetronomeNote('ching', chingP.pattern[globalBeatIndex % chingP.pattern.length], metronomeConf.ching.volume);
          }
        }

        if (metronomeConf.klong.active) {
          const klongP = metronomeConf.rhythms.klong.find(p => p.id === metronomeConf.klong.pattern) || metronomeConf.rhythms.klong[0];
          if (klongP && klongP.pattern.length > 0) {
            playMetronomeNote('klong-khaek', klongP.pattern[globalBeatIndex % klongP.pattern.length], metronomeConf.klong.volume);
          }
        }

        if (metronomeConf.krub.active) {
          const krubP = metronomeConf.rhythms.krub.find(p => p.id === metronomeConf.krub.pattern) || metronomeConf.rhythms.krub[0];
          if (krubP && krubP.pattern.length > 0) {
            playMetronomeNote('krub', krubP.pattern[globalBeatIndex % krubP.pattern.length], metronomeConf.krub.volume);
          }
        }
      }

      // [ส่วนที่ 2]: เล่นเสียงโน้ตดนตรีหลัก
      const cellsToCheck = [[r, m, c]];
      if (currentRowTypes[r] === 'double-right') cellsToCheck.push([r + 1, m, c]);
      else if (currentRowTypes[r] === 'double-left') cellsToCheck.push([r - 1, m, c]);

      const processedSymbols = new Set();
      const currentSymbols = symbolsRef.current;

      cellsToCheck.forEach(cell => {
        const [cr, cm, cc] = cell;
        const startingSymbols = currentSymbols.filter(s => {
          let sStart = [...s.start];
          let sEnd = [...s.end];
          if (currentRowTypes[sStart[0]] === 'double-left') sStart[0] -= 1;
          if (currentRowTypes[sEnd[0]] === 'double-left') sEnd[0] -= 1;
          const startIdx = sStart[0] * 1000 + sStart[1] * 10 + sStart[2];
          const endIdx = sEnd[0] * 1000 + sEnd[1] * 10 + sEnd[2];
          let normalizedCr = cr;
          if (currentRowTypes[cr] === 'double-left') normalizedCr -= 1;
          const currentIdx = normalizedCr * 1000 + cm * 10 + cc;
          return currentIdx === Math.min(startIdx, endIdx);
        });

        startingSymbols.forEach(sym => {
          if (processedSymbols.has(sym.id)) return;
          processedSymbols.add(sym.id);

          let startPos = [...sym.start];
          let endPos = [...sym.end];
          if (currentRowTypes[startPos[0]] === 'double-left') startPos[0] -= 1;
          if (currentRowTypes[endPos[0]] === 'double-left') endPos[0] -= 1;
          const startAbs = startPos[0] * 1000 + startPos[1] * 10 + startPos[2];
          const endAbs = endPos[0] * 1000 + endPos[1] * 10 + endPos[2];
          if (startAbs > endAbs) {
            const temp = startPos;
            startPos = endPos;
            endPos = temp;
          }

          let currR = startPos[0];
          let currM = startPos[1];
          let currC = startPos[2];
          const endR = endPos[0];
          const endM = endPos[1];
          const endC = endPos[2];

          let events = [];
          let cellIds = [];
          let dist = 0;
          let failSafe = 0;

          while (failSafe < 500) {
            const stepRowType = currentRowTypes[currR];
            let colNotesData = [];
            if (stepRowType && stepRowType.startsWith('double')) {
              const stepTop = stepRowType === 'double-left' ? currR - 1 : currR;
              const stepBot = stepTop + 1;
              const noteTop = currentSheetData[stepTop]?.[currM]?.[currC];
              const noteBot = currentSheetData[stepBot]?.[currM]?.[currC];

              const topParts = splitThaiNoteToken(noteTop || '-');
              const botParts = splitThaiNoteToken(noteBot || '-');
              const maxParts = Math.max(topParts.length, botParts.length);

              for (let s = 0; s < maxParts; s++) {
                const currentChord = [];
                if (topParts[s] && topParts[s] !== '-') currentChord.push({ note: topParts[s], r: stepTop, m: currM, c: currC, subIdx: s });
                if (botParts[s] && botParts[s] !== '-') currentChord.push({ note: botParts[s], r: stepBot, m: currM, c: currC, subIdx: s });
                if (currentChord.length > 0) colNotesData.push(currentChord);
              }
              cellIds.push(getCellId(stepTop, currM, currC));
              cellIds.push(getCellId(stepBot, currM, currC));
            } else {
              const note = currentSheetData[currR]?.[currM]?.[currC];
              const parts = splitThaiNoteToken(note || '-');
              parts.forEach((p, s) => {
                if (p && p !== '-') colNotesData.push([{ note: p, r: currR, m: currM, c: currC, subIdx: s }]);
              });
              cellIds.push(getCellId(currR, currM, currC));
            }

            if (colNotesData.length > 0) events.push(...colNotesData);

            if (currR === endR && currM === endM && currC === endC) break;
            dist += 1;
            currC += 1;
            const currentMeasureLength = currentSheetData[currR]?.[currM]?.length ?? 0;
            if (currC >= currentMeasureLength) {
              currC = 0;
              currM += 1;
              if (currM >= (currentSheetData[currR]?.length ?? 0)) {
                let tempR = currR + 1;
                while (tempR < currentSheetData.length && (currentRowTypes[tempR] === 'page-break' || currentRowTypes[tempR] === 'text' || currentRowTypes[tempR] === 'double-left' || currentRowTypes[tempR] === 'nathap')) tempR++;
                if (tempR >= currentSheetData.length) break;
                currR = tempR;
                currM = currentRowTypes[currR]?.startsWith('double') ? 1 : 0;
              }
            }
            failSafe += 1;
          }

          cellIds.forEach(id => mutedCellsRef.current.add(id));
          const timeUntilEnd = dist * msPerCell;
          if (events.length > 0) {
            scheduleSymbolPlayback(sym, events, timeUntilEnd, cellStartSec);
          }
        });
      });

      if (currentRowTypes[r] === 'double-right') {
        const rightToken = currentSheetData[r][m][c];
        const leftToken = currentSheetData[r + 1] ? currentSheetData[r + 1][m][c] : '-';
        const rightCellId = getCellId(r, m, c);
        const leftCellId = getCellId(r + 1, m, c);

        if (!mutedCellsRef.current.has(rightCellId)) {
          scheduleTokenPlayback(rightToken, layoutConfigRef.current.volume ?? 100, msPerCell, 0, { hand: 'right', bypassOctaveLayer: true }, r, m, c, cellStartSec);
        }
        if (!mutedCellsRef.current.has(leftCellId)) {
          scheduleTokenPlayback(leftToken, layoutConfigRef.current.volume ?? 100, msPerCell, 0, { hand: 'left', bypassOctaveLayer: true }, r + 1, m, c, cellStartSec);
        }
      } else if (!mutedCellsRef.current.has(getCellId(r, m, c))) {
        scheduleTokenPlayback(currentSheetData[r][m][c], layoutConfigRef.current.volume ?? 100, msPerCell, 0, { hand: 'single' }, r, m, c, cellStartSec);
      }

      const isParentDouble = currentRowTypes[r] === 'double-right';
      let scanR = isParentDouble ? r + 2 : r + 1;
      while (scanR < currentSheetData.length && currentRowTypes[scanR] === 'nathap') {
        if (!mutedCellsRef.current.has(getCellId(scanR, m, c))) {
          if (m < currentSheetData[scanR].length) {
            const nathapToken = currentSheetData[scanR][m][c];
            scheduleTokenPlayback(nathapToken, layoutConfigRef.current.volume ?? 100, msPerCell, 0, { hand: 'single' }, scanR, m, c, cellStartSec);
          }
        }
        scanR++;
      }

      // ⭐ สั่งให้จังหวะเดินหน้า (+1 เสมอ สำหรับห้อง 4 ช่องปกติ)
      globalBeatCountRef.current += (4 / safeCellCount); 
      return msPerCell;
    };

    const advanceCursor = (r, m, c, scheduledAtSec, schedulerSeqIdx, schedulerLoop) => {
      let nextC = c + 1;
      let nextM = m;
      let nextR = r;
      let nextSeqIdxState = schedulerSeqIdx;
      let nextLoopState = schedulerLoop;

      if (nextC >= currentSheetData[r][m].length) {
        nextC = 0;
        nextM += 1;

        if (nextM >= currentSheetData[r].length) {
          nextM = 0;
          const seq = playbackSequenceRef.current;
          const currSeqIdx = Number.isInteger(schedulerSeqIdx) ? schedulerSeqIdx : activeSequenceIdxRef.current;
          const currentLoop = Number.isInteger(schedulerLoop) ? schedulerLoop : activeLoopRef.current;
          const map = sheetMapRef.current;
          let isEndOfSection = false;
          let currentItem = null;
          let currentMappedSectionForAdvance = null;

          if (seq && seq.length > 0 && currSeqIdx < seq.length) {
            currentItem = seq[currSeqIdx];
            currentMappedSectionForAdvance = map.find(s => s.label === currentItem.label.trim());
            const rowCoverage = currentRowTypes[r] === 'double-right' ? r + 1 : r;
            if (currentMappedSectionForAdvance && rowCoverage >= currentMappedSectionForAdvance.endRow) isEndOfSection = true;
          }

          if (isEndOfSection && currentItem && currentMappedSectionForAdvance) {
            if (isLoopOneRef.current) {
              nextR = currentMappedSectionForAdvance.startRow;
              nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
              nextC = 0;

              let sectionMs = 0;
              for (let sr = currentMappedSectionForAdvance.startRow; sr <= currentMappedSectionForAdvance.endRow; sr++) {
                if (currentRowTypes[sr] === 'page-break' || currentRowTypes[sr] === 'text' || currentRowTypes[sr] === 'double-left' || currentRowTypes[sr] === 'annotation' || currentRowTypes[sr] === 'nathap') continue;
                for (let sm = 0; sm < currentSheetData[sr].length; sm++) {
                  if (currentRowTypes[sr].startsWith('double') && sm === 0) continue;
                  if (currentRowTypes[sr] === 'nathap' && sm === 0) continue;
                  const cellCount = currentSheetData[sr][sm].length;
                  if (cellCount > 0) sectionMs += (15000 / currentBpm) * 4;
                }
              }
              scheduleUiChange(() => {
                playbackStartTimeRef.current += sectionMs;
              }, scheduledAtSec);
            } else if (currentLoop < currentItem.loops) {
              const nextLoop = currentLoop + 1;
              scheduleUiChange(() => {
                activeLoopRef.current = nextLoop;
                setActiveLoop(nextLoop);
              }, scheduledAtSec);
              nextLoopState = nextLoop;
              nextR = currentMappedSectionForAdvance.startRow;
              nextM = currentRowTypes[nextR] && (currentRowTypes[nextR].startsWith('double') || currentRowTypes[nextR] === 'nathap') ? 1 : 0;
              nextC = 0;
            } else {
              const nextSeqIdx = currSeqIdx + 1;
              if (nextSeqIdx < seq.length) {
                scheduleUiChange(() => {
                  activeSequenceIdxRef.current = nextSeqIdx;
                  setActiveSequenceIdx(nextSeqIdx);
                  activeLoopRef.current = 1;
                  setActiveLoop(1);
                }, scheduledAtSec);
                nextSeqIdxState = nextSeqIdx;
                nextLoopState = 1;
                const nextMappedSection = map.find(s => s.label === seq[nextSeqIdx].label.trim());
                if (nextMappedSection) {
                  nextR = nextMappedSection.startRow;
                  nextM = currentRowTypes[nextR] && (currentRowTypes[nextR].startsWith('double') || currentRowTypes[nextR] === 'nathap') ? 1 : 0;
                  nextC = 0;
                } else { return null; }
              } else if (isLoopAllRef.current && seq.length > 0) {
                scheduleUiChange(() => {
                  activeSequenceIdxRef.current = 0;
                  setActiveSequenceIdx(0);
                  activeLoopRef.current = 1;
                  setActiveLoop(1);
                  seekOffsetRef.current = 0;
                  playbackStartTimeRef.current = performance.now();
                }, scheduledAtSec);
                nextSeqIdxState = 0;
                nextLoopState = 1;
                const firstMappedSection = map.find(s => s.label === seq[0].label.trim());
                if (firstMappedSection) {
                  nextR = firstMappedSection.startRow;
                  nextM = currentRowTypes[nextR] && (currentRowTypes[nextR].startsWith('double') || currentRowTypes[nextR] === 'nathap') ? 1 : 0;
                  nextC = 0;
                } else { return null; }
              } else { return null; }
            }
          } else {
            nextR = currentRowTypes[r] === 'double-right' ? r + 2 : r + 1;
            while (nextR < currentSheetData.length && (currentRowTypes[nextR] === 'page-break' || currentRowTypes[nextR] === 'text' || currentRowTypes[nextR] === 'annotation' || currentRowTypes[nextR] === 'nathap')) {
              nextR++;
            }
            if (nextR >= currentSheetData.length) return null;
            nextM = currentRowTypes[nextR] && (currentRowTypes[nextR].startsWith('double') || currentRowTypes[nextR] === 'nathap') ? 1 : 0;
          }
        }
      }
      return { r: nextR, m: nextM, c: nextC, seqIdx: nextSeqIdxState, loop: nextLoopState };
    };

    // เผื่อเวลาให้ browser เปิด output path และสร้างโน้ตแรก โดยไม่ทำให้ผู้ใช้รู้สึกว่ากดเล่นช้า
    const audioStartSec = (getAudioCurrentTime ? getAudioCurrentTime() : 0) + 0.08;
    schedulerStateRef.current = {
      r: currentCursor[0],
      m: currentCursor[1],
      c: currentCursor[2],
      seqIdx: activeSequenceIdxRef.current,
      loop: activeLoopRef.current
    };
    nextNoteTimeRef.current = audioStartSec;

    runAudioSchedulerRef.current = () => {
      if (!isPlayingRef.current) return;
      const scheduleAheadSec = isPageHiddenRef.current ? BACKGROUND_SCHEDULE_AHEAD_SEC : 1.5;
      const schedulingHorizon = (getAudioCurrentTime ? getAudioCurrentTime() : 0) + scheduleAheadSec;

      while (schedulerStateRef.current && nextNoteTimeRef.current < schedulingHorizon) {
        const { r, m, c, seqIdx, loop } = schedulerStateRef.current;
        const msPerCell = scheduleCell(r, m, c, nextNoteTimeRef.current);
        const scheduledAtSec = nextNoteTimeRef.current + ((msPerCell || 0) / 1000);
        const nextState = advanceCursor(r, m, c, scheduledAtSec, seqIdx, loop);
        nextNoteTimeRef.current = scheduledAtSec;
        schedulerStateRef.current = nextState;

        if (!nextState) {
          const stopDelayMs = Math.max(0, Math.round((nextNoteTimeRef.current - (getAudioCurrentTime ? getAudioCurrentTime() : 0)) * 1000) + 120);
          if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
          playbackTimerRef.current = setTimeout(() => stopPlayback({ clearScheduled: false }), stopDelayMs);
          break;
        }
      }
    };

    schedulerIntervalRef.current = setInterval(() => {
      if (runAudioSchedulerRef.current) runAudioSchedulerRef.current();
    }, 100);

    runAudioSchedulerRef.current();
  };

  const seek = (targetSeconds) => {
    if (!sheetDataRef.current) return;
    const targetMs = targetSeconds * 1000;
    const currentSheetData = sheetDataRef.current;
    const currentRowTypes = rowTypesRef.current;
    const currentSectionLabels = sectionLabelsRef.current;

    const sheetSections = [];
    let lastValidRow = 0;
    let lastProcessedVIdx = -1;
    for (let r = 0; r < currentSheetData.length; r++) {
      if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'annotation' || currentRowTypes[r] === 'nathap') continue; 
      const vIdx = getVisualIndex(r, currentRowTypes);
      const labels = currentSectionLabels[vIdx] || [];
      const validLabels = labels.filter(l => l.text && l.text.trim() !== '');

      if (validLabels.length > 0 && vIdx !== lastProcessedVIdx) {
        sheetSections.forEach(sec => { if (sec.endRow === currentSheetData.length - 1) sec.endRow = lastValidRow; });
        validLabels.forEach(vl => { sheetSections.push({ label: vl.text.trim(), startRow: r, endRow: currentSheetData.length - 1 }); });
        lastProcessedVIdx = vIdx; 
      }
      lastValidRow = r;
      if (currentRowTypes[r] === 'double-right') lastValidRow = r + 1; 
    }
    sheetSections.forEach(sec => { if (sec.endRow === currentSheetData.length - 1) sec.endRow = lastValidRow; });
    if (sheetSections.length > 0) sheetSections[sheetSections.length - 1].endRow = lastValidRow;

    const currentBpm = layoutConfigRef.current.bpm || 80;
    const seq = playbackSequenceRef.current;
    let elapsedMs = 0;
    let foundCell = null;

    for (let seqIdx = 0; seqIdx < seq.length && !foundCell; seqIdx++) {
      const section = sheetSections.find(s => s.label === seq[seqIdx].label.trim());
      if (!section) continue;
      for (let loop = 1; loop <= seq[seqIdx].loops && !foundCell; loop++) {
        for (let r = section.startRow; r <= section.endRow && !foundCell; r++) {
          if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'double-left' || currentRowTypes[r] === 'annotation' || currentRowTypes[r] === 'nathap') continue;
          const startM = (currentRowTypes[r].startsWith('double') || currentRowTypes[r] === 'nathap') ? 1 : 0;
          for (let m = startM; m < currentSheetData[r].length && !foundCell; m++) {
            const cellCount = currentSheetData[r][m].length;
            if (cellCount > 0) {
              const standardMsPerCell = 15000 / currentBpm;
              const msPerCell = Math.floor(standardMsPerCell * (4 / cellCount));
              for (let c = 0; c < cellCount; c++) {
                if (elapsedMs >= targetMs) {
                  foundCell = { r, m, c, seqIdx, loop, elapsedMs };
                  break;
                }
                elapsedMs += msPerCell;
              }
            }
          }
        }
      }
    }

    const wasPlaying = isPlayingRef.current;
    seekOffsetRef.current = foundCell ? foundCell.elapsedMs / 1000 : targetSeconds;

    if (foundCell) {
      const newCursor = [foundCell.r, foundCell.m, 0];
      setSelectedCell(newCursor); 
      activeSequenceIdxRef.current = foundCell.seqIdx;
      activeLoopRef.current = foundCell.loop;
    }
    if (wasPlaying) {
      stopPlayback({ preserveSeek: true });
      seekOffsetRef.current = foundCell ? foundCell.elapsedMs / 1000 : targetSeconds;
      setTimeout(() => startPlayback(), 50);
    } else {
      setCurrentTime(targetSeconds);
    }
  };

  const togglePlay = () => {
    if (isPlayingRef.current) {
      stopPlayback();
      return Promise.resolve();
    }
    return startPlayback();
  };

  const jumpToSequence = (targetSeqIdx) => {
    const seq = playbackSequenceRef.current;
    if (!seq || targetSeqIdx < 0 || targetSeqIdx >= seq.length) return;
    
    const currentSheetData = sheetDataRef.current;
    const currentRowTypes = rowTypesRef.current;
    const currentSectionLabels = sectionLabelsRef.current;
    const sheetSections = [];
    let lastValidRow = 0;
    let lastProcessedVIdx = -1;
    for (let r = 0; r < currentSheetData.length; r++) {
        if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'annotation' || currentRowTypes[r] === 'nathap') continue; 
        const vIdx = getVisualIndex(r, currentRowTypes);
        const labels = currentSectionLabels[vIdx] || [];
        const validLabels = labels.filter(l => l.text && l.text.trim() !== '');
        if (validLabels.length > 0 && vIdx !== lastProcessedVIdx) {
            if (sheetSections.length > 0) sheetSections[sheetSections.length - 1].endRow = lastValidRow;
            sheetSections.push({ label: validLabels[0].text.trim(), startRow: r, endRow: currentSheetData.length - 1 });
            lastProcessedVIdx = vIdx;
        }
        lastValidRow = r;
        if (currentRowTypes[r] === 'double-right') lastValidRow = r + 1;
    }
    if (sheetSections.length > 0) sheetSections[sheetSections.length - 1].endRow = lastValidRow;

    const currentBpm = layoutConfigRef.current.bpm || 80;
    let elapsedMs = 0;

    for (let i = 0; i < targetSeqIdx; i++) {
        const section = sheetSections.find(s => s.label === seq[i].label.trim());
        if (!section) continue;
        let sectionMs = 0;
        for (let r = section.startRow; r <= section.endRow; r++) {
            if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'double-left' || currentRowTypes[r] === 'annotation' || currentRowTypes[r] === 'nathap') continue;
            for (let m = 0; m < currentSheetData[r].length; m++) {
                if (currentRowTypes[r].startsWith('double') && m === 0) continue;
                if (currentRowTypes[r] === 'nathap' && m === 0) continue;
                const cellCount = currentSheetData[r][m].length;
                if (cellCount > 0) sectionMs += (15000 / currentBpm) * 4;
            }
        }
        elapsedMs += (sectionMs * seq[i].loops);
    }
    seek(elapsedMs / 1000);
  };

  const skipToNext = () => {
      if (!playbackSequenceRef.current || playbackSequenceRef.current.length === 0) return;
      const seq = playbackSequenceRef.current;
      let nextIdx = activeSequenceIdxRef.current + 1;
      
      if (nextIdx >= seq.length) {
          if (isLoopAllRef.current) nextIdx = 0;
          else {
              stopPlayback();
              return;
          }
      }
      jumpToSequence(nextIdx);
  };

  const skipToPrev = () => {
      if (!playbackSequenceRef.current || playbackSequenceRef.current.length === 0) return;
      let targetIdx = activeSequenceIdxRef.current;
      if (targetIdx > 0) targetIdx -= 1;
      jumpToSequence(targetIdx);
  };

  mediaSessionActionsRef.current = {
    play: startPlayback,
    pause: stopPlayback,
    stop: stopPlayback,
    nexttrack: skipToNext,
    previoustrack: skipToPrev
  };

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return undefined;

    if (typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'โน้ตเพลงไทย',
        artist: 'Thai Music Editor',
        album: 'กำลังเล่นจากเครื่องมือแก้ไขโน้ต'
      });
    }

    const actions = ['play', 'pause', 'stop', 'nexttrack', 'previoustrack'];
    actions.forEach((action) => {
      try {
        navigator.mediaSession.setActionHandler(action, () => {
          mediaSessionActionsRef.current[action]?.();
        });
      } catch (error) {
        // Some browsers expose Media Session but do not support every action.
        if (import.meta.env.DEV) console.debug(`Media Session action '${action}' is unavailable`, error);
      }
    });

    return () => {
      actions.forEach((action) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (error) {
          if (import.meta.env.DEV) console.debug(`Unable to clear Media Session action '${action}'`, error);
        }
      });
    };
  }, []);

  return {
    isPlaying, playbackCursor, currentTime, totalTime,
    playbackSequence, setPlaybackSequence,
    activeSequenceIdx, activeLoop,
    startPlayback, stopPlayback, togglePlay,
    seek, skipToNext, skipToPrev, jumpToSequence,
    metronomeConfig, setMetronomeConfig, isPlayingRef
  };
};
