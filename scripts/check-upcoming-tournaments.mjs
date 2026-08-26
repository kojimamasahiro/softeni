#!/usr/bin/env node
// scripts/check-upcoming-tournaments.mjs
//
// 「開催前の大会」まわりの対応もれを洗い出すレポート。
//
// 背景（docs/raw/2026-07-26-idea-tournament-metadata-platform.md 追記6〜9）:
// 開催前ブロックと「これから開催」は information の未来日付レコードだけを見て自動で出る。
// 逆に言うと、**要項が出たのに information に行を足し忘れると、何も言わずに出なくなる**。
// 予選会↔本大会のリンクも tournamentId の命名規約（{本大会ID}-qualifier）に頼っているため、
// 本大会を別の ID で登録すると黙って繋がらない。どちらも「壊れずに消える」種類の抜けなので、
// 検査しないと気づけない。
//
// 実行: npm run check:upcoming
// 終了コードは常に 0。これは「直すべきバグ」ではなく「人がやる運用の残り」を並べるレポートなので、
// ビルドを止めない（prebuild には入れない）。

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, 'data', 'tournaments', 'index.json');
const INFO_DIR = path.join(ROOT, 'data', 'tournaments', 'information');

const today = new Date().toISOString().slice(0, 10);

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

const index = readJson(INDEX_PATH) ?? [];
const ids = new Set(index.map((t) => t.tournamentId));

/** tournamentId -> information レコード配列 */
const infoById = new Map();
for (const t of index) {
  const entries = readJson(path.join(INFO_DIR, `${t.tournamentId}.json`));
  infoById.set(t.tournamentId, Array.isArray(entries) ? entries : []);
}

const futureOf = (tid) =>
  (infoById.get(tid) ?? []).filter((e) => e.endDate && e.endDate >= today).sort((a, b) => String(a.startDate ?? '').localeCompare(String(b.startDate ?? '')));

// ── 1. 予選会に対応する本大会が未登録 ──────────────────────────────────────
const orphanQualifiers = index
  .filter((t) => t.tournamentId.endsWith('-qualifier'))
  .map((t) => ({ qualifier: t.tournamentId, main: t.tournamentId.replace(/-qualifier$/, ''), label: t.label }))
  .filter((x) => !ids.has(x.main));

// ── 2. 未来日付のレコードが無い全国大会 ─────────────────────────────────────
// 毎年開催される大会なら、要項が出た時点で次回の行を足す必要がある。
// 最後の開催が古いものほど「足し忘れ」の可能性が高いので、最終開催年を添える。
const noFuture = index
  .filter((t) => futureOf(t.tournamentId).length === 0)
  .map((t) => {
    const entries = infoById.get(t.tournamentId) ?? [];
    const latest =
      entries
        .map((e) => e.startDate)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
    return { tournamentId: t.tournamentId, label: t.label, latest };
  })
  .sort((a, b) => String(b.latest ?? '').localeCompare(String(a.latest ?? '')));

// ── 3. 未来大会だが情報が欠けている ────────────────────────────────────────
const incompleteFuture = [];
for (const t of index) {
  for (const e of futureOf(t.tournamentId)) {
    const missing = [];
    if (!(e.venues ?? []).length) missing.push('venues');
    if (!(e.categories ?? []).length) missing.push('categories');
    if (!e.guidelineUrl) missing.push('guidelineUrl');
    if (missing.length) {
      incompleteFuture.push({ tournamentId: t.tournamentId, label: e.label ?? t.label, start: e.startDate, missing });
    }
  }
}

// ── 出力 ───────────────────────────────────────────────────────────────
const line = (s = '') => console.log(s);

line('check-upcoming-tournaments');
line('='.repeat(60));
line(`基準日: ${today}`);
line();

line(`[1] 予選会に対応する本大会が index.json に未登録: ${orphanQualifiers.length} 件`);
line('    → 大会ハブの「関連する大会」リンクが片側だけになる（黙って出ない）');
for (const x of orphanQualifiers) {
  line(`    - ${x.qualifier}  ->  "${x.main}" が無い（${x.label}）`);
}
if (orphanQualifiers.length === 0) line('    （なし）');
line();

line(`[2] 未来日付のレコードが無い大会: ${noFuture.length} / ${index.length} 件`);
line('    → 「これから開催」にも開催前ブロックにも出ない。要項が出たら information に行を足す');
for (const x of noFuture.slice(0, 15)) {
  line(`    - ${x.tournamentId}  最終開催 ${x.latest ?? '不明'}（${x.label}）`);
}
if (noFuture.length > 15) line(`    ... ほか ${noFuture.length - 15} 件`);
if (noFuture.length === 0) line('    （なし）');
line();

line(`[3] 未来大会だが情報が欠けている: ${incompleteFuture.length} 件`);
line('    → 開催前ブロックは出るが中身が薄い（venues が無いと会場が出ない）');
for (const x of incompleteFuture) {
  line(`    - ${x.start} ${x.tournamentId}  欠け: ${x.missing.join(', ')}（${x.label}）`);
}
if (incompleteFuture.length === 0) line('    （なし）');
line();

line('※ 終了コードは常に 0。これは運用の残タスク一覧であり、ビルドを止めるエラーではない。');
