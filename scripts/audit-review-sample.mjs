#!/usr/bin/env node
// 自動判定の誤り率を、無作為抽出で測る（抜き取り監査）。
//
// なぜ要るか（docs/raw/2026-09-06-idea-autonomous-improvement-agent.md 追記6・追記9）:
// 「機械が全件を処理し、人は無作為な少数だけを見て誤り率を測る」——これが成立すれば、
// 人の時間は件数に比例しなくなる（562件でも5,000件でも人が見るのは20件）。
//
// 2026-09-06 に台帳から出した誤り率 0.429（14件中6件）は**使えない**。
// 14件は人が目についた順に見たもので、難しそうなものから見ていれば当然高く出る。
// 測るべき母集団は「**機械が決めて人が一度も見ていない**」判断で、そこから無作為に引く。
//
// 手順は2段階に分ける。理由は、引いてから判断するという順序を守らないと
// 「都合のよい結果だけ採る」ことが構造的に可能になるため（事前登録）。
//
//   1) node scripts/audit-review-sample.mjs --draw 20 [--seed 12345]
//        母集団から無作為に20件を引き、data/teams/review-audit.json に記録する。
//        **引いた時点の機械の判定も一緒に保存する**（後で人が上書きすると、
//        機械が何と言っていたか分からなくなるため）。
//   2) レビュー画面の「監査対象」フィルタで、その20件だけを人が判断する。
//   3) node scripts/audit-review-sample.mjs --report
//        判断済みの標本について誤り率と95%信頼区間（Wilson）を出す。
//
// 終了コード: --report で「誤り率の下限が閾値を超えた」ときだけ 1（既定の閾値は 0.05）。
// それ以外は 0。まだ判断が揃っていない場合も 0（未測定は失敗ではない）。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { readLedger } from './lib/review-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT = path.join(ROOT, 'data', 'teams', 'review-audit.json');
const argv = process.argv.slice(2);

function arg(name, fallback = null) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

/** 再現できる擬似乱数（mulberry32）。seed を記録しておけば同じ標本を引き直せる。 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wilson score interval。標本が小さいとき正規近似より素直に振る舞う。 */
function wilson(successes, n, z = 1.96) {
  if (n === 0) return null;
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / d;
  const half = (z / d) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { p, low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

function readAudit() {
  return fs.existsSync(AUDIT) ? JSON.parse(fs.readFileSync(AUDIT, 'utf8')) : { rounds: [] };
}

// ---- draw: 標本を引く ----
if (argv.includes('--draw')) {
  const n = Number(arg('--draw', '20'));
  const seed = Number(arg('--seed', String(Date.now() % 2147483647)));
  const ledger = readLedger();

  // 母集団: 機械が決めて、人が一度も見ていないもの。
  const pool = Object.entries(ledger.decisions)
    .filter(([, d]) => d.decidedBy === 'auto')
    .map(([key, d]) => ({ key, verdict: d.verdict, members: d.members, prefecture: d.prefecture ?? null }));

  if (pool.length === 0) {
    console.log('母集団が空（機械だけで決めた判断が無い）。標本を引けない。');
    process.exit(0);
  }

  const audit = readAudit();
  // 既に引いた分は除く（同じものを二重に監査しない）
  const drawn = new Set(audit.rounds.flatMap((r) => r.sample.map((s) => s.key)));
  const available = pool.filter((x) => !drawn.has(x.key));
  if (available.length === 0) {
    console.log('母集団は全て抽出済み。新しく引けるものが無い。');
    process.exit(0);
  }

  const take = Math.min(n, available.length);
  const rand = rng(seed);
  const shuffled = available
    .map((x) => ({ x, r: rand() }))
    .sort((a, b) => a.r - b.r)
    .map((o) => o.x);
  const sample = shuffled.slice(0, take).map((x) => ({
    key: x.key,
    members: x.members,
    prefecture: x.prefecture,
    machineVerdict: x.verdict, // 引いた時点の機械の判定。後で人が上書きしても残る。
  }));

  audit.rounds.push({
    drawnAt: new Date().toISOString(),
    seed,
    requested: n,
    populationSize: pool.length,
    sample,
  });
  fs.writeFileSync(AUDIT, JSON.stringify(audit, null, 2) + '\n', 'utf8');

  console.log(`母集団 ${pool.length} 件（機械が決めて人が見ていないもの）から ${take} 件を無作為抽出した。`);
  console.log(`  seed=${seed}（同じ seed なら引き直せる）`);
  console.log(`  記録: ${path.relative(ROOT, AUDIT)}（第${audit.rounds.length}回）`);
  console.log('');
  console.log('次: レビュー画面の「監査対象」フィルタでこの標本だけを判断し、');
  console.log('    node scripts/audit-review-sample.mjs --report で誤り率を出す。');
  process.exit(0);
}

// ---- report: 誤り率を出す ----
const threshold = Number(arg('--threshold', '0.05'));
const audit = readAudit();
if (!audit.rounds.length) {
  console.log('監査の記録が無い。まず --draw N で標本を引くこと。');
  process.exit(0);
}
const ledger = readLedger();

let checked = 0;
let overturned = 0;
let pending = 0;
// 覆しは向きで意味がまったく違うので分けて数える。
//   merge → separate  … **誤統合**。別チームを1つにしてしまった。データが壊れる方向。
//   separate → merge  … **見逃し**。統合すべきものを残した。安全側だが、名寄せの仕事をしていない。
let wrongMerge = 0;
let missedMerge = 0;
const details = [];
for (const round of audit.rounds) {
  for (const s of round.sample) {
    const now = ledger.decisions[s.key];
    if (!now || now.decidedBy !== 'human') {
      pending++;
      continue;
    }
    checked++;
    if (now.verdict !== s.machineVerdict) {
      overturned++;
      if (s.machineVerdict === 'merge') wrongMerge++;
      else missedMerge++;
      details.push({ members: s.members, machine: s.machineVerdict, human: now.verdict });
    }
  }
}

console.log('抜き取り監査（自動判定の誤り率）');
console.log(`  抽出回数: ${audit.rounds.length} / 標本合計: ${checked + pending} 件`);
console.log(`  人が判断済み: ${checked} 件 / 未判断: ${pending} 件`);

if (checked === 0) {
  console.log('');
  console.log('まだ標本が判断されていないので未測定。レビュー画面の「監査対象」で判断すること。');
  process.exit(0);
}

const w = wilson(overturned, checked);
const wWrong = wilson(wrongMerge, checked);
console.log('');
console.log(`  機械の判定を人が覆した: ${overturned} / ${checked}`);
console.log(`  全体の誤り率: ${(w.p * 100).toFixed(1)}%（95%信頼区間 ${(w.low * 100).toFixed(1)}% 〜 ${(w.high * 100).toFixed(1)}%）`);
console.log('');
console.log('  向きの内訳（意味がまったく違うので分けて見る）:');
console.log(`    誤統合 merge → separate : ${wrongMerge} 件  ← 別チームを1つにした。**データが壊れる方向**`);
console.log(`    見逃し separate → merge : ${missedMerge} 件  ← 統合すべきものを残した。安全側`);
if (details.length) {
  console.log('');
  console.log('  覆された例（最大5件）:');
  for (const d of details.slice(0, 5)) {
    console.log(`    ${d.members.join(' / ')} — 機械: ${d.machine} → 人: ${d.human}`);
  }
}
console.log('');

// 判定は**誤統合の率だけ**で行う。見逃しはデータを壊さないので、
// 「自動OKを締める」根拠にはならない（締めても見逃しは減らない。むしろ増える）。
if (wWrong.low > threshold) {
  console.log(`判定: **誤統合**の率の下限 ${(wWrong.low * 100).toFixed(1)}% が閾値 ${(threshold * 100).toFixed(1)}% を超えている。`);
  console.log('  → 自動OKの範囲を締めること（緩める方向の変更は独立した照合で裏を取るまで禁止）。');
  process.exit(1);
}
console.log(`判定: **誤統合**は ${wrongMerge}/${checked} 件で、率の上限は ${(wWrong.high * 100).toFixed(1)}%。`);
if (wrongMerge === 0) {
  console.log('  データを壊す方向の誤りは観測されていない。自動OKを締める根拠は無い。');
}
if (missedMerge > 0) {
  const wm = wilson(missedMerge, checked);
  console.log('');
  console.log(
    `注意: **見逃し**が ${missedMerge}/${checked} 件（${(wm.p * 100).toFixed(1)}%・95%区間 ${(wm.low * 100).toFixed(1)}%〜${(wm.high * 100).toFixed(1)}%）ある。`,
  );
  console.log('  これはデータを壊さないが、自動判定が名寄せの仕事をしていないということ。');
  console.log('  対処は「自動OKを緩める」ではなく、**既定グループ分けの見直し**（同じ段階なのに');
  console.log('  別グループになっていないか）。緩める方向の安全弁はそのまま残すこと。');
}
process.exit(0);
