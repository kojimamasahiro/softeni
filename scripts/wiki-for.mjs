#!/usr/bin/env node
// scripts/wiki-for.mjs
//
// 触るコードのパスから、それを frontmatter の code: に持つ wiki ページを引く（ADR-024 の P2。Query の「触るコードで選ぶ」）。
//
//   npm run wiki:for -- lib/matchAnalysis/index.ts
//   npm run wiki:for -- src/pages/beta/ lib/siteConfig.ts
//   git diff --name-only main... | xargs npm run -s wiki:for --      … 変更したファイルの所有ページを確認する
//
// 一致の種類: 一致（code: の項目と同じ）／配下（code: のディレクトリの中にある）／含む（引いたディレクトリの中に code: の項目がある）／
// 本文で言及（code: には無いが、ページの本文がそのパスを書いている。改名・削除で記述が古くなるページ）。
// 過去120コミットでの測定: code: だけ 再現率32%・適合率40%、本文の言及だけ 35%・37%、両方 38%・32%（docs/raw/2026-10-09-llm-wiki-redesign.md）。
// パスで引ける範囲は限られる。主な経路は index.md の説明（意図）で、これは補助。
// 当たらなければ、語で探す grep の例を出す。情報を出すだけで、終了コードは常に 0（引数が無いときだけ 2）。
import path from 'node:path';

import { ROOT, loadWikiPages, matchPages, normalizeTarget, KIND_LABEL } from './lib/wiki-meta.mjs';

const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (targets.length === 0) {
  console.error('使い方: npm run wiki:for -- <パス> [<パス>...]');
  console.error('  触るファイル・ディレクトリを code: に持つ wiki ページと、その summary を出す。');
  process.exit(2);
}

const pages = loadWikiPages(path.join(ROOT, 'docs', 'wiki'));
const invalid = pages.filter((p) => !p.meta);
if (invalid.length > 0) {
  console.error(`注意: frontmatter が無いページがある（${invalid.map((p) => p.base).join(', ')}）。引けるのは frontmatter のあるページだけ。`);
}

for (const target of targets) {
  const t = normalizeTarget(target);
  console.log(`■ ${t}`);
  const hits = matchPages(pages, t);
  if (hits.length === 0) {
    const word = path.basename(t.replace(/\/$/, '')).replace(/\.[^.]+$/, '');
    console.log(`  所有ページなし。語で探す: grep -rn "${word}" docs/wiki`);
  }
  for (const h of hits) {
    const status = h.meta.status === 'current' ? '' : `・${h.meta.status}`;
    console.log(`  ${h.base}  [${h.meta.type}・${h.meta.scope}${status}]  ← ${h.entry}（${KIND_LABEL[h.kind]}）`);
    console.log(`    ${h.meta.summary}`);
  }
  console.log('');
}
