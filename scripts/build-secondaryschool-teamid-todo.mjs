#!/usr/bin/env node
/**
 * teamId の目視確認リストを生成する。出力:
 * docs/raw/2026-08-12-secondaryschool-teamid-review.md
 *
 * **override 済みのチームは除外する**（確認が終わったものを毎回眺めなくて済むように）。
 * override を書き足したら `npm run secondaryschool:build` の後にこれを流し直せば、
 * 残りだけのリストになる。
 *
 * 背景: teamId は pykakasi のローマ字読みで、`昇陽`→`noboruyou` のように誤ることがある。
 * URL は公開後に変えにくいので、公開前に人が目を通す必要がある。
 * 仕様は docs/wiki/secondaryschool.md「teamId の作り方」。
 *
 * 使い方: npm run secondaryschool:teamid-todo
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'raw', '2026-08-12-secondaryschool-teamid-review.md');

const readJson = (p, d) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return d;
  }
};

const teams = readJson(path.join(ROOT, 'data', 'secondaryschool', 'index.json'), { teams: [] }).teams;
const overrides = readJson(path.join(ROOT, 'data', 'secondaryschool', 'team-id-overrides.json'), {});
const pathways = readJson(path.join(ROOT, 'data', 'secondaryschool', 'pathways.json'), { pathways: {} }).pathways;

/** 読みを誤りうるか。0=英数のみ 1=カタカナのみ 2=漢字を含む */
function risk(name) {
  if (/^[\x20-\x7E！-～]+$/.test(name)) return 0;
  if (/^[ァ-ヶー・\s]+$/.test(name)) return 1;
  return 2;
}
const star = (t) => {
  const n = (pathways[`${t.name}\t${t.prefecture}`] ?? []).length;
  return n ? `★${n}` : '';
};

const rest = teams.filter((t) => !(t.name in overrides));
const sorted = [...rest].sort((a, b) => risk(b.name) - risk(a.name) || b.count - a.count);
const kanji = sorted.filter((t) => risk(t.name) === 2);
const other = sorted.filter((t) => risk(t.name) < 2);

const lines = [
  '# teamId 目視確認リスト（未確認ぶんのみ）',
  '',
  `生成 2026-08-12。**override 済み ${Object.keys(overrides).length}件を除いた ${rest.length}件**（全 ${teams.length}件）。`,
  '',
  '`data/secondaryschool/team-id-overrides.json` に `"チーム名": "正しいスラッグ"` を書くと上書きできる。',
  '書いたあと `npm run secondaryschool:build` を流し直し、`npm run secondaryschool:teamid-todo` でこのリストを再生成すると',
  '確認済みが消えて残りだけになる。',
  '',
  '## 書くときの規約',
  '',
  '- **長音は `ou` / `uu` を残す**（高校に合わせる）。`昇陽`→`shouyou`、`京都光華`→`kyoutokouka`',
  '- 「中学校」「◯◯市立」「ソフトテニス」は落とす。クラブ→club / ジュニア→junior / ユース→youth',
  '- 固有名詞のカタカナはローマ字のまま（`レペゼン千葉`→`repezenchiba`）',
  '- **同名の学校が高校側にあるときは `scripts/highschool/01team/team_id_map.json` を先に確認**',
  '  （相洋は高校側が `soyo` なので中学も `soyo` に合わせた）',
  '- teamId は**県内で一意**であればよい。県が違えば同じスラッグでも問題ない',
  '',
  `## 漢字を含む（読みを誤りやすい）: ${kanji.length}件`,
  '',
  '出場回数の多い順。★は進路の掲載件数で、**★が付くチームは高校ページからもリンクされる**ので優先度が高い。',
  '',
  '| チーム名 | 都道府県 | teamId | 出場 | 進路 |',
  '|---|---|---|---|---|',
  ...kanji.map((t) => `| ${t.name} | ${t.prefecture} | \`${t.id}\` | ${t.count} | ${star(t)} |`),
  '',
  `## カタカナ・英数のみ（読みは自明。基本そのままでよい）: ${other.length}件`,
  '',
  '| チーム名 | 都道府県 | teamId | 出場 |',
  '|---|---|---|---|',
  ...other.map((t) => `| ${t.name} | ${t.prefecture} | \`${t.id}\` | ${t.count} |`),
];

fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
console.log(`${path.relative(ROOT, OUT)} を生成しました`);
console.log(`  override済み ${Object.keys(overrides).length}件を除外 → 未確認 ${rest.length}件（漢字 ${kanji.length} / カタカナ英数 ${other.length}）`);
console.log(`  うち進路の掲載があるチーム（優先度高）: ${rest.filter((t) => star(t)).length}件`);
