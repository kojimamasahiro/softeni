#!/usr/bin/env node
/**
 * 小学生カテゴリの teamId 目視確認リストを生成する。
 * 出力: docs/raw/2026-09-13-primaryschool-teamid-review.md
 *
 * 中学版（build-secondaryschool-teamid-todo.mjs）は「override 済みを除いた全件」を
 * 並べるだけだが、小学版は**既存カテゴリの読みと突き合わせて確認不要なものを外す**。
 * 298件を端から眺めるのは現実的でないため。
 *
 * 仕分けの考え方:
 *   A. 既存カテゴリ（高校 teams.json / 中学 index.json / 両者の手動 override）に
 *      同じ地名があり、**読みが食い違う** → 最優先。ほぼ確実に誤読
 *   B. 同じ地名が無い → 人が読みを確認するしかない。出場延べの多い順
 *   C. 同じ地名があり読みが一致 → **確認不要**。既に人が見たIDと同じ読み
 *   D. 地名部分に漢字を含まない → pykakasi の誤読は起きない
 *
 * **前方一致は「残りも読みが合うか」まで見て初めて証拠になる。**
 * `倉敷ジュニアクラブ` の `倉敷`(kurashiki) が高校 `倉敷南`(kurashikiminami) に前方一致するとき、
 * 残りの `南` が `minami` と読めて ID の残りと一致するなら、`倉敷=kurashiki` は裏が取れている。
 * 残りが合わなければ、たまたま頭が被っただけなので確認済みとは言えない（B へ回す）。
 *
 * A が実際に効くことは確認済み: `市場ジュニアクラブ`（徳島）の `shijou` が
 * 中学の `市場中学校=ichiba` と食い違うのを、この仕分けだけで検出できた。
 *
 * override 済みのチームは除外する（確認が終わったものを毎回眺めなくて済むように）。
 * `data/primaryschool/team-id-overrides.json` に `"チーム名": "正しいスラッグ"` を書いたあと
 * これを流し直すと、残りだけのリストになる。
 *
 * pykakasi（Python）が要る。`.venv` を有効にした環境で実行すること。
 * 使い方: npm run primaryschool:teamid-todo
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'raw', '2026-09-13-primaryschool-teamid-review.md');
const DET = path.join(ROOT, 'data', 'tournaments', 'details', 'zennihon-primaryschool');

/** 掲載閾値。build-secondaryschool-index.mjs と揃える */
const THRESHOLD = 5;

const readJson = (p, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  } catch {
    return fallback;
  }
};

/** 閾値を満たす団体を (名前, 県) 単位で集める */
function collectTeams() {
  const teams = new Map();
  for (const year of fs.readdirSync(DET).filter((y) => /^\d{4}$/.test(y))) {
    for (const file of fs.readdirSync(path.join(DET, year)).filter((f) => f.endsWith('.json'))) {
      const data = readJson(path.relative(ROOT, path.join(DET, year, file)), null);
      if (!data) continue;
      for (const p of data.participants ?? []) {
        const name = p?.team?.trim();
        if (!name) continue;
        const key = `${name}\t${p.prefecture ?? ''}`;
        const rec = teams.get(key) ?? { name, prefecture: p.prefecture ?? null, count: 0 };
        rec.count += 1;
        teams.set(key, rec);
      }
    }
  }
  return [...teams.values()].filter((t) => t.count >= THRESHOLD);
}

/**
 * 団体名から「地名らしい先頭部分」を取り出す。
 * 末尾から既知の語（競技名・組織形態・略号）を剥がせるだけ剥がす。
 * 1文字以下になるところまでは削らない。
 */
const TAIL =
  /(ソフトテニス|テニス|ジュニアクラブ|ジュニア|クラブ|スポーツ少年団|スポ少|少年団|スクール|チーム|ユース|協会|倶楽部|Jr\.?|Ｊｒ\.?|ＳＴＣ|STC|ＪＳＣ|JSC|ＪＳＴＣ|JSTC|ＪＳＴ|JST|ＳＣ|SC)$/;
function placeCore(name) {
  let s = name.replace(/（.*?）|\(.*?\)/g, '').trim();
  let prev;
  do {
    prev = s;
    s = s.replace(TAIL, '').trim();
  } while (s !== prev && s.length > 1);
  return s;
}

function toRomaji(names) {
  const script = `
import sys, json, pykakasi
k = pykakasi.kakasi()
print(json.dumps({n: "".join(x["hepburn"] for x in k.convert(n)) for n in json.load(sys.stdin)}, ensure_ascii=False))
`;
  try {
    const raw = execFileSync(path.join(ROOT, '.venv', 'bin', 'python'), ['-c', script], {
      input: JSON.stringify(names),
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    return JSON.parse(raw);
  } catch {
    console.error('pykakasi を呼べませんでした。.venv を有効にした環境で実行してください。');
    process.exit(1);
  }
}

const slug = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * 既存カテゴリの名前は、ID を作るときに学校種別の接尾辞が落とされている
 * （`芳賀中学校` -> `haga`、`稲城第三中学校` -> `inagidaisan`）。
 * 読みを突き合わせるときは名前側からも同じ語を落としておかないと桁がずれる。
 */
const stripSchoolSuffix = (name) => name.replace(/(中等教育学校|中学校|中学|中|高等学校|高校)$/, '') || name;

/** 既存カテゴリの「名前 -> ID」。人が一度見ている読みの集合として使う */
function loadMasters() {
  const masters = [];
  for (const t of readJson('data/highschool/teams.json', [])) masters.push({ src: '高校', name: t.name, id: t.id });
  for (const t of readJson('data/secondaryschool/index.json', { teams: [] }).teams) masters.push({ src: '中学', name: t.name, id: t.id });
  for (const [name, id] of Object.entries(readJson('scripts/highschool/01team/team_id_map.json', {}))) masters.push({ src: '高校(手動)', name, id });
  for (const [name, id] of Object.entries(readJson('data/secondaryschool/team-id-overrides.json', {}))) masters.push({ src: '中学(override)', name, id });
  return masters;
}

function main() {
  const overrides = readJson('data/primaryschool/team-id-overrides.json', {});
  const all = collectTeams();
  const rest = all.filter((t) => !(t.name in overrides));
  const masters = loadMasters();

  const withCore = rest.map((t) => ({ ...t, core: placeCore(t.name) }));
  const kanji = withCore.filter((t) => /[一-鿿]/.test(t.core));
  const noKanji = withCore.filter((t) => !/[一-鿿]/.test(t.core));

  // 地名そのものと、前方一致した既存名の「残り」の両方の読みを引く
  const cores = [...new Set(kanji.map((t) => t.core))];
  const remainders = new Set();
  for (const t of kanji)
    for (const m of masters) {
      const base = stripSchoolSuffix(m.name);
      if (base.startsWith(t.core) && base !== t.core) remainders.add(base.slice(t.core.length));
    }
  const romaji = toRomaji([...new Set([...cores, ...remainders])]);

  const A = [];
  const B = [];
  const C = [];
  for (const t of kanji) {
    const reading = slug(romaji[t.core]);
    const hits = masters.filter((m) => m.name.startsWith(t.core));
    if (!hits.length) {
      B.push({ ...t, reading });
      continue;
    }
    const agree = hits.filter((m) => m.id.startsWith(reading));
    if (!agree.length) {
      A.push({ ...t, reading, hits });
      continue;
    }
    // 完全一致なら地名そのものの読みが取れている。
    // 前方一致は「残りの読み」も ID の残りと合うときだけ裏が取れたとみなす
    const confirmed = agree.find((m) => {
      const base = stripSchoolSuffix(m.name);
      if (base === t.core) return true;
      if (!base.startsWith(t.core)) return false;
      return slug(romaji[base.slice(t.core.length)]) === m.id.slice(reading.length);
    });
    if (confirmed) C.push({ ...t, reading, via: confirmed });
    else B.push({ ...t, reading, weak: agree[0] });
  }
  const byCount = (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja');
  A.sort(byCount);
  B.sort(byCount);
  C.sort(byCount);
  noKanji.sort(byCount);

  const lines = [
    '# 小学生カテゴリ teamId 目視確認リスト',
    '',
    `生成は \`npm run primaryschool:teamid-todo\`。override 済み ${Object.keys(overrides).length}件を除いた ${rest.length}件（閾値${THRESHOLD}の全 ${all.length}件）。`,
    '',
    '`data/primaryschool/team-id-overrides.json` に `"チーム名": "正しいスラッグ"` を書くと上書きできる。',
    '書いたあとこれを流し直すと、確認済みが消えて残りだけになる。',
    '',
    '## 書くときの規約',
    '',
    '- 長音は `ou` / `uu` を残す（`昇陽` は `shoyo` でなく `shouyou`）。サイト全体の一貫性を優先する規約',
    '- 競技名（`ソフトテニス` / `テニス`）は落とす。当サイトでは自明なため',
    '- `クラブ` `ジュニア` `ユース` `スポーツ` `センター` `チーム` は英語綴りへ。それ以外のカタカナはローマ字のまま',
    '- `スポ少` と `スポーツ少年団` は統一しない。各団体が自分で名乗っている名前の違いなので',
    '- **同名の学校が高校側にある場合は `scripts/highschool/01team/team_id_map.json` を先に確認する**',
    '',
    `## A. 最優先: 既存カテゴリと読みが食い違う（${A.length}件）`,
    '',
    '同じ地名が高校・中学のマスタにあり、そちらの ID と読みが合わない。ほぼ確実に pykakasi の誤読。',
    '',
  ];
  if (A.length) {
    lines.push('| 県 | 団体名 | 出場延べ | 地名 | pykakasi | 既存カテゴリ |', '|---|---|---|---|---|---|');
    for (const t of A)
      lines.push(
        `| ${t.prefecture ?? ''} | ${t.name} | ${t.count} | ${t.core} | \`${t.reading}\` | ${t.hits
          .slice(0, 3)
          .map((h) => `${h.src} ${h.name}=\`${h.id}\``)
          .join(' / ')} |`,
      );
  } else {
    lines.push('なし。');
  }

  lines.push(
    '',
    `## B. 要確認: 既存カテゴリで読みを確かめられない（${B.length}件）`,
    '',
    '同じ地名がマスタに無いか、あっても**前方一致どまり**で読みの裏づけにならないもの。',
    '人が読みを確認するしかない。出場延べの多い順。',
    '',
  );
  lines.push('| # | 県 | 団体名 | 出場延べ | 地名 | pykakasi | 参考（前方一致） |', '|---|---|---|---|---|---|---|');
  B.forEach((t, i) =>
    lines.push(
      `| ${i + 1} | ${t.prefecture ?? ''} | ${t.name} | ${t.count} | ${t.core} | \`${t.reading}\` | ${
        t.weak ? `${t.weak.src} ${t.weak.name}=\`${t.weak.id}\`` : ''
      } |`,
    ),
  );

  lines.push(
    '',
    `## C. 確認不要: 既存カテゴリで読みの裏が取れた（${C.length}件）`,
    '',
    '地名部分が高校・中学のマスタと完全一致するか、前方一致したうえで**残りの読みも ID と一致**したもの。人が一度目を通した ID と同じ読みなので確認不要。',
    '',
    '| 県 | 団体名 | 地名 | pykakasi | 一致した既存 |',
    '|---|---|---|---|---|',
  );
  for (const t of C) lines.push(`| ${t.prefecture ?? ''} | ${t.name} | ${t.core} | \`${t.reading}\` | ${t.via.src} ${t.via.name}=\`${t.via.id}\` |`);

  lines.push(
    '',
    `## D. 対象外: 地名部分に漢字が無い（${noKanji.length}件）`,
    '',
    'pykakasi の誤読は起きない。カタカナ・英字はローマ字化の規約どおりに落ちる。',
    '',
    noKanji.map((t) => `${t.name}（${t.prefecture ?? ''}・${t.count}）`).join(' / '),
    '',
  );

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
  console.log(`${path.relative(ROOT, OUT)} を生成しました`);
  console.log(`  A 最優先 ${A.length} / B 要確認 ${B.length} / C 確認不要 ${C.length} / D 対象外 ${noKanji.length}`);
  console.log(`  override 済み ${Object.keys(overrides).length}件は除外`);
}

main();
