// 高校ソフトテニス データパイプライン（scripts/highschool/**）の生成物が、
// 元データ（data/tournaments/details/highschool-*）に対して最新かをチェックする。
//
// 背景: パイプラインは scripts/highschool/README.md の手順を手動実行する運用だったため、
// 大会結果（data/tournaments/details）だけが更新されて、summary/analysis 系の生成物が
// 再生成されないまま取り残されることがあった。この状態では、大会結果ページのチームリンクが
// 古い（存在しない）データと突き合わされて欠落する、といった不具合が気付かれにくい形で起きる。
//
// 判定方法（2026-08-05 改訂 / 2026-09-06 に射影化）: タイムスタンプは一切使わない。
// scripts/highschool/lib/source-hash.mjs で「元データ（01team/02result/03list が実際に読む
// data/tournaments/details/<大会>/<year>/*.json、非再帰）のうち、
// **パイプラインが実際に読む項目だけ**を取り出した内容ハッシュ」を計算し、
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
// なぜ「読む項目だけ」に絞るか（2026-09-06）:
// ファイル全体のバイト列を混ぜていたため、パイプラインが一切読まない項目
// （`matches`・`knockoutDraw`・`entries[].type`・スコア等）を直すたびにビルドが落ちていた。
// 再実行しても生成物は 1 バイトも変わらず、マーカーのハッシュだけが動く空振りになる。
// 射影が「読む項目を漏れなく含んでいる」ことは、全 319 ファイルを射影後の項目だけに削って
// パイプラインを流し、**生成物が完全に一致する**ことで確認した（2026-09-06）。
//
// 使い方: node scripts/check-highschool-pipeline-freshness.mjs

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { computeSourceHash, MARKER_PATH_REL, SOURCE_HASH_KIND } from './highschool/lib/source-hash.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

const { hash: currentHash, rawHash: currentRawHash, fileCount } = computeSourceHash(ROOT);

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
let rawOnlyChanged = false;
if (!fs.existsSync(markerPath)) {
  markerProblem = `${MARKER_PATH_REL} が見つかりません（パイプラインが一度も実行されていない可能性があります）`;
} else {
  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  } catch {
    markerProblem = `${MARKER_PATH_REL} の読み込みに失敗しました（壊れている可能性があります）`;
  }
  if (marker) {
    // 2026-09-06 より前のマーカーは「ファイル全体のバイト列」のハッシュを持つ。
    // 射影ハッシュとは値が違うので、旧マーカーは旧方式で照合する（切り替えの過渡期に
    // 他ブランチのマーカーが一斉に赤くならないようにするため）。
    // 次に npm run highschool:pipeline を回した時点で新方式に載る。
    const isProjection = marker.sourceHashKind === SOURCE_HASH_KIND;
    const expected = isProjection ? currentHash : currentRawHash;
    if (marker.sourceHash !== expected) {
      markerProblem = `元データの内容が、最後に記録されたパイプライン実行時（${marker.generatedAt ?? '不明'}）から変わっています`;
      if (!isProjection) markerProblem += `（マーカーが旧形式です。npm run highschool:pipeline で ${SOURCE_HASH_KIND} に載せ替わります）`;
    } else if (isProjection && marker.rawSourceHash && marker.rawSourceHash !== currentRawHash) {
      rawOnlyChanged = true;
    }
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

if (rawOnlyChanged) {
  // 落とさない。生成物に影響しない項目（matches など）だけが変わった状態で、
  // パイプラインを回しても差分は出ない。「なぜ緑なのか」が読めるように理由だけ出す。
  console.log('ℹ️  元データは変わっていますが、パイプラインが読む項目は変わっていないため再実行は不要です。');
}
console.log('✅ 高校ソフトテニス データパイプラインの生成物は最新です。');
