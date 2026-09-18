// src/components/Tournament/MatchResults.tsx
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';

import { isUnplayedMatch } from '@/lib/playerStats/placement';
import { MatchRow, TeamMatchPlayer, TeamMatchRow, TournamentDetailData, TournamentEntry, TournamentMatch } from '@/types/tournament';
import { isTeamFormatPlayers, joinPlayerName } from '@/utils/playerName';

type NamePart = {
  text: string;
  playerId?: number;
};

interface Props {
  detail: TournamentDetailData;
  gameCategory: string;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
}

/**
 * 団体戦の対戦ごとの記録（ADR-020）を、side 側の組から見た向きに並べ替える。
 * 記録が無い試合は undefined（行の下に何も出さない）。
 */
function orientTeamMatches(match: TournamentMatch, side: 'A' | 'B'): TeamMatchRow[] | undefined {
  if (!match.matches?.length) return undefined;
  // ページに届く時点では「姓 名」の1文字列（lib/packedPageData.ts）。日本語名は詰めて表示する
  const displayName = (p: TeamMatchPlayer) => {
    if (!('name' in p)) return joinPlayerName(p.lastName, p.firstName);
    const [last, ...rest] = p.name.trim().split(/\s+/);
    return joinPlayerName(last, rest.join(''));
  };
  const toPlayers = (players: TeamMatchPlayer[]) => players.map((p) => ({ name: displayName(p), playerId: p.playerId }));
  return match.matches.map((sub) => {
    const mine = side === 'A';
    return {
      type: sub.type,
      status: sub.status,
      result: sub.winner === null ? null : sub.winner === side ? 'win' : 'lose',
      gamesWon: mine ? sub.scoreA : sub.scoreB,
      gamesLost: mine ? sub.scoreB : sub.scoreA,
      own: toPlayers(mine ? sub.playersA : sub.playersB),
      opponent: toPlayers(mine ? sub.playersB : sub.playersA),
    };
  });
}

function TeamMatchPlayers({ players }: { players: TeamMatchRow['own'] }) {
  // 不戦勝でペアを出さなかった側（ADR-020 の walkover）。空欄にすると読み落とすので言葉で書く
  if (players.length === 0) return <span className="text-text-muted">出場なし</span>;
  return (
    <>
      {/* 狭い画面では2人の間で折り返し、1人の名前の途中では折り返さない */}
      {players.map((p, i) => (
        <span key={i} className="inline-block whitespace-nowrap">
          {i > 0 && '・'}
          {p.playerId ? (
            <Link href={`/players/${p.playerId}/results`} className="underline underline-offset-2 decoration-dotted hover:decoration-solid">
              {p.name}
            </Link>
          ) : (
            p.name
          )}
        </span>
      ))}
    </>
  );
}

/** 試合の行の下に出す、対戦ごとのペアと本数。左がこの組、右が相手（STリーグの対戦詳細と同じ並び） */
function TeamMatchList({ rows }: { rows: TeamMatchRow[] }) {
  return (
    <ul className="divide-y divide-border bg-bg-subtle">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center gap-2 px-4 py-1.5 text-xs">
          <span className="w-14 shrink-0 text-text-muted">第{i + 1}対戦</span>
          <span className={`flex-1 min-w-0 text-right break-words ${r.result === 'win' ? 'font-bold text-text' : 'text-text-secondary'}`}>
            <TeamMatchPlayers players={r.own} />
          </span>
          <span className="shrink-0 w-16 text-center">
            {r.status === 'not_played' ? (
              <span className="text-text-muted">未実施</span>
            ) : r.status === 'walkover' ? (
              // 試合が行われていないので本数は出さない
              <span className="text-text-muted">{r.result === 'win' ? '不戦勝' : '相手が不戦勝'}</span>
            ) : (
              <>
                <span className="inline-block px-1.5 py-0.5 border border-border-strong rounded font-mono">
                  {r.gamesWon}-{r.gamesLost}
                </span>
                {r.result && <span className="sr-only">{r.result === 'win' ? '勝ち' : '負け'}</span>}
                {r.status === 'unfinished' && <span className="block text-text-muted">打ち切り</span>}
                {/* 途中棄権は本数から勝敗が読めない（棄権した側の本数が多いことがある）ので、どちらが棄権したかを書く */}
                {r.status === 'retired' && <span className="block text-text-muted">{r.result === 'lose' ? '棄権' : '相手が棄権'}</span>}
              </>
            )}
          </span>
          <span className={`flex-1 min-w-0 text-left break-words ${r.result === 'lose' ? 'font-bold text-text' : 'text-text-secondary'}`}>
            <TeamMatchPlayers players={r.opponent} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** この結果ラベルが付いた組は、既定で（畳まずに）出し、カードも開いた状態で始める。 */
const TOP_RESULT_LABELS = ['優勝', '準優勝', 'ベスト4', 'ベスト8'];

/**
 * 出場組がこれ以下の大会は畳まない。全 427 ファイルの実測で中央値 48 組・p75 は 104 組あり、
 * 大きい大会では 300 組を超える一方、24 組以下も 22.7% ある。小さい大会まで畳むと
 * 「開く」操作が増えるだけで、スクロール量は元から問題になっていない。
 */
const COLLAPSE_MIN_ENTRIES = 24;

/** 上のチップ（`aria-controls`）から「その他の組」の `<details>` を指すための id。 */
const REST_SECTION_ID = 'match-results-rest';

// 絞り込み（検索・上位/その他の振り分け）は呼び出し側で済ませてある。
// ここは 1 組ぶんの見出しと、開いたときの対戦表だけを受け持つ。
function MatchGroup({
  name,
  nameParts,
  entryNo,
  matchGroup,
  extraRows,
  isSeed,
  resultLabel,
  defaultOpen = false,
}: {
  name: string;
  nameParts?: NamePart[];
  entryNo: number;
  matchGroup: MatchRow[];
  extraRows?: MatchRow[];
  isSeed?: boolean;
  resultLabel: string;
  /** 上位（ベスト8以上）の組は開いた状態で出す。この節を見に来る人が最初に読むのがこの数組のため。 */
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-6 border border-border rounded-xl shadow-sm bg-surface">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className="w-full text-left px-4 py-3 border-b border-border hover:bg-bg-subtle cursor-pointer"
      >
        <h3 className="text-base font-semibold text-text flex justify-between items-center">
          <span className="flex flex-col">
            <span>
              {entryNo}.{' '}
              {nameParts && nameParts.length > 0
                ? nameParts.map((part, i) =>
                    part.playerId ? (
                      <Link
                        key={i}
                        href={`/players/${part.playerId}/results`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid"
                      >
                        {part.text}
                      </Link>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )
                : name}
            </span>
            <span className="text-sm">
              {resultLabel && <span className="ml-2 text-text-muted">{resultLabel}</span>}
              {isSeed && <span className="text-warning">（シード）</span>}
            </span>
          </span>
          <span className="ml-2 text-xs">{isOpen ? '▲' : '▼'}</span>
        </h3>
      </div>

      {isOpen && (
        <div className="w-full overflow-x-auto">
          {[
            { title: null, rows: matchGroup },
            { title: '以降の試合', rows: extraRows ?? [] },
          ].map(({ title, rows }, index) =>
            rows.length > 0 ? (
              <div key={title ?? 'main'} className="mb-2 w-full">
                {title && <div className="px-4 py-2 text-sm font-medium text-text-secondary bg-gray-50 dark:bg-gray-700 text-left">{title}</div>}
                <table className="w-full text-sm table-fixed border-collapse text-left">
                  {index === 0 && (
                    <thead className="bg-bg-subtle text-text">
                      <tr>
                        <th className="w-1/5 px-4 py-2 border-b border-border-strong text-left">ラウンド</th>
                        <th className="w-3/5 px-4 py-2 border-b border-border-strong text-left">対戦相手</th>
                        <th className="w-1/5 px-4 py-2 border-b border-border-strong text-left">スコア</th>
                      </tr>
                    </thead>
                  )}
                  {index !== 0 && (
                    <thead className="bg-gray-50 dark:bg-gray-700 text-text">
                      <tr>
                        <th className="w-1/5 px-4 py-2 border-b border-border-strong text-left"></th>
                        <th className="w-3/5 px-4 py-2 border-b border-border-strong text-left"></th>
                        <th className="w-1/5 px-4 py-2 border-b border-border-strong text-left"></th>
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {rows.map((m: MatchRow, i: number) => {
                      return [
                        <tr key={i} className="border-t border-border">
                          <td className="px-4 py-2 break-words text-left">{m.round ?? '予選'}</td>
                          <td className="px-4 py-2 break-words text-left">
                            {m.opponentPlayerIds?.length === 1 ? (
                              <Link
                                href={`/players/${m.opponentPlayerIds[0]}/results`}
                                className="underline underline-offset-2 decoration-dotted hover:decoration-solid"
                              >
                                {m.opponentDisplayName ?? '不明'}
                              </Link>
                            ) : (
                              (m.opponentDisplayName ?? '不明')
                            )}
                          </td>
                          <td className="px-4 py-2 text-left">
                            {m.unplayed ? <span className="text-text-muted">未実施</span> : `${m.games.won}-${m.games.lost}`}
                          </td>
                        </tr>,
                        m.teamMatches ? (
                          <tr key={`${i}-team`}>
                            <td colSpan={3} className="p-0">
                              <TeamMatchList rows={m.teamMatches} />
                            </td>
                          </tr>
                        ) : null,
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

export default function MatchResults({ detail, gameCategory, searchQuery, setSearchQuery }: Props) {
  // 「その他の組」を開いているか。検索中は強制的に開く（検索語が下半分にしか無いことがあるため）。
  const [showRest, setShowRest] = useState(false);
  // 上のチップから開いたときの移動先。上位の組が開いた状態で並ぶぶん、開くだけでは
  // 何も起きていないように見える（変化が数画面下で起きる）ので、その位置まで送る。
  const restRef = useRef<HTMLDetailsElement>(null);
  const shouldUseShortOpponentName = gameCategory !== 'singles';

  const participantMap = useMemo(() => {
    const map = new Map<string, (typeof detail.participants)[0]>();
    for (const p of detail.participants ?? []) map.set(p.id, p);
    return map;
  }, [detail]);

  // build a map: matchId -> match object for following nextMatchId
  const matchById = useMemo(() => {
    const map = new Map<string, TournamentMatch>();
    for (const m of detail.matches ?? []) {
      if (m.matchId != null) map.set(String(m.matchId), m);
    }
    return map;
  }, [detail]);

  // helper: build display name for an entry (used by later logic)
  const buildNameForEntry = useCallback(
    (entry: TournamentEntry, opts?: { short?: boolean }) => {
      const short = !!opts?.short;
      const players = (entry.playerIds ?? []).map((pid: string) => participantMap.get(pid)).filter(Boolean) as (typeof detail.participants)[0][];
      if (!players || players.length === 0) return `#${entry.entryNo ?? '?'}`;

      // Check if this is a team format (lastName and firstName are both empty)
      const isTeamFormat = isTeamFormatPlayers(players);

      if (isTeamFormat) {
        // For team format: display "チーム名（都道府県）"
        const teamNames = players
          .map((pl) => {
            const teamName = pl?.team || '不明';
            const prefecture = pl?.prefecture;
            return prefecture ? `${teamName}（${prefecture}）` : teamName;
          })
          .filter((name) => name !== '不明');
        return teamNames.join('・') || `#${entry.entryNo ?? '?'}`;
      }

      // For individual format: display "名前（チーム名）"
      const teamMap: Record<string, string[]> = {};
      for (const pl of players) {
        const team = (pl && pl.team) || '\u4e0d\u660e';
        if (!teamMap[team]) teamMap[team] = [];
        const last = pl?.lastName ?? '';
        const first = pl?.firstName ?? '';
        const fullName = joinPlayerName(last, first);
        const displayName = short ? `${last}`.trim() : fullName;
        teamMap[team].push(displayName || '');
      }
      return Object.entries(teamMap)
        .map(([team, names]) => {
          const teamLabel = team;
          return `${names.join('\u30fb')}\uff08${teamLabel}\uff09`;
        })
        .join('\u30fb');
    },
    [participantMap, detail],
  );

  // extract numeric player IDs from an entry (for opponent row links)
  const buildOpponentPlayerIds = useCallback(
    (entry: TournamentEntry): number[] => {
      return (entry.playerIds ?? []).map((pid: string) => participantMap.get(pid)?.playerId).filter((id): id is number => typeof id === 'number');
    },
    [participantMap],
  );

  // build linkable name parts for an entry header (individual format only)
  const buildNamePartsForEntry = useCallback(
    (entry: TournamentEntry): NamePart[] => {
      const players = (entry.playerIds ?? []).map((pid: string) => participantMap.get(pid)).filter(Boolean) as (typeof detail.participants)[0][];
      if (!players || players.length === 0) return [];

      const isTeamFormat = isTeamFormatPlayers(players);
      if (isTeamFormat) return [];

      // group players by team, keeping per-player link info
      const teamGroups = new Map<string, { text: string; playerId?: number }[]>();
      for (const pl of players) {
        const team = (pl && pl.team) || '不明';
        if (!teamGroups.has(team)) teamGroups.set(team, []);
        const fullName = joinPlayerName(pl?.lastName, pl?.firstName);
        teamGroups.get(team)!.push({
          text: fullName || '',
          playerId: pl?.playerId,
        });
      }

      const parts: NamePart[] = [];
      let groupIndex = 0;
      for (const [team, names] of teamGroups) {
        if (groupIndex > 0) parts.push({ text: '・' });
        names.forEach((n, i) => {
          if (i > 0) parts.push({ text: '・' });
          parts.push({ text: n.text, playerId: n.playerId });
        });
        parts.push({ text: `（${team}）` });
        groupIndex += 1;
      }
      return parts;
    },
    [participantMap, detail],
  );

  // Expand an entry's rows by following nextMatchId from the last match
  const expandMatchGroup = (entryNo: number, rows: MatchRow[]) => {
    const extra: MatchRow[] = [];
    if (!rows || rows.length === 0) return extra;
    const last = rows[rows.length - 1];
    if (!last?.matchId) return extra;

    // Start from the winner of the last match and follow their path.
    const visited = new Set<string>();
    const lastMatch = matchById.get(String(last.matchId));
    if (!lastMatch) return extra;

    let prevWinner = lastMatch.winnerEntryNo;
    if (typeof prevWinner !== 'number') return extra;

    let nextId = String(lastMatch.nextMatchId ?? '');
    let depth = 0;
    const MAX_DEPTH = 10;

    while (nextId && !visited.has(nextId) && depth < MAX_DEPTH) {
      visited.add(nextId);
      const nm = matchById.get(nextId);
      if (!nm) break;

      const [a, b] = nm.entries ?? [];

      // If the previous winner participates in this match, determine their opponent.
      let opponent: number | undefined;
      if (a === prevWinner) opponent = b;
      else if (b === prevWinner) opponent = a;
      else break; // prevWinner not in this match, stop following

      const scoreA = String(nm.scores?.[String(a)] ?? nm.scores?.[a] ?? '0');
      const scoreB = String(nm.scores?.[String(b)] ?? nm.scores?.[b] ?? '0');
      const unplayed = isUnplayedMatch(nm);

      const opponentEntry =
        typeof opponent === 'number'
          ? ((detail.entries ?? []).find((e) => e.entryNo === opponent) ?? {
              entryNo: opponent,
              playerIds: [],
            })
          : null;

      const row: MatchRow = {
        matchId: nm.matchId,
        stage: nm.stage,
        group: nm.group ?? null,
        round: nm.round ?? null,
        opponentDisplayName: opponentEntry
          ? buildNameForEntry(opponentEntry, {
              short: shouldUseShortOpponentName,
            })
          : undefined,
        opponentPlayerIds: opponentEntry ? buildOpponentPlayerIds(opponentEntry) : undefined,
        // result from the perspective of prevWinner
        result: nm.winnerEntryNo === prevWinner ? 'win' : 'lose',
        games: a === prevWinner ? { won: scoreA, lost: scoreB } : { won: scoreB, lost: scoreA },
        unplayed,
        teamMatches: orientTeamMatches(nm, a === prevWinner ? 'A' : 'B'),
      };

      extra.push(row);

      // advance: next winner becomes the new prevWinner
      prevWinner = nm.winnerEntryNo;
      nextId = String(nm.nextMatchId ?? '');
      depth += 1;
    }

    return extra;
  };
  // buildNameForEntry moved earlier

  // build a map: entryNo -> list of MatchRow
  const matchesByEntry = useMemo(() => {
    const map = new Map<number, MatchRow[]>();
    for (const m of detail.matches ?? []) {
      const [a, b] = m.entries ?? [];
      const scoreA = String(m.scores?.[String(a)] ?? m.scores?.[a] ?? '0');
      const scoreB = String(m.scores?.[String(b)] ?? m.scores?.[b] ?? '0');
      const unplayed = isUnplayedMatch(m);

      const entryB =
        typeof b === 'number'
          ? ((detail.entries ?? []).find((e) => e.entryNo === b) ?? {
              entryNo: b,
              playerIds: [],
            })
          : null;
      const entryA =
        typeof a === 'number'
          ? ((detail.entries ?? []).find((e) => e.entryNo === a) ?? {
              entryNo: a,
              playerIds: [],
            })
          : null;

      const rowA: MatchRow = {
        matchId: m.matchId,
        stage: m.stage,
        group: m.group ?? null,
        round: m.round ?? null,
        opponentDisplayName: entryB ? buildNameForEntry(entryB, { short: shouldUseShortOpponentName }) : undefined,
        opponentPlayerIds: entryB ? buildOpponentPlayerIds(entryB) : undefined,
        result: m.winnerEntryNo === a ? 'win' : m.winnerEntryNo === b ? 'lose' : 'draw',
        games: { won: scoreA, lost: scoreB },
        unplayed,
        teamMatches: orientTeamMatches(m, 'A'),
      };
      const rowB: MatchRow = {
        matchId: m.matchId,
        stage: m.stage,
        group: m.group ?? null,
        round: m.round ?? null,
        opponentDisplayName: entryA ? buildNameForEntry(entryA, { short: shouldUseShortOpponentName }) : undefined,
        opponentPlayerIds: entryA ? buildOpponentPlayerIds(entryA) : undefined,
        result: m.winnerEntryNo === b ? 'win' : m.winnerEntryNo === a ? 'lose' : 'draw',
        games: { won: scoreB, lost: scoreA },
        unplayed,
        teamMatches: orientTeamMatches(m, 'B'),
      };

      if (typeof a === 'number') map.set(a, [...(map.get(a) ?? []), rowA]);
      if (typeof b === 'number') map.set(b, [...(map.get(b) ?? []), rowB]);
    }

    // sort each entry's match list so that roundrobin stage comes first
    for (const [entryNo, rows] of map) {
      rows.sort((x, y) => {
        const xIsRR = x.stage === 'roundrobin' ? 0 : 1;
        const yIsRR = y.stage === 'roundrobin' ? 0 : 1;
        if (xIsRR !== yIsRR) return xIsRR - yIsRR;

        const rank = (r?: string | null) => {
          if (!r) return 0;
          const s = String(r);
          // 明示的なマッピング: 決勝を最大にして最後に来るようにする
          if (/準々決勝/.test(s)) return 70;
          if (/準決勝/.test(s)) return 80;
          if (/決勝/.test(s)) return 100;
          // 回戦表記から数字を抽出して順位付け（大きい数字ほど後）
          const m = s.match(/(\d+)/);
          if (m) return parseInt(m[1], 10) * 10;
          // その他は低優先度
          return 10;
        };

        const rx = rank(x.round);
        const ry = rank(y.round);
        if (rx !== ry) return rx - ry;
        // フォールバック: 文字列で安定ソート
        if (x.round && y.round) {
          return String(x.round).localeCompare(String(y.round));
        }
        return 0;
      });
      map.set(entryNo, rows);
    }

    return map;
  }, [detail, buildNameForEntry, buildOpponentPlayerIds, shouldUseShortOpponentName]);

  // build name list from entries & eliminatedEntries
  const groupedNames = [...new Set([...(detail.entries ?? []).map((e) => buildNameForEntry(e))])];

  // derive seed entry numbers from detail.entries if not provided
  const derivedSeedEntryNos: Set<number> = new Set();
  for (const e of detail.entries ?? []) {
    // assume entry.type can be 'seed' or 'シード' or similar; be permissive
    if (e.type && typeof e.type === 'string') {
      if (e.type.includes('seed')) {
        derivedSeedEntryNos.add(e.entryNo);
      }
    }
  }

  // Check if there are any knockout matches
  const hasKnockoutStage = useMemo(() => {
    return (detail.matches ?? []).some((m) => m.stage === 'knockout');
  }, [detail]);

  const derivedResultByEntryNo: Record<number, string | undefined> = {};
  for (const r of detail.results ?? []) {
    const parts: string[] = [];
    if (r.tournament && r.tournament.label) {
      parts.push(r.tournament.label);
    } else if (hasKnockoutStage) {
      parts.push('予選敗退');
    }
    if (r.roundrobin) {
      const group = r.roundrobin.group ?? '';
      const rank = r.roundrobin.rank ?? '';
      parts.push(`グループ${group} ${rank}位`);
    }
    derivedResultByEntryNo[r.entryNo] = parts.length > 0 ? parts.join(' / ') : undefined;
  }

  // getEntryName removed; use buildNameForEntry directly where needed

  // 1 組ぶんの表示に必要なものをまとめてから、検索 → 上位/その他 の順に振り分ける。
  // 振り分けを MatchGroup ではなくここでやるのは、「その他」を <details> に入れるため
  // 件数を先に知る必要があるのと、0 件のときに文言を出せるようにするため。
  const allItems = groupedNames.map((name) => {
    const entry = (detail.entries ?? []).find((e) => buildNameForEntry(e) === name);
    const entryNo = entry?.entryNo ?? -1;
    const matchGroup = matchesByEntry.get(entryNo) ?? [];
    // keep original matchGroup, and separately compute expandedRows
    const extraRows = expandMatchGroup(entryNo, matchGroup);
    const resultLabel = derivedResultByEntryNo[entryNo] ?? '';

    return {
      name,
      nameParts: entry ? buildNamePartsForEntry(entry) : undefined,
      entryNo,
      matchGroup,
      extraRows,
      isSeed: derivedSeedEntryNos.has(Number(entryNo) ?? -1),
      resultLabel,
      isTop: TOP_RESULT_LABELS.some((tag) => resultLabel.includes(tag)),
    };
  });

  const hasTeamMatches = (detail.matches ?? []).some((m) => (m.matches?.length ?? 0) > 0);

  const query = searchQuery.trim().toLowerCase();
  const visibleItems = query ? allItems.filter((item) => item.name.toLowerCase().includes(query)) : allItems;
  const collapsible = allItems.length > COLLAPSE_MIN_ENTRIES;
  // 上位・その他とも並びはエントリー順（ユーザー確定）。detail.entries は全427ファイルで
  // entryNo 昇順であることを確認済みなので、groupedNames の順をそのまま使えば足りる。
  const topItems = collapsible ? visibleItems.filter((item) => item.isTop) : visibleItems;
  const restItems = collapsible ? visibleItems.filter((item) => !item.isTop) : [];

  // 検索中は「その他」を開いたままにする。ユーザーが自分で開閉したときだけ状態を持つ。
  const restOpen = showRest || query.length > 0;

  // 状態の1行。検索中は絞り込み結果の件数を出す（母数の話をしても読み手の関心とずれる）。
  // 0 件のときは下に空状態の文面が出るので、ここでは何も出さない。
  const statusText = !collapsible
    ? null
    : query.length > 0
      ? visibleItems.length > 0
        ? `「${searchQuery.trim()}」に一致する${visibleItems.length}組を表示しています。`
        : null
      : restOpen
        ? `全${allItems.length}組を表示しています。`
        : topItems.length > 0
          ? `全${allItems.length}組のうち、ベスト8以上の${topItems.length}組を表示しています。`
          : `組数が多いので、全${allItems.length}組を畳んでいます。`;

  // 上位ラベルが1件も無い大会（全427件中20件）では「その他」に全組が入るので言い方を変える。
  const restChipLabel = topItems.length > 0 ? `その他の${restItems.length}組を表示` : `全${restItems.length}組を表示`;
  const restHideLabel = topItems.length > 0 ? `その他の${restItems.length}組を隠す` : `全${restItems.length}組を隠す`;
  // 検索中は下の `<details>` が強制的に開いていて閉じられないので、上のチップは出さない。
  // 開いている間も消さずにラベルだけ入れ替える（押した直後にボタンが消えるとフォーカスが飛ぶ）。
  const showTopChip = restItems.length > 0 && query.length === 0;

  const toggleRest = () => {
    const next = !showRest;
    setShowRest(next);
    // 開いたぶんの変化は数画面下で起きるので、その位置まで送る。
    // details 自身の位置は開閉で変わらないため、state の反映を待たずに呼んでよい。
    if (next) restRef.current?.scrollIntoView();
  };

  const renderItem = (item: (typeof allItems)[number]) => (
    <MatchGroup
      key={item.name}
      name={item.name}
      nameParts={item.nameParts}
      entryNo={item.entryNo}
      matchGroup={item.matchGroup}
      extraRows={item.extraRows}
      isSeed={item.isSeed}
      resultLabel={item.resultLabel}
      defaultOpen={item.isTop}
    />
  );

  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold mb-3">対戦詳細</h2>

      <p className="mb-3 text-sm text-text-secondary">1 組ずつの勝ち上がりとスコアです。</p>
      {hasTeamMatches && (
        <p className="mb-3 text-xs text-text-muted">
          ※ 公式記録に対戦ごとの記録がある試合は、各対戦の出場ペアと本数も載せています。左がその組、右が対戦相手です。
        </p>
      )}

      <div className="mb-4">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="選手名や所属で検索"
          aria-label="対戦詳細を選手名や所属で検索"
          className="h-9 w-full max-w-xs px-3 py-1 text-sm border border-border-strong rounded shadow-sm dark:bg-gray-900 dark:text-white"
        />
      </div>

      {/* 「いま何組のうち何組を見ているか」は説明文ではなくこの行とチップで出す。
          畳まれていることに気づかないまま離脱していたため（下のチップだけでは
          上位の組を全部スクロールしないと目に入らない）。 */}
      {statusText && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-text-secondary">{statusText}</p>
          {showTopChip && (
            <button
              type="button"
              aria-expanded={showRest}
              aria-controls={REST_SECTION_ID}
              onClick={toggleRest}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-bg-subtle px-4 py-2 text-sm font-semibold text-text hover:bg-surface"
            >
              {showRest ? restHideLabel : restChipLabel}
              <span aria-hidden className="text-text-muted">
                {showRest ? '▲' : '▼'}
              </span>
            </button>
          )}
        </div>
      )}

      {visibleItems.length === 0 && (
        <div className="mb-6 text-sm">
          <p>「{searchQuery}」に一致する組がありません。</p>
          <p className="mt-1 text-xs text-text-muted">選手名は大会結果の表記で登録されています。姓だけ、または所属名だけでも試せます。</p>
          <button type="button" onClick={() => setSearchQuery('')} className="mt-2 text-sm text-link hover:underline">
            検索をクリア
          </button>
        </div>
      )}

      {topItems.map(renderItem)}

      {restItems.length > 0 && (
        <details
          id={REST_SECTION_ID}
          ref={restRef}
          open={restOpen}
          // scroll-mt-20 は上の sticky ヘッダー（h-16）のぶん。サイト内の他のアンカーと同じ値。
          className="group scroll-mt-20"
          onToggle={(e) => {
            // 検索によって開いた分は状態に持ち込まない（検索を消したら畳んだ状態へ戻す）。
            if (query.length === 0) setShowRest((e.currentTarget as HTMLDetailsElement).open);
          }}
        >
          {/* 中身がカードの列なので、ここを囲むとカードの二重になる。区切りは summary の1行だけにする。
              チップ型なのは上のチップと同じ見た目に揃えるため。リンク色は使わない
              （別ページへ遷移するように見える。PlayerMajorResults.tsx の慣例）。 */}
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full border border-border-strong bg-bg-subtle px-4 py-2 text-sm font-semibold text-text hover:bg-surface">
            {restChipLabel}
            <span aria-hidden className="text-text-muted group-open:hidden">
              ▼
            </span>
            <span aria-hidden className="hidden text-text-muted group-open:inline">
              ▲
            </span>
          </summary>
          <div className="pt-4">{restItems.map(renderItem)}</div>
        </details>
      )}
    </section>
  );
}
