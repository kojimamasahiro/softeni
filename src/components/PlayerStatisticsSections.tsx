// src/components/PlayerStatisticsSections.tsx
// Player Statistics Engine（lib/playerStats）由来の新統計セクション群。
// 既存の PlayerSummaryStats（通算・年度別・ペア別）と重複しないものだけを描画する:
//   戦績ハイライト / 年度別ランキング推移 / 大会別成績 / 対戦相手との通算成績（H2H）/
//   所属別成績 / キャリア年表。
// データはすべてビルド時前計算（getStaticProps → facade）。ランタイム集計なし。

import Link from 'next/link';

import PlayerLiteLink from '@/components/PlayerLiteLink';
import type { Head2HeadRow, PlayerStatistics, RankingPoint, TeamRow, TimelineEvent, TournamentRow } from '@/types/playerStatistics';

type Props = {
  stats: PlayerStatistics;
  /** 結果ページが実在する（index.json count>=5）選手 id。デッドリンク防止。 */
  linkablePlayerIds?: number[];
};

const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;

const DISCIPLINE_LABEL: Record<string, string> = {
  singles: 'シングルス',
  doubles: 'ダブルス',
  mixed: 'ミックス',
  team: '団体',
};

const TIMELINE_KIND_LABEL: Record<string, string> = {
  debut: '初出場',
  firstNational: '全国初出場',
  firstTitle: '初優勝',
  'first-title': '初優勝',
  'repeat-title': '連覇',
  'nth-title': '優勝',
  'team-change': '所属',
  'season-best': 'シーズン',
};

function SectionCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-1 text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h3>
      {note && <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{note}</p>}
      {children}
    </div>
  );
}

function HighlightCards({ stats }: { stats: PlayerStatistics }) {
  const { records, highlights, reachRates, titles } = stats;
  const items: Array<{ label: string; value: string; sub?: string }> = [];

  if (titles.total > 0) {
    items.push({
      label: '通算優勝',
      value: `${titles.total}回`,
      sub: titles.major > 0 ? `うち主要大会 ${titles.major}回` : undefined,
    });
  }
  if (records.longestWinStreak.length >= 3) {
    const s = records.longestWinStreak;
    items.push({
      label: '最長連勝',
      value: `${s.length}連勝`,
      sub: s.from ? `${s.from.slice(0, 10)}〜${s.to?.slice(0, 10) ?? ''}` : undefined,
    });
  }
  if (records.bestSeason) {
    const b = records.bestSeason;
    items.push({
      label: 'ベストシーズン',
      value: `${b.year}年度 勝率${pct(b.winRate)}`,
      sub: `${b.wins}勝${b.losses}敗（${DISCIPLINE_LABEL[b.discipline] ?? b.discipline}）`,
    });
  }
  if (reachRates.denominator >= 5) {
    items.push({
      label: '決勝進出率',
      value: pct(reachRates.finalReachRate),
      sub: `準決勝進出率 ${pct(reachRates.semifinalReachRate)}（${reachRates.denominator}出場）`,
    });
  }
  if (highlights.mostFacedOpponent) {
    const o = highlights.mostFacedOpponent;
    items.push({
      label: '最多対戦',
      value: o.opponentName,
      sub: `${o.meetings}回（${o.wins}勝${o.losses}敗）`,
    });
  }
  if (highlights.favorableOpponents.length > 0) {
    const o = highlights.favorableOpponents[0];
    items.push({
      label: '得意な相手',
      value: o.opponentName,
      sub: `${o.wins}勝${o.losses}敗`,
    });
  }
  if (highlights.toughOpponents.length > 0) {
    const o = highlights.toughOpponents[0];
    items.push({
      label: '苦手な相手',
      value: o.opponentName,
      sub: `${o.wins}勝${o.losses}敗`,
    });
  }

  if (items.length === 0) return null;
  return (
    <SectionCard title="戦績ハイライト" note={stats.scopeNote}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((it) => (
          <li key={it.label} className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <p className="text-xs text-gray-500 dark:text-gray-400">{it.label}</p>
            <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-gray-100">{it.value}</p>
            {it.sub && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{it.sub}</p>}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function RankingTrendTable({ trend }: { trend: RankingPoint[] }) {
  if (trend.length === 0) return null;
  const sorted = [...trend].sort((a, b) => b.year - a.year || a.discipline.localeCompare(b.discipline));
  return (
    <SectionCard title="年度別ランキング推移" note="当サイト掲載大会のシーズンポイント（年度の上位3大会合算）による種目別順位です。">
      <table className="w-full border border-gray-200 text-sm dark:border-gray-600">
        <thead className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          <tr>
            <th className="py-1 px-2 text-center">年度</th>
            <th className="py-1 px-2 text-center">種目</th>
            <th className="py-1 px-2 text-center">順位</th>
            <th className="py-1 px-2 text-center">ポイント</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={`${p.year}-${p.discipline}`} className="border-t border-gray-200 text-center dark:border-gray-600">
              <td className="py-1 px-2">{p.year}年度</td>
              <td className="py-1 px-2">{DISCIPLINE_LABEL[p.discipline] ?? p.discipline}</td>
              <td className="py-1 px-2 font-semibold">
                {p.rank}位<span className="ml-1 font-normal text-xs text-gray-500 dark:text-gray-400">/ {p.outOf}人</span>
              </td>
              <td className="py-1 px-2">{p.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

function TournamentTable({ rows }: { rows: TournamentRow[] }) {
  if (rows.length === 0) return null;
  const top = rows.slice(0, 10);
  return (
    <SectionCard title="大会別成績" note={`出場大会ごとの通算成績と最高成績です${rows.length > top.length ? `（出場数上位${top.length}大会）` : ''}。`}>
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-200 text-sm dark:border-gray-600">
          <thead className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
            <tr>
              <th className="py-1 px-2 text-left">大会</th>
              <th className="py-1 px-2 text-center">出場</th>
              <th className="py-1 px-2 text-center">勝敗（勝率）</th>
              <th className="py-1 px-2 text-center">優勝</th>
              <th className="py-1 px-2 text-center">最高成績</th>
            </tr>
          </thead>
          <tbody>
            {top.map((t) => (
              <tr key={t.tournamentId} className="border-t border-gray-200 text-center dark:border-gray-600">
                <td className="py-1 px-2 text-left">{t.tournamentName}</td>
                <td className="py-1 px-2">{t.appearances}回</td>
                <td className="py-1 px-2">
                  {t.matches.wins}勝{t.matches.losses}敗（
                  {pct(t.matches.winRate)}）
                </td>
                <td className="py-1 px-2">{t.titles > 0 ? `${t.titles}回` : '―'}</td>
                <td className="py-1 px-2">{t.bestResult ?? '―'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function HeadToHeadTable({ rows, linkable }: { rows: Head2HeadRow[]; linkable: Set<number> }) {
  if (rows.length === 0) return null;
  const top = rows.slice(0, 10);
  return (
    <SectionCard title="対戦相手との通算成績" note="相手選手ごとの通算対戦成績（対個人・相方問わず名寄せ）です。対戦数の多い順に掲載しています。">
      <table className="w-full border border-gray-200 text-sm dark:border-gray-600">
        <thead className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          <tr>
            <th className="py-1 px-2 text-center">相手</th>
            <th className="py-1 px-2 text-center">対戦数</th>
            <th className="py-1 px-2 text-center">勝敗（勝率）</th>
          </tr>
        </thead>
        <tbody>
          {top.map((h) => {
            const canLink = h.opponentId != null && linkable.has(h.opponentId);
            return (
              <tr key={h.opponentKey} className="border-t border-gray-200 text-center dark:border-gray-600">
                <td className="py-1 px-2">
                  {canLink ? (
                    <Link
                      href={`/players/${h.opponentId}/results`}
                      className="text-inherit underline decoration-dotted underline-offset-2 hover:decoration-solid"
                    >
                      {h.opponentName}
                    </Link>
                  ) : h.opponentId != null ? (
                    <PlayerLiteLink id={String(h.opponentId)} name={h.opponentName} />
                  ) : (
                    h.opponentName
                  )}
                </td>
                <td className="py-1 px-2">{h.meetings}回</td>
                <td className="py-1 px-2">
                  {h.wins}勝{h.losses}敗（{pct(h.winRate)}）
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </SectionCard>
  );
}

function TeamTable({ rows }: { rows: TeamRow[] }) {
  if (rows.length <= 1) return null; // 所属が 1 つだけなら情報量が無い
  return (
    <SectionCard title="所属別成績" note="出場当時の所属チームごとの成績です。">
      <table className="w-full border border-gray-200 text-sm dark:border-gray-600">
        <thead className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          <tr>
            <th className="py-1 px-2 text-center">所属</th>
            <th className="py-1 px-2 text-center">期間</th>
            <th className="py-1 px-2 text-center">勝敗（勝率）</th>
            <th className="py-1 px-2 text-center">優勝</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.team} className="border-t border-gray-200 text-center dark:border-gray-600">
              <td className="py-1 px-2">{t.team}</td>
              <td className="py-1 px-2 text-xs">
                {t.span.from?.slice(0, 4) ?? '?'}〜{t.span.to?.slice(0, 4) ?? ''}
              </td>
              <td className="py-1 px-2">
                {t.matches.wins}勝{t.matches.losses}敗（
                {pct(t.matches.winRate)}）
              </td>
              <td className="py-1 px-2">{t.titles > 0 ? `${t.titles}回` : '―'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

function CareerTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;
  const shown = events.slice(0, 30);
  return (
    <SectionCard title="キャリア年表" note="収録大会から自動生成した主な出来事です。">
      <ol className="space-y-1.5">
        {shown.map((e, i) => (
          <li key={`${e.year}-${e.kind}-${i}`} className="flex items-baseline gap-2 text-sm">
            <span className="w-16 shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">{e.year}年度</span>
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {TIMELINE_KIND_LABEL[e.kind] ?? e.kind}
            </span>
            <span className="text-gray-800 dark:text-gray-200">{e.label}</span>
          </li>
        ))}
        {events.length > shown.length && <li className="text-xs text-gray-500 dark:text-gray-400">ほか{events.length - shown.length}件</li>}
      </ol>
    </SectionCard>
  );
}

/**
 * 新統計セクション群（表示条件を満たすものだけ描画）。
 * データが無い選手では何も描画しない。
 */
export default function PlayerStatisticsSections({ stats, linkablePlayerIds = [] }: Props) {
  if (!stats || stats.coverage.totalMatches === 0) return null;
  const linkable = new Set(linkablePlayerIds);

  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold">詳細スタッツ</h2>
      {stats.identity.homonymRisk && (
        <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">※ 同姓同名の別選手の成績が含まれている可能性があります。</p>
      )}
      <div className="mx-4">
        <HighlightCards stats={stats} />
        <RankingTrendTable trend={stats.rankingTrend} />
        <TournamentTable rows={stats.byTournament} />
        <HeadToHeadTable rows={stats.headToHead} linkable={linkable} />
        <TeamTable rows={stats.byTeam} />
        <CareerTimeline events={stats.careerTimeline} />
      </div>
    </section>
  );
}
