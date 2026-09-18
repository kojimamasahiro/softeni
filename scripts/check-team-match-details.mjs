#!/usr/bin/env node
/**
 * 団体戦の対戦ごとの記録（details の matches[].matches[]、ADR-020）の整合性チェック。
 * 問題があれば終了コード 1。
 *
 *   node scripts/check-team-match-details.mjs
 *
 * 見ること:
 *   1. 形: type / status / winner / score の組み合わせが仕様どおりか
 *      （completed は勝者あり・勝者の本数が多い、retired は勝者あり・本数の大小は問わない、
 *       walkover は勝者あり・本数なし・負けた側の選手が空、unfinished は勝者なし・本数あり、
 *       not_played は本数なし）
 *   2. 親との一致: 勝者 A の数・B の数が親の scores（entries[0] / entries[1]）と一致するか
 *   3. 選手: 姓・名で持つ選手が個人戦の出場記録に実在するか、誤分割と判断済みの綴りでないか。
 *      姓名の分割修正（normalize-name-splits.mjs）から取り残されると、選手ページに繋がらなくなる
 *   4. 取り違え: 同じ選手が1ファイルの中で2校に割り当てられていないか
 *
 * 取り込みは scripts/pdf/highschool_senbatsu_team_matches.py。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DETAILS = path.join(ROOT, 'data', 'tournaments', 'details');
const ALIAS_PATH = path.join(ROOT, 'data', 'players', 'name-split-aliases.json');

const TYPES = new Set(['D1', 'D2', 'D3', 'S']);
const STATUSES = new Set(['completed', 'retired', 'walkover', 'unfinished', 'not_played']);

/**
 * 4.（取り違え）の例外: **同名の別人**が同じ大会の2校に出ている組み合わせ。
 * 人がPDFで確かめたものだけを、ファイルと氏名を明示して足す（氏名だけで緩めない）。
 * 取り込み側は `--same-name` で同じことを通す。
 */
const SAME_NAME_DIFFERENT_PEOPLE = {
  // 2023 インターハイ男子: 中京(2) の佐藤直輝（ペアは前田英貴）と羽黒(7) の佐藤直輝（ペアは木皿璃夢斗）。
  // どちらも2回戦・3回戦で同じペアなので、塊の取り違えではなく同名の別人。
  'data/tournaments/details/highschool-championship/2023/team-none-boys.json': ['佐藤直輝'],
};

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'temp' ? [] : walk(p);
    return e.name.endsWith('.json') ? [p] : [];
  });

const readJson = (file) => {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
};

const files = walk(DETAILS)
  .map((file) => ({ file, data: readJson(file) }))
  .filter((f) => f.data);

// 個人戦の出場記録にある姓・名
const individualNames = new Set();
for (const { data } of files) {
  for (const p of data.participants ?? []) {
    if (p.lastName && p.firstName) individualNames.add(`${p.lastName}\t${p.firstName}`);
  }
}
const aliasNames = new Set();
for (const e of JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8')).entries ?? []) {
  for (const [ln, fn] of e.aliases ?? []) aliasNames.add(`${ln}\t${fn}`);
}

const problems = [];
let checkedMatches = 0;
let checkedSubs = 0;

const playerKey = (p) => (p.name !== undefined ? `name:${p.name.replace(/\s+/g, '')}` : `${p.lastName}\t${p.firstName}`);

for (const { file, data } of files) {
  const rel = path.relative(ROOT, file);
  const owner = new Map(); // playerKey -> Set(entryNo)
  for (const m of data.matches ?? []) {
    if (!Array.isArray(m.matches)) continue;
    checkedMatches += 1;
    const where = `${rel} ${m.matchId}`;
    const [a, b] = m.entries ?? [];
    let winsA = 0;
    let winsB = 0;
    for (const [i, sub] of m.matches.entries()) {
      checkedSubs += 1;
      const at = `${where} [${i}]`;
      if (!TYPES.has(sub.type)) problems.push(`${at}: type が不正 (${sub.type})`);
      if (!STATUSES.has(sub.status)) problems.push(`${at}: status が不正 (${sub.status})`);
      const hasScore = Number.isInteger(sub.scoreA) && Number.isInteger(sub.scoreB);
      const noScore = sub.scoreA === null && sub.scoreB === null;
      if (sub.status === 'completed') {
        if (sub.winner !== 'A' && sub.winner !== 'B') problems.push(`${at}: completed なのに winner が無い`);
        else if (!hasScore) problems.push(`${at}: completed なのに本数が無い`);
        else if ((sub.winner === 'A') !== sub.scoreA > sub.scoreB) problems.push(`${at}: winner と本数が合わない (${sub.scoreA}-${sub.scoreB} ${sub.winner})`);
      } else if (sub.status === 'retired') {
        // 途中棄権。棄権しなかった側の勝ちで、**勝者の本数が多いとは限らない**
        // （実例: アジア競技大会2026 男子団体 韓国-インドネシア 第3対戦は 3-2 から韓国が棄権）。
        // 勝敗は本数から導けないので winner を必ず持つ。
        if (sub.winner !== 'A' && sub.winner !== 'B') problems.push(`${at}: retired なのに winner が無い`);
        if (!hasScore) problems.push(`${at}: retired なのに棄権時点の本数が無い`);
      } else if (sub.status === 'walkover') {
        // 不戦勝。片側がペアを出さなかった＝試合は行われていないので本数は持たない。
        // 出さなかった側の選手は空配列（下の人数チェックで空を許すのはこの状態だけ）。
        if (sub.winner !== 'A' && sub.winner !== 'B') problems.push(`${at}: walkover なのに winner が無い`);
        if (!noScore) problems.push(`${at}: walkover なのに本数がある（試合は行われていない）`);
        const empty = [sub.playersA, sub.playersB].filter((ps) => Array.isArray(ps) && ps.length === 0).length;
        if (empty !== 1) problems.push(`${at}: walkover はペアを出さなかった側だけが空（空の側が ${empty} つ）`);
        else if ((sub.winner === 'A') !== (sub.playersB.length === 0)) problems.push(`${at}: walkover の勝者がペアを出した側でない`);
      } else if (sub.status === 'unfinished') {
        if (sub.winner !== null) problems.push(`${at}: unfinished なのに winner がある`);
        if (!hasScore) problems.push(`${at}: unfinished なのに途中の本数が無い`);
      } else if (sub.status === 'not_played') {
        if (sub.winner !== null || !noScore) problems.push(`${at}: not_played なのに winner か本数がある`);
      }
      if (Array.isArray(sub.games)) {
        // ゲームごとのポイント（インターハイ）。本数と数え直しが合うかまで見る
        let wonA = 0;
        let wonB = 0;
        for (const [gi, g] of sub.games.entries()) {
          if (!Array.isArray(g) || g.length !== 2 || !g.every((v) => Number.isInteger(v) && v >= 0)) {
            problems.push(`${at}: games[${gi}] が [数, 数] でない ${JSON.stringify(g)}`);
            continue;
          }
          if (g[0] === g[1]) problems.push(`${at}: games[${gi}] が同点 ${g[0]}-${g[1]}（取った側が決まらない）`);
          else if (g[0] > g[1]) wonA += 1;
          else wonB += 1;
        }
        if (sub.status !== 'not_played' && (wonA !== sub.scoreA || wonB !== sub.scoreB)) {
          problems.push(`${at}: 本数 ${sub.scoreA}-${sub.scoreB} がゲームごとのポイントの数え直し ${wonA}-${wonB} と合わない`);
        }
        if (sub.status === 'not_played' && sub.games.length > 0) problems.push(`${at}: not_played なのに games がある`);
      }
      if (sub.winner === 'A') winsA += 1;
      if (sub.winner === 'B') winsB += 1;

      for (const [side, entryNo] of [
        ['playersA', a],
        ['playersB', b],
      ]) {
        const players = sub[side];
        if (!Array.isArray(players) || (players.length === 0 && sub.status !== 'walkover')) {
          problems.push(`${at}: ${side} が空`);
          continue;
        }
        // 不戦勝でペアを出さなかった側は空のまま（人数は問わない）
        if (players.length === 0) continue;
        if (sub.type.startsWith('D') && players.length !== 2) problems.push(`${at}: ダブルスなのに ${side} が ${players.length} 人`);
        if (sub.type === 'S' && players.length !== 1) problems.push(`${at}: シングルスなのに ${side} が ${players.length} 人`);
        for (const p of players) {
          const named = typeof p?.name === 'string' && p.name.trim() && p.lastName === undefined;
          const split = typeof p?.lastName === 'string' && typeof p?.firstName === 'string' && p.lastName && p.firstName && p.name === undefined;
          if (!named && !split) {
            problems.push(`${at}: 選手の形が不正 ${JSON.stringify(p)}`);
            continue;
          }
          if (split) {
            const k = `${p.lastName}\t${p.firstName}`;
            if (aliasNames.has(k)) problems.push(`${at}: ${p.lastName}|${p.firstName} は誤分割と判断済みの綴り（normalize-name-splits.mjs を実行）`);
            else if (!individualNames.has(k)) problems.push(`${at}: ${p.lastName}|${p.firstName} が個人戦の出場記録に無い`);
          }
          const key = playerKey(p);
          if (!owner.has(key)) owner.set(key, new Set());
          owner.get(key).add(entryNo);
        }
      }
    }
    const want = [m.scores?.[String(a)], m.scores?.[String(b)]];
    if (winsA !== want[0] || winsB !== want[1]) problems.push(`${where}: 対戦の勝ち数 ${winsA}-${winsB} が試合の本数 ${want[0]}-${want[1]} と合わない`);
  }
  const sameName = new Set(SAME_NAME_DIFFERENT_PEOPLE[rel] ?? []);
  for (const [key, entryNos] of owner) {
    const name = key.replace('\t', '');
    if (entryNos.size > 1 && !sameName.has(name))
      problems.push(`${rel}: ${name} が複数の学校（entryNo ${[...entryNos].join(', ')}）に割り当てられている`);
  }
}

console.log(`団体戦の対戦ごとの記録: ${checkedMatches} 試合 / ${checkedSubs} 対戦`);
if (problems.length) {
  for (const p of problems) console.log(`  NG ${p}`);
  console.log(`${problems.length} 件の問題`);
  process.exit(1);
}
console.log('問題なし');
