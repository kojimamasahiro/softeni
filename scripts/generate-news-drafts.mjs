// scripts/generate-news-drafts.mjs
// /news 記事の「ドラフト stub」を生成する。
// 本文ブロック（historical-winners / milestone / career-record）は記事ページの
// getStaticProps が lib/newsArticle.ts でビルド時に構成するため、ここでは
// 記事レコード（どの大会・年・種別を記事化するか + state)だけを作る。
//
// 公開フロー（human-in-the-loop）: ここで作るのは state:"draft"。
//   人が中身を確認して state を "published" に変えると公開される。
//
// 使い方:
//   node scripts/generate-news-drafts.mjs            # preview（既定）
//   node scripts/generate-news-drafts.mjs --type result
//
// preview: information.startDate が未来 かつ details/<tid>/<year> に種目データ(entries)がある大会。
// result : details/<tid>/<year> に優勝者(results.kind==='winner')が確定している大会で、
//          information.startDate が過去（開催済み）のもの。
//
// 設計: docs/wiki/news-context-blocks.md / ADR-005。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tournamentsRoot = path.join(root, 'data', 'tournaments');
const detailsRoot = path.join(tournamentsRoot, 'details');
const infoRoot = path.join(tournamentsRoot, 'information');
const newsRoot = path.join(root, 'data', 'news');

const typeArgIdx = process.argv.indexOf('--type');
const type = typeArgIdx >= 0 ? process.argv[typeArgIdx + 1] : 'preview';
if (type !== 'preview' && type !== 'result') {
  console.error(`unknown --type "${type}" (preview | result)`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function hasYearDetails(tid, year) {
  const dir = path.join(detailsRoot, tid, String(year));
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some((f) => f.endsWith('.json'));
}

function hasWinner(tid, year) {
  const dir = path.join(detailsRoot, tid, String(year));
  if (!fs.existsSync(dir)) return false;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const d = readJson(path.join(dir, f), null);
    if (
      d &&
      Array.isArray(d.results) &&
      d.results.some((r) => r?.tournament?.rank?.kind === 'winner')
    ) {
      return true;
    }
  }
  return false;
}

function main() {
  if (!fs.existsSync(infoRoot)) {
    console.error('information ディレクトリがありません');
    process.exit(1);
  }
  fs.mkdirSync(newsRoot, { recursive: true });

  const candidates = [];
  for (const file of fs.readdirSync(infoRoot)) {
    if (!file.endsWith('.json')) continue;
    const tid = file.replace(/\.json$/, '');
    const entries = readJson(path.join(infoRoot, file), []);
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const year = e.year;
      const startDate = String(e.startDate ?? '');
      if (!year) continue;
      if (type === 'preview') {
        if (startDate && startDate > today && hasYearDetails(tid, year)) {
          candidates.push({ tid, year });
        }
      } else {
        if ((!startDate || startDate <= today) && hasWinner(tid, year)) {
          candidates.push({ tid, year });
        }
      }
    }
  }

  let created = 0;
  let skipped = 0;
  for (const { tid, year } of candidates) {
    const articleId = `${tid}-${year}-${type}`;
    const outPath = path.join(newsRoot, `${articleId}.json`);
    if (fs.existsSync(outPath)) {
      skipped += 1;
      continue;
    }
    const now = new Date().toISOString();
    const record = {
      articleId,
      type,
      state: 'draft',
      tournamentId: tid,
      year,
      categoryId: null,
      createdAt: now,
      updatedAt: now,
    };
    fs.writeFileSync(outPath, JSON.stringify(record, null, 2) + '\n', 'utf-8');
    created += 1;
    console.log(`draft 作成: ${articleId}`);
  }

  console.log(
    `\n[${type}] 候補 ${candidates.length} / 新規 ${created} / 既存skip ${skipped}`,
  );
  console.log(
    '確認後、各 data/news/<articleId>.json の "state" を "published" にすると公開されます。',
  );
}

main();
