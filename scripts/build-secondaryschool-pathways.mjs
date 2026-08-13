#!/usr/bin/env node
/**
 * 「中学 → 高校」の進路接続を生成する。出力: data/secondaryschool/pathways.json
 *
 * これは中学カテゴリの差別化の核。中学と高校の両方を名寄せ済みで持っているサイトにしか作れない。
 * 検討記録: docs/raw/2026-08-12-idea-juniorhigh-category-pages.md（候補1）
 *
 * 採用の条件（2026-08-12 に緩和。経緯と検証は docs/adr/ADR-014-pathway-name-match.md）:
 *   1. **中学の最終出場年 < 高校の初出場年 <= 中学の最終出場年 + 5**（`MAX_YEAR_GAP`）
 *      最長のケースは「中学1年で最後に出場 → 高校3年で初出場」で、
 *      中2・中3・高1・高2・高3 と数えて **5年**。これを超える一致は
 *      進学のタイミングとして成立しないので落とす。
 *      2026-08-12 時点の候補は最大4年なので**この条件で落ちるものは今は無い**。
 *      データが増えたとき（古い年度を遡及投入したとき）に効く
 *   2. **同姓同名の疑いがある氏名を除外する**（下記 `buildHomonymSet`）。
 *      緩和後はこれが唯一の安全弁なので、判定を「証拠ベース」に強化してある
 *
 * **県の一致もペアの継続も要求しない**。以前は「県一致 or ペア継続」を必須にしていたが、
 * 2026-08-12 に外した。理由:
 *   - ペア継続で同一人物が確定している96名に「氏名一致＋3年以内」を当てると **96/96 正解**
 *   - 同姓同名の証拠がある氏名は DB 全体で29件しかなく、候補244件のうち該当は1件だけ
 *   - 旧条件は越境進学を丸ごと落としていた（ペア継続で確定した96名のうち22.9%が県またぎ）
 *
 * ただし**この緩和は「氏名が実質的に一意」という前提に乗っている**。前提が崩れる兆候
 * （同姓同名の検出数が増える、誤りの報告が来る）が出たら条件を戻すこと。
 *
 * `basis` フィールドに採用根拠（pair / pref / name）を残すので、後から誤りを追える。
 * UIには出さない（2026-08-12 ユーザー判断）。
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

/**
 * 中学の最終出場年から高校の初出場年までに許す最大の年差。
 * 「中1で最後に出場 → 高3で初出場」が最長で 5年（中2・中3・高1・高2・高3）。
 */
const MAX_YEAR_GAP = 5;

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * 同姓同名の氏名を集める。**緩和後はこれが唯一の安全弁**なので、
 * 「疑い」ではなく**証拠**で判定する。
 *
 * 証拠 = 同一大会・同一年・同一種目ファイルの中に、同じ氏名が別チームで2人以上いること。
 * ドローの中で同時に存在しているので、別人であることが確定する。
 *
 * 収録全大会（中学・高校に限らない）を走査する。世代をまたいで同じ氏名が使われていれば、
 * それは進路の追跡でも誤マッチの原因になるため。
 *
 * 旧判定（中学側で同一年に3チーム以上へ出現）は 2026-08-12 の実測で 0件/2,956人 しか
 * 捕まえておらず、県一致ゲートを外した後の安全弁としては機能しなかった。
 * 本判定は同じデータで29件を検出する。
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

  // 同姓同名（証拠ベース）。緩和後の唯一の安全弁
  const homonyms = buildHomonymSet();

  // ペア継続: 中学で組んだペアが、より後の年に高校でも同じ2人で出ている。
  // 採用条件ではなくなったが、`basis` に確度を残すため引き続き計算する
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
  let acceptedName = 0;
  let rejectedGap = 0;
  let rejectedHomonym = 0;

  for (const [name, jList] of jhs.people) {
    const hList = hs.people.get(name);
    if (!hList) continue;
    considered += 1;
    if (homonyms.has(name)) {
      rejectedHomonym += 1;
      continue;
    }
    const jLast = Math.max(...jList.map((x) => x.year));
    const hFirst = Math.min(...hList.map((x) => x.year));
    if (!(hFirst > jLast)) continue;
    // 進学のタイミングとして成立しない年差を落とす（中1で最後の出場 → 高3で初出場が最長）
    if (hFirst - jLast > MAX_YEAR_GAP) {
      rejectedGap += 1;
      continue;
    }

    // 中学側は最終年の所属、高校側は初出年の所属を代表にする
    const jRec = jList.filter((x) => x.year === jLast).find((x) => x.team) ?? jList[jList.length - 1];
    const hRec = hList.filter((x) => x.year === hFirst).find((x) => x.team) ?? hList[0];
    if (!jRec?.team || !hRec?.team) continue;

    const prefMatch = Boolean(jRec.prefecture && hRec.prefecture && jRec.prefecture === hRec.prefecture);
    const viaPair = pairContinued.has(name);
    if (viaPair) acceptedPair += 1;
    else if (prefMatch) acceptedPref += 1;
    else acceptedName += 1;

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
      // 採用根拠。UIには出さないが、後から誤りを追えるように残す。
      // pair（ペア継続）> pref（県一致）> name（氏名一致のみ）の順に確度が高い
      basis: viaPair ? (prefMatch ? 'pair+pref' : 'pair') : prefMatch ? 'pref' : 'name',
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
  console.log(`  採用: ${acceptedPair + acceptedPref + acceptedName}`);
  console.log(`    ペア継続 ${acceptedPair} / 県一致 ${acceptedPref} / 氏名一致のみ ${acceptedName}`);
  console.log(`  不採用: 年差${MAX_YEAR_GAP}年超 ${rejectedGap} / 同姓同名 ${rejectedHomonym}（検出した同姓同名 ${homonyms.size}件）`);
  console.log(`  掲載チームに紐づいた進路: ${total}件 / ${Object.keys(pathways).length}チーム`);
}

main();
