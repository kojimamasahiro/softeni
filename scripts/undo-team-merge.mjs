#!/usr/bin/env node
// 誤って適用されたチーム統合を戻す。
//
// なぜ要るか（docs/raw/2026-09-06-idea-autonomous-improvement-agent.md 追記23）:
// 機械だけで決めた統合49件を人が無作為20件点検したところ、**誤統合が11件（55%）**あった。
// 統合は alias を当ててデータ本体（details）の表記を書き換えるので、**元の名前は現在のデータに残らない**。
// ただし git 履歴には残っているので、統合直前のコミットから「どのファイルの誰がその名前だったか」を
// 引いて、その participants だけを元の名前へ戻せる。
//
// 3つをまとめて行う（どれか1つでも欠けると元に戻らない・再発する）:
//   1. details の表記を戻す（participants[].team / .id / entries[].playerIds / matches の参照）
//   2. alias 表から該当の別名を外す（残すと次の normalize-team-names で再び統合される）
//   3. 判断台帳へ「人が別チームと判断した」と記録する（残すと機械が再び同じ提案をする）
//
// 使い方:
//   node scripts/undo-team-merge.mjs --from data/teams/undo-merges.json --dry-run
//   node scripts/undo-team-merge.mjs --from data/teams/undo-merges.json
//
// 入力（undo-merges.json）: [{ "canonical": "七尾ジュニアクラブ", "alias": "七尾中学校" }, ...]
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

import { clusterKey, readLedger, writeLedger } from './lib/review-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DETAILS = path.join(ROOT, 'data', 'tournaments', 'details');
const ALIAS_FILE = path.join(ROOT, 'data', 'tournaments', 'team-name-aliases.json');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const arg = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

/**
 * チーム名の比較キー。normalize-team-names.mjs / build-team-master.mjs と同じ規則。
 *
 * 生の文字列で比べると**全角と半角で取り逃がす**。2026-09-12 に実際に外した:
 * 台帳と alias 表は半角の `松山STC` / `今治五十鈴ジュニアSTC` を持つのに、
 * データ本体は全角の `松山ＳＴＣ` / `今治五十鈴ジュニアＳＴＣ` で入っており、
 * 「該当者が見つからない」として2クラスタを黙って素通りしていた。
 */
const normTeam = (s) => (s == null ? s : String(s).normalize('NFKC').replace(/[ 　]/g, '').replace(/[･•]/g, '・'));

/**
 * その名前が details から消えた（＝統合が適用された）コミット。
 *
 * 検索語は**引用符込み**（`"南方"`）にする。素の `南方` で引くと `南方JST` の中にも当たり、
 * 別の名前が変化したコミットを掴んでしまう（2026-09-12 に実際に外した。`沼田`／`沼田ジュニア` も同型）。
 */
function mergeCommit(alias) {
  const out = git(['log', '--format=%H', '-S', `"${alias}"`, '--', 'data/tournaments/details']).trim();
  return out ? out.split('\n')[0] : null;
}

/** 統合直前の状態で、その名前を持っていたファイルと participants。 */
function preMergeState(alias, commit) {
  let files;
  try {
    files = git(['grep', '-l', `"${alias}"`, `${commit}^`, '--', 'data/tournaments/details'])
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => l.replace(/^[^:]*:/, ''));
  } catch {
    return [];
  }
  const out = [];
  for (const rel of files) {
    let j;
    try {
      j = JSON.parse(git(['show', `${commit}^:${rel}`]));
    } catch {
      continue;
    }
    const people = (j.participants || []).filter((p) => p.team === alias);
    if (people.length) out.push({ rel, people });
  }
  return out;
}

const pairs = JSON.parse(fs.readFileSync(path.resolve(ROOT, arg('--from', 'data/teams/undo-merges.json')), 'utf8'));
let restoredFiles = 0;
let restoredPeople = 0;
const notFound = [];

for (const { canonical, alias } of pairs) {
  const commit = mergeCommit(alias);
  if (!commit) {
    notFound.push(`${canonical} ← ${alias}（統合コミットが見つからない）`);
    continue;
  }
  const pre = preMergeState(alias, commit);
  if (!pre.length) {
    notFound.push(`${canonical} ← ${alias}（統合前の participants が引けない）`);
    continue;
  }
  console.log(`${canonical} ← ${alias}  (統合 ${commit.slice(0, 8)})`);
  for (const { rel, people } of pre) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      console.log(`    [skip] ${rel}（現在は存在しない）`);
      continue;
    }
    // 整形を壊さないよう、JSON を書き戻さず**文字列置換**で直す（normalize-team-names.mjs と同じ方針）。
    let text = fs.readFileSync(abs, 'utf8');
    const j = JSON.parse(text);
    let n = 0;
    const esc = (s) => JSON.stringify(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const old of people) {
      // 統合後は canonical を名乗っているはず。姓名と県で本人を特定する。
      // team の比較は NFKC 正規化して行う（データ側が全角、台帳側が半角のことがある）。
      const now = (j.participants || []).find(
        (p) =>
          p.lastName === old.lastName &&
          p.firstName === old.firstName &&
          (p.prefecture ?? null) === (old.prefecture ?? null) &&
          normTeam(p.team) === normTeam(canonical),
      );
      if (!now) continue;
      const oldId = now.id;
      const newId = old.id ?? `${old.lastName}_${old.firstName}_${alias}_${old.prefecture ?? ''}`;
      // id は 姓_名_チーム_都道府県。id ごと置換すれば playerIds / matches の参照も一緒に直る。
      text = text.split(JSON.stringify(oldId)).join(JSON.stringify(newId));
      // team 欄（id とは別に持っている）。**実際に入っている文字列**を対象にする
      // （想定した canonical と全角半角が違うことがあるため）。
      // 同じファイルに同名のチームを名乗る別人が居ることがあるので、id で位置を特定してから置換する。
      const re = new RegExp(`("id":\\s*${esc(newId)}[\\s\\S]{0,200}?"team":\\s*)${esc(now.team)}`);
      if (re.test(text)) text = text.replace(re, `$1${JSON.stringify(alias)}`);
      n++;
      restoredPeople++;
    }
    if (n === 0) {
      console.log(`    [skip] ${rel}（現在の表記に該当者が見つからない）`);
      continue;
    }
    console.log(`    ${rel}: ${n}名を「${alias}」へ戻す`);
    if (!DRY) {
      JSON.parse(text); // 壊れていないことを確認してから書く
      fs.writeFileSync(abs, text, 'utf8');
    }
    restoredFiles++;
  }
}

// ---- alias 表から外す（残すと次の normalize で再統合される） ----
const aliasDoc = JSON.parse(fs.readFileSync(ALIAS_FILE, 'utf8'));
let dropped = 0;
let droppedEntries = 0;
for (const { canonical, alias } of pairs) {
  for (let i = aliasDoc.teamAliases.length - 1; i >= 0; i--) {
    const e = aliasDoc.teamAliases[i];
    if (e.canonical !== canonical) continue;
    const before = e.aliases.length;
    e.aliases = e.aliases.filter((a) => a !== alias);
    if (e.aliases.length !== before) {
      dropped++;
      e.note = `${e.note || ''} 2026-09-12: 「${alias}」を外した（人が別チームと判断・誤統合の修正）。`.trim();
    }
    if (e.aliases.length === 0) {
      aliasDoc.teamAliases.splice(i, 1);
      droppedEntries++;
    }
  }
}
if (!DRY) fs.writeFileSync(ALIAS_FILE, JSON.stringify(aliasDoc, null, 2) + '\n', 'utf8');

// ---- 判断台帳へ「人が別チームと判断した」と記録する ----
const ledger = readLedger();
let recorded = 0;
for (const { canonical, alias } of pairs) {
  for (const [key, d] of Object.entries(ledger.decisions)) {
    const names = (d.merges || []).flatMap((m) => [m.canonical, ...(m.aliases || [])]);
    if (!(d.verdict === 'merge' && names.includes(canonical) && names.includes(alias))) continue;
    ledger.decisions[key] = {
      ...d,
      decidedBy: 'human',
      verdict: 'separate',
      merges: [],
      groups: (d.members || []).map((_, i) => i),
      canon: {},
      decidedAt: new Date().toISOString(),
      revisions: (d.revisions || 0) + 1,
      note: '2026-09-12 の抜き取り点検で誤統合と判断（小中高／学校とクラブは別）。',
    };
    recorded++;
    void clusterKey;
  }
}
if (!DRY) writeLedger(ledger);

console.log('');
console.log(`${DRY ? '[dry-run] ' : ''}戻した: ${restoredPeople}名 / ${restoredFiles}ファイル`);
console.log(`${DRY ? '[dry-run] ' : ''}alias から外した別名: ${dropped}件（空になって削除したエントリ: ${droppedEntries}件）`);
console.log(`${DRY ? '[dry-run] ' : ''}台帳へ「別チーム」と記録: ${recorded}件`);
if (notFound.length) {
  console.log('');
  console.log('引けなかったもの（手で確認が要る）:');
  for (const x of notFound) console.log('  ' + x);
}
console.log('');
console.log('→ 次: node scripts/normalize-team-names.mjs --scope=all && node scripts/build-team-master.mjs && node scripts/build-team-merge-candidates.mjs');
