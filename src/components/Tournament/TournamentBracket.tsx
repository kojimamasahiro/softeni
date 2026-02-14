// components/Tournament/TournamentBracket.tsx

import { useMemo, useState } from 'react';

import { TournamentDetailData, TournamentMatch } from '@/types/index';

interface TournamentBracketProps {
  detailData: TournamentDetailData;
}

// 利用可能な試合に基づいてトーナメント表を動的に構築
// バイや欠場試合がある場合でも整列を確保するための標準木アプローチを使用
function buildBracket(matches: TournamentMatch[]): {
  rounds: string[];
  entriesByRound: Map<string, (number | null)[]>;
  defaultStartRound: string;
} {
  // 1. Strict Filter for Knockout
  const knockoutMatches = matches.filter((m) => m.stage === 'knockout');

  if (knockoutMatches.length === 0) {
    return { rounds: [], entriesByRound: new Map(), defaultStartRound: '' };
  }

  const entriesByRound = new Map<string, (number | null)[]>();

  // 2. Identify the Root (Final)
  // 他の試合の 'prevMatchId' としてリストされていない試合を見つける
  // または、nextMatchId が設定されている場合、nextMatchId を持たないものを探す方が通常安全
  // nextMatchId を使用する
  let finalMatch = knockoutMatches.find((m) => !m.nextMatchId);

  // フォールバック: 複数ある場合（例: 3位決定戦？）、'決勝' ラウンド名を持つものを選ぶ（利用可能な場合）
  const finals = knockoutMatches.filter((m) => !m.nextMatchId);
  if (finals.length > 1) {
    const namedFinal = finals.find((m) => m.round === '決勝');
    if (namedFinal) finalMatch = namedFinal;
  }

  if (!finalMatch) {
    // 奇妙なデータに対するフォールバック: 1つを選ぶか、空を返すか？
    // 循環または破損データの場合、起こり得る。
    // ロジックが失敗した場合、最初のものをルートと仮定する。
    finalMatch = knockoutMatches[0];
  }

  // 3. Tree Traversal to assign Canonical Slots
  // 座標: (DistanceFromFinal, IndexInLayer)
  // Final = (0, 0)
  // (D, I) への入力は (D+1, I*2) と (D+1, I*2+1)

  // Map: RoundName -> Distance
  const roundToDist = new Map<string, number>();
  // Map: Distance -> Array of Match/Null
  // スロットに Match オブジェクトを格納する。
  // (D, I) に試合が存在する場合、それを格納する。
  const treeGrid = new Map<number, Map<number, TournamentMatch>>();

  // MatchID を Match にマップする必要がある（簡単な検索のため）
  const matchMap = new Map<string, TournamentMatch>();
  knockoutMatches.forEach((m) => matchMap.set(m.matchId, m));

  // 再帰的フィル
  // Root からトラバースする。
  // (dist, index) にある試合 M に対して:
  //   - 入力を決定する。
  //   - Input 0 (Top) は prevMatchIds から来る？
  //     どの prevMatch が Top と Bottom かを知る必要がある。
  //     仮定: M.entries[0] は PrevMatchTop の勝者。
  //     M.entries[1] は PrevMatchBottom の勝者。

  let maxDist = 0;

  const traverse = (match: TournamentMatch, dist: number, index: number) => {
    if (dist > maxDist) maxDist = dist;
    if (match.round) roundToDist.set(match.round, dist);

    // Register this match in the grid
    if (!treeGrid.has(dist)) treeGrid.set(dist, new Map());
    treeGrid.get(dist)!.set(index, match);

    // Find predecessors
    // Slot 0 (Top) -> entries[0]
    const entry0 = match.entries[0];
    // Find the match where winnerEntryNo === entry0
    // (And that match must be in knockout list)
    // Optimization: Pre-calculate "WinnerOf" map?
    // Or just search. N is small (~100 max).

    const prevMatch0 = knockoutMatches.find(
      (m) => m.winnerEntryNo === entry0 && m.nextMatchId === match.matchId,
    );
    // 注意: nextMatchId のチェックはグループ試合や以前のトーナメントから保護する。
    // しかし、厳密な 'knockout' 試合のフィルタリングで通常十分。

    if (prevMatch0) {
      traverse(prevMatch0, dist + 1, index * 2);
    }

    // Slot 1 (Bottom) -> entries[1]
    if (match.entries.length > 1) {
      const entry1 = match.entries[1];
      const prevMatch1 = knockoutMatches.find(
        (m) => m.winnerEntryNo === entry1 && m.nextMatchId === match.matchId,
      );
      if (prevMatch1) {
        traverse(prevMatch1, dist + 1, index * 2 + 1);
      }
    }
  };

  if (finalMatch) {
    traverse(finalMatch, 0, 0);
  }

  // 4. Flatten Grid to entriesByRound
  // dist を Max から 0 まで反復する。
  // 各 dist について、有効なインデックスは 0 から 2^dist - 1？
  // いいえ。
  // Dist 0 (Final): 1 試合 (Index 0). Entries: 0, 1.
  // Dist 1 (Semi): 2 試合 (Ind 0, 1). Entries: 0,1 , 2,3.
  // Dist k: Matches 0 .. 2^k - 1. Entries 0 .. 2^(k+1) - 1.

  // `roundToDist` を使用して、どのラウンド名がどの距離に対応するかを決定する。
  // 逆マップ: Distance -> RoundName
  const distToRound = new Map<number, string>();
  roundToDist.forEach((d, r) => {
    // 複数のラウンドが同じ距離にマップされる場合（まれ）、1つを選ぶ。
    // 通常安全。
    if (!distToRound.has(d)) distToRound.set(d, r);
  });

  const sortedRounds: string[] = [];

  // 0 (Final) から MaxDist (First Round) までを入力
  // この方向により、シードを伝播できる（親ラウンドでエントリーされたがこのラウンドで試合がないプレイヤー）
  for (let d = 0; d <= maxDist; d++) {
    const roundName = distToRound.get(d);
    if (!roundName) continue; // Should have a name if matches exist

    // We want rounds ordered R1, R2... Final
    // Since we iterate Final -> R1 (0 -> Max), we unshift to reverse order
    sortedRounds.unshift(roundName);

    const layerMatches = treeGrid.get(d);
    const slotsCount = Math.pow(2, d); // Number of Matches
    const entriesCount = slotsCount * 2;

    const entriesArray: (number | null)[] = new Array(entriesCount).fill(null);

    for (let mIdx = 0; mIdx < slotsCount; mIdx++) {
      const match = layerMatches?.get(mIdx);
      if (match) {
        entriesArray[mIdx * 2] = match.entries[0];
        if (match.entries.length > 1)
          entriesArray[mIdx * 2 + 1] = match.entries[1];
      } else {
        // No match. Check for seed propagation from PARENT round (d - 1)
        if (d > 0) {
          const parentRoundName = distToRound.get(d - 1);
          if (parentRoundName) {
            const parentEntries = entriesByRound.get(parentRoundName);
            if (parentEntries) {
              const parentMatchIdx = Math.floor(mIdx / 2);
              // Even mIdx maps to Top slot (0) of parent match
              // Odd mIdx maps to Bottom slot (1) of parent match
              const parentSlot = parentMatchIdx * 2 + (mIdx % 2);
              const val = parentEntries[parentSlot];
              if (val !== null && val !== undefined) {
                // Propagate the entry
                entriesArray[mIdx * 2] = val;
                // Leave the partner slot null (Bye)
              }
            }
          }
        }
      }
    }

    entriesByRound.set(roundName, entriesArray);
  }

  // 5. Champion Column
  // 同じロジック: Final (0, 0) の勝者をチェック
  if (finalMatch && finalMatch.winnerEntryNo !== undefined) {
    entriesByRound.set('優勝', [finalMatch.winnerEntryNo]);
    sortedRounds.push('優勝');
  } else if (sortedRounds.length > 0) {
    // 不明でも列を追加するか？ プレースホルダーかも。
    entriesByRound.set('優勝', [-1]);
    sortedRounds.push('優勝');
  }

  // デフォルト開始ラウンドを計算（下から4番目、'優勝' を除く）
  const selectableRounds = sortedRounds.filter((r) => r !== '優勝');
  const defaultIndex = Math.max(0, selectableRounds.length - 4);
  const defaultStartRound = selectableRounds[defaultIndex] || '';

  return {
    rounds: sortedRounds,
    entriesByRound,
    defaultStartRound,
  };
}

export default function TournamentBracket({
  detailData,
}: TournamentBracketProps) {
  const { participants, entries, matches } = detailData;

  const { rounds, entriesByRound, defaultStartRound } = useMemo(
    () => buildBracket(matches),
    [matches],
  );

  const [startRound, setStartRound] = useState<string>(defaultStartRound);

  const displayedRounds = useMemo(() => {
    if (!startRound) return rounds;

    // Find index of start round
    const startIndex = rounds.indexOf(startRound);
    if (startIndex === -1) return rounds;

    return rounds.slice(startIndex);
  }, [rounds, startRound]);

  if (rounds.length === 0) {
    return null;
  }

  const ENTRY_HEIGHT = 34;
  const ROUND_GAP = 20; // Reduced to make connection lines shorter

  // ラウンドごとのエントリー -> 勝者ステータスのマップを構築
  const winnerMap = new Map<string, number>();
  matches
    .filter((m) => m.stage === 'knockout')
    .forEach((match) => {
      if (match.round) {
        winnerMap.set(`${match.round}-${match.matchId}`, match.winnerEntryNo);
      }
    });

  return (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-4 px-1">
        <h2 className="text-lg font-bold">トーナメント表</h2>

        {/* ラウンドセレクター */}
        {rounds.length > 1 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="round-select"
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              表示開始:
            </label>
            <select
              id="round-select"
              value={startRound}
              onChange={(e) => setStartRound(e.target.value)}
              className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            >
              {rounds
                .filter((r) => r !== '優勝') // 優勝ラインから開始することを許可しない
                .map((r) => (
                  <option key={r} value={r}>
                    {r}から
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      <div className="overflow-x-auto overflow-y-visible pb-4">
        <div className="relative inline-flex" style={{ gap: `${ROUND_GAP}px` }}>
          {displayedRounds.map((roundName, roundIndex) => {
            const roundEntries = entriesByRound.get(roundName) || [];
            const spacingMultiplier = Math.pow(2, roundIndex);

            // 表示に対する最初のラウンドでボックスを表示
            const showBoxes = roundIndex === 0;
            // 優勝ラウンドの特別処理（ただの線）
            const isChampionRound = roundName === '優勝';

            return (
              <div key={roundName} className="flex flex-col">
                {/* エントリーまたは接続ポイント */}
                <div
                  className="flex flex-col"
                  style={{
                    gap: `${ENTRY_HEIGHT * (spacingMultiplier - 1)}px`,
                    paddingTop: `${(ENTRY_HEIGHT * (spacingMultiplier - 1)) / 2}px`,
                  }}
                >
                  {roundEntries.map((entryNo, index) => {
                    if (isChampionRound) {
                      // 勝者がいるかどうかで色を決定
                      // entryNo は勝者の ID または -1 または null
                      const hasWinner = entryNo !== null && entryNo !== -1;
                      return (
                        <div
                          key={`champion-${index}`}
                          className="relative flex items-center"
                          style={{ height: `${ENTRY_HEIGHT}px` }}
                        >
                          <div
                            className={`h-px w-10 ${hasWinner ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'}`}
                          />
                        </div>
                      );
                    }

                    // NULL エントリを処理（バイ/プレースホルダー）
                    if (entryNo === null) {
                      return (
                        <div
                          key={`${roundName}-empty-${index}`}
                          className="relative invisible"
                          style={{ height: `${ENTRY_HEIGHT}px` }}
                        >
                          {/* 空のプレースホルダーは間隔を維持 */}
                        </div>
                      );
                    }

                    const entry = entries.find((e) => e.entryNo === entryNo);
                    const player1 = entry
                      ? participants.find((p) => p.id === entry.playerIds[0])
                      : null;
                    const player2 =
                      entry && entry.playerIds.length > 1
                        ? participants.find((p) => p.id === entry.playerIds[1])
                        : null;

                    let displayName = '';
                    if (player2) {
                      const n1 = player1?.lastName || player1?.team || '';
                      const n2 = player2?.lastName || player2?.team || '';
                      displayName = `${n1}・${n2}`;
                    } else if (player1) {
                      displayName = player1.lastName
                        ? `${player1.lastName} ${player1.firstName || ''}`.trim()
                        : player1.team || '';
                    }

                    const team1 = player1?.team || '';
                    const team2 = player2?.team || '';
                    const showTwoTeams = team2 && team1 !== team2;

                    // このラウンドでこのエントリーが勝ったかをチェック
                    const matchForEntry = matches.find(
                      (m) =>
                        m.stage === 'knockout' &&
                        m.round === roundName &&
                        m.entries.includes(entryNo),
                    );

                    const nextRoundName = displayedRounds[roundIndex + 1];
                    const nextRoundEntries = nextRoundName
                      ? entriesByRound.get(nextRoundName)
                      : null;
                    const isSeed =
                      !matchForEntry &&
                      !!nextRoundEntries &&
                      entryNo !== null &&
                      nextRoundEntries.includes(entryNo);

                    const isWinner =
                      matchForEntry?.winnerEntryNo === entryNo || isSeed;

                    return (
                      <div
                        key={`${roundName}-${entryNo}`}
                        className="relative"
                        style={{ height: `${ENTRY_HEIGHT}px` }}
                      >
                        {/* 最初のラウンドでのみエントリーボックスを表示 */}
                        {showBoxes && (
                          <div
                            className={`
                                                            h-full flex flex-row items-center
                                                            
                                                        `}
                            style={{ width: '220px', minWidth: '220px' }}
                          >
                            {/* エントリー番号: 最大3桁 */}
                            <div className="w-8 text-[10px] text-gray-500 dark:text-gray-400 font-mono text-center shrink-0 border-r border-gray-100 dark:border-gray-700">
                              {entryNo}
                            </div>

                            {/* プレイヤー名: 通常6文字最大、より多い場合は小さく */}
                            <div
                              className={`
                                                                flex-1 text-center font-medium truncate px-1 border-r border-gray-100 dark:border-gray-700
                                                                ${
                                                                  displayName.length >
                                                                  6
                                                                    ? 'text-[10px]'
                                                                    : 'text-xs'
                                                                }
                                                                ${
                                                                  isWinner
                                                                    ? 'text-blue-900 dark:text-blue-100'
                                                                    : 'text-gray-900 dark:text-gray-100'
                                                                }
                                                            `}
                            >
                              {displayName}
                            </div>

                            {/* チーム: 通常5文字最大、より多い場合は小さく */}
                            <div className="w-20 shrink-0 px-1 flex flex-col justify-center items-center leading-tight">
                              <div
                                className={`
                                                                    text-center text-gray-500 dark:text-gray-400 truncate w-full
                                                                    ${team1.length > 5 ? 'text-[9px]' : 'text-[10px]'}
                                                                `}
                              >
                                {team1}
                              </div>
                              {showTwoTeams && (
                                <div
                                  className={`
                                                                        text-center text-gray-500 dark:text-gray-400 truncate w-full
                                                                        ${team2.length > 5 ? 'text-[9px]' : 'text-[10px]'}
                                                                    `}
                                >
                                  {team2}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 次のラウンドへの接続線 */}
                        {roundIndex < displayedRounds.length - 1 && ( // 優勝列（最後のインデックス）から線を描かない、またはロジックが言う場合
                          <svg
                            className="absolute pointer-events-none overflow-visible"
                            style={{
                              top: '50%',
                              left: '100%',
                              width: `${ROUND_GAP}px`,
                              height: `${ENTRY_HEIGHT * spacingMultiplier}px`,
                              transform: `translateY(${index % 2 === 0 ? '0' : `-${ENTRY_HEIGHT * spacingMultiplier}px`})`,
                              zIndex: 10,
                            }}
                          >
                            {index % 2 === 0 ? (
                              // 上エントリー: 下と右
                              <>
                                {/* ボックスからの水平線 */}
                                {/* lineX は現在 ROUND_GAP (全幅) */}
                                {(() => {
                                  // 上エントリー（偶数）なので、勝者か有効かをチェックする必要がある。
                                  // 色ロジック: !showBoxes の場合、線ラウンドと仮定。
                                  // ユーザーがこの試合に勝った場合、青。それ以外はグレー。
                                  // または単に接続している場合。
                                  // 既存ロジック:
                                  // className={(!showBoxes || isWinner || (roundIndex > 0)) ? ... }
                                  // 待って、勝者ステータスに応じて線を描画。

                                  /* 
                                                                       lineX の修正:
                                                                       ほとんどの線で ROUND_GAP に戻した。
                                                                       優勝ラウンドは特別だったが、上記の独自ブロックで処理。
                                                                       ここは通常ラウンドブロック。
                                                                       lineX = ROUND_GAP.
                                                                    */
                                  const lineX = ROUND_GAP;
                                  // 実際、svg top はボックス中心。

                                  // 待って、以前のロジックはこの SVG ブロック内に線があった。
                                  // 置換で内部 SVG コンテンツロジックを削除していないことを確認する必要がある。
                                  // ループコンテンツを置換した。

                                  return (
                                    <>
                                      <line
                                        x1="0"
                                        y1="0"
                                        x2={lineX}
                                        y2="0"
                                        className={
                                          !showBoxes || isWinner
                                            ? 'stroke-blue-500 dark:stroke-blue-400'
                                            : 'stroke-gray-300 dark:stroke-gray-600'
                                        }
                                        strokeWidth="1"
                                      />
                                      {/* 右端で下向きの垂直線 */}
                                      <line
                                        x1={lineX}
                                        y1="0"
                                        x2={lineX}
                                        y2={
                                          ENTRY_HEIGHT * (spacingMultiplier / 2)
                                        }
                                        className={
                                          isWinner
                                            ? 'stroke-blue-500 dark:stroke-blue-400'
                                            : 'stroke-gray-300 dark:stroke-gray-600'
                                        }
                                        strokeWidth="1"
                                      />
                                    </>
                                  );
                                })()}
                              </>
                            ) : (
                              // 下エントリー: 上と右
                              <>
                                {(() => {
                                  const lineX = ROUND_GAP;
                                  // SVG top は下エントリー中心。（transform が上へ移動？）
                                  // 待って、transform `translateY(-${ENTRY_HEIGHT * spacingMultiplier}px)`？
                                  // いいえ、`transform: translateY(...)` は div 中心に対する SVG の位置決め？
                                  // 実際、SVG は div の `top: 50%` に配置。
                                  // index % 2 === 1 (下) の場合、Y を `height` だけ上へ移動。
                                  // 待って、以前のコード論理構造:
                                  /*
                                                                       style={{
                                                                           ...
                                                                           transform: `translateY(${index % 2 === 0 ? '0' : `-${ENTRY_HEIGHT * spacingMultiplier / 2}px`})` ?? 
                                                                           いいえ、ロジックは: 
                                                                           index % 2 === 0 ? '0' : ...
                                                                           
                                                                           SVG viewbox または coords を確認。
                                                                           X1, Y1... の線を描画。
                                                                    */

                                  return (
                                    <>
                                      <line
                                        x1="0"
                                        y1={ENTRY_HEIGHT * spacingMultiplier}
                                        x2={lineX}
                                        y2={ENTRY_HEIGHT * spacingMultiplier}
                                        className={
                                          !showBoxes || isWinner
                                            ? 'stroke-blue-500 dark:stroke-blue-400'
                                            : 'stroke-gray-300 dark:stroke-gray-600'
                                        }
                                        strokeWidth="1"
                                      />
                                      <line
                                        x1={lineX}
                                        y1={ENTRY_HEIGHT * spacingMultiplier}
                                        x2={lineX}
                                        y2={
                                          ENTRY_HEIGHT * (spacingMultiplier / 2)
                                        }
                                        className={
                                          isWinner
                                            ? 'stroke-blue-500 dark:stroke-blue-400'
                                            : 'stroke-gray-300 dark:stroke-gray-600'
                                        }
                                        strokeWidth="1"
                                      />
                                    </>
                                  );
                                })()}
                              </>
                            )}

                            {/* スコア表示ロジック再挿入 */}
                            {matchForEntry && !isChampionRound && !isWinner && (
                              <text
                                x={ROUND_GAP - 2}
                                y={
                                  index % 2 === 0
                                    ? -6
                                    : ENTRY_HEIGHT * spacingMultiplier + 14
                                }
                                textAnchor="end"
                                fontSize="10"
                                className="fill-gray-600 dark:fill-gray-400 pointer-events-none select-none"
                              >
                                {(() => {
                                  const s = matchForEntry.scores;
                                  if (!s) return null;
                                  const val = s[String(entryNo)] ?? s[entryNo];
                                  return val;
                                })()}
                              </text>
                            )}
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
