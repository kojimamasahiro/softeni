// lib/upcomingInternational.ts
//
// 「この選手は、これから開催される国際大会の日本代表予選会に出場している」を導く純関数。
//
// 目的（docs/wiki/upcoming-tournaments-runbook.md S1）:
// 大会ハブや大会一覧に開催前ブロックを置いたのは pull（探しに来た人が見つけられる）まで。
// 選手ページに出すのは **push**——選手を見に来た人へ国際大会を届ける。到達面が
// 予選会出場者ぶんの選手ページになり、大会ハブ1枚＋一覧1枚より桁違いに広い。
//
// 対応付けは大会ハブと同じ **tournamentId の命名規約**（`{本大会ID}-qualifier`）で行い、
// データ側にフィールドを増やさない。本大会が未登録なら何も出ないだけで壊れない
// （検出は `npm run check:upcoming`）。
//
// **代表選手だとは名乗らない。** 予選会はシングルスのみで団体・混合の選考は別経路のため、
// 当サイトのデータから日本代表は導出できない（runbook「やらないと決めたこと」）。
// 出せるのは「予選会に出場した」「本大会がいつどこで開催される」の2つの事実だけ。
//
// fs を触らない純関数にしてあるのは、呼び出し側（選手ページの getStaticProps）が
// 既に読み込んでいる tournamentIndex / informationMap をそのまま渡せるようにするため。

import type { TournamentInformationEntry } from '@/types/tournament';

/** 判定に使う、その選手の大会出場1件ぶん。`PlayerTournament` の必要な部分だけ。 */
export type PlayerTournamentLike = {
  tournamentId?: string;
  year?: number | string;
  /** 例: 優勝 / ベスト8 / 3回戦敗退 / 予選2位 / 不明 */
  finalResult?: string | null;
  link?: string | null;
};

export type UpcomingInternationalLink = {
  mainTournamentId: string;
  /** その年度の大会名（例: 第20回 アジア競技大会） */
  mainLabel: string;
  mainHref: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  /** 主会場の施設名。`venues` が無ければ null */
  venueName: string | null;
  /** 予選会の大会名（例: アジア競技大会日本代表予選会） */
  qualifierLabel: string;
  qualifierYear: number;
  qualifierHref: string | null;
  /** 予選会での成績。判定できなければ null（「出場」とだけ書く） */
  placementLabel: string | null;
  /** すでに会期に入っているか */
  hasStarted: boolean;
};

/**
 * 成績ラベルの強さ。同じ大会が複数カテゴリに分割されている場合
 * （例: アジア競技大会日本代表予選会2025 は 決勝トーナメント / 準決勝リーグ / 決勝リーグ の3つ）
 * に、どれを代表として見せるかを決める。
 *
 * 「予選N位」「不明」より、確定した最終成績（優勝〜N回戦敗退）を優先する。
 * docs/wiki/data-model.md「段階で分割された大会の最終成績」の規約により、
 * 最終成績を持つのは決着したカテゴリだけなので、この優先順で拾えば決着側が選ばれる。
 */
export function placementStrength(label: string | null | undefined): number {
  if (!label) return 0;
  if (label === '優勝') return 1000;
  if (label === '準優勝') return 900;
  if (label === 'ベスト4') return 800;
  if (label === 'ベスト8') return 700;
  const round = /^(\d+)回戦敗退$/.exec(label);
  if (round) return 100 + Number(round[1]);
  const group = /^予選(\d+)位$/.exec(label);
  if (group) return Math.max(1, 50 - Number(group[1]));
  return 0;
}

/** 表示に使える成績かどうか（「不明」や空は出さない）。 */
function displayablePlacement(label: string | null | undefined): string | null {
  if (!label || label === '不明') return null;
  return placementStrength(label) > 0 ? label : null;
}

export function buildUpcomingInternationalLinks(args: {
  playerTournaments: PlayerTournamentLike[];
  tournamentIndex: { tournamentId: string; label: string; generationId: string }[];
  informationMap: Map<string, TournamentInformationEntry[]>;
  /** YYYY-MM-DD。呼び出し側から渡す（テスト可能にするため） */
  today: string;
}): UpcomingInternationalLink[] {
  const { playerTournaments, tournamentIndex, informationMap, today } = args;

  const indexById = new Map(tournamentIndex.map((t) => [t.tournamentId, t]));

  // 本大会ID -> その選手の予選会出場のうち最も強い成績のもの
  const best = new Map<string, { entry: PlayerTournamentLike; qualifierId: string; year: number; strength: number }>();

  for (const pt of playerTournaments) {
    const qualifierId = pt.tournamentId;
    if (!qualifierId || !qualifierId.endsWith('-qualifier')) continue;

    const mainId = qualifierId.replace(/-qualifier$/, '');
    if (!indexById.has(mainId)) continue;

    const year = Number(pt.year);
    if (!Number.isFinite(year)) continue;

    // **今回の本大会に対応する予選会の回**だけを見る。
    // アジア競技大会は4年周期で、`asian-games-qualifier` には2022年度（前回=杭州大会向け）と
    // 2025年度（今回=愛知・名古屋向け）の2回ぶんが入っている。年度を絞らないと、
    // 前回の予選会にしか出ていない選手のページに今回の大会が出てしまい、
    // 「この選手が今回に関係している」という誤った含みが生まれる。
    const edition = resolveQualifierEdition(mainId, qualifierId, informationMap, today);
    if (edition !== null && year !== edition) continue;

    const strength = placementStrength(pt.finalResult);
    const cur = best.get(mainId);
    // 年度が新しいほうを優先し、同年度なら成績が強いほうを採る
    if (cur && (cur.year > year || (cur.year === year && cur.strength >= strength))) continue;
    best.set(mainId, { entry: pt, qualifierId, year, strength });
  }

  const links: UpcomingInternationalLink[] = [];

  for (const [mainId, picked] of best) {
    const mainEntry = indexById.get(mainId);
    if (!mainEntry) continue;

    const upcoming = resolveUpcomingMain(mainId, informationMap, today);
    if (!upcoming) continue;

    const qualifierEntry = indexById.get(picked.qualifierId);
    const venue = (upcoming.venues ?? [])[0];

    links.push({
      mainTournamentId: mainId,
      mainLabel: upcoming.label || mainEntry.label,
      mainHref: `/tournaments/${mainEntry.generationId}/${mainId}/`,
      startDate: upcoming.startDate || null,
      endDate: upcoming.endDate || null,
      location: upcoming.location || null,
      venueName: venue?.name ?? null,
      qualifierLabel: qualifierEntry?.label ?? picked.qualifierId,
      qualifierYear: picked.year,
      qualifierHref: picked.entry.link ?? null,
      placementLabel: displayablePlacement(picked.entry.finalResult),
      hasStarted: Boolean(upcoming.startDate && upcoming.startDate <= today),
    });
  }

  // 会期が近い順
  links.sort((a, b) => String(a.startDate ?? '').localeCompare(String(b.startDate ?? '')));
  return links;
}

/**
 * 本大会の「まだ終わっていない」開催情報を返す。無ければ null。
 * 会期が終われば null になり、ブロックは自動的に消える。
 */
function resolveUpcomingMain(mainId: string, informationMap: Map<string, TournamentInformationEntry[]>, today: string): TournamentInformationEntry | null {
  const infos = informationMap.get(mainId) ?? [];
  return infos.filter((i) => i.endDate && i.endDate >= today).sort((a, b) => String(a.startDate ?? '').localeCompare(String(b.startDate ?? '')))[0] ?? null;
}

/**
 * 「今回の本大会に対応する予選会の回」の年度を返す。
 *
 * 判定は日付だけで行う——本大会の開始日より前に開催された予選会のうち**最も新しい回**。
 * 予選会は本大会の直前サイクルに開かれるので、これで前回大会向けの回と切り分けられる。
 * データ側に「どの大会の予選か」を持たせずに済ませるための割り切りで、
 * 予選会↔本大会を命名規約で結ぶ方針（docs/wiki/public-pages.md）と揃えてある。
 *
 * 予選会側の開催情報が無い場合は `null` を返し、呼び出し側は年度で絞らない
 * （絞る根拠が無いので、出さないより出すほうを選ぶ）。
 */
function resolveQualifierEdition(mainId: string, qualifierId: string, informationMap: Map<string, TournamentInformationEntry[]>, today: string): number | null {
  const main = resolveUpcomingMain(mainId, informationMap, today);
  if (!main?.startDate) return null;

  const editions = (informationMap.get(qualifierId) ?? []).filter((i) => i.startDate && i.startDate < main.startDate!);
  if (editions.length === 0) return null;

  return editions.sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')))[0].year;
}
