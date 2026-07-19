// src/pages/players/[id]/results.tsx

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MajorTitles from '@/components/MajorTitles';
import MetaHead from '@/components/MetaHead';
import PlayerResults, { PlayerMatch, PlayerTournament } from '@/components/PlayerResults';
import PlayerStatisticsSections from '@/components/PlayerStatisticsSections';
import PlayerSummaryStats from '@/components/PlayerSummaryStats';
import PageLayout from '@/components/PageLayout';
import { getMajorTitlesForPlayer, MajorTitleData } from '@/lib/majorTitles';
import { getScoreMatchLinksForPlayer, type ScoreMatchLink } from '@/lib/matchReverseIndex';
import { resolveAliasedPlayerId, resolveAliasedTeam } from '@/lib/playerStats/participantAliases';
import { getPlayerStatistics } from '@/lib/playerStats/playerStatistics';
import { getAllDetailRecords, loadInformationMap, loadTournamentIndex } from '@/lib/tournamentData';
import { MatchResult } from '@/types/common';
import type { Games as GamesType, MatchStats as MatchStatsType } from '@/types/stats';
import { TournamentEntry, TournamentParticipant } from '@/types/tournament';

type PlayerResultsProps = {
  playerId: string;
  lastName: string;
  firstName: string;
  team?: string | null;
  profileSlug?: string | null;
  firstActivityDate?: string | null;
  latestActivityDate?: string | null;
  playerMatches: PlayerMatch[];
  playerTournaments: PlayerTournament[];
  majorTitlesData: MajorTitleData[];
  playerStats?: import('@/types/stats').PlayerStats | null;
  // Player Statistics Engine 由来の統計（既存表示は維持しつつ新データを追加提供・P5）。
  playerStatistics?: import('@/types/playerStatistics').PlayerStatistics | null;
  // H2H 相手のうち結果ページが実在する（count>=5）選手 id（デッドリンク防止）。
  statsLinkableIds?: number[];
  // 大会別成績の各大会 → 大会ハブページの generation 解決用（tournamentId → generationId）。
  tournamentGenerationMap?: Record<string, string>;
  allPlayers?: import('@/types/player').PlayerInfo[];
  relatedPlayers?: {
    id: string;
    name: string;
    total: number;
    wins: number;
    losses: number;
    hasPage: boolean;
  }[];
  scoreMatchLinks?: ScoreMatchLink[];
  // ショーケース対象（data/growth-featured.json）の場合の成長記録ページ slug。なければ null。
  growthShowcaseSlug?: string | null;
  // SEO: 収録試合が薄く全国高校大会出場もない選手ページは noindex にする（インデックス枠の集中）。
  noindex?: boolean;
};

export default function PlayerResultsPage({
  playerId,
  lastName,
  firstName,
  team = null,
  profileSlug = null,
  firstActivityDate = null,
  latestActivityDate = null,
  playerMatches,
  playerTournaments,
  majorTitlesData,
  playerStats,
  playerStatistics = null,
  statsLinkableIds = [],
  tournamentGenerationMap = {},
  allPlayers,
  relatedPlayers = [],
  scoreMatchLinks = [],
  growthShowcaseSlug = null,
  noindex = false,
}: PlayerResultsProps) {
  const fullName = `${lastName}${firstName}`;
  const pageUrl = `https://softeni-pick.com/players/${playerId}/results/`;
  const displayName = team ? `${fullName}（${team}）` : fullName;

  // latest tournament appearance (for unique description/summary)
  const latestTournament =
    playerTournaments.length > 0
      ? [...playerTournaments].sort((a, b) => String(a.startDate ?? a.year ?? '').localeCompare(String(b.startDate ?? b.year ?? '')))[
          playerTournaments.length - 1
        ]
      : null;

  // overall record
  const totalMatches = playerStats?.totalMatches ?? 0;
  const wins = playerStats?.wins ?? 0;
  const losses = playerStats?.losses ?? 0;
  const winRatePct = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : null;

  // most frequent partner (excluding singles)
  const mainPartnerName = (() => {
    const byPartner = playerStats?.byPartner ?? {};
    let bestKey: string | null = null;
    let bestCount = 0;
    for (const [key, agg] of Object.entries(byPartner)) {
      if (key === 'singles') continue;
      const count = agg?.matches?.total ?? 0;
      if (count > bestCount) {
        bestCount = count;
        bestKey = key;
      }
    }
    if (!bestKey) return null;
    const found = (allPlayers ?? []).find((p) => String(p.id) === bestKey);
    return found ? `${found.lastName}${found.firstName}` : null;
  })();

  const latestResultPhrase = latestTournament
    ? `${latestTournament.year ?? ''}年${latestTournament.tournamentName}${latestTournament.finalResult ? `で${latestTournament.finalResult}` : 'に出場'}`
    : null;

  // Player Statistics Engine 由来の実績（優勝数・最高ランキング）で description を一意化する（SEO）。
  const engineStatsPhrase = (() => {
    if (!playerStatistics) return '';
    const parts: string[] = [];
    const titles = playerStatistics.titles;
    if (titles && titles.total > 0) {
      parts.push(`優勝${titles.total}回${titles.major > 0 ? `（うち主要大会${titles.major}回）` : ''}`);
    }
    const genderLabel: Record<string, string> = { boys: '男子', girls: '女子' };
    const discLabel: Record<string, string> = { singles: 'シングルス', doubles: 'ダブルス' };
    let best: (typeof playerStatistics.rankingTrend)[number] | null = null;
    for (const p of playerStatistics.rankingTrend ?? []) {
      if (!best || p.rank < best.rank || (p.rank === best.rank && p.year > best.year)) best = p;
    }
    if (best) {
      parts.push(`最高ランキングは${best.year}年度${genderLabel[best.gender] ?? ''}${discLabel[best.discipline] ?? best.discipline}${best.rank}位`);
    }
    return parts.length > 0 ? `${parts.join('、')}。` : '';
  })();

  const summarySentence = [
    `${displayName}のソフトテニス試合結果・戦績。`,
    latestResultPhrase ? `直近は${latestResultPhrase}。` : '',
    totalMatches > 0 ? `収録試合は通算${totalMatches}試合${wins}勝${losses}敗${winRatePct !== null ? `（勝率${winRatePct}%）` : ''}。` : '',
    engineStatsPhrase,
    mainPartnerName ? `主なペアは${mainPartnerName}。` : '',
  ].join('');

  return (
    <>
      <MetaHead
        title={`${displayName}の試合結果・戦績 | ソフトテニス`}
        description={summarySentence}
        url={pageUrl}
        type="article"
        noindex={noindex}
        noindexFollow={noindex}
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ProfilePage',
              ...(firstActivityDate && {
                dateCreated: `${firstActivityDate}T00:00:00+09:00`,
              }),
              ...(latestActivityDate && {
                dateModified: `${latestActivityDate}T00:00:00+09:00`,
              }),
              inLanguage: 'ja',
              mainEntity: {
                '@type': 'Person',
                name: fullName,
                ...(team && {
                  affiliation: {
                    '@type': 'Organization',
                    name: team,
                  },
                }),
                url: pageUrl,
              },
              publisher: {
                '@type': 'Organization',
                name: 'Softeni Pick',
              },
              description: summarySentence,
            }),
          }}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'ホーム',
                  item: 'https://softeni-pick.com/',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: '選手一覧',
                  item: 'https://softeni-pick.com/players/',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: `${fullName} 試合結果`,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <PageLayout className="space-y-10">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            {
              label: '選手一覧',
              href: '/players',
            },
            {
              label: `${fullName} 試合結果`,
              href: `/players/${playerId}/results`,
            },
          ]}
        />

        <header>
          <h1 className="text-2xl font-bold">
            {fullName} 選手の試合結果{team ? `（${team}）` : ''}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {summarySentence}
            出場大会や成績、主な勝ち上がり情報を掲載しています。
          </p>
          {profileSlug && (
            <p className="mt-2 text-sm">
              <Link href={`/players/${profileSlug}/`} className="text-link hover:underline">
                {fullName} 選手のプロフィール（身長・所属・ポジション）はこちら
              </Link>
            </p>
          )}
        </header>

        {/* 主な成績（タイトル）(再現未実装) */}
        <section>
          <MajorTitles majorTitlesData={majorTitlesData} />
        </section>

        <div className="text-right">
          <Link href="/tournaments" className="text-sm text-blue-600 hover:underline">
            過去の大会一覧はこちら
          </Link>
        </div>

        <section>{playerStats && <PlayerSummaryStats playerStats={playerStats} allPlayers={allPlayers || []} />}</section>

        {/* Player Statistics Engine 由来の詳細スタッツ（ハイライト・ランキング推移・
            大会別・H2H・所属別・キャリア年表）。既存サマリーと重複しないもののみ。 */}
        {playerStatistics && (
          <PlayerStatisticsSections stats={playerStatistics} linkablePlayerIds={statsLinkableIds} tournamentGenerationMap={tournamentGenerationMap} />
        )}

        {scoreMatchLinks.length > 0 && (
          <section className="rounded-lg border border-success-border bg-success-bg p-4">
            <h2 className="mb-2 text-base font-bold text-success">スコア詳細のある試合</h2>
            <p className="mb-3 text-xs text-success">ポイントごとの記録・分析を掲載しています。</p>
            <ul className="divide-y divide-emerald-200/70 dark:divide-emerald-900/60">
              {scoreMatchLinks.map((link) => (
                <li key={link.matchId}>
                  <Link
                    href={link.detailPath}
                    className="flex items-center gap-2 py-2 text-sm text-success transition-colors hover:text-emerald-700 dark:hover:text-emerald-300"
                  >
                    {link.round && <span className="shrink-0 rounded bg-success-bg px-1.5 py-0.5 text-xs font-semibold text-success">{link.round}</span>}
                    <span className="font-medium">
                      {link.teamA} vs {link.teamB}
                    </span>
                    <span aria-hidden className="ml-auto text-emerald-500">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {growthShowcaseSlug && (
          <section className="rounded-lg border border-info-border bg-info-bg p-4">
            <h2 className="mb-1 text-base font-bold text-info">成長記録</h2>
            <p className="mb-3 text-xs text-info">勝ち負けだけでは見えない、試合内容の変化を指標で追っています。</p>
            <Link href={`/growth/${growthShowcaseSlug}`} className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
              {fullName}の成長記録を見る
              <span aria-hidden>›</span>
            </Link>
          </section>
        )}

        {relatedPlayers.length > 0 && (
          <section>
            <h2 className="mb-2 text-base font-bold text-text">関連選手（主なペア）</h2>
            <p className="mb-3 text-xs text-text-muted">{fullName}選手が収録大会でペアを組んだ選手です。</p>
            <ul className="flex flex-wrap gap-2">
              {relatedPlayers.map((p) => {
                const label = `${p.name}（${p.total}試合 ${p.wins}勝${p.losses}敗）`;
                return (
                  <li key={p.id}>
                    {p.hasPage ? (
                      <Link
                        href={`/players/${p.id}/results`}
                        className="inline-block rounded-full border border-border bg-gray-50 px-3 py-1 text-sm text-info transition-colors hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                      >
                        {label}
                      </Link>
                    ) : (
                      <span className="inline-block rounded-full border border-border bg-gray-50 px-3 py-1 text-sm text-text-secondary dark:bg-gray-800">
                        {label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section>
          <PlayerResults playerMatches={playerMatches} playerTournaments={playerTournaments} />
        </section>
      </PageLayout>
    </>
  );
}

/**
 * Player Statistics Engine の出力を、サマリー表示用の PlayerStats 形へ変換する。
 *
 * このページはかつて getStaticProps 内で独自に戦績を集計していたが、その集計は
 * 「retired（不戦勝・途中棄権）を除外する」という決定（ADR-011 / docs/wiki/players-pages.md
 * 2026-07-01）を実装しておらず、勝率の分母にも勝敗のつかない試合を含めていた。
 * 結果として「試合数」と「年度別・パートナー別の合計」が同一ページ内で食い違い
 * （例: 船水颯人 113 vs 112、黒坂卓矢 175 vs 173）、さらに同じページ下部の
 * 「詳細スタッツ」は方針どおりエンジン由来だったため、上下で集計基準が違っていた。
 *
 * 集計の正は Player Statistics Engine 側に一本化する。ここは表示形への詰め替えのみ。
 *
 * 注意: エンジンの byPartner はダブルスの相方のみを返す（シングルスを含まない）ため、
 * シングルス行は career.byDiscipline.singles から補う（従来表示の 'singles' キー相当）。
 */
function toSummaryStats(playerId: string, stats: import('@/types/playerStatistics').PlayerStatistics): import('@/types/stats').PlayerStats {
  const overall = stats.career.overall;

  const byPartner: import('@/types/stats').PartnerStats = {};
  for (const row of stats.byPartner ?? []) {
    if (row.partnerId == null) continue;
    byPartner[String(row.partnerId)] = { matches: row.matches, games: row.games };
  }
  const singles = stats.career.byDiscipline?.singles;
  if (singles && singles.matches.total > 0) {
    byPartner.singles = { matches: singles.matches, games: singles.games };
  }

  const byYear: import('@/types/stats').YearStats = {};
  for (const row of stats.byYear ?? []) {
    // byYear は種目別行も持ちうる。総計行（discipline='all'）だけを使う。
    if (row.discipline !== 'all') continue;
    byYear[String(row.year)] = { matches: row.matches, games: row.games };
  }

  return {
    playerId,
    totalMatches: overall.matches.total,
    wins: overall.matches.wins,
    losses: overall.matches.losses,
    totalWinRate: overall.matches.winRate,
    games: overall.games,
    byPartner,
    byYear,
  };
}

// data/players/index.json は結果ページ(getStaticPaths/getStaticProps)が対象選手数ぶん
// (数千回)呼ばれるたびに毎回読み直され、そこから allPlayersList/countById も毎回
// 再構築されていた。全ページで内容は共通なので、プロセス内で一度だけ読み込み・
// 導出してキャッシュし、重複したI/O・JSON.parse・配列走査をなくす。
type PlayerIndexEntry = { id: number; lastName: string; firstName: string; count?: number };
let cachedPlayerIndexPromise: Promise<PlayerIndexEntry[]> | null = null;

async function loadPlayerIndex(): Promise<PlayerIndexEntry[]> {
  if (!cachedPlayerIndexPromise) {
    cachedPlayerIndexPromise = (async () => {
      const fs = await import('fs');
      const path = await import('path');
      const indexPath = path.join(process.cwd(), 'data', 'players', 'index.json');
      try {
        return JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as PlayerIndexEntry[];
      } catch {
        return [];
      }
    })();
  }
  return cachedPlayerIndexPromise;
}

let cachedAllPlayersList: Array<{ id: string; lastName: string; firstName: string; count: number }> | null = null;
let cachedCountById: Map<string, number> | null = null;

async function getAllPlayersListAndCountById() {
  if (!cachedAllPlayersList || !cachedCountById) {
    const index = await loadPlayerIndex();
    cachedAllPlayersList = index.map((p) => ({
      id: String(p.id),
      lastName: p.lastName,
      firstName: p.firstName,
      count: p.count ?? 0,
    }));
    cachedCountById = new Map(index.map((p) => [String(p.id), p.count ?? 0]));
  }
  return { allPlayersList: cachedAllPlayersList, countById: cachedCountById };
}

// data/players/{slug}/information.json から curated profile slug を氏名で引く処理は、
// 結果ページ(count>=5 が対象、約1785ページ)ごとに data/players 配下(約8200件)を
// readdir + 1件ずつ existsSync/readFileSync/JSON.parse で先頭から線形探索していた
// (最悪ケースでページ数×選手数 ≈ 1400万回のファイルI/O)。ここで「姓|名 → slug」の
// Mapをプロセス内で一度だけ構築し、以降はO(1)で引けるようにする。
let cachedProfileSlugByName: Map<string, string> | null = null;

async function getProfileSlugByName(lastName?: string, firstName?: string): Promise<string | null> {
  if (!lastName || !firstName) return null;
  if (!cachedProfileSlugByName) {
    const fs = await import('fs');
    const path = await import('path');
    const map = new Map<string, string>();
    const playersDir = path.join(process.cwd(), 'data', 'players');
    try {
      for (const entry of fs.readdirSync(playersDir)) {
        const infoFile = path.join(playersDir, entry, 'information.json');
        if (!fs.existsSync(infoFile)) continue;
        try {
          const info = JSON.parse(fs.readFileSync(infoFile, 'utf-8')) as {
            lastName?: string;
            firstName?: string;
          };
          if (info.lastName && info.firstName) {
            const key = `${info.lastName}|${info.firstName}`;
            if (!map.has(key)) map.set(key, entry);
          }
        } catch {
          // ignore broken information.json
        }
      }
    } catch {
      // ignore
    }
    cachedProfileSlugByName = map;
  }
  return cachedProfileSlugByName.get(`${lastName}|${firstName}`) ?? null;
}

export const getStaticPaths: GetStaticPaths = async () => {
  // use data/players/index.json ids
  const index = await loadPlayerIndex();

  const paths = index.filter((p) => (p.count ?? 0) >= 5).map((p) => ({ params: { id: String(p.id) } }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const playerId = params?.id as string;

  // read index.json to get name
  const index = await loadPlayerIndex();

  const idx = index.find((it) => String(it.id) === playerId);
  if (!idx) {
    return { notFound: true };
  }

  // prepare allPlayers list from index.json with id as string, and id -> count
  // （結果ページが実在するのは count>=5 のみ。デッドリンク防止に使う）
  const { allPlayersList, countById } = await getAllPlayersListAndCountById();

  // 数値 id → 漢字姓名（国際大会のローマ字参加者を対応表で本人へ寄せる際の表示名解決に使う）
  const idToName = new Map<number, { lastName: string; firstName: string }>();
  for (const p of index) {
    if (!idToName.has(p.id)) idToName.set(p.id, { lastName: p.lastName, firstName: p.firstName });
  }

  // --- Structured loading using shared helpers ---
  const root = process.cwd();
  const tournamentIndex = await loadTournamentIndex(root);
  const tournamentMeta = new Map<string, { label?: string; isMajor?: boolean; generationId?: string }>();
  for (const t of tournamentIndex)
    tournamentMeta.set(t.tournamentId, {
      label: t.label,
      isMajor: !!t.isMajorTitle,
      generationId: t.generationId,
    });
  const informationMap = await loadInformationMap(root);
  const allDetails = await getAllDetailRecords(root);
  // majorTitlesData will be awaited and included in the returned props below

  const playerMatches: PlayerMatch[] = [];
  const teamRecords: { year: number; team: string }[] = [];
  const playerTournamentsMap = new Map<string, PlayerTournament>();
  const partnersMap = new Map<
    string,
    {
      id: string;
      lastName: string;
      firstName: string;
      team: string;
      prefecture: string | null;
    }
  >();
  const tournamentMatchesMap = new Map<string, MatchResult[]>();
  const tournamentFinalResult = new Map<string, string | null>();
  // map tournamentKey -> 当時のその選手の所属（大会ごとに異なりうるので大会単位で保持）
  const tournamentSelfTeam = new Map<string, string>();
  // map tournamentKey -> map of partnerId -> count (to pick most frequent partner for that tournament)
  const tournamentPartnerCounts = new Map<string, Map<string, number>>();

  for (const rec of allDetails) {
    const tournamentId = rec.tournamentId;
    const year = rec.year;
    const category = rec.fileName.replace('.json', '');
    const detail = rec.detail;

    // 国際大会（ローマ字表記のみ）の参加者は、手動対応表(participant-aliases.json)で
    // 本人の数値 id に解決できる場合、表示を漢字名・実所属へ差し替える。これにより
    // 姓名の完全一致でしか拾えていなかった大会一覧に国際大会が現れ、相手/パートナー名も
    // 漢字で表示され本人ページへリンクされる（大会結果ページと同挙動）。共有キャッシュを
    // 汚さないよう、別人物と判定された participant だけ複製して差し替える。
    const rawParticipants = Array.isArray(detail.participants) ? detail.participants : [];
    const participants: TournamentParticipant[] = rawParticipants.map((p) => {
      const aliasedId = resolveAliasedPlayerId(tournamentId, year, p.lastName, p.firstName);
      if (aliasedId === null) return p;
      const realTeam = resolveAliasedTeam(tournamentId, year, p.lastName, p.firstName);
      const kanji = idToName.get(aliasedId);
      return {
        ...p,
        lastName: kanji?.lastName ?? p.lastName,
        firstName: kanji?.firstName ?? p.firstName,
        team: realTeam ?? p.team,
      };
    });
    const participantById = new Map<string, TournamentParticipant>();
    for (const p of participants) participantById.set(p.id, p);

    const matchingParticipantIds = participants.filter((p) => p.lastName === idx.lastName && p.firstName === idx.firstName).map((p) => p.id);
    if (matchingParticipantIds.length === 0) continue;

    // record the player's own team per year (for latest-team resolution)
    const selfParticipant = participantById.get(matchingParticipantIds[0]);
    if (selfParticipant?.team && selfParticipant.team.trim().length > 0) {
      teamRecords.push({
        year: Number(year),
        team: selfParticipant.team.trim(),
      });
      // 大会（tournamentId/year/category）ごとの当時の所属を保持する
      tournamentSelfTeam.set(`${tournamentId}/${year}/${category}`, selfParticipant.team.trim());
    }

    const entries = Array.isArray(detail.entries) ? detail.entries : [];
    const entryByNo = new Map<number, TournamentEntry>();
    for (const e of entries) entryByNo.set(e.entryNo, e);

    for (const e of entries) {
      if (!Array.isArray(e.playerIds)) continue;
      if (e.playerIds.includes(matchingParticipantIds[0])) {
        for (const pid of e.playerIds) {
          if (pid === matchingParticipantIds[0]) continue;
          const partner = participantById.get(pid);
          if (partner && !partnersMap.has(pid))
            partnersMap.set(pid, {
              id: partner.id,
              lastName: partner.lastName,
              firstName: partner.firstName,
              team: partner.team,
              prefecture: partner.prefecture ?? null,
            });
        }
      }
    }

    const matches = Array.isArray(detail.matches) ? detail.matches : [];
    for (const m of matches) {
      if (!Array.isArray(m.entries) || m.entries.length === 0) continue;
      const intersection = m.entries.filter((n) =>
        entries.some((ee) => Array.isArray(ee.playerIds) && ee.playerIds.some((pid) => matchingParticipantIds.includes(pid)) && ee.entryNo === n),
      );
      if (intersection.length === 0) continue;
      const playerEntryNo = intersection[0];
      const opponentEntryNos = m.entries.filter((n) => n !== playerEntryNo);

      const opponentNames: string[] = [];
      const opponents: TournamentParticipant[] = [];

      // collect opponent participants for name formatting only
      for (const o of opponentEntryNos) {
        const oe = entryByNo.get(o);
        if (oe && Array.isArray(oe.playerIds)) {
          for (const pid of oe.playerIds) {
            const p = participantById.get(pid);
            if (p) opponents.push(p);
          }
        }
      }

      // if all opponents (ペア) have the same non-empty team, show team once at the end:
      // e.g. "苗字A・苗字B（チーム名）"
      if (opponents.length > 0) {
        const lastNames = opponents.map((p) => p.lastName);
        const teams = opponents.map((p) => (p.team && p.team.trim().length > 0 ? p.team.trim() : ''));
        const nonEmptyTeams = teams.filter((t) => t.length > 0);
        const allSameTeam = nonEmptyTeams.length > 0 && nonEmptyTeams.length === opponents.length && nonEmptyTeams.every((t) => t === nonEmptyTeams[0]);

        if (allSameTeam && opponents.length > 1) {
          opponentNames.push(`${lastNames.join('・')}（${nonEmptyTeams[0]}）`);
        } else {
          for (let i = 0; i < opponents.length; i++) {
            const team = teams[i] ? `（${teams[i]}）` : '';
            opponentNames.push(`${lastNames[i]}${team}`);
          }
        }
      }

      let score = '';
      if (m.scores && typeof m.scores === 'object') {
        const playerScore = (m.scores as Record<string, number>)[String(playerEntryNo)];
        const oppScore = (m.scores as Record<string, number>)[String(opponentEntryNos[0])];
        if (typeof playerScore === 'number' && typeof oppScore === 'number') score = `${playerScore}-${oppScore}`;
      }

      const resultFlag: 'win' | 'lose' | 'unknown' = typeof m.winnerEntryNo === 'number' ? (m.winnerEntryNo === playerEntryNo ? 'win' : 'lose') : 'unknown';

      let partnerName: string | null = null;
      let partnerId: string | null = null;
      for (const e of entries) {
        if (!Array.isArray(e.playerIds)) continue;
        if (e.playerIds.includes(matchingParticipantIds[0]) && e.playerIds.length > 1) {
          const other = e.playerIds.find((pid) => pid !== matchingParticipantIds[0]);
          if (other) {
            const pp = participantById.get(other);
            if (pp) partnerName = `${pp.lastName}${pp.firstName}`;
            partnerId = other || null;
          }
        }
      }

      const matchResult: MatchResult = {
        round: String(m.round ?? '予選'),
        opponent: opponentNames.length > 0 ? opponentNames.join('・') : opponentEntryNos.length > 0 ? `#${opponentEntryNos[0]}` : '不明',
        result: resultFlag === 'win' ? '勝' : resultFlag === 'lose' ? '敗' : '',
        score: score,
        partner: partnerName ?? null,
      };

      const tournamentKey = `${tournamentId}/${year}/${category}`;
      if (!tournamentMatchesMap.has(tournamentKey)) tournamentMatchesMap.set(tournamentKey, []);
      tournamentMatchesMap.get(tournamentKey)!.push(matchResult);

      // record partner occurrence for this tournament
      if (partnerId) {
        if (!tournamentPartnerCounts.has(tournamentKey)) tournamentPartnerCounts.set(tournamentKey, new Map());
        const cntMap = tournamentPartnerCounts.get(tournamentKey)!;
        cntMap.set(partnerId, (cntMap.get(partnerId) || 0) + 1);
      }

      // Don't include opponents array to reduce data size - opponentNames is sufficient
      playerMatches.push({
        tournamentId,
        category,
        tournamentName: tournamentMeta.get(tournamentId)?.label || tournamentId,
        year: Number(year),
        round: m.round ?? '予選',
        entryNo: playerEntryNo,
        opponentNames,
        opponents: [], // Empty array to maintain type compatibility
        score,
        result: resultFlag,
        partnerId: partnerId ?? null,
      });
    }

    if (Array.isArray(detail.results)) {
      // compute entryNos for the target player in this tournament (could be multiple)
      const targetEntryNos: number[] = [];
      for (const e of entries) {
        if (!Array.isArray(e.playerIds)) continue;
        if (e.playerIds.includes(matchingParticipantIds[0])) targetEntryNos.push(e.entryNo);
      }

      for (const r of detail.results) {
        try {
          // TournamentResult can include entryNo or playerIds or a tournament object with label
          const rec = r as unknown as {
            playerIds?: unknown;
            result?: unknown;
            entryNo?: unknown;
            tournament?: unknown;
            roundrobin?: unknown;
          };
          const recEntryNo = typeof rec.entryNo === 'number' ? rec.entryNo : undefined;
          const playerIdsField = Array.isArray(rec.playerIds) ? (rec.playerIds as string[]) : undefined;
          let isTarget = false;

          // First preference: match by entryNo
          if (typeof recEntryNo === 'number') {
            if (targetEntryNos.includes(recEntryNo)) isTarget = true;
          }

          // Fallback: match by playerIds (legacy)
          if (!isTarget && Array.isArray(playerIdsField) && playerIdsField.some((pid) => matchingParticipantIds.includes(pid))) {
            isTarget = true;
          }

          if (!isTarget) continue;

          let resultField: string | undefined = undefined;
          // Prefer explicit tournament.label when present
          if (rec.tournament && typeof rec.tournament === 'object') {
            try {
              const t = rec.tournament as { label?: unknown };
              if (typeof t.label === 'string' && t.label.trim().length > 0) {
                resultField = t.label;
              }
            } catch {
              // ignore
            }
          } else if (rec.roundrobin && typeof rec.roundrobin === 'object') {
            try {
              const t = rec.roundrobin as { rank?: unknown };
              if (typeof t.rank === 'number') {
                resultField = `予選${t.rank}位`;
              }
            } catch {
              // ignore
            }
          }

          // fallback to legacy result string
          if (!resultField && typeof rec.result === 'string') resultField = rec.result;

          const tournamentKey = `${tournamentId}/${year}/${category}`;
          // if no resultField was found, set default to '不明'
          tournamentFinalResult.set(tournamentKey, resultField ?? '不明');
        } catch {
          // ignore
        }
      }
    }
  }

  // build playerTournaments array with matches
  for (const [tournamentKey, matches] of tournamentMatchesMap.entries()) {
    const [tid, yr, category] = tournamentKey.split('/');
    const yearVal = yr ? (Number(yr) ? Number(yr) : yr) : undefined;
    const infoEntries = informationMap.get(tid) ?? [];
    const infoForYear = infoEntries.find((it) => String(it.year) === String(yearVal));
    const startDateVal = infoForYear ? (infoForYear.startDate ?? null) : null;
    const endDateVal = infoForYear ? (infoForYear.endDate ?? null) : null;
    const dateRange = startDateVal
      ? `${startDateVal}${endDateVal ? ' - ' + endDateVal : ''}`
      : infoForYear
        ? `${infoForYear.startDate ?? ''}${infoForYear.endDate ? ' - ' + infoForYear.endDate : ''}`
        : null;
    const location = infoForYear ? (infoForYear.location ?? null) : null;
    // サイト内の大会ページへリンクする（詳細ファイル名 = gameCategory-ageCategory-gender）
    let link: string | null = null;
    const categoryParts = (category ?? '').split('-');
    if (categoryParts.length >= 3) {
      const gender = categoryParts.pop() as string;
      const ageCategory = categoryParts.pop() as string;
      const gameCategory = categoryParts.join('-');
      const generation = tournamentMeta.get(tid)?.generationId ?? 'unknown';
      link = `/tournaments/${generation}/${tid}/${yr}/${gameCategory}/${ageCategory}/${gender}/`;
    }
    const tournamentName = tournamentMeta.get(tid)?.label || tid;
    const finalResult = tournamentFinalResult.get(tournamentKey) ?? null;

    // determine most frequent partner for this tournament, if any
    let partnerIdForTournament: string | null = null;
    let partnerLiteIdForTournament: string | null = null;
    let partnerNameForTournament: string | null = null;
    const partnerCounts = tournamentPartnerCounts.get(tournamentKey);
    if (partnerCounts) {
      let max = 0;
      for (const [pid, c] of partnerCounts.entries()) {
        if (c > max) {
          max = c;
          partnerIdForTournament = pid;
        }
      }
      if (partnerIdForTournament) {
        const p = partnersMap.get(partnerIdForTournament);
        if (p) {
          // try to map partner to canonical id from allPlayersList (index.json)
          const found = allPlayersList.find((ap) => ap.lastName === p.lastName && ap.firstName === p.firstName);
          if (found) {
            partnerNameForTournament = `${p.lastName}${p.firstName}`;
            // 結果ページが実在する（count>=5）選手のみページへリンク化する。
            // 無い選手に results リンクを付けると 404 になるため、その場合は
            // partnerLiteId にだけ id を入れてモーダル（PlayerLiteLink）で表示する。
            if ((countById.get(found.id) ?? 0) >= 5) {
              partnerIdForTournament = found.id;
            } else {
              // 結果ページが無い選手。生の参加者 id が partnerIdForTournament に
              // 残っていると /players/{生id}/results へのデッドリンクになるので null にし、
              // モーダル用の partnerLiteId にだけ canonical id を入れる。
              partnerIdForTournament = null;
              partnerLiteIdForTournament = found.id;
            }
          } else {
            // if not found in canonical list, set partnerId to null (explicitly indicate unknown id)
            partnerNameForTournament = `${p.lastName}${p.firstName}`;
            partnerIdForTournament = null;
          }
        } else {
          // partner not in partnersMap: cannot resolve name, clear id
          partnerNameForTournament = null;
          partnerIdForTournament = null;
        }
      }
    }

    const info: PlayerTournament = {
      id: tournamentKey,
      tournamentId: tid,
      year: yearVal,
      tournamentName,
      team: tournamentSelfTeam.get(tournamentKey) ?? null,
      dateRange,
      startDate: startDateVal,
      endDate: endDateVal,
      location,
      link,
      finalResult,
      partnerId: partnerIdForTournament,
      partnerLiteId: partnerLiteIdForTournament,
      partnerName: partnerNameForTournament,
      matches,
    };
    playerTournamentsMap.set(tournamentKey, info);
  }

  const playerTournaments = Array.from(playerTournamentsMap.values());
  // detailed playerStats: aggregate by partner and by year
  const totalMatches = playerMatches.length;
  const wins = playerMatches.filter((m) => m.result === 'win').length;
  const losses = playerMatches.filter((m) => m.result === 'lose').length;

  const games = { total: 0, won: 0, lost: 0, gameRate: 0 };

  type Agg = {
    matches: { total: number; wins: number; losses: number };
    games: { total: number; won: number; lost: number };
  };

  const byPartner: Record<string, Agg> = {};
  const byYear: Record<string, Agg> = {};

  const findPlayerIdByName = (lastName: string, firstName: string) => {
    const found = allPlayersList.find((p) => p.lastName === lastName && p.firstName === firstName);
    return found ? found.id : undefined;
  };

  const getYearForTournament = (tournamentKeyOrId: string) => {
    // tournamentKeyOrId can be either 'tournamentId/year' or the old file key
    const info = playerTournamentsMap.get(tournamentKeyOrId) ?? playerTournamentsMap.get(String(tournamentKeyOrId));
    // prefer explicit year field if present
    if (info && info.year) return String(info.year);
    const dateRange = info?.dateRange || '';
    const fromDateMatch = String(dateRange).match(/(19|20)\d{2}/);
    if (fromDateMatch) return fromDateMatch[0];
    const fileYearMatch = String(tournamentKeyOrId).match(/(19|20)\d{2}/);
    if (fileYearMatch) return fileYearMatch[0];
    return 'unknown';
  };

  for (const m of playerMatches) {
    // parse games from score
    if (m.score) {
      const parts = m.score.split('-').map((s) => Number(s));
      if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
        games.won += parts[0];
        games.lost += parts[1];
        games.total += parts[0] + parts[1];
      }
    }

    // partner key: try to map by last+first to canonical player id, else use combined name; singles -> 'singles'
    let partnerKey = 'singles';
    if (m.partnerId) {
      const partner = partnersMap.get(m.partnerId);
      if (partner) {
        const maybeId = findPlayerIdByName(partner.lastName, partner.firstName);
        partnerKey = maybeId ?? `${partner.lastName}${partner.firstName}`;
      } else {
        partnerKey = m.partnerId;
      }
    }

    if (!byPartner[partnerKey]) {
      byPartner[partnerKey] = {
        matches: { total: 0, wins: 0, losses: 0 },
        games: { total: 0, won: 0, lost: 0 },
      };
    }

    byPartner[partnerKey].matches.total += 1;
    if (m.result === 'win') byPartner[partnerKey].matches.wins += 1;
    else if (m.result === 'lose') byPartner[partnerKey].matches.losses += 1;

    if (m.score) {
      const parts = m.score.split('-').map((s) => Number(s));
      if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
        byPartner[partnerKey].games.won += parts[0];
        byPartner[partnerKey].games.lost += parts[1];
        byPartner[partnerKey].games.total += parts[0] + parts[1];
      }
    }

    // year aggregation: prefer explicit m.year, otherwise ask map using tournamentKey
    const tournamentKey = m.year ? `${m.tournamentId}/${m.year}` : String(m.tournamentId);
    const year = m.year ? String(m.year) : getYearForTournament(tournamentKey);
    if (!byYear[year]) {
      byYear[year] = {
        matches: { total: 0, wins: 0, losses: 0 },
        games: { total: 0, won: 0, lost: 0 },
      };
    }
    byYear[year].matches.total += 1;
    if (m.result === 'win') byYear[year].matches.wins += 1;
    else if (m.result === 'lose') byYear[year].matches.losses += 1;
    if (m.score) {
      const parts = m.score.split('-').map((s) => Number(s));
      if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
        byYear[year].games.won += parts[0];
        byYear[year].games.lost += parts[1];
        byYear[year].games.total += parts[0] + parts[1];
      }
    }
  }

  // compute gameRate for overall and per-category
  games.gameRate = games.total > 0 ? games.won / games.total : 0;
  const normalizeStats = (s: Agg) => ({
    matches: {
      total: s.matches.total,
      wins: s.matches.wins,
      losses: s.matches.losses,
      winRate: s.matches.total > 0 ? s.matches.wins / s.matches.total : 0,
    },
    games: {
      total: s.games.total,
      won: s.games.won,
      lost: s.games.lost,
      gameRate: s.games.total > 0 ? s.games.won / s.games.total : 0,
    },
  });
  const byPartnerNormalized: Record<string, { matches: MatchStatsType; games: GamesType }> = {};
  for (const k of Object.keys(byPartner)) {
    byPartnerNormalized[k] = normalizeStats(byPartner[k]);
  }
  const byYearNormalized: Record<string, { matches: MatchStatsType; games: GamesType }> = {};
  for (const k of Object.keys(byYear)) {
    byYearNormalized[k] = normalizeStats(byYear[k]);
  }

  const playerStats = {
    playerId,
    totalMatches,
    wins,
    losses,
    totalWinRate: totalMatches > 0 ? wins / totalMatches : 0,
    games,
    byPartner: byPartnerNormalized,
    byYear: byYearNormalized,
  };

  // Build minimal allPlayers list - only include partners referenced in stats
  const referencedPartnerIds = new Set(Object.keys(byPartnerNormalized).filter((k) => k !== 'singles'));
  const minimalPlayersList = allPlayersList.filter((p) => referencedPartnerIds.has(p.id));

  // 関連選手（主なペア）: byPartner を試合数で降順に並べ、
  // 結果ページを持つ選手（index.json の count>=5）のみリンク対象にする。
  const partnerNameById = new Map(allPlayersList.map((p) => [p.id, `${p.lastName}${p.firstName}`]));
  const relatedPlayers = Object.entries(byPartnerNormalized)
    .filter(([k]) => k !== 'singles')
    .map(([id, agg]) => ({
      id,
      name: partnerNameById.get(id) ?? '',
      total: agg.matches.total,
      wins: agg.matches.wins,
      losses: agg.matches.losses,
      hasPage: (countById.get(id) ?? 0) >= 5,
    }))
    .filter((p) => p.name !== '')
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // latest team (most recent year wins)
  const team = teamRecords.length > 0 ? teamRecords.sort((a, b) => a.year - b.year).slice(-1)[0].team : null;

  // activity dates from tournament information (real freshness signals)
  const activityDates = playerTournaments
    .map((t) => t.endDate ?? t.startDate)
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .sort();
  const firstActivityDate = activityDates[0] ?? null;
  const latestActivityDate = activityDates[activityDates.length - 1] ?? null;

  // resolve curated profile slug (data/players/{slug}/information.json) if any
  const profileSlug = await getProfileSlugByName(idx.lastName, idx.firstName);

  // ショーケース対象（data/growth-featured.json）なら成長記録ページ slug を引く（ADR-004）。
  let growthShowcaseSlug: string | null = null;
  try {
    const fs = await import('fs');
    const path = await import('path');
    const featuredPath = path.join(process.cwd(), 'data', 'growth-featured.json');
    const featuredPayload = JSON.parse(fs.readFileSync(featuredPath, 'utf-8')) as {
      featured?: Array<{ slug?: string; playerId?: string | number }>;
    };
    const featuredEntry = (featuredPayload.featured ?? []).find((entry) => entry?.playerId != null && String(entry.playerId) === playerId);
    growthShowcaseSlug = featuredEntry?.slug ?? null;
  } catch {
    // featured 設定が無い/壊れている場合は導線を出さない
  }

  // --- SEO: 薄い選手ページの noindex 判定 ---
  // 「クロール済み - インデックス未登録」対策として、収録試合が薄く、かつ
  // 全国高校大会（generation = 'highschool'）の出場歴も無い選手ページを noindex にし、
  // 内容の厚いページ・全国高校大会出場選手にインデックス枠を集中させる。
  // 全国高校大会出場選手（有名校の主力選手を含む）は試合数に関わらず常にインデックス対象とする。
  // sitemap からの除外は postbuild（scripts/filter-noindex-from-sitemap.mjs）が
  // 生成 HTML の robots meta を読んで自動的に行うため、判定はこの 1 箇所に集約する。
  const PLAYER_INDEX_MIN_MATCHES = 15;
  const hasHighschoolNational = playerMatches.some((m) => tournamentMeta.get(m.tournamentId)?.generationId === 'highschool');
  const shouldIndex = totalMatches >= PLAYER_INDEX_MIN_MATCHES || hasHighschoolNational;

  // Player Statistics Engine（facade）を併用し新データを追加提供する（P5・非破壊）。
  // 既存の playerMatches/playerTournaments 等の表示ロジックはそのまま維持する。
  // ビルド時は prebuild が生成した _facts/_index/rankings を読む（freshness:'cache'）。
  let playerStatistics: import('@/types/playerStatistics').PlayerStatistics | null = null;
  try {
    playerStatistics = await getPlayerStatistics(Number(playerId), {}, root);
  } catch {
    playerStatistics = null;
  }

  // サマリー（試合数・勝敗・ゲーム・パートナー別・年度別）はエンジンの集計を正とする。
  // エンジンが使えない場合のみ、従来のページ内集計にフォールバックする。
  const summaryStats = playerStatistics ? toSummaryStats(playerId, playerStatistics) : playerStats;

  // H2H 相手のうち結果ページが実在する（count>=5）選手のみリンク化する。
  const statsLinkableIds = (playerStatistics?.headToHead ?? [])
    .map((h) => h.opponentId)
    .filter((id): id is number => id != null && (countById.get(String(id)) ?? 0) >= 5);

  // 大会別成績の各行を大会ハブページ（/tournaments/{generation}/{tournamentId}/）へ
  // リンクするための generation 解決マップ。tournamentMeta は index.json / local_index.json
  // 由来なので、ここに載る tid は必ずハブページ（generationId ?? 'unknown'）が生成される
  // ＝デッドリンクにならない。ハブ側 getStaticPaths のフォールバックに合わせて 'unknown' を補完する。
  const tournamentGenerationMap: Record<string, string> = {};
  for (const t of playerStatistics?.byTournament ?? []) {
    if (tournamentMeta.has(t.tournamentId)) {
      tournamentGenerationMap[t.tournamentId] = tournamentMeta.get(t.tournamentId)?.generationId ?? 'unknown';
    }
  }

  return {
    props: {
      playerId,
      noindex: !shouldIndex,
      lastName: idx.lastName,
      firstName: idx.firstName,
      team,
      profileSlug,
      firstActivityDate,
      latestActivityDate,
      playerMatches,
      playerTournaments,
      playerStats: summaryStats,
      playerStatistics,
      statsLinkableIds,
      tournamentGenerationMap,
      allPlayers: minimalPlayersList,
      relatedPlayers,
      majorTitlesData: await getMajorTitlesForPlayer(idx.lastName, idx.firstName),
      scoreMatchLinks: getScoreMatchLinksForPlayer(playerId),
      growthShowcaseSlug,
    },
  };
};
