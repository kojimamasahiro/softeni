import fs from 'fs';
import path from 'path';

import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';

type Gender = 'boys' | 'girls';

interface EditionRow {
  year: number;
  edition?: number;
  title: string;
  venue?: string;
  champions: { boys?: string; girls?: string };
  note?: string;
}

interface RecordCard {
  gender: Gender;
  label: string;
  team: string;
  detail: string;
}

interface PromotionRow {
  season: string;
  category: Gender;
  promoted: string[];
  relegated: string[];
  note?: string;
}

interface Props {
  editions: EditionRow[];
  records: RecordCard[];
  promotions: PromotionRow[];
}

const GENDER_LABEL: Record<Gender, string> = { boys: '男子', girls: '女子' };

export default function STLeagueChampions({
  editions,
  records,
  promotions,
}: Props) {
  const pageTitle =
    'STリーグ歴代優勝チーム一覧｜男子・女子の王者と記録 | ソフトテニス情報';
  const pageUrl = 'https://softeni-pick.com/st-league/champions/';
  const description =
    'ソフトテニスSTリーグの歴代優勝チームを男子・女子別に一覧でまとめました。各回（第1回〜）の王者・会場、連覇などの記録、プレーオフ（入替戦）による昇格・降格の歴史を掲載しています。';

  // 昇降格をシーズン単位にまとめる（男女を1行に）
  const seasons = Array.from(new Set(promotions.map((p) => p.season)));

  return (
    <>
      <MetaHead title={pageTitle} description={description} url={pageUrl} />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: 'STリーグ 歴代優勝チーム一覧',
              itemListElement: editions.map((e, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: `${e.title}（男子: ${e.champions.boys ?? '—'} / 女子: ${
                  e.champions.girls ?? '—'
                }）`,
                url: `https://softeni-pick.com/st-league/${e.year}/matches`,
              })),
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'STリーグ', href: '/st-league' },
            { label: '歴代優勝・記録', href: '/st-league/champions' },
          ]}
        />

        {/* Header */}
        <section className="max-w-3xl mx-auto mb-10 px-4">
          <h1 className="text-2xl font-bold mb-4">
            STリーグ 歴代優勝チーム一覧・記録
          </h1>
          <p className="text-lg leading-relaxed mb-4">
            ソフトテニス実業団最高峰
            <strong>STリーグ</strong>の<strong>歴代優勝チーム</strong>
            を男子・女子別にまとめました。各回の王者・会場に加え、連覇などの記録、プレーオフ（入替戦）による
            <strong>昇格・降格</strong>の歴史も掲載しています。
          </p>
          <Link
            href="/st-league/about"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            STリーグのルール・仕組みを見る
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </section>

        {/* 記録ハイライト */}
        {records.length > 0 && (
          <section className="max-w-4xl mx-auto mb-12 px-4">
            <h2 className="text-lg font-bold mb-4">記録ハイライト</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {records.map((r, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${
                        r.gender === 'boys'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {GENDER_LABEL[r.gender]}
                    </span>
                    <span className="text-xs text-gray-500">{r.label}</span>
                  </div>
                  <p className="text-xl font-bold">{r.team}</p>
                  <p className="text-sm text-gray-500 mt-1">{r.detail}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 歴代王者表 */}
        <section className="max-w-4xl mx-auto mb-12 px-4">
          <h2 className="text-lg font-bold mb-4">
            歴代優勝チーム（男子・女子）
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-700 text-left">
                  <th className="py-2 pr-3 whitespace-nowrap">回</th>
                  <th className="py-2 pr-3 whitespace-nowrap">年</th>
                  <th className="py-2 pr-3">
                    <span className="text-blue-700 dark:text-blue-400">
                      男子優勝
                    </span>
                  </th>
                  <th className="py-2 pr-3">
                    <span className="text-rose-700 dark:text-rose-400">
                      女子優勝
                    </span>
                  </th>
                  <th className="py-2 pr-3 hidden sm:table-cell">会場</th>
                </tr>
              </thead>
              <tbody>
                {editions.map((e) => (
                  <tr
                    key={e.year}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-2.5 pr-3 whitespace-nowrap font-bold">
                      <Link
                        href={`/st-league/${e.year}/matches`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {e.edition ? `第${e.edition}回` : e.year}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-gray-500">
                      {e.year}
                    </td>
                    <td className="py-2.5 pr-3 font-medium">
                      {e.champions.boys ?? '—'}
                    </td>
                    <td className="py-2.5 pr-3 font-medium">
                      {e.champions.girls ?? '—'}
                    </td>
                    <td className="py-2.5 pr-3 hidden sm:table-cell text-gray-500 text-xs">
                      {e.venue ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            ※
            各回の「回」をタップすると、その年度の試合結果・順位表へ移動します。
          </p>
        </section>

        {/* 昇降格の系譜 */}
        {seasons.length > 0 && (
          <section className="max-w-4xl mx-auto mb-12 px-4">
            <h2 className="text-lg font-bold mb-4">
              昇格・降格の系譜（プレーオフ／入替戦）
            </h2>
            <div className="space-y-4">
              {seasons.map((season) => {
                const rows = promotions.filter((p) => p.season === season);
                return (
                  <div
                    key={season}
                    className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm"
                  >
                    <p className="font-bold mb-3">{season} シーズン</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {(['boys', 'girls'] as Gender[]).map((g) => {
                        const row = rows.find((r) => r.category === g);
                        return (
                          <div key={g}>
                            <span
                              className={`inline-block text-xs font-bold px-2 py-0.5 rounded mb-2 ${
                                g === 'boys'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {GENDER_LABEL[g]}
                            </span>
                            {row &&
                            (row.promoted.length || row.relegated.length) ? (
                              <div className="space-y-1 text-sm">
                                {row.promoted.length > 0 && (
                                  <p className="text-emerald-700 dark:text-emerald-400">
                                    ▲ 昇格：{row.promoted.join('、')}
                                  </p>
                                )}
                                {row.relegated.length > 0 && (
                                  <p className="text-gray-500">
                                    ▼ 降格：{row.relegated.join('、')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400">
                                Ⅰ部の昇降格なし／データ未入力
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              ※
              昇降格はⅠ部とⅡ部間のプレーオフ（入替戦）の結果です。一部はAssumptionを含みます。
            </p>
          </section>
        )}

        {/* 各回ダイジェスト */}
        {editions.some((e) => e.note) && (
          <section className="max-w-4xl mx-auto mb-8 px-4">
            <h2 className="text-lg font-bold mb-4">各回のトピック</h2>
            <div className="space-y-4">
              {editions
                .filter((e) => e.note)
                .map((e) => (
                  <div
                    key={e.year}
                    className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded">
                        {e.edition ? `第${e.edition}回` : e.year}
                      </span>
                      <Link
                        href={`/st-league/${e.year}/matches`}
                        className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {e.title}
                      </Link>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      {e.note}
                    </p>
                  </div>
                ))}
            </div>
          </section>
        )}
      </PageLayout>
    </>
  );
}

interface EditionsJson {
  editions?: Array<{
    year: number;
    edition?: number;
    title?: string;
    venue?: string;
    champions?: { boys?: string; girls?: string };
    note?: string;
  }>;
  promotionRelegation?: PromotionRow[];
}

function computeRecords(editions: EditionRow[]): RecordCard[] {
  const cards: RecordCard[] = [];

  (['boys', 'girls'] as Gender[]).forEach((g) => {
    // 年代順（昇順）に王者を並べる
    const seq = editions
      .map((e) => ({ year: e.year, team: e.champions[g] }))
      .filter((x): x is { year: number; team: string } => Boolean(x.team));
    if (seq.length === 0) return;

    // 最多優勝
    const counts = new Map<string, number>();
    seq.forEach((x) => counts.set(x.team, (counts.get(x.team) ?? 0) + 1));
    let topTeam = seq[0].team;
    let topCount = 0;
    counts.forEach((c, team) => {
      if (c > topCount) {
        topCount = c;
        topTeam = team;
      }
    });
    if (topCount >= 2) {
      cards.push({
        gender: g,
        label: '最多優勝',
        team: topTeam,
        detail: `通算${topCount}回優勝`,
      });
    }

    // 最長連覇（連続して同一チームが優勝した最大の長さ）
    let bestTeam = seq[0].team;
    let bestRun = 1;
    let curTeam = seq[0].team;
    let curRun = 1;
    let bestStart = seq[0].year;
    let bestEnd = seq[0].year;
    let curStart = seq[0].year;
    for (let i = 1; i < seq.length; i += 1) {
      if (seq[i].team === curTeam) {
        curRun += 1;
      } else {
        curTeam = seq[i].team;
        curRun = 1;
        curStart = seq[i].year;
      }
      if (curRun > bestRun) {
        bestRun = curRun;
        bestTeam = curTeam;
        bestStart = curStart;
        bestEnd = seq[i].year;
      }
    }
    if (bestRun >= 2) {
      cards.push({
        gender: g,
        label: '連覇記録',
        team: bestTeam,
        detail: `${bestRun}連覇（${bestStart}〜${bestEnd}）`,
      });
    }
  });

  return cards;
}

export const getStaticProps = async () => {
  const editionsPath = path.join(process.cwd(), 'data/st-league/editions.json');
  let parsed: EditionsJson = {};
  if (fs.existsSync(editionsPath)) {
    parsed = JSON.parse(fs.readFileSync(editionsPath, 'utf8'));
  }

  // 優勝チームが確定している回のみ（サンプル/未開催を除外）。年代昇順。
  const editions: EditionRow[] = (parsed.editions ?? [])
    .filter((e) => e.champions && (e.champions.boys || e.champions.girls))
    .map((e) => ({
      year: e.year,
      edition: e.edition ?? null,
      title: e.title ?? `STリーグ ${e.year}`,
      venue: e.venue ?? null,
      champions: {
        boys: e.champions?.boys ?? null,
        girls: e.champions?.girls ?? null,
      },
      note: e.note ?? null,
    }))
    .sort((a, b) => a.year - b.year) as EditionRow[];

  const records = computeRecords(editions);
  const promotions: PromotionRow[] = parsed.promotionRelegation ?? [];

  return { props: { editions, records, promotions } };
};
