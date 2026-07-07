import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { aggregateStLeagueTeam, Gender, getAllStLeagueTeamIds } from '@/utils/st-league';

interface HubEntry {
  teamId: string;
  name: string;
  divisionId: string;
  divisionName: string;
  titlesTop: number;
}

type DivisionGroup = {
  divisionId: string;
  divisionName: string;
  teams: HubEntry[];
};

interface Props {
  groups: { gender: Gender; divisions: DivisionGroup[] }[];
  totalTeams: number;
}

const GENDER_LABEL: Record<Gender, string> = { boys: '男子', girls: '女子' };

export default function StLeagueTeamsList({ groups, totalTeams }: Props) {
  const pageUrl = 'https://softeni-pick.com/st-league/teams/';
  const allEntries = groups.flatMap((g) => g.divisions.flatMap((d) => d.teams));

  return (
    <>
      <MetaHead
        title="STリーグ 掲載チーム一覧（実業団）｜ソフトテニス情報"
        description="ソフトテニス実業団リーグ「STリーグ」の掲載チーム一覧。男子・女子、所属リーグ（Ⅰ・Ⅱ部）別に各チームの年度別成績・順位ページへリンクしています。"
        url={pageUrl}
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: 'STリーグ 掲載チーム一覧',
              itemListElement: allEntries.map((e, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: e.name,
                url: `https://softeni-pick.com/teams/${e.teamId}`,
              })),
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="4xl" className="space-y-8">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'STリーグ', href: '/st-league' },
            { label: '掲載チーム', href: '/st-league/teams' },
          ]}
        />

        <header>
          <h1 className="text-2xl font-bold">STリーグ 掲載チーム一覧</h1>
          <p className="mt-2 text-text-secondary leading-relaxed">
            当サイトが掲載している
            <Link href="/st-league" className="text-primary font-semibold hover:underline">
              STリーグ
            </Link>
            （ソフトテニス実業団リーグ）の出場チーム{totalTeams}
            チームを、男女・所属リーグ別に まとめています。各チームの年度別成績・順位は、チーム名から確認できます。
          </p>
          <p className="mt-1 text-xs text-gray-400">※ STリーグにはⅢ部もありますが、本サイトでは対戦データを掲載しているチームを対象としています。</p>
        </header>

        {groups.map(({ gender, divisions }) => (
          <section key={gender}>
            <h2 className="text-xl font-bold mb-4 border-b-2 border-border pb-1">{GENDER_LABEL[gender]}</h2>
            <div className="space-y-6">
              {divisions.map((d) => (
                <div key={d.divisionId}>
                  <h3 className="text-sm font-bold text-text-muted mb-2 uppercase tracking-wider">{d.divisionName}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {d.teams.map((t) => (
                      <Link
                        key={t.teamId}
                        href={`/teams/${t.teamId}`}
                        className="flex items-center justify-between bg-surface rounded-lg border border-border px-4 py-3 hover:border-blue-400 hover:shadow-sm transition"
                      >
                        <span className="font-medium truncate">{t.name}</span>
                        {t.titlesTop > 0 && (
                          <span className="ml-2 shrink-0 text-amber-500" title={`STリーグⅠ 優勝 ${t.titlesTop}回`} aria-label={`優勝${t.titlesTop}回`}>
                            🏆
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <nav className="flex flex-wrap gap-4 pt-2 border-t border-border">
          <Link href="/st-league" className="text-primary font-semibold hover:underline">
            ◀ STリーグ トップ（結果・順位表）
          </Link>
          <Link href="/st-league/champions" className="text-primary font-semibold hover:underline">
            ▶ 歴代優勝チーム・記録
          </Link>
        </nav>
      </PageLayout>
    </>
  );
}

export const getStaticProps = async () => {
  const ids = getAllStLeagueTeamIds();

  const byGender: Record<Gender, Map<string, DivisionGroup>> = {
    boys: new Map(),
    girls: new Map(),
  };

  for (const id of ids) {
    const summary = aggregateStLeagueTeam(id);
    if (!summary) continue;
    (['boys', 'girls'] as Gender[]).forEach((gender) => {
      // seasons は年度降順。その性別の最新シーズンを所属の代表とする。
      const latest = summary.seasons.find((s) => s.gender === gender);
      if (!latest) return;
      const map = byGender[gender];
      if (!map.has(latest.divisionId)) {
        map.set(latest.divisionId, {
          divisionId: latest.divisionId,
          divisionName: latest.divisionName || `第${latest.divisionId}部`,
          teams: [],
        });
      }
      map.get(latest.divisionId)!.teams.push({
        teamId: id,
        name: summary.name,
        divisionId: latest.divisionId,
        divisionName: latest.divisionName,
        titlesTop: summary.titlesTop,
      });
    });
  }

  const groups = (['boys', 'girls'] as Gender[]).map((gender) => {
    const divisions = Array.from(byGender[gender].values())
      .sort((a, b) => a.divisionId.localeCompare(b.divisionId))
      .map((d) => ({
        ...d,
        teams: d.teams.sort((a, b) => a.name.localeCompare(b.name, 'ja')),
      }));
    return { gender, divisions };
  });

  return { props: { groups, totalTeams: ids.length } };
};
