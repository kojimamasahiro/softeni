#!/usr/bin/env node
// サイト内検索のクエリを受け取り、**0件になる語**を洗い出す。
//
// なぜ要るか（docs/raw/2026-09-06-idea-user-problem-discovery.md）:
// `/players` は検索語を URL に反映し（`?q=`）、`_app.tsx` が `page_path` ごと
// `page_view` を送っている。つまり「ユーザーが自分の言葉で何を探したか」が GA4 に
// 溜まっている。検索インデックスは 11,179 組なので、**0件になった語は
// 「収録していない」か「表記が違う」のどちらか**で、どちらもそのまま打ち手になる。
//
// 判定はレビュー画面と同じ実装を使う（src/pages/players/index.tsx）:
//   queries = q.toLowerCase().trim().split(/\s+/)
//   entry.searchText.includes(query) を **すべての語について** 満たすものが結果
//
// 使い方:
//   node scripts/check-search-misses.mjs queries.txt        # 1行1クエリ
//   node scripts/check-search-misses.mjs queries.csv        # 「クエリ,回数」でも可
//   cat queries.txt | node scripts/check-search-misses.mjs  # 標準入力
//   node scripts/check-search-misses.mjs queries.txt --json
//
// 入力の作り方は上記アイデアの「手順1」を参照（GA4 の `/players?q=` を書き出す）。
// 終了コードは常に 0（これは発見のための道具で、合否を決めるゲートではない）。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'public', 'data', 'players-search.json');
const asJson = process.argv.includes('--json');
const file = process.argv.slice(2).find((a) => !a.startsWith('--'));

if (!fs.existsSync(INDEX)) {
  console.error(`検索インデックスが無い: ${path.relative(ROOT, INDEX)}`);
  console.error('先に node scripts/generate-players-json.mjs を実行すること。');
  process.exit(1);
}

const raw = file ? fs.readFileSync(file, 'utf8') : fs.readFileSync(0, 'utf8');

/** 入力を「クエリ, 回数」に正規化する。回数が無ければ 1 とみなす。 */
function parseInput(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    // 「?q=あいうえお」「/players?q=あいうえお」のような GA4 のページパスも受ける
    const m = s.match(/[?&]q=([^&\s,]+)/);
    let query;
    let count = 1;
    if (m) {
      query = decodeURIComponent(m[1].replace(/\+/g, ' '));
      const tail = s
        .split(/[,\t]/)
        .slice(1)
        .join(',')
        .replace(/[^0-9]/g, '');
      if (tail) count = Number(tail);
    } else {
      const parts = s.split(/[,\t]/);
      query = parts[0].trim();
      const n = Number(String(parts[1] ?? '').replace(/[^0-9]/g, ''));
      if (n) count = n;
    }
    if (!query) continue;
    out.push({ query, count });
  }
  // 同じ語をまとめる
  const byQuery = new Map();
  for (const { query, count } of out) byQuery.set(query, (byQuery.get(query) || 0) + count);
  return [...byQuery].map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count);
}

const entries = JSON.parse(fs.readFileSync(INDEX, 'utf8')).sameNameGroups;
/** 画面と同じ照合。語をスペースで分け、すべてが searchText に含まれること。 */
function hits(query) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return entries.length;
  let n = 0;
  for (const e of entries) {
    let ok = true;
    for (const t of terms) {
      if (!e.searchText.includes(t)) {
        ok = false;
        break;
      }
    }
    if (ok) n++;
  }
  return n;
}

const input = parseInput(raw);
if (!input.length) {
  console.error('クエリが1件も読めなかった。1行1クエリ、または「クエリ,回数」で渡すこと。');
  process.exit(1);
}

const results = input.map(({ query, count }) => ({ query, count, hits: hits(query) }));
const zero = results.filter((r) => r.hits === 0);
const many = results.filter((r) => r.hits > 30);
const totalSearches = results.reduce((s, r) => s + r.count, 0);
const zeroSearches = zero.reduce((s, r) => s + r.count, 0);

if (asJson) {
  console.log(JSON.stringify({ total: results.length, zero: zero.length, results }, null, 2));
  process.exit(0);
}

console.log(`サイト内検索の取りこぼし（インデックス ${entries.length} 組）`);
console.log(`  語の種類: ${results.length} / 検索回数の合計: ${totalSearches}`);
console.log(`  **0件だった語: ${zero.length} 種類（検索回数 ${zeroSearches}・全体の ${((zeroSearches / totalSearches) * 100).toFixed(1)}%）**`);
console.log(`  30件超ヒット（絞り込めていない疑い）: ${many.length} 種類`);

if (zero.length) {
  console.log('');
  console.log('0件だった語（回数の多い順）— 収録していないか、表記が違う:');
  for (const r of zero.slice(0, 50)) console.log(`  ${String(r.count).padStart(5)}回  ${r.query}`);
  if (zero.length > 50) console.log(`  … 他 ${zero.length - 50} 種類`);
}
if (many.length) {
  console.log('');
  console.log('30件超ヒット（探している人にたどり着けていない疑い）:');
  for (const r of many.slice(0, 15)) console.log(`  ${String(r.count).padStart(5)}回  ${r.query}（${r.hits}件）`);
}
console.log('');
console.log('次: 0件の語を「収録の穴」と「表記違い」に仕分ける。');
console.log('    表記違いなら data/players/player-name-aliases.json 等での吸収を検討する。');
