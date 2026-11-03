import { useMemo, useState } from 'react';
import { ArrowUpRight, Layers, Plus, Trash2 } from 'lucide-react';
import { blocks, buildBlock, themes } from './blocks';
import { newScreen } from './model';
import { ScreenRenderer } from './Renderer';
import { useEditor } from './store';

function BlockThumbnail({id,themeId}:{id:string;themeId:string}) {
  const screen=useMemo(()=>{const s=newScreen(),nodes=buildBlock(id,themes.find(t=>t.id===themeId));return {...s,width:340,height:nodes[0].height,nodes,background:'transparent',viewportSettings:{statusBar:false,deviceFrame:false,safeArea:false,scrollHeight:nodes[0].height}};},[id,themeId]);
  return <div className="block-thumbnail" aria-hidden="true" inert><div style={{transform:'scale(.58)',transformOrigin:'top left',width:340,height:screen.height}}><ScreenRenderer screen={screen}/></div></div>;
}
export function StudioLibrary(){
  const st=useEditor(),[themeId,setThemeId]=useState('nomad'),[mode,setMode]=useState<'blocks'|'saved'>('blocks'),[search,setSearch]=useState(''),theme=themes.find(t=>t.id===themeId)!;
  return <div className="studio-library"><div className="studio-library-intro"><span className="studio-eyebrow">A LITTLE HEAD START</span><h3>思い描く、に近いところから。</h3><p>置いたあとも、文字も写真も<br/>ひとつずつ自由に編集できます。</p></div>
    <div className="library-mode"><button aria-pressed={mode==='blocks'} onClick={()=>setMode('blocks')}>ひな形 <span>{blocks.length}</span></button><button aria-pressed={mode==='saved'} onClick={()=>setMode('saved')}>自分の部品 <span>{st.project.library.length}</span></button></div>
    {mode==='blocks'?<><div className="theme-picker" aria-label="ひな形のテーマ">{themes.map(t=><button key={t.id} title={t.name} aria-label={`${t.name}テーマ`} aria-pressed={themeId===t.id} onClick={()=>setThemeId(t.id)}><i style={{background:t.bg,borderColor:t.text}}><b style={{background:t.accent}}/></i><span>{t.name}</span></button>)}</div><div className="studio-search"><input aria-label="ひな形を検索" placeholder="カード・フォーム・業務…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="block-gallery">{blocks.filter(b=>`${b.name} ${b.description} ${b.tag}`.includes(search)).map(b=><article className="block-card" key={b.id}><div role="button" tabIndex={0} className="block-main" onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();st.insertBlock(b.id,themeId);}}} aria-label={`${b.name}を配置`} onClick={()=>st.insertBlock(b.id,themeId)} style={{background:theme.bg}}><BlockThumbnail id={b.id} themeId={themeId}/><div className="block-card-heading"><span>{b.name}</span><Plus size={13}/></div></div><div className="block-card-footer"><small>{b.tag}</small><button aria-label={`${b.name}を新しい画面で試す`} title="新しい画面に配置する" onClick={()=>{st.addScreen();st.patchScreen({background:theme.bg,name:b.name});st.insertBlock(b.id,themeId);}}><ArrowUpRight size={12}/>新しい画面</button></div></article>)}</div></>:<div className="saved-library">{st.project.library.map(c=><article className="saved-part" key={c.id}><Layers size={20}/><div><strong>{c.name}</strong><small>{c.nodes.length}レイヤー · 自由に編集</small></div><button className="tiny-button" aria-label={`${c.name}を再利用`} onClick={()=>st.insertComponent(c.id)}><Plus size={16}/></button><button className="tiny-button" aria-label={`${c.name}をライブラリから削除`} onClick={()=>st.deleteComponent(c.id)}><Trash2 size={12}/></button></article>)}{!st.project.library.length&&<div className="studio-library-empty"><Layers size={28}/><h4>気に入ったら、もう一度。</h4><p>パーツを選び、右側の<br/>「自分の部品に保存」から登録。<br/>別の画面でもすぐ使えます。</p></div>}</div>}
  </div>;
}
