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
//  - 実装済み（2026-07-30、P1）: perfect-title（無敗優勝） / nth-title の「◯年ぶり」拡張
//    → docs/raw/2026-07-11-giant-killing-milestone-plan.md のB系統。P0頻度検証（全307
//      エディション横断）で perfect-title 3.3%・title-streak-gap相当（nth-titleの再優勝
//      ギャップ） 2.9% を確認し、想定どおりの希少性のため採用。
//      perfect-title は matches[].scores（個人戦=ゲーム数、団体戦=団体内個人戦勝利数。
//      同一ロジックで両方判定可能）で当年データのみから決定的に判定できる（confirmed）。
//      「title-streak-gap」は当初 milestone-logic.md で新規 kind として構想されていたが、
//      実装済みの nth-title が既に同じトリガー条件（過去に優勝歴があり連覇ではない）で
//      発火するため、別kindを新設せず nth-title のラベルに年数ギャップを追加する形で
//      吸収した（同一事象への二重イベント発行を避けるため）。
//    → 見送り: first-region（大会史上初の地域）。掲載年数が薄く「連覇でない優勝」と
//      ほぼ同義になり希少性が無いこと、team/participant の `prefecture` フィールドに
//      「日本学連」等の非都道府県値が混入することを P0 で確認したため、当面実装しない。
//  - 未実装（pending）: best4-first / career-wins / first-appearance
//    → Step1 の placements 拡張（ベスト4）や analysis.json との突合（playerId 名寄せ）が
//      必要。名寄せ精度の検証が済むまで出さない（誤った節目表示は信頼を損なうため）。
//      MilestoneEvent 構造はこれらを後から足せるよう汎用にしている。

import { getUpsets } from './ratingsUpsets';
import {
  buildParticipantMap,
  championKey,
  getHistoricalWinners,
  readYearDetail,
  resolveEntryToChampion,
  type ChampionEntry,
  type HistoricalWinnersBlock,
  type RepeatChampion,
} from './tournamentRecords';
import { getCategoryLabel } from './utils';

export type MilestoneKind =
  | 'first-title' // 初優勝（当サイト収録範囲で）
  | 'repeat-title' // 連覇（2連覇以上）
  | 'perfect-title' // 無敗優勝（優勝までの全試合で相手の獲得数0。2026-07-30）
  | 'nth-title' // n回目の優勝（連覇でも初優勝でもない複数回優勝。「◯年ぶり」ギャップ情報を含む）
  | 'first-appearance' // 初出場（pending）
  | 'champion-defeat' // 王者撃破（pending）
  | 'giant-killing' // 金星（実力指標で格上を破る。data/ratings/upsets.json 由来、2026-07-11）
  | 'career-wins' // 通算N勝の節目（pending）
  | 'best4-first'; // ベスト4初進出（pending）

/**
 * confirmed: 同一大会内の対戦・連続年など、掲載範囲でも決定的に確定する事実。
 * scope-limited: 「初」「通算」など当サイト収録範囲に依存する事実（描画側で要注記）。
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
  /**
   * 大会結果ページ用のラベル（例:「船水颯人 2連覇（2025年〜）」）。
   * そのページ自体が既に種目・性別（例:「女子ダブルス」）を見出しで示しているため、
   * label/shortLabel と異なり種目名を前置しない。バッジの種別タグ（連覇/初優勝など）
   * と重複しないよう、language もタグに頼れる範囲は簡潔にする。
   */
  resultLabel: string;
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

const SCOPE_NOTE = '当サイト収録大会分の集計に基づきます。';

/** 重要度（小さいほど上位）。並び順 docs/raw/2026-06-21-milestone-logic.md 準拠。 */
const KIND_IMPORTANCE: Record<MilestoneKind, number> = {
  'repeat-title': 0,
  'perfect-title': 1,
  'first-title': 2,
  'nth-title': 3,
  'giant-killing': 4, // champion-defeat と同一試合なら giant-killing を優先（重複抑制は呼び出し側）
  'champion-defeat': 5,
  'career-wins': 6,
  'best4-first': 7,
  'first-appearance': 8,
};

/**
 * categoryId（例: doubles-none-boys）から「性別＋種目」ラベルを作る。
 * 種目（シングルス/ダブルス/団体戦）と性別（男子/女子/混合）を区別して表示するため、
 * information の categoryLabel（「男子一般」など種目が落ちる表記揺れがある）には頼らず
 * categoryId から決定的に組み立てる。連覇/初優勝バッジに前置して種目を区別する。
 */
function genreGenderLabel(categoryId: string): string {
  const parts = categoryId.split('-');
  // categoryId = `${category}-${age}-${gender}`。category はハイフンを含みうる。
  const gender = parts[parts.length - 1];
  const category = parts.slice(0, -2).join('-');
  const genderLabel = gender === 'boys' ? '男子' : gender === 'girls' ? '女子' : gender === 'mixed' ? '混合' : '';
  return `${genderLabel}${getCategoryLabel(category)}`;
}

function subjectOf(c: ChampionEntry): MilestoneEvent['subject'] {
  return {
    players: c.players,
    teams: c.teams,
    display: c.display ?? '',
  };
}

/**
 * perfect-title（無敗優勝）判定。優勝エントリが絡んだ全試合で、相手の獲得数
 * （個人戦=ゲーム数、団体戦=団体戦内の個人戦勝利数。matches[].scores は両者で同じ
 * 「相手の獲得数」の意味を持つため同一ロジックで判定できる）が0だったかを見る。
 *
 * - 対象年の詳細データが無い／優勝エントリを特定できない／試合が1件も無い
 *   （bye続き等）→ null（判定不能。呼び出し側はイベントを出さない）。
 * - 1試合でも敗退・0以外の失点があれば false。
 *
 * P0頻度検証（2026-07-30、docs/raw/2026-07-11-giant-killing-milestone-plan.md）で
 * 全307エディション中10件（約3.3%）の頻度・棄権絡み0件を確認済み。
 */
function isPerfectTitle(tournamentId: string, categoryId: string, targetYear: number, targetChampionKey: string | null): boolean | null {
  if (!targetChampionKey) return null;
  const detail = readYearDetail(tournamentId, targetYear, categoryId);
  if (!detail) return null;
  const participantById = buildParticipantMap(detail);

  let championEntryNo: number | null = null;
  for (const e of detail.entries ?? []) {
    const ce = resolveEntryToChampion(e, participantById, targetYear);
    if (championKey(ce) === targetChampionKey) {
      championEntryNo = e.entryNo;
      break;
    }
  }
  if (championEntryNo == null) return null;

  const champMatches = (detail.matches ?? []).filter((m) => Array.isArray(m.entries) && m.entries.includes(championEntryNo as number));
  if (champMatches.length === 0) return null;

  for (const m of champMatches) {
    if (m.winnerEntryNo !== championEntryNo) return false;
    const opponentEntryNo = m.entries?.find((e) => e !== championEntryNo);
    const opponentScore = opponentEntryNo != null ? m.scores?.[String(opponentEntryNo)] : undefined;
    if (typeof opponentScore !== 'number' || opponentScore !== 0) return false;
  }
  return true;
}

/**
 * ある年の優勝者に「その選手本人」が含まれるかを判定する（個人戦用）。
 *
 * playerKey は「名前@所属」のため、進学・移籍で所属が変わると年度をまたいだ照合が
 * 外れる（例: zennihon-mixed 2025 天間麗奈@東北 → 2026 天間麗奈@日本体育大学）。
 * そのため playerKeys 一致に加えて players（フルネーム）でも突合する。
 *
 * この関数を連覇（repeat-title）判定と first/nth-title 判定の**両方**で使うこと。
 * 片方だけが名前フォールバックを持つと、所属変更時に「連覇なのに nth-title」という
 * 矛盾したラベル（例:「1年ぶり2回目の優勝」＝ギャップ1年、定義上それは連覇）が出る。
 * 2026-09-05 の不具合はこの不整合が原因（docs/raw/2026-09-05-repeat-title-team-change.md）。
 *
 * 残リスク: 同一種目の優勝者に同姓同名の別人がいると誤って同一人物とみなす。
 * 対象が「その大会・種目の歴代優勝者」という極めて狭い集合であること、および
 * 既に first/nth-title が同じ割り切りで運用されていることから許容する。
 */
function championIncludesPlayer(c: ChampionEntry, key: string, name: string): boolean {
  return c.playerKeys.includes(key) || c.players.includes(name);
}

/**
 * 選手個人の連覇情報を返す。ペアが替わっても、その選手が連続開催で
 * 優勝していれば連覇とみなす（ダブルスを「選手個人」軸で判定するための関数）。
 * 対象年にその選手が優勝者に含まれない場合は null。
 */
function computePlayerStreak(championsDesc: ChampionEntry[], targetYear: number, key: string, name: string): RepeatChampion | null {
  const asc = championsDesc.slice().sort((a, b) => a.year - b.year);
  const idx = asc.findIndex((c) => c.year === targetYear);
  if (idx < 0) return null;
  if (!championIncludesPlayer(asc[idx], key, name)) return null;

  let streak = 1;
  let since = asc[idx].year;
  for (let i = idx - 1; i >= 0; i--) {
    // 連続する開催年であることも条件にする（隔年・欠落は連覇を切る）
    if (asc[i + 1].year - asc[i].year !== 1) break;
    if (!championIncludesPlayer(asc[i], key, name)) break;
    streak += 1;
    since = asc[i].year;
  }
  return streak >= 2 ? { streak, since } : null;
}

/**
 * 個人戦（シングルス/ダブルス）の repeat-title / first-title を「選手個人」単位で
 * 抽出する。ダブルスでも各選手をそれぞれ主役にし、パートナーが替わっても本人の
 * 連続優勝を連覇、本人が掲載範囲で初優勝なら初優勝として 1 選手 1 イベントを返す。
 */
function buildIndividualMilestones(
  block: HistoricalWinnersBlock,
  target: ChampionEntry,
  targetYear: number,
  tournamentId: string,
  categoryId: string,
  targetChampionKey: string | null,
): MilestoneEvent[] {
  const events: MilestoneEvent[] = [];
  // 種目（性別＋シングルス/ダブルス/団体）を区別するためのラベル前置。
  const cat = genreGenderLabel(categoryId);
  // 「優勝者が判明している」過去の収録年のみ「初」の反証に使える
  const priorKnownYears = block.champions.filter((c) => c.year < targetYear && c.display);
  // perfect-title はペア単位の判定（両選手で共通）のため、選手ループの外で1回だけ判定する。
  const perfect = isPerfectTitle(tournamentId, categoryId, targetYear, targetChampionKey);

  target.players.forEach((name, i) => {
    const key = target.playerKeys[i];
    if (!key) return;
    const subject: MilestoneEvent['subject'] = {
      players: [name],
      teams: target.teams,
      display: name,
    };

    // --- perfect-title（無敗優勝）: 連覇/初優勝/n回目とは独立に判定（confirmed） ---
    if (perfect) {
      const shortLabel = `${cat}無敗優勝`;
      events.push({
        kind: 'perfect-title',
        subject,
        tournamentId,
        categoryId,
        year: targetYear,
        detail: {},
        confidence: 'confirmed',
        label: `${name} ${shortLabel}`,
        shortLabel,
        resultLabel: `${name} 無敗優勝`,
      });
    }

    // --- repeat-title（連覇）: 本人の連続優勝（confirmed） ---
    const streak = computePlayerStreak(block.champions, targetYear, key, name);
    if (streak) {
      const streakLabel = `${streak.streak}連覇`;
      const shortLabel = `${cat}${streakLabel}（${streak.since}年〜）`;
      events.push({
        kind: 'repeat-title',
        subject,
        tournamentId,
        categoryId,
        year: targetYear,
        detail: { streak: streak.streak, since: streak.since },
        confidence: 'confirmed',
        label: `${name} ${shortLabel}`,
        shortLabel,
        resultLabel: `${name} ${streakLabel}（${streak.since}年〜）`,
      });
      return; // 連覇のときは初優勝ではない
    }

    // --- first-title / nth-title ---
    // 照合は連覇判定と同じ championIncludesPlayer を使う（所属変更フォールバック込み）。
    if (priorKnownYears.length > 0) {
      const priorWins = priorKnownYears.filter((c) => championIncludesPlayer(c, key, name));
      if (priorWins.length === 0) {
        // first-title（初優勝）: 掲載範囲の過去年に優勝歴がない（scope-limited）
        events.push({
          kind: 'first-title',
          subject,
          tournamentId,
          categoryId,
          year: targetYear,
          detail: { coveredSince: block.sourceYears[0] },
          confidence: 'scope-limited',
          label: `${name} ${cat}初優勝`,
          shortLabel: `${cat}初優勝`,
          resultLabel: `${name} 初優勝`,
          scopeNote: SCOPE_NOTE,
        });
      } else {
        // nth-title（n回目の優勝）: 連覇ではないが過去に優勝実績あり（scope-limited）。
        // 直近の優勝年からのギャップ（「◯年ぶり」）を添える（2026-07-30、P0検証で
        // 採用したtitle-streak-gapを、別kindを新設せずここに統合）。
        const n = priorWins.length + 1;
        const previousTitleYear = Math.max(...priorWins.map((c) => c.year));
        const gapYears = targetYear - previousTitleYear;
        const shortLabel = `${cat}${gapYears}年ぶり${n}回目の優勝`;
        events.push({
          kind: 'nth-title',
          subject,
          tournamentId,
          categoryId,
          year: targetYear,
          detail: { n, coveredSince: block.sourceYears[0], gapYears, previousTitleYear },
          confidence: 'scope-limited',
          label: `${name} ${shortLabel}`,
          shortLabel,
          resultLabel: `${name} ${gapYears}年ぶり${n}回目の優勝`,
          scopeNote: SCOPE_NOTE,
        });
      }
    }
  });

  return events;
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
  const block: HistoricalWinnersBlock | null = precomputed ?? getHistoricalWinners(tournamentId, categoryId, { targetYear });
  if (!block) return null;

  const target = block.champions.find((c) => c.year === targetYear);
  if (!target || !target.display) return null;
  const targetKey = championKey(target);
  if (!targetKey) return null;

  let events: MilestoneEvent[] = [];

  if (target.players.length > 0) {
    // --- 個人戦（シングルス/ダブルス）: 「選手個人」単位で判定する ---
    // ダブルスはペア単位ではなく各選手をそれぞれ主役にし、パートナーが替わっても
    // 本人の連続優勝を連覇・本人の掲載範囲初優勝を初優勝として 1 選手 1 イベント出す。
    events = buildIndividualMilestones(block, target, targetYear, tournamentId, categoryId, targetKey);
  } else {
    // --- 団体戦: 校（championKey）単位で判定する（従来どおり） ---
    const subject = subjectOf(target);
    const cat = genreGenderLabel(categoryId);

    // perfect-title（無敗優勝）: 連覇/初優勝/n回目とは独立に判定（confirmed）
    if (isPerfectTitle(tournamentId, categoryId, targetYear, targetKey)) {
      const shortLabel = `${cat}無敗優勝`;
      events.push({
        kind: 'perfect-title',
        subject,
        tournamentId,
        categoryId,
        year: targetYear,
        detail: {},
        confidence: 'confirmed',
        label: `${subject.display} ${shortLabel}`,
        shortLabel,
        resultLabel: `${subject.display} 無敗優勝`,
      });
    }

    // repeat-title（連覇）: Step1 の連覇判定をそのまま使う（confirmed）
    const repeat: RepeatChampion | null = block.edition.repeatChampion;
    if (repeat && repeat.streak >= 2) {
      const streakLabel = `${repeat.streak}連覇`;
      const shortLabel = `${cat}${streakLabel}（${repeat.since}年〜）`;
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
        resultLabel: `${subject.display} ${streakLabel}（${repeat.since}年〜）`,
      });
    }

    // first-title / nth-title: 連覇でないとき過去優勝歴で分岐。
    // 優勝者不明年（display=null）は反証にならないため除外する。
    const priorKnownYears = block.champions.filter((c) => c.year < targetYear && c.display);
    if (!repeat && priorKnownYears.length > 0) {
      const priorWins = priorKnownYears.filter((c) => championKey(c) === targetKey);
      if (priorWins.length === 0) {
        // first-title（初優勝）
        events.push({
          kind: 'first-title',
          subject,
          tournamentId,
          categoryId,
          year: targetYear,
          detail: { coveredSince: block.sourceYears[0] },
          confidence: 'scope-limited',
          label: `${subject.display} ${cat}初優勝`,
          shortLabel: `${cat}初優勝`,
          resultLabel: `${subject.display} 初優勝`,
          scopeNote: SCOPE_NOTE,
        });
      } else {
        // nth-title（n回目の優勝）。直近優勝年からのギャップ（「◯年ぶり」）を添える
        // （2026-07-30、別kind新設せず title-streak-gap をここに統合。個人戦側と同じ扱い）。
        const n = priorWins.length + 1;
        const previousTitleYear = Math.max(...priorWins.map((c) => c.year));
        const gapYears = targetYear - previousTitleYear;
        const shortLabel = `${cat}${gapYears}年ぶり${n}回目の優勝`;
        events.push({
          kind: 'nth-title',
          subject,
          tournamentId,
          categoryId,
          year: targetYear,
          detail: { n, coveredSince: block.sourceYears[0], gapYears, previousTitleYear },
          confidence: 'scope-limited',
          label: `${subject.display} ${shortLabel}`,
          shortLabel,
          resultLabel: `${subject.display} ${gapYears}年ぶり${n}回目の優勝`,
          scopeNote: SCOPE_NOTE,
        });
      }
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

const DEFEAT_SCOPE_NOTE = '前回優勝は当サイト収録大会分の判定に基づきます。';

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
  const block: HistoricalWinnersBlock | null = precomputed ?? getHistoricalWinners(tournamentId, categoryId, { targetYear });
  if (!block) return null;

  // 前回（対象年より前で直近の優勝者が判明している開催）の王者を特定する。
  const prior = block.champions.filter((c) => c.year < targetYear && c.display).sort((a, b) => b.year - a.year)[0];
  if (!prior) return null;
  const priorKey = championKey(prior);
  if (!priorKey) return null;

  // 当年の生 detail（matches を含む）を読む。
  const detail = readYearDetail(tournamentId, targetYear, categoryId);
  if (!detail) return null;
  const participantById = buildParticipantMap(detail);
  const entryByNo = new Map((detail.entries ?? []).map((e) => [e.entryNo, e] as const));

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
      Array.isArray(m.entries) && m.entries.includes(championEntryNo as number) && typeof m.winnerEntryNo === 'number' && m.winnerEntryNo !== championEntryNo,
  );
  // 敗退していない（連覇など） → null。
  if (defeats.length === 0) return null;

  // knockout の敗戦を優先（リーグの複数敗戦による曖昧さを避ける）。無ければ先頭。
  const defeat = defeats.find((m) => (m.stage ?? 'knockout') !== 'roundrobin') ?? defeats[0];
  const winnerEntry = typeof defeat.winnerEntryNo === 'number' ? entryByNo.get(defeat.winnerEntryNo) : undefined;
  if (!winnerEntry) return null;

  const winner = resolveEntryToChampion(winnerEntry, participantById, targetYear);
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
    resultLabel: `${subject.display} が${shortLabel}${round ? `（${round}）` : ''}`,
    scopeNote: DEFEAT_SCOPE_NOTE,
  };
}

const UPSET_SCOPE_NOTE = '「格上」は当サイト収録大会分から算出した実力指標による判定です。';

/**
 * giant-killing（金星）イベントを抽出する（2026-07-11、P4）。
 *
 * データ源は `data/ratings/upsets.json`（scripts/ranking/generate-ratings.mjs が時系列Elo再生の
 * 事前レートで判定・生成。勝者の期待勝率が閾値以下の勝利、両者 established 限定）。
 * 表示は数字なしの定性表現のみ（レート・期待勝率は非公開。2026-07-11決定）。
 *
 * - 試合の勝敗は確定事実だが、「格上」認定は内部実力指標に依存するため scopeNote を添える。
 * - champion-defeat と同一試合（勝者が同じ）の場合は giant-killing を優先し、呼び出し側で
 *   champion-defeat を抑制する（suppressChampionDefeatIfDuplicate を使う）。
 */
export function getGiantKillings(tournamentId: string, categoryId: string, targetYear: number): MilestoneEvent[] {
  const upsets = getUpsets(tournamentId, categoryId, targetYear);
  return upsets.map((u) => {
    const winnerNames = u.winners.map((w) => w.name);
    const display = winnerNames.join('・');
    const beaten = u.losers.map((l) => l.name).join('・');
    const round = u.round ?? '';
    const shortLabel = `格上の ${beaten} を破る金星`;
    return {
      kind: 'giant-killing' as const,
      subject: { players: winnerNames, teams: [], display },
      tournamentId,
      categoryId,
      year: targetYear,
      detail: { beaten, ...(round ? { round } : {}) },
      confidence: 'confirmed' as const,
      label: `${display} が${shortLabel}${round ? `（${round}）` : ''}`,
      shortLabel,
      resultLabel: `${display} が${shortLabel}${round ? `（${round}）` : ''}`,
      scopeNote: UPSET_SCOPE_NOTE,
    };
  });
}

/**
 * champion-defeat が giant-killing と同一試合（勝者の選手名集合が一致）の場合に
 * champion-defeat を落とす重複抑制。前回王者は多くの場合レート上位でもあるため、
 * 同じ勝利が「王者撃破」と「金星」で二重表示されるのを防ぐ（giant-killing を優先）。
 */
export function suppressChampionDefeatIfDuplicate(defeat: MilestoneEvent | null, giantKillings: MilestoneEvent[]): MilestoneEvent | null {
  if (!defeat) return null;
  const defeatWinners = new Set(defeat.subject.players);
  const dup = giantKillings.some((g) => g.subject.players.length === defeatWinners.size && g.subject.players.every((p) => defeatWinners.has(p)));
  return dup ? null : defeat;
}
