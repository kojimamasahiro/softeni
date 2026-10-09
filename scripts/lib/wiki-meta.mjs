// scripts/lib/wiki-meta.mjs
//
// docs/wiki のページ先頭の frontmatter を読む・検証する・使う部品（ADR-024。経緯は docs/raw/2026-10-09-llm-wiki-redesign.md）。
//   - check-wiki-size.mjs   … frontmatter の検証（ゲート）と index.md の鮮度
//   - generate-wiki-index.mjs … index.md を frontmatter から生成する
//   - wiki-for.mjs          … 触るコードのパスから、それを code: に持つページを引く
//
// frontmatter の形は `---` で挟んだ `key: value` と、`code:` の下の `  - "path"` の並びだけ。
// YAML の全機能は使わない（依存を増やさないため）。値は "…"（JSON 形式）・'…'（Prettier が書き換えるとこの形）・素の文字列。
//
// テスト: node scripts/lib/wiki-meta.test.mjs
import fs from 'node:fs';
import path from 'node:path';

// 作業ディレクトリ基準（check-wiki-size.mjs と同じ。一時コピーでの検査ができるように）。
export const ROOT = process.cwd();

export const FM_TYPES = ['entity', 'concept', 'feature', 'procedure', 'overview', 'index'];
export const FM_SCOPES = ['汎用', '学校', '固有', '混在'];
export const FM_STATUSES = ['current', 'draft', 'deprecated'];
export const FM_KEYS = ['type', 'scope', 'status', 'summary', 'code'];
export const FM_SUMMARY_MAX = 160;
// 本文の「適用範囲」の語 → scope の値。
export const SCOPE_WORDS = { 汎用: '汎用', 学校スポーツ共通: '学校', 学校: '学校', ソフトテニス固有: '固有', 固有: '固有', 混在: '混在' };
const SCOPE_LINE = /適用範囲[:：]\s*\*{0,2}\s*(汎用|学校スポーツ共通|学校|ソフトテニス固有|固有|混在)/;

function parseScalar(v) {
  if (v.startsWith('"')) return JSON.parse(v);
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

/** 先頭の frontmatter と本文に分ける。frontmatter が無ければ meta は null。 */
export function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: null, errors: [], body: text };
  const meta = {};
  const errors = [];
  let key = null;
  for (const line of m[1].split('\n')) {
    try {
      let mm;
      if ((mm = line.match(/^([A-Za-z_]+):\s*(.*)$/))) {
        key = mm[1];
        meta[key] = mm[2] === '' ? [] : parseScalar(mm[2].trim());
      } else if (key && Array.isArray(meta[key]) && (mm = line.match(/^\s+-\s+(.+)$/))) {
        meta[key].push(parseScalar(mm[1].trim()));
      } else if (line.trim() !== '') {
        errors.push(`解釈できない行（${line.slice(0, 30)}）`);
      }
    } catch {
      errors.push(`値を解釈できない（${line.slice(0, 30)}）`);
    }
  }
  return { meta, errors, body: text.slice(m[0].length) };
}

/**
 * wiki 1ページの frontmatter を検査する。schema＝形と値、codeMissing＝code: の実在しないパス。
 * exists は code: のパスの実在確認（テストで差し替える）。
 */
export function validateFrontmatter(text, exists = (p) => fs.existsSync(path.join(ROOT, p))) {
  const { meta, errors, body } = splitFrontmatter(text);
  const schema = [...errors];
  const codeMissing = [];
  if (!meta) return { schema: ['frontmatter が無い（必須: type / scope / status / summary。形式は docs/adr/ADR-024）'], codeMissing };
  for (const k of Object.keys(meta)) if (!FM_KEYS.includes(k)) schema.push(`未知のキー ${k}`);
  if (!FM_TYPES.includes(meta.type)) schema.push(`type が不正（${FM_TYPES.join('/')}）`);
  if (!FM_SCOPES.includes(meta.scope)) schema.push(`scope が不正（${FM_SCOPES.join('/')}）`);
  if (!FM_STATUSES.includes(meta.status)) schema.push(`status が不正（${FM_STATUSES.join('/')}）`);
  if (typeof meta.summary !== 'string' || meta.summary.trim() === '') schema.push('summary が空');
  else if ([...meta.summary].length > FM_SUMMARY_MAX) schema.push(`summary が長い（${FM_SUMMARY_MAX} 字まで）`);
  if ('code' in meta) {
    if (!Array.isArray(meta.code) || meta.code.length === 0) schema.push('code が空（無いなら項目ごと省く）');
    else {
      for (const p of meta.code) {
        if (typeof p !== 'string' || p.startsWith('/') || p.includes('..')) schema.push(`code のパスが不正（${p}）`);
        else if (!exists(p)) codeMissing.push(p);
      }
    }
  }
  // 移行の間は本文の「適用範囲」の行も残すので、frontmatter の scope と一致していることを確かめる。
  const sm = body.split('\n').slice(0, 12).join('\n').match(SCOPE_LINE);
  if (sm && FM_SCOPES.includes(meta.scope) && SCOPE_WORDS[sm[1]] !== meta.scope) {
    schema.push(`scope（${meta.scope}）が本文の適用範囲（${sm[1]}）と食い違う`);
  }
  return { schema, codeMissing };
}

/** 本文の最初の H1。無ければ null。 */
export function titleOf(body) {
  const m = body.match(/^# (.+)$/m);
  return m ? m[1].trim() : null;
}

/** docs/wiki の全ページを読む。base＝ファイル名、meta＝frontmatter、errors＝形と値の問題（code: の実在は見ない）。 */
export function loadWikiPages(dir = path.join(ROOT, 'docs', 'wiki')) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((base) => {
      const text = fs.readFileSync(path.join(dir, base), 'utf-8');
      const { meta, body } = splitFrontmatter(text);
      return { base, meta, body, title: titleOf(body) || base.replace(/\.md$/, ''), errors: validateFrontmatter(text, () => true).schema };
    });
}

// ---- wiki:for（触るコード → 所有ページ） ----

const KIND_RANK = { exact: 0, inside: 1, contains: 2, cited: 3 };
export const KIND_LABEL = { exact: '一致', inside: '配下', contains: '含む', cited: '本文で言及' };

/** 引数のパスを、リポジトリ基準の相対パスにそろえる（./ と絶対パスを吸収。末尾の / は残す＝ディレクトリの印）。 */
export function normalizeTarget(t, root = ROOT) {
  let s = t.replace(/\\/g, '/');
  if (s.startsWith(root + '/')) s = s.slice(root.length + 1);
  return s.replace(/^\.\//, '');
}

// 本文が target のパスをそのまま書いているか。ディレクトリ（末尾 / か拡張子なし）は2階層以上のときだけ数える。
function citedIn(body, t) {
  const base = t.split('/').pop();
  const dirLike = t.endsWith('/') || !base.includes('.');
  if (!dirLike) return body.includes(t);
  const d = t.endsWith('/') ? t : `${t}/`;
  return d.split('/').filter(Boolean).length >= 2 && body.includes(d);
}

/**
 * target のパスを code: に持つページを返す。
 *   exact    … code: の項目と同じ（ディレクトリは末尾の / の有無を問わない）
 *   inside   … target が、code: のディレクトリの配下にある
 *   contains … code: の項目が、target のディレクトリの配下にある（`lib/` を引くと配下の項目を持つページが出る）
 *   cited    … code: には無いが、ページの本文が target のパスをそのまま書いている（p.body があるとき。改名・削除で記述が古くなるページ）
 *              1階層だけのディレクトリ（`lib/` や `scripts/`）は、ほぼ全ページに出てくる雑音なので数えない。
 * ページごとに最も近い一致だけを残し、一致の種類 → 項目が長い（具体的）順（contains は除く）→ ファイル名の順に並べる。
 * 前方一致は必ず / で区切る（`lib/matchAnalysis/` は `lib/matchAnalysisX.ts` に当たらない）。
 */
export function matchPages(pages, target, root = ROOT) {
  const t = normalizeTarget(target, root);
  const tDir = t.endsWith('/') ? t : `${t}/`;
  const out = [];
  for (const p of pages) {
    const codes = p.meta && Array.isArray(p.meta.code) ? p.meta.code : [];
    let best = null;
    for (const e of codes) {
      let kind = null;
      if (e === t || e === tDir) kind = 'exact';
      else if (e.endsWith('/') && t.startsWith(e)) kind = 'inside';
      else if (e.startsWith(tDir)) kind = 'contains';
      if (!kind) continue;
      if (!best || KIND_RANK[kind] < KIND_RANK[best.kind] || (kind === best.kind && e.length > best.entry.length)) best = { kind, entry: e };
    }
    if (!best && typeof p.body === 'string' && citedIn(p.body, t)) best = { kind: 'cited', entry: t };
    if (best) out.push({ base: p.base, title: p.title, meta: p.meta, ...best });
  }
  // 項目が長い＝具体的、は exact / inside の間でだけ意味がある。contains はファイル名順（偶然の並びにしない）。
  const specificity = (m) => (m.kind === 'contains' ? 0 : -m.entry.length);
  out.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || specificity(a) - specificity(b) || a.base.localeCompare(b.base));
  return out;
}

// ---- index.md の生成 ----

const TYPE_ORDER = ['overview', 'entity', 'concept', 'feature', 'procedure', 'index'];
const TYPE_LABEL = {
  overview: '全体の構成と基盤',
  entity: 'データの対象（定義・識別子・置き場）',
  concept: '規則・判定のしかた',
  feature: '機能・ページ群の仕様',
  procedure: '繰り返す手順と検算',
  index: '索引・集約',
};

const INDEX_FRONTMATTER = `---
type: index
scope: 汎用
status: current
summary: "wiki の入口。全ページを type 別に並べた説明つきの一覧。npm run wiki:index で生成する"
---
`;

const INDEX_HEAD = `<!-- 生成物。npm run wiki:index で作り直す（手で直さない。コンフリクトしたら作り直す）。元は各ページ先頭の frontmatter。設計は ADR-024。 -->
# Wiki Index

> **適用範囲: 汎用**。この wiki の入口。

Softeni Pick の現在の仕様・設計・運用の一覧。各行の説明は、そのページ先頭の frontmatter の \`summary\`。

読み方:

1. **意図で選ぶ** — 下の一覧から説明で選ぶ。
2. **触るコードで選ぶ（補助）** — \`npm run wiki:for -- <パス>\` で、そのパスを \`code:\` に持つページと、本文でそのパスに触れているページを引く。
3. **語で選ぶ** — \`grep -rn "<語>" docs/wiki\`。
4. 選んだページは全文を読む。「なぜ」が要るときだけ [ADR](../adr/README.md)、証拠が要るときだけ [raw](../raw/README.md)。

印: \`汎用\` どの競技でも使える／\`学校\` 日本の学校スポーツに共通／\`固有\` ソフトテニス固有／\`混在\` 節によって違う
（背景は [raw/2026-09-18-idea-multi-sport-expansion.md](../raw/2026-09-18-idea-multi-sport-expansion.md)）。
\`draft\` は検討中で未確定、\`deprecated\` は古くなった記述。
`;

const INDEX_FOOT = `
## wiki の外

- [docs/README.md](../README.md) — docs の運用ガイド（層の定義、置き場所）
- [adr/README.md](../adr/README.md) — 重要な決定の記録
- [raw/README.md](../raw/README.md) — 生の記録（追記のみ）
- [prompts/README.md](../prompts/README.md) — 定型プロンプト
`;

/** index.md の全文を作る。frontmatter が不正なページがあれば problems に挙げ、text は null。 */
export function buildIndexText(pages) {
  const body = pages.filter((p) => p.base !== 'index.md');
  const problems = body.filter((p) => !p.meta || p.errors.length > 0).map((p) => `${p.base}（${p.errors.join('、') || 'frontmatter が無い'}）`);
  if (problems.length > 0) return { text: null, problems };
  let text = INDEX_FRONTMATTER + INDEX_HEAD;
  for (const type of TYPE_ORDER) {
    const group = body.filter((p) => p.meta.type === type).sort((a, b) => a.base.localeCompare(b.base));
    if (group.length === 0) continue;
    text += `\n## ${type} — ${TYPE_LABEL[type]}\n\n`;
    for (const p of group) {
      const status = p.meta.status === 'current' ? '' : ` \`${p.meta.status}\``;
      text += `- [${p.title}](./${p.base}) \`${p.meta.scope}\`${status} — ${p.meta.summary}\n`;
    }
  }
  return { text: text + INDEX_FOOT, problems: [] };
}
