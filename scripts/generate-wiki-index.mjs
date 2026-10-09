#!/usr/bin/env node
// scripts/generate-wiki-index.mjs
//
// docs/wiki/index.md を、各ページ先頭の frontmatter から生成する（ADR-024 の P2）。
// 手で書くと、適用範囲の印がページ側と食い違った（P1 の前は41行中2件）ので、元は frontmatter に一本化した。
//
//   npm run wiki:index              … index.md を作り直す
//   npm run wiki:index -- --check   … 生成物と違えば終了コード1（check:wiki --strict も同じことを見る）
//
// 並行作業（複数の worktree）で index.md がコンフリクトしたら、手で直さずこれで作り直す。
// frontmatter が不正なページがあるときは作らない（先に npm run check:wiki -- --strict で直す）。
import fs from 'node:fs';
import path from 'node:path';

import { ROOT, loadWikiPages, buildIndexText } from './lib/wiki-meta.mjs';

const check = process.argv.includes('--check');
const { text, problems } = buildIndexText(loadWikiPages());
if (text === null) {
  console.error('frontmatter が不正なページがあるため index.md を作れない:');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('先に npm run check:wiki -- --strict で直してください。');
  process.exit(1);
}

const target = path.join(ROOT, 'docs', 'wiki', 'index.md');
const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : '';
if (check) {
  if (current !== text) {
    console.error('docs/wiki/index.md が生成物と異なる。npm run wiki:index で作り直してください。');
    process.exit(1);
  }
  console.log('docs/wiki/index.md は最新');
} else if (current === text) {
  console.log('docs/wiki/index.md は変更なし');
} else {
  fs.writeFileSync(target, text);
  console.log('docs/wiki/index.md を更新した');
}
