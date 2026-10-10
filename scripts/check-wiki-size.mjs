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
//   - ゲート   … `--strict`。リンク切れか、APPLIED.md に行の無い SQL があるか、wiki の frontmatter が
//                不正（必須項目・値・本文の適用範囲との食い違い・code: の実在）か、index.md が生成物と違うか、Compile Log の行き先が実在しない・raw の kind が語彙の外なら終了コード1
//                （誰が見ても直すべきなので止めてよい）
//   - 報告のみ … 引数なし。文字数の超過を一覧にする（仕様が増えればページは育つので、止めない）
//
// 見るもの:
//   1. ページごとの文字数（目安 WIKI_CHAR_BUDGET 超に「超過」、圧縮基準 SLIM_THRESHOLD 超に「圧縮」の印）
//      対象は docs/wiki と、wiki と同じ役割を持ちながら外に置かれている docs 直下・docs/ui
//      （2026-09-19 に追加。`tournament-data-structure.md` のような大物が予算の外にいたため）
//   2. docs 全体のリンク切れ（ファイルと見出しアンカー）
//   3. AGENTS.md の docs 規約が守られているか（2026-09-19 に追加）
//      - wiki のページが index.md 以外からも参照されているか（孤立していないか）
//      - ADR の `## Status` 直下が状態語だけになっているか
//      - raw のノートに Compile Log があるか（免除の条件は docs/prompts/update-wiki.md）
//      - docs/sql/*.sql がすべて docs/sql/APPLIED.md の台帳に載っているか（2026-09-30 に追加・ゲート）
//      - wiki の frontmatter（type / scope / status / summary と任意の code:）が正しいか（ゲート。ADR-024 の P1）
//      - raw の Compile Log の行き先（wiki:<ページ> / ADR-<番号>）が実在するか（ゲート。ADR-024 の P3）
//      - raw の kind（ADR-024 の P5）: 値が語彙の外ならゲート、新規ノートに kind が無ければ報告
//      - 報告（ADR-024 の P4）: 本文中の実在しないパス・npm run の不在・draft の昇格漏れ候補、
//        `--changed-base=<ref>` を付けると『コードを変えたが所有ページを更新していない』（PR 用）
//      - index.md が frontmatter からの生成物と一致するか（ゲート。ADR-024 の P2。直し方は npm run wiki:index）
//   文字数の検査は、frontmatter を除いた本文で行う（メタデータで予算がずれないように）。
//
// 実行: node scripts/check-wiki-size.mjs [--strict]

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import {
  splitFrontmatter,
  validateFrontmatter,
  loadWikiPages,
  buildIndexText,
  compileLogDestinations,
  deadPathsInBody,
  npmRunMissing,
  draftPromotionCandidates,
  ownersNotUpdated,
  rawKindOf,
  compileLogExempt,
} from './lib/wiki-meta.mjs';

const ROOT = process.cwd();
const DOCS = path.join(ROOT, 'docs');
// 1ページの目安（文字数）。日本語はおおむね1文字≒1トークン以上なので、これで1ページ1万トークン強に収まる。
const WIKI_CHAR_BUDGET = 12000;
// 圧縮する基準（目安の1.3倍）。目安の超過は報告だけで、圧縮はこれを超えたページに限る（2026-09-30）。
// 目安ぎりぎりまで削ると、削る作業（全文の読み直し・退避・測り直し）のトークンが、読むたびに浮く分を上回る。
// 次の小さな追記でまた超えるので、まとまった量を一度に削れるところまで育ってから手を付ける。
const SLIM_THRESHOLD = Math.round(WIKI_CHAR_BUDGET * 1.3);
// 目安の対象外。未解決の問いを集約するページなので、集約した分だけ育つのは設計どおり。
const BUDGET_EXEMPT = new Set(['open-questions.md']);
// 文字数の対象外。docs 直下に置く「進行中の作業表」で、読み物ではなく入力用の作業ファイル。
// 終わったら消す前提なので圧縮しない（docs/README.md「docs の中身」参照）。
const WORK_FILES = new Set(['venue-input-worksheet.md']);

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
    for (const line of splitFrontmatter(fs.readFileSync(file, 'utf-8')).body.split('\n')) {
      if (line.startsWith('```')) inFence = !inFence;
      if (inFence) continue;
      const m = line.match(/^#{1,6}\s+(.*)$/);
      if (m) set.add(slugify(m[1]));
    }
    anchorCache.set(file, set);
  }
  return anchorCache.get(file);
}

// 1. 文字数（wiki は frontmatter の scope も並べる）
console.log(`# docs の文字数（目安 ${WIKI_CHAR_BUDGET.toLocaleString()} 字/ページ・圧縮は ${SLIM_THRESHOLD.toLocaleString()} 字超から）\n`);
let overAll = 0;
let slimAll = 0;
for (const [group, dir] of SIZE_GROUPS) {
  const rows = listMarkdown(dir)
    .filter((file) => !WORK_FILES.has(path.basename(file)))
    .map((file) => {
      const { meta, body } = splitFrontmatter(fs.readFileSync(file, 'utf-8'));
      return {
        page: path.basename(file),
        chars: [...body].length,
        scope: meta && meta.scope ? meta.scope : '-',
      };
    });
  if (rows.length === 0) continue;
  rows.sort((a, b) => b.chars - a.chars);
  const total = rows.reduce((s, r) => s + r.chars, 0);
  const counted = rows.filter((r) => !BUDGET_EXEMPT.has(r.page));
  const over = counted.filter((r) => r.chars > WIKI_CHAR_BUDGET);
  const slim = counted.filter((r) => r.chars > SLIM_THRESHOLD);
  overAll += over.length;
  slimAll += slim.length;
  console.log(`## ${group}: ${rows.length} ページ・${total.toLocaleString()} 字・予算超過 ${over.length}・圧縮基準超過 ${slim.length}\n`);
  for (const r of rows) {
    const flag = BUDGET_EXEMPT.has(r.page)
      ? '対象外'
      : r.chars > SLIM_THRESHOLD
        ? '圧縮'
        : r.chars > WIKI_CHAR_BUDGET
          ? '超過'
          : '    ';
    const scope = group === 'wiki' ? `[${r.scope}]`.padEnd(5, '　') : '';
    console.log(`${flag} ${String(r.chars).padStart(7)}  ${scope}  ${r.page}`);
  }
  console.log('');
}
console.log(`予算超過は全体で ${overAll} ページ（うち圧縮基準 ${SLIM_THRESHOLD.toLocaleString()} 字の超過 ${slimAll} ページ）\n`);

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

// 3. AGENTS.md の docs 規約
console.log('\n# 規約チェック\n');
const wikiDir = path.join(DOCS, 'wiki');
const wikiFiles = listMarkdown(wikiDir);

// （3-1 の『適用範囲の行が無い wiki』は ADR-024 の P4 で外した。scope の正は frontmatter で、本文の行は任意。
//   行があるときの scope との一致は 3-6 の frontmatter 検査が見る。）

// 3-2. index.md 以外から参照されていない wiki（孤立）
const inbound = new Map(wikiFiles.map((f) => [path.basename(f), new Set()]));
for (const f of wikiFiles) {
  const text = fs.readFileSync(f, 'utf-8');
  for (const m of text.matchAll(/\]\(\.\/([a-z0-9-]+\.md)/g)) {
    if (inbound.has(m[1])) inbound.get(m[1]).add(path.basename(f));
  }
}
const orphanWiki = wikiFiles
  .map((f) => path.basename(f))
  .filter((b) => b !== 'index.md' && [...inbound.get(b)].filter((x) => x !== 'index.md' && x !== b).length === 0);
console.log(`- index.md 以外から参照されていない wiki: ${orphanWiki.length} 件 ${orphanWiki.join(', ')}`);

// 3-3. ADR の Status 書式（直下1行が状態語だけ）
const ADR_STATES = ['Draft', 'Accepted', 'Deprecated', 'Superseded'];
const badStatus = [];
for (const f of listMarkdown(path.join(DOCS, 'adr'))) {
  const base = path.basename(f);
  if (!/^ADR-\d{3}-/.test(base) || base.startsWith('ADR-000')) continue;
  const lines = fs.readFileSync(f, 'utf-8').split('\n');
  const i = lines.findIndex((l) => /^##\s+Status/.test(l));
  if (i < 0) {
    badStatus.push(`${base}（Status 節が無い）`);
    continue;
  }
  const first = lines.slice(i + 1).find((l) => l.trim());
  if (!first || !ADR_STATES.includes(first.trim())) badStatus.push(`${base}（${(first || '').trim().slice(0, 24)}）`);
}
console.log(`- Status が状態語だけになっていない ADR: ${badStatus.length} 件 ${badStatus.join(', ')}`);

// 3-4. raw の Compile Log（免除は kind か、kind の無い旧ノートのファイル名。判定は scripts/lib/wiki-meta.mjs の compileLogExempt）
const COMPILE_LOG_SINCE = '2026-09-19'; // 規約を機械チェックにした日。これ以降に作ったノートだけを見る
const missingLog = listMarkdown(path.join(DOCS, 'raw'))
  .filter((f) => {
    const m = path.basename(f).match(/^(\d{4}-\d{2}-\d{2})-/);
    return m && m[1] >= COMPILE_LOG_SINCE;
  })
  .filter((f) => {
    const text = fs.readFileSync(f, 'utf-8');
    return !compileLogExempt(path.basename(f), text) && !/Compile Log/.test(text);
  })
  .map((f) => path.basename(f));
console.log(`- Compile Log が無い raw（${COMPILE_LOG_SINCE} 以降・免除を除く）: ${missingLog.length} 件 ${missingLog.join(', ')}`);

// 3-5. docs/sql/*.sql がすべて APPLIED.md の台帳に載っているか（2026-09-30 に追加）
// point-pick.sql の行が漏れていた（docs/raw/2026-09-30-llm-wiki-lint.md）。適用可否はコードから読めないので、
// 台帳に行が無いと「未適用のまま本番で動かない」に誰も気づけない。
const sqlDir = path.join(DOCS, 'sql');
const ledgerPath = path.join(sqlDir, 'APPLIED.md');
const ledger = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, 'utf-8') : '';
const unlisted = fs.existsSync(sqlDir)
  ? fs
      .readdirSync(sqlDir)
      .filter((b) => b.endsWith('.sql'))
      .filter((b) => !ledger.includes(`](./${b})`))
  : [];
console.log(`- APPLIED.md の台帳に行が無い SQL: ${unlisted.length} 件 ${unlisted.join(', ')}`);

// 3-6. wiki の frontmatter（ADR-024 の P1・ゲート）。type / scope / status / summary の形と値、
// 本文の適用範囲との一致、code: に書いたパスの実在。本文中のパスの存在はゲートにしない（意図的な記述が混じり誤検知が多い）。
const fmBad = [];
const fmCodeMissing = [];
for (const f of wikiFiles) {
  const r = validateFrontmatter(fs.readFileSync(f, 'utf-8'));
  const base = path.basename(f);
  if (r.schema.length > 0) fmBad.push(`${base}（${r.schema.join('、')}）`);
  if (r.codeMissing.length > 0) fmCodeMissing.push(`${base}（${r.codeMissing.join(', ')}）`);
}
console.log(`- frontmatter が不正な wiki: ${fmBad.length} 件 ${fmBad.join(', ')}`);
console.log(`- code: に実在しないパスがある wiki: ${fmCodeMissing.length} 件 ${fmCodeMissing.join(', ')}`);

// 3-7. index.md が frontmatter からの生成物と一致するか（ADR-024 の P2・ゲート）。
// 手で直した index が残ると、summary や scope を変えても入口だけ古いままになる（P1 前は41行中2件の印が食い違っていた）。
// frontmatter が不正で生成できないときは、上の 3-6 が落とすので、ここでは数えない。
const indexBuilt = buildIndexText(loadWikiPages());
const indexFile = path.join(DOCS, 'wiki', 'index.md');
const indexStale = indexBuilt.text !== null && (!fs.existsSync(indexFile) || fs.readFileSync(indexFile, 'utf-8') !== indexBuilt.text);
console.log(
  `- index.md が生成物と異なる: ${indexStale ? '1 件 npm run wiki:index で作り直す' : indexBuilt.text === null ? '判定できない（frontmatter を先に直す）' : '0 件'}`,
);

// 3-8. raw の Compile Log の行き先（`wiki:<ページ>` / `ADR-<番号>`）が実在するか（ADR-024 の P3・ゲート）。
// 書式は .claude/skills/wiki-compile/references/compile-log.md。この2つだけを見る（旧書式・自由記述の行は見ない）。
// 行き先が消えた・綴りを誤った Compile Log は、「検討した上で反映した」という記録が空を指す。
const adrFiles = fs.existsSync(path.join(DOCS, 'adr')) ? fs.readdirSync(path.join(DOCS, 'adr')) : [];
const badDest = [];
for (const file of listMarkdown(path.join(DOCS, 'raw'))) {
  for (const d of compileLogDestinations(fs.readFileSync(file, 'utf-8'))) {
    const ok = d.kind === 'wiki' ? fs.existsSync(path.join(DOCS, 'wiki', `${d.name}.md`)) : adrFiles.some((b) => b.startsWith(`ADR-${d.name}-`));
    if (!ok) badDest.push(`${path.basename(file)}:${d.line}（${d.kind === 'wiki' ? 'wiki:' : 'ADR-'}${d.name}）`);
  }
}
console.log(`- Compile Log の行き先（wiki:<ページ> / ADR-<番号>）が実在しない raw: ${badDest.length} 件 ${badDest.join(', ')}`);

// 3-8b. raw の kind（ADR-024 の P5）。新規ノート（RAW_KIND_SINCE 以降）は先頭の frontmatter に kind を書く。
//   - kind の値が語彙の外（綴りの誤り）: ゲート。Compile Log の免除が静かに効かなくなるのを止める
//   - 新規ノートに kind が無い: 報告のみ。既存のノートは追記のみの原則に従い触らない（遡及しない）
const RAW_KIND_SINCE = '2026-10-10';
const badKind = [];
const noKind = [];
for (const file of listMarkdown(path.join(DOCS, 'raw'))) {
  const base = path.basename(file);
  const r = rawKindOf(fs.readFileSync(file, 'utf-8'));
  if (r.error) badKind.push(`${base}（${r.error}）`);
  const m = base.match(/^(\d{4}-\d{2}-\d{2})-/);
  if (m && m[1] >= RAW_KIND_SINCE && !r.kind && !r.error) noKind.push(base);
}
console.log(`- kind が語彙の外の raw: ${badKind.length} 件 ${badKind.join(', ')}`);
console.log(`- kind が無い新規の raw（${RAW_KIND_SINCE} 以降）: ${noKind.length} 件 ${noKind.join(', ')}`);

// 3-9. 報告（ゲートにしない。CI のサマリに出す。ADR-024 の P4）。判定の関数は scripts/lib/wiki-meta.mjs。
//   - 本文中の実在しないパス: 意図的な記述（削除済み・まだ作らない・設計のみ…が前後1行か見出しにある）は除く
//   - 本文の npm run が package.json に無い
//   - status: draft なのに code: が全部実在する（current への昇格漏れの候補）
//   - --changed-base=<ref> のとき: コードを変えたのに、code: で所有するページを同じ変更で更新していないもの（PR 用）
const pkgScripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')).scripts;
const allPages = loadWikiPages();
const deadPaths = [];
const npmMissing = [];
for (const p of allPages) {
  for (const d of deadPathsInBody(p.body)) deadPaths.push(`${p.base}:${d.line}（${d.path}）`);
  for (const n of npmRunMissing(p.body, pkgScripts)) npmMissing.push(`${p.base}（npm run ${n}）`);
}
const listUp = (xs, n = 10) => xs.slice(0, n).join(', ') + (xs.length > n ? ` ほか ${xs.length - n} 件` : '');
console.log(`- 本文中の実在しないパス（意図的な記述を除く）: ${deadPaths.length} 件 ${listUp(deadPaths)}`);
console.log(`- 本文の npm run が package.json に無い: ${npmMissing.length} 件 ${listUp(npmMissing)}`);
const promote = draftPromotionCandidates(allPages);
console.log(`- status: draft なのに code: が全て実在する（current への昇格漏れの候補）: ${promote.length} 件 ${promote.join(', ')}`);

const changedBase = (process.argv.find((a) => a.startsWith('--changed-base=')) || '').slice('--changed-base='.length);
if (changedBase) {
  const gitLines = (args) =>
    execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
      .split('\n')
      .filter(Boolean);
  let changed = null;
  try {
    // 三点差分（merge-base から）。浅い clone で merge-base が取れないときは二点差分にする
    // （pull_request の HEAD はベースにマージした結果なので、ベースの先端との二点差分が PR の変更そのもの）。
    try {
      changed = gitLines(['diff', '--name-only', `${changedBase}...HEAD`]);
    } catch {
      changed = gitLines(['diff', '--name-only', changedBase, 'HEAD']);
    }
  } catch {
    console.log(`- コードを変えたが所有ページを更新していない: 判定できない（git diff ${changedBase} に失敗）`);
  }
  if (changed) {
    const stale = ownersNotUpdated(allPages, changed).map((o) => `${o.page}←${listUp(o.files, 2)}`);
    console.log(`- コードを変えたが所有ページを更新していない（${changedBase} との差・${changed.length} ファイル）: ${stale.length} 件 ${listUp(stale)}`);
  }
}

if (strict && (broken.length > 0 || unlisted.length > 0 || fmBad.length > 0 || fmCodeMissing.length > 0 || indexStale || badDest.length > 0 || badKind.length > 0)) {
  process.exit(1);
}
