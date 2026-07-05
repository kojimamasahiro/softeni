// lib/playerStats/facts.ts
// L1: 対象選手の match/entry を PlayerMatchFact/PlayerEntryFact に落とし時系列昇順に並べる。
// 逆引き索引で当該選手の該当カテゴリだけを開く（全大会スキャン回避）。
//
// データ契約: §D（同定）/ §E（スコア・勝敗・retired・team 除外）/ §G（進出率・roundOrder）。

import crypto from 'crypto';

import { Identity, playerKey, resolveNumericId } from './identity';
import { participantMatchesAliasedId, resolveAliasedPlayerId, resolveAliasedTeam } from './participantAliases';
import { isFinalRound, isSemifinalRound, normalizeRoundOrder, parseCategoryId, resolvePlacement } from './placement';
import { RawEntry, RawParticipant, SourceAdapter, StandardDetail } from './sourceAdapter';
import type { PersonRef, Placement, PlayerEntryFact, PlayerFacts, PlayerMatchFact, ReverseIndex } from './types';

// 1.1.0: ランキングを男女別に分離（rankings/{year}-{discipline}-{gender}.json・
// RankingPoint.gender 追加）。バージョンを上げ全再計算で旧形式の順位表を一掃する。
export const ENGINE_VERSION = '1.1.0';

function personRefFromParticipant(
  identity: Identity,
  p: RawParticipant | undefined,
  fallbackId?: string,
  aliasCtx?: { tournamentId: string; year: number | string },
): PersonRef {
  if (!p) {
    const name = fallbackId ?? '';
    return { id: null, key: playerKey(name), name, team: null };
  }
  const rawName = `${p.lastName ?? ''}${p.firstName ?? ''}`.trim();
  const id =
    resolveNumericId(identity, p.lastName, p.firstName) ??
    (aliasCtx ? resolveAliasedPlayerId(aliasCtx.tournamentId, aliasCtx.year, p.lastName, p.firstName) : null);
  // ローマ字参加者が対応表で解決できた場合、表示名は既存の漢字表記（identity.byId）を優先する。
  const idInfo = id != null ? identity.byId.get(id) : undefined;
  const name = idInfo ? `${idInfo.lastName}${idInfo.firstName}` : rawName;
  const team = (aliasCtx ? resolveAliasedTeam(aliasCtx.tournamentId, aliasCtx.year, p.lastName, p.firstName) : null) ?? p.team ?? null;
  return {
    id,
    key: playerKey(name || p.id, team ?? undefined),
    name: name || p.id,
    team,
  };
}

/** 1 カテゴリ detail から、対象選手（matchingIds）の match/entry facts を抽出する。 */
function factsFromCategory(
  identity: Identity,
  detail: StandardDetail,
  matchingIds: string[],
  ctx: {
    tournamentId: string;
    tournamentName: string;
    year: number;
    categoryId: string;
    category: PlayerMatchFact['category'];
    gender: PlayerMatchFact['gender'];
    ageRaw: string;
    date: string;
    isNational: boolean;
    isMajorTitle: boolean;
  },
): { matches: PlayerMatchFact[]; entries: PlayerEntryFact[] } {
  const matches: PlayerMatchFact[] = [];
  const entries: PlayerEntryFact[] = [];
  const matchingSet = new Set(matchingIds);

  const participantById = new Map<string, RawParticipant>(detail.participants.map((p) => [p.id, p] as const));
  const entryByNo = new Map<number, RawEntry>(detail.entries.map((e) => [e.entryNo, e] as const));

  // 対象選手が属する entryNo 群
  const targetEntryNos = detail.entries.filter((e) => Array.isArray(e.playerIds) && e.playerIds.some((id) => matchingSet.has(id))).map((e) => e.entryNo);
  const targetEntryNoSet = new Set(targetEntryNos);

  // 自分の participant（team 解決用。最初の一致）
  const selfParticipant = detail.participants.find((p) => matchingSet.has(p.id));
  const selfTeam =
    (selfParticipant ? resolveAliasedTeam(ctx.tournamentId, ctx.year, selfParticipant.lastName, selfParticipant.firstName) : null) ??
    selfParticipant?.team ??
    null;

  // ---- matches ----
  for (const m of detail.matches) {
    if (!Array.isArray(m.entries) || m.entries.length === 0) continue;
    const playerEntryNo = m.entries.find((no) => targetEntryNoSet.has(no));
    if (playerEntryNo === undefined) continue;
    const oppEntryNo = m.entries.find((no) => no !== playerEntryNo);
    if (oppEntryNo === undefined) continue;
    // #1 ガード: 同一カテゴリに同姓同名の別人物が居ると、両エントリーが self 判定になり
    // 自己対戦（self-vs-self）として勝敗を二重計上してしまう。相手も self なら除外する
    // （名前単位 id の限界。人物別 id 分離は P7/設計。データ契約 §D）。
    if (targetEntryNoSet.has(oppEntryNo)) continue;

    const scores = m.scores ?? {};
    const gw = Number(scores[String(playerEntryNo)]);
    const gl = Number(scores[String(oppEntryNo)]);
    const gamesWon = Number.isFinite(gw) ? gw : 0;
    const gamesLost = Number.isFinite(gl) ? gl : 0;

    let result: PlayerMatchFact['result'] = 'draw';
    if (typeof m.winnerEntryNo === 'number') {
      result = m.winnerEntryNo === playerEntryNo ? 'win' : 'lose';
    }

    const selfEntry = entryByNo.get(playerEntryNo);
    const oppEntry = entryByNo.get(oppEntryNo);

    let partner: PersonRef | null = null;
    if (selfEntry && selfEntry.playerIds.length > 1) {
      const partnerId = selfEntry.playerIds.find((id) => !matchingSet.has(id));
      if (partnerId) {
        partner = personRefFromParticipant(identity, participantById.get(partnerId), partnerId, { tournamentId: ctx.tournamentId, year: ctx.year });
      }
    }

    const opponents: PersonRef[] = (oppEntry?.playerIds ?? []).map((id) =>
      personRefFromParticipant(identity, participantById.get(id), id, { tournamentId: ctx.tournamentId, year: ctx.year }),
    );

    const stage: 'knockout' | 'roundrobin' = m.stage === 'roundrobin' ? 'roundrobin' : 'knockout';

    matches.push({
      tournamentId: ctx.tournamentId,
      tournamentName: ctx.tournamentName,
      year: ctx.year,
      categoryId: ctx.categoryId,
      category: ctx.category,
      gender: ctx.gender,
      ageRaw: ctx.ageRaw,
      date: ctx.date,
      roundOrder: normalizeRoundOrder(m.round),
      round: m.round ?? null,
      stage,
      result,
      gamesWon,
      gamesLost,
      countsForWinRate: !m.retired,
      opponents,
      partner,
      selfTeam,
      isNational: ctx.isNational,
      isMajorTitle: ctx.isMajorTitle,
    });
  }

  // ---- entries（出場単位。placement・進出率） ----
  const resultByEntryNo = new Map<number, StandardDetail['results'][number]>();
  for (const r of detail.results) {
    if (typeof r.entryNo === 'number' && !resultByEntryNo.has(r.entryNo)) {
      resultByEntryNo.set(r.entryNo, r);
    }
  }

  for (const entryNo of targetEntryNos) {
    const entry = entryByNo.get(entryNo);
    if (!entry) continue;
    const rawResult = resultByEntryNo.get(entryNo);
    const placement: Placement = rawResult ? resolvePlacement(rawResult) : { kind: 'unknown' };

    // 進出率判定（round 名リテラル + placement）
    const entryMatches = detail.matches.filter((m) => Array.isArray(m.entries) && m.entries.includes(entryNo));
    const appearsInKnockout = entryMatches.some((m) => (m.stage ?? 'knockout') !== 'roundrobin');
    const reachedFinal =
      placement.kind === 'winner' ||
      placement.kind === 'runnerup' ||
      entryMatches.some((m) => (m.stage ?? 'knockout') !== 'roundrobin' && isFinalRound(m.round));
    const reachedSemifinal =
      reachedFinal ||
      (placement.kind === 'best' && placement.bestLevel === 4) ||
      entryMatches.some((m) => (m.stage ?? 'knockout') !== 'roundrobin' && isSemifinalRound(m.round));

    const isKnockoutSDM =
      (ctx.category === 'singles' || ctx.category === 'doubles' || ctx.category === 'mixed') &&
      (appearsInKnockout || placement.kind === 'winner' || placement.kind === 'runnerup' || placement.kind === 'best' || placement.kind === 'roundLoss');

    let partner: PersonRef | null = null;
    if (entry.playerIds.length > 1) {
      const partnerId = entry.playerIds.find((id) => !matchingSet.has(id));
      if (partnerId) {
        partner = personRefFromParticipant(identity, participantById.get(partnerId), partnerId, { tournamentId: ctx.tournamentId, year: ctx.year });
      }
    }

    entries.push({
      tournamentId: ctx.tournamentId,
      tournamentName: ctx.tournamentName,
      year: ctx.year,
      categoryId: ctx.categoryId,
      category: ctx.category,
      gender: ctx.gender,
      ageRaw: ctx.ageRaw,
      date: ctx.date,
      isNational: ctx.isNational,
      isMajorTitle: ctx.isMajorTitle,
      entryNo,
      placement,
      reachedFinal,
      reachedSemifinal,
      isKnockoutSinglesDoublesMixed: isKnockoutSDM,
      partner,
      selfTeam,
    });
  }

  return { matches, entries };
}

/** 時系列昇順キー（date → roundOrder）。 */
function sortMatchesChronologically(matches: PlayerMatchFact[]): void {
  matches.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.roundOrder - b.roundOrder;
  });
}

/** 選手 1 人の Facts を構築する（O(m log m)）。 */
export function buildFacts(playerId: number, adapter: SourceAdapter, identity: Identity, reverseIndex: ReverseIndex): PlayerFacts {
  const idInfo = identity.byId.get(playerId);
  const displayName = idInfo ? `${idInfo.lastName}${idInfo.firstName}` : String(playerId);
  const categories = reverseIndex[String(playerId)]?.categories ?? [];

  const allMatches: PlayerMatchFact[] = [];
  const allEntries: PlayerEntryFact[] = [];
  const hashes: string[] = [];
  let currentTeam: string | null = null;
  let latestDate = '';

  for (const catKey of categories) {
    const [tournamentId, yearStr, categoryId] = catKey.split('/');
    const parsed = parseCategoryId(categoryId);
    if (!parsed) continue;
    // team は個人統計対象外（§E）。
    if (parsed.category === 'team') continue;

    const detail = adapter.readStandardDetail(tournamentId, yearStr, categoryId);
    if (!detail || !idInfo) continue;

    const matchingIds = detail.participants
      .filter(
        (p) =>
          (p.lastName === idInfo.lastName && p.firstName === idInfo.firstName) ||
          participantMatchesAliasedId(tournamentId, yearStr, p.lastName, p.firstName, playerId),
      )
      .map((p) => p.id);
    if (matchingIds.length === 0) continue;

    const meta = adapter.metaFor(tournamentId);
    const info = adapter.getInfoForYear(tournamentId, Number(yearStr));
    const date = info?.startDate ?? '';
    hashes.push(adapter.contentHash(tournamentId, yearStr, categoryId));

    const { matches, entries } = factsFromCategory(identity, detail, matchingIds, {
      tournamentId,
      tournamentName: meta.label,
      year: Number(yearStr),
      categoryId,
      category: parsed.category,
      gender: parsed.gender,
      ageRaw: parsed.ageRaw,
      date,
      isNational: meta.isNational,
      isMajorTitle: meta.isMajorTitle,
    });
    allMatches.push(...matches);
    allEntries.push(...entries);

    // currentTeam = 最新出場時の所属
    const selfTeam = matches[0]?.selfTeam ?? entries[0]?.selfTeam ?? null;
    if (selfTeam && date >= latestDate) {
      latestDate = date;
      currentTeam = selfTeam;
    }
  }

  sortMatchesChronologically(allMatches);

  const sourceHash = crypto
    .createHash('sha1')
    .update(hashes.sort().join('|') + `|${ENGINE_VERSION}`)
    .digest('hex')
    .slice(0, 16);

  const homonymRisk = idInfo ? identity.homonymNames.has(`${idInfo.lastName}\t${idInfo.firstName}`) : false;

  return {
    playerId,
    displayName,
    currentTeam,
    homonymRisk,
    matches: allMatches,
    entries: allEntries,
    sourceHash,
    engineVersion: ENGINE_VERSION,
  };
}
