// lib/bracketLayout.ts
// ドロー（組み合わせ）から「2 つのエントリーが最短で何回戦に当たるか」を求める。
//
// なぜ matches ではなくエントリーから復元するのか:
//   開催前のデータには 2 回戦以降の試合レコードが無く、`nextMatchId` も付かない
//   （実測: インターハイ 2026 は全 0 件／完了済みの 2025 は 314/315 件）。
//   よって matches のツリーを辿る方法では大会前に山の位置が分からない。
//
// 復元の根拠（2026-07-26 実測）:
//   - `entryNo` はドロー順で、1 回戦は必ず隣接同士（[2,3] [11,12] …）で組まれる。
//   - `entries[].type` が `seed` / `extra` の枠は 1 回戦が不戦勝なので、
//     スロット列に bye を 1 つ挟む。`packing` は 2 つで 1 試合。
//   - こうして組んだブラケットで求めた対戦ラウンドは、
//     **インターハイ 2026 男子ダブルスの実データ 128 試合と 100% 一致**した。
//
// 限界:
//   `type` が入っていない大会（入力ツールのシード対応が 2026-07-26 のため、それ以前の
//   データには `null` が多い）では復元できない。その場合は null を返す（graceful）。

import { readYearDetail, type RawDetail } from '@/lib/tournamentRecords';

/** ラウンド index（0 始まり）→ 表示名。0=1回戦。 */
const ROUND_LABELS = ['1回戦', '2回戦', '3回戦', '4回戦', '5回戦', '6回戦', '7回戦', '準々決勝', '準決勝', '決勝'];

/**
 * ラウンド index を表示名にする。
 * 決勝から数えて 3 つ（準々決勝・準決勝・決勝）は名前付きなので、総ラウンド数から逆算する。
 */
export function roundLabelOf(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return '決勝';
  if (fromEnd === 1) return '準決勝';
  if (fromEnd === 2) return '準々決勝';
  return ROUND_LABELS[roundIndex] ?? `${roundIndex + 1}回戦`;
}

export type BracketLayout = {
  /** entryNo → ブラケットのスロット位置（0 始まり） */
  slotOf: Map<number, number>;
  /** スロット総数（2 の冪） */
  size: number;
  /** 総ラウンド数（log2(size)） */
  totalRounds: number;
};

/**
 * `entries`（entryNo 昇順＝ドロー順）と `type` からブラケットの席順を復元する。
 * `type` が 1 件も無い場合は復元できないので null。
 */
export function buildBracketLayout(detail: RawDetail | null): BracketLayout | null {
  const entries = detail?.entries ?? [];
  if (entries.length === 0) return null;
  const typed = entries as Array<{ entryNo: number; type?: string | null }>;
  // seed / extra が 1 件も無い＝シード未入力のデータ。復元しても実際の山と合わないので諦める。
  if (!typed.some((e) => e.type === 'seed' || e.type === 'extra')) return null;

  const byNo = new Map(typed.map((e) => [e.entryNo, e.type ?? null]));
  const nos = [...byNo.keys()].sort((a, b) => a - b);

  const slots: (number | null)[] = [];
  for (let i = 0; i < nos.length; ) {
    const no = nos[i];
    const t = byNo.get(no);
    if (t === 'seed' || t === 'extra') {
      // 1 回戦不戦勝: 本人＋bye で 1 試合ぶんの席を使う
      slots.push(no, null);
      i += 1;
    } else {
      // packing: 隣同士で 1 試合
      slots.push(no, nos[i + 1] ?? null);
      i += 2;
    }
  }
  // 2 の冪まで埋める
  let size = 1;
  while (size < slots.length) size *= 2;
  while (slots.length < size) slots.push(null);

  const slotOf = new Map<number, number>();
  slots.forEach((no, idx) => {
    if (no != null) slotOf.set(no, idx);
  });
  return { slotOf, size, totalRounds: Math.log2(size) };
}

/**
 * 2 つのエントリーが**最短で**当たるラウンド index（0=1回戦）。
 * どちらかがブラケットに無ければ null。
 *
 * 「最短で」なのは、両者が全部勝ち上がった場合の合流地点だから。実際には途中で
 * 負ければ当たらない。表示では「◯回戦で対戦の可能性」ではなく事実として扱うこと。
 */
export function meetingRoundIndex(layout: BracketLayout, a: number, b: number): number | null {
  const p = layout.slotOf.get(a);
  const q = layout.slotOf.get(b);
  if (p == null || q == null || p === q) return null;
  for (let k = 1; k <= layout.totalRounds; k++) {
    if (p >> k === q >> k) return k - 1;
  }
  return null;
}

/** 大会・年度・種目からレイアウトを作る（薄いキャッシュ付き）。 */
const layoutCache = new Map<string, BracketLayout | null>();

export function getBracketLayout(tournamentId: string, year: number, categoryId: string): BracketLayout | null {
  const key = `${tournamentId}/${year}/${categoryId}`;
  if (layoutCache.has(key)) return layoutCache.get(key) ?? null;
  const layout = buildBracketLayout(readYearDetail(tournamentId, year, categoryId));
  layoutCache.set(key, layout);
  return layout;
}
