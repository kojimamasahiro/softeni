// lib/milestones.ts
// 文脈ブロック「milestone」生成。ADR-005 の「イベント抽出」レイヤの最初の具体例。
// 大会データから「意味のある出来事」を構造化イベントとして抽出する。
// 文章は生成せず、描画用の素文（label）と構造化 detail を返す。
//
// 設計: docs/raw/2026-06-21-milestone-logic.md / ADR-005。
//
// 実装スコープ（段階導入）:
//  - 実装済み: repeat-title（連覇） / first-title（初優勝） / champion-defeat（王者撃破）
//    → いずれも Step1（lib/tournamentRecords.ts）の優勝者データ＋当年の試合（matches）から
//      決定的に導ける。championKey による所属＋名前比較で判定するため playerId 名寄せに
//      依存せず、誤判定リスクが低い。champion-defeat は前回王者が当年に出場し試合で敗退した
//      場合のみ検出する（不出場は出さない）。
//  - 未実装（pending）: best4-first / career-wins / first-appearance
//    → Step1 の placements 拡張（ベスト4）や analysis.json との突合（playerId 名寄せ）が
//      必要。名寄せ精度の検証が済むまで出さない（誤った節目表示は信頼を損なうため）。
//      MilestoneEvent 構造はこれらを後から足せるよう汎用にしている。

import {
  buildParticipantMap,
  championKey,
  getHistoricalWinners,
  readYearDetail,
  resolveEntryToChampion,
  type ChampionEntry,
  type HistoricalWinnersBlock,
} from './tournamentRecords';

export type MilestoneKind =
  | 'first-title' // 初優勝（当サイト掲載範囲で）
  | 'repeat-title' // 連覇（2連覇以上）
  | 'first-appearance' // 初出場（pending）
  | 'champion-defeat' // 王者撃破（pending）
  | 'career-wins' // 通算N勝の節目（pending）
  | 'best4-first'; // ベスト4初進出（pending）

/**
 * confirmed: 同一大会内の対戦・連続年など、掲載範囲でも決定的に確定する事実。
 * scope-limited: 「初」「通算」など当サイト掲載範囲に依存する事実（描画側で要注記）。
 */
export type MilestoneConfidence = 'confirmed' | 'scope-limited';

export type MilestoneEvent = {
  kind: MilestoneKind;
  subject: { players: string[]; teams: string[]; display: string };
  tournamentId: string;
  categoryId: string;
  year: number;
  detail: Record<string, string | number>;
  confidence: MilestoneConfidence;
  /** 描画用の素文（テンプレ。自然文生成はしない）。主役名を含む（例:「船水颯人 初優勝」） */
  label: string;
  /**
   * label から主役名を除いた核（例:「初優勝」「3連覇（2021年〜）」）。
   * 大会名など別の文脈を前置したい呼び出し側（選手ページ等）が使う。
   */
  shortLabel: string;
  /** scope-limited のとき描画側で添える注記 */
  scopeNote?: string;
};

export type MilestoneBlock = {
  blockType: 'milestone';
  tournamentId: string;
  categoryId: string;
  year: number;
  /** 重要度降順 */
  events: MilestoneEvent[];
};

const SCOPE_NOTE = '当サイト掲載大会分の集計に基づく';

/** 重要度（小さいほど上位）。並び順 docs/raw/2026-06-21-milestone-logic.md 準拠。 */
const KIND_IMPORTANCE: Record<MilestoneKind, number> = {
  'repeat-title': 0,
  'first-title': 1,
  'champion-defeat': 2,
  'career-wins': 3,
  'best4-first': 4,
  'first-appearance': 5,
};

function subjectOf(c: ChampionEntry): MilestoneEvent['subject'] {
  return {
    players: c.players,
    teams: c.teams,
    display: c.display ?? '',
  };
}

/**
 * 対象年の優勝者（主役）について milestone イベントを抽出する。
 * 優勝者を特定できない／対象年が無い場合は null。
 */
export function getChampionMilestones(
  tournamentId: string,
  categoryId: string,
  targetYear: number,
  precomputed?: HistoricalWinnersBlock | null,
): MilestoneBlock | null {
  // 呼び出し側が同じ条件の historical-winners を既に持っている場合は再利用し、
  // 同一データの二重走査（全年 detail 読み込み）を避ける。
  const block: HistoricalWinnersBlock | null =
    precomputed ??
    getHistoricalWinners(tournamentId, categoryId, { targetYear });
  if (!block) return null;

  const target = block.champions.find((c) => c.year === targetYear);
  if (!target || !target.display) return null;
  const targetKey = championKey(target);
  if (!targetKey) return null;

  const events: MilestoneEvent[] = [];
  const subject = subjectOf(target);

  // --- repeat-title（連覇）: Step1 の連覇判定をそのまま使う（confirmed） ---
  const repeat = block.edition.repeatChampion;
  if (repeat && repeat.streak >= 2) {
    const streakLabel =
      repeat.streak >= 3 ? `${repeat.streak}連覇` : '連覇（2連覇）';
    const shortLabel = `${streakLabel}（${repeat.since}年〜）`;
    events.push({
      kind: 'repeat-title',
      subject,
      tournamentId,
      categoryId,
      year: targetYear,
      detail: { streak: repeat.streak, since: repeat.since },
      confidence: 'confirmed',
      label: `${subject.display} ${shortLabel}`,
      shortLabel,
    });
  }

  // --- first-title（初優勝）: 掲載範囲の過去年に同一優勝者がいない（scope-limited） ---
  // 連覇のときは初優勝ではないので抑制。
  // 「優勝者が判明している」過去の収録年が存在する場合のみ「初」と言える。
  // 優勝者不明年（display=null）は反証にならない（その年に主役が勝っていた可能性を
  // 排除できない）ため、誤った「初優勝」を出さないよう除外する。
  const priorKnownYears = block.champions.filter(
    (c) => c.year < targetYear && c.display,
  );
  if (!repeat && priorKnownYears.length > 0) {
    const wonBefore = priorKnownYears.some((c) => championKey(c) === targetKey);
    if (!wonBefore) {
      events.push({
        kind: 'first-title',
        subject,
        tournamentId,
        categoryId,
        year: targetYear,
        detail: { coveredSince: block.sourceYears[0] },
        confidence: 'scope-limited',
        label: `${subject.display} 初優勝`,
        shortLabel: '初優勝',
        scopeNote: SCOPE_NOTE,
      });
    }
  }

  // --- pending kinds ---
  // best4-first / career-wins / first-appearance は
  // Step1 placements 拡張・analysis.json 突合（名寄せ）が整うまで出さない。
  // champion-defeat は主役（優勝者）視点ではないため getChampionDefeat に分離している。

  events.sort((a, b) => KIND_IMPORTANCE[a.kind] - KIND_IMPORTANCE[b.kind]);

  return {
    blockType: 'milestone',
    tournamentId,
    categoryId,
    year: targetYear,
    events,
  };
}

const DEFEAT_SCOPE_NOTE = '前回優勝は当サイト掲載大会分の判定に基づく';

/**
 * champion-defeat（王者撃破）イベントを抽出する。
 *
 * 「前回王者」＝対象年より前で直近に優勝者が判明している開催の優勝ペア/校。
 * その前回王者が対象年の大会に出場し、いずれかの試合で敗退している場合に、
 * 撃破した（勝った）エントリを主役（subject）としたイベントを返す。
 *
 * - 前回王者が出場していない → null（ユーザー仕様: 出場して敗退した時のみ表示）。
 * - 前回王者が敗退していない（連覇など） → null。
 * - 試合の勝敗自体は確定（confidence: 'confirmed'）。ただし「前回王者」認定は
 *   掲載範囲に依存するため scopeNote を添える。
 *
 * subject は撃破した側（＝「勝った選手の情報」）。
 */
export function getChampionDefeat(
  tournamentId: string,
  categoryId: string,
  targetYear: number,
  precomputed?: HistoricalWinnersBlock | null,
): MilestoneEvent | null {
  const block: HistoricalWinnersBlock | null =
    precomputed ??
    getHistoricalWinners(tournamentId, categoryId, { targetYear });
  if (!block) return null;

  // 前回（対象年より前で直近の優勝者が判明している開催）の王者を特定する。
  const prior = block.champions
    .filter((c) => c.year < targetYear && c.display)
    .sort((a, b) => b.year - a.year)[0];
  if (!prior) return null;
  const priorKey = championKey(prior);
  if (!priorKey) return null;

  // 当年の生 detail（matches を含む）を読む。
  const detail = readYearDetail(tournamentId, targetYear, categoryId);
  if (!detail) return null;
  const participantById = buildParticipantMap(detail);
  const entryByNo = new Map(
    (detail.entries ?? []).map((e) => [e.entryNo, e] as const),
  );

  // 当年エントリの中から前回王者と一致するものを探す（同所属・同名で比較）。
  let championEntryNo: number | null = null;
  for (const e of detail.entries ?? []) {
    const ce = resolveEntryToChampion(e, participantById, targetYear);
    if (championKey(ce) === priorKey) {
      championEntryNo = e.entryNo;
      break;
    }
  }
  // 出場していない → 出さない。
  if (championEntryNo == null) return null;

  // 前回王者が敗れた試合（負けた試合）を抽出する。
  const defeats = (detail.matches ?? []).filter(
    (m) =>
      Array.isArray(m.entries) &&
      m.entries.includes(championEntryNo as number) &&
      typeof m.winnerEntryNo === 'number' &&
      m.winnerEntryNo !== championEntryNo,
  );
  // 敗退していない（連覇など） → null。
  if (defeats.length === 0) return null;

  // knockout の敗戦を優先（リーグの複数敗戦による曖昧さを避ける）。無ければ先頭。
  const defeat =
    defeats.find((m) => (m.stage ?? 'knockout') !== 'roundrobin') ?? defeats[0];
  const winnerEntry =
    typeof defeat.winnerEntryNo === 'number'
      ? entryByNo.get(defeat.winnerEntryNo)
      : undefined;
  if (!winnerEntry) return null;

  const winner = resolveEntryToChampion(
    winnerEntry,
    participantById,
    targetYear,
  );
  if (!winner.display) return null;

  const round = defeat.round ?? '';
  const subject = subjectOf(winner);
  const beaten = prior.display as string;
  const shortLabel = `前回王者 ${beaten} を破る`;

  return {
    kind: 'champion-defeat',
    subject,
    tournamentId,
    categoryId,
    year: targetYear,
    detail: { beaten, beatenYear: prior.year, round },
    confidence: 'confirmed',
    label: `${subject.display} が${shortLabel}${round ? `（${round}）` : ''}`,
    shortLabel,
    scopeNote: DEFEAT_SCOPE_NOTE,
  };
}
