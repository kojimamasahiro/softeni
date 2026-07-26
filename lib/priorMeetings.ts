// lib/priorMeetings.ts
// 文脈ブロック「前哨戦・再戦」: 対象大会の出場ペアどうしが、それ以前の別大会で
// 既に対戦していた事実を抽出する。
//
// 用途は 2 つあり、同じ索引から両方を導く（ADR-005「文脈ブロックが一次成果物、
// 記事はその再利用先の一つ」）:
//   1. 大会前（プレビュー）— 「この大会には既知の対戦カードが N 件ある」
//   2. 大会中／大会後（結果ページ）— 「この試合は◯◯大会 準々決勝の再戦」
//
// **ペア（名前セット）単位で照合する**のが本モジュールの肝。2026-07-26 の実測で、
// 選手単位の照合は同姓同名の汚染が約 3%（スコープを地区大会に絞っても 2.11% で
// ほとんど下がらない）である一方、ダブルスのペア単位では
//   - インターハイ 2026 で同一の名前セットを持つエントリは男女とも 0 件（316/314 ペア）
//   - 地区大会 → IH で一致した 565 ペアのうち都道府県の不一致 0 件
// と曖昧性が消えることが分かった。誤マッチ率を決めるのはスコープの狭さではなく
// **照合キーの結合度**である。詳細は docs/raw/2026-07-26-homonym-measurement.md。
//
// **`generationId` は一致するものだけを候補にする**（同一世代のみ。詳細は findPriorEditions）。
//
// **シングルス（1 名エントリ）は「名前＋所属」で照合する**（2026-07-26 追加）。
// 名前 1 つだけでは上記の一意性が担保できないため所属を鍵に足す。これは次の
// トレードオフを**許容する**という運用判断に基づく（ユーザー決定・2026-07-26）:
//   - 年度間で所属が変わる（進学・転職）と一致しなくなり、取りこぼす
//   - 同姓同名かつ同一所属の別人は誤って同一視される
// ダブルス（名前 2 つの結合）や団体（校名）と違い**構造的な保証が無い**ので、
// シングルスの前哨戦は「取りこぼし前提・完全ではない」という性質を持つ。
//
// **団体戦は校単位**（校名＋都道府県）で照合する。選手名を持たないため個人と同じキーは
// 使えないが、`historical-winners` / milestone が団体を championKey（校単位）で扱っている
// 既存パターンがあり、それに合わせている。校名は team-name-aliases.json による正規化を
// 通っている前提。

import fs from 'fs';
import path from 'path';

import { buildParticipantMap, readYearDetail, type RawDetail, type RawParticipant } from '@/lib/tournamentRecords';

/**
 * 遡る窓（月）。対象大会の開催日から遡ってこの期間内に行われた開催を候補にする。
 *
 * 経緯: 当初 3 ヶ月 →「前回この大会が開かれてから」→ **1 年**（2026-07-26）。
 * 「前回開催から」は大会の周期に自動追従する利点があったが、大会ごとに窓の長さが変わり
 * 「どこまで遡っているか」を説明しづらいため 1 年を基準にした。
 *
 * ただし **1 年ちょうどで切ると前回開催を取りこぼす**。実測（2026-07-26）:
 * インターハイは前回 2025-07-25 → 今回 2026-07-31 で **371 日**、ハイスクールジャパンカップも
 * **370 日**空いており、素の 12 ヶ月窓では前回開催が窓の外に落ちる（実際これで
 * 団体戦の検出が 67 件 → 41 件に減った）。最も価値の高い「昨年のこの大会でも対戦している」を
 * 落とさないため、**窓の下限は「1 年前」と「同一大会の前回開催日」の早い方**にする
 * （`findPriorEditions`）。
 */
const PRIOR_WINDOW_MONTHS = 12;

export type PriorMeeting = {
  /** 対戦が行われた大会 */
  tournamentId: string;
  tournamentLabel: string;
  year: number;
  /** 例: 準々決勝 / 3回戦 */
  round: string | null;
  /** 対象大会での entryNo（勝った側 / 負けた側） */
  winnerEntryNo: number;
  loserEntryNo: number;
  /** 表示用の選手名 */
  winnerNames: string[];
  loserNames: string[];
};

/** key = `${小さい方のentryNo}-${大きい方のentryNo}`（対象大会の entryNo） */
export type PriorMeetingIndex = Map<string, PriorMeeting[]>;

export function meetingKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function resolveRoot(): string {
  return process.cwd();
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

type IndexRow = { tournamentId: string; label?: string; generationId?: string };

/**
 * index.json（全国・主要大会）と local_index.json（地区大会・県大会）を連結して読む。
 * 前哨戦の主な供給源は local_index 側の地区大会なので、両方を見る必要がある。
 */
let tournamentsCache: IndexRow[] | null = null;

function readAllTournaments(): IndexRow[] {
  if (tournamentsCache) return tournamentsCache;
  const out: IndexRow[] = [];
  for (const file of ['index.json', 'local_index.json']) {
    const rows = readJson<IndexRow[]>(path.join(resolveRoot(), 'data', 'tournaments', file));
    if (Array.isArray(rows)) out.push(...rows);
  }
  tournamentsCache = out;
  return out;
}

/**
 * 大会 → 開催年一覧。**必ずキャッシュする**。
 * `findPriorEditions` は全大会 × 全開催をループするため、素直に実装すると
 * 1 ページあたり数百回の JSON 読み込みが走る（実測で索引全体が 4.0 秒 → キャッシュ後 1.5 秒）。
 */
const editionsCache = new Map<string, Array<{ year: number; startDate?: string }>>();

function readEditions(tournamentId: string): Array<{ year: number; startDate?: string }> {
  const hit = editionsCache.get(tournamentId);
  if (hit) return hit;
  const rows = readJson<Array<{ year: number; startDate?: string }>>(path.join(resolveRoot(), 'data', 'tournaments', 'information', `${tournamentId}.json`));
  const val = Array.isArray(rows) ? rows : [];
  editionsCache.set(tournamentId, val);
  return val;
}

function startDateOf(tournamentId: string, year: number): string | null {
  return readEditions(tournamentId).find((e) => e.year === year)?.startDate ?? null;
}

function normName(s: string): string {
  return s.replace(/\s+/gu, '');
}

/**
 * エントリ → 照合キー。3 種類あり、種目によって強度が違う。
 *
 * - **ダブルス（2 名）**: 選手 2 名の名前セット。名前の結合で一意性が実測されている
 *   （最も安全。所属が変わっても追跡できる）。
 * - **シングルス（1 名）**: `名前@所属`。名前 1 つでは一意性が無いため所属を足す。
 *   所属変更で取りこぼす／同姓同名かつ同一所属は誤同一視する、というトレードオフを許容する
 *   （2026-07-26 の運用判断。モジュール冒頭のコメント参照）。所属不明なら対象外。
 * - **団体**: `校名@都道府県`。`participants` が `lastName: null` で `team` のみを持つ形。
 *   `historical-winners` / milestone が団体を `championKey`（校単位）で扱う既存パターンに合わせる。
 *
 * いずれにも当てはまらなければ null（対象外）。
 */
function entryKeyOf(playerIds: string[], pmap: Map<string, RawParticipant>): { key: string; names: string[]; isTeam: boolean } | null {
  const rows: RawParticipant[] = [];
  for (const id of playerIds) {
    const p = pmap.get(id);
    if (p) rows.push(p);
  }
  if (rows.length === 0) return null;

  // 団体戦: 1 エントリ = 1 校（選手名を持たない）
  if (rows.length === 1 && !rows[0].lastName && rows[0].team) {
    const team = normName(rows[0].team);
    if (!team) return null;
    return { key: `T:${team}@${normName(rows[0].prefecture ?? '')}`, names: [rows[0].team], isTeam: true };
  }

  const names: string[] = [];
  for (const p of rows) {
    const n = normName(`${p.lastName ?? ''}${p.firstName ?? ''}`);
    // 氏名が未分割（firstName 欠落）のレコードは名前だけでは同定できないため対象外。
    if (!p.lastName || !p.firstName || !n) return null;
    names.push(n);
  }

  // シングルス: 名前 1 つでは一意にならないので所属を足す。所属不明なら諦める。
  if (names.length === 1) {
    const team = normName(rows[0].team ?? '');
    if (!team) return null;
    return { key: `S:${names[0]}@${team}`, names, isTeam: false };
  }

  if (names.length !== 2) return null;
  const sorted = [...names].sort();
  return { key: sorted.join(' '), names: sorted, isTeam: false };
}

/** 対象大会の「照合キー → entryNo」索引。 */
function buildFieldPairIndex(detail: RawDetail): Map<string, number> {
  const pmap = buildParticipantMap(detail);
  const out = new Map<string, number>();
  for (const e of detail.entries ?? []) {
    const pk = entryKeyOf(e.playerIds ?? [], pmap);
    if (!pk) continue;
    // 同一ペア／同一校が複数エントリに出ることは実測で 0 件。万一あれば先勝ちにする。
    if (!out.has(pk.key)) out.set(pk.key, e.entryNo);
  }
  return out;
}

/**
 * 対象大会（tournamentId / year）から見て**直近 1 年以内**に行われた開催を候補として返す。
 * 呼び出し側で**同一 categoryId** に限定される（種目・性別・年齢区分が一致するもののみ）。
 * **同一大会の前回開催そのものも含む**。
 *
 * **同一大会の前回開催を含める**のは、「昨年のこの大会でも対戦している」が最も価値の高い
 * 文脈だから（実測で全体の約 1/4 がこの自大会由来）。当年の開催だけは当然除外する。
 *
 * **`generationId` は完全一致のみ**（2026-07-26 決定）。`all` は `all` とだけ、`highschool` は
 * `highschool` とだけ照合する。世代をまたぐ照合（`junior` ↔ `highschool` の進学、
 * `international-qualifier` ↔ `all` の実質同一層など）は技術的には成立していたが、
 * **文脈として「同じ土俵の直近の対戦」に絞る**ためこの制約を置く（運用判断・ユーザー決定）。
 * 世代が変わって拾えなくなるケースは許容する。
 *
 * `categoryId` も揃える（男子ダブルスの対戦を女子ダブルスの文脈に混ぜない）。
 */
function findPriorEditions(
  tournamentId: string,
  year: number,
  startDateIso: string,
  generationId: string | null,
): Array<{ tournamentId: string; label: string; year: number }> {
  const target = new Date(startDateIso);
  if (Number.isNaN(target.getTime())) return [];

  const windowStart = new Date(target);
  windowStart.setMonth(windowStart.getMonth() - PRIOR_WINDOW_MONTHS);
  // 同一大会の前回開催が 1 年より前でも必ず窓に含める（開催日は年ごとに数日ずれるため、
  // 1 年ちょうどで切ると前回開催を落とす。上の定数コメント参照）。
  for (const ed of readEditions(tournamentId)) {
    if (!ed.startDate) continue;
    const d = new Date(ed.startDate);
    if (Number.isNaN(d.getTime()) || d >= target) continue;
    if (d < windowStart) {
      // 前回開催（= target より前で最も新しい開催）だけを対象にする
      const isPrevEdition = !readEditions(tournamentId).some((o) => {
        if (!o.startDate) return false;
        const od = new Date(o.startDate);
        return !Number.isNaN(od.getTime()) && od < target && od > d;
      });
      if (isPrevEdition) windowStart.setTime(d.getTime());
    }
  }

  const out: Array<{ tournamentId: string; label: string; year: number; startDate: string }> = [];
  for (const t of readAllTournaments()) {
    if (!t.tournamentId) continue;
    // 同一世代のみ。generationId が解決できない大会は絞り込まず従来どおり候補に入れる
    // （誤って候補ゼロにするより安全側。④ findRecentTournaments と同じ方針）。
    if (generationId && t.generationId !== generationId) continue;
    for (const ed of readEditions(t.tournamentId)) {
      if (!ed.startDate) continue;
      // 自大会は「前回開催」を含めるが、当年の開催自体は除く（同じ大会の中の対戦は再戦ではない）。
      if (t.tournamentId === tournamentId && ed.year === year) continue;
      const d = new Date(ed.startDate);
      if (Number.isNaN(d.getTime())) continue;
      if (d >= windowStart && d < target) {
        out.push({ tournamentId: t.tournamentId, label: t.label ?? t.tournamentId, year: ed.year, startDate: ed.startDate });
      }
    }
  }
  // 新しい順（表示順の既定）。件数は絞らない: 地区大会は 9 件が同時に該当するのが正常で、
  // 「直近 2 大会」を選ぶ recentAchievers と違い、ここは網羅することに意味がある。
  out.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return out.map(({ tournamentId: id, label, year: y }) => ({ tournamentId: id, label, year: y }));
}

/**
 * 対象大会・年度・種目について、出場ペアどうしの「過去の対戦」を索引化する。
 * 個人はペア（名前セット）単位、団体は校単位で照合する。
 * 該当が無い、または対象がシングルスなら空の Map を返す（graceful）。
 */
export function buildPriorMeetingIndex(tournamentId: string, year: number, categoryId: string, generationId: string | null): PriorMeetingIndex {
  const out: PriorMeetingIndex = new Map();
  const detail = readYearDetail(tournamentId, year, categoryId);
  if (!detail || !detail.entries?.length) return out;

  const field = buildFieldPairIndex(detail);
  if (field.size === 0) return out; // シングルス等、照合キーを作れない種目はここで抜ける

  const startDate = startDateOf(tournamentId, year);
  if (!startDate) return out;

  for (const ed of findPriorEditions(tournamentId, year, startDate, generationId)) {
    const src = readYearDetail(ed.tournamentId, ed.year, categoryId);
    if (!src || !src.matches?.length || !src.entries?.length) continue;
    const spmap = buildParticipantMap(src);
    const srcPair = new Map<number, { key: string; names: string[]; isTeam: boolean }>();
    for (const e of src.entries) {
      const pk = entryKeyOf(e.playerIds ?? [], spmap);
      if (pk) srcPair.set(e.entryNo, pk);
    }
    for (const m of src.matches) {
      const es = m.entries ?? [];
      if (es.length !== 2 || m.winnerEntryNo == null) continue;
      const a = srcPair.get(es[0]);
      const b = srcPair.get(es[1]);
      if (!a || !b) continue;
      const ea = field.get(a.key);
      const eb = field.get(b.key);
      if (ea == null || eb == null || ea === eb) continue; // 双方が対象大会に出ている場合のみ
      const winnerIsFirst = m.winnerEntryNo === es[0];
      const meeting: PriorMeeting = {
        tournamentId: ed.tournamentId,
        tournamentLabel: ed.label,
        year: ed.year,
        round: m.round ?? null,
        winnerEntryNo: winnerIsFirst ? ea : eb,
        loserEntryNo: winnerIsFirst ? eb : ea,
        winnerNames: winnerIsFirst ? a.names : b.names,
        loserNames: winnerIsFirst ? b.names : a.names,
      };
      const key = meetingKey(ea, eb);
      const list = out.get(key);
      if (list) list.push(meeting);
      else out.set(key, [meeting]);
    }
  }
  return out;
}

/**
 * 全大会・全年度・全種目を横断した前哨戦の索引（プロセス内で 1 度だけ構築してキャッシュ）。
 * key = `${tournamentId}/${year}/${categoryId}/${meetingKey(a,b)}`。
 *
 * 選手結果ページ（約 1,900 ページ）が「この試合は再戦だったか」を引くために使う。
 * ページごとに `buildPriorMeetingIndex` を呼ぶと同じ計算を何度も繰り返すため、
 * 全体を 1 度だけ作る（実測 333 組・約 900ms）。
 */
let allMeetingsCache: Map<string, PriorMeeting[]> | null = null;

export function loadAllPriorMeetings(): Map<string, PriorMeeting[]> {
  if (allMeetingsCache) return allMeetingsCache;
  const out = new Map<string, PriorMeeting[]>();
  const genOf = new Map<string, string | undefined>();
  for (const t of readAllTournaments()) genOf.set(t.tournamentId, t.generationId);
  const root = path.join(resolveRoot(), 'data', 'tournaments', 'details');
  let tids: string[] = [];
  try {
    tids = fs.readdirSync(root);
  } catch {
    allMeetingsCache = out;
    return out;
  }
  for (const tid of tids) {
    const tdir = path.join(root, tid);
    let years: string[] = [];
    try {
      if (!fs.statSync(tdir).isDirectory()) continue;
      years = fs.readdirSync(tdir);
    } catch {
      continue;
    }
    for (const y of years) {
      if (!/^\d{4}$/.test(y)) continue;
      let files: string[] = [];
      try {
        files = fs.readdirSync(path.join(tdir, y));
      } catch {
        continue;
      }
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const cid = f.replace(/\.json$/u, '');
        const idx = buildPriorMeetingIndex(tid, Number(y), cid, genOf.get(tid) ?? null);
        for (const [k, list] of idx) out.set(`${tid}/${y}/${cid}/${k}`, list);
      }
    }
  }
  allMeetingsCache = out;
  return out;
}

/** 1 試合ぶんの再戦情報を引く。再戦でなければ null。 */
export function lookupPriorMeeting(tournamentId: string, year: number | string, categoryId: string, a: number, b: number): PriorMeeting | null {
  const list = loadAllPriorMeetings().get(`${tournamentId}/${year}/${categoryId}/${meetingKey(a, b)}`);
  return list?.[0] ?? null;
}

/** 索引に含まれる対戦カードの総数（同一カードが複数回対戦していればその回数ぶん）。 */
export function countPriorMeetings(index: PriorMeetingIndex): number {
  let n = 0;
  for (const list of index.values()) n += list.length;
  return n;
}

/** 対戦履歴を持つエントリの数（対象大会のペア数のうち何組か）。 */
export function countCoveredEntries(index: PriorMeetingIndex): number {
  const s = new Set<number>();
  for (const list of index.values())
    for (const m of list) {
      s.add(m.winnerEntryNo);
      s.add(m.loserEntryNo);
    }
  return s.size;
}
