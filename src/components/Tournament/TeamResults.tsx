// src/components/Tournament/TeamResults.tsx
import Link from 'next/link';

import { resultPriority } from '@/lib/utils';
import { TournamentDetailData } from '@/types';

type DisplayPart = {
  text: string;
  id?: number;
};

interface Member {
  result: string;
  resultOrder: number;
  displayParts: DisplayPart[];
}

interface HighschoolTeamLink {
  prefectureId: string;
  teamId: string;
}

interface Props {
  detailData: TournamentDetailData[];
  highschoolGender?: string | null;
  highschoolTeamLinks?: Record<string, HighschoolTeamLink> | null;
}

export default function TeamResults({ detailData, highschoolGender = null, highschoolTeamLinks = null }: Props) {
  const TOP_SET = ['優勝', '準優勝', 'ベスト4', 'ベスト8'];
  const getHighschoolTeamLookupKey = (team: string, prefecture: string | null) => `${team}::${prefecture ?? ''}`;
  // 都道府県の有無で同一チームが分裂しないよう、都道府県別リンクが必要な高校の部のみ
  // team+prefecture でグルーピングし、それ以外（社会人など）はチーム名のみでグルーピングする。
  const getBucketKey = (team: string, prefecture: string | null) => (highschoolGender ? getHighschoolTeamLookupKey(team, prefecture) : team);

  type TeamBucket = {
    team: string;
    prefecture?: string | null;
    members: Member[];
  };

  const sortedTeams: TeamBucket[] = (() => {
    const buckets: Record<string, TeamBucket> = {};

    for (const detail of detailData ?? []) {
      const participantMap = new Map<string, (typeof detail.participants)[0]>();
      for (const p of detail.participants ?? []) participantMap.set(p.id, p);

      for (const r of detail.results ?? []) {
        // 結果ラベルを決定（tournament.label があるケースが多い）
        const label = r.tournament?.label ?? '';

        // ベスト8以上判定: ラベルに含まれるケース、または best ランク情報がある場合
        const isTop8ByLabel = TOP_SET.some((t) => label.includes(t));
        let isTop8ByRank = false;
        if (r.tournament && typeof r.tournament === 'object') {
          const tt = r.tournament as unknown as {
            rank?: { kind?: string; bestLevel?: number };
          };
          const rankInfo = tt.rank;

          if (rankInfo && rankInfo.kind === 'best') {
            const bestLevel = rankInfo.bestLevel ?? 999;
            isTop8ByRank = bestLevel <= 8;
          }
        }
        if (!isTop8ByLabel && !isTop8ByRank) continue;

        // エントリの playerIds を探す（entryNo に一致するエントリ）
        const entry = (detail.entries ?? []).find((e) => e.entryNo === r.entryNo);
        const playerIds = entry?.playerIds ?? [];

        if (!playerIds || playerIds.length === 0) continue;

        // playerIds を解析
        if (!playerIds || playerIds.length === 0) continue;

        if (playerIds.length > 1) {
          // 複数人（ペアなど）の場合、participants を取得
          const players = playerIds.map((pid) => participantMap.get(pid)).filter(Boolean) as (typeof detail.participants)[0][];
          if (!players || players.length === 0) continue;

          const teamSet = new Set(players.map((p) => p.team ?? '\u4e0d\u660e'));

          if (teamSet.size === 1) {
            // 同一チームのペア -> ペア表示として1つの Member を追加
            const teamLabel = Array.from(teamSet)[0];
            const prefectureId = players[0]?.prefecture ?? null;
            const bucketKey = getBucketKey(teamLabel, prefectureId);

            const displayParts: DisplayPart[] = players.flatMap((pl, idx) => {
              const last = pl.lastName ?? '';
              const first = pl.firstName ?? '';
              const name = `${last}${first}`.trim() || '\u4e0d\u660e';
              return idx < players.length - 1 ? [{ text: name, id: pl.playerId }, { text: '・' }] : [{ text: name, id: pl.playerId }];
            });

            const member: Member = {
              result: label || 'ベスト8',
              resultOrder: resultPriority(label || 'ベスト8'),
              displayParts,
            };

            if (!buckets[bucketKey]) {
              buckets[bucketKey] = {
                team: teamLabel,
                prefecture: prefectureId,
                members: [],
              };
            }
            buckets[bucketKey].members.push(member);
          } else {
            // 所属チームが異なるペア -> 各選手をそれぞれのチームに追加
            for (const pl of players) {
              if (!pl) continue;

              const teamLabel = pl.team ?? '\u4e0d\u660e';
              const prefectureId = pl.prefecture ?? null;
              const bucketKey = getBucketKey(teamLabel, prefectureId);
              const last = pl.lastName ?? '';
              const first = pl.firstName ?? '';
              const name = `${last}${first}`.trim() || '\u4e0d\u660e';

              const displayParts: DisplayPart[] = [{ text: name, id: pl.playerId }];

              const member: Member = {
                result: label || 'ベスト8',
                resultOrder: resultPriority(label || 'ベスト8'),
                displayParts,
              };

              if (!buckets[bucketKey]) {
                buckets[bucketKey] = {
                  team: teamLabel,
                  prefecture: prefectureId,
                  members: [],
                };
              }
              buckets[bucketKey].members.push(member);
            }
          }
        } else {
          // 単独エントリ
          const pid = playerIds[0];
          const pl = participantMap.get(pid);
          if (!pl) continue;

          const teamLabel = pl.team ?? '\u4e0d\u660e';
          const prefectureId = pl.prefecture ?? null;
          const bucketKey = getBucketKey(teamLabel, prefectureId);
          const last = pl.lastName ?? '';
          const first = pl.firstName ?? '';
          const name = `${last}${first}`.trim() || '';

          const displayParts: DisplayPart[] = [{ text: name, id: pl.playerId }];

          const member: Member = {
            result: label || 'ベスト8',
            resultOrder: resultPriority(label || 'ベスト8'),
            displayParts,
          };

          if (!buckets[bucketKey]) {
            buckets[bucketKey] = {
              team: teamLabel,
              prefecture: prefectureId,
              members: [],
            };
          }
          buckets[bucketKey].members.push(member);
        }
      }
    }

    // 各チームのメンバーを成績順でソートし、チーム自体も最良成績でソート
    const arr = Object.values(buckets).map((b) => {
      const members = b.members.slice().sort((a, b2) => {
        return a.resultOrder - b2.resultOrder || a.displayParts[0].text.localeCompare(b2.displayParts[0].text);
      });
      return { ...b, members };
    });

    arr.sort((a, b) => {
      const aBest = a.members.length > 0 ? a.members[0].resultOrder : 99;
      const bBest = b.members.length > 0 ? b.members[0].resultOrder : 99;
      if (aBest !== bBest) return aBest - bBest;
      return a.team.localeCompare(b.team);
    });

    return arr;
  })();

  if (detailData.length === 0) {
    return <p className="text-center text-text-secondary mt-6 mb-6">大会結果はまだすべて揃っていません。判明次第、順次掲載していきます。</p>;
  }

  return (
    <section className="mb-10">
      {sortedTeams.map(({ team, prefecture, members }) => {
        const highschoolTeamLink = highschoolGender && highschoolTeamLinks ? highschoolTeamLinks[getHighschoolTeamLookupKey(team, prefecture ?? null)] : null;
        const grouped = members.reduce(
          (acc, m) => {
            if (!acc[m.result]) acc[m.result] = [];
            acc[m.result].push(m);
            return acc;
          },
          {} as Record<string, Member[]>,
        );

        const resultEntries = Object.entries(grouped)
          .map(([result, list]) => ({
            result,
            resultOrder: resultPriority(result),
            members: list,
          }))
          .sort((a, b) => a.resultOrder - b.resultOrder);

        return (
          <div key={team} className="mb-6 rounded-lg border border-border bg-surface shadow-sm">
            <div className="px-4 py-3 border-b border-border">
              {highschoolGender && highschoolTeamLink ? (
                <Link
                  href={`/highschool/${highschoolGender}/${highschoolTeamLink.prefectureId}/${highschoolTeamLink.teamId}`}
                  className="text-base font-semibold text-info hover:underline"
                >
                  {team}
                </Link>
              ) : (
                <span className="text-base font-semibold text-gray-800 dark:text-gray-200">{team}</span>
              )}
            </div>
            <ul className="divide-y divide-border text-sm">
              {resultEntries.map(({ result, members }, i) => (
                <li key={i} className="flex px-4 py-2 gap-4">
                  <div className="w-20 text-right text-text-secondary">{result}</div>
                  <div className="text-text flex flex-wrap gap-x-1">
                    {members.map((m, j) => (
                      <span key={j}>
                        {m.displayParts.map((part, k) =>
                          part.id ? (
                            <Link
                              key={k}
                              href={`/players/${part.id}/results`}
                              className="text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid"
                            >
                              {part.text}
                            </Link>
                          ) : (
                            <span key={k}>{part.text}</span>
                          ),
                        )}
                        {j < members.length - 1 && <span>、</span>}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
