import { useEffect, useState } from 'react';
import { Copy, Layers, Paintbrush, Save } from 'lucide-react';
import { expandableTypes } from './blocks';
import type { UINode } from './model';
import { useEditor } from './store';
export function ReuseControls({node:n}:{node:UINode}) {
  const st=useEditor(),[name,setName]=useState(n.name),screen=st.project.screens.find(s=>s.id===st.screenId)!;
  useEffect(()=>setName(n.name),[n.id,n.name]);
  return <><section className="inspector-section reuse-section"><h3>見た目を再利用 <span className="studio-label">REUSE</span></h3><div className="two-buttons"><button onClick={st.copyStyle}><Copy size={12}/>見た目をコピー</button><button disabled={!st.styleClipboard} onClick={st.pasteStyle}><Paintbrush size={12}/>貼り付け</button></div><div className="save-component"><input aria-label="保存する部品の名前" value={name} maxLength={200} onChange={e=>setName(e.target.value)}/><button aria-label="自分の部品に保存" onClick={()=>st.saveComponent(name)} title="自分の部品に保存"><Save size={14}/></button></div><small className="field-caption">選択したパーツと中身を、ひな形タブに保存。</small>
    {expandableTypes.includes(n.type)&&<button className="outline-button full expand-part" onClick={st.expandSelection}><Layers size={13}/>中身を編集できるレイヤーに展開</button>}
    </section><details className="inspector-details"><summary>入れる枠・グループ</summary><div className="details-inner"><select aria-label="親コンテナ" value={n.parentId??''} onChange={e=>st.reparent(e.target.value||null)}><option value="">画面の直下</option>{screen.nodes.filter(v=>v.type==='container'&&!st.selected.includes(v.id)).map(v=><option value={v.id} key={v.id}>{v.name}</option>)}</select><small className="field-caption">自由配置の枠へ移すときは、見た目の位置を保ちます。</small></div></details></>;
}
