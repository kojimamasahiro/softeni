// 識別・名寄せのヘルスチェック。現データを走査し、人手対応が必要な未処理項目を一覧する。
// 取り込み後に実行することで「対応忘れ」を防ぐ。問題があれば終了コード1。
// 使い方: node scripts/check-identity-health.mjs
//   前提: 先に build-team-master.mjs を実行し teams.json / team-context.json を最新化しておく。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { teamCore } from './lib/team-core.mjs';
import { clusterPlayerOverlapPairs, findPlayerOverlapPairs, MIN_SHARED_PLAYERS } from './lib/team-player-overlap.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DET = path.join(ROOT, 'data', 'tournaments', 'details');

// ---- 定数 ----
const REAL = new Set([
  '北海道',
  '東京都',
  '大阪府',
  '京都府',
  ...'青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄'
    .split(/\s+/)
    .map((k) => k + '県'),
]);
const FOREIGN = new Set(['韓国', '台湾', '中華台北', 'モンゴル']);
const norm = (s) => (s == null ? s : s.normalize('NFKC').replace(/[ 　]/g, '').replace(/[･•]/g, '・'));
const catOf = (tid) => {
  if (tid.startsWith('primaryschool') || tid === 'zennihon-primaryschool') return '小';
  if (tid.includes('secondaryschool')) return '中';
  if (tid.startsWith('highschool')) return '高';
  if (tid.startsWith('zennihon-university')) return '大';
  if (['zennihon-workers', 'zennihon-business-group', 'zennihon-club', 'zennihon-senior'].includes(tid)) return '成';
  return null;
};
const ORD = { 小: 0, 中: 1, 高: 2, 大: 3, 成: 4 };
// コア算出は build-team-merge-candidates.mjs と必ず同じ定義を使う（過少報告防止）。
const core = teamCore;
const level = (n) => {
  if (/中学/.test(n)) return '中';
  if (/高校|高等学校/.test(n)) return '高';
  if (/大学/.test(n)) return '大';
  if (/小学|スポーツ少年団|スポ少|ジュニア/.test(n)) return '小';
  if (/クラブ|ＯＢ|OB|役場|電力|協会|ＳＴＣ|STC|JSC/.test(n)) return 'ク';
  return null;
};

const read = (p, d) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return d;
  }
};

// 大会 → generationId。index.json と local_index.json の両方（地区大会等は local 側）。
const genOf = new Map();
for (const fn of ['index.json', 'local_index.json'])
  for (const t of read(path.join(ROOT, 'data', 'tournaments', fn), [])) if (t && t.tournamentId) genOf.set(t.tournamentId, t.generationId);

/**
 * 1 観測（世代・年齢区分・開催年）が示す「出生年の許容レンジ」[lo, hi]。
 * チェックE で使う。**わざと広め**に取る（レンジが広い＝矛盾しにくい＝過小検出側）。
 * 目的は「確実に別人と言えるものだけ挙げる」ことで、疑わしきは挙げない。
 */
const birthBand = (gen, age, y) => {
  const m = /^over(\d+)$/.exec(age);
  if (m) return [y - +m[1] - 30, y - +m[1]]; // overNN は NN 歳以上（上限は +30 歳で丸める）
  if (gen === 'highschool') return [y - 19, y - 14];
  if (gen === 'university') return [y - 25, y - 17];
  if (gen === 'junior') {
    if (/grade\d/.test(age)) return [y - 14, y - 5]; // 小学生の学年別
    if (age === 'u14') return [y - 16, y - 10];
    if (age === 'u17') return [y - 19, y - 13];
    if (age === 'u20') return [y - 22, y - 15];
    return [y - 17, y - 10]; // 中学生・ジュニア一般
  }
  return [y - 60, y - 14]; // all / corporate / masters(none) / international など成年区分
};
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? (e.name === 'temp' ? [] : walk(p)) : e.name.endsWith('.json') ? [p] : [];
  });

// ---- 読み込み ----
const aliases = new Set();
const canonicals = new Set();
// scope 付き別名は「その大会でだけ別名」なので、大会を見ずに判定すると誤検出になる。
// 別名 -> scope[] を別に持ち、走査時に大会文脈で判定する。
// （normalize-team-names.mjs の scopeMatches と同じ規約。片方だけ変えると
//   ヘルスチェックが過少/過大報告する ＝ 2026-07 に異体字対応で起きた事故と同型）
const scopedAliases = new Map();
for (const e of read(path.join(ROOT, 'data', 'tournaments', 'team-name-aliases.json'), { teamAliases: [] }).teamAliases) {
  canonicals.add(norm(e.canonical));
  for (const a of e.aliases || []) {
    if (e.scope) {
      const list = scopedAliases.get(norm(a)) || [];
      list.push(e.scope);
      scopedAliases.set(norm(a), list);
    } else {
      aliases.add(norm(a));
    }
  }
}
// 別名が canonical と NFKC 等価な場合（全角/半角違いなど。例: Ｊ－Ｋｉｄｓ ⇄ J-Kids）、
// 正準化済みの生表記まで「別名のまま」と誤検出してしまうので canonical 側を除外する。
for (const c of canonicals) aliases.delete(c);

/** scope 付き別名が、この大会で「別名のまま残っている」と言えるか。 */
function scopedAliasLeft(teamName, tournamentId, generation, prefecture) {
  const list = scopedAliases.get(norm(teamName));
  if (!list) return false;
  return list.some(
    (s) =>
      (!Array.isArray(s.generation) || s.generation.includes(generation)) &&
      (!Array.isArray(s.tournamentPrefix) || s.tournamentPrefix.some((p) => (tournamentId ?? '').startsWith(p))) &&
      (!Array.isArray(s.prefecture) || s.prefecture.includes(prefecture ?? null)),
  );
}
const teams = read(path.join(ROOT, 'data', 'teams', 'teams.json'), []);
const ctx = read(path.join(ROOT, 'data', 'teams', 'team-context.json'), {});
const homo = read(path.join(ROOT, 'data', 'players', 'homonyms.json'), []);
const homoNames = new Set(homo.map((o) => o.lastName + '\t' + o.firstName));

// ---- データ走査 ----
const prefCount = new Map();
let brokenRefs = 0;
const brokenEx = [];
let dupIds = 0;
const dupEx = [];
let aliasLeft = 0;
const appByName = new Map(); // name -> [(year,stage)]
const bandByName = new Map(); // name -> {lo,hi,ex:[]} 出生年レンジの積集合（チェックE）
const prefByName = new Map(); // name -> Map('tid\tyear' -> Set(prefecture))（チェックF）
for (const f of walk(DET)) {
  const d = read(f, null);
  if (!d || !Array.isArray(d.participants)) continue;
  const rel = path.relative(DET, f).split(path.sep);
  const tid = rel[0];
  const year = /^\d{4}$/.test(rel[1]) ? +rel[1] : null;
  const stage = catOf(tid);
  // categoryId（`category-age-gender`）の age 部。E の overNN / 学年別判定に使う。
  const seg = (rel[rel.length - 1] || '').replace(/\.json$/, '').split('-');
  const age = seg.length >= 3 ? seg[seg.length - 2] : null;
  const gen = genOf.get(tid) ?? null;
  const ids = new Set();
  const seen = new Set();
  for (const p of d.participants) {
    if (p.prefecture != null) prefCount.set(p.prefecture, (prefCount.get(p.prefecture) || 0) + 1);
    if (aliases.has(norm(p.team)) || scopedAliasLeft(p.team, tid, gen, p.prefecture ?? null)) aliasLeft++;
    if (p.id) {
      if (seen.has(p.id) && !ids.has('dup:' + p.id)) {
        dupIds++;
        ids.add('dup:' + p.id);
        if (dupEx.length < 5) dupEx.push(rel.join('/') + ' : ' + p.id);
      }
      seen.add(p.id);
      ids.add(p.id);
    }
    const nm = (p.lastName || '') + '\t' + (p.firstName || '');
    if (p.lastName && year && stage) (appByName.get(nm) || appByName.set(nm, []).get(nm)).push([year, stage]);
    if (p.lastName && year && age) {
      const [lo, hi] = birthBand(gen, age, year);
      const cur = bandByName.get(nm);
      const label = `${year} ${gen || '?'}/${age} ${p.team || ''}`;
      if (!cur) bandByName.set(nm, { lo, hi, ex: [label] });
      else {
        cur.lo = Math.max(cur.lo, lo);
        cur.hi = Math.min(cur.hi, hi);
        if (cur.ex.length < 4) cur.ex.push(label);
      }
    }
    // F は「実在 47 都道府県」のみで判定する（学連 / 高体連 / 連盟 等は所属区分であり県ではない）。
    if (p.lastName && year && REAL.has(p.prefecture)) {
      const ed = prefByName.get(nm) || prefByName.set(nm, new Map()).get(nm);
      const k = tid + '\t' + year;
      (ed.get(k) || ed.set(k, new Set()).get(k)).add(p.prefecture);
    }
  }
  for (const e of d.entries || [])
    for (const r of e.playerIds || [])
      if (!ids.has(r)) {
        brokenRefs++;
        if (brokenEx.length < 5) brokenEx.push(rel.join('/') + ' : ' + r);
      }
}

// ---- チェックA: 未解決の県値 ----
const unresolvedPref = [...prefCount.entries()]
  .filter(([v]) => v != null && !REAL.has(v) && !FOREIGN.has(v) && !/連盟|学連|体連/.test(v))
  .sort((a, b) => b[1] - a[1]);

// ---- チェックB: 未統合の表記候補（teams.json から県内コア一致を再計算し autoOK/要確認に分類）----
const memGenre = (id) => {
  const g = (ctx[id] || {}).genres || [];
  return g.length === 1 ? g[0] : null;
};
const instOf = (id) => new Set((ctx[id] || {}).inst || []);
const blocks = new Map();
for (const t of teams) {
  const b = t.prefecture || '__none__';
  (blocks.get(b) || blocks.set(b, []).get(b)).push(t);
}
let candAuto = 0,
  candReview = 0;
const reviewEx = [];
for (const [, arr] of blocks) {
  const byCore = new Map();
  for (const t of arr) {
    const c = core(t.name);
    (byCore.get(c) || byCore.set(c, []).get(c)).push(t);
  }
  for (const [, members] of byCore) {
    if (members.length < 2) continue;
    // defaultGroups（ジャンル優先）
    const keys = members.map((m, i) => {
      const g = memGenre(m.id);
      return g != null ? 'G:' + g : 'N:' + (level(m.name) || 'b' + i);
    });
    const byG = {};
    members.forEach((m, i) => (byG[keys[i]] = byG[keys[i]] || []).push(m));
    const hasMerge = Object.values(byG).some((ms) => ms.length >= 2); // 統合が発生するか（分離のみは対応不要）
    let ok = true;
    for (const g in byG) {
      const ms = byG[g];
      for (let i = 0; i < ms.length; i++)
        for (let j = i + 1; j < ms.length; j++) {
          const a = instOf(ms[i].id),
            b = instOf(ms[j].id);
          for (const x of a) if (b.has(x)) ok = false;
        }
    }
    if (!hasMerge) continue; // 全メンバーが別グループ＝確定分離。対応不要。
    if (ok) candAuto++;
    else {
      candReview++;
      if (reviewEx.length < 8) reviewEx.push(members.map((m) => m.name).join(' / '));
    }
  }
}

// ---- チェックB2: 未統合の表記候補（選手共有シグナル）----
// コア一致では拾えない語中の脱落（`岡山理大附` ⇔ `岡山理科大附高校`）を、
// 「同一年度に同じ氏名の選手が2チームへ出ている」ことから検出する。
// 定義は build-team-merge-candidates.mjs と共有（scripts/lib/team-player-overlap.mjs）。
// 小学生・社会人の二重登録（クラブと市協会など）が偽陽性として混ざるため、常に人手レビュー扱い。
const overlapClusters = clusterPlayerOverlapPairs(findPlayerOverlapPairs(ROOT, teams));

// ---- チェックC: 同名別校の疑い ----
const reviewPref = teams.filter((t) => t.reviewPrefectures);

// ---- チェックD: 未登録の同姓同名（同年×非隣接段階）----
const newHomo = [];
for (const [nm, aps] of appByName) {
  const byy = new Map();
  for (const [y, s] of aps) {
    if (ORD[s] != null) (byy.get(y) || byy.set(y, new Set()).get(y)).add(s);
  }
  const conf = [...byy.values()].some((set) => {
    const o = [...set].map((s) => ORD[s]);
    return o.length > 1 && Math.max(...o) - Math.min(...o) >= 2;
  });
  if (conf && !homoNames.has(nm)) newHomo.push(nm.replace('\t', ''));
}

// ---- チェックE: 未登録の同姓同名（出生年レンジの矛盾。年をまたいで検出）----
// D は「同一年 × 段階 ORD 差 2 以上」しか見ないため、(a) 年をまたぐ矛盾、(b) catOf が null を返す
// 大会（zennihon-championship / east-japan 等）、(c) overNN のマスターズ区分 を取りこぼしていた。
// E は generationId と categoryId の age 部から出生年レンジを引き、積集合が空なら別人確定とする。
// 名(firstName)が空の participant は「姓だけの一致」であり同姓同名の根拠にならない
// （下流の identity.ts も nameKey(lastName, firstName) で照合する）。データ側の名前分割の
// 不備として別枠で数える。build-player-homonyms.py も同じ理由で除外している。
const noFirstName = new Set();
const hasFirst = (nm) => {
  const t = nm.split('\t')[1];
  if (t) return true;
  noFirstName.add(nm.split('\t')[0]);
  return false;
};

const dSet = new Set(newHomo);
const ageConflict = [];
for (const [nm, b] of bandByName) {
  if (b.lo <= b.hi) continue;
  const n = nm.replace('\t', '');
  if (homoNames.has(nm) || dSet.has(n) || !hasFirst(nm)) continue;
  ageConflict.push(n);
}

// ---- チェックF: 未登録の同姓同名（同一大会 × 異なる都道府県）----
// 1 人が同じ大会・同じ年に 2 つの都道府県を代表することはできない。世代が同じ（＝E で検出できない）
// 同姓同名を捕まえる唯一の信号。所属校名は略称ゆれがあるため県のみで判定する。
const eSet = new Set(ageConflict);
const prefConflict = [];
for (const [nm, ed] of prefByName) {
  let hit = false;
  for (const s of ed.values())
    if (s.size > 1) {
      hit = true;
      break;
    }
  if (!hit) continue;
  const n = nm.replace('\t', '');
  if (homoNames.has(nm) || dSet.has(n) || eSet.has(n) || !hasFirst(nm)) continue;
  prefConflict.push(n);
}

// ---- 出力 ----
const line = (label, n, extra) => console.log(`${n > 0 ? '⚠' : '✓'} ${label}: ${n}${extra ? '  ' + extra : ''}`);
console.log('=== 識別・名寄せ ヘルスチェック ===\n');
line(
  '[県] 未解決の県値',
  unresolvedPref.length,
  unresolvedPref.length
    ? '例: ' +
        unresolvedPref
          .slice(0, 5)
          .map(([v, c]) => `${v}(${c})`)
          .join(', ')
    : '',
);
line('[参照] playerIds 参照切れ', brokenRefs, brokenEx.join(' / '));
line('[参照] participant id 重複', dupIds, dupEx.join(' / '));
line('[チーム] 別名のまま残る出場', aliasLeft, aliasLeft ? '→ normalize-team-names.mjs --scope=all' : '');
line('[チーム] 自動OK可の未統合候補', candAuto, candAuto ? '→ apply-auto-merges.mjs' : '');
line('[チーム] 要人手レビュー候補(同一大会同居等)', candReview, reviewEx.length ? '例: ' + reviewEx.slice(0, 4).join(' ｜ ') : '');
line(
  `[チーム] 未統合候補(選手共有・同年共起${MIN_SHARED_PLAYERS}名以上)`,
  overlapClusters.length,
  overlapClusters.length
    ? '例: ' +
        overlapClusters
          .slice(0, 3)
          .map((c) => c.members.map((m) => m.name).join(' / '))
          .join(' ｜ ') +
        ' → team-merge-review.html'
    : '',
);
line(
  '[チーム] 同名別校の疑い(reviewPrefectures)',
  reviewPref.length,
  reviewPref
    .slice(0, 4)
    .map((t) => t.name)
    .join(', '),
);
line('[選手] 未登録の同姓同名(同年×非隣接段階)', newHomo.length, newHomo.slice(0, 8).join(', '));
line('[選手] 未登録の同姓同名(出生年レンジ矛盾)', ageConflict.length, ageConflict.slice(0, 8).join(', '));
line('[選手] 未登録の同姓同名(同一大会×異なる都道府県)', prefConflict.length, prefConflict.slice(0, 8).join(', '));
line(
  '[選手] 名(firstName)が未分割の同姓衝突',
  noFirstName.size,
  noFirstName.size ? [...noFirstName].slice(0, 8).join(', ') + ' → 取り込み元の氏名分割を確認' : '',
);

const total =
  unresolvedPref.length +
  brokenRefs +
  dupIds +
  aliasLeft +
  candAuto +
  candReview +
  overlapClusters.length +
  reviewPref.length +
  newHomo.length +
  ageConflict.length +
  prefConflict.length +
  noFirstName.size;
console.log(`\n合計 要対応シグナル: ${total}`);
console.log(
  '注: 内部略称(理大/理科大 のような語中の脱落)はコア一致では拾えないため、選手共有シグナルで検出する。' +
    'ただし同年に両表記へ出た選手が居ない表記揺れは、どちらのシグナルにも掛からず依然検出できない。',
);
console.log('注: 同姓同名の検出 D/E/F は下限。**同世代かつ同一都道府県**の同姓同名は 3 つとも信号が無く原理的に検出できない。');
console.log('注: D/E/F の検出数は homonyms.json への登録漏れであり、登録しても players/index.json の id は分割されない（1 名前 = 1 id）。');
process.exitCode = total > 0 ? 1 : 0;
