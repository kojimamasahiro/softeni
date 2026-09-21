#!/usr/bin/env node
// scripts/sync-agent-skills.mjs
//
// skill の実体は `.claude/skills/<name>/`（Claude Code が読む場所）。
// Codex は `.agents/skills/<name>/` を読むので、そこへ skill ごとのシンボリックリンクを張る。
// `npm run sync:skills` で張り直し、`--check` ならずれがあるとき終了コード1。
//
// 実体を1か所に置くのは、2か所にコピーすると片方だけ直されて食い違うため。

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, '.claude/skills');
const dst = path.join(root, '.agents/skills');
const check = process.argv.includes('--check');

const skills = fs
  .readdirSync(src, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(src, d.name, 'SKILL.md')))
  .map((d) => d.name);

fs.mkdirSync(dst, { recursive: true });
const problems = [];

for (const name of skills) {
  const link = path.join(dst, name);
  const target = path.join('..', '..', '.claude', 'skills', name);
  let current = null;
  try {
    current = fs.readlinkSync(link);
  } catch {}
  if (current === target) continue;
  problems.push(`${name}: リンクがない/向き先が違う`);
  if (!check) {
    fs.rmSync(link, { recursive: true, force: true });
    fs.symlinkSync(target, link);
  }
}

// 実体が消えた skill のリンクを掃除する
for (const name of fs.readdirSync(dst)) {
  if (skills.includes(name)) continue;
  problems.push(`${name}: 実体のない skill`);
  if (!check) fs.rmSync(path.join(dst, name), { recursive: true, force: true });
}

if (problems.length === 0) {
  console.log(`.agents/skills は同期済み（${skills.length} 件）`);
} else if (check) {
  console.error(problems.map((p) => `- ${p}`).join('\n'));
  console.error('`npm run sync:skills` で直してください');
  process.exit(1);
} else {
  console.log(problems.map((p) => `- 修正: ${p}`).join('\n'));
}
