// lib/roundLabel.ts
//
// 試合1行の「ラウンド」欄の文言。
//
// 予選リーグの試合は `round` を持たないので、以前は4か所で `round ?? '予選'` と書いていた。
// 予選リーグを複数の組で行う大会（収録 118 種目のうち 116）では、それだと
// **どの組の試合か画面から分からない**。成績欄が「グループA 1位」と出しているのに、
// 対戦表は「予選」としか出ない、という食い違いがあった（2026-09-19 修正）。
//
// 決勝トーナメントの試合（`round` を持つ）は従来どおり `round` をそのまま出す。

type RoundLabelSource = {
  round?: string | null;
  group?: string | null;
};

/**
 * 「1回戦」「準決勝」/「予選 グループA」/「予選」。
 * 組の表記は成績欄（MatchResults の `グループA 1位`）と揃える。
 */
export function formatRoundLabel(match: RoundLabelSource): string {
  if (match.round) return match.round;
  const group = typeof match.group === 'string' ? match.group.trim() : match.group == null ? '' : String(match.group);
  return group ? `予選 グループ${group}` : '予選';
}
