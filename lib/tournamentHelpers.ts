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
      exists: true,
    };
  } catch (error) {
    console.error('Failed to fetch tournament info:', error);
    return null;
  }
};

/**
 * サーバーサイドで大会情報を取得する（動的データ読み込み）
 */
export const getTournamentInfoSSR = async (
  tournamentId: string,
): Promise<TournamentInfo | null> => {
  try {
    const fs = await import('fs');
    const path = await import('path');

    // data/tournaments ディレクトリを再帰的に検索
    const tournamentsDir = path.join(process.cwd(), 'data', 'tournaments');

    const findTournament = (dir: string): TournamentInfo | null => {
      try {
        if (!fs.existsSync(dir)) return null;

        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = path.join(dir, entry.name);

            // meta.json をチェック
            const metaPath = path.join(fullPath, 'meta.json');
            if (fs.existsSync(metaPath)) {
              try {
                const metaContent = fs.readFileSync(metaPath, 'utf8');
                const meta = JSON.parse(metaContent);

                // 完全一致、ベースIDでマッチ、または名前でマッチ
                const isMatch =
                  meta.id === tournamentId ||
                  meta.name === tournamentId ||
                  (tournamentId.includes('-') &&
                    meta.id === tournamentId.split('-').slice(0, -1).join('-'));

                if (isMatch) {
                  // tournamentIdから年度を抽出（例: zennihon-championship-2025 → 2025）
                  const yearMatch = tournamentId.match(/-(\d{4})$/);
                  const extractedYear = yearMatch ? yearMatch[1] : null;

                  // 利用可能な年度を探す（抽出した年度を優先）
                  const years = extractedYear
                    ? [extractedYear, '2024', '2023', '2025', '2022']
                    : ['2024', '2023', '2025', '2022'];

                  for (const year of years) {
                    const yearPath = path.join(fullPath, year, 'meta.json');
                    if (fs.existsSync(yearPath)) {
                      try {
                        const yearContent = fs.readFileSync(yearPath, 'utf8');
                        const yearMeta = JSON.parse(yearContent);

                        return {
                          meta,
                          yearMeta,
                          fullName: `${meta.name} ${year}`,
                          detailUrl: `/tournaments/${meta.generation}/${meta.id}/${year}`,
                          exists: true,
                        };
                      } catch (error) {
                        console.error(
                          `Error parsing year meta for ${year}:`,
                          error,
                        );
                      }
                    }
                  }

                  // 年度データがない場合はメタデータのみ返す
                  return {
                    meta,
                    yearMeta: {
                      year: 2024,
                      startDate: '',
                      endDate: '',
                      location: '',
                      status: 'unknown',
                    },
                    fullName: meta.name,
                    detailUrl: `/tournaments/${meta.generation}/${meta.id}`,
                    exists: true,
                  };
                }
              } catch (error) {
                console.error(`Error parsing meta.json at ${metaPath}:`, error);
              }
            }

            // サブディレクトリを再帰的に検索
            const result = findTournament(fullPath);
            if (result) return result;
          }
        }

        return null;
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
        return null;
      }
    };

    const result = findTournament(tournamentsDir);

    // 見つからない場合は、tournamentIdをそのまま表示名として使用（リンクなし）
    if (!result && tournamentId) {
      return {
        meta: {
          id: tournamentId,
          name: tournamentId,
          generation: 'unknown',
          categoryTypes: [],
          isMajorTitle: false,
        },
        yearMeta: {
          year: 2024,
          startDate: '',
          endDate: '',
          location: '',
          status: 'unknown',
        },
        fullName: tournamentId,
        detailUrl: '', // 存在しない場合は空のURL
        exists: false, // 存在しないことを明示
      };
    }

    return result;
  } catch (error) {
    console.error('getTournamentInfoSSR error:', error);
    return null;
  }
};

/**
 * マッチデータから完全な大会URLを生成する
 */
export const generateTournamentUrlFromMatch = (match: {
  tournament_name: string | null;
  tournament_generation: string | null;
  tournament_gender: string | null;
  tournament_category: string | null;
  tournament_year?: number | null; // TODO: データベースにカラム追加後に必須にする
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

  // tournament_nameからIDを推測（簡単なマッピング）
  const tournamentIdMapping: Record<string, string> = {
    全日本選手権: 'zennihon-championship',
    全日本社会人選手権: 'japan-business-championship',
    全日本インドア: 'zennihon-indoor',
    全日本ミックスダブルス: 'zennihon-mix-doubles',
    全日本シングルス: 'zennihon-singles',
    国際大会予選: 'international-qualifier',
    高校選手権: 'highschool-championship',
  };

  const tournamentId = match.tournament_name
    ? tournamentIdMapping[match.tournament_name]
    : null;

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
 * 大会IDから利用可能な年のリストを取得する
 */
export const getTournamentYearsSSR = async (
  tournamentId: string,
): Promise<number[]> => {
  // サーバーサイドでのみ実行
  if (typeof window !== 'undefined') {
    return [];
  }

  try {
    // Dynamic imports for server-side only
    const fs = await import('fs');
    const path = await import('path');

    const tournamentsDir = path.join(process.cwd(), 'data/tournaments');

    const findYears = (dir: string): number[] => {
      const years: number[] = [];

      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
          if (item.isDirectory()) {
            const itemPath = path.join(dir, item.name);

            // tournaments/[generation]/[tournamentId] の構造を探索
            if (fs.existsSync(path.join(itemPath, tournamentId))) {
              const tournamentPath = path.join(itemPath, tournamentId);
              const yearDirs = fs.readdirSync(tournamentPath, {
                withFileTypes: true,
              });

              for (const yearDir of yearDirs) {
                if (yearDir.isDirectory()) {
                  const year = parseInt(yearDir.name);
                  if (!isNaN(year) && year >= 2020 && year <= 2030) {
                    // meta.json が存在することを確認
                    const metaPath = path.join(
                      tournamentPath,
                      yearDir.name,
                      'meta.json',
                    );
                    if (fs.existsSync(metaPath)) {
                      years.push(year);
                    }
                  }
                }
              }
            } else {
              // 再帰的に探索
              years.push(...findYears(itemPath));
            }
          }
        }
      } catch {
        // エラーは無視して続行
      }

      return years;
    };

    const years = findYears(tournamentsDir);

    // 重複を除去して降順ソート（最新年が最初）
    return [...new Set(years)].sort((a, b) => b - a);
  } catch (error) {
    console.error('getTournamentYearsSSR error:', error);
    return [];
  }
};

/**
 * 複数の大会情報を効率的に取得する（動的データ読み込み）
 */
export const getTournamentInfosSSR = async (
  tournamentIds: string[],
): Promise<Record<string, TournamentInfo>> => {
  const results: Record<string, TournamentInfo> = {};

  // 重複を除去
  const uniqueIds = [...new Set(tournamentIds)];

  // 並列処理でパフォーマンス向上
  const promises = uniqueIds.map(async (id) => {
    const info = await getTournamentInfoSSR(id);
    if (info) {
      results[id] = info;
    }
    return { id, info };
  });

  try {
    await Promise.all(promises);
  } catch (error) {
    console.error('Error fetching tournament infos:', error);
  }

  return results;
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
