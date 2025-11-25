// pages/api/players/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';

import type { TournamentDetailData } from '@/types';
import type {
  TournamentEntry,
  TournamentParticipant,
} from '@/types/tournament';

interface PlayerResult {
  firstName: string;
  lastName: string;
  fullName: string;
  team: string;
  prefecture?: string | null;
  result: string;
  tournamentName: string;
  tournamentId: string;
  generation: string;
  year: string;
  gameCategory: string;
  ageCategory: string;
  gender: string;
  categoryLabel: string;
  playerId?: string | null;
}

interface SameNameGroup {
  fullName: string;
  players: PlayerResult[];
  count: number;
  differentTeams: string[];
  playerId?: string | null;
}

// ".json" を削除して "-" で分割するヘルパー
const parseCombinedCategory = (raw?: string | null) => {
  if (!raw) return { gameCategory: '', ageCategory: 'none', gender: 'none' };
  const cleaned = String(raw).replace(/\.json$/i, '');
  const parts = cleaned.split('-');
  if (parts.length >= 3) {
    return {
      gameCategory: parts[0] || '',
      ageCategory: parts[1] || 'none',
      gender: parts[2] || 'none',
    };
  }
  return { gameCategory: cleaned, ageCategory: 'none', gender: 'none' };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get minMatchCount from query params, default to 2
  const minMatchCount = parseInt(
    (req.query.minMatchCount as string) || '2',
    10,
  );

  if (isNaN(minMatchCount) || minMatchCount < 1) {
    return res.status(400).json({ error: 'Invalid minMatchCount parameter' });
  }

  try {
    const fs = await import('fs');
    const path = await import('path');

    // Use tournamentData helper to read parsed detail records
    const tournamentData = await import('../../../../lib/tournamentData');
    const records = await tournamentData.getAllDetailRecords(process.cwd());
    const informationMap = await tournamentData.loadInformationMap(process.cwd());

    // Load base player index (data/players/index.json)
    const playersIndexPath = path.join(
      process.cwd(),
      'data',
      'players',
      'index.json',
    );
    let playersIndex: Array<{
      id: number | string;
      lastName: string;
      firstName: string;
    }> = [];
    if (fs.existsSync(playersIndexPath)) {
      try {
        playersIndex = JSON.parse(fs.readFileSync(playersIndexPath, 'utf-8'));
      } catch {
        playersIndex = [];
      }
    }

    // Build a map from lastName::firstName -> array of player ids (from index.json)
    const indexMap = new Map<string, Array<number | string>>();
    const makeNameKey = (last?: string | null, first?: string | null) => {
      return `${String(last || '')}::${String(first || '')}`;
    };
    for (const p of playersIndex) {
      const key = makeNameKey(p.lastName, p.firstName);
      if (!indexMap.has(key)) indexMap.set(key, []);
      indexMap.get(key)!.push(p.id);
    }

    const playerMap = new Map<string, PlayerResult[]>();
    const participantNameSet = new Set<string>();

    for (const r of records) {
      const tournamentId = r.tournamentId;
      const year = r.year;
      const detail = r.detail as TournamentDetailData;
      const categoryInfo = parseCombinedCategory(r.fileName);
      const categoryId = String(r.fileName).replace(/\.json$/i, '');
      let humanLabel = undefined as string | undefined;
      try {
        const infoEntries = informationMap.get(r.tournamentId);
        if (infoEntries && Array.isArray(infoEntries)) {
          const yr = parseInt(year, 10);
          const infoForYear = infoEntries.find((ie) => Number(ie.year) === yr);
          if (infoForYear && Array.isArray(infoForYear.categories)) {
            const matchA = categoryId;
            const matchB = String(categoryId);
            const cat = infoForYear.categories.find(
              (c) => c.categoryId === matchA || c.categoryId === matchB,
            );
            if (cat && cat.label) humanLabel = cat.label;
          }
        }
      } catch {
        humanLabel = undefined;
      }

      const participants: TournamentParticipant[] = Array.isArray(
        detail.participants,
      )
        ? (detail.participants as TournamentParticipant[])
        : [];
      const participantById = new Map<string, TournamentParticipant>();
      const participantByName = new Map<string, TournamentParticipant>();
      for (const p of participants) {
        if (p && p.id) participantById.set(String(p.id), p);
        if (p && p.lastName && p.firstName) {
          const key = makeNameKey(p.lastName, p.firstName);
          participantByName.set(key, p);
          participantNameSet.add(key);
        }
      }
      const entries: TournamentEntry[] = Array.isArray(detail.entries)
        ? (detail.entries as TournamentEntry[])
        : [];
      const entryByNo = new Map<number, TournamentEntry>();
      for (const e of entries) {
        entryByNo.set(e.entryNo, e);
      }

      if (detail.results && Array.isArray(detail.results)) {
        for (const res of detail.results) {
          let resultPlayerIds: string[] | undefined;
          if (typeof res.entryNo === 'number' && entryByNo.has(res.entryNo)) {
            const ent = entryByNo.get(res.entryNo);
            resultPlayerIds = ent?.playerIds;
          }

          if (Array.isArray(resultPlayerIds)) {
            for (const pid of resultPlayerIds) {
              const participant = participantById.get(pid);
              if (!participant?.lastName || !participant?.firstName) continue;
              const nameKey = makeNameKey(
                participant?.lastName || '',
                participant?.firstName || '',
              );
              if (!indexMap.has(nameKey)) continue;
              const playerResult: PlayerResult = {
                firstName: participant?.firstName || '',
                lastName: participant?.lastName || '',
                fullName: `${participant?.lastName || ''}${participant?.firstName || ''}`,
                team: participant?.team || '所属不明',
                result: res.tournament?.label || '予選敗退',
                tournamentName: r.tournamentName || '大会名不明',
                tournamentId,
                generation: r.generation || 'all',
                year,
                gameCategory: categoryInfo.gameCategory,
                ageCategory: categoryInfo.ageCategory,
                gender: categoryInfo.gender,
                categoryLabel:
                  humanLabel ??
                  `${categoryInfo.gameCategory}-${categoryInfo.ageCategory}-${categoryInfo.gender}`,
                playerId: String(indexMap.get(nameKey)![0]),
              };
              if (!playerMap.has(nameKey)) playerMap.set(nameKey, []);
              playerMap.get(nameKey)!.push(playerResult);
            }
          }
        }
      }
    }

    const sameNameGroups: SameNameGroup[] = [];
    for (const [, players] of playerMap.entries()) {
      const fullName = `${players[0].fullName}`;
      const uniquePlayersArray = players.slice();
      const differentTeams = [
        ...new Set(uniquePlayersArray.map((p) => p.team)),
      ];
      sameNameGroups.push({
        fullName,
        players: uniquePlayersArray.map((p) => ({
          ...p,
          playerId: p.playerId ?? null,
        })),
        count: uniquePlayersArray.length,
        differentTeams,
        playerId:
          uniquePlayersArray.find((p) => p.playerId)?.playerId ?? undefined,
      });
    }

    // Filter by minMatchCount
    const filteredGroups = sameNameGroups.filter(
      (group) => group.count >= minMatchCount,
    );

    // Set cache headers for better performance
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );

    return res.status(200).json({ sameNameGroups: filteredGroups });
  } catch (error) {
    console.error('Error generating player data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
