import { create } from 'zustand';
import Dexie, { type Table } from 'dexie';
import { clone, createProject, newNode, newScreen, nodeTypes, parseProject, uid } from './model';
import type { NodeType, Project, Screen, UINode } from './model';
import { clampZoom, deepEqual, editableRoots, isEffectivelyLocked, localDelta, reflowScreen, worldGeometry } from './editor-geometry';
import { createSaveQueue } from './save-queue';

const db = new Dexie('moku-studio');
db.version(1).stores({ projects: 'id, updatedAt', session: 'key' });
const projects = db.table('projects') as Table<Project>;
const session = db.table('session') as Table<{ key: string; value: string }>;
type ViewState = { screenId: string; selected: string[]; zoom: number; grid: boolean; snap: boolean };
type Editor = {
  project: Project; screenId: string; selected: string[]; past: Project[]; future: Project[];
  zoom: number; grid: boolean; snap: boolean; tool: 'select' | 'hand'; clipboard: UINode[];
  saveStatus: 'saved' | 'saving' | 'error'; loaded: boolean; viewRestored: boolean; toast: string;
  update: (fn: (p: Project) => void, history?: boolean) => void;
  checkpoint: () => void; undo: () => void; redo: () => void;
  select: (ids: string[]) => void; setScreen: (id: string) => void;
  patchNodes: (ids: string[], patch: Partial<UINode>, history?: boolean) => void;
  patchStyles: (ids: string[], patch: Partial<UINode['styles']>) => void;
  patchProperties: (ids: string[], patch: Partial<UINode['properties']>) => void;
  addNode: (type: NodeType, x?: number, y?: number) => void;
  moveSelected: (dx: number, dy: number) => void; removeNodes: () => void;
  duplicate: () => void; copy: () => void; paste: () => void;
  group: () => void; ungroup: () => void; arrange: (mode: string) => void;
  distribute: (axis: 'horizontal' | 'vertical') => void; reorder: (front: boolean) => void;
  addScreen: () => void; duplicateScreen: () => void; deleteScreen: (id: string) => void;
  patchScreen: (patch: Partial<Screen>) => void; loadProject: (p: Project) => void;
  notify: (message: string) => void;
};
const initial = createProject();
const currentScreen = (s: Pick<Editor, 'project' | 'screenId'>) => s.project.screens.find(sc => sc.id === s.screenId) ?? s.project.screens[0];
const bounded = (value: number, min = -20000, max = 20000) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const normalizeDocument = (p: Project) => p.screens.forEach(sc => {
  sc.nodes.forEach(n => { n.x = bounded(n.x); n.y = bounded(n.y); n.width = bounded(n.width, 1, 10000); n.height = bounded(n.height, 1, 10000); n.rotation = bounded(n.rotation, -360, 360); });
  reflowScreen(sc);
});
const validSelection = (p: Project, screenId: string, ids: string[]) => {
  const sc = p.screens.find(s => s.id === screenId) ?? p.screens[0];
  return [...new Set(ids)].filter(id => sc.nodes.some(n => n.id === id));
};

export const useEditor = create<Editor>((set, get) => ({
  project: initial, screenId: initial.screens[0].id, selected: [], past: [], future: [], zoom: .8,
  grid: false, snap: true, tool: 'select', clipboard: [], saveStatus: 'saved', loaded: false, viewRestored: false, toast: '',
  update: (fn, history = true) => {
    const st = get(), p = clone(st.project);
    fn(p); normalizeDocument(p);
    if (deepEqual(p, st.project)) return;
    p.updatedAt = new Date().toISOString();
    const screenId = p.screens.some(sc => sc.id === st.screenId) ? st.screenId : p.screens[0].id;
    set({ project: p, screenId, selected: validSelection(p, screenId, st.selected), past: history ? [...st.past.slice(-59), st.project] : st.past, future: history ? [] : st.future, saveStatus: 'saving' });
  },
  checkpoint: () => set(s => ({ past: [...s.past.slice(-59), clone(s.project)], future: [] })),
  undo: () => {
    const s = get(); if (!s.past.length) return;
    const p = s.past.at(-1)!, screenId = p.screens.some(v => v.id === s.screenId) ? s.screenId : p.screens[0].id;
    set({ project: p, past: s.past.slice(0, -1), future: [s.project, ...s.future], selected: validSelection(p, screenId, s.selected), screenId, saveStatus: 'saving' });
  },
  redo: () => {
    const s = get(); if (!s.future.length) return;
    const p = s.future[0], screenId = p.screens.some(v => v.id === s.screenId) ? s.screenId : p.screens[0].id;
    set({ project: p, past: [...s.past.slice(-59), s.project], future: s.future.slice(1), selected: validSelection(p, screenId, s.selected), screenId, saveStatus: 'saving' });
  },
  select: ids => set(s => ({ selected: validSelection(s.project, s.screenId, ids) })),
  setScreen: id => { if (get().project.screens.some(s => s.id === id)) set({ screenId: id, selected: [] }); },
  patchNodes: (ids, patch, history = true) => {
    if (!ids.length) return;
    get().update(p => {
      const sc = currentScreen({ project: p, screenId: get().screenId });
      sc.nodes.forEach(n => {
        if (!ids.includes(n.id)) return;
        const parent = sc.nodes.find(p => p.id === n.parentId);
        const canUnlock = patch.locked !== undefined && (!parent || !isEffectivelyLocked(parent, sc.nodes));
        if (!isEffectivelyLocked(n, sc.nodes) || canUnlock) Object.assign(n, patch);
      });
    }, history);
  },
  patchStyles: (ids, patch) => get().update(p => {
    const sc = currentScreen({ project: p, screenId: get().screenId });
    sc.nodes.forEach(n => { if (ids.includes(n.id) && !isEffectivelyLocked(n, sc.nodes)) Object.assign(n.styles, patch); });
  }),
  patchProperties: (ids, patch) => get().update(p => {
    const sc = currentScreen({ project: p, screenId: get().screenId });
    sc.nodes.forEach(n => { if (ids.includes(n.id) && !isEffectivelyLocked(n, sc.nodes)) Object.assign(n.properties, patch); });
  }),
  addNode: (type, x, y) => {
    if (!nodeTypes.includes(type)) return;
    const sc = currentScreen(get()); if (sc.nodes.length >= 2000) { get().notify("1画面に追加できるパーツは2000個までです"); return; } const n = newNode(type, x, y), canvasHeight = Math.max(sc.height, sc.viewportSettings.scrollHeight);
    n.width = Math.min(n.width, sc.width); n.height = Math.min(n.height, canvasHeight);
    n.x = bounded(n.x, 0, Math.max(0, sc.width - n.width)); n.y = bounded(n.y, 0, Math.max(0, canvasHeight - n.height));
    n.zIndex = Math.max(0, ...sc.nodes.map(n => n.zIndex)) + 1;
    get().update(p => currentScreen({ project: p, screenId: get().screenId }).nodes.push(n));
    set({ selected: [n.id], tool: 'select' });
  },
  moveSelected: (dx, dy) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return;
    const st = get(), sc = currentScreen(st), ids = new Set(editableRoots(sc.nodes, st.selected).map(n => n.id));
    if (!ids.size) return;
    get().update(p => { const s = currentScreen({ project: p, screenId: st.screenId }); s.nodes.forEach(n => { if (ids.has(n.id)) { const d = localDelta(n, s.nodes, dx, dy); n.x += d.x; n.y += d.y; } }); });
  },
  removeNodes: () => {
    const st = get(), sc = currentScreen(st), ids = new Set(editableRoots(sc.nodes, st.selected).map(n => n.id));
    if (!ids.size) { if (st.selected.length) get().notify('ロックを解除すると削除できます'); return; }
    let last = -1;
    while (last !== ids.size) { last = ids.size; sc.nodes.forEach(n => { if (n.parentId && ids.has(n.parentId)) ids.add(n.id); }); }
    get().update(p => { const s = currentScreen({ project: p, screenId: st.screenId }); s.nodes = s.nodes.filter(n => !ids.has(n.id)); });
    set({ selected: st.selected.filter(id => !ids.has(id)) });
  },
  copy: () => {
    const st = get(), sc = currentScreen(st), ids = new Set(st.selected);
    let last = -1;
    while (last !== ids.size) { last = ids.size; sc.nodes.forEach(n => { if (n.parentId && ids.has(n.parentId)) ids.add(n.id); }); }
    const clipboard = clone(sc.nodes.filter(n => ids.has(n.id)));
    clipboard.forEach(n => { if (!n.parentId || !ids.has(n.parentId)) { const source = sc.nodes.find(v => v.id === n.id)!, position = worldGeometry(source, sc.nodes); n.parentId = null; n.x = position.x; n.y = position.y; n.rotation = position.rotation; } });
    set({ clipboard });
  },
  paste: () => {
    const st = get(); if (!st.clipboard.length) return; if (currentScreen(st).nodes.length + st.clipboard.length > 2000) { get().notify("パーツ数が1画面の上限2000個を超えます"); return; }
    const map = new Map(st.clipboard.map(n => [n.id, uid()]));
    const nodes = clone(st.clipboard).map(n => ({ ...n, id: map.get(n.id)!, name: n.name + ' のコピー', parentId: n.parentId && map.has(n.parentId) ? map.get(n.parentId)! : null, children: n.children.map(id => map.get(id)!).filter(Boolean), x: n.x + (n.parentId && map.has(n.parentId) ? 0 : 16), y: n.y + (n.parentId && map.has(n.parentId) ? 0 : 16), actions: n.actions.map(a => ({ ...a, id: uid() })), locked: false }));
    get().update(p => { const sc = currentScreen({ project: p, screenId: st.screenId }), top = Math.max(0, ...sc.nodes.map(n => n.zIndex)); nodes.forEach((n, i) => { n.zIndex = top + i + 1; sc.nodes.push(n); }); });
    set({ selected: nodes.filter(n => !n.parentId).map(n => n.id) });
  },
  duplicate: () => { get().copy(); get().paste(); },
  group: () => {
    const st = get(), sc = currentScreen(st), ns = editableRoots(sc.nodes, st.selected);
    if (ns.length < 2 || ns.some(n => n.parentId !== ns[0].parentId)) { get().notify('同じ階層のロックされていないパーツを2つ以上選択してください'); return; }
    if (sc.nodes.length >= 2000) { get().notify("パーツ数が上限です。不要なパーツを削除してください"); return; }
    const x = Math.min(...ns.map(n => n.x)), y = Math.min(...ns.map(n => n.y)), group = newNode('container', x, y);
    group.name = 'グループ'; group.parentId = ns[0].parentId; group.width = Math.max(...ns.map(n => n.x + n.width)) - x; group.height = Math.max(...ns.map(n => n.y + n.height)) - y;
    group.styles.background = 'transparent'; group.styles.radius = 0; group.styles.borderWidth = 0; group.children = ns.map(n => n.id); group.zIndex = Math.min(...ns.map(n => n.zIndex));
    const ids = new Set(group.children);
    get().update(p => { const s = currentScreen({ project: p, screenId: st.screenId }); s.nodes.forEach(n => { if (ids.has(n.id)) { n.parentId = group.id; n.x -= x; n.y -= y; } }); s.nodes.push(group); });
    set({ selected: [group.id] });
  },
  ungroup: () => {
    const st = get(), sc = currentScreen(st), groups = editableRoots(sc.nodes, st.selected).filter(n => n.type === 'container');
    if (!groups.length) return;
    const selected: string[] = [];
    get().update(p => {
      const s = currentScreen({ project: p, screenId: st.screenId });
      groups.forEach(g => s.nodes.forEach(n => {
        if (n.parentId !== g.id) return;
        const angle = g.rotation * Math.PI / 180, dx = n.x + n.width / 2 - g.width / 2, dy = n.y + n.height / 2 - g.height / 2;
        n.x = g.x + g.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle) - n.width / 2;
        n.y = g.y + g.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) - n.height / 2;
        n.rotation = ((n.rotation + g.rotation + 180) % 360 + 360) % 360 - 180; n.parentId = g.parentId; selected.push(n.id);
      }));
      s.nodes = s.nodes.filter(n => !groups.some(g => g.id === n.id));
    });
    set({ selected });
  },
  arrange: mode => {
    if (mode === 'distribute-horizontal' || mode === 'distribute-vertical') { get().distribute(mode === 'distribute-horizontal' ? 'horizontal' : 'vertical'); return; }
    const st = get(), sc = currentScreen(st), ns = editableRoots(sc.nodes, st.selected); if (!ns.length) return;
    const positions = ns.map(n => ({ n, ...worldGeometry(n, sc.nodes) }));
    const left = ns.length > 1 ? Math.min(...positions.map(n => n.x)) : 0, top = ns.length > 1 ? Math.min(...positions.map(n => n.y)) : 0;
    const right = ns.length > 1 ? Math.max(...positions.map(({ n, x }) => x + n.width)) : sc.width, bottom = ns.length > 1 ? Math.max(...positions.map(({ n, y }) => y + n.height)) : sc.height;
    get().update(p => {
      const s = currentScreen({ project: p, screenId: st.screenId });
      positions.forEach(({ n, x, y }) => {
        let dx = 0, dy = 0;
        if (mode === 'left') dx = left - x; if (mode === 'center') dx = (left + right - n.width) / 2 - x; if (mode === 'right') dx = right - n.width - x;
        if (mode === 'top') dy = top - y; if (mode === 'middle') dy = (top + bottom - n.height) / 2 - y; if (mode === 'bottom') dy = bottom - n.height - y;
        const target = s.nodes.find(v => v.id === n.id)!, d = localDelta(n, sc.nodes, dx, dy); target.x += d.x; target.y += d.y;
      });
    });
  },
  distribute: axis => {
    const st = get(), sc = currentScreen(st), ns = editableRoots(sc.nodes, st.selected);
    if (ns.length < 3) { get().notify('等間隔に並べるパーツを3つ以上選択してください'); return; }
    const horizontal = axis === 'horizontal', key = horizontal ? 'x' : 'y', size = horizontal ? 'width' : 'height';
    const positions = ns.map(n => ({ n, ...worldGeometry(n, sc.nodes) })).sort((a, b) => a[key] - b[key]);
    const first = positions[0], last = positions.at(-1)!, available = last[key] + last.n[size] - first[key] - positions.reduce((sum, v) => sum + v.n[size], 0), gap = available / (positions.length - 1);
    let cursor = first[key];
    const moves = positions.map(v => { const delta = cursor - v[key]; cursor += v.n[size] + gap; return { id: v.n.id, d: localDelta(v.n, sc.nodes, horizontal ? delta : 0, horizontal ? 0 : delta) }; });
    get().update(p => { const s = currentScreen({ project: p, screenId: st.screenId }); moves.forEach(({ id, d }) => { const n = s.nodes.find(n => n.id === id)!; n.x += d.x; n.y += d.y; }); });
  },
  reorder: front => {
    const st = get(), sc = currentScreen(st), roots = editableRoots(sc.nodes, st.selected); if (!roots.length) return;
    const ids = new Set(roots.map(n => n.id)), parents = new Set(roots.map(n => n.parentId));
    get().update(p => { const s = currentScreen({ project: p, screenId: st.screenId }); parents.forEach(parent => { const siblings = s.nodes.filter(n => n.parentId === parent).toSorted((a, b) => a.zIndex - b.zIndex), selected = siblings.filter(n => ids.has(n.id)), rest = siblings.filter(n => !ids.has(n.id)); (front ? [...rest, ...selected] : [...selected, ...rest]).forEach((n, i) => n.zIndex = i); }); });
  },
  addScreen: () => {
    if (get().project.screens.length >= 100) { get().notify('1プロジェクトの画面は100画面までです'); return; }
    const st = get(), source = currentScreen(st), sc = newScreen(`画面 ${st.project.screens.length + 1}`);
    Object.assign(sc, { device: source.device, width: source.width, height: source.height, background: source.background, viewportSettings: clone(source.viewportSettings) });
    get().update(p => p.screens.push(sc)); set({ screenId: sc.id, selected: [] });
  },
  duplicateScreen: () => {
    if (get().project.screens.length >= 100) { get().notify('1プロジェクトの画面は100画面までです'); return; }
    const st = get(), source = currentScreen(st), s = clone(source); s.id = uid(); s.name += ' のコピー';
    const map = new Map(s.nodes.map(n => [n.id, uid()]));
    s.nodes.forEach(n => { n.id = map.get(n.id)!; n.parentId = n.parentId ? map.get(n.parentId)! : null; n.children = n.children.map(id => map.get(id)!); n.actions = n.actions.map(a => ({ ...a, id: uid(), targetScreenId: a.targetScreenId === source.id ? s.id : a.targetScreenId })); });
    get().update(p => p.screens.push(s)); set({ screenId: s.id, selected: [] });
  },
  deleteScreen: id => {
    const st = get(); if (!st.project.screens.some(s => s.id === id)) return;
    if (st.project.screens.length === 1) { get().notify('最後の画面は削除できません'); return; }
    get().update(p => { p.screens = p.screens.filter(s => s.id !== id); if (p.startScreenId === id) p.startScreenId = p.screens[0].id; });
  },
  patchScreen: patch => get().update(p => {
    const sc = currentScreen({ project: p, screenId: get().screenId }); Object.assign(sc, patch);
    sc.width = bounded(sc.width, 100, 6000); sc.height = bounded(sc.height, 100, 10000); sc.viewportSettings.scrollHeight = Math.max(sc.height, bounded(sc.viewportSettings.scrollHeight, 100, 20000));
  }),
  loadProject: p => {
    const project = parseProject(p), view = viewCache.get(project.id);
    set({ project, screenId: project.startScreenId, selected: [], past: [], future: [], tool: 'select', saveStatus: 'saving', loaded: true, viewRestored: !!view, ...(view ? validatedView(project, view) : {}) });
    if (!view) { const current = get().project, requestedRevision = revision; session.get(`view:${project.id}`).then(row => { if (get().project !== current || revision !== requestedRevision || !row) return; const restored = readView(row.value); if (!restored) return; viewCache.set(project.id, restored); set({ ...validatedView(project, restored), viewRestored: true }); }).catch(() => undefined); }
  },
  notify: message => set({ toast: message }),
}));

const viewCache = new Map<string, ViewState>();
const viewOf = (s: Editor): ViewState => ({ screenId: s.screenId, selected: [...s.selected], zoom: clampZoom(s.zoom), grid: s.grid, snap: s.snap });
function readView(raw: string): ViewState | undefined {
  try { const v = JSON.parse(raw); if (typeof v.screenId !== 'string' || !Array.isArray(v.selected) || typeof v.zoom !== 'number') return; return { screenId: v.screenId, selected: v.selected.filter((id: unknown): id is string => typeof id === 'string'), zoom: clampZoom(v.zoom), grid: !!v.grid, snap: v.snap !== false }; } catch { return; }
}
function validatedView(p: Project, view: ViewState): ViewState { const screenId = p.screens.some(s => s.id === view.screenId) ? view.screenId : p.startScreenId; return { ...view, screenId, selected: validSelection(p, screenId, view.selected), zoom: clampZoom(view.zoom) }; }
type SaveSnapshot = { project: Project; view: ViewState; revision: number };
let revision = 0, saving: ReturnType<typeof setTimeout> | undefined, initialization: Promise<void> | undefined;
const queue = createSaveQueue<SaveSnapshot>(async snapshot => { await db.transaction('rw', projects, session, async () => { await projects.put(snapshot.project); await session.put({ key: `view:${snapshot.project.id}`, value: JSON.stringify(snapshot.view) }); await session.put({ key: 'active', value: snapshot.project.id }); }); });
const saveSnapshot = (): SaveSnapshot => { const s = useEditor.getState(); return { project: clone(s.project), view: viewOf(s), revision }; };
async function writeSnapshot(snapshot: SaveSnapshot) {
  try { await queue.enqueue(snapshot); if (snapshot.revision === revision) useEditor.setState({ saveStatus: 'saved' }); }
  catch (error) { if (snapshot.revision === revision) useEditor.setState({ saveStatus: 'error', toast: '自動保存できません。JSONを書き出してバックアップしてください。' }); throw error; }
}
useEditor.subscribe((s, prev) => {
  if (!s.loaded) return;
  const view = viewOf(s), viewChanged = !deepEqual(view, viewOf(prev));
  if (s.project === prev.project && !viewChanged) return;
  viewCache.set(s.project.id, view); revision += 1; clearTimeout(saving);
  if (s.saveStatus !== 'saving') useEditor.setState({ saveStatus: 'saving' });
  saving = setTimeout(() => { void writeSnapshot(saveSnapshot()).catch(() => undefined); }, 500);
});
export function initialize(): Promise<void> {
  if (useEditor.getState().loaded) return Promise.resolve(); if (initialization) return initialization;
  initialization = (async () => {
    try {
      const rows = await session.toArray();
      rows.forEach(row => { if (row.key.startsWith('view:')) { const view = readView(row.value); if (view) viewCache.set(row.key.slice(5), view); } });
      const active = rows.find(row => row.key === 'active'), stored = active ? await projects.get(active.value) : undefined, project = stored ? parseProject(stored) : initial;
      const view = viewCache.get(project.id);
      if (!stored) await db.transaction('rw', projects, session, async () => { await projects.put(project); await session.put({ key: 'active', value: project.id }); });
      if (view) viewCache.set(project.id, view);
      useEditor.setState({ project, screenId: project.startScreenId, selected: [], loaded: true, viewRestored: !!view, ...(view ? validatedView(project, view) : {}) });
    } catch { useEditor.setState({ loaded: true, saveStatus: 'error', toast: '保存データを開けませんでした。編集中の内容はJSONでバックアップしてください。' }); }
  })(); return initialization;
}
export async function listProjects() { return projects.orderBy('updatedAt').reverse().toArray(); }
export async function persistNow() { clearTimeout(saving); useEditor.setState({ saveStatus: 'saving' }); await writeSnapshot(saveSnapshot()); }
