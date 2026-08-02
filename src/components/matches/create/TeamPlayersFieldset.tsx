import type { Dispatch, SetStateAction } from 'react';

import type { EntryOption, TeamFormState } from './types';

type TeamPlayersFieldsetProps = {
  teamKey: 'A' | 'B';
  teamLabel: string;
  team: TeamFormState;
  onTeamChange: Dispatch<SetStateAction<TeamFormState>>;
  isDoubles: boolean;
  entryOptions: EntryOption[];
  onApplyEntry: (option: EntryOption | null) => void;
  lastNameListId: string;
  firstNameListId: string;
};

const ACCENT_STYLES = {
  A: {
    wrapper: 'border-blue-200 bg-blue-50/40',
    heading: 'text-blue-800',
  },
  B: {
    wrapper: 'border-red-200 bg-red-50/40',
    heading: 'text-red-800',
  },
} as const;

const INPUT_CLASS = 'w-full rounded border p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1';

/**
 * チームA/チームBの選手入力フォーム。元は create.tsx にチームごと丸ごと重複していたJSXを共通化し、
 * チーム単位の色分け（A=青 / B=赤、他画面と同じ配色規約）を統一した。
 */
const TeamPlayersFieldset = ({
  teamKey,
  teamLabel,
  team,
  onTeamChange,
  isDoubles,
  entryOptions,
  onApplyEntry,
  lastNameListId,
  firstNameListId,
}: TeamPlayersFieldsetProps) => {
  const accent = ACCENT_STYLES[teamKey];
  const ringClass = teamKey === 'A' ? 'focus-visible:ring-blue-400' : 'focus-visible:ring-red-400';

  const updatePlayer1 = (field: keyof TeamFormState, value: string) => onTeamChange((current) => ({ ...current, [field]: value }));
  const updatePlayer2 = (field: keyof TeamFormState, value: string) => onTeamChange((current) => ({ ...current, [field]: value }));

  return (
    <div className={`rounded-lg border p-4 ${accent.wrapper}`}>
      <label className={`mb-3 block text-sm font-semibold ${accent.heading}`}>{teamLabel}</label>

      {entryOptions.length > 0 && (
        <div className="mb-3">
          <label className="mb-1 block text-xs text-emerald-700">エントリーから選択（自動入力）</label>
          <select
            value=""
            onChange={(e) => onApplyEntry(entryOptions.find((option) => String(option.entryNo) === e.target.value) ?? null)}
            className={`w-full rounded border border-emerald-300 bg-emerald-50 p-2 text-sm ${INPUT_CLASS} ${ringClass}`}
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

      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-600">エントリー番号</label>
        <input
          type="text"
          value={team.entry_number}
          onChange={(e) => updatePlayer1('entry_number', e.target.value)}
          className={`${INPUT_CLASS} ${ringClass}`}
          placeholder={`例: ${teamKey}001`}
        />
      </div>

      <div className="space-y-3">
        <div className="rounded border border-gray-200 bg-white p-3">
          <p className="mb-2 text-xs font-medium text-gray-600">選手1</p>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                value={team.player1_last_name}
                onChange={(e) => updatePlayer1('player1_last_name', e.target.value)}
                className={`${INPUT_CLASS} ${ringClass}`}
                placeholder="姓 *"
                list={lastNameListId}
              />
              <input
                type="text"
                required
                value={team.player1_first_name}
                onChange={(e) => updatePlayer1('player1_first_name', e.target.value)}
                className={`${INPUT_CLASS} ${ringClass}`}
                placeholder="名 *"
                list={firstNameListId}
              />
            </div>
            <input
              type="text"
              required
              value={team.player1_team_name}
              onChange={(e) => updatePlayer1('player1_team_name', e.target.value)}
              className={`${INPUT_CLASS} ${ringClass}`}
              placeholder="チーム名 * (例: 東京都立高校)"
            />
            <input
              type="text"
              value={team.player1_region}
              onChange={(e) => updatePlayer1('player1_region', e.target.value)}
              className={`${INPUT_CLASS} ${ringClass}`}
              placeholder="地域 (例: 東京都)"
            />
          </div>
        </div>

        {isDoubles && (
          <div className="rounded border border-gray-200 bg-white p-3">
            <p className="mb-2 text-xs font-medium text-gray-600">選手2</p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={team.player2_last_name}
                  onChange={(e) => updatePlayer2('player2_last_name', e.target.value)}
                  className={`${INPUT_CLASS} ${ringClass}`}
                  placeholder="姓 *"
                  list={lastNameListId}
                />
                <input
                  type="text"
                  required
                  value={team.player2_first_name}
                  onChange={(e) => updatePlayer2('player2_first_name', e.target.value)}
                  className={`${INPUT_CLASS} ${ringClass}`}
                  placeholder="名 *"
                  list={firstNameListId}
                />
              </div>
              <input
                type="text"
                required
                value={team.player2_team_name}
                onChange={(e) => updatePlayer2('player2_team_name', e.target.value)}
                className={`${INPUT_CLASS} ${ringClass}`}
                placeholder="チーム名 * (例: 神奈川県立高校)"
              />
              <input
                type="text"
                value={team.player2_region}
                onChange={(e) => updatePlayer2('player2_region', e.target.value)}
                className={`${INPUT_CLASS} ${ringClass}`}
                placeholder="地域 (例: 神奈川県)"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamPlayersFieldset;
