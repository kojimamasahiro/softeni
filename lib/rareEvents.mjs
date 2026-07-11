// lib/rareEvents.mjs
// 希少ポイント/ゲームイベント検知（相対評価・ポジティブ限定。比較スコープは config.scope）。
// ADR-005 の「イベント抽出」レイヤの score 版。文章生成はせず、構造化イベント＋素文 label を返す。
//
// 設計: docs/raw/2026-07-11-rare-event-sns-plan.md / docs/wiki/rare-events.md
// 方針（2026-07-11 決定）:
//  - 絶対閾値でなく「比較プール内で最大」の相対評価を既定にする。プールは config.scope で
//    切り替え（2026-07-12 から 'all-time'＝記録済み全試合。記録できない試合の方が多く、
//    大会単位では分母が薄すぎるため）。
//  - 何を希少とするかは RARE_EVENT_CONFIG に集約し、scripts/rare-events-report.mjs で
//    定義変更→歩留まり確認を回せるようにする（ハーネス）。
//  - データが少ないうちの誤検知（見かけ上の「大会最長」等）は許容。ただし表示側は必ず
//    scopeNote（記録済み試合の範囲での比較である旨）を添える。
//
// スコア再構成の規則は lib/matchRules.ts と同一（通常4点先取・ファイナル7点先取・2点差）。
// .mjs からは TS を import できないため定数をここに複製している。変更時は両方を揃えること。

const NORMAL_GAME_WIN_POINTS = 4;
const FINAL_GAME_WIN_POINTS = 7;

/**
 * 「何を希少とするか」の定義（ハーネスの調整対象）。
 * enabled を切る・閾値を変えたら scripts/rare-events-report.mjs を再実行して
 * カテゴリ別の候補数・分布を確認する。
 *
 * min* 閾値の意図: 「大会最大」は必ず1件成立してしまうため、絶対値として語るに
 * 値しない最大値（例: 最長ラリーが3球）を候補から落とすための下限。
 */
/**
 * maxTies: 「大会最大」が同値で並んだとき許容する件数。超えた場合はその開催で
 * このカテゴリを出さない（例: 2点差逆転が6ゲームで並ぶ → もはや希少ではない）。
 * null は無制限。
 */
export const RARE_EVENT_CONFIG = {
  /**
   * 希少判定の比較スコープ。
   * - 'all-time': 記録済み全試合（大会紐付けあり）の横断比較。既定（2026-07-12〜）。
   *   記録できない試合の方が多く、大会単位だと分母が薄すぎて「大会最長」の意味が弱いため。
   * - 'tournament': 大会開催（tournament_id × year）単位の相対評価（当初案。データが増えたら再検討）。
   */
  scope: 'all-time',
  categories: {
    // 大会最長ラリー（rally_count 最大。rally_count 未記録=0/null は分母から除外）
    'longest-rally': { enabled: true, minRally: 9, maxTies: 3 },
    // サービスエース（0.3%と実際に希少なので全件・絶対判定。maxTies は上限件数として使う）
    'service-ace': { enabled: true, maxTies: 5 },
    // 大会最長のデュースゲーム（デュース到達ゲームのうち総ポイント数最大）
    'longest-deuce': { enabled: true, minTotalPoints: 9, maxTies: 3 },
    // 最大ビハインドからの逆転ゲーム（勝者が喫した最大点差）
    'biggest-comeback': { enabled: true, minDeficit: 2, maxTies: 3 },
    // 大会最多の連続ポイント（同一チームの連取。試合内・ゲーム跨ぎ可）
    'longest-point-streak': { enabled: true, minStreak: 5, maxTies: 3 },
  },
  /**
   * 昇格済みの組み合わせパターン（発見ハーネス scripts/rare-events-discover.mjs で見つけ、
   * 人がレビューして命名したものだけをここに足す）。conditions は listPointsWithFeatures の
   * 特徴量（feature: value）の AND。例:
   *   { id: 'receive-side-smash', label: 'レシーブ側のスマッシュポイント',
   *     conditions: { result: 'smash_winner', winner_side: 'receive' }, enabled: true, maxTies: 5 }
   */
  patterns: [],
};

/** スコープ別の文言（ラベル前置と注記）。 */
export const SCOPE_WORDING = {
  tournament: {
    sup: 'この大会', // 最上級の前置: 「この大会最長の〜」
    in: 'この大会で', // 件数の前置: 「この大会で計N本」
    note: '「この大会」は当サイトでスコア記録した試合の範囲での比較',
  },
  'all-time': {
    sup: '記録済み全試合で',
    in: '記録済み全試合で',
    note: '当サイトでスコア記録した全試合の中での比較',
  },
};

const KIND_ORDER = ['longest-rally', 'service-ace', 'longest-deuce', 'biggest-comeback', 'longest-point-streak', 'pattern'];

// ---------------------------------------------------------------------------
// 表示名ヘルパー（scripts/generate-match-reverse-index.mjs と同規約）
// ---------------------------------------------------------------------------

const joinPlayerName = (lastName, firstName) => {
  const last = (lastName ?? '').toString().trim();
  const first = (firstName ?? '').toString().trim();
  if (last && first) return `${last} ${first}`;
  return last || first;
};

export const buildTeamDisplayName = (match, side) => {
  const p1Last = match[`team_${side}_player1_last_name`];
  if (p1Last) {
    return [
      joinPlayerName(p1Last, match[`team_${side}_player1_first_name`]),
      joinPlayerName(match[`team_${side}_player2_last_name`], match[`team_${side}_player2_first_name`]),
    ]
      .filter(Boolean)
      .join('・');
  }
  return (match[`team_${side}`] ?? '').toString().trim();
};

const teamDisplayOf = (match, team) => buildTeamDisplayName(match, team === 'A' ? 'a' : 'b');

// ---------------------------------------------------------------------------
// スコア再構成（matchRules と同一規則）
// ---------------------------------------------------------------------------

const getRequiredWins = (bestOf) => Math.ceil((typeof bestOf === 'number' && bestOf > 0 ? bestOf : 1) / 2);

const sortedGames = (match) => [...(match.games ?? [])].sort((a, b) => a.game_number - b.game_number);

const sortedPoints = (game) => [...(game.points ?? [])].sort((a, b) => a.point_number - b.point_number);

/**
 * 試合内の各ゲームに、そのゲームが「ファイナルゲームか」と勝利必要ポイント数を付与して列挙する。
 */
const listGamesWithRules = (match) => {
  const requiredWins = getRequiredWins(match.best_of ?? 0);
  let wonA = 0;
  let wonB = 0;
  const result = [];
  for (const game of sortedGames(match)) {
    const isFinal = requiredWins > 1 && wonA === requiredWins - 1 && wonB === requiredWins - 1;
    result.push({ game, winPoints: isFinal ? FINAL_GAME_WIN_POINTS : NORMAL_GAME_WIN_POINTS });
    if (game.winner_team === 'A') wonA += 1;
    if (game.winner_team === 'B') wonB += 1;
  }
  return result;
};

// ---------------------------------------------------------------------------
// ポイントの特徴量化（発見ハーネス・昇格パターン判定の共通基盤）
// ---------------------------------------------------------------------------

/** レポート表示用の特徴量名。 */
export const FEATURE_LABELS = {
  result: '決まり方',
  winner_side: '得点側',
  rally: 'ラリー帯',
  first_serve: '1stサーブ',
  deuce: 'デュース局面',
  game_point: 'ゲームポイント局面',
  final_game: 'ファイナルゲーム',
  shot_type: 'ショット種別',
  shot_course: 'コース',
};

const rallyBucketOf = (rallyCount) => {
  if (typeof rallyCount !== 'number' || rallyCount <= 0) return undefined;
  if (rallyCount <= 2) return '1-2';
  if (rallyCount <= 4) return '3-4';
  if (rallyCount <= 8) return '5-8';
  return '9+';
};

/**
 * 試合内の全ポイントを、スコア文脈込みの特徴量つきで列挙する。
 * 戻り値: [{ match, game, point, features }]
 * features はカテゴリカル値の辞書。**記録が無い特徴量は undefined**（分母から外す）。
 *  - 前衛/後衛のロールは現行データに存在しないため特徴量化できない。
 *    shot_type / shot_course はスキーマにあるが未収録（recording_level: basic）。
 *    記録されるようになれば自動的に発見対象へ合流する。
 */
export const listPointsWithFeatures = (match) => {
  const entries = [];
  const requiredWins = getRequiredWins(match.best_of ?? 0);
  let wonA = 0;
  let wonB = 0;

  for (const game of sortedGames(match)) {
    const isFinal = requiredWins > 1 && wonA === requiredWins - 1 && wonB === requiredWins - 1;
    const winPoints = isFinal ? FINAL_GAME_WIN_POINTS : NORMAL_GAME_WIN_POINTS;
    let scoreA = 0;
    let scoreB = 0;

    for (const point of sortedPoints(game)) {
      const winner = point.winner_team === 'A' || point.winner_team === 'B' ? point.winner_team : null;
      const serving = point.serving_team === 'A' || point.serving_team === 'B' ? point.serving_team : null;
      // ポイント開始時点（このポイントが打たれる前）のスコア文脈
      const isDeuce = scoreA >= winPoints - 1 && scoreB >= winPoints - 1;
      const hasGamePoint = (scoreA >= winPoints - 1 && scoreA - scoreB >= 1) || (scoreB >= winPoints - 1 && scoreB - scoreA >= 1);

      const features = {
        result: point.result_type || undefined,
        winner_side: winner && serving ? (winner === serving ? 'serve' : 'receive') : undefined,
        rally: rallyBucketOf(point.rally_count),
        first_serve: typeof point.first_serve_fault === 'boolean' ? (point.first_serve_fault ? 'fault' : 'in') : undefined,
        deuce: isDeuce ? 'yes' : 'no',
        game_point: hasGamePoint ? 'yes' : 'no',
        final_game: isFinal ? 'yes' : 'no',
        shot_type: point.shot_type || undefined,
        shot_course: point.shot_course || undefined,
      };

      entries.push({ match, game, point, features });

      if (winner === 'A') scoreA += 1;
      if (winner === 'B') scoreB += 1;
    }
    if (game.winner_team === 'A') wonA += 1;
    if (game.winner_team === 'B') wonB += 1;
  }
  return entries;
};

/** 特徴量辞書が conditions（feature: value の AND）を満たすか。 */
export const matchesConditions = (features, conditions) => {
  return Object.entries(conditions).every(([feature, value]) => features[feature] === value);
};

// ---------------------------------------------------------------------------
// 大会（開催）単位のグルーピング
// ---------------------------------------------------------------------------

export const editionKeyOf = (match) => {
  if (!match?.tournament_id || match?.tournament_year == null) return null;
  return `${match.tournament_id}::${match.tournament_year}`;
};

/**
 * 試合一覧を「大会開催（tournament_id × year）」単位にグルーピングする。
 * 大会に紐づかない試合（野良・練習試合）は対象外（プライバシー方針: 運営記録の掲載大会のみ）。
 */
export const groupMatchesByEdition = (matches) => {
  const editions = new Map();
  for (const match of matches) {
    const key = editionKeyOf(match);
    if (!key) continue;
    if (!editions.has(key)) {
      editions.set(key, {
        key,
        tournamentId: match.tournament_id,
        year: match.tournament_year,
        matches: [],
      });
    }
    editions.get(key).matches.push(match);
  }
  return editions;
};

/**
 * config.scope に応じた比較プールを作る。
 * - 'all-time': 大会紐付けのある全試合を1プールに（既定）。野良・練習試合は
 *   プライバシー方針どおり対象外のまま（運営記録の掲載大会のみ）。
 * - 'tournament': 大会開催単位のプール（当初案）。
 */
export const buildScopePools = (matches, config = RARE_EVENT_CONFIG) => {
  const scope = config.scope ?? 'all-time';
  if (scope === 'tournament') return [...groupMatchesByEdition(matches).values()];
  return [{ key: 'all-time', tournamentId: null, year: null, matches: matches.filter((m) => editionKeyOf(m) != null) }];
};

// ---------------------------------------------------------------------------
// 検知本体
// ---------------------------------------------------------------------------

const buildVideoUrl = (match, point) => {
  if (!match.youtube_video_id) return null;
  if (point?.video_start_ms == null) return null;
  const seconds = Math.floor(point.video_start_ms / 1000);
  return `https://www.youtube.com/watch?v=${match.youtube_video_id}${seconds > 0 ? `&t=${seconds}s` : ''}`;
};

const matchDetailPath = (match) =>
  match.siteLink?.tournamentPath ? `${match.siteLink.tournamentPath}/matches/${match.id}` : `/beta/matches-results/${match.id}`;

// 大会情報はプールでなく試合ごとに保持する（all-time プールは大会をまたぐため）
const baseEvent = (kind, scope, match) => ({
  kind,
  scope,
  tournamentId: match.tournament_id,
  year: match.tournament_year ?? null,
  matchId: match.id,
  round: match.round_name ?? null,
  teamA: teamDisplayOf(match, 'A'),
  teamB: teamDisplayOf(match, 'B'),
  detailPath: matchDetailPath(match),
});

/**
 * 1プールぶん（scope='all-time' なら記録済み全試合、'tournament' なら1開催）の
 * 試合列から希少イベントを検知する。
 * 戻り値: { events, stats }
 *  - events: RareEvent[]（label 付き・重要度順ではなく KIND_ORDER 順）
 *  - stats: レポート（ハーネス）用の分布データ。閾値調整の材料。
 */
export const detectRareEvents = (pool, config = RARE_EVENT_CONFIG) => {
  const scope = config.scope ?? 'all-time';
  const wording = SCOPE_WORDING[scope] ?? SCOPE_WORDING['all-time'];
  const events = [];
  const stats = {
    matchCount: pool.matches.length,
    pointCount: 0,
    ralliesTop: [], // { rally, matchId } 降順
    aceCount: 0,
    deuceGames: [], // { totalPoints, matchId, gameNumber }
    comebacks: [], // { deficit, matchId, gameNumber }
    streaks: [], // { streak, matchId }
  };

  // --- ポイント横断走査（rally / ace / streak） ---
  let bestRally = { rally: 0, entries: [] };
  const aces = [];
  let bestStreak = { streak: 0, entries: [] };

  for (const match of pool.matches) {
    let streakTeam = null;
    let streakLen = 0;
    let streakStart = null; // { game, point }
    let matchMaxStreak = 0;

    for (const { game } of listGamesWithRules(match)) {
      for (const point of sortedPoints(game)) {
        stats.pointCount += 1;

        // longest-rally
        const rally = typeof point.rally_count === 'number' ? point.rally_count : 0;
        if (rally > 0) {
          stats.ralliesTop.push({ rally, matchId: match.id });
          if (rally > bestRally.rally) {
            bestRally = { rally, entries: [{ match, game, point }] };
          } else if (rally === bestRally.rally && rally > 0) {
            bestRally.entries.push({ match, game, point });
          }
        }

        // service-ace
        if (point.result_type === 'service_ace') {
          stats.aceCount += 1;
          aces.push({ match, game, point });
        }

        // longest-point-streak（試合内・ゲーム跨ぎで連取を数える）
        const winner = point.winner_team === 'A' || point.winner_team === 'B' ? point.winner_team : null;
        if (winner) {
          if (winner === streakTeam) {
            streakLen += 1;
          } else {
            streakTeam = winner;
            streakLen = 1;
            streakStart = { game, point };
          }
          matchMaxStreak = Math.max(matchMaxStreak, streakLen);
          if (streakLen > bestStreak.streak) {
            bestStreak = {
              streak: streakLen,
              entries: [{ match, team: winner, start: streakStart, endGame: game, endPoint: point }],
            };
          } else if (streakLen === bestStreak.streak && streakLen > 0) {
            const last = bestStreak.entries[bestStreak.entries.length - 1];
            // 同一連取の途中経過で重複登録しない（最後に登録した streak の終端を更新）
            if (last && last.match.id === match.id && last.start?.point?.id === streakStart?.point?.id) {
              last.endGame = game;
              last.endPoint = point;
            } else {
              bestStreak.entries.push({ match, team: winner, start: streakStart, endGame: game, endPoint: point });
            }
          }
        }
      }
    }
    if (matchMaxStreak > 0) stats.streaks.push({ streak: matchMaxStreak, matchId: match.id });
  }

  stats.ralliesTop.sort((a, b) => b.rally - a.rally);
  stats.ralliesTop = stats.ralliesTop.slice(0, 10);

  // --- ゲーム横断走査（deuce / comeback） ---
  let bestDeuce = { totalPoints: 0, entries: [] };
  let bestComeback = { deficit: 0, entries: [] };

  for (const match of pool.matches) {
    for (const { game, winPoints } of listGamesWithRules(match)) {
      const points = sortedPoints(game).filter((p) => p.winner_team === 'A' || p.winner_team === 'B');
      if (points.length === 0) continue;

      let scoreA = 0;
      let scoreB = 0;
      let reachedDeuce = false;
      const gameWinner = game.winner_team === 'A' || game.winner_team === 'B' ? game.winner_team : null;
      let maxDeficit = 0;

      for (const point of points) {
        if (gameWinner) {
          const winnerScore = gameWinner === 'A' ? scoreA : scoreB;
          const loserScore = gameWinner === 'A' ? scoreB : scoreA;
          maxDeficit = Math.max(maxDeficit, loserScore - winnerScore);
        }
        if (point.winner_team === 'A') scoreA += 1;
        else scoreB += 1;
        if (scoreA >= winPoints - 1 && scoreB >= winPoints - 1) reachedDeuce = true;
      }

      // longest-deuce
      if (reachedDeuce) {
        stats.deuceGames.push({ totalPoints: points.length, matchId: match.id, gameNumber: game.game_number });
        if (points.length > bestDeuce.totalPoints) {
          bestDeuce = { totalPoints: points.length, entries: [{ match, game, lastPoint: points[points.length - 1] }] };
        } else if (points.length === bestDeuce.totalPoints) {
          bestDeuce.entries.push({ match, game, lastPoint: points[points.length - 1] });
        }
      }

      // biggest-comeback
      if (gameWinner && maxDeficit > 0) {
        stats.comebacks.push({ deficit: maxDeficit, matchId: match.id, gameNumber: game.game_number });
        if (maxDeficit > bestComeback.deficit) {
          bestComeback = { deficit: maxDeficit, entries: [{ match, game, team: gameWinner, lastPoint: points[points.length - 1] }] };
        } else if (maxDeficit === bestComeback.deficit) {
          bestComeback.entries.push({ match, game, team: gameWinner, lastPoint: points[points.length - 1] });
        }
      }
    }
  }

  // --- イベント化（config で有効なカテゴリのみ） ---
  const cats = config.categories ?? {};
  stats.suppressed = []; // maxTies 超過で出さなかったカテゴリ（レポート用）

  /** 同値タイが maxTies を超えたら「もはや希少ではない」としてカテゴリごと落とす。 */
  const applyMaxTies = (kind, entries) => {
    const maxTies = cats[kind]?.maxTies ?? null;
    if (maxTies != null && entries.length > maxTies) {
      stats.suppressed.push({ kind, ties: entries.length, maxTies });
      return [];
    }
    return entries;
  };

  if (cats['longest-rally']?.enabled && bestRally.rally >= (cats['longest-rally'].minRally ?? 1)) {
    for (const { match, game, point } of applyMaxTies('longest-rally', bestRally.entries)) {
      events.push({
        ...baseEvent('longest-rally', scope, match),
        gameId: game.id,
        gameNumber: game.game_number,
        pointId: point.id,
        pointNumber: point.point_number,
        subjectTeam: point.winner_team === 'A' || point.winner_team === 'B' ? point.winner_team : null,
        detail: { rallyCount: bestRally.rally },
        videoUrl: buildVideoUrl(match, point),
        label: `${wording.sup}最長の${bestRally.rally}本ラリー`,
      });
    }
  }

  if (cats['service-ace']?.enabled) {
    const soleAce = aces.length === 1;
    for (const { match, game, point } of applyMaxTies('service-ace', aces)) {
      events.push({
        ...baseEvent('service-ace', scope, match),
        gameId: game.id,
        gameNumber: game.game_number,
        pointId: point.id,
        pointNumber: point.point_number,
        subjectTeam: point.serving_team === 'A' || point.serving_team === 'B' ? point.serving_team : null,
        subjectPlayer: point.serving_player ?? null,
        detail: { totalInTournament: aces.length },
        videoUrl: buildVideoUrl(match, point),
        label: soleAce ? `${wording.sup}唯一のサービスエース` : `サービスエース（${wording.in}計${aces.length}本）`,
      });
    }
  }

  if (cats['longest-deuce']?.enabled && bestDeuce.totalPoints >= (cats['longest-deuce'].minTotalPoints ?? 1)) {
    for (const { match, game, lastPoint } of applyMaxTies('longest-deuce', bestDeuce.entries)) {
      events.push({
        ...baseEvent('longest-deuce', scope, match),
        gameId: game.id,
        gameNumber: game.game_number,
        pointId: lastPoint.id,
        pointNumber: lastPoint.point_number,
        subjectTeam: game.winner_team === 'A' || game.winner_team === 'B' ? game.winner_team : null,
        detail: { totalPoints: bestDeuce.totalPoints, finalScore: `${game.points_a}-${game.points_b}` },
        videoUrl: buildVideoUrl(match, lastPoint),
        label: `${wording.sup}最長のデュースゲーム（第${game.game_number}ゲーム・全${bestDeuce.totalPoints}ポイント）`,
      });
    }
  }

  if (cats['biggest-comeback']?.enabled && bestComeback.deficit >= (cats['biggest-comeback'].minDeficit ?? 1)) {
    for (const { match, game, team, lastPoint } of applyMaxTies('biggest-comeback', bestComeback.entries)) {
      events.push({
        ...baseEvent('biggest-comeback', scope, match),
        gameId: game.id,
        gameNumber: game.game_number,
        pointId: lastPoint.id,
        pointNumber: lastPoint.point_number,
        subjectTeam: team,
        detail: { deficit: bestComeback.deficit, finalScore: `${game.points_a}-${game.points_b}` },
        videoUrl: buildVideoUrl(match, lastPoint),
        label: `${wording.sup}最大の${bestComeback.deficit}点差逆転ゲーム（第${game.game_number}ゲーム）`,
      });
    }
  }

  if (cats['longest-point-streak']?.enabled && bestStreak.streak >= (cats['longest-point-streak'].minStreak ?? 1)) {
    for (const { match, team, start, endGame } of applyMaxTies('longest-point-streak', bestStreak.entries)) {
      if (!start) continue;
      events.push({
        ...baseEvent('longest-point-streak', scope, match),
        gameId: start.game.id,
        gameNumber: start.game.game_number,
        pointId: start.point.id,
        pointNumber: start.point.point_number,
        subjectTeam: team,
        detail: {
          streak: bestStreak.streak,
          startGameNumber: start.game.game_number,
          endGameNumber: endGame.game_number,
        },
        videoUrl: buildVideoUrl(match, start.point),
        label: `${wording.sup}最多の${bestStreak.streak}連続ポイント`,
      });
    }
  }

  // --- 昇格済みパターン（発見ハーネス由来。conditions AND 一致の全件・絶対判定） ---
  for (const pattern of config.patterns ?? []) {
    if (!pattern?.enabled || !pattern.conditions) continue;
    const hits = [];
    for (const match of pool.matches) {
      for (const entry of listPointsWithFeatures(match)) {
        if (matchesConditions(entry.features, pattern.conditions)) hits.push(entry);
      }
    }
    const maxTies = pattern.maxTies ?? 5;
    if (hits.length === 0) continue;
    if (hits.length > maxTies) {
      stats.suppressed.push({ kind: `pattern:${pattern.id}`, ties: hits.length, maxTies });
      continue;
    }
    for (const { match, game, point } of hits) {
      events.push({
        ...baseEvent('pattern', scope, match),
        patternId: pattern.id,
        gameId: game.id,
        gameNumber: game.game_number,
        pointId: point.id,
        pointNumber: point.point_number,
        subjectTeam: point.winner_team === 'A' || point.winner_team === 'B' ? point.winner_team : null,
        detail: { totalInTournament: hits.length, ...pattern.conditions },
        videoUrl: buildVideoUrl(match, point),
        label: hits.length === 1 ? `${wording.sup}唯一の${pattern.label}` : `${pattern.label}（${wording.in}計${hits.length}本）`,
      });
    }
  }

  for (const event of events) {
    event.scopeNote = wording.note;
    // 動画リンクの有無が投稿価値を大きく左右する（動画なしはサイト内表示のみ）
    event.postable = Boolean(event.videoUrl);
  }
  events.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));

  return { events, stats };
};

/**
 * 全試合からイベントを検知する（プール構成は config.scope に従う）。
 * 戻り値: { events, pools: [{ key, tournamentId, year, stats }] }
 */
export const detectAllRareEvents = (matches, config = RARE_EVENT_CONFIG) => {
  const events = [];
  const pools = [];
  for (const pool of buildScopePools(matches, config)) {
    const { events: poolEvents, stats } = detectRareEvents(pool, config);
    events.push(...poolEvents);
    pools.push({ key: pool.key, tournamentId: pool.tournamentId ?? null, year: pool.year ?? null, stats });
  }
  return { events, pools };
};

// ---------------------------------------------------------------------------
// SNS 投稿テンプレ（手動投稿用・テンプレート主義: ADR-005）
// ---------------------------------------------------------------------------

/**
 * 手動投稿用のテンプレ文を組み立てる。LLM は使わない（誤り混入ゼロ・決定的）。
 * 実名の扱いは大会結果としてすでに公開している範囲と同一（成績・希少プレー以外の評価的言及はしない）。
 */
export const buildPostText = (event, { tournamentLabel, siteBaseUrl = 'https://softeni-pick.com' }) => {
  const name = tournamentLabel ?? event.tournamentId;
  const matchup = `${event.teamA} vs ${event.teamB}${event.round ? `（${event.round}）` : ''}`;
  const detailUrl = `${siteBaseUrl}${event.detailPath}/${event.pointId ? `?pointId=${event.pointId}` : ''}`;
  const lines = [`🎾 ${name} ${event.year}`, event.label, matchup];
  if (event.videoUrl) {
    lines.push('その瞬間はこちら👇', event.videoUrl);
  }
  lines.push(`スコア詳細: ${detailUrl}`);
  return lines.join('\n');
};
