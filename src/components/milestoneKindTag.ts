// src/components/milestoneKindTag.ts
// milestone の kind（連覇/初優勝/王者撃破 など）を、バッジ内に添える「種別タグ」の
// 表示テキスト＋配色にマッピングする。複数の milestone バッジが並んだときに、
// ラベル文を読まなくても種類が一目で区別できるようにするための表示定義。
// 参照元: lib/milestones.ts の MilestoneKind。ResultContextBlocks / TournamentContextBlocks /
// PlayerCareerHighlights の3箇所で共有し、種別ごとの見た目を一貫させる。

export type MilestoneKindTagInfo = {
  /** バッジに添える短い種別テキスト（例: 「連覇」） */
  text: string;
  /** 種別タグの配色（Tailwind の背景/文字色クラス） */
  className: string;
};

const KIND_TAG: Record<string, MilestoneKindTagInfo> = {
  'repeat-title': { text: '連覇', className: 'bg-amber-600 text-white' },
  'first-title': { text: '初優勝', className: 'bg-emerald-600 text-white' },
  'nth-title': { text: '優勝', className: 'bg-sky-600 text-white' },
  'champion-defeat': { text: '王者撃破', className: 'bg-rose-600 text-white' },
  'career-wins': { text: '節目', className: 'bg-violet-600 text-white' },
  'best4-first': { text: 'ベスト4初', className: 'bg-teal-600 text-white' },
  'first-appearance': { text: '初出場', className: 'bg-gray-600 text-white' },
};

/** kind に対応する種別タグ情報を返す。未知の kind は null（タグなしでラベルのみ表示）。 */
export function milestoneKindTag(kind: string): MilestoneKindTagInfo | null {
  return KIND_TAG[kind] ?? null;
}
