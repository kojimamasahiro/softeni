#!/usr/bin/env node
/**
 * 中学カテゴリを高校型（都道府県ページ→チームページ）で作った場合の規模を実測する。
 *
 * 何を決めるための道具か:
 *   1. 掲載閾値をいくつにするか（薄いページを量産しない下限）
 *   2. ブロック大会を対象に含めるか（含めないと閾値を満たす校が足りるのか）
 *   3. 「学校」ではなく「チーム」として設計する必要がどの程度あるか（クラブの比率）
 *
 * 前提: 先に scripts/normalize-team-names.mjs --scope=all で名寄せを済ませておくこと。
 *       名寄せ前に測ると表記ゆれのぶんだけチーム数が水増しされる（2026-08-12 に実測で確認）。
 *
 * 検討記録: docs/raw/2026-08-12-idea-juniorhigh-category-pages.md
 * 使い方: node scripts/measure-juniorhigh-scale.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DET = path.join(ROOT, 'data', 'tournaments', 'details');

/** 中学の大会。ブロック大会だけ別グループにして「込み/なし」を比較できるようにする。 */
const BLOCKS = ['hokkaido', 'tohoku', 'hokushinetsu', 'kanto', 'tokai', 'kinki', 'chugoku', 'shikoku', 'kyushu'].map((b) => `secondaryschool-${b}-block`);
const NATIONAL = ['secondaryschool-championship', 'zennihon-secondaryschool-versus', 'zennihon-secondaryschool-club-pre'];

const THRESHOLDS = [1, 3, 5, 10, 15];

// lib/clubTransition.ts と同じ分類規約（下限カウント）。
// TS を直接 import できないのでここでは同等の正規表現を持つ。判定を変えるときは両方直すこと。
const SCHOOL_MARKER = /(中学校|中等教育学校|義務教育学校|学園|学院|義塾|附属|付属|高等学校|高校|中$)/;
const CLUB_MARKER =
  /クラブ|ｸﾗﾌﾞ|CLUB|ＣＬＵＢ|スポ少|スポーツ少年団|少年団|ジュニア|ユース|協会|S[.・]?T[.・]?C|Ｓ[.・]?Ｔ[.・]?Ｃ|J[.・]?S[.・]?T?[.・]?C|S[.・]?O[.・]?C|Jr/i;
const LATIN_SEPARATORS = /[.・\-＿_'’`~×＊*\s（）()]/g;
const LATIN_RUN = /[A-Za-zＡ-Ｚａ-ｚ]{2,}/;
const KATAKANA_RUN = /[ァ-ヶー]{3,}/;

function classify(name) {
  if (SCHOOL_MARKER.test(name)) return 'school';
  if (CLUB_MARKER.test(name)) return 'club';
  if (LATIN_RUN.test(name.replace(LATIN_SEPARATORS, ''))) return 'club';
  if (KATAKANA_RUN.test(name)) return 'club';
  return 'unknown';
}

/** 大会群を走査し、(チーム名, 都道府県) ごとの出場延べ数と性別の出現を数える。 */
function collect(tournamentIds) {
  const teams = new Map(); // "name\tpref" -> { name, pref, count, genders:Set }
  for (const tid of tournamentIds) {
    const dir = path.join(DET, tid);
    if (!fs.existsSync(dir)) continue;
    for (const year of fs.readdirSync(dir).filter((y) => /^\d{4}$/.test(y))) {
      for (const file of fs.readdirSync(path.join(dir, year)).filter((f) => f.endsWith('.json'))) {
        let data;
        try {
          data = JSON.parse(fs.readFileSync(path.join(dir, year, file), 'utf8'));
        } catch {
          continue;
        }
        // ファイル名 `category-age-gender.json` の最後のセグメントが性別
        const gender = file
          .replace(/\.json$/, '')
          .split('-')
          .pop();
        for (const p of data.participants ?? []) {
          const name = p?.team?.trim();
          if (!name) continue;
          const key = `${name}\t${p.prefecture ?? ''}`;
          const rec = teams.get(key) ?? { name, pref: p.prefecture ?? null, count: 0, genders: new Set() };
          rec.count += 1;
          if (gender === 'boys' || gender === 'girls') rec.genders.add(gender);
          teams.set(key, rec);
        }
      }
    }
  }
  return [...teams.values()];
}

function report(title, tournamentIds) {
  const teams = collect(tournamentIds);
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
  console.log(`収録団体（名寄せ後・県別に区別）: ${teams.length}`);

  console.log('\n閾値  対象団体  ページ数  県中央値  0件の県  学校  クラブ  判定不能');
  for (const th of THRESHOLDS) {
    const kept = teams.filter((t) => t.count >= th);
    // 男女別ページを別URLとする前提。性別が取れないものは1ページで数える
    const pages = kept.reduce((n, t) => n + Math.max(t.genders.size, 1), 0);
    const byPref = new Map();
    for (const t of kept) if (t.pref) byPref.set(t.pref, (byPref.get(t.pref) ?? 0) + 1);
    const counts = [...byPref.values()].sort((a, b) => a - b);
    const median = counts.length ? counts[Math.floor(counts.length / 2)] : 0;
    const kinds = { school: 0, club: 0, unknown: 0 };
    for (const t of kept) kinds[classify(t.name)] += 1;
    console.log(
      `${String(th).padStart(3)}  ${String(kept.length).padStart(8)}  ${String(pages).padStart(8)}  ${String(median).padStart(8)}  ${String(47 - byPref.size).padStart(7)}  ${String(kinds.school).padStart(4)}  ${String(kinds.club).padStart(6)}  ${String(kinds.unknown).padStart(8)}`,
    );
  }

  // 閾値5の県別分布（薄い県がどこか）
  const kept5 = teams.filter((t) => t.count >= 5);
  const byPref5 = new Map();
  for (const t of kept5) if (t.pref) byPref5.set(t.pref, (byPref5.get(t.pref) ?? 0) + 1);
  const sorted = [...byPref5.entries()].sort((a, b) => a[1] - b[1]);
  console.log(
    `\n閾値5のとき、団体数が少ない県: ${sorted
      .slice(0, 8)
      .map(([p, n]) => `${p}${n}`)
      .join(' / ')}`,
  );
  console.log(
    `閾値5のとき、団体数が多い県: ${sorted
      .slice(-5)
      .reverse()
      .map(([p, n]) => `${p}${n}`)
      .join(' / ')}`,
  );
}

report('A) 全中＋県対抗＋クラブ選手権プレ（ブロック大会なし）', NATIONAL);
report('B) A＋9ブロック大会（ブロック込み）', [...NATIONAL, ...BLOCKS]);

// 参考: 高校（既存カテゴリ）の同じ物差し
report('参考) 高校 3大会（IH・ハイジャパ・選抜）', ['highschool-championship', 'highschool-japan-cup', 'highschool-senbatsu']);
