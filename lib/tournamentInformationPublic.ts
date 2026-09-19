// lib/tournamentInformationPublic.ts
// `information/<tournamentId>.json` の年エントリを **公開ページの props に載せられる形**へ落とす。
//
// `note`（年エントリ直下・`venues[]` の両方）は入力時のメモで、出典の誤りをどう直したか・
// なぜ値を書かなかったかといった**内部の判断**が入る。docs/wiki/data-model.md の
// 「公開ページには出さない」はレンダリング結果だけの話ではなく、**ページのペイロード**も含む:
// Next.js は getStaticProps が返した props を `__NEXT_DATA__` としてHTMLに丸ごと埋めるため、
// 「描画していないから出ていない」は成り立たない（2026-09-19 に年度別結果ページで実際に露出。
// asian-games 2026 の note が配信HTMLにそのまま入っていた）。
//
// そのため**描画側ではなく getStaticProps で落とす**。型 (`PublicTournamentInformationEntry`) は
// `note?: never` にしてあるので、props に生の `TournamentInformationEntry` を入れると型エラーになる
// （props の型が効いている場所に限る）。

import type { TournamentInformationEntry, TournamentVenue } from '@/types/tournament';

// `note?: never` は飾りではなく**再発防止の本体**。単なる `Omit<…, 'note'>` だと
// `note` を持つ生の値もそのまま代入できてしまう（余剰プロパティの検査はオブジェクトリテラルにしか
// 効かない）。`never` にしておくと `note?: string` を持つ `TournamentInformationEntry` が
// 代入不能になり、props へ直接渡した時点で型エラーになる。
export type PublicTournamentVenue = Omit<TournamentVenue, 'note'> & { note?: never };

export type PublicTournamentInformationEntry = Omit<TournamentInformationEntry, 'note' | 'venues'> & {
  venues?: PublicTournamentVenue[];
  note?: never;
};

/**
 * 年エントリから `note` を取り除いた複製を返す。
 *
 * `note: undefined` を代入するのではなく**キーごと落とす**こと。Next.js は props に
 * `undefined` があるとシリアライズできずビルドが落ちる。
 */
export function toPublicInformationEntry(entry: TournamentInformationEntry | null | undefined): PublicTournamentInformationEntry | null {
  if (!entry) return null;

  const copy: Record<string, unknown> = { ...entry };
  delete copy.note;

  if (entry.venues) {
    copy.venues = entry.venues.map((venue) => {
      const venueCopy: Record<string, unknown> = { ...venue };
      delete venueCopy.note;
      return venueCopy as unknown as PublicTournamentVenue;
    });
  }

  return copy as unknown as PublicTournamentInformationEntry;
}
