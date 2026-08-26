// lib/playerStats/aggregators/reachRates.ts
// 決勝 / 準決勝 進出率。分母 = ノックアウト個人戦（singles/doubles/mixed）の出場エントリー数。
// リーグのみ・placement=unknown・team は分母から除外（データ契約 §G）。
//
// 2026-08-26: **placement=unknown の除外を実際に実装した**（それまでコメントだけで、
// 実装は `isKnockoutSinglesDoublesMixed` に任せていたが、このフラグは
// `appearsInKnockout`＝knockout の試合に出たかでも true になるため素通りしていた）。
//
// 何が問題だったか: 組み合わせだけ投入して結果がまだ無い大会の出場者が、
// 「決勝に行けなかった」として分母に入り、進出率を不当に下げていた。
// 実測（2026-08-26）で分母 42,819 件のうち 764 件（1.78%）が該当し、
// **うち 748 件は開催前の zennihon-workers/2026**（2026-08-29 開幕）だった。
// 「開催前の大会を出す」方針（docs/wiki/public-pages.md）により組み合わせのみのデータは
// 今後増えるため、恒久的な対処が要る。
//
// 影響（実測）: 進出率を持つ 16,693 人のうち 764 人（4.6%）の分母が減り、
// うち 35 人は分母 0 になって進出率が出せなくなる（＝結果が確定した出場が1つも無い人）。
// 変化幅は中央値 0.00pt・90%点 0.00pt・99%点 16.67pt・最大 50.0pt で、
// 大きく動くのは分母 2→1・3→2 の少出場者のみ。
// 経緯: docs/raw/2026-07-26-idea-tournament-metadata-platform.md 追記10

import type { PlayerStatistics } from '../../../src/types/playerStatistics';
import type { PlayerFacts } from '../types';
import { calculateRate } from './util';

export function aggregateReachRates(facts: PlayerFacts): PlayerStatistics['reachRates'] {
  let denominator = 0;
  let finals = 0;
  let semis = 0;
  for (const e of facts.entries) {
    if (!e.isKnockoutSinglesDoublesMixed) continue;
    // 結果が確定していない出場は「決勝に行けなかった」と数えない
    if (e.placement.kind === 'unknown') continue;
    denominator += 1;
    if (e.reachedFinal) finals += 1;
    if (e.reachedSemifinal) semis += 1;
  }
  return {
    denominator,
    finalReachRate: calculateRate(finals, denominator),
    semifinalReachRate: calculateRate(semis, denominator),
  };
}
