// lib/nationalTitles.ts
// 選手の主要大会実績（勲章カード＋「全国大会優勝」SEO 文言）の対象大会マスタと表示ヘルパ。
//
// このファイルは **2 つの異なる対象集合** を 1 つのマスタで表現している。混同しないこと:
//
// | 用途 | 判定フィールド | 含む | 除く |
// |---|---|---|---|
// | 勲章カード（ベスト8以上をカテゴリ別に表示） | `majorCategory !== null` | ジュニア/高校/大学/総合/国際大会/シニア | **社会人**・東西日本・国際予選 |
// | 「全国大会優勝」SEO・`titles.national`・`firstNational*` | `nationalTitle === true` | 国内の全国大会（**社会人を含む**） | **国際大会**・東西日本・国際予選 |
//
// ずれているのは意図的（2026-07-20 ユーザー決定）。理由は `NationalTitleTournamentMeta`
// の各フィールドの doc コメントを参照。
//
// 設計上の要点（2026-07-20 決定）:
//
// 1. 判定は `PlayerEntryFact.isNational` を使わず、**このファイルの明示ホワイトリスト**で行う。
//    選手統計エンジンの `isNational` は「`generationId` が international / international-qualifier
//    以外」という広い定義（docs/wiki/players-pages.md「確定した集計ルール」）で、
//    東日本選手権大会・西日本選手権大会という**地域大会**まで true になる。
//    これらを「全国大会優勝」と表示するのは事実として誤りなので、実績表示の対象は
//    大会 ID の列挙で持つ。`isNational` の定義自体（ランキング tier 等で使用）は変更しない。
//
// 2. 「どの大会が格上か」の序列は付けない（2026-07-20 決定）。全国大会で優勝したという
//    事実をそのまま出すだけ。並び順は年度降順（直近優先）で、これは格付けではない。
//
// 3. `shortLabel` / `aliases` は SEO 用。正式名称「全国高等学校総合体育大会」だけでは
//    「インターハイ 優勝」という通称クエリに一致しないため、通称を title / description /
//    本文バッジに literal で出す。`lib/highschoolNationalTournaments.ts` の
//    `HsNationalTournamentMeta.aliases` と同じ考え方（docs/wiki/seo.md #3）。

/**
 * 勲章カードのカテゴリ。選手のキャリア進行順に並べる（格付けではない）。
 *
 * `index.json` の `generationId` をそのまま使わないのは、①`junior` に小学・中学・U20 が
 * 同居していて 1 カテゴリにまとめたい、②`corporate`（社会人）と `international-qualifier`
 * （国際予選）はカテゴリを与えない、という 2 つの理由から（2026-07-20 ユーザー決定）。
 */
export type MajorCategoryId = 'junior' | 'highschool' | 'university' | 'general' | 'international' | 'senior';

/**
 * 表示順。**キャリアの新しい側から並べる**（シニア → 国際大会 → 総合 → 大学 → 高校 → ジュニア）。
 * 直近・上位カテゴリの実績を先に見せるため（2026-07-20 ユーザー決定で進行順から反転）。
 * 格付けの順位ではない。
 */
export const MAJOR_CATEGORY_ORDER: MajorCategoryId[] = ['senior', 'international', 'general', 'university', 'highschool', 'junior'];

export const MAJOR_CATEGORY_LABEL: Record<MajorCategoryId, string> = {
  junior: 'ジュニア',
  highschool: '高校',
  university: '大学',
  general: '総合',
  international: '国際大会',
  senior: 'シニア',
};

export type NationalTitleTournamentMeta = {
  tournamentId: string;
  /** 正式名称（data/tournaments/index.json の label と一致させる） */
  label: string;
  /** 通称・短縮名。バッジ・title に出す主表記 */
  shortLabel: string;
  /** 追加の検索略称。description に 1 回だけ添える（title には入れない） */
  aliases?: string[];
  /**
   * 勲章カードのカテゴリ。`null` はカードを出さない大会
   * （社会人＝`corporate`、東日本/西日本選手権、国際予選）。
   */
  majorCategory: MajorCategoryId | null;
  /**
   * 「全国大会優勝」として SEO（title / description / JSON-LD `award`）と
   * `titles.national` / `firstNational*` に数えてよいか。
   *
   * `majorCategory` とは**わざと一致させていない**（2026-07-20 ユーザー決定）:
   * - 社会人（全日本社会人・実業団・クラブ選手権）: 勲章カードは出さないが、
   *   「全国大会優勝」としては事実正しいので SEO には残す（優勝者の流入を落とさないため）。
   * - 国際大会（平和カップ・コリアカップ）: 勲章カードは「国際大会」として出すが、
   *   国内の全国大会ではないので「全国大会優勝」には数えない。
   */
  nationalTitle: boolean;
};

/**
 * 実績表示の対象大会マスタ（明示ホワイトリスト・24件）。
 *
 * data/tournaments/index.json の 29 大会のうち、次の 5 件は**どちらの用途でも対象外**なので
 * このマスタに載せていない:
 * - `international-qualifier`（世界選手権予選 等・3件）: 代表選考であり大会タイトルではない
 * - `east-japan` / `west-japan`（東日本選手権 / 西日本選手権）: 地域大会であり全国大会ではない
 *
 * 大会を追加したときは、ここに足さない限り実績表示には現れない（安全側に倒す設計）。
 */
export const NATIONAL_TITLE_TOURNAMENTS: NationalTitleTournamentMeta[] = [
  // 総合（一般・全日本系）
  {
    tournamentId: 'zennihon-championship',
    label: '天皇賜杯・皇后賜杯 全日本選手権大会',
    shortLabel: '全日本選手権',
    aliases: ['天皇杯', '皇后杯'],
    majorCategory: 'general',
    nationalTitle: true,
  },
  {
    tournamentId: 'zennihon-mixed',
    label: '全日本ミックスダブルス選手権大会',
    shortLabel: '全日本ミックスダブルス選手権',
    majorCategory: 'general',
    nationalTitle: true,
  },
  {
    tournamentId: 'zennihon-singles',
    label: '全日本シングルス選手権大会',
    shortLabel: '全日本シングルス選手権',
    majorCategory: 'general',
    nationalTitle: true,
  },
  { tournamentId: 'zennihon-indoor', label: '全日本インドア選手権大会', shortLabel: '全日本インドア', majorCategory: 'general', nationalTitle: true },
  { tournamentId: 'zennihon-senbatsu', label: '全日本選抜大会', shortLabel: '全日本選抜', majorCategory: 'general', nationalTitle: true },
  // 社会人: 勲章カードは出さない（majorCategory=null）が、全国大会優勝としては SEO に数える
  { tournamentId: 'zennihon-business-group', label: '全日本実業団選手権大会', shortLabel: '全日本実業団', majorCategory: null, nationalTitle: true },
  { tournamentId: 'zennihon-workers', label: '全日本社会人選手権大会', shortLabel: '全日本社会人', majorCategory: null, nationalTitle: true },
  { tournamentId: 'zennihon-club', label: '全日本クラブ選手権大会', shortLabel: '全日本クラブ選手権', majorCategory: null, nationalTitle: true },
  // 大学
  {
    tournamentId: 'zennihon-university',
    label: '全日本学生選手権大会',
    shortLabel: 'インカレ',
    aliases: ['全日本学生選手権'],
    majorCategory: 'university',
    nationalTitle: true,
  },
  {
    tournamentId: 'zennihon-university-ouza',
    label: '全日本大学ソフトテニス王座決定戦',
    shortLabel: '大学王座',
    majorCategory: 'university',
    nationalTitle: true,
  },
  {
    tournamentId: 'zennihon-university-indoor',
    label: '全日本学生選抜インドア選手権大会',
    shortLabel: '学生選抜インドア',
    majorCategory: 'university',
    nationalTitle: true,
  },
  // 高校
  {
    tournamentId: 'highschool-championship',
    label: '全国高等学校総合体育大会',
    shortLabel: 'インターハイ',
    aliases: ['高校総体', 'インハイ'],
    majorCategory: 'highschool',
    nationalTitle: true,
  },
  { tournamentId: 'highschool-senbatsu', label: '全日本高等学校選抜大会', shortLabel: '高校選抜', majorCategory: 'highschool', nationalTitle: true },
  {
    tournamentId: 'highschool-japan-cup',
    label: 'ハイスクールジャパンカップ',
    shortLabel: 'ハイスクールジャパンカップ',
    aliases: ['ハイジャパ'],
    majorCategory: 'highschool',
    nationalTitle: true,
  },
  // ジュニア（中学・小学・U20 をひとまとめ）
  {
    tournamentId: 'secondaryschool-championship',
    label: '全国中学校体育大会',
    shortLabel: '全国中学校大会',
    aliases: ['全中'],
    majorCategory: 'junior',
    nationalTitle: true,
  },
  {
    tournamentId: 'zennihon-secondaryschool-versus',
    label: '都道府県対抗全日本中学生大会',
    shortLabel: '都道府県対抗全日本中学生大会',
    majorCategory: 'junior',
    nationalTitle: true,
  },
  {
    tournamentId: 'zennihon-secondaryschool-club',
    label: '全日本中学生クラブソフトテニス選手権',
    shortLabel: '全日本中学生クラブ選手権',
    majorCategory: 'junior',
    nationalTitle: true,
  },
  {
    tournamentId: 'zennihon-secondaryschool-club-pre',
    label: '全日本中学生クラブソフトテニス選手権プレ大会',
    shortLabel: '全日本中学生クラブ選手権プレ大会',
    majorCategory: 'junior',
    nationalTitle: true,
  },
  { tournamentId: 'zennihon-primaryschool', label: '全日本小学生選手権大会', shortLabel: '全日本小学生選手権', majorCategory: 'junior', nationalTitle: true },
  { tournamentId: 'primaryschool-championship', label: '全国小学生大会', shortLabel: '全国小学生大会', majorCategory: 'junior', nationalTitle: true },
  { tournamentId: 'zennihon-junior', label: '全日本ジュニア選手権大会', shortLabel: '全日本ジュニア選手権', majorCategory: 'junior', nationalTitle: true },
  // シニア
  { tournamentId: 'zennihon-senior', label: '全日本シニア選手権大会', shortLabel: '全日本シニア選手権', majorCategory: 'senior', nationalTitle: true },
  // 国際大会: 勲章カードは「国際大会」として出すが、国内の全国大会ではないので
  // 「全国大会優勝」には数えない（nationalTitle=false）
  {
    tournamentId: 'international-hiroshima-peacecup',
    label: '平和カップひろしま国際大会',
    shortLabel: '平和カップひろしま',
    majorCategory: 'international',
    nationalTitle: false,
  },
  { tournamentId: 'international-korea-cup', label: 'コリアカップ国際大会', shortLabel: 'コリアカップ', majorCategory: 'international', nationalTitle: false },
];

const BY_ID = new Map(NATIONAL_TITLE_TOURNAMENTS.map((t) => [t.tournamentId, t] as const));

/**
 * この大会での優勝を「全国大会優勝」として扱ってよいか（SEO・`titles.national`・
 * `firstNational*` 用）。社会人は含み、国際大会は含まない。
 */
export function isNationalTitleTournament(tournamentId: string): boolean {
  return BY_ID.get(tournamentId)?.nationalTitle === true;
}

/**
 * 勲章カードのカテゴリを返す。カードを出さない大会（社会人・東西日本・国際予選・
 * マスタ外）は null。
 */
export function getMajorCategory(tournamentId: string): MajorCategoryId | null {
  return BY_ID.get(tournamentId)?.majorCategory ?? null;
}

export function getNationalTitleMeta(tournamentId: string): NationalTitleTournamentMeta | null {
  return BY_ID.get(tournamentId) ?? null;
}

/**
 * 表示・SEO 用の短縮名。マスタに無い大会は null を返す
 * （＝実績表示の対象外。呼び出し側でフィルタ済みである前提）。
 */
export function nationalTitleShortLabel(tournamentId: string): string | null {
  return BY_ID.get(tournamentId)?.shortLabel ?? null;
}

// ---------------------------------------------------------------------------
// 表示・SEO 文言のビルダー
//
// バッジ（本文）・title・description・JSON-LD の 4 箇所で同じ実績を出すため、
// 文言生成をここに集約する。ページ側で組み立てると表記が割れるため。
// ---------------------------------------------------------------------------

/** 大会単位にまとめた優勝実績（同一大会の複数回優勝は 1 行に集約）。 */
export type NationalTitleGroup = {
  tournamentId: string;
  tournamentName: string;
  shortLabel: string;
  /** その大会での優勝回数 */
  count: number;
  /** 優勝年度（降順） */
  years: number[];
  /** 種目ラベル（男子ダブルス 等）。重複除去済み */
  disciplines: string[];
  /** バッジ表示用ラベル（例: 「インターハイ優勝」「インターハイ優勝2回」） */
  badgeLabel: string;
};

/** 年度降順の NationalTitle[] を大会単位にまとめる（直近優勝が新しい大会順）。 */
export function groupNationalTitles(titles: NationalTitleLike[]): NationalTitleGroup[] {
  const byTournament = new Map<string, NationalTitleGroup>();
  for (const t of titles) {
    const existing = byTournament.get(t.tournamentId);
    if (existing) {
      existing.count += 1;
      if (!existing.years.includes(t.year)) existing.years.push(t.year);
      if (t.discipline && !existing.disciplines.includes(t.discipline)) existing.disciplines.push(t.discipline);
      continue;
    }
    byTournament.set(t.tournamentId, {
      tournamentId: t.tournamentId,
      tournamentName: t.tournamentName,
      shortLabel: t.shortLabel,
      count: 1,
      years: [t.year],
      disciplines: t.discipline ? [t.discipline] : [],
      badgeLabel: '',
    });
  }
  const groups = Array.from(byTournament.values());
  for (const g of groups) {
    g.years.sort((a, b) => b - a);
    g.badgeLabel = g.count > 1 ? `${g.shortLabel}優勝${g.count}回` : `${g.shortLabel}優勝`;
  }
  return groups;
}

/** 型の重複 import を避けるための最小形（src/types/playerStatistics.ts の NationalTitle 互換）。 */
export type NationalTitleLike = {
  tournamentId: string;
  tournamentName: string;
  shortLabel: string;
  discipline: string;
  year: number;
};

/**
 * title 用の短い実績フレーズ。
 *
 * 「インターハイ 優勝」のような**通称クエリ**に exact 一致させるのが目的なので、
 * 直近に優勝した大会の shortLabel を必ず先頭に置く（docs/wiki/seo.md #3 の
 * 略称 literal 方針と同じ考え方）。title 全体が長くなりすぎないよう 1 大会分に絞る。
 */
export function nationalTitleTitlePhrase(titles: NationalTitleLike[]): string | null {
  const groups = groupNationalTitles(titles);
  if (groups.length === 0) return null;
  if (groups.length === 1) return groups[0].badgeLabel;
  // 複数大会で優勝している場合、直近 1 大会だけを title に載せると
  // 「インターハイ優勝」のような需要の大きい通称が title から落ちうる。
  // 先頭 2 大会まで並べて主要な通称を確実に残す（3 件以上は「ほか計N回」に畳む）。
  // ただし大会名が長い場合まで 2 件並べると title が崩れるので、
  // 2 件目を足して長くなりすぎるときは 1 件に戻す（実測 p90 は 2 件で 33 字）。
  const TWO_LABEL_MAX = 26;
  const two = groups
    .slice(0, 2)
    .map((g) => g.badgeLabel)
    .join('・');
  const head = two.length <= TWO_LABEL_MAX ? two : groups[0].badgeLabel;
  return `${head}ほか全国優勝計${titles.length}回`;
}

/**
 * 検索用の大会表記。正式名称に通称が含まれていない場合だけ「正式名称（通称）」にする。
 * 「全日本ジュニア選手権大会（全日本ジュニア選手権）」のような冗長な重複を避ける。
 */
function searchableTournamentName(meta: NationalTitleTournamentMeta): string {
  const extras = [meta.shortLabel, ...(meta.aliases ?? [])].filter((s) => !meta.label.includes(s));
  return extras.length > 0 ? `${meta.label}（${extras.join('・')}）` : meta.label;
}

/**
 * description 用の実績フレーズ。title と違い字数に余裕があるので、
 * 正式名称・通称・略称・年度まで入れてロングテールを広く取る。
 */
export function nationalTitleDescriptionPhrase(titles: NationalTitleLike[]): string | null {
  if (titles.length === 0) return null;
  const groups = groupNationalTitles(titles);
  const shown = groups.slice(0, 3).map((g) => {
    const meta = BY_ID.get(g.tournamentId);
    const name = meta ? searchableTournamentName(meta) : g.tournamentName;
    return `${g.years[0]}年${name}`;
  });
  const rest = groups.length > shown.length ? `ほか${groups.length - shown.length}大会` : '';
  return `全国大会優勝${titles.length}回: ${shown.join('、')}${rest}。`;
}

/** JSON-LD `Person.award` 用の文字列配列。 */
export function nationalTitleAwards(titles: NationalTitleLike[]): string[] {
  return titles.map((t) => `${t.year}年 ${t.tournamentName} ${t.discipline} 優勝`);
}
