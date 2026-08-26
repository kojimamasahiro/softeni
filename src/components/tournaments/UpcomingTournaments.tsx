// src/components/tournaments/UpcomingTournaments.tsx
//
// 「これから開催」ブロック。会期が終わっていない大会を開催日の**昇順**で出す。
//
// 背景（docs/raw/2026-07-26-idea-tournament-metadata-platform.md 追記6）:
// 大会一覧は年度降順のグループ表示なので、開催予定の大会は最新年度ブロックの中で
// 過去の大会に埋もれる。「開催予定」バッジはあっても、探しに行かないと見つからない。
// トップページに至っては「最近追加された大会」しかなく、サイトの入口に未来形が1つも無かった。
//
// 2026-08-26 に大会一覧の中のローカル実装から共有コンポーネントへ切り出した。
// 同じものが2箇所にあると「これから開催」の定義が割れるため。
//
// リンク先は**大会ハブページ（サイト内）**。結果が無い大会のカードは外部の公式サイトへ
// 出てしまうので、開催前ブロック（会期・会場・関連する予選会）のあるハブへ寄せる。
// href は呼び出し側が getStaticProps で組む（`getTournamentHubHref` はサーバー側の都合を含むため）。
//
// 表記ルール: 絵文字を使わない（AGENTS.md。eslint で強制）。

import Link from 'next/link';

export type UpcomingTournamentItem = {
  tournamentId: string;
  year: number;
  /** その年度の大会名（例: 第20回 アジア競技大会） */
  label: string;
  startDate: string;
  endDate: string;
  location: string;
  /** 大会ハブページへの内部リンク */
  href: string;
};

/**
 * 「今日」を Asia/Tokyo で求める。**描画時に評価する**ので、静的書き出し後も日付が進む。
 * ビルド時刻に固定すると、再ビルドまで終わった大会が「これから開催」に残る。
 */
export function getTodayInTokyo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate) return '—';
  const [, sm, sd] = startDate.split('-').map(Number);
  const start = `${sm}/${sd}`;
  if (!endDate || endDate === startDate) return start;
  const [, em, ed] = endDate.split('-').map(Number);
  if (sm === em) return `${sm}/${sd}〜${ed}`;
  return `${sm}/${sd}〜${em}/${ed}`;
}

export default function UpcomingTournaments({
  items,
  limit,
  headingId,
  className = '',
}: {
  /** 候補（絞り込み前）。会期の判定はこのコンポーネントが描画時に行う */
  items: UpcomingTournamentItem[];
  /** 表示する最大件数。面ごとの制約が違うので呼び出し側が決める */
  limit: number;
  /** 同一ページに複数置く場合に id が衝突しないようにする */
  headingId?: string;
  className?: string;
}) {
  const todayStr = getTodayInTokyo();
  const id = headingId ?? 'upcoming-tournaments';

  const upcoming = items
    .filter((i) => i.startDate && (i.endDate || i.startDate) >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, limit);

  if (upcoming.length === 0) return null;

  return (
    <section className={`rounded-xl border border-border bg-surface p-3 shadow-sm ${className}`} aria-labelledby={id}>
      <h2 id={id} className="mb-1.5 text-sm font-bold">
        これから開催
      </h2>
      <ul className="divide-y divide-border">
        {upcoming.map((inst) => {
          const started = inst.startDate <= todayStr;
          return (
            <li key={`${inst.tournamentId}-${inst.year}`} className="py-1.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold tabular-nums text-text-secondary">{formatDateRange(inst.startDate, inst.endDate)}</span>
                <Link href={inst.href} className="text-sm font-medium text-link hover:underline">
                  {inst.label}
                </Link>
                {started && (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    開催中
                  </span>
                )}
                {inst.location && <span className="text-xs text-text-muted">{inst.location}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
