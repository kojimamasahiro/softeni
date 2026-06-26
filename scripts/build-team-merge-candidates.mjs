// チーム名のマージ候補（同一チームの表記揺れ・省略の疑い）を県ブロッキングで抽出する。
// 自動マージはしない。人手レビュー用に data/teams/merge-candidates.json を出力。
// シグナル: 接尾辞除去後のコア一致（県内ブロック）。
//   接尾辞: 高等学校/高校/中学校/中学/小学校/小学/大学/各種クラブ/少年団 と 単漢字 中/高/小/大。
//   付↔附 を同一視。コアが2文字未満になる除去はしない（短い固有名の誤結合防止）。
// 注意: 中学校 vs 高校（中高で別チーム）も同コアで候補に入る→レビューで判断。
import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const teams=JSON.parse(fs.readFileSync(path.join(ROOT,'data','teams','teams.json'),'utf8'));
const SUF=['高等学校','高校','中学校','中学','小学校','小学','大学','ソフトテニスクラブ','テニスクラブ','スポーツ少年団','スポ少','少年団','ジュニアクラブ','ジュニア','クラブ','STC','JSC','JST','TC','SC','中','高','小','大'];
function core(name){let s=name.replace(/付/g,'附');let ch=true;
  while(ch){ch=false;for(const suf of SUF){if(s.endsWith(suf)&&s.length-suf.length>=2){s=s.slice(0,-suf.length);ch=true;break;}}}return s;}
const blocks=new Map();
for(const t of teams){const b=t.prefecture||'__none__';(blocks.get(b)||blocks.set(b,[]).get(b)).push(t);}
const clusters=[];
for(const [pref,arr] of blocks){
  const byCore=new Map();
  for(const t of arr){const c=core(t.name);(byCore.get(c)||byCore.set(c,[]).get(c)).push(t);}
  for(const [c,members] of byCore){if(members.length<2)continue;
    members.sort((x,y)=>y.count-x.count);
    clusters.push({prefecture:pref==='__none__'?null:pref,core:c,
      members:members.map(m=>({id:m.id,name:m.name,count:m.count}))});}
}
clusters.sort((a,b)=>b.members.reduce((s,m)=>s+m.count,0)-a.members.reduce((s,m)=>s+m.count,0));
fs.writeFileSync(path.join(ROOT,'data','teams','merge-candidates.json'),JSON.stringify(clusters,null,2)+'\n','utf8');
console.log('候補クラスタ:',clusters.length,'/ 関与チーム:',clusters.reduce((s,c)=>s+c.members.length,0));
// 新接尾辞(中/少年団)で繋がった例の確認
console.log('\n例:');
let n=0;
for(const c of clusters){const ns=c.members.map(m=>m.name);
  if(ns.some(x=>/中$/.test(x)||/少年団$/.test(x))&&n<12){console.log('  ['+(c.prefecture||'null')+'] '+ns.join(' / '));n++;}}
