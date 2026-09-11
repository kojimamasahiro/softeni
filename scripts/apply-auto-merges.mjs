// merge-candidates のうち「自動OK」判定のクラスタの統合を一括で alias 表へ適用する。
// 判定ロジックは scripts/lib/team-grouping.mjs が正（build-team-review-html.mjs・
// audit-review-sample.mjs と共有。以前はここに独自実装を持っていたため、抜き取り監査が
// 想定する判定とずれる余地があった。2026-09-11 に import へ統一した）。
//   - 既定グループ: 出場大会のジャンル(小/中/高/大/成)で分割。一意でなければ名前段階で補完。
//   - 自動OK: 同一グループ内で「同一大会(大会id+年)」に表記が同居しなければ自動OK。
//   - ただし signal:"players"（選手共有シグナル）のクラスタは常に自動OKにしない（人手レビュー専用）。
//   - 自動OKクラスタの各統合グループ(≥2)を {canonical:最多表記, aliases:残り} として追加。
//
// 抜き取り監査で引かれ、まだ人が判断していないクラスタは**適用しない**（2026-09-11 追加）。
// 理由（docs/raw/2026-09-06-idea-autonomous-improvement-agent.md 追記15・追記16）:
// このスクリプトが対象クラスタを人の目に触れる前に統合すると、統合された側は
// merge-candidates.json から消え、誤統合を原理的に監査できなくなる
// （実測: merge層の標本48件が1件も画面に出なかった）。
//
// 適用したクラスタは判断台帳(review-decisions.json)にも decidedBy:'auto' として記録する
// （2026-09-11 追加）。以前は記録していなかったため、このスクリプト経由で統合された分は
// 抜き取り監査の母集団に一度も入らず、監査から完全に見えなかった。
//
// 適用後は normalize-team-names.mjs + build-team-master.mjs の再実行が必要。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { applyAdditions } from './apply-team-aliases.mjs';
import { clusterKey, heldAuditKeys, readLedger, recordDecision, writeLedger } from './lib/review-ledger.mjs';
import { defaultGroups as sharedGroups, isAutoOK, machineVerdict } from './lib/team-grouping.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clusters = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams', 'merge-candidates.json'), 'utf8'));
const ctx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams', 'team-context.json'), 'utf8'));
const AUDIT_PATH = path.join(ROOT, 'data', 'teams', 'review-audit.json');

const defaultGroups = (members) => sharedGroups(members, ctx);

function mergeEntries(c) {
  const groups = defaultGroups(c.members);
  const byG = {};
  c.members.forEach((m, i) => (byG[groups[i]] = byG[groups[i]] || []).push(m));
  const out = [];
  for (const g in byG) {
    const ms = byG[g];
    if (ms.length < 2) continue;
    ms.sort((a, b) => b.count - a.count);
    out.push({ canonical: ms[0].name, aliases: ms.slice(1).map((m) => m.name), note: c.prefecture || '' });
  }
  return out;
}

const audit = fs.existsSync(AUDIT_PATH) ? JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8')) : { rounds: [] };
const ledger = readLedger();
const held = heldAuditKeys(audit.rounds, ledger.decisions);

const additions = [];
const decidedNow = [];
let autoClusters = 0;
let heldClusters = 0;
let alreadyDecided = 0;
const at = new Date().toISOString();
for (const c of clusters) {
  if (!isAutoOK(c, ctx)) continue;
  const key = clusterKey(c.members);
  // 既に判断台帳にあるものは触らない。held は「まだ台帳に無い」ものだけを保留する
  // 目的の集合だが、ここでは**それに加えて**「人が別チームと判断済み」の場合も
  // 守る必要がある（このスクリプトの自動OK判定は人の判断を知らずに機械だけで決まるため、
  // 台帳を見ずに適用すると、人が明示的に「別チーム」と判断したものまで
  // 上書き統合してしまう）。
  if (ledger.decisions[key]) {
    alreadyDecided++;
    continue;
  }
  if (held.has(key)) {
    heldClusters++;
    continue;
  }
  autoClusters++;
  const entries = mergeEntries(c);
  for (const e of entries) additions.push(e);
  decidedNow.push({
    key,
    prefecture: c.prefecture || null,
    signal: c.signal || 'core',
    members: c.members.map((m) => m.name),
    proposedAutoOK: true,
    decidedBy: 'auto',
    groups: defaultGroups(c.members),
    canon: {},
    verdict: machineVerdict(c, ctx),
    merges: entries,
    decidedAt: at,
  });
}

console.log(
  `自動OKクラスタ: ${autoClusters} / 統合グループ(別名追加): ${additions.length}` +
    (heldClusters ? ` / 監査対象で保留: ${heldClusters}` : '') +
    (alreadyDecided ? ` / 判断済でスキップ: ${alreadyDecided}` : ''),
);

const res = applyAdditions(additions);
console.log(`alias反映: 適用 ${res.applied.length} / スキップ ${res.skipped.length} / 競合 ${res.conflicts.length}`);
if (res.conflicts.length) for (const x of res.conflicts.slice(0, 10)) console.warn('  競合:', x.canonical, JSON.stringify(x.issues));

for (const d of decidedNow) recordDecision(ledger, d);
writeLedger(ledger);
console.log(`判断台帳に記録: ${decidedNow.length}件（decidedBy:'auto'）`);

console.log('→ 次: node scripts/normalize-team-names.mjs --scope=all && node scripts/build-team-master.mjs');
