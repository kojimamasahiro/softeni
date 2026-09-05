// チーム名の表記揺れを「選手の共有」から検出する（名前の類似度を使わないシグナル）。
//
// なぜ必要か:
//   既存のマージ候補検出（scripts/lib/team-core.mjs のコア一致）は、接尾辞を落とした
//   コアが**完全一致**することを条件にしている。したがって内部略称のように語中の文字が
//   落ちる揺れ（`岡山理大附` ⇔ `岡山理科大附高校` の 理大/理科大）は原理的に拾えず、
//   docs/wiki/team-player-identity.md では長らく「既知の残課題（手動残務）」だった。
//   部分列一致で拾おうとすると `鹿児島実`/`鹿児島商` のような別校を誤結合するため不採用。
//
// このモジュールが使うシグナル:
//   **同一年度に、同じ氏名の選手が2チーム以上に出場している**こと。
//   実在の別チームなら（進学・転校でも）同一年度に両方へ在籍することは無いので、
//   同年共起は「表記揺れ」か「同姓同名の別人」のどちらかに絞られる。
//   同姓同名の混入を抑えるため **共有選手2名以上**を要求する（1名では偶然が残る）。
//
// 検出しないもの（意図的）:
//   - コアが一致するペア: 既存のコア一致シグナルの担当なので二重計上しない。
//   - 都道府県が違う / どちらかが null のペア: 既存の候補生成と同じ県ブロッキングに揃える。
//     大学・連盟系は prefecture が null になるため、この検出器の対象外。
//
// 既知の偽陽性（自動マージしてはいけない理由）:
//   小学生・社会人では「クラブ所属」と「市協会・勤務先」の二重登録が実在する
//   （例: `大館ジュニア` と `大館市協会`、`兼六クラブ` と `能登町役場`）。
//   これらは同年共起するが別チーム。よって出力は**人手レビュー用の候補**に限る。

import fs from 'fs';
import path from 'path';

import { teamCore } from './team-core.mjs';

/** 同姓同名の偶然を排除するために必要な共有選手数。 */
export const MIN_SHARED_PLAYERS = 2;

/** チーム名の正規化。build-team-master.mjs と同じ規則（キー照合専用）。 */
const norm = (s) => (s == null ? s : s.normalize('NFKC').replace(/[ 　]/g, '').replace(/[･•]/g, '・'));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'temp' ? [] : walk(p);
    return e.name.endsWith('.json') ? [p] : [];
  });
}

/**
 * 選手共有シグナルによるマージ候補ペアを返す。
 *
 * @param {string} root リポジトリルート
 * @param {{id:number,name:string,prefecture:string|null,aliases?:string[]}[]} teams data/teams/teams.json
 * @returns {{a:object,b:object,players:string[],years:number[],tournaments:string[]}[]} 共有選手数の多い順
 */
export function findPlayerOverlapPairs(root, teams) {
  const DET = path.join(root, 'data', 'tournaments', 'details');
  const aliasToCanon = new Map();
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(root, 'data', 'tournaments', 'team-name-aliases.json'), 'utf8'));
    for (const e of doc.teamAliases || []) for (const a of e.aliases || []) aliasToCanon.set(norm(a), e.canonical);
  } catch {
    /* エイリアス表が無くても素の表記だけで動く */
  }
  // teams.json の正準名・別名からチームを引く索引
  const byKey = new Map();
  for (const t of teams) {
    byKey.set(norm(t.name), t);
    for (const a of t.aliases || []) byKey.set(norm(a), t);
  }

  // (氏名, 年) -> Map<チームキー, Set<大会id>>
  const obs = new Map();
  for (const file of walk(DET)) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    const rel = path.relative(DET, file).split(path.sep);
    const tid = rel[0];
    const year = /^\d{4}$/.test(rel[1]) ? +rel[1] : null;
    if (!year) continue; // 年が無いデータは同年共起を判定できない
    for (const p of data.participants || []) {
      if (!p.team || !p.lastName || !p.firstName) continue; // 氏名未分割の行は同一性を判断できない
      const canon = aliasToCanon.get(norm(p.team));
      const key = canon ? norm(canon) : norm(p.team);
      const obsKey = p.lastName + p.firstName + '|' + year;
      let m = obs.get(obsKey);
      if (!m) obs.set(obsKey, (m = new Map()));
      let s = m.get(key);
      if (!s) m.set(key, (s = new Set()));
      s.add(tid);
    }
  }

  // 同年に2チーム以上へ出ている選手からペアを起こす
  const pairs = new Map();
  for (const [obsKey, m] of obs) {
    if (m.size < 2) continue;
    const sep = obsKey.lastIndexOf('|');
    const name = obsKey.slice(0, sep);
    const year = +obsKey.slice(sep + 1);
    const keys = [...m.keys()].sort();
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const ta = byKey.get(keys[i]);
        const tb = byKey.get(keys[j]);
        if (!ta || !tb || ta.id === tb.id) continue;
        // 県ブロッキング（既存の候補生成と同条件）とコア一致の除外
        if (!ta.prefecture || ta.prefecture !== tb.prefecture) continue;
        if (teamCore(ta.name) === teamCore(tb.name)) continue;
        const pk = ta.id < tb.id ? `${ta.id}-${tb.id}` : `${tb.id}-${ta.id}`;
        let e = pairs.get(pk);
        if (!e) pairs.set(pk, (e = { a: ta.id < tb.id ? ta : tb, b: ta.id < tb.id ? tb : ta, players: new Set(), years: new Set(), tournaments: new Set() }));
        e.players.add(name);
        e.years.add(year);
        for (const t of m.get(keys[i])) e.tournaments.add(t);
        for (const t of m.get(keys[j])) e.tournaments.add(t);
      }
    }
  }

  return [...pairs.values()]
    .filter((e) => e.players.size >= MIN_SHARED_PLAYERS)
    .map((e) => ({
      a: e.a,
      b: e.b,
      players: [...e.players].sort(),
      years: [...e.years].sort((x, y) => x - y),
      tournaments: [...e.tournaments].sort(),
    }))
    .sort((x, y) => y.players.length - x.players.length || x.a.id - y.a.id || x.b.id - y.b.id);
}

/**
 * ペアを連結成分（クラスタ）へまとめる。`白鷗大足利` のように3表記以上に割れている
 * ケースを1件として扱うため。
 *
 * @returns {{prefecture:string|null, members:object[], sharedPlayers:string[], years:number[], tournaments:string[]}[]}
 */
export function clusterPlayerOverlapPairs(pairs) {
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (x, y) => {
    for (const v of [x, y]) if (!parent.has(v)) parent.set(v, v);
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };
  const teamById = new Map();
  for (const p of pairs) {
    teamById.set(p.a.id, p.a);
    teamById.set(p.b.id, p.b);
    union(p.a.id, p.b.id);
  }
  const groups = new Map();
  for (const p of pairs) {
    const r = find(p.a.id);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = { ids: new Set(), players: new Set(), years: new Set(), tournaments: new Set() }));
    g.ids.add(p.a.id).add(p.b.id);
    for (const x of p.players) g.players.add(x);
    for (const x of p.years) g.years.add(x);
    for (const x of p.tournaments) g.tournaments.add(x);
  }
  return [...groups.values()]
    .map((g) => {
      const members = [...g.ids].map((id) => teamById.get(id)).sort((a, b) => b.count - a.count);
      return {
        prefecture: members[0].prefecture ?? null,
        members,
        sharedPlayers: [...g.players].sort(),
        years: [...g.years].sort((a, b) => a - b),
        tournaments: [...g.tournaments].sort(),
      };
    })
    .sort((a, b) => b.sharedPlayers.length - a.sharedPlayers.length || a.members[0].id - b.members[0].id);
}
