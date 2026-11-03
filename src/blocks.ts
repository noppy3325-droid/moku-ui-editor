import { clone, newNode, uid } from './model';
import type { UINode } from './model';

export const themes = [
  {id:'nomad',name:'Nomad',bg:'#FFFDF7',surface:'#FFFFFF',text:'#293A32',muted:'#7C847B',accent:'#D4A373',font:'"Noto Sans JP", sans-serif',radius:16},
  {id:'minimal',name:'Minimal',bg:'#F8FAFC',surface:'#FFFFFF',text:'#0F172A',muted:'#64748B',accent:'#2563EB',font:'"Inter", "Noto Sans JP", sans-serif',radius:12},
  {id:'editorial',name:'Editorial',bg:'#F3EEE6',surface:'#FFFBF5',text:'#392A22',muted:'#9B8270',accent:'#7D3E2C',font:'"Noto Serif JP", serif',radius:2},
  {id:'playful',name:'Playful',bg:'#FFF8FC',surface:'#FFFFFF',text:'#4C1D61',muted:'#9C80A7',accent:'#DB2777',font:'"Nunito", "Noto Sans JP", sans-serif',radius:24},
  {id:'midnight',name:'Midnight',bg:'#0F1221',surface:'#1C2135',text:'#F1F5FF',muted:'#9CA9C8',accent:'#A78BFA',font:'"Space Grotesk", "Noto Sans JP", sans-serif',radius:16},
  {id:'bold',name:'Bold',bg:'#FDE047',surface:'#FFFFFF',text:'#18181B',muted:'#52525B',accent:'#7C3AED',font:'"Inter", "Noto Sans JP", sans-serif',radius:0},
];
export type StudioTheme=typeof themes[number];
export const blocks = [
  {id:'hero',name:'ヒーロー',description:'見出し・説明・行動ボタン',tag:'はじめの一画面'},
  {id:'product',name:'商品カード',description:'写真・価格・購入ボタン',tag:'EC'},
  {id:'login',name:'ログイン',description:'メール・パスワード・ボタン',tag:'フォーム'},
  {id:'profile',name:'プロフィール',description:'アバター・紹介・フォロー',tag:'SNS'},
  {id:'pricing',name:'料金プラン',description:'価格・特徴・申し込み',tag:'サービス'},
  {id:'stats',name:'ダッシュボード',description:'指標・数値・トレンド',tag:'業務'},
  {id:'article',name:'記事カード',description:'カバー写真・見出し・日付',tag:'メディア'},
  {id:'feature',name:'機能の紹介',description:'アイコン・タイトル・本文',tag:'サービス'},
  {id:'notification',name:'通知カード',description:'通知・説明・アクション',tag:'状態'},
  {id:'navigation',name:'ナビゲーション',description:'ロゴ・リンク・アイコン',tag:'ナビ'},
  {id:'dialog',name:'確認ダイアログ',description:'タイトル・説明・2つのボタン',tag:'状態'},
  {id:'search',name:'検索とフィルター',description:'検索欄・絞り込み・見出し',tag:'探す'},
];

export function buildBlock(key:string, theme:StudioTheme=themes[0]):UINode[] {
  const root=newNode('container',0,0);root.name=blocks.find(b=>b.id===key)?.name??'ブロック';root.width=340;root.height=300;
  Object.assign(root.styles,{background:theme.surface,radius:theme.radius,borderWidth:theme.id==='bold'?2:1,borderColor:theme.id==='bold'?theme.text:theme.muted+'30',color:theme.text,fontFamily:theme.font});
  const nodes=[root],buttonInk=['nomad','midnight'].includes(theme.id)?'#302D28':'#FFFFFF';
  const add=(type:UINode['type'],name:string,x:number,y:number,w:number,h:number,text='',style:Partial<UINode['styles']>={})=>{
    const n=newNode(type,x,y);Object.assign(n,{name,parentId:root.id,width:w,height:h,zIndex:nodes.length});n.properties.text=text;
    Object.assign(n.styles,{fontFamily:theme.font,background:type==='button'?theme.accent:'transparent',color:type==='button'?buttonInk:theme.text,radius:type==='button'?Math.min(theme.radius,14):0,borderWidth:0,fontSize:14,accent:theme.accent},style);nodes.push(n);return n;
  };
  const text=(name:string,x:number,y:number,w:number,h:number,value:string,size=14,weight=400,color=theme.text)=>add('text',name,x,y,w,h,value,{fontSize:size,fontWeight:weight,color,lineHeight:1.5});
  const title=(value:string,y=30,size=26)=>text('見出し',24,y,292,Math.ceil(size*3.1),value,size,700);
  const button=(value:string,y:number)=>add('button','メインボタン',24,y,292,48,value,{fontWeight:600});
  if(key==='hero'){
    root.height=370;root.styles.background=theme.bg;text('ラベル',24,28,292,22,'MAKE SOMETHING GREAT',10,600,theme.accent);title('思い描いた、\nその先へ。',74,34);text('説明文',24,202,292,58,'小さなアイデアが、次の体験になる。\nあなたらしい一歩を、ここから。',14,400,theme.muted);button('さっそく始める　→',290);
  } else if(key==='product'||key==='article'){
    root.height=key==='product'?406:340;const image=add('image','カバー写真',12,12,316,188);image.properties.src='/assets/mountain.jpg';image.styles.radius=Math.max(0,theme.radius-5);
    text('カテゴリ',24,218,292,20,key==='product'?'NEW COLLECTION':'STORIES / 2026',10,600,theme.accent);text('タイトル',24,248,292,44,key==='product'?'毎日を軽くする、ひとつ。':'余白のある暮らしを探して',20,600);
    if(key==='product'){text('価格',24,294,292,30,'¥12,800',20,700);button('カートに入れる',344);}else text('記事の説明',24,294,292,25,'新しい視点に出会う、小さな旅へ。',12,400,theme.muted);
  } else if(key==='login'){
    root.height=400;title('おかえりなさい',30,25);text('説明文',24,83,292,25,'あなたのワークスペースへログイン',12,400,theme.muted);
    ['メールアドレス','パスワード'].forEach((label,i)=>{text(label,24,130+i*83,292,20,label,11,600);add('input',label,24,157+i*83,292,45,i?'パスワードを入力':'you@example.com',{background:theme.bg,borderWidth:1,borderColor:theme.muted+'50',radius:8,fontSize:13});});button('ログイン',316);text('補足',24,372,292,20,'アカウントをお持ちでない方は登録',10,400,theme.muted);
  } else if(key==='profile'){
    root.height=330;const avatar=add('avatar','プロフィール画像',24,28,72,72,'N',{background:theme.accent+'25',color:theme.accent,fontSize:28});avatar.styles.radius=999;
    text('名前',24,120,292,36,'山田 はるか',25,700);text('肩書き',24,166,292,24,'Designer & Maker',12,500,theme.accent);text('紹介文',24,204,292,50,'日常に、心が動く瞬間を。\nデザインとものづくりの記録。',13,400,theme.muted);button('フォローする',270);
  } else if(key==='pricing'){
    root.height=410;text('プラン名',24,26,292,24,'PRO PLAN',12,600,theme.accent);title('¥1,980 / 月',73,32);text('説明文',24,140,292,30,'もっと自由に、もっと遠くへ。',13,400,theme.muted);text('プランの内容',24,202,292,122,'✓　プロジェクト数は無制限\n✓　すべての書き出し形式\n✓　充実のカスタマイズ',14,400);button('このプランを選ぶ',340);
  } else if(key==='stats'){
    root.height=240;text('指標名',24,26,292,24,'月間の売上',12,500,theme.muted);title('¥248,600',72,37);text('前月比',24,144,292,25,'↗  12.8%   前月から増加',12,600,theme.accent);for(let i=0;i<10;i++)add('rectangle',`棒グラフ ${i+1}`,24+i*29,216-(i%3+1)*12,18,(i%3+1)*12,'',{background:theme.accent,opacity:.25+i*.07,radius:3});
  } else if(key==='feature'){
    root.height=260;const icon=add('icon','機能アイコン',24,26,48,48,'',{background:theme.accent+'20',color:theme.accent,radius:12});icon.properties.icon='Sparkles';title('想像を、すぐに形へ。',100,23);text('説明文',24,159,292,66,'必要なものを、必要な場所に。\n迷わない操作で、アイデアを\n次のステップにつなげます。',14,400,theme.muted);
  } else if(key==='notification'){
    root.height=200;const icon=add('icon','通知アイコン',24,25,32,32,'',{color:theme.accent});icon.properties.icon='Bell';text('通知タイトル',68,28,248,28,'新しいお知らせ',18,600);text('通知内容',24,81,292,48,'作業が完了しました。\nいつでも内容を確認できます。',13,400,theme.muted);add('button','詳細ボタン',208,143,108,35,'詳細を見る',{fontSize:12,radius:8});
  } else if(key==='navigation'){
    root.height=76;root.styles.radius=0;text('ブランド',20,23,135,34,'moku.',23,700);text('リンク',177,28,95,25,'サービス',12,500);const icon=add('icon','メニューアイコン',289,23,30,30,'',{color:theme.text});icon.properties.icon='Menu';
  } else if(key==='dialog'){
    root.height=230;title('変更を保存しますか？',25,22);text('説明文',24,88,292,52,'編集した内容を保存します。\nこの操作はあとから取り消せます。',13,400,theme.muted);add('button','キャンセル',24,164,140,42,'キャンセル',{background:theme.bg,color:theme.text,radius:8});add('button','保存ボタン',176,164,140,42,'保存する',{radius:8});root.styles.shadow=true;
  } else {
    root.height=220;title('次の発見を探す',26,24);add('search','検索欄',24,93,292,46,'キーワードで検索',{background:theme.bg,borderWidth:1,borderColor:theme.muted+'40',radius:10,color:theme.muted});['すべて','人気','新着'].forEach((label,i)=>add('button',`フィルター ${label}`,24+i*99,159,91,35,label,{background:i?theme.bg:theme.accent,color:i?theme.muted:buttonInk,radius:18,fontSize:11}));
  }
  root.children=nodes.slice(1).map(n=>n.id);return nodes;
}

export const expandableTypes=['card','navbar','list','stat','alert'];
export function expandNode(n:UINode):UINode[] {
  if(!expandableTypes.includes(n.type))return [clone(n)];
  const root=clone(n);root.type='container';root.layout.mode='free';root.styles.clipContent=true;root.styles.padding.enabled=false;root.properties.text='';const nodes=[root],lines=n.properties.text.split(/\r?\n/),w=n.width-n.styles.borderWidth*2,h=n.height-n.styles.borderWidth*2,fs=n.styles.fontSize;
  const part=(type:UINode['type'],name:string,x:number,y:number,width:number,height:number,text:string,size=fs,weight=n.styles.fontWeight,opacity=1)=>{
    const child=newNode(type,x,y);Object.assign(child,{name,parentId:root.id,width:Math.max(1,width),height:Math.max(1,height),zIndex:nodes.length});child.properties.text=text;
    Object.assign(child.styles,clone(n.styles),{background:'transparent',gradient:{...n.styles.gradient,type:'none'},corners:{...n.styles.corners,enabled:false},padding:{...n.styles.padding,enabled:false},shadow:false,blur:0,backdropBlur:0,clipContent:false,borderWidth:0,radius:0,opacity,fontSize:size,fontWeight:weight,autoHeight:false});nodes.push(child);return child;
  };
  const pad=n.styles.padding;
  if(n.type==='card'){
    const left=pad.enabled?pad.left:14,top=pad.enabled?pad.top:14,right=pad.enabled?pad.right:14,bottom=pad.enabled?pad.bottom:14,iw=w-left-right,ih=(h-top-bottom)*.55;
    part('rectangle','画像エリア',left,top,iw,ih,'').styles.background='#EEE6D8';nodes.at(-1)!.styles.radius=7;
    const icon=part('icon','画像プレースホルダー',left+(iw-27)/2,top+(ih-27)/2,27,27,'');icon.properties.icon='Image';icon.properties.iconSize=27;icon.styles.color='#B09B7A';
    const ty=top+ih+10,th=fs*n.styles.lineHeight;part('text','タイトル',left,ty,iw,th,lines[0],fs,600);
    if(lines.length>1){const body=part('text','説明',left,ty+th+3,iw,Math.max(1,h-(ty+th+3)-bottom),lines.slice(1).join('\n'),fs*.8,n.styles.fontWeight,.65);body.styles.lineHeight=1.6;}
  }else if(n.type==='navbar'){
    const left=pad.enabled?pad.left:16,right=pad.enabled?pad.right:16;
    part('icon','戻るアイコン',left,(h-19)/2,19,19,'').properties.icon='ArrowLeft';
    const t=part('text','タイトル',left+33,0,w-left-right-66,h,n.properties.text);t.styles.textAlign='center';t.styles.verticalAlign='center';
    part('icon','メニューアイコン',w-right-19,(h-19)/2,19,19,'').properties.icon='Menu';
  }else if(n.type==='stat'){
    const sizes=[fs*.85,fs*1.9,fs*.72],heights=[sizes[0]*n.styles.lineHeight,sizes[1]*1.2,sizes[2]*1.6],top=(h-heights.reduce((a,b)=>a+b,0)-16)/2;
    let y=Math.max(17,top);[lines[0],lines[1]||'0',lines.slice(2).join('\n')].forEach((value,i)=>{const t=part('text',['指標','数値','補足'][i],19,y,w-38,heights[i],value,sizes[i],i===1?700:n.styles.fontWeight,i===0?.65:i===2?.6:1);if(i===1)t.styles.lineHeight=1.2;if(i===2)t.styles.lineHeight=1.6;y+=heights[i]+8;});
  }else{
    const alert=n.type==='alert',left=alert?44:14,right=alert?14:43,titleHeight=fs*(alert?.95:1)*n.styles.lineHeight,bodyHeight=lines.length>1?fs*.8*1.6*(lines.length-1):0,top=alert?13:(h-titleHeight-bodyHeight-(bodyHeight?3:0))/2;
    part('text','タイトル',left,top,w-left-right,titleHeight,lines[0],alert?fs*.95:fs,600);
    if(lines.length>1){const body=part('text','説明',left,top+titleHeight+3,w-left-right,bodyHeight,lines.slice(1).join('\n'),fs*(alert?.83:.8),n.styles.fontWeight,alert?1:.65);body.styles.lineHeight=alert?1.7:1.6;}
    const icon=part('icon',alert?'状態アイコン':'矢印',alert?14:w-31,alert?16:(h-17)/2,alert?20:17,alert?20:17,'');icon.properties.icon=alert?n.properties.icon:'ChevronRight';
  }
  root.children=nodes.slice(1).map(n=>n.id);return nodes;
}

export function freshNodes(source:UINode[],x=24,y=100):UINode[] {
  const nodes=clone(source),map=new Map(nodes.map(n=>[n.id,uid()]));
  const roots=nodes.filter(n=>!n.parentId||!map.has(n.parentId)),left=Math.min(...roots.map(n=>n.x)),top=Math.min(...roots.map(n=>n.y));
  return nodes.map(n=>({...n,id:map.get(n.id)!,parentId:n.parentId&&map.has(n.parentId)?map.get(n.parentId)!:null,children:n.children.map(id=>map.get(id)!).filter(Boolean),x:n.x+(!n.parentId||!map.has(n.parentId)?x-left:0),y:n.y+(!n.parentId||!map.has(n.parentId)?y-top:0),actions:n.actions.map(a=>({...a,id:uid()}))}));
}
