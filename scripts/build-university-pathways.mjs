#!/usr/bin/env node
/**
 * 「高校 → 大学」の進路接続を生成する。出力: data/university/pathways.json
 *
 * 大学カテゴリは地域軸が無い（participants[].prefecture が `日本学連`/`学連`）ため、
 * カテゴリのツリーより先に進路接続を作る方針にした。
 * 検討記録: docs/raw/2026-08-12-idea-university-category-pages.md
 *           docs/raw/2026-08-14-highschool-pathway-sections-design.md（案A）
 * 検証: docs/raw/2026-09-13-university-pathways-verification.md
 *
 * 採用の条件（ADR-014 を高校→大学に適用。変えた点は ADR-014 の追記を参照）:
 *   1. **高校の最終出場年 < 大学の初出場年 <= 高校の最終出場年 + 4**（`MAX_YEAR_GAP`）
 *      中学→高校（5年）・小学→中学（6年）は「理屈上の最長」で決めたが、
 *      高校→大学は**実測で決めた**。時系列上ありえない一致（大学の出場年 <= 高校の出場年）から
 *      偶然一致の率を出すと、誤マッチは年差によらず1年セルあたり約1件で一定なのに、
 *      本物の進学は年差1〜4年に集中する。そのため誤マッチ率の期待値が
 *      年差4年以下 0.9% → 5年 約10% → 6年 約18% と跳ねる（2026-09-13 実測）
 *   2. **同姓同名として検出された氏名を除外**（`buildHomonymSet`。中学版と同じ）
 *   3. **性別が食い違う一致を除外**（高校で女子・大学で男子なら確実に別人。2026-09-13 実測1件）
 *
 * ペアの継続は採用条件にしない。県一致は大学側に県が無いので使えない。
 * `basis` に採用根拠（pair / name）を残す。UIには出さない。
 *
 * 前提: 先に scripts/normalize-team-names.mjs --scope=all で名寄せを済ませること。
 * 使い方: node scripts/build-university-pathways.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DET = path.join(ROOT, 'data', 'tournaments', 'details');
const OUT = path.join(ROOT, 'data', 'university', 'pathways.json');

const HS_TOURNAMENTS = ['highschool-championship', 'highschool-japan-cup', 'highschool-senbatsu'];
const UNIV_TOURNAMENTS = ['zennihon-university', 'zennihon-university-indoor', 'zennihon-university-ouza'];

/** 高校の最終出場年から大学の初出場年までに許す最大の年差（実測で決めた。ヘッダ参照） */
const MAX_YEAR_GAP = 4;

/**
 * 進学先として掲載するチーム名か。元データでチーム名の欄に選手名が入っていて
 * 校名が復元できないもの（`千葉琉翔` など5組。docs/raw/2026-08-12-university-team-name-cleanup.md「保留中」）を落とす。
 * 学連には大学のほかに高専・専門学校も加盟している（`石川工業高等専門学校` `履正社スポーツ専門学校` 等）ので、
 * それらは残す。
 */
const looksLikeUniversity = (name) => /大学|大學|大$|短大|高専|高等専門学校|専門学校/.test(name);

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function* detailFiles(tournamentIds) {
  for (const tid of tournamentIds) {
    const dir = path.join(DET, tid);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    for (const year of fs.readdirSync(dir).filter((y) => /^\d{4}$/.test(y))) {
      for (const file of fs.readdirSync(path.join(dir, year)).filter((f) => f.endsWith('.json'))) {
        const data = readJson(path.join(dir, year, file), null);
        if (data && Array.isArray(data.participants)) yield { year: Number(year), file, data };
      }
    }
  }
}

/**
 * 同姓同名（証拠ベース）。同一大会・同一年・同一種目ファイルに同じ氏名が別チームで2人以上。
 * 収録全大会を走査する。scripts/build-secondaryschool-pathways.mjs と同じ判定。
 */
function buildHomonymSet() {
  const homonyms = new Set();
  if (!fs.existsSync(DET)) return homonyms;
  for (const { data } of detailFiles(fs.readdirSync(DET))) {
    const teamsByName = new Map();
    for (const p of data.participants) {
      if (!p?.lastName || !p.firstName || !p.team) continue;
      const name = `${p.lastName}${p.firstName}`;
      const set = teamsByName.get(name) ?? new Set();
      set.add(p.team);
      teamsByName.set(name, set);
    }
    for (const [name, teams] of teamsByName) if (teams.size > 1) homonyms.add(name);
  }
  return homonyms;
}

/** 出場記録とダブルスのペアを集める。氏名は「姓+名」をキーにする */
function scan(tournamentIds) {
  const people = new Map();
  const pairs = new Map();
  for (const { year, file, data } of detailFiles(tournamentIds)) {
    const gender = file
      .replace(/\.json$/, '')
      .split('-')
      .pop();
    const byPid = new Map();
    for (const p of data.participants) {
      if (!p?.id || !p.lastName || !p.firstName) continue;
      const name = `${p.lastName}${p.firstName}`;
      const team = (p.team ?? '').trim() || null;
      byPid.set(p.id, name);
      const list = people.get(name) ?? [];
      list.push({ year, team, prefecture: p.prefecture ?? null, gender });
      people.set(name, list);
    }
    if (!file.includes('doubles')) continue;
    for (const e of data.entries ?? []) {
      const ids = e.playerIds ?? [];
      if (ids.length !== 2) continue;
      const a = byPid.get(ids[0]);
      const b = byPid.get(ids[1]);
      if (!a || !b) continue;
      const key = [a, b].sort().join('\t');
      const list = pairs.get(key) ?? [];
      list.push(year);
      pairs.set(key, list);
    }
  }
  return { people, pairs };
}

const gendersOf = (list) => new Set(list.map((x) => x.gender).filter((g) => g === 'boys' || g === 'girls'));

function main() {
  const hs = scan(HS_TOURNAMENTS);
  const univ = scan(UNIV_TOURNAMENTS);
  const homonyms = buildHomonymSet();

  // ペア継続: 高校で組んだ2人が、より後の年に大学でも同じ2人で出ている（basis 用）
  const pairContinued = new Set();
  for (const [key, hYears] of hs.pairs) {
    const uYears = univ.pairs.get(key);
    if (uYears && uYears.some((y) => y > Math.min(...hYears))) key.split('\t').forEach((n) => pairContinued.add(n));
  }

  /** 大学名 -> 進路レコード[] */
  const byUniversity = new Map();
  const stat = { considered: 0, pair: 0, name: 0, gap: 0, homonym: 0, gender: 0, notUniversity: 0 };

  for (const [name, hList] of hs.people) {
    const uList = univ.people.get(name);
    if (!uList) continue;
    stat.considered += 1;
    if (homonyms.has(name)) {
      stat.homonym += 1;
      continue;
    }
    const hLast = Math.max(...hList.map((x) => x.year));
    const uFirst = Math.min(...uList.map((x) => x.year));
    if (!(uFirst > hLast)) continue;
    if (uFirst - hLast > MAX_YEAR_GAP) {
      stat.gap += 1;
      continue;
    }
    const hg = gendersOf(hList);
    const ug = gendersOf(uList);
    if (hg.size && ug.size && ![...hg].some((g) => ug.has(g))) {
      stat.gender += 1;
      continue;
    }

    // 高校側は最終年の所属、大学側は初出年の所属を代表にする
    const hRec = hList.filter((x) => x.year === hLast).find((x) => x.team) ?? hList[hList.length - 1];
    const uRec = uList.filter((x) => x.year === uFirst).find((x) => x.team) ?? uList[0];
    if (!hRec?.team || !uRec?.team) continue;
    if (!looksLikeUniversity(uRec.team)) {
      stat.notUniversity += 1;
      continue;
    }

    const viaPair = pairContinued.has(name);
    stat[viaPair ? 'pair' : 'name'] += 1;
    // 性別は高校側・大学側で一致を確認済み。mixed は null（男女どちらのページにも出す）
    const gender = [...hg][0] ?? [...ug][0] ?? null;
    const list = byUniversity.get(uRec.team) ?? [];
    list.push({
      player: name,
      highschool: hRec.team,
      highschoolPrefecture: hRec.prefecture,
      highschoolLastYear: hLast,
      universityFirstYear: uFirst,
      gender: hg.size === 1 || ug.size === 1 ? gender : null,
      basis: viaPair ? 'pair' : 'name',
    });
    byUniversity.set(uRec.team, list);
  }

  const pathways = {};
  for (const univName of [...byUniversity.keys()].sort((a, b) => a.localeCompare(b, 'ja'))) {
    pathways[univName] = byUniversity
      .get(univName)
      .sort(
        (a, b) => b.universityFirstYear - a.universityFirstYear || a.highschool.localeCompare(b.highschool, 'ja') || a.player.localeCompare(b.player, 'ja'),
      );
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ maxYearGap: MAX_YEAR_GAP, pathways }, null, 2) + '\n', 'utf8');

  const records = Object.values(pathways).flat();
  const hsGroups = new Set(records.map((r) => `${r.highschool}\t${r.highschoolPrefecture}\t${r.gender}`));
  console.log('data/university/pathways.json を生成しました');
  console.log(`  高校・大学の両方に出る氏名: ${stat.considered}`);
  console.log(`  採用: ${stat.pair + stat.name}（ペア継続 ${stat.pair} / 氏名一致のみ ${stat.name}）`);
  console.log(
    `  不採用: 年差${MAX_YEAR_GAP}年超 ${stat.gap} / 同姓同名 ${stat.homonym}（検出 ${homonyms.size}件） / 性別不一致 ${stat.gender} / 大学名でない ${stat.notUniversity}`,
  );
  console.log(`  大学 ${Object.keys(pathways).length}校 / 高校×性別 ${hsGroups.size}グループ`);
}

main();
