// components/Tournament/TournamentBracket.tsx

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';

import { TournamentDetailData, TournamentMatch } from '@/types/index';

interface TournamentBracketProps {
  detailData: TournamentDetailData;
}

// 利用可能な試合に基づいてトーナメント表を動的に構築
// バイや欠場試合がある場合でも整列を確保するための標準木アプローチを使用
function buildBracket(matches: TournamentMatch[]): {
  rounds: string[];
  entriesByRound: Map<string, (number | null)[]>;
  layoutByRound: Map<string, { entryNo: number | null; y: number }[]>;
  defaultStartRound: string;
} {
  // 1. Strict Filter for Knockout
  const knockoutMatches = matches.filter((m) => m.stage === 'knockout');

  if (knockoutMatches.length === 0) {
    return {
      rounds: [],
      entriesByRound: new Map(),
      layoutByRound: new Map(),
      defaultStartRound: '',
    };
  }

  const entriesByRound = new Map<string, (number | null)[]>();

  // 2. Identify the Roots (Final or Interrupted round)
  let finalMatches = knockoutMatches.filter((m) => !m.nextMatchId);

  if (finalMatches.length > 1) {
    const namedFinal = finalMatches.find((m) => m.round === '決勝');
    if (namedFinal) {
      finalMatches = [namedFinal];
    } else {
      // 決勝がなくて複数ルートがある＝途中で終わっているトーナメント
      // エントリー番号順にソートして、インデックスを割り当てる
      finalMatches.sort((a, b) => {
        const aMin = Math.min(...a.entries.map((e) => e ?? Infinity));
        const bMin = Math.min(...b.entries.map((e) => e ?? Infinity));
        return aMin - bMin;
      });
    }
  } else if (finalMatches.length === 0) {
    // 循環または異常データフォールバック
    finalMatches = [knockoutMatches[0]];
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

  finalMatches.forEach((match, idx) => {
    traverse(match, 0, idx);
  });

  // 4. Flatten Grid to entriesByRound
  // `roundToDist` を使用して、どのラウンド名がどの距離に対応するかを決定する。
  const distToRound = new Map<number, string>();
  roundToDist.forEach((d, r) => {
    if (!distToRound.has(d)) distToRound.set(d, r);
  });

  const sortedRounds: string[] = [];

  for (let d = 0; d <= maxDist; d++) {
    const roundName = distToRound.get(d);
    if (!roundName) continue;

    sortedRounds.unshift(roundName);

    const layerMatches = treeGrid.get(d);
    const slotsCount = finalMatches.length * Math.pow(2, d); // Number of Matches
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

  const layoutByRound = new Map<
    string,
    { entryNo: number | null; y: number }[]
  >();

  if (sortedRounds.length > 0 && distToRound.has(maxDist)) {
    const maxDistRound = distToRound.get(maxDist)!;
    const maxDistEntries = entriesByRound.get(maxDistRound) || [];
    let currentY = 0;
    const maxDistLayout = maxDistEntries.map((entryNo) => {
      if (entryNo === null) return { entryNo, y: -1 };
      return { entryNo, y: currentY++ };
    });
    layoutByRound.set(maxDistRound, maxDistLayout);

    for (let d = maxDist - 1; d >= 0; d--) {
      const roundName = distToRound.get(d)!;
      const entries = entriesByRound.get(roundName) || [];
      const prevRoundName = distToRound.get(d + 1)!;
      const prevLayout = layoutByRound.get(prevRoundName) || [];

      const roundLayout = entries.map((entryNo, idx) => {
        if (entryNo === null) return { entryNo, y: -1 };
        const childTop = prevLayout[idx * 2];
        const childBottom = prevLayout[idx * 2 + 1];

        let y = -1;
        if (childTop?.entryNo !== null && childBottom?.entryNo !== null) {
          y = (childTop.y + childBottom.y) / 2;
        } else if (childTop?.entryNo !== null) {
          y = childTop.y;
        } else if (childBottom?.entryNo !== null) {
          y = childBottom.y;
        }
        return { entryNo, y };
      });
      layoutByRound.set(roundName, roundLayout);
    }
  }

  // 5. Champion Column
  if (finalMatches.length === 1) {
    const singleFinal = finalMatches[0];
    if (singleFinal.winnerEntryNo !== undefined) {
      entriesByRound.set('優勝', [singleFinal.winnerEntryNo]);
      sortedRounds.push('優勝');

      // Calculate champion Y
      const finalRoundName = distToRound.get(0);
      const finalLayout = finalRoundName
        ? layoutByRound.get(finalRoundName)
        : [];
      const top = finalLayout?.[0];
      const bottom = finalLayout?.[1];
      let champY = 0;
      if (top?.entryNo !== null && bottom?.entryNo !== null) {
        champY = (top!.y + bottom!.y) / 2;
      } else if (top?.entryNo !== null) {
        champY = top!.y;
      } else if (bottom?.entryNo !== null) {
        champY = bottom!.y;
      }
      layoutByRound.set('優勝', [
        { entryNo: singleFinal.winnerEntryNo, y: champY },
      ]);
    } else if (sortedRounds.length > 0) {
      entriesByRound.set('優勝', [-1]);
      sortedRounds.push('優勝');
      layoutByRound.set('優勝', [{ entryNo: -1, y: 0 }]);
    }
  }

  // デフォルト開始ラウンドを計算（下から4番目、'優勝' を除く）
  const selectableRounds = sortedRounds.filter((r) => r !== '優勝');
  const defaultIndex = Math.max(0, selectableRounds.length - 4);
  const defaultStartRound = selectableRounds[defaultIndex] || '';

  return {
    rounds: sortedRounds,
    entriesByRound,
    layoutByRound,
    defaultStartRound,
  };
}

export default function TournamentBracket({
  detailData,
}: TournamentBracketProps) {
  const { participants, entries, matches } = detailData;

  // 個人戦で結果ページを持つ選手（playerId あり）のみリンク化する。
  // 既存の MatchResults / TeamResults と同じ規約に揃える。
  const renderPlayerName = (
    player: (typeof participants)[number] | null | undefined,
    text: string,
  ): ReactNode => {
    if (player?.playerId && player.lastName) {
      return (
        <Link
          href={`/players/${player.playerId}/results`}
          className="text-inherit hover:underline underline-offset-2 decoration-dotted"
        >
          {text}
        </Link>
      );
    }
    return text;
  };

  const { rounds, entriesByRound, layoutByRound, defaultStartRound } = useMemo(
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

  // startRound に応じて、表示するラウンドだけでレイアウトを再計算する
  const dynamicLayout = useMemo(() => {
    const layout = new Map<
      string,
      {
        entryNo: number | null;
        y: number;
        originalNode?: { entryNo: number | null; y: number };
      }[]
    >();

    if (displayedRounds.length === 0) return layout;

    // 最初の表示ラウンドの Y 座標を 0 から振り直す
    const firstRoundName = displayedRounds[0];
    const firstRoundEntries = entriesByRound.get(firstRoundName) || [];

    let currentY = 0;
    const firstLayout = firstRoundEntries.map((entryNo) => {
      if (entryNo === null) return { entryNo, y: -1 };
      return { entryNo, y: currentY++ };
    });
    layout.set(firstRoundName, firstLayout);

    // 以降のラウンドは、前のラウンドの座標の中間を取る
    for (let i = 1; i < displayedRounds.length; i++) {
      const roundName = displayedRounds[i];
      if (roundName === '優勝') {
        // 優勝の特別計算
        const prevRoundName = displayedRounds[i - 1];
        const prevLayout = layout.get(prevRoundName) || [];
        const top = prevLayout[0];
        const bottom = prevLayout[1];
        let champY = 0;
        if (top?.entryNo !== null && bottom?.entryNo !== null) {
          champY = (top!.y + bottom!.y) / 2;
        } else if (top?.entryNo !== null) {
          champY = top!.y;
        } else if (bottom?.entryNo !== null) {
          champY = bottom!.y;
        }

        // 優勝者の entryNo を取得
        const originalChampLayout = layoutByRound.get('優勝');
        const champEntryNo = originalChampLayout?.[0]?.entryNo ?? -1;

        layout.set('優勝', [{ entryNo: champEntryNo, y: champY }]);
        continue;
      }

      const entries = entriesByRound.get(roundName) || [];
      const prevRoundName = displayedRounds[i - 1];
      const prevLayout = layout.get(prevRoundName) || [];

      const roundLayout = entries.map((entryNo, idx) => {
        if (entryNo === null) return { entryNo, y: -1 };

        // prevLayout から、このエントリーに対応する子要素を探す
        // originalLayout では `idx * 2` と `idx * 2 + 1` が子だった
        // displayedRounds でスライスされているため、要素の繋がりは維持されているはず
        const childTop = prevLayout[idx * 2];
        const childBottom = prevLayout[idx * 2 + 1];

        let y = -1;
        if (
          childTop?.entryNo !== null &&
          childBottom?.entryNo !== null &&
          childTop !== undefined &&
          childBottom !== undefined
        ) {
          y = (childTop.y + childBottom.y) / 2;
        } else if (childTop?.entryNo !== null && childTop !== undefined) {
          y = childTop.y;
        } else if (childBottom?.entryNo !== null && childBottom !== undefined) {
          y = childBottom.y;
        } else {
          // 子がどちらも存在しない/null の場合（シード等で prev に上がってこなかった場合）、
          // このエントリー自身のインデックスをベースにするしかないが、
          // 上流から辿れる場合はその座標を使うためのフォールバック
          y = currentY++; // 暫定
        }
        return { entryNo, y };
      });
      layout.set(roundName, roundLayout);
    }
    return layout;
  }, [displayedRounds, entriesByRound, layoutByRound]);

  if (rounds.length === 0) {
    return null;
  }

  const ENTRY_HEIGHT = 34;
  const ROUND_GAP = 20; // Reduced to make connection lines shorter

  let maxY = 0;
  if (dynamicLayout) {
    dynamicLayout.forEach((layout) => {
      layout.forEach((node) => {
        if (node.y > maxY) maxY = node.y;
      });
    });
  }
  const containerHeight = (maxY + 1) * ENTRY_HEIGHT;

  // ラウンドごとのエントリー -> 勝者ステータスのマップを構築
  const winnerMap = new Map<string, number>();
  matches
    .filter((m) => m.stage === 'knockout')
    .forEach((match) => {
      if (match.round) {
        winnerMap.set(`${match.round}-${match.matchId}`, match.winnerEntryNo);
      }
    });

  // 優勝者の entryNo（名前の強調表示に使用）
  const championEntryNo = entriesByRound.get('優勝')?.[0];

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
        <div
          className="relative inline-flex"
          style={{ gap: `${ROUND_GAP}px`, height: `${containerHeight}px` }}
        >
          {displayedRounds.map((roundName, roundIndex) => {
            const layout = dynamicLayout.get(roundName) || [];

            // 表示に対する最初のラウンドでボックスを表示
            const showBoxes = roundIndex === 0;
            // 優勝ラウンドの特別処理（ただの線）
            const isChampionRound = roundName === '優勝';

            return (
              <div
                key={roundName}
                className="relative"
                style={{ width: showBoxes ? '220px' : '0px' }}
              >
                {/* エントリーまたは接続ポイント */}
                {layout.map((node, index) => {
                  const entryNo = node.entryNo;
                  if (entryNo === null) return null; // 枠を消して詰める
                  if (isChampionRound) {
                    // 勝者がいるかどうかで色を決定
                    // entryNo は勝者の ID または -1 または null
                    const hasWinner = entryNo !== null && entryNo !== -1;
                    return (
                      <div
                        key={`champion-${roundName}-${index}`}
                        className="absolute flex items-center"
                        style={{
                          top: `${node.y * ENTRY_HEIGHT}px`,
                          height: `${ENTRY_HEIGHT}px`,
                          width: '40px',
                        }}
                      >
                        <div
                          className={`h-px w-10 ${hasWinner ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'}`}
                        />
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
                  let nameNodes: ReactNode = '';
                  if (player2) {
                    const n1 = player1?.lastName || player1?.team || '';
                    const n2 = player2?.lastName || player2?.team || '';
                    displayName = `${n1}・${n2}`;
                    nameNodes = (
                      <>
                        {renderPlayerName(player1, n1)}
                        {'・'}
                        {renderPlayerName(player2, n2)}
                      </>
                    );
                  } else if (player1) {
                    displayName = player1.lastName
                      ? `${player1.lastName} ${player1.firstName || ''}`.trim()
                      : player1.team || '';
                    nameNodes = renderPlayerName(player1, displayName);
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

                  // 名前の強調表示は優勝者のみ
                  const isChampion =
                    championEntryNo !== undefined &&
                    championEntryNo !== -1 &&
                    entryNo === championEntryNo;

                  return (
                    <div
                      key={`${roundName}-${entryNo}`}
                      className="absolute w-full"
                      style={{
                        top: `${node.y * ENTRY_HEIGHT}px`,
                        height: `${ENTRY_HEIGHT}px`,
                      }}
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
                                                                  isChampion
                                                                    ? 'text-blue-900 dark:text-blue-100'
                                                                    : 'text-gray-900 dark:text-gray-100'
                                                                }
                                                            `}
                          >
                            {nameNodes}
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

                      {/* 次のラウンドへの接続線、または最終・途中結果のスコア線 */}
                      {(roundIndex < displayedRounds.length - 1 ||
                        matchForEntry) &&
                        (() => {
                          const nextRoundName = displayedRounds[roundIndex + 1];
                          const nextLayout = nextRoundName
                            ? dynamicLayout.get(nextRoundName)
                            : undefined;
                          // 次のラウンドのエントリーは、2つの子を1つにまとめるため、idx = Math.floor(index / 2)
                          const destNode = nextLayout?.[Math.floor(index / 2)];

                          if (
                            roundIndex === displayedRounds.length - 1 &&
                            !matchForEntry
                          )
                            return null;

                          return (
                            <svg
                              className="absolute pointer-events-none overflow-visible"
                              style={{
                                top: '50%',
                                left: '100%',
                                width: `${ROUND_GAP}px`,
                                height: '1px',
                                zIndex: 10,
                              }}
                            >
                              <line
                                x1="0"
                                y1="0"
                                x2={ROUND_GAP}
                                y2="0"
                                className={
                                  !showBoxes || isWinner
                                    ? 'stroke-blue-500 dark:stroke-blue-400'
                                    : 'stroke-gray-300 dark:stroke-gray-600'
                                }
                                strokeWidth="1"
                              />

                              {destNode && node.y !== destNode.y && (
                                <line
                                  x1={ROUND_GAP}
                                  y1="0"
                                  x2={ROUND_GAP}
                                  y2={(destNode.y - node.y) * ENTRY_HEIGHT}
                                  className={
                                    isWinner
                                      ? 'stroke-blue-500 dark:stroke-blue-400'
                                      : 'stroke-gray-300 dark:stroke-gray-600'
                                  }
                                  strokeWidth="1"
                                />
                              )}

                              {matchForEntry &&
                                !isChampionRound &&
                                !isWinner && (
                                  <text
                                    x={ROUND_GAP - 2}
                                    y={index % 2 === 0 ? -6 : 14}
                                    textAnchor="end"
                                    fontSize="10"
                                    className="fill-gray-600 dark:fill-gray-400 pointer-events-none select-none"
                                  >
                                    {(() => {
                                      const s = matchForEntry.scores;
                                      if (!s) return null;
                                      const val =
                                        s[String(entryNo)] ?? s[entryNo];
                                      return val;
                                    })()}
                                  </text>
                                )}
                            </svg>
                          );
                        })()}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
