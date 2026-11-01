import { useMemo, useState } from 'react';
import { Check, ChevronRight, Monitor, RotateCw, Search, Smartphone, X } from 'lucide-react';
import { presets } from './model';
import { useEditor } from './store';
import { Modal } from './Dialogs';
import { applyScreenSize } from './device-layout';

export function DeviceDialog({ onClose }: { onClose: () => void }) {
  const st = useEditor(), screen = st.project.screens.find(s => s.id === st.screenId)!;
  const [search, setSearch] = useState(''), [group, setGroup] = useState('すべて'), [name, setName] = useState(screen.device);
  const [width, setWidth] = useState(screen.width), [height, setHeight] = useState(screen.height), [scale, setScale] = useState(false);
  const groups = [...new Set(presets.map(p => p.group))];
  const filtered = useMemo(() => presets.filter(p => (group === 'すべて' || p.group === group) && `${p.name} ${p.w} ${p.h}`.toLowerCase().includes(search.toLowerCase())), [group, search]);
  const valid = width >= 100 && width <= 6000 && height >= 100 && height <= 10000;
  function apply() {
    if (!valid) return;
    st.update(p => applyScreenSize(p.screens.find(s => s.id === st.screenId)!, width, height, name, scale));
    const viewport = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
    if (viewport) useEditor.setState({ zoom: Math.max(.1, Math.min(1, +Math.min((viewport.width - 120) / width, (viewport.height - 145) / height).toFixed(2))) });
    st.notify(`${name} · ${width} × ${height} に変更しました`); onClose();
  }
  return <Modal title="画面サイズを選択" className="device-modal" onClose={onClose}><header className="modal-header"><div><span className="modal-icon"><Smartphone size={21} /></span><div><h2>画面サイズを選択</h2><p>{presets.length}種類の機種・ビューポート・画面比から選べます。</p></div></div><button className="icon-button" aria-label="画面サイズ選択を閉じる" onClick={onClose}><X size={20} /></button></header>
    <div className="device-picker-body"><aside className="device-picker-nav"><span className="eyebrow">カテゴリ</span>{['すべて', ...groups].map(g => <button key={g} className={g === group ? 'active' : ''} onClick={() => setGroup(g)}>{g}<span>{g === 'すべて' ? presets.length : presets.filter(p => p.group === g).length}</span></button>)}<p>サイズは参考論理ピクセルです。OSやブラウザーの設定によって表示領域は変わります。</p></aside><div className="device-picker-content"><div className="device-search"><Search size={17} /><input aria-label="機種・サイズを検索" value={search} onChange={e => setSearch(e.target.value)} placeholder="iPhone、Pixel、16:9、1440…" /></div><div className="device-presets">{filtered.map(p => <button key={p.name} aria-pressed={name === p.name && width === p.w && height === p.h} className={`device-preset ${name === p.name && width === p.w && height === p.h ? 'selected' : ''}`} onClick={() => { setName(p.name); setWidth(p.w); setHeight(p.h); }}><div className="device-preset-visual"><span style={{ width: Math.min(78, 60 * p.w / p.h), height: Math.min(64, 70 * p.h / p.w), borderRadius: p.w > p.h ? 4 : 7 }} /><i>{p.w > p.h ? <Monitor size={13} /> : <Smartphone size={13} />}</i></div><strong>{p.name}</strong><span>{p.w} × {p.h}</span>{name === p.name && width === p.w && height === p.h && <Check size={15} className="device-selected-check" />}</button>)}{!filtered.length && <div className="device-empty">一致するプリセットがありません。下のサイズ欄で自由に指定できます。</div>}</div></div></div>
    <div className="device-custom"><div><span>選択中</span><strong>{name}</strong></div><label>幅<input aria-label="プリセットの幅" type="number" min={100} max={6000} value={width || ''} onChange={e => { setWidth(Number(e.target.value)); setName('カスタム'); }} /><span>px</span></label><button className="icon-button" aria-label="画面の向きを変更" title="縦・横を切り替え" onClick={() => { const base = name.replace(/（(?:横向き|縦向き|正方形)）$/, "").replace(/\s+横向き$/, ""); const original = presets.find(p => p.name === base && p.w === height && p.h === width); setWidth(height); setHeight(width); setName(original ? base : `${base}（${height > width ? "横向き" : height < width ? "縦向き" : "正方形"}）`); }}><RotateCw size={16} /></button><label>高さ<input aria-label="プリセットの高さ" type="number" min={100} max={10000} value={height || ''} onChange={e => { setHeight(Number(e.target.value)); setName('カスタム'); }} /><span>px</span></label></div>
    <footer className="modal-footer"><label className="checkbox-label"><input type="checkbox" checked={scale} onChange={e => setScale(e.target.checked)} />配置したパーツもサイズに合わせて拡縮</label><div><button className="outline-button" onClick={onClose}>キャンセル</button><button className="primary-button" disabled={!valid} onClick={apply}>このサイズを適用<ChevronRight size={16} /></button></div></footer>
  </Modal>;
}
