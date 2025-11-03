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
}

interface TournamentOption {
  id: string;
  name: string;
  generation: string;
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

/**
 * 大会IDから大会情報を取得する
 */
export const getTournamentInfo = async (
  tournamentId: string,
): Promise<TournamentInfo | null> => {
  try {
    // APIから全ての大会データを取得
    const response = await fetch('/api/tournaments');
    const data = await response.json();

    if (!response.ok || !data.tournaments) {
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
      detailUrl: `/tournaments/${tournament.generation}/${tournament.meta.id}/${tournament.yearMeta.year}`,
    };
  } catch (error) {
    console.error('Failed to fetch tournament info:', error);
    return null;
  }
};

/**
 * 大会情報をマッチ作成時に使用するための選択肢を生成
 */
export const getTournamentOptions = async (): Promise<
  { id: string; name: string }[]
> => {
  try {
    // APIから全ての大会データを取得
    const response = await fetch('/api/tournaments');
    const data = await response.json();

    if (!response.ok || !data.tournaments) {
      throw new Error('Failed to fetch tournaments');
    }

    // 選択肢用の形式に変換
    return data.tournaments.map((tournament: { id: string; name: string }) => ({
      id: tournament.id,
      name: tournament.name,
    }));
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
    const data = await response.json();

    if (!response.ok || !data.categories) {
      throw new Error('Failed to fetch tournament categories');
    }

    return data.categories;
  } catch (error) {
    console.error('Failed to fetch tournament categories:', error);
    return [];
  }
};

/**
 * カテゴリから選択肢を生成する
 */
export const getCategoryOptions = (categories: TournamentCategory[]) => {
  // 世代の選択肢
  const generations = Array.from(
    new Set(categories.map((cat) => cat.age || 'none')),
  ).map((age) => ({
    value: age,
    label: age === 'none' ? '一般' : age,
  }));

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
