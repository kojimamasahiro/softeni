// src/components/tournaments/TournamentSearchTable.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

// ─── 型定義 ─────────────────────────────────────────────────────────────
export type TournamentLevel =
  | 'national'
  | 'block'
  | 'prefecture'
  | 'city'
  | 'open';

export type TournamentInstance = {
  tournamentId: string;
  generation: string;
  generationLabel: string;
  year: number;
  label: string;
  startDate: string;
  endDate: string;
  location: string;
  prefectureId: string | null;
  level: TournamentLevel;
  categoryLabels: string[];
  hasInternalResult: boolean;
  officialUrl: string;
  firstCategoryPath: string | null;
};

type Props = {
  instances: TournamentInstance[];
  prefectures: { id: string; name: string }[];
  years: number[];
  generations: { id: string; label: string }[];
};

// ─── 定数 ────────────────────────────────────────────────────────────────
const LEVEL_LABELS: Record<TournamentLevel, string> = {
  national: '全国',
  block: 'ブロック',
  prefecture: '都道府県',
  city: '市区町村',
  open: 'オープン',
};

const LEVEL_COLORS: Record<TournamentLevel, string> = {
  national: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  block: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  prefecture:
    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  city: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  open: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
};

// ─── ユーティリティ ───────────────────────────────────────────────────────
function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate) return '—';
  const [, sm, sd] = startDate.split('-').map(Number);
  const start = `${sm}/${sd}`;
  if (!endDate || endDate === startDate) return start;
  const [, em, ed] = endDate.split('-').map(Number);
  if (sm === em) return `${sm}/${sd}〜${ed}`;
  return `${sm}/${sd}〜${em}/${ed}`;
}

// ─── FilterDropdown コンポーネント ────────────────────────────────────────
type FilterDropdownProps = {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
};

function FilterDropdown({
  label,
  options,
  selected,
  onChange,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const displayLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? label)
        : `${label} (${selected.length})`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm transition-colors ${
          selected.length > 0
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400'
        }`}
      >
        <span>{displayLabel}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-max bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span className="text-gray-800 dark:text-gray-100">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────────────────────────
export default function TournamentSearchTable({
  instances,
  prefectures,
  years,
  generations,
}: Props) {
  const router = useRouter();

  // フィルター状態
  const [filterGeneration, setFilterGeneration] = useState<string[]>([]);
  const [filterLevel, setFilterLevel] = useState<string[]>([]);
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterPrefecture, setFilterPrefecture] = useState<string[]>([]);
  const [filterHasResult, setFilterHasResult] = useState(false);
  const initialized = useRef(false);

  // URL → 状態 初期化（isReady 後に一度だけ）
  useEffect(() => {
    if (!router.isReady || initialized.current) return;
    initialized.current = true;

    const q = router.query;
    const toArray = (v: string | string[] | undefined) =>
      !v ? [] : Array.isArray(v) ? v : [v];

    setFilterGeneration(toArray(q.generation));
    setFilterLevel(toArray(q.level));
    setFilterPrefecture(toArray(q.prefecture));
    setFilterYear(typeof q.year === 'string' ? q.year : '');
    setFilterHasResult(q.hasResult === '1');
  }, [router.isReady, router.query]);

  // 状態 → URL 同期
  useEffect(() => {
    if (!initialized.current) return;
    const query: Record<string, string | string[]> = {};
    if (filterGeneration.length) query.generation = filterGeneration;
    if (filterLevel.length) query.level = filterLevel;
    if (filterPrefecture.length) query.prefecture = filterPrefecture;
    if (filterYear) query.year = filterYear;
    if (filterHasResult) query.hasResult = '1';

    router.replace({ pathname: '/tournaments', query }, undefined, {
      shallow: true,
      scroll: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filterGeneration,
    filterLevel,
    filterYear,
    filterPrefecture,
    filterHasResult,
  ]);

  // フィルター適用
  const filtered = instances.filter((inst) => {
    if (filterGeneration.length && !filterGeneration.includes(inst.generation))
      return false;
    if (filterLevel.length && !filterLevel.includes(inst.level)) return false;
    if (filterYear && String(inst.year) !== filterYear) return false;
    if (
      filterPrefecture.length &&
      !(inst.prefectureId && filterPrefecture.includes(inst.prefectureId))
    )
      return false;
    if (filterHasResult && !inst.hasInternalResult) return false;
    return true;
  });

  // フィルターリセット
  const hasAnyFilter =
    filterGeneration.length > 0 ||
    filterLevel.length > 0 ||
    filterPrefecture.length > 0 ||
    filterYear !== '' ||
    filterHasResult;

  const resetAll = () => {
    setFilterGeneration([]);
    setFilterLevel([]);
    setFilterYear('');
    setFilterPrefecture([]);
    setFilterHasResult(false);
  };

  // オプション
  const levelOptions = Object.entries(LEVEL_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
  const generationOptions = generations.map((g) => ({
    value: g.id,
    label: g.label,
  }));
  const prefectureOptions = prefectures.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  return (
    <div>
      {/* ── フィルターバー ── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
            絞り込み：
          </span>

          <FilterDropdown
            label="カテゴリ"
            options={generationOptions}
            selected={filterGeneration}
            onChange={setFilterGeneration}
          />

          <FilterDropdown
            label="種類"
            options={levelOptions}
            selected={filterLevel}
            onChange={setFilterLevel}
          />

          <FilterDropdown
            label="開催地"
            options={prefectureOptions}
            selected={filterPrefecture}
            onChange={setFilterPrefecture}
          />

          {/* 年 */}
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
              filterYear
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
            }`}
          >
            <option value="">年度</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}年
              </option>
            ))}
          </select>

          {/* 結果ありのみ */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-sm cursor-pointer hover:border-blue-400 bg-white dark:bg-gray-800">
            <input
              type="checkbox"
              className="accent-blue-600"
              checked={filterHasResult}
              onChange={(e) => setFilterHasResult(e.target.checked)}
            />
            <span className="text-gray-700 dark:text-gray-200">結果あり</span>
          </label>

          {/* リセット */}
          {hasAnyFilter && (
            <button
              onClick={resetAll}
              className="ml-auto text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors"
            >
              ✕ リセット
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-4">
          年・カテゴリ・地域で絞り込んで大会を探せます。
          結果データが収録されている大会は「結果」列のリンクから直接参照できます。
        </p>
      </div>

      {/* ── 件数 ── */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        {filtered.length} 件
        {instances.length !== filtered.length && ` / ${instances.length} 件中`}
      </p>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-gray-500 py-10">
          該当する大会がありません
        </p>
      ) : (
        (() => {
          // 年度ごとにグルーピング（降順）
          const grouped = filtered.reduce<Record<number, TournamentInstance[]>>(
            (acc, inst) => {
              (acc[inst.year] ??= []).push(inst);
              return acc;
            },
            {},
          );
          const sortedYears = Object.keys(grouped)
            .map(Number)
            .sort((a, b) => b - a);

          return (
            <div className="space-y-6">
              {sortedYears.map((year) => (
                <section key={year}>
                  {/* 年度見出し */}
                  <h2 className="text-base font-bold text-gray-700 dark:text-gray-200 mb-2 px-1 border-b border-gray-200 dark:border-gray-700 pb-1">
                    {year}年度
                  </h2>

                  {/* ── テーブル（デスクトップ） ── */}
                  <div className="hidden md:block">
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800">
                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              日程
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                              大会名
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              開催地
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              種類
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              対象
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              結果
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {grouped[year].map((inst) => (
                            <TableRow
                              key={`${inst.tournamentId}-${inst.year}`}
                              inst={inst}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── カード（モバイル） ── */}
                  <div className="md:hidden space-y-3">
                    {grouped[year].map((inst) => (
                      <MobileCard
                        key={`${inst.tournamentId}-${inst.year}`}
                        inst={inst}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}

// ─── テーブル行コンポーネント ───────────────────────────────────────────────
function TableRow({ inst }: { inst: TournamentInstance }) {
  const name = inst.firstCategoryPath ? (
    <Link
      href={inst.firstCategoryPath}
      className="font-medium text-blue-700 dark:text-blue-400 hover:underline"
    >
      {inst.label}
    </Link>
  ) : (
    <span className="font-medium text-gray-800 dark:text-gray-100">
      {inst.label}
    </span>
  );

  return (
    <tr className="hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors group">
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
        {formatDateRange(inst.startDate, inst.endDate)}
      </td>
      <td className="px-4 py-3">{name}</td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
        {inst.location || '—'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <LevelBadge level={inst.level} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs px-2 py-0.5 rounded-full">
          {inst.generationLabel}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <ResultCell inst={inst} />
      </td>
    </tr>
  );
}

// ─── モバイルカードコンポーネント ──────────────────────────────────────────
function MobileCard({ inst }: { inst: TournamentInstance }) {
  // カード全体のタップ先（結果ページ優先、なければ公式URL）
  const cardHref = inst.firstCategoryPath ?? inst.officialUrl ?? null;
  const cardExternal = !inst.firstCategoryPath && !!inst.officialUrl;

  return (
    <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm active:bg-blue-50 dark:active:bg-gray-750 transition-colors">
      {/* カード全体のタップ領域 */}
      {cardHref &&
        (cardExternal ? (
          <a
            href={cardHref}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 rounded-xl"
            aria-label={inst.label}
          />
        ) : (
          <Link
            href={cardHref}
            className="absolute inset-0 rounded-xl"
            aria-label={inst.label}
          />
        ))}

      {/* タイトル */}
      <p className="font-semibold text-blue-700 dark:text-blue-400 leading-snug mb-2">
        {inst.label}
      </p>

      {/* 日程・開催地 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <span>{formatDateRange(inst.startDate, inst.endDate)}</span>
        {inst.location && <span>{inst.location}</span>}
      </div>

      {/* バッジ類（relative z-10 で stretched link より前面に） */}
      <div className="relative z-10 flex flex-wrap items-center gap-2">
        <LevelBadge level={inst.level} />
        <span className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs px-2 py-0.5 rounded-full">
          {inst.generationLabel}
        </span>
        <ResultCell inst={inst} />
      </div>
    </div>
  );
}

// ─── バッジ・セル補助コンポーネント ───────────────────────────────────────
function LevelBadge({ level }: { level: TournamentLevel }) {
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_COLORS[level]}`}
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}

function ResultCell({ inst }: { inst: TournamentInstance }) {
  if (inst.hasInternalResult && inst.firstCategoryPath) {
    return (
      <Link
        href={inst.firstCategoryPath}
        className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full hover:opacity-80 transition"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        結果
      </Link>
    );
  }

  if (inst.officialUrl) {
    const isPdf = inst.officialUrl.toLowerCase().endsWith('.pdf');
    const isX = /^https?:\/\/(www\.)?(x\.com|twitter\.com)/.test(
      inst.officialUrl,
    );
    // 今日の日付（YYYY-MM-DD）と startDate を文字列比較して未来かどうか判定
    const todayStr = new Date().toISOString().slice(0, 10);
    const isFuture = !!inst.startDate && inst.startDate > todayStr;
    return (
      <a
        href={inst.officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-xs transition ${
          isPdf
            ? 'text-red-600 dark:text-red-400 hover:text-red-700'
            : isX
              ? 'text-gray-800 dark:text-gray-200 hover:text-black dark:hover:text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-blue-600'
        }`}
        title={isPdf ? 'PDF' : isX ? 'X (Twitter)' : '公式サイト'}
      >
        {isPdf ? (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 13h6M9 17h4"
            />
          </svg>
        ) : isX ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        ) : (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        )}
        {isFuture ? '予定' : isPdf ? 'PDF' : isX ? 'X' : '公式'}
      </a>
    );
  }

  return <span className="text-gray-300 dark:text-gray-600">—</span>;
}
