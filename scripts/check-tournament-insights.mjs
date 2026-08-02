// scripts/check-tournament-insights.mjs
// 公開済み（state: published）の大会インサイトが、機械照合を通っていることをビルド前に強制する。
//
// ADR-012 でサイト本文へのLLM利用を解禁したが、その条件は「機械照合を通っていること」。
// 条件を人の手順書だけに委ねると必ず抜けるため、ビルドを落とす形で強制する。
// verifiedAt を手で書いただけでは通らないよう、**照合をこの場で実行し直す**。
//
// 使い方: node scripts/check-tournament-insights.mjs
// prebuild から呼ばれる。1件でも不合格ならビルドを止める。

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const INSIGHTS_DIR = path.join(process.cwd(), 'data', 'tournament-insights');
const VERIFIER = path.join(process.cwd(), 'scripts', 'verify-story-text.mjs');

function listInsightFiles() {
  if (!fs.existsSync(INSIGHTS_DIR)) return [];
  const out = [];
  for (const tournamentId of fs.readdirSync(INSIGHTS_DIR)) {
    const tDir = path.join(INSIGHTS_DIR, tournamentId);
    if (!fs.statSync(tDir).isDirectory()) continue;
    for (const year of fs.readdirSync(tDir)) {
      const yDir = path.join(tDir, year);
      if (!fs.statSync(yDir).isDirectory()) continue;
      for (const f of fs.readdirSync(yDir)) {
        if (f.endsWith('.json')) out.push(path.join(yDir, f));
      }
    }
  }
  return out;
}

const problems = [];
let checked = 0;
let skipped = 0;

for (const file of listInsightFiles()) {
  const rel = path.relative(process.cwd(), file);
  let insight;
  try {
    insight = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    problems.push(`${rel}: JSONとして読めない（${e.message}）`);
    continue;
  }

  // 公開していないものは検証しない（下書き段階で赤くなるとレビューが回らない）
  if (insight.state !== 'published') {
    skipped += 1;
    continue;
  }

  if (!insight.verifiedAt) {
    problems.push(`${rel}: state=published だが verifiedAt が空。照合を通してから公開すること`);
    continue;
  }
  if (!Array.isArray(insight.paragraphs) || insight.paragraphs.length === 0) {
    problems.push(`${rel}: paragraphs が空`);
    continue;
  }
  if (!Array.isArray(insight.usedStoryIds) || insight.usedStoryIds.length === 0) {
    problems.push(`${rel}: usedStoryIds が空。根拠を追跡できない本文は公開しない`);
    continue;
  }

  // verifiedAt を信用せず、その場で照合し直す。
  // 本文を後から書き換えて verifiedAt を残したままにする事故を防ぐ唯一の方法。
  //
  // -y <year> でこの記事の年を渡す。「N年連続」「N連覇」の起点をその年に固定するため、
  // 翌年以降に大会が続いて記録が伸びても、公開済みの過去記事がそれだけで不一致にならない。
  const result = spawnSync(
    process.execPath,
    [VERIFIER, '-t', insight.tournamentId, '-c', insight.categoryId, '-y', String(insight.year), '--text', insight.paragraphs.join('\n'), '-q'],
    { encoding: 'utf8' },
  );

  checked += 1;
  if (result.status !== 0) {
    problems.push(`${rel}: 照合に失敗\n${result.stdout?.trim() ?? ''}${result.stderr?.trim() ?? ''}`);
  }
}

if (problems.length > 0) {
  console.error('大会インサイトの検査に失敗しました:\n');
  for (const p of problems) console.error(`  - ${p}\n`);
  console.error('公開手順: docs/story-yaml/PROMPT.md / ADR-012');
  process.exit(1);
}

console.log(`大会インサイト: 公開${checked}件すべて照合済み（未公開${skipped}件はスキップ）`);
