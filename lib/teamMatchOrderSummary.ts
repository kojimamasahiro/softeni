// lib/teamMatchOrderSummary.ts
//
// 団体戦のオーダー（ADR-020）を「文章で答えられる形」に畳む。
//
// 用途は年度別結果ページの FAQ（docs/wiki/seo.md）。X で繰り返される問いが
// 「決勝のオーダーは？」「第1対戦は誰と誰？」（docs/raw/2026-09-17-x-posts-user-problem-findings.md）で、
// サイト側は対戦詳細の表で答えているが、**「オーダー」という語が1回も出ていなかった**。
// 表はそのままに、決勝のオーダーを1文にした答えをページと FAQPage の両方に出す。
//
// ここは詰め替えた `TournamentDetailData` の上だけで動く純関数（fs を使わない）。
// 表示の向き・文言の規則は src/components/Tournament/MatchResults.tsx と揃えること。

import type { TeamMatchDetail, TeamMatchPlayer, TournamentDetailData, TournamentMatch } from '@/types/tournament';

export interface TeamMatchOrderRubber {
  /** 「第1対戦」など。元資料の `type`（D1/S 等）ではなく実施順で数える（表と同じ） */
  label: string;
  sideA: string;
  sideB: string;
  /** 「4-2」。行われていない対戦（未実施・不戦勝）は null */
  score: string | null;
  /** 「未実施」「不戦勝」「打ち切り」「棄権」。通常の決着では null */
  note: string | null;
}

export interface TeamMatchOrderSummary {
  /** オーダーを持つ試合数 */
  matchCount: number;
  /** オーダーを持つ対戦（第N対戦）の数 */
  rubberCount: number;
  /** ゲームごとのポイントを持つ対戦があるか */
  hasGames: boolean;
  /** 決勝（無ければ null）。ラウンド名が「決勝」の試合だけを指す */
  final: {
    teamA: string;
    teamB: string;
    /** 学校対学校の本数。「2-1」 */
    score: string | null;
    rubbers: TeamMatchOrderRubber[];
  } | null;
}

/** 「姓 名」。名前だけの選手はその文字列のまま（表示の規則は MatchResults.tsx と同じ） */
function playerName(p: TeamMatchPlayer): string {
  if ('name' in p) return p.name.trim();
  return `${p.lastName}${p.firstName ? ` ${p.firstName}` : ''}`;
}

function sideName(players: TeamMatchPlayer[]): string {
  // walkover でペアを出さなかった側。表と同じ言葉にする
  if (players.length === 0) return '出場なし';
  return players.map(playerName).join('・');
}

function rubberOf(sub: TeamMatchDetail, order: number): TeamMatchOrderRubber {
  const label = `第${order}対戦`;
  const sideA = sideName(sub.playersA);
  const sideB = sideName(sub.playersB);
  const score = sub.scoreA !== null && sub.scoreB !== null ? `${sub.scoreA}-${sub.scoreB}` : null;

  switch (sub.status) {
    case 'not_played':
      return { label, sideA, sideB, score: null, note: '未実施' };
    case 'walkover':
      return { label, sideA, sideB, score: null, note: '不戦勝' };
    case 'unfinished':
      return { label, sideA, sideB, score, note: '打ち切り' };
    case 'retired':
      return { label, sideA, sideB, score, note: '棄権' };
    default:
      return { label, sideA, sideB, score, note: null };
  }
}

/** 団体戦のエントリーの表示名。`playerIds` は `校名_都道府県` の1件で、participants から引く */
function entryName(detail: TournamentDetailData, entryNo: number | undefined): string | null {
  if (entryNo === undefined) return null;
  const entry = (detail.entries ?? []).find((e) => e.entryNo === entryNo);
  const participantId = (entry?.playerIds ?? [])[0];
  if (!participantId) return null;
  const participant = (detail.participants ?? []).find((p) => p.id === participantId);
  return participant?.team ?? null;
}

/**
 * オーダーの収録状況と決勝のオーダー。**1件も持たない種目では null**
 * （個人戦のページや、記録が公開されていない大会では何も出さないため）。
 */
export function buildTeamMatchOrderSummary(detail: TournamentDetailData | null): TeamMatchOrderSummary | null {
  if (!detail) return null;
  const withRubbers = (detail.matches ?? []).filter((m): m is TournamentMatch & { matches: TeamMatchDetail[] } => (m.matches?.length ?? 0) > 0);
  if (withRubbers.length === 0) return null;

  const rubberCount = withRubbers.reduce((sum, m) => sum + m.matches.length, 0);
  const hasGames = withRubbers.some((m) => m.matches.some((sub) => (sub.games?.length ?? 0) > 0));

  // 決勝は元資料のラウンド名で引く。持たない大会（予選リーグだけの年など）では final は null
  const finalMatch = withRubbers.find((m) => m.round === '決勝') ?? null;
  let final: TeamMatchOrderSummary['final'] = null;
  if (finalMatch) {
    const teamA = entryName(detail, finalMatch.entries?.[0]);
    const teamB = entryName(detail, finalMatch.entries?.[1]);
    if (teamA && teamB) {
      const scoreA = finalMatch.scores?.[String(finalMatch.entries[0])];
      const scoreB = finalMatch.scores?.[String(finalMatch.entries[1])];
      final = {
        teamA,
        teamB,
        score: typeof scoreA === 'number' && typeof scoreB === 'number' ? `${scoreA}-${scoreB}` : null,
        rubbers: finalMatch.matches.map((sub, i) => rubberOf(sub, i + 1)),
      };
    }
  }

  return { matchCount: withRubbers.length, rubberCount, hasGames, final };
}

/** 決勝のオーダーを1文にする。FAQ の答えとページ本文で同じ文字列を使う */
export function describeFinalOrder(summary: TeamMatchOrderSummary): string | null {
  if (!summary.final) return null;
  const { teamA, teamB, score, rubbers } = summary.final;
  const head = `決勝は${teamA}対${teamB}${score ? `（${score}）` : ''}です。`;
  const body = rubbers
    .map((r) => {
      if (r.note === '未実施') return `${r.label}は${r.sideA}対${r.sideB}で未実施`;
      if (r.note === '不戦勝') return `${r.label}は${r.sideA}対${r.sideB}で不戦勝`;
      const tail = r.note ? `（${r.score}・${r.note}）` : `（${r.score}）`;
      return `${r.label}は${r.sideA}対${r.sideB}${tail}`;
    })
    .join('、');
  return `${head}${body}。`;
}
