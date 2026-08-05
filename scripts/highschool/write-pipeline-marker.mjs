// run-pipeline.sh の最終ステップから呼ばれる。
// 「元データの現在の内容ハッシュ」を data/highschool/.pipeline-source-hash.json に記録する。
// これにより、check-highschool-pipeline-freshness.mjs は
// 「今の元データに対してパイプラインが実行済みか」をタイムスタンプに頼らず判定できる。
//
// 使い方: node scripts/highschool/write-pipeline-marker.mjs

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { computeSourceHash, MARKER_PATH_REL } from './lib/source-hash.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '../..');

const { hash, fileCount } = computeSourceHash(ROOT_DIR);
const markerPath = path.join(ROOT_DIR, MARKER_PATH_REL);

fs.writeFileSync(
  markerPath,
  `${JSON.stringify(
    {
      sourceHash: hash,
      sourceFileCount: fileCount,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);

console.log(`  ✅ ${path.relative(ROOT_DIR, markerPath)} を更新しました（元データ ${fileCount} ファイル分のハッシュを記録）`);
