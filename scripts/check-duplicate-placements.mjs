#!/usr/bin/env node
// scripts/check-duplicate-placements.mjs
//
// 「1人の選手が、同じ大会・同じ年・同じ種目/性別で、最終成績（results[].tournament.rank）を
// 2つ以上持っていないか」を検査する。
//
// なぜ要るか（docs/raw/2026-07-26-idea-tournament-metadata-platform.md 追記10）:
// 2025年のアジア競技大会日本代表予選会は、1つの大会を
// `singles-tournament-*`（決勝トーナメント）/ `singles-semifinal-*`（準決勝リーグ）/
// `singles-final-*`（決勝リーグ）の**3カテゴリに分割**して取り込んでいる。
// このとき各カテゴリが独立に `tournament.rank` を持つと、同じ大会の同じ選手が
// 「ベスト8」と「優勝」の2エントリーとして集計され、進出率（reachRates）の分母・分子や
// タイトル数が二重計上される。
//
// 規約: **段階分割された大会では、最終成績は決着したカテゴリだけが持つ**。
// 先の段階へ進んだ選手は、手前のカテゴリでは `tournament: null` にする。
// 詳細は docs/wiki/data-model.md「段階で分割された大会の最終成績」。
//
// 誤検知を避けるための絞り込みが3つある。
//   1. 同一 category（singles/doubles/team）× 同一 gender の中だけで比較する
//      （全日本選手権のダブルスとミックスのような種目またぎの複数出場は正常）
//   2. **異なる categoryId** の間だけで比較する。同じ categoryId に同名が2回出るのは
//      同姓同名の別人であって段階分割ではない（名寄せは homonyms.json の担当）
//   3. 比較する2つのうち**少なくとも一方の age が「段階」語彙**であること。
//      段階語彙: final / semifinal / tournament / qualifying / upper / lower / top / second。
//      これを条件にしないと、全日本シニアの over50 と over60 の重複出場や
//      全国小学生の学年別クラスまで拾ってしまう（どちらも正常な別イベント）。
//
// 実行: npm run check:placements
// 終了コード: 問題があれば 1（データの不整合なので、こちらはビルドを止めてよい種類）

import fs from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), 'data', 'tournaments', 'details');

/**
 * 「段階」を表す age 語彙。1つの大会を複数カテゴリに割ったときにここが変わる。
 * 実測で、この語彙を使っているのは asian-games-qualifier / primaryschool-akita-indoor /
 * zennihon-secondaryschool-club-pre の3大会のみ（2026-08-25 時点）。
 */
const STAGE_AGES = new Set(['final', 'semifinal', 'tournament', 'qualifying', 'upper', 'lower', 'top', 'second']);

/** categoryId（`{disc}-{age}-{gender}`）を disc / age / gender に分解する。 */
function parseCategoryId(base) {
  const parts = base.split('-');
  if (parts.length < 3) return null;
  const gender = parts.pop();
  const age = parts.pop();
  return { disc: parts.join('-'), age, gender };
}

const problems = [];
let scannedTournaments = 0;

for (const tid of fs.readdirSync(ROOT)) {
  const tDir = path.join(ROOT, tid);
  if (!fs.statSync(tDir).isDirectory()) continue;

  for (const year of fs.readdirSync(tDir)) {
    const yDir = path.join(tDir, year);
    if (!fs.statSync(yDir).isDirectory()) continue;
    scannedTournaments += 1;

    // `${disc}\t${gender}\t${選手名}` -> [{categoryId, label}]
    const placements = new Map();

    for (const file of fs.readdirSync(yDir)) {
      if (!file.endsWith('.json')) continue;
      const base = file.replace(/\.json$/, '');
      const parsed = parseCategoryId(base);
      if (!parsed) continue;

      let detail;
      try {
        detail = JSON.parse(fs.readFileSync(path.join(yDir, file), 'utf-8'));
      } catch {
        continue;
      }

      const nameById = new Map((detail.participants ?? []).map((p) => [p.id, `${p.lastName ?? ''}${p.firstName ?? ''}`]));
      const playersByEntry = new Map((detail.entries ?? []).map((e) => [e.entryNo, e.playerIds ?? []]));

      for (const r of detail.results ?? []) {
        const kind = r?.tournament?.rank?.kind;
        // 'ongoing' は「まだ確定していない」なので最終成績ではない（ADR-007）
        if (!kind || kind === 'ongoing') continue;

        for (const pid of playersByEntry.get(r.entryNo) ?? []) {
          const name = nameById.get(pid);
          if (!name) continue;
          const key = `${parsed.disc}\t${parsed.gender}\t${name}`;
          const arr = placements.get(key) ?? [];
          arr.push({ categoryId: base, age: parsed.age, label: r.tournament?.label ?? kind });
          placements.set(key, arr);
        }
      }
    }

    for (const [key, arr] of placements) {
      // 同一 categoryId の重複は同姓同名（別人）なので落とす
      const byCategory = new Map();
      for (const e of arr) if (!byCategory.has(e.categoryId)) byCategory.set(e.categoryId, e);
      if (byCategory.size < 2) continue;

      // 段階分割の疑いがあるときだけ報告する
      const cats = [...byCategory.values()];
      if (!cats.some((c) => STAGE_AGES.has(c.age))) continue;

      const [disc, gender, name] = key.split('\t');
      problems.push({ tournamentId: tid, year, disc, gender, name, entries: cats });
    }
  }
}

console.log('check-duplicate-placements');
console.log('='.repeat(60));
console.log(`走査した 大会×年: ${scannedTournaments}`);

if (problems.length === 0) {
  console.log('問題なし（1選手が同一大会・同一種目で複数の最終成績を持つケースは無い）');
  process.exit(0);
}

console.log(`\n重複した最終成績: ${problems.length} 件`);
for (const p of problems) {
  console.log(`\n  ${p.tournamentId} / ${p.year} / ${p.disc}-${p.gender} / ${p.name}`);
  for (const e of p.entries) {
    console.log(`    - ${e.categoryId}: ${e.label}`);
  }
}
console.log('\n段階で分割された大会では、最終成績は決着したカテゴリだけが持つこと。');
console.log('先の段階へ進んだ選手は、手前のカテゴリでは tournament: null にする。');
console.log('詳細: docs/wiki/data-model.md「段階で分割された大会の最終成績」');
process.exit(1);
