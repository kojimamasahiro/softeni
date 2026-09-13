#!/usr/bin/env node
/**
 * 小学生カテゴリを中学型（都道府県ページ→チームページ）で作った場合の規模を実測する。
 *
 * 何を決めるための道具か:
 *   1. 対象大会を全日本小学生選手権だけに絞ってよいか（他の小学生大会を足す価値があるか）
 *   2. 掲載閾値をいくつにするか（薄いページを量産しない下限）
 *   3. 男女を1ページにまとめてよいか（両方に出る団体がどれだけあるか）
 *   4. 名寄せにどれだけ手がかかるか（表記ゆれの量）
 *   5. 進路（小学→中学）がどれだけ当たるか
 *
 * 前提: 先に scripts/normalize-team-names.mjs --scope=all で名寄せを済ませておくこと。
 *       名寄せ前に測ると表記ゆれのぶんだけ団体数が水増しされる。
 *
 * 検討記録: docs/raw/2026-09-12-idea-primaryschool-category.md
 * 使い方: npm run primaryschool:measure
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DET = path.join(ROOT, 'data', 'tournaments', 'details');

/** 採用スコープ。全日本小学生選手権だけを対象にする（理由は下の「B) 比較」を参照）。 */
const ADOPTED = ['zennihon-primaryschool'];
/** 比較用。採用しなかった小学生大会。 */
const OTHERS = ['primaryschool-championship', 'primaryschool-akita-indoor', 'primaryschool-miyagi-indoor'];
/** 進路の接続先（中学カテゴリの対象大会と揃える）。 */
const SECONDARY = [
  'secondaryschool-championship',
  'zennihon-secondaryschool-versus',
  'zennihon-secondaryschool-club-pre',
  ...['hokkaido', 'tohoku', 'hokushinetsu', 'kanto', 'tokai', 'kinki', 'chugoku', 'shikoku', 'kyushu'].map((b) => `secondaryschool-${b}-block`),
];

const THRESHOLDS = [1, 3, 5, 8, 10];
/** 進路の採用年差。小4で最後に出場→中3で初出場が最長で6年（ADR-014 の MAX_YEAR_GAP と同じ考え方）。 */
const MAX_YEAR_GAP = 6;

/** 大会ディレクトリを走査して (年, ファイル, データ) を返す。temp/ 以下は読まない。 */
function* eachFile(tournamentIds) {
  for (const tid of tournamentIds) {
    const dir = path.join(DET, tid);
    if (!fs.existsSync(dir)) continue;
    for (const year of fs
      .readdirSync(dir)
      .filter((y) => /^\d{4}$/.test(y))
      .sort()) {
      for (const file of fs.readdirSync(path.join(dir, year)).filter((f) => f.endsWith('.json'))) {
        let data;
        try {
          data = JSON.parse(fs.readFileSync(path.join(dir, year, file), 'utf8'));
        } catch {
          continue;
        }
        yield { tid, year: Number(year), file, data };
      }
    }
  }
}

/** (団体名, 都道府県) ごとに出場延べ・出場年・性別・選手を数える。 */
function collect(tournamentIds) {
  const teams = new Map();
  const editions = new Set();
  let participants = 0;
  let noPrefecture = 0;
  let pairSame = 0;
  let pairTotal = 0;

  for (const { tid, year, file, data } of eachFile(tournamentIds)) {
    editions.add(`${tid}:${year}`);
    // ファイル名 `category-age-gender.json` の最後のセグメントが性別
    const gender = file
      .replace(/\.json$/, '')
      .split('-')
      .pop();
    const list = data.participants ?? [];

    // ダブルスは participants が入場順（＝2人で1ペア）なので、隣り合う2人の所属一致を数える。
    // 「団体を主語にして書けるか」の判定材料。
    if (file.startsWith('doubles') && list.length % 2 === 0) {
      for (let i = 0; i < list.length; i += 2) {
        const a = list[i]?.team?.trim();
        const b = list[i + 1]?.team?.trim();
        if (!a || !b) continue;
        pairTotal += 1;
        if (a === b) pairSame += 1;
      }
    }

    for (const p of list) {
      const name = p?.team?.trim();
      if (!name) continue;
      participants += 1;
      if (!p.prefecture) noPrefecture += 1;
      const key = `${name}\t${p.prefecture ?? ''}`;
      const rec = teams.get(key) ?? {
        name,
        prefecture: p.prefecture ?? null,
        count: 0,
        years: new Set(),
        genders: new Set(),
        players: new Set(),
      };
      rec.count += 1;
      rec.years.add(year);
      if (gender === 'boys' || gender === 'girls') rec.genders.add(gender);
      rec.players.add(`${p.lastName ?? ''}${p.firstName ?? ''}`);
      teams.set(key, rec);
    }
  }

  return { teams: [...teams.values()], editions: [...editions].sort(), participants, noPrefecture, pairSame, pairTotal };
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function report(title, tournamentIds) {
  const { teams, editions, participants, noPrefecture, pairSame, pairTotal } = collect(tournamentIds);
  console.log(`\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}`);
  console.log(`大会×年: ${editions.length}（${editions.join(', ')}）`);
  console.log(`延べ出場: ${participants}  うち都道府県なし: ${noPrefecture}`);
  console.log(`ダブルスのペア所属一致率: ${pairTotal ? ((100 * pairSame) / pairTotal).toFixed(2) : '-'}%（${pairSame}/${pairTotal}）`);
  console.log(`収録団体（県別に区別）: ${teams.length}`);

  console.log('\n閾値  団体数  男女別にした場合  男女両方に出る  出場県数  県中央値  県最小  出場延べ中央値');
  for (const th of THRESHOLDS) {
    const kept = teams.filter((t) => t.count >= th);
    const genderPages = kept.reduce((n, t) => n + Math.max(t.genders.size, 1), 0);
    const both = kept.filter((t) => t.genders.size === 2).length;
    const byPref = new Map();
    for (const t of kept) if (t.prefecture) byPref.set(t.prefecture, (byPref.get(t.prefecture) ?? 0) + 1);
    const perPref = [...byPref.values()];
    console.log(
      [
        String(th).padStart(3),
        String(kept.length).padStart(7),
        String(genderPages).padStart(17),
        String(both).padStart(15),
        String(byPref.size).padStart(9),
        String(median(perPref)).padStart(9),
        String(perPref.length ? Math.min(...perPref) : 0).padStart(7),
        String(median(kept.map((t) => t.count))).padStart(15),
      ].join('  '),
    );
  }

  const kept5 = teams.filter((t) => t.count >= 5);
  console.log(`\n閾値5: 出場年数の中央値 ${median(kept5.map((t) => t.years.size))} / 掲載選手数の中央値 ${median(kept5.map((t) => t.players.size))}`);
  const byPref5 = new Map();
  for (const t of kept5) if (t.prefecture) byPref5.set(t.prefecture, (byPref5.get(t.prefecture) ?? 0) + 1);
  const sorted = [...byPref5.entries()].sort((a, b) => a[1] - b[1]);
  console.log(
    `閾値5・団体数が少ない県: ${sorted
      .slice(0, 8)
      .map(([p, n]) => `${p}${n}`)
      .join(' / ')}`,
  );
  console.log(
    `閾値5・団体数が多い県: ${sorted
      .slice(-5)
      .reverse()
      .map(([p, n]) => `${p}${n}`)
      .join(' / ')}`,
  );
  return teams;
}

/**
 * 県ごとの出場枠が揃っているかを見る。
 * 全日本小学生選手権は全県4ペア・開催県のみ8ペアという構造なので、
 * 「県を同じ土俵で比べられる」と書いてよいかがここで決まる。
 */
function reportQuota(tournamentIds) {
  console.log(`\n${'='.repeat(78)}\n県ごとの出場枠\n${'='.repeat(78)}`);
  for (const { tid, year, file, data } of eachFile(tournamentIds)) {
    const byPref = new Map();
    for (const p of data.participants ?? []) byPref.set(p.prefecture, (byPref.get(p.prefecture) ?? 0) + 1);
    const pairs = [...byPref.values()].map((v) => v / 2);
    const odd = [...byPref.entries()]
      .filter(([, v]) => v / 2 !== 4)
      .map(([k, v]) => `${k}:${v / 2}`)
      .join(' ');
    console.log(
      `${tid} ${year} ${file.replace(/\.json$/, '').padEnd(20)} 県数${String(byPref.size).padStart(3)}  ペア/県 中央値${median(
        pairs,
      )}  4ペアでない県: ${odd || 'なし'}`,
    );
  }
}

/**
 * 同一県内で、正規化すると重なる団体名を探す（＝名寄せで潰すべき表記ゆれの量）。
 * 判定を緩めに取っているので、出た件数は「手で見る候補の上限」として読むこと。
 */
function reportNameVariance(teams) {
  const normalize = (s) =>
    s
      .normalize('NFKC')
      .replace(/[\s・.'’\-_]/g, '')
      .replace(/ソフトテニス/g, '')
      .replace(/スポーツ少年団|スポ少/g, 'SS')
      .replace(/クラブ|CLUB/gi, 'C')
      .replace(/ジュニア|Jr/gi, 'J')
      .toUpperCase();

  const groups = new Map();
  for (const t of teams) {
    const key = `${t.prefecture ?? ''}|${normalize(t.name)}`;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  const dups = [...groups.values()].filter((a) => a.length > 1);
  const extra = dups.reduce((n, a) => n + a.length - 1, 0);
  console.log(`\n${'='.repeat(78)}\n表記ゆれ（同一県内・正規化すると重なる）\n${'='.repeat(78)}`);
  console.log(`余剰: ${extra} / ${teams.length} = ${((100 * extra) / teams.length).toFixed(1)}%`);
  for (const a of dups) {
    console.log(`  ${a[0].prefecture ?? '（県なし）'} ${a.map((t) => `${t.name}(${t.count})`).join(' ≒ ')}`);
  }
  const paren = teams.filter((t) => /[（(]/.test(t.name));
  console.log(`括弧書きを含む団体名: ${paren.length}${paren.length ? ` （${paren.map((t) => t.name).join(' / ')}）` : ''}`);
}

/** 氏名ごとに (出場年, 団体, 県) を集める。進路の突き合わせ用。 */
function collectPlayers(tournamentIds) {
  const players = new Map();
  for (const { year, data } of eachFile(tournamentIds)) {
    for (const p of data.participants ?? []) {
      const name = `${(p.lastName ?? '').trim()}${(p.firstName ?? '').trim()}`;
      if (!name) continue;
      const rec = players.get(name) ?? { years: new Set(), teams: new Set(), prefectures: new Set() };
      rec.years.add(year);
      if (p.team) rec.teams.add(p.team.trim());
      if (p.prefecture) rec.prefectures.add(p.prefecture);
      players.set(name, rec);
    }
  }
  return players;
}

/**
 * 進路（小学→中学）。採用条件は ADR-014 と同じ「氏名一致＋年差」で、県の一致は要求しない。
 * 県一致率は精度の傍証として出すだけ。
 */
function reportPathways(primaryIds) {
  const primary = collectPlayers(primaryIds);
  const secondary = collectPlayers(SECONDARY);

  const indexPath = path.join(ROOT, 'data', 'secondaryschool', 'index.json');
  const published = fs.existsSync(indexPath) ? new Set(JSON.parse(fs.readFileSync(indexPath, 'utf8')).teams.map((t) => t.name)) : new Set();

  let nameHit = 0;
  let adopted = 0;
  let samePrefecture = 0;
  const byPrimaryTeam = new Map();
  const bySecondaryTeam = new Map();

  for (const [name, pri] of primary) {
    const sec = secondary.get(name);
    if (!sec) continue;
    nameHit += 1;
    const gap = Math.min(...sec.years) - Math.max(...pri.years);
    if (gap < 1 || gap > MAX_YEAR_GAP) continue;
    adopted += 1;
    if ([...pri.prefectures].some((p) => sec.prefectures.has(p))) samePrefecture += 1;
    for (const t of pri.teams) byPrimaryTeam.set(t, (byPrimaryTeam.get(t) ?? 0) + 1);
    for (const t of sec.teams) if (published.has(t)) bySecondaryTeam.set(t, (bySecondaryTeam.get(t) ?? 0) + 1);
  }

  console.log(`\n${'='.repeat(78)}\n進路（小学→中学）\n${'='.repeat(78)}`);
  console.log(`氏名ユニーク: 小学 ${primary.size} / 中学 ${secondary.size}`);
  console.log(
    `氏名一致 ${nameHit} → 年差1〜${MAX_YEAR_GAP}年で採用 ${adopted}（県一致 ${samePrefecture} = ${
      adopted ? ((100 * samePrefecture) / adopted).toFixed(0) : '-'
    }%）`,
  );
  console.log(`進路が付く小学団体: ${byPrimaryTeam.size}`);
  if (published.size) {
    console.log(
      `「出身クラブ」節が付く掲載中学チーム: ${bySecondaryTeam.size} / ${published.size}（レコード計 ${[...bySecondaryTeam.values()].reduce(
        (a, b) => a + b,
        0,
      )}）`,
    );
    console.log(
      `  上位: ${[...bySecondaryTeam.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([t, n]) => `${t}${n}`)
        .join(' / ')}`,
    );
  } else {
    console.log('（data/secondaryschool/index.json が無いので掲載中学チームへの当たり方は未測定）');
  }
}

const adoptedTeams = report('A) 採用スコープ: 全日本小学生選手権のみ', ADOPTED);
report('B) 比較（不採用）: A ＋ 全国小学生大会 ＋ 県大会', [...ADOPTED, ...OTHERS]);
reportQuota(ADOPTED);
reportNameVariance(adoptedTeams);
reportPathways(ADOPTED);
