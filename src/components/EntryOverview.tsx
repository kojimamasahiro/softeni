type EntryInfo = {
  entryNo: number;
  information?: {
    lastName: string;
    firstName: string;
    team: string;
    playerId?: string;
    prefecture?: string;
  }[];
  team?: string;
  prefecture?: string;
  type?: string;
};

interface Props {
  entries: Record<string, EntryInfo[]>; // カテゴリは string
  fixCategory?: string; // オプションで特定のカテゴリを表示するため
}

const CATEGORY_LABELS: Record<string, string> = {
  doubles: 'ダブルス',
  singles: 'シングルス',
  team: '団体',
};

function getStats(entryList: EntryInfo[]) {
  const teamMap: Record<string, number> = {};
  let playerCount = 0;

  entryList.forEach((entry) => {
    entry.information?.forEach((p) => {
      teamMap[p.team] = (teamMap[p.team] || 0) + 1;
      playerCount++;
    });
  });

  return {
    entryCount: entryList.length,
    teamCount: Object.keys(teamMap).length,
    playerCount,
    teamMap,
  };
}

export default function EntryOverview({ entries, fixCategory }: Props) {
  if (!entries || Object.keys(entries).length === 0) return null;

  return (
    <section className="space-y-8 my-6">
      <h2 className="text-xl font-bold mt-10 mb-2">エントリー一覧</h2>
      {Object.entries(entries).map(([tempCategory, entryList]) => {
        if (!entryList || entryList.length === 0) return null;
        const category = fixCategory || tempCategory;

        const stats = getStats(entryList);
        const sortedTeams = Object.entries(stats.teamMap).sort(
          (a, b) => b[1] - a[1],
        );
        const label = CATEGORY_LABELS[category] || ``;

        return (
          <div key={category}>
            <h3 className="text-l font-bold mt-10 mb-2">{label}</h3>

            {/* 出場選手一覧 */}
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm max-h-[300px] overflow-auto whitespace-pre-wrap">
              {entryList
                .map((entry) => {
                  if (category === 'singles') {
                    const p = entry.information?.[0];
                    return p
                      ? `${entry.entryNo}.　${p.lastName}${p.firstName}（${p.team}）`
                      : `${entry.entryNo}.　情報不明`;
                  }

                  if (category === 'team') {
                    return `${entry.entryNo}.　${entry.team}（${entry.prefecture}）`;
                  }

                  // doublesなど
                  const names = (entry.information ?? []).map(
                    (p) => `${p.lastName}${p.firstName}`,
                  );
                  const teams = (entry.information ?? []).map((p) => p.team);
                  const teamSet = new Set(teams);
                  const pairLabel =
                    teamSet.size === 1
                      ? `${names.join('・')}（${teams[0]}）`
                      : (entry.information ?? [])
                          .map(
                            (p) => `${p.lastName}${p.firstName}（${p.team}）`,
                          )
                          .join('・');
                  return `${entry.entryNo}.　${pairLabel}`;
                })
                .join('\n')}
            </pre>

            {/* 出場統計（団体は非表示） */}
            {category !== 'team' && (
              <>
                <ul className="list-disc list-inside text-sm mt-3 mb-3">
                  <li>エントリー数：{stats.entryCount}</li>
                  <li>出場チーム数：{stats.teamCount}</li>
                  <li>出場選手数：{stats.playerCount}名</li>
                </ul>
                <ul className="list-disc list-inside text-sm columns-2 md:columns-3 mb-3">
                  {sortedTeams.map(([team, count]) => (
                    <li key={team}>
                      {team}（{count}名）
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
