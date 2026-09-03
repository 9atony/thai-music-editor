export const RHYTHM_LAYER_OPTIONS = [
  { value: 'all', label: 'ทุกชั้น' },
  { value: 'one', label: 'ชั้นเดียว' },
  { value: 'two', label: 'สองชั้น' },
  { value: 'three', label: 'สามชั้น' }
];

const LAYER_TERMS = {
  one: ['ชั้นเดียว', '1ชั้น', '๑ชั้น'],
  two: ['สองชั้น', '2ชั้น', '๒ชั้น'],
  three: ['สามชั้น', '3ชั้น', '๓ชั้น']
};

const normalizePatternName = (name) => String(name || '').replace(/\s+/g, '').toLowerCase();

export const filterRhythmPatternsByLayer = (patterns, layer = 'all') => {
  if (!Array.isArray(patterns) || layer === 'all' || !LAYER_TERMS[layer]) return patterns || [];
  return patterns.filter((pattern) => {
    const normalizedName = normalizePatternName(pattern?.name);
    return LAYER_TERMS[layer].some((term) => normalizedName.includes(term));
  });
};

// เปลี่ยนชั้นครั้งเดียว แล้วปรับหน้าทับของทุกเครื่องให้เป็นรายการในชั้นเดียวกัน
// โดยไม่เปลี่ยนเครื่องที่ยังไม่มีหน้าทับของชั้นนั้นอยู่ในระบบกลาง
export const applyRhythmLayer = (config, layer) => {
  const next = { ...config, rhythmLayer: layer };
  ['ching', 'klong', 'krub'].forEach((key) => {
    const available = filterRhythmPatternsByLayer(config.rhythms?.[key], layer);
    if (available.length === 0) return;
    const selectedId = config[key]?.pattern;
    next[key] = {
      ...config[key],
      pattern: available.some((pattern) => pattern.id === selectedId) ? selectedId : available[0].id
    };
  });
  return next;
};
