// lib/tournaments.ts - 既存ファイルに追加する関数

export interface TournamentMeta {
  id: string;
  name: string;
  generation: string;
  categoryTypes: string[];
  isMajorTitle: boolean;
  officialUrl?: string;
}

export interface TournamentYearMeta {
  year: number;
  startDate: string;
  endDate: string;
  location: string;
  status: string;
  specialRules?: string;
  note?: string;
  source?: string;
  sourceUrl?: string;
}

export interface TournamentInfo {
  meta: TournamentMeta;
  yearMeta: TournamentYearMeta;
  fullName: string;
  detailUrl: string;
  exists: boolean; // 大会データが実際に存在するかどうか
}

interface TournamentOption {
  id: string;
  name: string;
  meta: TournamentMeta;
  yearMeta: TournamentYearMeta;
}

export interface TournamentCategory {
  id: string;
  label: string;
  category: string;
  gender: string;
  age: string;
}

const isJsonResponse = (response: Response) => {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json');
};

const readJsonResponse = async <T>(response: Response) => {
  if (!response.ok || !isJsonResponse(response)) {
    return null;
  }

  return (await response.json()) as T;
};

/**
 * 世代IDから表示用ラベルを取得する
 */
const getGenerationLabel = (generation: string): string => {
  const generationLabels: Record<string, string> = {
    all: '一般',
    highschool: '高校生',
    junior: 'ジュニア',
    university: '大学生',
    corporate: '社会人',
    masters: 'シニア',
    'international-qualifier': '国際大会',
  };
  return generationLabels[generation] || generation;
};

/**
 * 大会IDから大会情報を取得する
 */
export const getTournamentInfo = async (
  tournamentId: string,
): Promise<TournamentInfo | null> => {
  try {
    // APIから全ての大会データを取得
    const response = await fetch('/api/tournaments');
    const data = await readJsonResponse<{
      tournaments?: TournamentOption[];
    }>(response);

    if (!data?.tournaments) {
      throw new Error('Failed to fetch tournaments');
    }

    // 指定されたIDの大会を検索
    const tournament = data.tournaments.find(
      (t: TournamentOption) => t.id === tournamentId,
    );
    if (!tournament) return null;

    return {
      meta: tournament.meta,
      yearMeta: tournament.yearMeta,
      fullName: tournament.name,
      detailUrl: `/tournaments/${tournament.meta.generation}/${tournament.meta.id}/${tournament.yearMeta.year}`,
      exists: true,
    };
  } catch (error) {
    console.error('Failed to fetch tournament info:', error);
    return null;
  }
};

/**
 * マッチデータから完全な大会URLを生成する
 */
export const generateTournamentUrlFromMatch = (match: {
  tournament_name: string | null;
  tournament_id?: string | null;
  tournament_generation: string | null;
  tournament_gender: string | null;
  tournament_category: string | null;
  tournament_year?: number | null;
}): string | null => {
  // 必要な情報が不足している場合はnullを返す
  if (
    !match.tournament_generation ||
    !match.tournament_gender
    // TODO: データベースにカラム追加後に tournament_year チェックを有効化
    // || !match.tournament_year
  ) {
    return null;
  }

  // tournament_idを使用
  const tournamentId = match.tournament_id;

  if (!tournamentId) {
    return null;
  }

  // マッチデータの年を使用（フォールバックは現在年）
  const year = match.tournament_year || new Date().getFullYear();
  const gameCategory =
    match.tournament_category === 'singles' ? 'singles' : 'doubles';
  const ageCategory = 'none'; // デフォルト
  const gender = match.tournament_gender;

  return `/tournaments/${match.tournament_generation}/${tournamentId}/${year}/${gameCategory}/${ageCategory}/${gender}`;
};

/**
 * 大会情報をマッチ作成時に使用するための選択肢を生成
 */
export const getTournamentOptions = async (): Promise<
  { id: string; name: string; year: number }[]
> => {
  try {
    // APIから全ての大会データを取得
    const response = await fetch('/api/tournaments');
    const data = await readJsonResponse<{
      tournaments?: Array<{
        id: string;
        name: string;
        yearMeta: { year: number };
      }>;
    }>(response);

    if (!data?.tournaments) {
      throw new Error('Failed to fetch tournaments');
    }

    // 選択肢用の形式に変換（年情報も含む）
    return data.tournaments.map(
      (tournament: {
        id: string;
        name: string;
        yearMeta: { year: number };
      }) => ({
        id: tournament.id,
        name: tournament.name,
        year: tournament.yearMeta.year,
      }),
    );
  } catch (error) {
    console.error('Failed to fetch tournament options:', error);
    return [];
  }
};

/**
 * 特定の大会のカテゴリ情報を取得する
 */
export const getTournamentCategories = async (
  tournamentId: string,
): Promise<TournamentCategory[]> => {
  try {
    const response = await fetch(`/api/tournaments/${tournamentId}/categories`);
    const data = await readJsonResponse<{
      categories?: TournamentCategory[];
    }>(response);

    if (!data?.categories) {
      throw new Error('Failed to fetch tournament categories');
    }

    return data.categories;
  } catch (error) {
    console.error('Failed to fetch tournament categories:', error);
    return [];
  }
};

/**
 * 特定の大会のカテゴリ情報とメタデータを取得する
 */
export const getTournamentCategoriesWithMeta = async (
  tournamentId: string,
): Promise<{
  categories: TournamentCategory[];
  meta: TournamentMeta | null;
}> => {
  try {
    // まず大会リストから該当する大会のメタデータを取得
    const tournamentsResponse = await fetch('/api/tournaments');
    const tournamentsData = await readJsonResponse<{
      tournaments?: TournamentOption[];
    }>(tournamentsResponse);

    if (!tournamentsData?.tournaments) {
      throw new Error('Failed to fetch tournaments');
    }

    // tournamentIdに一致する大会を検索
    const tournament = tournamentsData.tournaments.find(
      (t: TournamentOption) => t.id === tournamentId,
    );

    // カテゴリ情報を取得
    const categoriesResponse = await fetch(
      `/api/tournaments/${tournamentId}/categories`,
    );
    const categoriesData = await readJsonResponse<{
      categories?: TournamentCategory[];
    }>(categoriesResponse);

    const categories = categoriesData?.categories ?? [];

    return {
      categories,
      meta: tournament?.meta || null,
    };
  } catch (error) {
    console.error('Failed to fetch tournament categories with meta:', error);
    return { categories: [], meta: null };
  }
};

/**
 * カテゴリから選択肢を生成する
 */
export const getCategoryOptions = (
  categories: TournamentCategory[],
  meta?: TournamentMeta,
) => {
  // 世代の選択肢（TournamentMetaのgenerationを優先使用）
  const generations = meta
    ? [
        {
          value: meta.generation,
          label: getGenerationLabel(meta.generation),
        },
      ]
    : Array.from(new Set(categories.map((cat) => cat.age || 'none'))).map(
        (age) => ({
          value: age,
          label: age === 'none' ? '一般' : age,
        }),
      );

  // 性別の選択肢
  const genders = Array.from(new Set(categories.map((cat) => cat.gender))).map(
    (gender) => ({
      value: gender,
      label: gender === 'boys' ? '男子' : gender === 'girls' ? '女子' : '混合',
    }),
  );

  // カテゴリの選択肢
  const gameCategories = Array.from(
    new Set(categories.map((cat) => cat.category)),
  ).map((category) => ({
    value: category,
    label:
      category === 'doubles'
        ? 'ダブルス'
        : category === 'team'
          ? '団体'
          : category === 'singles'
            ? 'シングルス'
            : category,
  }));

  return {
    generations,
    genders,
    gameCategories,
  };
};
