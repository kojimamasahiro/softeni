// 大会結果データ（data/tournaments/details/**）の entries 健全性チェック。
// 取り込み後に実行することで「入力ミスの取りこぼし」を防ぐ。問題があれば終了コード1。
// 使い方: node scripts/check-tournament-entries.mjs [--json]
//
// 背景: 2026-07-19、選手ページのパートナー別集計が試合数と合わない問題を追ったところ、
// 原因は全て entries の入力ミスだった（docs/raw/2026-07-19-manual-fix-checklist.md）。
// 統計エンジンはこれらを「相方不明」として黙って除外するため、表示だけ見ても気付けない。
//
// 重要: 検出は選手側から逆引きせず、details を全走査すること。
// 選手をサンプリングして逆引きすると、サンプル外の選手が絡む分を取りこぼす（実際に4件見落とした）。

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DETAILS = path.join(ROOT, 'data', 'tournaments', 'details');
const asJson = process.argv.includes('--json');

// ルールの実体は入力ツールと共有する（二重管理を避けるため）。
// tools/shared/validate-entries.js は Browser + Node 両対応の UMD。
const require = createRequire(import.meta.url);
const { validateTournamentData } = require('../tools/shared/validate-entries.js');

/** temp/ は入力途中の作業ファイル（形が異なる）。check-identity-health.mjs と同様に除外する。 */
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'temp' ? [] : walk(p);
    return e.name.endsWith('.json') && !e.name.startsWith('og') ? [p] : [];
  });

const findings = [];
const add = (file, entryNo, rule, message) => findings.push({ file, entryNo, rule, message });

for (const filePath of walk(DETAILS)) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    add(path.relative(ROOT, filePath), null, 'parse-error', `JSON として読めない: ${err.message}`);
    continue;
  }
  if (!data || !Array.isArray(data.entries)) continue;

  const rel = path.relative(ROOT, filePath);
  const categoryId = path.basename(filePath, '.json');

  for (const f of validateTournamentData(data, { categoryId })) {
    add(rel, f.entryNo, f.rule, f.message);
  }
}

if (asJson) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  const byRule = new Map();
  for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f]);

  if (findings.length === 0) {
    console.log('check-tournament-entries: 問題なし');
  } else {
    for (const [rule, items] of byRule) {
      console.log(`\n[${rule}] ${items.length}件`);
      for (const i of items) {
        console.log(`  ${i.file}${i.entryNo != null ? ` entryNo=${i.entryNo}` : ''}`);
        console.log(`    ${i.message}`);
      }
    }
    console.log(`\n合計 ${findings.length}件`);
  }
}

process.exitCode = findings.length > 0 ? 1 : 0;
