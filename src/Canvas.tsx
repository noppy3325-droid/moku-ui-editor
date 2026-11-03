import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ArrowUpRight, ChevronDown, Grid2X2, Hand, Magnet, Maximize, Minus, MousePointer2, Plus, Smartphone } from 'lucide-react';
import { clone, nodeTypes } from './model';
import type { NodeType, UINode } from './model';
import { clampZoom, editableRoots, isEffectivelyLocked, localDelta, resizeGeometry, worldGeometry } from './editor-geometry';
import { useEditor } from './store';
import { ScreenRenderer } from './Renderer';

type Pointer = { clientX: number; clientY: number; shiftKey: boolean };
type Drag = {
  mode: 'move' | 'resize' | 'pan' | 'marquee'; clientX: number; clientY: number; nodes: UINode[];
  allNodes: UINode[]; screenId: string; handle?: string; changed: boolean;
  scrollX?: number; scrollY?: number; startX?: number; startY?: number; selection?: string[];
};
type SelectionBox = { x: number; y: number; width: number; height: number };

export function Canvas() {
  const st = useEditor(), screen = st.project.screens.find(s => s.id === st.screenId) ?? st.project.screens[0];
  const viewport = useRef<HTMLDivElement>(null), board = useRef<HTMLDivElement>(null), drag = useRef<Drag | null>(null);
  const pendingMove = useRef<Pointer | null>(null), animationFrame = useRef<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null), [spaceHeld, setSpaceHeld] = useState(false);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({}), [marquee, setMarquee] = useState<SelectionBox | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const selected = screen.nodes.filter(n => st.selected.includes(n.id));
  const single = selected.length === 1 ? selected[0] : null;
  const pos = single ? worldGeometry(single, screen.nodes) : null;
  const z = clampZoom(st.zoom), contentHeight = Math.max(screen.height, screen.viewportSettings.scrollHeight);
  const panning = st.tool === 'hand' || spaceHeld;

  function setZoom(value: number, origin?: { clientX: number; clientY: number }) {
    const next = clampZoom(value), old = useEditor.getState().zoom;
    if (next === old) return;
    const view = viewport.current, artboard = board.current;
    if (!view || !artboard) { useEditor.setState({ zoom: next }); return; }
    const vr = view.getBoundingClientRect(), br = artboard.getBoundingClientRect();
    const x = origin?.clientX ?? vr.left + vr.width / 2, y = origin?.clientY ?? vr.top + vr.height / 2;
    const localX = (x - br.left) / old, localY = (y - br.top) / old;
    useEditor.setState({ zoom: next });
    requestAnimationFrame(() => {
      const rect = board.current?.getBoundingClientRect(); if (!rect || !viewport.current) return;
      viewport.current.scrollLeft += rect.left + localX * next - x;
      viewport.current.scrollTop += rect.top + localY * next - y;
    });
  }
  function fit() {
    const rect = viewport.current?.getBoundingClientRect(); if (!rect) return;
    useEditor.setState({ zoom: clampZoom(Math.min(1, Math.min((rect.width - 90) / screen.width, (rect.height - 135) / screen.height))) });
    if (viewport.current) { viewport.current.scrollTop = 0; viewport.current.scrollLeft = 0; }
  }
  useEffect(() => {
    const el = viewport.current; if (!el) return;
    const observer = new ResizeObserver(([entry]) => setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    const wheel = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(useEditor.getState().zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e); } };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); el.removeEventListener('wheel', wheel); };
  }, []);
  useEffect(() => {
    if (!st.loaded || st.viewRestored) return;
    const rect = viewport.current?.getBoundingClientRect(); if (!rect) return;
    useEditor.setState({ zoom: clampZoom(Math.min(.8, (rect.width - 90) / screen.width, (rect.height - 135) / screen.height)), viewRestored: true });
  }, [st.loaded, st.project.id, st.viewRestored]);
  useEffect(() => {
    drag.current = null; setEditing(null); setGuides({}); setMarquee(null);
  }, [st.screenId]);
  useEffect(() => {
    function down(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
      if (e.code === 'Space') { e.preventDefault(); setSpaceHeld(true); }
      if (e.key === 'Escape' && drag.current) { if (drag.current.changed && ['move', 'resize'].includes(drag.current.mode)) useEditor.getState().undo(); end(); }
    }
    function up(e: KeyboardEvent) { if (e.code === 'Space') setSpaceHeld(false); }
    const blur = () => { setSpaceHeld(false); end(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const measure = () => { if (cancelled || !board.current) return;
      const heights = new Map<string, number>();
      board.current.querySelectorAll<HTMLElement>('[data-node-id]').forEach(el => {
        const n = screen.nodes.find(n => n.id === el.dataset.nodeId);
        if (n?.type === 'text' && n.styles.autoHeight && !isEffectivelyLocked(n, screen.nodes)) {
          const content = el.querySelector<HTMLElement>(':scope > .node-text');
          if (content) heights.set(n.id, Math.max(1, Math.min(10000, Math.ceil(content.scrollHeight))));
        }
      });
      if ([...heights].some(([id,h]) => screen.nodes.find(n=>n.id===id)?.height !== h)) st.update(p=>p.screens.find(s=>s.id===screen.id)!.nodes.forEach(n=>{if(heights.has(n.id))n.height=heights.get(n.id)!;}), false);
    };
    void document.fonts.ready.then(measure); return () => { cancelled = true; };
  }, [screen.nodes]);

  function begin(e: ReactPointerEvent, node: UINode) {
    if (editing === node.id || e.button !== 0 || panning) return;
    e.stopPropagation();
    if (isEffectivelyLocked(node, screen.nodes)) { st.select([node.id]); return; }
    let ids = st.selected.includes(node.id) ? st.selected : [node.id];
    if (e.shiftKey) ids = st.selected.includes(node.id) ? st.selected.filter(id => id !== node.id) : [...st.selected, node.id];
    st.select(ids); e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode: 'move', clientX: e.clientX, clientY: e.clientY, nodes: clone(editableRoots(screen.nodes, ids)), allNodes: clone(screen.nodes), screenId: screen.id, changed: false };
  }
  function startMarquee(e: ReactPointerEvent) {
    if (panning || e.button !== 0 || !board.current) return;
    const target = e.target as HTMLElement;
    if (target !== e.currentTarget && !target.classList.contains('screen-renderer') && !target.classList.contains('artboard-content')) return;
    e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
    const rect = board.current.getBoundingClientRect();
    const selection = e.shiftKey ? [...st.selected] : [];
    st.select(selection);
    drag.current = { mode: 'marquee', clientX: e.clientX, clientY: e.clientY, nodes: [], allNodes: clone(screen.nodes), screenId: screen.id, changed: false, startX: (e.clientX - rect.left) / z, startY: (e.clientY - rect.top) / z, selection };
  }
  function moveNow(e: Pointer) {
    const d = drag.current; if (!d || d.screenId !== useEditor.getState().screenId) return;
    const zoom = useEditor.getState().zoom, dx = (e.clientX - d.clientX) / zoom, dy = (e.clientY - d.clientY) / zoom;
    if (d.mode === 'pan') { if (viewport.current) { viewport.current.scrollLeft = d.scrollX! - (e.clientX - d.clientX); viewport.current.scrollTop = d.scrollY! - (e.clientY - d.clientY); } return; }
    if (!d.changed && Math.abs(e.clientX - d.clientX) + Math.abs(e.clientY - d.clientY) < 3) return;
    if (d.mode === 'marquee') {
      d.changed = true;
      const box = { x: Math.min(d.startX!, d.startX! + dx), y: Math.min(d.startY!, d.startY! + dy), width: Math.abs(dx), height: Math.abs(dy) };
      setMarquee(box);
      const visible = (node: UINode) => { const seen = new Set<string>(); let n: UINode | undefined = node; while (n && !seen.has(n.id)) { if (!n.visible) return false; seen.add(n.id); n = d.allNodes.find(v => v.id === n!.parentId); } return true; };
      const ids = d.allNodes.filter(n => {
        if (!visible(n) || isEffectivelyLocked(n, d.allNodes)) return false;
        const p = worldGeometry(n, d.allNodes), angle = p.rotation * Math.PI / 180;
        const width = Math.abs(n.width * Math.cos(angle)) + Math.abs(n.height * Math.sin(angle)), height = Math.abs(n.width * Math.sin(angle)) + Math.abs(n.height * Math.cos(angle));
        const x = p.x + (n.width - width) / 2, y = p.y + (n.height - height) / 2;
        return x < box.x + box.width && x + width > box.x && y < box.y + box.height && y + height > box.y;
      }).map(n => n.id);
      useEditor.getState().select([...new Set([...(d.selection ?? []), ...ids])]); return;
    }
    if (!d.nodes.length) return;
    if (!d.changed) { useEditor.getState().checkpoint(); d.changed = true; }
    let deltaX = dx, deltaY = dy; const guide: { x?: number; y?: number } = {}, current = useEditor.getState();
    const activeScreen = current.project.screens.find(s => s.id === d.screenId)!;
    if (current.snap && d.mode === 'move' && d.nodes.length === 1) {
      const n = d.nodes[0], p = worldGeometry(n, d.allNodes), xs = [0, activeScreen.width / 2, activeScreen.width], ys = [0, activeScreen.height / 2, activeScreen.height];
      d.allNodes.filter(v => v.id !== n.id && !v.parentId && v.visible && !n.children.includes(v.id)).forEach(v => { xs.push(v.x, v.x + v.width / 2, v.x + v.width); ys.push(v.y, v.y + v.height / 2, v.y + v.height); });
      let minX = 5 / zoom, minY = 5 / zoom;
      for (const offset of [0, n.width / 2, n.width]) for (const x of xs) { const dist = x - (p.x + dx + offset); if (Math.abs(dist) < minX) { minX = Math.abs(dist); deltaX = dx + dist; guide.x = x; } }
      for (const offset of [0, n.height / 2, n.height]) for (const y of ys) { const dist = y - (p.y + dy + offset); if (Math.abs(dist) < minY) { minY = Math.abs(dist); deltaY = dy + dist; guide.y = y; } }
    }
    setGuides(guide);
    current.update(p => {
      const s = p.screens.find(s => s.id === d.screenId)!;
      d.nodes.forEach(original => {
        const node = s.nodes.find(n => n.id === original.id); if (!node) return;
        if (d.mode === 'move') {
          const delta = localDelta(original, d.allNodes, deltaX, deltaY);
          node.x = Math.round(original.x + delta.x); node.y = Math.round(original.y + delta.y);
          if (current.grid && current.snap) { node.x = Math.round(node.x / 8) * 8; node.y = Math.round(node.y / 8) * 8; }
        } else {
          const delta = localDelta(original, d.allNodes, dx, dy);
          Object.assign(node, resizeGeometry(original, d.handle!, delta.x, delta.y, e.shiftKey));
        }
      });
    }, false);
  }
  function move(e: ReactPointerEvent) {
    if (!drag.current) return;
    pendingMove.current = { clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey };
    if (animationFrame.current !== null) return;
    animationFrame.current = requestAnimationFrame(() => { animationFrame.current = null; if (pendingMove.current) moveNow(pendingMove.current); });
  }
  function end(e?: ReactPointerEvent) {
    if (animationFrame.current !== null) { cancelAnimationFrame(animationFrame.current); animationFrame.current = null; }
    if (e && drag.current) moveNow({ clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey });
    pendingMove.current = null; drag.current = null; setGuides({}); setMarquee(null);
  }
  function resize(e: ReactPointerEvent, handle: string) {
    if (!single || isEffectivelyLocked(single, screen.nodes)) return;
    e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode: 'resize', clientX: e.clientX, clientY: e.clientY, nodes: clone([single]), allNodes: clone(screen.nodes), screenId: screen.id, handle, changed: false };
  }
  return <main className="canvas-area" aria-label="編集キャンバス">
    <div className="canvas-topbar"><div className="breadcrumbs"><span>画面</span><span>/</span><strong>{screen.name}</strong><ChevronDown size={12} /></div><span className="canvas-mode"><span />{selected.length ? `${selected.length}個のパーツを選択` : '自由にレイアウト'}</span></div>
    <div ref={viewport} className={`canvas-viewport ${panning ? 'panning' : ''}`} onPointerMove={move} onPointerUp={end} onPointerCancel={() => end()} onPointerDown={e => {
      if (panning || e.button === 1) { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { mode: 'pan', clientX: e.clientX, clientY: e.clientY, nodes: [], allNodes: [], screenId: screen.id, changed: false, scrollX: e.currentTarget.scrollLeft, scrollY: e.currentTarget.scrollTop }; }
      else if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-stage')) st.select([]);
    }}>
      <div className="canvas-stage" style={{ width: Math.max(viewportSize.width, screen.width * z + 100), minHeight: Math.max(viewportSize.height, contentHeight * z + 150) }}>
        <div className="artboard-wrap" style={{ width: screen.width * z, height: contentHeight * z }}>
          <div className="artboard-label"><div><Smartphone size={12} /><span>{screen.name}</span>{st.project.startScreenId === screen.id && <span className="start-tag">スタート</span>}</div><span>{screen.width} × {screen.height}{contentHeight > screen.height ? ` / 内容 ${contentHeight}` : ''}</span></div>
          <div ref={board} className={`artboard ${screen.viewportSettings.deviceFrame ? 'device-frame' : ''}`} style={{ width: screen.width, height: contentHeight, transform: `scale(${z})` }} onPointerDown={startMarquee} onDragOver={e => { if (e.dataTransfer.types.includes('moku/part')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }} onDrop={e => {
            e.preventDefault(); const type = e.dataTransfer.getData('moku/part') as NodeType; if (!nodeTypes.includes(type)) return;
            const r = board.current!.getBoundingClientRect(); st.addNode(type, Math.round((e.clientX - r.left) / z), Math.round((e.clientY - r.top) / z));
          }}>
            <div className="artboard-content" style={{ height: contentHeight }}><ScreenRenderer screen={screen} selected={st.selected} editingId={editing} onPointerDown={begin} onDoubleClick={n => {
              if (!isEffectivelyLocked(n, screen.nodes) && !['rectangle', 'ellipse', 'line', 'divider', 'container', 'image', 'icon'].includes(n.type)) setEditing(n.id);
            }} onText={(id, text) => { st.patchProperties([id], { text }); setEditing(null); }} /></div>
            {st.grid && <div className="canvas-grid" />}
            {selected.filter(n => n !== single).map(n => { const p = worldGeometry(n, screen.nodes); return <div key={n.id} className="selection-outline" style={{ left: p.x, top: p.y, width: n.width, height: n.height, transform: `rotate(${p.rotation}deg)` }} />; })}
            {single && pos && !editing && <div className={`selection-outline ${isEffectivelyLocked(single, screen.nodes) ? 'selection-locked' : ''}`} style={{ left: pos.x, top: pos.y, width: single.width, height: single.height, transform: `rotate(${pos.rotation}deg)` }}><span className="selection-name" style={{ fontSize: 10 / z }}>{single.name}</span>{!isEffectivelyLocked(single, screen.nodes) && ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => <div key={h} className={`resize-handle handle-${h}`} style={{ width: 8 / z, height: 8 / z }} onPointerDown={e => resize(e, h)} />)}<span className="dimension-label" style={{ fontSize: 10 / z }}>{Math.round(single.width)} × {Math.round(single.height)}</span></div>}
            {marquee && <div className="marquee-selection" style={{ ...marquee, left: marquee.x, top: marquee.y, position: 'absolute', border: '1px solid var(--nk-ocean, #0891B2)', background: 'rgba(8,145,178,.12)', pointerEvents: 'none', zIndex: 30002 }} />}
            {guides.x !== undefined && <div className="snap-line vertical" style={{ left: guides.x }} />}{guides.y !== undefined && <div className="snap-line horizontal" style={{ top: guides.y }} />}
            {contentHeight > screen.height && <div aria-hidden="true" style={{ position: 'absolute', top: screen.height, left: 0, right: 0, borderTop: '1px dashed var(--nk-ocean, #0891B2)', pointerEvents: 'none', zIndex: 20000 }} />}
          </div>
          <div className="artboard-footnote"><Smartphone size={11} />{screen.device}<span>·</span>{screen.width > screen.height ? '横向き' : screen.width === screen.height ? '正方形' : '縦向き'}</div>
        </div>
      </div>
    </div>
    <div className="canvas-bottom"><div className="tool-dock"><button aria-label="選択ツール" title="選択 (V)・余白をドラッグして範囲選択" className={st.tool === 'select' ? 'active' : ''} onClick={() => useEditor.setState({ tool: 'select' })}><MousePointer2 size={17} /></button><button aria-label="手のひらツール" title="キャンバスを移動 (H / Space)" className={panning ? 'active' : ''} onClick={() => useEditor.setState({ tool: 'hand' })}><Hand size={17} /></button><i /><button aria-label="グリッド" title="8pxグリッド (Shift+G)" className={st.grid ? 'active' : ''} onClick={() => useEditor.setState({ grid: !st.grid })}><Grid2X2 size={17} /></button><button aria-label="スナップ" title="端・中央・他のパーツに位置を合わせる" className={st.snap ? 'active subtle' : ''} onClick={() => useEditor.setState({ snap: !st.snap })}><Magnet size={17} /></button></div><div className="zoom-dock"><button aria-label="縮小" onClick={() => setZoom(z - .1)}><Minus size={15} /></button><select aria-label="ズーム" value={z} onChange={e => setZoom(Number(e.target.value))}>{[...new Set([.15, .25, .5, .65, .8, 1, 1.25, 1.5, 2, z])].sort((a, b) => a - b).map(v => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}</select><button aria-label="拡大" onClick={() => setZoom(z + .1)}><Plus size={15} /></button><i /><button aria-label="画面に合わせる" title="表示範囲に合わせる" onClick={fit}><Maximize size={15} /></button></div></div>
    <div className="canvas-hint"><ArrowUpRight size={12} />余白をドラッグで範囲選択 · Spaceでキャンバスを移動</div>
  </main>;
}
