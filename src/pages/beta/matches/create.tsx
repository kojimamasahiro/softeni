import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { isDebugMode, isTestMode } from '../../../../lib/env';
import {
  getCategoryOptions,
  getTournamentCategoriesWithMeta,
  getTournamentOptions,
} from '../../../../lib/tournamentHelpers';

const CreateMatch = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    tournament_name: '',
    generation: '',
    gender: '',
    category: '',
    year: new Date().getFullYear(),
    round_name: '',
    best_of: 7,
  });

  // カテゴリからゲーム形式を判定する関数
  const getGameTypeFromCategory = (
    selectedCategory: string,
  ): 'singles' | 'doubles' | 'team' => {
    if (!selectedCategory || !categoryOptions.gameCategories) return 'singles';

    const category = categoryOptions.gameCategories.find(
      (cat) => cat.value === selectedCategory,
    );
    return (category?.value as 'singles' | 'doubles' | 'team') || 'singles';
  };

  // 優先度に基づいてデフォルト選択肢を決定する関数
  const getDefaultSelection = (
    options: { value: string; label: string }[],
    type: 'gender' | 'category',
  ) => {
    if (options.length === 0) return '';
    if (options.length === 1) return options[0].value;

    if (type === 'gender') {
      // 性別は「boys」(男子)があれば優先
      const boysOption = options.find((opt) => opt.value === 'boys');
      if (boysOption) return boysOption.value;
    } else if (type === 'category') {
      // ゲームカテゴリは「doubles」があれば優先
      const doublesOption = options.find((opt) => opt.value === 'doubles');
      if (doublesOption) return doublesOption.value;
    }

    // 優先選択肢がない場合は空文字（ユーザーに選択させる）
    return '';
  };
  const [teamA, setTeamA] = useState({
    entry_number: '',
    player1_last_name: '',
    player1_first_name: '',
    player1_team_name: '',
    player1_region: '',
    player2_last_name: '', // ダブルスの場合のみ
    player2_first_name: '', // ダブルスの場合のみ
    player2_team_name: '', // ダブルスの場合のみ
    player2_region: '', // ダブルスの場合のみ
  });
  const [teamB, setTeamB] = useState({
    entry_number: '',
    player1_last_name: '',
    player1_first_name: '',
    player1_team_name: '',
    player1_region: '',
    player2_last_name: '', // ダブルスの場合のみ
    player2_first_name: '', // ダブルスの場合のみ
    player2_team_name: '', // ダブルスの場合のみ
    player2_region: '', // ダブルスの場合のみ
  });
  const [tournamentOptions, setTournamentOptions] = useState<
    { id: string; name: string; year: number }[]
  >([]);
  const [categoryOptions, setCategoryOptions] = useState<{
    generations: { value: string; label: string }[];
    genders: { value: string; label: string }[];
    gameCategories: { value: string; label: string }[];
  }>({
    generations: [],
    genders: [],
    gameCategories: [],
  });

  const [creating, setCreating] = useState(false);

  // 大会データを取得
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const options = await getTournamentOptions();
        setTournamentOptions(options);
      } catch (error) {
        console.error('Failed to fetch tournament options:', error);
      }
    };

    if (isDebugMode()) {
      fetchTournaments();
    }
  }, []);

  // 大会選択時にカテゴリと年を取得
  useEffect(() => {
    const fetchCategories = async () => {
      if (!formData.tournament_name) {
        setCategoryOptions({
          generations: [],
          genders: [],
          gameCategories: [],
        });
        return;
      }

      try {
        const { categories: tournamentCategories, meta } =
          await getTournamentCategoriesWithMeta(formData.tournament_name);

        const options = getCategoryOptions(
          tournamentCategories,
          meta || undefined,
        );
        setCategoryOptions(options);

        // フォームのカテゴリ選択をリセット（年は大会選択時に既に設定済み）
        // 選択肢が1つしかない場合は自動選択、複数ある場合は優先度に基づいて選択
        setFormData((prev) => ({
          ...prev,
          generation:
            options.generations.length === 1
              ? options.generations[0].value
              : '',
          gender: getDefaultSelection(options.genders, 'gender'),
          category: getDefaultSelection(options.gameCategories, 'category'),
        }));
      } catch (error) {
        console.error('Failed to fetch tournament data:', error);
      }
    };

    fetchCategories();
  }, [formData.tournament_name]);

  // 開発環境でない場合はアクセス拒否
  if (!isDebugMode()) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">アクセス拒否</strong>
          <span className="block sm:inline ml-2">
            この機能は開発環境でのみ利用可能です。
          </span>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      // カテゴリ詳細からゲーム形式を取得
      const gameType = getGameTypeFromCategory(formData.category);

      // API用にフィールド名を変換
      // tournament_nameから年を除外してtournament_idとして使用
      const tournamentId = formData.tournament_name.replace(/-\d{4}$/, '');
      const apiData = {
        tournament_name: formData.tournament_name,
        tournament_id: tournamentId, // 年を除外したtournament_id
        tournament_generation: formData.generation,
        tournament_gender: formData.gender,
        tournament_category: formData.category,
        tournament_year: formData.year,
        round_name: formData.round_name,
        best_of: formData.best_of,
        game_type: gameType,

        // チームA詳細情報
        team_a_entry_number: teamA.entry_number,
        team_a_player1_last_name: teamA.player1_last_name,
        team_a_player1_first_name: teamA.player1_first_name,
        team_a_player1_team_name: teamA.player1_team_name,
        team_a_player1_region: teamA.player1_region,
        team_a_player2_last_name:
          gameType === 'doubles' ? teamA.player2_last_name : null,
        team_a_player2_first_name:
          gameType === 'doubles' ? teamA.player2_first_name : null,
        team_a_player2_team_name:
          gameType === 'doubles' ? teamA.player2_team_name : null,
        team_a_player2_region:
          gameType === 'doubles' ? teamA.player2_region : null,

        // チームB詳細情報
        team_b_entry_number: teamB.entry_number,
        team_b_player1_last_name: teamB.player1_last_name,
        team_b_player1_first_name: teamB.player1_first_name,
        team_b_player1_team_name: teamB.player1_team_name,
        team_b_player1_region: teamB.player1_region,
        team_b_player2_last_name:
          gameType === 'doubles' ? teamB.player2_last_name : null,
        team_b_player2_first_name:
          gameType === 'doubles' ? teamB.player2_first_name : null,
        team_b_player2_team_name:
          gameType === 'doubles' ? teamB.player2_team_name : null,
        team_b_player2_region:
          gameType === 'doubles' ? teamB.player2_region : null,

        // 構造化されたチームデータ
        teams: {
          A: {
            entry_number: teamA.entry_number,
            players: [
              {
                last_name: teamA.player1_last_name,
                first_name: teamA.player1_first_name,
                team_name: teamA.player1_team_name,
                region: teamA.player1_region,
              },
              ...(gameType === 'doubles'
                ? [
                    {
                      last_name: teamA.player2_last_name,
                      first_name: teamA.player2_first_name,
                      team_name: teamA.player2_team_name,
                      region: teamA.player2_region,
                    },
                  ]
                : []),
            ],
          },
          B: {
            entry_number: teamB.entry_number,
            players: [
              {
                last_name: teamB.player1_last_name,
                first_name: teamB.player1_first_name,
                team_name: teamB.player1_team_name,
                region: teamB.player1_region,
              },
              ...(gameType === 'doubles'
                ? [
                    {
                      last_name: teamB.player2_last_name,
                      first_name: teamB.player2_first_name,
                      team_name: teamB.player2_team_name,
                      region: teamB.player2_region,
                    },
                  ]
                : []),
            ],
          },
        },

        // 表示用（後方互換性のため）
        team_a:
          gameType === 'doubles'
            ? `${teamA.entry_number} ${teamA.player1_last_name} ${teamA.player1_first_name} (${teamA.player1_team_name}) [${teamA.player1_region}] / ${teamA.player2_last_name} ${teamA.player2_first_name} (${teamA.player2_team_name}) [${teamA.player2_region}]`
            : `${teamA.entry_number} ${teamA.player1_last_name} ${teamA.player1_first_name} (${teamA.player1_team_name}) [${teamA.player1_region}]`,
        team_b:
          gameType === 'doubles'
            ? `${teamB.entry_number} ${teamB.player1_last_name} ${teamB.player1_first_name} (${teamB.player1_team_name}) [${teamB.player1_region}] / ${teamB.player2_last_name} ${teamB.player2_first_name} (${teamB.player2_team_name}) [${teamB.player2_region}]`
            : `${teamB.entry_number} ${teamB.player1_last_name} ${teamB.player1_first_name} (${teamB.player1_team_name}) [${teamB.player1_region}]`,
      };

      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });

      const data = await response.json();

      if (response.ok) {
        // 作成されたマッチの入力ページへ遷移
        router.push(`/beta/matches/${data.match.id}/input`);
      } else {
        console.error('Failed to create match:', data.error);
      }
    } catch (error) {
      console.error('Error creating match:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">新しいマッチを作成</h1>
        {isTestMode() && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-1 rounded text-sm">
            テストモード
          </div>
        )}
      </div>

      {isTestMode() && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                テスト環境で実行中
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  このデータはテスト用データベースに保存されます。本番環境には影響しません。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">大会名</label>

          <div className="space-y-2">
            <div>
              <select
                required
                value={formData.tournament_name}
                onChange={(e) => {
                  const selectedTournament = tournamentOptions.find(
                    (option) => option.id === e.target.value,
                  );
                  setFormData({
                    ...formData,
                    tournament_name: e.target.value,
                    year: selectedTournament
                      ? selectedTournament.year
                      : new Date().getFullYear(),
                  });
                }}
                className="w-full border rounded p-2"
              >
                <option value="">大会を選択してください</option>
                {tournamentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* カテゴリ選択 */}
        {formData.tournament_name && (
          <div className="space-y-4 p-4 bg-gray-50 rounded">
            <h3 className="font-medium text-gray-700">カテゴリ詳細</h3>

            {/* 世代選択 */}
            {categoryOptions.generations.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">世代</label>
                <div className="space-y-2">
                  {categoryOptions.generations.map((gen) => (
                    <label key={gen.value} className="flex items-center">
                      <input
                        type="radio"
                        name="generation"
                        value={gen.value}
                        checked={formData.generation === gen.value}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            generation: e.target.value,
                          })
                        }
                        className="mr-2"
                      />
                      {gen.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 性別選択 */}
            {categoryOptions.genders.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">性別</label>
                <div className="space-y-2">
                  {categoryOptions.genders.map((gender) => (
                    <label key={gender.value} className="flex items-center">
                      <input
                        type="radio"
                        name="gender"
                        value={gender.value}
                        checked={formData.gender === gender.value}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            gender: e.target.value,
                          })
                        }
                        className="mr-2"
                      />
                      {gender.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ゲームカテゴリ選択 */}
            {categoryOptions.gameCategories.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  ゲームカテゴリ
                </label>
                <div className="space-y-2">
                  {categoryOptions.gameCategories.map((cat) => (
                    <label key={cat.value} className="flex items-center">
                      <input
                        type="radio"
                        name="category"
                        value={cat.value}
                        checked={formData.category === cat.value}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            category: e.target.value,
                          })
                        }
                        className="mr-2"
                      />
                      {cat.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">開催年</label>
          {formData.tournament_name ? (
            <div className="w-full border rounded p-2 bg-gray-100 text-gray-700">
              {formData.year}年 (大会データより自動設定)
            </div>
          ) : (
            <input
              type="number"
              required
              min="2020"
              max="2030"
              value={formData.year}
              onChange={(e) =>
                setFormData({ ...formData, year: parseInt(e.target.value) })
              }
              className="w-full border rounded p-2"
              placeholder="例: 2024"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">回戦</label>
          <select
            value={formData.round_name}
            onChange={(e) =>
              setFormData({ ...formData, round_name: e.target.value })
            }
            className="w-full border rounded p-2"
          >
            <option value="">回戦を選択してください（任意）</option>
            <option value="1回戦">1回戦</option>
            <option value="2回戦">2回戦</option>
            <option value="3回戦">3回戦</option>
            <option value="4回戦">4回戦</option>
            <option value="5回戦">5回戦</option>
            <option value="準々決勝">準々決勝</option>
            <option value="準決勝">準決勝</option>
            <option value="決勝">決勝</option>
            <option value="3位決定戦">3位決定戦</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-4">チームA</label>
          <div className="mb-4">
            <label className="block text-xs text-gray-600 mb-1">
              エントリー番号
            </label>
            <input
              type="text"
              value={teamA.entry_number}
              onChange={(e) =>
                setTeamA({ ...teamA, entry_number: e.target.value })
              }
              className="w-full border rounded p-2 text-sm"
              placeholder="例: A001"
            />
          </div>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <label className="block text-xs text-gray-600 mb-2">選手1</label>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={teamA.player1_last_name}
                    onChange={(e) =>
                      setTeamA({ ...teamA, player1_last_name: e.target.value })
                    }
                    className="border rounded p-2 text-sm"
                    placeholder="姓"
                  />
                  <input
                    type="text"
                    required
                    value={teamA.player1_first_name}
                    onChange={(e) =>
                      setTeamA({ ...teamA, player1_first_name: e.target.value })
                    }
                    className="border rounded p-2 text-sm"
                    placeholder="名"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={teamA.player1_team_name}
                  onChange={(e) =>
                    setTeamA({ ...teamA, player1_team_name: e.target.value })
                  }
                  className="w-full border rounded p-2 text-sm"
                  placeholder="チーム名 (例: 東京都立高校)"
                />
                <input
                  type="text"
                  value={teamA.player1_region}
                  onChange={(e) =>
                    setTeamA({ ...teamA, player1_region: e.target.value })
                  }
                  className="w-full border rounded p-2 text-sm"
                  placeholder="地域 (例: 東京都)"
                />
              </div>
            </div>

            {getGameTypeFromCategory(formData.category) === 'doubles' && (
              <div className="border-l-4 border-green-500 pl-4">
                <label className="block text-xs text-gray-600 mb-2">
                  選手2
                </label>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={teamA.player2_last_name}
                      onChange={(e) =>
                        setTeamA({
                          ...teamA,
                          player2_last_name: e.target.value,
                        })
                      }
                      className="border rounded p-2 text-sm"
                      placeholder="姓"
                    />
                    <input
                      type="text"
                      required
                      value={teamA.player2_first_name}
                      onChange={(e) =>
                        setTeamA({
                          ...teamA,
                          player2_first_name: e.target.value,
                        })
                      }
                      className="border rounded p-2 text-sm"
                      placeholder="名"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    value={teamA.player2_team_name}
                    onChange={(e) =>
                      setTeamA({ ...teamA, player2_team_name: e.target.value })
                    }
                    className="w-full border rounded p-2 text-sm"
                    placeholder="チーム名 (例: 神奈川県立高校)"
                  />
                  <input
                    type="text"
                    value={teamA.player2_region}
                    onChange={(e) =>
                      setTeamA({ ...teamA, player2_region: e.target.value })
                    }
                    className="w-full border rounded p-2 text-sm"
                    placeholder="地域 (例: 神奈川県)"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-4">チームB</label>
          <div className="mb-4">
            <label className="block text-xs text-gray-600 mb-1">
              エントリー番号
            </label>
            <input
              type="text"
              value={teamB.entry_number}
              onChange={(e) =>
                setTeamB({ ...teamB, entry_number: e.target.value })
              }
              className="w-full border rounded p-2 text-sm"
              placeholder="例: B001"
            />
          </div>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <label className="block text-xs text-gray-600 mb-2">選手1</label>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={teamB.player1_last_name}
                    onChange={(e) =>
                      setTeamB({ ...teamB, player1_last_name: e.target.value })
                    }
                    className="border rounded p-2 text-sm"
                    placeholder="姓"
                  />
                  <input
                    type="text"
                    required
                    value={teamB.player1_first_name}
                    onChange={(e) =>
                      setTeamB({ ...teamB, player1_first_name: e.target.value })
                    }
                    className="border rounded p-2 text-sm"
                    placeholder="名"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={teamB.player1_team_name}
                  onChange={(e) =>
                    setTeamB({ ...teamB, player1_team_name: e.target.value })
                  }
                  className="w-full border rounded p-2 text-sm"
                  placeholder="チーム名 (例: 大阪府立高校)"
                />
                <input
                  type="text"
                  value={teamB.player1_region}
                  onChange={(e) =>
                    setTeamB({ ...teamB, player1_region: e.target.value })
                  }
                  className="w-full border rounded p-2 text-sm"
                  placeholder="地域 (例: 大阪府)"
                />
              </div>
            </div>

            {getGameTypeFromCategory(formData.category) === 'doubles' && (
              <div className="border-l-4 border-green-500 pl-4">
                <label className="block text-xs text-gray-600 mb-2">
                  選手2
                </label>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={teamB.player2_last_name}
                      onChange={(e) =>
                        setTeamB({
                          ...teamB,
                          player2_last_name: e.target.value,
                        })
                      }
                      className="border rounded p-2 text-sm"
                      placeholder="姓"
                    />
                    <input
                      type="text"
                      required
                      value={teamB.player2_first_name}
                      onChange={(e) =>
                        setTeamB({
                          ...teamB,
                          player2_first_name: e.target.value,
                        })
                      }
                      className="border rounded p-2 text-sm"
                      placeholder="名"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    value={teamB.player2_team_name}
                    onChange={(e) =>
                      setTeamB({ ...teamB, player2_team_name: e.target.value })
                    }
                    className="w-full border rounded p-2 text-sm"
                    placeholder="チーム名 (例: 兵庫県立高校)"
                  />
                  <input
                    type="text"
                    value={teamB.player2_region}
                    onChange={(e) =>
                      setTeamB({ ...teamB, player2_region: e.target.value })
                    }
                    className="w-full border rounded p-2 text-sm"
                    placeholder="地域 (例: 兵庫県)"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">マッチ形式</label>
          <div className="space-y-2">
            {[
              { value: 3, label: '3ゲームマッチ' },
              { value: 5, label: '5ゲームマッチ' },
              { value: 7, label: '7ゲームマッチ' },
              { value: 9, label: '9ゲームマッチ' },
            ].map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  name="best_of"
                  value={option.value}
                  checked={formData.best_of === option.value}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      best_of: parseInt(e.target.value),
                    })
                  }
                  className="mr-2"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={creating}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
        >
          {creating ? 'マッチを作成中...' : 'マッチを作成して開始'}
        </button>
      </form>
    </div>
  );
};

export default CreateMatch;
