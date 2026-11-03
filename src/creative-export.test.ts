import { expect, it } from 'vitest';
import { createProject, newNode, parseProject } from './model';
import { html, markdown, portableProject } from './exports';

it('HTMLに使用フォントを埋め込み、細かい装飾を維持する', () => {
  const p=createProject(true),n=newNode('text');n.properties.text='Hello';n.styles.fontFamily='"moku-custom", sans-serif';n.styles.gradient={type:'linear',angle:45,from:'#ff0000',to:'#0000ff'};
  p.fonts=[{id:'custom',name:'Custom',family:'moku-custom',src:'data:font/woff2;base64,d09GMg==',weight:'400',style:'normal',unicodeRange:''}];p.screens[0].nodes.push(n);
  const code=html(p);expect(code).toContain('@font-face');expect(code).toContain('data:font/woff2;base64,d09GMg==');expect(code).toContain('linear-gradient(45deg, #ff0000, #0000ff)');
});
it('仕様書へ塗りと影の詳細を渡す',()=>{
  const p=createProject(true),n=newNode('button');n.styles.gradient={type:'linear',angle:45,from:'#112233',to:'#445566'};n.styles.shadow=true;n.styles.shadowStyle={x:4,y:8,blur:24,spread:-2,color:'#00000040',inset:false};p.screens[0].nodes.push(n);
  const code=markdown(p);expect(code).toContain('#112233');expect(code).toContain('#445566');expect(code).toContain('24px');
});
it('自分の部品とフォントを持ち運び用JSONに保持する',async()=>{
  const p=createProject(true),n=newNode('text');n.styles.fontFamily='"moku-custom", sans-serif';p.screens[0].nodes.push(n);p.library.push({id:'saved',name:'保存部品',nodes:[structuredClone(n)]});p.fonts=[{id:'custom',name:'Custom',family:'moku-custom',src:'data:font/woff2;base64,d09GMg==',weight:'400',style:'normal',unicodeRange:''}];
  const copy=parseProject(await portableProject(p));expect(copy.fonts[0].family).toBe('moku-custom');expect(copy.library[0].nodes[0].properties.text).toBe(n.properties.text);
});
