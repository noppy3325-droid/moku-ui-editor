import { Sparkles, Mail, Phone, Globe, ShoppingCart, CreditCard, ShieldCheck, Zap, Camera, Music, Video, Code2, LayoutDashboard, Send, MessageCircle, ArrowUpRight, CircleCheck, Clock, Briefcase, Palette, Coffee, Leaf, Sun, Moon, Cloud, Lock, Eye, Filter, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Bell, Bookmark, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Compass, Download, FileText, Heart, Home, Image, Info, MapPin, Menu, Minus, Plus, Search, Settings, Star, Upload, UserRound, Users, X } from 'lucide-react';
import type { Action, Screen, UINode } from './model';
import { appearanceCSS } from './appearance';

export const iconMap = { Image, ChevronRight, Sparkles, Mail, Phone, Globe, ShoppingCart, CreditCard, ShieldCheck, Zap, Camera, Music, Video, Code2, LayoutDashboard, Send, MessageCircle, ArrowUpRight, CircleCheck, Clock, Briefcase, Palette, Coffee, Leaf, Sun, Moon, Cloud, Lock, Eye, Filter, SlidersHorizontal, Heart, Home, Search, Star, UserRound, ArrowRight, ArrowLeft, Settings, Bell, MapPin, Bookmark, Menu, Compass, Check, CalendarDays, Download, Upload, FileText, Users, Info, CircleAlert, Plus, Minus, X };
export const iconNames = Object.keys(iconMap);
export function NodeIcon({ name, size = 20, strokeWidth = 1.7 }: { name: string; size?: number; strokeWidth?: number }) {
  const Icon = iconMap[name as keyof typeof iconMap] ?? Heart;
  return <Icon size={size} strokeWidth={strokeWidth} />;
}
export function nodeCSS(n: UINode): CSSProperties {
  return {
    position: 'absolute', left: n.x, top: n.y, width: n.width, height: n.height,
    transform: `rotate(${n.rotation}deg)`, zIndex: n.zIndex,
    background: n.styles.background, color: n.styles.color,
    border: `${n.styles.borderWidth}px solid ${n.styles.borderColor}`,
    borderRadius: n.type === 'ellipse' || n.type === 'avatar' ? '50%' : n.styles.radius,
    opacity: n.styles.opacity, boxShadow: n.styles.shadow ? '0 8px 28px #27342b16' : undefined,
    fontFamily: n.styles.fontFamily, fontSize: n.styles.fontSize, fontWeight: n.styles.fontWeight,
    lineHeight: n.styles.lineHeight, letterSpacing: n.styles.letterSpacing, textAlign: n.styles.textAlign,
    boxSizing: 'border-box', display: n.visible ? undefined : 'none', ...appearanceCSS(n),
  };
}
const options = (text: string) => text.split(/\r?\n|[,、]/).map(s => s.trim()).filter(Boolean);

function NodeContent({ node: n, interactive, editing, onText }: { node: UINode; interactive?: boolean; editing?: boolean; onText?: (text: string) => void }) {
  const [checked, setChecked] = useState(n.properties.checked);
  const [value, setValue] = useState(n.properties.value);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { setChecked(n.properties.checked); setValue(n.properties.value); setDismissed(false); }, [n.properties.checked, n.properties.value, interactive]);
  const disabled = n.properties.disabled;
  const lines = n.properties.text.split(/\r?\n/);
  const choices = options(n.properties.text);
  const stop = (e: MouseEvent) => e.stopPropagation();
  if (editing) return <textarea className="inline-text" aria-label="テキストを直接編集" autoFocus defaultValue={n.properties.text} onPointerDown={e => e.stopPropagation()} onBlur={e => onText?.(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') { e.currentTarget.value = n.properties.text; e.currentTarget.blur(); } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.blur(); }} />;
  if (dismissed && interactive) return null;
  switch (n.type) {
    case 'text': return <div className="node-text" style={{height:n.styles.autoHeight ? 'auto' : '100%'}}>{n.properties.text}</div>;
    case 'button': return <button type="button" className="node-button node-native-button" disabled={disabled} tabIndex={interactive ? 0 : -1}>{n.properties.text}</button>;
    case 'image': return n.properties.src ? <img className="node-image" style={{ objectFit: n.properties.fit }} src={n.properties.src} alt={n.properties.role || n.name} draggable={false} /> : <div className="node-placeholder"><Image size={30} /><span>画像を選択</span></div>;
    case 'icon': return <div className="node-center"><NodeIcon name={n.properties.icon} size={n.properties.iconSize || Math.max(12, Math.min(n.width, n.height) * .65)} strokeWidth={n.properties.iconStroke} /></div>;
    case 'input':
    case 'search': return <div className="node-input">{n.type === 'search' && <Search size={17} />}<input type={n.type === 'search' ? 'search' : 'text'} aria-label={n.name} placeholder={n.properties.text} readOnly={!interactive} disabled={disabled} tabIndex={interactive ? 0 : -1} onClick={stop} /></div>;
    case 'textarea': return <textarea className="node-textarea" aria-label={n.name} placeholder={n.properties.text} readOnly={!interactive} disabled={disabled} tabIndex={interactive ? 0 : -1} onClick={stop} />;
    case 'select': return <div className="node-select"><select aria-label={n.name} value={Math.max(0, Math.min(value, choices.length - 1))} disabled={disabled} tabIndex={interactive ? 0 : -1} onClick={stop} onChange={e => interactive && setValue(Number(e.target.value))}>{choices.map((choice, i) => <option key={i} value={i}>{choice}</option>)}</select><ChevronDown size={16} /></div>;
    case 'checkbox': return <label className="node-check" data-control="checkbox" onClick={stop}><input type="checkbox" aria-label={n.name} checked={checked} disabled={disabled} readOnly={!interactive} tabIndex={interactive ? 0 : -1} onChange={e => interactive && setChecked(e.target.checked)} /><span className="node-label">{n.properties.text}</span></label>;
    case 'switch': return <label className="node-check node-switch" data-control="switch" onClick={stop}><span className="node-label">{n.properties.text}</span><input className="node-switch-input" type="checkbox" role="switch" aria-label={n.name} checked={checked} aria-checked={checked} disabled={disabled} readOnly={!interactive} tabIndex={interactive ? 0 : -1} onChange={e => interactive && setChecked(e.target.checked)} /><span className={checked ? 'node-toggle on' : 'node-toggle'}><i /></span></label>;
    case 'radio': return <div className="node-radio" role="radiogroup" aria-label={n.name} data-control="radio" onClick={stop}>{choices.map((choice, i) => <label key={i}><input type="radio" name={n.id} value={i} aria-label={choice} checked={Math.max(0, Math.min(value, choices.length - 1)) === i} disabled={disabled} readOnly={!interactive} tabIndex={interactive ? 0 : -1} onChange={() => interactive && setValue(i)} /><span>{choice}</span></label>)}</div>;
    case 'slider': return <div className="node-slider" data-control="slider" onClick={stop}><div><span>{n.properties.text}</span><output className="node-slider-value">{value}</output></div><input aria-label={n.name} type="range" min="0" max="100" value={value} disabled={disabled} tabIndex={interactive ? 0 : -1} onChange={e => interactive && setValue(Number(e.target.value))} /></div>;
    case 'progress': return <div className="node-progress"><div><span>{n.properties.text}</span><strong>{n.properties.value}%</strong></div><div className="node-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={n.properties.value} aria-label={n.name}><i style={{ width: `${n.properties.value}%` }} /></div></div>;
    case 'badge': return <span className="node-badge">{n.properties.text}</span>;
    case 'chip': return <button type="button" className={`node-chip node-native-button ${checked ? 'selected' : ''}`} data-control="chip" aria-pressed={checked} disabled={disabled} tabIndex={interactive ? 0 : -1} onClick={e => { e.stopPropagation(); if (interactive) setChecked(!checked); }}>{checked && <Check size={14} />}<span>{n.properties.text}</span></button>;
    case 'avatar': return n.properties.src ? <img className="node-image" src={n.properties.src} alt={n.properties.role || n.properties.text || n.name} style={{ objectFit: n.properties.fit }} draggable={false} /> : <div className="node-avatar">{n.properties.text.slice(0, 3)}</div>;
    case 'rating': return <div className="node-rating" data-control="rating" aria-label={n.name} onClick={stop}>{Array.from({ length: 5 }, (_, i) => <button type="button" className="node-native-button" key={i} data-rating={i + 1} aria-label={`${i + 1}つ星`} aria-pressed={i < value} disabled={disabled} tabIndex={interactive ? 0 : -1} onClick={() => interactive && setValue(i + 1)}><Star size={Math.max(12, Math.min(n.height - 8, 26))} fill={i < value ? 'currentColor' : 'none'} /></button>)}</div>;
    case 'navbar': return <div className="node-nav"><ArrowLeft size={19} /><span>{n.properties.text}</span><Menu size={19} /></div>;
    case 'tabbar': return <div className="node-tabs" data-control="tabbar">{choices.map((choice, i) => <button type="button" key={i} className={`node-native-button ${i === value ? 'active' : ''}`} data-index={i} aria-current={i === value ? 'page' : undefined} disabled={disabled} tabIndex={interactive ? 0 : -1} onClick={() => interactive && setValue(i)}><NodeIcon name={['Home', 'Compass', 'Heart', 'UserRound', 'Settings'][i % 5]} size={20} /><span>{choice}</span></button>)}</div>;
    case 'breadcrumb': return <nav className="node-breadcrumb" aria-label={n.name}>{choices.map((choice, i) => <span key={i}>{i > 0 && <ChevronRight size={12} />}<span aria-current={i === choices.length - 1 ? 'page' : undefined}>{choice}</span></span>)}</nav>;
    case 'pagination': return <nav className="node-pagination" data-control="pagination" aria-label={n.name} onClick={stop}><button type="button" className="node-native-button" data-page-step="-1" aria-label="前のページ" disabled={disabled || value <= 0} tabIndex={interactive ? 0 : -1} onClick={() => interactive && setValue(Math.max(0, value - 1))}><ChevronLeft size={16} /></button>{choices.map((choice, i) => <button type="button" key={i} className={`node-native-button ${i === value ? 'active' : ''}`} data-index={i} aria-current={i === value ? 'page' : undefined} disabled={disabled} tabIndex={interactive ? 0 : -1} onClick={() => interactive && setValue(i)}>{choice}</button>)}<button type="button" className="node-native-button" data-page-step="1" aria-label="次のページ" disabled={disabled || value >= choices.length - 1} tabIndex={interactive ? 0 : -1} onClick={() => interactive && setValue(Math.min(choices.length - 1, value + 1))}><ChevronRight size={16} /></button></nav>;
    case 'tabs': return <div className="node-segmented" role="tablist" data-control="tabs" aria-label={n.name} onClick={stop}>{choices.map((choice, i) => <button type="button" key={i} role="tab" className={`node-native-button ${i === value ? 'active' : ''}`} data-index={i} aria-selected={i === value} disabled={disabled} tabIndex={interactive ? 0 : -1} onClick={() => interactive && setValue(i)}>{choice}</button>)}</div>;
    case 'list': return <div className="node-list-item"><div><strong>{lines[0]}</strong>{lines.length > 1 && <span>{lines.slice(1).join('\n')}</span>}</div><ChevronRight size={17} /></div>;
    case 'card': return <div className="node-card"><div className="card-illustration"><Image size={27} /></div><strong>{lines[0]}</strong>{lines.length > 1 && <span>{lines.slice(1).join('\n')}</span>}</div>;
    case 'alert': return <div className={`node-alert tone-${n.properties.tone}`} role="status"><NodeIcon name={n.properties.tone === 'error' || n.properties.tone === 'warning' ? 'CircleAlert' : n.properties.tone === 'info' ? 'Info' : n.properties.icon} size={20} /><div><strong>{lines[0]}</strong>{lines.length > 1 && <p>{lines.slice(1).join('\n')}</p>}</div></div>;
    case 'toast': return <div className="node-toast" role="status"><NodeIcon name={n.properties.icon} size={19} /><span>{n.properties.text}</span><button type="button" className="node-native-button" data-dismiss="true" aria-label="通知を閉じる" tabIndex={interactive ? 0 : -1} onClick={e => { e.stopPropagation(); if (interactive) setDismissed(true); }}><X size={16} /></button></div>;
    case 'tooltip': return <div className="node-tooltip" role="tooltip">{n.properties.text}</div>;
    case 'accordion': return <details className="node-accordion" data-control="accordion" open={checked} onClick={stop} onToggle={e => { if (interactive) setChecked(e.currentTarget.open); }}><summary>{lines[0]}<ChevronDown size={16} /></summary><div>{lines.slice(1).join('\n') || '説明を入力してください。'}</div></details>;
    case 'table': { const rows = lines.filter(Boolean).map(line => line.split('|').map(cell => cell.trim())); return <div className="node-table-wrap"><table className="node-table" aria-label={n.name}><thead><tr>{rows[0]?.map((cell, i) => <th key={i} scope="col">{cell}</th>)}</tr></thead><tbody>{rows.slice(1).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>; }
    case 'sidebar': return <nav className="node-side-menu" data-control="sidebar" aria-label={n.name} onClick={stop}><strong>{lines[0]}</strong>{lines.slice(1).filter(Boolean).map((choice, i) => <button type="button" className={`node-native-button ${i === value ? 'active' : ''}`} key={i} data-index={i} aria-current={i === value ? 'page' : undefined} disabled={disabled} tabIndex={interactive ? 0 : -1} onClick={() => interactive && setValue(i)}><NodeIcon name={['Home', 'Bookmark', 'Users', 'Settings'][i % 4]} size={16} /><span>{choice}</span></button>)}</nav>;
    case 'dialog': return <div className="node-dialog"><div><strong>{lines[0]}</strong><button type="button" className="node-native-button" data-dismiss="true" aria-label="ダイアログを閉じる" tabIndex={interactive ? 0 : -1} onClick={e => { e.stopPropagation(); if (interactive) setDismissed(true); }}><X size={18} /></button></div><p>{lines.slice(1).join('\n')}</p><footer><button type="button" className="node-native-button" data-dismiss="true" tabIndex={interactive ? 0 : -1} onClick={e => { e.stopPropagation(); if (interactive) setDismissed(true); }}>キャンセル</button><button type="button" className="node-native-button" tabIndex={interactive ? 0 : -1}>保存する</button></footer></div>;
    case 'stat': return <div className="node-stat"><span>{lines[0]}</span><strong>{lines[1] || '0'}</strong><small>{lines.slice(2).join('\n')}</small></div>;
    case 'skeleton': return <div className="node-skeleton" aria-label={n.properties.text} role="status"><div /><span /><span /><span /></div>;
    case 'upload': return <div className="node-upload"><Upload size={25} /><strong>{lines[0]}</strong><span>{lines.slice(1).join('\n')}</span></div>;
    case 'stepper': return <div className="node-stepper" data-control="stepper" onClick={stop}><button type="button" className="node-native-button" data-step="-1" disabled={disabled || value <= 0} aria-label={`${n.name}を減らす`} tabIndex={interactive ? 0 : -1} onClick={() => interactive && setValue(Math.max(0, value - 1))}><Minus size={16} /></button><output aria-label={n.name}>{value}</output><button type="button" className="node-native-button" data-step="1" disabled={disabled || value >= 100} aria-label={`${n.name}を増やす`} tabIndex={interactive ? 0 : -1} onClick={() => interactive && setValue(Math.min(100, value + 1))}><Plus size={16} /></button></div>;
    default: return null;
  }
}

type RenderProps = {
  screen: Screen; interactive?: boolean; selected?: string[]; editingId?: string | null;
  onPointerDown?: (e: ReactPointerEvent, n: UINode) => void; onDoubleClick?: (n: UINode) => void;
  onText?: (id: string, text: string) => void; onAction?: (action: Action) => void;
  showFrame?: boolean; scrollOffset?: number;
};
export function ScreenRenderer({ screen, interactive, selected = [], editingId, onPointerDown, onDoubleClick, onText, onAction, scrollOffset = 0 }: RenderProps) {
  const byParent = new Map<string | null, UINode[]>();
  for (const node of screen.nodes) { const children = byParent.get(node.parentId) ?? []; children.push(node); byParent.set(node.parentId, children); }
  const render = (parentId: string | null): ReactNode => (byParent.get(parentId) ?? []).toSorted((a, b) => a.zIndex - b.zIndex).map(n => {
    const action = n.actions.find(a => a.type !== 'none');
    const keyboardAction = Boolean(interactive && action && !n.properties.disabled && !['button','input','search','textarea','select','checkbox','switch','radio','slider','chip','rating','pagination','tabs','tabbar','sidebar','stepper','accordion','dialog','toast'].includes(n.type));
    const css = nodeCSS(n);
    if (interactive && n.properties.fixed !== 'none' && !n.parentId) { css.top = n.y + scrollOffset; css.zIndex = 9999; }
    return <div key={n.id} className={`ui-node ${selected.includes(n.id) ? 'is-selected' : ''} ${interactive && action ? 'has-action' : ''} ${n.locked ? 'locked-node' : ''} ${n.properties.disabled ? 'node-disabled' : ''}`} data-node-id={n.id} data-node-name={n.name} data-node-type={n.type} data-fixed={n.properties.fixed} data-value={n.properties.value} data-tone={n.properties.tone} data-checked={n.properties.checked} style={css}
      role={keyboardAction ? 'button' : undefined} tabIndex={keyboardAction ? 0 : undefined} aria-label={keyboardAction ? n.name : undefined}
      onKeyDown={e => { if (keyboardAction && action && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAction?.(action); } }}
      onPointerDown={e => onPointerDown?.(e, n)}
      onDoubleClick={e => { if (!interactive) { e.stopPropagation(); onDoubleClick?.(n); } }}
      onClick={e => { if (interactive && action && !n.properties.disabled) { e.stopPropagation(); onAction?.(action); } }}>
      <NodeContent node={n} interactive={interactive} editing={editingId === n.id} onText={text => onText?.(n.id, text)} />
      {render(n.id)}
    </div>;
  });
  const raw=screen.background.replace('#',''),hex=raw.length<=4?raw.slice(0,3).split('').map(c=>c+c).join(''):raw.slice(0,6);
  const rgb=[0,2,4].map(i=>Number.isFinite(parseInt(hex.slice(i,i+2),16))?parseInt(hex.slice(i,i+2),16):255);
  const ink=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)<140?'#ffffff':'#302d28';
  return <div className={`screen-renderer ${interactive ? 'interactive-screen' : ''}`} style={{ width: screen.width, minHeight: screen.height, height: Math.max(screen.height, screen.viewportSettings.scrollHeight), background: screen.background, '--device-ink':ink } as CSSProperties}>
    {screen.viewportSettings.statusBar && <div className="status-bar"><b>9:41</b><div className="status-icons"><svg viewBox="0 0 17 12" width="17" height="12"><path d="M1 8v3h2V8zM5 6v5h2V6zM9 3v8h2V3zM13 0v11h2V0z" fill="currentColor" /></svg><svg width="16" height="12" viewBox="0 0 16 12"><path d="M1 3Q8-3 15 3M3.5 6q4.5-4 9 0M6 8.5q2-2 4 0" stroke="currentColor" fill="none" strokeWidth="1.6" /><circle cx="8" cy="11" r="1" fill="currentColor" /></svg><span className="battery" /></div></div>}
    {render(null)}
    {screen.viewportSettings.safeArea && <div className="home-indicator" style={{ top: screen.height - 11 }} />}
  </div>;
}
