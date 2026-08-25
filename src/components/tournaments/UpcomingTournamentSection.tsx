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
// 表記ルール: 絵文字は使わない（AGENTS.md「UI の表記ルール」。eslint で強制）。

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
  /** 実施種目のラベル（例: 男子団体 / 男子シングルス） */
  categoryLabels: string[];
  officialUrl: string | null;
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
              {data.categoryLabels.map((c) => (
                <span key={c} className="inline-block rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-gray-700 dark:text-gray-200">
                  {c}
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>

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
