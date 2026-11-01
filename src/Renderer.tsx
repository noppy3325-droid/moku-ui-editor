import { useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Bell, Bookmark, Check, ChevronRight, Compass, Heart, Home, Image, MapPin, Menu, Search, Settings, Star, UserRound } from 'lucide-react';
import type { Action, Screen, UINode } from './model';

export const iconMap = { Heart, Home, Search, Star, UserRound, ArrowRight, ArrowLeft, Settings, Bell, MapPin, Bookmark, Menu, Compass, Check };
export const iconNames = Object.keys(iconMap);
export function NodeIcon({ name, size = 20 }: { name: string; size?: number }) { const Icon = iconMap[name as keyof typeof iconMap] ?? Heart; return <Icon size={size} strokeWidth={1.7} />; }
export function nodeCSS(n: UINode): CSSProperties { return { position: 'absolute', left: n.x, top: n.y, width: n.width, height: n.height, transform: `rotate(${n.rotation}deg)`, zIndex: n.zIndex, background: n.styles.background, color: n.styles.color, border: `${n.styles.borderWidth}px solid ${n.styles.borderColor}`, borderRadius: n.type === 'ellipse' ? '50%' : n.styles.radius, opacity: n.styles.opacity, boxShadow: n.styles.shadow ? '0 6px 24px #1c332418' : undefined, fontFamily: n.styles.fontFamily, fontSize: n.styles.fontSize, fontWeight: n.styles.fontWeight, lineHeight: n.styles.lineHeight, letterSpacing: n.styles.letterSpacing, textAlign: n.styles.textAlign, boxSizing: 'border-box', display: n.visible ? undefined : 'none' }; }

function NodeContent({ node: n, interactive, editing, onText }: { node: UINode; interactive?: boolean; editing?: boolean; onText?: (text: string) => void }) {
  const [checked, setChecked] = useState(n.properties.checked);
  if (editing) return <textarea className="inline-text" aria-label="テキストを直接編集" autoFocus defaultValue={n.properties.text} onPointerDown={e => e.stopPropagation()} onBlur={e => onText?.(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) e.currentTarget.blur(); }} />;
  switch (n.type) {
    case 'text': return <div className="node-text">{n.properties.text}</div>;
    case 'button': return <div className="node-button">{n.properties.text}</div>;
    case 'image': return n.properties.src ? <img className="node-image" src={n.properties.src} alt={n.properties.role || n.name} draggable={false} /> : <div className="node-placeholder"><Image size={30} /><span>画像を選択</span></div>;
    case 'icon': return <div className="node-center"><NodeIcon name={n.properties.icon} size={Math.max(12, Math.min(n.width, n.height) * .65)} /></div>;
    case 'input': return <div className="node-input"><Search size={17} />{interactive ? <input aria-label={n.name} placeholder={n.properties.text} onClick={e => e.stopPropagation()} /> : <span>{n.properties.text}</span>}</div>;
    case 'checkbox': return <div className="node-check" onClick={() => interactive && setChecked(!checked)}><span className={checked ? 'check-box checked' : 'check-box'}>{checked && <Check size={13} />}</span>{n.properties.text}</div>;
    case 'switch': return <div className="node-check" onClick={() => interactive && setChecked(!checked)}><span>{n.properties.text}</span><span className={checked ? 'node-toggle on' : 'node-toggle'}><i /></span></div>;
    case 'navbar': return <div className="node-nav"><ArrowLeft size={19} /><span>{n.properties.text}</span><Menu size={19} /></div>;
    case 'tabbar': return <div className="node-tabs">{n.properties.text.split(/[,、]/).map((s, i) => <div key={i} style={{ color: i === 0 ? '#237d68' : '#9a9e92' }}><NodeIcon name={['Home', 'Compass', 'Heart'][i % 3]} size={20} /><span>{s}</span></div>)}</div>;
    case 'list': return <div className="node-nav"><span>{n.properties.text}</span><ChevronRight size={18} /></div>;
    case 'card': return <div className="node-card"><div className="card-illustration"><Image size={25} /></div><strong>{n.properties.text}</strong></div>;
    default: return null;
  }
}

type RenderProps = { screen: Screen; interactive?: boolean; selected?: string[]; editingId?: string | null; onPointerDown?: (e: ReactPointerEvent, n: UINode) => void; onDoubleClick?: (n: UINode) => void; onText?: (id: string, text: string) => void; onAction?: (action: Action) => void; showFrame?: boolean; scrollOffset?: number };
export function ScreenRenderer({ screen, interactive, selected = [], editingId, onPointerDown, onDoubleClick, onText, onAction, scrollOffset = 0 }: RenderProps) {
  const render = (parentId: string | null) => screen.nodes.filter(n => n.parentId === parentId).toSorted((a, b) => a.zIndex - b.zIndex).map(n => {
    const action = n.actions.find(a => a.type !== 'none');
    const css = nodeCSS(n);
    if (interactive && n.properties.fixed !== 'none' && !n.parentId) { css.top = n.y + scrollOffset; css.zIndex = 9999; }
    return <div key={n.id} className={`ui-node ${selected.includes(n.id) ? 'is-selected' : ''} ${interactive && action ? 'has-action' : ''} ${n.locked ? 'locked-node' : ''}`} data-node-id={n.id} data-node-name={n.name} data-fixed={n.properties.fixed} style={css} onPointerDown={e => onPointerDown?.(e, n)} onDoubleClick={e => { if (!interactive) { e.stopPropagation(); onDoubleClick?.(n); } }} onClick={e => { if (interactive && action) { e.stopPropagation(); onAction?.(action); } }}>
      <NodeContent node={n} interactive={interactive} editing={editingId === n.id} onText={text => onText?.(n.id, text)} />
      {render(n.id)}
    </div>;
  });
  return <div className={`screen-renderer ${interactive ? 'interactive-screen' : ''}`} style={{ width: screen.width, minHeight: screen.height, height: Math.max(screen.height, screen.viewportSettings.scrollHeight), background: screen.background }}>
    {screen.viewportSettings.statusBar && <div className="status-bar"><b>9:41</b><div className="status-icons"><svg viewBox="0 0 17 12" width="17" height="12"><path d="M1 8v3h2V8zM5 6v5h2V6zM9 3v8h2V3zM13 0v11h2V0z" fill="currentColor" /></svg><svg width="16" height="12" viewBox="0 0 16 12"><path d="M1 3Q8-3 15 3M3.5 6q4.5-4 9 0M6 8.5q2-2 4 0" stroke="currentColor" fill="none" strokeWidth="1.6" /><circle cx="8" cy="11" r="1" fill="currentColor" /></svg><span className="battery" /></div></div>}
    {render(null)}
    {screen.viewportSettings.safeArea && <div className="home-indicator" style={{ top: screen.height - 11 }} />}
  </div>;
}
