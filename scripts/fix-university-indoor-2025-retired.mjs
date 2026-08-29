#!/usr/bin/env node
/**
 * 一回限りのデータ修復スクリプト。
 *
 * data/tournaments/details/zennihon-university-indoor/2025/doubles-none-boys.json の
 * エントリー3（浅見竣一朗・安達宣／早稲田大学）はリーグ戦を**リタイアで不戦敗**しており、
 * 2試合ぶんの記録が丸ごと欠けていた。このため
 *   - scripts/check-orphan-entries.mjs が「1組がどの試合にも現れない」と報告
 *   - results の roundrobin.rank が null のまま（グループCで3位が空く）
 * という状態になっていた。集計すると消えた組が分母から落ちる。
 *
 * 記録の形は zennihon-mixed/2026/doubles-over35-mixed.json のグループ3（エントリー7が棄権）
 * に倣う。**棄権側の試合も記録し**、相手が 4-0 で勝ち `retired: true` を付ける。
 * 4 は tools/roundrobin/index.html の `initScore`（リタイアボタンが相手に入れる点数）。
 *
 * 入力ツール側のバグではない: `applyRetire()` は winner をセットし、エクスポートは
 * `if (!match.winner) continue;` なので、リタイアを入力していれば出力される。
 * 2026-08-01 の不戦勝バグ（byeDerived がノックアウトの試合を落とす）とも別件で、
 * 単にリタイアが入力されずに2試合が飛ばされていた。
 *
 * matchId は既存を振り直さず末尾番号を続ける（knockout の nextMatchId / prevMatchIds が
 * 既存 id を参照しているため）。配列上はグループCの試合の直後に差し込む。
 *
 *   node scripts/fix-university-indoor-2025-retired.mjs --dry-run
 *   node scripts/fix-university-indoor-2025-retired.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data/tournaments/details/zennihon-university-indoor/2025/doubles-none-boys.json');
const DRY_RUN = process.argv.includes('--dry-run');

const RETIRED_ENTRY = 3;
const GROUP = 'C';
const WIN_SCORE = 4; // tools/roundrobin/index.html の initScore
const RETIRED_RANK = 3; // グループC最下位（2試合とも不戦敗）

function main() {
  const text = fs.readFileSync(FILE, 'utf8');
  const data = JSON.parse(text);

  // グループCの相手（既に試合が記録されている組）を実データから割り出す
  const groupMatches = data.matches.filter((m) => m.group === GROUP);
  if (groupMatches.some((m) => m.entries.includes(RETIRED_ENTRY))) {
    console.log('既に適用済み（エントリー3の試合が存在する）');
    return;
  }
  const opponents = [...new Set(groupMatches.flatMap((m) => m.entries))].filter((e) => e !== RETIRED_ENTRY).sort((a, b) => a - b);
  if (opponents.length !== 2) throw new Error(`グループ${GROUP}の相手が2組ではない: ${opponents.join(',')}`);

  const maxNo = Math.max(...data.matches.map((m) => Number(String(m.matchId).replace('match-', '')) || 0));

  // このファイルは prettier 整形ではない（独自シリアライザ由来）。JSON を書き戻すと
  // 全行が変わるので、既存ブロックと同じ体裁のテキストを組み立てて差し込む。
  // retired の位置は同ファイルの knockout レコードに合わせて winnerEntryNo の直後。
  const renderMatch = (opp, no) =>
    [
      '    {',
      `      "entries": [${RETIRED_ENTRY}, ${opp}],`,
      '      "scores": {',
      `        "${opp}": ${WIN_SCORE},`,
      `        "${RETIRED_ENTRY}": 0`,
      '      },',
      '      "round": null,',
      '      "stage": "roundrobin",',
      `      "group": "${GROUP}",`,
      `      "winnerEntryNo": ${opp},`,
      '      "retired": true,',
      '      "nextMatchId": null,',
      '      "prevMatchIds": [],',
      '      "prevMatchId": null,',
      `      "matchId": "match-${no}"`,
      '    },',
    ].join('\n');

  // グループCの最後の試合ブロックの直後へ差し込む
  const lastGroupMatch = groupMatches[groupMatches.length - 1];
  const anchor = `      "matchId": "${lastGroupMatch.matchId}"\n    },\n`;
  if (text.split(anchor).length !== 2) throw new Error(`差し込み位置（${lastGroupMatch.matchId}）が一意に決まらない`);
  const block = opponents.map((opp, i) => renderMatch(opp, maxNo + i + 1)).join('\n');
  let out = text.replace(anchor, `${anchor}${block}\n`);

  // リーグ順位を埋める（エントリー3の results ブロックの rank だけを差し替える）
  const rankAnchor = `      "entryNo": ${RETIRED_ENTRY},\n      "tournament": null,\n      "roundrobin": {\n        "group": "${GROUP}",\n        "rank": null\n      }`;
  if (out.split(rankAnchor).length !== 2) throw new Error('results のエントリー3ブロックが一意に決まらない');
  out = out.replace(rankAnchor, rankAnchor.replace('"rank": null', `"rank": ${RETIRED_RANK}`));

  // ---- 検証 ----
  const after = JSON.parse(out);

  // 同一グループ内で順位が重複しない
  const ranks = after.results.filter((r) => r.roundrobin?.group === GROUP).map((r) => r.roundrobin.rank);
  if (new Set(ranks).size !== ranks.length || ranks.includes(null)) throw new Error(`グループ${GROUP}の順位が不正: ${ranks.join(',')}`);

  // 全組がいずれかの試合に現れる（check-orphan-entries.mjs と同じ観点）
  const inMatches = new Set(after.matches.flatMap((m) => m.entries ?? []));
  const orphans = after.entries.map((e) => e.entryNo).filter((no) => !inMatches.has(no));
  if (orphans.length) throw new Error(`どの試合にも現れない組が残っている: ${orphans.join(',')}`);

  // matchId が重複しない
  const ids = after.matches.map((m) => m.matchId);
  if (new Set(ids).size !== ids.length) throw new Error('matchId が重複した');

  // グループCが総当たり（3組 = 3試合）になった
  const gc = after.matches.filter((m) => m.group === GROUP);
  if (gc.length !== 3) throw new Error(`グループ${GROUP}の試合数が ${gc.length}`);

  console.log(`  グループ${GROUP}: エントリー${RETIRED_ENTRY} の不戦敗 ${opponents.map((o) => `vs${o}`).join(' / ')} を追加`);
  console.log(`  roundrobin.rank: null -> ${RETIRED_RANK}`);

  if (!DRY_RUN) fs.writeFileSync(FILE, out, 'utf8');
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}2 試合を追加、順位1件を補完`);
}

main();
