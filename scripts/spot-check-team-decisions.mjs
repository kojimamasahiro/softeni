#!/usr/bin/env node
// 機械が決めたチーム名寄せの判断を、人が無作為抽出で点検する（一度きりの測定）。
//
// なぜ要るか（docs/raw/2026-09-06-idea-autonomous-improvement-agent.md 追記21）:
// 2026-09-12 に自動統合は廃止したが、**それ以前に機械だけで決まった判断が台帳に342件残っている**
// （`decidedBy:"auto"`）。この342件が信用できるかは一度も測っていない。
// 今後の運用（全件レビュー）とは別に、**既存データの信頼度を知るための一回限りの測定**として引く。
//
// これは廃止した抜き取り監査（audit-review-sample.mjs）の再開ではない。
// あちらは「これから自動適用されるものを止めて測る」常設の仕組みで、母集団が1件しかないため畳んだ。
// こちらは「もう適用されてしまった過去の判断」を事後に点検するもので、目的も母集団も違う。
//
// 層を必ず分けること（追記11・追記12の教訓）:
//   merge    … 機械が「統合する」と決めた49件。**データが壊れる方向**。既に alias 適用済みで、
//              候補一覧からは消えているため、レビュー画面では見られない。ここが本命。
//   separate … 機械が「別チーム」と決めた293件。安全側（統合し損ね）。
//
// 手順:
//   1) node scripts/spot-check-team-decisions.mjs --draw 20 --stratum merge [--seed S]
//        無作為抽出して data/teams/spot-check.json に記録し、点検票を出す。
//        **引いてから答えること**（先に中身を見て選ぶと測定が無意味になる）。
//   2) 点検票を見て、各件が正しいか判断する。答えの記録:
//        node scripts/spot-check-team-decisions.mjs --answer 3=ng --answer 7=ok --note 3="別の学校"
//   3) node scripts/spot-check-team-decisions.mjs --report
//        誤り率と95%信頼区間（Wilson）を出す。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { clusterKey, readLedger } from './lib/review-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'teams', 'spot-check.json');
const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

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

const readOut = () => (fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { rounds: [] });
const writeOut = (o) => fs.writeFileSync(OUT, JSON.stringify(o, null, 2) + '\n', 'utf8');

/** チーム名 → 出場文脈（選手・年・大会）。id は作り直しのたびに変わるので名前で引く。 */
function buildContext() {
  const teams = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams', 'teams.json'), 'utf8'));
  const ctx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams', 'team-context.json'), 'utf8'));
  const byName = new Map();
  for (const t of teams) byName.set(t.name, { team: t, ctx: ctx[t.id] || null });
  return byName;
}

/** 点検票の1件を表示する。判断の材料（誰が・いつ・どの大会に出たか）まで出す。 */
function renderItem(s, no, byName) {
  const mark = s.answer ? `  ← 回答済み: ${s.answer === 'ok' ? '正しい' : '誤り'}${s.note ? `（${s.note}）` : ''}` : '';
  console.log(`[${no}] 機械の判断: ${s.machineVerdict === 'merge' ? '**統合**（同じチーム）' : '別チーム（統合しない）'}  ${s.prefecture ?? ''}${mark}`);
  for (const name of s.members) {
    const hit = byName.get(name);
    const c = hit?.ctx;
    const players = c?.players?.slice(0, 4).join('・') ?? '';
    const events = c?.events?.slice(0, 3).join(', ') ?? '';
    const years = c?.years ? `${c.years[0]}〜${c.years[c.years.length - 1]}` : '';
    console.log(`      ${name}${hit ? `（出場${hit.team.count}件` + (years ? ` / ${years}` : '') + '）' : '（統合済みでマスタに無し）'}`);
    if (players) console.log(`         選手: ${players}`);
    if (events) console.log(`         大会: ${events}`);
  }
  if (s.machineVerdict === 'merge' && (s.machineMerges || []).length) {
    for (const m of s.machineMerges) console.log(`      → 統合後の名前: ${m.canonical}（${(m.aliases || []).join(' / ')} を寄せた）`);
  }
  console.log('');
}

// ---- draw ----
if (argv.includes('--draw')) {
  const n = Number(arg('--draw', '20'));
  const stratum = arg('--stratum', null);
  if (stratum && stratum !== 'merge' && stratum !== 'separate') {
    console.error('--stratum は merge か separate。');
    process.exit(2);
  }
  const seed = Number(arg('--seed', String(Date.now() % 2147483647)));
  const ledger = readLedger();
  const out = readOut();
  const alreadyDrawn = new Set(out.rounds.flatMap((r) => r.sample.map((s) => s.key)));

  const pool = Object.entries(ledger.decisions)
    .filter(([k, d]) => d.decidedBy === 'auto' && !alreadyDrawn.has(k))
    .filter(([, d]) => (stratum ? d.verdict === stratum : true))
    .map(([key, d]) => ({ key, d }));

  if (pool.length === 0) {
    console.log('母集団が空（機械だけで決まった未抽出の判断が無い）。');
    process.exit(0);
  }

  const rand = rng(seed);
  const take = Math.min(n, pool.length);
  const sample = pool
    .map((x) => ({ x, r: rand() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, take)
    .map(({ x }) => ({
      key: x.key,
      members: x.d.members,
      prefecture: x.d.prefecture ?? null,
      machineVerdict: x.d.verdict,
      machineMerges: x.d.merges ?? [],
      answer: null, // 'ok'（機械の判断は正しい） / 'ng'（誤り）
      note: '',
    }));

  out.rounds.push({ drawnAt: new Date().toISOString(), seed, stratum: stratum ?? 'all', populationSize: pool.length, sample });
  writeOut(out);

  const byName = buildContext();
  console.log(`母集団 ${pool.length} 件（機械だけで決まった判断・${stratum ?? '全層'}）から ${take} 件を無作為抽出した。`);
  console.log(`  seed=${seed} / 記録: ${path.relative(ROOT, OUT)}（第${out.rounds.length}回）`);
  console.log('');
  console.log('=== 点検票 ===');
  console.log('各件について「機械の判断が正しいか」を見てください。');
  console.log('統合＝これらは同じチーム、別チーム＝別のチームとして残す、という意味です。');
  console.log('');
  const offset = out.rounds.slice(0, -1).reduce((a, r) => a + r.sample.length, 0);
  sample.forEach((s, i) => renderItem(s, offset + i + 1, byName));
  console.log('答えの記録:');
  console.log('  node scripts/spot-check-team-decisions.mjs --answer 1=ok --answer 2=ng --note 2="別の学校"');
  process.exit(0);
}

// ---- answer ----
if (argv.includes('--answer') || argv.includes('--note')) {
  const out = readOut();
  const flat = out.rounds.flatMap((r) => r.sample);
  let changed = 0;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--answer' || argv[i] === '--note') {
      const [noStr, ...rest] = String(argv[i + 1] ?? '').split('=');
      const value = rest.join('=');
      const idx = Number(noStr) - 1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= flat.length) {
        console.error(`番号 ${noStr} は点検票にない（1〜${flat.length}）。`);
        process.exit(2);
      }
      if (argv[i] === '--answer') {
        if (value !== 'ok' && value !== 'ng') {
          console.error(`--answer は ok か ng（${value}）。`);
          process.exit(2);
        }
        flat[idx].answer = value;
      } else {
        flat[idx].note = value;
      }
      changed++;
    }
  }
  writeOut(out);
  const answered = flat.filter((s) => s.answer).length;
  console.log(`${changed}件を記録した。回答済み ${answered} / ${flat.length}`);
  process.exit(0);
}

// ---- sheet: 点検票をもう一度出す（範囲指定可: --sheet 11-20 / --sheet 3） ----
if (argv.includes('--sheet')) {
  const all = readOut().rounds.flatMap((r) => r.sample);
  if (!all.length) {
    console.log('まだ標本が無い。--draw N --stratum merge で引くこと。');
    process.exit(0);
  }
  const spec = arg('--sheet', null);
  let from = 1;
  let to = all.length;
  if (spec && /^\d+(-\d+)?$/.test(spec)) {
    const [a, b] = spec.split('-').map(Number);
    from = a;
    to = b ?? a;
  }
  const byName = buildContext();
  for (let i = from; i <= Math.min(to, all.length); i++) renderItem(all[i - 1], i, byName);
  console.log('答えの記録: node scripts/spot-check-team-decisions.mjs --answer 1=ok --answer 2=ng --note 2="別の学校"');
  process.exit(0);
}

// ---- report ----
const out = readOut();
const flat = out.rounds.flatMap((r) => r.sample);
if (!flat.length) {
  console.log('まだ標本が無い。--draw N --stratum merge で引くこと。');
  process.exit(0);
}
const strata = ['merge', 'separate'];
console.log('機械だけで決まった判断の点検');
console.log(`  抽出回数: ${out.rounds.length} / 標本合計: ${flat.length} 件 / 回答済み: ${flat.filter((s) => s.answer).length} 件`);
console.log('');
for (const st of strata) {
  const rows = flat.filter((s) => s.machineVerdict === st && s.answer);
  const ng = rows.filter((s) => s.answer === 'ng');
  const label = st === 'merge' ? '誤統合（別チームを1つにした・データが壊れる方向）' : '見逃し（統合すべきものを残した・安全側）';
  if (rows.length === 0) {
    console.log(`  ${label}: 未測定（分母0）。「0件」は「起きていない」ではない。`);
    continue;
  }
  const w = wilson(ng.length, rows.length);
  console.log(`  ${label}: ${ng.length} / ${rows.length}（${(w.p * 100).toFixed(1)}%・95%区間 ${(w.low * 100).toFixed(1)}%〜${(w.high * 100).toFixed(1)}%）`);
  for (const s of ng) console.log(`      誤り: ${s.members.join(' / ')}${s.note ? ` — ${s.note}` : ''}`);
}
const pending = flat.filter((s) => !s.answer);
if (pending.length) {
  console.log('');
  console.log(`  未回答 ${pending.length} 件:`);
  for (const s of pending.slice(0, 10)) console.log(`      [${flat.indexOf(s) + 1}] ${s.members.join(' / ')}`);
}
