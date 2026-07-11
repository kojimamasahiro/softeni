// src/components/milestoneKindTag.ts
// milestone の kind（連覇/初優勝/王者撃破 など）を、バッジ内に添える「種別タグ」の
// 表示テキスト＋配色にマッピングする。複数の milestone バッジが並んだときに、
// ラベル文を読まなくても種類が一目で区別できるようにするための表示定義。
// 参照元: lib/milestones.ts の MilestoneKind。ResultContextBlocks / TournamentContextBlocks /
// PlayerCareerHighlights の3箇所で共有し、種別ごとの見た目を一貫させる。

export type MilestoneKindTagInfo = {
  /** バッジに添える短い種別テキスト（例: 「連覇」） */
  text: string;
  /**
   * 種別タグの配色（Tailwind の背景/文字色クラス）。
   * 種別ごとに異なる色相で一目の区別を付ける用途のため、セマンティックな
   * デザイントークン（globals.css・§2.1）には該当色が無く、生パレットを使う。
   * ダーク時は背景を一段深く（`700`）してバッジ本体（dark:bg-*-900）の上で
   * 落ち着かせつつ、白文字とのコントラストを保つ。
   */
  className: string;
};

const KIND_TAG: Record<string, MilestoneKindTagInfo> = {
  'repeat-title': { text: '連覇', className: 'bg-amber-600 text-white dark:bg-amber-700' },
  'first-title': { text: '初優勝', className: 'bg-emerald-600 text-white dark:bg-emerald-700' },
  'nth-title': { text: '優勝', className: 'bg-sky-600 text-white dark:bg-sky-700' },
  'champion-defeat': { text: '王者撃破', className: 'bg-rose-600 text-white dark:bg-rose-700' },
  'giant-killing': { text: '金星', className: 'bg-orange-600 text-white dark:bg-orange-700' },
  'career-wins': { text: '節目', className: 'bg-violet-600 text-white dark:bg-violet-700' },
  'best4-first': { text: 'ベスト4初', className: 'bg-teal-600 text-white dark:bg-teal-700' },
  'first-appearance': { text: '初出場', className: 'bg-gray-600 text-white dark:bg-gray-700' },
};

/** kind に対応する種別タグ情報を返す。未知の kind は null（タグなしでラベルのみ表示）。 */
export function milestoneKindTag(kind: string): MilestoneKindTagInfo | null {
  return KIND_TAG[kind] ?? null;
}
