import { expect, it } from 'vitest';
import { createProject, newNode, parseProject } from './model';
import { nodeCSS } from './Renderer';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TypographyControls } from './TypographyControls';
import { fontCatalog, portableFonts } from './fonts';
import { useEditor } from './store';

it('フォントの追加でロック済みの文字や別プロジェクトを変更しない',()=>{
  const p=createProject(true),n=newNode('text');n.locked=true;p.screens[0].nodes.push(n);useEditor.getState().loadProject(p);
  const f={id:'custom',name:'Custom',family:'moku-custom',src:'data:font/woff2;base64,d09GMg==',weight:'400',style:'normal' as const,unicodeRange:''};
  expect(typeof useEditor.getState().addFont).toBe('function');useEditor.getState().addFont(f,[n.id],p.id);
  expect(useEditor.getState().project.screens[0].nodes[0].styles.fontFamily).toBe('"Noto Sans JP", sans-serif');
  const second=createProject(true);useEditor.getState().loadProject(second);useEditor.getState().addFont(f,[n.id],p.id);expect(useEditor.getState().project.fonts).toHaveLength(0);
});

it('本番圧縮CSSの末尾セミコロンがなくても、書き出したフォントを再読込できる',async()=>{
  const inter=fontCatalog.find(f=>f.id==='inter')!,old=inter.css;
  inter.css='@font-face{font-family:Inter;font-style:normal;font-weight:100 900;src:url("data:font/woff2;base64,d09GMg==");unicode-range:U+0000-00FF}';
  try {const p=createProject(true),n=newNode('text');n.styles.fontFamily='Inter, sans-serif';n.properties.text='Hello';p.screens[0].nodes.push(n);p.fonts=await portableFonts(p);expect(p.fonts[0].unicodeRange).toBe('U+0000-00FF');expect(()=>parseProject(p)).not.toThrow();}finally{inter.css=old;}
});

it('欧文フォントを選んだときに日本語の代替フォントを選択表示しない', () => {
  const n=newNode('text');n.styles.fontFamily='"Space Grotesk", "Noto Sans JP", sans-serif';
  expect(renderToStaticMarkup(createElement(TypographyControls,{node:n}))).toContain('>Space Grotesk</span>');
});

it('持ち込んだフォントをJSONで保持し、不正な外部参照を拒否する', () => {
  const p = createProject(true);
  Object.assign(p, { fonts: [{ id: 'font-1', name: 'My Font', family: 'moku-font-1', src: 'data:font/woff2;base64,d09GMg==', weight: '100 900' }] });
  expect((parseProject(p) as typeof p & { fonts: unknown[] }).fonts).toHaveLength(1);
  Object.assign(p, { fonts: [{ id: 'font-1', name: 'Bad', family: 'bad', src: 'https://unknown.example/font.woff2', weight: '400' }] });
  expect(() => parseProject(p)).toThrow();
});
it('文字の装飾を描画に反映する', () => {
  const n = newNode('text');
  Object.assign(n.styles, { fontStyle: 'italic', textDecoration: 'underline', textTransform: 'uppercase' });
  expect(nodeCSS(n)).toMatchObject({ fontStyle: 'italic', textDecoration: 'underline', textTransform: 'uppercase' });
});
