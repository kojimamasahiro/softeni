// lib/tournamentAbandonment.ts
//
// 「打ち切り（大会が途中で終了し、以降の試合が実施されなかった）」大会の成績解決。
// 検討記録: docs/raw/2026-07-26-abandoned-tournament-ui-design.md
// 前提となる語彙: docs/adr/ADR-007-in-progress-tournament-standing.md（rank.kind:'ongoing'）
//
// 背景:
//   ADR-007 で導入した `rank.kind:'ongoing'` は「まだ試合が残っている＝いずれ確定する」を
//   意味する。ところが打ち切り大会（例: highschool-tokai-block/2026）では ongoing が
//   永久に確定しないため、そのままだと coverage が in_progress のまま／戦績に載らない／
//   ブラケットが空欄、という誤動作を起こす。
//
// 方針:
//   打ち切りの事実は data/tournaments/information/<tid>.json の categories[] に
//   `status:'abandoned'` / `abandonedAfterRound` として持ち（detail JSON は matches の
//   忠実な記録のままにする）、detail を読み出す時点で ongoing を確定 rank に解決する。
//   これにより既存の消費側（playerStats/placement.ts, highschoolAlumni.ts,
//   majorResults.ts, newsArticle.ts）は分岐追加なしで正しく動く。
//
// 注意: 打ち切り「理由」は保持しない。理由を断定できるだけの典拠が無く、
//       不正確な情報を UI に出さないため（2026-07-26 決定）。

/** information の categories[] 要素のうち、打ち切り判定に使う部分だけを見る構造的部分型。 */
export interface AbandonableCategoryInfo {
  categoryId?: string;
  /** 'abandoned' のときだけ打ち切り扱い。未設定＝通常進行（既存データは全て未設定）。 */
  status?: string;
  /** 最後に完了したラウンド名（例: "3回戦"）。 */
  abandonedAfterRound?: string;
}

export interface AbandonmentInfo {
  /** 最後に完了したラウンド名（例: "3回戦"）。 */
  abandonedAfterRound: string;
}

/** 解決後の rank。detail JSON の rank と同じ形。 */
export type ResolvedRank = { kind: 'best'; bestLevel: number } | { kind: 'round'; round?: number };

export interface ResolvedStanding {
  label: string;
  rank: ResolvedRank;
}

/**
 * results 要素のうち打ち切り解決に必要な部分だけを見る構造的部分型。
 * 呼び出し側の具体型（TournamentResult / RawResult 等）は互いに微妙に異なるため、
 * 要素はこの型へナローイングして扱い、detail 側はジェネリクスで素通しする。
 */
interface AbandonableResult {
  tournament?: { label?: string; rank?: { kind?: string } | null } | null;
}

/** results を持つ detail であればよい（他フィールドは触らない）。 */
interface AbandonableDetail {
  results?: unknown[] | null;
}

/**
 * information の categories[] から、指定カテゴリの打ち切り情報を取り出す。
 * 打ち切りでない（＝大多数の大会）なら null。
 */
export function getAbandonment(categories: AbandonableCategoryInfo[] | null | undefined, categoryId: string): AbandonmentInfo | null {
  if (!categories) return null;
  const hit = categories.find((c) => c?.categoryId === categoryId);
  if (!hit || hit.status !== 'abandoned') return null;
  const round = hit.abandonedAfterRound;
  if (!round) return null;
  return { abandonedAfterRound: round };
}

/**
 * 打ち切り時点で ongoing だったエントリー数から、確定成績を導く。
 *
 * aliveEntries=8 → ベスト8 / aliveEntries=4 → ベスト4。
 *
 * 【未検証パターンについて】
 * 消費側（lib/highschoolAlumni.ts, lib/playerStats/aggregators/majorResults.ts）は
 * bestLevel を **4 と 8 しか判定していない**。したがって 4/8 以外（ベスト16 打ち切り等）は
 * `best` にせず `round`（＝入賞扱いしない保守側）へフォールバックする。
 * このフォールバックの妥当性は **未検証** で、該当する大会がまだ存在しないため
 * 意図的に未検証のまま残している（2026-07-26 決定）。
 * 実際に該当大会が出た場合は emitAbandonmentWarning() の警告が出るので、
 * docs/raw/2026-07-26-abandoned-tournament-ui-design.md を読み返して再設計すること。
 */
export function resolveAbandonedRank(aliveEntries: number, abandonedAfterRound: string): ResolvedStanding {
  if (aliveEntries === 8 || aliveEntries === 4) {
    return { label: `ベスト${aliveEntries}`, rank: { kind: 'best', bestLevel: aliveEntries } };
  }
  const numMatch = abandonedAfterRound.match(/(\d+)/);
  const round = numMatch ? Number(numMatch[1]) : undefined;
  return {
    label: `ベスト${aliveEntries}`,
    rank: round !== undefined ? { kind: 'round', round } : { kind: 'round' },
  };
}

/** 未検証パターンを踏んだ時だけ、ビルド時に1度だけ警告する（公開UIには出さない）。 */
const warnedAbandonmentKeys = new Set<string>();

export function emitAbandonmentWarning(aliveEntries: number, context: string): void {
  if (aliveEntries === 8 || aliveEntries === 4) return;
  if (warnedAbandonmentKeys.has(context)) return;
  warnedAbandonmentKeys.add(context);
  console.warn(
    `[abandonment] 未検証パターン: aliveEntries=${aliveEntries} (${context}). ` +
      `bestLevel は消費側が 4/8 しか判定しないため round へフォールバックしました。` +
      `docs/raw/2026-07-26-abandoned-tournament-ui-design.md を参照してください。`,
  );
}

function isOngoing(raw: unknown): boolean {
  return (raw as AbandonableResult | null)?.tournament?.rank?.kind === 'ongoing';
}

/** detail の results のうち ongoing なエントリー数（＝打ち切り時点で勝ち上がり中だった枠数）。 */
export function countAliveEntries(detail: AbandonableDetail | null | undefined): number {
  return (detail?.results ?? []).filter(isOngoing).length;
}

/**
 * detail の results 内の ongoing を確定成績に置換した**新しい** detail を返す純粋関数。
 * 打ち切りでない／ongoing が無い場合は元のオブジェクトをそのまま返す（＝既存挙動を一切変えない）。
 *
 * 引数の detail は破壊しない（tournament-data-loader のキャッシュ済みオブジェクトを
 * 共有したまま渡されうるため）。
 */
export function applyAbandonment<T extends AbandonableDetail>(detail: T, abandonment: AbandonmentInfo | null, context = ''): T {
  if (!abandonment) return detail;

  const aliveEntries = countAliveEntries(detail);
  if (aliveEntries === 0) return detail;

  emitAbandonmentWarning(aliveEntries, context);
  const standing = resolveAbandonedRank(aliveEntries, abandonment.abandonedAfterRound);

  const results = (detail.results ?? []).map((raw) => {
    if (!isOngoing(raw)) return raw;
    const r = raw as AbandonableResult;
    return { ...r, tournament: { ...r.tournament, label: standing.label, rank: standing.rank } };
  });

  // results 要素の具体型は呼び出し側ごとに異なる（TournamentResult / RawResult）。
  // 置換後の形は実データの完了大会（{label:"ベスト8", rank:{kind:"best",bestLevel:8}}）と
  // 同一なので、ここでの cast は安全。
  return { ...detail, results } as T;
}
