// data/teams/teams.json を生成する。
// - 安全な揺れ（NFKC＋空白＋中黒）を畳む。既存 team-name-aliases.json の正準名も取り込む。
// - id は連番。name は最頻出の生表記。prefecture は実県modeだが、
//   実県カバー率が低いチーム（大学・連盟系など）は信頼できないため null。
// - 実県が複数に割れるチームは reviewPrefectures（同名別校の確認用）。
// 使い方: node scripts/build-team-master.mjs
import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';
import {toHalfWidthAscii} from './lib/halfwidth.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DET=path.join(ROOT,'data','tournaments','details');
const COV_MIN=0.4, SHARE_MIN=0.5;
const REAL=new Set(['北海道','東京都','大阪府','京都府',...'青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄'.split(/\s+/).map(k=>k+'県')]);
const norm=s=>s==null?s:s.normalize('NFKC').replace(/[ 　]/g,'').replace(/[･•]/g,'・');
// 大会id -> ジャンル（学校段階/社会人/シニア）。オープン・国際・ジュニア代表等は null。
const catOf=(tid)=>{
  if(tid.startsWith('primaryschool')||tid==='zennihon-primaryschool')return '小';
  if(tid.includes('secondaryschool'))return '中';
  if(tid.startsWith('highschool'))return '高';
  if(tid.startsWith('zennihon-university'))return '大';
  // 社会人とシニアは同じ成人カテゴリ（同一人物が両方に出る）ため統合する。
  if(tid==='zennihon-workers'||tid==='zennihon-business-group'||tid==='zennihon-club'||tid==='zennihon-senior')return '成';
  return null;};
// 既存エイリアス
const aliasRaw=new Map();
try{const at=JSON.parse(fs.readFileSync(path.join(ROOT,'data','tournaments','team-name-aliases.json'),'utf8'));
for(const e of at.teamAliases||[])for(const a of e.aliases||[])aliasRaw.set(norm(a),e.canonical);}catch{}
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);
return e.isDirectory()?(e.name==='temp'?[]:walk(p)):(e.name.endsWith('.json')?[p]:[]);});
const rawC=new Map(),prefC=new Map(),tot=new Map();
const playerC=new Map(),eventC=new Map(),yearsK=new Map(),genreK=new Map(),instK=new Map(); // 文脈: 選手名/大会/年/ジャンル/大会インスタンス
const inc=(m,k,v)=>{let x=m.get(k);if(!x){x=new Map();m.set(k,x);}x.set(v,(x.get(v)||0)+1);};
for(const f of walk(DET)){let d;try{d=JSON.parse(fs.readFileSync(f,'utf8'));}catch{continue;}
const rel=path.relative(DET,f).split(path.sep);const tid=rel[0];const ym=rel[1];const year=/^\d{4}$/.test(ym)?+ym:null;
for(const p of d.participants||[]){const raw=p.team;if(!raw)continue;
const n=norm(raw);const canon=aliasRaw.get(n);const key=canon?norm(canon):n;
inc(rawC,key,raw);tot.set(key,(tot.get(key)||0)+1);
if(REAL.has(p.prefecture))inc(prefC,key,p.prefecture);
const nm=((p.lastName||'')+(p.firstName||'')).trim();if(nm)inc(playerC,key,nm);
inc(eventC,key,tid);
const ct=catOf(tid);if(ct){let gs=genreK.get(key);if(!gs){gs=new Set();genreK.set(key,gs);}gs.add(ct);}
if(year){let ys=yearsK.get(key);if(!ys){ys=new Set();yearsK.set(key,ys);}ys.add(year);}
{let is=instK.get(key);if(!is){is=new Set();instK.set(key,is);}is.add(tid+'|'+(year??'?'));}}}
const top=m=>[...m.entries()].sort((a,b)=>b[1]-a[1])[0];
const topN=(m,n)=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k])=>k);
const teams=[];let nulled=0;const review=[];const context={};
for(const key of [...tot.keys()].sort((a,b)=>tot.get(b)-tot.get(a)||(a<b?-1:a>b?1:0))){ // count降順→名前で決定的タイブレーク（id安定化）
// 表示名は最頻出の生表記だが、全角ASCIIは半角へ寄せる（ＹＫＫ→YKK, Ｊ－Ｋｉｄｓ→J-Kids）。
// 半角化前の生表記は aliases 側に残るので、元の表記は失われない。
const rc=rawC.get(key);const name=toHalfWidthAscii(top(rc)[0]);
const aliases=[...rc.keys()].filter(r=>r!==name).sort();
const total=tot.get(key);const pc=prefC.get(key);
let prefecture=null,others=[];
if(pc){const real=[...pc.values()].reduce((a,b)=>a+b,0);const[mp,mc]=top(pc);
const cov=real/total, share=mc/real;
if(cov>=COV_MIN&&share>=SHARE_MIN){prefecture=mp;
others=[...pc.entries()].filter(([k,c])=>k!==mp&&c>=Math.max(2,mc*0.25)).map(([k])=>k);}
else nulled++;}
const id=teams.length+1;
const rec={id,name,prefecture,count:total};
if(aliases.length)rec.aliases=aliases;
if(others.length){rec.reviewPrefectures=[prefecture,...others];review.push(name);}
teams.push(rec);
// 文脈（レビュー用）: 代表的な選手名・年範囲・主な大会
const ys=yearsK.get(key);
context[id]={players:topN(playerC.get(key)||new Map(),8),
years:ys&&ys.size?[Math.min(...ys),Math.max(...ys)]:null,
events:topN(eventC.get(key)||new Map(),3),
genres:[...(genreK.get(key)||[])],
inst:[...(instK.get(key)||[])]};}
fs.mkdirSync(path.join(ROOT,'data','teams'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'data','teams','teams.json'),JSON.stringify(teams,null,2)+'\n','utf8');
fs.writeFileSync(path.join(ROOT,'data','teams','team-context.json'),JSON.stringify(context)+'\n','utf8');
console.log('entries:',teams.length,'/ prefecture=null:',teams.filter(t=>!t.prefecture).length,'/ aliases付き:',teams.filter(t=>t.aliases).length,'/ 同名別校疑い:',review.length);
console.log('上位5:');for(const t of teams.slice(0,5))console.log('  ',JSON.stringify(t));
