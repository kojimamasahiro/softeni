#!/usr/bin/env node
/**
 * 「小学生クラブ → 中学」の進路接続を生成する。出力: data/primaryschool/pathways.json
 *
 * 中学カテゴリの `build-secondaryschool-pathways.mjs`（中学→高校）を1段下へ伸ばしたもの。
 * これが入ると **小 → 中 → 高の3段接続**が当サイトで初めて成立する。
 * 検討記録: docs/raw/2026-09-12-idea-primaryschool-category.md
 *
 * 採用の条件は [ADR-014](docs/adr/ADR-014-pathway-name-match.md) と同じ「氏名一致＋年差」:
 *   1. **小学の最終出場年 < 中学の初出場年 <= 小学の最終出場年 + 6**（`MAX_YEAR_GAP`）
 *      最長のケースは「小4で最後に出場 → 中3で初出場」で、
 *      小5・小6・中1・中2・中3 と数えて **6年**。中学→高校（5年）より1年長い
 *   2. **同姓同名の疑いがある氏名を除外する**（`buildHomonymSet`。中学版と同じ証拠ベースの判定）
 *
 * **県の一致もペアの継続も要求しない**（中学版と同じ）。小→中では中学→高校より条件が強く、
 * 2026-09-13 実測で採用1340件のうち**県一致が93%**（中学→高校は42%）。
 * 地元の中学へ進むのでそもそも県をまたがない。
 *
 * **掲載閾値によるフィルタはしない。** 中学版は「掲載閾値を満たす中学」に絞ってから出力するが、
 * ここでは絞らない。理由は2つ:
 *   - 小学生カテゴリのチームページ（Step 2）がまだ無く、絞る基準となる index が存在しない
 *   - 絞ると中学ページの「出身クラブ」節から**選手が消える**。閾値5で絞ると
 *     レコードの19%・節が付く中学チームの35枚（270→235）が落ちる（2026-09-13 実測）
 * 表示側（lib/secondaryschoolFeederClubs.ts）がリンクの有無だけを出し分ける。
 *
 * `basis` フィールドに採用根拠（pair / pref / name）を残すので、後から誤りを追える。
 * 中学版と同じくUIには出さない。
 *
 * 前提: 先に scripts/normalize-team-names.mjs --scope=all で名寄せを済ませること。
 * 使い方: npm run primaryschool:pathways
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DET = path.join(ROOT, 'data', 'tournaments', 'details');
const OUT = path.join(ROOT, 'data', 'primaryschool', 'pathways.json');

/** 小学生カテゴリの対象大会。全日本小学生選手権だけに絞っている（理由は raw ノート） */
const PRIMARY_TOURNAMENTS = ['zennihon-primaryschool'];

const BLOCK_IDS = ['hokkaido', 'tohoku', 'hokushinetsu', 'kanto', 'tokai', 'kinki', 'chugoku', 'shikoku', 'kyushu'].map((b) => `secondaryschool-${b}-block`);
/** 接続先。中学カテゴリ（build-secondaryschool-index.mjs）の対象大会と揃えること */
const SECONDARY_TOURNAMENTS = ['secondaryschool-championship', 'zennihon-secondaryschool-versus', 'zennihon-secondaryschool-club-pre', ...BLOCK_IDS];

/**
 * 小学の最終出場年から中学の初出場年までに許す最大の年差。
 * 「小4で最後に出場 → 中3で初出場」が最長で 6年（小5・小6・中1・中2・中3）。
 */
const MAX_YEAR_GAP = 6;

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * 同姓同名の氏名を集める。中学版 `build-secondaryschool-pathways.mjs` と同一の判定。
 *
 * 証拠 = 同一大会・同一年・同一種目ファイルの中に、同じ氏名が別チームで2人以上いること。
 * ドローの中で同時に存在しているので、別人であることが確定する。
 * 収録全大会を走査する（世代をまたいで同じ氏名が使われていれば追跡の誤りになるため）。
 *
 * **これは下限**である点に注意。同じ大会に居合わせなかった同姓同名は検出できない。
 */
function buildHomonymSet() {
  const homonyms = new Set();
  if (!fs.existsSync(DET)) return homonyms;
  for (const tid of fs.readdirSync(DET)) {
    const dir = path.join(DET, tid);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const year of fs.readdirSync(dir).filter((y) => /^\d{4}$/.test(y))) {
      for (const file of fs.readdirSync(path.join(dir, year)).filter((f) => f.endsWith('.json'))) {
        const data = readJson(path.join(dir, year, file), null);
        if (!data || !Array.isArray(data.participants)) continue;
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
    }
  }
  return homonyms;
}

/**
 * 大会群を走査し、選手の出場記録とダブルスのペアを集める。
 * 氏名は「姓+名」をキーにする（team 非依存。players/index.json と同じ規約）。
 *
 * 中学版と違い性別は持たない。表示先の中学チームページが男女を1枚にまとめているため
 * （高校の学校ページは男女別なので、中学版は `highschoolGender` を持っている）。
 */
function scan(tournamentIds) {
  /** name -> [{year, team, prefecture}] */
  const people = new Map();
  /** `nameA\tnameB`（ソート済み） -> [{year}] */
  const pairs = new Map();

  for (const tid of tournamentIds) {
    const dir = path.join(DET, tid);
    if (!fs.existsSync(dir)) continue;
    for (const year of fs.readdirSync(dir).filter((y) => /^\d{4}$/.test(y))) {
      for (const file of fs.readdirSync(path.join(dir, year)).filter((f) => f.endsWith('.json'))) {
        const data = readJson(path.join(dir, year, file), null);
        if (!data || !Array.isArray(data.participants)) continue;
        const y = Number(year);
        const byPid = new Map();
        for (const p of data.participants) {
          if (!p?.id || !p.lastName || !p.firstName) continue;
          const name = `${p.lastName}${p.firstName}`;
          const team = (p.team ?? '').trim() || null;
          byPid.set(p.id, { name });
          const list = people.get(name) ?? [];
          list.push({ year: y, team, prefecture: p.prefecture ?? null });
          people.set(name, list);
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
          list.push({ year: y });
          pairs.set(key, list);
        }
      }
    }
  }
  return { people, pairs };
}

function main() {
  const primary = scan(PRIMARY_TOURNAMENTS);
  const secondary = scan(SECONDARY_TOURNAMENTS);
  const homonyms = buildHomonymSet();

  // ペア継続: 小学で組んだペアが、より後の年に中学でも同じ2人で出ている。
  // 採用条件ではないが `basis` に確度を残すため計算する
  const pairContinued = new Set();
  for (const [key, pList] of primary.pairs) {
    const sList = secondary.pairs.get(key);
    if (!sList) continue;
    const pMin = Math.min(...pList.map((x) => x.year));
    if (sList.some((x) => x.year > pMin)) key.split('\t').forEach((n) => pairContinued.add(n));
  }

  /** `小学クラブ名\t県` -> 進路レコード[] */
  const byTeam = new Map();
  let considered = 0;
  let acceptedPair = 0;
  let acceptedPref = 0;
  let acceptedName = 0;
  let rejectedGap = 0;
  let rejectedHomonym = 0;

  for (const [name, pList] of primary.people) {
    const sList = secondary.people.get(name);
    if (!sList) continue;
    considered += 1;
    if (homonyms.has(name)) {
      rejectedHomonym += 1;
      continue;
    }
    const pLast = Math.max(...pList.map((x) => x.year));
    const sFirst = Math.min(...sList.map((x) => x.year));
    if (!(sFirst > pLast)) continue;
    if (sFirst - pLast > MAX_YEAR_GAP) {
      rejectedGap += 1;
      continue;
    }

    // 小学側は最終年の所属、中学側は初出年の所属を代表にする
    const pRec = pList.filter((x) => x.year === pLast).find((x) => x.team) ?? pList[pList.length - 1];
    const sRec = sList.filter((x) => x.year === sFirst).find((x) => x.team) ?? sList[0];
    if (!pRec?.team || !sRec?.team) continue;

    const prefMatch = Boolean(pRec.prefecture && sRec.prefecture && pRec.prefecture === sRec.prefecture);
    const viaPair = pairContinued.has(name);
    if (viaPair) acceptedPair += 1;
    else if (prefMatch) acceptedPref += 1;
    else acceptedName += 1;

    const key = `${pRec.team}\t${pRec.prefecture ?? ''}`;
    const list = byTeam.get(key) ?? [];
    list.push({
      player: name,
      primaryLastYear: pLast,
      secondaryschool: sRec.team,
      secondaryschoolPrefecture: sRec.prefecture,
      secondaryschoolFirstYear: sFirst,
      basis: viaPair ? (prefMatch ? 'pair+pref' : 'pair') : prefMatch ? 'pref' : 'name',
    });
    byTeam.set(key, list);
  }

  const pathways = {};
  for (const [key, list] of byTeam) {
    pathways[key] = list.sort((a, b) => b.secondaryschoolFirstYear - a.secondaryschoolFirstYear || a.player.localeCompare(b.player, 'ja'));
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ pathways }, null, 2) + '\n', 'utf8');

  const total = Object.values(pathways).reduce((n, l) => n + l.length, 0);
  const accepted = acceptedPair + acceptedPref + acceptedName;
  console.log('data/primaryschool/pathways.json を生成しました');
  console.log(`  小中の両方に出る氏名: ${considered}`);
  console.log(`  採用: ${accepted}`);
  console.log(
    `    ペア継続 ${acceptedPair} / 県一致 ${acceptedPref} / 氏名一致のみ ${acceptedName}（県一致は ${
      accepted ? Math.round((100 * (acceptedPair + acceptedPref)) / accepted) : 0
    }%）`,
  );
  console.log(`  不採用: 年差${MAX_YEAR_GAP}年超 ${rejectedGap} / 同姓同名 ${rejectedHomonym}（検出した同姓同名 ${homonyms.size}件）`);
  console.log(`  進路: ${total}件 / 小学生クラブ ${Object.keys(pathways).length}団体`);
}

main();
