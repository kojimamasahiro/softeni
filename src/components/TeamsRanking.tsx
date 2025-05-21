type TeamsRankingProps = {
  statsList: {
    id: string;
    name: string;
    appearances: number;
    wins: number;
    losses: number;
    winsByRound: Record<string, number>;
  }[];
};

export default function TeamsRanking({ statsList }: TeamsRankingProps) {
  const statsLabels = [
    { label: "出場数", key: "appearances" },
    { label: "優勝", key: "優勝" },
    { label: "準優勝", key: "準優勝" },
    { label: "ベスト4", key: "ベスト4" },
    { label: "ベスト8", key: "ベスト8" },
  ];

  return (
    <section className="mb-8 px-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
        選手別成績
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {statsList.map((p) => {
          const wins = p.wins;
          const losses = p.losses;
          const total = wins + losses;
          const ratio = total > 0 ? `${wins}勝${losses}敗` : "-";

          return (
            <div
              key={p.id}
              className="bg-white rounded-2xl shadow dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-lg font-bold mb-2 text-gray-800 dark:text-gray-100">{p.name}</h3>
              <ul className="text-sm space-y-1">
                {statsLabels.map(({ label, key }) => (
                  <li key={key}>
                    <span className="text-gray-500 dark:text-gray-400">{label}：</span>
                    <span className="font-medium">
                      {key === "appearances" ? p.appearances : p.winsByRound[key] || 0}
                    </span>
                  </li>
                ))}
                <li>
                  <span className="text-gray-500 dark:text-gray-400">勝率：</span>
                  <span className="font-medium">{ratio}</span>
                </li>
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
