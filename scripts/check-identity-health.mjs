// 識別・名寄せのヘルスチェック。現データを走査し、人手対応が必要な未処理項目を一覧する。
// 取り込み後に実行することで「対応忘れ」を防ぐ。問題があれば終了コード1。
// 使い方: node scripts/check-identity-health.mjs
//   前提: 先に build-team-master.mjs を実行し teams.json / team-context.json を最新化しておく。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DET = path.join(ROOT, 'data', 'tournaments', 'details');

// ---- 定数 ----
const REAL = new Set(['北海道', '東京都', '大阪府', '京都府', ...'青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄'.split(/\s+/).map((k) => k + '県')]);
const FOREIGN = new Set(['韓国', '台湾', '中華台北', 'モンゴル']);
const norm = (s) => (s == null ? s : s.normalize('NFKC').replace(/[ 　]/g, '').replace(/[･•]/g, '・'));
const catOf = (tid) => {
  if (tid.startsWith('primaryschool') || tid === 'zennihon-primaryschool') return '小';
  if (tid.includes('secondaryschool')) return '中';
  if (tid.startsWith('highschool')) return '高';
  if (tid.startsWith('zennihon-university')) return '大';
  if (['zennihon-workers', 'zennihon-business-group', 'zennihon-club', 'zennihon-senior'].includes(tid)) return '成';
  return null;
};
const ORD = { 小: 0, 中: 1, 高: 2, 大: 3, 成: 4 };
const SUF = ['高等学校', '高校', '中学校', '中学', '小学校', '小学', '大学', 'ソフトテニスクラブ', 'テニスクラブ', 'スポーツ少年団', 'スポ少', '少年団', 'ジュニアクラブ', 'ジュニア', 'クラブ', 'STC', 'JSC', 'JST', 'TC', 'SC', '中', '高', '小', '大'];
const core = (name) => { let s = name.replace(/付/g, '附'); let ch = true; while (ch) { ch = false; for (const suf of SUF) { if (s.endsWith(suf) && s.length - suf.length >= 2) { s = s.slice(0, -suf.length); ch = true; break; } } } return s; };
const level = (n) => { if (/中学/.test(n)) return '中'; if (/高校|高等学校/.test(n)) return '高'; if (/大学/.test(n)) return '大'; if (/小学|スポーツ少年団|スポ少|ジュニア/.test(n)) return '小'; if (/クラブ|ＯＢ|OB|役場|電力|協会|ＳＴＣ|STC|JSC/.test(n)) return 'ク'; return null; };

const read = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => { const p = path.join(dir, e.name); return e.isDirectory() ? (e.name === 'temp' ? [] : walk(p)) : (e.name.endsWith('.json') ? [p] : []); });

// ---- 読み込み ----
const aliases = new Set();
for (const e of read(path.join(ROOT, 'data', 'tournaments', 'team-name-aliases.json'), { teamAliases: [] }).teamAliases) for (const a of e.aliases || []) aliases.add(norm(a));
const teams = read(path.join(ROOT, 'data', 'teams', 'teams.json'), []);
const ctx = read(path.join(ROOT, 'data', 'teams', 'team-context.json'), {});
const homo = read(path.join(ROOT, 'data', 'players', 'homonyms.json'), []);
const homoNames = new Set(homo.map((o) => o.lastName + '\t' + o.firstName));

// ---- データ走査 ----
const prefCount = new Map();
let brokenRefs = 0; const brokenEx = [];
let dupIds = 0; const dupEx = [];
let aliasLeft = 0;
const appByName = new Map(); // name -> [(year,stage)]
for (const f of walk(DET)) {
  const d = read(f, null); if (!d || !Array.isArray(d.participants)) continue;
  const rel = path.relative(DET, f).split(path.sep); const tid = rel[0]; const year = /^\d{4}$/.test(rel[1]) ? +rel[1] : null; const stage = catOf(tid);
  const ids = new Set(); const seen = new Set();
  for (const p of d.participants) {
    if (p.prefecture != null) prefCount.set(p.prefecture, (prefCount.get(p.prefecture) || 0) + 1);
    if (aliases.has(norm(p.team))) aliasLeft++;
    if (p.id) { if (seen.has(p.id) && !ids.has('dup:' + p.id)) { dupIds++; ids.add('dup:' + p.id); if (dupEx.length < 5) dupEx.push(rel.join('/') + ' : ' + p.id); } seen.add(p.id); ids.add(p.id); }
    const nm = (p.lastName || '') + '\t' + (p.firstName || '');
    if (p.lastName && year && stage) (appByName.get(nm) || appByName.set(nm, []).get(nm)).push([year, stage]);
  }
  for (const e of d.entries || []) for (const r of e.playerIds || []) if (!ids.has(r)) { brokenRefs++; if (brokenEx.length < 5) brokenEx.push(rel.join('/') + ' : ' + r); }
}

// ---- チェックA: 未解決の県値 ----
const unresolvedPref = [...prefCount.entries()].filter(([v]) => v != null && !REAL.has(v) && !FOREIGN.has(v) && !/連盟|学連|体連/.test(v)).sort((a, b) => b[1] - a[1]);

// ---- チェックB: 未統合の表記候補（teams.json から県内コア一致を再計算し autoOK/要確認に分類）----
const memGenre = (id) => { const g = (ctx[id] || {}).genres || []; return g.length === 1 ? g[0] : null; };
const instOf = (id) => new Set((ctx[id] || {}).inst || []);
const blocks = new Map();
for (const t of teams) { const b = t.prefecture || '__none__'; (blocks.get(b) || blocks.set(b, []).get(b)).push(t); }
let candAuto = 0, candReview = 0; const reviewEx = [];
for (const [, arr] of blocks) {
  const byCore = new Map();
  for (const t of arr) { const c = core(t.name); (byCore.get(c) || byCore.set(c, []).get(c)).push(t); }
  for (const [, members] of byCore) {
    if (members.length < 2) continue;
    // defaultGroups（ジャンル優先）
    const keys = members.map((m, i) => { const g = memGenre(m.id); return g != null ? 'G:' + g : 'N:' + (level(m.name) || 'b' + i); });
    const byG = {}; members.forEach((m, i) => (byG[keys[i]] = byG[keys[i]] || []).push(m));
    const hasMerge = Object.values(byG).some((ms) => ms.length >= 2); // 統合が発生するか（分離のみは対応不要）
    let ok = true;
    for (const g in byG) { const ms = byG[g]; for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) { const a = instOf(ms[i].id), b = instOf(ms[j].id); for (const x of a) if (b.has(x)) ok = false; } }
    if (!hasMerge) continue; // 全メンバーが別グループ＝確定分離。対応不要。
    if (ok) candAuto++; else { candReview++; if (reviewEx.length < 8) reviewEx.push(members.map((m) => m.name).join(' / ')); }
  }
}

// ---- チェックC: 同名別校の疑い ----
const reviewPref = teams.filter((t) => t.reviewPrefectures);

// ---- チェックD: 未登録の同姓同名（同年×非隣接段階）----
const newHomo = [];
for (const [nm, aps] of appByName) {
  const byy = new Map();
  for (const [y, s] of aps) { if (ORD[s] != null) (byy.get(y) || byy.set(y, new Set()).get(y)).add(s); }
  const conf = [...byy.values()].some((set) => { const o = [...set].map((s) => ORD[s]); return o.length > 1 && Math.max(...o) - Math.min(...o) >= 2; });
  if (conf && !homoNames.has(nm)) newHomo.push(nm.replace('\t', ''));
}

// ---- 出力 ----
const line = (label, n, extra) => console.log(`${n > 0 ? '⚠' : '✓'} ${label}: ${n}${extra ? '  ' + extra : ''}`);
console.log('=== 識別・名寄せ ヘルスチェック ===\n');
line('[県] 未解決の県値', unresolvedPref.length, unresolvedPref.length ? '例: ' + unresolvedPref.slice(0, 5).map(([v, c]) => `${v}(${c})`).join(', ') : '');
line('[参照] playerIds 参照切れ', brokenRefs, brokenEx.join(' / '));
line('[参照] participant id 重複', dupIds, dupEx.join(' / '));
line('[チーム] 別名のまま残る出場', aliasLeft, aliasLeft ? '→ normalize-team-names.mjs --scope=all' : '');
line('[チーム] 自動OK可の未統合候補', candAuto, candAuto ? '→ apply-auto-merges.mjs' : '');
line('[チーム] 要人手レビュー候補(同一大会同居等)', candReview, reviewEx.length ? '例: ' + reviewEx.slice(0, 4).join(' ｜ ') : '');
line('[チーム] 同名別校の疑い(reviewPrefectures)', reviewPref.length, reviewPref.slice(0, 4).map((t) => t.name).join(', '));
line('[選手] 未登録の同姓同名(同年×非隣接段階)', newHomo.length, newHomo.slice(0, 8).join(', '));

const total = unresolvedPref.length + brokenRefs + dupIds + aliasLeft + candAuto + candReview + reviewPref.length + newHomo.length;
console.log(`\n合計 要対応シグナル: ${total}`);
console.log('注: 「内部略称(理大/理科大)」「同校別年の同姓同名」は信号が無く本チェックでは検出不可。');
process.exitCode = total > 0 ? 1 : 0;
