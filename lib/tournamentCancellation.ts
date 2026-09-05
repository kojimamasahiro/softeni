// lib/tournamentCancellation.ts
// 「中止（開催されなかった回）」の判定を1箇所に集約する。
//
// data/tournaments/information/<tournamentId>.json の年エントリに
// `status: 'cancelled'` を持たせて表す。結果（details）が無い年は本来ページに出ないが、
// **回次（第N回）が進んだまま中止になった年**（2020・2021 のコロナ禍など）を落とすと、
// 年表に空いた穴が「未収録なのか、そもそも開催されなかったのか」区別できなくなる。
//
// カテゴリ単位の打ち切り（lib/tournamentAbandonment.ts の `status: 'abandoned'`）とは別物。
// 打ち切りは途中まで実施されて成績が残るが、中止は1試合も行われていないので、
// 成績・連覇・statistics には一切入らない（information にだけ存在する年）。
//
// 設計: docs/raw/2026-09-05-cancelled-tournament-editions.md

/** `status` を持ちうる information 年エントリの最小形（読み出し経路ごとに型が違うため構造で受ける） */
type CancellableEntry = { status?: string | null } | null | undefined;

/** その年が「中止」として記録されているか。 */
export function isCancelledEntry(entry: CancellableEntry): boolean {
  return !!entry && entry.status === 'cancelled';
}

/**
 * 一覧・年表に出す中止の表記。理由（コロナ禍・荒天など）は持たないので書かない
 * （打ち切りで理由を持たないのと同じ方針。docs/raw/2026-07-26-abandoned-tournament-ui-design.md）。
 */
export const CANCELLED_LABEL = '中止';
