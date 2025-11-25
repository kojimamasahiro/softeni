// src/pages/players/[id]/results.tsx
/* eslint-disable prettier/prettier */

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MajorTitles from '@/components/MajorTitles';
import MetaHead from '@/components/MetaHead';
import PlayerResults, {
  PlayerMatch,
  PlayerTournament,
} from '@/components/PlayerResults';
import PlayerSummaryStats from '@/components/PlayerSummaryStats';
import { getMajorTitlesForPlayer, MajorTitleData } from '@/lib/majorTitles';
import {
  getAllDetailRecords,
  loadInformationMap,
  loadTournamentIndex,
} from '@/lib/tournamentData';
import { MatchResult } from '@/types/common';
import type {
  Games as GamesType,
  MatchStats as MatchStatsType,
} from '@/types/stats';
import { TournamentEntry, TournamentParticipant } from '@/types/tournament';

type PlayerResultsProps = {
  playerId: string;
  lastName: string;
  firstName: string;
  playerMatches: PlayerMatch[];
  playerTournaments: PlayerTournament[];
  majorTitlesData: MajorTitleData[];
  playerStats?: import('@/types/stats').PlayerStats | null;
  allPlayers?: import('@/types/player').PlayerInfo[];
};

export default function PlayerResultsPage({
  playerId,
  lastName,
  firstName,
  playerMatches,
  playerTournaments,
  majorTitlesData,
  playerStats,
  allPlayers,
}: PlayerResultsProps) {
  const fullName = `${lastName}${firstName}`;
  const pageUrl = `https://softeni-pick.com/players/${playerId}/results`;

  return (
    <>
      <MetaHead
        title={`${fullName} 試合結果 | ソフトテニス情報`}
        description={`${fullName}の主要大会結果や試合速報を掲載`}
        url={pageUrl}
        type="article"
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: `${fullName}の試合結果・大会成績`,
              author: {
                '@type': 'Person',
                name: 'Softeni Pick',
              },
              publisher: {
                '@type': 'Organization',
                name: 'Softeni Pick',
              },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': pageUrl,
              },
              description: `${fullName}の主要大会結果や試合速報を掲載`,
              about: {
                '@type': 'Person',
                name: fullName,
                url: pageUrl,
              },
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
                  item: 'https://softeni-pick.com/players',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: `試合結果`,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-10">
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
            <h1 className="text-2xl font-bold">{fullName} 選手の試合結果</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              本ページでは、{fullName}{' '}
              選手の出場大会や成績、主な勝ち上がり情報を掲載しています。
            </p>
          </header>

          {/* 主な成績（タイトル）(再現未実装) */}
          <section>
            <MajorTitles majorTitlesData={majorTitlesData} />
          </section>

          <div className="text-right">
            <Link
              href="/tournaments"
              className="text-sm text-blue-600 hover:underline"
            >
              大会結果一覧はこちら
            </Link>
          </div>

          <section>
            {playerStats && (
              <PlayerSummaryStats
                playerStats={playerStats}
                allPlayers={allPlayers || []}
              />
            )}
          </section>

          <section>
            <PlayerResults
              playerMatches={playerMatches}
              playerTournaments={playerTournaments}
            />
          </section>
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const fs = await import('fs');
  const path = await import('path');

  // use data/players/index.json ids
  const indexPath = path.join(process.cwd(), 'data', 'players', 'index.json');
  const entriesRaw = fs.readFileSync(indexPath, 'utf-8');
  const index = JSON.parse(entriesRaw) as Array<{ id: number }>;

  const paths = index.map((p) => ({ params: { id: String(p.id) } }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const playerId = params?.id as string;

  // read index.json to get name
  const fs = await import('fs');
  const path = await import('path');
  const indexPath = path.join(process.cwd(), 'data', 'players', 'index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as Array<{
    id: number;
    lastName: string;
    firstName: string;
  }>;

  const idx = index.find((it) => String(it.id) === playerId);
  if (!idx) {
    return { notFound: true };
  }

  // prepare allPlayers list from index.json with id as string
  const allPlayersList = index.map((p) => ({
    id: String(p.id),
    lastName: p.lastName,
    firstName: p.firstName,
  }));

  // --- Structured loading using shared helpers ---
  const root = process.cwd();
  const tournamentIndex = await loadTournamentIndex(root);
  const tournamentMeta = new Map<
    string,
    { label?: string; isMajor?: boolean }
  >();
  for (const t of tournamentIndex)
    tournamentMeta.set(t.tournamentId, {
      label: t.label,
      isMajor: !!t.isMajorTitle,
    });
  const informationMap = await loadInformationMap(root);
  const allDetails = await getAllDetailRecords(root);
  // majorTitlesData will be awaited and included in the returned props below

  const playerMatches: PlayerMatch[] = [];
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
  // map tournamentKey -> map of partnerId -> count (to pick most frequent partner for that tournament)
  const tournamentPartnerCounts = new Map<string, Map<string, number>>();

  for (const rec of allDetails) {
    const tournamentId = rec.tournamentId;
    const year = rec.year;
    const detail = rec.detail;

    const participants = Array.isArray(detail.participants)
      ? detail.participants
      : [];
    const participantById = new Map<string, TournamentParticipant>();
    for (const p of participants) participantById.set(p.id, p);

    const matchingParticipantIds = participants
      .filter(
        (p) => p.lastName === idx.lastName && p.firstName === idx.firstName,
      )
      .map((p) => p.id);
    if (matchingParticipantIds.length === 0) continue;

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
        entries.some(
          (ee) =>
            Array.isArray(ee.playerIds) &&
            ee.playerIds.some((pid) => matchingParticipantIds.includes(pid)) &&
            ee.entryNo === n,
        ),
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
        const teams = opponents.map((p) =>
          p.team && p.team.trim().length > 0 ? p.team.trim() : '',
        );
        const nonEmptyTeams = teams.filter((t) => t.length > 0);
        const allSameTeam =
          nonEmptyTeams.length > 0 &&
          nonEmptyTeams.length === opponents.length &&
          nonEmptyTeams.every((t) => t === nonEmptyTeams[0]);

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
        const playerScore = (m.scores as Record<string, number>)[
          String(playerEntryNo)
        ];
        const oppScore = (m.scores as Record<string, number>)[
          String(opponentEntryNos[0])
        ];
        if (typeof playerScore === 'number' && typeof oppScore === 'number')
          score = `${playerScore}-${oppScore}`;
      }

      const resultFlag: 'win' | 'lose' | 'unknown' =
        typeof m.winnerEntryNo === 'number'
          ? m.winnerEntryNo === playerEntryNo
            ? 'win'
            : 'lose'
          : 'unknown';

      let partnerName: string | null = null;
      let partnerId: string | null = null;
      for (const e of entries) {
        if (!Array.isArray(e.playerIds)) continue;
        if (
          e.playerIds.includes(matchingParticipantIds[0]) &&
          e.playerIds.length > 1
        ) {
          const other = e.playerIds.find(
            (pid) => pid !== matchingParticipantIds[0],
          );
          if (other) {
            const pp = participantById.get(other);
            if (pp) partnerName = `${pp.lastName}${pp.firstName}`;
            partnerId = other || null;
          }
        }
      }

      const matchResult: MatchResult = {
        round: String(m.round ?? '予選'),
        opponent:
          opponentNames.length > 0
            ? opponentNames.join('・')
            : opponentEntryNos.length > 0
              ? `#${opponentEntryNos[0]}`
              : '不明',
        result: resultFlag === 'win' ? '勝' : resultFlag === 'lose' ? '敗' : '',
        score: score,
        partner: partnerName ?? null,
      };

      const tournamentKey = `${tournamentId}/${year}`;
      if (!tournamentMatchesMap.has(tournamentKey))
        tournamentMatchesMap.set(tournamentKey, []);
      tournamentMatchesMap.get(tournamentKey)!.push(matchResult);

      // record partner occurrence for this tournament
      if (partnerId) {
        if (!tournamentPartnerCounts.has(tournamentKey))
          tournamentPartnerCounts.set(tournamentKey, new Map());
        const cntMap = tournamentPartnerCounts.get(tournamentKey)!;
        cntMap.set(partnerId, (cntMap.get(partnerId) || 0) + 1);
      }

      // Don't include opponents array to reduce data size - opponentNames is sufficient
      playerMatches.push({
        tournamentId,
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
        if (e.playerIds.includes(matchingParticipantIds[0]))
          targetEntryNos.push(e.entryNo);
      }

      for (const r of detail.results) {
        try {
          // TournamentResult can include entryNo or playerIds or a tournament object with label
          const rec = r as unknown as {
            playerIds?: unknown;
            result?: unknown;
            entryNo?: unknown;
            tournament?: unknown;
          };
          const recEntryNo =
            typeof rec.entryNo === 'number' ? rec.entryNo : undefined;
          const playerIdsField = Array.isArray(rec.playerIds)
            ? (rec.playerIds as string[])
            : undefined;
          let isTarget = false;

          // First preference: match by entryNo
          if (typeof recEntryNo === 'number') {
            if (targetEntryNos.includes(recEntryNo)) isTarget = true;
          }

          // Fallback: match by playerIds (legacy)
          if (
            !isTarget &&
            Array.isArray(playerIdsField) &&
            playerIdsField.some((pid) => matchingParticipantIds.includes(pid))
          ) {
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
          }

          // fallback to legacy result string
          if (!resultField && typeof rec.result === 'string')
            resultField = rec.result;

          const tournamentKey = `${tournamentId}/${year}`;
          // if no resultField was found, set default to '予選敗退'
          tournamentFinalResult.set(tournamentKey, resultField ?? '予選敗退');
        } catch {
          // ignore
        }
      }
    }
  }

  // build playerTournaments array with matches
  for (const [tournamentKey, matches] of tournamentMatchesMap.entries()) {
    const [tid, yr] = tournamentKey.split('/');
    const yearVal = yr ? (Number(yr) ? Number(yr) : yr) : undefined;
    const infoEntries = informationMap.get(tid) ?? [];
    const infoForYear = infoEntries.find(
      (it) => String(it.year) === String(yearVal),
    );
    const startDateVal = infoForYear ? (infoForYear.startDate ?? null) : null;
    const endDateVal = infoForYear ? (infoForYear.endDate ?? null) : null;
    const dateRange = startDateVal
      ? `${startDateVal}${endDateVal ? ' - ' + endDateVal : ''}`
      : infoForYear
        ? `${infoForYear.startDate ?? ''}${infoForYear.endDate ? ' - ' + infoForYear.endDate : ''}`
        : null;
    const location = infoForYear ? (infoForYear.location ?? null) : null;
    const link = infoForYear ? (infoForYear.sourceUrl ?? null) : null;
    const tournamentName = tournamentMeta.get(tid)?.label || tid;
    const finalResult = tournamentFinalResult.get(tournamentKey) ?? null;

    // determine most frequent partner for this tournament, if any
    let partnerIdForTournament: string | null = null;
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
          const found = allPlayersList.find(
            (ap) => ap.lastName === p.lastName && ap.firstName === p.firstName,
          );
          if (found) {
            partnerIdForTournament = found.id; // use canonical id
            partnerNameForTournament = `${p.lastName}${p.firstName}`;
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
      dateRange,
      startDate: startDateVal,
      endDate: endDateVal,
      location,
      link,
      finalResult,
      partnerId: partnerIdForTournament,
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
    const found = allPlayersList.find(
      (p) => p.lastName === lastName && p.firstName === firstName,
    );
    return found ? found.id : undefined;
  };

  const getYearForTournament = (tournamentKeyOrId: string) => {
    // tournamentKeyOrId can be either 'tournamentId/year' or the old file key
    const info =
      playerTournamentsMap.get(tournamentKeyOrId) ??
      playerTournamentsMap.get(String(tournamentKeyOrId));
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
      if (
        parts.length === 2 &&
        !Number.isNaN(parts[0]) &&
        !Number.isNaN(parts[1])
      ) {
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
      if (
        parts.length === 2 &&
        !Number.isNaN(parts[0]) &&
        !Number.isNaN(parts[1])
      ) {
        byPartner[partnerKey].games.won += parts[0];
        byPartner[partnerKey].games.lost += parts[1];
        byPartner[partnerKey].games.total += parts[0] + parts[1];
      }
    }

    // year aggregation: prefer explicit m.year, otherwise ask map using tournamentKey
    const tournamentKey = m.year
      ? `${m.tournamentId}/${m.year}`
      : String(m.tournamentId);
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
      if (
        parts.length === 2 &&
        !Number.isNaN(parts[0]) &&
        !Number.isNaN(parts[1])
      ) {
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
  const byPartnerNormalized: Record<
    string,
    { matches: MatchStatsType; games: GamesType }
  > = {};
  for (const k of Object.keys(byPartner)) {
    byPartnerNormalized[k] = normalizeStats(byPartner[k]);
  }
  const byYearNormalized: Record<
    string,
    { matches: MatchStatsType; games: GamesType }
  > = {};
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
  const referencedPartnerIds = new Set(Object.keys(byPartnerNormalized).filter(k => k !== 'singles'));
  const minimalPlayersList = allPlayersList.filter(p => referencedPartnerIds.has(p.id));

  return {
    props: {
      playerId,
      lastName: idx.lastName,
      firstName: idx.firstName,
      playerMatches,
      playerTournaments,
      playerStats,
      allPlayers: minimalPlayersList,
      majorTitlesData: await getMajorTitlesForPlayer(
        idx.lastName,
        idx.firstName,
      ),
    },
  };
};
