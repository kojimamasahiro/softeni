// src/components/tournaments/UpcomingTournamentSection.tsx
//
// 大会ハブページの「開催前」ブロック。まだ結果が無く、これから開催される年度の
// 会期・会場・実施種目・関連大会への導線を出す。
//
// 背景（docs/raw/2026-07-26-idea-tournament-metadata-platform.md 追記6・追記7）:
// information に集めた `venues`（会場の構造化データ）は、これまでサイト上のどこにも
// 描画されていなかった（`grep -rn "venues" src` が0件）。原因は実装漏れではなく、
// venue が載るべき「開催前の大会ページ」が存在しなかったこと。このコンポーネントが
// その面であり、venues の最初の描画先でもある。
//
// 実施種目のリンク: `categoryLabels` の各要素は details/ に実データがある種目だけ
// `href` を持つ（呼び出し側 index.tsx が details ディレクトリの実走査結果＝yearGroups
// と突き合わせて判定する）。href が無いもの（要項段階でまだ組み合わせが無い種目）は
// リンクにすると 404 になるため、ただのバッジのまま出す。
//
// 表記ルール: 絵文字は使わない（AGENTS.md「UI の表記ルール」。eslint で強制）。

import Link from 'next/link';

import type { CategorySchedule } from '@/lib/categorySchedule';

/** 開催前ブロックで表示する会場1件。information の `venues[]` の表示に必要な項目だけを抜いたもの。 */
export type UpcomingVenue = {
  name: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  tel: string | null;
  courts: number | null;
  surface: string | null;
  /** どの日・どの種目に使われるか。自由文（docs/wiki/data-model.md） */
  usage: string | null;
};

export type UpcomingTournamentData = {
  year: number;
  /** その年度の大会名（例: 第20回 アジア競技大会） */
  label: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  venues: UpcomingVenue[];
  /** 実施種目。href はその年度・種目の結果ページが details/ に実在する場合のみ入る（無ければリンクにしない）。 */
  categoryLabels: { label: string; href: string | null }[];
  officialUrl: string | null;
  /** 種目別の競技日程（主催者発表の予定の転記）。無ければ null で、表ごと出さない */
  schedule: CategorySchedule | null;
  /** すでに会期に入っているか（true なら「開催中」表記にする） */
  hasStarted: boolean;
};

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const fmt = (d: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    return m ? `${Number(m[2])}月${Number(m[3])}日` : d;
  };
  const year = start.slice(0, 4);
  if (!end || end === start) return `${year}年${fmt(start)}`;
  return `${year}年${fmt(start)}〜${fmt(end)}`;
}

function formatCheckedOn(d: string | null): string | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : d;
}

/**
 * 種目別の日程表。主催者発表の「予定」なので、見出しと注記で予定であることと
 * 出典・確認日を必ず併記する（当サイトの推定と読まれないように）。
 */
function ScheduleTable({ schedule }: { schedule: CategorySchedule }) {
  const checkedOn = formatCheckedOn(schedule.checkedOn);
  return (
    <div className="mb-3">
      <h3 className="mb-1.5 text-sm font-semibold text-text-secondary">種目別の日程（予定）</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-xs text-text-muted">
            <tr>
              <th scope="col" className="px-2 py-1.5 sm:px-3 text-left font-semibold">
                種目
              </th>
              <th scope="col" className="px-2 py-1.5 sm:px-3 text-left font-semibold">
                日程
              </th>
              <th scope="col" className="px-2 py-1.5 sm:px-3 text-left font-semibold whitespace-nowrap">
                決勝開始
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {schedule.rows.map((r) => (
              <tr key={r.categoryId}>
                <th scope="row" className="px-2 py-1.5 sm:px-3 text-left font-medium whitespace-nowrap">
                  {r.label}
                </th>
                <td className="px-2 py-1.5 sm:px-3 text-text-secondary">
                  {/* 狭い幅では「〜」の後でだけ折り返す（「（金）」の途中で割れないように） */}
                  {r.dateLabel.split('〜').map((part, i, all) => (
                    <span key={part} className="inline-block whitespace-nowrap">
                      {part}
                      {i < all.length - 1 ? '〜' : ''}
                    </span>
                  ))}
                </td>
                <td className="px-2 py-1.5 sm:px-3 tabular-nums text-text-secondary whitespace-nowrap">{r.finalTime ?? '―'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-text-muted">
        時刻は会場の現地時刻での開始予定。出典:{' '}
        <a href={schedule.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
          {schedule.source}
        </a>
        {checkedOn ? `（${checkedOn}時点）` : ''}。変更されることがあるため、最新の情報は出典を確認してください。
      </p>
    </div>
  );
}

export default function UpcomingTournamentSection({ data }: { data: UpcomingTournamentData }) {
  const statusLabel = data.hasStarted ? '開催中' : '開催予定';
  const dateRange = formatDateRange(data.startDate, data.endDate);

  return (
    <section className="mb-8 rounded-xl border border-border bg-surface p-4 shadow-sm" aria-labelledby="upcoming-heading">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {statusLabel}
        </span>
        <h2 id="upcoming-heading" className="text-lg font-bold">
          {data.label}
        </h2>
      </div>

      <dl className="mb-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {dateRange && (
          <>
            <dt className="font-semibold text-text-secondary">会期</dt>
            <dd className="text-text-secondary">{dateRange}</dd>
          </>
        )}
        {data.location && (
          <>
            <dt className="font-semibold text-text-secondary">開催地</dt>
            <dd className="text-text-secondary">{data.location}</dd>
          </>
        )}
        {data.categoryLabels.length > 0 && (
          <>
            <dt className="font-semibold text-text-secondary">実施種目</dt>
            <dd className="flex flex-wrap gap-1.5">
              {data.categoryLabels.map((c) =>
                c.href ? (
                  <Link
                    key={c.label}
                    href={c.href}
                    className="inline-block rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-link hover:underline dark:text-blue-300"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span key={c.label} className="inline-block rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-gray-700 dark:text-gray-200">
                    {c.label}
                  </span>
                ),
              )}
            </dd>
          </>
        )}
      </dl>

      {data.schedule && <ScheduleTable schedule={data.schedule} />}

      {data.venues.length > 0 && (
        <div className="mb-3">
          <h3 className="mb-1.5 text-sm font-semibold text-text-secondary">会場</h3>
          <ul className="space-y-2">
            {data.venues.map((v, i) => (
              <li key={`${v.name ?? 'venue'}-${i}`} className="rounded-lg border border-border px-3 py-2 text-sm">
                {v.name && <p className="font-medium">{v.name}</p>}
                {v.usage && <p className="text-xs text-text-muted">{v.usage}</p>}
                {v.address && <p className="mt-1 text-xs text-text-muted">{v.address}</p>}
                <p className="mt-0.5 text-xs text-text-muted">
                  {[v.tel ? `TEL ${v.tel}` : null, v.courts ? `${v.courts}面` : null, v.surface].filter(Boolean).join(' / ')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.officialUrl && (
        <p className="text-sm">
          <a href={data.officialUrl} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
            大会公式情報
          </a>
          <span className="ml-2 text-xs text-text-muted">日程・チケット・観戦情報は主催者の発表を確認してください</span>
        </p>
      )}
    </section>
  );
}
