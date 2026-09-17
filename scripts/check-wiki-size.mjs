#!/usr/bin/env node
// scripts/check-wiki-size.mjs
//
// docs/wiki の「重さ」と「持ち出しやすさ」を並べるレポート。
//
// 背景（docs/raw/2026-09-18-wiki-slimming.md）:
// AGENTS.md は「コードを書く前に関連 wiki を読む」ので、wiki の文字数はそのまま毎回の LLM コストになる。
// 追記を重ねたページは 4〜7万字まで育ち、1ページ読むだけで数万トークンを使っていた。
// 圧縮の手順は docs/prompts/slim-wiki-page.md。このスクリプトはその対象選びと事後確認に使う。
//
// 見るもの:
//   1. ページごとの文字数（予算 WIKI_CHAR_BUDGET を超えたものに印）
//   2. 冒頭に「適用範囲」の行があるか（他競技へ持ち出すときの仕分け。汎用 / 学校スポーツ共通 / ソフトテニス固有 / 混在）
//   3. docs/wiki と docs/prompts から出ている相対リンクの切れ（ファイルと見出しアンカー）
//
// 実行: node scripts/check-wiki-size.mjs [--strict]
// 終了コードは既定で常に 0（運用の残りを並べるレポートなので）。--strict のときはリンク切れがあれば 1。

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const WIKI_DIR = path.join(ROOT, 'docs', 'wiki');
const LINK_SOURCE_DIRS = [WIKI_DIR, path.join(ROOT, 'docs', 'prompts')];
// 1ページの上限（文字数）。日本語はおおむね1文字≒1トークン以上なので、これで1ページ1万トークン強に収まる。
const WIKI_CHAR_BUDGET = 12000;
const SCOPE_PATTERN = /適用範囲[:：]/;

const strict = process.argv.includes('--strict');

function listMarkdown(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(dir, f));
}

// GitHub の見出しアンカー生成に近い規則（小文字化・記号除去・空白をハイフン）。
function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

const anchorCache = new Map();
function anchorsOf(file) {
  if (!anchorCache.has(file)) {
    const set = new Set();
    let inFence = false;
    for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
      if (line.startsWith('```')) inFence = !inFence;
      if (inFence) continue;
      const m = line.match(/^#{1,6}\s+(.*)$/);
      if (m) set.add(slugify(m[1]));
    }
    anchorCache.set(file, set);
  }
  return anchorCache.get(file);
}

// 1. 文字数と適用範囲
const rows = listMarkdown(WIKI_DIR).map((file) => {
  const text = fs.readFileSync(file, 'utf-8');
  const head = text.split('\n').slice(0, 12).join('\n');
  return {
    page: path.basename(file),
    chars: [...text].length,
    hasScope: SCOPE_PATTERN.test(head),
  };
});
rows.sort((a, b) => b.chars - a.chars);
const total = rows.reduce((s, r) => s + r.chars, 0);
const over = rows.filter((r) => r.chars > WIKI_CHAR_BUDGET);

console.log(`# docs/wiki の文字数（予算 ${WIKI_CHAR_BUDGET.toLocaleString()} 字/ページ）\n`);
console.log(`合計 ${total.toLocaleString()} 字・${rows.length} ページ・予算超過 ${over.length} ページ\n`);
for (const r of rows) {
  const flag = r.chars > WIKI_CHAR_BUDGET ? '超過' : '    ';
  const scope = r.hasScope ? '適用範囲あり' : '適用範囲なし';
  console.log(`${flag} ${String(r.chars).padStart(7)}  ${scope}  ${r.page}`);
}

// 2. リンク切れ
const broken = [];
for (const dir of LINK_SOURCE_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const file of listMarkdown(dir)) {
    // コードブロック内の見本（`[...](...)`）はリンクとして数えない
    const text = fs.readFileSync(file, 'utf-8').replace(/^```[\s\S]*?^```/gm, '');
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:)/.test(target)) continue;
      const [rawPath, anchor] = target.split('#');
      const resolved = rawPath ? path.resolve(path.dirname(file), decodeURI(rawPath)) : file;
      const rel = path.relative(ROOT, file);
      if (!fs.existsSync(resolved)) {
        broken.push(`${rel} → ${target}（ファイルが無い）`);
        continue;
      }
      if (anchor && resolved.endsWith('.md')) {
        const want = decodeURIComponent(anchor).toLowerCase();
        if (!anchorsOf(resolved).has(want)) broken.push(`${rel} → ${target}（見出しが無い）`);
      }
    }
  }
}

console.log(`\n# リンク切れ（docs/wiki・docs/prompts 発）: ${broken.length} 件\n`);
for (const b of broken) console.log(`- ${b}`);

if (strict && broken.length > 0) process.exit(1);
