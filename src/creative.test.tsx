import { describe, expect, it } from 'vitest';
import { createProject, newNode, parseProject } from './model';
import { nodeCSS } from './Renderer';
import { ScreenRenderer } from './Renderer';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { legacyProject } from './fixtures/legacy-v1';
import { useEditor } from './store';
import { ColorField } from './inputs';

describe('自由な見た目と旧データ', () => {
  it('半透明色の実際の不透明度を色の欄に表示する',()=>{
    expect(renderToStaticMarkup(createElement(ColorField,{label:'色',value:'#00000040',onChange:()=>{}}))).toContain('<span>25%</span>');
    const short=renderToStaticMarkup(createElement(ColorField,{label:'色',value:'#f008',onChange:()=>{}}));expect(short).toContain('<span>53%</span>');expect(short).toContain('value="#ff0000"');
  });
  it('実際に旧版から書き出したデータを、文字と外観を保って読み込む',()=>{
    const p=parseProject(legacyProject);expect(p.version).toBe('1.0');expect(p.fonts).toEqual([]);expect(p.library).toEqual([]);expect(p.screens[0].nodes[0].properties.text).toBe('yohaku.');expect(nodeCSS(p.screens[0].nodes[0]).background).toBe('transparent');
  });
  it('旧データに新しい装飾を付けたら書き出しスキーマをv2にする',()=>{
    const p=parseProject(legacyProject);useEditor.getState().loadProject(p);useEditor.getState().patchStyles([p.screens[0].nodes[0].id],{gradient:{type:'linear',angle:90,from:'#000000',to:'#ffffff'}});expect(useEditor.getState().project.version).toBe('2.0');
  });
  it('暗い画面でもステータスバーの文字を読める色にする',()=>{
    const p=createProject(true),screen=p.screens[0];
    for(const bg of ['#0F1221','#000000','#000']){screen.background=bg;expect(renderToStaticMarkup(createElement(ScreenRenderer,{screen}))).toContain('--device-ink:#ffffff');}
    screen.background='#FFFDF7';expect(renderToStaticMarkup(createElement(ScreenRenderer,{screen}))).toContain('--device-ink:#302d28');
  });
  it('旧プロジェクトの見た目を保ちながら装飾の既定値を補完する', () => {
    const raw = createProject(true);
    const n = newNode('button');
    raw.screens[0].nodes.push(n);
    delete (n.styles as Partial<typeof n.styles>).gradient;
    const parsed = parseProject(raw);
    expect(parsed.screens[0].nodes[0].styles.gradient).toEqual({ type: 'none', angle: 135, from: '#D4A373', to: '#0891B2' });
    expect(nodeCSS(parsed.screens[0].nodes[0]).background).toBe('#D4A373');
  });
  it('選んだ塗り・個別角丸・内側の影を同じ描画スタイルへ変換する', () => {
    const n = newNode('rectangle');
    Object.assign(n.styles, { gradient: { type: 'linear', angle: 90, from: '#ff0000', to: '#0000ff' }, corners: { enabled: true, topLeft: 4, topRight: 12, bottomRight: 24, bottomLeft: 0 }, shadow: true, shadowStyle: { x: 2, y: 6, blur: 18, spread: -2, color: '#00000040', inset: true }, borderStyle: 'dashed' });
    expect(nodeCSS(n)).toMatchObject({ background: 'linear-gradient(90deg, #ff0000, #0000ff)', borderRadius: '4px 12px 24px 0px', boxShadow: 'inset 2px 6px 18px -2px #00000040', borderStyle: 'dashed' });
  });
  it('不正な装飾値をJSONから受け入れない', () => {
    const p = createProject(true), n = newNode('text');
    Object.assign(n.styles, { gradient: { type: 'linear', angle: 90, from: 'url(javascript:alert(1))', to: '#ffffff' } });
    p.screens[0].nodes.push(n);
    expect(() => parseProject(p)).toThrow();
  });
});
