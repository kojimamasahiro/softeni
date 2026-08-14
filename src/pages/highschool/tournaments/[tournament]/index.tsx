// pages/highschool/tournaments/[tournament]/index.tsx
// 高校カテゴリ「全国大会 歴代記録」: 大会ごとの年度別・種目別の上位入賞（優勝〜ベスト4）。
// 都道府県別・学校別ページとは別に、代表的な全国大会そのものを軸にした回遊ページ。

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { Fragment } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import {
  getHsNationalTournamentRecords,
  HS_NATIONAL_SLUGS,
  HS_NATIONAL_TOURNAMENTS,
  type ChampionSummaryRow,
  type HsNationalTournamentSlug,
  type InProgressCategory,
  type InProgressEdition,
  type PlayerLink,
  type TeamLink,
  type TournamentRecords,
  type UpcomingEdition,
} from '@/lib/highschoolNationalTournaments';

type Props = {
  records: TournamentRecords;
};

/** 学校名を、学校ページが実在する場合のみリンク表示する（・区切り） */
function SchoolNames({ links }: { links: TeamLink[] }) {
  if (links.length === 0) {
    return <span className="font-normal text-gray-400">—</span>;
  }
  return (
    <>
      {links.map((t, i) => (
        <span key={`${t.name}-${i}`}>
          {i > 0 && '・'}
          {t.href ? (
            <Link href={t.href} className="text-link hover:underline">
              {t.name}
            </Link>
          ) : (
            t.name
          )}
        </span>
      ))}
    </>
  );
}

/** 選手名を、試合結果ページが実在する場合のみリンク表示する（・区切り） */
function PlayerNames({ links }: { links: PlayerLink[] }) {
  if (links.length === 0) {
    return <span className="font-normal text-gray-400">—</span>;
  }
  return (
    <>
      {links.map((p, i) => (
        <span key={`${p.name}-${i}`}>
          {i > 0 && '・'}
          {p.href ? (
            <Link href={p.href} className="text-link hover:underline">
              {p.name}
            </Link>
          ) : (
            p.name
          )}
        </span>
      ))}
    </>
  );
}

/** 上位入賞の表示名。個人は「選手名（所属校リンク）」、団体は校名リンク。 */
function PlacementName({ playerLinks, teamLinks }: { playerLinks: PlayerLink[]; teamLinks: TeamLink[] }) {
  if (playerLinks.length === 0) {
    return <SchoolNames links={teamLinks} />;
  }
  return (
    <>
      <PlayerNames links={playerLinks} />
      {teamLinks.length > 0 && (
        <>
          （<SchoolNames links={teamLinks} />）
        </>
      )}
    </>
  );
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return '';
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${Number(y)}年${Number(m)}月${Number(day)}日`;
  };
  if (!endDate || endDate === startDate) return fmt(startDate);
  const [, em, ed] = endDate.split('-');
  return `${fmt(startDate)}〜${Number(em)}月${Number(ed)}日`;
}

/** 次回大会（開催予定）の案内。結果が出る前から大会の存在を示す。 */
function UpcomingSection({ editions, shortLabel, officialUrl }: { editions: UpcomingEdition[]; shortLabel: string; officialUrl: string }) {
  if (editions.length === 0) return null;
  return (
    <section className="mb-10">
      {editions.map((ed) => {
        const dateRange = formatDateRange(ed.startDate, ed.endDate);
        return (
          <div key={ed.year} className="rounded-2xl border border-success-border bg-success-bg p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-xs font-bold">開催予定</span>
              <h2 className="text-lg font-bold">
                {ed.year}年 {shortLabel}
              </h2>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-1.5 text-sm">
              {dateRange && (
                <div className="flex gap-2">
                  <dt className="text-text-muted">日程</dt>
                  <dd className="font-semibold">{dateRange}</dd>
                </div>
              )}
              {ed.location && (
                <div className="flex gap-2">
                  <dt className="text-text-muted">開催地</dt>
                  <dd className="font-semibold">{ed.location}</dd>
                </div>
              )}
              {ed.categoryLabels.length > 0 && (
                <div className="flex gap-2">
                  <dt className="text-text-muted">種目</dt>
                  <dd className="font-semibold">{ed.categoryLabels.join('・')}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-sm text-text-secondary">
              結果が確定し次第、本ページの「年度別の記録」に追加します。 最新情報は
              <a href={ed.sourceUrl || officialUrl} target="_blank" rel="noopener noreferrer" className="text-link hover:underline mx-0.5">
                大会公式サイト
              </a>
              をご確認ください。
            </p>
          </div>
        );
      })}
    </section>
  );
}

/**
 * 開催中（または組み合わせのみ掲載済み）の大会ブロック。
 *
 * このページは「{大会} 歴代」系クエリで唯一順位が付いている入口だが、大会期間中は
 * 「結果が確定し次第このページに追加します」としか書いておらず、検索から来た人を
 * 大会公式サイトへ逃がしていた。開催中は最上部でその年の対戦表・勝ち上がりへ
 * 直接橋渡しする（docs/wiki/seo.md #11）。
 */
function InProgressSection({ edition, shortLabel, hasStarted }: { edition: InProgressEdition; shortLabel: string; hasStarted: boolean }) {
  const dateRange = formatDateRange(edition.startDate, edition.endDate);
  const statusLabel = hasStarted ? '開催中' : '組み合わせ掲載中';

  return (
    <section className="mb-10" id="current">
      <div className="rounded-2xl border-2 border-emerald-500/70 bg-success-bg p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-xs font-bold">{statusLabel}</span>
          <h2 className="text-lg sm:text-xl font-bold">
            {edition.year}年 {shortLabel} 結果・{hasStarted ? '途中経過' : '組み合わせ'}
          </h2>
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-1.5 text-sm mb-4">
          {dateRange && (
            <div className="flex gap-2">
              <dt className="text-text-muted">日程</dt>
              <dd className="font-semibold">{dateRange}</dd>
            </div>
          )}
          {edition.location && (
            <div className="flex gap-2">
              <dt className="text-text-muted">開催地</dt>
              <dd className="font-semibold">{edition.location}</dd>
            </div>
          )}
          {edition.totalSchools > 0 && (
            <div className="flex gap-2">
              <dt className="text-text-muted">出場校</dt>
              <dd className="font-semibold tabular-nums">{edition.totalSchools}校</dd>
            </div>
          )}
          {edition.totalPrefectures > 0 && (
            <div className="flex gap-2">
              <dt className="text-text-muted">出場都道府県</dt>
              <dd className="font-semibold tabular-nums">{edition.totalPrefectures}</dd>
            </div>
          )}
        </dl>

        <div className="grid gap-3 sm:grid-cols-2">
          {edition.categories.map((cat) => (
            <InProgressCategoryCard key={cat.categoryId} cat={cat} />
          ))}
        </div>

        <p className="mt-4 text-xs text-text-secondary">
          結果は大会の進行に合わせて随時更新しています。確定した優勝・準優勝・ベスト4は、下の「年度別の記録」へ順次追加します。
        </p>
      </div>
    </section>
  );
}

/** 開催中の1種目ぶんのカード。対戦表への導線と、現在の勝ち上がりを出す。 */
function InProgressCategoryCard({ cat }: { cat: InProgressCategory }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h3 className="font-semibold">{cat.label}</h3>
        <Link href={cat.bracketHref} className="text-xs text-link hover:underline whitespace-nowrap">
          対戦表・全試合結果
        </Link>
      </div>

      <p className="text-xs text-text-muted mb-2 tabular-nums">
        {cat.entryCount}
        {cat.category === 'team' ? '校出場' : 'ペア出場'}
        {cat.schoolCount > 0 && cat.category !== 'team' ? ` / ${cat.schoolCount}校` : ''}
      </p>

      {cat.statusText && <p className="text-xs text-text-secondary mb-2">{cat.statusText}</p>}

      {cat.aliveRoundLabel && cat.aliveLeaders.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <p className="text-xs font-semibold text-text-secondary mb-1.5">現在勝ち上がり中（{cat.aliveRoundLabel}）</p>
          <ul className="space-y-1">
            {cat.aliveLeaders.map((p, idx) => (
              <li key={`${cat.categoryId}-alive-${idx}`} className="text-sm">
                <PlacementName playerLinks={p.playerLinks} teamLinks={p.teamLinks} />
                {p.prefectures.length > 0 && <span className="ml-1 text-xs text-text-muted">{p.prefectures.join('・')}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cat.aliveRoundLabel && cat.aliveLeaders.length === 0 && (
        <p className="text-xs text-text-muted">現在の勝ち上がりは対戦表ページで確認できます（{cat.aliveRoundLabel}）。</p>
      )}
    </div>
  );
}

const RANK_BADGE_CLASS: Record<string, string> = {
  優勝: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  準優勝: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  ベスト4: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
};

function formatYearRange(years: number[]): string {
  if (years.length === 0) return '';
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `${min}年` : `${min}〜${max}年`;
}

/** 表のグループ見出し（種目）。行見出しは性別だけにして重複させない */
function categoryGroupLabel(category: string): string {
  if (category === 'team') return '団体戦';
  if (category === 'singles') return 'シングルス';
  if (category === 'doubles') return 'ダブルス';
  return category;
}

function genderRowLabel(gender: string, fallback: string): string {
  if (gender === 'boys') return '男子';
  if (gender === 'girls') return '女子';
  if (gender === 'mixed') return '混合';
  return fallback;
}

/**
 * 歴代優勝を**種目×年度の1つの表**で出す（2026-08-13 変更）。
 *
 * 以前は種目ごとにカードを作り、その中で「年度・学校・選手・都道府県」を縦に並べていた。
 * 種目4つ×年度6つで4枚のカードに分かれ、**年度をまたいだ比較がしづらい**うえ、
 * 年度が増えるほど縦に伸び続ける。
 *
 * 中学（`/tournaments/[generation]/[tournamentId]` の「歴代優勝者」）が同じ問題を
 * 種目=行 / 年度=列 の表で解いているので、**UIをそちらに揃えた**。
 * 年度が増えると右に伸びるため、1列目（種目）を `sticky` で固定して横スクロールさせる。
 */
function ChampionSummary({ rows }: { rows: ChampionSummaryRow[] }) {
  if (rows.length === 0) return null;

  const years = [...new Set(rows.flatMap((r) => r.byYear.map((c) => c.year)))].sort((a, b) => b - a);
  const table = rows.map((r) => ({ ...r, cellsByYear: new Map(r.byYear.map((c) => [c.year, c] as const)) }));

  return (
    <section className="mb-12">
      <h2 className="text-xl font-bold mb-1">歴代優勝者</h2>
      <p className="text-sm text-text-secondary mb-4">年度ごとの優勝を種目別に並べています。横に並ぶ年度を見比べると、優勝の傾向を自分で確認できます。</p>

      {/* 年度が増えるほど右に伸びるので、種目（1列目）を固定して横スクロールできるようにする。 */}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full min-w-max border-collapse text-sm text-gray-700 dark:text-gray-200">
          <caption className="sr-only">歴代優勝（種目別・年度別の学校／選手／都道府県）</caption>
          <thead className="bg-bg-subtle text-text">
            <tr>
              <th className="sticky left-0 z-10 bg-bg-subtle px-4 py-2 text-left">種目</th>
              {years.map((year) => (
                <th key={year} className="whitespace-nowrap px-4 py-2">
                  {year}年
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.map((row, index) => {
              const prevCategory = index > 0 ? table[index - 1].category : null;
              const showGroupHeader = row.category && row.category !== prevCategory;
              return (
                <Fragment key={row.categoryId}>
                  {showGroupHeader && (
                    <tr className="border-t border-border">
                      <td colSpan={years.length + 1} className="sticky left-0 z-10 bg-bg-subtle px-4 py-1.5 text-xs font-semibold text-text-secondary">
                        {categoryGroupLabel(row.category)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-border">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-4 py-2 font-medium">{genderRowLabel(row.gender, row.label)}</td>
                    {years.map((year) => {
                      const cell = row.cellsByYear.get(year) ?? null;
                      if (!cell) {
                        return (
                          <td key={year} className="whitespace-nowrap px-4 py-2 text-center">
                            <span className="text-text-muted">ー</span>
                          </td>
                        );
                      }
                      return (
                        <td key={year} className="whitespace-nowrap px-4 py-2 text-center">
                          {/* 個人戦は「選手名」→「学校名（都道府県）」の2行。
                              学校と都道府県を別行にすると3行になって表が間延びするため1行にまとめる。
                              団体戦は学校名が主役なので「学校名」→「都道府県」の2行。 */}
                          {cell.playerLinks.length > 0 ? (
                            <>
                              <span className="font-semibold">
                                <PlayerNames links={cell.playerLinks} />
                              </span>
                              {(cell.teamLinks.length > 0 || cell.prefectures.length > 0) && (
                                <span className="mt-0.5 block text-xs text-text-muted">
                                  {cell.teamLinks.length > 0 && <SchoolNames links={cell.teamLinks} />}
                                  {cell.prefectures.length > 0 &&
                                    (cell.teamLinks.length > 0 ? `（${cell.prefectures.join('・')}）` : cell.prefectures.join('・'))}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="font-semibold">
                                <SchoolNames links={cell.teamLinks} />
                              </span>
                              {cell.prefectures.length > 0 && <span className="mt-0.5 block text-xs text-text-muted">{cell.prefectures.join('・')}</span>}
                            </>
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
  );
}

export default function HighschoolTournamentRecordsPage({ records }: Props) {
  const { slug, label, shortLabel, aliases, officialUrl, description, years, championSummary, upcoming, inProgress, lastModified, yearsCovered } = records;

  const pageUrl = `https://softeni-pick.com/highschool/tournaments/${slug}/`;
  // yearRange は「歴代（優勝が確定している年）」の範囲。FAQ 等でそう名乗るのでここに開催中の年を混ぜない
  const yearRange = formatYearRange(yearsCovered);
  // 収録年度の表示は、組み合わせ・途中経過を載せている開催中の年も含める
  const coverageRange = formatYearRange(inProgress ? [...yearsCovered, inProgress.year] : yearsCovered);
  const titleName = label === shortLabel ? label : `${label}（${shortLabel}）`;
  // 検索略称（例: ハイジャパ）。専用ページは作らず、この大会ハブに literal で集約する。
  // FAQ（「〜とは何ですか？」）はこの値で出す。
  const primaryAlias = aliases?.[0] ?? null;
  // 見出し・description に**併記**する略称。titleName に既に出ている語
  // （label / shortLabel）と同じなら併記しない。高校選抜は shortLabel も aliases[0] も
  // 「高校選抜」のため、素通しすると
  // 「全日本高等学校選抜ソフトテニス大会（高校選抜）（高校選抜）」と二重になる（2026-08-05 修正）。
  const displayAlias = primaryAlias && primaryAlias !== shortLabel && primaryAlias !== label ? primaryAlias : null;
  // タイトル/見出し向けの表示名。略称があれば exact 一致用に併記する。
  const headingName = displayAlias ? `${titleName}（${displayAlias}）` : titleName;
  // --- title 専用の表示名（2026-08-06） ---
  // title は「歴代」を**先頭30字以内**に置く。日本語 SERP の表示上限が概ね30字で、
  // それより後ろの語は検索結果に出ないため。従来は正式名称を先に置いており、
  // 「歴代」の開始位置が通常モード28字目・開催中モード40字目だった（実測）。
  // 対して 全日本シングルス（汎用ハブ）は17字目で、同じ「歴代」クエリで上位に付いている。
  // そこで title の頭は短い通称（shortLabel）にし、正式名称は後半へ回す。
  // 略称の併記は通常モードのみ。開催中モードは先頭に「{通称}{年} 結果・途中経過」が入るので、
  // 併記すると「歴代」が30字を超える（ハイジャパ併記時で40字目）。開催中でも略称は
  // h1・description・FAQ に literal で出ているので取りこぼさない。
  const titleLeadName = displayAlias && !inProgress ? `${shortLabel}（${displayAlias}）` : shortLabel;
  // 正式名称が通称と同一のとき（ハイスクールジャパンカップ）は重ねない
  const titleFormalSuffix = label === shortLabel ? '' : `｜${label}`;
  const latestYear = yearsCovered.length ? Math.max(...yearsCovered) : null;
  const categoryCount = championSummary.length;
  // 開催中の年は InProgressSection が受け持つので、「開催予定」からは外す（同じ年を二重に出さない）
  const upcomingEditions = inProgress ? upcoming.filter((e) => e.year !== inProgress.year) : upcoming;
  const nextEdition = upcomingEditions[0] ?? null;

  // 開催中フラグ。開催前（組み合わせのみ）と開催中で文言を変える
  const todayIso = new Date().toISOString().slice(0, 10);
  const hasStarted = Boolean(inProgress?.startDate && inProgress.startDate <= todayIso);
  const hasAnyResult = Boolean(inProgress?.categories.some((c) => c.status === 'in_progress'));
  // 「途中経過」と名乗れるのは実際に試合結果が入っているときだけ。まだなら「組み合わせ」
  const progressWord = hasAnyResult ? '途中経過' : '組み合わせ';
  const inProgressDateRange = inProgress ? formatDateRange(inProgress.startDate, inProgress.endDate) : '';

  const faqItems = [
    ...(inProgress
      ? [
          {
            question: `${shortLabel}${inProgress.year}の結果はこのページで分かりますか？`,
            answer: `${inProgress.year}年大会（${inProgressDateRange || '開催中'}${
              inProgress.location ? `・${inProgress.location}` : ''
            }）の${progressWord}をページ上部に掲載しています。種目ごとの「対戦表・全試合結果」から、全${inProgress.totalEntries}エントリー・${
              inProgress.totalSchools
            }校の勝ち上がりを1回戦から確認できます。大会の進行に合わせて随時更新しています。`,
          },
          {
            question: `${shortLabel}${inProgress.year}の組み合わせ（ドロー）は見られますか？`,
            answer: `見られます。各種目の対戦表ページに全${inProgress.totalEntries}エントリーの組み合わせを掲載しており、結果が入っていないラウンドも含めて勝ち上がりを追えます。出場は${inProgress.totalPrefectures}都道府県・${inProgress.totalSchools}校です。`,
          },
        ]
      : []),
    ...(nextEdition
      ? [
          {
            question: `次回の${shortLabel}（${nextEdition.year}年）はいつ・どこで開催されますか？`,
            answer: `${nextEdition.year}年大会は${
              formatDateRange(nextEdition.startDate, nextEdition.endDate) || '日程調整中'
            }${nextEdition.location ? `、${nextEdition.location}で` : ''}開催予定です。結果が確定次第このページに掲載します。`,
          },
        ]
      : []),
    ...(primaryAlias
      ? [
          {
            question: `「${primaryAlias}」とは何ですか？`,
            answer: `「${primaryAlias}」は${label}の通称です。本ページでは「${primaryAlias}」の歴代の優勝・準優勝・ベスト4を年度別・種目別にまとめ、各年度の対戦表へもリンクしています。`,
          },
        ]
      : []),
    {
      question: `${shortLabel}の歴代優勝校・優勝ペアはどこで分かりますか？`,
      answer: `このページで年度別・種目別に優勝〜ベスト4の上位入賞をまとめています。${yearRange ? `${yearRange}の` : ''}結果を確認できます。`,
    },
    {
      question: '都道府県別・学校別のページとの違いは何ですか？',
      answer:
        '都道府県・学校別ページは「その学校が各大会でどこまで勝ち上がったか」を学校視点でまとめています。このページは大会そのものを軸に、各年度の上位入賞者を横断的に確認できます。',
    },
    {
      question: '対戦表（トーナメント表）も見られますか？',
      answer: '各種目の「対戦表を見る」リンクから、その年度・種目の全試合結果・トーナメント表ページへ移動できます。',
    },
  ];

  const championRows = championSummary.flatMap((row) =>
    row.byYear.map((cell) => ({
      year: cell.year,
      categoryLabel: row.label,
      winner: cell.winner as string,
    })),
  );

  // 開催中は「{大会}{年} 結果」インテントを先頭に立てる。大会期間中がこのクエリの需要ピークで、
  // かつ本ページはこの大会で唯一順位が付いている入口のため（docs/wiki/seo.md #11）。
  // 終了後は従来の「歴代」インテントへ自動的に戻る。
  // 収録年度（（2021〜2026年度）等）と次回開催予定は title から外し description・FAQ に置く。
  // 30字の枠を「歴代優勝校・結果一覧」に使うため。とくに収録年度は、歴代クエリの利用者に
  // 「6年分しか無い」と SERP 上で先に伝えてしまう面もある。
  const metaTitle = inProgress
    ? `ソフトテニス ${titleLeadName}${inProgress.year} 結果・${progressWord}｜歴代優勝校一覧 | ソフトテニス情報`
    : `ソフトテニス ${titleLeadName} 歴代優勝校・結果一覧${titleFormalSuffix} | ソフトテニス情報`;

  const metaDescription = inProgress
    ? `ソフトテニス${shortLabel}${inProgress.year}（${label}）の${progressWord}を掲載中。${
        inProgressDateRange ? `${inProgressDateRange}` : ''
      }${inProgress.location ? `・${inProgress.location}開催` : ''}。${inProgress.categories
        .map((c) => c.label)
        .join('・')}の対戦表と、${inProgress.totalPrefectures}都道府県${inProgress.totalSchools}校・全${
        inProgress.totalEntries
      }エントリーの勝ち上がりを種目別に確認できます。${yearRange ? `${yearRange}の歴代優勝校・準優勝・ベスト4も一覧。` : ''}`
    : `ソフトテニス「${titleName}」${displayAlias ? `（通称「${displayAlias}」）` : ''}の歴代優勝校・優勝ペアを年度別・種目別に一覧でまとめました。${yearRange ? `${yearRange}の` : ''}優勝・準優勝・ベスト4の上位入賞と都道府県、各年度の対戦表へのリンクを掲載。${
        nextEdition
          ? `${nextEdition.year}年大会は${formatDateRange(nextEdition.startDate, nextEdition.endDate) || '開催予定'}${nextEdition.location ? `（${nextEdition.location}）` : ''}。`
          : ''
      }`;

  return (
    <>
      <MetaHead title={metaTitle} description={metaDescription} url={pageUrl} type="article" />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'ホーム',
                  item: 'https://softeni-pick.com/',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: '高校',
                  item: 'https://softeni-pick.com/highschool/boys/',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: '全国大会の歴代記録',
                  item: 'https://softeni-pick.com/highschool/tournaments/',
                },
                {
                  '@type': 'ListItem',
                  position: 4,
                  name: titleName,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
        {championRows.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: `${titleName} 歴代優勝者`,
                numberOfItems: championRows.length,
                itemListElement: championRows.map((r, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: `${r.year}年 ${r.categoryLabel}`,
                  description: `優勝: ${r.winner}`,
                })),
              }),
            }}
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqItems.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: item.answer,
                },
              })),
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: `${titleName} 歴代優勝校・結果一覧`,
              description: `${titleName}の歴代優勝校・上位入賞（優勝〜ベスト4）を年度別・種目別にまとめたページ。`,
              url: pageUrl,
              inLanguage: 'ja',
              ...(lastModified ? { dateModified: lastModified } : {}),
              isPartOf: {
                '@type': 'WebSite',
                name: 'ソフトテニス情報',
                url: 'https://softeni-pick.com/',
              },
            }),
          }}
        />
        {upcoming.map((ed) => (
          <script
            key={`event-${ed.year}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'SportsEvent',
                name: `${ed.year}年 ${titleName}`,
                sport: 'ソフトテニス',
                ...(ed.startDate ? { startDate: ed.startDate } : {}),
                ...(ed.endDate ? { endDate: ed.endDate } : {}),
                eventStatus: 'https://schema.org/EventScheduled',
                eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
                ...(ed.location
                  ? {
                      location: {
                        '@type': 'Place',
                        name: ed.location,
                        address: {
                          '@type': 'PostalAddress',
                          addressRegion: ed.location,
                          addressCountry: 'JP',
                        },
                      },
                    }
                  : {}),
                organizer: {
                  '@type': 'Organization',
                  name: '公益財団法人日本ソフトテニス連盟',
                  url: 'https://www.jsta.or.jp/',
                },
                url: pageUrl,
              }),
            }}
          />
        ))}
      </Head>

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '高校', href: '/highschool/boys/' },
            { label: '全国大会の歴代記録', href: '/highschool/tournaments/' },
            { label: titleName, href: `/highschool/tournaments/${slug}` },
          ]}
        />

        <header className="mb-8 rounded-2xl border border-border bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/80 dark:to-gray-900 p-6 sm:p-7">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {inProgress ? `${headingName} ${inProgress.year} 結果・${progressWord}と歴代優勝校一覧` : `${headingName} 歴代結果・優勝校一覧`}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">{description}</p>
          {inProgress && (
            <p className="mt-2 text-sm text-text-secondary">
              {inProgress.year}年大会は{inProgressDateRange || '開催中'}
              {inProgress.location ? `・${inProgress.location}` : ''}で{hasStarted ? '開催中' : '開催予定'}です。
              {progressWord}はこのページ上部にまとめています。
            </p>
          )}

          {(coverageRange || categoryCount > 0) && (
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              {coverageRange && (
                <div>
                  <dt className="text-xs text-text-muted">収録年度</dt>
                  <dd className="font-semibold tabular-nums">{coverageRange}</dd>
                </div>
              )}
              {categoryCount > 0 && (
                <div>
                  <dt className="text-xs text-text-muted">収録種目</dt>
                  <dd className="font-semibold tabular-nums">{categoryCount}種目</dd>
                </div>
              )}
            </dl>
          )}

          {officialUrl && (
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1 rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-bg-subtle transition"
            >
              大会公式サイト
              <span aria-hidden>↗</span>
            </a>
          )}
        </header>

        {inProgress && <InProgressSection edition={inProgress} shortLabel={shortLabel} hasStarted={hasStarted} />}

        <UpcomingSection editions={upcomingEditions} shortLabel={shortLabel} officialUrl={officialUrl} />

        <p className="mb-8 text-sm text-text-secondary">
          {yearRange ? `${yearRange}にかけての` : ''}各年度・種目別に、 優勝・準優勝・ベスト4の上位入賞をまとめています。
          気になる年度は「対戦表を見る」から全試合結果・トーナメント表へ進めます。 学校名から各校の戦績ページへも移動できます。
        </p>

        {lastModified && <p className="mb-8 -mt-4 text-xs text-gray-400 dark:text-gray-500">最終更新: {formatDateRange(lastModified, null)}</p>}

        <ChampionSummary rows={championSummary} />

        {years.length === 0 ? (
          <p className="text-sm text-gray-500">現在、掲載中の結果データがありません。</p>
        ) : (
          <section>
            <h2 className="text-xl font-bold mb-1">年度別の記録</h2>
            <p className="text-sm text-text-secondary mb-5">各年度の優勝〜ベスト4を種目別に掲載。新しい年度から並べています。</p>
            <div className="space-y-10">
              {years.map((yr) => (
                <section key={yr.year} className="scroll-mt-20" id={`y${yr.year}`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <h3 className="text-lg font-bold">
                      {yr.year}年度 {shortLabel}
                    </h3>
                    {latestYear === yr.year && <span className="rounded-full bg-success-bg text-success px-2 py-0.5 text-xs font-semibold">最新</span>}
                  </div>
                  {(yr.location || yr.startDate) && (
                    <p className="mb-3 text-xs text-text-muted">
                      {yr.location ? `開催地: ${yr.location}` : ''}
                      {yr.location && yr.startDate ? ' / ' : ''}
                      {yr.startDate ? `日程: ${formatDateRange(yr.startDate, yr.endDate)}` : ''}
                    </p>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    {yr.categories.map((cat) => (
                      <div key={cat.categoryId} className="rounded-xl border border-border p-4 bg-surface">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <h4 className="font-semibold">{cat.label}</h4>
                          <Link href={cat.bracketHref} className="text-xs text-link hover:underline whitespace-nowrap">
                            対戦表を見る
                          </Link>
                        </div>
                        <ul className="space-y-2">
                          {cat.placements.map((p, idx) => (
                            <li key={`${cat.categoryId}-${p.order}-${idx}`} className="flex items-start gap-2 text-sm">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                                  RANK_BADGE_CLASS[p.rankLabel] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100'
                                }`}
                              >
                                {p.rankLabel}
                              </span>
                              <span className="flex-1">
                                <PlacementName playerLinks={p.playerLinks} teamLinks={p.teamLinks} />
                                {p.prefectures.length > 0 && <span className="ml-1 text-xs text-text-muted">{p.prefectures.join('・')}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-semibold mb-4">よくある質問</h2>
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
            {faqItems.map((item) => (
              <div key={item.question} className="rounded-xl border border-border p-4">
                <h3 className="font-semibold mb-2">{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/highschool/tournaments/" className="text-link hover:underline">
            ← 全国大会の歴代記録 一覧へ
          </Link>
          <Link href="/highschool/rankings/" className="text-link hover:underline">
            強豪校ランキングを見る
          </Link>
          <Link href="/highschool/boys/" className="text-link hover:underline">
            高校 都道府県別ページへ
          </Link>
        </div>
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: HS_NATIONAL_SLUGS.map((slug) => ({ params: { tournament: slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const tournament = context.params?.tournament as HsNationalTournamentSlug;
  if (!tournament || !(tournament in HS_NATIONAL_TOURNAMENTS)) {
    return { notFound: true };
  }
  const records = getHsNationalTournamentRecords(tournament);
  return { props: { records } };
};
