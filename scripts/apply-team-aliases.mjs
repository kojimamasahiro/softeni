// レビュー結果（team-alias-additions.json 形式の配列）を
// data/tournaments/team-name-aliases.json へ取り込む（重複・競合チェック付き）。
//
// 追加要素の形式: { canonical, aliases:[...], note }
//  - 既存の同一 canonical があれば aliases を和集合でマージ。
//  - alias が別の canonical に既に割り当て済み / 既存の canonical と衝突する場合はスキップして競合報告。
//
// 使い方:
//   node scripts/apply-team-aliases.mjs path/to/team-alias-additions.json
//   （適用後に必要なら node scripts/build-team-master.mjs を実行）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALIAS = path.join(ROOT, 'data', 'tournaments', 'team-name-aliases.json');

export function applyAdditions(additions) {
  const doc = JSON.parse(fs.readFileSync(ALIAS, 'utf8'));
  doc.teamAliases = doc.teamAliases || [];
  const byCanon = new Map(doc.teamAliases.map((e) => [e.canonical, e]));
  const aliasOwner = new Map();
  for (const e of doc.teamAliases) for (const a of e.aliases || []) aliasOwner.set(a, e.canonical);

  const applied = [], skipped = [], conflicts = [];
  for (const add of additions || []) {
    const canon = add.canonical;
    if (!canon || !Array.isArray(add.aliases)) { skipped.push({ canonical: canon, reason: '形式不正' }); continue; }
    // 競合チェック
    const bad = [];
    for (const a of add.aliases) {
      if (a === canon) continue;
      const owner = aliasOwner.get(a);
      if (owner && owner !== canon) bad.push({ alias: a, reason: '別canonicalに割当済', existing: owner });
      if (byCanon.has(a) && a !== canon) bad.push({ alias: a, reason: '既存canonicalをaliasにしようとした' });
    }
    if (bad.length) { conflicts.push({ canonical: canon, issues: bad }); skipped.push({ canonical: canon, reason: '競合' }); continue; }
    // 適用
    let e = byCanon.get(canon);
    if (!e) { e = { canonical: canon, aliases: [] }; if (add.note) e.note = add.note; doc.teamAliases.push(e); byCanon.set(canon, e); }
    const set = new Set(e.aliases);
    let added = 0;
    for (const a of add.aliases) { if (a !== canon && !set.has(a)) { set.add(a); aliasOwner.set(a, canon); added++; } }
    e.aliases = [...set];
    if (added) applied.push({ canonical: canon, added });
  }
  fs.writeFileSync(ALIAS, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  return { applied, skipped, conflicts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) { console.error('使い方: node scripts/apply-team-aliases.mjs <additions.json>'); process.exit(1); }
  const additions = JSON.parse(fs.readFileSync(file, 'utf8'));
  const res = applyAdditions(additions);
  console.log(`適用: ${res.applied.length} canonical / スキップ: ${res.skipped.length} / 競合: ${res.conflicts.length}`);
  if (res.conflicts.length) { console.warn('⚠ 競合（取り込まず）:'); for (const c of res.conflicts) console.warn('  ', c.canonical, JSON.stringify(c.issues)); }
  console.log('→ マスタ再生成: node scripts/build-team-master.mjs');
}
