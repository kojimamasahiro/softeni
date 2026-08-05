// 高校ソフトテニス データパイプライン（scripts/highschool/**）の生成物が、
// 元データ（data/tournaments/details/highschool-*）に対して最新かをチェックする。
//
// 背景: パイプラインは scripts/highschool/README.md の手順を手動実行する運用だったため、
// 大会結果（data/tournaments/details）だけが更新されて、summary/analysis 系の生成物が
// 再生成されないまま取り残されることがあった。この状態では、大会結果ページのチームリンクが
// 古い（存在しない）データと突き合わされて欠落する、といった不具合が気付かれにくい形で起きる。
//
// 判定方法（2026-08-05 改訂）: タイムスタンプは一切使わない。
// scripts/highschool/lib/source-hash.mjs で「元データ（01team/02result が実際に読む
// data/tournaments/details/<highschool-*>/<year>/*.json、非再帰）の内容ハッシュ」を計算し、
// npm run highschool:pipeline の最終ステップ（write-pipeline-marker.mjs）が
// data/highschool/.pipeline-source-hash.json に記録したハッシュと突き合わせる。
// 一致しなければ「今の元データに対してパイプラインが実行されていない」ことが確定するので
// ビルドを失敗させ、`npm run highschool:pipeline` の再実行を促す。
//
// なぜ以前の mtime/gitコミット日時ベースをやめたか:
// - CI（Netlify等）は毎回リポジトリをフレッシュに checkout するため、ファイルの mtime は
//   実際の新旧ではなく checkout 時の書き込み順に左右され、誤検知した実例があった。
// - git のコミット日時ベースにしても、「元データの一部だけが変わったが、この生成物の内容には
//   影響しない変更だった」場合に生成物側の最終コミットが古いまま止まり、パイプラインを
//   再実行しても内容が変わらない（＝新しいコミットが生まれない）ため、恒久的に
//   stale 判定され続けてしまう問題があった。
// 内容ハッシュの突き合わせなら、どちらの問題も原理的に起こらない。
//
// 使い方: node scripts/check-highschool-pipeline-freshness.mjs

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { computeSourceHash, MARKER_PATH_REL } from './highschool/lib/source-hash.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

const { hash: currentHash, fileCount } = computeSourceHash(ROOT);

if (fileCount === 0) {
  console.log('ℹ️  highschool 大会データが見つからないため、チェックをスキップします。');
  process.exit(0);
}

// --- パイプライン生成物の存在チェック（内容そのものではなく「ファイルがあるか」だけを見る） -----
const requiredArtifacts = [
  'scripts/highschool/01team/teams.json',
  'scripts/highschool/02result/results.json',
  'scripts/highschool/03list/prefecture-summary.json',
  'data/highschool/teams.json',
  'data/highschool/prefecture-summary.json',
];
const missing = requiredArtifacts.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));

// --- 元データの内容ハッシュ vs 直近のパイプライン実行時のハッシュ ---------------------
const markerPath = path.join(ROOT, MARKER_PATH_REL);
let markerProblem = null;
if (!fs.existsSync(markerPath)) {
  markerProblem = `${MARKER_PATH_REL} が見つかりません（パイプラインが一度も実行されていない可能性があります）`;
} else {
  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  } catch {
    markerProblem = `${MARKER_PATH_REL} の読み込みに失敗しました（壊れている可能性があります）`;
  }
  if (marker && marker.sourceHash !== currentHash) {
    markerProblem = `元データの内容が、最後に記録されたパイプライン実行時（${marker.generatedAt ?? '不明'}）から変わっています`;
  }
}

const problems = [];
if (missing.length > 0) {
  problems.push(...missing.map((rel) => `未生成: ${rel}`));
}
if (markerProblem) {
  problems.push(markerProblem);
}

if (problems.length > 0) {
  console.error('❌ 高校ソフトテニス データパイプラインの生成物が古い可能性があります:');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  console.error('👉 次を実行してください: npm run highschool:pipeline');
  process.exit(1);
}

console.log('✅ 高校ソフトテニス データパイプラインの生成物は最新です。');
