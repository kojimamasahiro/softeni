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

interface TeamMemberCandidate {
  last_name: string;
  first_name: string;
  /** そのチーム名で個人戦に出た最後の年（候補の並び順と表示に使う） */
  last_year: number;
}

export interface TournamentEntryOption {
  entryNo: number;
  label: string;
  players: EntryOptionPlayer[];
  /** 団体戦のエントリーだけが持つ。同じチーム名で個人戦に出た選手（ADR-023） */
  members?: TeamMemberCandidate[];
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

// チーム名の比較キー（全角・半角と空白の揺れだけを吸収する。scripts/pdf/team_match_details.py の key_of と同じ）
const teamKey = (value: string) => value.normalize('NFKC').replace(/\s+/g, '');

/**
 * 団体戦の選手候補: 個人戦（doubles / singles）の出場記録を、チーム名ごとに集める。
 * 結び付けの規約は ADR-020（同じ氏名・同じチームの個人戦の記録）と同じ。
 * 同じチーム名で男女のチームがある（例: ワタキューセイモア）ので、団体のファイルと同じ性別の種目だけを見る。
 */
const collectTeamMembers = (detailsRoot: string, teamKeys: Set<string>, gender: string) => {
  const members = new Map<string, Map<string, TeamMemberCandidate>>();
  if (teamKeys.size === 0) return members;

  for (const tournamentDir of fs.readdirSync(detailsRoot, { withFileTypes: true })) {
    if (!tournamentDir.isDirectory()) continue;
    const tournamentPath = path.join(detailsRoot, tournamentDir.name);
    for (const yearDir of fs.readdirSync(tournamentPath, { withFileTypes: true })) {
      if (!yearDir.isDirectory() || !/^\d{4}$/.test(yearDir.name)) continue;
      const year = Number(yearDir.name);
      const yearPath = path.join(tournamentPath, yearDir.name);
      for (const fileName of fs.readdirSync(yearPath)) {
        if (!/^(doubles|singles)-.*\.json$/.test(fileName) || !fileName.endsWith(`-${gender}.json`)) continue;
        let detail: { participants?: DetailParticipant[] };
        try {
          detail = JSON.parse(fs.readFileSync(path.join(yearPath, fileName), 'utf-8'));
        } catch {
          continue;
        }
        for (const participant of detail.participants ?? []) {
          const lastName = participant.lastName?.trim();
          const firstName = participant.firstName?.trim();
          if (!lastName || !firstName || !participant.team) continue;
          const key = teamKey(participant.team);
          if (!teamKeys.has(key)) continue;
          const byName = members.get(key) ?? new Map<string, TeamMemberCandidate>();
          members.set(key, byName);
          const nameKey = `${lastName} ${firstName}`;
          const existing = byName.get(nameKey);
          if (!existing || existing.last_year < year) {
            byName.set(nameKey, { last_name: lastName, first_name: firstName, last_year: year });
          }
        }
      }
    }
  }
  return members;
};

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

        // 団体戦のエントリーは氏名を持たない（チーム単位）ので、チーム名で表示する
        const names = players.map((p) => `${p.last_name}${p.first_name}`).filter(Boolean);
        const label = `${entry.entryNo} ${names.length > 0 ? names.join('・') : players.map((p) => p.team_name).join('・')}`;

        return { entryNo: entry.entryNo, label, players };
      })
      .filter((entry) => entry.players.length > 0)
      .sort((a, b) => a.entryNo - b.entryNo);

    // 団体戦: エントリーはチーム単位（氏名が無い）なので、対戦に出る選手の候補を添える
    if (categoryId.startsWith('team-')) {
      const detailsRoot = path.join(process.cwd(), 'data', 'tournaments', 'details');
      const teamKeys = new Set(entries.map((entry) => teamKey(entry.players[0]?.team_name ?? '')).filter(Boolean));
      const gender = categoryId.split('-')[2] ?? '';
      const members = collectTeamMembers(detailsRoot, teamKeys, gender);
      for (const entry of entries) {
        const candidates = members.get(teamKey(entry.players[0]?.team_name ?? ''));
        entry.members = candidates
          ? Array.from(candidates.values()).sort(
              (a, b) => b.last_year - a.last_year || `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`, 'ja'),
            )
          : [];
      }
    }

    return res.status(200).json({ entries });
  } catch (error) {
    console.error('Failed to load tournament entries:', error);
    return res.status(500).json({ error: 'Failed to load entries.' });
  }
}
