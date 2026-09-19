#!/usr/bin/env node
// scripts/check-wiki-size.mjs
//
// docs の「重さ」と「つながり」を見るレポート。`npm run check:wiki`。
//
// 背景（docs/raw/2026-09-18-wiki-slimming.md）:
// AGENTS.md は「コードを書く前に関連 wiki を読む」ので、wiki の文字数はそのまま毎回の LLM コストになる。
// 追記を重ねたページは 4〜7万字まで育っていた。圧縮の手順は docs/prompts/slim-wiki-page.md。
//
// CI（.github/workflows/checks.yml）では2つの役割に分けて使う:
//   - ゲート   … `--strict`。リンク切れがあれば終了コード1（誰が見ても直すべきなので止めてよい）
//   - 報告のみ … 引数なし。文字数の超過を一覧にする（仕様が増えればページは育つので、止めない）
//
// 見るもの:
//   1. ページごとの文字数（予算 WIKI_CHAR_BUDGET を超えたものに印）
//      対象は docs/wiki と、wiki と同じ役割を持ちながら外に置かれている docs 直下・docs/ui
//      （2026-09-19 に追加。`tournament-data-structure.md` のような大物が予算の外にいたため）
//   2. 冒頭に「適用範囲」の行があるか（他競技へ持ち出すときの仕分け）
//   3. docs 全体のリンク切れ（ファイルと見出しアンカー）
//
// 実行: node scripts/check-wiki-size.mjs [--strict]

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DOCS = path.join(ROOT, 'docs');
// 1ページの上限（文字数）。日本語はおおむね1文字≒1トークン以上なので、これで1ページ1万トークン強に収まる。
const WIKI_CHAR_BUDGET = 12000;
const SCOPE_PATTERN = /適用範囲[:：]/;

// 文字数を見る対象（グループ名 → ディレクトリ）。
const SIZE_GROUPS = [
  ['wiki', path.join(DOCS, 'wiki')],
  ['docs直下', DOCS],
  ['ui', path.join(DOCS, 'ui')],
];
// リンク切れを見る対象。raw も含める（194本で0件の状態から始めたので、増えたら気づける）。
const LINK_DIRS = [path.join(DOCS, 'wiki'), path.join(DOCS, 'prompts'), path.join(DOCS, 'adr'), path.join(DOCS, 'raw'), path.join(DOCS, 'ui'), DOCS];

const strict = process.argv.includes('--strict');

function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => path.join(dir, e.name));
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
console.log(`# docs の文字数（予算 ${WIKI_CHAR_BUDGET.toLocaleString()} 字/ページ）\n`);
let overAll = 0;
for (const [group, dir] of SIZE_GROUPS) {
  const rows = listMarkdown(dir).map((file) => {
    const text = fs.readFileSync(file, 'utf-8');
    return {
      page: path.basename(file),
      chars: [...text].length,
      hasScope: SCOPE_PATTERN.test(text.split('\n').slice(0, 12).join('\n')),
    };
  });
  if (rows.length === 0) continue;
  rows.sort((a, b) => b.chars - a.chars);
  const total = rows.reduce((s, r) => s + r.chars, 0);
  const over = rows.filter((r) => r.chars > WIKI_CHAR_BUDGET);
  overAll += over.length;
  console.log(`## ${group}: ${rows.length} ページ・${total.toLocaleString()} 字・予算超過 ${over.length}\n`);
  for (const r of rows) {
    const flag = r.chars > WIKI_CHAR_BUDGET ? '超過' : '    ';
    const scope = r.hasScope ? '適用範囲あり' : '適用範囲なし';
    console.log(`${flag} ${String(r.chars).padStart(7)}  ${scope}  ${r.page}`);
  }
  console.log('');
}
console.log(`予算超過は全体で ${overAll} ページ\n`);

// 2. リンク切れ
const broken = [];
const seen = new Set();
for (const dir of LINK_DIRS) {
  for (const file of listMarkdown(dir)) {
    if (seen.has(file)) continue;
    seen.add(file);
    // コードブロック内の見本（`[...](...)`）はリンクとして数えない
    const text = fs.readFileSync(file, 'utf-8').replace(/^```[\s\S]*?^```/gm, '');
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
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

console.log(`# リンク切れ（docs 全体・${seen.size} ファイル）: ${broken.length} 件\n`);
for (const b of broken) console.log(`- ${b}`);

if (strict && broken.length > 0) process.exit(1);
