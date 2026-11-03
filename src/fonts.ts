import sans from '@fontsource-variable/noto-sans-jp/index.css?inline';
import serif from '@fontsource-variable/noto-serif-jp/index.css?inline';
import inter from '@fontsource-variable/inter/index.css?inline';
import nunito from '@fontsource-variable/nunito/index.css?inline';
import playfair from '@fontsource-variable/playfair-display/index.css?inline';
import space from '@fontsource-variable/space-grotesk/index.css?inline';
import mono from '@fontsource-variable/jetbrains-mono/index.css?inline';
import type { FontAsset, Project } from './model';

const font = (id: string, label: string, family: string, category: string, css: string) => ({ id, label, family, category, value: `"${family}", "Noto Sans JP", sans-serif`, css: css.replaceAll(`${family} Variable`, family) });
export const fontCatalog = [
  font('noto-sans-jp', 'Noto Sans JP', 'Noto Sans JP', '日本語・ゴシック', sans),
  font('noto-serif-jp', 'Noto Serif JP', 'Noto Serif JP', '日本語・明朝', serif),
  font('inter', 'Inter', 'Inter', '欧文・モダン', inter),
  font('nunito', 'Nunito', 'Nunito', '欧文・丸ゴシック', nunito),
  font('playfair', 'Playfair Display', 'Playfair Display', '欧文・セリフ', playfair),
  font('space', 'Space Grotesk', 'Space Grotesk', '欧文・幾何学', space),
  font('mono', 'JetBrains Mono', 'JetBrains Mono', '欧文・等幅', mono),
];
export function assetFontCSS(font: FontAsset) {
  return `@font-face{font-family:"${font.family}";font-style:${font.style};font-weight:${font.weight};font-display:swap;src:url("${font.src}")${font.unicodeRange ? `;unicode-range:${font.unicodeRange}` : ''};}`;
}
export function usedFontCSS(p: Project) {
  const families = p.screens.flatMap(s => s.nodes.map(n => n.styles.fontFamily)).join(',');
  const embedded = new Set(p.fonts.map(f => f.family));
  return fontCatalog.filter(f => families.includes(f.family) && !embedded.has(f.family)).map(f => f.css).join('\n') + p.fonts.map(assetFontCSS).join('\n');
}
export function installFonts(p?: Project) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('moku-fonts');
  if (!el) { el = document.createElement('style'); el.id = 'moku-fonts'; document.head.append(el); }
  el.textContent = fontCatalog.map(f => f.css).join('\n') + (p?.fonts ?? []).map(assetFontCSS).join('\n');
}
function containsCharacter(range: string, text: string) {
  if (!range) return true;
  const spans = range.split(',').map(part => {
    const value = part.trim().replace(/^U\+/i, ''), [start, end] = value.split('-');
    return [parseInt(start.replaceAll('?', '0'), 16), parseInt((end ?? start).replaceAll('?', 'f'), 16)];
  });
  return [...text].some(c => spans.some(([a,b]) => c.codePointAt(0)! >= a && c.codePointAt(0)! <= b));
}
const dataCache = new Map<string, Promise<string>>();
async function fontData(url: string) {
  if (url.startsWith('data:')) return url;
  if (!dataCache.has(url)) dataCache.set(url, (async () => {
    const response = await fetch(url); if (!response.ok) throw new Error('フォントを読み込めません。オンラインで開き直してください。');
    const bytes = new Uint8Array(await response.arrayBuffer()); let binary = '';
    for (let i=0;i<bytes.length;i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768));
    return `data:font/woff2;base64,${btoa(binary)}`;
  })().catch(error => { dataCache.delete(url); throw error; }));
  return dataCache.get(url)!;
}
export async function portableFonts(p: Project): Promise<FontAsset[]> {
  const result = [...p.fonts];
  for (const f of fontCatalog) {
    const nodes = p.screens.flatMap(s => s.nodes).filter(n => n.styles.fontFamily.includes(f.family));
    if (!nodes.length) continue;
    const text = nodes.map(n => n.properties.text).join('') + '0123456789';
    const faces = f.css.match(/@font-face\s*\{[^}]+\}/g) ?? [];
    await Promise.all(faces.map(async (face, i) => {
      const range = /unicode-range:\s*([^;}]+)/.exec(face)?.[1] ?? '';
      if (!containsCharacter(range, text)) return;
      const id = `${f.id}-${i}`; if (result.some(v => v.id === id)) return;
      const url = /url\(["']?([^"')]+)["']?\)/.exec(face)?.[1]; if (!url) return;
      result.push({ id, name: f.label, family: f.family, src: await fontData(url), weight: /font-weight:\s*([^;}]+)/.exec(face)?.[1].trim() ?? '100 900', unicodeRange: range, style: /font-style:\s*italic/.test(face) ? 'italic' : 'normal' });
    }));
  }
  return result;
}
export async function importFont(file: File): Promise<FontAsset> {
  if (file.size > 12 * 1024 * 1024 || !/\.(woff2?|ttf|otf)$/i.test(file.name)) throw new Error('WOFF2 / WOFF / TTF / OTF（12MB以内）を選択してください。');
  const buffer = await file.arrayBuffer(), bytes = new Uint8Array(buffer);
  const magic = String.fromCharCode(...bytes.slice(0,4));
  if (!['wOF2','wOFF','OTTO','true'].includes(magic) && !(bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)) throw new Error('フォントファイルの形式を確認してください。');
  const id = crypto.randomUUID(), family = `moku-${id}`, name = file.name.replace(/\.[^.]+$/, '').slice(0,160);
  const ext = file.name.split('.').at(-1)!.toLowerCase(); let binary='';
  for (let i=0;i<bytes.length;i+=32768) binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const src = `data:font/${ext};base64,${btoa(binary)}`;
  const face = await new FontFace(family, `url(${src})`, { weight:'100 900' }).load(); document.fonts.add(face);
  return {id,name,family,src,weight:'100 900',unicodeRange:'',style:'normal'};
}
