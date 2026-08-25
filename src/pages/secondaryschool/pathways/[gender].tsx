// src/pages/secondaryschool/pathways/[gender].tsx
// 高校別の「出身中学」一覧（/secondaryschool/pathways/boys/ ・ /girls/）。
//
// **高校起点**にしている。中学起点（この中学からどこへ行ったか）は各中学のチームページが担当し、
// このページは「この高校の選手はどの中学から来ているか」を横断で見せる。
// 検索需要が高校名に偏ることと、**この向きでしか見えない事実がある**ことによる。
// 例: 東北（宮城）に埼玉の上青木中学校から2名、広島翔洋（広島）に愛知と埼玉から。
// 中学起点だと1件ずつ別のチームページに散ってしまい、越境の集中が見えない。
//
// **男女で別URLにしている**。理由は docs/wiki/seo.md #13:
//   - 高校の学校ページが男女別（/highschool/[gender]/...）なので、内容が原理的に重ならない。
//     中学112チームのうち男女両方に出るのは22だけで、45ずつが片側のみ
//   - 高校の学校ページ111枚からのリンクを**同じ性別のページ**へ向けられる
//   - サイトの既存規約が Link ベースの切り替え（HighschoolGenderToggle）
//
// 高校の学校ページにも同じ「出身中学」節がある（lib/highschoolFeederSchools.ts）。
// 重複の整理は seo.md #13。こちらは入口、詳細は学校ページ側。
//
// リンク先はすべて実在確認してから出す（デッドリンク防止）。

import type { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import HighschoolGenderToggle from '@/components/highschool/HighschoolGenderToggle';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { getSchoolResolver } from '@/lib/highschoolNationalTournaments';
import { getFeederGroups, resolvePlayerId, teamKindLabel, type TeamKind } from '@/lib/secondaryschool';

const GENDERS = ['boys', 'girls'] as const;
type Gender = (typeof GENDERS)[number];

/** props はシリアライズ可能である必要があるので、リンクはビルド時に解決して文字列で持つ */
interface Feeder {
  teamName: string;
  teamKind: TeamKind;
  teamPrefecture: string;
  teamHref: string;
  crossPrefecture: boolean;
  affiliated: boolean;
  players: { name: string; playerId: number | null; jhsLastYear: number; highschoolFirstYear: number }[];
}

interface Group {
  key: string;
  highschool: string;
  prefecture: string | null;
  highschoolHref: string | null;
  feeders: Feeder[];
  playerCount: number;
}

interface Props {
  gender: Gender;
  groups: Group[];
  total: number;
  crossPrefectureTotal: number;
}

export default function SecondarySchoolPathways({ gender, groups, total, crossPrefectureTotal }: Props) {
  const pageUrl = `https://softeni-pick.com/secondaryschool/pathways/${gender}/`;
  const genderLabel = gender === 'boys' ? '男子' : '女子';
  const multiFeeder = groups.filter((g) => g.feeders.length >= 2).length;

  return (
    <>
      <MetaHead
        title={`高校${genderLabel}の出身中学一覧 | 中学ソフトテニス | Softeni Pick`}
        description={`全国大会に出場している高校ソフトテニス部（${genderLabel}）の選手が、どの中学・地域クラブの出身かをまとめた一覧です。${groups.length}校・${total}名を掲載。中学で最後に出場した年から5年以内に高校の全国大会へ出場した同姓同名の選手を同一人物として追跡しています。`}
        url={pageUrl}
        type="website"
      />

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '中学', href: '/secondaryschool' },
            { label: `高校${genderLabel}の出身中学`, href: `/secondaryschool/pathways/${gender}` },
          ]}
        />

        <h1 className="mb-2 text-2xl font-bold">高校{genderLabel}の出身中学</h1>
        <p className="mb-6 text-sm text-text-secondary">
          高校の全国大会（インターハイ・ハイスクールジャパンカップ・全日本高校選抜）に出場した{genderLabel}選手が、
          中学時代にどのチームで全国大会に出ていたかの一覧です。
          <strong className="font-semibold">
            {groups.length}校・{total}名
          </strong>
          を掲載しています。複数の中学から集めている高校を先に並べています。
        </p>

        {/* 高校カテゴリと同じ見た目・同じ位置（h1＋説明文のあと、mb-8 max-w-sm mx-auto）に揃える */}
        <HighschoolGenderToggle
          gender={gender}
          boysHref="/secondaryschool/pathways/boys"
          girlsHref="/secondaryschool/pathways/girls"
          className="mb-8 max-w-sm mx-auto"
        />

        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">複数の中学から選手が来ている高校</p>
            <p className="text-lg font-bold">{multiFeeder}校</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">中学と高校で都道府県が違う（県外からの進学）</p>
            <p className="text-lg font-bold">{crossPrefectureTotal}名</p>
          </div>
        </div>

        <div className="mb-8 rounded-lg border border-border bg-bg-subtle p-4 text-xs text-text-muted">
          <p className="mb-1 font-semibold text-text-secondary">掲載の条件</p>
          <p>
            <strong className="font-semibold">氏名の一致</strong>で追跡しています。中学で最後に出場した年から
            <strong className="font-semibold">5年以内</strong>に高校の全国大会に出場した同姓同名の選手を同一人物とみなしています
            （中学1年で最後に出場して高校3年で初出場する場合が最長）。 別チームに同姓同名がいることが確認できた氏名は除外していますが、
            <strong className="font-semibold">同姓同名の別人が含まれている可能性は残ります</strong>。 また
            <strong className="font-semibold">ここに出ていない選手も多くいます</strong>（中学時代に全国大会へ出ていない、など）。
            校ごとの人数は部員数ではなく、当サイトが追跡できた人数です。
          </p>
        </div>

        {groups.map((g) => (
          <section key={g.key} className="mb-6">
            <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-base font-bold">
              {g.highschoolHref ? (
                <Link href={g.highschoolHref} className="text-link hover:underline">
                  {g.highschool}
                </Link>
              ) : (
                <span>{g.highschool}</span>
              )}
              {/* 性別はページ全体で固定なのでここには出さない */}
              <span className="text-xs font-normal text-text-muted">
                {g.prefecture ?? ''} ／ 出身中学{g.feeders.length}・{g.playerCount}名
              </span>
            </h2>
            <ul className="grid gap-2">
              {g.feeders.map((f) => (
                <li key={f.teamHref} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={f.teamHref} className="font-semibold text-link hover:underline">
                      {f.teamName}
                    </Link>
                    <span className="text-xs text-text-muted">
                      {f.teamPrefecture} ／ {teamKindLabel(f.teamKind)}
                    </span>
                    {f.crossPrefecture && <span className="rounded-full bg-info-bg px-2 py-0.5 text-xs text-info">県外</span>}
                    {f.affiliated && <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-text-muted">同名の系列校</span>}
                  </div>
                  <p className="mt-1">
                    {f.players.map((p, i) => (
                      <span key={p.name}>
                        {i > 0 && '・'}
                        {p.playerId ? (
                          <Link href={`/players/${p.playerId}/results`} className="text-link hover:underline">
                            {p.name}
                          </Link>
                        ) : (
                          p.name
                        )}
                      </span>
                    ))}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    中学 {Math.min(...f.players.map((p) => p.jhsLastYear))}年 ／ 高校 {Math.min(...f.players.map((p) => p.highschoolFirstYear))}年〜
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-8 text-sm">
          <Link href="/secondaryschool/" className="text-link hover:underline">
            中学ソフトテニスのトップへ
          </Link>
        </p>
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: GENDERS.map((gender) => ({ params: { gender } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const gender = (context.params as { gender: string }).gender as Gender;
  if (!GENDERS.includes(gender)) return { notFound: true };

  const schoolResolver = getSchoolResolver();

  const groups = getFeederGroups(gender).map((g) => ({
    key: `${g.highschool}\t${g.prefecture ?? ''}\t${g.gender ?? ''}`,
    highschool: g.highschool,
    prefecture: g.prefecture,
    // mixed（gender=null）はこのページの性別で引く
    highschoolHref: schoolResolver(g.highschool, g.prefecture, g.gender ?? gender),
    playerCount: g.playerCount,
    feeders: g.feeders.map((f) => ({
      teamName: f.team.name,
      teamKind: f.team.kind,
      teamPrefecture: f.team.prefecture,
      teamHref: `/secondaryschool/${f.team.prefectureId}/${f.team.id}/`,
      crossPrefecture: f.crossPrefecture,
      affiliated: f.affiliated,
      players: f.players.map((p) => ({ ...p, playerId: resolvePlayerId(p.name) })),
    })),
  }));

  return {
    props: {
      gender,
      groups,
      total: groups.reduce((n, g) => n + g.playerCount, 0),
      crossPrefectureTotal: groups.reduce((n, g) => n + g.feeders.filter((f) => f.crossPrefecture).reduce((m, f) => m + f.players.length, 0), 0),
    },
  };
};
