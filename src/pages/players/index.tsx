// pages/players/index.tsx
//
// 選手を探す入口（04-site-structure.md: `/players` = 「選手入口(検索)」）。
//
// 2026-08-08 全面改修。それ以前はこのページが「同姓同名選手の一覧」を名乗っていたが、
// データ実体は全収録選手を氏名でグループ化しただけで、`count` は同名人数ではなく出場した
// 大会カテゴリ数、`differentTeams` は同名別人の所属ではなくその選手のキャリア変遷だった。
// 実際の同姓同名は `data/players/homonyms.json`（65件）が持つ別データで、9,391組のうち
// 「複数所属」4,512組と1件も重ならない。つまり冒頭の警告はほぼ全ユーザーに対して事実と
// 異なっていたため撤去し、ページの役割を入口として定義し直した。
//
// 構成（06-design-principles.md P3「一覧では要約、詳細では全量」）:
//   1. 検索（全収録選手 9,391 組が対象。インデックスは操作時に遅延ロード）
//   2. 注目選手の表（出場数上位 200 人。名前・最新所属・出場数・最高成績）
//   3. 全選手リンク（結果ページが実在する 1,917 人。内部リンクのハブ）
//
// 旧実装は出場数 20 以上の 97 人ぶんの全大会記録を SSR に埋め込んでおり生成 HTML が 1.45MB、
// さらにマウント時に無条件で 3.0MB の検索インデックスを fetch していた（検索しない訪問者にも）。
// 大会記録は選手結果ページと完全重複でカニバリ側（seo.md #2）のため一覧からは落とした。
//
// 姓の頭文字での分割ページは作らない: 頭文字は342種あり243種が5件未満で薄いページの量産に
// なるため、seo.md の「入口を1ページに集約し、重複ページ自体を作らない」方針に反する
// （/rankings が年度×種目×男女でURLを切らないのと同じ判断）。
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import AdUnit from '@/components/AdUnit';
import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import PlayerLiteLink from '@/components/PlayerLiteLink';
import { AD_SLOTS } from '@/lib/ads';

const PAGE_URL = 'https://softeni-pick.com/players/';

/** 検索結果の初期表示件数。全件描画すると 9,391 行になり入力のたびに固まるため段階表示する。 */
const SEARCH_PAGE_SIZE = 50;

/** 構造化データ（ItemList）に載せる件数。 */
const ITEMLIST_LIMIT = 50;

/** 注目選手の表（SSR）1 人ぶんの要約。players-index.json 由来。 */
type FeaturedPlayer = {
  id: string | null;
  name: string;
  count: number;
  team: string | null;
  teamCount: number;
  latestYear: string | null;
  bestResult: string | null;
  bestTournament: string | null;
  bestYear: string | null;
};

/** 全選手リンク用の最小レコード。 */
type PlayerLink = {
  id: string;
  name: string;
};

/** 検索インデックス（players-search.json）1 組ぶん。遅延ロードする。 */
type SearchEntry = {
  fullName: string;
  playerId: string | null;
  // 結果ページ（/players/{id}/results/）が実在するか（data/players/index.json の count>=5）。
  // false でも playerId があれば PlayerLiteLink のモーダルで出場大会・所属だけは見せられる。
  hasPage: boolean;
  count: number;
  team: string | null;
  teamCount: number;
  searchText: string;
};

type PlayersPageProps = {
  featured: FeaturedPlayer[];
  all: PlayerLink[];
};

/** 最高成績の色分け。P2「同じ情報は同じ見た目」に従い既存のステータストークンを使う。 */
const RESULT_TONE: Record<string, string> = {
  優勝: 'bg-warning-bg text-warning border-warning-border',
  準優勝: 'bg-info-bg text-info border-info-border',
};

function ResultBadge({ result }: { result: string }) {
  const tone = RESULT_TONE[result] ?? 'bg-neutral-bg text-neutral border-neutral-border';
  return <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${tone}`}>{result}</span>;
}

/**
 * 検索語（スペース区切り AND）をすべてハイライトする。
 * 旧実装は queries[0] だけを見ており、2 語目以降が光らなかった。
 */
function highlightAll(text: string, queries: string[]) {
  if (queries.length === 0) return text;
  const escaped = queries.filter(Boolean).map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return text;
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const lowered = queries.map((q) => q.toLowerCase());
  return text.split(regex).map((part, index) =>
    lowered.includes(part.toLowerCase()) ? (
      <mark key={index} className="rounded bg-warning-bg px-0.5 text-warning">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export default function PlayersPage({ featured, all }: PlayersPageProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState<SearchEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(SEARCH_PAGE_SIZE);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchStarted = useRef(false);

  // 入力の反映を遅らせて、9,391 件の絞り込みでキー入力が詰まるのを防ぐ。
  const deferredQuery = useDeferredValue(searchQuery);

  /**
   * 検索インデックス（約 2.9MB）は「検索する意思」が見えた時だけ取りに行く。
   * 旧実装はマウント時に無条件 fetch していたため、検索しない訪問者にも転送していた。
   */
  const ensureSearchIndex = useCallback(() => {
    if (fetchStarted.current) return;
    fetchStarted.current = true;
    setIsLoading(true);
    fetch('/data/players-search.json')
      .then((res) => res.json())
      .then((data) => {
        setSearchIndex(data.sameNameGroups || []);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching player search index:', error);
        setSearchIndex([]);
        setIsLoading(false);
      });
  }, []);

  // ?q= で来た場合（共有・ブックマーク・ブラウザバック）は初期値として復元する。
  useEffect(() => {
    if (!router.isReady) return;
    const q = typeof router.query.q === 'string' ? router.query.q : '';
    setSearchQuery((current) => (current === '' && q !== '' ? q : current));
    if (q) ensureSearchIndex();
    // router.query.q の変化のみを見る（searchQuery を依存に入れると入力のたびに初期値へ戻る）
  }, [router.isReady, router.query.q, ensureSearchIndex]);

  // 検索語を URL に反映する。共有・履歴・計測が効くようになる。
  // canonical は常に /players/ 固定なので ?q= 付き URL は正規化される。
  useEffect(() => {
    if (!router.isReady) return;
    const current = typeof router.query.q === 'string' ? router.query.q : '';
    const next = deferredQuery.trim();
    if (current === next) return;
    const timer = setTimeout(() => {
      router.replace({ pathname: '/players', query: next ? { q: next } : {} }, undefined, { shallow: true, scroll: false });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredQuery, router.isReady]);

  const queries = useMemo(() => deferredQuery.toLowerCase().trim().split(/\s+/).filter(Boolean), [deferredQuery]);
  const isSearching = queries.length > 0;

  const results = useMemo(() => {
    if (!isSearching || !searchIndex) return [];
    return searchIndex
      .filter((entry) => queries.every((query) => entry.searchText.includes(query)))
      .sort((a, b) => b.count - a.count || a.fullName.localeCompare(b.fullName, 'ja'));
  }, [isSearching, searchIndex, queries]);

  // 新しい検索語のたびに段階表示をリセットする。
  useEffect(() => {
    setVisibleCount(SEARCH_PAGE_SIZE);
  }, [deferredQuery]);

  const clearSearch = () => {
    setSearchQuery('');
    inputRef.current?.focus();
  };

  return (
    <>
      <MetaHead
        title="選手一覧・選手検索 | ソフトテニス情報"
        description="ソフトテニスの大会結果に登場する選手を名前・所属チーム・大会名・年度で検索できます。全国大会をはじめとする収録大会の出場記録から、各選手の成績ページへ移動できます。"
        url={PAGE_URL}
        type="website"
      />

      {/* canonical は MetaHead が url（= PAGE_URL）で出力する。?q= は検索結果の一時的な
          状態にすぎず、静的書き出し（output:'export'）では同じ HTML が返るため正規化される。 */}
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: '選手一覧・選手検索',
              description: 'ソフトテニスの大会結果に登場する選手の一覧と検索。',
              inLanguage: 'ja',
              url: PAGE_URL,
              // 旧実装は WebPage に datePublished/dateModified としてビルド日を入れていたため
              // 毎ビルド日付が動いていた。実データ由来の日付を持たないので日付は出さない
              // （選手結果ページで「ビルド日を使わない」と方針化済み・players-pages.md）。
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: all.length,
                itemListElement: featured.slice(0, ITEMLIST_LIMIT).map((player, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  url: player.id ? `https://softeni-pick.com/players/${player.id}/results/` : undefined,
                  name: player.name,
                })),
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              url: 'https://softeni-pick.com/',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: 'https://softeni-pick.com/players/?q={search_term_string}',
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '選手一覧', href: '/players' },
          ]}
        />

        <h1 className="mb-2 text-2xl font-bold">選手一覧・選手検索</h1>
        <p className="mb-6 text-sm text-text-secondary">
          収録している大会結果から {all.length.toLocaleString()} 人の選手ページを作成しています。名前・所属・大会名・年度で検索できます。
        </p>

        {/* 検索 */}
        <div role="search" className="mb-8">
          <label htmlFor="searchQuery" className="mb-2 block text-sm font-medium text-text-secondary">
            選手を検索（スペース区切りで絞り込み）
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="searchQuery"
              type="search"
              autoComplete="off"
              placeholder="例: 田中 全日本 2024 / 佐藤 明大"
              value={searchQuery}
              onFocus={ensureSearchIndex}
              onChange={(e) => {
                ensureSearchIndex();
                setSearchQuery(e.target.value);
              }}
              className="w-full rounded-md border border-border-strong bg-surface px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="mt-2 text-xs text-text-muted">名前・所属チーム・大会名・年度が対象です。すべての語を含む選手が表示されます。</p>

          {/* 件数の変化をスクリーンリーダーへ伝える。 */}
          <p aria-live="polite" className="mt-3 text-sm text-text-secondary">
            {!isSearching
              ? ''
              : isLoading
                ? '検索データを読み込んでいます…'
                : `「${deferredQuery.trim()}」に一致する選手 ${results.length.toLocaleString()} 人`}
          </p>
        </div>

        {/* 検索結果 */}
        {isSearching && (
          <section className="mb-10">
            <h2 className="mb-3 text-xl font-bold">検索結果</h2>
            {!isLoading && results.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-center">
                <p className="mb-2 text-sm">
                  「<span className="font-medium">{deferredQuery.trim()}</span>」に一致する選手がありません。
                </p>
                <p className="mb-4 text-xs text-text-muted">
                  選手名は漢字で登録されています。ひらがな・カタカナ・ローマ字では一致しません。語を減らすか、所属や大会名だけで試してください。
                </p>
                <button type="button" onClick={clearSearch} className="text-sm text-link hover:underline">
                  検索をクリア
                </button>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                  {results.slice(0, visibleCount).map((entry) => (
                    <li key={entry.playerId ?? entry.fullName} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
                      <span className="text-base font-medium">
                        {entry.playerId && entry.hasPage ? (
                          <Link href={`/players/${entry.playerId}/results/`} className="text-link hover:underline">
                            {highlightAll(entry.fullName, queries)}
                          </Link>
                        ) : entry.playerId ? (
                          // 結果ページ（count>=5）が無い選手。専用ページへは飛ばさず、既存の
                          // PlayerLiteLink モーダルで出場大会・所属・ペアだけをその場で見せる
                          // （個別ページの薄いページ量産は避けつつ、検索から情報にたどり着けるようにする）。
                          <PlayerLiteLink id={entry.playerId} name={entry.fullName} className="text-link underline decoration-dotted hover:decoration-solid" />
                        ) : (
                          highlightAll(entry.fullName, queries)
                        )}
                      </span>
                      <span className="text-xs text-text-muted">
                        {entry.team ? highlightAll(entry.team, queries) : '所属不明'}
                        {entry.teamCount > 1 ? ` 他${entry.teamCount - 1}` : ''}
                        <span className="mx-1.5">/</span>
                        <span className="tabular-nums">{entry.count}</span> 大会
                      </span>
                    </li>
                  ))}
                </ul>
                {results.length > visibleCount && (
                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((c) => c + SEARCH_PAGE_SIZE)}
                      className="rounded-full border border-border-strong bg-bg-subtle px-4 py-1.5 text-sm hover:border-blue-300"
                    >
                      さらに表示（残り {(results.length - visibleCount).toLocaleString()} 人）
                    </button>
                  </div>
                )}
                <p className="mt-3 text-xs text-text-muted">
                  出場大会数が 5 未満の選手には個別ページがないため、名前をクリックすると出場大会・所属をその場でポップアップ表示します。
                </p>
              </>
            )}
          </section>
        )}

        {/* 主力枠。検索ボックスの直後・「出場数の多い選手」の前＝ファーストビュー内に置く
            （2026-08-23 変更。原案の「ファーストビューには置かない」を視認性優先で覆した。
            経緯は docs/adr/ADR-016 の追記）。検索という主目的の操作は上に残し、
            その下の読み物（表・全選手リンク）は分断しない位置。 */}
        <AdUnit slot={AD_SLOTS.playersIndex} />

        {/* 注目選手（出場数上位）。P1「データが主役」に沿って表形式にする。 */}
        <section className="mb-10">
          <h2 className="mb-1 text-xl font-bold">出場数の多い選手</h2>
          <p className="mb-3 text-xs text-text-muted">
            収録大会への出場数が多い上位 {featured.length} 人です。所属は最新の出場時点、最高成績は収録範囲内のものです。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border border-border-strong text-sm">
              <thead className="bg-bg-subtle text-gray-800 dark:text-gray-200">
                <tr>
                  <th scope="col" className="px-2 py-1.5 text-left">
                    選手
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-left">
                    所属（最新）
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-center">
                    出場
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-left">
                    最高成績
                  </th>
                </tr>
              </thead>
              <tbody>
                {featured.map((player) => (
                  <tr key={player.id ?? player.name} className="border-t border-border-strong">
                    <td className="px-2 py-1.5 font-medium">
                      {player.id ? (
                        <Link href={`/players/${player.id}/results/`} className="text-link hover:underline">
                          {player.name}
                        </Link>
                      ) : (
                        player.name
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-text-secondary">
                      {player.team ?? '―'}
                      {player.teamCount > 1 && <span className="ml-1 text-xs text-text-muted">他{player.teamCount - 1}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{player.count}</td>
                    <td className="px-2 py-1.5">
                      {player.bestResult ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <ResultBadge result={player.bestResult} />
                          <span className="text-xs text-text-muted">
                            {player.bestYear}年 {player.bestTournament}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">―</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 全選手リンク。内部リンクのハブとしてクローラにも訪問者にも全件を見せる。
            読み仮名データが無いため五十音の見出しは付けられず、名前順で並べている。 */}
        <section className="mb-10">
          <h2 className="mb-1 text-xl font-bold">選手ページ一覧</h2>
          <p className="mb-3 text-xs text-text-muted">個別ページのある {all.length.toLocaleString()} 人を名前順に並べています。</p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-sm leading-relaxed">
            {all.map((player) => (
              <li key={player.id}>
                <Link href={`/players/${player.id}/results/`} className="text-link hover:underline">
                  {player.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <nav aria-label="関連ページ" className="border-t border-border pt-6 text-sm">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href="/rankings" className="text-link hover:underline">
                年度別ランキング（男女別・種目別）
              </Link>
            </li>
            <li>
              <Link href="/tournaments" className="text-link hover:underline">
                大会結果一覧
              </Link>
            </li>
            <li>
              <Link href="/teams" className="text-link hover:underline">
                チーム一覧
              </Link>
            </li>
          </ul>
        </nav>
      </PageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps<PlayersPageProps> = async () => {
  const fs = await import('fs');
  const path = await import('path');

  const jsonPath = path.join(process.cwd(), 'public', 'data', 'players-index.json');

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    return { props: { featured: data.featured ?? [], all: data.all ?? [] } };
  } catch (error) {
    console.error('Error reading players-index.json:', error);
    return { props: { featured: [], all: [] } };
  }
};
