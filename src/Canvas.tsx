import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ArrowUpRight, ChevronDown, Grid2X2, Hand, Magnet, Maximize, Minus, MousePointer2, Plus, Smartphone } from 'lucide-react';
import { absolutePosition, clone } from './model';
import type { NodeType, UINode } from './model';
import { useEditor } from './store';
import { ScreenRenderer } from './Renderer';

type Drag = { mode: 'move' | 'resize' | 'pan'; clientX: number; clientY: number; nodes: UINode[]; handle?: string; changed: boolean; scrollX?: number; scrollY?: number };
export function Canvas() {
  const st = useEditor(); const screen = st.project.screens.find(s => s.id === st.screenId)!;
  const viewport = useRef<HTMLDivElement>(null); const board = useRef<HTMLDivElement>(null); const drag = useRef<Drag | null>(null);
  const [editing, setEditing] = useState<string | null>(null); const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const selected = screen.nodes.filter(n => st.selected.includes(n.id));
  const single = selected.length === 1 ? selected[0] : null;
  const pos = single ? absolutePosition(single, screen.nodes) : null;
  const z = st.zoom;
  useEffect(() => { const rect = viewport.current?.getBoundingClientRect(); if (rect) useEditor.setState({ zoom: Math.max(.15, Math.min(.8, +Math.min((rect.width - 140) / screen.width, (rect.height - 145) / screen.height).toFixed(2))) }); }, []);
  function begin(e: ReactPointerEvent, n: UINode) {
    if (editing === n.id || e.button !== 0 || st.tool === 'hand') return;
    e.stopPropagation();
    if (n.locked) return;
    let ids = st.selected.includes(n.id) ? st.selected : [n.id];
    if (e.shiftKey) ids = st.selected.includes(n.id) ? st.selected.filter(id => id !== n.id) : [...st.selected, n.id];
    st.select(ids); e.currentTarget.setPointerCapture(e.pointerId);
    const roots = screen.nodes.filter(n => ids.includes(n.id) && !n.locked && !ids.includes(n.parentId ?? ''));
    drag.current = { mode: 'move', clientX: e.clientX, clientY: e.clientY, nodes: clone(roots), changed: false };
  }
  function move(e: ReactPointerEvent) {
    const d = drag.current; if (!d) return;
    const dx = (e.clientX - d.clientX) / z, dy = (e.clientY - d.clientY) / z;
    if (d.mode === 'pan') { if (viewport.current) { viewport.current.scrollLeft = d.scrollX! - (e.clientX - d.clientX); viewport.current.scrollTop = d.scrollY! - (e.clientY - d.clientY); } return; }
    if (!d.changed && Math.abs(dx) + Math.abs(dy) < 2) return;
    if (!d.changed) { st.checkpoint(); d.changed = true; }
    let deltaX = dx, deltaY = dy; const guide: { x?: number; y?: number } = {};
    if (st.snap && d.mode === 'move' && d.nodes.length === 1) {
      const n = d.nodes[0], p = absolutePosition(n, screen.nodes); const xs = [0, screen.width / 2, screen.width], ys = [0, screen.height / 2, screen.height];
      screen.nodes.filter(v => v.id !== n.id && !v.parentId && v.visible).forEach(v => { xs.push(v.x, v.x + v.width / 2, v.x + v.width); ys.push(v.y, v.y + v.height / 2, v.y + v.height); });
      let minX = 5 / z, minY = 5 / z;
      for (const offset of [0, n.width / 2, n.width]) for (const x of xs) { const dist = x - (p.x + dx + offset); if (Math.abs(dist) < minX) { minX = Math.abs(dist); deltaX = dx + dist; guide.x = x; } }
      for (const offset of [0, n.height / 2, n.height]) for (const y of ys) { const dist = y - (p.y + dy + offset); if (Math.abs(dist) < minY) { minY = Math.abs(dist); deltaY = dy + dist; guide.y = y; } }
    }
    setGuides(guide);
    st.update(p => { const s = p.screens.find(s => s.id === st.screenId)!; d.nodes.forEach(original => { const n = s.nodes.find(n => n.id === original.id)!; if (d.mode === 'move') { n.x = Math.round(original.x + deltaX); n.y = Math.round(original.y + deltaY); if (st.grid && st.snap) { n.x = Math.round(n.x / 8) * 8; n.y = Math.round(n.y / 8) * 8; } } else { const h = d.handle!; let w = original.width + (h.includes('e') ? dx : h.includes('w') ? -dx : 0); let height = original.height + (h.includes('s') ? dy : h.includes('n') ? -dy : 0); if (e.shiftKey) height = w / (original.width / original.height); n.width = Math.max(8, Math.round(w)); n.height = Math.max(8, Math.round(height)); if (h.includes('w')) n.x = original.x + original.width - n.width; if (h.includes('n')) n.y = original.y + original.height - n.height; } }); }, false);
  }
  function end() { drag.current = null; setGuides({}); }
  function resize(e: ReactPointerEvent, handle: string) { if (!single || single.locked) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { mode: 'resize', clientX: e.clientX, clientY: e.clientY, nodes: clone([single]), handle, changed: false }; }
  const zoom = (delta: number) => useEditor.setState({ zoom: Math.max(.15, Math.min(2, +(z + delta).toFixed(2))) });
  const fit = () => { const rect = viewport.current?.getBoundingClientRect(); if (rect) useEditor.setState({ zoom: Math.min(1, +Math.min((rect.width - 170) / screen.width, (rect.height - 150) / screen.height).toFixed(2)) }); };
  return <main className="canvas-area">
    <div className="canvas-topbar"><div className="breadcrumbs"><span>ページ</span><span>/</span><strong>{screen.name}</strong><ChevronDown size={12} /></div><span className="canvas-mode"><span />自由にレイアウト</span></div>
    <div ref={viewport} className={`canvas-viewport ${st.tool === 'hand' ? 'panning' : ''}`} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerDown={e => { if (st.tool === 'hand' || e.button === 1) { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { mode: 'pan', clientX: e.clientX, clientY: e.clientY, nodes: [], changed: false, scrollX: e.currentTarget.scrollLeft, scrollY: e.currentTarget.scrollTop }; } else if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-stage')) st.select([]); }} onWheel={e => { if (e.ctrlKey || e.metaKey) zoom(e.deltaY < 0 ? .05 : -.05); }}>
      <div className="canvas-stage" style={{ minWidth: Math.max(600, screen.width * z + 170), minHeight: screen.height * z + 156 }}>
        <div className="artboard-wrap" style={{ width: screen.width * z, height: screen.height * z }}>
          <div className="artboard-label"><div><Smartphone size={12} /><span>{screen.name}</span>{st.project.startScreenId === screen.id && <span className="start-tag">スタート</span>}</div><span>{screen.width} × {screen.height}</span></div>
          <div ref={board} className={`artboard ${screen.viewportSettings.deviceFrame ? 'device-frame' : ''}`} style={{ width: screen.width, height: screen.height, transform: `scale(${z})` }} onPointerDown={e => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('screen-renderer')) st.select([]); }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const type = e.dataTransfer.getData('moku/part') as NodeType; if (!type) return; const r = board.current!.getBoundingClientRect(); st.addNode(type, Math.round((e.clientX - r.left) / z), Math.round((e.clientY - r.top) / z)); }}>
            <div className="artboard-content" style={{ height: screen.height }}><ScreenRenderer screen={screen} selected={st.selected} editingId={editing} onPointerDown={begin} onDoubleClick={n => { if (n.locked) return; if (['text', 'button', 'input', 'navbar', 'list', 'card', 'tabbar'].includes(n.type)) setEditing(n.id); }} onText={(id, text) => { st.patchProperties([id], { text }); setEditing(null); }} /></div>
            {st.grid && <div className="canvas-grid" />}
            {selected.filter(n => n !== single).map(n => { const p = absolutePosition(n, screen.nodes); return <div key={n.id} className="selection-outline" style={{ left: p.x, top: p.y, width: n.width, height: n.height, transform: `rotate(${n.rotation}deg)` }} />; })}
            {single && pos && !editing && <div className={`selection-outline ${single.locked ? 'selection-locked' : ''}`} style={{ left: pos.x, top: pos.y, width: single.width, height: single.height, transform: `rotate(${single.rotation}deg)` }}><span className="selection-name" style={{ fontSize: 10 / z }}>{single.name}</span>{!single.locked && ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => <div key={h} className={`resize-handle handle-${h}`} style={{ width: 7 / z, height: 7 / z }} onPointerDown={e => resize(e, h)} />)}<span className="dimension-label" style={{ fontSize: 10 / z }}>{Math.round(single.width)} × {Math.round(single.height)}</span></div>}
            {guides.x !== undefined && <div className="snap-line vertical" style={{ left: guides.x }} />}{guides.y !== undefined && <div className="snap-line horizontal" style={{ top: guides.y }} />}
          </div>
          <div className="artboard-footnote"><Smartphone size={11} />{screen.device}<span>·</span>縦向き</div>
        </div>
      </div>
    </div>
    <div className="canvas-bottom"><div className="tool-dock"><button aria-label="選択ツール" title="選択 (V)" className={st.tool === 'select' ? 'active' : ''} onClick={() => useEditor.setState({ tool: 'select' })}><MousePointer2 size={17} /></button><button aria-label="手のひらツール" title="キャンバスを移動 (H)" className={st.tool === 'hand' ? 'active' : ''} onClick={() => useEditor.setState({ tool: 'hand' })}><Hand size={17} /></button><i /><button aria-label="グリッド" title="グリッド (Shift+G)" className={st.grid ? 'active' : ''} onClick={() => useEditor.setState({ grid: !st.grid })}><Grid2X2 size={17} /></button><button aria-label="スナップ" title="位置を揃える" className={st.snap ? 'active subtle' : ''} onClick={() => useEditor.setState({ snap: !st.snap })}><Magnet size={17} /></button></div><div className="zoom-dock"><button aria-label="縮小" onClick={() => zoom(-.1)}><Minus size={15} /></button><select aria-label="ズーム" value={z} onChange={e => useEditor.setState({ zoom: Number(e.target.value) })}>{[...new Set([.25, .5, .65, .8, 1, 1.25, 1.5, 2, z])].sort((a, b) => a - b).map(v => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}</select><button aria-label="拡大" onClick={() => zoom(.1)}><Plus size={15} /></button><i /><button aria-label="画面に合わせる" title="画面に合わせる" onClick={fit}><Maximize size={15} /></button></div></div>
    <div className="canvas-hint"><ArrowUpRight size={12} />パーツをドラッグして、アイデアを形に。</div>
  </main>;
}
