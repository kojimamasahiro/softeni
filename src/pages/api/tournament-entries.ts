import fs from 'fs';
import path from 'path';

import type { NextApiRequest, NextApiResponse } from 'next';

import { isScoreSiteMode } from '@/lib/siteConfig';

// 試合作成画面（dev 専用）向け: 掲載大会のエントリー一覧を返す。
// data/tournaments/details/{tournamentId}/{year}/{categoryId}.json から
// entryNo と選手情報を組み立てる。
// このルートは静的 export には含まれず、開発サーバーでのみ機能する。
// 仕様: docs/wiki/score-site-link.md

interface EntryOptionPlayer {
  last_name: string;
  first_name: string;
  team_name: string;
  region: string;
}

export interface TournamentEntryOption {
  entryNo: number;
  label: string;
  players: EntryOptionPlayer[];
}

interface DetailParticipant {
  id: string;
  lastName?: string;
  firstName?: string;
  team?: string;
  prefecture?: string;
}

interface DetailEntry {
  entryNo: number;
  playerIds?: string[];
}

const isSafeSegment = (value: string) => /^[\w-]+$/.test(value);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (isScoreSiteMode()) {
    return res.status(404).json({ error: 'Not found.' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const tournamentId = String(req.query.tournamentId ?? '');
  const year = String(req.query.year ?? '');
  const categoryId = String(req.query.categoryId ?? '');

  if (!tournamentId || !year || !categoryId) {
    return res.status(400).json({ error: 'tournamentId, year, categoryId are required.' });
  }

  // パストラバーサル対策（外部入力をパスに使うため）
  if (!isSafeSegment(tournamentId) || !/^\d{4}$/.test(year) || !isSafeSegment(categoryId)) {
    return res.status(400).json({ error: 'Invalid parameter format.' });
  }

  const detailPath = path.join(process.cwd(), 'data', 'tournaments', 'details', tournamentId, year, `${categoryId}.json`);

  if (!fs.existsSync(detailPath)) {
    return res.status(200).json({ entries: [] });
  }

  try {
    const detail = JSON.parse(fs.readFileSync(detailPath, 'utf-8')) as {
      participants?: DetailParticipant[];
      entries?: DetailEntry[];
    };

    const participantById = new Map<string, DetailParticipant>((detail.participants ?? []).map((participant) => [participant.id, participant]));

    const entries: TournamentEntryOption[] = (detail.entries ?? [])
      .map((entry) => {
        const players: EntryOptionPlayer[] = (entry.playerIds ?? [])
          .map((id) => participantById.get(id))
          .filter((p): p is DetailParticipant => Boolean(p))
          .map((p) => ({
            last_name: p.lastName ?? '',
            first_name: p.firstName ?? '',
            team_name: p.team ?? '',
            region: p.prefecture ?? '',
          }));

        const label = `${entry.entryNo} ${players.map((p) => `${p.last_name}${p.first_name}`).join('・')}`;

        return { entryNo: entry.entryNo, label, players };
      })
      .filter((entry) => entry.players.length > 0)
      .sort((a, b) => a.entryNo - b.entryNo);

    return res.status(200).json({ entries });
  } catch (error) {
    console.error('Failed to load tournament entries:', error);
    return res.status(500).json({ error: 'Failed to load entries.' });
  }
}
