// lib/tournamentCoverage.ts
//
// 大会結果ページで「どこまで結果が反映されているか」を示すための集計。
// docs/adr/ADR-007-in-progress-tournament-standing.md の Open Question
// 「結果ページでも途中経過(ongoing)を明示表示するか」に対応するもの。
//
// 設計方針（2026-07-19 検討）:
// - 対象は個人戦・団体戦の決勝トーナメント（stage:'knockout'）のみ。予選リーグ
//   （stage:'roundrobin'）は進捗の測り方が別物（ラウンド深度でなくグループ内消化数・
//   順位確定）になるため、今回のスコープ外（docs/wiki の Open Questions へ記載）。
// - 完了/進行中の判定は matches の decided/total 件数比だけに頼らない。理由:
//   3位決定戦が実施されない大会や、対戦相手が確定しない不完全な試合データ（例:
//   entries に null を含むダミー枠）が過去の「完了済み」大会にも残っており、
//   matches ベースの比較だけだと完了済みの大会を誤って「進行中」と判定してしまう
//   （highschool-championship/2025 doubles-none-girls 等で確認）。
//   そこで、results[].tournament.rank.kind に 'ongoing' が1件でも残っているか
//   （= normalize-core.js が「まだ勝ち上がり中で最終結果未確定」と判定したエントリーが
//   存在するか）を完了判定の主軸にする。ongoing が無ければ完了済みとみなす。
// - matches の decided/total 件数・最深確定ラウンドは、進行中の場合の表示文言
//   （「現在◯回戦まで結果掲載中」等）を組み立てるための補助情報として使う。

export type ResultCoverageStatus =
  | 'not_recorded' // 組み合わせは掲載済みだが決勝Tの結果はまだ1件も反映されていない
  | 'in_progress' // 決勝Tが一部反映されている（一部エントリーが ongoing）
  | 'completed' // 決勝Tの結果が出揃っている（ongoing なエントリーが無い）
  | 'abandoned' // 大会が途中で打ち切られ、以降の試合が実施されなかった
  | 'unsupported'; // 決勝T(knockout)の試合データ自体が無い（予選リーグのみ等、今回はスコープ外）

export interface ResultCoverage {
  status: ResultCoverageStatus;
  /** 決勝T(stage:'knockout')の総試合数 */
  totalKnockoutMatches: number;
  /** 決勝Tのうち勝者が確定している試合数 */
  decidedKnockoutMatches: number;
  /** decidedKnockoutMatches / totalKnockoutMatches（totalが0ならnull） */
  progressRatio: number | null;
  /** 勝者が確定している試合のうち、最も深いラウンドの表示名（例: "準々決勝" / "3回戦"） */
  deepestDecidedRoundLabel: string | null;
  /** results[].tournament.rank.kind === 'ongoing' なエントリー数（＝現在勝ち上がり中の枠数） */
  aliveEntries: number;
  /** status==='abandoned' のとき、最後に完了したラウンド名（例: "3回戦"）。それ以外は null */
  abandonedAfterRound: string | null;
  /** 勝者未確定の試合のうち、最も浅いラウンドの表示名（例: "準々決勝"）。打ち切り文言に使う */
  firstUndecidedRoundLabel: string | null;
}

/**
 * その試合の勝者が確定しているか。
 *
 * 注意: **`null` だけを見てはいけない**。ページに渡す際の pack/unpack
 * （`lib/packedPageData.ts`）が `winnerEntryNo: number` 型に合わせて
 * `null` を **`-1`** に置き換えるため、未実施の試合が「確定済み」と誤判定される。
 * 実際、インターハイ 2026 男子ダブルス（1回戦 60 試合すべて未実施）で
 * 「1回戦まで結果掲載中(全60試合中60試合終了・100%)」と表示される不具合が出た（2026-07-26）。
 * entryNo は 1 以上なので、0 以下は「未確定」とみなす。
 */
function isDecided(m: CoverageMatchInput): boolean {
  const w = m.winnerEntryNo;
  return w !== null && w !== undefined && w > 0;
}

interface CoverageMatchInput {
  stage?: string | null;
  round?: string | null;
  winnerEntryNo?: number | null;
}

interface CoverageResultInput {
  tournament?: {
    rank?: {
      kind?: string;
    } | null;
  } | null;
}

interface CoverageDetailDataInput {
  matches?: CoverageMatchInput[] | null;
  results?: CoverageResultInput[] | null;
}

// tools/shared/normalize-core.js の roundOrderOf と同じ並び替えロジック。
// 「準々決勝」「準決勝」「決勝」はいずれも部分文字列に "決勝" を含むため、
// 長い語から順にマッチさせる必要がある。
const ROUND_ORDER_MAP: Record<string, number> = { 準々決勝: 8000, 準決勝: 9000, 決勝: 10000 };
const ROUND_ORDER_KEYS = Object.keys(ROUND_ORDER_MAP).sort((a, b) => b.length - a.length);

function roundOrderOf(roundName: string | null | undefined): number {
  if (!roundName) return -1;
  const numMatch = roundName.match(/(\d+)/);
  if (numMatch) return Number(numMatch[0]);
  for (const key of ROUND_ORDER_KEYS) {
    if (roundName.includes(key)) return ROUND_ORDER_MAP[key];
  }
  return 0;
}

const EMPTY_UNSUPPORTED: ResultCoverage = {
  status: 'unsupported',
  totalKnockoutMatches: 0,
  decidedKnockoutMatches: 0,
  progressRatio: null,
  deepestDecidedRoundLabel: null,
  aliveEntries: 0,
  abandonedAfterRound: null,
  firstUndecidedRoundLabel: null,
};

/**
 * @param abandonment 打ち切り情報（information の categories[] 由来。lib/tournamentAbandonment.ts）。
 *   **detailData から導出できないので明示的に渡す**必要がある。理由: 打ち切り大会の detail は
 *   読み出し時点で ongoing が確定成績へ解決済みのため、aliveEntries が 0 になり
 *   completed と区別が付かないため。
 */
export function computeResultCoverage(
  detailData: CoverageDetailDataInput | null | undefined,
  abandonment?: { abandonedAfterRound: string } | null,
): ResultCoverage {
  const matches = detailData?.matches ?? [];
  const results = detailData?.results ?? [];

  const knockoutMatches = matches.filter((m) => m?.stage === 'knockout');
  if (knockoutMatches.length === 0) {
    return EMPTY_UNSUPPORTED;
  }

  const decided = knockoutMatches.filter((m) => isDecided(m));
  const totalKnockoutMatches = knockoutMatches.length;
  const decidedKnockoutMatches = decided.length;
  const progressRatio = totalKnockoutMatches > 0 ? decidedKnockoutMatches / totalKnockoutMatches : null;

  let deepestDecidedRoundLabel: string | null = null;
  let bestOrder = -Infinity;
  for (const m of decided) {
    const order = roundOrderOf(m.round);
    if (order > bestOrder) {
      bestOrder = order;
      deepestDecidedRoundLabel = m.round ?? null;
    }
  }

  // 未確定試合のうち最も浅いラウンド（＝打ち切りなら「実施されなかった最初のラウンド」）。
  let firstUndecidedRoundLabel: string | null = null;
  let shallowestOrder = Infinity;
  for (const m of knockoutMatches) {
    if (isDecided(m)) continue;
    const order = roundOrderOf(m.round);
    if (order < shallowestOrder) {
      shallowestOrder = order;
      firstUndecidedRoundLabel = m.round ?? null;
    }
  }

  const aliveEntries = results.filter((r) => r?.tournament?.rank?.kind === 'ongoing').length;

  let status: ResultCoverageStatus;
  if (abandonment) {
    // 打ち切りは最優先。「これから更新される」と誤解させないため、
    // 未実施試合が残っていても in_progress にはしない。
    status = 'abandoned';
  } else if (results.length === 0) {
    // results 自体が無い（＝正規化パイプライン未実行等）。決勝T試合は存在するので
    // unsupported ではなく「反映前」として扱う。
    status = 'not_recorded';
  } else if (aliveEntries > 0) {
    status = decidedKnockoutMatches === 0 ? 'not_recorded' : 'in_progress';
  } else {
    status = 'completed';
  }

  return {
    status,
    totalKnockoutMatches,
    decidedKnockoutMatches,
    progressRatio,
    deepestDecidedRoundLabel,
    aliveEntries,
    abandonedAfterRound: abandonment?.abandonedAfterRound ?? null,
    firstUndecidedRoundLabel,
  };
}

/**
 * ページ本文（H1直下）に出す1行の文言。completed/unsupported は呼び出し側で非表示にする想定。
 *
 * 打ち切り文言では**理由に一切言及しない**（「荒天のため」等を書かない）。
 * 理由を断定できる典拠が無く、不正確な情報を出さないため。
 * 詳細: docs/raw/2026-07-26-abandoned-tournament-ui-design.md
 */
export function formatResultCoverageBodyText(coverage: ResultCoverage): string | null {
  if (coverage.status === 'abandoned') {
    const lastRound = coverage.abandonedAfterRound ?? coverage.deepestDecidedRoundLabel;
    const nextRound = coverage.firstUndecidedRoundLabel;
    if (lastRound && nextRound) {
      return `この大会は${lastRound}までで打ち切りとなり、${nextRound}以降は実施されませんでした。掲載している結果が最終結果です。`;
    }
    if (lastRound) {
      return `この大会は${lastRound}までで打ち切りとなりました。掲載している結果が最終結果です。`;
    }
    return 'この大会は途中で打ち切りとなりました。掲載している結果が最終結果です。';
  }
  if (coverage.status === 'not_recorded') {
    return `組み合わせを掲載しています。結果はこれから随時反映予定です(全${coverage.totalKnockoutMatches}試合)。`;
  }
  if (coverage.status === 'in_progress') {
    const percent = coverage.progressRatio !== null ? Math.round(coverage.progressRatio * 100) : null;
    const roundLabel = coverage.deepestDecidedRoundLabel ?? '一部';
    const percentText = percent !== null ? `・${percent}%` : '';
    return `現在の反映状況: ${roundLabel}まで結果掲載中(全${coverage.totalKnockoutMatches}試合中${coverage.decidedKnockoutMatches}試合終了${percentText})。`;
  }
  return null;
}

/** meta description に追記する短い一文（末尾に付け足す用途）。completed/unsupported は null。 */
export function formatResultCoverageMetaSuffix(coverage: ResultCoverage): string | null {
  if (coverage.status === 'abandoned') {
    const lastRound = coverage.abandonedAfterRound ?? coverage.deepestDecidedRoundLabel;
    return lastRound ? `${lastRound}までで打ち切り・これが最終結果。` : '途中で打ち切り・これが最終結果。';
  }
  if (coverage.status === 'not_recorded') {
    return '組み合わせ掲載・結果は今後反映予定。';
  }
  if (coverage.status === 'in_progress') {
    const roundLabel = coverage.deepestDecidedRoundLabel ?? '一部';
    return `現在${roundLabel}まで結果反映中。`;
  }
  return null;
}
