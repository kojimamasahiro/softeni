// lib/qualifierFinishers.ts
//
// 「これから開催される国際大会」の大会ハブに出す、**その予選会の上位進出者**を集める。
//
// 目的（docs/wiki/upcoming-tournaments-runbook.md S2）:
// 本大会のページは結果がまだ無いので実体が薄く、選手ページへのリンクが0本だった。
// 予選会の上位進出者を通算成績つきで出すと、ページに中身が入り、
// S1（選手ページ→本大会）の受け皿にもなる。
//
// **代表選手だとは名乗らない。** 予選会はシングルスのみで団体・混合の選考は別経路のため、
// 当サイトのデータから日本代表は導出できない。出せるのは「予選会でこの成績だった」だけで、
// 描画側は必ずその断りを併記する（`PLACEMENT_DISCLAIMER`）。
//
// 予選会↔本大会の対応付けは他と同じ **tournamentId の命名規約**（`{本大会ID}-qualifier`）。
// 「どの回の予選会か」は本大会の開始日より前で最も新しい回（4年周期の大会があるため。
// 詳細は lib/upcomingInternational.ts の resolveQualifierEdition と同じ考え方）。

import fs from 'fs';
import path from 'path';

import type { TournamentInformationEntry } from '@/types/tournament';

import { getPlayerStatistics } from './playerStats/playerStatistics';

/** 描画側が必ず併記する断り。ここに置いて文言を1箇所にする。 */
export const PLACEMENT_DISCLAIMER = '日本代表の選手は主催者・連盟の発表をご確認ください。当サイトのデータからは特定できません。';

export type QualifierFinisher = {
  /** 例: 優勝 / 準優勝 / ベスト4 */
  placementLabel: string;
  /** 並び順（小さいほど上位） */
  order: number;
  name: string;
  team: string | null;
  /** 選手ページを持つ場合の数値 id */
  playerId: number | null;
  /** 当サイト掲載分の通算成績。選手ページを持たない場合などは null */
  record: { matches: number; wins: number; losses: number; winRate: number } | null;
};

export type QualifierFinishersBlock = {
  qualifierLabel: string;
  qualifierYear: number;
  qualifierHubHref: string;
  startDate: string | null;
  location: string | null;
  /** 性別ラベル（男子/女子）ごとの上位進出者 */
  groups: { genderLabel: string; finishers: QualifierFinisher[] }[];
};

/** `tournament.rank` を表示ラベルと並び順へ写す。ベスト8以下は出さない（上位進出者に絞る）。 */
function toPlacement(rank: { kind?: string; bestLevel?: number } | undefined): { label: string; order: number } | null {
  if (!rank?.kind) return null;
  if (rank.kind === 'winner') return { label: '優勝', order: 1 };
  if (rank.kind === 'runnerup') return { label: '準優勝', order: 2 };
  if (rank.kind === 'best' && rank.bestLevel === 4) return { label: 'ベスト4', order: 3 };
  return null;
}

const GENDER_LABEL: Record<string, string> = { boys: '男子', girls: '女子', mixed: '混合' };

/**
 * 本大会IDから、対応する予選会の上位進出者を集める。
 *
 * @param mainTournamentId 本大会の tournamentId（例: `asian-games`）
 * @param mainStartDate    本大会の開始日。これより前で最も新しい回の予選会を採る
 * @param informationMap   tournamentId -> 開催情報
 * @param indexById        tournamentId -> ラベルと generationId
 * @param playerNameToId   `姓::名` -> 選手ページの数値 id
 */
export async function getQualifierFinishers(args: {
  mainTournamentId: string;
  mainStartDate: string | null;
  informationMap: Map<string, TournamentInformationEntry[]>;
  indexById: Map<string, { label: string; generationId: string }>;
  playerNameToId: Map<string, number>;
}): Promise<QualifierFinishersBlock | null> {
  const { mainTournamentId, mainStartDate, informationMap, indexById, playerNameToId } = args;

  const qualifierId = `${mainTournamentId}-qualifier`;
  const qualifierIndex = indexById.get(qualifierId);
  if (!qualifierIndex || !mainStartDate) return null;

  const edition = (informationMap.get(qualifierId) ?? [])
    .filter((i) => i.startDate && i.startDate < mainStartDate)
    .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')))[0];
  if (!edition) return null;

  // nft（output file tracing）が静的解決できるよう、パスセグメントはリテラルで書く。
  // `path.join(process.cwd(), ...ARRAY, 変数)` にすると nft が解決を諦め、
  // リポジトリ全体を再帰 glob する（ビルドが数分遅くなる）。
  // 詳細: docs/wiki/deployment.md「output file tracing（nft）のワイルドカード走査」
  const yearDir = path.join(process.cwd(), 'data', 'tournaments', 'details', qualifierId, String(edition.year));
  if (!fs.existsSync(yearDir)) return null;

  // 性別 -> 上位進出者
  const byGender = new Map<string, QualifierFinisher[]>();

  for (const file of fs.readdirSync(yearDir)) {
    if (!file.endsWith('.json')) continue;
    const parts = file.replace(/\.json$/, '').split('-');
    if (parts.length < 3) continue;
    const gender = parts[parts.length - 1];

    let detail: {
      participants?: { id: string; lastName?: string; firstName?: string; team?: string }[];
      entries?: { entryNo: number; playerIds: string[] }[];
      results?: { entryNo: number; tournament?: { rank?: { kind?: string; bestLevel?: number } } | null }[];
    };
    try {
      detail = JSON.parse(fs.readFileSync(path.join(yearDir, file), 'utf-8'));
    } catch {
      continue;
    }
    if (!Array.isArray(detail.participants)) continue;

    const participantById = new Map(detail.participants.map((p) => [p.id, p]));
    const entryById = new Map((detail.entries ?? []).map((e) => [e.entryNo, e]));

    for (const r of detail.results ?? []) {
      const placement = toPlacement(r.tournament?.rank);
      if (!placement) continue;

      for (const pid of entryById.get(r.entryNo)?.playerIds ?? []) {
        const p = participantById.get(pid);
        if (!p?.lastName) continue;
        const name = `${p.lastName}${p.firstName ?? ''}`;
        const playerId = playerNameToId.get(`${p.lastName}::${p.firstName ?? ''}`) ?? null;

        const list = byGender.get(gender) ?? [];
        // 同じ選手が複数カテゴリに出ている場合は上位の成績だけ残す
        const existing = list.find((f) => f.name === name);
        if (existing) {
          if (placement.order < existing.order) {
            existing.placementLabel = placement.label;
            existing.order = placement.order;
          }
          continue;
        }
        list.push({
          placementLabel: placement.label,
          order: placement.order,
          name,
          team: p.team ?? null,
          playerId,
          // 通算成績は Player Statistics Engine から引く。
          // `getCareerRecordByFullName` はプロフィール slug を持つ選手（20人ほど）しか引けず、
          // 男子だけ成績が出て女子は出ない、という偏った表示になっていた（2026-08-26 修正）。
          record: playerId !== null ? await loadRecord(playerId) : null,
        });
        byGender.set(gender, list);
      }
    }
  }

  const groups = [...byGender.entries()]
    .map(([gender, finishers]) => ({
      genderLabel: GENDER_LABEL[gender] ?? gender,
      finishers: finishers.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.finishers.length > 0)
    // 男子 -> 女子 -> その他 の順
    .sort((a, b) => ['男子', '女子'].indexOf(a.genderLabel) - ['男子', '女子'].indexOf(b.genderLabel));

  if (groups.length === 0) return null;

  return {
    qualifierLabel: edition.label || qualifierIndex.label,
    qualifierYear: edition.year,
    qualifierHubHref: `/tournaments/${qualifierIndex.generationId}/${qualifierId}/`,
    startDate: edition.startDate || null,
    location: edition.location || null,
    groups,
  };
}

/** 通算成績（当サイト掲載分）。引けなければ null。 */
async function loadRecord(playerId: number): Promise<QualifierFinisher['record']> {
  try {
    const stats = await getPlayerStatistics(playerId, { sections: ['career'] });
    const m = stats?.career?.overall?.matches;
    if (!m || m.total === 0) return null;
    return { matches: m.total, wins: m.wins, losses: m.losses, winRate: m.winRate };
  } catch {
    return null;
  }
}
