// src/components/Tournament/ClubTransitionSection.tsx
//
// 大会ハブに出す「学校部活動と地域クラブの内訳」節。
// 集計と分類は lib/clubTransition.ts、検討記録は
// docs/raw/2026-08-12-idea-juniorhigh-category-pages.md（候補3）。
//
// 表示方針:
// - **クラブ数は下限**である。判定できなかった団体数（unknown）を必ず併記し、
//   「クラブと断定できた数」であることを本文でも明示する。2022年度は出典が略称表記の
//   ため判定不能が80件あり、これを隠すと数字が実態より確かなものに見えてしまう。
// - 制度（中体連の参加資格の特例・2023年度）という外部要因を先に置き、
//   データがそれと一致していることを読者が自分で確かめられるようにする。
// - **アイコン・絵文字は使わない**（AGENTS.md「UI の表記ルール」）。棒は CSS の矩形で描く。

import Link from 'next/link';

import type { ClubTransitionData } from '@/lib/clubTransition';

interface Props {
  label: string;
  data: ClubTransitionData;
}

export default function ClubTransitionSection({ label, data }: Props) {
  const latest = data.years[data.years.length - 1];
  const earliest = data.years[0];
  const maxShare = Math.max(...data.years.map((y) => y.clubShare), 0.01);

  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold mb-3">学校部活動と地域クラブの内訳</h2>

      <p className="mb-3 text-sm text-gray-700 dark:text-gray-200">
        日本中学校体育連盟は{data.policyYear}年度（令和{data.policyYear - 2018}年度）から、全国中学校体育大会に
        「地域クラブ活動の参加資格の特例」を設けました。学校の部活動ではなく地域クラブに所属する生徒も、 都道府県予選を通れば全国大会に出場できます。{label}
        の出場団体を年度ごとに数えると、
        {earliest.year}年度の{earliest.clubTeams}団体から{latest.year}年度の{latest.clubTeams}団体 （出場{latest.totalTeams}団体中
        {Math.round(latest.clubShare * 100)}%）まで増えています。
      </p>

      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full min-w-max border-collapse text-sm text-gray-700 dark:text-gray-200">
          <thead className="bg-bg-subtle text-text">
            <tr>
              <th className="px-4 py-2 text-left">年度</th>
              <th className="px-4 py-2 text-right">出場団体</th>
              <th className="px-4 py-2 text-right">うち地域クラブ</th>
              <th className="px-4 py-2 text-left">比率</th>
            </tr>
          </thead>
          <tbody>
            {data.years.map((y) => {
              const pct = Math.round(y.clubShare * 100);
              return (
                <tr key={y.year} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-2 font-medium">
                    {y.year}年度
                    {y.year === data.policyYear && <span className="ml-2 text-xs text-text-muted">特例の適用開始</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{y.totalTeams}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{y.clubTeams}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-bg-subtle" role="presentation" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((y.clubShare / maxShare) * 100)}%` }} />
                      </div>
                      <span className="tabular-nums text-xs text-text-secondary">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-text-muted">
        当サイト収録の出場団体名から集計しています。団体名に「クラブ」「STC」「スポーツ少年団」等が含まれるものを 地域クラブとして数えているため、
        <strong className="font-semibold">ここでの地域クラブ数は下限</strong>です。 名称だけでは判別できない団体は学校側にも地域クラブ側にも数えていません（
        {data.years.map((y) => `${y.year}年度${y.unknownTeams}件`).join('・')}）。
        {data.hasPrePolicyClub &&
          `なお${data.policyYear}年度より前にも1件の地域クラブの出場があり、特例の適用開始以前から例外的な参加があったことがうかがえます。`}
      </p>

      {latest.clubs.length > 0 && (
        <details className="group mt-3 rounded-md border border-border px-4 py-3">
          <summary className="cursor-pointer list-none text-sm text-text-secondary hover:text-text">
            {latest.year}年度に出場した地域クラブ{latest.clubTeams}団体を
            <span className="group-open:hidden">見る</span>
            <span className="hidden group-open:inline">閉じる</span>
          </summary>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {latest.clubs.map((c) => (
              <li key={c.name} className="text-gray-700 dark:text-gray-200">
                {c.name}
                {c.prefecture && <span className="ml-1 text-xs text-text-muted">{c.prefecture}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 中学カテゴリへの回遊。都道府県別・チーム別の戦績はそちらに集約している */}
      <p className="mt-3 text-sm">
        <Link href="/secondaryschool/" className="text-link hover:underline">
          中学ソフトテニスの都道府県別・チーム別の成績を見る
        </Link>
      </p>
    </section>
  );
}
