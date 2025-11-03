import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { isDebugMode } from '../../../../lib/env';
import {
  getCategoryOptions,
  getTournamentCategories,
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
    team_a: '',
    team_b: '',
    best_of: 7,
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
  const [isCustomTournament, setIsCustomTournament] = useState(false);

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
      if (!formData.tournament_name || isCustomTournament) {
        setCategoryOptions({
          generations: [],
          genders: [],
          gameCategories: [],
        });
        return;
      }

      try {
        const tournamentCategories = await getTournamentCategories(
          formData.tournament_name,
        );

        const options = getCategoryOptions(tournamentCategories);
        setCategoryOptions(options);

        // フォームのカテゴリ選択をリセット（年は大会選択時に既に設定済み）
        // 選択肢が1つしかない場合は自動選択
        setFormData((prev) => ({
          ...prev,
          generation:
            options.generations.length === 1
              ? options.generations[0].value
              : '',
          gender: options.genders.length === 1 ? options.genders[0].value : '',
          category:
            options.gameCategories.length === 1
              ? options.gameCategories[0].value
              : '',
        }));
      } catch (error) {
        console.error('Failed to fetch tournament data:', error);
      }
    };

    fetchCategories();
  }, [formData.tournament_name, isCustomTournament]);

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
      // API用にフィールド名を変換
      const apiData = {
        tournament_name: formData.tournament_name,
        tournament_generation: formData.generation,
        tournament_gender: formData.gender,
        tournament_category: formData.category,
        tournament_year: formData.year,
        round_name: formData.round_name,
        team_a: formData.team_a,
        team_b: formData.team_b,
        best_of: formData.best_of,
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
      <h1 className="text-2xl font-bold mb-6">新しいマッチを作成</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">大会名</label>

          {/* 既存大会から選択 or カスタム入力 */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="tournamentType"
                  checked={!isCustomTournament}
                  onChange={() => setIsCustomTournament(false)}
                  className="mr-2"
                />
                既存大会から選択
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="tournamentType"
                  checked={isCustomTournament}
                  onChange={() => setIsCustomTournament(true)}
                  className="mr-2"
                />
                カスタム入力
              </label>
            </div>

            {!isCustomTournament ? (
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
            ) : (
              <input
                type="text"
                required
                value={formData.tournament_name}
                onChange={(e) =>
                  setFormData({ ...formData, tournament_name: e.target.value })
                }
                className="w-full border rounded p-2"
                placeholder="例: 全国高等学校ソフトテニス選手権大会"
              />
            )}
          </div>
        </div>

        {/* カテゴリ選択（既存大会選択時のみ） */}
        {!isCustomTournament && formData.tournament_name && (
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
          {!isCustomTournament && formData.tournament_name ? (
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
          <label className="block text-sm font-medium mb-2">チームA</label>
          <input
            type="text"
            required
            value={formData.team_a}
            onChange={(e) =>
              setFormData({ ...formData, team_a: e.target.value })
            }
            className="w-full border rounded p-2"
            placeholder="例: 東京都立高校"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">チームB</label>
          <input
            type="text"
            required
            value={formData.team_b}
            onChange={(e) =>
              setFormData({ ...formData, team_b: e.target.value })
            }
            className="w-full border rounded p-2"
            placeholder="例: 大阪府立高校"
          />
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
