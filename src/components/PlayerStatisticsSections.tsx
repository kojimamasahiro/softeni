// src/components/PlayerStatisticsSections.tsx
// results.tsx の「スタッツ」セクションのうち、<details>「詳細を見る」で畳む深掘り層。
// SectionCard（h3）を6枚並べる: 対戦成績（全パートナー・全年度）/ 戦績ハイライト /
// 年度別ランキング推移 / 大会別成績 / 対戦相手との通算成績（H2H）/ 所属別成績。
// キャリア年表（CareerTimeline）はこのコンポーネントからexportし、results.tsx側で
// <details>の外＝常時表示として単独描画する（2026-08-26）。
// 常時表示のチップ（PlayerSummaryStats.tsx）とは対になる関係で、自前の <h2> は持たない。
// データはすべてビルド時前計算（getStaticProps → facade。対戦成績のみ toSummaryStats 経由）。
// ランタイム集計なし。

import Link from 'next/link';

import PlayerLiteLink from '@/components/PlayerLiteLink';
import { getTournamentHubHref } from '@/lib/highschoolNationalTournamentMeta';
import type { PlayerInfo, PlayerStats } from '@/types/index';
import type { Head2HeadRow, PlayerStatistics, RankingPoint, TeamRow, TimelineEvent, TournamentRow } from '@/types/playerStatistics';

type Props = {
  stats: PlayerStatistics;
  /** 結果ページが実在する（index.json count>=5）選手 id。デッドリンク防止。 */
  linkablePlayerIds?: number[];
  /** 大会別成績の各大会 → 大会ハブページの generation 解決用（tournamentId → generationId）。 */
  tournamentGenerationMap?: Record<string, string>;
  /** 対戦成績（全パートナー・全年度）カード用。常時表示のサマリー（PlayerSummaryStats.tsx）
   * と同じ playerStats/allPlayers を渡し、数値の食い違いを起こさない
   * （2026-08-07: 旧 PlayerFullBreakdown.tsx を統合。単独 <section><h2> だと
   * 「詳細スタッツを見る」で開いた直後に「対戦成績」「詳細スタッツ」という2つの見出しが
   * 並んで見えたため、SectionCard の1枚としてこのコンポーネントに含めた）。 */
  playerStats?: PlayerStats | null;
  allPlayers?: PlayerInfo[];
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

function SectionCard({
  title,
  note,
  titleClassName = 'mb-1 text-lg font-bold text-text',
  children,
}: {
  title: string;
  note?: string;
  /** 見出しの文字サイズ等を上書きしたい場合に指定（例: CareerTimeline は
   * PlayerMajorResults.tsx の見出しとサイズを揃えるため小さめを指定）。 */
  titleClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h3 className={titleClassName}>{title}</h3>
      {note && <p className="mb-3 text-xs text-text-muted">{note}</p>}
      {children}
    </div>
  );
}

// 対戦成績（全パートナー・全年度）。旧 PlayerFullBreakdown.tsx から統合（2026-08-07）。
// 常時表示のサマリー（PlayerSummaryStats.tsx、主なペア・直近年度のチップのみ）とは
// 表示範囲が違うだけの対（同じ playerStats/allPlayers を参照）。
type PartnerYearStats = {
  matches: { total: number; wins: number; losses: number; winRate: number };
  games: { total: number; won: number; lost: number; gameRate: number };
  name?: string;
};

function formatGameStats(games?: { won: number; lost: number; gameRate: number }) {
  if (!games) return '―';
  return `${games.won} - ${games.lost}（${(games.gameRate * 100).toFixed(1)}%）`;
}

function PartnerYearRow({ label, stats, link, liteId }: { label: string; stats: PartnerYearStats; link?: string; liteId?: string }) {
  return (
    <tr className="border-t border-border-strong text-center">
      <td className="py-1 px-2">
        {link ? (
          <Link href={link} className="text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid">
            {label}
          </Link>
        ) : liteId ? (
          <PlayerLiteLink id={liteId} name={label} />
        ) : (
          label
        )}
      </td>
      <td className="py-1 px-2">
        {stats.matches.wins}勝 {stats.matches.losses}敗（
        {(stats.matches.winRate * 100).toFixed(1)}%）
      </td>
      <td className="py-1 px-2">{formatGameStats(stats.games)}</td>
    </tr>
  );
}

function PartnerYearTable({
  title,
  data,
  isYear = false,
  allPlayers,
}: {
  title: string;
  data: Record<string, PartnerYearStats>;
  isYear?: boolean;
  allPlayers: PlayerInfo[];
}) {
  const entries = Object.entries(data);
  // 年度別は新しい年が先、パートナー別は試合数の多い順（2026-08-07: 元は挿入順のままだった。
  // 常時表示のサマリーから「よく組む相手が一目でわかる」役割を引き継ぐため、こちらも降順に揃えた）。
  const sortedEntries = isYear ? entries.sort(([a], [b]) => Number(b) - Number(a)) : entries.sort(([, a], [, b]) => b.matches.total - a.matches.total);

  return (
    <div className="mb-4">
      <h4 className="text-base font-semibold mb-2">{title}</h4>
      <table className="w-full border border-border-strong text-sm">
        <thead className="bg-bg-subtle text-gray-800 dark:text-gray-200">
          <tr>
            <th className="py-1 px-2 text-center">{isYear ? '年度' : 'パートナー'}</th>
            <th className="py-1 px-2 text-center">勝敗（勝率）</th>
            <th className="py-1 px-2 text-center">ゲーム（獲得率）</th>
          </tr>
        </thead>
        <tbody>
          {sortedEntries.map(([key, stats]) => {
            const matchedPlayer = allPlayers.find((p) => p.id === key);
            const label = isYear ? `${key}年` : (stats.name ?? (matchedPlayer ? `${matchedPlayer.lastName} ${matchedPlayer.firstName || ''}` : key));

            // 結果ページが実在する（count>=5）選手のみページへリンクする。count<5 は
            // 404 になるためリンクせず、モーダル（PlayerLiteLink）で表示する。
            const partner = !isYear ? matchedPlayer : undefined;
            const hasPage = partner ? (partner.count ?? 0) >= 5 : false;
            const link = hasPage ? `/players/${key}/results` : undefined;
            const liteId = partner && !hasPage ? key : undefined;

            return <PartnerYearRow key={key} label={label} stats={stats} link={link} liteId={liteId} />;
          })}
        </tbody>
      </table>
    </div>
  );
}

function PartnerYearBreakdown({ playerStats, allPlayers }: { playerStats?: PlayerStats | null; allPlayers: PlayerInfo[] }) {
  if (!playerStats || !playerStats.totalMatches) return null;
  return (
    <SectionCard title="対戦成績（全パートナー・全年度）">
      <PartnerYearTable title="パートナー別" data={playerStats.byPartner} allPlayers={allPlayers} />
      <PartnerYearTable title="年度別" data={playerStats.byYear} allPlayers={allPlayers} isYear />
    </SectionCard>
  );
}

function HighlightCards({ stats }: { stats: PlayerStatistics }) {
  const { records, highlights, reachRates, titles } = stats;
  const items: Array<{ label: string; value: string; sub?: string }> = [];

  // 全国大会優勝は「通算優勝」より先に出す（該当者にとって最も価値の高い事実のため）。
  // 判定は lib/nationalTitles.ts のホワイトリスト（東日本/西日本選手権は含めない）。
  if (titles.national && titles.national.count > 0) {
    const latest = titles.national.titles[0];
    items.push({
      label: '全国大会優勝',
      value: `${titles.national.count}回`,
      sub: latest ? `直近は${latest.year}年 ${latest.shortLabel}（${latest.discipline}）` : undefined,
    });
  }
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
          <li key={it.label} className="rounded-lg border border-border bg-gray-50 p-3 dark:bg-gray-900/40">
            <p className="text-xs text-text-muted">{it.label}</p>
            <p className="mt-0.5 text-sm font-bold text-text">{it.value}</p>
            {it.sub && <p className="mt-0.5 text-xs text-text-muted">{it.sub}</p>}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

const GENDER_LABEL: Record<string, string> = {
  boys: '男子',
  girls: '女子',
  mixed: '混合',
};

function RankingTrendTable({ trend }: { trend: RankingPoint[] }) {
  if (trend.length === 0) return null;
  const sorted = [...trend].sort((a, b) => b.year - a.year || a.discipline.localeCompare(b.discipline) || (a.gender ?? '').localeCompare(b.gender ?? ''));
  return (
    <SectionCard title="年度別ランキング推移" note="当サイト収録大会のシーズンポイント（年度の上位3大会合算）による男女別ダブルスの順位です。">
      <table className="w-full border border-border-strong text-sm">
        <thead className="bg-bg-subtle text-gray-800 dark:text-gray-200">
          <tr>
            <th className="py-1 px-2 text-center">年度</th>
            <th className="py-1 px-2 text-center">種目</th>
            <th className="py-1 px-2 text-center">順位</th>
            <th className="py-1 px-2 text-center">ポイント</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={`${p.year}-${p.discipline}-${p.gender}`} className="border-t border-border-strong text-center">
              <td className="py-1 px-2">{p.year}年度</td>
              <td className="py-1 px-2">
                {GENDER_LABEL[p.gender] ?? ''}
                {DISCIPLINE_LABEL[p.discipline] ?? p.discipline}
              </td>
              <td className="py-1 px-2 font-semibold">
                {p.rank}位<span className="ml-1 font-normal text-xs text-text-muted">/ {p.outOf}人</span>
              </td>
              <td className="py-1 px-2">{p.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-right text-sm">
        <Link href="/rankings/" className="text-link hover:underline">
          全体ランキングを見る ›
        </Link>
      </p>
    </SectionCard>
  );
}

function TournamentTable({ rows, generationMap }: { rows: TournamentRow[]; generationMap: Record<string, string> }) {
  if (rows.length === 0) return null;
  const top = rows.slice(0, 10);
  return (
    <SectionCard title="大会別成績" note={`出場大会ごとの通算成績と最高成績です${rows.length > top.length ? `（出場数上位${top.length}大会）` : ''}。`}>
      <div className="overflow-x-auto">
        <table className="w-full border border-border-strong text-sm">
          <thead className="bg-bg-subtle text-gray-800 dark:text-gray-200">
            <tr>
              <th className="py-1 px-2 text-left">大会</th>
              <th className="py-1 px-2 text-center">出場</th>
              <th className="py-1 px-2 text-center">勝敗（勝率）</th>
              <th className="py-1 px-2 text-center">優勝</th>
              <th className="py-1 px-2 text-center">最高成績</th>
            </tr>
          </thead>
          <tbody>
            {top.map((t) => {
              const generation = generationMap[t.tournamentId];
              return (
                <tr key={t.tournamentId} className="border-t border-border-strong text-center">
                  <td className="py-1 px-2 text-left">
                    {generation ? (
                      <Link
                        href={getTournamentHubHref(generation, t.tournamentId)}
                        className="text-inherit underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      >
                        {t.tournamentName}
                      </Link>
                    ) : (
                      t.tournamentName
                    )}
                  </td>
                  <td className="py-1 px-2">{t.appearances}回</td>
                  <td className="py-1 px-2">
                    {t.matches.wins}勝{t.matches.losses}敗（
                    {pct(t.matches.winRate)}）
                  </td>
                  <td className="py-1 px-2">{t.titles > 0 ? `${t.titles}回` : '―'}</td>
                  <td className="py-1 px-2">{t.bestResult ?? '―'}</td>
                </tr>
              );
            })}
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
      <table className="w-full border border-border-strong text-sm">
        <thead className="bg-bg-subtle text-gray-800 dark:text-gray-200">
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
              <tr key={h.opponentKey} className="border-t border-border-strong text-center">
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
      <table className="w-full border border-border-strong text-sm">
        <thead className="bg-bg-subtle text-gray-800 dark:text-gray-200">
          <tr>
            <th className="py-1 px-2 text-center">所属</th>
            <th className="py-1 px-2 text-center">期間</th>
            <th className="py-1 px-2 text-center">勝敗（勝率）</th>
            <th className="py-1 px-2 text-center">優勝</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.team} className="border-t border-border-strong text-center">
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

const CAREER_TIMELINE_VISIBLE_COUNT = 3;
const CAREER_TIMELINE_MAX_TOTAL = 30;

function CareerTimelineItem({ event }: { event: TimelineEvent }) {
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <span className="w-16 shrink-0 text-xs font-semibold text-text-muted">{event.year}年度</span>
      <span className="shrink-0 rounded bg-bg-subtle px-1.5 py-0.5 text-xs text-text-secondary">{TIMELINE_KIND_LABEL[event.kind] ?? event.kind}</span>
      <span className="text-gray-800 dark:text-gray-200">{event.label}</span>
    </li>
  );
}

// aggregateCareerTimeline（lib/playerStats/aggregators/careerTimeline.ts）は年の昇順
// （古い→新しい）で返す。ここでは「直近」を優先表示したいので新しい→古いに反転する。
export function CareerTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;
  const sorted = [...events].reverse();
  const capped = sorted.slice(0, CAREER_TIMELINE_MAX_TOTAL);
  const recent = capped.slice(0, CAREER_TIMELINE_VISIBLE_COUNT);
  const rest = capped.slice(CAREER_TIMELINE_VISIBLE_COUNT);
  const omitted = sorted.length - capped.length;
  return (
    <SectionCard
      title="キャリア年表"
      note="収録大会から自動生成した主な出来事です。直近のものから表示しています。"
      titleClassName="mb-2 text-xs font-bold tracking-wide text-text-secondary"
    >
      <ol className="space-y-1.5">
        {recent.map((e, i) => (
          <CareerTimelineItem key={`${e.year}-${e.kind}-${i}`} event={e} />
        ))}
      </ol>
      {rest.length > 0 && (
        <details className="group mt-1.5">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs text-text-secondary hover:text-text">
            もっと見る（{rest.length}件）
            <span aria-hidden className="text-text-muted group-open:hidden">
              ▼
            </span>
            <span aria-hidden className="hidden text-text-muted group-open:inline">
              ▲
            </span>
          </summary>
          <ol className="mt-1.5 space-y-1.5">
            {rest.map((e, i) => (
              <CareerTimelineItem key={`${e.year}-${e.kind}-${i}`} event={e} />
            ))}
            {omitted > 0 && <li className="text-xs text-text-muted">ほか{omitted}件</li>}
          </ol>
        </details>
      )}
    </SectionCard>
  );
}

/**
 * 新統計セクション群（表示条件を満たすものだけ描画）。
 * データが無い選手では何も描画しない。
 */
export default function PlayerStatisticsSections({ stats, linkablePlayerIds = [], tournamentGenerationMap = {}, playerStats = null, allPlayers = [] }: Props) {
  if (!stats || stats.coverage.totalMatches === 0) return null;
  const linkable = new Set(linkablePlayerIds);

  // 自前の <h2> は持たない（2026-08-07: 呼び出し側 results.tsx が「スタッツ」という
  // 1つの見出しの下に、常時表示のチップ（PlayerSummaryStats）とこのコンポーネントを
  // <details>「詳細を見る」でまとめて配置する）。
  return (
    <div className="mx-4">
      {stats.identity.homonymRisk && <p className="mb-3 text-xs text-warning">※ 同姓同名の別選手の成績が含まれている可能性があります。</p>}
      <PartnerYearBreakdown playerStats={playerStats} allPlayers={allPlayers} />
      <HighlightCards stats={stats} />
      <RankingTrendTable trend={stats.rankingTrend} />
      <TournamentTable rows={stats.byTournament} generationMap={tournamentGenerationMap} />
      <HeadToHeadTable rows={stats.headToHead} linkable={linkable} />
      <TeamTable rows={stats.byTeam} />
    </div>
  );
}
