/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
/*
  This file is a small normalization script run with `node` as CommonJS.
  We intentionally use `require()` here instead of ESM imports to avoid
  changing the repo `package.json` to "type": "module".
*/
const fs = require('fs');
const path = require('path');

const src = path.join('doubles-none-boys.json');
const out = path.join('doubles-none-boys.normalized.json');
const entriesMetaPath = path.join('..', 'entries', 'doubles-none-boys.json');

const data = JSON.parse(fs.readFileSync(src, 'utf8'));

const participantsMap = new Map();

// helper: build id "last_first_team_prefecture"
function makeIdFromParts(last, first, team, prefecture) {
  return [last || '', first || '', team || '', prefecture || '']
    .filter(Boolean)
    .join('_');
}

// register from detailed opponent object
function registerOpponent(o) {
  if (!o) return;
  const id =
    o.tempId || makeIdFromParts(o.lastName, o.firstName, o.team, o.prefecture);
  if (!participantsMap.has(id)) {
    participantsMap.set(id, {
      id,
      lastName: o.lastName || null,
      firstName: o.firstName || null,
      team: o.team || null,
      prefecture: o.prefecture || null,
    });
  } else {
    const cur = participantsMap.get(id);
    if (!cur.prefecture && o.prefecture) cur.prefecture = o.prefecture;
    if (!cur.team && o.team) cur.team = o.team;
    if (!cur.firstName && o.firstName) cur.firstName = o.firstName;
    if (!cur.lastName && o.lastName) cur.lastName = o.lastName;
  }
}

// register from id-string like "姓_名_チーム"
function registerFromIdString(idStr) {
  if (!idStr) return;
  if (!participantsMap.has(idStr)) {
    const parts = idStr.split('_');
    const last = parts[0] || null;
    const first = parts[1] || null;
    const team = parts.slice(2).join('_') || null;
    participantsMap.set(idStr, {
      id: idStr,
      lastName: last,
      firstName: first,
      team,
      prefecture: null,
    });
  }
}

// collect participants from matches.opponents and matches.pair
for (const m of data.matches || []) {
  if (Array.isArray(m.opponents)) {
    for (const o of m.opponents) registerOpponent(o);
  }
  if (Array.isArray(m.pair)) {
    for (const p of m.pair) {
      if (typeof p === 'string') registerFromIdString(p);
      else if (p && typeof p === 'object') {
        // in case pair contains object (unlikely), build id including prefecture
        const id =
          p.tempId ||
          makeIdFromParts(p.lastName, p.firstName, p.team, p.prefecture);
        registerOpponent({ ...p, tempId: id });
      }
    }
  }
}
// If some participants were registered from plain id-strings ("姓_名_チーム")
// try to copy prefecture from any detailed entry that has the same name+team.
for (const p of participantsMap.values()) {
  if (!p.prefecture) {
    // search for a detailed record with same last+first+team and a prefecture
    for (const q of participantsMap.values()) {
      if (
        q.prefecture &&
        q.lastName === p.lastName &&
        q.firstName === p.firstName &&
        q.team === p.team
      ) {
        p.prefecture = q.prefecture;
        break;
      }
    }
  }
}

// Rebuild participantsMap so that ids always include prefecture when available.
// Also build a mapping from oldId -> newId so we can remap matches/entries/results.
const oldToNewId = new Map();
{
  const newMap = new Map();
  for (const p of participantsMap.values()) {
    const newId = makeIdFromParts(
      p.lastName,
      p.firstName,
      p.team,
      p.prefecture,
    );
    // If newId conflicts, keep the first one encountered and merge prefecture/team if needed
    if (!newMap.has(newId)) {
      const newP = { ...p, id: newId };
      newMap.set(newId, newP);
      oldToNewId.set(p.id, newId);
    } else {
      // merge into existing entry
      const exist = newMap.get(newId);
      if (!exist.prefecture && p.prefecture) exist.prefecture = p.prefecture;
      if (!exist.team && p.team) exist.team = p.team;
      if (!exist.firstName && p.firstName) exist.firstName = p.firstName;
      if (!exist.lastName && p.lastName) exist.lastName = p.lastName;
      oldToNewId.set(p.id, newId);
    }
  }
  // replace participantsMap with newMap
  participantsMap.clear();
  for (const [k, v] of newMap.entries()) participantsMap.set(k, v);
}

// build entries map from entryNo -> playerIds
const entriesMap = new Map();
for (const m of data.matches || []) {
  if (m.entryNo != null) {
    const key = String(m.entryNo);
    const playerIds = Array.isArray(m.pair) ? m.pair.map((x) => String(x)) : [];
    if (!entriesMap.has(key)) {
      entriesMap.set(key, { entryNo: Number(m.entryNo), playerIds });
    } else {
      const e = entriesMap.get(key);
      // merge if one is empty and another has data
      if ((!e.playerIds || e.playerIds.length === 0) && playerIds.length)
        e.playerIds = playerIds;
    }
  }
}

// helper to remap an id using oldToNewId map
function remapId(id) {
  if (!id) return id;
  return oldToNewId.get(id) || id;
}

// remap ids inside entriesMap so playerIds include prefecture when available
for (const e of entriesMap.values()) {
  if (Array.isArray(e.playerIds)) {
    e.playerIds = e.playerIds.map((id) => remapId(id));
  }
}

// normalize matches: group reciprocal rows so each match is a single object
const rawMatches = data.matches || [];

function arrayEquals(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function findEntryNoByPlayerIds(playerIds) {
  const sorted = (arr) => (arr || []).slice().map(String).sort().join('|');
  const key = sorted(playerIds || []);
  for (const [k, v] of entriesMap.entries()) {
    if (sorted(v.playerIds) === key) return Number(k);
  }
  return null;
}

// build canonical grouping key per row
const groups = new Map();
for (const m of rawMatches) {
  const teamA_pair = Array.isArray(m.pair)
    ? m.pair.map((x) => remapId(String(x)))
    : [];
  const teamA_entry = m.entryNo != null ? Number(m.entryNo) : null;
  const teamA_key =
    teamA_entry != null ? `E${teamA_entry}` : `P:${teamA_pair.join('|')}`;

  let teamB_pair = [];
  let teamB_entry = null;
  if (Array.isArray(m.opponents) && m.opponents.length) {
    teamB_pair = m.opponents.map((o) => {
      const id =
        o.tempId ||
        makeIdFromParts(o.lastName, o.firstName, o.team, o.prefecture);
      return remapId(id);
    });
    teamB_entry = findEntryNoByPlayerIds(teamB_pair);
  }
  const teamB_key =
    teamB_entry != null
      ? `E${teamB_entry}`
      : teamB_pair.length
        ? `P:${teamB_pair.join('|')}`
        : null;

  const keyParts = [teamA_key];
  if (teamB_key) keyParts.push(teamB_key);
  const groupKey = keyParts.sort().join('|');

  if (!groups.has(groupKey)) groups.set(groupKey, []);
  groups
    .get(groupKey)
    .push({ m, teamA_pair, teamA_entry, teamB_pair, teamB_entry });
}

const matches = [];
for (const [gk, rows] of groups.entries()) {
  if (rows.length === 1) {
    const { m, teamA_pair, teamA_entry, teamB_pair, teamB_entry } = rows[0];
    const entryA =
      teamA_entry != null
        ? teamA_entry
        : teamA_pair.length
          ? findEntryNoByPlayerIds(teamA_pair)
          : null;
    const entryB =
      teamB_entry != null
        ? teamB_entry
        : teamB_pair.length
          ? findEntryNoByPlayerIds(teamB_pair)
          : null;
    const scoreA = m.games ? Number(m.games.won || 0) : null;
    const scoreB = m.games ? Number(m.games.lost || 0) : null;
    const scoresObj = {};
    const keyA =
      entryA != null ? String(entryA) : `P:${(teamA_pair || []).join('|')}`;
    const keyB =
      entryB != null ? String(entryB) : `P:${(teamB_pair || []).join('|')}`;
    if (scoreA != null) scoresObj[keyA] = scoreA;
    if (scoreB != null) scoresObj[keyB] = scoreB;
    const winnerEntryNo =
      scoreA != null && scoreB != null
        ? scoreA > scoreB
          ? entryA
          : entryB
        : null;
    matches.push({
      round: m.round || null,
      entries: [entryA, entryB],
      scores: scoresObj,
      winnerEntryNo,
      retired: !!m.retired,
    });
    continue;
  }

  const a = rows[0];
  const b = rows[1];
  const mA = a.m;
  const mB = b.m;

  const entryA =
    a.teamA_entry != null
      ? a.teamA_entry
      : a.teamA_pair.length
        ? findEntryNoByPlayerIds(a.teamA_pair)
        : null;
  const entryB =
    b.teamA_entry != null
      ? b.teamA_entry
      : b.teamA_pair.length
        ? findEntryNoByPlayerIds(b.teamA_pair)
        : null;

  const pairA = a.teamA_pair.length
    ? a.teamA_pair
    : entryA != null
      ? (entriesMap.get(String(entryA)) || {}).playerIds || []
      : [];
  const pairB = b.teamA_pair.length
    ? b.teamA_pair
    : entryB != null
      ? (entriesMap.get(String(entryB)) || {}).playerIds || []
      : [];

  const scoreA = mA.games
    ? Number(mA.games.won || 0)
    : mB.games
      ? Number(mB.games.lost || 0)
      : null;
  const scoreB = mB.games
    ? Number(mB.games.won || 0)
    : mA.games
      ? Number(mA.games.lost || 0)
      : null;

  if (mA.games && mB.games) {
    const a_vs_b = Number(mA.games.won || 0) === Number(mB.games.lost || 0);
    const b_vs_a = Number(mB.games.won || 0) === Number(mA.games.lost || 0);
    if (!a_vs_b || !b_vs_a) {
      console.warn(
        'Inconsistent reciprocal scores for group',
        gk,
        mA.games,
        mB.games,
      );
    }
  }

  const entriesArr = [entryA, entryB];
  const scoresObj = {};
  const keyA = entryA != null ? String(entryA) : `P:${(pairA || []).join('|')}`;
  const keyB = entryB != null ? String(entryB) : `P:${(pairB || []).join('|')}`;
  if (scoreA != null) scoresObj[keyA] = scoreA;
  if (scoreB != null) scoresObj[keyB] = scoreB;
  const winnerEntryNo =
    scoreA != null && scoreB != null
      ? scoreA > scoreB
        ? entriesArr[0]
        : entriesArr[1]
      : null;
  const retired = !!mA.retired || !!mB.retired;
  matches.push({
    round: mA.round || mB.round || null,
    entries: entriesArr,
    scores: scoresObj,
    winnerEntryNo,
    retired,
  });
}

// normalize results: keep playerIds and result, drop category
const results = (data.results || []).map((r) => ({
  playerIds: Array.isArray(r.playerIds)
    ? r.playerIds.map((x) => remapId(String(x)))
    : [],
  result: r.result || null,
}));

const participants = Array.from(participantsMap.values());

// try to read entries metadata (types) from ../entries/doubles-none-boys.json
let entryTypeMap = new Map();
try {
  if (fs.existsSync(entriesMetaPath)) {
    const entriesMeta =
      JSON.parse(fs.readFileSync(entriesMetaPath, 'utf8')) || [];
    for (const em of entriesMeta) {
      if (em && em.entryNo != null)
        entryTypeMap.set(Number(em.entryNo), em.type || null);
    }
  }
} catch (err) {
  // ignore if missing or parse error; leave map empty
}

const entries = Array.from(entriesMap.values()).map((e) => ({
  ...e,
  type: entryTypeMap.has(e.entryNo) ? entryTypeMap.get(e.entryNo) : null,
}));

// For compatibility (Option A) we output matches as { entries: [entryA, entryB], scores: {entry:score}, ... }
// matches already contains `entries` and `scores` from earlier normalization, so pass through.
const matchesTransformed = matches.map((m) => {
  // ensure scores is an object and entries is an array
  const entriesArr = Array.isArray(m.entries) ? m.entries : [];
  const scoresObj = m.scores || {};
  // explicitly omit legacy `sides`
  const { sides, ...rest } = m;
  // set default stage/group: this dataset is knockout-only for now
  return {
    ...rest,
    entries: entriesArr,
    scores: scoresObj,
    stage: 'knockout',
    group: null,
  };
});

// assign deterministic matchId and compute nextMatchId by finding a match in the next round
// where the winner's playerIds appear in one of that match's entries.
function roundOrder(roundName) {
  if (!roundName) return -1;
  // try to extract leading number like "1回戦", "2回戦"
  const num = (roundName.match(/(\d+)/) || [])[0];
  if (num) return Number(num);
  const map = {
    準々決勝: 8000,
    準決勝: 9000,
    決勝: 10000,
    // numeric rounds like 3回戦/4回戦 are handled by the regex at the top
  };
  // iterate keys longest-first so that '準々決勝' is matched before '決勝'
  const mapKeys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const k of mapKeys) {
    if (roundName.includes(k)) return map[k];
  }
  return 0;
}

// helper to get playerIds for an entryNo (may be undefined)
function playerIdsForEntry(entryNo) {
  if (entryNo == null) return [];
  const e = entriesMap.get(String(entryNo));
  return e && Array.isArray(e.playerIds) ? e.playerIds : [];
}

// assign matchId
for (let i = 0; i < matchesTransformed.length; i++) {
  matchesTransformed[i].matchId = `match-${i + 1}`;
}

// debug helper removed; do not print verbose debug logs in normal runs

// build index by roundOrder
const matchesByRoundOrder = new Map();
for (const m of matchesTransformed) {
  const ord = roundOrder(m.round);
  if (!matchesByRoundOrder.has(ord)) matchesByRoundOrder.set(ord, []);
  matchesByRoundOrder.get(ord).push(m);
}
// sorted unique round orders
const sortedOrders = Array.from(matchesByRoundOrder.keys()).sort(
  (a, b) => a - b,
);

// map from matchId to match for lookup (not needed currently)
// const matchIdMap = new Map(matchesTransformed.map((m) => [m.matchId, m]));

// for each match, find the next round (smallest order > current) and try to find a match
// that contains the winner's playerIds in one of its entries
// debug run removed

for (const m of matchesTransformed) {
  m.nextMatchId = null;
  if (m.winnerEntryNo == null) continue;
  const myOrder = roundOrder(m.round);
  // find next order
  const nextOrder = sortedOrders.find((o) => o > myOrder);
  if (nextOrder == null) continue;
  const winnerPlayerIds = playerIdsForEntry(m.winnerEntryNo);
  if (!winnerPlayerIds.length) continue;
  const candidates = matchesByRoundOrder.get(nextOrder) || [];
  for (const cand of candidates) {
    // check each entry in candidate
    const candEntries = Array.isArray(cand.entries) ? cand.entries : [];
    for (const en of candEntries) {
      const enPlayerIds = playerIdsForEntry(en);
      // intersection
      const intersect = enPlayerIds.some((id) => winnerPlayerIds.includes(id));
      if (intersect) {
        m.nextMatchId = cand.matchId;
        break;
      }
    }
    if (m.nextMatchId) break;
  }
}

// build reverse mapping: prevMatchIds for each match (may be multiple previous matches)
const prevMap = new Map();
for (const m of matchesTransformed) {
  if (m.nextMatchId) {
    if (!prevMap.has(m.nextMatchId)) prevMap.set(m.nextMatchId, []);
    prevMap.get(m.nextMatchId).push(m.matchId);
  }
}
for (const m of matchesTransformed) {
  const prevs = prevMap.get(m.matchId) || [];
  // always provide array for multiple previous matches
  m.prevMatchIds = prevs;
  // convenience single-link field for backwards compatibility
  m.prevMatchId = prevs.length === 1 ? prevs[0] : null;
}

const outObj = { participants, entries, matches: matchesTransformed, results };

// Compute per-entry final results derived from matches.
// For each entry, find all matches they participated in, pick the latest by roundOrder
// and derive a human-friendly result label. We keep this as `entryResults` so
// the original `results` (player-based) remains unchanged.
function deriveResultLabelForEntry(entryNo) {
  // gather matches that include this entry
  const played = matchesTransformed.filter(
    (m) => Array.isArray(m.entries) && m.entries.some((en) => en === entryNo),
  );
  if (!played || !played.length) {
    return { resultLabel: '不明', eliminatedRound: null, lastMatchId: null };
  }
  // sort by roundOrder (ascending), take the last (deepest) match
  played.sort((a, b) => roundOrder(a.round) - roundOrder(b.round));
  const last = played[played.length - 1];
  const lastRound = last.round || null;
  const lastMatchId = last.matchId || null;
  const wasWinner =
    last.winnerEntryNo != null && last.winnerEntryNo === entryNo;

  // champion detection: winner of the match that has no nextMatchId (final)
  if (wasWinner && !last.nextMatchId) {
    return { resultLabel: '優勝', eliminatedRound: null, lastMatchId };
  }

  // runner-up: lost the final (last match is final and not winner)
  if (!wasWinner && !last.nextMatchId) {
    return { resultLabel: '準優勝', eliminatedRound: lastRound, lastMatchId };
  }

  // named round heuristics
  if (lastRound) {
    if (lastRound.includes('準決勝'))
      return {
        resultLabel: 'ベスト4',
        eliminatedRound: lastRound,
        lastMatchId,
      };
    if (lastRound.includes('準々決勝'))
      return {
        resultLabel: 'ベスト8',
        eliminatedRound: lastRound,
        lastMatchId,
      };
    // numeric rounds like "3回戦"
    const num = (lastRound.match(/(\d+)回/) || [])[1];
    if (num)
      return {
        resultLabel: `${num}回戦敗退`,
        eliminatedRound: lastRound,
        lastMatchId,
      };
    // fallback: round name + 敗退
    return {
      resultLabel: `${lastRound}敗退`,
      eliminatedRound: lastRound,
      lastMatchId,
    };
  }

  // default unknown
  return { resultLabel: '不明', eliminatedRound: null, lastMatchId };
}

const entryResults = (entries || []).map((e) => {
  const r = deriveResultLabelForEntry(e.entryNo);
  return {
    entryNo: e.entryNo,
    playerIds: Array.isArray(e.playerIds) ? e.playerIds : [],
    resultLabel: r.resultLabel,
    eliminatedRound: r.eliminatedRound,
    lastMatchId: r.lastMatchId,
  };
});

// add entry-level results into `results` (keep original player-based results too)
// For 推奨A: keep playerIds on `entryResults` only; top-level `results` should be lightweight
const resultsFromEntries = entryResults.map((er) => ({
  entryNo: er.entryNo,
  result: er.resultLabel,
}));

// keep original player-based results under `playerResults` for reference
outObj.playerResults = results || [];
// expose entry-level results as the primary `results` array (replace old output)
outObj.entryResults = entryResults;
// results: per-entry objects containing both tournament and roundrobin fields
outObj.results = resultsFromEntries.map((r) => ({
  entryNo: r.entryNo,
  tournament: r.result,
  roundrobin: null,
}));

// Ensure top-level results are sorted by entryNo ascending (if entryNo exists)
if (Array.isArray(outObj.results)) {
  outObj.results.sort(
    (a, b) => (Number(a.entryNo) || 0) - (Number(b.entryNo) || 0),
  );
}

// Build output with participants one object per line
function buildOutput({ participants, entries, matches, results }) {
  const parts = [];
  // no indentBlock helper needed anymore; results and entries printed one-object-per-line
  parts.push('{');

  // participants: one object per line
  parts.push('  "participants": [');
  if (participants && participants.length) {
    parts.push(participants.map((p) => '    ' + JSON.stringify(p)).join(',\n'));
  }
  parts.push('  ],');

  // entries: sort by entryNo and print one object per line
  parts.push('  "entries": [');
  if (entries && entries.length) {
    const sorted = entries
      .slice()
      .sort((a, b) => (a.entryNo || 0) - (b.entryNo || 0));
    parts.push(sorted.map((e) => '    ' + JSON.stringify(e)).join(',\n'));
  }
  parts.push('  ],');

  // matches: print each match as an object where `entries` and `scores` are single-line
  parts.push('  "matches": [');
  if (matches && matches.length) {
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      // shallow copy and remove entries/scores for separate printing
      const mCopy = { ...m };
      const entriesField = JSON.stringify(mCopy.entries || []);
      const scoresField = JSON.stringify(mCopy.scores || {});
      delete mCopy.entries;
      delete mCopy.scores;

      parts.push('    {');
      parts.push(
        '      "entries": ' +
          entriesField +
          (Object.keys(mCopy).length ? ',' : ''),
      );
      parts.push(
        '      "scores": ' +
          scoresField +
          (Object.keys(mCopy).length ? ',' : ''),
      );

      const otherKeys = Object.keys(mCopy);
      if (otherKeys.length) {
        const otherLines = otherKeys
          .map((k) => '      "' + k + '": ' + JSON.stringify(mCopy[k]))
          .join(',\n');
        parts.push(otherLines);
      }

      parts.push(i === matches.length - 1 ? '    }' : '    },');
    }
  }
  parts.push('  ],');

  // results: one object per line, each contains tournament and roundrobin fields
  parts.push('  "results": [');
  if (results && results.length) {
    parts.push(results.map((r) => '    ' + JSON.stringify(r)).join(',\n'));
  }
  parts.push('  ]');

  parts.push('}');
  return parts.join('\n');
}

const outStr = buildOutput(outObj);
fs.writeFileSync(out, outStr, 'utf8');
console.log('wrote', out);
