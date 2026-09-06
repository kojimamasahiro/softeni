// data/teams/merge-candidates.json から、人手レビュー用のインタラクティブHTMLを生成する。
// 出力: data/teams/team-merge-review.html（ブラウザで開いてクリック判断→JSON書き出し）。
//  - 各メンバーに選手名・年代・主な大会の文脈を表示（チーム名だけで判断できない時の手がかり）。
//  - 「確認済にする」を押したものだけを出力・反映対象にする。
//  - 判断は data/teams/review-decisions.json（判断台帳）に保存する。localStorage は作業用キャッシュ。
//    台帳はクラスタを**メンバーの team id** で識別するので、候補を再生成して並びが変わっても
//    過去の判断が追随する（旧実装は配列インデックス保持で、再生成のたびに取り違えるか捨てるかだった）。
//  - 「統合しない」という否定の判断も台帳に残す（機械の自動OK判定の誤り率を測る素になる）。
//  - 確認済はレビュー対象から外れる（畳んで表示／「未確認のみ」で非表示）。
// 使い方: npm run team:review （サーバ経由で台帳へ直接保存）
//         node scripts/build-team-review-html.mjs （HTMLの生成のみ）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { clusterKey, readLedger, summarize } from './lib/review-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clusters = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams', 'merge-candidates.json'), 'utf8'));
const contextAll = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams', 'team-context.json'), 'utf8'));
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
//
// 2026-09-06 修正: 以前は出場大会由来を 'G:高'、名前由来を 'N:高' と**別の接頭辞**にしていた。
// 同じ「高校」を意味するのに文字列が違うため、片方だけジャンルを持つクラスタは必ず分割された
// （例:「大田原女子」ジャンル[高] と「大田原女子高校」ジャンル[] が別グループ）。
// 抜き取り監査の実測で、標本14件中7件がこの型の**見逃し**（統合すべきものを残した）で、
// 逆向きの誤統合は0件だった。さらに、自動OK 350件のうち実際に統合が起きていたのは**1件だけ**
// ＝自動判定が99.7%空回りしていた。段階が同じなら由来を問わず同じキーにする。
// 同一大会での同居チェック（下の autoOK）は触っていないので、安全弁はそのまま。
function defaultGroups(members) {
  const keys = members.map((m, i) => {
    const stage = memGenre(m) ?? level(m.name);
    return stage != null ? 'S:' + stage : 'bare' + i;
  });
  const uniq = [...new Set(keys)];
  const idx = {};
  uniq.forEach((k, i) => (idx[k] = i));
  return keys.map((k) => idx[k]);
}

const data = clusters.map((c) => ({
  prefecture: c.prefecture,
  signal: c.signal || 'core',
  core: c.core,
  // 選手共有シグナルの根拠（見出しに出す）。コア一致クラスタでは undefined。
  sharedPlayers: c.sharedPlayers,
  years: c.years,
  members: c.members,
  groups: defaultGroups(c.members),
}));
const needsReview = data.map((c) => new Set(c.groups).size > 1);
const CTX = {};
for (const c of clusters)
  for (const m of c.members) {
    const x = contextAll[m.id];
    if (x) CTX[m.id] = { players: x.players, years: x.years, events: x.events, genres: x.genres };
  }
function instOf(m) {
  return new Set((contextAll[m.id] || {}).inst || []);
}

// 自動OK判定（大会の共起ベース）:
//  - 既定グループ（ジャンル/段階で分割）で統合される＝同一グループ内のメンバー同士を見て、
//    2つの表記が「同一大会(大会id+年)」に同居していれば別チームの疑い→人手レビュー。
//  - どのグループ内でも同居が無ければ（＝表記揺れは別々の大会にしか出ない）自動OK。
//  - ジャンルが違うメンバーは既定グループで分かれる＝統合されないので自動で別チーム扱い。
const autoOK = clusters.map((c) => {
  // signal:"players" は常に人手レビュー（理由は apply-auto-merges.mjs の autoOK を参照）。
  if (c.signal === 'players') return false;
  const groups = defaultGroups(c.members);
  const byG = {};
  c.members.forEach((m, i) => (byG[groups[i]] = byG[groups[i]] || []).push(m));
  for (const g in byG) {
    const ms = byG[g];
    for (let i = 0; i < ms.length; i++)
      for (let j = i + 1; j < ms.length; j++) {
        const a = instOf(ms[i]),
          b = instOf(ms[j]);
        for (const x of a) if (b.has(x)) return false; // 同一大会で表記揺れが同居→要確認
      }
  }
  return true;
});

// 安定キー（メンバーの team id 順）。候補の並びが変わっても判断が追随する。
const keys = clusters.map((c) => clusterKey(c.members));
const ledger = readLedger();
const ledgerStats = summarize(ledger);

// 抜き取り監査で引いた標本（scripts/audit-review-sample.mjs --draw）。
// 「監査対象」フィルタで、この標本だけを順に判断できるようにする。
const auditPath = path.join(ROOT, 'data', 'teams', 'review-audit.json');
const auditKeys = fs.existsSync(auditPath)
  ? new Set(JSON.parse(fs.readFileSync(auditPath, 'utf8')).rounds.flatMap((r) => r.sample.map((x) => x.key)))
  : new Set();

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
.b-audit{background:rgba(220,90,160,.18);color:#f0a0cc}
.hint{margin-left:auto;color:var(--mut);font-size:12px}
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
    <button data-f="audit">監査対象</button>
    <button data-f="all">すべて</button>
  </div>
  <button id="openall" title="表示中の畳まれたカードをまとめて開く／閉じる（判断は変えない）">表示中をすべて開く</button>
</header>
<main id="list"></main>
<div class="foot">
  <button class="primary" id="dl">確認済を反映</button>
  <button id="copy">確認済をコピー</button>
  <small id="msg">同ジャンルの純粋な表記揺れは「自動OK」で既定の反映対象。要確認(中高別校/本体↔クラブ/別ジャンル)だけ手で判断→「確認済にする」。チップでグループ分け（同色＝同一／×＝除外、3つ以上可）、★＝代表名。「確認済を反映」で判断台帳(review-decisions.json)へ保存＋alias取り込み。統合しない判断も記録される。</small>
</div>
<script>
const CLUSTERS=${JSON.stringify(data)};
const NEEDS=${JSON.stringify(needsReview)};
const CTX=${JSON.stringify(CTX)};
const AUTO=${JSON.stringify(autoOK)};
const KEYS=${JSON.stringify(keys)};
const LEDGER=${JSON.stringify(ledger.decisions)};
const AUDIT=new Set(${JSON.stringify([...auditKeys])});
const KEY='team-merge-review-v10';
// state は**安定キー**（メンバーのteam id昇順）で持つ。候補が再生成されて並びが変わっても
// 過去の判断を取り違えない。localStorage は作業用キャッシュで、正はリポジトリの
// data/teams/review-decisions.json（台帳）。
let state=JSON.parse(localStorage.getItem(KEY)||'{}'); // {stableKey:{groups:[],canon:{},reviewed:bool}}
let filter='todo';
// 「確認済」で畳まれたカードを、判断を変えずに開いて中身を見るためだけの状態。
// localStorage には保存しない（判断ではないので）。
const OPEN=new Set();
// 初期値の優先順: 台帳に判断があればそれ > 自動OKなら確認済 > 既定グループ分け。
function st(i){const k=KEYS[i];
  if(!state[k]){const led=LEDGER[k];
    state[k]=(led&&Array.isArray(led.groups))
      ?{groups:led.groups.slice(),canon:led.canon||{},reviewed:true,touched:led.decidedBy==='human'}
      :{groups:CLUSTERS[i].groups.slice(),canon:{},reviewed:AUTO[i]===true};}
  // 監査対象は「人が中身を見て判断する」のが目的なので、機械が決めただけの段階では
  // 確認済み（畳んだ表示）にしない。人が一度でも触れば通常どおり確認済みのまま残る。
  if(AUDIT.has(k)&&!state[k].touched){const led=LEDGER[k];
    if(!led||led.decidedBy!=='human') state[k].reviewed=false;}
  return state[k];}
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
  let aTodo=0,aAll=0;
  for(let i=0;i<total;i++){if(AUDIT.has(KEYS[i])){aAll++;const d=LEDGER[KEYS[i]];if(!(d&&d.decidedBy==='human')&&!st(i).touched)aTodo++;}}
  document.getElementById('prog').textContent='反映対象 '+done+' / '+total+'（自動OK '+auto+'・残り未確認 '+(total-done)+'）'
    +(aAll?' ・ 監査対象 '+aAll+'件（未判断 '+aTodo+'）':'');}
function touch(i){st(i).touched=true;}
function cycle(i,mi){const s=st(i);touch(i);const others=s.groups.filter((g,j)=>j!==mi&&g>=0);
  const maxOther=others.length?Math.max(...others):-1;let cur=s.groups[mi];
  if(cur<0)cur=0;else if(cur>=maxOther+1)cur=-1;else cur=cur+1;s.groups[mi]=cur;save();render();}
// いま表示対象かどうか。render と「すべて開く」の両方から使う。
function visible(i){const s=st(i);
  if(filter==='todo'&&s.reviewed)return false;
  if(filter==='auto'&&!AUTO[i])return false;
  if(filter==='done'&&(!s.reviewed||AUTO[i]))return false;
  if(filter==='review'&&(!NEEDS[i]||s.reviewed))return false;
  // 監査対象: 無作為抽出した標本だけを出す。判断済みでも出す（結果を見返せるように）。
  if(filter==='audit'&&!AUDIT.has(KEYS[i]))return false;
  return true;}
function render(){const root=document.getElementById('list');root.innerHTML='';
  CLUSTERS.forEach((c,i)=>{const s=st(i);
    if(!visible(i))return;
    const card=document.createElement('div');card.className='card'+(s.reviewed?' rev':'');
    const head=document.createElement('div');head.className='chead';
    const badge=(s.reviewed?('<span class="badge '+(AUTO[i]?'b-autook">自動OK':'b-done">確認済')+'</span>'):('<span class="badge '+(NEEDS[i]?'b-rev">要確認':'b-auto">ほぼ自明')+'</span>'))
      +(AUDIT.has(KEYS[i])?'<span class="badge b-audit">監査対象</span>':'');
    const sig=c.signal==='players'
      ?'選手共有: '+c.sharedPlayers.length+'名 ('+c.sharedPlayers.slice(0,3).join('・')+(c.sharedPlayers.length>3?' 他':'')+') '+c.years.join(',')
      :'core: '+c.core;
    head.innerHTML='<span class="pref">'+(c.prefecture||'（県なし）')+'</span><span class="core">'+sig+'</span>'+badge;
    card.appendChild(head);
    const ents=aliasEntries(i);
    // 見出しをタップすると、確認済のまま開いて中身を見られる（判断は変えない）。
    if(s.reviewed){
      head.style.cursor='pointer';
      head.title='タップで開く／閉じる（確認済のまま中身を見る）';
      head.onclick=()=>{OPEN.has(i)?OPEN.delete(i):OPEN.add(i);render();};
      head.innerHTML+='<span class="hint">'+(OPEN.has(i)?'▲ 閉じる':'▼ 開く')+'</span>';
    }
    if(s.reviewed&&!OPEN.has(i)){ // 確認済は既定で畳む（レビュー対象から外す）
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
      row.onclick=(e)=>{if(e.shiftKey){if(s.groups[mi]>=0){s.canon[s.groups[mi]]=mi;}touch(i);save();render();return;}cycle(i,mi);};
      list.appendChild(row);});
    card.appendChild(list);
    const prev=document.createElement('div');prev.className='prev';
    prev.innerHTML=ents.length?ents.map(e=>'畳む: <b>'+e.canonical+'</b> ← '+e.aliases.join(', ')).join('<br>'):'<i>畳むグループなし（全て別チーム/除外）</i>';
    card.appendChild(prev);
    const row=document.createElement('div');row.className='row2';
    const b1=document.createElement('button');b1.textContent='全部まとめる';b1.onclick=()=>{s.groups=c.members.map(()=>0);s.canon={};touch(i);save();render();};
    const b2=document.createElement('button');b2.textContent='初期分けに戻す';b2.onclick=()=>{s.groups=c.groups.slice();s.canon={};touch(i);save();render();};
    const b3=document.createElement('button');b3.className='primary';b3.textContent='確認済にする';b3.onclick=()=>{s.reviewed=true;touch(i);save();render();};
    row.append(b1,b2,b3);
    if(s.reviewed){ // 開いて見ているだけの確認済カード
      const b4=document.createElement('button');b4.textContent='閉じる（確認済のまま）';
      b4.onclick=()=>{OPEN.delete(i);render();};
      const b5=document.createElement('button');b5.textContent='確認済を解除';
      b5.onclick=()=>{s.reviewed=false;OPEN.delete(i);save();render();};
      row.append(b4,b5);
    }
    card.appendChild(row);
    root.appendChild(card);});
  renderProg();}
// 確認済クラスタから、alias追加(additions)と判断台帳(decisions)の両方を作る。
// 「統合しない」= verdict:'separate' も必ず1件として残す（機械の誤り率を測る素になる）。
function buildOutput(){const additions=[],decisions=[];
  CLUSTERS.forEach((c,i)=>{const s=st(i);if(!s.reviewed)return;
    const ents=aliasEntries(i);ents.forEach(e=>additions.push(e));
    decisions.push({key:KEYS[i],prefecture:c.prefecture||null,signal:c.signal,
      members:c.members.map(m=>m.name),proposedAutoOK:AUTO[i]===true,
      decidedBy:s.touched?'human':(AUTO[i]===true?'auto':'human'),
      groups:s.groups.slice(),canon:s.canon||{},
      verdict:ents.length?'merge':'separate',merges:ents});});
  return {additions,decisions};}
// 表示中で畳まれているものを一括で開閉する（判断は変えない）。
document.getElementById('openall').onclick=()=>{
  const idx=CLUSTERS.map((_,i)=>i).filter(i=>visible(i)&&st(i).reviewed);
  const allOpen=idx.length>0&&idx.every(i=>OPEN.has(i));
  idx.forEach(i=>allOpen?OPEN.delete(i):OPEN.add(i));
  document.getElementById('openall').textContent=allOpen?'表示中をすべて開く':'表示中をすべて閉じる';
  render();};
document.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>{filter=b.dataset.f;
  OPEN.clear();document.getElementById('openall').textContent='表示中をすべて開く';
  document.querySelectorAll('.filters button').forEach(x=>x.classList.toggle('on',x===b));render();});
document.getElementById('dl').onclick=async()=>{const o=buildOutput();const msg=document.getElementById('msg');
  if(!o.decisions.length){msg.textContent='確認済が0件です。「確認済にする」を押してから反映してください。';return;}
  try{const r=await fetch('/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)});
    if(!r.ok)throw new Error('server');const res=await r.json();
    msg.textContent='反映: alias 適用 '+res.applied.length+' / スキップ '+res.skipped.length+' / 競合 '+res.conflicts.length+(res.conflicts.length?'（競合は取り込まず）':'')
      +' ・ 台帳 '+res.ledger.total+'件（人 '+res.ledger.human+'・統合 '+res.ledger.merge+'・別チーム '+res.ledger.separate+'）に保存。'
      +(res.remaining?' ・ 候補を作り直した（'+res.remaining.clusters+'件・未判断 '+res.remaining.todo+'件）。ページを再読み込みしてください。':'');
  }catch(e){const blob=new Blob([JSON.stringify(o,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='team-review-output.json';a.click();
    msg.textContent='（サーバ未起動）確認済 '+o.decisions.length+' 件を team-review-output.json に保存。npm run team:review で起動すれば台帳へ直接保存されます（http://localhost:5173）。';}};
document.getElementById('copy').onclick=async()=>{const o=buildOutput();await navigator.clipboard.writeText(JSON.stringify(o,null,2));
  document.getElementById('msg').textContent='確認済 '+o.decisions.length+' 件をコピーしました。';};
render();
</script></body></html>`;

const outPath = path.join(ROOT, 'data', 'teams', 'team-merge-review.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(
  '生成:',
  path.relative(ROOT, outPath),
  '/ クラスタ',
  data.length,
  '/ 要確認',
  needsReview.filter(Boolean).length,
  '/ 文脈付きチーム',
  Object.keys(CTX).length,
);
console.log(
  '判断台帳:',
  `${ledgerStats.total}件（人 ${ledgerStats.human}・自動 ${ledgerStats.auto}` +
    ` / 統合 ${ledgerStats.merge}・別チーム ${ledgerStats.separate}` +
    ` / 自動OKを人が覆した ${ledgerStats.autoOKOverturned}）`,
);
