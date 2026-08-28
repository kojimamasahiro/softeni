// pages/tournaments/[generation]/[tournamentId]/index.tsx
// 大会ハブページ: 1大会の歴代（年度別・種別別）結果をまとめて内部リンクする。
// 「ソフトテニス 大会名 結果」など年度を含まない検索クエリの受け皿。

import fs from 'fs';
import path from 'path';

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { Fragment } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import ClubTransitionSection from '@/components/Tournament/ClubTransitionSection';
import TournamentContextBlocks, { type TournamentContextData } from '@/components/TournamentContextBlocks';
import QualifierFinishersSection from '@/components/tournaments/QualifierFinishersSection';
import RelatedTournamentsBlock, { type RelatedTournamentLink } from '@/components/tournaments/RelatedTournamentsBlock';
import UpcomingTournamentSection, { type UpcomingTournamentData } from '@/components/tournaments/UpcomingTournamentSection';
import { getCareerRecordByFullName } from '@/lib/careerRecord';
import { getClubTransition, type ClubTransitionData } from '@/lib/clubTransition';
import { getHsNationalSlugByTournamentId } from '@/lib/highschoolNationalTournaments';
import { getQualifierFinishers, type QualifierFinishersBlock } from '@/lib/qualifierFinishers';
import { getChampionMilestones } from '@/lib/milestones';
import { buildEventOrganizer, buildEventPlace, buildEventPlaceFromVenue, resolveEventDates, sportsEventBaseFields } from '@/lib/sportsEventJsonLd';
import { getAbandonment } from '@/lib/tournamentAbandonment';
import { buildTournamentSearchNames } from '@/lib/tournamentSearchNames';
import { buildPriorMeetingIndex, countCoveredEntries, countPriorMeetings } from '@/lib/priorMeetings';
import { getHistoricalWinners, readYearDetail } from '@/lib/tournamentRecords';
import { getCategoryLabel } from '@/lib/utils';
import { TournamentIndexEntry, TournamentInformationEntry } from '@/types/index';
import { joinPlayerName } from '@/utils/playerName';

/** 優勝者の個人（選手ページを持つ場合は playerId が入る）。 */
type WinnerPlayer = {
  name: string;
  /** /players/{playerId}/results/ の数値ID。結果ページが無い（count<5・未収録等）選手は null。 */
  playerId: number | null;
};

type CategoryLink = {
  label: string;
  category: string;
  age: string;
  gender: string;
  href: string;
  winner: string | null;
  /**
   * winner の個人名内訳（選手ページへのリンク用）。team カテゴリ（個人名が無く学校名のみ）
   * や参加者データが解決できない場合は null。
   */
  winnerPlayers: WinnerPlayer[] | null;
  /**
   * winner の所属校名。個人戦では「（〇〇高校）」の中身として選手名の下に、
   * team カテゴリ（個人名が無い）ではチーム名そのものとして表示に使う。
   */
  winnerTeamsLabel: string | null;
  /** team カテゴリ（個人名が無い）の都道府県表記。チーム名の下に2行目として表示する。個人戦では null。 */
  winnerPrefectureLabel: string | null;
  /**
   * 打ち切り大会のとき、最後に完了したラウンド名（例: "3回戦"）。それ以外は null。
   * 打ち切り年は優勝者が存在しないため、歴代優勝者リストで空欄（＝データ未整備に見える）
   * にせず「打ち切り」と明示するために使う。
   * docs/raw/2026-07-26-abandoned-tournament-ui-design.md
   */
  abandonedAfterRound: string | null;
};

type YearGroup = {
  year: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  categories: CategoryLink[];
};

interface TournamentHubPageProps {
  generation: string;
  tournamentId: string;
  label: string;
  /** 検索で使われる大会名。未設定なら label をそのまま使う。docs/wiki/seo.md「大会名の表記と検索語の乖離」 */
  searchLabel: string | null;
  /** 略称。先頭1件を title / h1 に併記する */
  searchAliases: string[];
  officialUrl: string | null;
  yearGroups: YearGroup[];
  // 高校全国大会（インターハイ/ジャパンカップ）の場合のみスラッグが入る。
  // このハブは /highschool/tournaments/[tournament] とカニバるため、
  // 高校全国大会では noindex,follow にして検索面を高校歴代ページへ集中させる。
  // docs/wiki/seo.md #3 参照。
  hsNationalSlug: string | null;
  // 結果が details ではなく専用の特集ページ側にある大会（STリーグ→`/st-league/`）の特集トップ。
  // 特集ページとカニバるため、hsNationalSlug と同じく noindex,follow にして特集側へ検索面を集中させる。
  featurePath: string | null;
  // 文脈ブロック（最新年度の milestone と優勝者の通算成績）。docs/wiki/news-context-blocks.md
  contextBlocks: TournamentContextData;
  // 「学校部活動と地域クラブの内訳」。allowlist 外の大会（= 経年比較が成立しない大会）は null。
  // docs/raw/2026-08-12-idea-juniorhigh-category-pages.md（候補3）
  clubTransition: ClubTransitionData | null;
  // 「開催前」ブロック。まだ結果が無く会期が終わっていない年度がある大会のみ非 null。
  // docs/raw/2026-07-26-idea-tournament-metadata-platform.md（追記6・追記7）
  upcoming: UpcomingTournamentData | null;
  // 予選会↔本大会の相互リンク。無ければ空配列。
  relatedLinks: RelatedTournamentLink[];
  // 開催前の国際大会に出す「日本代表予選会の上位進出者」。該当しなければ null。
  // docs/wiki/upcoming-tournaments-runbook.md S2。
  qualifierFinishers: QualifierFinishersBlock | null;
}

export default function TournamentHubPage({
  generation,
  tournamentId,
  label,
  searchLabel,
  searchAliases,
  officialUrl,
  yearGroups,
  hsNationalSlug,
  featurePath,
  contextBlocks,
  clubTransition,
  upcoming,
  relatedLinks,
  qualifierFinishers,
}: TournamentHubPageProps) {
  const pageUrl = `https://softeni-pick.com/tournaments/${generation}/${tournamentId}/`;

  // 検索で使われる名前を title / h1 / description に literal で出す。
  // searchLabel / searchAliases が未設定の大会では headingName === label となり、
  // 出力は従来と 1 文字も変わらない。docs/wiki/seo.md「大会名の表記と検索語の乖離」
  const { headingName, formalLabel, needsFormalLabelNote } = buildTournamentSearchNames(label, searchLabel, searchAliases);
  const hsNationalHref = hsNationalSlug ? `/highschool/tournaments/${hsNationalSlug}` : null;

  const years = yearGroups.map((g) => g.year);
  const latestYear = years[0] ?? '';
  const oldestYear = years[years.length - 1] ?? '';
  const yearRange = latestYear && oldestYear && latestYear !== oldestYear ? `${oldestYear}〜${latestYear}年` : latestYear ? `${latestYear}年` : '';

  // 打ち切り年は優勝者が存在しないが、行ごと落とすと「その年だけデータが無い」ように
  // 見えてしまうため、優勝者名の代わりに打ち切り表記を入れて残す。
  const championRows = yearGroups.flatMap((g) =>
    g.categories
      .filter((c) => c.winner || c.abandonedAfterRound)
      .map((c) => ({
        year: g.year,
        category: c.category,
        gender: c.gender,
        categoryLabel: c.label,
        // 打ち切り年は null。JSON-LD の performer / description はこの null を見て出し分ける
        // （プレースホルダ文字列を構造化データに混ぜない）。
        winner: c.winner,
        winnerPlayers: c.winnerPlayers,
        winnerTeamsLabel: c.winnerTeamsLabel,
        winnerPrefectureLabel: c.winnerPrefectureLabel,
        abandonedAfterRound: c.winner ? null : c.abandonedAfterRound,
        href: c.href,
        location: g.location,
        startDate: g.startDate,
        endDate: g.endDate,
      })),
  );

  // 歴代優勝者を種目（種別）ごとにまとめる。yearGroups が年度降順のため、
  // 各種目の優勝者リストも新しい年が先頭になる。種目の並びは最新年度での
  // 出現順を踏襲する（削除した結果記事の「種目ごとに歴代優勝者を並べる」見た目に合わせる）。
  const championCategoryGroups = (() => {
    const order: string[] = [];
    const map = new Map<string, typeof championRows>();
    for (const r of championRows) {
      if (!map.has(r.categoryLabel)) {
        map.set(r.categoryLabel, []);
        order.push(r.categoryLabel);
      }
      map.get(r.categoryLabel)!.push(r);
    }
    return order.map((categoryLabel) => ({
      categoryLabel,
      // 同じ categoryLabel の中身は常に同じ category（doubles/team/singles）・gender のはず
      category: map.get(categoryLabel)![0]?.category ?? null,
      gender: map.get(categoryLabel)![0]?.gender ?? null,
      winners: map.get(categoryLabel)!,
    }));
  })();

  // 性別のみの短いラベル。表の行見出しは「グループ見出し（ダブルス/団体戦）+ この短縮ラベル」
  // で表すので、行ごとに「男子ダブルス」のように種目名を繰り返さない。
  // 男子/女子/混合以外（想定外のカテゴリ）は null を返し、呼び出し側で categoryLabel にフォールバックする。
  const genderShortLabel = (gender: string | null): string | null => {
    if (gender === 'boys') return '男子';
    if (gender === 'girls') return '女子';
    if (gender === 'mixed') return '混合';
    return null;
  };

  // 「歴代優勝者」を種目×年度の表で表示するためのデータ（年度が増えるほど縦に伸びる
  // 種目別リストの代わりに、種目を行・年度を列にして一覧性を保つ）。
  // category（doubles/team/singles）が切り替わる境目には見出し行を挟み、
  // 1つの表のまま「ダブルス」「団体戦」をグループとして見分けられるようにする。
  // 行見出し自体は性別のみ（例: 男子/女子）にして、グループ見出しと種目名が重複しないようにする。
  const championTable = (() => {
    const years = [...new Set(championRows.map((r) => r.year))].sort((a, b) => Number(b) - Number(a));

    // 短縮ラベル（男子/女子/混合）が同じグループ見出しの中で衝突するなら、そのグループは
    // フルの種目名を使う。年齢区分のある大会（全日本社会人の 一般男子 / 男子35歳 / 男子45歳、
    // 全日本シニアの各年齢など）は短縮すると「男子」が何行も並んで区別がつかなくなる
    // （2026-08-26 修正。それまで一般・35歳・45歳がすべて「男子」で表示されていた）。
    // 判定はグループ見出し（doubles/team/singles）ごとに行い、同じ見出しの中では
    // 短縮とフルが混ざらないようにする。
    const shortLabelCount = new Map<string, number>();
    for (const group of championCategoryGroups) {
      const short = genderShortLabel(group.gender);
      if (!short) continue;
      const key = `${group.category ?? ''}\t${short}`;
      shortLabelCount.set(key, (shortLabelCount.get(key) ?? 0) + 1);
    }
    const categoryNeedsFullLabel = new Set<string>();
    for (const [key, count] of shortLabelCount) {
      if (count > 1) categoryNeedsFullLabel.add(key.split('\t')[0]);
    }

    const rows = championCategoryGroups.map((group) => {
      const short = genderShortLabel(group.gender);
      const useShort = short !== null && !categoryNeedsFullLabel.has(group.category ?? '');
      return {
        categoryLabel: group.categoryLabel,
        rowLabel: useShort ? short : group.categoryLabel,
        category: group.category,
        cellsByYear: new Map(group.winners.map((r) => [r.year, r] as const)),
      };
    });
    return { years, rows };
  })();

  const breadcrumbs = [
    { label: 'ホーム', href: '/' },
    { label: '大会結果一覧', href: '/tournaments' },
    {
      label: `${label} 結果`,
      href: `/tournaments/${generation}/${tournamentId}`,
    },
  ];

  // まだ1年分も結果が無く、これから開催される大会（例: 2026年度のアジア競技大会）は
  // 「歴代結果」ではなく「日程・会場」を主語にする。歴代を名乗ると中身と食い違ううえ、
  // このとき実在する検索需要は「{大会名} 日程」「{大会名} 会場」のほうであるため。
  const upcomingOnly = yearGroups.length === 0 && upcoming ? upcoming : null;
  const upcomingVenueNames = upcomingOnly ? upcomingOnly.venues.map((v) => v.name).filter((n): n is string => !!n) : [];

  const title = upcomingOnly
    ? `${headingName} ${upcomingOnly.year}年 日程・会場・実施種目 | ソフトテニス情報`
    : `${headingName} 結果・歴代優勝/上位入賞者まとめ | ソフトテニス情報`;
  // 構造化データ用の別名リスト。正式名称と重複するものは除く。
  const alternateNames = [searchLabel, ...searchAliases].filter((n): n is string => !!n && n !== label);

  const description = upcomingOnly
    ? `ソフトテニス「${upcomingOnly.label}」の日程・会場・実施種目。${[
        upcomingOnly.startDate ? `会期${upcomingOnly.startDate}〜${upcomingOnly.endDate ?? upcomingOnly.startDate}` : null,
        upcomingOnly.location,
        upcomingVenueNames[0] ?? null,
      ]
        .filter(Boolean)
        .join(' / ')}。`
    : `ソフトテニス「${headingName}」の歴代大会結果・トーナメント表・優勝/上位入賞者を年度別にまとめています。${yearRange ? `${yearRange}の` : ''}試合結果を一覧から確認できます。${
        needsFormalLabelNote ? `正式名称は${formalLabel}です。` : ''
      }`;

  return (
    <>
      <MetaHead
        title={title}
        description={description}
        url={pageUrl}
        type="website"
        noindex={!!hsNationalSlug || !!featurePath}
        noindexFollow={!!hsNationalSlug || !!featurePath}
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: `${headingName} 結果（歴代一覧）`,
              inLanguage: 'ja',
              url: pageUrl,
              about: {
                '@type': 'Thing',
                name: `ソフトテニス ${label}`,
                // 正式名称・検索名・略称が食い違う大会は、同一エンティティだと示すために別名を列挙する
                ...(alternateNames.length > 0 && { alternateName: alternateNames }),
              },
              description,
            }),
          }}
        />
        {/* 開催前の大会は「これから起きるイベント」なので、歴代の ItemList とは別に
            単体の SportsEvent を出す。日付・会場・住所が揃っているのはこの形のときだけで、
            `venues` があれば location に実住所を入れられる（buildEventPlace は
            addressCountry だけの控えめな版）。 */}
        {upcoming && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'SportsEvent',
                name: `${upcoming.label}（ソフトテニス）`,
                sport: 'ソフトテニス',
                inLanguage: 'ja',
                url: pageUrl,
                ...sportsEventBaseFields,
                ...resolveEventDates(upcoming.startDate, upcoming.endDate),
                location: upcoming.venues[0]
                  ? buildEventPlaceFromVenue({
                      name: upcoming.venues[0].name,
                      address: upcoming.venues[0].address,
                      postalCode: upcoming.venues[0].postalCode,
                      city: upcoming.venues[0].city,
                      prefecture: upcoming.location,
                    })
                  : buildEventPlace(null, upcoming.location),
                // organizer は出さない。buildEventOrganizer() の既定は Softeni Pick だが、
                // 当サイトは主催者ではない。歴代の ItemList では既存挙動として残っているものの、
                // これから開催される実イベントに主催者を偽って書くのは
                // lib/sportsEventJsonLd.ts の方針（虚偽の構造化データを避ける）に反する。
                // 主催者名を information に持つようになったら入れる。
                ...(upcoming.categoryLabels.length > 0 ? { subEvent: upcoming.categoryLabels.map((c) => ({ '@type': 'SportsEvent', name: c })) } : {}),
                description: `${upcoming.label}のソフトテニス競技の日程・会場・実施種目。`,
              }),
            }}
          />
        )}
        {championRows.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: `${label} 歴代優勝者`,
                numberOfItems: championRows.length,
                itemListElement: championRows.map((r, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  item: {
                    '@type': 'SportsEvent',
                    name: `${label} ${r.year}年 ${r.categoryLabel}`,
                    sport: 'ソフトテニス',
                    inLanguage: 'ja',
                    url: `https://softeni-pick.com${r.href}`,
                    ...sportsEventBaseFields,
                    ...resolveEventDates(r.startDate, r.endDate),
                    location: buildEventPlace(r.location),
                    organizer: buildEventOrganizer(),
                    // performer: 優勝者（その大会の出場者）を推奨項目として付与。
                    // 打ち切り年は優勝者が存在しないので performer を出さない。
                    ...(r.winner
                      ? {
                          performer: {
                            '@type': 'SportsTeam',
                            name: r.winner,
                          },
                        }
                      : {}),
                    description: r.winner ? `優勝: ${r.winner}` : `${r.abandonedAfterRound}までで打ち切りのため優勝者なし`,
                  },
                })),
              }),
            }}
          />
        )}
      </Head>

      <PageLayout>
        <Breadcrumbs crumbs={breadcrumbs} />

        <h1 className="text-2xl font-bold mb-4">{upcomingOnly ? `${headingName} ${upcomingOnly.year}年 日程・会場` : `${headingName} 大会結果（歴代一覧）`}</h1>

        {/* 検索名で名乗る大会は、正式名称を置き換えるのではなく併記する（seo.md「大会名の表記と検索語の乖離」）。
            全中のように正式名称が全競技共通（全国中学校体育大会）の場合、ここが唯一の正式名称の出どころになる。 */}
        {needsFormalLabelNote && <p className="-mt-2 mb-4 text-sm text-text-secondary">正式名称は{formalLabel}（ソフトテニス競技）。</p>}

        {hsNationalHref && (
          <div className="mb-5 rounded-md border border-info-border bg-info-bg px-4 py-3 text-sm">
            <Link href={hsNationalHref} className="font-semibold text-link hover:underline">
              {label} 歴代記録（優勝・準優勝・ベスト4／開催予定）はこちら →
            </Link>
            <p className="mt-1 text-text-secondary">
              種目別の歴代優勝サマリーや出場校の戦績まで、{label}
              のまとめは高校カテゴリの歴代記録ページに集約しています。
            </p>
          </div>
        )}

        {featurePath && (
          <div className="mb-5 rounded-md border border-info-border bg-info-bg px-4 py-3 text-sm">
            <Link href={featurePath} className="font-semibold text-link hover:underline">
              {label} の結果・順位表・出場チームはこちら →
            </Link>
            <p className="mt-1 text-text-secondary">
              {label}
              は年度別の順位表・対戦結果・選手成績を専用ページにまとめています。
            </p>
          </div>
        )}

        {upcoming && <UpcomingTournamentSection data={upcoming} />}

        <RelatedTournamentsBlock links={relatedLinks} />

        {qualifierFinishers && <QualifierFinishersSection data={qualifierFinishers} />}

        <section className="mb-6 px-1">
          <p className="mb-2 text-sm text-gray-700 dark:text-gray-200">
            {upcomingOnly ? (
              <>ソフトテニス「{upcomingOnly.label}」の日程・会場・実施種目をまとめています。 この大会の結果はまだ掲載していません（大会終了後に追加します）。</>
            ) : (
              <>
                ソフトテニス「{label}
                」の歴代の試合結果・トーナメント表・優勝/上位入賞者を年度別にまとめています。
                {yearRange ? `${yearRange}の大会結果を掲載中です。` : ''}
                見たい年度・種別を選ぶと、各大会の詳細な結果ページに移動できます。
              </>
            )}
          </p>
          {officialUrl && !upcomingOnly && (
            <p className="text-sm text-text-secondary">
              公式サイト:{' '}
              <a href={officialUrl} className="text-link hover:underline" target="_blank" rel="noopener noreferrer">
                {officialUrl}
              </a>
            </p>
          )}
        </section>

        {championCategoryGroups.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold mb-3">歴代優勝者</h2>
            {/* 種目×年度の表形式。年度が増えるほど右に伸びるので、種目（1列目）を固定して横スクロールできるようにする。 */}
            <div className="overflow-x-auto rounded-lg shadow">
              <table className="w-full min-w-max border-collapse text-sm text-gray-700 dark:text-gray-200">
                <thead className="bg-bg-subtle text-text">
                  <tr>
                    <th className="sticky left-0 z-10 bg-bg-subtle px-4 py-2 text-left">種目</th>
                    {championTable.years.map((year) => (
                      <th key={year} className="whitespace-nowrap px-4 py-2">
                        {year}年
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {championTable.rows.map((row, index) => {
                    const prevCategory = index > 0 ? championTable.rows[index - 1].category : null;
                    const showGroupHeader = row.category && row.category !== prevCategory;
                    return (
                      <Fragment key={row.categoryLabel}>
                        {showGroupHeader && (
                          <tr className="border-t border-border">
                            <td
                              colSpan={championTable.years.length + 1}
                              className="sticky left-0 z-10 bg-bg-subtle px-4 py-1.5 text-xs font-semibold text-text-secondary"
                            >
                              {getCategoryLabel(row.category as string)}
                            </td>
                          </tr>
                        )}
                        <tr className="border-t border-border">
                          <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-4 py-2 font-medium">{row.rowLabel}</td>
                          {championTable.years.map((year) => {
                            const r = row.cellsByYear.get(year) ?? null;
                            return (
                              <td key={year} className="whitespace-nowrap px-4 py-2 text-center">
                                {!r ? (
                                  <span className="text-text-muted">ー</span>
                                ) : r.winner ? (
                                  r.winnerPlayers && r.winnerPlayers.length > 0 ? (
                                    <>
                                      {r.winnerPlayers.map((p, i) => (
                                        <span key={`${p.name}-${i}`}>
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
                                      {r.winnerTeamsLabel && <span className="mt-0.5 block text-xs text-text-muted">{r.winnerTeamsLabel}</span>}
                                    </>
                                  ) : (
                                    // team カテゴリ（個人名が無い）。ダブルスと同じく1行目にチーム名、
                                    // 2行目に都道府県を表示する（その年度の結果ページへのリンク付き）。
                                    <>
                                      <Link href={r.href} className="text-link hover:underline">
                                        {r.winnerTeamsLabel ?? r.winner}
                                      </Link>
                                      {r.winnerPrefectureLabel && <span className="mt-0.5 block text-xs text-text-muted">{r.winnerPrefectureLabel}</span>}
                                    </>
                                  )
                                ) : (
                                  <span className="text-xs text-text-muted">{r.abandonedAfterRound}打ち切り</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <TournamentContextBlocks label={label} data={contextBlocks} />

        {clubTransition && <ClubTransitionSection label={label} data={clubTransition} />}

        {yearGroups.length === 0 ? (
          // 開催前ブロックが「まだ結果が無い」ことを既に説明しているため、そこでは出さない
          upcomingOnly ? null : (
            <p className="text-sm text-gray-500">現在、掲載中の結果データがありません。</p>
          )
        ) : (
          <section className="mb-10">
            <h2 className="text-lg font-bold mb-3">年度別結果</h2>
            {yearGroups.map((g) => (
              <section className="mb-8" key={g.year}>
                <h3 className="text-base font-semibold mb-1">{g.year}年度</h3>
                {(g.location || g.startDate) && (
                  <p className="mb-2 text-xs text-text-muted">
                    {g.location ? `開催地:${g.location}` : ''}
                    {g.location && g.startDate ? ' / ' : ''}
                    {g.startDate ? `日程:${g.startDate}${g.endDate ? `〜${g.endDate}` : ''}` : ''}
                  </p>
                )}
                <ul className="flex flex-wrap gap-2">
                  {g.categories.map((c) => (
                    <li key={`${g.year}-${c.category}-${c.age}-${c.gender}`}>
                      <Link href={c.href}>
                        <span className="inline-block bg-info-bg text-info px-3 py-1 rounded-full text-sm hover:opacity-80 transition">{c.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </section>
        )}

        <div className="text-right mt-10 mb-2">
          <Link href="/tournaments" className="text-sm text-blue-500 hover:underline">
            大会結果一覧へ
          </Link>
        </div>
      </PageLayout>
    </>
  );
}

type ExtractedWinner = {
  display: string;
  /** 個人名の内訳（選手ページへのリンク用）。team カテゴリ（個人名が無い）では空配列。 */
  players: WinnerPlayer[];
  /** 所属校名（個人戦は「（〇〇高校）」の中身、team カテゴリはチーム名そのもの）。無ければ null。 */
  teamsLabel: string | null;
  /** team カテゴリ（個人名が無い）の都道府県表記。個人戦では null。 */
  teamPrefectureLabel: string | null;
};

// data/players/index.json（掲載選手全体・数千件）は選手ページと同じ「姓名一致・count>=5・
// 同姓同名は最初のID」規約で数値IDへ解決する（docs/wiki/players-pages.md「選手名から
// 『その選手の成績ページ』へ内部リンクしたい一般用途」）。このハブページは大会数ぶん
// （数十回）呼ばれるだけだが、他ページ（TeamsRanking 等）と同じくプロセス内で一度だけ
// 読み込んでキャッシュし、1.2MB の JSON を毎回パースし直さないようにする。
let cachedPlayerNameToId: Map<string, number> | null = null;

function getPlayerNameToIdMap(): Map<string, number> {
  if (cachedPlayerNameToId) return cachedPlayerNameToId;
  const map = new Map<string, number>();
  const playersIndexPath = path.join(process.cwd(), 'data', 'players', 'index.json');
  if (fs.existsSync(playersIndexPath)) {
    try {
      const playersIndex = JSON.parse(fs.readFileSync(playersIndexPath, 'utf-8')) as Array<{
        id: number;
        lastName: string;
        firstName: string;
        count: number;
      }>;
      for (const p of playersIndex) {
        if (p.count < 5) continue;
        const key = `${p.lastName}::${p.firstName}`;
        // 同姓同名は最初の ID を使う（players/index.tsx 等と同じ既存規約）
        if (!map.has(key)) map.set(key, p.id);
      }
    } catch (err) {
      console.error('failed to parse players index.json', err);
    }
  }
  cachedPlayerNameToId = map;
  return map;
}

// 詳細JSONから優勝ペア（選手名・所属）を抽出する。なければ null。
function extractWinner(detailPath: string, nameToId: Map<string, number>): ExtractedWinner | null {
  try {
    const data = JSON.parse(fs.readFileSync(detailPath, 'utf-8')) as {
      participants?: Array<{
        id: string;
        lastName?: string;
        firstName?: string;
        team?: string;
        prefecture?: string;
      }>;
      entries?: Array<{ entryNo: number; playerIds: string[] }>;
      results?: Array<{
        entryNo: number;
        tournament?: { rank?: { kind?: string } };
      }>;
    };
    const winResult = (data.results ?? []).find((r) => r.tournament?.rank?.kind === 'winner');
    if (!winResult) return null;
    const entry = (data.entries ?? []).find((e) => e.entryNo === winResult.entryNo);
    if (!entry) return null;
    const pmap = new Map((data.participants ?? []).map((p) => [p.id, p] as const));
    const players: WinnerPlayer[] = [];
    const names = entry.playerIds.map((id) => {
      const p = pmap.get(id);
      if (!p) return id;
      const name = joinPlayerName(p.lastName, p.firstName);
      // team カテゴリは lastName/firstName が無く name が空文字になるため、
      // 個人名リストには入れない（リンク先の無い空リンクを作らない）。
      if (p.lastName && p.firstName && name) {
        players.push({ name, playerId: nameToId.get(`${p.lastName}::${p.firstName}`) ?? null });
      }
      return name;
    });
    const teams = [...new Set(entry.playerIds.map((id) => pmap.get(id)?.team).filter((t): t is string => Boolean(t)))];
    const prefectures = [...new Set(entry.playerIds.map((id) => pmap.get(id)?.prefecture).filter((p): p is string => Boolean(p)))];
    const nameStr = names.join('・');
    const teamsLabel = teams.length > 0 ? teams.join('・') : null;
    let display: string;
    if (!nameStr) {
      // team カテゴリ（個人名が無い）は所属名がそのままチーム名なので、
      // 「（チーム名）」ではなく「チーム名（都道府県）」で表示する。
      display = teamsLabel ? (prefectures.length > 0 ? `${teamsLabel}（${prefectures.join('・')}）` : teamsLabel) : '';
    } else {
      display = teamsLabel ? `${nameStr}（${teamsLabel}）` : nameStr;
    }
    const teamPrefectureLabel = !nameStr && prefectures.length > 0 ? prefectures.join('・') : null;
    return { display, players, teamsLabel, teamPrefectureLabel };
  } catch {
    return null;
  }
}

function loadGenerationMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const file of ['index.json', 'local_index.json']) {
    const p = path.join(process.cwd(), 'data', 'tournaments', file);
    if (!fs.existsSync(p)) continue;
    try {
      const idx = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(idx)) {
        for (const it of idx) {
          if (it && typeof it === 'object') {
            const entry = it as Record<string, unknown>;
            const tid = entry['tournamentId'];
            const gen = entry['generationId'];
            if (typeof tid === 'string') {
              map[tid] = typeof gen === 'string' ? gen : 'unknown';
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return map;
}

function loadIndexEntry(tournamentId: string): TournamentIndexEntry | null {
  for (const file of ['index.json', 'local_index.json']) {
    const p = path.join(process.cwd(), 'data', 'tournaments', file);
    if (!fs.existsSync(p)) continue;
    try {
      const idx = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(idx)) {
        const found = idx.find((it) => it && typeof it === 'object' && (it as TournamentIndexEntry).tournamentId === tournamentId);
        if (found) return found as TournamentIndexEntry;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/** tournamentId -> {label, generationId}。`getQualifierFinishers` へ渡す。 */
function buildIndexById(): Map<string, { label: string; generationId: string }> {
  const generationMap = loadGenerationMap();
  const map = new Map<string, { label: string; generationId: string }>();
  for (const tid of Object.keys(generationMap)) {
    const entry = loadIndexEntry(tid);
    if (!entry) continue;
    map.set(tid, { label: entry.label, generationId: generationMap[tid] });
  }
  return map;
}

/** tournamentId -> 開催情報。`getQualifierFinishers` へ渡す。 */
function buildInformationMap(): Map<string, TournamentInformationEntry[]> {
  const dir = path.join(process.cwd(), 'data', 'tournaments', 'information');
  const map = new Map<string, TournamentInformationEntry[]>();
  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      if (Array.isArray(parsed)) map.set(file.replace(/\.json$/, ''), parsed as TournamentInformationEntry[]);
    } catch {
      // ignore
    }
  }
  return map;
}

export const getStaticPaths: GetStaticPaths = async () => {
  // nft（output file tracing）が静的解決できるよう、パスセグメントはリテラルで書く。
  // `path.join(process.cwd(), ...ARRAY, 変数)` にすると nft が解決を諦め、
  // リポジトリ全体を再帰 glob する（ビルドが数分遅くなる）。
  // 詳細: docs/wiki/deployment.md「output file tracing（nft）のワイルドカード走査」
  const detailsRoot = path.join(process.cwd(), 'data', 'tournaments', 'details');
  const generationMap = loadGenerationMap();

  const idsWithDetails = fs.existsSync(detailsRoot) ? fs.readdirSync(detailsRoot).filter((n) => fs.statSync(path.join(detailsRoot, n)).isDirectory()) : [];

  // TournamentCard などから「歴代結果・優勝者まとめ」リンクは、外部結果リンクのみで
  // details 配下にデータがない大会（＝まだ大会結果が掲載されていない地方大会）にも
  // 一律で張られる。details ディレクトリの有無だけでパスを作ると、そうした大会の
  // ハブページが生成されず404になってしまうため、index.json / local_index.json に
  // 登録済みの大会IDも合わせて対象にし、空状態（掲載中の結果データがありません）を
  // 表示できるようにする。
  const tournamentIds = new Set<string>([...idsWithDetails, ...Object.keys(generationMap)]);

  const paths = Array.from(tournamentIds).map((tid) => ({
    params: {
      generation: generationMap[tid] ?? 'unknown',
      tournamentId: tid,
    },
  }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { generation, tournamentId } = context.params as {
    generation: string;
    tournamentId: string;
  };

  const indexEntry = loadIndexEntry(tournamentId);
  const label = indexEntry?.label ?? tournamentId;
  const searchLabel = indexEntry?.searchLabel ?? null;
  const searchAliases = indexEntry?.searchAliases ?? [];
  const officialUrl = indexEntry?.officialUrl || null;

  // information から年度ごとの開催情報・カテゴリラベルを取得
  const infoPath = path.join(process.cwd(), 'data', 'tournaments', 'information', `${tournamentId}.json`);
  let information: TournamentInformationEntry[] = [];
  if (fs.existsSync(infoPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
      if (Array.isArray(parsed)) information = parsed;
    } catch {
      // ignore
    }
  }

  const categoryLabelByYear = new Map<string, Map<string, string>>();
  const infoByYear = new Map<string, TournamentInformationEntry>();
  for (const entry of information) {
    const y = String(entry.year);
    infoByYear.set(y, entry);
    const m = new Map<string, string>();
    for (const cat of entry.categories ?? []) {
      m.set(cat.categoryId, cat.label);
    }
    categoryLabelByYear.set(y, m);
  }

  // 優勝者名 → 選手ページ数値ID の解決マップ（プロセス内キャッシュ）
  const playerNameToId = getPlayerNameToIdMap();

  // details ディレクトリを走査し、実際にデータがある年度・種別のみリンク化
  // nft（output file tracing）が静的解決できるよう、パスセグメントはリテラルで書く。
  // `path.join(process.cwd(), ...ARRAY, 変数)` にすると nft が解決を諦め、
  // リポジトリ全体を再帰 glob する（ビルドが数分遅くなる）。
  // 詳細: docs/wiki/deployment.md「output file tracing（nft）のワイルドカード走査」
  const tidDir = path.join(process.cwd(), 'data', 'tournaments', 'details', tournamentId);
  const yearGroups: YearGroup[] = [];

  if (fs.existsSync(tidDir)) {
    const years = fs
      .readdirSync(tidDir)
      .filter((y) => {
        const p = path.join(tidDir, y);
        return fs.statSync(p).isDirectory();
      })
      .sort((a, b) => Number(b) - Number(a)); // 年度降順

    for (const y of years) {
      const yearDir = path.join(tidDir, y);
      const files = fs.readdirSync(yearDir).filter((f) => f.endsWith('.json'));

      const labelMap = categoryLabelByYear.get(y) ?? new Map<string, string>();
      const categories: CategoryLink[] = [];

      for (const f of files) {
        const base = f.replace(/\.json$/, '');
        const parts = base.split('-');
        if (parts.length < 3) continue;
        const gender = parts.pop() as string;
        const age = parts.pop() as string;
        const category = parts.join('-');
        const categoryId = `${category}-${age}-${gender}`;

        const extracted = extractWinner(path.join(yearDir, f), playerNameToId);

        categories.push({
          label: labelMap.get(categoryId) ?? categoryId,
          category,
          age,
          gender,
          href: `/tournaments/${generation}/${tournamentId}/${y}/${category}/${age}/${gender}`,
          winner: extracted?.display ?? null,
          winnerPlayers: extracted && extracted.players.length > 0 ? extracted.players : null,
          winnerTeamsLabel: extracted?.teamsLabel ?? null,
          winnerPrefectureLabel: extracted?.teamPrefectureLabel ?? null,
          abandonedAfterRound: getAbandonment(infoByYear.get(y)?.categories, categoryId)?.abandonedAfterRound ?? null,
        });
      }

      if (categories.length === 0) continue;

      const info = infoByYear.get(y) ?? null;
      yearGroups.push({
        year: y,
        location: info?.location || null,
        startDate: info?.startDate || null,
        endDate: info?.endDate || null,
        categories,
      });
    }
  }

  // 結果が details ではなく特集ページ側にある大会（STリーグ等）は、information の
  // resultPath から年度別の導線を作る。details が無い＝空状態になるのを避けるため。
  const featurePath = indexEntry?.featurePath || null;
  if (featurePath && yearGroups.length === 0) {
    for (const entry of [...information].sort((a, b) => b.year - a.year)) {
      if (!entry.resultPath) continue;
      yearGroups.push({
        year: String(entry.year),
        location: entry.location || null,
        startDate: entry.startDate || null,
        endDate: entry.endDate || null,
        categories: [
          {
            label: '結果・順位表',
            category: 'team',
            age: 'none',
            gender: 'all',
            href: entry.resultPath,
            winner: null,
            winnerPlayers: null,
            winnerTeamsLabel: null,
            winnerPrefectureLabel: null,
            abandonedAfterRound: null,
          },
        ],
      });
    }
  }

  // --- 文脈ブロック（最新年度の milestone と優勝者の通算成績）---
  // docs/wiki/news-context-blocks.md / ADR-005。
  // featurePath 大会の yearGroups は details 由来ではない（優勝者・前哨戦を引けない）ため文脈ブロックは作らない
  const latestGroup = featurePath ? null : (yearGroups[0] ?? null);
  const latestYear = latestGroup?.year ?? null;
  const contextBlocks: TournamentContextData = {
    latestYear,
    milestones: [],
    championRecords: [],
    priorMeetings: [],
  };

  if (latestGroup) {
    const ty = Number(latestGroup.year);
    const seenMilestone = new Set<string>();
    const seenRecord = new Set<string>();

    // 最新年度の種目は yearGroups（解析済み）を再利用し、ディレクトリ再走査と
    // categoryId の再パースを避ける。
    for (const c of latestGroup.categories) {
      const categoryId = `${c.category}-${c.age}-${c.gender}`;

      // historical-winners は milestone と career-record で共有し、二重走査を避ける
      const hw = getHistoricalWinners(tournamentId, categoryId, {
        targetYear: ty,
      });

      // milestone（連覇 / 初優勝）
      const ms = getChampionMilestones(tournamentId, categoryId, ty, hw);
      for (const e of ms?.events ?? []) {
        // ラベルではなくイベント実体（種別×大会×種目×年×主役）で重複排除する。
        // 同一表示文字列の別イベント（例: 別種目の初優勝）を取りこぼさない。
        // 主役（subject.display）まで含めるのは、ダブルスを選手個人単位で判定する
        // ため同一年・同一種目で複数選手のイベント（例: 2人とも初優勝）が出るから。
        const key = `${e.kind}|${e.tournamentId}|${e.categoryId}|${e.year}|${e.subject.display}`;
        if (seenMilestone.has(key)) continue;
        seenMilestone.add(key);
        contextBlocks.milestones.push({
          kind: e.kind,
          label: e.label,
          confidence: e.confidence,
          scopeNote: e.scopeNote ?? null,
        });
      }

      // 優勝者の career-record（curated 選手のみ取得できる）
      const champ = hw?.champions.find((cc) => cc.year === ty);
      for (const name of champ?.players ?? []) {
        const cr = getCareerRecordByFullName(name);
        if (!cr || seenRecord.has(cr.subject.slug)) continue;
        seenRecord.add(cr.subject.slug);
        contextBlocks.championRecords.push({
          slug: cr.subject.slug,
          display: cr.subject.display,
          team: cr.subject.team,
          totals: {
            matches: cr.totals.matches,
            wins: cr.totals.wins,
            losses: cr.totals.losses,
            winRate: cr.totals.winRate,
          },
          titles: cr.titles.map((t) => ({
            year: t.year,
            tournamentLabel: t.tournamentLabel,
            categoryLabel: t.categoryLabel,
          })),
          scopeNote: cr.scopeNote,
        });
      }

      // 前哨戦（最新年度の種目ごとに規模だけ出す。lib/priorMeetings.ts）
      const pmIndex = buildPriorMeetingIndex(tournamentId, ty, categoryId, generation || null);
      if (pmIndex.size > 0) {
        const total = readYearDetail(tournamentId, ty, categoryId)?.entries?.length ?? 0;
        if (total > 0) {
          contextBlocks.priorMeetings?.push({
            categoryLabel: c.label || categoryId,
            cards: countPriorMeetings(pmIndex),
            covered: countCoveredEntries(pmIndex),
            total,
            unit: categoryId.startsWith('team') ? '校' : categoryId.startsWith('singles') ? '選手' : 'ペア',
            href: `/tournaments/${generation}/${tournamentId}/${ty}/${c.category}/${c.age}/${c.gender}/`,
          });
        }
      }
    }
  }

  // --- 開催前ブロック ---
  // 会期が終わっていない information があれば、会期・会場・種目・関連大会を出す。
  // 結果DBであるこのサイトに唯一無かった「未来形の面」で、`venues` の最初の描画先でもある。
  // 「今日」は lib/highschoolInProgress.ts と同じくビルド時刻を使う（静的書き出しのため）。
  //
  // **判定は `endDate >= 今日` だけ**。当初は「その年度の結果がまだ無い」も条件に入れていたが、
  // これは `details/` にファイルがあるかを見ており、**組み合わせだけ投入した未開催の大会**まで
  // 「結果あり」と扱ってブロックを消していた（2026-08-26 修正）。実際、直近の全日本社会人
  // （2026-08-29 開幕・組み合わせ投入済み）でブロックが出ず、トップの「これから開催」から
  // 「第54回 全日本社会人選手権大会」をたどっても、その回の会期も会場も出ない状態になっていた。
  // 会期が終わっていない以上その大会は未開催なので、日程・会場を出すのが正しい。
  // 会期が終われば条件から外れて自動的に消える。
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingEntry =
    [...information].filter((e) => e.endDate && e.endDate >= todayIso).sort((a, b) => String(a.startDate ?? '').localeCompare(String(b.startDate ?? '')))[0] ??
    null;

  const upcoming: UpcomingTournamentData | null = upcomingEntry
    ? {
        year: upcomingEntry.year,
        label: upcomingEntry.label || label,
        startDate: upcomingEntry.startDate || null,
        endDate: upcomingEntry.endDate || null,
        location: upcomingEntry.location || null,
        venues: (upcomingEntry.venues ?? []).map((v) => ({
          name: v.name ?? null,
          city: v.city ?? null,
          address: v.address ?? null,
          postalCode: v.postalCode ?? null,
          tel: v.tel ?? null,
          courts: v.courts ?? null,
          surface: v.surface ?? null,
          usage: v.usage ?? null,
        })),
        categoryLabels: (upcomingEntry.categories ?? []).map((c) => c.label),
        officialUrl: upcomingEntry.sourceUrl || officialUrl || null,
        hasStarted: Boolean(upcomingEntry.startDate && upcomingEntry.startDate <= todayIso),
      }
    : null;

  return {
    props: {
      generation,
      tournamentId,
      label,
      searchLabel,
      searchAliases,
      officialUrl,
      yearGroups,
      hsNationalSlug: getHsNationalSlugByTournamentId(tournamentId),
      featurePath,
      contextBlocks,
      clubTransition: getClubTransition(tournamentId),
      upcoming,
      relatedLinks: buildRelatedTournamentLinks(tournamentId),
      // 予選会の上位進出者は、本大会がこれから開催されるときだけ出す
      // （終わったあとは本大会の結果そのものが載るため役割を終える）。
      qualifierFinishers: upcoming
        ? await getQualifierFinishers({
            mainTournamentId: tournamentId,
            mainStartDate: upcoming.startDate,
            informationMap: buildInformationMap(),
            indexById: buildIndexById(),
            playerNameToId,
          })
        : null,
    },
  };
};

/**
 * 予選会と本大会を相互リンクする。
 *
 * 対応付けは **tournamentId の命名規約** で行い、データ側にフィールドを増やさない。
 * `index.json` の国際大会予選は3件すべて `{本大会ID}-qualifier` 形式
 * （`world-championship-qualifier` / `asian-championship-qualifier` / `asian-games-qualifier`）で、
 * 本大会が未登録なら単にリンクが出ないだけで壊れない。将来 `world-championship` 等を
 * 登録したときも自動で繋がる。
 */
function buildRelatedTournamentLinks(tournamentId: string): RelatedTournamentLink[] {
  const generationMap = loadGenerationMap();
  const links: RelatedTournamentLink[] = [];
  const todayIso = new Date().toISOString().slice(0, 10);

  const push = (tid: string, description: string) => {
    const gen = generationMap[tid];
    if (!gen) return;
    const entry = loadIndexEntry(tid);
    if (!entry) return;

    // 相手が開催前なら会期・開催地を説明に足す（「本番がいつどこであるか」がこの導線の主目的）
    let suffix = '';
    const infoPath = path.join(process.cwd(), 'data', 'tournaments', 'information', `${tid}.json`);
    if (fs.existsSync(infoPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(infoPath, 'utf-8')) as TournamentInformationEntry[];
        const future = (Array.isArray(parsed) ? parsed : [])
          .filter((e) => e.endDate && e.endDate >= todayIso)
          .sort((a, b) => String(a.startDate ?? '').localeCompare(String(b.startDate ?? '')))[0];
        if (future?.startDate) {
          suffix = `（${future.startDate}〜${future.endDate ?? future.startDate}${future.location ? ` ${future.location}` : ''}）`;
        }
      } catch {
        // ignore
      }
    }

    links.push({ label: entry.label, href: `/tournaments/${gen}/${tid}/`, description: `${description}${suffix}` });
  };

  if (tournamentId.endsWith('-qualifier')) {
    push(tournamentId.replace(/-qualifier$/, ''), 'この予選会の先にある本大会');
  } else {
    push(`${tournamentId}-qualifier`, '日本代表を決める予選会。出場選手の成績を掲載');
  }

  return links;
}
