import type { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { hasLiveMatchApi } from '../../../../lib/betaMatchesClient';
import { isDebugMode, isTestMode } from '../../../../lib/env';
import { isScoreSiteMode } from '../../../../lib/siteConfig';
import { getCategoryOptions, TournamentCategory, TournamentMeta } from '../../../../lib/tournamentHelpers';

type TournamentOption = {
  id: string;
  name: string;
  year: number;
};

type TournamentCatalogEntry = {
  categories: TournamentCategory[];
  meta: TournamentMeta | null;
};

type EntryOption = {
  entryNo: number;
  label: string;
  players: {
    last_name: string;
    first_name: string;
    team_name: string;
    region: string;
  }[];
};

type KnownPlayer = {
  lastName: string;
  firstName: string;
};

type CreateMatchProps = {
  tournamentOptions: TournamentOption[];
  tournamentCatalog: Record<string, TournamentCatalogEntry>;
};

// 氏名の正規化（成長分析のキーと同じ規約: 前後空白除去＋連続空白を1つ＋小文字化）。
const normalizeNameText = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
// 空白を全て除いた緩いキー（「上岡俊介」と「上岡 俊介」を同一視するため）。
const looseNameKey = (lastName: string, firstName: string) => `${normalizeNameText(lastName)}${normalizeNameText(firstName)}`.replace(/\s+/g, '');

const CreateMatch = ({ tournamentOptions, tournamentCatalog }: CreateMatchProps) => {
  const router = useRouter();
  const canEditMatches = isDebugMode() && hasLiveMatchApi();
  // 氏名サジェスト・重複検知用の既知選手一覧。ページ props に同梱すると
  // 数百kBになるため、ビルド時生成の静的JSONをクライアントで遅延取得する。
  const [knownPlayers, setKnownPlayers] = useState<KnownPlayer[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/data/known-players.json')
      .then((response) => (response.ok ? response.json() : []))
      .then((data: KnownPlayer[]) => {
        if (!cancelled && Array.isArray(data)) setKnownPlayers(data);
      })
      .catch(() => {
        /* 取得失敗時はサジェスト無しで続行 */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [formData, setFormData] = useState({
    tournament_name: '',
    generation: '',
    gender: '',
    category: '',
    year: new Date().getFullYear(),
    round_name: '',
    best_of: 7,
    match_date: new Date().toISOString().slice(0, 10),
    court_name: '',
    opponent_level: 'unknown',
  });

  // カテゴリからゲーム形式を判定する関数
  const getGameTypeFromCategory = (selectedCategory: string): 'singles' | 'doubles' | 'team' => {
    if (!selectedCategory || !categoryOptions.gameCategories) return 'singles';

    const category = categoryOptions.gameCategories.find((cat) => cat.value === selectedCategory);
    return (category?.value as 'singles' | 'doubles' | 'team') || 'singles';
  };

  // 優先度に基づいてデフォルト選択肢を決定する関数
  const getDefaultSelection = (options: { value: string; label: string }[], type: 'gender' | 'category') => {
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

  // 掲載大会のエントリー候補（dev 専用 API から取得）。
  // 選択すると entry_number / 選手情報を自動入力し、siteLink の解決精度を上げる。
  // 仕様: docs/wiki/score-site-link.md
  const [entryOptions, setEntryOptions] = useState<EntryOption[]>([]);

  // 選択中カテゴリの categoryId（ファイル名規約 {category}-{age}-{gender}）を解決
  const currentCategoryId = (() => {
    const selected = tournamentCatalog[formData.tournament_name];
    if (!selected) return '';
    const matched = selected.categories.find((cat) => cat.category === formData.category && cat.gender === formData.gender);
    return matched?.id ?? '';
  })();

  // カテゴリ確定時にエントリー候補を取得
  useEffect(() => {
    if (!formData.tournament_name || !currentCategoryId) {
      setEntryOptions([]);
      return;
    }

    const tournamentId = formData.tournament_name.replace(/-\d{4}$/, '');
    let cancelled = false;

    fetch(`/api/tournament-entries?tournamentId=${encodeURIComponent(tournamentId)}&year=${formData.year}&categoryId=${encodeURIComponent(currentCategoryId)}`)
      .then((response) => (response.ok ? response.json() : { entries: [] }))
      .then((data) => {
        if (!cancelled) setEntryOptions(data.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntryOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [formData.tournament_name, formData.year, currentCategoryId]);

  // エントリー候補を選手フォームへ反映（手入力フィールドは編集可能なまま）
  const applyEntryToTeam = (side: 'A' | 'B', option: EntryOption | null) => {
    if (!option) return;
    const [p1, p2] = option.players;
    const nextTeam = {
      entry_number: String(option.entryNo),
      player1_last_name: p1?.last_name ?? '',
      player1_first_name: p1?.first_name ?? '',
      player1_team_name: p1?.team_name ?? '',
      player1_region: p1?.region ?? '',
      player2_last_name: p2?.last_name ?? '',
      player2_first_name: p2?.first_name ?? '',
      player2_team_name: p2?.team_name ?? '',
      player2_region: p2?.region ?? '',
    };
    if (side === 'A') {
      setTeamA(nextTeam);
    } else {
      setTeamB(nextTeam);
    }
  };

  // 大会選択時にカテゴリと年を取得
  useEffect(() => {
    const updateCategories = () => {
      if (!formData.tournament_name) {
        setCategoryOptions({
          generations: [],
          genders: [],
          gameCategories: [],
        });
        return;
      }

      const selected = tournamentCatalog[formData.tournament_name];
      const options = getCategoryOptions(selected?.categories ?? [], selected?.meta ?? undefined);
      setCategoryOptions(options);

      // フォームのカテゴリ選択をリセット（年は大会選択時に既に設定済み）
      // 選択肢が1つしかない場合は自動選択、複数ある場合は優先度に基づいて選択
      setFormData((prev) => ({
        ...prev,
        generation: options.generations.length === 1 ? options.generations[0].value : '',
        gender: getDefaultSelection(options.genders, 'gender'),
        category: getDefaultSelection(options.gameCategories, 'category'),
      }));
    };

    updateCategories();
  }, [formData.tournament_name, tournamentCatalog]);

  // 開発環境でない場合はアクセス拒否
  if (!canEditMatches) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">編集不可</strong>
          <span className="block sm:inline ml-2">このページは開発サーバーでのみ利用できます。静的公開環境ではマッチ作成はできません。</span>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 氏名の表記ゆれ（空白・大小）で既存選手と別キーになるのを防ぐ警告。
    // 完全一致する既存選手はそのまま、緩いキー（空白除去）が既存と一致する場合だけ確認する。
    // 新規選手（既存に似た名前が無い）は警告しない。
    const enteredGameType = getGameTypeFromCategory(formData.category);
    const enteredPlayers = [
      {
        lastName: teamA.player1_last_name,
        firstName: teamA.player1_first_name,
      },
      ...(enteredGameType === 'doubles'
        ? [
            {
              lastName: teamA.player2_last_name,
              firstName: teamA.player2_first_name,
            },
          ]
        : []),
      {
        lastName: teamB.player1_last_name,
        firstName: teamB.player1_first_name,
      },
      ...(enteredGameType === 'doubles'
        ? [
            {
              lastName: teamB.player2_last_name,
              firstName: teamB.player2_first_name,
            },
          ]
        : []),
    ];
    const knownExact = new Set(knownPlayers.map((p) => `${normalizeNameText(p.lastName)} ${normalizeNameText(p.firstName)}`));
    const knownLoose = new Map<string, string>();
    knownPlayers.forEach((p) => {
      knownLoose.set(looseNameKey(p.lastName, p.firstName), `${p.lastName} ${p.firstName}`);
    });
    const variantWarnings: string[] = [];
    for (const pl of enteredPlayers) {
      const last = pl.lastName.trim();
      const first = pl.firstName.trim();
      if (!last || !first) continue;
      const exact = `${normalizeNameText(last)} ${normalizeNameText(first)}`;
      if (knownExact.has(exact)) continue;
      const match = knownLoose.get(looseNameKey(last, first));
      if (match) {
        variantWarnings.push(`「${last} ${first}」は既存選手「${match}」の表記ゆれの可能性があります`);
      }
    }
    if (variantWarnings.length > 0) {
      const proceed = window.confirm(`${variantWarnings.join('\n')}\n\nこのまま作成しますか？（別人なら OK、表記を直すならキャンセル）`);
      if (!proceed) return;
    }

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
        match_date: formData.match_date || null,
        court_name: formData.court_name || null,
        status: 'in_progress',
        opponent_level: formData.opponent_level,
        source_site_match_id: null,
        source_site_tournament_id: tournamentId,

        // チームA詳細情報
        team_a_entry_number: teamA.entry_number,
        team_a_player1_last_name: teamA.player1_last_name,
        team_a_player1_first_name: teamA.player1_first_name,
        team_a_player1_team_name: teamA.player1_team_name,
        team_a_player1_region: teamA.player1_region,
        team_a_player2_last_name: gameType === 'doubles' ? teamA.player2_last_name : null,
        team_a_player2_first_name: gameType === 'doubles' ? teamA.player2_first_name : null,
        team_a_player2_team_name: gameType === 'doubles' ? teamA.player2_team_name : null,
        team_a_player2_region: gameType === 'doubles' ? teamA.player2_region : null,

        // チームB詳細情報
        team_b_entry_number: teamB.entry_number,
        team_b_player1_last_name: teamB.player1_last_name,
        team_b_player1_first_name: teamB.player1_first_name,
        team_b_player1_team_name: teamB.player1_team_name,
        team_b_player1_region: teamB.player1_region,
        team_b_player2_last_name: gameType === 'doubles' ? teamB.player2_last_name : null,
        team_b_player2_first_name: gameType === 'doubles' ? teamB.player2_first_name : null,
        team_b_player2_team_name: gameType === 'doubles' ? teamB.player2_team_name : null,
        team_b_player2_region: gameType === 'doubles' ? teamB.player2_region : null,

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
      const contentType = response.headers.get('content-type') ?? '';
      const data = contentType.includes('application/json') ? await response.json() : null;

      if (response.ok && data?.match?.id) {
        const startGameResponse = await fetch(`/api/matches/${data.match.id}/games`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game_number: 1,
          }),
        });
        const startGameContentType = startGameResponse.headers.get('content-type') ?? '';
        const startGameData = startGameContentType.includes('application/json') ? await startGameResponse.json() : null;

        if (startGameResponse.ok) {
          // 作成されたマッチの入力ページへ遷移
          router.push(`/beta/matches/${data.match.id}/input`);
        } else {
          const errorMessage = startGameData?.error ?? '第1ゲームの開始に失敗しました。マッチは作成済みです。';
          console.error('Failed to start first game:', errorMessage);
          alert(errorMessage);
        }
      } else {
        const errorMessage = data?.error ?? 'マッチ作成に失敗しました。API から JSON を取得できませんでした。';
        console.error('Failed to create match:', errorMessage);
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error creating match:', error);
      alert('マッチ作成中にエラーが発生しました。');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">新しいマッチを作成</h1>
        {isTestMode() && <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-1 rounded text-sm">テストモード</div>}
      </div>

      {isTestMode() && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">テスト環境で実行中</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>このデータはテスト用データベースに保存されます。本番環境には影響しません。</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 氏名サジェスト用（表記ゆれ防止・成長キーの分裂を防ぐ） */}
        <datalist id="known-last-names">
          {Array.from(new Set(knownPlayers.map((p) => p.lastName)))
            .filter(Boolean)
            .map((lastName) => (
              <option key={`ln-${lastName}`} value={lastName} />
            ))}
        </datalist>
        <datalist id="known-first-names">
          {Array.from(new Set(knownPlayers.map((p) => p.firstName)))
            .filter(Boolean)
            .map((firstName) => (
              <option key={`fn-${firstName}`} value={firstName} />
            ))}
        </datalist>
        <div>
          <label className="block text-sm font-medium mb-2">大会名</label>

          <div className="space-y-2">
            <div>
              <select
                required
                value={formData.tournament_name}
                onChange={(e) => {
                  const selectedTournament = tournamentOptions.find((option) => option.id === e.target.value);
                  setFormData({
                    ...formData,
                    tournament_name: e.target.value,
                    year: selectedTournament ? selectedTournament.year : new Date().getFullYear(),
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
                <label className="block text-sm font-medium mb-2">ゲームカテゴリ</label>
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
            <div className="w-full border rounded p-2 bg-gray-100 text-gray-700">{formData.year}年 (大会データより自動設定)</div>
          ) : (
            <input
              type="number"
              required
              min="2020"
              max="2030"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              className="w-full border rounded p-2"
              placeholder="例: 2024"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">回戦</label>
          <select value={formData.round_name} onChange={(e) => setFormData({ ...formData, round_name: e.target.value })} className="w-full border rounded p-2">
            <option value="">回戦を選択してください（任意）</option>
            <option value="1回戦">1回戦</option>
            <option value="2回戦">2回戦</option>
            <option value="3回戦">3回戦</option>
            <option value="4回戦">4回戦</option>
            <option value="5回戦">5回戦</option>
            <option value="6回戦">6回戦</option>
            <option value="準々決勝">準々決勝</option>
            <option value="準決勝">準決勝</option>
            <option value="決勝">決勝</option>
            <option value="3位決定戦">3位決定戦</option>
          </select>
        </div>

        <div className="grid gap-4 rounded border border-gray-200 bg-gray-50 p-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-2">試合日</label>
            <input
              type="date"
              value={formData.match_date}
              onChange={(e) => setFormData({ ...formData, match_date: e.target.value })}
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">コート</label>
            <input
              type="text"
              value={formData.court_name}
              onChange={(e) => setFormData({ ...formData, court_name: e.target.value })}
              className="w-full border rounded p-2"
              placeholder="例: 第1コート"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">相手レベル</label>
            <select
              value={formData.opponent_level}
              onChange={(e) => setFormData({ ...formData, opponent_level: e.target.value })}
              className="w-full border rounded p-2"
            >
              <option value="unknown">不明</option>
              <option value="stronger">格上</option>
              <option value="same">同格</option>
              <option value="weaker">格下</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-4">チームA</label>
          {entryOptions.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs text-emerald-700 mb-1">エントリーから選択（自動入力）</label>
              <select
                value=""
                onChange={(e) => applyEntryToTeam('A', entryOptions.find((option) => String(option.entryNo) === e.target.value) ?? null)}
                className="w-full border border-emerald-300 rounded p-2 text-sm bg-emerald-50"
              >
                <option value="">エントリーを選択…</option>
                {entryOptions.map((option) => (
                  <option key={option.entryNo} value={option.entryNo}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mb-4">
            <label className="block text-xs text-gray-600 mb-1">エントリー番号</label>
            <input
              type="text"
              value={teamA.entry_number}
              onChange={(e) => setTeamA({ ...teamA, entry_number: e.target.value })}
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
                    onChange={(e) => setTeamA({ ...teamA, player1_last_name: e.target.value })}
                    className="border rounded p-2 text-sm"
                    placeholder="姓"
                    list="known-last-names"
                  />
                  <input
                    type="text"
                    required
                    value={teamA.player1_first_name}
                    onChange={(e) => setTeamA({ ...teamA, player1_first_name: e.target.value })}
                    className="border rounded p-2 text-sm"
                    placeholder="名"
                    list="known-first-names"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={teamA.player1_team_name}
                  onChange={(e) => setTeamA({ ...teamA, player1_team_name: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                  placeholder="チーム名 (例: 東京都立高校)"
                />
                <input
                  type="text"
                  value={teamA.player1_region}
                  onChange={(e) => setTeamA({ ...teamA, player1_region: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                  placeholder="地域 (例: 東京都)"
                />
              </div>
            </div>

            {getGameTypeFromCategory(formData.category) === 'doubles' && (
              <div className="border-l-4 border-green-500 pl-4">
                <label className="block text-xs text-gray-600 mb-2">選手2</label>
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
                    onChange={(e) => setTeamA({ ...teamA, player2_team_name: e.target.value })}
                    className="w-full border rounded p-2 text-sm"
                    placeholder="チーム名 (例: 神奈川県立高校)"
                  />
                  <input
                    type="text"
                    value={teamA.player2_region}
                    onChange={(e) => setTeamA({ ...teamA, player2_region: e.target.value })}
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
          {entryOptions.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs text-emerald-700 mb-1">エントリーから選択（自動入力）</label>
              <select
                value=""
                onChange={(e) => applyEntryToTeam('B', entryOptions.find((option) => String(option.entryNo) === e.target.value) ?? null)}
                className="w-full border border-emerald-300 rounded p-2 text-sm bg-emerald-50"
              >
                <option value="">エントリーを選択…</option>
                {entryOptions.map((option) => (
                  <option key={option.entryNo} value={option.entryNo}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mb-4">
            <label className="block text-xs text-gray-600 mb-1">エントリー番号</label>
            <input
              type="text"
              value={teamB.entry_number}
              onChange={(e) => setTeamB({ ...teamB, entry_number: e.target.value })}
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
                    onChange={(e) => setTeamB({ ...teamB, player1_last_name: e.target.value })}
                    className="border rounded p-2 text-sm"
                    placeholder="姓"
                    list="known-last-names"
                  />
                  <input
                    type="text"
                    required
                    value={teamB.player1_first_name}
                    onChange={(e) => setTeamB({ ...teamB, player1_first_name: e.target.value })}
                    className="border rounded p-2 text-sm"
                    placeholder="名"
                    list="known-first-names"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={teamB.player1_team_name}
                  onChange={(e) => setTeamB({ ...teamB, player1_team_name: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                  placeholder="チーム名 (例: 大阪府立高校)"
                />
                <input
                  type="text"
                  value={teamB.player1_region}
                  onChange={(e) => setTeamB({ ...teamB, player1_region: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                  placeholder="地域 (例: 大阪府)"
                />
              </div>
            </div>

            {getGameTypeFromCategory(formData.category) === 'doubles' && (
              <div className="border-l-4 border-green-500 pl-4">
                <label className="block text-xs text-gray-600 mb-2">選手2</label>
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
                    onChange={(e) => setTeamB({ ...teamB, player2_team_name: e.target.value })}
                    className="w-full border rounded p-2 text-sm"
                    placeholder="チーム名 (例: 兵庫県立高校)"
                  />
                  <input
                    type="text"
                    value={teamB.player2_region}
                    onChange={(e) => setTeamB({ ...teamB, player2_region: e.target.value })}
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

        <button type="submit" disabled={creating} className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-gray-300">
          {creating ? 'マッチを作成中...' : 'マッチを作成して開始'}
        </button>
      </form>
    </div>
  );
};

export default CreateMatch;

export const getStaticProps: GetStaticProps<CreateMatchProps> = async () => {
  if (isScoreSiteMode()) {
    return { notFound: true };
  }

  const fs = await import('fs');
  const path = await import('path');

  const tournamentsRoot = path.join(process.cwd(), 'data', 'tournaments');
  const detailsRoot = path.join(tournamentsRoot, 'details');
  const informationRoot = path.join(tournamentsRoot, 'information');

  const tournamentOptions: TournamentOption[] = [];
  const tournamentCatalog: Record<string, TournamentCatalogEntry> = {};

  try {
    // 大会の世代(generation)は data/tournaments/{generation}/{tournamentId}/meta.json という
    // 旧構造から取得していたが、このディレクトリ構造は data/tournaments/index.json
    // (+ local_index.json) ベースの新構造に移行済みで、旧パスは既に存在しない。
    // 旧パスのまま参照し続けると meta が常に null になり、getCategoryOptions() が
    // generation の選択肢をカテゴリの age から誤って導出してしまう
    // (例: zennihon-singles の age は常に "none" のため generation も "none" になる) ため、
    // 新構造の index.json / local_index.json から generationId を引く。
    const tournamentMetaMap = new Map<string, TournamentMeta>();
    const indexPath = path.join(tournamentsRoot, 'index.json');
    const localIndexPath = path.join(tournamentsRoot, 'local_index.json');

    type TournamentIndexEntry = {
      tournamentId: string;
      generationId: string;
      label: string;
      isMajorTitle: boolean;
      officialUrl?: string;
    };

    const readIndexEntries = (filePath: string): TournamentIndexEntry[] => {
      if (!fs.existsSync(filePath)) {
        return [];
      }
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TournamentIndexEntry[];
    };

    const indexEntries = [...readIndexEntries(indexPath), ...readIndexEntries(localIndexPath)];

    for (const entry of indexEntries) {
      tournamentMetaMap.set(entry.tournamentId, {
        id: entry.tournamentId,
        name: entry.label,
        generation: entry.generationId,
        categoryTypes: [],
        isMajorTitle: entry.isMajorTitle ?? false,
        officialUrl: entry.officialUrl,
      });
    }

    const informationMap = new Map<
      string,
      Array<{
        year: number;
        label?: string;
        categories?: Array<{
          categoryId: string;
          label: string;
          category: string;
          gender: string;
          age: string;
        }>;
      }>
    >();

    if (fs.existsSync(informationRoot)) {
      const informationFiles = fs.readdirSync(informationRoot).filter((fileName) => fileName.endsWith('.json'));

      for (const fileName of informationFiles) {
        const tournamentId = path.basename(fileName, '.json');
        const entries = JSON.parse(fs.readFileSync(path.join(informationRoot, fileName), 'utf8')) as Array<{
          year: number;
          label?: string;
          categories?: Array<{
            categoryId: string;
            label: string;
            category: string;
            gender: string;
            age: string;
          }>;
        }>;
        informationMap.set(tournamentId, entries);
      }
    }

    const buildCategoriesFromFileNames = (fileNames: string[]) => {
      const categoryMap = new Map<string, TournamentCategory>();

      for (const fileName of fileNames) {
        const categoryId = fileName.replace(/\.json$/, '');
        const [category = '', age = 'none', gender = ''] = categoryId.split('-');

        categoryMap.set(categoryId, {
          id: categoryId,
          label: categoryId,
          category,
          gender,
          age,
        });
      }

      return Array.from(categoryMap.values());
    };

    if (fs.existsSync(detailsRoot)) {
      const tournamentDirs = fs
        .readdirSync(detailsRoot, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

      for (const tournamentDir of tournamentDirs) {
        const tournamentId = tournamentDir.name;
        const tournamentPath = path.join(detailsRoot, tournamentId);
        const meta = tournamentMetaMap.get(tournamentId) ?? null;
        const informationEntries = informationMap.get(tournamentId) ?? [];

        const yearDirs = fs
          .readdirSync(tournamentPath, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
          .map((dirent) => dirent.name)
          .sort((a, b) => Number(b) - Number(a));

        for (const yearDir of yearDirs) {
          const year = Number(yearDir);
          const optionId = `${tournamentId}-${year}`;
          const detailYearPath = path.join(tournamentPath, yearDir);
          const detailFiles = fs.readdirSync(detailYearPath).filter((fileName) => fileName.endsWith('.json'));

          if (detailFiles.length === 0) {
            continue;
          }

          const informationEntry = informationEntries.find((entry) => entry.year === year);
          const categories = informationEntry?.categories?.length
            ? informationEntry.categories.map((category) => ({
                id: category.categoryId,
                label: category.label,
                category: category.category,
                gender: category.gender,
                age: category.age,
              }))
            : buildCategoriesFromFileNames(detailFiles);

          const displayName = informationEntry?.label ?? meta?.name ?? tournamentId;

          tournamentOptions.push({
            id: optionId,
            name: `${displayName} ${year}`,
            year,
          });

          tournamentCatalog[optionId] = {
            categories,
            meta,
          };
        }
      }
    }
  } catch (error) {
    console.error('Failed to build tournament options for beta matches:', error);
  }

  return {
    props: {
      tournamentOptions,
      tournamentCatalog,
    },
  };
};
