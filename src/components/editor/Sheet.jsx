import React, { useContext, forwardRef, useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { MusicContext } from '../../contexts/MusicContext';

// ==========================================
// 1. Helper Functions (ฟังก์ชันช่วยเหลือ)
// ==========================================
const getFlattenedCol = (row, rType, targetM, targetC) => {
  if (!row || rType === 'text' || rType === 'page-break') return 0; 
  let col = 0;
  for (let m = 0; m < row.length; m++) {
    // ⭐ ข้ามห้องที่ 0 เฉพาะเมื่อบรรทัดนั้นมีความยาว 9 ห้อง (บรรทัดคู่)
    const isLabel = (rType.startsWith('double') || (rType === 'nathap' && row.length === 9)) && m === 0;
    if (isLabel) continue;
    if (m === targetM) return col + targetC;
    col += row[m].length;
  }
  return col;
};

const getMeasureCountForRowType = (row = [], rType = '') => {
  if (!Array.isArray(row)) return 0;
  // ⭐ หักลบช่องป้ายชื่อออกเฉพาะเมื่อหน้าทับมีความยาว 9 ห้อง
  if (rType && (rType.startsWith('double') || (rType === 'nathap' && row.length === 9))) {
    return Math.max(0, row.length - 1);
  }
  return row.length;
};

const getVisualIndexForCalc = (rowIndex, types) => {
  let count = 0;
  for (let i = 0; i <= rowIndex; i++) {
    if (types[i] === 'single' || types[i] === 'double-right') count++;
  }
  return count > 0 ? count - 1 : 0;
};

const getMarginPx = (val, unit) => {
  if (unit === 'cm') return val * 37.795275;
  if (unit === 'in') return val * 96;
  return val;
};

const hasVisibleHtml = (value) => String(value || '')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/gi, ' ')
  .trim().length > 0;

const THAI_NOTE_COMBINER_PATTERN = /[ั-๎​]/;
const MAIN_STAFF_MEASURE_COUNT = 8;
const STAFF_LABEL_COLUMN_WIDTH = '65px';

const splitThaiNoteToken = (token) => {
  if (!token || token === '-') return [];

  return Array.from(String(token).replace(/\s+/g, '').trim()).reduce((parts, char) => {
    if (!char || char === '-') return parts;
    if (THAI_NOTE_COMBINER_PATTERN.test(char) && parts.length > 0) {
      parts[parts.length - 1] += char;
    } else {
      parts.push(char);
    }
    return parts;
  }, []);
};

// ==========================================
// 2. Main Component
// ==========================================
const Sheet = forwardRef((props, ref) => {
  // --- Contexts ---
  const { 
    sheetData, selectedCell, setSelectedCell, layoutConfig, setLayoutConfig,
    headerDetails, songName, setSongName, addDetail, removeDetail, updateDetail,
    sectionLabels, updateSectionLabel, rowTypes,
    startSelection, updateSelection, endSelection, selectionRange, setSelectionRange,
    playbackCursor, isPlaying, symbols = [], addSymbol, removeSymbol,
    selectedSymbolId, setSelectedSymbolId, updateTextRow,
    removeRow, addTextRow, rowMargins, updateRowMarginsList, commitChange,
    setToolbarMode, stopPlayback, updateCellToken, isReadOnly,
    moveSelectionNext, updateMeasureText,
    isAutoScroll
  } = useContext(MusicContext);

  // --- States & Refs ---
  const [pageSvgPaths, setPageSvgPaths] = useState({});
  const [zoom, setZoom] = useState(props.defaultZoom || 100);
  const [editingSongName, setEditingSongName] = useState(false);
  const [editingDetailId, setEditingDetailId] = useState(null);
  const [editingDetailField, setEditingDetailField] = useState(null);
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingTokenCell, setEditingTokenCell] = useState(null);
  const [editingTokenValue, setEditingTokenValue] = useState('');
  
  const [paginateTrigger, setPaginateTrigger] = useState(0);

  const sheetScrollRef = useRef(null);
  const headerSpacingDragRef = useRef(null);
  const zoomTargetRef = useRef(props.defaultZoom || 100);
  const zoomAnimationRef = useRef(null);
  const pinchZoomRef = useRef(null);
  const pinchScrollRafRef = useRef(null);
  const editLabelRef = useRef("");
  const initialSongNameRef = useRef("");
  const initialDetailLabelRef = useRef("");
  const initialDetailValueRef = useRef("");

  const handleAddHeaderDetail = () => {
    if (isReadOnly || !addDetail) return;
    const newDetailId = addDetail();
    if (newDetailId === null || newDetailId === undefined) return;
    initialDetailLabelRef.current = '';
    initialDetailValueRef.current = '';
    setEditingDetailId(newDetailId);
    setEditingDetailField('label');
    if (setToolbarMode) setToolbarMode('text');
  };

  const requestResponsiveZoom = useCallback((nextZoomOrUpdater) => {
    const currentTarget = zoomTargetRef.current;
    const requestedZoom = typeof nextZoomOrUpdater === 'function'
      ? nextZoomOrUpdater(currentTarget)
      : nextZoomOrUpdater;
    zoomTargetRef.current = Math.max(30, Math.min(200, requestedZoom));

    // Coalesce all touchpad events received in the same frame, then apply the
    // latest target directly. This tracks the fingers without an easing tail.
    if (zoomAnimationRef.current !== null) return;
    zoomAnimationRef.current = requestAnimationFrame(() => {
      const targetZoom = zoomTargetRef.current;
      setZoom(targetZoom);
      zoomAnimationRef.current = null;
    });
  }, []);

  const setSheetScrollContainerRef = useCallback((node) => {
    sheetScrollRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  const startHeaderSpacingDrag = useCallback((event) => {
    if (isReadOnly || event.button !== 0) return;
    headerSpacingDragRef.current = {
      startY: event.clientY,
      startSpacing: layoutConfig.headerBottomSpacing ?? 8,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }, [isReadOnly, layoutConfig.headerBottomSpacing]);

  const moveHeaderSpacingDrag = useCallback((event) => {
    const drag = headerSpacingDragRef.current;
    if (!drag) return;
    const nextSpacing = Math.max(0, Math.min(48, drag.startSpacing + (event.clientY - drag.startY)));
    setLayoutConfig((previous) => ({ ...previous, headerBottomSpacing: nextSpacing }));
    event.preventDefault();
    event.stopPropagation();
  }, [setLayoutConfig]);

  const stopHeaderSpacingDrag = useCallback((event) => {
    if (!headerSpacingDragRef.current) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    headerSpacingDragRef.current = null;
    event.stopPropagation();
  }, []);

  useEffect(() => {
    const container = sheetScrollRef.current;
    if (!container) return undefined;

    const handleTrackpadZoom = (event) => {
      // Trackpad pinch is reported as Ctrl/Command + wheel by Chromium/WebKit.
      // Cancel it here so the gesture changes only the music sheet, not the browser page.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();

      if (!event.deltaY) return;
      // Multiplicative scaling feels like a physical pinch at every zoom level.
      // Clamp only unusually large mouse-wheel bursts, not normal touchpad motion.
      const scaleExponent = Math.max(-0.12, Math.min(0.12, -event.deltaY * 0.008));
      const scaleFactor = Math.exp(scaleExponent);
      requestResponsiveZoom((currentTarget) => currentTarget * scaleFactor);
    };

    const getTouchDistance = (touches) => Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );

    const handleTouchStart = (event) => {
      if (event.touches.length !== 2) return;
      const rect = container.getBoundingClientRect();
      const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
      pinchZoomRef.current = {
        distance: getTouchDistance(event.touches),
        zoom: zoomTargetRef.current,
        contentX: (container.scrollLeft + centerX) / (zoomTargetRef.current / 100),
        contentY: (container.scrollTop + centerY) / (zoomTargetRef.current / 100)
      };
      event.preventDefault();
    };

    const handleTouchMove = (event) => {
      const pinch = pinchZoomRef.current;
      if (!pinch || event.touches.length !== 2) return;
      const distance = getTouchDistance(event.touches);
      if (!distance || !pinch.distance) return;
      event.preventDefault();
      event.stopPropagation();
      const nextZoom = Math.max(30, Math.min(200, pinch.zoom * (distance / pinch.distance)));
      zoomTargetRef.current = nextZoom;
      // Apply directly instead of waiting for the wheel/trackpad animation.
      // A pinch must follow the fingers on every touchmove event.
      setZoom(nextZoom);

      const rect = container.getBoundingClientRect();
      const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
      if (pinchScrollRafRef.current !== null) cancelAnimationFrame(pinchScrollRafRef.current);
      pinchScrollRafRef.current = requestAnimationFrame(() => {
        const scale = nextZoom / 100;
        container.scrollLeft = Math.max(0, pinch.contentX * scale - centerX);
        container.scrollTop = Math.max(0, pinch.contentY * scale - centerY);
        pinchScrollRafRef.current = null;
      });
    };

    const handleTouchEnd = (event) => {
      if (event.touches.length < 2) pinchZoomRef.current = null;
    };

    container.addEventListener('wheel', handleTrackpadZoom, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('wheel', handleTrackpadZoom);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      pinchZoomRef.current = null;
      if (pinchScrollRafRef.current !== null) {
        cancelAnimationFrame(pinchScrollRafRef.current);
        pinchScrollRafRef.current = null;
      }
      if (zoomAnimationRef.current !== null) {
        cancelAnimationFrame(zoomAnimationRef.current);
        zoomAnimationRef.current = null;
      }
    };
  }, [requestResponsiveZoom]);

  // --- Fonts Setup ---
  const defaultFontFamily = layoutConfig.fontFamily || "'TH Sarabun New', sans-serif";
  const noteFontFamily = layoutConfig.noteFontFamily || defaultFontFamily;
  const textFontFamily = layoutConfig.textFontFamily || defaultFontFamily;
  const pageFontFamily = layoutConfig.pageFontFamily || textFontFamily;
  const hasHeaderDetails = headerDetails.some((detail) => hasVisibleHtml(detail.label) || hasVisibleHtml(detail.value));

  const commitTokenEdit = useCallback(() => {
    if (!editingTokenCell || !updateCellToken) return;
    const { r, m, c } = editingTokenCell;
    updateCellToken(r, m, c, editingTokenValue, {
      preview: editingTokenValue.trim() !== '',
      keepSelection: true,
    });
    setEditingTokenCell(null);
    setEditingTokenValue('');
  }, [editingTokenCell, editingTokenValue, updateCellToken]);

  const cancelTokenEdit = useCallback(() => {
    setEditingTokenCell(null);
    setEditingTokenValue('');
  }, []);

  const startTokenEdit = useCallback((r, m, c, note) => {
    if (isReadOnly) return;
    if (isPlaying && stopPlayback) stopPlayback();
    setSelectedCell([r, m, c]);
    if (setSelectedSymbolId) setSelectedSymbolId(null);
    setEditingTokenCell({ r, m, c });
    setEditingTokenValue(note === '-' ? '' : (note || ''));
    if (setToolbarMode) setToolbarMode('text');
  }, [isReadOnly, isPlaying, stopPlayback, setSelectedCell, setSelectedSymbolId, setToolbarMode]);

  // ==========================================
  // 3. Global Event Listeners (Watchdog)
  // ==========================================
  useEffect(() => {
    const handleMouseUpGlobal = () => {
      if (endSelection) endSelection();
    };
    
    const handleMouseDownGlobal = (e) => {
      const isToolbar = e.target.closest('.playback-controls-container');
      if (isToolbar) return; 
      
      if (editingSongName) {
         const songEditor = document.getElementById('song-name-editor');
         if (songEditor && !songEditor.contains(e.target)) {
            setSongName(songEditor.innerHTML); 
            setEditingSongName(false);
         }
      }
      
      if (editingDetailId) {
         const activeDetail = document.querySelector(`div[data-id="${editingDetailId}"]`);
         if (activeDetail && !activeDetail.contains(e.target)) {
            const field = activeDetail.getAttribute('data-field');
            updateDetail(editingDetailId, field, activeDetail.innerHTML); 
            setEditingDetailId(null);
            setEditingDetailField(null);
         }
      }

      if (editingTokenCell) {
        const tokenEditor = document.getElementById(`token-editor-${editingTokenCell.r}-${editingTokenCell.m}-${editingTokenCell.c}`);
        if (tokenEditor && !tokenEditor.contains(e.target)) {
          commitTokenEdit();
        }
      }

      const activeEl = document.activeElement;
      if (activeEl && activeEl !== document.body && typeof activeEl.id === 'string' && !activeEl.contains(e.target)) {
        if (activeEl.id.startsWith('text-row-')) {
          const rowIndex = Number(activeEl.id.replace('text-row-', ''));
          if (!Number.isNaN(rowIndex) && updateTextRow) {
            updateTextRow(rowIndex, activeEl.innerHTML);
          }
        } else if (activeEl.id.startsWith('annotation-')) {
          const parts = activeEl.id.replace('annotation-', '').split('-').map(Number);
          if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && updateMeasureText) {
            updateMeasureText(parts[0], parts[1], activeEl.innerHTML);
          }
        }
      }
    };

    window.addEventListener('mouseup', handleMouseUpGlobal);
    // ⭐ ใส่ true เพื่อให้ทำงานแบบ Capture Phase (ดักจับก่อนโดน StopPropagation)
    window.addEventListener('mousedown', handleMouseDownGlobal, true); 
    return () => {
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      window.removeEventListener('mousedown', handleMouseDownGlobal, true);
    };
  }, [endSelection, editingSongName, editingDetailId, editingTokenCell, commitTokenEdit, setSongName, updateDetail]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // ป้องกันไม่ให้ทำงานซ้อนทับตอนกำลังพิมพ์ในกล่องข้อความที่มีอยู่แล้ว
      if (e.target.tagName === 'INPUT' || e.target.closest('[contenteditable="true"]')) return;
      
      if (e.key === 'Enter') {
        e.preventDefault();
        const [rIndex, mIndex] = selectedCell;
        const rType = rowTypes[rIndex];

        // 1. ถ้าไม่ได้อยู่บรรทัดโน้ต ให้ทำงานปกติ
        if (rType === 'text' || rType === 'page-break') {
          if (addTextRow) addTextRow(true);
          return;
        }

        // 2. ⭐ ระบบคำนวณหารครึ่งอัจฉริยะ สำหรับแทรกบรรทัดข้อความ
        if (sheetData[rIndex]) {
          const currentMeasureCount = sheetData[rIndex].length;
          // คำนวณกึ่งกลางของห้องในบรรทัดนั้น (เช่น 8 ห้อง -> ครึ่งคือ 4, 4 ห้อง -> ครึ่งคือ 2)
          const halfLimit = Math.ceil(currentMeasureCount / 2);
          
          // ถ้าอยู่ครึ่งแรก (ซ้าย) ให้แทรกขึ้นข้างบน (true) | ถ้าอยู่ครึ่งหลัง (ขวา) ให้แทรกกกราบลงข้างล่าง (false)
          const isFirstHalf = mIndex < halfLimit;
          
          if (addTextRow) {
            addTextRow(isFirstHalf);
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedCell, rowTypes, sheetData, addTextRow]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 768px)').matches) {
      setToolbarMode('default');
      return undefined;
    }
    const [r, m] = selectedCell;
    if (rowTypes[r] === 'text') {
      setToolbarMode('text'); 
      setTimeout(() => {
        const textEl = document.getElementById(`text-row-${r}`);
        if (textEl) {
          const sel = window.getSelection();
          if (!textEl.contains(sel.anchorNode)) {
            textEl.focus();
            if (document.createRange) {
              const range = document.createRange();
              range.selectNodeContents(textEl);
              range.collapse(false); 
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }
      }, 10); 
    } else if (rowTypes[r] === 'annotation') {
      // ⭐ เปิด Toolbar ข้อความสำหรับบรรทัดคำอธิบายด้วย
      setToolbarMode('text');
      setTimeout(() => {
        const annoEl = document.getElementById(`annotation-${r}-${m}`);
        if (annoEl) {
          const sel = window.getSelection();
          if (!annoEl.contains(sel.anchorNode)) {
            annoEl.focus();
            if (document.createRange) {
              const range = document.createRange();
              range.selectNodeContents(annoEl);
              range.collapse(false); 
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }
      }, 10);
    } else {
      setToolbarMode('default'); 
    }
  }, [selectedCell[0], selectedCell[1], rowTypes, setToolbarMode]);

  useEffect(() => {
    if (selectedSymbolId) setToolbarMode('symbol');
  }, [selectedSymbolId, setToolbarMode]);

// ==========================================
// ⭐ 1. ระบบล็อกหน้าจอ (ปลดล็อกให้เลื่อนสมูทได้ตลอด)
// ==========================================
  useEffect(() => {
    const vContainer = document.querySelector('main');
    if (vContainer) {
      vContainer.style.overflowY = 'auto'; 
    }
    return () => {
      if (vContainer) vContainer.style.overflowY = 'auto';
    };
  }, [isPlaying, isAutoScroll]);
// ==========================================
// ⭐ 2. ระบบติดตามเคอร์เซอร์ "ทีละบรรทัด" (Line-by-Line Tracking)
// ==========================================
  const lastScrolledRowRef = useRef(null);
  const activePageRef = useRef(0);

  useEffect(() => {
    if (!isPlaying) lastScrolledRowRef.current = null;
  }, [isPlaying]);

  useEffect(() => {
    const targetCursor = (isPlaying && isAutoScroll && playbackCursor) ? playbackCursor : null;
    if (!targetCursor) return;

    const [r, m, c] = targetCursor;
    // ⭐ Bug fix 1: ถ้า playbackCursor อยู่บน nathap/annotation ต้องหา parent row เพื่อ scroll/paint
    let scrollR = r;
    if (rowTypes[r] === 'nathap' || rowTypes[r] === 'annotation') {
      let findMainR = r;
      while (findMainR >= 0 && (rowTypes[findMainR] === 'nathap' || rowTypes[findMainR] === 'annotation')) {
        findMainR -= 1;
      }
      if (findMainR >= 0) {
        if (rowTypes[findMainR] === 'double-left') findMainR -= 1;
        scrollR = findMainR;
      }
    }
    const noteEl = document.getElementById(`note-${scrollR}-${m}-${c}`) || document.getElementById(`note-${r}-${m}-${c}`);
    const hContainer = document.getElementById('sheet-scroll-container');
    const page0 = document.getElementById('page-0');

    if (noteEl && hContainer && page0) {
      const pageEl = noteEl.closest('.print-page');

      if (pageEl) {
        const pageIndex = parseInt(pageEl.id.split('-')[1]);
        const isPageChanged = activePageRef.current !== pageIndex;

        // --- แกน X: เลื่อนแผ่นกระดาษแนวนอน ---
        if (isPageChanged) {
          const unzoomedDistance = pageEl.offsetLeft - page0.offsetLeft;
          const targetLeft = unzoomedDistance * (zoom / 100);
          const isMobileViewport = window.matchMedia('(max-width: 767px)').matches;
          hContainer.scrollTo({ left: targetLeft, behavior: isMobileViewport ? 'auto' : 'smooth' });
          activePageRef.current = pageIndex;
        }

        // --- แกน Y: เลื่อนแนวตั้ง (ทำงานเฉพาะตอนเปลี่ยนบรรทัดเท่านั้น) ---
        const isRowChanged = lastScrolledRowRef.current !== r;

        if (isRowChanged) {
          const doVerticalScroll = () => {
            const currentNoteEl = document.getElementById(`note-${r}-${m}-${c}`);
            if (!currentNoteEl) return;

            const vContainer = document.querySelector('main') || window;
            const noteRect = currentNoteEl.getBoundingClientRect();
            const isMobileViewport = window.matchMedia('(max-width: 767px)').matches;
            const scrollBehavior = isMobileViewport ? 'auto' : 'smooth';
            
            // คำนวณให้โน้ตอยู่กลางจอ โดยหักลบความสูงแถบเครื่องมือด้านบน (ประมาณ 80px)
            if (vContainer === window) {
              const targetY = window.scrollY + noteRect.top - (window.innerHeight / 2) + (noteRect.height / 2);
              window.scrollTo({ top: targetY, behavior: scrollBehavior });
            } else {
              const parentRect = vContainer.getBoundingClientRect();
              const topOffset = 80; 
              const targetY = vContainer.scrollTop + (noteRect.top - parentRect.top) - topOffset - (parentRect.height / 2) + (noteRect.height / 2);
              vContainer.scrollTo({ top: targetY, behavior: scrollBehavior });
            }
          };

          // Do not leave a delayed scroll behind: on fast passages it can run
          // after the cursor has already moved and make mobile playback jump.
          doVerticalScroll();

          lastScrolledRowRef.current = r;
        }
      }
    }
  }, [playbackCursor, isAutoScroll, isPlaying, zoom]);
// ==========================================
  // ⭐ 2.5 ระบบติดตามและเลื่อนหน้าจอตามเคอร์เซอร์แก้ไข (Edit Tracking)
  // ==========================================
  const lastEditRowRef = useRef(null);
  const editPageRef = useRef(0);

  useEffect(() => {
    if (isPlaying) {
      lastEditRowRef.current = null;
      return; 
    }

    if (!selectedCell) return;
    const [r, m, c] = selectedCell;
    const targetEl = document.getElementById(`note-${r}-${m}-${c}`) || document.getElementById(`text-row-${r}`);
    const hContainer = document.getElementById('sheet-scroll-container');
    const page0 = document.getElementById('page-0');

    if (targetEl && hContainer && page0) {
      const pageEl = targetEl.closest('.print-page');

      if (pageEl) {
        const pageIndex = parseInt(pageEl.id.split('-')[1]);
        const isPageChanged = editPageRef.current !== pageIndex;

        // --- 1. เลื่อนแนวนอน (หน้ากระดาษ) ทันที ---
        if (isPageChanged) {
          const unzoomedDistance = pageEl.offsetLeft - page0.offsetLeft;
          const targetLeft = unzoomedDistance * (zoom / 100);
          hContainer.scrollTo({ left: targetLeft, behavior: 'smooth' });
          editPageRef.current = pageIndex;
        }

        // --- 2. เลื่อนแนวตั้ง (จัดกึ่งกลางจอ) ทันที ---
        const isRowChanged = lastEditRowRef.current !== r;

        // บังคับเลื่อนเมื่อเปลี่ยนบรรทัด หรือ เปลี่ยนหน้ากระดาษ
        if (isRowChanged || isPageChanged) {
          
          // หน่วงเวลา 50ms (แค่พริบตาเดียว) เพื่อให้ React เรนเดอร์ DOM เสร็จก่อนคำนวณระยะ
          setTimeout(() => {
            const el = document.getElementById(`note-${r}-${m}-${c}`) || document.getElementById(`text-row-${r}`);
            if (!el) return;

            const vContainer = document.querySelector('main') || window;
            const rect = el.getBoundingClientRect();
            
            // ⭐ จุดที่ 3: ใช้สูตร scrollTo แบบ Absolute แม่นยำกว่าทุกเบราว์เซอร์
            if (vContainer === window) {
              const targetY = window.scrollY + rect.top - (window.innerHeight / 2) + (rect.height / 2);
              window.scrollTo({ top: targetY, behavior: 'smooth' });
            } else {
              const parentRect = vContainer.getBoundingClientRect();
              const topOffset = 60; // ปรับชดเชยความสูงของเมนูด้านบน
              const targetY = vContainer.scrollTop + (rect.top - parentRect.top) - topOffset - (parentRect.height / 2) + (rect.height / 2);
              vContainer.scrollTo({ top: targetY, behavior: 'smooth' });
            }
          }, 50);

          lastEditRowRef.current = r;
        }
      }
    }
  }, [selectedCell, isPlaying, zoom]);
  // ==========================================
  // 4. Render Calculations (จัดหน้ากระดาษ)
  // ==========================================
  const displayRowNumbers = useMemo(() => {
    let currentNumber = 0;
    return rowTypes.map(type => {
      if (type === 'single' || type === 'double-right') {
        currentNumber++;
        return currentNumber;
      }
      return ''; 
    });
  }, [rowTypes]);

  const pages = useMemo(() => {
    const A4_HEIGHT_PX = 1122; 
    const mUnit = layoutConfig.marginUnit || 'px';
    const mTopPx = getMarginPx(layoutConfig.marginTop ?? 48, mUnit);
    const mBotPx = getMarginPx(layoutConfig.marginBottom ?? 48, mUnit);
    const PAGE_PADDING = mTopPx + mBotPx;
    const FOOTER_SPACE = 20;   
    
    const headerLines = layoutConfig.detailsAlign === 'between' ? Math.ceil(headerDetails.length / 2) : headerDetails.length;
    const headerBottomSpacing = layoutConfig.headerBottomSpacing ?? 8;
    const headerHeight = 40 + (layoutConfig.songNameSize * 1.5) + (headerLines * 25) + (headerBottomSpacing - 8);

    const calculatedPages = [];
    let currentRows = [];
    let currentUsedHeight = 0;
    let isFirstPage = true;

    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i];
      const rType = rowTypes[i];
      const headerSpace = isFirstPage ? headerHeight : 0;
      const rMarginTop = rowMargins[i]?.top || 0;
      const rMarginBot = rowMargins[i]?.bottom || 0;
      
      if (rType === 'page-break') {
        if (currentRows.length > 0) {
          calculatedPages.push({ rows: currentRows, startIndex: i - currentRows.length });
          currentRows = []; currentUsedHeight = 0; isFirstPage = false;
        }
        currentRows.push(row);
        continue;
      }

      if (rType === 'text') {
        let textValue = (row && row[0] && typeof row[0][0] === 'string') ? row[0][0] : '';
        const breakCount = (textValue.match(/<br\s*\/?>/gi) || []).length;
        const divCount = (textValue.match(/<div/gi) || []).length;
        const pCount = (textValue.match(/<p/gi) || []).length;
        const totalLines = Math.max(1, 1 + breakCount + divCount + pCount);

        const textLineHeight = layoutConfig.textLineHeight || 1.5;
        const baseLineHeight = Math.max(20, (layoutConfig.textFontSize || 16) * textLineHeight);
        const textRowHeight = (baseLineHeight * totalLines) + rMarginTop + rMarginBot; 
        
        if ((currentUsedHeight + textRowHeight + 120 + headerSpace + PAGE_PADDING + FOOTER_SPACE > A4_HEIGHT_PX) && currentRows.length > 0) {
          calculatedPages.push({ rows: currentRows, startIndex: i - currentRows.length });
          currentRows = [row]; currentUsedHeight = textRowHeight; isFirstPage = false;
        } else {
          currentRows.push(row); currentUsedHeight += textRowHeight;
        }
        continue;
      }

      const isDoubleRight = rType === 'double-right';
      const isDoubleLeft = rType === 'double-left';
      const isDouble = isDoubleRight || isDoubleLeft;
      const isNathap = rType === 'nathap';
      const measureCount = getMeasureCountForRowType(row, rType);
      const visualLines = Math.max(1, Math.ceil(measureCount / MAIN_STAFF_MEASURE_COUNT));
      
      const gridHeight = (layoutConfig.measureHeight * visualLines) + (layoutConfig.rowGap * Math.max(0, visualLines - 1));
      const pb = (isDoubleRight || isNathap) ? 0 : layoutConfig.rowGap; 
      const actualRowHeight = gridHeight + pb + rMarginTop + rMarginBot;
      let combinedHeight = actualRowHeight;
      
      if (isDoubleRight && i + 1 < sheetData.length && rowTypes[i + 1] === 'double-left') {
         const nextRow = sheetData[i + 1];
         const nextMeasureCount = getMeasureCountForRowType(nextRow, rowTypes[i + 1]);
         const nextVisualLines = Math.max(1, Math.ceil(nextMeasureCount / 8));
         const nextGridHeight = (layoutConfig.measureHeight * nextVisualLines) + (layoutConfig.rowGap * Math.max(0, nextVisualLines - 1));
         const nextRMarginTop = rowMargins[i+1]?.top || 0;
         const nextRMarginBot = rowMargins[i+1]?.bottom || 0;
         combinedHeight += nextGridHeight + layoutConfig.rowGap + nextRMarginTop + nextRMarginBot;
      }

      if (rType !== 'double-left' && (currentUsedHeight + combinedHeight + headerSpace + PAGE_PADDING + FOOTER_SPACE > A4_HEIGHT_PX) && currentRows.length > 0) {
        calculatedPages.push({ rows: currentRows, startIndex: i - currentRows.length });
        currentRows = [row]; currentUsedHeight = actualRowHeight; isFirstPage = false;
      } else {
        currentRows.push(row); currentUsedHeight += actualRowHeight;
      }
    }

    if (currentRows.length > 0) {
      calculatedPages.push({ rows: currentRows, startIndex: sheetData.length - currentRows.length });
    }
    return calculatedPages;
  }, [sheetData, layoutConfig, headerDetails, rowTypes, sectionLabels, rowMargins, paginateTrigger]);

  const createPageBreakRow = () => Array.from({ length: 8 }, () => Array(4).fill('-'));
  const createBlankMusicRow = () => Array.from({ length: 8 }, () => Array(4).fill('-'));
  const clonePageValue = (value) => JSON.parse(JSON.stringify(value));

  const commitPageStructure = (newData, newTypes, newMargins, originalRowMap, duplicateRowMap = new Map(), preferredRow = 0) => {
    const visualRowByIndex = [];
    rowTypes.forEach((type, rowIndex) => {
      if (type === 'single' || type === 'double-right') visualRowByIndex.push(rowIndex);
    });

    const getNewVisualIndex = (targetRow) => {
      if (typeof targetRow !== 'number') return -1;
      let visualIndex = 0;
      for (let rowIndex = 0; rowIndex < targetRow; rowIndex++) {
        if (newTypes[rowIndex] === 'single' || newTypes[rowIndex] === 'double-right') visualIndex += 1;
      }
      return (newTypes[targetRow] === 'single' || newTypes[targetRow] === 'double-right') ? visualIndex : -1;
    };

    const newLabels = {};
    Object.entries(sectionLabels).forEach(([oldVisualIndex, labels]) => {
      const sourceRow = visualRowByIndex[Number(oldVisualIndex)];
      const mappedRow = originalRowMap.get(sourceRow);
      const mappedVisualIndex = getNewVisualIndex(mappedRow);
      if (mappedVisualIndex >= 0) newLabels[mappedVisualIndex] = clonePageValue(labels);

      const duplicatedRow = duplicateRowMap.get(sourceRow);
      const duplicatedVisualIndex = getNewVisualIndex(duplicatedRow);
      if (duplicatedVisualIndex >= 0) {
        newLabels[duplicatedVisualIndex] = clonePageValue(labels).map((label, index) => ({
          ...label,
          id: Date.now() + index + Math.random()
        }));
      }
    });

    const remapSymbol = (symbol, rowMap, duplicate = false, index = 0) => {
      const startRow = rowMap.get(symbol.start[0]);
      const endRow = rowMap.get(symbol.end[0]);
      if (typeof startRow !== 'number' || typeof endRow !== 'number') return null;
      return {
        ...clonePageValue(symbol),
        ...(duplicate ? { id: Date.now() + index + Math.random() } : {}),
        start: [startRow, symbol.start[1], symbol.start[2]],
        end: [endRow, symbol.end[1], symbol.end[2]]
      };
    };

    const newSymbols = symbols
      .map((symbol, index) => remapSymbol(symbol, originalRowMap, false, index))
      .filter(Boolean);
    symbols.forEach((symbol, index) => {
      const duplicatedSymbol = remapSymbol(symbol, duplicateRowMap, true, index);
      if (duplicatedSymbol) newSymbols.push(duplicatedSymbol);
    });

    commitChange(newData, newTypes, newLabels, newSymbols, newMargins);
    if (setSelectionRange) setSelectionRange(null);
    const safeRow = Math.max(0, Math.min(newData.length - 1, preferredRow));
    const firstMeasure = (newTypes[safeRow]?.startsWith('double') || (newTypes[safeRow] === 'nathap' && newData[safeRow]?.length === 9)) ? 1 : 0;
    setSelectedCell([safeRow, firstMeasure, 0]);
  };

  const addBlankPageAfter = (page) => {
    if (isReadOnly) return;
    if (isPlaying && stopPlayback) stopPlayback();
    const insertIndex = page.startIndex + page.rows.length;
    const shouldCloseBlankPage = insertIndex < sheetData.length && rowTypes[insertIndex] !== 'page-break';
    const insertedData = [createPageBreakRow(), createBlankMusicRow()];
    const insertedTypes = ['page-break', 'single'];
    const insertedMargins = [{ top: 0, bottom: 0, left: 0 }, { top: 0, bottom: 0, left: 0 }];
    if (shouldCloseBlankPage) {
      insertedData.push(createPageBreakRow());
      insertedTypes.push('page-break');
      insertedMargins.push({ top: 0, bottom: 0, left: 0 });
    }

    const newData = [...sheetData.slice(0, insertIndex), ...insertedData, ...sheetData.slice(insertIndex)];
    const newTypes = [...rowTypes.slice(0, insertIndex), ...insertedTypes, ...rowTypes.slice(insertIndex)];
    const newMargins = [...rowMargins.slice(0, insertIndex), ...insertedMargins, ...rowMargins.slice(insertIndex)];
    const originalRowMap = new Map();
    rowTypes.forEach((_, rowIndex) => originalRowMap.set(rowIndex, rowIndex < insertIndex ? rowIndex : rowIndex + insertedTypes.length));
    commitPageStructure(newData, newTypes, newMargins, originalRowMap, new Map(), insertIndex + 1);
  };

  const duplicatePage = (page) => {
    if (isReadOnly) return;
    if (isPlaying && stopPlayback) stopPlayback();
    const insertIndex = page.startIndex + page.rows.length;
    const sourceRows = page.rows
      .map((_, localIndex) => page.startIndex + localIndex)
      .filter((rowIndex) => rowTypes[rowIndex] !== 'page-break');
    if (sourceRows.length === 0) return;

    const insertedData = [createPageBreakRow(), ...sourceRows.map((rowIndex) => clonePageValue(sheetData[rowIndex]))];
    const insertedTypes = ['page-break', ...sourceRows.map((rowIndex) => rowTypes[rowIndex])];
    const insertedMargins = [
      { top: 0, bottom: 0, left: 0 },
      ...sourceRows.map((rowIndex) => clonePageValue(rowMargins[rowIndex] || { top: 0, bottom: 0, left: 0 }))
    ];
    const shouldCloseDuplicate = insertIndex < sheetData.length && rowTypes[insertIndex] !== 'page-break';
    if (shouldCloseDuplicate) {
      insertedData.push(createPageBreakRow());
      insertedTypes.push('page-break');
      insertedMargins.push({ top: 0, bottom: 0, left: 0 });
    }

    const newData = [...sheetData.slice(0, insertIndex), ...insertedData, ...sheetData.slice(insertIndex)];
    const newTypes = [...rowTypes.slice(0, insertIndex), ...insertedTypes, ...rowTypes.slice(insertIndex)];
    const newMargins = [...rowMargins.slice(0, insertIndex), ...insertedMargins, ...rowMargins.slice(insertIndex)];
    const originalRowMap = new Map();
    rowTypes.forEach((_, rowIndex) => originalRowMap.set(rowIndex, rowIndex < insertIndex ? rowIndex : rowIndex + insertedTypes.length));
    const duplicateRowMap = new Map();
    sourceRows.forEach((sourceRow, index) => duplicateRowMap.set(sourceRow, insertIndex + 1 + index));
    commitPageStructure(newData, newTypes, newMargins, originalRowMap, duplicateRowMap, insertIndex + 1);
  };

  const deletePage = (page, pageIndex) => {
    if (isReadOnly) return;
    if (isPlaying && stopPlayback) stopPlayback();

    if (pages.length <= 1) {
      commitChange([createBlankMusicRow()], ['single'], {}, [], [{ top: 0, bottom: 0, left: 0 }]);
      if (setSelectionRange) setSelectionRange(null);
      setSelectedCell([0, 0, 0]);
      return;
    }

    const deleteStart = page.startIndex;
    const deleteEnd = page.startIndex + page.rows.length;
    const survivingRows = [];
    for (let rowIndex = 0; rowIndex < sheetData.length; rowIndex++) {
      if (rowIndex < deleteStart || rowIndex >= deleteEnd) survivingRows.push(rowIndex);
    }

    const boundaryPosition = survivingRows.findIndex((rowIndex) => rowIndex >= deleteEnd);
    const needsBoundary = pageIndex > 0
      && boundaryPosition >= 0
      && rowTypes[survivingRows[boundaryPosition]] !== 'page-break';
    const newData = [];
    const newTypes = [];
    const newMargins = [];
    const originalRowMap = new Map();

    survivingRows.forEach((oldRowIndex, survivorIndex) => {
      if (needsBoundary && survivorIndex === boundaryPosition) {
        newData.push(createPageBreakRow());
        newTypes.push('page-break');
        newMargins.push({ top: 0, bottom: 0, left: 0 });
      }
      originalRowMap.set(oldRowIndex, newData.length);
      newData.push(sheetData[oldRowIndex]);
      newTypes.push(rowTypes[oldRowIndex]);
      newMargins.push(rowMargins[oldRowIndex] || { top: 0, bottom: 0, left: 0 });
    });

    const preferredRow = boundaryPosition >= 0
      ? (originalRowMap.get(survivingRows[boundaryPosition]) ?? Math.max(0, deleteStart - 1))
      : Math.max(0, newData.length - 1);
    commitPageStructure(newData, newTypes, newMargins, originalRowMap, new Map(), preferredRow);
  };

  // ==========================================
  // 5. Symbol & SVG Calculations
  // ==========================================
  const calculatePaths = useCallback(() => {
    const newPagePaths = {};
    const scale = zoom / 100;

    symbols.forEach(sym => {
      const isKro = sym.type === 'kro';

      // ⭐ แก้ไขการดึงค่า (ดึงจาก sym โดยตรง โดยใช้ชื่อ key แบบพิมพ์เล็ก)
      // ถ้าไม่มีค่าเฉพาะตัว ค่อยไปดึงค่า Global มาใช้
      const color = sym.color || (isKro ? (layoutConfig.kroColor || '#3b82f6') : (layoutConfig.sabatColor || '#1e293b'));
      
      // ⭐ แก้ไขปัญหาความหนา (Stroke Width) ไม่อัปเดต
      const strokeW = sym.strokewidth !== undefined ? sym.strokewidth : (isKro ? (layoutConfig.kroStrokeWidth || 2.5) : (layoutConfig.sabatStrokeWidth || 2.5));
      
      // ⭐ แก้ไขปัญหาความนูน/โค้ง (Curve) ไม่อัปเดต
      const offset = sym.offset !== undefined ? sym.offset : (isKro ? (layoutConfig.kroOffset || 30) : (layoutConfig.sabatOffset || 4));
      const curve = sym.curve !== undefined ? sym.curve : (layoutConfig.sabatCurve ?? 20);

      if (isKro && sym.start[0] !== sym.end[0]) {
        // กรณีลูกกรอข้ามบรรทัด (ยังคงเหมือนเดิม)
        for (let r = sym.start[0]; r <= sym.end[0]; r++) {
          const pageIndex = pages.findIndex(p => r >= p.startIndex && r < p.startIndex + p.rows.length);
          if (pageIndex === -1) continue;

          const rowStartCell = (r === sym.start[0]) ? sym.start : [r, 0, 0];
          const rowEndCell = (r === sym.end[0]) ? sym.end : [r, sheetData[r].length - 1, sheetData[r][sheetData[r].length - 1].length - 1];

          const startEl = document.getElementById(`note-${rowStartCell[0]}-${rowStartCell[1]}-${rowStartCell[2]}`);
          const endEl = document.getElementById(`note-${rowEndCell[0]}-${rowEndCell[1]}-${rowEndCell[2]}`);

          if (startEl && endEl) {
            const pageEl = document.getElementById(`page-${pageIndex}`);
            const pRect = pageEl.getBoundingClientRect();
            // หาโค้ดเดิมที่เขียนว่า const sRect = startEl.getBoundingClientRect(); แล้วเปลี่ยนเป็นแบบนี้ครับ 👇
            let sRect = startEl.getBoundingClientRect();
            const startParts = startEl.querySelectorAll('.tme-note-part');
            // ⭐ สั่งให้ลากเส้นออกจากโน้ต "ตัวแรก" ในช่องนั้น
            if (startParts.length > 0) sRect = startParts[0].getBoundingClientRect(); 

            let eRect = endEl.getBoundingClientRect();
            const endParts = endEl.querySelectorAll('.tme-note-part');
            // ⭐ สั่งให้ปลายเส้นไปชี้ที่โน้ต "ตัวสุดท้าย" ในช่องนั้น!
            if (endParts.length > 0) eRect = endParts[endParts.length - 1].getBoundingClientRect();

            const x1 = (sRect.left - pRect.left + (sRect.width / 2)) / scale;
            const y1 = (sRect.top - pRect.top) / scale + offset; 
            const x2 = (eRect.left - pRect.left + (eRect.width / 2)) / scale;
            const y2 = (eRect.top - pRect.top) / scale + offset;

            const d = `M ${x1} ${y1} L ${x2} ${y2}`;
            if (!newPagePaths[pageIndex]) newPagePaths[pageIndex] = [];
            newPagePaths[pageIndex].push({ id: `${sym.id}-${r}`, type: 'kro', d, color, strokeW });
          }
        }
      } else {
        const startEl = document.getElementById(`note-${sym.start[0]}-${sym.start[1]}-${sym.start[2]}`);
        const endEl = document.getElementById(`note-${sym.end[0]}-${sym.end[1]}-${sym.end[2]}`);

        if (startEl && endEl) {
          const pageIndex = pages.findIndex(p => sym.start[0] >= p.startIndex && sym.start[0] < p.startIndex + p.rows.length);
          if (pageIndex !== -1) {
            const pageEl = document.getElementById(`page-${pageIndex}`);
            const pRect = pageEl.getBoundingClientRect();
            const sRect = startEl.getBoundingClientRect();
            const eRect = endEl.getBoundingClientRect();

            const x1 = (sRect.left - pRect.left + (sRect.width / 2)) / scale;
            const y1 = (sRect.top - pRect.top) / scale; 
            const x2 = (eRect.left - pRect.left + (eRect.width / 2)) / scale;
            const y2 = (eRect.top - pRect.top) / scale;
            
            let d = "";

            if (isKro) {
                // วาดเส้นลูกกรอ + Offset
                d = `M ${x1} ${y1 + offset} L ${x2} ${y2 + offset}`;
            } else {
                // วาดเส้นลูกสะบัดโค้ง + Curve + Offset (ให้วาดขึ้นไปด้านบน เลยต้องติดลบ y)
                const finalY1 = y1 - offset;
                const finalY2 = y2 - offset;
                const dynamicCurve = curve + Math.abs(x2 - x1) * 0.15; // ถ้ายาวมากให้โค้งเพิ่มนิดนึง
                
                d = `M ${x1} ${finalY1} C ${x1 + (x2 - x1) * 0.25} ${finalY1 - dynamicCurve}, ${x2 - (x2 - x1) * 0.25} ${finalY2 - dynamicCurve}, ${x2} ${finalY2}`;
            }

            if (!newPagePaths[pageIndex]) newPagePaths[pageIndex] = [];
            newPagePaths[pageIndex].push({ id: sym.id, type: sym.type, d, color, strokeW });
          }
        }
      }
    });
    setPageSvgPaths(newPagePaths);
  }, [symbols, layoutConfig, pages, zoom, sheetData]);

  useEffect(() => {
    if (playbackCursor !== null) return; 
    const timerId = setTimeout(() => { calculatePaths(); }, 150); 
    return () => clearTimeout(timerId); 
  }, [calculatePaths, sheetData, rowTypes, headerDetails, zoom, playbackCursor]); 

  useEffect(() => {
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(calculatePaths, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [calculatePaths]);

  useEffect(() => {
    const handleBeforePrint = () => {
      const container = document.getElementById('sheet-scroll-container');
      if (container) { container.style.display = 'block'; container.style.width = '100%'; calculatePaths(); }
    };
    const handleAfterPrint = () => {
      const container = document.getElementById('sheet-scroll-container');
      if (container) { container.style.display = ''; container.style.width = ''; calculatePaths(); }
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [calculatePaths]);

  // ==========================================
  // 6. UI Interaction Handlers
  // ==========================================
  const handleRightClick = (e, rIndex, mIndex, cIndex) => {
    e.preventDefault(); 
    const existingSymbol = symbols.find(s => 
      (s.start[0] === rIndex && s.start[1] === mIndex && s.start[2] === cIndex) ||
      (s.end[0] === rIndex && s.end[1] === mIndex && s.end[2] === cIndex)
    );

    if (existingSymbol) {
      if (removeSymbol) removeSymbol(existingSymbol.id);
    } 
    else if (selectedCell && (selectedCell[0] !== rIndex || selectedCell[1] !== mIndex || selectedCell[2] !== cIndex)) {
      if (addSymbol) {
         const symType = layoutConfig.activeSymbol || 'sabat'; 
         addSymbol(symType, selectedCell, [rIndex, mIndex, cIndex], {
             color: symType === 'kro' ? '#3b82f6' : (layoutConfig.symbolColor || '#1e293b'),
             strokeWidth: layoutConfig.symbolStrokeWidth || 2.5,
             height: layoutConfig.symbolHeight !== undefined ? layoutConfig.symbolHeight : 20
         });
      }
    }
  };
  
  const renderSheetNote = (note, rIndex, mIndex, cIndex) => {
    if (note === '-') return <span>-</span>;
    const customStyle = layoutConfig.customStyles?.[`${rIndex}_${mIndex}_${cIndex}`] || {};
    const isBold = customStyle.isBold !== undefined ? customStyle.isBold : layoutConfig.isBold;
    const isItalic = customStyle.isItalic !== undefined ? customStyle.isItalic : layoutConfig.isItalic;
    const cellFontFamily = customStyle.noteFontFamily || noteFontFamily;
    const cellColor = customStyle.color || 'inherit'; 

    const tokenParts = splitThaiNoteToken(note);
    const isGroupedToken = tokenParts.length > 1;
    const groupedFontScale = tokenParts.length === 2
      ? 0.72
      : tokenParts.length === 3
        ? 0.58
        : Math.max(0.34, 0.52 - ((tokenParts.length - 4) * 0.045));
    const groupedFitWidth = Math.max(11, 92 / tokenParts.length);

    return (
      <span 
        className={`inline-flex h-full w-full min-w-0 items-center justify-center ${isBold ? 'font-bold' : 'font-normal'} ${isItalic ? 'italic' : ''}`}
        style={{ fontFamily: cellFontFamily, padding: '0.12em 1px 0.16em', color: cellColor, lineHeight: 1.12 }}
      >
        {isGroupedToken ? (
          <span
            className="inline-flex w-full min-w-0 items-center justify-evenly overflow-visible whitespace-nowrap"
            style={{
              gap: 0,
              fontSize: `min(${groupedFontScale}em, ${groupedFitWidth}cqi)`,
              lineHeight: 1.12
            }}
          >
            {tokenParts.map((part, index) => (
              <span key={`${rIndex}-${mIndex}-${cIndex}-${index}`} className="tme-note-part inline-flex min-w-0 items-center justify-center leading-[1.12]">
                {part}
              </span>
            ))}
          </span>
        ) : (
          <span className="tme-note-part inline-flex items-center justify-center leading-[1.12]">{note}</span>
        )}
      </span>
    );
  };

  const renderSectionLabels = (visualIndex, rowType, actualRowIndex) => { 
    const labels = sectionLabels[visualIndex];
    if (!labels || labels.length === 0) return null;
    
    return labels.map((label) => {
      if (!label.text) return null;
      
      // ⭐ ลบเงื่อนไขที่บล็อกป้ายออกไป เนื่องจากเราวาดมือซ้ายและมือขวารวมกันในกล่องเดียว (double-right) แล้ว
      // กล่องนี้จึงมีสิทธิ์วาดป้ายได้ทั้งด้านบนและด้านล่างอย่างอิสระครับ

      let positionStyle = { 
        position: 'absolute', color: '#0f172a',
        whiteSpace: 'nowrap', zIndex: 20, lineHeight: 1 
        // ❌ เอา fontSize, fontFamily ออก เพราะข้อมูลจะถูกควบคุมโดยโค้ด HTML (span) ในข้อความแล้ว
      };
      const labelOffset = label.offsetY !== undefined ? label.offsetY : 6;
      
      if (label.position.includes('top')) { 
        positionStyle.bottom = '100%'; positionStyle.marginBottom = `${labelOffset}px`; 
      } else { 
        positionStyle.top = '100%'; positionStyle.marginTop = `${labelOffset}px`; 
      }
      
      if (label.position.includes('left')) positionStyle.left = '0'; 
      else if (label.position.includes('center')) { positionStyle.left = '50%'; positionStyle.transform = 'translateX(-50%)'; } 
      else if (label.position.includes('right')) positionStyle.right = '0'; 
return (
        <div key={label.id} style={positionStyle} className="tracking-wide">
          <div
            id={`sheet-label-${label.id}`} // ⭐ 1. เพิ่ม ID ให้ระบบลิงก์ข้อความหากันเจอ
            onMouseDown={(e) => {
                e.stopPropagation();
                setSelectedCell([actualRowIndex, 0, 0]); 
            }}
          
            onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('tme-open-labels-tab'));
            }}
            dangerouslySetInnerHTML={{ __html: label.text || 'ป้ายกำกับ' }}
            className="cursor-pointer hover:ring-2 hover:ring-indigo-300 hover:bg-indigo-50/50 rounded px-1 transition-all print:hover:bg-transparent print:hover:ring-0 min-w-[20px]"
            title="คลิกเพื่อแก้ไขในแถบเครื่องมือ"
          />
        </div>
      );
    });
  };

  const selectionLimits = useMemo(() => {
    if (!selectionRange || !selectionRange.start || !selectionRange.end) return { min: -1, max: -1 };
    return {
      min: Math.min(selectionRange.start[0], selectionRange.end[0]),
      max: Math.max(selectionRange.start[0], selectionRange.end[0])
    };
  }, [selectionRange]);

  // ==========================================
  // 7. Main Rendering
  // ==========================================
  return (
    <div 
      className="relative w-full h-full flex flex-col flex-1 min-h-0 bg-slate-50/50"
      onMouseDown={() => {
        if (setToolbarMode) setToolbarMode('default');
        if (setSelectedSymbolId) setSelectedSymbolId(null);
      }}
    >
      <style>
        {`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            html, body, #root {
              width: 100% !important; height: auto !important; margin: 0 !important;
              padding: 0 !important; background: white !important; overflow: visible !important;
            }
            * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
            #sheet-scroll-container {
              display: block !important; width: 100% !important; max-width: 100% !important;
              padding: 0 !important; margin: 0 !important; overflow: visible !important; transform: none !important;
            }
            #sheet-pages { zoom: 1 !important; }
            .print-page { 
              display: block !important; width: 100% !important; min-width: 100% !important; max-width: 100% !important;
              height: 297mm !important; min-height: 297mm !important; max-height: 297mm !important;
              margin: 0 auto !important; box-shadow: none !important;
              border: none !important; page-break-inside: avoid !important; page-break-after: always !important; 
              break-after: page !important; zoom: 1 !important; 
            }
            .print-page:last-child { page-break-after: auto !important; break-after: auto !important; }
            .print-hidden { display: none !important; }
            .print-invisible { visibility: hidden !important; }
          }
          .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 10px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid #f8fafc; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `}
      </style>

      {/* Zoom Controls */}
      <div className={`absolute bottom-8 right-8 z-[60] ${props.hideZoomControls ? 'hidden' : 'flex'} flex-col items-center backdrop-blur-md border border-slate-200 shadow-xl rounded-xl overflow-hidden print:hidden transition-all duration-300 group ${isPlaying ? 'bg-slate-50/90' : 'bg-white/90 hover:shadow-2xl'}`}>
        <button
          onClick={() => requestResponsiveZoom(currentTarget => currentTarget + 10)}
          className="p-2.5 w-full flex justify-center text-slate-500 transition-colors hover:text-sky-600 hover:bg-sky-50 active:bg-sky-100"
          title="ขยายกระดาษ (Zoom In)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
        </button>
        <div
          onClick={() => requestResponsiveZoom(100)}
          className="px-2 py-1.5 text-[11px] font-black w-full text-center border-y border-slate-100 text-sky-700 bg-slate-50/80 cursor-pointer transition-colors select-none hover:bg-slate-100"
          title="คืนค่ากระดาษเป็น 100% (Reset Zoom)"
        >
          {Math.round(zoom)}%
        </div>
        <button
          onClick={() => requestResponsiveZoom(currentTarget => currentTarget - 10)}
          className="p-2.5 w-full flex justify-center text-slate-500 transition-colors hover:text-sky-600 hover:bg-sky-50 active:bg-sky-100"
          title="ย่อกระดาษ (Zoom Out)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4"/></svg>
        </button>
      </div>

     {/* Main Sheet Container */}
      <div 
        ref={setSheetScrollContainerRef}
        id="sheet-scroll-container"
        // ⭐ เปลี่ยนกลับเป็น pt-12 pb-32 เพื่อเอาพื้นที่อากาศออก ป้องกัน IDM บั๊ก
        className="flex overflow-auto pt-12 pb-32 w-full max-w-full custom-scrollbar select-none print:block print:overflow-visible print:p-0 relative"
        style={{ paddingLeft: `max(1rem, calc(50% - ${105 * (zoom / 100)}mm))`, paddingRight: `max(1rem, calc(50% - ${105 * (zoom / 100)}mm))`, touchAction: 'pan-x pan-y' }}
      >
        <div id="sheet-pages" className="flex gap-12 snap-x h-max print:block" style={{ zoom: `${zoom}%` }}>
          {pages.map((page, pIndex) => (
            <div 
              key={pIndex} 
              id={`page-${pIndex}`} 
              className="print-page relative bg-white w-[210mm] min-w-[210mm] h-[297mm] min-h-[297mm] shadow-xl border border-slate-200 flex flex-col text-slate-800 shrink-0 snap-center print:shadow-none print:border-none print:m-0 transition-shadow hover:shadow-2xl" 
              style={{ 
                fontFamily: pageFontFamily, 
                boxSizing: 'border-box',
                paddingTop: `${getMarginPx(layoutConfig.marginTop ?? 48, layoutConfig.marginUnit || 'px')}px`,
                paddingBottom: `${getMarginPx(layoutConfig.marginBottom ?? 48, layoutConfig.marginUnit || 'px')}px`,
                paddingLeft: `${getMarginPx(layoutConfig.marginLeft ?? 48, layoutConfig.marginUnit || 'px')}px`,
                paddingRight: `${getMarginPx(layoutConfig.marginRight ?? 48, layoutConfig.marginUnit || 'px')}px`,
              }}
            >
              {!isReadOnly && (
                <div
                  className="absolute -top-10 right-0 z-[70] hidden items-center gap-1.5 print:hidden md:flex"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); duplicatePage(page); }}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-sky-200 bg-white/95 px-2.5 text-[11px] font-bold text-sky-700 shadow-sm backdrop-blur transition hover:border-sky-300 hover:bg-sky-50 active:scale-95"
                    title={`ทำซ้ำหน้าที่ ${pIndex + 1}`}
                  >
                    <Copy size={13} />
                    <span>ทำซ้ำหน้า</span>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); deletePage(page, pIndex); }}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white/95 px-2.5 text-[11px] font-bold text-rose-600 shadow-sm backdrop-blur transition hover:border-rose-300 hover:bg-rose-50 active:scale-95"
                    title={`ลบหน้าที่ ${pIndex + 1} (สามารถ Undo ได้)`}
                  >
                    <Trash2 size={13} />
                    <span>ลบหน้า</span>
                  </button>
                </div>
              )}

              {!isReadOnly && (
                <button
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => { event.stopPropagation(); addBlankPageAfter(page); }}
                  className="absolute -right-9 top-1/2 z-[70] hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600 shadow-md transition hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-lg active:scale-95 print:hidden md:flex"
                  title={`เพิ่มหน้ากระดาษต่อจากหน้าที่ ${pIndex + 1}`}
                  aria-label={`เพิ่มหน้ากระดาษต่อจากหน้าที่ ${pIndex + 1}`}
                >
                  <Plus size={17} strokeWidth={2.5} />
                </button>
              )}

              
              {/* SVG Layer for Symbols */}
              {/* ให้พื้นที่คลิกของสัญลักษณ์อยู่เหนือป้ายกำกับที่ลอยทับบรรทัดถัดไปเสมอ */}
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none z-40 print:z-30 print:w-full print:max-w-full"
                viewBox="0 0 793.7008 1122.5197"
                preserveAspectRatio="none"
              >
                {(pageSvgPaths[pIndex] || []).map(p => {
                  const isSelected = p.id === selectedSymbolId;
                  const isKro = p.type === 'kro';
                  return (
                    <g key={p.id}>
                      <path 
                        d={p.d} fill="none" stroke="transparent" strokeWidth="20" 
                        className="pointer-events-auto cursor-pointer print:pointer-events-none"
                        onMouseDown={(e) => { e.stopPropagation(); if (setSelectedSymbolId) setSelectedSymbolId(p.id); }}
                      />
                      {isSelected && <path d={p.d} fill="none" stroke="#f59e0b" strokeWidth={p.strokeW + 4} strokeLinecap="round" opacity="0.4" className="pointer-events-none print:hidden" />}
                      <path 
                        d={p.d} fill="none" stroke={isSelected ? '#d97706' : (isKro ? '#3b82f6' : p.color)} 
                        strokeWidth={p.strokeW} strokeLinecap="round" strokeDasharray={isKro ? "6, 4" : "none"} 
                        className="pointer-events-none drop-shadow-sm transition-all duration-200"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Page Header (Only on first page) */}
              {pIndex === 0 && (
                <div
                  className="text-center border-b-2 border-slate-900 mb-3 shrink-0 relative z-10 print:border-b-2 print:border-slate-900"
                  style={{ paddingBottom: `${layoutConfig.headerBottomSpacing ?? 8}px` }}
                >
                  
                  {/* Song Name Editor */}
                  {editingSongName ? (
                     <div
                        id="song-name-editor"
                        contentEditable
                        suppressContentEditableWarning
                        autoFocus
                        onMouseDown={(e) => e.stopPropagation()}
                        onFocus={(e) => {
                          const el = e.target;
                          setTimeout(() => {
                            const range = document.createRange();
                            const sel = window.getSelection();
                            range.selectNodeContents(el);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                          }, 10); 
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); setSongName(e.target.innerHTML); setEditingSongName(false); }
                          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold', false, null); }
                          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); document.execCommand('italic', false, null); }
                        }}
                        onInput={(e) => {
                          initialSongNameRef.current = e.target.innerHTML;
                        }}
                        dangerouslySetInnerHTML={{ __html: initialSongNameRef.current }}
                        // 👇 เอา px-2 และ w-full ออก เพื่อไม่ให้มันบีบคำจนตกบรรทัด
                        className={`font-bold ${hasHeaderDetails ? 'mb-2' : 'mb-0'} uppercase tracking-tight text-center bg-white/90 border-b-2 border-sky-400 outline-none min-h-[1.5em] shadow-sm rounded`}
                        style={{ fontSize: `${layoutConfig.songNameSize}px`, fontFamily: pageFontFamily }}
                     />
                  ) : (
                    <h1 
                      className={`font-bold ${hasHeaderDetails ? 'mb-2' : 'mb-0'} uppercase tracking-tight cursor-text hover:bg-slate-100/50 rounded transition-colors print:hover:bg-transparent min-h-[1.5em]`}
                      style={{ fontSize: `${layoutConfig.songNameSize}px`, fontFamily: pageFontFamily }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (setToolbarMode) setToolbarMode('text');
                        initialSongNameRef.current = songName || ''; 
                        setEditingSongName(true);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      dangerouslySetInnerHTML={{ __html: songName || 'ชื่อเพลง' }}
                      title="ดับเบิลคลิกเพื่อแก้ไขชื่อเพลง (คลุมดำแล้วเปลี่ยนฟอนต์/ขนาดเฉพาะคำได้)"
                    />
                  )}

                  {!isReadOnly && !hasHeaderDetails && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); handleAddHeaderDetail(); }}
                      className="print-hidden absolute right-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600"
                      title="เพิ่มข้อมูลใต้หัวกระดาษ"
                      aria-label="เพิ่มข้อมูลใต้หัวกระดาษ"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Header Details */}
                  <div className={`grid gap-x-12 gap-y-1 px-4 ${layoutConfig.detailsAlign === 'between' ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ fontSize: `${layoutConfig.authorSize}px`, textAlign: layoutConfig.detailsAlign === 'between' ? 'left' : layoutConfig.detailsAlign, fontFamily: textFontFamily }}>
                    {headerDetails.map((detail, index) => (
                      <div
                        key={detail.id}
                        className={`relative group/header-detail rounded px-1 ${layoutConfig.detailsAlign === 'between' && index % 2 !== 0 ? "text-right" : ""} ${!hasVisibleHtml(detail.label) && !hasVisibleHtml(detail.value) ? 'print-invisible' : ''}`}
                      >
                        {!isReadOnly && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeDetail(detail.id);
                              if (editingDetailId === detail.id) {
                                setEditingDetailId(null);
                                setEditingDetailField(null);
                              }
                            }}
                            className="print-hidden absolute -right-5 top-1/2 -translate-y-1/2 rounded-full bg-white p-1 text-slate-300 opacity-0 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-rose-50 hover:text-rose-500 hover:ring-rose-200 group-hover/header-detail:opacity-100 group-focus-within/header-detail:opacity-100 focus:opacity-100"
                            title="ลบข้อมูลนี้"
                            aria-label="ลบข้อมูลนี้"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        
                        {/* Detail Label */}
                        {editingDetailId === detail.id && editingDetailField === 'label' ? (
                          <div
                            id="detail-editor"
                            data-id={detail.id}
                            data-field="label"
                            contentEditable
                            suppressContentEditableWarning
                            autoFocus
                            onMouseDown={(e) => e.stopPropagation()}
                            onFocus={(e) => {
                              const range = document.createRange();
                              const sel = window.getSelection();
                              range.selectNodeContents(e.target);
                              range.collapse(false);
                              sel.removeAllRanges();
                              sel.addRange(range);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); updateDetail(detail.id, 'label', e.target.innerHTML); setEditingDetailId(null); setEditingDetailField(null); }
                              if (e.key === 'Tab') {
                                e.preventDefault();
                                updateDetail(detail.id, 'label', e.target.innerHTML);
                                initialDetailValueRef.current = detail.value || '';
                                setEditingDetailField('value');
                              }
                              if (e.key === 'Escape') { e.preventDefault(); setEditingDetailId(null); setEditingDetailField(null); }
                              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold', false, null); }
                              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); document.execCommand('italic', false, null); }
                            }}
                            onInput={(e) => { initialDetailLabelRef.current = e.target.innerHTML; }}
                            dangerouslySetInnerHTML={{ __html: initialDetailLabelRef.current }}
                            className="inline-block font-bold bg-white/90 border-b border-sky-400 outline-none min-w-[50px] px-1 rounded shadow-sm"
                          />
                        ) : (
                          <>
                            <span 
                              className="font-bold cursor-text hover:bg-slate-100/50 rounded px-1 transition-colors print:hover:bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation(); 
                                if (isReadOnly) return;
                                if (setToolbarMode) setToolbarMode('text'); 
                                initialDetailLabelRef.current = detail.label || ''; 
                                setEditingDetailId(detail.id); 
                                setEditingDetailField('label'); 
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              dangerouslySetInnerHTML={{ __html: detail.label || '<span class="text-slate-300">หัวข้อ</span>' }}
                              title="คลิกเพื่อแก้ไขหัวข้อ"
                            />
                            {hasVisibleHtml(detail.label) && <span className="font-bold">:</span>}
                          </>
                        )}
                        
                        {' '}

                        {/* Detail Value */}
                        {editingDetailId === detail.id && editingDetailField === 'value' ? (
                          <div
                            id="detail-editor"
                            data-id={detail.id}
                            data-field="value"
                            contentEditable
                            suppressContentEditableWarning
                            autoFocus
                            onMouseDown={(e) => e.stopPropagation()}
                            onFocus={(e) => {
                              const range = document.createRange();
                              const sel = window.getSelection();
                              range.selectNodeContents(e.target);
                              range.collapse(false);
                              sel.removeAllRanges();
                              sel.addRange(range);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); updateDetail(detail.id, 'value', e.target.innerHTML); setEditingDetailId(null); setEditingDetailField(null); }
                              if (e.key === 'Escape') { e.preventDefault(); setEditingDetailId(null); setEditingDetailField(null); }
                              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold', false, null); }
                              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); document.execCommand('italic', false, null); }
                            }}
                            onInput={(e) => { initialDetailValueRef.current = e.target.innerHTML; }}
                            dangerouslySetInnerHTML={{ __html: initialDetailValueRef.current }}
                            className="inline-block bg-white/90 border-b border-sky-400 outline-none min-w-[100px] px-1 rounded shadow-sm"
                          />
                        ) : (
                          <span 
                            className="cursor-text hover:bg-slate-100/50 rounded px-1 transition-colors print:hover:bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation(); 
                              if (isReadOnly) return;
                              if (setToolbarMode) setToolbarMode('text'); 
                              initialDetailValueRef.current = detail.value || ''; 
                              setEditingDetailId(detail.id); 
                              setEditingDetailField('value'); 
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            dangerouslySetInnerHTML={{ __html: detail.value || '<span class="text-slate-300">รายละเอียด</span>' }}
                            title="คลิกเพื่อแก้ไขข้อมูล"
                          />
                        )}
                      </div>
                    ))}
                    {!isReadOnly && hasHeaderDetails && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); handleAddHeaderDetail(); }}
                        className="print-invisible col-span-full mx-auto mt-0.5 flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        เพิ่มข้อมูลใต้หัวกระดาษ
                      </button>
                    )}
                  </div>
                  {!isReadOnly && (
                    <div
                      role="separator"
                      aria-label="ลากเพื่อปรับระยะห่างใต้ชื่อเพลง"
                      title="ลากเส้นนี้ขึ้นหรือลงเพื่อปรับระยะห่าง"
                      onPointerDown={startHeaderSpacingDrag}
                      onPointerMove={moveHeaderSpacingDrag}
                      onPointerUp={stopHeaderSpacingDrag}
                      onPointerCancel={stopHeaderSpacingDrag}
                      className="print-hidden absolute inset-x-0 -bottom-1 z-30 h-3 cursor-ns-resize touch-none"
                    />
                  )}
                </div>
              )}

              {/* Rows Rendering */}
              <div className="flex flex-col w-full pb-12 print:pb-[15mm] h-full relative">
                {page.rows.map((row, localIndex) => {
                  const rIndex = page.startIndex + localIndex;
                  const rType = rowTypes[rIndex];
                  const isCursor = selectedCell[0] === rIndex;
                  
                  const rMarginTop = rowMargins[rIndex]?.top || 0;
                  const rMarginBot = rowMargins[rIndex]?.bottom || 0;
                  const rIndent = rowMargins[rIndex]?.left || 0;

                  if (rType === 'page-break') {
                     return (
                       <div key={`pb-${rIndex}`} className="w-full flex flex-col items-center justify-center my-1">
                         <div
                           onMouseDown={(e) => {
                              e.stopPropagation(); 
                              if(setSelectedSymbolId) setSelectedSymbolId(null);
                              setSelectedCell([rIndex, 0, 0]);
                              if (setToolbarMode) setToolbarMode('default');
                           }}
                           className={`flex items-center w-full py-2 cursor-pointer print-hidden select-none transition-all ${isCursor ? 'bg-indigo-50 ring-2 ring-indigo-400 rounded-md' : 'hover:bg-slate-50'}`}
                         >
                            <div className="w-full border-t-2 border-dashed border-slate-300"></div>
                         </div>
                       </div>
                     );
                  }

                  if (rType === 'text') {
                    let textValue = (row && row[0] && typeof row[0][0] === 'string') ? row[0][0] : '';
                    return (
                      <div 
                        key={`text-${rIndex}`} 
                        className="w-full flex items-center my-1 relative group print:my-1"
                        style={{ 
                          marginTop: `${rMarginTop}px`, marginBottom: `${rMarginBot}px`, 
                          paddingLeft: `calc(1rem + ${rIndent}px)`, paddingRight: '1rem',
                          zIndex: (rMarginTop < 0 || rMarginBot < 0) ? 20 : 10 
                        }}
                      >
                        <div
  id={`text-row-${rIndex}`} 
  contentEditable
  suppressContentEditableWarning
  onMouseDown={(e) => e.stopPropagation()}
  onMouseUp={(e) => {
    e.stopPropagation();
    if (selectedCell[0] !== rIndex) setSelectedCell([rIndex, 0, 0]); 
    if (setSelectedSymbolId) setSelectedSymbolId(null);
    if (setToolbarMode) setToolbarMode('text');
  }}
  onClick={(e) => e.stopPropagation()}
  // 1. เซฟค่าชั่วคราวตอนพิมพ์ (ป้องกันเคอร์เซอร์เด้ง)
                          // เซฟแบบเงียบๆ ป้องกันเคอร์เซอร์เด้ง
                          onInput={(e) => {
                            if (sheetData[rIndex] && sheetData[rIndex][0]) {
                              sheetData[rIndex][0][0] = e.target.innerHTML;
                            }
                            setPaginateTrigger(prev => prev + 1); 
                          }}
                          // ❌ ลบ onKeyUp ทิ้งไปแล้ว ❌

                          // เซฟจริงจังเข้าหน้าจอเมื่อคลิกออก
                          onBlur={(e) => {
                            const isToolbar = e.relatedTarget && e.relatedTarget.closest('.playback-controls-container');
                            if (isToolbar) return; 
                            if (updateTextRow) updateTextRow(rIndex, e.target.innerHTML);
                          }}
                          onKeyDown={(e) => {
                            if (isPlaying) stopPlayback();

                            // ⭐ ระบบ Enter อัจฉริยะ (ทับของเดิมเลยครับ)
                            if (e.key === 'Enter') {
                              const pageEl = e.target.closest('.print-page');
                              if (pageEl) {
                                 const pageRect = pageEl.getBoundingClientRect();
                                 const divRect = e.target.getBoundingClientRect();
                                 // เรดาร์กะระยะขอบล่าง (เว้นที่ไว้ 120px)
                                 const threshold = 120 * (zoom / 100); 
                                 
                                 // 🚨 ถ้ากล่องข้อความยาวจนชิดขอบล่างกระดาษแล้ว
                                 if (divRect.bottom > pageRect.bottom - threshold) {
                                    e.preventDefault();
                                    e.target.blur(); // เซฟเนื้อหาแผ่นนี้
                                    if (addTextRow) addTextRow(false); // ขึ้นกล่องใหม่/หน้าใหม่ให้ทันที!
                                    return;
                                 }
                              }
                              
                              // ✅ ถ้ากระดาษยังเหลือ: สับบรรทัด ณ "จุดที่เคอร์เซอร์อยู่" พอดีเป๊ะ
                              e.preventDefault();
                              document.execCommand('insertLineBreak');
                              
                              // บันทึกเงียบๆ ไม่ให้ React รีเฟรชจนเคอร์เซอร์เด้งหนี
                              if (sheetData[rIndex] && sheetData[rIndex][0]) {
                                sheetData[rIndex][0][0] = e.target.innerHTML;
                              }
                              setPaginateTrigger(prev => prev + 1);
                              return;
                            }

                            if (e.key === 'Tab') {
                              e.preventDefault(); document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
                              return;
                            }
                            
                            if (e.key === 'Backspace') {
                              const sel = window.getSelection();
                              if (sel && !sel.isCollapsed) return;
                              
                              let isAtStart = false;
                              if (sel.rangeCount > 0) {
                                 const range = sel.getRangeAt(0);
                                 const preCaretRange = range.cloneRange();
                                 preCaretRange.selectNodeContents(e.target);
                                 preCaretRange.setEnd(range.startContainer, range.startOffset);
                                 
                                 const tempDiv = document.createElement('div');
                                 tempDiv.appendChild(preCaretRange.cloneContents());
                                 if (tempDiv.textContent.length === 0 && !tempDiv.innerHTML.includes('<br>')) isAtStart = true;
                              }

                              if (isAtStart) {
                                  e.preventDefault(); 
                                  const htmlContent = e.target.innerHTML;
                                  const isEmpty = e.target.textContent.trim() === '' && !htmlContent.includes('<img');
                                  
                                  if (isEmpty || htmlContent === '<br>') {
                                      // ⭐ 2.1 บังคับให้ส่ง rIndex ไปเจาะจง
                                      if (removeRow) removeRow(rIndex);
                                  } else if (rIndex > 0 && rowTypes[rIndex - 1] === 'text') {
                                      const prevText = sheetData[rIndex - 1][0][0];
                                      sheetData[rIndex - 1][0][0] = prevText + htmlContent; 
                                      // ⭐ 2.2 บังคับให้ส่ง rIndex ไปเจาะจง
                                      if (removeRow) removeRow(rIndex); 
                                      
                                      setTimeout(() => {
                                          setSelectedCell([rIndex - 1, 0, 0]);
                                          const prevEl = document.getElementById(`text-row-${rIndex - 1}`);
                                          if (prevEl) {
                                              prevEl.focus();
                                              const newSel = window.getSelection();
                                              const newRange = document.createRange();
                                              newRange.selectNodeContents(prevEl);
                                              newRange.collapse(false); 
                                              newSel.removeAllRanges();
                                              newSel.addRange(newRange);
                                          }
                                      }, 50);
                                  }
                                  return;
                              }
                            } else if (e.key === 'Delete') {
                              if (e.target.textContent.trim() === '' || e.target.innerHTML === '<br>') {
                                 // ⭐ 2.3 บังคับให้ส่ง rIndex ไปเจาะจง
                                 e.preventDefault(); if (removeRow) removeRow(rIndex);
                              }
                            }
                          }}
                          ref={(el) => {
                            if (el && document.activeElement !== el && el.innerHTML !== textValue) {
                              el.innerHTML = textValue;
                            }
                          }}
                          className="w-full outline-none text-slate-800 cursor-text bg-transparent min-h-[24px]"
                          style={{ fontSize: `${layoutConfig.textFontSize || 16}px`, fontFamily: textFontFamily, lineHeight: layoutConfig.textLineHeight || 1.5 }}
                        />
                      </div>
                    );
                  }

                  const isDoubleRight = rType === 'double-right';
                  const isDoubleLeft = rType === 'double-left';
                  const isDouble = isDoubleRight || isDoubleLeft;
                  const isAnnotation = rType === 'annotation';
                  
                  // ⭐ เช็กว่าบรรทัดถัดไปเป็นคำอธิบายหรือหน้าทับหรือไม่ เพื่อลดระยะห่างให้ติดกัน
                  const nextRType = rIndex + 1 < rowTypes.length ? rowTypes[rIndex + 1] : null;
                  // ⭐ Bug fix 2: nathap row ลด padding ให้ชิดกับบรรทัดแม่
                  const isNathapRow = rType === 'nathap';
                  const pb = (isDoubleRight || isNathapRow || nextRType === 'annotation' || nextRType === 'nathap') ? 0 : layoutConfig.rowGap;

                  let visualRowNumber = displayRowNumbers[rIndex];
                  if (isDoubleLeft && rIndex > 0) visualRowNumber = displayRowNumbers[rIndex - 1]; 
                  const visualIndex = visualRowNumber !== '' && visualRowNumber != null ? visualRowNumber - 1 : null;                  
                  
                  // ⭐ 1. เพิ่มการเช็กว่าบรรทัดนี้มีป้ายกำกับอยู่หรือไม่
                  const currentLabels = visualIndex !== null ? sectionLabels[visualIndex] : null;
                  const hasLabels = currentLabels && currentLabels.length > 0;

                  // ⭐ สร้างแพ็กเกจสำหรับวาดช่องโน้ต (รองรับการหั่นบรรทัดเมื่อล้น 8 ห้อง และบรรทัดคำอธิบาย)
                  const renderMeasureBlock = (measure, actualMIndex, localMIdx, actualRIndex, actualRType, chunkLength) => {
                      if (!measure || measure[0] === '@HIDDEN') return null;

                      const isDoubleCurrent = actualRType.startsWith('double');
                      const isDoubleRightCurrent = actualRType === 'double-right';
                      const isDoubleLeftCurrent = actualRType === 'double-left';
                      const isAnnotationCurrent = actualRType === 'annotation';

                      const isNathapCurrent = actualRType === 'nathap';
                      // ⭐ เช็กว่าบรรทัดหน้าทับนี้ถูกสร้างให้มีความยาว 9 ห้อง (มีช่องซ้ายสุด) หรือไม่ ถ้ามี 8 ห้องห้ามแสดงป้ายกำกับ
                      const nathapHasLabel = isNathapCurrent && chunkLength === 9;
                      const isLabelMeasure = (isDoubleCurrent && localMIdx === 0) || (nathapHasLabel && localMIdx === 0);
                      
                      const isTextMeasure = typeof measure[0] === 'string' && measure[0].startsWith('@TEXT_SPAN_');
                      const spanCount = isTextMeasure ? parseInt(measure[0].split('_')[2], 10) || 1 : 1;

                      const colsPerLine = (isDoubleCurrent || nathapHasLabel) ? MAIN_STAFF_MEASURE_COUNT + 1 : MAIN_STAFF_MEASURE_COUNT;
                      const isFirstInLine = localMIdx % colsPerLine === ((isDoubleCurrent || nathapHasLabel) ? 1 : 0);
                      const isLastInLine = (localMIdx + spanCount - 1) % colsPerLine === colsPerLine - 1 || localMIdx === chunkLength - 1;

                      return (
                        <div 
                          key={actualMIndex} 
                          className="grid bg-white relative h-full w-full overflow-hidden" 
                          style={{ 
                            gridColumn: `span ${spanCount}`, 
                            gridTemplateColumns: isLabelMeasure ? '1fr' : (isTextMeasure || isAnnotationCurrent ? '1fr' : `repeat(${measure.length}, minmax(0, 1fr))`),
                            height: (isAnnotationCurrent || isNathapCurrent) ? `${layoutConfig.measureHeight * 0.75}px` : `${layoutConfig.measureHeight}px`,
                            // ⭐ ดึงขอบบนออกและปรับสีพื้นหลังให้กลมกลืน (ใช้ร่วมกันทั้งคำอธิบายและหน้าทับ)
                            borderTop: (isAnnotationCurrent || isNathapCurrent) ? 'none' : `${layoutConfig.outerBorderWidth ?? 1}px solid ${layoutConfig.borderColor || '#0f172a'}`,
                            borderBottom: isDoubleRightCurrent ? 'none' : `${layoutConfig.outerBorderWidth ?? 1}px solid ${layoutConfig.borderColor || '#0f172a'}`,
                            borderRight: `${layoutConfig.outerBorderWidth ?? 1}px solid ${layoutConfig.borderColor || '#0f172a'}`,
                            borderLeft: isFirstInLine || isLabelMeasure ? `${layoutConfig.outerBorderWidth ?? 1}px solid ${layoutConfig.borderColor || '#0f172a'}` : 'none',
                            borderTopLeftRadius: (isFirstInLine && !isDoubleLeftCurrent && !isAnnotationCurrent && !isNathapCurrent) ? `${layoutConfig.borderRadius}px` : 0,
                            borderBottomLeftRadius: (isFirstInLine && !isDoubleRightCurrent) ? `${layoutConfig.borderRadius}px` : 0,
                            borderTopRightRadius: (isLastInLine && !isDoubleLeftCurrent && !isAnnotationCurrent && !isNathapCurrent) ? `${layoutConfig.borderRadius}px` : 0,
                            borderBottomRightRadius: (isLastInLine && !isDoubleRightCurrent) ? `${layoutConfig.borderRadius}px` : 0,
                            backgroundColor: isLabelMeasure ? '#f8fafc' : ((isAnnotationCurrent || isNathapCurrent) ? '#f8fafc' : 'white'),
                          }}
                        >
                          {isLabelMeasure ? (
                            isNathapCurrent ? (
                              <div className="w-full h-full px-2 py-1 bg-white hover:bg-slate-50 transition-colors">
                                <div
                                  id={`annotation-${actualRIndex}-${actualMIndex}`}
                                  contentEditable
                                  suppressContentEditableWarning
                                  className="w-full h-full outline-none cursor-text overflow-hidden break-words text-slate-600 text-center font-bold"
                                  style={{ fontFamily: textFontFamily, fontSize: `${Math.max((layoutConfig.textFontSize || 16) * 0.85, 13)}px` }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (selectedCell[0] !== actualRIndex || selectedCell[1] !== actualMIndex) {
                                      setSelectedCell([actualRIndex, actualMIndex, 0]);
                                    }
                                  }}
                                  onMouseUp={(e) => { e.stopPropagation(); if (setToolbarMode) setToolbarMode('text'); }}
                                  onBlur={(e) => {
                                    const isToolbar = e.relatedTarget && e.relatedTarget.closest('.playback-controls-container');
                                    if (isToolbar) return;
                                    updateMeasureText(actualRIndex, actualMIndex, e.target.innerHTML);
                                  }}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') e.preventDefault();
                                  }}
                                  ref={(el) => {
                                    const textValue = Array.isArray(measure) ? (measure[0] || '') : (measure || '');
                                    if (el && document.activeElement !== el && el.innerHTML !== textValue) {
                                      el.innerHTML = textValue;
                                    }
                                  }}
                                  placeholder="พิมพ์ข้อความ..."
                                />
                              </div>
                            ) : (
                              <div className="flex items-center justify-center w-full h-full text-[13px] font-bold text-slate-700 tracking-wide select-none" style={{ fontFamily: noteFontFamily }}>
                                {measure[0]}
                              </div>
                            )
                          ) : isTextMeasure ? (
                            <div className={`w-full h-full p-1 transition-colors ${isAnnotationCurrent ? 'bg-white hover:bg-slate-50' : 'bg-amber-50/30 hover:bg-amber-100/30'}`}>
                              <div
                                id={`annotation-${actualRIndex}-${actualMIndex}`}
                                contentEditable
                                suppressContentEditableWarning
                                // ⭐ ปลดล็อกสมบูรณ์แบบ: ใช้ block คู่กับ text-center เพื่อให้ Toolbar สามารถส่งคำสั่ง align-left/right มาทับได้ 100%
                                className={`w-full h-full outline-none cursor-text overflow-hidden break-words px-1 pt-0.5 block text-center ${isAnnotationCurrent ? 'text-slate-500' : 'text-slate-800'}`}
                                style={{ fontFamily: textFontFamily, fontSize: isAnnotationCurrent ? `${(layoutConfig.textFontSize || 16) * 0.85}px` : `${layoutConfig.textFontSize || 16}px` }}
                                onMouseDown={(e) => { 
                                  e.stopPropagation(); 
                                  if (selectedCell[0] !== actualRIndex || selectedCell[1] !== actualMIndex) {
                                      setSelectedCell([actualRIndex, actualMIndex, 0]); 
                                  }
                                }}
                                onMouseUp={(e) => { e.stopPropagation(); if (setToolbarMode) setToolbarMode('text'); }}
                                onInput={(e) => {
                                  if (sheetData[actualRIndex] && sheetData[actualRIndex][actualMIndex]) {
                                      sheetData[actualRIndex][actualMIndex][1] = e.target.innerHTML;
                                  }
                                  setPaginateTrigger(prev => prev + 1);
                                }}
                                onBlur={(e) => {
                                  const isToolbar = e.relatedTarget && e.relatedTarget.closest('.playback-controls-container');
                                  if (isToolbar) return; 
                                  updateMeasureText(actualRIndex, actualMIndex, e.target.innerHTML);
                                }}
                                onKeyDown={(e) => {
                                    e.stopPropagation(); 
                                    if (e.key === 'Enter') e.preventDefault(); 
                                    if (e.key === 'Delete') {
                                        // ⭐ ดักไว้: ห้ามลบทิ้งทั้งบรรทัด ถ้ามันคือช่องผสานในบรรทัดโน้ตปกติ! (อนุญาตให้ลบได้เฉพาะบรรทัด annotation)
                                        if (isAnnotationCurrent) {
                                            e.preventDefault(); 
                                            if (removeRow) removeRow(actualRIndex); 
                                        }
                                    }
                                }}
                                ref={(el) => {
                                  const textValue = measure[1] || '';
                                  if (el && document.activeElement !== el && el.innerHTML !== textValue) {
                                    el.innerHTML = textValue;
                                  }
                                }}
                                placeholder={isAnnotationCurrent ? "พิมพ์คำอธิบาย..." : ""}
                              />
                            </div>
                          ) : isAnnotationCurrent ? (
                            // ⭐ โหมดใหม่: บรรทัดคำอธิบายพิมพ์อิสระต่อ 1 ห้อง
                            <div className="w-full h-full p-1 hover:bg-slate-100/50 transition-colors">
                              <div
                                id={`annotation-${actualRIndex}-${actualMIndex}`} // ⭐ ใส่ ID ให้ระบบโฟกัสถูกช่อง
                                contentEditable
                                suppressContentEditableWarning
                                // ⭐ ปลดล็อก: ถอดคำสั่ง text-center, flex, justify-center ออก เพื่อให้อิสระในการจัดหน้าซ้าย-ขวา-กลาง
                                className="w-full h-full outline-none cursor-text overflow-hidden break-words text-slate-600 px-1 pt-0.5"
                                style={{ fontFamily: textFontFamily, fontSize: `${(layoutConfig.textFontSize || 16) * 0.9}px` }}
                                onMouseDown={(e) => { 
                                  e.stopPropagation(); 
                                  // ⭐ ต้องให้มันจำว่าเรากำลังเลือกช่องนี้ตั้งแต่ตอนเมาส์กดลงไป เพื่อให้ Toolbar อ่านค่าได้ทันที
                                  if (selectedCell[0] !== actualRIndex || selectedCell[1] !== actualMIndex) {
                                      setSelectedCell([actualRIndex, actualMIndex, 0]); 
                                  }
                                }}
                                onMouseUp={(e) => { 
                                  e.stopPropagation(); 
                                  if (setToolbarMode) setToolbarMode('text'); // บังคับเปิดแถบเครื่องมือ
                                }}
                                onBlur={(e) => {
                                  const isToolbar = e.relatedTarget && e.relatedTarget.closest('.playback-controls-container');
                                  if (isToolbar) return;
                                  updateMeasureText(actualRIndex, actualMIndex, e.target.innerHTML);
                                }}
                                onKeyDown={(e) => {
                                    e.stopPropagation(); 
                                    if (e.key === 'Enter') e.preventDefault(); 
                                }}
                                // ดึงข้อความออกมาแสดง
                                ref={(el) => {
                                  const textValue = measure[0] !== '-' ? measure[0] : '';
                                  if (el && document.activeElement !== el && el.innerHTML !== textValue) {
                                    el.innerHTML = textValue;
                                  }
                                }}
                                placeholder="คำอธิบาย..."
                              />
                            </div>
                          ) : (                         
                            // โหมดวาดโน้ตปกติ
                            measure.map((note, cIndex) => {
                              let isInRange = false;
                              let minR = -1, maxR = -1, minCol = -1, maxCol = -1;
                              if (selectionRange && selectionRange.start && selectionRange.end) {
                                minR = Math.min(selectionRange.start[0], selectionRange.end[0]); maxR = Math.max(selectionRange.start[0], selectionRange.end[0]);
                                const startColVal = getFlattenedCol(sheetData[selectionRange.start[0]] || [], rowTypes[selectionRange.start[0]], selectionRange.start[1], selectionRange.start[2]);
                                const endColVal = getFlattenedCol(sheetData[selectionRange.end[0]] || [], rowTypes[selectionRange.end[0]], selectionRange.end[1], selectionRange.end[2]);
                                minCol = Math.min(startColVal, endColVal); maxCol = Math.max(startColVal, endColVal);
                              }

                              if (selectionRange && actualRIndex >= minR && actualRIndex <= maxR) {
                                  const currentCol = getFlattenedCol(sheetData[actualRIndex], actualRType, actualMIndex, cIndex);
                                  if (currentCol >= minCol && currentCol <= maxCol) isInRange = true;
                              }

                              const isCursorExact = selectedCell[0] === actualRIndex && selectedCell[1] === actualMIndex && selectedCell[2] === cIndex;
                              let isPlayingNow = false;
                              if (playbackCursor) {
                                // 1. เช็กบรรทัดหลักที่กำลังเล่น
                                if (playbackCursor[0] === actualRIndex && playbackCursor[1] === actualMIndex && playbackCursor[2] === cIndex) {
                                  isPlayingNow = true;
                                }
                                // 2. เช็กมือซ้าย (กรณีเป็นบรรทัดคู่)
                                else if (rowTypes[playbackCursor[0]] === 'double-right' && actualRIndex === playbackCursor[0] + 1 && playbackCursor[1] === actualMIndex && playbackCursor[2] === cIndex) {
                                  isPlayingNow = true;
                                }
                                // 3. ⭐ เช็กบรรทัดหน้าทับ (กวาดสีเขียวลงมาคลุมให้ยาวเท่ากันพอดี)
                                // ⭐ Bug fix 2: ข้าม label cell (m=0) ของบรรทัดหน้าทับ
                                else if (isNathapCurrent && actualMIndex > 0 && playbackCursor[1] === actualMIndex) {
                                  // คำนวณสัดส่วนความยาวช่อง เผื่อกรณีบรรทัดหลักกับหน้าทับมีจำนวนช่องแบ่งย่อยไม่เท่ากัน
                                  const mainCellCount = sheetData[playbackCursor[0]][playbackCursor[1]].length;
                                  const nathapCellCount = measure.length;
                                  
                                  const mainRatioStart = playbackCursor[2] / mainCellCount;
                                  const mainRatioEnd = (playbackCursor[2] + 1) / mainCellCount;
                                  const nathapRatioStart = cIndex / nathapCellCount;
                                  const nathapRatioEnd = (cIndex + 1) / nathapCellCount;

                                  // ตรวจสอบว่าช่องความยาวมันตรงกันไหม (Overlap)
                                  const isOverlapping = Math.max(mainRatioStart, nathapRatioStart) < Math.min(mainRatioEnd, nathapRatioEnd);

                                  if (isOverlapping) {
                                    // ถอยกลับไปหาบรรทัดหลักที่เป็นเจ้าของหน้าทับนี้
                                    let findMainR = actualRIndex - 1;
                                    while (findMainR >= 0 && (rowTypes[findMainR] === 'nathap' || rowTypes[findMainR] === 'annotation')) {
                                      findMainR--;
                                    }
                                    if (findMainR >= 0 && rowTypes[findMainR] === 'double-left') findMainR--;
                                    
                                    // ถ้าบรรทัดแม่ตรงกับบรรทัดที่เล่นอยู่ ให้ระบายสีเขียว
                                    if (playbackCursor[0] === findMainR) {
                                      isPlayingNow = true;
                                    }
                                  }
                                }
                              }
                              
                              let cellBgClass = 'hover:bg-sky-50 print:bg-transparent';
                              if (isPlayingNow) cellBgClass = 'bg-emerald-200 ring-2 ring-inset ring-emerald-500 z-20 print:bg-transparent print:ring-0';
                              else if (isInRange) cellBgClass = 'bg-sky-200 print:bg-transparent';
                              else if (isCursorExact) cellBgClass = 'bg-yellow-100 ring-2 ring-inset ring-blue-400 z-10 print:bg-transparent print:ring-0';
                              if (isCursorExact && isInRange && !isPlayingNow) cellBgClass = 'bg-sky-300 ring-2 ring-inset ring-blue-500 z-10 print:bg-transparent print:ring-0';

                              const cellCustomStyle = layoutConfig.customStyles?.[`${actualRIndex}_${actualMIndex}_${cIndex}`] || {};
                              // ⭐ ลดขนาดฟอนต์ของหน้าทับลง 25% ให้ดูเป็นบรรทัดรอง
                              const baseFontSize = isNathapCurrent ? (layoutConfig.fontSize || 30) * 0.75 : (layoutConfig.fontSize || 30);
                              const cellFontSize = cellCustomStyle.fontSize || baseFontSize;
                              const isEditingToken = editingTokenCell?.r === actualRIndex && editingTokenCell?.m === actualMIndex && editingTokenCell?.c === cIndex;

                              return (
                                <div 
                                  id={`note-${actualRIndex}-${actualMIndex}-${cIndex}`}
                                  key={cIndex} 
                                  onMouseDown={(e) => {
                                    e.stopPropagation(); 
                                    if (setSelectedSymbolId) setSelectedSymbolId(null);
                                    if (!isEditingToken && e.button !== 2) startSelection(actualRIndex, actualMIndex, cIndex);
                                    if (setToolbarMode) setToolbarMode('default');
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseEnter={() => updateSelection(actualRIndex, actualMIndex, cIndex)}
                                  onContextMenu={(e) => handleRightClick(e, actualRIndex, actualMIndex, cIndex)}
                                  // ⭐ ปรับสีตัวหนังสือหน้าทับให้อ่อนลงเล็กน้อย (slate-600) ให้ดูแยกกับโน้ตหลักชัดเจน
                                  className={`flex items-center justify-center cursor-crosshair transition-colors duration-75 ease-linear min-h-0 overflow-hidden ${cellBgClass} ${isNathapCurrent ? 'text-slate-600' : ''}`}
                                  style={{ 
                                    fontSize: `${cellFontSize}px`, fontFamily: cellCustomStyle.noteFontFamily || noteFontFamily,
                                    containerType: 'inline-size',
                                    borderRight: (cIndex < measure.length - 1 && layoutConfig.innerBorderWidth > 0) ? `${layoutConfig.innerBorderWidth}px solid ${layoutConfig.borderColor}66` : 'none' 
                                  }}
                                  title={isReadOnly ? undefined : 'ดับเบิลคลิกเพื่อแก้ไขโน้ตแบบหลายตัวในช่องเดียว'}
                                >
                                  {isEditingToken ? (
                                    <input
                                      id={`token-editor-${actualRIndex}-${actualMIndex}-${cIndex}`}
                                      type="text"
                                      value={editingTokenValue}
                                      autoFocus
                                      spellCheck={false}
                                      maxLength={8}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => setEditingTokenValue(e.target.value.replace(/\s+/g, ''))}
                                      onBlur={() => commitTokenEdit()}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          commitTokenEdit(); 
                                          if (moveSelectionNext) moveSelectionNext(); 
                                        } else if (e.key === 'Escape') {
                                          e.preventDefault();
                                          cancelTokenEdit();
                                        }
                                      }}
                                      className="w-full h-full bg-white text-center outline-none px-1 text-slate-900"
                                      style={{ fontSize: `${Math.max(cellFontSize - 2, 18)}px`, fontFamily: cellCustomStyle.noteFontFamily || noteFontFamily }}
                                      placeholder="-"
                                    />
                                  ) : (
                                    renderSheetNote(note, actualRIndex, actualMIndex, cIndex)
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                  };
                  

                  // ⭐ 2. ดักทาง: ซ่อนกล่องมือซ้ายเดิม เพื่อเอาไปรวมวาดพร้อมกล่องมือขวา
                  if (isDoubleLeft) return null; 

                  let measuresContent;
                  let containerPb = pb;
                  let containerMarginBot = rMarginBot;

                  if (isDoubleRight) {
                      const leftRowIndex = rIndex + 1;
                      const leftRow = sheetData[leftRowIndex] || [];
                      
                      // คำนวณว่ามันล้นไปกี่บรรทัดแล้ว (แบ่งบรรทัดละ 8 ช่อง)
                      const maxMeasures = Math.max(row.length, leftRow.length) - 1; 
                      const totalChunks = Math.max(1, Math.ceil(maxMeasures / MAIN_STAFF_MEASURE_COUNT));

                      // ⭐ เช็กว่าบรรทัดถัดจากมือซ้าย เป็นคำอธิบายหรือหน้าทับหรือไม่ ถ้าใช่ให้ระยะห่างเป็น 0 เพื่อดูดชิดกัน
                      const nextAfterDouble = leftRowIndex + 1 < rowTypes.length ? rowTypes[leftRowIndex + 1] : null;
                      containerPb = (nextAfterDouble === 'annotation' || nextAfterDouble === 'nathap') ? 0 : layoutConfig.rowGap; 
                      
                      containerMarginBot = rowMargins[leftRowIndex]?.bottom || 0;

                      measuresContent = (
                          <div className="flex flex-col w-full">
                              {Array.from({ length: totalChunks }).map((_, chunkIdx) => {
                                  const startM = chunkIdx * MAIN_STAFF_MEASURE_COUNT + 1;
                                  const endM = startM + MAIN_STAFF_MEASURE_COUNT;
                                  
                                  // หั่นกล่องให้ความยาวเท่ากันทั้งสองมือ
                                  const rightChunk = [row[0], ...row.slice(startM, endM)];
                                  const leftChunk = [leftRow[0], ...leftRow.slice(startM, endM)];

                                  return (
                                      <div key={chunkIdx} className="flex flex-col w-full" style={{ marginBottom: chunkIdx < totalChunks - 1 ? layoutConfig.rowGap : 0 }}>
                                          {/* แถวขวา */}
                                          <div className="grid w-full" style={{ gridTemplateColumns: `${STAFF_LABEL_COLUMN_WIDTH} repeat(${MAIN_STAFF_MEASURE_COUNT}, minmax(0, 1fr))` }}>
                                              {rightChunk.map((measure, localMIdx) => {
                                                  const actualMIndex = localMIdx === 0 ? 0 : startM + localMIdx - 1;
                                                  return renderMeasureBlock(measure, actualMIndex, localMIdx, rIndex, 'double-right', rightChunk.length);
                                              })}
                                          </div>
                                          {/* แถวซ้าย (ประกบคู่กันเสมอ) */}
                                          <div className="grid w-full" style={{ gridTemplateColumns: `${STAFF_LABEL_COLUMN_WIDTH} repeat(${MAIN_STAFF_MEASURE_COUNT}, minmax(0, 1fr))` }}>
                                              {leftChunk.map((measure, localMIdx) => {
                                                  const actualMIndex = localMIdx === 0 ? 0 : startM + localMIdx - 1;
                                                  return renderMeasureBlock(measure, actualMIndex, localMIdx, leftRowIndex, 'double-left', leftChunk.length);
                                              })}
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      );
                  } else if (rType === 'nathap') {
                      // ⭐ ตรวจสอบว่าหน้าทับนี้เป็นแบบ 9 ห้อง (บรรทัดคู่) หรือ 8 ห้อง (บรรทัดเดี่ยว)
                      const isUnderDouble = row.length === 9;
                      
                      if (isUnderDouble) {
                          const totalChunks = Math.max(1, Math.ceil(Math.max(0, row.length - 1) / MAIN_STAFF_MEASURE_COUNT));
                          measuresContent = (
                              <div className="flex flex-col w-full">
                                  {Array.from({ length: totalChunks }).map((_, chunkIdx) => {
                                      const startM = chunkIdx * MAIN_STAFF_MEASURE_COUNT + 1;
                                      const endM = startM + MAIN_STAFF_MEASURE_COUNT;
                                      const chunk = [row[0], ...row.slice(startM, endM)];
                                      return (
                                          <div key={chunkIdx} className="grid w-full" style={{ gridTemplateColumns: `${STAFF_LABEL_COLUMN_WIDTH} repeat(${MAIN_STAFF_MEASURE_COUNT}, minmax(0, 1fr))`, marginBottom: chunkIdx < totalChunks - 1 ? layoutConfig.rowGap : 0 }}>
                                              {chunk.map((measure, localMIdx) => {
                                                  const actualMIndex = localMIdx === 0 ? 0 : startM + localMIdx - 1;
                                                  return renderMeasureBlock(measure, actualMIndex, localMIdx, rIndex, 'nathap', chunk.length);
                                              })}
                                          </div>
                                      );
                                  })}
                              </div>
                          );
                      } else {
                          // ⭐ สร้างหน้าทับสำหรับบรรทัดเดี่ยว (ไม่มีช่องว่างด้านหน้า)
                          const totalChunks = Math.max(1, Math.ceil(row.length / MAIN_STAFF_MEASURE_COUNT));
                          measuresContent = (
                              <div className="flex flex-col w-full">
                                  {Array.from({ length: totalChunks }).map((_, chunkIdx) => {
                                      const startM = chunkIdx * MAIN_STAFF_MEASURE_COUNT;
                                      const endM = startM + MAIN_STAFF_MEASURE_COUNT;
                                      const chunk = row.slice(startM, endM);
                                      return (
                                          <div key={chunkIdx} className="grid w-full" style={{ gridTemplateColumns: `repeat(${MAIN_STAFF_MEASURE_COUNT}, minmax(0, 1fr))`, marginBottom: chunkIdx < totalChunks - 1 ? layoutConfig.rowGap : 0 }}>
                                              {chunk.map((measure, localMIdx) => {
                                                  const actualMIndex = startM + localMIdx;
                                                  return renderMeasureBlock(measure, actualMIndex, localMIdx, rIndex, 'nathap', chunk.length);
                                              })}
                                          </div>
                                      );
                                  })}
                              </div>
                          );
                      }
                  } else {
                      measuresContent = (
                          <div className="grid w-full" style={{ rowGap: `${layoutConfig.rowGap}px`, gridTemplateColumns: `repeat(${MAIN_STAFF_MEASURE_COUNT}, minmax(0, 1fr))` }}>
                              {row.map((measure, mIndex) => renderMeasureBlock(measure, mIndex, mIndex, rIndex, 'single', row.length))}
                          </div>
                      );
                  }

                  return (
                    <div 
                      key={`note-${rIndex}-${rType}`} 
                      className="flex flex-col w-full relative transition-colors"
                      style={{ 
                        paddingBottom: `${containerPb}px`, marginTop: `${rMarginTop}px`, marginBottom: `${containerMarginBot}px`,
                        paddingLeft: `calc(1rem + ${rIndent}px)`, paddingRight: '1rem',
                        // ⭐ 2. ปรับ zIndex ให้บรรทัดที่มีป้ายกำกับลอยอยู่เหนือบรรทัดอื่น ป้องกันโดนพื้นหลังบรรทัดล่างบัง
                        zIndex: (rMarginTop < 0 || rMarginBot < 0) ? 20 : (hasLabels ? 30 : 1) 
                      }}
                    >     
                      <div className="relative w-full">
                        
                        {(displayRowNumbers[rIndex] !== '' && layoutConfig?.showRowNumber !== false) && (
                          <div 
                            className={`absolute -left-8 -translate-y-1/2 text-[12px] font-bold print-hidden select-none ${isDoubleRight ? 'top-[24px]' : 'top-1/2'}`} 
                            style={{ fontFamily: textFontFamily, color: layoutConfig?.rowNumberColor || '#cbd5e1' }}
                          >
                            {displayRowNumbers[rIndex]}
                          </div>
                        )}

                        {(isDoubleRight && layoutConfig?.showRowNumber !== false) && (
                          <div 
                            className="absolute border-l border-t border-b print:border-slate-400"
                            style={{
                              top: 0, left: '-10px', width: '6px', height: '100%',
                              borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', zIndex: 10,
                              borderColor: layoutConfig?.rowNumberColor || '#cbd5e1',
                              borderWidth: `${layoutConfig?.rowNumberWidth ?? 3}px 0 ${layoutConfig?.rowNumberWidth ?? 3}px ${layoutConfig?.rowNumberWidth ?? 3}px`
                            }}
                          />
                        )}

                        {visualIndex !== null && renderSectionLabels(visualIndex, rType, rIndex)}

                        {measuresContent}

                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="absolute bottom-[20px] left-0 right-0 border-t border-slate-200 text-center text-slate-400 text-[12px] print:text-slate-500 z-20 bg-transparent pt-2 mx-12" style={{ fontFamily: textFontFamily }}>
                <p>Thai Music Editor - หน้า {pIndex + 1} / {pages.length}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default Sheet;
