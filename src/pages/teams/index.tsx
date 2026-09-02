// src/pages/teams/index.tsx
// チーム一覧(セクション入口・ページタイプ T2)。
// 検索対象はチームマスタの count>=2(D-014)。
// 詳細ページへのリンクは (1) STリーグ集計ページ (2) 高校の学校ページ の順に解決する
// (TeamLink 規則・07-components.md §4)。高校は (校名, 都道府県) 照合で引く。
// 男女切替は teams.json の boysCount/girlsCount による(scripts/build-team-master.mjs)。
import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { isVisibleGender } from '@/lib/highschool';
import { getAllStLeagueTeamIds, getStLeagueYears, loadParticipants } from '@/utils/st-league';
import { normalizeJa } from '@/utils/team-data-aggregator';

/** 高校の学校ページ(/highschool/[gender]/[prefectureId]/[teamId])への参照 */
type HighschoolRef = {
  /** 学校ページの teamId(文字列 slug) */
  t: string;
  /** 都道府県 id */
  p: string;
  /** 男子ページが存在するか */
  b?: 1;
  /** 女子ページが存在するか */
  g?: 1;
};

type TeamRow = {
  /** チーム名(マスタの最頻出表記) */
  n: string;
  /** 都道府県(不明時 null) */
  p: string | null;
  /** 収録試合数 */
  c: number;
  /** STリーグ teamId(集計ページが実在する場合のみ) */
  s?: string;
  /** 男子の収録数(0 のときは省略) */
  b?: number;
  /** 女子の収録数(0 のときは省略) */
  g?: number;
  /** ミックスのみ出場か(男女の判定材料が無いチーム。両方のタブに出す) */
  m?: 1;
  /** 高校の学校ページ */
  h?: HighschoolRef;
};

type GenderFilter = 'all' | 'boys' | 'girls';

type Props = {
  teams: TeamRow[];
  totalCount: number;
};

const INITIAL_LIMIT = 50;

const GENDER_FILTERS: { id: GenderFilter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'boys', label: '男子' },
  { id: 'girls', label: '女子' },
];

export default function TeamsIndexPage({ teams, totalCount }: Props) {
  const pageUrl = 'https://softeni-pick.com/teams/';
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState<GenderFilter>('all');

  // 男女切替: 該当性別の収録があるチームだけに絞り、収録数もその性別の値にする。
  // ミックス種目にしか出ていないチーム(男女ペアなのでカテゴリから性別が決まらない)は
  // どちらのタブにも残す。
  const scoped = useMemo(() => {
    if (gender === 'all') return teams;
    const key = gender === 'boys' ? 'b' : 'g';
    return teams.filter((t) => t.m || (t[key] ?? 0) > 0).sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0) || a.n.localeCompare(b.n, 'ja'));
  }, [teams, gender]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped.slice(0, INITIAL_LIMIT);
    const terms = q.split(/\s+/);
    return scoped.filter((t) => {
      const text = `${t.n} ${t.p ?? ''}`.toLowerCase();
      return terms.every((term) => text.includes(term));
    });
  }, [scoped, query]);

  const isSearching = query.trim().length > 0;
  const genderLabel = gender === 'all' ? '' : gender === 'boys' ? '男子' : '女子';
  const countOf = (t: TeamRow) => (gender === 'all' ? t.c : ((gender === 'boys' ? t.b : t.g) ?? 0));

  return (
    <>
      <MetaHead
        title="チーム一覧 | ソフトテニス情報 Softeni Pick"
        description="ソフトテニスのチーム（学校・実業団・クラブ）を名前・都道府県・男女で検索できます。STリーグ出場チームは年度別成績ページ、高校は学校ページへのリンクつき。"
        url={pageUrl}
        type="website"
      />

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'チーム一覧', href: '/teams' },
          ]}
        />

        <h1 className="text-2xl font-bold mb-2">チーム一覧</h1>
        <p className="text-sm text-text-muted dark:text-gray-400 mb-6">
          大会結果に収録されているチーム（学校・実業団・クラブ）を検索できます。掲載は収録試合が2試合以上のチーム（{totalCount.toLocaleString()}
          件）。STリーグ出場チームはチームページ、高校は学校ページへのリンクがあります。
        </p>

        {/* 男女切替(収録データの性別で絞り込む) */}
        <div className="mb-4 flex flex-wrap gap-2">
          {GENDER_FILTERS.map((f) => {
            const active = f.id === gender;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setGender(f.id)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active ? 'border-blue-600 bg-blue-600 text-white' : 'border-border bg-surface text-text-secondary hover:border-blue-400'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="チーム名・都道府県で検索（例: 高田商業、長野県）"
            aria-label="チーム検索"
            className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text placeholder:text-gray-400 focus:border-blue-600 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <p className="text-xs text-text-muted dark:text-gray-400 mb-2">
          {isSearching
            ? `検索結果: ${filtered.length.toLocaleString()}件`
            : `${genderLabel ? `${genderLabel}の収録があるチーム ${scoped.length.toLocaleString()}件のうち、` : ''}収録試合数の上位 ${INITIAL_LIMIT} 件を表示中（検索で全件から絞り込めます）`}
        </p>

        <div className="overflow-x-auto rounded-lg border border-border dark:border-gray-700">
          <table className="w-full bg-surface text-sm dark:bg-gray-900">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted dark:border-gray-700 dark:text-gray-400">
                <th className="px-4 py-2 font-medium">チーム</th>
                <th className="px-4 py-2 font-medium">都道府県</th>
                <th className="px-4 py-2 font-medium text-right">収録試合数{genderLabel && `(${genderLabel})`}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={`${t.n}-${t.p ?? ''}`} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                  <td className="px-4 py-2">
                    <TeamCell row={t} gender={gender} />
                  </td>
                  <td className="px-4 py-2 text-text-muted dark:text-gray-400">{t.p ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-text dark:text-gray-100">{countOf(t).toLocaleString()}</td>
                </tr>
              ))}
              {isSearching && filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-sm text-text-muted dark:text-gray-400">
                    「{query}」に一致するチームがありません。
                    <span className="mt-1 block text-xs">
                      チーム名は大会結果の表記で登録されています。略称（高田商業→高田商）や都道府県名だけでも試せます。
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-text-muted dark:text-gray-400">
          ※ 収録試合数は当サイトが収録している大会結果に基づくもので、実際の出場数とは異なる場合があります。
        </p>
      </PageLayout>
    </>
  );
}

/**
 * チーム名セル。リンク先の優先順位は (1) STリーグ集計ページ (2) 高校の学校ページ (3) リンクなし
 * （`docs/ui/deliverables/07-components.md` の TeamLink 規則）。
 * 高校は男女で URL が分かれるため、男女切替が「すべて」のときだけ校名の後ろに
 * 男子・女子リンクを併記し、性別を選んでいるときは校名自体をその性別のページへリンクする。
 */
function TeamCell({ row, gender }: { row: TeamRow; gender: GenderFilter }) {
  if (row.s) {
    return (
      <Link href={`/teams/${row.s}`} className="text-link hover:underline dark:text-blue-300">
        {row.n}
      </Link>
    );
  }

  const hs = row.h;
  if (hs) {
    if (gender !== 'all') {
      const available = gender === 'boys' ? hs.b : hs.g;
      if (available) {
        return (
          <Link href={`/highschool/${gender}/${hs.p}/${hs.t}`} className="text-link hover:underline dark:text-blue-300">
            {row.n}
          </Link>
        );
      }
    } else {
      const genders = (['boys', 'girls'] as const).filter((g) => (g === 'boys' ? hs.b : hs.g));
      if (genders.length > 0) {
        return (
          <span className="text-text dark:text-gray-100">
            {row.n}
            {genders.map((g) => (
              <Link key={g} href={`/highschool/${g}/${hs.p}/${hs.t}`} className="ml-2 text-xs text-link hover:underline dark:text-blue-300">
                {g === 'boys' ? '男子' : '女子'}
              </Link>
            ))}
          </span>
        );
      }
    }
  }

  return <span className="text-text dark:text-gray-100">{row.n}</span>;
}

// ─── データ取得 ───────────────────────────────────────────────────────────
type TeamMasterEntry = {
  id: number;
  name: string;
  prefecture: string | null;
  count: number;
  /** 男女別の収録数(scripts/build-team-master.mjs が付与。0 のときは省略される) */
  boysCount?: number;
  girlsCount?: number;
  /** ミックス種目の収録数(男女ペアなのでカテゴリから性別が決まらない分) */
  mixedCount?: number;
  aliases?: string[];
};

type HighschoolSummaryEntry = {
  team: string;
  teamId: string;
  prefectureId: string;
  gender: string;
};

/**
 * 高校の学校ページを (校名, 都道府県) で引ける索引を作る。
 * チームマスタ(連番 id)と学校ページ(文字列 id)の体系は未統合(O-007/D-019)だが、
 * 校名は都道府県内で一意（都道府県をまたぐ同名校は実データで0件）なので姓名照合と
 * 同じ要領で解決できる。mixed の成績は男女どちらのページにも出る(isVisibleGender)。
 */
function buildHighschoolIndex(): Map<string, HighschoolRef> {
  const prefDir = path.join(process.cwd(), 'data/highschool/prefectures');
  const index = new Map<string, HighschoolRef>();
  if (!fs.existsSync(prefDir)) return index;

  for (const prefId of fs.readdirSync(prefDir)) {
    const summaryPath = path.join(prefDir, prefId, 'summary.json');
    if (!fs.existsSync(summaryPath)) continue;
    let entries: HighschoolSummaryEntry[];
    try {
      entries = JSON.parse(fs.readFileSync(summaryPath, 'utf-8')) as HighschoolSummaryEntry[];
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.team || !e.teamId) continue;
      const key = `${normalizeJa(e.team)}::${e.prefectureId}`;
      const ref: HighschoolRef = index.get(key) ?? { t: e.teamId, p: e.prefectureId };
      if (isVisibleGender(e.gender, 'boys')) ref.b = 1;
      if (isVisibleGender(e.gender, 'girls')) ref.g = 1;
      index.set(key, ref);
    }
  }
  return index;
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const teamsPath = path.join(process.cwd(), 'data', 'teams', 'teams.json');
  const master = JSON.parse(fs.readFileSync(teamsPath, 'utf-8')) as TeamMasterEntry[];

  // STリーグチーム名 → teamId の対応(全年度の name バリアントを集約)
  const stIds = new Set(getAllStLeagueTeamIds());
  const nameToStId = new Map<string, string>();
  for (const year of getStLeagueYears()) {
    const participants = loadParticipants(year);
    if (!participants) continue;
    (['boys', 'girls'] as const).forEach((g) => {
      for (const team of participants[g]) {
        if (!stIds.has(team.teamId)) continue;
        for (const name of team.name) nameToStId.set(name, team.teamId);
      }
    });
  }

  const resolveStId = (entry: TeamMasterEntry): string | undefined => {
    if (nameToStId.has(entry.name)) return nameToStId.get(entry.name);
    for (const alias of entry.aliases ?? []) {
      if (nameToStId.has(alias)) return nameToStId.get(alias);
    }
    return undefined;
  };

  // 高校の学校ページ索引と、都道府県名 → id の対応
  const highschoolIndex = buildHighschoolIndex();
  const prefIds = new Map<string, string>(
    (JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'prefectures.json'), 'utf-8')) as { id: string; name: string }[]).map((p) => [p.name, p.id]),
  );
  const resolveHighschool = (entry: TeamMasterEntry): HighschoolRef | undefined => {
    if (!entry.prefecture) return undefined;
    const prefId = prefIds.get(entry.prefecture);
    if (!prefId) return undefined;
    for (const name of [entry.name, ...(entry.aliases ?? [])]) {
      const ref = highschoolIndex.get(`${normalizeJa(name)}::${prefId}`);
      if (ref) return ref;
    }
    return undefined;
  };

  // D-014: count>=2 のみ掲載。収録試合数の多い順
  const teams: TeamRow[] = master
    .filter((t) => t.count >= 2)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
    .map((t) => {
      const s = resolveStId(t);
      const h = resolveHighschool(t);
      const boys = t.boysCount ?? 0;
      const girls = t.girlsCount ?? 0;
      return {
        n: t.name,
        p: t.prefecture,
        c: t.count,
        ...(s ? { s } : {}),
        ...(boys > 0 ? { b: boys } : {}),
        ...(girls > 0 ? { g: girls } : {}),
        // ミックスにしか出ていない(男女の判定材料が無い)チームの目印
        ...(boys === 0 && girls === 0 && (t.mixedCount ?? 0) > 0 ? { m: 1 as const } : {}),
        ...(h ? { h } : {}),
      };
    });

  return { props: { teams, totalCount: teams.length } };
};
