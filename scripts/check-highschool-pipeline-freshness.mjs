// 高校ソフトテニス データパイプライン（scripts/highschool/**）の生成物が、
// 元データ（data/tournaments/details/highschool-*）より古くないかをチェックする。
//
// 背景: パイプラインは scripts/highschool/README.md の手順を手動実行する運用だったため、
// 大会結果（data/tournaments/details）だけが更新されて、summary/analysis 系の生成物が
// 再生成されないまま取り残されることがあった。この状態では、大会結果ページのチームリンクが
// 古い（存在しない）データと突き合わされて欠落する、といった不具合が気付かれにくい形で起きる。
//
// このチェックは「元データの最新更新日時」より「パイプライン生成物の最古の更新日時」が
// 古い場合にビルドを失敗させ、`npm run highschool:pipeline` の再実行を促す。
//
// 使い方: node scripts/check-highschool-pipeline-freshness.mjs

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'data', 'tournaments', 'details');

/** data/tournaments/details 配下の highschool-* ディレクトリだけを対象にする。 */
function findHighschoolSourceDirs() {
  if (!fs.existsSync(SOURCE_DIR)) return [];
  return fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('highschool'))
    .map((e) => path.join(SOURCE_DIR, e.name));
}

/** 指定ディレクトリ配下の *.json を再帰的に集めて最新の mtime を返す。 */
function latestMtime(dir) {
  let latest = 0;
  let latestFile = null;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
        continue;
      }
      if (!entry.name.endsWith('.json')) continue;
      const mtime = fs.statSync(p).mtimeMs;
      if (mtime > latest) {
        latest = mtime;
        latestFile = p;
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return { mtime: latest, file: latestFile };
}

/** 存在しなければ「未生成」として mtime=0 を返す（＝必ず stale 扱いにする）。 */
function mtimeOf(relPath) {
  const p = path.join(ROOT, relPath);
  if (!fs.existsSync(p)) return { mtime: 0, file: relPath, missing: true };
  return { mtime: fs.statSync(p).mtimeMs, file: relPath, missing: false };
}

// --- 元データの最新更新日時 -------------------------------------------------
const sourceDirs = findHighschoolSourceDirs();
let source = { mtime: 0, file: null };
for (const dir of sourceDirs) {
  const found = latestMtime(dir);
  if (found.mtime > source.mtime) source = found;
}

if (source.mtime === 0) {
  console.log('ℹ️  highschool 大会データが見つからないため、チェックをスキップします。');
  process.exit(0);
}

// --- パイプライン生成物 -----------------------------------------------------
const singleFileArtifacts = [
  'scripts/highschool/01team/teams.json',
  'scripts/highschool/02result/results.json',
  'scripts/highschool/03list/prefecture-summary.json',
  'data/highschool/teams.json',
  'data/highschool/prefecture-summary.json',
];

const artifacts = singleFileArtifacts.map(mtimeOf);

// 都道府県別 summary.json も対象に含める（04summry ステップの実行漏れを検出するため）。
// 学校別 analysis.json は対象外: generate_school_analysis.py はチームが現在の
// summary.json に登場しなくなっても古い analysis.json を削除しないため（既知の別課題）、
// 単なる「実行し忘れ」と「もう対象外になったチームの残骸」を区別できない。
const prefecturesDir = path.join(ROOT, 'data', 'highschool', 'prefectures');
if (fs.existsSync(prefecturesDir)) {
  const walkForOldest = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkForOldest(p);
        continue;
      }
      if (entry.name === 'summary.json') {
        artifacts.push({ mtime: fs.statSync(p).mtimeMs, file: path.relative(ROOT, p), missing: false });
      }
    }
  };
  walkForOldest(prefecturesDir);
}

const missing = artifacts.filter((a) => a.missing);
const oldest = artifacts.filter((a) => !a.missing).sort((a, b) => a.mtime - b.mtime)[0];

const problems = [];
if (missing.length > 0) {
  problems.push(...missing.map((a) => `未生成: ${a.file}`));
}
if (oldest && oldest.mtime < source.mtime) {
  const sourceRel = path.relative(ROOT, source.file);
  problems.push(
    `生成物が古い: ${oldest.file} (${new Date(oldest.mtime).toISOString()}) が` +
      ` 元データ ${sourceRel} (${new Date(source.mtime).toISOString()}) より古いです`,
  );
}

if (problems.length > 0) {
  console.error('❌ 高校ソフトテニス データパイプラインの生成物が古い可能性があります:');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  console.error('👉 次を実行してください: npm run highschool:pipeline');
  process.exit(1);
}

console.log('✅ 高校ソフトテニス データパイプラインの生成物は最新です。');
