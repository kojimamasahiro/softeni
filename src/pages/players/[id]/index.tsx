// src/pages/players/[id].tsx
import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import PlayerCareerHighlights, { type PlayerCareerHighlightsData } from '@/components/PlayerCareerHighlights';
import { getCareerRecord } from '@/lib/careerRecord';
import { getChampionMilestones } from '@/lib/milestones';
import { PlayerInfo } from '@/types/index';

type Props = {
  player: PlayerInfo;
  id: string;
  numericId?: number | null;
  hasResultsPage: boolean;
  latest?: {
    date: string;
    location: string;
    tournament: string;
    result: string;
    partner?: string;
    link?: string;
  } | null;
  highlights: PlayerCareerHighlightsData | null;
};

const calculateAge = (birthDate?: string): number | null => {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  const dayDiff = today.getDate() - birth.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return age;
};

const formatJapaneseDate = (dateString?: string): string | null => {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export default function PlayerInformation({ player, id, numericId, hasResultsPage, latest, highlights }: Props) {
  const age = calculateAge(player.birthDate);
  const formattedBirthDate = formatJapaneseDate(player.birthDate);
  const fullName = `${player.lastName}${player.firstName}`;
  const pageUrl = `https://softeni-pick.com/players/${id}/`;

  const profileFacts = [
    player.height ? `身長${player.height}cm` : '',
    player.position ? `ポジションは${player.position}` : '',
    player.handedness ? `${player.handedness}利き` : '',
  ]
    .filter(Boolean)
    .join('、');

  const faqItems = [
    ...(player.height
      ? [
          {
            question: `${fullName}選手の身長は？`,
            answer: `${fullName}選手の身長は${player.height}cmです。`,
          },
        ]
      : []),
    ...(player.team
      ? [
          {
            question: `${fullName}選手の所属は？`,
            answer: `${fullName}選手は${player.retired ? '引退済みです' : `${player.team}に所属しています`}。`,
          },
        ]
      : []),
    ...(player.position
      ? [
          {
            question: `${fullName}選手のポジションは？`,
            answer: `${fullName}選手のポジションは${player.position}です。`,
          },
        ]
      : []),
  ];

  return (
    <>
      <MetaHead
        title={`${fullName}${player.team ? `（${player.team}）` : ''}のプロフィール・身長 | ソフトテニス`}
        description={`ソフトテニス ${fullName}選手${player.team ? `（${player.team}）` : ''}のプロフィール。${profileFacts ? `${profileFacts}。` : ''}試合結果・戦績も掲載しています。`}
        url={pageUrl}
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Person',
              name: `${player.lastName} ${player.firstName}`,
              alternateName: `${player.lastNameKana} ${player.firstNameKana}`,
              ...(player.birthDate && { birthDate: player.birthDate }),
              ...(player.height && { height: `${player.height} cm` }),
              memberOf: {
                '@type': 'Organization',
                name: player.team,
              },
              url: pageUrl,
              ...(player.profileLinks?.length > 0 && {
                sameAs: player.profileLinks.map((link) => link.url),
              }),
            }),
          }}
        />

        {faqItems.length > 0 && (
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
        )}

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
                  name: '選手一覧',
                  item: 'https://softeni-pick.com/players/',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: fullName,
                  item: pageUrl,
                },
                ...(hasResultsPage
                  ? [
                      {
                        '@type': 'ListItem',
                        position: 4,
                        name: '試合結果',
                        item: `https://softeni-pick.com/players/${numericId ?? id}/results/`,
                      },
                    ]
                  : []),
              ],
            }),
          }}
        />
      </Head>

      <PageLayout>
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            {
              label: '選手一覧',
              href: '/players',
            },
            {
              label: `${player.lastName}${player.firstName}`,
              href: `/players/${id}`,
            },
          ]}
        />

        <h1 className="text-2xl font-bold mb-6">
          {player.lastName} {player.firstName}
        </h1>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">プロフィール</h2>
          <table className="w-full text-sm border border-gray-300 dark:border-gray-600">
            <tbody>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-2 text-left bg-gray-100 dark:bg-gray-700 w-32">所属</th>
                <td className="p-2">{player.retired ? '引退済み' : player.team}</td>
              </tr>

              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-2 text-left bg-gray-100 dark:bg-gray-700">ポジション</th>
                <td className="p-2">{player.position}</td>
              </tr>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-2 text-left bg-gray-100 dark:bg-gray-700">誕生日</th>
                <td className="p-2">{formattedBirthDate ? `${formattedBirthDate}${age !== null ? `（${age}歳）` : ''}` : '年月日（歳）'}</td>
              </tr>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-2 text-left bg-gray-100 dark:bg-gray-700">身長</th>
                <td className="p-2">{player.height}cm</td>
              </tr>
              <tr>
                <th className="p-2 text-left bg-gray-100 dark:bg-gray-700">利き手</th>
                <td className="p-2">{player.handedness}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {highlights && <PlayerCareerHighlights fullName={fullName} data={highlights} />}

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-2">試合結果</h2>

          {latest ? (
            <div className="mb-3 text-sm text-gray-800 dark:text-gray-200">
              <p className="mb-1">
                <span className="font-semibold">更新情報：</span>
                {latest.date} / {latest.tournament}（{latest.result}）
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">最近の試合情報はまだありません。</p>
          )}

          {hasResultsPage ? (
            <Link
              href={`/players/${numericId ?? id}/results`}
              className="inline-block mt-2 text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition"
            >
              すべての試合結果を見る
            </Link>
          ) : (
            <p className="mt-2 text-sm text-gray-500">試合結果ページは準備中です。</p>
          )}
        </section>

        {faqItems.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">よくある質問</h2>
            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
              {faqItems.map((item) => (
                <div key={item.question} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="font-semibold mb-2">{item.question}</h3>
                  <p>{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xl font-semibold mb-2">関連リンク</h2>
          <ul className="list-disc list-inside space-y-1">
            {player.profileLinks.map((link, index) => (
              <li key={index}>
                <Link
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const playersPath = path.join(process.cwd(), 'data', 'players');
  const entries = fs.readdirSync(playersPath);

  const paths = entries
    .filter((entry) => {
      const fullPath = path.join(playersPath, entry);
      return fs.statSync(fullPath).isDirectory(); // ディレクトリのみ
    })
    .map((dir) => ({
      params: { id: dir },
    }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const id = params?.id as string;
  const filePath = path.join(process.cwd(), 'data', 'players', id, 'information.json');
  const fileContents = fs.readFileSync(filePath, 'utf-8');
  const player = JSON.parse(fileContents);

  // Resolve numeric id from data/players/index.json by matching name
  let numericId: number | null = null;
  let hasResultsPage = false;
  try {
    const indexPath = path.join(process.cwd(), 'data', 'players', 'index.json');
    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as Array<{
      id: number;
      lastName: string;
      firstName: string;
      count?: number;
    }>;

    const found = indexData.find((e) => e.lastName === player.lastName && e.firstName === player.firstName);
    if (found) {
      numericId = found.id;
      hasResultsPage = (found.count ?? 0) >= 5;
    }
  } catch (err) {
    void err;
  }

  const analysisPath = path.join(process.cwd(), 'data', 'players', id, 'analysis.json');

  let latest = null;
  if (fs.existsSync(analysisPath)) {
    const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
    latest = analysis.latestMatch || null;
  }

  // --- 文脈ブロック（主な戦績: 通算成績・優勝歴・連覇/初優勝）---
  // docs/wiki/news-context-blocks.md / ADR-005。career-record は curated 選手のみ。
  let highlights: PlayerCareerHighlightsData | null = null;
  const career = getCareerRecord(id);
  if (career) {
    // 優勝歴の各タイトルから milestone（連覇/初優勝）を再利用抽出してまとめる
    const milestones: PlayerCareerHighlightsData['milestones'] = [];
    const seen = new Set<string>();
    // 連覇は終了年ごとに重複抽出される（例: 同じ 2022年〜のランが 4連覇・5連覇として
    // 別々に出る）。同一ラン（大会×種目×開始年）では最長だけを残し、初出位置に維持する。
    const repeatIndex = new Map<string, number>();
    const repeatStreak = new Map<string, number>();
    // milestone はダブルスを「選手個人」単位で出すため、同一年・種目でパートナーの
    // イベントも返る。この選手ページの主役だけに絞る（主役名で照合）。
    const normalizeName = (s: string) => s.replace(/\s+/g, '').normalize('NFKC');
    const subjectName = normalizeName(career.subject.display);
    for (const t of career.titles) {
      const ms = getChampionMilestones(t.tournamentId, t.categoryId, t.year);
      for (const e of ms?.events ?? []) {
        // 団体戦（players 空）は従来どおり通す。個人戦は主役名一致のみ採用。
        if (e.subject.players.length > 0 && !e.subject.players.some((p) => normalizeName(p) === subjectName)) {
          continue;
        }
        // 選手ページでは主役名は自明なので、代わりに大会名を前置して
        // 複数の「初優勝」等を区別できるようにする（例:「全日本選手権 初優勝」）。
        // 単年の出来事（初優勝など）は年も前置する。連覇は shortLabel に
        // 「（2022年〜）」と開始年が入るため二重表示を避けて年を付けない。
        const label = e.kind === 'repeat-title' ? `${t.tournamentLabel} ${e.shortLabel}` : `${t.year}年 ${t.tournamentLabel} ${e.shortLabel}`;
        const entry = {
          kind: e.kind,
          label,
          confidence: e.confidence,
          scopeNote: e.scopeNote ?? null,
        };

        if (e.kind === 'repeat-title') {
          const since = e.detail.since;
          const streak = Number(e.detail.streak) || 0;
          const runKey = `${e.tournamentId}|${e.categoryId}|${since}`;
          const idx = repeatIndex.get(runKey);
          if (idx === undefined) {
            repeatIndex.set(runKey, milestones.length);
            repeatStreak.set(runKey, streak);
            milestones.push(entry);
          } else if (streak > (repeatStreak.get(runKey) ?? 0)) {
            repeatStreak.set(runKey, streak);
            milestones[idx] = entry; // 最長で上書き
          }
          continue;
        }

        // ラベルではなくイベント実体で重複排除する。同一表示文字列の別イベント
        // （例: 別大会・別種目での初優勝）を取りこぼさない。
        const key = `${e.kind}|${e.tournamentId}|${e.categoryId}|${e.year}`;
        if (seen.has(key)) continue;
        seen.add(key);
        milestones.push(entry);
      }
    }
    highlights = {
      milestones,
      totals: {
        matches: career.totals.matches,
        wins: career.totals.wins,
        losses: career.totals.losses,
        winRate: career.totals.winRate,
      },
      titles: career.titles.map((t) => ({
        year: t.year,
        tournamentLabel: t.tournamentLabel,
        categoryLabel: t.categoryLabel,
        tournamentLink: t.generationId ? `/tournaments/${t.generationId}/${t.tournamentId}` : null,
      })),
      scopeNote: career.scopeNote,
    };
  }

  return {
    props: {
      player,
      id,
      latest,
      numericId,
      hasResultsPage,
      highlights,
    },
  };
};
