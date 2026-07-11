import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { getAllRareEvents, type RareEvent, type RareEventKind } from '@/lib/rareEventsStatic';
import { buildSiteUrl, getPublicMatchesListPath, isScoreSiteMode } from '@/lib/siteConfig';

// サイト記録一覧（レコードブック）。URL は /matches/highlights（公開試合一覧 /matches の配下）。
// 記録済み全試合の横断比較（scope='all-time'）で検知した希少イベントを
// 「カテゴリ＝種目の現記録」として一覧表示する。データは rare-events.json（prebuild 生成）。
// 件数が少なくても「各種目の現記録枠が埋まっている」形で成立させるのが狙い。
// 当面 noindex（コンテンツが育ってから indexable 昇格を判断）。内部リンクは follow。
// 仕様: docs/wiki/rare-events.md

interface Props {
  generatedAt: string | null;
  events: RareEvent[];
  /** tournamentId -> 表示名（data/tournaments/index.json の label） */
  tournamentLabels: Record<string, string>;
}

/** 「現記録」枠として見せる最上級カテゴリ（表示順）。 */
const RECORD_SECTIONS: { kind: RareEventKind; title: string; value: (e: RareEvent) => string }[] = [
  { kind: 'longest-rally', title: '最長ラリー', value: (e) => `${e.detail.rallyCount}本` },
  { kind: 'longest-deuce', title: '最長デュースゲーム', value: (e) => `全${e.detail.totalPoints}ポイント` },
  { kind: 'biggest-comeback', title: '最大ビハインドからの逆転ゲーム', value: (e) => `${e.detail.deficit}点差` },
  { kind: 'longest-point-streak', title: '最多連続ポイント', value: (e) => `${e.detail.streak}連続` },
];

/** 全件系（記録枠ではなく発生したものを列挙するカテゴリ）。 */
const LIST_SECTIONS: { kind: RareEventKind; title: string; note: string }[] = [
  { kind: 'service-ace', title: 'サービスエース', note: '記録済み全試合でも数本しか出ていない希少プレー（全件掲載）' },
  { kind: 'pattern', title: '希少パターン', note: '複数条件の組み合わせで見つけた希少プレー' },
];

const tournamentDisplayOf = (event: RareEvent, labels: Record<string, string>) => {
  const name = labels[event.tournamentId] ?? event.tournamentId;
  return event.year ? `${name} ${event.year}` : name;
};

const EventRow = ({ event, tournamentLabels, showLabel }: { event: RareEvent; tournamentLabels: Record<string, string>; showLabel?: boolean }) => (
  <div className="flex flex-col gap-1 rounded bg-surface px-4 py-3">
    {showLabel && <div className="text-sm font-medium text-text">{event.label}</div>}
    <div className="text-sm text-text">
      {event.teamA} vs {event.teamB}
    </div>
    <div className="text-xs text-text-muted">
      {tournamentDisplayOf(event, tournamentLabels)}
      {event.round ? `（${event.round}）` : ''}
      {typeof event.gameNumber === 'number' ? ` 第${event.gameNumber}ゲーム` : ''}
    </div>
    <div className="mt-1 flex flex-wrap gap-3 text-xs">
      {event.videoUrl && (
        <a href={event.videoUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-link hover:underline">
          ▶ その瞬間を動画で見る
        </a>
      )}
      <Link href={`${event.detailPath}/?pointId=${event.pointId}`} className="text-link hover:underline">
        スコア詳細で見る →
      </Link>
    </div>
  </div>
);

export default function RareEventHighlightsPage({ generatedAt, events, tournamentLabels }: Props) {
  const byKind = new Map<RareEventKind, RareEvent[]>();
  for (const event of events) {
    if (!byKind.has(event.kind)) byKind.set(event.kind, []);
    byKind.get(event.kind)!.push(event);
  }
  const scopeNote = events[0]?.scopeNote ?? '当サイトでスコア記録した全試合の中での比較';
  const generatedDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' })
    : null;

  return (
    <>
      <MetaHead
        title="名場面ハイライト・サイト記録一覧"
        description="スコア記録した全試合の中から検知した希少プレー（最長ラリー・最長デュース・最大逆転など）のサイト記録一覧です。"
        url={buildSiteUrl(`${getPublicMatchesListPath()}/highlights/`)}
        type="website"
        noindex
        noindexFollow
      />
      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '試合一覧', href: getPublicMatchesListPath() },
            { label: 'サイト記録', href: `${getPublicMatchesListPath()}/highlights` },
          ]}
        />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text">名場面ハイライト・サイト記録</h1>
          <p className="mt-2 text-sm text-text-secondary">
            スコア記録した全試合のポイント列から検知した希少プレーの「現記録」です。新しい試合を記録して記録が塗り替えられると、このページも更新されます。
          </p>
          <p className="mt-1 text-xs text-text-muted">
            ※{scopeNote}
            {generatedDate ? `（${generatedDate}時点）` : ''}
          </p>
        </div>

        {events.length === 0 && <p className="text-sm text-text-muted">まだ記録がありません。試合を記録すると、ここに名場面が並びます。</p>}

        <div className="grid gap-4 md:grid-cols-2">
          {RECORD_SECTIONS.map(({ kind, title, value }) => {
            const kindEvents = byKind.get(kind) ?? [];
            if (kindEvents.length === 0) return null;
            return (
              <section key={kind} className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">{title}</h2>
                  <div className="text-xl font-bold text-amber-900 dark:text-amber-100">{value(kindEvents[0])}</div>
                </div>
                {kindEvents.length > 1 && <p className="mt-1 text-[10px] text-amber-800/70 dark:text-amber-300/70">同記録 {kindEvents.length}件</p>}
                <div className="mt-3 grid gap-2">
                  {kindEvents.map((event) => (
                    <EventRow key={`${event.kind}-${event.pointId}`} event={event} tournamentLabels={tournamentLabels} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {LIST_SECTIONS.map(({ kind, title, note }) => {
          const kindEvents = byKind.get(kind) ?? [];
          if (kindEvents.length === 0) return null;
          return (
            <section key={kind} className="mt-6 rounded-lg border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-text">{title}</h2>
              <p className="mt-1 text-xs text-text-muted">{note}</p>
              <div className="mt-3 grid gap-2">
                {kindEvents.map((event) => (
                  <EventRow key={`${event.kind}-${event.pointId}`} event={event} tournamentLabels={tournamentLabels} showLabel />
                ))}
              </div>
            </section>
          );
        })}

        <div className="mt-8">
          <Link href={getPublicMatchesListPath()} className="text-sm text-link hover:underline">
            ← 試合一覧に戻る
          </Link>
        </div>
      </PageLayout>
    </>
  );
}

// 大会表示名（data/tournaments/index.json / local_index.json の label）
const buildTournamentLabels = (tournamentIds: string[]): Record<string, string> => {
  const labels: Record<string, string> = {};
  const wanted = new Set(tournamentIds);
  for (const file of ['index.json', 'local_index.json']) {
    const filePath = path.join(process.cwd(), 'data', 'tournaments', file);
    if (!fs.existsSync(filePath)) continue;
    try {
      const entries = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { tournamentId?: string; label?: string }[];
      for (const entry of entries) {
        if (entry?.tournamentId && entry?.label && wanted.has(entry.tournamentId) && !labels[entry.tournamentId]) {
          labels[entry.tournamentId] = entry.label;
        }
      }
    } catch {
      // 表示名は任意情報のため読めなくても続行（tournamentId のまま表示）
    }
  }
  return labels;
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  // score モードは大会ページ群（イベントの detailPath が指すネスト URL）を持たないため出さない
  if (isScoreSiteMode()) {
    return { notFound: true };
  }

  const { generatedAt, events } = getAllRareEvents();
  const tournamentLabels = buildTournamentLabels(events.map((e) => e.tournamentId));

  return {
    props: {
      generatedAt,
      events,
      tournamentLabels,
    },
  };
};
