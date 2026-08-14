#!/usr/bin/env node
/**
 * 中学カテゴリ（/secondaryschool）の公開ページが読む索引を生成する。
 *
 * 出力: data/secondaryschool/index.json
 *   { generatedFrom, threshold, prefectures: [...], teams: [...] }
 *
 * 設計判断は docs/raw/2026-08-12-idea-juniorhigh-category-pages.md、
 * 仕様は docs/wiki/secondaryschool.md。要点だけ再掲する:
 *
 *   - 対象大会は全中・都道府県対抗・クラブ選手権プレ・9ブロック大会（TOURNAMENTS）。
 *     すべて掲載判定（出場延べのカウント）に使う。
 *   - **県別のポイント・順位は持たない**（2026-08-12 廃止）。大会ごとに県の出場枠が違い
 *     （全中は県により20倍差、ブロック大会は北海道65対福岡4）、順位づけが成立しないため。
 *     このカテゴリは「収録チームの名鑑＋進路」に絞り、順位づけをしない。
 *   - 掲載閾値は出場延べ5件（THRESHOLD）。`/teams/[teamId]` の noindex 閾値と揃えてある。
 *     閾値なしだと990団体の7割が薄いページになる。
 *   - **性別をURLに入れない**。男女別ページにすると32%が5件未満になるが、
 *     1ページにまとめると0%（2026-08-12 実測）。中学は1団体あたり中央値8件しかない。
 *   - 「学校」ではなくチームとして扱う。閾値5の280チーム中クラブが114（41%）ある。
 *
 * 前提: 先に scripts/normalize-team-names.mjs --scope=all で名寄せを済ませること。
 *       名寄せ前に流すと表記ゆれのぶんチームが分裂する。
 *
 * 使い方: node scripts/build-secondaryschool-index.mjs
 *   romaji ID の生成には pykakasi（Python）を使うが、変換結果は
 *   data/secondaryschool/team-name-romaji-cache.json に永続キャッシュしてある。
 *   通常のビルド（Cloudflare Pages / Vercel など Python が無い/pykakasiが入らない環境）は
 *   このキャッシュだけを読み、python3 を呼ばない。新しいチーム名が増えてキャッシュに
 *   無いときだけ python3 を呼ぶので、その場合は `.venv` に pykakasi を入れたローカル環境で
 *   一度実行してキャッシュを更新し、コミットすること。
 *   読みが誤るものは data/secondaryschool/team-id-overrides.json に手で書けば優先される。
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DET = path.join(ROOT, 'data', 'tournaments', 'details');
const OUT_DIR = path.join(ROOT, 'data', 'secondaryschool');
const OVERRIDE_FILE = path.join(OUT_DIR, 'team-id-overrides.json');
const ROMAJI_CACHE_FILE = path.join(OUT_DIR, 'team-name-romaji-cache.json');

/** 掲載閾値（出場延べ）。これ未満のチームは個別ページを作らない。 */
export const THRESHOLD = 5;

const BLOCK_IDS = ['hokkaido', 'tohoku', 'hokushinetsu', 'kanto', 'tokai', 'kinki', 'chugoku', 'shikoku', 'kyushu'].map((b) => `secondaryschool-${b}-block`);

/** 対象大会。すべて掲載判定（出場延べのカウント）に使う。 */
const TOURNAMENTS = [
  { id: 'secondaryschool-championship', label: '全国中学校体育大会', short: '全中' },
  { id: 'zennihon-secondaryschool-versus', label: '都道府県対抗全日本中学生大会', short: '県対抗' },
  { id: 'zennihon-secondaryschool-club-pre', label: '全日本中学生クラブ選手権プレ大会', short: 'クラブ選手権プレ' },
  ...BLOCK_IDS.map((id) => ({ id, label: null, short: 'ブロック' })),
];

// ---- チーム種別の判定（lib/clubTransition.ts と同じ下限カウント規約）----
const SCHOOL_MARKER = /(中学校|中等教育学校|義務教育学校|学園|学院|義塾|附属|付属|高等学校|高校|中$)/;
const CLUB_MARKER =
  /クラブ|ｸﾗﾌﾞ|CLUB|ＣＬＵＢ|スポ少|スポーツ少年団|少年団|ジュニア|ユース|協会|S[.・]?T[.・]?C|Ｓ[.・]?Ｔ[.・]?Ｃ|J[.・]?S[.・]?T?[.・]?C|S[.・]?O[.・]?C|Jr/i;
const LATIN_SEPARATORS = /[.・\-＿_'’`~×＊*\s（）()]/g;
const LATIN_RUN = /[A-Za-zＡ-Ｚａ-ｚ]{2,}/;
const KATAKANA_RUN = /[ァ-ヶー]{3,}/;

function classifyKind(name) {
  if (SCHOOL_MARKER.test(name)) return 'school';
  if (CLUB_MARKER.test(name)) return 'club';
  if (LATIN_RUN.test(name.replace(LATIN_SEPARATORS, ''))) return 'club';
  if (KATAKANA_RUN.test(name)) return 'club';
  return 'unknown';
}

// ---- 成績の序列（表示順と代表成績の決定に使う）----
const RANK_ORDER = { winner: 6, runnerup: 5, best: 4, round: 1, ongoing: 0 };
function rankScore(rank) {
  if (!rank) return 0;
  const base = RANK_ORDER[rank.kind] ?? 0;
  if (rank.kind === 'best') return base + (rank.bestLevel === 4 ? 0.5 : 0);
  if (rank.kind === 'round') return base + Math.min(rank.round ?? 0, 9) * 0.05;
  return base;
}

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * pykakasi でローマ字読みをまとめて引く（1プロセスで全件）。
 *
 * 結果は team-name-romaji-cache.json に永続キャッシュする。ビルド環境
 * （Cloudflare Pages / Vercel など）には Python が無いか、あっても pykakasi は
 * 入っていないため、python3 はキャッシュに無い名前があるときだけ呼ぶ。
 * その python3 呼び出し自体に失敗したら、キャッシュ更新をローカルで行うよう促す
 * エラーにして落とす（ビルドがサイレントに壊れたIDを吐かないようにするため）。
 */
function toRomajiBulk(names) {
  const cache = readJson(ROMAJI_CACHE_FILE, {});
  const missing = names.filter((n) => !(n in cache));
  if (missing.length) {
    const script = `
import sys, json
import pykakasi
k = pykakasi.kakasi()
names = json.load(sys.stdin)
out = {}
for n in names:
    out[n] = ''.join(x['hepburn'] for x in k.convert(n))
json.dump(out, sys.stdout, ensure_ascii=False)
`;
    let fresh;
    try {
      const raw = execFileSync('python3', ['-c', script], { input: JSON.stringify(missing), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      fresh = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `${path.relative(ROOT, ROMAJI_CACHE_FILE)} に無いチーム名が ${missing.length} 件あり、pykakasi（Python）でも変換できませんでした。\n` +
          `.venv を有効化した（pykakasi をインストール済みの）ローカル環境で一度\n` +
          `  node scripts/build-secondaryschool-index.mjs\n` +
          `を実行してキャッシュを更新し、コミットしてください。\n` +
          `未キャッシュ（先頭10件）: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` 他${missing.length - 10}件` : ''}\n` +
          `元エラー: ${err.message}`,
      );
    }
    Object.assign(cache, fresh);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const sortedKeys = Object.keys(cache).sort();
    fs.writeFileSync(ROMAJI_CACHE_FILE, JSON.stringify(cache, sortedKeys, 2) + '\n', 'utf8');
  }
  return Object.fromEntries(names.map((n) => [n, cache[n]]));
}

/**
 * ローマ字化する前にチーム名から URL に不要な部分を落とす。
 *
 * 高校側（scripts/highschool/01team/entries-to-teams.py の `to_romaji`）が
 * 「高等学校」「高校」を落としてから変換しているのと同じ規約。
 * 中学は加えて**設置者の接頭辞**（`江別市立…`）も落とす。これが無いと
 * `江別市立江別第一中学校` が `ebetsushiritsuebetsudaiichichuugakkou` という
 * 37文字のスラッグになり、地名が2回出て読めない。
 *
 * 落としすぎて2文字未満になる場合は落とさない（`南中学校` → `南` を潰さない）。
 */
function stripForSlug(name) {
  let s = name.replace(/（.*?）|\(.*?\)/g, '').trim();
  // 設置者接頭辞: 「◯◯市立」「◯◯町立」「◯◯村立」「◯◯区立」「◯◯県立」など
  const withoutFounder = s.replace(/^.{1,6}?[都道府県市区町村]立/, '');
  if (withoutFounder.length >= 2) s = withoutFounder;
  // 競技名は当サイトでは自明なので落とす（`浜頓別ソフトテニス少年団` の「ソフトテニス」）
  const withoutSport = s.replace(/ソフトテニス/g, '');
  if (withoutSport.length >= 2) s = withoutSport;
  // 学校種別の接尾辞
  const withoutSuffix = s.replace(/(中等教育学校|中学校|中学|中)$/, '');
  if (withoutSuffix.length >= 2) s = withoutSuffix;
  return s;
}

/**
 * カタカナ外来語は英語綴りへ寄せる。
 *
 * pykakasi は `クラブ` を `kurabu` と読むが、チーム名には `MKクラブ` `奈良LEGENDS` のように
 * 英字が混ざるものが多く、`mkkurabu` は英字部分と読みが混在して落ち着かない。
 * URLとしても `shuunanclub` のほうが読める。
 *
 * 対象は**英語の原語が明らかなカタカナ語だけ**に限る。`少年団`(shounendan) `協会`(kyoukai) は
 * 日本語なのでローマ字のままにする（無理に英訳すると団体名から離れる）。
 * クラブ名そのものは落とさない。`野木`（中学校）と `野木クラブ`（地域クラブ）は別団体で、
 * 落とすと衝突するため（docs/wiki/secondaryschool.md「学校と同地名クラブ」）。
 */
const LOANWORDS = [
  [/クラブ/g, 'club'],
  [/ジュニア/g, 'junior'],
  [/ユース/g, 'youth'],
  [/スポーツ/g, 'sports'],
  [/センター/g, 'center'],
  [/チーム/g, 'team'],
];
function applyLoanwords(name) {
  let s = name;
  for (const [re, en] of LOANWORDS) s = s.replace(re, ` ${en} `);
  return s;
}

/** ローマ字文字列をURLスラッグへ。英数以外を落とす。 */
function slugify(romaji) {
  return romaji
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
}

function main() {
  const prefectures = readJson(path.join(ROOT, 'data', 'prefectures.json'), []);
  const prefIdByName = new Map(prefectures.map((p) => [p.name, p.id]));
  // 大会ラベル（information / local_index から補う。ブロック大会は local_index 側にある）
  const labelById = new Map();
  for (const f of ['index.json', 'local_index.json']) {
    for (const t of readJson(path.join(ROOT, 'data', 'tournaments', f), [])) {
      if (t?.tournamentId) labelById.set(t.tournamentId, t.label ?? t.tournamentId);
    }
  }

  /** key `name\tprefName` -> チーム集計 */
  const teams = new Map();
  for (const tour of TOURNAMENTS) {
    const dir = path.join(DET, tour.id);
    if (!fs.existsSync(dir)) continue;
    for (const year of fs.readdirSync(dir).filter((y) => /^\d{4}$/.test(y))) {
      for (const file of fs.readdirSync(path.join(dir, year)).filter((f) => f.endsWith('.json'))) {
        const data = readJson(path.join(dir, year, file), null);
        if (!data || !Array.isArray(data.participants)) continue;

        const categoryId = file.replace(/\.json$/, '');
        const [category, , gender] = categoryId.split('-');
        const teamByPid = new Map();
        const prefByPid = new Map();
        const nameByPid = new Map();
        for (const p of data.participants) {
          if (!p?.id) continue;
          teamByPid.set(p.id, (p.team ?? '').trim());
          prefByPid.set(p.id, p.prefecture ?? null);
          const full = [p.lastName, p.firstName].filter(Boolean).join(' ');
          if (full) nameByPid.set(p.id, full);
        }
        const entryById = new Map((data.entries ?? []).map((e) => [e.entryNo, e]));

        // 出場延べのカウント（participants 単位。同一団体が個人戦・団体戦に出れば両方数える）
        for (const p of data.participants) {
          const name = (p?.team ?? '').trim();
          if (!name) continue;
          const prefName = p.prefecture ?? null;
          const key = `${name}\t${prefName ?? ''}`;
          const rec = teams.get(key) ?? {
            name,
            prefName,
            count: 0,
            years: new Set(),
            genders: new Set(),
            tournaments: new Set(),
            results: [],
            members: new Map(),
          };
          rec.count += 1;
          rec.years.add(Number(year));
          if (gender === 'boys' || gender === 'girls') rec.genders.add(gender);
          rec.tournaments.add(tour.id);
          if (nameByPid.has(p.id)) {
            const m = rec.members.get(nameByPid.get(p.id)) ?? { name: nameByPid.get(p.id), years: new Set() };
            m.years.add(Number(year));
            rec.members.set(nameByPid.get(p.id), m);
          }
          teams.set(key, rec);
        }

        // 成績（results）をチームと都道府県へ配る
        for (const r of data.results ?? []) {
          const entry = entryById.get(r.entryNo);
          if (!entry) continue;
          const pids = entry.playerIds ?? [];
          const teamNames = [...new Set(pids.map((i) => teamByPid.get(i)).filter(Boolean))];
          const prefNames = [...new Set(pids.map((i) => prefByPid.get(i)).filter(Boolean))];
          const label = r.tournament?.label ?? null;
          const score = rankScore(r.tournament?.rank);
          const playerNames = pids.map((i) => nameByPid.get(i)).filter(Boolean);

          // チーム成績: 所属が1つに定まるときだけ（混成ペアは団体の成績にしない）
          if (teamNames.length === 1) {
            const key = `${teamNames[0]}\t${prefNames[0] ?? ''}`;
            const rec = teams.get(key);
            if (rec) {
              rec.results.push({
                tournamentId: tour.id,
                tournamentLabel: labelById.get(tour.id) ?? tour.label ?? tour.id,
                short: tour.short,
                year: Number(year),
                categoryId,
                category,
                gender,
                label,
                score,
                players: playerNames,
              });
            }
          }
        }
      }
    }
  }

  // ---- 閾値で絞り、ID を採番 ----
  const kept = [...teams.values()].filter((t) => t.count >= THRESHOLD && t.prefName && prefIdByName.has(t.prefName));
  const overrides = readJson(OVERRIDE_FILE, {});
  // 短縮形（既定）と、衝突したときのフォールバック用に元の名前も引いておく
  const needRomaji = new Set();
  for (const t of kept) {
    if (overrides[t.name]) continue;
    needRomaji.add(applyLoanwords(stripForSlug(t.name)));
    needRomaji.add(applyLoanwords(t.name));
  }
  const romaji = needRomaji.size ? toRomajiBulk([...needRomaji]) : {};

  // 県ごとにスラッグの衝突を解消する（teamId は県内で一意ならよい）
  const usedByPref = new Map();
  const collisions = [];
  const out = [];
  for (const t of kept.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))) {
    const prefectureId = prefIdByName.get(t.prefName);
    const used = usedByPref.get(prefectureId) ?? new Set();
    let id = overrides[t.name] ?? slugify(romaji[applyLoanwords(stripForSlug(t.name))] ?? '');
    if (!id) id = slugify(romaji[applyLoanwords(t.name)] ?? '');
    // 衝突したら短縮前の名前で作り直す（`-2` を付けるより読める URL になる）
    if (used.has(id)) {
      const full = slugify(romaji[applyLoanwords(t.name)] ?? '');
      collisions.push(`${t.prefName} ${t.name}: ${id} → ${full || `${id}-2`}`);
      if (full && !used.has(full)) id = full;
      else {
        let n = 2;
        while (used.has(`${id}-${n}`)) n += 1;
        id = `${id}-${n}`;
      }
    }
    if (!id) id = `team${out.length + 1}`;
    used.add(id);
    usedByPref.set(prefectureId, used);

    const results = t.results.sort((a, b) => b.year - a.year || b.score - a.score);
    out.push({
      id,
      name: t.name,
      kind: classifyKind(t.name),
      prefecture: t.prefName,
      prefectureId,
      count: t.count,
      years: [...t.years].sort((a, b) => a - b),
      genders: [...t.genders].sort(),
      tournamentIds: [...t.tournaments].sort(),
      best: results.length ? results.reduce((a, b) => (b.score > a.score ? b : a)) : null,
      results,
      members: [...t.members.values()]
        .map((m) => ({ name: m.name, years: [...m.years].sort((a, b) => a - b) }))
        .sort((a, b) => b.years[b.years.length - 1] - a.years[a.years.length - 1] || a.name.localeCompare(b.name, 'ja')),
    });
  }

  // 都道府県は「県内にどのチームがあるか」の集計だけ持つ。
  // **県別のポイント・順位は持たない**（2026-08-12 廃止）。理由は
  // docs/wiki/secondaryschool.md「都道府県ページ」。配点が Assumption だったうえ、
  // 大会ごとに県の出場枠が違う（全中は県により20倍差）ため順位づけが成立しなかった。
  const prefOut = prefectures.map((p) => {
    const teamsOfPref = out.filter((t) => t.prefectureId === p.id);
    return {
      id: p.id,
      name: p.name,
      region: p.region,
      teamCount: teamsOfPref.length,
      schoolCount: teamsOfPref.filter((t) => t.kind === 'school').length,
      clubCount: teamsOfPref.filter((t) => t.kind === 'club').length,
    };
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const payload = {
    threshold: THRESHOLD,
    tournamentIds: TOURNAMENTS.map((t) => t.id),
    prefectures: prefOut,
    teams: out,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  if (!fs.existsSync(OVERRIDE_FILE)) fs.writeFileSync(OVERRIDE_FILE, '{}\n', 'utf8');

  const pages = out.length;
  console.log(`data/secondaryschool/index.json を生成しました`);
  console.log(
    `  チーム ${pages} 件（閾値 ${THRESHOLD}）: 学校 ${out.filter((t) => t.kind === 'school').length} / クラブ ${out.filter((t) => t.kind === 'club').length} / 判定不能 ${out.filter((t) => t.kind === 'unknown').length}`,
  );
  console.log(
    `  都道府県 ${prefOut.filter((p) => p.teamCount > 0).length}/47 に掲載チームあり（0件: ${
      prefOut
        .filter((p) => p.teamCount === 0)
        .map((p) => p.name)
        .join('・') || 'なし'
    }）`,
  );
  console.log(`  総ページ数の見込み: ${1 + prefOut.length + pages}`);
  console.log(
    `  teamId の最長: ${Math.max(...out.map((t) => t.id.length))}文字 / 平均 ${Math.round(out.reduce((n, t) => n + t.id.length, 0) / out.length)}文字`,
  );
  if (collisions.length) console.log(`  短縮形が県内で衝突したため作り直したもの（${collisions.length}件）:\n    ${collisions.join('\n    ')}`);
  const dupes = out.filter((t, i) => out.findIndex((x) => x.prefectureId === t.prefectureId && x.id === t.id) !== i);
  if (dupes.length) console.warn(`  警告: 県内でIDが重複: ${dupes.map((d) => `${d.prefecture}/${d.id}`).join(', ')}`);
}

main();
