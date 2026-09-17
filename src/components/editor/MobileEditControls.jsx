import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  Drum,
  AudioLines,
  FileDown,
  FilePlus2,
  FileText,
  FolderOpen,
  Keyboard,
  Maximize2,
  Minus,
  MousePointer2,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  Redo2,
  ListMusic,
  Rows3,
  Save,
  Scissors,
  Settings,
  SlidersHorizontal,
  Table2,
  Tag,
  Trash2,
  Undo2,
  Upload,
  Volume2,
  Waves,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { MusicContext } from '../../contexts/MusicContext';
import { useFeatureAccess } from '../../contexts/FeatureAccessContext';
import { INSTRUMENT_CONFIG } from '../../utils/instrumentConfig';
import { getFlattenedCol, hasNathapLeadingLabel } from '../../utils/sheetUtils';
import { escapeMobileLabel, getMobileTextTarget, resolveMobileTextRowHtml } from '../../utils/mobileEditorContent';
import {
  CUSTOM_CELL_MAX_LENGTH,
  CUSTOM_KEYBOARD_FEATURE_ID,
  CUSTOM_KEYBOARD_MAX_KEYS,
  CUSTOM_KEYBOARD_MAX_LABEL_LENGTH,
  decodeCustomCellToken,
  encodeCustomCellToken,
  normalizeCustomKeyboardKeys,
  normalizeCustomText,
} from '../../utils/customKeyboard';

const FONT_OPTIONS = [
  { value: "'TH Sarabun New', sans-serif", label: 'TH Sarabun New' },
  { value: "'Sarabun', sans-serif", label: 'Sarabun' },
  { value: "'Noto Sans Thai', sans-serif", label: 'Noto Sans Thai' },
  { value: "'Prompt', sans-serif", label: 'Prompt' },
  { value: "'Kanit', sans-serif", label: 'Kanit' },
  { value: "'Mitr', sans-serif", label: 'Mitr' },
  { value: "'Mali', cursive", label: 'Mali' },
];

const NOTE_STYLE_KEYS = ['fontSize', 'noteFontFamily', 'isBold', 'isItalic', 'color'];

const getPlainText = (value = '') => {
  const temp = document.createElement('div');
  temp.innerHTML = String(value ?? '');
  temp.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith('\n'));
  return temp.textContent || temp.innerText || '';
};

const formatNote = (key) => {
  const octaveMatch = key.eng?.match(/\d+/);
  if (!octaveMatch) return key.thai;
  const octave = Number(octaveMatch[0]);
  if (octave >= 5) return `${key.thai}\u0E4D`;
  if (octave === 2) return `${key.thai}\u0E3A\u200B`;
  if (octave === 3) return `${key.thai}\u0E3A`;
  return key.thai;
};

const SmallAction = ({ icon: Icon, label, onClick, disabled = false, active = false, danger = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex min-h-14 min-w-[66px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-3 text-[10px] font-black transition active:scale-95 ${
      disabled
        ? 'border-slate-200 bg-slate-100 text-slate-300'
        : danger
          ? 'border-rose-200 bg-rose-50 text-rose-600'
          : active
            ? 'border-sky-500 bg-sky-500 text-white'
            : 'border-slate-200 bg-white text-slate-600'
    }`}
  >
    {React.createElement(Icon, { size: 19, strokeWidth: 2.4 })}
    <span>{label}</span>
  </button>
);

const FileAction = ({ icon: Icon, label, accept, onFile }) => (
  <label className="flex min-h-14 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-center text-[10px] font-black text-slate-600 transition active:scale-95">
    {React.createElement(Icon, { size: 19, strokeWidth: 2.4 })}
    <span>{label}</span>
    <input type="file" accept={accept} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ''; }} />
  </label>
);

const MobileEditControls = ({ onOpenMetronome, onOpenSettings, onOpenMusicXml, onPrint }) => {
  const { canAccess } = useFeatureAccess();
  const {
    currentInstrument,
    changeInstrument,
    selectedCell,
    selectionRange,
    setSelectionRange,
    sheetData,
    rowTypes,
    inputNote,
    inputCustomText,
    appendCustomTextToCurrentCell,
    updateCellToken,
    updateTextRow,
    updateMeasureText,
    moveSelectionPrev,
    moveSelectionNext,
    undo,
    redo,
    canUndo,
    canRedo,
    saveProject,
    newProject,
    loadProject,
    importThaiMusicXml,
    exportThaiMusicXml,
    stopPlayback,
    isPlaying,
    togglePlay,
    isReadOnly,
    copySelection,
    cutSelection,
    pasteSelection,
    addNoteColumn,
    removeNoteColumn,
    addMeasure,
    removeMeasure,
    addRow,
    addDoubleRow,
    removeRow,
    addPageBreak,
    addTextRow,
    convertMeasureToText,
    addAnnotationRow,
    expandSelectedMeasures,
    addSymbol,
    symbols,
    selectedSymbolId,
    setSelectedSymbolId,
    removeSymbol,
    layoutConfig,
    setLayoutConfig,
    intervalMode,
    setIntervalMode,
    isReduceMode,
    setIsReduceMode,
    shiftNoteObject,
    userRole,
    autoSaveStatus,
  } = useContext(MusicContext);
  const [isExpanded, setIsExpanded] = useState(true);
  const [keyboardMode, setKeyboardMode] = useState('notes');
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const [appendCustomText, setAppendCustomText] = useState(false);
  const [rangeAnchor, setRangeAnchor] = useState(null);
  const [isCellEditorOpen, setIsCellEditorOpen] = useState(false);
  const [cellDraft, setCellDraft] = useState('');
  const [cellDraftMode, setCellDraftMode] = useState('notes');
  const [cellOriginalHtml, setCellOriginalHtml] = useState('');
  const [notice, setNotice] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const noticeTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(noticeTimerRef.current), []);

  const hasCell = Array.isArray(selectedCell);
  const selectedInstrumentId = hasCell
    ? layoutConfig?.customStyles?.[`${selectedCell[0]}_${selectedCell[1]}_${selectedCell[2]}`]?.instrumentId
    : null;
  const displayInstrument = INSTRUMENT_CONFIG[selectedInstrumentId] || currentInstrument;
  const keys = displayInstrument?.keys || [];
  const canUseCustomKeyboard = canAccess(CUSTOM_KEYBOARD_FEATURE_ID, userRole);
  const activeKeyboardMode = canUseCustomKeyboard ? keyboardMode : 'notes';
  const customKeys = normalizeCustomKeyboardKeys(layoutConfig?.customKeyboardKeys);
  const canExpand = Boolean(selectionRange?.start && selectionRange?.end && !selectionRange?.labelOnly);
  const canCreateSymbol = Boolean(
    selectionRange?.start
    && selectionRange?.end
    && !selectionRange?.labelOnly
    && selectionRange.start.some((value, index) => value !== selectionRange.end[index]),
  );
  const selectedSymbol = symbols?.find((symbol) => symbol.id === selectedSymbolId);
  const selectedLabel = hasCell
    ? `บรรทัด ${selectedCell[0] + 1} · ห้อง ${selectedCell[1] + 1} · ช่อง ${selectedCell[2] + 1}`
    : 'แตะช่องโน้ตบนกระดาษก่อน';
  const selectedRow = hasCell ? sheetData?.[selectedCell[0]] : null;
  const selectedRowType = hasCell ? rowTypes?.[selectedCell[0]] : null;
  const selectedMeasure = hasCell ? selectedRow?.[selectedCell[1]] : null;
  const selectedTextTarget = hasCell ? getMobileTextTarget({ rowType: selectedRowType, row: selectedRow, measureIndex: selectedCell[1] }) : null;
  const isSelectedTextRow = selectedTextTarget?.kind === 'row';
  const isSelectedTextMeasure = selectedTextTarget?.kind === 'measure';
  const isSelectedAnnotation = selectedTextTarget?.kind === 'annotation';
  const isSelectedDoubleRowLabel = hasCell && selectedCell[1] === 0 && String(selectedRowType || '').startsWith('double');
  const isSelectedNathapLabel = hasCell && selectedCell[1] === 0 && hasNathapLeadingLabel(selectedRow, selectedRowType);
  const isSelectedLeadingLabel = isSelectedDoubleRowLabel || isSelectedNathapLabel;
  const isSelectedRowLabel = isSelectedLeadingLabel && Array.isArray(selectedMeasure);
  const canEditSelectedToken = hasCell
    && Array.isArray(selectedMeasure)
    && selectedMeasure[selectedCell[2]] !== undefined
    && selectedRowType !== 'text'
    && selectedRowType !== 'annotation'
    && selectedRowType !== 'page-break'
    && !isSelectedTextMeasure
    && !isSelectedLeadingLabel;
  const canOpenContentEditor = canEditSelectedToken || isSelectedTextRow || isSelectedTextMeasure || isSelectedAnnotation || isSelectedRowLabel;
  const autoSaveLabel = {
    saving: 'กำลังบันทึกขึ้น Cloud…',
    saved: 'บันทึกขึ้น Cloud แล้ว',
    retrying: 'รอบันทึกขึ้น Cloud ใหม่',
    error: 'ยังบันทึกขึ้น Cloud ไม่สำเร็จ',
    offline: 'ออฟไลน์ · เก็บสำเนาไว้ในเครื่อง',
  }[autoSaveStatus];

  const showNotice = (message, tone = 'success') => {
    window.clearTimeout(noticeTimerRef.current);
    setNotice({ message, tone });
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 1800);
  };

  const runWithNotice = (callback, message) => {
    callback?.();
    showNotice(message);
  };

  const requestDestructiveAction = ({ title, description, action, successMessage }) => {
    if (isReadOnly) return;
    setConfirmAction({ title, description, action, successMessage });
  };

  const runConfirmedAction = () => {
    const pending = confirmAction;
    setConfirmAction(null);
    if (!pending) return;
    pending.action?.();
    if (pending.successMessage) showNotice(pending.successMessage);
  };

  const updateCustomKeys = (nextKeys) => {
    if (!canUseCustomKeyboard || isReadOnly) return;
    setLayoutConfig((current) => ({ ...current, customKeyboardKeys: normalizeCustomKeyboardKeys(nextKeys) }));
  };

  const addCustomKey = (event) => {
    event.preventDefault();
    const label = normalizeCustomText(customDraft, CUSTOM_KEYBOARD_MAX_LABEL_LENGTH);
    if (!label || customKeys.length >= CUSTOM_KEYBOARD_MAX_KEYS) return;
    let sequence = customKeys.length + 1;
    while (customKeys.some((key) => key.id === `custom-${sequence}`)) sequence += 1;
    updateCustomKeys([...customKeys, { id: `custom-${sequence}`, label }]);
    setCustomDraft('');
  };

  const insertInstrumentNote = (key) => {
    const adjustedKey = isReduceMode && shiftNoteObject ? shiftNoteObject(key, 1) : key;
    inputNote?.(formatNote(adjustedKey));
  };

  const openPanel = (callback) => {
    setIsToolsOpen(false);
    callback?.();
  };

  const openEditorPanel = (panel) => {
    setIsToolsOpen(false);
    window.dispatchEvent(new CustomEvent('tme-open-editor-panel', { detail: { panel } }));
  };

  const getStyleTargetKeys = () => {
    const hasRange = selectionRange?.start && selectionRange?.end && (
      selectionRange.labelOnly
      || selectionRange.start.some((value, index) => value !== selectionRange.end[index])
    );

    if (!hasRange) {
      return hasCell ? [`${selectedCell[0]}_${selectedCell[1]}_${selectedCell[2]}`] : [];
    }

    const minRow = Math.min(selectionRange.start[0], selectionRange.end[0]);
    const maxRow = Math.max(selectionRange.start[0], selectionRange.end[0]);
    if (selectionRange.labelOnly) {
      const labelKeys = [];
      for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
        if (String(rowTypes?.[rowIndex] || '').startsWith('double')) labelKeys.push(`${rowIndex}_0_0`);
      }
      return labelKeys;
    }

    const startCol = getFlattenedCol(
      sheetData?.[selectionRange.start[0]],
      rowTypes?.[selectionRange.start[0]],
      selectionRange.start[1],
      selectionRange.start[2],
    );
    const endCol = getFlattenedCol(
      sheetData?.[selectionRange.end[0]],
      rowTypes?.[selectionRange.end[0]],
      selectionRange.end[1],
      selectionRange.end[2],
    );
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const keysToUpdate = [];

    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      const row = sheetData?.[rowIndex];
      const rowType = rowTypes?.[rowIndex];
      if (!Array.isArray(row) || rowType === 'text' || rowType === 'page-break') continue;
      for (let measureIndex = 0; measureIndex < row.length; measureIndex += 1) {
        const isRowLabel = String(rowType || '').startsWith('double') && measureIndex === 0;
        if (isRowLabel) {
          if (selectionRange.includeRowLabels) keysToUpdate.push(`${rowIndex}_0_0`);
          continue;
        }
        const measure = row[measureIndex];
        if (!Array.isArray(measure)) continue;
        for (let cellIndex = 0; cellIndex < measure.length; cellIndex += 1) {
          const flattenedCol = getFlattenedCol(row, rowType, measureIndex, cellIndex);
          if (flattenedCol >= minCol && flattenedCol <= maxCol) {
            keysToUpdate.push(`${rowIndex}_${measureIndex}_${cellIndex}`);
          }
        }
      }
    }
    return keysToUpdate;
  };

  const styleTargetKeys = getStyleTargetKeys();
  const firstTargetStyle = layoutConfig?.customStyles?.[styleTargetKeys[0]] || {};
  const isLabelSelection = Boolean(selectionRange?.labelOnly);
  const selectedFontFamily = firstTargetStyle.noteFontFamily
    || (isLabelSelection ? layoutConfig?.rowLabelFontFamily : null)
    || layoutConfig?.noteFontFamily
    || layoutConfig?.fontFamily
    || "'Sarabun', sans-serif";
  const selectedFontSize = Number(
    firstTargetStyle.fontSize
    ?? (isLabelSelection ? layoutConfig?.rowLabelFontSize : null)
    ?? layoutConfig?.fontSize
    ?? 16,
  );
  const allTargetsUse = (styleKey) => styleTargetKeys.length > 0 && styleTargetKeys.every((key) => {
    const customValue = layoutConfig?.customStyles?.[key]?.[styleKey];
    return customValue !== undefined ? Boolean(customValue) : Boolean(layoutConfig?.[styleKey]);
  });

  const applySelectedStyle = (styleKey, value) => {
    if (styleTargetKeys.length === 0 || isReadOnly) return;
    setLayoutConfig((current) => {
      const customStyles = { ...(current.customStyles || {}) };
      styleTargetKeys.forEach((key) => {
        const currentStyle = customStyles[key] || {};
        const fallbackValue = styleKey === 'fontSize'
          ? (isLabelSelection ? current.rowLabelFontSize : current.fontSize) ?? 16
          : current[styleKey];
        const nextValue = typeof value === 'function' ? value(currentStyle[styleKey] ?? fallbackValue) : value;
        customStyles[key] = { ...currentStyle, [styleKey]: nextValue };
      });
      return { ...current, customStyles };
    });
  };

  const clearSelectedStyles = () => {
    if (styleTargetKeys.length === 0 || isReadOnly) return;
    setLayoutConfig((current) => {
      const customStyles = { ...(current.customStyles || {}) };
      styleTargetKeys.forEach((key) => {
        if (!customStyles[key]) return;
        const cleanedStyle = Object.fromEntries(
          Object.entries(customStyles[key]).filter(([styleKey]) => !NOTE_STYLE_KEYS.includes(styleKey)),
        );
        if (Object.keys(cleanedStyle).length > 0) customStyles[key] = cleanedStyle;
        else delete customStyles[key];
      });
      return { ...current, customStyles };
    });
  };

  const toggleRangeSelection = () => {
    if (!hasCell || isReadOnly) return;
    if (!rangeAnchor) {
      setRangeAnchor([...selectedCell]);
      return;
    }
    setSelectionRange?.({ start: rangeAnchor, end: [...selectedCell], includeRowLabels: false });
    setRangeAnchor(null);
  };

  const selectCurrentMeasure = () => {
    if (!hasCell || isReadOnly) return;
    const [rowIndex, measureIndex] = selectedCell;
    const row = sheetData?.[rowIndex];
    const rowType = rowTypes?.[rowIndex];
    const isLeadingLabel = measureIndex === 0 && (
      String(rowType || '').startsWith('double') || hasNathapLeadingLabel(row, rowType)
    );
    const measure = row?.[measureIndex];
    if (isLeadingLabel || !Array.isArray(measure) || measure.length === 0) return;
    setSelectionRange?.({
      start: [rowIndex, measureIndex, 0],
      end: [rowIndex, measureIndex, measure.length - 1],
      includeRowLabels: false,
    });
    setRangeAnchor(null);
  };

  const selectCurrentRow = () => {
    if (!hasCell || isReadOnly) return;
    const rowIndex = selectedCell[0];
    const row = sheetData?.[rowIndex];
    const rowType = rowTypes?.[rowIndex];
    if (!Array.isArray(row) || rowType === 'text' || rowType === 'page-break') return;
    const firstMeasureIndex = (
      String(rowType || '').startsWith('double') || hasNathapLeadingLabel(row, rowType)
    ) ? 1 : 0;
    const selectableMeasures = row
      .map((measure, measureIndex) => ({ measure, measureIndex }))
      .filter(({ measure, measureIndex }) => {
        if (measureIndex < firstMeasureIndex || !Array.isArray(measure) || measure.length === 0) return false;
        const marker = measure[0];
        return marker !== '@HIDDEN' && !(typeof marker === 'string' && marker.startsWith('@TEXT_SPAN_'));
      });
    if (selectableMeasures.length === 0) return;
    const first = selectableMeasures[0];
    const last = selectableMeasures[selectableMeasures.length - 1];
    setSelectionRange?.({
      start: [rowIndex, first.measureIndex, 0],
      end: [rowIndex, last.measureIndex, last.measure.length - 1],
      includeRowLabels: false,
    });
    setRangeAnchor(null);
  };

  const openCellEditor = () => {
    if (!canOpenContentEditor || isReadOnly) return;
    if (isSelectedTextRow) {
      const originalHtml = selectedTextTarget.html;
      setCellOriginalHtml(originalHtml);
      setCellDraft(getPlainText(originalHtml));
      setCellDraftMode('text');
      setIsCellEditorOpen(true);
      return;
    }
    if (isSelectedTextMeasure || isSelectedAnnotation) {
      const originalHtml = selectedTextTarget.html;
      setCellOriginalHtml(originalHtml);
      setCellDraft(getPlainText(originalHtml));
      setCellDraftMode('measure-text');
      setIsCellEditorOpen(true);
      return;
    }
    if (isSelectedRowLabel) {
      const originalHtml = String(selectedMeasure?.[0] ?? '');
      setCellOriginalHtml(originalHtml);
      setCellDraft(getPlainText(originalHtml));
      setCellDraftMode('row-label');
      setIsCellEditorOpen(true);
      return;
    }
    const rawToken = selectedMeasure[selectedCell[2]];
    const customText = decodeCustomCellToken(rawToken);
    setCellOriginalHtml('');
    setCellDraft(customText ?? (rawToken === '-' ? '' : String(rawToken ?? '')));
    setCellDraftMode(customText !== null && canUseCustomKeyboard ? 'custom' : 'notes');
    setIsCellEditorOpen(true);
  };

  const saveCellDraft = (event) => {
    event.preventDefault();
    if (!canOpenContentEditor || isReadOnly) return;
    if (cellDraftMode === 'text' && isSelectedTextRow) {
      const nextValue = resolveMobileTextRowHtml({
        originalHtml: cellOriginalHtml,
        originalPlainText: getPlainText(cellOriginalHtml),
        draft: cellDraft,
      });
      updateTextRow?.(selectedCell[0], nextValue);
      setIsCellEditorOpen(false);
      showNotice('บันทึกบรรทัดข้อความแล้ว');
      return;
    }
    if (cellDraftMode === 'measure-text' && (isSelectedTextMeasure || isSelectedAnnotation)) {
      const nextValue = resolveMobileTextRowHtml({
        originalHtml: cellOriginalHtml,
        originalPlainText: getPlainText(cellOriginalHtml),
        draft: cellDraft,
      });
      updateMeasureText?.(selectedCell[0], selectedCell[1], nextValue);
      setIsCellEditorOpen(false);
      showNotice(isSelectedAnnotation ? 'บันทึกคำอธิบายแล้ว' : 'บันทึกข้อความในห้องแล้ว');
      return;
    }
    if (cellDraftMode === 'row-label' && isSelectedRowLabel) {
      const singleLineLabel = String(cellDraft ?? '').replace(/\r?\n/g, ' ');
      updateMeasureText?.(
        selectedCell[0],
        selectedCell[1],
        isSelectedNathapLabel ? escapeMobileLabel(singleLineLabel) : singleLineLabel,
      );
      setIsCellEditorOpen(false);
      showNotice('บันทึกชื่อแถวแล้ว');
      return;
    }
    const [rowIndex, measureIndex, cellIndex] = selectedCell;
    const nextToken = cellDraftMode === 'custom' && canUseCustomKeyboard
      ? encodeCustomCellToken(cellDraft)
      : cellDraft;
    updateCellToken?.(rowIndex, measureIndex, cellIndex, nextToken, {
      preview: cellDraftMode !== 'custom',
    });
    setIsCellEditorOpen(false);
    showNotice('บันทึกเนื้อหาในช่องแล้ว');
  };

  const clearCurrentCell = () => {
    if (!canOpenContentEditor || isReadOnly) return;
    if (isSelectedTextRow) {
      updateTextRow?.(selectedCell[0], '');
      setIsCellEditorOpen(false);
      showNotice('ล้างบรรทัดข้อความแล้ว');
      return;
    }
    if (isSelectedTextMeasure || isSelectedAnnotation) {
      updateMeasureText?.(selectedCell[0], selectedCell[1], '');
      setIsCellEditorOpen(false);
      showNotice(isSelectedAnnotation ? 'ล้างคำอธิบายแล้ว' : 'ล้างข้อความในห้องแล้ว');
      return;
    }
    if (isSelectedRowLabel) {
      updateMeasureText?.(selectedCell[0], selectedCell[1], '');
      setIsCellEditorOpen(false);
      showNotice('ล้างชื่อแถวแล้ว');
      return;
    }
    updateCellToken?.(selectedCell[0], selectedCell[1], selectedCell[2], '-', { preview: false });
    setIsCellEditorOpen(false);
    showNotice('ล้างช่องแล้ว');
  };

  const addMobileSymbol = (type) => {
    if (!canCreateSymbol || isReadOnly || !addSymbol) return;
    const start = [...selectionRange.start];
    const end = [...selectionRange.end];
    const startOrder = start[0] * 1000000 + start[1] * 1000 + start[2];
    const endOrder = end[0] * 1000000 + end[1] * 1000 + end[2];
    const symbolId = Date.now();
    addSymbol(type, start, end, {
      id: symbolId,
      color: type === 'kro'
        ? (layoutConfig.kroColor || '#3b82f6')
        : (layoutConfig.sabatColor || '#1e293b'),
      strokewidth: type === 'kro'
        ? (layoutConfig.kroStrokeWidth || 2.5)
        : (layoutConfig.sabatStrokeWidth || 2.5),
      height: layoutConfig.symbolHeight ?? 20,
      wraps: type === 'kro' && startOrder > endOrder,
    });
    setLayoutConfig((current) => ({ ...current, activeSymbol: type }));
    setSelectionRange?.(null);
    setSelectedSymbolId?.(symbolId);
    window.dispatchEvent(new CustomEvent('tme-open-symbol-panel', { detail: { type } }));
    showNotice(type === 'kro' ? 'เพิ่มเส้นกรอแล้ว' : 'เพิ่มเส้นสะบัดแล้ว');
  };

  const deleteSelectedSymbol = () => {
    if (!selectedSymbol || isReadOnly) return;
    removeSymbol?.(selectedSymbol.id);
    setSelectedSymbolId?.(null);
    showNotice('ลบเส้นสัญลักษณ์แล้ว');
  };

  return (
    <footer className="relative z-40 shrink-0 rounded-t-3xl border-t border-slate-200 bg-white shadow-[0_-12px_30px_rgba(15,23,42,0.15)]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <button type="button" onClick={moveSelectionPrev} disabled={!hasCell} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 disabled:opacity-40" aria-label="ไปช่องก่อนหน้า">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs font-black text-slate-700">{selectedLabel}</p>
          <p className={`mt-0.5 text-[9px] font-semibold ${['error', 'retrying', 'offline'].includes(autoSaveStatus) ? 'text-amber-600' : 'text-slate-400'}`}>
            {autoSaveLabel || displayInstrument?.name || 'เครื่องดนตรีไทย'}
          </p>
        </div>
        <button type="button" onClick={moveSelectionNext} disabled={!hasCell} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 disabled:opacity-40" aria-label="ไปช่องถัดไป">
          <ChevronRight size={22} />
        </button>
        <button type="button" onClick={() => setIsExpanded((expanded) => !expanded)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600" aria-label={isExpanded ? 'ย่อคีย์บอร์ด' : 'เปิดคีย์บอร์ด'} aria-expanded={isExpanded}>
          <ChevronDown size={22} className={`transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {isExpanded && (
        <>
          <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <label className="flex h-12 min-w-[150px] shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-900">
              <Music2 size={18} className="shrink-0" />
              <select
                value={displayInstrument?.id || ''}
                onChange={(event) => changeInstrument?.(event.target.value)}
                disabled={isReadOnly}
                className="min-w-0 flex-1 bg-transparent outline-none"
                aria-label="เลือกเครื่องดนตรี"
              >
                {Object.values(INSTRUMENT_CONFIG).map((instrument) => (
                  <option key={instrument.id} value={instrument.id} disabled={!canAccess(`instrument:${instrument.id}`, userRole)}>{instrument.name}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setKeyboardMode('notes')} className={`flex h-12 min-w-[84px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black ${activeKeyboardMode === 'notes' ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
              <Keyboard size={17} /> โน้ต
            </button>
            {canUseCustomKeyboard && <button type="button" onClick={() => setKeyboardMode('custom')} className={`flex h-12 min-w-[88px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black ${activeKeyboardMode === 'custom' ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
              <FileText size={17} /> คำกำหนดเอง
            </button>}
            {displayInstrument?.type !== 'percussion' && <button type="button" onClick={() => setIntervalMode?.(intervalMode === '8' ? 'off' : '8')} className={`flex h-12 min-w-[82px] shrink-0 items-center justify-center rounded-xl border px-3 text-xs font-black ${intervalMode === '8' ? 'border-amber-400 bg-amber-400 text-amber-950' : 'border-slate-200 bg-white text-slate-600'}`}>
              คู่ 8 {intervalMode === '8' ? 'เปิด' : 'ปิด'}
            </button>}
            {displayInstrument?.type !== 'percussion' && <button type="button" onClick={() => setIsReduceMode?.(!isReduceMode)} className={`flex h-12 min-w-[82px] shrink-0 items-center justify-center rounded-xl border px-3 text-xs font-black ${isReduceMode ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
              ลดเสียง {isReduceMode ? 'เปิด' : 'ปิด'}
            </button>}
            <button type="button" onClick={() => setIsToolsOpen(true)} className="flex h-12 min-w-[92px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-black text-indigo-700">
              <SlidersHorizontal size={17} /> เครื่องมือ
            </button>
          </div>

          <div className={`flex gap-2 overflow-x-auto border-b px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${rangeAnchor ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
            <button type="button" onClick={toggleRangeSelection} disabled={!hasCell || isReadOnly} className={`flex h-11 min-w-[126px] shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black disabled:opacity-40 ${rangeAnchor ? 'border-amber-500 bg-amber-500 text-white' : 'border-sky-200 bg-white text-sky-700'}`}>
              {rangeAnchor ? <Check size={18} /> : <MousePointer2 size={18} />}
              {rangeAnchor ? 'จบช่วงที่นี่' : 'เริ่มเลือกช่วง'}
            </button>
            {rangeAnchor && <button type="button" onClick={() => setRangeAnchor(null)} className="flex h-11 min-w-[82px] shrink-0 items-center justify-center gap-1 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-600"><X size={17} /> ยกเลิก</button>}
            <button type="button" onClick={selectCurrentMeasure} disabled={!hasCell || isReadOnly} className="flex h-11 min-w-[104px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 disabled:opacity-40"><Table2 size={17} /> ทั้งห้อง</button>
            <button type="button" onClick={selectCurrentRow} disabled={!hasCell || isReadOnly} className="flex h-11 min-w-[116px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 disabled:opacity-40"><Rows3 size={17} /> ทั้งบรรทัด</button>
            {rangeAnchor && <p className="flex min-w-[210px] shrink-0 items-center text-[10px] font-bold text-amber-700">แตะช่องปลายทางบนกระดาษ แล้วกด “จบช่วงที่นี่”</p>}
          </div>

          <div className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <SmallAction icon={Undo2} label="ย้อนกลับ" onClick={undo} disabled={!canUndo || isReadOnly} />
            <SmallAction icon={Redo2} label="ทำซ้ำ" onClick={redo} disabled={!canRedo || isReadOnly} />
            <SmallAction icon={isPlaying ? Pause : Play} label={isPlaying ? 'หยุด' : 'เล่น'} onClick={togglePlay} active={isPlaying} />
            <SmallAction icon={Save} label="บันทึก" onClick={saveProject} />
            <SmallAction icon={Pencil} label={isSelectedRowLabel ? 'แก้ชื่อแถว' : isSelectedTextRow || isSelectedTextMeasure ? 'แก้ข้อความ' : isSelectedAnnotation ? 'แก้คำอธิบาย' : 'แก้ในช่อง'} onClick={openCellEditor} disabled={!canOpenContentEditor || isReadOnly} />
            <SmallAction icon={Copy} label="คัดลอก" onClick={() => runWithNotice(copySelection, 'คัดลอกแล้ว')} disabled={!hasCell || isReadOnly} />
            <SmallAction icon={Scissors} label="ตัด" onClick={() => runWithNotice(cutSelection, 'ตัดแล้ว')} disabled={!hasCell || isReadOnly} />
            <SmallAction icon={ClipboardPaste} label="วาง" onClick={() => runWithNotice(pasteSelection, 'วางแล้ว')} disabled={!hasCell || isReadOnly} />
            <SmallAction icon={Waves} label="เพิ่มสะบัด" onClick={() => addMobileSymbol('sabat')} disabled={!canCreateSymbol || isReadOnly} />
            <SmallAction icon={AudioLines} label="เพิ่มกรอ" onClick={() => addMobileSymbol('kro')} disabled={!canCreateSymbol || isReadOnly} />
            {selectedSymbol && <SmallAction icon={Trash2} label="ลบเส้น" onClick={() => requestDestructiveAction({ title: 'ลบเส้นสัญลักษณ์?', description: 'เส้นที่เลือกจะถูกลบออกจากโน้ต', action: deleteSelectedSymbol })} disabled={isReadOnly} danger />}
            <SmallAction icon={Plus} label="เพิ่มจังหวะ" onClick={addNoteColumn} disabled={!hasCell || isReadOnly} />
            <SmallAction icon={Minus} label="ลบจังหวะ" onClick={() => requestDestructiveAction({ title: 'ลบจังหวะนี้?', description: 'ช่องจังหวะที่เลือกและข้อมูลภายในจะถูกลบ', action: removeNoteColumn, successMessage: 'ลบจังหวะแล้ว' })} disabled={!hasCell || isReadOnly} danger />
            <SmallAction icon={Plus} label="เพิ่มห้อง" onClick={addMeasure} disabled={!hasCell || isReadOnly} />
            <SmallAction icon={Minus} label="ลบห้อง" onClick={() => requestDestructiveAction({ title: 'ลบห้องนี้?', description: 'โน้ตและข้อความทั้งหมดในห้องที่เลือกจะถูกลบ', action: removeMeasure, successMessage: 'ลบห้องแล้ว' })} disabled={!hasCell || isReadOnly} danger />
            <SmallAction icon={Plus} label="เพิ่มบรรทัด" onClick={addRow} disabled={!hasCell || isReadOnly} />
            <SmallAction icon={Trash2} label="ลบบรรทัด" onClick={() => requestDestructiveAction({ title: 'ลบบรรทัดนี้?', description: 'ข้อมูลทั้งบรรทัดที่เลือกจะถูกลบออกจากกระดาษ', action: removeRow, successMessage: 'ลบบรรทัดแล้ว' })} disabled={!hasCell || isReadOnly} danger />
          </div>

          {activeKeyboardMode === 'notes' ? (
            <div className="flex items-stretch gap-1.5 overflow-x-auto border-t border-sky-100 bg-sky-50/70 px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button type="button" onClick={() => inputNote?.('-')} disabled={!hasCell || isReadOnly} className="flex h-[76px] min-w-[66px] shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40">
                <span className="text-2xl font-black">—</span>
                <span className="mt-1 text-[9px] font-bold">พักเสียง</span>
              </button>
              {keys.map((key, index) => (
                <button
                  key={`${key.eng}-${index}`}
                  type="button"
                  onClick={() => insertInstrumentNote(key)}
                  disabled={!hasCell || isReadOnly}
                  className="flex h-[76px] min-w-[64px] shrink-0 flex-col items-center justify-center rounded-xl border border-slate-300 border-b-4 bg-white text-slate-800 shadow-sm active:translate-y-0.5 active:border-b-2 disabled:opacity-40"
                >
                  <span className="text-[9px] font-bold text-slate-400">{key.eng}</span>
                  <span className="mt-1 text-2xl font-black leading-none">{formatNote(isReduceMode && shiftNoteObject ? shiftNoteObject(key, 1) : key)}</span>
                </button>
              ))}
              <button type="button" onClick={() => inputNote?.('BACKSPACE')} disabled={!hasCell || isReadOnly} className="flex h-[76px] min-w-[72px] shrink-0 flex-col items-center justify-center rounded-xl border border-rose-200 border-b-4 bg-rose-50 text-rose-600 shadow-sm active:translate-y-0.5 active:border-b-2 disabled:opacity-40">
                <Trash2 size={24} />
                <span className="mt-1 text-[9px] font-black">ลบโน้ต</span>
              </button>
            </div>
          ) : (
            <div className="border-t border-violet-100 bg-violet-50/70 px-3 py-2.5">
              <div className="mb-2 flex items-center gap-2">
                <form onSubmit={addCustomKey} className="flex min-w-0 flex-1 items-center gap-2">
                  <input value={customDraft} onChange={(event) => setCustomDraft(event.target.value)} maxLength={CUSTOM_KEYBOARD_MAX_LABEL_LENGTH} placeholder="พิมพ์คำสำหรับสร้างปุ่ม" disabled={isReadOnly || customKeys.length >= CUSTOM_KEYBOARD_MAX_KEYS} className="h-11 min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-3 text-sm font-semibold outline-none focus:border-violet-400" />
                  <button type="submit" disabled={!normalizeCustomText(customDraft) || isReadOnly || customKeys.length >= CUSTOM_KEYBOARD_MAX_KEYS} className="h-11 shrink-0 rounded-xl bg-violet-600 px-4 text-xs font-black text-white disabled:opacity-40">เพิ่มปุ่ม</button>
                </form>
                <button type="button" onClick={() => setAppendCustomText((current) => !current)} className={`h-11 shrink-0 rounded-xl border px-3 text-[10px] font-black ${appendCustomText ? 'border-amber-400 bg-amber-400 text-amber-950' : 'border-slate-200 bg-white text-slate-600'}`}>ต่อคำ {appendCustomText ? 'เปิด' : 'ปิด'}</button>
              </div>
              <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {customKeys.map((key) => (
                  <div key={key.id} className="flex h-[72px] min-w-[92px] shrink-0 flex-col overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
                    <button type="button" onClick={() => appendCustomText ? appendCustomTextToCurrentCell?.(key.label) : inputCustomText?.(key.label)} disabled={!hasCell || isReadOnly} className="min-h-0 flex-1 px-3 text-sm font-black text-violet-800 disabled:opacity-40">{key.label}</button>
                    <button type="button" onClick={() => updateCustomKeys(customKeys.filter((item) => item.id !== key.id))} disabled={isReadOnly} className="h-6 border-t border-violet-100 text-[9px] font-bold text-rose-500 disabled:opacity-40">ลบปุ่ม</button>
                  </div>
                ))}
                {customKeys.length === 0 && <div className="flex h-[72px] min-w-full items-center justify-center rounded-xl border border-dashed border-violet-200 bg-white px-4 text-xs font-bold text-violet-400">พิมพ์คำด้านบนแล้วกด “เพิ่มปุ่ม”</div>}
              </div>
            </div>
          )}
        </>
      )}

      {isToolsOpen && (
        <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/45" onClick={() => setIsToolsOpen(false)}>
          <section className="max-h-[78vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 shadow-2xl" onClick={(event) => event.stopPropagation()} aria-label="เครื่องมือแก้ไขมือถือ">
            <div className="mb-4 flex items-center justify-between">
              <div><h3 className="text-lg font-black text-slate-900">เครื่องมือแก้ไข</h3><p className="text-xs font-semibold text-slate-400">จัดโครงสร้างและขนาดกระดาษ</p></div>
              <button type="button" onClick={() => setIsToolsOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"><X size={22} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SmallAction icon={Rows3} label="บรรทัดเดี่ยว" onClick={() => addRow?.()} disabled={isReadOnly} />
              <SmallAction icon={Rows3} label="บรรทัดคู่" onClick={() => addDoubleRow?.()} disabled={isReadOnly} />
              <SmallAction icon={Trash2} label="ลบบรรทัด" onClick={() => requestDestructiveAction({ title: 'ลบบรรทัดนี้?', description: 'ข้อมูลทั้งบรรทัดที่เลือกจะถูกลบออกจากกระดาษ', action: () => { removeRow?.(); setIsToolsOpen(false); }, successMessage: 'ลบบรรทัดแล้ว' })} disabled={!hasCell || isReadOnly} danger />
              <SmallAction icon={FilePlus2} label="ขึ้นหน้าใหม่" onClick={() => addPageBreak?.()} disabled={isReadOnly} />
              <SmallAction icon={FileText} label="ช่องข้อความ" onClick={() => convertMeasureToText?.()} disabled={!hasCell || isReadOnly} />
              <SmallAction icon={FileText} label="บรรทัดข้อความ" onClick={() => addTextRow?.()} disabled={!hasCell || isReadOnly} />
              <SmallAction icon={FileText} label="คำอธิบาย" onClick={() => addAnnotationRow?.()} disabled={isReadOnly} />
              <SmallAction icon={Maximize2} label="ขยาย 4→8" onClick={() => expandSelectedMeasures?.()} disabled={!canExpand || isReadOnly} />
              <SmallAction icon={Drum} label="เครื่องจังหวะ" onClick={() => openPanel(onOpenMetronome)} />
              <SmallAction icon={Settings} label="ข้อมูลเพลง" onClick={() => openPanel(onOpenSettings)} />
            </div>
            <p className="mb-2 mt-5 text-xs font-black text-slate-400">เครื่องมือแบบคอม</p>
            <div className="grid grid-cols-3 gap-2">
              <SmallAction icon={ListMusic} label="ลำดับเพลง" onClick={() => openEditorPanel('sequence')} />
              <SmallAction icon={Tag} label="ป้ายกำกับ" onClick={() => openEditorPanel('labels')} />
              <SmallAction icon={Table2} label="ตั้งค่าตาราง" onClick={() => openEditorPanel('table')} />
              <SmallAction icon={Volume2} label="น้ำหนักเสียง" onClick={() => openEditorPanel('velocity')} />
              <SmallAction icon={Waves} label="ลูกสะบัด" onClick={() => openEditorPanel('sabat')} />
              <SmallAction icon={AudioLines} label="ลูกกรอ" onClick={() => openEditorPanel('kro')} />
            </div>
            <p className="mb-2 mt-5 text-xs font-black text-slate-400">รูปแบบโน้ตที่เลือก</p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <select
                value={selectedFontFamily}
                onChange={(event) => applySelectedStyle('noteFontFamily', event.target.value)}
                disabled={styleTargetKeys.length === 0 || isReadOnly}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none disabled:opacity-40"
                aria-label="แบบอักษรของโน้ตที่เลือก"
              >
                {FONT_OPTIONS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
              </select>
              <div className="mt-2 grid grid-cols-5 gap-2">
                <button type="button" onClick={() => applySelectedStyle('fontSize', (value) => Math.max(10, Number(value || 16) - 2))} disabled={styleTargetKeys.length === 0 || isReadOnly} className="h-12 rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-600 disabled:opacity-40" aria-label="ลดขนาดตัวโน้ต">A−</button>
                <div className="flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-600">{selectedFontSize}</div>
                <button type="button" onClick={() => applySelectedStyle('fontSize', (value) => Math.min(150, Number(value || 16) + 2))} disabled={styleTargetKeys.length === 0 || isReadOnly} className="h-12 rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-600 disabled:opacity-40" aria-label="เพิ่มขนาดตัวโน้ต">A+</button>
                <button type="button" onClick={() => applySelectedStyle('isBold', !allTargetsUse('isBold'))} disabled={styleTargetKeys.length === 0 || isReadOnly} className={`h-12 rounded-xl border text-lg font-black disabled:opacity-40 ${allTargetsUse('isBold') ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-200 bg-white text-slate-700'}`} aria-label="ตัวหนา">B</button>
                <button type="button" onClick={() => applySelectedStyle('isItalic', !allTargetsUse('isItalic'))} disabled={styleTargetKeys.length === 0 || isReadOnly} className={`h-12 rounded-xl border text-lg font-black italic disabled:opacity-40 ${allTargetsUse('isItalic') ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-200 bg-white text-slate-700'}`} aria-label="ตัวเอียง">I</button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600">
                  <input type="color" value={firstTargetStyle.color || '#0f172a'} onChange={(event) => applySelectedStyle('color', event.target.value)} disabled={styleTargetKeys.length === 0 || isReadOnly} className="h-8 w-10 rounded border-0 bg-transparent p-0 disabled:opacity-40" />
                  สีตัวโน้ต
                </label>
                <button type="button" onClick={clearSelectedStyles} disabled={styleTargetKeys.length === 0 || isReadOnly} className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-500 disabled:opacity-40">คืนค่าเดิม</button>
              </div>
              {styleTargetKeys.length === 0 && <p className="mt-2 text-center text-[10px] font-bold text-amber-600">แตะช่องโน้ตก่อนปรับรูปแบบ</p>}
            </div>
            <p className="mb-2 mt-5 text-xs font-black text-slate-400">ไฟล์และส่งออก</p>
            <div className="grid grid-cols-3 gap-2">
              <SmallAction icon={FilePlus2} label="โปรเจกต์ใหม่" onClick={() => openPanel(newProject)} />
              <FileAction icon={FolderOpen} label="เปิดไฟล์ .tme" accept=".thai,.tme,.json" onFile={(file) => openPanel(() => loadProject?.(file))} />
              <FileAction icon={Upload} label="นำเข้า TXML" accept=".txml,application/xml,text/xml" onFile={(file) => openPanel(() => importThaiMusicXml?.(file))} />
              <SmallAction icon={Save} label="บันทึก .tme" onClick={() => openPanel(saveProject)} />
              {canAccess('export-txml', userRole) && <SmallAction icon={Download} label="ส่งออก TXML" onClick={() => openPanel(exportThaiMusicXml)} />}
              {canAccess('export-musicxml', userRole) && <SmallAction icon={Music2} label="MusicXML" onClick={() => openPanel(onOpenMusicXml)} />}
              {canAccess('export-pdf', userRole) && <SmallAction icon={FileDown} label="ส่งออก PDF" onClick={() => openPanel(() => { stopPlayback?.(); onPrint?.(); })} />}
            </div>
            <p className="mb-2 mt-5 text-xs font-black text-slate-400">ขนาดกระดาษ</p>
            <div className="grid grid-cols-3 gap-2">
              <SmallAction icon={ZoomOut} label="ดูทั้งหน้า" onClick={() => window.dispatchEvent(new CustomEvent('tme-sheet-zoom', { detail: { value: 48 } }))} />
              <SmallAction icon={ZoomIn} label="แตะง่าย" onClick={() => window.dispatchEvent(new CustomEvent('tme-sheet-zoom', { detail: { value: 160 } }))} active />
              <SmallAction icon={ZoomIn} label="ขยายสุด" onClick={() => window.dispatchEvent(new CustomEvent('tme-sheet-zoom', { detail: { value: 200 } }))} />
            </div>
            <p className="mb-2 mt-5 text-xs font-black text-slate-400">เปลี่ยนหน้ากระดาษ</p>
            <div className="grid grid-cols-2 gap-2">
              <SmallAction icon={ChevronLeft} label="หน้าก่อนหน้า" onClick={() => { setIsToolsOpen(false); window.dispatchEvent(new CustomEvent('tme-sheet-page', { detail: { delta: -1 } })); }} />
              <SmallAction icon={ChevronRight} label="หน้าถัดไป" onClick={() => { setIsToolsOpen(false); window.dispatchEvent(new CustomEvent('tme-sheet-page', { detail: { delta: 1 } })); }} />
            </div>
          </section>
        </div>
      )}

      {isCellEditorOpen && (
        <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/45" onClick={() => setIsCellEditorOpen(false)}>
          <form className="w-full rounded-t-3xl bg-white p-4 pb-8 shadow-2xl" onSubmit={saveCellDraft} onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">{cellDraftMode === 'text' ? 'แก้บรรทัดข้อความ' : cellDraftMode === 'measure-text' ? (isSelectedAnnotation ? 'แก้คำอธิบาย' : 'แก้ข้อความในห้อง') : cellDraftMode === 'row-label' ? 'แก้ชื่อแถว' : 'แก้เนื้อหาในช่อง'}</h3>
                <p className="text-xs font-semibold text-slate-400">{['text', 'measure-text', 'row-label'].includes(cellDraftMode) ? 'พิมพ์ข้อความได้โดยไม่ต้องแตะตัวอักษรเล็กบนกระดาษ' : 'พิมพ์โน้ตหลายตัวหรือข้อความกำหนดเองได้โดยตรง'}</p>
              </div>
              <button type="button" onClick={() => setIsCellEditorOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-label="ปิด"><X size={22} /></button>
            </div>
            {!['text', 'measure-text', 'row-label'].includes(cellDraftMode) && <div className="mb-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setCellDraftMode('notes')} className={`h-12 rounded-xl border text-sm font-black ${cellDraftMode === 'notes' ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>ตัวโน้ต</button>
              <button type="button" onClick={() => setCellDraftMode('custom')} disabled={!canUseCustomKeyboard} className={`h-12 rounded-xl border text-sm font-black disabled:opacity-40 ${cellDraftMode === 'custom' ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>คำกำหนดเอง</button>
            </div>}
            {cellDraftMode === 'text' || cellDraftMode === 'measure-text' ? (
              <textarea
                value={cellDraft}
                onChange={(event) => setCellDraft(event.target.value)}
                maxLength={1000}
                autoFocus
                rows={cellDraftMode === 'text' ? 5 : 3}
                placeholder={isSelectedAnnotation ? 'พิมพ์คำอธิบาย' : cellDraftMode === 'measure-text' ? 'พิมพ์ข้อความในห้อง' : 'พิมพ์ข้อความที่ต้องการแสดงในบรรทัด'}
                className="w-full resize-none rounded-2xl border-2 border-sky-200 bg-sky-50 p-4 text-base font-semibold leading-7 text-slate-800 outline-none focus:border-sky-500"
              />
            ) : cellDraftMode === 'row-label' ? (
              <input
                value={cellDraft}
                onChange={(event) => setCellDraft(event.target.value)}
                maxLength={80}
                autoFocus
                enterKeyHint="done"
                placeholder="เช่น มือขวา มือซ้าย หรือชื่อหน้าทับ"
                className="h-16 w-full rounded-2xl border-2 border-sky-200 bg-sky-50 px-4 text-center text-lg font-black text-slate-800 outline-none focus:border-sky-500"
              />
            ) : (
              <input
                value={cellDraft}
                onChange={(event) => setCellDraft(event.target.value)}
                maxLength={cellDraftMode === 'custom' ? CUSTOM_CELL_MAX_LENGTH : 32}
                autoFocus
                enterKeyHint="done"
                placeholder={cellDraftMode === 'custom' ? 'พิมพ์คำที่ต้องการแสดงในช่อง' : 'เช่น ดรมฟ หรือ - สำหรับช่องว่าง'}
                className="h-16 w-full rounded-2xl border-2 border-sky-200 bg-sky-50 px-4 text-center text-xl font-black text-slate-800 outline-none focus:border-sky-500"
              />
            )}
            <p className="mt-2 text-center text-[10px] font-bold text-slate-400">{cellDraftMode === 'text' || cellDraftMode === 'measure-text' ? 'รองรับข้อความหลายบรรทัด สูงสุด 1,000 ตัวอักษร' : cellDraftMode === 'row-label' ? 'ชื่อนี้จะแสดงทางซ้ายของบรรทัด' : 'ช่องว่างจะถูกบันทึกเป็นเครื่องหมายพักเสียง −'}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setIsCellEditorOpen(false)} className="h-12 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-600">ยกเลิก</button>
              <button type="button" onClick={clearCurrentCell} className="h-12 rounded-xl border border-rose-200 bg-rose-50 text-sm font-black text-rose-600">ล้างช่อง</button>
              <button type="submit" className="h-12 rounded-xl bg-sky-500 text-sm font-black text-white shadow-lg shadow-sky-500/20">บันทึก</button>
            </div>
          </form>
        </div>
      )}
      {notice && (
        <div className={`fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[220] flex min-h-11 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs font-black text-white shadow-xl ${notice.tone === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`} role="status" aria-live="polite">
          <Check size={17} /> {notice.message}
        </div>
      )}
      {confirmAction && (
        <div className="fixed inset-0 z-[230] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onClick={() => setConfirmAction(null)}>
          <section className="w-full max-w-sm rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl sm:rounded-3xl sm:pb-5" onClick={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="mobile-confirm-title">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600"><Trash2 size={23} /></div>
            <h3 id="mobile-confirm-title" className="text-center text-lg font-black text-slate-900">{confirmAction.title}</h3>
            <p className="mt-2 text-center text-sm font-medium leading-6 text-slate-500">{confirmAction.description}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setConfirmAction(null)} className="h-12 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-600">ยกเลิก</button>
              <button type="button" onClick={runConfirmedAction} className="h-12 rounded-xl bg-rose-600 text-sm font-black text-white shadow-lg shadow-rose-600/20">ยืนยันลบ</button>
            </div>
          </section>
        </div>
      )}
    </footer>
  );
};

export default MobileEditControls;
