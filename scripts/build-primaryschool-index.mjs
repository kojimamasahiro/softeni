#!/usr/bin/env node
/**
 * 小学生カテゴリ（/primaryschool）の公開ページが読む索引を生成する。
 *
 * 出力: data/primaryschool/index.json
 *   { threshold, tournamentIds, prefectures: [...], teams: [...] }
 *
 * 設計判断は docs/raw/2026-09-12-idea-primaryschool-category.md、
 * 仕様は docs/wiki/primaryschool.md。要点だけ再掲する:
 *
 *   - **対象大会は全日本小学生選手権だけ**（TOURNAMENTS）。他の小学生大会を足しても
 *     進路は2%しか増えないのに、県欠落1121件・表記ゆれ9.0%・部分取り込みが付いてくる。
 *     1大会だけで閾値5が298団体・47県非空になるので、中学が必要とした
 *     「ブロック大会は掲載判定にだけ使う」例外も要らない。
 *   - 掲載閾値は出場延べ5件（THRESHOLD）。中学・`/teams/[teamId]` と揃えてある。
 *   - **性別をURLに入れない**。閾値5の298団体のうち263（88%）が男女両方に出ており、
 *     分けると中身が半分ずつに割れる（中学より強い理由がある）。
 *   - **順位づけをしない**。県ページも「県内にどの団体が収録されているか」の一覧だけ。
 *     中学が県別ポイントを廃止したのと同じ理由（配点が Assumption になる）。
 *   - 「小学校」と呼ばない。閾値5の298団体はほぼ全部クラブ・少年団で、
 *     `小学校` / `小` で終わる団体は0件だった。
 *
 * 前提: 先に scripts/normalize-team-names.mjs --scope=all で名寄せを済ませること。
 *
 * 使い方: npm run primaryschool:build
 *   ローマ字読みには pykakasi（Python）を使うが、変換結果は
 *   data/primaryschool/team-name-romaji-cache.json に永続キャッシュする。
 *   Python の無いビルド環境はキャッシュだけを読む（中学版と同じ規約）。
 *
 * **読みの上書きは「地名部分の読み」であって teamId 全体ではない**（中学版との違い）。
 * data/primaryschool/team-reading-overrides.json に
 *   "大用ジュニアクラブ": "ooyuu"
 * と書くと、地名 `大用` の読みだけが差し替わり、残り（`ジュニアクラブ`）は
 * 通常どおり英語綴りへ寄せて連結される → `ooyuujuniorclub`。
 * 確認用リストは npm run primaryschool:teamid-todo。
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DET = path.join(ROOT, 'data', 'tournaments', 'details');
const OUT_DIR = path.join(ROOT, 'data', 'primaryschool');
const OVERRIDE_FILE = path.join(OUT_DIR, 'team-reading-overrides.json');
const ROMAJI_CACHE_FILE = path.join(OUT_DIR, 'team-name-romaji-cache.json');

/** 掲載閾値（出場延べ）。これ未満の団体は個別ページを作らない。 */
export const THRESHOLD = 5;

/** 対象大会。全日本小学生選手権のみ。 */
const TOURNAMENTS = [{ id: 'zennihon-primaryschool', short: '全日本小学生', label: '全日本小学生選手権大会' }];

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * 成績の序列（大きいほど上位）。
 *
 * **優勝・準優勝は `kind: 'winner' / 'runnerup'` で入っている**（`place` ではない）。
 * 当初はこの2つを拾っておらず0点になり、優勝した団体の代表成績が
 * 「3回戦敗退」になっていた（298団体中8件。2026-09-13 修正）。
 * 中学版 `RANK_ORDER` は最初から winner/runnerup を持っていたので影響なし。
 */
function rankScore(rank) {
  if (!rank) return 0;
  if (rank.kind === 'winner') return 1000;
  if (rank.kind === 'runnerup') return 999;
  if (rank.kind === 'place') return 1000 - (rank.place ?? 99);
  if (rank.kind === 'best') return 900 - (rank.bestLevel ?? 99);
  if (rank.kind === 'round') return 100 + (rank.round ?? 0);
  return 0;
}

/** pykakasi でローマ字読みをまとめて引く。結果は永続キャッシュする（中学版と同じ）。 */
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
        `${path.relative(ROOT, ROMAJI_CACHE_FILE)} に無い名前が ${missing.length} 件あり、pykakasi（Python）でも変換できませんでした。\n` +
          `.venv を有効化したローカル環境で一度 npm run primaryschool:build を実行してキャッシュを更新し、コミットしてください。\n` +
          `未キャッシュ（先頭10件）: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` 他${missing.length - 10}件` : ''}\n` +
          `元エラー: ${err.message}`,
      );
    }
    Object.assign(cache, fresh);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(ROMAJI_CACHE_FILE, JSON.stringify(cache, Object.keys(cache).sort(), 2) + '\n', 'utf8');
  }
  return Object.fromEntries(names.map((n) => [n, cache[n]]));
}

/**
 * ローマ字化の前に URL に不要な部分を落とす。中学版 `stripForSlug` と同じ規約だが、
 * 学校種別の接尾辞は落とさない（`小学校` / `小` で終わる団体が0件のため不要）。
 *
 * 競技名には `軟庭`（＝軟式庭球）も含める。`登別子ども軟庭倶楽部` の1件だけだが、
 * `ソフトテニス` `テニス` と同じく当サイトでは自明なため。
 */
function stripForSlug(name) {
  let s = name.replace(/（.*?）|\(.*?\)/g, '').trim();
  const withoutFounder = s.replace(/^.{1,6}?[都道府県市区町村]立/, '');
  if (withoutFounder.length >= 2) s = withoutFounder;
  const withoutSport = s.replace(/(ソフトテニス|テニス|軟庭)/g, '');
  if (withoutSport.length >= 2) s = withoutSport;
  return s;
}

/**
 * カタカナ外来語は英語綴りへ寄せる。中学版の対象に `倶楽部` を足してある
 * （`クラブ` の当て字。`登別子ども軟庭倶楽部` の1件）。
 * 固有名詞は英訳しない（`日野フレンズ` は `hinofurenzu` のまま）。
 */
const LOANWORDS = [
  [/クラブ|倶楽部/g, 'club'],
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

/**
 * 団体名から「地名らしい先頭部分」を取り出す。読みの上書きが効く範囲を決める。
 * scripts/build-primaryschool-teamid-todo.mjs の `placeCore` と同じ規約
 * （目視リストの「地名」列と、上書きのキーが一致している必要がある）。
 */
const TAIL =
  /(ソフトテニス|テニス|ジュニアクラブ|ジュニア|クラブ|スポーツ少年団|スポ少|少年団|スクール|チーム|ユース|協会|倶楽部|Jr\.?|Ｊｒ\.?|ＳＴＣ|STC|ＪＳＣ|JSC|ＪＳＴＣ|JSTC|ＪＳＴ|JST|ＳＣ|SC)$/;
function placeCore(name) {
  let s = name;
  let prev;
  do {
    prev = s;
    s = s.replace(TAIL, '').trim();
  } while (s !== prev && s.length > 1);
  return s;
}

/** ローマ字文字列をURLスラッグへ。英数以外を落とす。 */
function slugify(romaji) {
  return (romaji ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
}

function main() {
  const prefectures = readJson(path.join(ROOT, 'data', 'prefectures.json'), []);
  const prefIdByName = new Map(prefectures.map((p) => [p.name, p.id]));
  const labelById = new Map();
  for (const f of ['index.json', 'local_index.json']) {
    for (const t of readJson(path.join(ROOT, 'data', 'tournaments', f), [])) {
      if (t?.tournamentId) labelById.set(t.tournamentId, t.label ?? t.tournamentId);
    }
  }

  /** key `name\tprefName` -> 団体集計 */
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

        for (const r of data.results ?? []) {
          const entry = entryById.get(r.entryNo);
          if (!entry) continue;
          const pids = entry.playerIds ?? [];
          const teamNames = [...new Set(pids.map((i) => teamByPid.get(i)).filter(Boolean))];
          const prefNames = [...new Set(pids.map((i) => prefByPid.get(i)).filter(Boolean))];
          // 所属が1つに定まるときだけ団体の成績にする。
          // 全日本小学生はペアの所属一致が71%で、残り29%の混成ペアは団体の成績にしない
          if (teamNames.length !== 1) continue;
          const rec = teams.get(`${teamNames[0]}\t${prefNames[0] ?? ''}`);
          if (!rec) continue;
          rec.results.push({
            tournamentId: tour.id,
            tournamentLabel: labelById.get(tour.id) ?? tour.label,
            short: tour.short,
            year: Number(year),
            categoryId,
            category,
            gender,
            label: r.tournament?.label ?? null,
            score: rankScore(r.tournament?.rank),
            players: pids.map((i) => nameByPid.get(i)).filter(Boolean),
          });
        }
      }
    }
  }

  // 県名がそのまま団体名になっているものは落とす（中学の関東ブロックで実際にあった事故への保険）
  const prefShortNames = new Set(prefectures.map((p) => p.name.replace(/[都道府県]$/, '')));
  const droppedAsPrefName = [];
  const kept = [...teams.values()].filter((t) => {
    if (!(t.count >= THRESHOLD && t.prefName && prefIdByName.has(t.prefName))) return false;
    if (prefShortNames.has(t.name) && t.prefName.replace(/[都道府県]$/, '') === t.name) {
      droppedAsPrefName.push(`${t.name}(${t.prefName}, ${t.count}件)`);
      return false;
    }
    return true;
  });
  if (droppedAsPrefName.length) console.log(`  県名がそのまま団体名になっていたため除外: ${droppedAsPrefName.join(' / ')}`);

  // ---- teamId を採番 ----
  const readingOverrides = readJson(OVERRIDE_FILE, {});
  const needRomaji = new Set();
  for (const t of kept) {
    const stripped = stripForSlug(t.name);
    needRomaji.add(applyLoanwords(stripped));
    // 上書きがあるときは「地名」と「残り」を別々に引いて連結する
    const core = placeCore(stripped);
    needRomaji.add(applyLoanwords(stripped.slice(core.length)));
    needRomaji.add(applyLoanwords(t.name));
  }
  const romaji = toRomajiBulk([...needRomaji].filter((s) => s.trim()));

  const usedByPref = new Map();
  const collisions = [];
  const overrideApplied = [];
  const out = [];
  for (const t of kept.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))) {
    const prefectureId = prefIdByName.get(t.prefName);
    const used = usedByPref.get(prefectureId) ?? new Set();
    const stripped = stripForSlug(t.name);

    let id;
    if (readingOverrides[t.name]) {
      const core = placeCore(stripped);
      const rest = applyLoanwords(stripped.slice(core.length));
      id = slugify(readingOverrides[t.name]) + slugify(rest.trim() ? romaji[rest] : '');
      overrideApplied.push(`${t.prefName} ${t.name} → ${id}`);
    } else {
      id = slugify(romaji[applyLoanwords(stripped)] ?? '');
    }
    if (!id) id = slugify(romaji[applyLoanwords(t.name)] ?? '');

    // 衝突したら短縮前の名前で作り直す（`-2` を付けるより読める URL になる）。
    // **衝突自体が名寄せの取りこぼしを示す信号**なのでログに出す
    if (used.has(id)) {
      const full = slugify(romaji[applyLoanwords(t.name)] ?? '');
      collisions.push(`${t.prefName} ${t.name}: ${id} → ${full && !used.has(full) ? full : `${id}-2`}`);
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

  // 都道府県は「県内にどの団体が収録されているか」の集計だけ持つ。順位づけはしない
  const prefOut = prefectures.map((p) => ({
    id: p.id,
    name: p.name,
    region: p.region,
    teamCount: out.filter((t) => t.prefectureId === p.id).length,
  }));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'index.json'),
    JSON.stringify({ threshold: THRESHOLD, tournamentIds: TOURNAMENTS.map((t) => t.id), prefectures: prefOut, teams: out }, null, 2) + '\n',
    'utf8',
  );
  if (!fs.existsSync(OVERRIDE_FILE)) fs.writeFileSync(OVERRIDE_FILE, '{}\n', 'utf8');

  const empty = prefOut.filter((p) => p.teamCount === 0);
  console.log('data/primaryschool/index.json を生成しました');
  console.log(`  団体 ${out.length}件（閾値 ${THRESHOLD}）`);
  console.log(`  都道府県 ${47 - empty.length}/47 に掲載団体あり（0件: ${empty.map((p) => p.name).join('・') || 'なし'}）`);
  console.log(`  総ページ数の見込み: ${1 + prefOut.length + out.length}`);
  console.log(`  teamId 最長 ${Math.max(...out.map((t) => t.id.length))}文字 / 平均 ${Math.round(out.reduce((n, t) => n + t.id.length, 0) / out.length)}文字`);
  console.log(`  読みの上書きを適用: ${overrideApplied.length}件\n    ${overrideApplied.join('\n    ')}`);
  if (collisions.length) console.log(`  県内で衝突したため作り直したもの（${collisions.length}件）:\n    ${collisions.join('\n    ')}`);
}

main();
