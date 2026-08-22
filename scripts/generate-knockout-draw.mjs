// 予選リーグ→決勝トーナメント形式の大会について、決勝Tのドロー（席順）を
// `knockoutDraw` として details JSON に書き戻す。
//
// 使い方:
//   npm run bracket:draw                 # 実行結果を表示するだけ
//   npm run bracket:draw -- --apply      # JSON に書き込む
//   npm run bracket:draw -- --verbose    # 対象外・失敗の詳細も出す
//
// なぜ必要か:
//   決勝Tの席は **エントリーではなく予選リーグの組に属する**（詳細は
//   docs/adr/ADR-015-knockout-draw-by-group.md）。`entries[].type` に席順を持たせる
//   従来の方式は、リーグ終了まで誰がその席に入るか決まらないこの形式の大会では成立せず、
//   実測で 90 大会中 17 大会が誤復元になる（docs/raw/2026-08-22-bracket-slot-parity-
//   roundrobin-false-positive.md 検証2）。
//
//   完了済み大会は `matches` に決勝Tの木がそのまま残っているので、そこから席順を
//   起こせる。手入力が要るのは開催前・進行中の大会だけになる。
//
// 席順を起こす手順そのものは tools/shared/knockout-draw.js にある（入力ツールと共有）。
// このスクリプトはファイルの走査と書き戻しだけを担当する。

import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DETAILS = path.join(ROOT, 'data', 'tournaments', 'details');
const apply = process.argv.includes('--apply');
const verbose = process.argv.includes('--verbose');

const { buildKnockoutDraw } = createRequire(import.meta.url)(path.join(ROOT, 'tools', 'shared', 'knockout-draw.js'));

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'temp' ? [] : walk(p);
    return e.name.endsWith('.json') && !e.name.startsWith('og') ? [p] : [];
  });

/** `knockoutDraw` を既存の書式に合わせて 1 席 1 行で書く。 */
function formatDraw(draw) {
  const lines = draw.slots.map((s) => (s == null ? '      null' : `      {"group":${JSON.stringify(s.group)},"rank":${s.rank}}`));
  return ['  "knockoutDraw": {', '    "slots": [', lines.join(',\n'), '    ]', '  },'].join('\n');
}

/**
 * ファイル本文の `"knockoutDraw"` を差し替える（無ければ `"matches"` の直前に挿入）。
 *
 * details JSON は「1 行 1 オブジェクト」の独自書式なので、`JSON.stringify` で書き戻すと
 * ファイル全体が再整形されて差分が読めなくなる。該当箇所だけ文字列で差し替える。
 * 位置が特定できなければ null。
 */
function replaceKnockoutDraw(text, draw) {
  const block = formatDraw(draw);
  const existing = /^ {2}"knockoutDraw": \{\n(?: .*\n)*? {2}\},$/m;
  if (existing.test(text)) return text.replace(existing, block);
  const matchesKey = /^ {2}"matches": \[$/m;
  if (!matchesKey.test(text)) return null;
  return text.replace(matchesKey, `${block}\n  "matches": [`);
}

const summary = { generated: 0, written: 0, unchanged: 0, skipped: [], failed: [] };

for (const filePath of walk(DETAILS)) {
  let data;
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(text);
  } catch {
    continue;
  }
  if (!data || !Array.isArray(data.matches)) continue;

  const rel = path.relative(ROOT, filePath);
  const result = buildKnockoutDraw(data);

  // 予選リーグを含まない大会は毎回ここに来るので、記録するのは形式が該当するものだけ。
  if (result.skip) {
    if (result.skip !== '予選リーグ→決勝トーナメント形式ではない') summary.skipped.push({ rel, reason: result.skip });
    continue;
  }
  if (result.error) {
    summary.failed.push({ rel, reason: result.error });
    continue;
  }

  summary.generated += 1;
  if (verbose) console.log(`  ${rel} ${result.draw.slots.length}枠 検算${result.verified}件`);

  if (!apply) continue;
  if (JSON.stringify(data.knockoutDraw ?? null) === JSON.stringify(result.draw)) {
    summary.unchanged += 1;
    continue;
  }
  const next = replaceKnockoutDraw(text, result.draw);
  if (next == null) {
    summary.failed.push({ rel, reason: '"matches" の位置が見つからず書き込めない' });
    continue;
  }
  fs.writeFileSync(filePath, next);
  summary.written += 1;
}

console.log('決勝Tドロー（knockoutDraw）の生成');
console.log(`  生成できた: ${summary.generated} 大会`);
console.log(`  対象外（決勝1試合のみでブラケットが無い等）: ${summary.skipped.length} 大会`);
if (verbose) for (const s of summary.skipped) console.log(`    ${s.rel} — ${s.reason}`);
if (apply) console.log(`  書き込み: ${summary.written} 大会（変更なし ${summary.unchanged} 大会）`);
console.log(`  生成できなかった: ${summary.failed.length} 大会`);
for (const f of summary.failed) console.log(`  ${f.rel} — ${f.reason}`);
if (!apply) console.log('\n（--apply で書き込み）');
