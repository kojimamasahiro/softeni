// data/teams/merge-candidates.json から、人手レビュー用のインタラクティブHTMLを生成する。
// 出力: data/teams/team-merge-review.html（ブラウザで開いてクリック判断→JSON書き出し）。
//  - 各メンバーに選手名・年代・主な大会の文脈を表示（チーム名だけで判断できない時の手がかり）。
//  - 「確認済にする」を押したものだけを出力・反映対象にする。
//  - 判断はブラウザ(localStorage)に保存。リロードしても確認済・グループ分けは保持される。
//  - 確認済はレビュー対象から外れる（畳んで表示／「未確認のみ」で非表示）。
// 使い方: node scripts/build-team-review-html.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clusters = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'teams', 'merge-candidates.json'), 'utf8'),
);
const contextAll = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'teams', 'team-context.json'), 'utf8'),
);
const teamsArr = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams', 'teams.json'), 'utf8'));
const idAliases = {};
for (const t of teamsArr) idAliases[t.id] = t.aliases || [];

// 初期グループ分け（賢いデフォルト）: 学校段階/クラブで分け、本体名は優勢な学校段階へ寄せる。
function level(n) {
  if (/中学/.test(n)) return '中';
  if (/高校|高等学校/.test(n)) return '高';
  if (/大学/.test(n)) return '大';
  if (/小学|スポーツ少年団|スポ少|ジュニア/.test(n)) return '小';
  if (/クラブ|ＯＢ|OB|役場|電力|協会|ＳＴＣ|STC|JSC/.test(n)) return 'ク';
  return null;
}
// メンバーのジャンル（出場大会から判定した段階: 小/中/高/大/社/シ）。一意に決まらなければ null。
function memGenre(m) {
  const gs = (contextAll[m.id] || {}).genres || [];
  return gs.length === 1 ? gs[0] : null;
}
// 既定グループ: 出場大会のジャンルで分ける（小/中/高/大/社/シが違えば別グループ）。
// ジャンルが一意でない（高校と中学の両方に出る等）メンバーは名前ベースで補完し、無ければ単独。
function defaultGroups(members) {
  const keys = members.map((m, i) => {
    const g = memGenre(m);
    return g != null ? 'G:' + g : 'N:' + (level(m.name) || 'bare' + i);
  });
  const uniq = [...new Set(keys)];
  const idx = {};
  uniq.forEach((k, i) => (idx[k] = i));
  return keys.map((k) => idx[k]);
}

const data = clusters.map((c) => ({
  prefecture: c.prefecture,
  core: c.core,
  members: c.members,
  groups: defaultGroups(c.members),
}));
const needsReview = data.map((c) => new Set(c.groups).size > 1);
const CTX = {};
for (const c of clusters) for (const m of c.members) { const x = contextAll[m.id]; if (x) CTX[m.id] = { players: x.players, years: x.years, events: x.events, genres: x.genres }; }
function instOf(m) { return new Set((contextAll[m.id] || {}).inst || []); }

// 自動OK判定（大会の共起ベース）:
//  - 既定グループ（ジャンル/段階で分割）で統合される＝同一グループ内のメンバー同士を見て、
//    2つの表記が「同一大会(大会id+年)」に同居していれば別チームの疑い→人手レビュー。
//  - どのグループ内でも同居が無ければ（＝表記揺れは別々の大会にしか出ない）自動OK。
//  - ジャンルが違うメンバーは既定グループで分かれる＝統合されないので自動で別チーム扱い。
const autoOK = clusters.map((c) => {
  const groups = defaultGroups(c.members);
  const byG = {};
  c.members.forEach((m, i) => (byG[groups[i]] = byG[groups[i]] || []).push(m));
  for (const g in byG) {
    const ms = byG[g];
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
      const a = instOf(ms[i]), b = instOf(ms[j]);
      for (const x of a) if (b.has(x)) return false; // 同一大会で表記揺れが同居→要確認
    }
  }
  return true;
});

const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>チーム名 マージレビュー</title>
<style>
:root{--bg:#0f1115;--card:#1a1d24;--mut:#8b93a7;--line:#2a2f3a;--acc:#4f8cff;--ok:#33c481;--warn:#e0a23a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#e8ebf2;font:14px/1.5 system-ui,"Hiragino Sans","Noto Sans JP",sans-serif}
header{position:sticky;top:0;z-index:10;background:#12141a;border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font-size:15px;margin:0 8px 0 0}
.pill{background:#222632;border:1px solid var(--line);border-radius:999px;padding:3px 10px;color:var(--mut);font-size:12px}
button{background:#222632;color:#e8ebf2;border:1px solid var(--line);border-radius:8px;padding:6px 11px;cursor:pointer;font-size:13px}
button:hover{border-color:var(--acc)}
button.primary{background:var(--acc);border-color:var(--acc);color:#fff}
.filters{display:flex;gap:6px;margin-left:auto}
.filters .on{border-color:var(--acc);color:#fff}
main{max-width:980px;margin:16px auto;padding:0 16px;display:flex;flex-direction:column;gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.card.rev{border-color:rgba(51,196,129,.4)}
.chead{display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.pref{font-weight:600}.core{color:var(--mut)}
.badge{font-size:11px;padding:2px 8px;border-radius:999px}
.b-auto{background:rgba(51,196,129,.15);color:var(--ok)}
.b-rev{background:rgba(224,162,58,.15);color:var(--warn)}
.b-done{background:rgba(51,196,129,.18);color:var(--ok)}
.b-autook{background:rgba(79,140,255,.15);color:var(--acc)}
.mlist{display:flex;flex-direction:column;gap:6px}
.mrow{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:9px;padding:7px 10px;cursor:pointer;user-select:none}
.mrow.ex .mname{text-decoration:line-through;opacity:.55}
.mrow.canon{box-shadow:0 0 0 2px var(--acc) inset}
.mrow .gl{flex:none;font-weight:700;font-size:11px;width:18px;height:18px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;margin-top:1px;color:#fff}
.mbody{min-width:0}
.mname{font-weight:600}.mname .cnt{color:var(--mut);font-weight:400;font-size:12px}
.mctx{color:var(--mut);font-size:12px;margin-top:1px;word-break:break-word}
.g0{background:rgba(79,140,255,.14)}.g1{background:rgba(51,196,129,.14)}.g2{background:rgba(224,162,58,.14)}
.g3{background:rgba(220,90,160,.14)}.g4{background:rgba(120,200,230,.14)}.g5{background:rgba(180,140,255,.14)}
.gl0{background:var(--acc)}.gl1{background:var(--ok)}.gl2{background:var(--warn)}.gl3{background:#dc5aa0}.gl4{background:#78c8e6}.gl5{background:#b48cff}
.glx{background:#555}
.prev{margin-top:9px;font-size:12px;color:var(--mut)}
.prev b{color:#cfe0ff}
.row2{display:flex;gap:8px;align-items:center;margin-top:9px;flex-wrap:wrap}
.foot{position:sticky;bottom:0;background:#12141a;border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
small{color:var(--mut)}
</style></head><body>
<header>
  <h1>チーム名 マージレビュー</h1>
  <span class="pill" id="prog"></span>
  <div class="filters">
    <button data-f="todo" class="on">未確認のみ</button>
    <button data-f="review">要確認のみ</button>
    <button data-f="auto">自動OK</button>
    <button data-f="done">手動確認済</button>
    <button data-f="all">すべて</button>
  </div>
</header>
<main id="list"></main>
<div class="foot">
  <button class="primary" id="dl">確認済を反映</button>
  <button id="copy">確認済をコピー</button>
  <small id="msg">同ジャンルの純粋な表記揺れは「自動OK」で既定の反映対象。要確認(中高別校/本体↔クラブ/別ジャンル)だけ手で判断→「確認済にする」。チップでグループ分け（同色＝同一／×＝除外、3つ以上可）、★＝代表名。判断は自動保存。「確認済を反映」でサーバへ即取り込み（未起動ならファイル保存）。</small>
</div>
<script>
const CLUSTERS=${JSON.stringify(data)};
const NEEDS=${JSON.stringify(needsReview)};
const CTX=${JSON.stringify(CTX)};
const AUTO=${JSON.stringify(autoOK)};
const KEY='team-merge-review-v9';
let state=JSON.parse(localStorage.getItem(KEY)||'{}'); // {idx:{groups:[],canon:{},reviewed:bool}}
let filter='todo';
// 自動OKクラスタは既定で確認済（＝反映対象）。手で編集すれば解除できる。
function st(i){if(!state[i])state[i]={groups:CLUSTERS[i].groups.slice(),canon:{},reviewed:AUTO[i]===true};return state[i];}
function save(){localStorage.setItem(KEY,JSON.stringify(state));renderProg();}
function ci(g){return ((g%6)+6)%6;}
function canonOf(i,g){const s=st(i);if(s.canon[g]!=null)return s.canon[g];
  let best=-1,bc=-1;CLUSTERS[i].members.forEach((m,mi)=>{if(s.groups[mi]===g&&m.count>bc){bc=m.count;best=mi;}});return best;}
function aliasEntries(i){const c=CLUSTERS[i],s=st(i);const byG={};
  s.groups.forEach((g,mi)=>{if(g<0)return;(byG[g]=byG[g]||[]).push(mi);});
  const out=[];for(const g in byG){const mis=byG[g];if(mis.length<2)continue;
    const can=canonOf(i,+g);out.push({canonical:c.members[can].name,
      aliases:mis.filter(mi=>mi!==can).map(mi=>c.members[mi].name),note:c.prefecture||''});}
  return out;}
function ctxLine(id){const x=CTX[id]||{};const pl=(x.players||[]).slice(0,6).join('、');
  const yr=x.years?(x.years[0]+(x.years[1]!==x.years[0]?'–'+x.years[1]:'')):'';
  const ev=(x.events||[]).join(', ');
  return (pl?'選手: '+pl:'選手情報なし')+(yr?' ・ '+yr:'')+(ev?' ・ '+ev:'');}
function renderProg(){const total=CLUSTERS.length;let done=0,auto=0;
  for(let i=0;i<total;i++){if(st(i).reviewed){done++;if(AUTO[i])auto++;}}
  document.getElementById('prog').textContent='反映対象 '+done+' / '+total+'（自動OK '+auto+'・残り未確認 '+(total-done)+'）';}
function cycle(i,mi){const s=st(i);const others=s.groups.filter((g,j)=>j!==mi&&g>=0);
  const maxOther=others.length?Math.max(...others):-1;let cur=s.groups[mi];
  if(cur<0)cur=0;else if(cur>=maxOther+1)cur=-1;else cur=cur+1;s.groups[mi]=cur;save();render();}
function render(){const root=document.getElementById('list');root.innerHTML='';
  CLUSTERS.forEach((c,i)=>{const s=st(i);
    if(filter==='todo'&&s.reviewed)return;
    if(filter==='auto'&&!AUTO[i])return;
    if(filter==='done'&&(!s.reviewed||AUTO[i]))return;
    if(filter==='review'&&(!NEEDS[i]||s.reviewed))return;
    const card=document.createElement('div');card.className='card'+(s.reviewed?' rev':'');
    const head=document.createElement('div');head.className='chead';
    const badge=s.reviewed?('<span class="badge '+(AUTO[i]?'b-autook">自動OK':'b-done">確認済')+'</span>'):('<span class="badge '+(NEEDS[i]?'b-rev">要確認':'b-auto">ほぼ自明')+'</span>');
    head.innerHTML='<span class="pref">'+(c.prefecture||'（県なし）')+'</span><span class="core">core: '+c.core+'</span>'+badge;
    card.appendChild(head);
    const ents=aliasEntries(i);
    if(s.reviewed){ // 確認済は畳んで表示（レビュー対象から外す）
      const prev=document.createElement('div');prev.className='prev';
      prev.innerHTML=ents.length?ents.map(e=>'畳む: <b>'+e.canonical+'</b> ← '+e.aliases.join(', ')).join('<br>'):'<i>畳むグループなし</i>';
      card.appendChild(prev);
      const row=document.createElement('div');row.className='row2';
      const be=document.createElement('button');be.textContent='編集する（確認済を解除）';be.onclick=()=>{s.reviewed=false;save();render();};
      row.appendChild(be);card.appendChild(row);root.appendChild(card);return;}
    const list=document.createElement('div');list.className='mlist';
    c.members.forEach((m,mi)=>{const g=s.groups[mi];const k=ci(g);const isCan=canonOf(i,g)===mi&&g>=0;
      const row=document.createElement('div');row.className='mrow '+(g<0?'ex':'g'+k)+(isCan?' canon':'');
      row.innerHTML='<span class="gl '+(g>=0?'gl'+k:'glx')+'">'+(g>=0?String.fromCharCode(65+g):'×')+'</span>'+
        '<div class="mbody"><div class="mname">'+(isCan?'★ ':'')+m.name+' <span class="cnt">×'+m.count+'</span></div>'+
        '<div class="mctx">'+ctxLine(m.id)+'</div></div>';
      row.title='クリック: グループ変更（A→B→…→新グループ→除外）。Shift+クリック: 代表名(★)に設定';
      row.onclick=(e)=>{if(e.shiftKey){if(s.groups[mi]>=0){s.canon[s.groups[mi]]=mi;}save();render();return;}cycle(i,mi);};
      list.appendChild(row);});
    card.appendChild(list);
    const prev=document.createElement('div');prev.className='prev';
    prev.innerHTML=ents.length?ents.map(e=>'畳む: <b>'+e.canonical+'</b> ← '+e.aliases.join(', ')).join('<br>'):'<i>畳むグループなし（全て別チーム/除外）</i>';
    card.appendChild(prev);
    const row=document.createElement('div');row.className='row2';
    const b1=document.createElement('button');b1.textContent='全部まとめる';b1.onclick=()=>{s.groups=c.members.map(()=>0);s.canon={};save();render();};
    const b2=document.createElement('button');b2.textContent='初期分けに戻す';b2.onclick=()=>{s.groups=c.groups.slice();s.canon={};save();render();};
    const b3=document.createElement('button');b3.className='primary';b3.textContent='確認済にする';b3.onclick=()=>{s.reviewed=true;save();render();};
    row.append(b1,b2,b3);card.appendChild(row);
    root.appendChild(card);});
  renderProg();}
function buildOutput(){const out=[];CLUSTERS.forEach((c,i)=>{if(st(i).reviewed)aliasEntries(i).forEach(e=>out.push(e));});return out;}
document.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>{filter=b.dataset.f;
  document.querySelectorAll('.filters button').forEach(x=>x.classList.toggle('on',x===b));render();});
document.getElementById('dl').onclick=async()=>{const o=buildOutput();const msg=document.getElementById('msg');
  if(!o.length){msg.textContent='確認済が0件です。「確認済にする」を押してから反映してください。';return;}
  try{const r=await fetch('/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)});
    if(!r.ok)throw new Error('server');const res=await r.json();
    msg.textContent='サーバへ反映: 適用 '+res.applied.length+' / スキップ '+res.skipped.length+' / 競合 '+res.conflicts.length+(res.conflicts.length?'（競合は取り込まず）':'')+' ・ マスタ再生成済。';
  }catch(e){const blob=new Blob([JSON.stringify(o,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='team-alias-additions.json';a.click();
    msg.textContent='（サーバ未起動）確認済 '+o.length+' 件を team-alias-additions.json に保存。node scripts/apply-team-aliases.mjs team-alias-additions.json で取り込めます。';}};
document.getElementById('copy').onclick=async()=>{const o=buildOutput();await navigator.clipboard.writeText(JSON.stringify(o,null,2));
  document.getElementById('msg').textContent='確認済 '+o.length+' 件をコピーしました。';};
render();
</script></body></html>`;

const outPath = path.join(ROOT, 'data', 'teams', 'team-merge-review.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('生成:', path.relative(ROOT, outPath), '/ クラスタ', data.length, '/ 要確認', needsReview.filter(Boolean).length, '/ 文脈付きチーム', Object.keys(CTX).length);
