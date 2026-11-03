import { installFonts } from './fonts';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Code2, Component, Download, FolderOpen, HardDrive, HelpCircle, Layers3, LoaderCircle, Play, Redo2, RefreshCw, Save, Settings2, Smartphone, Undo2, Upload, Wifi, WifiOff, X } from 'lucide-react';
import { initialize, persistNow, useEditor } from './store';
import { parseProject, warnings } from './model';
import { Sidebar } from './Sidebar';
import { Inspector } from './Inspector';
import { Canvas } from './Canvas';
import { applyOfflineUpdate, useOffline } from './offline';
import { DialogSkeleton, EditorSkeleton } from './Skeleton';

const ExportDialog = lazy(() => import('./Dialogs').then(m => ({ default: m.ExportDialog })));
const FlowDialog = lazy(() => import('./Dialogs').then(m => ({ default: m.FlowDialog })));
const HelpDialog = lazy(() => import('./Dialogs').then(m => ({ default: m.HelpDialog })));
const PreviewDialog = lazy(() => import('./Dialogs').then(m => ({ default: m.PreviewDialog })));
const ProjectsDialog = lazy(() => import('./Dialogs').then(m => ({ default: m.ProjectsDialog })));
const DeviceDialog = lazy(() => import('./DeviceDialog').then(m => ({ default: m.DeviceDialog })));
type Dialog = 'preview' | 'export' | 'code' | 'projects' | 'flow' | 'help' | 'devices' | 'backup' | null;

function ProjectName() {
  const name = useEditor(s => s.project.name), update = useEditor(s => s.update);
  const [draft, setDraft] = useState(name); const cancelled = useRef(false);
  useEffect(() => setDraft(name), [name]);
  function commit() { if (cancelled.current) { cancelled.current = false; setDraft(name); return; } const next = draft.trim().slice(0, 200) || '無題のプロジェクト'; if (next !== name) update(p => { p.name = next; }); setDraft(next); }
  return <input aria-label="プロジェクト名" title={name} maxLength={200} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur(); } }} />;
}

export default function App() {
  const st = useEditor(), offline = useOffline();
  useEffect(() => { installFonts(st.project); }, [st.project.fonts]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [projectMenu, setProjectMenu] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'library' | 'inspector' | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const screen = st.project.screens.find(s => s.id === st.screenId) ?? st.project.screens[0];
  const issues = warnings(st.project);
  const open = (value: Dialog) => { setProjectMenu(false); setMobilePanel(null); setDialog(value); };
  useEffect(() => { initialize(); }, []);
  useEffect(() => { if (!st.toast) return; const timer = setTimeout(() => useEditor.setState({ toast: '' }), 5500); return () => clearTimeout(timer); }, [st.toast]);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (dialog || event.isComposing) return;
      const target = event.target as HTMLElement, cmd = event.ctrlKey || event.metaKey, key = event.key.toLowerCase(), s = useEditor.getState();
      if (cmd && key === 's') { event.preventDefault(); target.blur?.(); queueMicrotask(() => persistNow().then(() => s.notify('この端末に保存しました')).catch(() => s.notify('保存できませんでした。JSONでバックアップしてください。'))); return; }
      if (target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (cmd && key === 'enter') { event.preventDefault(); open('preview'); return; }
      if (cmd && event.shiftKey && key === 'e') { event.preventDefault(); open('export'); return; }
      if (cmd && ['z', 'y', 'c', 'v', 'd', 'a', 'g', 'k'].includes(key)) {
        event.preventDefault();
        if (key === 'z') event.shiftKey ? s.redo() : s.undo();
        if (key === 'y') s.redo();
        if (key === 'c' && s.selected.length) { s.copy(); s.notify('選択したパーツをコピーしました'); }
        if (key === 'v') s.paste();
        if (key === 'd') s.duplicate();
        if (key === 'a') s.select(s.project.screens.find(sc => sc.id === s.screenId)!.nodes.filter(n => !n.locked && n.visible).map(n => n.id));
        if (key === 'g') event.shiftKey ? s.ungroup() : s.group();
        if (key === 'k') { if (window.innerWidth <= 1000) setMobilePanel('library'); requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[aria-label="パーツを検索"]')?.focus()); }
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); if (s.selected.length) s.removeNodes(); }
      if (event.key === 'Escape') { s.select([]); setProjectMenu(false); setMobilePanel(null); }
      if (key === 'v') useEditor.setState({ tool: 'select' });
      if (key === 'h') useEditor.setState({ tool: 'hand' });
      if (key === 'g' && event.shiftKey) useEditor.setState({ grid: !s.grid });
      if (event.key.startsWith('Arrow') && s.selected.length) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; s.moveSelected(event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0); }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [dialog]);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (useEditor.getState().saveStatus !== 'saved') { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload); }, []);
  async function importProject(file?: File) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { st.notify('JSONファイルは50MB以内にしてください'); return; }
    try { const p = parseProject(JSON.parse(await file.text())); await persistNow(); st.loadProject(p); open(null); st.notify(`${p.name}を読み込みました`); }
    catch { st.notify('JSONを読み込めませんでした。ファイルの形式と空き容量を確認してください。'); }
  }
  async function saveNow() { try { await persistNow(); st.notify('この端末に保存しました'); } catch { st.notify('保存できませんでした。JSONでバックアップしてください。'); } }
  async function installUpdate() { try { await persistNow(); applyOfflineUpdate(); } catch { st.notify('更新の前に、編集内容をJSONでバックアップしてください。'); } }
  if (!st.loaded) return <EditorSkeleton />;
  return <div className={`app-shell ${mobilePanel ? 'mobile-' + mobilePanel : ''}`}>
    <header className="app-header">
      <a className="brand" href="#" onClick={event => { event.preventDefault(); open('projects'); }} aria-label="moku プロジェクト"><span className="brand-symbol" aria-hidden="true"><svg width="25" height="24" viewBox="0 0 28 24"><path d="M3 21V9a4 4 0 0 1 8 0v12m0-11a4 4 0 0 1 8 0v11m0-9a4 4 0 0 1 8 0v9" fill="none" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round" /></svg></span><span>moku<span className="brand-period">.</span></span><small>STUDIO</small></a>
      <span className="header-divider" />
      <div className="project-name"><ProjectName /><button className="tiny-button" aria-label="プロジェクトメニュー" aria-expanded={projectMenu} onClick={() => setProjectMenu(!projectMenu)}><ChevronDown size={15} /></button>{projectMenu && <><button className="menu-backdrop" aria-label="メニューを閉じる" onClick={() => setProjectMenu(false)} /><div className="context-menu project-context"><button onClick={() => open('projects')}><FolderOpen size={15} />プロジェクトを開く・作成</button><button onClick={() => { importRef.current?.click(); setProjectMenu(false); }}><Upload size={15} />JSONを読み込む</button><button onClick={() => { saveNow(); setProjectMenu(false); }}><Save size={15} />今すぐ保存</button><button onClick={() => open('backup')}><Download size={15} />JSONでバックアップ</button></div></>}</div>
      <div className={`save-status ${st.saveStatus === 'error' ? 'save-error' : ''}`} aria-live="polite" title="編集内容はこのブラウザーの端末内に保存します">{st.saveStatus === 'saving' ? <LoaderCircle size={14} className="spinning" /> : st.saveStatus === 'error' ? <AlertTriangle size={15} /> : <Check size={15} />}<span>{st.saveStatus === 'saved' ? '端末に保存済み' : st.saveStatus === 'saving' ? '保存中' : '保存できません'}</span></div>
      <div className="header-spacer" />
      <div className="history-buttons"><button className="icon-button" disabled={!st.past.length} aria-label="元に戻す" title="元に戻す (Ctrl / ⌘ + Z)" onClick={st.undo}><Undo2 size={18} /></button><button className="icon-button" disabled={!st.future.length} aria-label="やり直す" title="やり直す (Ctrl / ⌘ + Shift + Z)" onClick={st.redo}><Redo2 size={18} /></button></div>
      <button className="device-control" aria-label="画面サイズを選択" title={`${screen.device} · ${screen.width} × ${screen.height}`} onClick={() => open('devices')}><Smartphone size={16} /><span>{screen.device}</span><ChevronDown size={13} /></button>
      <span className="header-divider action-divider" /><button aria-label="AIに渡す" className="header-code" onClick={() => open('code')}><Code2 size={17} /><span>AIに渡す</span></button><button aria-label="プレビュー" className="preview-button" onClick={() => open('preview')}><Play size={14} fill="currentColor" /><span>プレビュー</span></button><button aria-label="エクスポート" className="primary-button export-button" onClick={() => open('export')}><Download size={16} /><span>書き出す</span></button>
    </header>
    <div className="workspace-strip"><div><span className="workspace-eyebrow">WORKSPACE</span><span className="workspace-separator">/</span><span>UIモックアップ</span><span className="design-system-tag">NomadKit</span></div><div className="workspace-strip-actions"><button onClick={() => open('flow')}><Layers3 size={14} />画面フロー<span>{st.project.screens.length}</span></button><span className={`connection-status ${!offline.online ? 'is-offline' : ''}`} title={offline.ready ? 'アプリのオフライン利用準備ができています' : '初回はオンラインで開いてください'}>{offline.online ? <Wifi size={13} /> : <WifiOff size={13} />}<span>{!offline.online ? 'オフラインで編集中' : offline.ready ? 'オフライン利用可' : 'ローカルで編集'}</span></span></div></div>
    <div className="mobile-toolbar"><button className={mobilePanel === 'library' ? 'active' : ''} aria-expanded={mobilePanel === 'library'} onClick={() => setMobilePanel(mobilePanel === 'library' ? null : 'library')}><Component size={15} />画面・パーツ</button><span>{screen.name}</span><button className={mobilePanel === 'inspector' ? 'active' : ''} aria-expanded={mobilePanel === 'inspector'} onClick={() => setMobilePanel(mobilePanel === 'inspector' ? null : 'inspector')}><Settings2 size={15} />設定</button></div>
    {mobilePanel && <button className="mobile-backdrop" aria-label="パネルを閉じる" onClick={() => setMobilePanel(null)} />}
    {st.saveStatus === 'error' && <div className="save-error-banner" role="alert"><AlertTriangle size={16} /><span>編集内容を保存できていません。ファイルにバックアップしてください。</span><button onClick={saveNow}>再試行</button><button onClick={() => open('backup')}>JSONを保存</button></div>}
    <div className="editor-layout"><Sidebar onProjects={() => open('projects')} onHelp={() => open('help')} onFlow={() => open('flow')} /><Canvas /><Inspector /></div>
    <footer className="app-statusbar"><div><HardDrive size={12} /><span>端末内に保存</span><span className="statusbar-divider">·</span><span className="storage-description">クラウドへの自動送信はありません</span></div><div><span className="selected-count">{st.selected.length ? `${st.selected.length}個を選択` : `${screen.nodes.length} パーツ`}</span>{issues.length > 0 && <button className="warning-button" onClick={() => open('flow')}><AlertTriangle size={12} />リンクを確認 ({issues.length})</button>}<button onClick={() => open('help')}><HelpCircle size={13} />操作ガイド</button><span className="version-label">3.0</span></div></footer>
    <input type="file" accept="application/json,.json" ref={importRef} className="sr-only" onChange={event => { importProject(event.target.files?.[0]); event.target.value = ''; }} />
    <Suspense fallback={<DialogSkeleton />}>
      {dialog === 'preview' && <PreviewDialog onClose={() => setDialog(null)} />}
      {(dialog === 'export' || dialog === 'code' || dialog === 'backup') && <ExportDialog codeMode={dialog === 'code'} initialFormat={dialog === 'backup' ? 'json' : undefined} onClose={() => setDialog(null)} />}
      {dialog === 'projects' && <ProjectsDialog onClose={() => setDialog(null)} onImport={() => importRef.current?.click()} />}
      {dialog === 'flow' && <FlowDialog onClose={() => setDialog(null)} />}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === 'devices' && <DeviceDialog onClose={() => setDialog(null)} />}
    </Suspense>
    {offline.available && <div className="update-notice" role="status"><RefreshCw size={16} /><span>新しいバージョンを利用できます</span><button onClick={installUpdate}>保存して更新</button></div>}
    {st.toast && <div className="toast" role="status"><span>{st.toast}</span><button className="tiny-button" aria-label="通知を閉じる" onClick={() => useEditor.setState({ toast: '' })}><X size={15} /></button></div>}
  </div>;
}
