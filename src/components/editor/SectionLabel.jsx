import { useEffect, useRef } from 'react';

export default function SectionLabel({ label, readOnly, onSelect, onSave }) {
  const editorRef = useRef(null);
  const saveRef = useRef(onSave);
  useEffect(() => { saveRef.current = onSave; }, [onSave]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor.innerHTML !== (label.text || '')) editor.innerHTML = label.text || '';
  }, [label.text]);

  useEffect(() => {
    const editor = editorRef.current;
    const save = () => saveRef.current(editor.innerHTML);
    editor.addEventListener('input', save);
    return () => editor.removeEventListener('input', save);
  }, []);

  return (
    <div
      ref={editorRef}
      id={`sheet-label-${label.id}`}
      data-section-label-editor="true"
      contentEditable={!readOnly}
      suppressContentEditableWarning
      role={readOnly ? undefined : 'textbox'}
      aria-label="ข้อความป้ายกำกับ"
      data-placeholder="พิมพ์ป้ายกำกับ..."
      onMouseDown={(event) => {
        event.stopPropagation();
        if (!readOnly) event.currentTarget.focus();
      }}
      onClick={(event) => { event.stopPropagation(); if (!readOnly) onSelect(); }}
      onFocus={() => {
        if (readOnly) return;
        onSelect();
        const selection = window.getSelection();
        if (!editorRef.current.contains(selection.anchorNode)) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }}
      onKeyDown={(event) => event.stopPropagation()}
      style={{ fontSize: label.fontSize || 18, fontWeight: label.isBold ? 'bold' : 'normal' }}
      className="outline-none cursor-text rounded px-1 min-w-[20px] min-h-[1em] focus:ring-2 focus:ring-indigo-400 hover:ring-2 hover:ring-indigo-200 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 print:empty:hidden print:ring-0"
      title="แก้ข้อความที่นี่ และจัดรูปแบบด้วยแถบด้านบน"
    />
  );
}
