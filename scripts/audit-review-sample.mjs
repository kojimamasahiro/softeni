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
//
// 2026-09-11: --draw の母集団を「台帳から過去に決まったもの」ではなく「まだ台帳に無い、
// これから自動適用されようとしているもの」に変えた（追記15の欠陥1）。
// 理由: 機械が「統合」と判定したクラスタは、レビュー画面や apply-auto-merges.mjs が
// 適用すると人が見る前に merge-candidates.json から消える。台帳に載った時点（＝
// decidedBy:'auto' として記録された時点）で既に適用済みなので、そこから引いても
// 手遅れだった（実測: merge層48件が1件も画面に出なかった）。
// いまは「まだ誰も判断しておらず、台帳にも無い」段階で引き、引かれた標本は
// scripts/lib/review-ledger.mjs の heldAuditKeys() により、人が判断するまで
// あらゆる自動適用経路（apply-auto-merges.mjs／レビュー画面の一括反映）で保留される。

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

import { clusterKey, heldAuditKeys, readLedger } from './lib/review-ledger.mjs';
import { isAutoOK, machineVerdict } from './lib/team-grouping.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT = path.join(ROOT, 'data', 'teams', 'review-audit.json');
const CANDIDATES = path.join(ROOT, 'data', 'teams', 'merge-candidates.json');
const REVIEW_HTML = path.join(ROOT, 'scripts', 'build-team-review-html.mjs');
const CONTEXT = path.join(ROOT, 'data', 'teams', 'team-context.json');
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
  const stratum = arg('--stratum', null); // 'merge' | 'separate' | null(=全体)
  if (stratum && stratum !== 'merge' && stratum !== 'separate') {
    console.error('--stratum は merge か separate。');
    process.exit(2);
  }
  const ledger = readLedger();
  const audit = readAudit();
  const candidates = fs.existsSync(CANDIDATES) ? JSON.parse(fs.readFileSync(CANDIDATES, 'utf8')) : [];
  const context = fs.existsSync(CONTEXT) ? JSON.parse(fs.readFileSync(CONTEXT, 'utf8')) : {};

  // 母集団: 「機械が自動適用しようとしていて、まだ誰も判断しておらず、台帳にも無い」クラスタ。
  //
  // 2026-09-11: 以前は台帳の decidedBy:'auto' な記録から引いていたが、**その記録自体が
  // 「既に適用された後」にしか作られない**（apply-auto-merges.mjs / レビュー画面の一括反映は
  // 台帳登録と alias 適用を同じ操作で行う）ため、引いた時点で手遅れだった
  // （追記15の欠陥1。実測: merge層48件が1件も画面に出なかった）。
  // ここで先に引いて review-audit.json に載せておけば、以後の自動適用経路は
  // heldAuditKeys() でこのキーを見送るので、**適用される前に**人の目に届く。
  const held = heldAuditKeys(audit.rounds, ledger.decisions);
  const all = candidates
    .filter((c) => isAutoOK(c, context))
    .map((c) => ({ key: clusterKey(c.members), cluster: c, verdict: machineVerdict(c, context) }))
    .filter((x) => !ledger.decisions[x.key] && !held.has(x.key));
  const pool = stratum ? all.filter((x) => x.verdict === stratum) : all;

  if (pool.length === 0) {
    console.log('母集団が空（機械が自動適用しようとしていて未判断のクラスタが無い）。標本を引けない。');
    process.exit(0);
  }

  const take = Math.min(n, pool.length);
  const rand = rng(seed);
  const shuffled = pool
    .map((x) => ({ x, r: rand() }))
    .sort((a, b) => a.r - b.r)
    .map((o) => o.x);
  const sample = shuffled.slice(0, take).map((x) => ({
    key: x.key,
    members: x.cluster.members.map((m) => m.name),
    prefecture: x.cluster.prefecture ?? null,
    machineVerdict: x.verdict,
    verdictSource: 'computed',
  }));

  audit.rounds.push({
    drawnAt: new Date().toISOString(),
    seed,
    requested: n,
    stratum: stratum ?? 'all',
    verdictSource: 'computed',
    populationSize: pool.length,
    sample,
  });
  fs.writeFileSync(AUDIT, JSON.stringify(audit, null, 2) + '\n', 'utf8');

  // レビューHTMLを作り直し、引いたばかりの標本を「監査対象」として即座に保留状態にする。
  // 作り直さないと、サーバがまだ古い review-audit.json を読み込んだ画面を配信し続け、
  // 引いた標本がうっかり自動適用の対象に含まれてしまう（build-team-review-html.mjs の
  // AUDIT 集合はビルド時点の review-audit.json のスナップショットのため）。
  execFileSync('node', [REVIEW_HTML], { stdio: 'ignore' });

  const label = stratum ? `機械が「${stratum === 'merge' ? '統合' : '別チーム'}」と判定したもの` : '機械が自動適用しようとしていて未判断のもの';
  console.log(`母集団 ${pool.length} 件（${label}）から ${take} 件を無作為抽出した。`);
  console.log(`  seed=${seed}（同じ seed なら引き直せる）`);
  console.log(`  記録: ${path.relative(ROOT, AUDIT)}（第${audit.rounds.length}回）`);
  console.log(`  標本は判断されるまで自動適用されない（apply-auto-merges.mjs・レビュー画面の一括反映の両方が対象）。`);
  console.log('');
  console.log('次: レビュー画面（npm run team:review）の「監査対象」フィルタでこの標本だけを判断し、');
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

// 台帳から機械の判定を読んでいた回は集計に使えない。
// 台帳の値は反映のたびに上書きされ、IDがずれていた時期のものが混ざるため、
// 「既に直っているバグ」を現在の誤り率として報告してしまう（2026-09-06 に実際に起きた）。
// 除外の基準は結果ではなく**取得方法**なので、都合のよい回を選ぶことにはならない。
const usableRounds = audit.rounds.filter((r) => r.verdictSource === 'computed');
const staleRounds = audit.rounds.filter((r) => r.verdictSource !== 'computed');

let checked = 0;
let overturned = 0;
let pending = 0;
// 覆しは向きで意味がまったく違うので分けて数える。
//   merge → separate  … **誤統合**。別チームを1つにしてしまった。データが壊れる方向。
//   separate → merge  … **見逃し**。統合すべきものを残した。安全側だが、名寄せの仕事をしていない。
let wrongMerge = 0;
let missedMerge = 0;
const details = [];
for (const round of usableRounds) {
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
if (staleRounds.length) {
  console.log('');
  console.log(`  ⚠ ${staleRounds.length} 回ぶんを集計から除外した（機械の判定を判断台帳から読んでいた回）。`);
  console.log('    台帳の値は反映のたびに上書きされ、IDがずれていた時期のものが混ざるため、');
  console.log('    「既に直っているバグ」を現在の誤り率として報告してしまう。');
  console.log('    除外の基準は結果ではなく取得方法なので、都合のよい回を選ぶことにはならない。');
  console.log('    使える標本を得るには引き直すこと: --draw 20 --stratum merge');
  console.log('');
}
console.log(`  有効な抽出回数: ${usableRounds.length} / 標本合計: ${checked + pending} 件`);
console.log(`  人が判断済み: ${checked} 件 / 未判断: ${pending} 件`);
console.log('');
console.log('  回ごとの内訳:');
audit.rounds.forEach((round, i) => {
  const stale = round.verdictSource !== 'computed';
  let j = 0;
  let o = 0;
  let w = 0;
  for (const s of round.sample) {
    const now = ledger.decisions[s.key];
    if (!now || now.decidedBy !== 'human') continue;
    j++;
    if (now.verdict !== s.machineVerdict) {
      o++;
      if (s.machineVerdict === 'merge') w++;
    }
  }
  const when = String(round.drawnAt).slice(0, 16).replace('T', ' ');
  const st = (round.stratum && round.stratum !== 'all' ? ` [${round.stratum}層]` : '') + (stale ? ' ⚠除外' : '');
  console.log(`    第${i + 1}回 ${when} seed=${round.seed}${st}  標本${round.sample.length}件` + ` → 判断済 ${j}（覆し ${o}${o ? `・うち誤統合 ${w}` : ''}）`);
});
// 複数回引いてあっても、引いてから判断している限りプールしてよい（事前登録は保たれる）。
// 逆に「結果を見てから回を選ぶ」ことができないよう、レポートは常に全回をまとめて集計する。
console.log('');
console.log('  ※ 複数回に分かれていても全回をまとめて集計する。引いてから判断している限り');
console.log('    プールしてよく、「結果を見て回を選ぶ」ことを構造的に防ぐため。');

// 除外した回でも**人の判断は有効**（人の答えは機械の値に依存しない）。
// 古いのは機械側だけなので、現在のロジックで機械の判定を計算し直した参考値を出す。
// ただしこれは事前登録された測定ではない（結果を見た後に判定を計算し直している）ので、
// **参考値として明示し、判定には使わない**。
if (staleRounds.length) {
  const candidates = fs.existsSync(CANDIDATES) ? JSON.parse(fs.readFileSync(CANDIDATES, 'utf8')) : [];
  const context = fs.existsSync(CONTEXT) ? JSON.parse(fs.readFileSync(CONTEXT, 'utf8')) : {};
  const byKey = new Map(candidates.map((c) => [clusterKey(c.members), c]));
  let n = 0;
  let wrong = 0;
  let missed = 0;
  let mN = 0;
  let sN = 0;
  let gone = 0;
  let goneMerged = 0;
  for (const round of staleRounds) {
    for (const smp of round.sample) {
      const now = ledger.decisions[smp.key];
      if (!now || now.decidedBy !== 'human') continue;
      const cluster = byKey.get(smp.key);
      if (!cluster) {
        // 人が統合した結果、候補一覧から消えたもの。機械の現在の判定を計算できない。
        // **消えるのは統合された側だけ**なので、無視すると見逃しが過小評価される。
        gone++;
        if (now.verdict === 'merge') goneMerged++;
        continue;
      }
      const mv = machineVerdict(cluster, context);
      n++;
      if (mv === 'merge') mN++;
      else sN++;
      if (now.verdict !== mv) {
        if (mv === 'merge') wrong++;
        else missed++;
      }
    }
  }
  console.log('');
  console.log('─── 参考値（事前登録されていないので判定には使わない）───');
  console.log('  除外した回の人の判断を、**現在のロジックで計算し直した機械の判定**と突き合わせた:');
  console.log(`    突き合わせできた: ${n} 件（候補から消えていて照合不能: ${gone} 件）`);
  if (mN > 0) console.log(`    誤統合 merge → separate : ${wrong} / ${mN}（${((wrong / mN) * 100).toFixed(1)}%）`);
  else console.log('    誤統合 merge → separate : 0 / 0（分母0）');
  if (sN > 0) {
    // 照合不能のうち「人が統合した」ものは、消えた理由がまさに統合だから消えている。
    // 無視すれば最良、すべて見逃しに数えれば最悪。真の値はこの間にある。
    const bestP = (missed / sN) * 100;
    const worstP = ((missed + goneMerged) / (sN + goneMerged)) * 100;
    console.log(`    見逃し separate → merge : ${missed} / ${sN}（${bestP.toFixed(1)}%）… **最良の場合**`);
    if (goneMerged > 0) {
      console.log(
        `      照合不能 ${gone} 件のうち ${goneMerged} 件は人が「統合」と判断したもの。` + `統合されて候補から消えたので、**見逃しだった側だけが抜けている**。`,
      );
      console.log(`      それを全部見逃しに数えると ${missed + goneMerged} / ${sN + goneMerged}（${worstP.toFixed(1)}%）… **最悪の場合**`);
      console.log(`      真の値はこの ${bestP.toFixed(1)}% 〜 ${worstP.toFixed(1)}% の間にある。幅が広すぎて使えない。`);
    }
  }
  console.log('  この値は「結果を見た後に機械側を計算し直した」ものであり、さらに上記の偏りがある。');
  console.log('  **修正の効果を知るには、修正後に新しく引き直すしかない**:');
  console.log('    node scripts/audit-review-sample.mjs --draw 20');
}

if (checked === 0) {
  console.log('');
  console.log('まだ標本が判断されていないので未測定。レビュー画面の「監査対象」で判断すること。');
  console.log('判断したつもりで0件のときは、画面で「確認済を反映」を押したか確認する');
  console.log('（判断はブラウザに溜まっているだけで、反映するまで台帳に届かない）。');
  process.exit(0);
}

// **分母を層ごとに分ける。** 誤統合は機械が「統合」と判定した標本でしか起こり得ず、
// 「別チーム」判定を分母に入れると、検証していない安全性を検証したかのように見せてしまう。
let mergeN = 0;
let separateN = 0;
for (const round of usableRounds) {
  for (const s of round.sample) {
    const now = ledger.decisions[s.key];
    if (!now || now.decidedBy !== 'human') continue;
    if (s.machineVerdict === 'merge') mergeN++;
    else separateN++;
  }
}
const w = wilson(overturned, checked);
const wWrong = wilson(wrongMerge, mergeN);
const wMissed = wilson(missedMerge, separateN);
console.log('');
console.log(`  機械の判定を人が覆した: ${overturned} / ${checked}`);
console.log(`  全体の誤り率: ${(w.p * 100).toFixed(1)}%（95%信頼区間 ${(w.low * 100).toFixed(1)}% 〜 ${(w.high * 100).toFixed(1)}%）`);
console.log('');
console.log('  向きの内訳（意味も分母も違うので分けて見る）:');
console.log(
  `    誤統合 merge → separate : ${wrongMerge} / ${mergeN}  ← 別チームを1つにした。**データが壊れる方向**` +
    (mergeN === 0 ? '（分母0＝一度も検証していない）' : `（${((wrongMerge / mergeN) * 100).toFixed(1)}%）`),
);
console.log(
  `    見逃し separate → merge : ${missedMerge} / ${separateN}  ← 統合すべきものを残した。安全側` +
    (separateN === 0 ? '（分母0）' : `（${((missedMerge / separateN) * 100).toFixed(1)}%）`),
);
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
if (mergeN === 0) {
  console.log('判定: **誤統合は未測定**。');
  console.log('  機械が「統合」と判定した標本を人が一度も判断していないので、分母が0。');
  console.log('  「誤統合0件」は「起きていない」ではなく「**測っていない**」という意味。');
  console.log('  データを壊す方向を測るには、その層から明示的に引くこと:');
  console.log('    node scripts/audit-review-sample.mjs --draw 20 --stratum merge');
} else if (wWrong.low > threshold) {
  console.log(`判定: **誤統合**の率の下限 ${(wWrong.low * 100).toFixed(1)}% が閾値 ${(threshold * 100).toFixed(1)}% を超えている。`);
  console.log('  → 自動OKの範囲を締めること（緩める方向の変更は独立した照合で裏を取るまで禁止）。');
  process.exit(1);
} else {
  console.log(`判定: **誤統合**は ${wrongMerge}/${mergeN} 件で、率の上限は ${(wWrong.high * 100).toFixed(1)}%。`);
  if (wrongMerge === 0) {
    console.log(`  データを壊す方向の誤りは、この ${mergeN} 件では観測されていない。自動OKを締める根拠は無い。`);
    if (wWrong.high > threshold) {
      console.log(`  ただし上限 ${(wWrong.high * 100).toFixed(1)}% は閾値 ${(threshold * 100).toFixed(1)}% より広い。断言するには標本が要る。`);
    }
  }
}
if (missedMerge > 0) {
  const wm = wMissed;
  console.log('');
  console.log(
    `注意: **見逃し**が ${missedMerge}/${separateN} 件（${(wm.p * 100).toFixed(1)}%・95%区間 ${(wm.low * 100).toFixed(1)}%〜${(wm.high * 100).toFixed(1)}%）ある。`,
  );
  console.log('  これはデータを壊さないが、自動判定が名寄せの仕事をしていないということ。');
  console.log('  対処は「自動OKを緩める」ではなく、**既定グループ分けの見直し**（同じ段階なのに');
  console.log('  別グループになっていないか）。緩める方向の安全弁はそのまま残すこと。');
}
process.exit(0);
