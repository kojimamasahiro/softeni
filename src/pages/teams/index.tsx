// src/pages/teams/index.tsx
// チーム一覧(セクション入口・ページタイプ T2)。
// 検索対象はチームマスタの count>=2(D-014)。
// 詳細ページへのリンクは (1) チームページ（STリーグ集計 / team-name-mappings.json）を最優先し、
// 無ければ (2) 高校の学校ページ (3) 中学生・小学生のチームページ を**すべて**出す
// (TeamLink 規則・07-components.md §4。小中は 2026-09-14 追加)。学校系は (校名, 都道府県) 照合で引く。
// 同名で複数カテゴリに当たる行（小中両方のクラブ、高校と同名の中学など）はカテゴリ名つきのリンクを並べる。
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

/** 中学生・小学生のチームページ(/[category]/[prefectureId]/[teamId])への参照。男女共通の1枚 */
type JuniorRef = {
  /** チームページの teamId(文字列 slug) */
  t: string;
  /** 都道府県 id */
  p: string;
};

type TeamRow = {
  /** チーム名(マスタの最頻出表記) */
  n: string;
  /** 都道府県(不明時 null) */
  p: string | null;
  /** 収録試合数 */
  c: number;
  /** /teams/[teamId] の teamId(STリーグ集計か team-name-mappings.json でページが実在する場合のみ) */
  s?: string;
  /** 男子の収録数(0 のときは省略) */
  b?: number;
  /** 女子の収録数(0 のときは省略) */
  g?: number;
  /** ミックスのみ出場か(男女の判定材料が無いチーム。両方のタブに出す) */
  m?: 1;
  /** 高校の学校ページ */
  h?: HighschoolRef;
  /** 中学生のチームページ */
  j?: JuniorRef;
  /** 小学生のチームページ */
  e?: JuniorRef;
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
        description="ソフトテニスのチーム（学校・実業団・クラブ）を名前・都道府県・男女で検索できます。STリーグ出場チームは年度別成績ページ、高校生・中学生・小学生はカテゴリのページへのリンクつき。"
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
          件）。STリーグ出場チームなどはチームページ、高校生・中学生・小学生はそれぞれのカテゴリのページへのリンクがあります。
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
 * チーム名セル（`docs/ui/deliverables/07-components.md` の TeamLink 規則）。
 * (1) チームページ（/teams/[teamId]）があればチーム名をそこへリンクして終わり。
 * 無ければ (2) 高校の学校ページ (3) 中学生 (4) 小学生 のうち存在するものを**すべて**出す。
 *
 * - リンク先が1つで、ラベルが要らないとき（性別選択中の高校・中学生のみ・小学生のみ）はチーム名自体をリンクにする
 * - それ以外はチーム名の後ろにラベルつきリンクを並べる。高校は男女で URL が分かれるので
 *   「すべて」表示では男子・女子を併記する。小中と並ぶときは高校側を「高校男子」「高校」のように区別する
 * - 中学生・小学生のページは男女共通なので、男女切替に関係なく同じリンクを出す
 */
function TeamCell({ row, gender }: { row: TeamRow; gender: GenderFilter }) {
  if (row.s) {
    return (
      <Link href={`/teams/${row.s}`} className="text-link hover:underline dark:text-blue-300">
        {row.n}
      </Link>
    );
  }

  const hasJunior = Boolean(row.j || row.e);
  // label が null のリンクは「チーム名自体をリンクにしてよい」もの
  const links: { label: string | null; href: string }[] = [];

  const hs = row.h;
  if (hs) {
    if (gender !== 'all') {
      if (gender === 'boys' ? hs.b : hs.g) links.push({ label: hasJunior ? '高校' : null, href: `/highschool/${gender}/${hs.p}/${hs.t}` });
    } else {
      for (const g of ['boys', 'girls'] as const) {
        if (!(g === 'boys' ? hs.b : hs.g)) continue;
        const genderWord = g === 'boys' ? '男子' : '女子';
        links.push({ label: hasJunior ? `高校${genderWord}` : genderWord, href: `/highschool/${g}/${hs.p}/${hs.t}` });
      }
    }
  }
  if (row.j) links.push({ label: '中学生', href: `/secondaryschool/${row.j.p}/${row.j.t}` });
  if (row.e) links.push({ label: '小学生', href: `/primaryschool/${row.e.p}/${row.e.t}` });

  if (links.length === 0) return <span className="text-text dark:text-gray-100">{row.n}</span>;

  // 行き先が1つだけで、高校の男女ラベルが要らない場合は名前をリンクにする（大半の行はこれ）
  const single = links.length === 1 && (links[0].label === null || links[0].label === '中学生' || links[0].label === '小学生');
  if (single) {
    return (
      <Link href={links[0].href} className="text-link hover:underline dark:text-blue-300">
        {row.n}
      </Link>
    );
  }

  return (
    <span className="text-text dark:text-gray-100">
      {row.n}
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="ml-2 text-xs text-link hover:underline dark:text-blue-300">
          {l.label ?? '学校ページ'}
        </Link>
      ))}
    </span>
  );
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

/**
 * 中学生・小学生のチームページを (チーム名, 都道府県) で引ける索引を作る。
 * 生成物は data/{secondaryschool,primaryschool}/index.json（ページがあるチームだけが入っている）。
 */
function buildJuniorIndex(category: 'secondaryschool' | 'primaryschool'): Map<string, JuniorRef> {
  const index = new Map<string, JuniorRef>();
  try {
    const { teams } = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', category, 'index.json'), 'utf-8')) as {
      teams: { id: string; name: string; prefectureId: string }[];
    };
    for (const t of teams) index.set(`${normalizeJa(t.name)}::${t.prefectureId}`, { t: t.id, p: t.prefectureId });
  } catch {
    // 索引が無ければリンクしない
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

  // team-name-mappings.json のキーにも /teams/[teamId] が生成される（getStaticPaths と同じ）。
  // STリーグに出ていない日本体育大学（nssu）がこれで一覧からリンクされる。STリーグの対応を優先する
  try {
    const mappings = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'teams', 'team-name-mappings.json'), 'utf-8')) as Record<string, string[]>;
    for (const [teamId, names] of Object.entries(mappings)) {
      for (const name of names) if (!nameToStId.has(name)) nameToStId.set(name, teamId);
    }
  } catch {
    // mappings が無ければ STリーグのみ
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

  const juniorIndexes = { j: buildJuniorIndex('secondaryschool'), e: buildJuniorIndex('primaryschool') };
  const resolveJunior = (entry: TeamMasterEntry, key: 'j' | 'e'): JuniorRef | undefined => {
    if (!entry.prefecture) return undefined;
    const prefId = prefIds.get(entry.prefecture);
    if (!prefId) return undefined;
    for (const name of [entry.name, ...(entry.aliases ?? [])]) {
      const ref = juniorIndexes[key].get(`${normalizeJa(name)}::${prefId}`);
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
      const j = resolveJunior(t, 'j');
      const e = resolveJunior(t, 'e');
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
        ...(j ? { j } : {}),
        ...(e ? { e } : {}),
      };
    });

  return { props: { teams, totalCount: teams.length } };
};
