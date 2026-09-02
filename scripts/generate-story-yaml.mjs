// scripts/generate-story-yaml.mjs
// 大会インサイト（過去の事実ベース5分類ストーリー）の構造化データを YAML で生成する。
//
// 運用手順のステップ1。ここは **決定的なロジックのみ**で、LLMは使わない
// （LLMの役割は事実を作ることではなく、出来上がった事実を読み物に編集すること）。
// 設計: docs/raw/2026-08-01-idea-news-fact-based-story-categories.md
//
// 方針:
//  - 生成段階では候補を絞らない（抽出とキュレーションの責務を分離する）。優先度は付けるが
//    切り捨てはせず、選定は後段（人・LLM）に任せる。
//  - 「該当なし」を独立ストーリーにしない。関連ストーリーの notes.absence に吸収する。
//  - 評価情報は事実から機械的に算出できる範囲（連続年数・期待勝率・「初」フラグ）に留める。
//
// 使い方:
//   node scripts/generate-story-yaml.mjs -t zennihon-championship -y 2025
//   node scripts/generate-story-yaml.mjs -t highschool-championship -y 2025 -c team-none-boys -o out.yaml
//
// 出力を必ず scripts/verify-story-text.mjs に通すこと（生成ロジック自体のバグを検出するため）。

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DETAILS_DIR = path.join(ROOT, 'data', 'tournaments', 'details');
const INDEX_PATH = path.join(ROOT, 'data', 'tournaments', 'index.json');
const UPSETS_PATH = path.join(ROOT, 'data', 'ratings', 'upsets.json');

const SCOPE_NOTE = '当サイト収録大会分の集計に基づきます。';

// 閾値。実測（docs/raw/2026-08-01-idea-... 2.）で決めた値。
const PLAYER_STREAK_MIN = 3; // 選手の連続ベスト8以上
const SCHOOL_STREAK_MIN = 4; // 学校の連続ベスト8以上
const BOTH_EVENTS_MIN = 3; // 団体×個人の両輪
const STREAK_STOPPED_MIN = 3; // 途切れたと言うのに必要だった連続年数

// 優先度（小さいほど上位）。lib/milestones.ts の KIND_IMPORTANCE に揃える。
const PRIORITY = {
  'title-won': 1, // 当年の優勝。ニュースの主語になるので最上位
  'giant-killing': 4,
  'best8-streak': 6,
  'self-best': 7,
  'streak-stopped': 8,
  'school-both-events': 8.5,
  'school-best8-streak': 9,
  'pair-rematch': 5,
  'recurring-matchup': 5.5,
  'watched-eliminated': 2, // 進行中: 注目主体の敗退（確定事実）
  'watched-advancing': 3, // 進行中: 注目主体の勝ち残り
  'watched-school-progress': 2.5, // 進行中: 学校ごとの残存組数（個人戦の集約）
  'watched-title-watch': 2.8, // 進行中: 過去に優勝歴がある学校が、まだ生き残っている
  'watched-self-best': 3.2, // 進行中: 選手の自己ベスト更新が確定
  'watched-school-peak': 3.4, // 進行中: 学校の歴代最高（ピーク）更新が確定
};

// ---------------------------------------------------------------- 共通

const normalize = (s) => (s ?? '').toString().replace(/\s|　/g, '');
const teamKey = (s) => normalize(s).replace(/(高等学校|高校|中学校|中学|大学)$/, '');
const RANK_LABEL = { 100: '優勝', 90: '準優勝', 80: 'ベスト4', 70: 'ベスト8' };

function rankScore(rank) {
  if (!rank) return null;
  if (rank.kind === 'winner') return 100;
  if (rank.kind === 'runnerup') return 90;
  if (rank.kind === 'best') return { 4: 80, 8: 70 }[rank.bestLevel] ?? null;
  // ベスト8未満は「N回戦敗退」でドロー規模に依存するため年度間比較に使えない。
  return null;
}

const fullName = (p) => normalize(p?.lastName) + normalize(p?.firstName);
/** 姓のみ（firstName欠落）の選手。同姓同名の衝突率が跳ね上がるため選手単位の判定から外す。 */
const isNameOnly = (p) => !!normalize(p?.lastName) && !normalize(p?.firstName);

// ---------------------------------------------------------------- 読み込み

function listYears(tournamentId, categoryId) {
  const base = path.join(DETAILS_DIR, tournamentId);
  if (!fs.existsSync(base)) throw new Error(`大会が見つかりません: ${tournamentId}`);
  return fs
    .readdirSync(base)
    .filter((y) => /^\d{4}$/.test(y) && fs.existsSync(path.join(base, y, `${categoryId}.json`)))
    .map(Number)
    .sort((a, b) => a - b);
}

function listCategories(tournamentId, year) {
  const dir = path.join(DETAILS_DIR, tournamentId, String(year));
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5));
}

/** 1種目ぶんの全年度インデックス。 */
function buildIndex(tournamentId, categoryId) {
  const years = listYears(tournamentId, categoryId);
  const editions = new Map();
  const player = new Map(); // 氏名 -> { year: {score,label} }
  const school = new Map(); // 校名キー -> { year: {score,label} }
  const playerEntry = new Map(); // 氏名 -> Set<year>
  const meetings = new Map(); // '主語A' 対 '主語B' -> [{year, round, winner}]
  const finals = new Map(); // year -> {winner, loser, score}
  const semifinals = new Map(); // year -> [{winner, loser, score}]
  let nameOnlySeen = false;
  let mixedPairs = 0;
  let totalPairs = 0;

  for (const year of years) {
    const detail = JSON.parse(fs.readFileSync(path.join(DETAILS_DIR, tournamentId, String(year), `${categoryId}.json`), 'utf8'));
    const byId = new Map((detail.participants ?? []).map((p) => [p.id, p]));
    const entryPlayers = new Map();

    for (const entry of detail.entries ?? []) {
      const players = (entry.playerIds ?? []).map((id) => byId.get(id)).filter(Boolean);
      entryPlayers.set(entry.entryNo, players);
      for (const p of players) {
        if (isNameOnly(p)) nameOnlySeen = true;
        const n = fullName(p);
        if (n) {
          if (!playerEntry.has(n)) playerEntry.set(n, new Set());
          playerEntry.get(n).add(year);
        }
      }
      if (players.length >= 2) {
        totalPairs += 1;
        if (new Set(players.map((p) => teamKey(p.team))).size > 1) mixedPairs += 1;
      }
    }

    for (const result of detail.results ?? []) {
      const score = rankScore(result?.tournament?.rank);
      if (score == null) continue;
      const label = RANK_LABEL[score];
      const players = entryPlayers.get(result.entryNo) ?? [];
      for (const p of players) {
        const n = fullName(p);
        if (n && !isNameOnly(p)) {
          if (!player.has(n)) player.set(n, {});
          if ((player.get(n)[year]?.score ?? 0) < score) player.get(n)[year] = { score, label };
        }
        const tk = teamKey(p.team);
        if (tk) {
          if (!school.has(tk)) school.set(tk, {});
          if ((school.get(tk)[year]?.score ?? 0) < score) school.get(tk)[year] = { score, label };
        }
      }
    }

    // 対戦カードの主語。団体戦は**学校名**で取る。選手名で取ると団体戦はメンバーが毎年
    // 入れ替わるためカードが一致せず、再戦を1件も検出できない（実際に検出0だった）。
    const isTeamEvent = categoryId.startsWith('team-');
    const side = (no) => {
      const players = entryPlayers.get(no) ?? [];
      const keys = isTeamEvent ? [...new Set(players.map((p) => teamKey(p.team)).filter(Boolean))] : players.map(fullName).filter(Boolean);
      return keys.sort().join('|');
    };

    for (const match of detail.matches ?? []) {
      if (match.winnerEntryNo == null) continue;
      const [a, b] = match.entries ?? [];
      if (a == null || b == null) continue;
      const [ka, kb] = [side(a), side(b)];
      if (!ka || !kb) continue;
      const key = [ka, kb].sort().join(' 対 ');
      if (!meetings.has(key)) meetings.set(key, []);
      meetings.get(key).push({ year, round: match.round ?? null, winner: side(match.winnerEntryNo) });

      // 決勝は当年のニュースの軸になるので単独で持つ。
      const scores = match.scores ?? {};
      const win = scores[String(match.winnerEntryNo)];
      const loseEntry = [a, b].find((no) => no !== match.winnerEntryNo);
      if (match.round === '決勝' && win != null && scores[String(loseEntry)] != null) {
        const finalistTeams = [
          ...new Set([match.winnerEntryNo, loseEntry].flatMap((no) => (entryPlayers.get(no) ?? []).map((p) => teamKey(p.team)).filter(Boolean))),
        ];
        finals.set(year, {
          winner: side(match.winnerEntryNo),
          loser: side(loseEntry),
          score: `${win}-${scores[String(loseEntry)]}`,
          finalistTeams,
        });
      }
      if (match.round === '準決勝' && win != null && scores[String(loseEntry)] != null) {
        if (!semifinals.has(year)) semifinals.set(year, []);
        semifinals.get(year).push({ winner: side(match.winnerEntryNo), loser: side(loseEntry), score: `${win}-${scores[String(loseEntry)]}` });
      }
    }

    editions.set(year, { detail, entryPlayers });
  }

  return {
    years,
    editions,
    player,
    school,
    playerEntry,
    meetings,
    finals,
    semifinals,
    isTeamEvent: categoryId.startsWith('team-'),
    nameOnlySeen,
    mixedPairRate: totalPairs ? mixedPairs / totalPairs : 0,
  };
}

// ---------------------------------------------------------------- 連続の計算

/**
 * targetYear を末尾とする連続年数。
 * **暦年で連続していること**を条件にする。掲載年に欠落がある大会（例 2019, 2022-2025）で
 * 2022 を 2019 の翌年として数えないため。
 */
function streakEndingAt(history, years, targetYear, minScore = 70) {
  const has = (y) => years.includes(y) && (history[y]?.score ?? 0) >= minScore;
  if (!has(targetYear)) return 0;
  let n = 1;
  for (let y = targetYear - 1; has(y); y -= 1) n += 1;
  return n;
}

const yearSeq = (history, years, upto) =>
  years
    .filter((y) => y <= upto && history[y])
    .map((y) => `${y}年${history[y].label}`)
    .join(' / ');

// ---------------------------------------------------------------- 検出

function detect(tournamentId, categoryId, year, idx, upsets) {
  const stories = [];
  const { years, player, school, meetings, finals, semifinals } = idx;
  const prevYears = years.filter((y) => y < year);
  const seq = (n) => stories.filter((s) => s.kind === n).length + 1;
  const mk = (kind, category, extra) => {
    const story = { id: `${tournamentId}-${year}-${categoryId}-${kind}-${seq(kind)}`, category, kind, priority: PRIORITY[kind] ?? 99, ...extra };
    stories.push(story);
    return story;
  };

  // --- 当年の優勝。「今年何が起きたか」が無いと読み物の主語が立たず、経年データの
  //     羅列になってしまう（インターハイ2025の初稿がそうなった）。ニュースの見出しにあたる。
  const final = finals.get(year);
  if (final) {
    const winnerNames = final.winner.split('|');
    const loserNames = final.loser.split('|');
    // 掲載範囲での優勝回数と、前回優勝年。first-title / repeat-title / nth-title の判定材料。
    const titleYears = years.filter((y) => y <= year && finals.get(y)?.winner === final.winner);
    const prevTitle = titleYears.filter((y) => y < year).pop() ?? null;
    const isFirst = titleYears.length === 1;
    const isRepeat = prevTitle === year - 1;

    // 準決勝で誰を倒して決勝に上がったか。ニュースとしての具体性はここで出る。
    const semi = (semifinals.get(year) ?? []).find((m) => m.winner === final.winner);

    // 個人戦で決勝が同一所属同士になったか。ニュースとして強い事実だが、
    // 優勝者と準優勝者を別々に見ている限り出てこない（実際に取りこぼしていた）。
    const finalTeams = idx.isTeamEvent ? null : final.finalistTeams;
    const sameTeamFinal = finalTeams && finalTeams.length === 1 ? finalTeams[0] : null;

    mk('title-won', isFirst ? '成長' : '継続', {
      subject: { [idx.isTeamEvent ? 'teams' : 'players']: winnerNames, subjectKeys: winnerNames, opponents: loserNames },
      round: '決勝',
      facts: {
        runnerUp: loserNames.join('・'),
        finalScore: final.score,
        titleCount: titleYears.length,
        isFirstTitle: isFirst,
        repeatFrom: isRepeat ? titleYears.filter((y, i, a) => a.slice(i).every((v, j) => v === y + j)).length : null,
        previousTitleYear: prevTitle,
        semifinalOpponent: semi ? semi.loser.split('|').join('・') : null,
        semifinalScore: semi ? semi.score : null,
        sameTeamFinal,
      },
      text: `${year}年の優勝は${winnerNames.join('・')}。決勝は${loserNames.join('・')}に${final.score}${
        semi ? `、準決勝は${semi.loser.split('|').join('・')}に${semi.score}` : ''
      }。${sameTeamFinal ? `決勝は${sameTeamFinal}同士の対戦。` : ''}${
        isFirst ? '当サイト収録範囲では初優勝。' : prevTitle ? `前回の優勝は${prevTitle}年。` : ''
      }`,
      scopeNote: SCOPE_NOTE,
    });
  }

  // --- 再会: 同じカードが複数年にわたって繰り返し組まれている（団体戦で強く出る）
  for (const [key, list] of meetings) {
    const rounds = list.filter((m) => m.round === '決勝' || m.round === '準決勝');
    if (rounds.length < 3 || !rounds.some((m) => m.year === year)) continue;
    const [sideA, sideB] = key.split(' 対 ');
    const yearsList = rounds.map((m) => `${m.year}年${m.round}は${m.winner.split('|').join('・')}`).join(' / ');
    mk('recurring-matchup', '再会', {
      subject: {
        [idx.isTeamEvent ? 'teams' : 'players']: [...sideA.split('|'), ...sideB.split('|')],
        subjectKeys: [...sideA.split('|'), ...sideB.split('|')],
      },
      facts: { times: rounds.length, byYear: yearsList },
      text: `${sideA.split('|').join('・')}と${sideB.split('|').join('・')}は、上位ラウンドで${rounds.length}回対戦している（${yearsList}）。`,
      scopeNote: SCOPE_NOTE,
    });
  }

  // --- 逆転: 番狂わせ（既存の内部生成物をそのまま使う）
  for (const e of upsets) {
    if (e.tournamentId !== tournamentId || e.year !== year || e.categoryId !== categoryId) continue;
    const winners = e.winners.map((w) => normalize(w.name));
    const losers = e.losers.map((l) => normalize(l.name));
    mk('giant-killing', '逆転', {
      subject: { players: winners, subjectKeys: winners, opponents: losers },
      round: e.round ?? null,
      facts: { expectedWinProb: e.expectedWinProb },
      text: `${e.round ? `${e.round}で` : ''}${winners.join('・')}が、事前の実力指標で格上と算出されていた${losers.join('・')}を破った。`,
      scopeNote: '「格上」は当サイト収録大会分から算出した実力指標による判定です。数値は非公開。',
      evidence: { source: 'data/ratings/upsets.json' },
    });
  }

  // --- 継続: 選手の連続ベスト8以上
  for (const [name, history] of player) {
    const n = streakEndingAt(history, years, year);
    if (n < PLAYER_STREAK_MIN) continue;
    mk('best8-streak', '継続', {
      subject: { players: [name], subjectKeys: [name] },
      facts: { streakYears: n, since: year - n + 1, resultsByYear: yearSeq(history, years, year) },
      text: `${name}は${n}年連続でベスト8以上に入っている（${year - n + 1}年〜）。`,
      scopeNote: SCOPE_NOTE,
    });
  }

  // --- 成長: 自己最高成績
  for (const [name, history] of player) {
    if (!history[year]) continue;
    const past = prevYears.filter((y) => history[y]).map((y) => history[y].score);
    if (past.length === 0 || history[year].score <= Math.max(...past)) continue;
    mk('self-best', '成長', {
      subject: { players: [name], subjectKeys: [name] },
      facts: { before: RANK_LABEL[Math.max(...past)], after: history[year].label, resultsByYear: yearSeq(history, years, year) },
      text: `${name}は、これまでの最高${RANK_LABEL[Math.max(...past)]}を上回る${history[year].label}となった。`,
      scopeNote: SCOPE_NOTE,
    });
  }

  // --- 衰退: 連続記録が途切れた
  for (const [name, history] of player) {
    if (history[year]) continue;
    const n = streakEndingAt(history, years, year - 1);
    if (n < STREAK_STOPPED_MIN) continue;
    const entered = idx.playerEntry.get(name)?.has(year);
    mk('streak-stopped', '衰退', {
      subject: { players: [name], subjectKeys: [name] },
      facts: { streakYears: n, through: year - 1, resultsByYear: yearSeq(history, years, year - 1) },
      text: `${name}は${year - 1}年まで${n}年連続でベスト8以上だったが、${year}年は${entered ? 'ベスト8に届かなかった' : '出場記録がない'}。`,
      scopeNote: SCOPE_NOTE,
      notes: entered ? undefined : { absence: `${year}年の出場記録なし（理由はデータからは判断できない）` },
    });
  }

  // --- 継続: 学校の連続ベスト8以上
  for (const [name, history] of school) {
    const n = streakEndingAt(history, years, year);
    if (n < SCHOOL_STREAK_MIN) continue;
    mk('school-best8-streak', '継続', {
      subject: { teams: [name], subjectKeys: [name] },
      facts: { streakYears: n, since: year - n + 1, resultsByYear: yearSeq(history, years, year) },
      // 混成ペアがある種目では「学校が優勝」と書けないため、主語を必ず「所属選手」にする。
      text:
        idx.mixedPairRate > 0
          ? `${name}所属の選手は${n}年連続でベスト8以上に残っている（${year - n + 1}年〜）。`
          : `${name}は${n}年連続でベスト8以上に入っている（${year - n + 1}年〜）。`,
      scopeNote:
        idx.mixedPairRate > 0
          ? `${SCOPE_NOTE}。この種目には所属の異なる選手同士のペアが存在するため、主語は「所属選手」であり学校の成績ではない。`
          : SCOPE_NOTE,
    });
  }

  // --- 再会: 同一カードが過去開催にもあった
  for (const [key, list] of meetings) {
    const now = list.find((m) => m.year === year);
    const past = list.filter((m) => m.year < year);
    if (!now || past.length === 0) continue;
    const [sideA, sideB] = key.split(' 対 ');
    const last = past[past.length - 1];
    const revenge = last.winner !== now.winner;
    mk('pair-rematch', '再会', {
      subject: {
        [idx.isTeamEvent ? 'teams' : 'players']: [...sideA.split('|'), ...sideB.split('|')],
        subjectKeys: [...sideA.split('|'), ...sideB.split('|')],
      },
      facts: { priorYear: last.year, priorRound: last.round, currentRound: now.round, revenge },
      text: `${now.round ? `${now.round}の` : ''}${sideA.split('|').join('・')}対${sideB.split('|').join('・')}は、${last.year}年${last.round ?? ''}と同じ顔合わせ。${revenge ? `${last.year}年に敗れた${now.winner.split('|').join('・')}が勝った。` : `${now.winner.split('|').join('・')}が再び勝った。`}`,
      scopeNote: SCOPE_NOTE,
    });
  }

  return stories;
}

/** 団体戦と個人戦の双方でベスト8以上（学校単位固有。種目をまたぐので別処理） */
// ---------------------------------------------------------------- 進行中の大会

/** ラウンド名を深さに直す。1回戦 < 2回戦 < ... < 準々決勝 < 準決勝 < 決勝 */
function roundDepth(round) {
  const fixed = { 準々決勝: 90, 準決勝: 91, 決勝: 92 };
  if (fixed[round]) return fixed[round];
  const m = /^(\d+)回戦$/.exec(round ?? '');
  return m ? Number(m[1]) : 0;
}

/**
 * 大会が進行中のときのストーリー。
 *
 * 前提: 順位（ベスト8以上）が確定するのは準々決勝以降だけで、それ以前は
 * `rank.kind: 'ongoing'` のまま（ADR-007）。男子ダブルスなら315試合のうち
 * 順位が付くのは最後の7試合だけなので、**通常のkindは大会の終盤まで一切計算できない**。
 * したがって途中で語れるのは「誰が勝ち残っていて、誰が消えたか」に限られる。
 *
 * 件数対策: 全エントリーを追うと1大会で敗退イベントが362件出る。
 * **前年にベスト8以上だった主体（注目主体）に絞ると10件**まで落ちる（実測）。
 * 注目主体の定義はプレビュー記事の「ピックアップ選手」と同じ考え方（ADR-005）。
 */
function detectInProgress(tournamentId, categoryId, year, idx) {
  const stories = [];
  const { years, player, school, isTeamEvent } = idx;
  const prevYears = years.filter((y) => y < year);
  if (prevYears.length === 0) return { stories, asOf: null };

  const lastYear = prevYears[prevYears.length - 1];
  const history = isTeamEvent ? school : player;
  // 注目主体 = 直近の確定年にベスト8以上だった選手・学校
  const watched = new Set([...history.keys()].filter((k) => history.get(k)[lastYear]));

  const edition = idx.editions.get(year);
  if (!edition) return { stories, asOf: null };
  const { detail, entryPlayers } = edition;

  const keysOf = (no) => {
    const ps = entryPlayers.get(no) ?? [];
    return isTeamEvent ? [...new Set(ps.map((p) => teamKey(p.team)).filter(Boolean))] : ps.map(fullName).filter(Boolean);
  };
  const displayOf = (no) => keysOf(no).join('・');

  const decided = (detail.matches ?? []).filter((m) => m.winnerEntryNo != null);
  if (decided.length === 0) return { stories, asOf: null };
  const asOf = decided.map((m) => m.round).sort((a, b) => roundDepth(b) - roundDepth(a))[0];

  // エントリーごとに「勝った最深ラウンド」と「負けたラウンド」を出す
  const wonAt = new Map();
  const lostAt = new Map();
  for (const m of decided) {
    const loser = (m.entries ?? []).find((no) => no !== m.winnerEntryNo);
    const w = m.winnerEntryNo;
    if (roundDepth(m.round) > roundDepth(wonAt.get(w))) wonAt.set(w, m.round);
    if (loser != null) lostAt.set(loser, { round: m.round, to: displayOf(m.winnerEntryNo) });
  }

  const seq = (k) => stories.filter((s) => s.kind === k).length + 1;
  const mk = (kind, category, extra) => {
    stories.push({ id: `${tournamentId}-${year}-${categoryId}-${kind}-${seq(kind)}`, category, kind, priority: PRIORITY[kind] ?? 99, categoryId, ...extra });
  };

  // --- 現時点で「最低でもこの順位は確定している」を、残存数（ラウンド名ではなく）から出す。
  // ラウンド名は種目・年で深さがずれる（例: 2026年女子ダブルスは6回戦でベスト8が確定した）ため、
  // 「あと何人／何組残っているか」で判定するほうが年をまたいで揺れない。
  // 残り2組なら少なくとも準優勝、4組なら少なくともベスト4、8組なら少なくともベスト8が確定する。
  const lostEntryNos = new Set([...lostAt.keys()]);
  const aliveCount = (detail.entries ?? []).length - lostEntryNos.size;
  const guaranteedLevel = aliveCount <= 2 ? 90 : aliveCount <= 4 ? 80 : aliveCount <= 8 ? 70 : null;

  // まだ生き残っている学校（団体戦なら1エントリー=1校、個人戦なら複数エントリーが同校のことがある）。
  const aliveSchoolKeys = new Set();
  for (const entry of detail.entries ?? []) {
    if (lostEntryNos.has(entry.entryNo)) continue;
    for (const p of entryPlayers.get(entry.entryNo) ?? []) {
      const tk = teamKey(p.team);
      if (tk) aliveSchoolKeys.add(tk);
    }
  }

  for (const entry of detail.entries ?? []) {
    const keys = keysOf(entry.entryNo).filter((k) => watched.has(k));
    if (keys.length === 0) continue;

    const past = keys
      .map(
        (k) =>
          `${k}は${prevYears
            .filter((y) => history.get(k)?.[y])
            .map((y) => `${y}年${history.get(k)[y].label}`)
            .join('・')}`,
      )
      .join('、');
    const subjectField = isTeamEvent ? 'teams' : 'players';
    const lost = lostAt.get(entry.entryNo);

    if (lost) {
      // 連続記録が途切れたかどうかは、前年までの連続年数で測る（当年は順位未確定のため）
      const streak = Math.max(...keys.map((k) => streakEndingAt(history.get(k) ?? {}, years, lastYear)));
      mk('watched-eliminated', '衰退', {
        subject: { [subjectField]: keysOf(entry.entryNo), subjectKeys: keys },
        round: lost.round,
        facts: { lostTo: lost.to, priorStreak: streak, priorResults: past },
        text: `${displayOf(entry.entryNo)}は${lost.round}で${lost.to}に敗れた。${past}。`,
        scopeNote: SCOPE_NOTE,
      });
    } else {
      const reached = wonAt.get(entry.entryNo);
      if (!reached) continue; // まだ1試合も終わっていない
      mk('watched-advancing', '継続', {
        subject: { [subjectField]: keysOf(entry.entryNo), subjectKeys: keys },
        round: reached,
        facts: { clearedRound: reached, priorResults: past },
        text: `${displayOf(entry.entryNo)}は${reached}を突破して勝ち残っている。${past}。`,
        scopeNote: SCOPE_NOTE,
      });

      // 選手: 自己ベスト更新ウォッチ（個人戦のみ）。
      // 「まだ決まっていない試合の結果を先読みしない」原則を守るため、実際に確定した
      // 主張（残存数から導く下限）だけを使う。「並ぶ／上回る可能性がある」ではなく
      // 「すでに並んだ・上回った（確定）」の形でしか出さない。
      if (!isTeamEvent && guaranteedLevel != null) {
        for (const name of keys) {
          const hist = player.get(name);
          if (!hist) continue;
          const pastScores = prevYears.filter((y) => hist[y]).map((y) => hist[y].score);
          if (pastScores.length === 0) continue;
          const best = Math.max(...pastScores);
          if (guaranteedLevel < best) continue; // まだ自己ベストに届いていない
          mk('watched-self-best', '成長', {
            subject: { players: [name], subjectKeys: [name] },
            round: reached,
            facts: {
              priorBest: RANK_LABEL[best],
              guaranteedLevel: RANK_LABEL[guaranteedLevel],
              ties: guaranteedLevel === best,
              resultsByYear: yearSeq(hist, years, year - 1),
            },
            text: `${name}は少なくとも${RANK_LABEL[guaranteedLevel]}が確定し、自己最高（${RANK_LABEL[best]}）に${
              guaranteedLevel === best ? '並んだ' : '並ぶか上回った'
            }。`,
            scopeNote: SCOPE_NOTE,
          });
        }
      }
    }
  }

  // --- 学校: 連覇／◯年ぶり優勝ウォッチと、歴代最高（ピーク）更新ウォッチ。
  // どちらも団体戦・個人戦の両方に共通（個人戦は所属選手の集約）。
  // guaranteedLevel と同じ理由で、確定した下限のみを使う（先読みしない）。
  if (guaranteedLevel != null) {
    for (const sk of aliveSchoolKeys) {
      const hist = school.get(sk);
      if (!hist) continue;
      const subjectLabel = idx.mixedPairRate > 0 ? `${sk}所属の選手` : sk;

      const titleYears = prevYears.filter((y) => hist[y]?.score === 100);
      if (titleYears.length > 0) {
        const lastTitleYear = titleYears[titleYears.length - 1];
        const gap = year - lastTitleYear;
        mk('watched-title-watch', gap <= 1 ? '継続' : '成長', {
          subject: { teams: [sk], subjectKeys: [sk] },
          facts: {
            lastTitleYear,
            yearsSinceTitle: gap,
            titleYears: titleYears.join('・'),
            guaranteedLevel: RANK_LABEL[guaranteedLevel],
          },
          text: `${subjectLabel}は少なくとも${RANK_LABEL[guaranteedLevel]}が確定しており、この種目での前回優勝は${lastTitleYear}年（${gap}年前）。`,
          scopeNote: SCOPE_NOTE,
        });
      }

      const pastScores = prevYears.filter((y) => hist[y]).map((y) => hist[y].score);
      if (pastScores.length > 0) {
        const best = Math.max(...pastScores);
        if (guaranteedLevel >= best) {
          mk('watched-school-peak', '成長', {
            subject: { teams: [sk], subjectKeys: [sk] },
            facts: {
              priorBest: RANK_LABEL[best],
              guaranteedLevel: RANK_LABEL[guaranteedLevel],
              ties: guaranteedLevel === best,
              resultsByYear: yearSeq(hist, years, year - 1),
            },
            text: `${subjectLabel}は少なくとも${RANK_LABEL[guaranteedLevel]}が確定し、学校としてのこれまでの最高成績（${RANK_LABEL[best]}）に${
              guaranteedLevel === best ? '並んだ' : '並ぶか上回った'
            }。`,
            scopeNote:
              idx.mixedPairRate > 0
                ? `${SCOPE_NOTE}。この種目には所属の異なる選手同士のペアが存在するため、主語は「所属選手」であり学校の成績ではない。`
                : SCOPE_NOTE,
          });
        }
      }
    }
  }

  // --- 個人戦は選手単位だと卒業で枯れる（2026年女子ダブルスは前年ベスト8以上16人中
  //     残り3人＝ストーリー2件）。学校単位に広げると材料が出るが、ペアごとに1件出すと
  //     23件になってノイズなので、**学校ごとに「何組残って何組消えたか」に集約**する。
  if (!isTeamEvent) {
    const schoolWatched = new Set([...school.keys()].filter((k) => school.get(k)[lastYear]));
    const perSchool = new Map();
    for (const entry of detail.entries ?? []) {
      const ps = entryPlayers.get(entry.entryNo) ?? [];
      const teams = [...new Set(ps.map((p) => teamKey(p.team)).filter((t) => schoolWatched.has(t)))];
      for (const t of teams) {
        if (!perSchool.has(t)) perSchool.set(t, { alive: [], out: [], unknown: [] });
        const names = ps.map(fullName).filter(Boolean).join('・');
        if (lostAt.has(entry.entryNo)) perSchool.get(t).out.push({ names, ...lostAt.get(entry.entryNo) });
        else if (wonAt.has(entry.entryNo)) perSchool.get(t).alive.push({ names, round: wonAt.get(entry.entryNo) });
        // どの試合にも現れないエントリー。勝敗が分からないので alive にも out にも数えない。
        else perSchool.get(t).unknown.push({ names });
      }
    }
    for (const [name, v] of perSchool) {
      if (v.alive.length === 0 && v.out.length === 0) continue;
      const past = prevYears
        .filter((y) => school.get(name)?.[y])
        .map((y) => `${y}年${school.get(name)[y].label}`)
        .join('・');
      // 「勝ち残りが無くなった」は、勝敗の分からないエントリーが1組でもあると断定できない。
      // 実例: インターハイ2026女子ダブルスで就実の3組目がどの試合にも現れておらず、
      // 「2組が敗退して全滅」と誤って断定しかけた。照合スクリプトでは検出できない種類の誤り。
      const canDeclareOut = v.alive.length === 0 && v.unknown.length === 0;
      const unknownNote = v.unknown.length > 0 ? `${v.unknown.length}組は試合結果が未掲載で勝敗不明。` : '';
      mk('watched-school-progress', v.alive.length === 0 ? '衰退' : '継続', {
        subject: { teams: [name], subjectKeys: [name] },
        facts: {
          alive: v.alive.length,
          eliminated: v.out.length,
          unknown: v.unknown.length,
          alivePairs: v.alive.map((a) => a.names).join(' / ') || null,
          eliminatedPairs: v.out.map((o) => `${o.names}（${o.round}）`).join(' / ') || null,
          unknownPairs: v.unknown.map((u) => u.names).join(' / ') || null,
          priorResults: past,
        },
        text: canDeclareOut
          ? `${name}は勝ち残りが無くなった（${v.out.length}組が敗退）。${name}は${past}。`
          : `${name}は${v.alive.length}組が勝ち残っている（${v.out.length}組が敗退）。${unknownNote}${name}は${past}。`,
        scopeNote: SCOPE_NOTE,
        notes:
          v.unknown.length > 0
            ? {
                absence: `${name}の${v.unknown.length}組は掲載中の試合に現れないため、勝ち残りの有無を断定しないこと（${v.unknown.map((u) => u.names).join(' / ')}）`,
              }
            : undefined,
      });
    }
  }

  return { stories, asOf };
}

function detectBothEvents(tournamentId, year, indexes) {
  const teamCats = [...indexes.keys()].filter((c) => c.startsWith('team-'));
  const stories = [];
  for (const teamCat of teamCats) {
    const gender = teamCat.split('-')[2];
    const indivCat = [...indexes.keys()].find((c) => !c.startsWith('team-') && c.split('-')[2] === gender);
    if (!indivCat) continue;
    const t = indexes.get(teamCat);
    const i = indexes.get(indivCat);
    const shared = [...t.school.keys()].filter((s) => i.school.has(s));
    for (const name of shared) {
      const both = t.years.filter((y) => y <= year && t.school.get(name)[y] && i.school.get(name)[y]);
      const n = (() => {
        if (!both.includes(year)) return 0;
        let c = 1;
        for (let y = year - 1; both.includes(y); y -= 1) c += 1;
        return c;
      })();
      if (n < BOTH_EVENTS_MIN) continue;
      stories.push({
        id: `${tournamentId}-${year}-${gender}-school-both-events-${stories.length + 1}`,
        category: '継続',
        kind: 'school-both-events',
        priority: PRIORITY['school-both-events'],
        subject: { teams: [name], subjectKeys: [name] },
        facts: {
          streakYears: n,
          since: year - n + 1,
          byYear: both
            .filter((y) => y > year - n)
            .map((y) => `${y}年 団体${t.school.get(name)[y].label}・個人${i.school.get(name)[y].label}`)
            .join(' / '),
        },
        text: `${name}は${n}年連続で、団体戦と個人戦の両方でベスト8以上に入っている（${year - n + 1}年〜）。`,
        scopeNote: SCOPE_NOTE,
      });
    }
  }
  return stories;
}

/** 機械的に決まる関連だけを張る。物語筋の判断はLLM側の仕事。 */
function relate(stories) {
  for (const a of stories) {
    const related = [];
    for (const b of stories) {
      if (a === b) continue;
      const ka = new Set(a.subject?.subjectKeys ?? []);
      const kb = b.subject?.subjectKeys ?? [];
      if (kb.some((k) => ka.has(k))) related.push({ id: b.id, relation: 'same-subject' });
      else if (a.subject?.opponents?.some((o) => kb.includes(o))) related.push({ id: b.id, relation: 'counterpart' });
    }
    if (related.length > 0) a.related = related;
  }
  return stories;
}

/** ストーリーにしない（希少性が無い）が一覧としては価値がある事実。 */
function records(categoryId, year, idx) {
  const first = [];
  for (const [name, history] of idx.player) {
    if (!history[year]) continue;
    const appearedBefore = [...(idx.playerEntry.get(name) ?? [])].some((y) => y < year);
    if (idx.years.filter((y) => y < year).some((y) => history[y])) continue;
    first.push({ name, label: history[year].label, appearedBefore });
  }
  return { firstBest8: first };
}

// ---------------------------------------------------------------- YAML 出力

const q = (s) => {
  const v = String(s);
  return /[:#\-{}[\]&*!|>'"%@`,\n]/.test(v) || v === '' ? `'${v.replace(/'/g, "''")}'` : v;
};

function emit(meta, stories, recordsByCategory, { withRecords = true, asOfByCategory = null } = {}) {
  const L = [];
  L.push('# 自動生成（scripts/generate-story-yaml.mjs）。手で編集しないこと。');
  L.push('# LLMへの指示: この事実だけを使うこと。新しい数値・事実・評価を作らない、または推測しないこと。');
  L.push('#   選手名・学校名・年はそのまま使うこと。scopeNote と notes.absence は必ず反映すること。');
  L.push('#   related で結ばれたストーリーは同じ筋の可能性が高いので、1つの段落にまとめてよい。');
  L.push('');
  L.push('tournament:');
  L.push(`  tournamentId: ${q(meta.tournamentId)}`);
  L.push(`  year: ${meta.year}`);
  L.push(`  label: ${q(meta.label)}`);
  L.push(`  scope: ${q(`当サイト収録大会分（${meta.years.join('・')}年）から算出`)}`);
  if (asOfByCategory) {
    L.push('  inProgress: true');
    L.push('  asOf: # 種目ごとの「ここまで確定」ラウンド。これより先はまだ結果が入っていない');
    for (const [c, r] of Object.entries(asOfByCategory)) L.push(`    ${c}: ${q(r)}`);
  }
  L.push('');
  L.push('stories:');
  if (stories.length === 0) L.push('  [] # 検出なし');
  for (const s of stories) {
    L.push(`  - id: ${q(s.id)}`);
    L.push(`    category: ${q(s.category)}`);
    L.push(`    kind: ${q(s.kind)}`);
    L.push(`    categoryId: ${q(s.categoryId)}`);
    L.push(`    priority: ${s.priority}`);
    L.push('    subject:');
    for (const key of ['players', 'teams', 'subjectKeys', 'opponents']) {
      if (s.subject?.[key]?.length) L.push(`      ${key}: [${s.subject[key].map(q).join(', ')}]`);
    }
    if (s.round) L.push(`    round: ${q(s.round)}`);
    if (s.facts) {
      L.push('    facts:');
      for (const [k, v] of Object.entries(s.facts)) if (v != null) L.push(`      ${k}: ${typeof v === 'number' ? v : q(v)}`);
    }
    L.push(`    text: ${q(s.text)}`);
    if (s.scopeNote) L.push(`    scopeNote: ${q(s.scopeNote)}`);
    if (s.notes) {
      L.push('    notes:');
      for (const [k, v] of Object.entries(s.notes)) L.push(`      ${k}: ${q(v)}`);
    }
    if (s.evidence) L.push(`    evidence: { source: ${q(s.evidence.source)} }`);
    if (s.related?.length) {
      L.push('    related:');
      for (const r of s.related) L.push(`      - { id: ${q(r.id)}, relation: ${q(r.relation)} }`);
    }
  }
  L.push('');
  if (!withRecords) return `${L.join('\n')}\n`;
  L.push('# ストーリーにはしないが一覧として出す事実（LLMの執筆は不要。そのままリスト表示する）');
  L.push('records:');
  for (const [categoryId, rec] of Object.entries(recordsByCategory)) {
    L.push(`  ${categoryId}:`);
    L.push('    firstBest8:');
    if (rec.firstBest8.length === 0) L.push('      [] # 該当なし');
    for (const f of rec.firstBest8) {
      L.push(`      - { name: ${q(f.name)}, result: ${q(f.label)}, appearedBefore: ${f.appearedBefore} }`);
    }
  }
  return `${L.join('\n')}\n`;
}

// ---------------------------------------------------------------- CLI

function main() {
  const argv = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '-t' || a === '--tournament') args.tournament = argv[++i];
    else if (a === '-y' || a === '--year') args.year = Number(argv[++i]);
    else if (a === '-c' || a === '--category') args.category = argv[++i];
    else if (a === '-o' || a === '--out') args.out = argv[++i];
    // LLMに渡す用。records（初ベスト8の一覧）はリスト表示用でLLMに書かせるものではないため、
    // 渡すとそこから文章を作ろうとしてノイズになる。執筆用は stories だけにする。
    else if (a === '--no-records') args.noRecords = true;
    // 大会が進行中のときのモード。順位が確定していないため通常のkindは使えず、
    // 「注目主体が勝ち残っているか／どこで消えたか」だけを出す。
    else if (a === '--in-progress') args.inProgress = true;
  }
  if (!args.tournament || !args.year) {
    console.error('使い方: node scripts/generate-story-yaml.mjs -t <tournamentId> -y <year> [-c <categoryId>] [-o out.yaml] [--no-records] [--in-progress]');
    process.exit(2);
  }

  const meta = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')).find((t) => t.tournamentId === args.tournament);
  const upsets = JSON.parse(fs.readFileSync(UPSETS_PATH, 'utf8')).events ?? [];
  const categories = args.category ? [args.category] : listCategories(args.tournament, args.year);

  const indexes = new Map();
  const stories = [];
  const recordsByCategory = {};
  const asOfByCategory = {};
  let allYears = [];

  for (const categoryId of categories) {
    const idx = buildIndex(args.tournament, categoryId);
    if (!idx.years.includes(args.year)) continue;
    indexes.set(categoryId, idx);
    allYears = [...new Set([...allYears, ...idx.years])].sort();
    if (idx.nameOnlySeen) {
      console.error(`  ! ${categoryId}: 姓のみの選手が含まれるため、該当選手は選手単位の判定から除外されます`);
    }
    if (args.inProgress) {
      const { stories: inProgress, asOf } = detectInProgress(args.tournament, categoryId, args.year, idx);
      for (const s of inProgress) stories.push(s);
      if (asOf) asOfByCategory[categoryId] = asOf;
    } else {
      for (const s of detect(args.tournament, categoryId, args.year, idx, upsets)) stories.push({ ...s, categoryId });
      recordsByCategory[categoryId] = records(categoryId, args.year, idx);
    }
  }

  if (!args.inProgress) {
    for (const s of detectBothEvents(args.tournament, args.year, indexes)) stories.push({ ...s, categoryId: '（団体・個人横断）' });
  }

  stories.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  relate(stories);

  const yaml = emit(
    { tournamentId: args.tournament, year: args.year, label: `${meta?.label ?? args.tournament} ${args.year}`, years: allYears },
    stories,
    recordsByCategory,
    { withRecords: !args.noRecords && !args.inProgress, asOfByCategory: args.inProgress ? asOfByCategory : null },
  );

  if (args.out) {
    fs.writeFileSync(args.out, yaml);
    const byKind = stories.reduce((acc, s) => ({ ...acc, [s.kind]: (acc[s.kind] ?? 0) + 1 }), {});
    console.error(`${args.out} に ${stories.length} 件を書き出しました`);
    for (const [k, v] of Object.entries(byKind)) console.error(`  ${k}: ${v}`);
  } else {
    process.stdout.write(yaml);
  }
}

main();
