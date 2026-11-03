import fontNotices from './font-notices.txt?raw';
import { usedFontCSS, portableFonts } from './fonts';
import { useEditor } from './store';
import { renderToStaticMarkup } from 'react-dom/server';
import { toPng, toSvg } from 'html-to-image';
import JSZip from 'jszip';
import { ScreenRenderer } from './Renderer';
import type { Project, Screen } from './model';
import { absolutePosition, labels, safeImage, safeUrl } from './model';
import { prototypeRuntime } from './exportRuntime';
import rendererCSS from './renderer.css?raw';

export const implementationPrompt = '添付したモックアップと構造化仕様を参考に、React + TypeScriptでUIを実装してください。色、余白、文字、画面遷移を可能な限り再現してください。座標情報は設計上の参考値とし、必要に応じてFlexboxやGridでレスポンシブに実装してください。未定義の機能を勝手に補完せず、TODOとして扱ってください。';
export function fileName(value: string) {
  const cleaned = value.normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[.\s]+$/g, '').trim();
  const match = /(\.[a-zA-Z0-9]{1,10})$/.exec(cleaned), extension = match && match.index > 0 ? match[1] : '';
  const stem = extension ? cleaned.slice(0, -extension.length) : cleaned;
  let bounded = '';
  for (const character of stem) {
    if (Array.from(bounded).length >= 100 - extension.length || new TextEncoder().encode(bounded + character + extension).length > 180) break;
    bounded += character;
  }
  bounded += extension;
  if (!bounded) return 'moku';
  return /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(bounded) ? `_${bounded}` : bounded;
}
export const escapeHTML = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const mdInline = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]()#+!|])/g, '\\$1').replace(/\r?\n/g, ' ');
const mdCell = (value: string) => value.split(/\r?\n/).map(mdInline).join('<br>');
const mdBlock = (value: string) => value.split(/\r?\n/).map(line => `> ${mdInline(line)}`).join('\n');
export const serializeForScript = (value: unknown) => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const imageTypes: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
export function imageExtension(src: string) {
  const mime = /^data:([^;,]+)/.exec(src)?.[1];
  if (mime && imageTypes[mime]) return imageTypes[mime];
  const ext = /\.([a-z]+)$/i.exec(src)?.[1].toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext && ['png', 'jpg', 'webp', 'gif'].includes(ext) ? ext : 'png';
}
export function getExportWarnings(p: Project, screens: Screen[] = p.screens) {
  const selectedIds = new Set(screens.map(s => s.id));
  return screens.flatMap(s => s.nodes.flatMap(n => n.actions.filter(a => a.type === 'navigate' && !selectedIds.has(a.targetScreenId)).map(a => {
    const target = p.screens.find(candidate => candidate.id === a.targetScreenId);
    return target ? `${s.name}の「${n.name}」→「${target.name}」：移動先は今回の書き出しに含まれません` : `${s.name}の「${n.name}」：移動先の画面が見つかりません`;
  })));
}
export function scopedProject(p: Project, screens: Screen[]): Project {
  if (!screens.length) throw new Error('書き出す画面を1つ以上選択してください。');
  return { ...p, screens, startScreenId: screens.some(s => s.id === p.startScreenId) ? p.startScreenId : screens[0].id };
}
export function markdown(p: Project, screens = p.screens, assetPaths: ReadonlyMap<string, string> = new Map()) {
  const scoped = scopedProject(p, screens), warnings = getExportWarnings(p, screens);
  const text = [`# ${mdInline(p.name)} — UI実装仕様書`, '', `> moku / スキーマ ${mdInline(p.version)} / 更新 ${mdInline(p.updatedAt)}`, '', '## プロジェクト概要', mdBlock(p.settings.description || '未指定（要確認）'), '', `- スタート画面：${mdInline(screens.find(s => s.id === scoped.startScreenId)?.name ?? '未指定')} (${mdInline(scoped.startScreenId)})`, `- 対象画面数：${screens.length} / ${p.screens.length}`, `- レスポンシブ：${mdInline(p.settings.responsive || '未指定（TODO）')}`, '- 補足：', mdBlock(p.settings.notes || 'なし'), '', '## AIへの実装指示', implementationPrompt, '', '## 設計上の注意', '座標はデザインの参考値です。HTMLは見た目を再現するための参考コードです。業務ロジック、アクセシビリティ、レスポンシブ対応を確認して実装してください。', '未定義の画面や動作を補完せず、TODOとして残してください。', ''];
  if (warnings.length) text.push('## 書き出し範囲の確認', ...warnings.map(w => `- ${mdInline(w)}`), '');
  screens.forEach(s => {
    text.push(`## 画面：${mdInline(s.name)}`, `- ID：${mdInline(s.id)}`, `- 役割：${mdInline(s.description || '未指定')}`, `- デバイス：${mdInline(s.device)} / ${s.width} × ${s.height}px`, `- 背景：${s.background}`, `- スクロール範囲：${Math.max(s.height, s.viewportSettings.scrollHeight)}px`, `- セーフエリア：${s.viewportSettings.safeArea ? 'あり' : 'なし'} / ステータスバー：${s.viewportSettings.statusBar ? '表示' : '非表示'}`, '', '### 要素と階層', '| 名前 / ID | 種類 / 親ID | 位置 (x, y) | 寸法 (W × H) | 内容 / 役割 |', '| --- | --- | --- | --- | --- |');
    s.nodes.toSorted((a, b) => a.zIndex - b.zIndex).forEach(n => { const pos = absolutePosition(n, s.nodes); text.push(`| ${mdCell(n.name)} / ${mdCell(n.id)} | ${mdCell(labels[n.type])} / ${mdCell(n.parentId ?? '画面直下')} | ${n.x}, ${n.y} (画面基準 ${pos.x}, ${pos.y}) | ${n.width} × ${n.height} | ${mdCell(n.properties.text)} ${mdCell(n.properties.role)} |`); });
    text.push('', '### 色・文字・レイアウト');
    s.nodes.forEach(n => {
      text.push(`- **${mdInline(n.name)}** (${mdInline(n.id)})：塗り ${n.styles.background}、文字色 ${n.styles.color}、フォント ${mdInline(n.styles.fontFamily)}（代替フォントを含む）、${n.styles.fontSize}px / ${n.styles.fontWeight}、行間 ${n.styles.lineHeight}、字間 ${n.styles.letterSpacing}px、${n.styles.textAlign}揃え、角丸 ${n.styles.radius}px、枠線 ${n.styles.borderWidth}px ${n.styles.borderColor}、不透明度 ${n.styles.opacity}、回転 ${n.rotation}°、影 ${n.styles.shadow ? 'あり' : 'なし'}、重なり順 ${n.zIndex}、${n.visible ? '表示' : '非表示'}、${n.locked ? 'ロック' : '編集可'}。`);
      const g=n.styles.gradient,shadow=n.styles.shadowStyle,corners=n.styles.corners;
      if(g.type!=='none')text.push(`  - グラデーション：${g.type} / ${g.angle}° / ${g.from} → ${g.to}`);
      if(n.styles.shadow)text.push(`  - 影：横 ${shadow.x}px / 縦 ${shadow.y}px / ぼかし ${shadow.blur}px / 広がり ${shadow.spread}px / ${shadow.color} / ${shadow.inset?'内側':'外側'}`);
      if(corners.enabled)text.push(`  - 角別の丸み：${corners.topLeft}, ${corners.topRight}, ${corners.bottomRight}, ${corners.bottomLeft}px`);
      text.push(`  - 文字装飾：${n.styles.fontStyle} / ${n.styles.textDecoration} / ${n.styles.textTransform} / 縦揃え ${n.styles.verticalAlign}`);
      if (n.children.length || n.type === 'container') text.push(`  - 配置 ${n.layout.mode} / 余白 ${n.layout.padding}px / 間隔 ${n.layout.gap}px / 整列 ${n.layout.align} / 子要素 ${n.children.map(mdInline).join(', ')}`);
      if (n.properties.fixed !== 'none') text.push(`  - スクロール時の固定：${n.properties.fixed}`);
      text.push(`  - 部品の状態：数値・選択番号 ${n.properties.value} / ${n.properties.checked ? "選択済み" : "未選択"} / ${n.properties.disabled ? "無効" : "有効"} / 通知 ${n.properties.tone} / 画像 ${n.properties.fit}`);
      if (n.properties.src) { const path = assetPaths.get(n.id) ?? (n.properties.src.startsWith('data:') ? `assets/${fileName(n.id)}.${imageExtension(n.properties.src)}` : n.properties.src.replace(/^\//, '')); text.push(`  - 画像：${mdInline(path)}（JSONに画像データを保持）`); }
    });
    text.push('', '### 画面遷移・クリック動作');
    const actions = s.nodes.flatMap(n => n.actions.filter(a => a.type !== 'none').map(a => ({ n, a })));
    if (!actions.length) text.push('クリック動作の指定なし。');
    actions.forEach(({ n, a }) => { const target = p.screens.find(s => s.id === a.targetScreenId); const destination = a.type === 'navigate' ? `${target ? mdInline(target.name) : '⚠ 削除された画面'} (${mdInline(a.targetScreenId)})${target && !screens.some(s => s.id === target.id) ? '［書き出し対象外］' : ''}` : a.type === 'back' ? '直前の画面へ戻る' : mdInline(a.url); text.push(`- ${mdInline(n.name)} (${mdInline(n.id)}) → ${destination} / ${a.type} / アニメーション ${a.transition}`); });
    text.push('');
  });
  return text.join('\n');
}
export function html(p: Project, screens = p.screens) {
  const selected = scopedProject(p, screens);
  const content = screens.map(s => `<section class="prototype-screen" data-screen="${escapeHTML(s.id)}" data-width="${s.width}" data-height="${s.height}" aria-label="${escapeHTML(s.name)}" tabindex="-1" ${s.id === selected.startScreenId ? '' : 'hidden'}>${renderToStaticMarkup(<ScreenRenderer screen={s} interactive />)}</section>`).join('\n');
  const data = screens.flatMap(s => s.nodes.map(n => ({ id: n.id, type: n.type, name: n.name, y: n.y, parentId: n.parentId, properties: n.properties, actions: n.actions })));
  const screenList = screens.map(s => ({ id: s.id, name: s.name, width: s.width, height: s.height }));
  const options = screens.map(s => `<option value="${escapeHTML(s.id)}" ${s.id === selected.startScreenId ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('');
  return `<!doctype html>\n<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(p.name)}</title><style>
:root{--nk-sand:#D4A373;--nk-ocean:#0891B2;--nk-forest:#166534;--nk-background:#FFFDF7;--nk-surface:#FFFFFF;--nk-success:#166534;--nk-warning:#CA8A04;--nk-error:#DC2626;--nk-info:#0891B2}
${rendererCSS}
${usedFontCSS(selected)}
*{box-sizing:border-box}body{margin:0;background:#f5f0e7;color:#343c38;font-family:system-ui,"Yu Gothic",sans-serif}.prototype-toolbar{min-height:60px;display:flex;align-items:center;gap:12px;justify-content:space-between;padding:12px 20px;background:#fffdf7;border-bottom:1px solid #e7e0d5;position:relative;z-index:10001}.prototype-toolbar strong{font-size:13px;max-width:35vw;overflow-wrap:anywhere}.prototype-toolbar nav{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.prototype-toolbar button,.prototype-toolbar select{font:inherit;font-size:11px;border:1px solid #ded4c5;border-radius:6px;background:white;color:#4c554c;padding:7px 10px;cursor:pointer;max-width:190px}.prototype-toolbar button:focus-visible,.prototype-toolbar select:focus-visible,.has-action:focus-visible{outline:2px solid #0891b2;outline-offset:3px}.prototype-toolbar button:disabled{opacity:.4;cursor:default}.prototype-workspace{padding:24px 16px;overflow:auto;min-height:calc(100dvh - 60px)}.prototype-screen{position:relative;margin:0 auto;width:max-content;box-shadow:0 8px 40px #0001;overflow:auto;background:white;overscroll-behavior:contain;outline:none}.prototype-screen[hidden]{display:none!important}.prototype-status{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 32px);padding:11px 16px;border:1px solid #ded4c5;border-radius:8px;background:#fffdf7;box-shadow:0 3px 18px #0002;font-size:12px;z-index:20000}.prototype-status:empty{display:none}.screen-transition-fade{animation:prototype-fade .2s ease}.screen-transition-slide{animation:prototype-slide .25s ease}@keyframes prototype-fade{from{opacity:.2}to{opacity:1}}@keyframes prototype-slide{from{transform:translateX(20px);opacity:.4}to{transform:translateX(0);opacity:1}}.ui-node.has-action{cursor:pointer}@media(max-width:600px){.prototype-toolbar{padding:10px 12px;gap:8px;flex-direction:column;align-items:flex-start}.prototype-toolbar strong{max-width:100%}.prototype-toolbar nav{width:100%}.prototype-toolbar select{flex:1;max-width:100%;min-width:0}}@media(prefers-reduced-motion:reduce){.prototype-screen{animation:none!important}}
</style></head><body><header class="prototype-toolbar"><strong>${escapeHTML(p.name)}</strong><nav aria-label="プレビュー操作"><button type="button" data-prototype-nav="back" aria-label="前の画面に戻る" disabled>← 戻る</button><button type="button" data-prototype-nav="reset">最初へ</button><select aria-label="表示する画面" id="prototype-screen-select">${options}</select><button type="button" data-prototype-nav="fit">画面に合わせる</button><button type="button" data-prototype-nav="actual">100%</button></nav></header><main class="prototype-workspace">${content}</main><details class="prototype-font-licenses" style="font:11px system-ui;color:#777;padding:16px"><summary>Font licenses</summary><pre style="white-space:pre-wrap">${escapeHTML(fontNotices)}</pre></details><div class="prototype-status" role="status" aria-live="polite"></div><script>\nconst prototypeNodes=${serializeForScript(data)};\nconst prototypeScreens=${serializeForScript(screenList)};\nconst prototypeStart=${serializeForScript(selected.startScreenId)};\n${prototypeRuntime}\n</script></body></html>`;
}
export function download(data: string | Blob, name: string, type = 'text/plain;charset=utf-8') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = fileName(name); a.style.display = 'none';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function dataURL(blob: Blob) {
  if (!imageTypes[blob.type.split(';')[0]]) throw new Error('画像の形式を確認してください。PNG、JPEG、WebP、GIFを利用できます。');
  const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return `data:${blob.type.split(';')[0]};base64,${btoa(binary)}`;
}
async function imageSources(sources: string[]) {
  const result = new Map<string, string>(), pending = [...new Set(sources.filter(Boolean))]; let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(6, pending.length) }, async () => {
    while (cursor < pending.length) {
      const src = pending[cursor++];
      if (!safeImage(src)) throw new Error('書き出せない画像が含まれています。画像を選び直してください。');
      if (src.startsWith('data:')) { result.set(src, src); continue; }
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
      try { const response = await fetch(src, { signal: controller.signal }); if (!response.ok) throw new Error('画像を読み込めませんでした。画像を選び直して、もう一度お試しください。'); result.set(src, await dataURL(await response.blob())); }
      catch (e) { if (e instanceof DOMException && e.name === 'AbortError') throw new Error('画像の読み込みに時間がかかっています。接続や画像を確認してください。'); throw e; }
      finally { clearTimeout(timer); }
    }
  }));
  return result;
}
export async function inlineImages(code: string, screens: Screen[]) {
  const sources = await imageSources(screens.flatMap(s => s.nodes.map(n => n.properties.src)).filter(src => src.startsWith('/assets/')));
  for (const [src, data] of sources) for (const attribute of ['src', 'href']) for (const quote of ['"', "'"]) { const from = `${attribute}=${quote}${escapeHTML(src)}${quote}`; code = code.split(from).join(`${attribute}=${quote}${data}${quote}`); }
  return code;
}
export async function portableProject(p: Project) {
  const copy = structuredClone(p), sources = await imageSources([...p.screens.flatMap(s => s.nodes.map(n => n.properties.src)), ...p.assets.map(a => a.src)]);
  copy.screens.forEach(s => s.nodes.forEach(n => { if (n.properties.src) n.properties.src = sources.get(n.properties.src)!; }));
  copy.assets.forEach(asset => { if (asset.src) asset.src = sources.get(asset.src)!; });
  const librarySources = await imageSources(p.library.flatMap(c=>c.nodes.map(n=>n.properties.src)).filter(Boolean));
  copy.library.forEach(c=>c.nodes.forEach(n=>{if(n.properties.src)n.properties.src=librarySources.get(n.properties.src)!;}));
  copy.fonts = await portableFonts(copy);
  return copy;
}
export function capturePixelRatio(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('画面のサイズを確認してください。');
  return Math.min(2, 8192 / width, 8192 / height, Math.sqrt(24000000 / (width * height)));
}
async function within<T>(promise: Promise<T>, milliseconds: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
export async function screenImage(id: string, format: 'png' | 'svg', frame: boolean) {
  const element = Array.from(document.querySelectorAll<HTMLElement>('[data-export-screen]')).find(el => el.dataset.exportScreen === id);
  if (!element) throw new Error('画面の準備が終わっていません。少し待ってから書き出してください。');
  if (document.fonts) await within(document.fonts.ready, 15000, 'フォントの読み込みが完了していません。少し待ってから書き出してください。');
  const project=useEditor.getState().project, screen=project.screens.find(s=>s.id===id);
  const fontProject=screen?scopedProject(project,[screen]):project;
  const fontEmbedCSS=usedFontCSS({...fontProject,fonts:await portableFonts(fontProject)});
  await Promise.all(Array.from(element.querySelectorAll('img')).map(img => within(img.decode(), 15000, '画像の読み込みが完了しませんでした。').catch(() => { throw new Error('画像を表示できません。画像を選び直してから書き出してください。'); })));
  let target = element; let wrapper: HTMLDivElement | undefined;
  if (frame) {
    wrapper = document.createElement('div'); const content = element.cloneNode(true) as HTMLElement;
    content.removeAttribute('data-export-screen');
    Object.assign(content.style, { border: 'none', margin: '0', borderRadius: '27px', overflow: 'hidden' });
    Object.assign(wrapper.style, { position: 'fixed', left: '-30000px', top: '0', padding: '9px', background: '#24302a', borderRadius: '36px', width: `${element.offsetWidth + 18}px`, height: `${element.offsetHeight + 18}px`, boxSizing: 'border-box', overflow: 'hidden' });
    wrapper.append(content); document.body.append(wrapper); target = wrapper;
  }
  try {
    const options = { pixelRatio: capturePixelRatio(target.offsetWidth, target.offsetHeight), cacheBust: false, fontEmbedCSS, includeQueryParams: true };
    const result = await (format === 'png' ? toPng(target, options) : toSvg(target, options));
    if (!result || result === 'data:,') throw new Error('画像を生成できませんでした。画面サイズを小さくしてお試しください。');
    return result;
  } finally { wrapper?.remove(); }
}
async function assetBundle(p: Project) {
  const unique = new Map<string, { path: string; data: string }>(), nodePaths = new Map<string, string>();
  for (const screen of p.screens) for (const node of screen.nodes) {
    const src = node.properties.src; if (!src) continue;
    if (!unique.has(src)) {
      const binary = atob(src.slice(src.indexOf(',') + 1)), bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      const digest = await crypto.subtle.digest('SHA-256', bytes), hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
      unique.set(src, { path: `assets/${hash.slice(0, 20)}.${imageExtension(src)}`, data: src.slice(src.indexOf(',') + 1) });
    }
    nodePaths.set(node.id, unique.get(src)!.path);
  }
  return { unique, nodePaths };
}
export async function exportZip(p: Project, screens: Screen[], frame: boolean) {
  const zip = new JSZip(), portable = await portableProject(scopedProject(p, screens));
  const { unique, nodePaths } = await assetBundle(portable);
  const imageFiles = screens.map((s, i) => ({ id: s.id, name: s.name, width: s.width, height: s.height, image: `screens/${String(i + 1).padStart(2, '0')}-${fileName(s.name)}.png` }));
  zip.file('FONT-LICENSES.txt', fontNotices);
  zip.file('project.json', JSON.stringify(portable, null, 2));
  zip.file('specification.md', markdown(p, screens, nodePaths));
  zip.file('prompt.md', implementationPrompt);
  zip.file('prototype.html', html(portable));
  zip.file('manifest.json', JSON.stringify({ schemaVersion: p.version, projectName: p.name, createdAt: new Date().toISOString(), startScreenId: portable.startScreenId, screens: imageFiles, assets: Object.fromEntries(nodePaths), warnings: getExportWarnings(p, screens) }, null, 2));
  zip.file('README.md', '# moku 書き出しパッケージ\n\n- prototype.html：ブラウザーで開いて画面遷移を確認できます。インターネット接続は不要です。\n- project.json：mokuの「JSONを読み込む」から編集を再開できます。画像も含まれています。\n- specification.md：画面構造・文字・色・寸法・遷移の仕様書です。\n- prompt.md：AIへの実装指示文です。\n- screens/：各画面のPNG画像です。大きな画面は画像サイズを自動調整します。\n- assets/：重複をまとめた画像素材です。manifest.jsonで要素IDとファイルの対応を確認できます。\n\nHTMLはプロトタイプの参考コードです。業務ロジックや最終的なレスポンシブ対応は実装時に調整してください。\n');
  unique.forEach(asset => zip.file(asset.path, asset.data, { base64: true }));
  for (const [index, screen] of screens.entries()) { const data = await screenImage(screen.id, 'png', frame); zip.file(imageFiles[index].image, data.slice(data.indexOf(',') + 1), { base64: true }); }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } });
}
export { warnings } from './model';
export function performURL(url: string) { if (safeUrl(url)) window.open(url, '_blank', 'noopener,noreferrer'); }
