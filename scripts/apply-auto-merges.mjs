// merge-candidates のうち「自動OK」判定のクラスタの統合を一括で alias 表へ適用する。
// 判定ロジックはレビューHTML(build-team-review-html.mjs)と同一:
//   - 既定グループ: 出場大会のジャンル(小/中/高/大/成)で分割。一意でなければ名前段階で補完。
//   - 自動OK: 同一グループ内で「同一大会(大会id+年)」に表記が同居しなければ自動OK。
//   - 自動OKクラスタの各統合グループ(≥2)を {canonical:最多表記, aliases:残り} として追加。
// 適用後は normalize-team-names.mjs + build-team-master.mjs の再実行が必要。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyAdditions } from './apply-team-aliases.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clusters = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams', 'merge-candidates.json'), 'utf8'));
const ctx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams', 'team-context.json'), 'utf8'));

function level(n) {
  if (/中学/.test(n)) return '中';
  if (/高校|高等学校/.test(n)) return '高';
  if (/大学/.test(n)) return '大';
  if (/小学|スポーツ少年団|スポ少|ジュニア/.test(n)) return '小';
  if (/クラブ|ＯＢ|OB|役場|電力|協会|ＳＴＣ|STC|JSC/.test(n)) return 'ク';
  return null;
}
const memGenre = (m) => { const g = (ctx[m.id] || {}).genres || []; return g.length === 1 ? g[0] : null; };
const instOf = (m) => new Set((ctx[m.id] || {}).inst || []);
function defaultGroups(members) {
  const keys = members.map((m, i) => { const g = memGenre(m); return g != null ? 'G:' + g : 'N:' + (level(m.name) || 'bare' + i); });
  const uniq = [...new Set(keys)]; const idx = {}; uniq.forEach((k, i) => (idx[k] = i));
  return keys.map((k) => idx[k]);
}
function autoOK(c) {
  const groups = defaultGroups(c.members); const byG = {};
  c.members.forEach((m, i) => (byG[groups[i]] = byG[groups[i]] || []).push(m));
  for (const g in byG) { const ms = byG[g];
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
      const a = instOf(ms[i]), b = instOf(ms[j]); for (const x of a) if (b.has(x)) return false;
    } }
  return true;
}
function mergeEntries(c) {
  const groups = defaultGroups(c.members); const byG = {};
  c.members.forEach((m, i) => (byG[groups[i]] = byG[groups[i]] || []).push(m));
  const out = [];
  for (const g in byG) { const ms = byG[g]; if (ms.length < 2) continue;
    ms.sort((a, b) => b.count - a.count);
    out.push({ canonical: ms[0].name, aliases: ms.slice(1).map((m) => m.name), note: c.prefecture || '' });
  }
  return out;
}

const additions = [];
let autoClusters = 0;
for (const c of clusters) { if (!autoOK(c)) continue; autoClusters++; for (const e of mergeEntries(c)) additions.push(e); }
console.log(`自動OKクラスタ: ${autoClusters} / 統合グループ(別名追加): ${additions.length}`);
const res = applyAdditions(additions);
console.log(`alias反映: 適用 ${res.applied.length} / スキップ ${res.skipped.length} / 競合 ${res.conflicts.length}`);
if (res.conflicts.length) for (const x of res.conflicts.slice(0, 10)) console.warn('  競合:', x.canonical, JSON.stringify(x.issues));
console.log('→ 次: node scripts/normalize-team-names.mjs --scope=all && node scripts/build-team-master.mjs');
