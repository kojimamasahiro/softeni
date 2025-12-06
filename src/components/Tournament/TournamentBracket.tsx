// components/Tournament/TournamentBracket.tsx

import { useMemo, useState } from 'react';

import { TournamentDetailData, TournamentMatch } from '@/types/index';

interface TournamentBracketProps {
  detailData: TournamentDetailData;
}

// Build tournament bracket dynamically based on available matches
// Uses a Canonical Tree approach to ensure alignment even with byes/missing matches
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
  // Find a match that is NOT listed as a 'prevMatchId' for any other match
  // OR simply finding the one with no nextMatchId is usually safer if nextMatchId is populated.
  // Let's use nextMatchId.
  let finalMatch = knockoutMatches.find((m) => !m.nextMatchId);

  // Fallback: if multiple (e.g. 3rd place match?), picking the one with '決勝' round name if available
  const finals = knockoutMatches.filter((m) => !m.nextMatchId);
  if (finals.length > 1) {
    const namedFinal = finals.find((m) => m.round === '決勝');
    if (namedFinal) finalMatch = namedFinal;
  }

  if (!finalMatch) {
    // Fallback for weird data: just pick one? or return empty?
    // If circular or broken data, might happen.
    // Let's assume the first one is root if logic fails.
    finalMatch = knockoutMatches[0];
  }

  // 3. Tree Traversal to assign Canonical Slots
  // Coordinate: (DistanceFromFinal, IndexInLayer)
  // Final = (0, 0)
  // Inputs to (D, I) are (D+1, I*2) and (D+1, I*2+1)

  // Map: RoundName -> Distance
  const roundToDist = new Map<string, number>();
  // Map: Distance -> Array of Match/Null
  // We store the Match Object at the slot.
  // If a match exists at (D, I), we store it.
  const treeGrid = new Map<number, Map<number, TournamentMatch>>();

  // We need to map MatchID to Match for easy lookup
  const matchMap = new Map<string, TournamentMatch>();
  knockoutMatches.forEach((m) => matchMap.set(m.matchId, m));

  // Recursive fill
  // We traverse from Root.
  // For a match M at (dist, index):
  //   - Determine its inputs.
  //   - Input 0 (Top) comes from prevMatchIds?
  //     We need to know WHICH prevMatch is Top vs Bottom.
  //     Assumption: M.entries[0] is the winner of PrevMatchTop.
  //     M.entries[1] is the winner of PrevMatchBottom.

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
    // Note: checking nextMatchId protects against group matches or previous tournaments.
    // But strict filtering `knockout` matches usually sufficient.

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
  // We iterate dist from Max down to 0.
  // For each dist, valid indices are 0 to 2^dist - 1?
  // No.
  // Dist 0 (Final): 1 match (Index 0). Entries: 0, 1.
  // Dist 1 (Semi): 2 matches (Ind 0, 1). Entries: 0,1 , 2,3.
  // Dist k: Matches 0 .. 2^k - 1. Entries 0 .. 2^(k+1) - 1.

  // We use `roundToDist` to determine which round name corresponds to which distance.
  // Inverse map: Distance -> RoundName
  const distToRound = new Map<number, string>();
  roundToDist.forEach((d, r) => {
    // If multiple rounds map to same distance (unlikely), pick one.
    // Usually safe.
    if (!distToRound.has(d)) distToRound.set(d, r);
  });

  const sortedRounds: string[] = [];

  // Populate from 0 (Final) up to MaxDist (First Round)
  // This direction allows us to propagate seeds (players entered in parent round but missing match in this round)
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
  // Same logic: check Winner of Final (0, 0)
  if (finalMatch && finalMatch.winnerEntryNo !== undefined) {
    entriesByRound.set('優勝', [finalMatch.winnerEntryNo]);
    sortedRounds.push('優勝');
  } else if (sortedRounds.length > 0) {
    // Should add column even if unknown? Maybe placeholder.
    entriesByRound.set('優勝', [-1]);
    sortedRounds.push('優勝');
  }

  // Calculate default start round (4th from bottom, excluding '優勝')
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

  // Build a map of entry -> winner status per round
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

        {/* Round Selector */}
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
                .filter((r) => r !== '優勝') // Don't allow starting from Champion line
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

            // Only show boxes for the first round detected (relative to display)
            const showBoxes = roundIndex === 0;
            // Special handling for Champion round (just a line)
            const isChampionRound = roundName === '優勝';

            return (
              <div key={roundName} className="flex flex-col">
                {/* Entries or connection points */}
                <div
                  className="flex flex-col"
                  style={{
                    gap: `${ENTRY_HEIGHT * (spacingMultiplier - 1)}px`,
                    paddingTop: `${(ENTRY_HEIGHT * (spacingMultiplier - 1)) / 2}px`,
                  }}
                >
                  {roundEntries.map((entryNo, index) => {
                    if (isChampionRound) {
                      // Determine color based on whether we have a winner
                      // The entryNo is the winner's ID or -1 or null
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

                    // Handle NULL entry (Bye/Placeholder)
                    if (entryNo === null) {
                      return (
                        <div
                          key={`${roundName}-empty-${index}`}
                          className="relative invisible"
                          style={{ height: `${ENTRY_HEIGHT}px` }}
                        >
                          {/* Empty placeholder maintains spacing */}
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
                        ? `${player1.lastName} ${player1.firstName}`
                        : player1.team || '';
                    }

                    const team1 = player1?.team || '';
                    const team2 = player2?.team || '';
                    const showTwoTeams = team2 && team1 !== team2;

                    // Check if this entry won in this round
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
                        {/* Show entry box only for the first round */}
                        {showBoxes && (
                          <div
                            className={`
                                                            h-full flex flex-row items-center
                                                            
                                                        `}
                            style={{ width: '220px', minWidth: '220px' }}
                          >
                            {/* Entry Number: Max 3 digits */}
                            <div className="w-8 text-[10px] text-gray-500 dark:text-gray-400 font-mono text-center shrink-0 border-r border-gray-100 dark:border-gray-700">
                              {entryNo}
                            </div>

                            {/* Player Names: Max 6 chars normal, smaller if more */}
                            <div
                              className={`
                                                                flex-1 text-center font-medium truncate px-1 border-r border-gray-100 dark:border-gray-700
                                                                ${displayName.length >
                                  6
                                  ? 'text-[10px]'
                                  : 'text-xs'
                                }
                                                                ${isWinner
                                  ? 'text-blue-900 dark:text-blue-100'
                                  : 'text-gray-900 dark:text-gray-100'
                                }
                                                            `}
                            >
                              {displayName}
                            </div>

                            {/* Team: Max 5 chars normal, smaller if more */}
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

                        {/* Connection line to next round */}
                        {roundIndex < displayedRounds.length - 1 && ( // Don't draw line from Champion column (last index) or if logic says so
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
                              // Top entry: Down and Right
                              <>
                                {/* Horizontal line from box */}
                                {/* lineX is now ROUND_GAP (full width) */}
                                {(() => {
                                  // Since we are top entry (even), we need to check if we are the winner or valid.
                                  // Color logic: if !showBoxes, we assume it's a line round.
                                  // If user won this match, Blue. Else Gray.
                                  // Or if we are just connecting.
                                  // Existing logic:
                                  // className={(!showBoxes || isWinner || (roundIndex > 0)) ? ... }
                                  // Wait, renders lines depending on winner status.

                                  /* 
                                                                       Correction on lineX:
                                                                       We reverted to ROUND_GAP for most lines.
                                                                       Except Champion Round was special but handled in its own block above.
                                                                       Here we are in normal round block.
                                                                       lineX = ROUND_GAP.
                                                                    */
                                  const lineX = ROUND_GAP;
                                  // Actually svg top is at box center.

                                  // But wait, the previous logic had lines inside this SVG block.
                                  // I need to make sure I didn't delete the internal SVG content logic in my replacement.
                                  // I replaced the Loop content.

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
                                      {/* Vertical line at right end going down */}
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
                              // Bottom entry: Up and Right
                              <>
                                {(() => {
                                  const lineX = ROUND_GAP;
                                  // SVG top is at bottom entry center. (transform translated up?)
                                  // Wait, transform `translateY(-${ENTRY_HEIGHT * spacingMultiplier}px)`?
                                  // No, `transform: translateY(...)` is for positioning the SVG relative to the div center?
                                  // Actually, the SVG is positioned `top: 50%` of the div.
                                  // If index % 2 === 1 (bottom), we translate Y up by `height`.
                                  // Wait, the previous code logical structure:
                                  /*
                                                                       style={{
                                                                           ...
                                                                           transform: `translateY(${index % 2 === 0 ? '0' : `-${ENTRY_HEIGHT * spacingMultiplier / 2}px`})` ?? 
                                                                           No, logic says: 
                                                                           index % 2 === 0 ? '0' : ...
                                                                           
                                                                           Let's look at the SVG viewbox or coords.
                                                                           It renders lines X1, Y1...
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

                            {/* Score Display Logic Re-insertion */}
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
