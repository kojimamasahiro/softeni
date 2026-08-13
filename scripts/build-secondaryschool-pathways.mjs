#!/usr/bin/env node
/**
 * 「中学 → 高校」の進路接続を生成する。出力: data/secondaryschool/pathways.json
 *
 * これは中学カテゴリの差別化の核。中学と高校の両方を名寄せ済みで持っているサイトにしか作れない。
 * 検討記録: docs/raw/2026-08-12-idea-juniorhigh-category-pages.md（候補1）
 *
 * 採用の条件（誤マッチを出さないためのゲート）:
 *   1. 中学の最終出場年 < 高校の初出場年（時系列が進学として成立する）
 *   2. 次のどちらかを満たす
 *      a) **ペア継続**: 中学で組んだダブルスのペアが、高校でも同じ2人で出ている。
 *         ペア単位の一致は誤マッチ率が実質ゼロという既存実測がある（news-context-blocks.md、
 *         IH2026で名前セットの重複0件）。最も安全な単位
 *      b) **県一致**: 中学の所属県と高校の所属県が一致する
 *   3. 同姓同名の疑いがある氏名を除外する。「中学側で同一年に3チーム以上へ出現する氏名」＝
 *      確実に別人が混ざっている証拠。2026-08-12 の実測では 0件/2,956人 だったが、
 *      データが増えたときに効くよう判定は残す
 *
 * **県をまたぐ単独一致（越境進学と誤マッチの混在）は採用しない**。2026-08-12 時点で
 * 追跡候補547件のうち県一致は301件で、残り246件がこれに当たる。
 * 越境進学を取りこぼすが、誤った進学先を出すほうが害が大きいため。
 *
 * 前提: 先に scripts/normalize-team-names.mjs --scope=all で名寄せを済ませること。
 * 使い方: node scripts/build-secondaryschool-pathways.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DET = path.join(ROOT, 'data', 'tournaments', 'details');
const OUT = path.join(ROOT, 'data', 'secondaryschool', 'pathways.json');

const BLOCK_IDS = ['hokkaido', 'tohoku', 'hokushinetsu', 'kanto', 'tokai', 'kinki', 'chugoku', 'shikoku', 'kyushu'].map((b) => `secondaryschool-${b}-block`);
const JHS_TOURNAMENTS = ['secondaryschool-championship', 'zennihon-secondaryschool-versus', 'zennihon-secondaryschool-club-pre', ...BLOCK_IDS];
const HS_TOURNAMENTS = ['highschool-championship', 'highschool-japan-cup', 'highschool-senbatsu'];

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * 大会群を走査し、選手の出場記録とダブルスのペアを集める。
 * 氏名は「姓+名」をキーにする（team 非依存。players/index.json と同じ規約）。
 */
function scan(tournamentIds) {
  /** name -> [{year, team, prefecture}] */
  const people = new Map();
  /** `nameA\tnameB`（ソート済み） -> [{year, teams:[..]}] */
  const pairs = new Map();
  /** name -> Map<year, Set<team>> 同姓同名検出用 */
  const teamsByYear = new Map();

  for (const tid of tournamentIds) {
    const dir = path.join(DET, tid);
    if (!fs.existsSync(dir)) continue;
    for (const year of fs.readdirSync(dir).filter((y) => /^\d{4}$/.test(y))) {
      for (const file of fs.readdirSync(path.join(dir, year)).filter((f) => f.endsWith('.json'))) {
        const data = readJson(path.join(dir, year, file), null);
        if (!data || !Array.isArray(data.participants)) continue;
        const y = Number(year);
        // ファイル名 `category-age-gender.json` の最後のセグメントが性別。
        // 高校の学校ページが男女別（/highschool/[gender]/...）なので、逆引きで
        // 男子ページに女子選手を出さないために記録する。
        const genderOfFile = file
          .replace(/\.json$/, '')
          .split('-')
          .pop();
        const byPid = new Map();
        for (const p of data.participants) {
          if (!p?.id || !p.lastName || !p.firstName) continue;
          const name = `${p.lastName}${p.firstName}`;
          const team = (p.team ?? '').trim() || null;
          byPid.set(p.id, { name, team, prefecture: p.prefecture ?? null });
          const list = people.get(name) ?? [];
          list.push({ year: y, team, prefecture: p.prefecture ?? null, tournamentId: tid, gender: genderOfFile });
          people.set(name, list);
          const ty = teamsByYear.get(name) ?? new Map();
          const set = ty.get(y) ?? new Set();
          if (team) set.add(team);
          ty.set(y, set);
          teamsByYear.set(name, ty);
        }
        if (!file.includes('doubles')) continue;
        for (const e of data.entries ?? []) {
          const ids = e.playerIds ?? [];
          if (ids.length !== 2) continue;
          const a = byPid.get(ids[0]);
          const b = byPid.get(ids[1]);
          if (!a || !b) continue;
          const key = [a.name, b.name].sort().join('\t');
          const list = pairs.get(key) ?? [];
          list.push({ year: y, teams: [...new Set([a.team, b.team].filter(Boolean))] });
          pairs.set(key, list);
        }
      }
    }
  }
  return { people, pairs, teamsByYear };
}

function main() {
  const jhs = scan(JHS_TOURNAMENTS);
  const hs = scan(HS_TOURNAMENTS);

  // 同姓同名の疑い: 中学側で同一年に3チーム以上へ出現する氏名（＝確実に別人が混在）
  const suspicious = new Set();
  for (const [name, byYear] of jhs.teamsByYear) {
    for (const set of byYear.values()) if (set.size >= 3) suspicious.add(name);
  }

  // ペア継続: 中学で組んだペアが、より後の年に高校でも同じ2人で出ている
  const pairContinued = new Set();
  for (const [key, jList] of jhs.pairs) {
    const hList = hs.pairs.get(key);
    if (!hList) continue;
    const jMin = Math.min(...jList.map((x) => x.year));
    if (hList.some((x) => x.year > jMin)) key.split('\t').forEach((n) => pairContinued.add(n));
  }

  const index = readJson(path.join(ROOT, 'data', 'secondaryschool', 'index.json'), { teams: [] });
  const teamKey = (name, pref) => `${name}\t${pref ?? ''}`;
  const publishedTeams = new Set(index.teams.map((t) => teamKey(t.name, t.prefecture)));

  /** `中学名\t県` -> 進路レコード[] */
  const byTeam = new Map();
  let considered = 0;
  let acceptedPair = 0;
  let acceptedPref = 0;
  let rejectedCrossPref = 0;
  let rejectedHomonym = 0;

  for (const [name, jList] of jhs.people) {
    const hList = hs.people.get(name);
    if (!hList) continue;
    considered += 1;
    if (suspicious.has(name)) {
      rejectedHomonym += 1;
      continue;
    }
    const jLast = Math.max(...jList.map((x) => x.year));
    const hFirst = Math.min(...hList.map((x) => x.year));
    if (!(hFirst > jLast)) continue;

    // 中学側は最終年の所属、高校側は初出年の所属を代表にする
    const jRec = jList.filter((x) => x.year === jLast).find((x) => x.team) ?? jList[jList.length - 1];
    const hRec = hList.filter((x) => x.year === hFirst).find((x) => x.team) ?? hList[0];
    if (!jRec?.team || !hRec?.team) continue;

    const prefMatch = Boolean(jRec.prefecture && hRec.prefecture && jRec.prefecture === hRec.prefecture);
    const viaPair = pairContinued.has(name);
    if (!prefMatch && !viaPair) {
      rejectedCrossPref += 1;
      continue;
    }
    if (viaPair) acceptedPair += 1;
    else acceptedPref += 1;

    const key = teamKey(jRec.team, jRec.prefecture);
    if (!publishedTeams.has(key)) continue; // 掲載閾値未満の中学は対象外
    const list = byTeam.get(key) ?? [];
    list.push({
      player: name,
      jhsLastYear: jLast,
      highschool: hRec.team,
      highschoolPrefecture: hRec.prefecture,
      highschoolFirstYear: hFirst,
      // 高校側の性別。逆引き（高校ページ→出身中学）で男女を出し分けるために持つ。
      // mixed は男女どちらのページにも出す規約（highschool.md）に合わせて null にする
      highschoolGender: hRec.gender === 'boys' || hRec.gender === 'girls' ? hRec.gender : null,
      // 採用根拠。UIには出さないが、後から誤りを追えるように残す
      basis: viaPair ? (prefMatch ? 'pair+pref' : 'pair') : 'pref',
    });
    byTeam.set(key, list);
  }

  const pathways = {};
  for (const [key, list] of byTeam) {
    pathways[key] = list.sort((a, b) => b.highschoolFirstYear - a.highschoolFirstYear || a.player.localeCompare(b.player, 'ja'));
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ pathways }, null, 2) + '\n', 'utf8');

  const total = Object.values(pathways).reduce((n, l) => n + l.length, 0);
  console.log('data/secondaryschool/pathways.json を生成しました');
  console.log(`  中高の両方に出る氏名: ${considered}`);
  console.log(`  採用: ${acceptedPair + acceptedPref}（ペア継続 ${acceptedPair} / 県一致のみ ${acceptedPref}）`);
  console.log(`  不採用: 県またぎの単独一致 ${rejectedCrossPref} / 同姓同名の疑い ${rejectedHomonym}`);
  console.log(`  掲載チームに紐づいた進路: ${total}件 / ${Object.keys(pathways).length}チーム`);
}

main();
