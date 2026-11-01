import { z } from 'zod';

export const nodeTypes = ['text', 'rectangle', 'ellipse', 'line', 'button', 'image', 'icon', 'input', 'checkbox', 'switch', 'card', 'navbar', 'tabbar', 'list', 'divider', 'container'] as const;
export type NodeType = typeof nodeTypes[number];
export const labels: Record<NodeType, string> = { text: 'テキスト', rectangle: '長方形', ellipse: '円', line: '線', button: 'ボタン', image: '画像', icon: 'アイコン', input: '入力欄', checkbox: 'チェック', switch: 'スイッチ', card: 'カード', navbar: 'ナビゲーション', tabbar: 'タブバー', list: 'リスト', divider: '区切り線', container: 'コンテナ' };
const color = z.string().regex(/^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|transparent)$/);
const bounded = z.number().finite().min(-20000).max(20000);
export const safeUrl = (value: string) => { try { return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol); } catch { return false; } };
export const safeImage = (value: string) => /^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value) || /^\/assets\/[a-zA-Z0-9_.-]+$/.test(value) || value === '';
export const actionSchema = z.object({ id: z.string().max(100), trigger: z.literal('click'), type: z.enum(['none', 'navigate', 'back', 'url']), targetScreenId: z.string().max(100).default(''), url: z.string().max(2000).refine(v => !v || safeUrl(v), '安全なURLを指定してください').default(''), transition: z.enum(['none', 'fade', 'slide']).default('fade') });
const styleSchema = z.object({ background: color, color, fontSize: z.number().min(1).max(500), fontFamily: z.string().max(160), fontWeight: z.number().min(100).max(900), lineHeight: z.number().min(.5).max(5), letterSpacing: z.number().min(-20).max(100), textAlign: z.enum(['left', 'center', 'right']), borderColor: color, borderWidth: z.number().min(0).max(50), radius: z.number().min(0).max(1000), opacity: z.number().min(0).max(1), shadow: z.boolean() });
export const nodeSchema = z.object({ id: z.string().max(100), type: z.enum(nodeTypes), name: z.string().max(200), parentId: z.string().max(100).nullable(), x: bounded, y: bounded, width: z.number().min(1).max(10000), height: z.number().min(1).max(10000), rotation: z.number().min(-360).max(360), visible: z.boolean(), locked: z.boolean(), zIndex: z.number().int().min(-10000).max(10000), styles: styleSchema, properties: z.object({ text: z.string().max(20000), src: z.string().max(12000000).refine(safeImage, '画像形式が無効です'), icon: z.string().max(60), checked: z.boolean(), role: z.string().max(1000), fixed: z.enum(['none', 'top', 'bottom']) }), layout: z.object({ mode: z.enum(['free', 'vertical', 'horizontal', 'grid']), gap: z.number().min(0).max(1000), padding: z.number().min(0).max(1000), align: z.enum(['start', 'center', 'end']) }), actions: z.array(actionSchema).max(10), children: z.array(z.string().max(100)).max(1000) });
export const screenSchema = z.object({ id: z.string().max(100), name: z.string().max(200), description: z.string().max(5000).default(''), device: z.string().max(100), width: z.number().min(100).max(6000), height: z.number().min(100).max(10000), background: color, nodes: z.array(nodeSchema).max(2000), viewportSettings: z.object({ statusBar: z.boolean(), deviceFrame: z.boolean(), safeArea: z.boolean(), scrollHeight: z.number().min(100).max(20000) }) });
export const projectSchema = z.object({ id: z.string().max(100), name: z.string().min(1).max(200), version: z.literal('1.0'), createdAt: z.string(), updatedAt: z.string(), settings: z.object({ description: z.string().max(10000), notes: z.string().max(10000), responsive: z.string().max(5000) }), assets: z.array(z.object({ id: z.string(), name: z.string(), src: z.string().max(12000000).refine(safeImage) })).max(200), screens: z.array(screenSchema).min(1).max(100), startScreenId: z.string().max(100) }).superRefine((p, ctx) => {
  const ids = p.screens.map(s => s.id);
  if (new Set(ids).size !== ids.length || !ids.includes(p.startScreenId)) ctx.addIssue({ code: 'custom', message: '画面IDまたはスタート画面が無効です' });
  const allIds = p.screens.flatMap(s => s.nodes.map(n => n.id));
  const identifiers = [p.id, ...ids, ...allIds, ...p.screens.flatMap(s => s.nodes.flatMap(n => n.actions.map(a => a.id)))];
  if (identifiers.some(id => !/^[a-zA-Z0-9_-]{1,100}$/.test(id))) ctx.addIssue({ code: 'custom', message: 'IDに使用できない文字が含まれています' });
  if (new Set(allIds).size !== allIds.length) ctx.addIssue({ code: 'custom', message: '要素IDが重複しています' });
  p.screens.forEach(s => s.nodes.forEach(n => {
    const visited = new Set([n.id]); let parent = n.parentId;
    while (parent) { if (visited.has(parent)) { ctx.addIssue({ code: 'custom', message: '要素の階層が循環しています' }); break; } visited.add(parent); const found = s.nodes.find(v => v.id === parent); if (!found) { ctx.addIssue({ code: 'custom', message: '親要素が見つかりません' }); break; } parent = found.parentId; }
  }));
});
export type Project = z.infer<typeof projectSchema>;
export type Screen = z.infer<typeof screenSchema>;
export type UINode = z.infer<typeof nodeSchema>;
export type Action = z.infer<typeof actionSchema>;
export const uid = () => crypto.randomUUID();
export const clone = <T,>(v: T): T => structuredClone(v);
export const presets = [ { name: 'iPhone 16', w: 393, h: 852, group: 'スマートフォン' }, { name: 'Android', w: 412, h: 915, group: 'スマートフォン' }, { name: 'iPad', w: 820, h: 1180, group: 'タブレット' }, { name: 'Android Tablet', w: 800, h: 1280, group: 'タブレット' }, { name: 'ノートPC', w: 1440, h: 900, group: 'PC' }, { name: 'デスクトップ', w: 1920, h: 1080, group: 'PC' } ];
export function newNode(type: NodeType, x = 32, y = 160): UINode {
  const text = ({ text: '新しいテキスト', button: 'はじめる', input: 'テキストを入力', checkbox: 'チェック項目', card: 'カードのタイトル', navbar: 'ページタイトル', tabbar: 'ホーム　　検索　　お気に入り', list: 'リストの項目', switch: '通知を受け取る' } as Partial<Record<NodeType, string>>)[type] ?? '';
  const sizes: Partial<Record<NodeType, [number, number]>> = { text: [240, 36], button: [280, 52], ellipse: [100, 100], icon: [32, 32], line: [240, 2], divider: [300, 1], image: [300, 190], navbar: [329, 56], tabbar: [329, 60], checkbox: [240, 32], switch: [250, 32], input: [300, 48], container: [300, 200], list: [300, 64], card: [300, 150] };
  const [width, height] = sizes[type] ?? [180, 120];
  return { id: uid(), type, name: labels[type], parentId: null, x, y, width, height, rotation: 0, visible: true, locked: false, zIndex: 0, styles: { background: ['text', 'icon', 'checkbox', 'switch'].includes(type) ? 'transparent' : type === 'button' ? '#237d68' : ['line', 'divider'].includes(type) ? '#dce1df' : '#f0f2ef', color: type === 'button' ? '#ffffff' : '#263b34', fontSize: type === 'text' ? 20 : 14, fontFamily: '"Noto Sans JP", sans-serif', fontWeight: type === 'button' ? 600 : 400, lineHeight: 1.6, letterSpacing: 0, textAlign: type === 'button' ? 'center' : 'left', borderColor: '#dce1df', borderWidth: ['input', 'card'].includes(type) ? 1 : 0, radius: type === 'ellipse' ? 1000 : 12, opacity: 1, shadow: false }, properties: { text, src: type === 'image' ? '/assets/mountain.jpg' : '', icon: 'Heart', checked: false, role: '', fixed: 'none' }, layout: { mode: 'free', gap: 12, padding: 16, align: 'start' }, actions: [], children: [] };
}
export function newScreen(name = '新しい画面'): Screen { return { id: uid(), name, description: '', device: 'iPhone 16', width: 393, height: 852, background: '#ffffff', nodes: [], viewportSettings: { statusBar: true, deviceFrame: true, safeArea: true, scrollHeight: 852 } }; }
export function createProject(blank = false): Project {
  const home = newScreen('ホーム'); const detail = newScreen('旅の詳細'); const saved = newScreen('お気に入り');
  const node = (s: Screen, type: NodeType, name: string, x: number, y: number, w: number, h: number, text = '', style: Partial<UINode['styles']> = {}, props: Partial<UINode['properties']> = {}) => { const n = newNode(type, x, y); n.name = name; n.width = w; n.height = h; n.properties = { ...n.properties, text, ...props }; n.styles = { ...n.styles, ...style }; n.zIndex = s.nodes.length; s.nodes.push(n); return n; };
  if (!blank) {
    home.background = '#fcfbf8'; detail.background = '#fcfbf8'; saved.background = '#fcfbf8';
    node(home, 'text', 'ブランドロゴ', 26, 59, 180, 34, 'yohaku.', { fontSize: 27, fontWeight: 700, letterSpacing: -1.2 });
    node(home, 'icon', 'プロフィール', 333, 62, 32, 32, '', { background: '#e8ede5', radius: 20 }, { icon: 'UserRound' });
    node(home, 'text', 'イントロダクション', 26, 119, 330, 25, '忙しい毎日に、ひと息の旅を。', { fontSize: 12, color: '#7d867c', letterSpacing: .6 });
    node(home, 'text', 'メインタイトル', 26, 151, 345, 91, '次の週末は、\nどこへ行こう。', { fontSize: 30, fontWeight: 600, lineHeight: 1.45, letterSpacing: -1 });
    node(home, 'input', '行き先を検索', 26, 261, 341, 46, 'エリアやキーワードで探す', { background: '#ffffff', radius: 10, color: '#9aa198', fontSize: 12 }, { icon: 'Search' });
    const hero = node(home, 'image', '山のある風景', 26, 330, 341, 238, '', { radius: 14 }, { src: '/assets/mountain.jpg', role: 'おすすめの旅のカバー写真' }); hero.actions = [{ id: uid(), type: 'navigate', trigger: 'click', targetScreenId: detail.id, url: '', transition: 'slide' }];
    node(home, 'rectangle', 'おすすめラベル背景', 42, 347, 80, 25, '', { background: '#fcfbf8', radius: 5 });
    node(home, 'text', 'おすすめラベル', 50, 349, 70, 22, '今週のおすすめ', { fontSize: 9, fontWeight: 600 });
    node(home, 'text', 'おすすめの旅タイトル', 26, 586, 300, 30, '深呼吸したくなる、山の旅', { fontSize: 19, fontWeight: 600 });
    node(home, 'text', '旅の説明', 26, 624, 300, 22, '長野県・上高地　 ·　 1泊2日', { fontSize: 11, color: '#7d867c' });
    const cta = node(home, 'button', '旅を見つけるボタン', 26, 668, 341, 50, 'この旅を見てみる　 →', { radius: 10, fontSize: 13 }); cta.actions = [{ id: uid(), trigger: 'click', type: 'navigate', targetScreenId: detail.id, url: '', transition: 'slide' }];
    node(home, 'text', '小さなコピー', 26, 738, 341, 25, '遠くへ行かなくても、心は旅できる。', { fontSize: 10, textAlign: 'center', color: '#9a9e92' });
    const nav = node(home, 'tabbar', 'ボトムナビゲーション', 0, 782, 393, 70, 'ホーム,さがす,お気に入り', { background: '#ffffff', borderWidth: 0, radius: 0 }, { fixed: 'bottom' }); nav.actions = [{ id: uid(), trigger: 'click', type: 'navigate', targetScreenId: saved.id, url: '', transition: 'fade' }];
    node(detail, 'image', '旅のカバー', 0, 48, 393, 310, '', { radius: 0 });
    const back = node(detail, 'button', '戻るボタン', 24, 66, 42, 42, '←', { background: '#ffffff', color: '#263b34', radius: 24, fontSize: 22 }); back.actions = [{ id: uid(), trigger: 'click', type: 'back', targetScreenId: '', url: '', transition: 'slide' }];
    node(detail, 'text', '旅のエリア', 26, 384, 330, 24, 'NAGANO  /  KAMIKOCHI', { fontSize: 10, letterSpacing: 2, color: '#237d68', fontWeight: 600 });
    node(detail, 'text', '旅のタイトル', 26, 425, 341, 100, '山と、川と、\nなにもしない時間。', { fontSize: 29, fontWeight: 600, lineHeight: 1.5 });
    node(detail, 'text', '旅のストーリー', 26, 552, 341, 112, '澄んだ空気を胸いっぱいに。\n木漏れ日の道をゆっくり歩いて、\nいつもの自分に、小さな余白を。', { fontSize: 14, lineHeight: 2, color: '#788078' });
    const favorite = node(detail, 'button', '旅を保存', 26, 714, 341, 52, '♡　お気に入りに追加', { radius: 10 }); favorite.actions = [{ id: uid(), trigger: 'click', type: 'navigate', targetScreenId: saved.id, url: '', transition: 'fade' }];
    node(saved, 'text', 'ページタイトル', 26, 84, 341, 55, 'お気に入りの旅', { fontSize: 28, fontWeight: 600 });
    node(saved, 'text', 'サブタイトル', 26, 146, 341, 30, 'いつか行きたい場所を、ここに。', { fontSize: 13, color: '#788078' });
    node(saved, 'image', '森の風景', 26, 210, 341, 240, '', { radius: 14 }, { src: '/assets/forest.jpg' });
    node(saved, 'text', 'お気に入りタイトル', 26, 475, 341, 40, '森に、会いに行く。', { fontSize: 22, fontWeight: 600 });
    const homeBtn = node(saved, 'button', 'ホームに戻る', 26, 579, 341, 50, 'ほかの旅を見つける', { radius: 10 }); homeBtn.actions = [{ id: uid(), trigger: 'click', type: 'navigate', targetScreenId: home.id, url: '', transition: 'fade' }];
  }
  const now = new Date().toISOString();
  return { id: uid(), name: blank ? '無題のプロジェクト' : '旅のアプリ「yohaku」', version: '1.0', createdAt: now, updatedAt: now, settings: { description: blank ? '' : '日常に余白をつくる、小さな旅を見つけるアプリ。', notes: '', responsive: 'スマートフォンを基準に、幅に合わせて余白を調整する。' }, assets: [], screens: blank ? [home] : [home, detail, saved], startScreenId: home.id };
}
export function absolutePosition(n: UINode, nodes: UINode[]): { x: number; y: number } { let x = n.x, y = n.y, parent = n.parentId; const seen = new Set([n.id]); while (parent && !seen.has(parent)) { seen.add(parent); const p = nodes.find(v => v.id === parent); if (!p) break; x += p.x; y += p.y; parent = p.parentId; } return { x, y }; }
export function parseProject(raw: unknown): Project { const p = projectSchema.parse(raw); p.screens.forEach(s => s.nodes.forEach(n => n.children = s.nodes.filter(c => c.parentId === n.id).map(c => c.id))); return p; }
export function warnings(p: Project) { return p.screens.flatMap(s => s.nodes.flatMap(n => n.actions.filter(a => a.type === 'navigate' && !p.screens.some(s => s.id === a.targetScreenId)).map(() => `${s.name}の「${n.name}」の移動先が見つかりません`))); }
