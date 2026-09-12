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

  const applied = [],
    skipped = [],
    conflicts = [],
    // 別グループを吸収した記録（absorbCanonical 指定時のみ発生する）。
    // 正準名が1つ減るので、呼び出し側が結果を目視できるように返す。
    absorbed = [];
  for (const add of additions || []) {
    const canon = add.canonical;
    if (!canon || !Array.isArray(add.aliases)) {
      skipped.push({ canonical: canon, reason: '形式不正' });
      continue;
    }
    // 別名にしようとしている名前が、それ自体で別グループの正準名になっている場合は
    // **そのグループごと吸収する**（2026-09-12 追加）。
    //
    // なぜ要るか: 人が「A と B は同じチーム」と判断しても、B が既に正準名だと
    // 「既存canonicalをaliasにしようとした」で弾かれ、判断が永久に反映されない。
    // 実測で**人の統合判断19組すべてがこれで落ちていた**（適用0・競合19）。
    // 例: 台帳「学法石川 ← 石川高校」に対し、対応表には
    //     `石川高校 ← [石川高等学校, 学校法人石川高校]` が既にあった。
    // 吸収すると `学法石川 ← [石川高校, 石川高等学校, 学校法人石川高校]` になる。
    //
    // どちらを正準名にするかは**呼び出し側が決めたもの（add.canonical）に従う**。
    // 判断台帳の canonical は最頻出の表記なので、サイトの表示名が変わらず差分も最小になる。
    if (!add.absorbCanonical) {
      // 従来どおり競合として弾く（既定）。
    } else {
      // forbid: 人が「別グループ」と判断した名前。吸収の巻き込みで一緒に入れてはならない。
      //
      // なぜ要るか（2026-09-12 に実際にやらかした）: 吸収は相手グループの別名を全部引き取るため、
      // 人が明示的に除外した名前まで混入する。`修大附鈴峯` に高校2表記だけを統合したはずが、
      // 吸収元の配下にいた `修道大附鈴峯女子中学校` が一緒に移り、中学校の出場9名が
      // 高校側へ吸収された（データ本体まで書き換わった）。
      const forbid = new Set(add.forbid || []);
      for (const a of add.aliases) {
        if (a === canon) continue;
        const victim = byCanon.get(a);
        if (!victim) continue;
        if (forbid.has(a)) continue;
        const move = (victim.aliases || []).filter((x) => x !== canon && !forbid.has(x));
        const keep = (victim.aliases || []).filter((x) => forbid.has(x));
        for (const x of move) {
          add.aliases.push(x);
          aliasOwner.delete(x);
        }
        if (keep.length) {
          // 禁止された別名は宙に浮かせず、別グループとして残す
          victim.canonical = keep[0];
          victim.aliases = keep.slice(1);
          byCanon.delete(a);
          byCanon.set(keep[0], victim);
          for (const x of keep) aliasOwner.delete(x);
        } else {
          const i = doc.teamAliases.indexOf(victim);
          if (i >= 0) doc.teamAliases.splice(i, 1);
          byCanon.delete(a);
        }
        aliasOwner.delete(a);
        absorbed.push({ into: canon, from: a, moved: move.length, kept: keep.length });
      }
      add.aliases = [...new Set(add.aliases)];
    }

    // 競合チェック
    const bad = [];
    for (const a of add.aliases) {
      if (a === canon) continue;
      const owner = aliasOwner.get(a);
      if (owner && owner !== canon) bad.push({ alias: a, reason: '別canonicalに割当済', existing: owner });
      if (byCanon.has(a) && a !== canon) bad.push({ alias: a, reason: '既存canonicalをaliasにしようとした' });
    }
    if (bad.length) {
      conflicts.push({ canonical: canon, issues: bad });
      skipped.push({ canonical: canon, reason: '競合' });
      continue;
    }
    // 適用
    let e = byCanon.get(canon);
    if (!e) {
      e = { canonical: canon, aliases: [] };
      if (add.note) e.note = add.note;
      doc.teamAliases.push(e);
      byCanon.set(canon, e);
    }
    const set = new Set(e.aliases);
    let added = 0;
    for (const a of add.aliases) {
      if (a !== canon && !set.has(a)) {
        set.add(a);
        aliasOwner.set(a, canon);
        added++;
      }
    }
    e.aliases = [...set];
    if (added) applied.push({ canonical: canon, added });
  }
  fs.writeFileSync(ALIAS, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  return { applied, skipped, conflicts, absorbed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error('使い方: node scripts/apply-team-aliases.mjs <additions.json>');
    process.exit(1);
  }
  const additions = JSON.parse(fs.readFileSync(file, 'utf8'));
  const res = applyAdditions(additions);
  console.log(`適用: ${res.applied.length} canonical / スキップ: ${res.skipped.length} / 競合: ${res.conflicts.length}`);
  if (res.conflicts.length) {
    console.warn('⚠ 競合（取り込まず）:');
    for (const c of res.conflicts) console.warn('  ', c.canonical, JSON.stringify(c.issues));
  }
  console.log('→ マスタ再生成: node scripts/build-team-master.mjs');
}
