import { useEffect, useRef, useState } from 'react';

export function NumberField({ label, value, onChange, min = -20000, max = 20000, suffix }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; suffix?: string }) {
  const [draft, setDraft] = useState(String(Math.round(value * 100) / 100)), focused = useRef(false), cancelled = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(Math.round(value * 100) / 100)); }, [value]);
  function commit() { focused.current = false; if (cancelled.current) { cancelled.current = false; setDraft(String(value)); return; } const number = Number(draft); if (!draft.trim() || !Number.isFinite(number)) { setDraft(String(value)); return; } const next = Math.min(max, Math.max(min, number)); setDraft(String(next)); if (next !== value) onChange(next); }
  return <label className="number-field"><span>{label}</span><input aria-label={label} inputMode="decimal" value={draft} onFocus={() => focused.current = true} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur(); } }} />{suffix && <em>{suffix}</em>}</label>;
}
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  const [draft, setDraft] = useState(value), [invalid, setInvalid] = useState(false); const focused = useRef(false), cancelled = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  const transparent = value === 'transparent';
  const alpha = transparent ? 0 : value.length===9 ? Math.round(parseInt(value.slice(7,9),16)/255*100) : value.length===5 ? Math.round(parseInt(value[4]+value[4],16)/255*100) : 100;
  function commit() { focused.current = false; if (cancelled.current) { cancelled.current = false; setDraft(value); setInvalid(false); return; } let next = draft.trim(); if (next === '透明') next = 'transparent'; if (!next.startsWith('#') && /^[a-fA-F0-9]{3,8}$/.test(next)) next = '#' + next; if (!/^(#[a-fA-F0-9]{3}|#[a-fA-F0-9]{4}|#[a-fA-F0-9]{6}|#[a-fA-F0-9]{8}|transparent)$/.test(next)) { setInvalid(true); return; } setInvalid(false); setDraft(next); if (next !== value) onChange(next); }
  const picker = /^#[a-fA-F0-9]{6}/.test(value) ? value.slice(0,7) : /^#[a-fA-F0-9]{3,4}$/.test(value) ? '#' + value.slice(1,4).split('').map(v => v + v).join('') : '#ffffff';
  return <><div className="color-field"><input className="color-swatch" aria-label={`${label}を選択`} type="color" value={picker} onChange={e => { onChange(e.target.value); setDraft(e.target.value); setInvalid(false); }} /><input aria-label={label} value={draft === 'transparent' && !focused.current ? '透明' : draft} aria-invalid={invalid} onFocus={() => { focused.current = true; setDraft(value); }} onChange={e => { setDraft(e.target.value); setInvalid(false); }} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur(); } }} /><span>{alpha}%</span></div>{invalid && <small className="danger-text field-caption">#D4A373のような色コードを入力してください</small>}</>;
}
