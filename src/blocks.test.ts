import { expect, it } from 'vitest';
import { createProject, newNode, parseProject } from './model';
import { useEditor } from './store';
import { blocks, buildBlock, themes } from './blocks';
import { reflowScreen, worldGeometry } from './editor-geometry';

it('グリッドの列数を変えても間隔と行の高さを保つ', () => {
  const p=createProject(true),parent=newNode('container',0,0);parent.width=320;parent.layout={mode:'grid',padding:10,gap:10,align:'start'};Object.assign(parent.layout,{columns:3});
  const children=Array.from({length:4},()=>{const n=newNode('rectangle');n.parentId=parent.id;n.width=50;n.height=50;return n;});p.screens[0].nodes=[parent,...children];reflowScreen(p.screens[0]);
  expect(children[1].x).toBeCloseTo(113.333333);expect(children[3].x).toBe(10);expect(children[3].y).toBe(70);
});

it('全テーマの完成ブロックが、個別編集と保存に使えるレイヤーになる', () => {
  for(const theme of themes) for(const block of blocks) {
    const p=createProject(true),nodes=buildBlock(block.id,theme);p.screens[0].nodes=nodes;
    expect(()=>parseProject(p)).not.toThrow();
    expect(nodes[0].type).toBe('container');expect(nodes.some(n=>n.type==='text')).toBe(true);
    expect(new Set(nodes.map(n=>n.id)).size).toBe(nodes.length);
    expect(nodes.slice(1).every(n=>n.parentId===nodes[0].id)).toBe(true);
  }
});

it('選択を自分の部品へ保存し、別IDで再挿入してUndoできる', () => {
  const p=createProject(true),n=newNode('button',20,30);p.screens[0].nodes.push(n);
  const st=useEditor.getState();st.loadProject(p);st.select([n.id]);
  expect(typeof (useEditor.getState() as unknown as {saveComponent:unknown}).saveComponent).toBe('function');
  useEditor.getState().saveComponent('My button');
  const saved=useEditor.getState().project.library[0];
  expect(parseProject(useEditor.getState().project).library[0].name).toBe('My button');
  useEditor.getState().insertComponent(saved.id);
  const nodes=useEditor.getState().project.screens[0].nodes;
  expect(nodes).toHaveLength(2);expect(nodes[1].id).not.toBe(n.id);expect(nodes[1].properties.text).toBe(n.properties.text);
  useEditor.getState().undo();expect(useEditor.getState().project.screens[0].nodes).toHaveLength(1);
});
it('部品の中身を実際の子レイヤーへ展開する', () => {
  const p=createProject(true),n=newNode('card',20,40);p.screens[0].nodes.push(n);
  useEditor.getState().loadProject(p);useEditor.getState().select([n.id]);
  expect(typeof useEditor.getState().expandSelection).toBe('function');useEditor.getState().expandSelection();
  const nodes=useEditor.getState().project.screens[0].nodes;
  expect(nodes.find(v=>v.id===n.id)?.type).toBe('container');
  expect(nodes.filter(v=>v.parentId===n.id).some(v=>v.type==='text')).toBe(true);
  useEditor.getState().undo();expect(useEditor.getState().project.screens[0].nodes).toHaveLength(1);
});
it('既存カードの展開で値段や購入ボタンを勝手に追加しない',()=>{
  const p=createProject(true),n=newNode('card');n.properties.text='自分で作ったタイトル\n自分で書いた説明';p.screens[0].nodes.push(n);useEditor.getState().loadProject(p);useEditor.getState().select([n.id]);useEditor.getState().expandSelection();
  const nodes=useEditor.getState().project.screens[0].nodes;
  expect(nodes.filter(v=>v.type==='text').map(v=>v.properties.text)).toEqual(['自分で作ったタイトル','自分で書いた説明']);
  expect(nodes.some(v=>v.type==='button')).toBe(false);expect(nodes.some(v=>v.properties.text.includes('12,800'))).toBe(false);
});
it('ライブラリの重複IDや循環する階層をJSONの読込時に拒否する',()=>{
  const p=createProject(true),n=newNode('text');p.library.push({id:'saved',name:'Bad',nodes:[n,structuredClone(n)]});expect(()=>parseProject(p)).toThrow();
  const a=newNode('container'),b=newNode('container');a.parentId=b.id;b.parentId=a.id;p.library[0].nodes=[a,b];expect(()=>parseProject(p)).toThrow();
});
it('親を変更しても座標を保ち、循環する階層を作らない', () => {
  const p=createProject(true),parent=newNode('container',100,100),n=newNode('text',150,150);p.screens[0].nodes.push(parent,n);
  useEditor.getState().loadProject(p);useEditor.getState().select([n.id]);
  expect(typeof useEditor.getState().reparent).toBe('function');useEditor.getState().reparent(parent.id);
  const child=useEditor.getState().project.screens[0].nodes.find(v=>v.id===n.id)!;
  expect(child.parentId).toBe(parent.id);expect(child.x).toBe(50);expect(child.y).toBe(50);
  useEditor.getState().select([parent.id]);useEditor.getState().reparent(n.id);
  expect(useEditor.getState().project.screens[0].nodes.find(v=>v.id===parent.id)?.parentId).toBe(null);
});
