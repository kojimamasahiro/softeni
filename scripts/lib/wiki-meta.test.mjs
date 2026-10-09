#!/usr/bin/env node
// wiki-meta.mjs の回帰テスト（ADR-024 の P1・P2）。
//
// 固定するもの:
//   - frontmatter の解析（"…"・'…'・素の文字列・code の並び・解釈できない行）
//   - 検証（必須項目・値・未知のキー・summary の長さ・code の実在・本文の適用範囲との一致）
//   - wiki:for の前方一致（/ で区切る。`lib/matchAnalysis/` は `lib/matchAnalysisX.ts` に当たらない）
//   - index.md の生成（type 順・ファイル名順・index.md 自身を除く・draft の印・同じ入力なら同じ出力・不正なページがあれば作らない）
//
// 実行: node scripts/lib/wiki-meta.test.mjs
import { splitFrontmatter, validateFrontmatter, matchPages, normalizeTarget, buildIndexText, titleOf, ROOT, compileLogDestinations } from './wiki-meta.mjs';

let pass = 0;
const failed = [];
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++;
    console.log(`OK  : ${name}`);
  } else {
    failed.push(`${name}${detail ? ' — ' + detail : ''}`);
    console.log(`FAIL: ${name}${detail ? ' — ' + detail : ''}`);
  }
};

const page = (extra = '', body = '# Title\n\n> **適用範囲: 汎用**。説明。\n') =>
  `---\ntype: feature\nscope: 汎用\nstatus: current\nsummary: "要約"\n${extra}---\n${body}`;
const exists = (set) => (p) => set.includes(p);

// ---- 解析 ----
{
  const a = splitFrontmatter(page('code:\n  - "lib/a.ts"\n  - "src/b/"\n'));
  check('解析: キーと code の並び', a.meta.type === 'feature' && a.meta.code.length === 2 && a.meta.code[1] === 'src/b/');
  check('解析: 本文は frontmatter を除いた部分', a.body.startsWith('# Title'));
  const b = splitFrontmatter(`---\ntype: feature\nsummary: 'it''s ok'\ncode:\n  - 'lib/x.ts'\n---\n本文`);
  check("解析: 単一引用符（Prettier が書き換えた形）と '' のエスケープ", b.meta.summary === "it's ok" && b.meta.code[0] === 'lib/x.ts');
  const c = splitFrontmatter(`---\nsummary: コロン: を含む素の文字列\n---\n`);
  check('解析: 素の文字列', c.meta.summary === 'コロン: を含む素の文字列');
  const d = splitFrontmatter('# タイトルだけ\n本文\n');
  check('解析: frontmatter が無ければ meta は null', d.meta === null && d.body.startsWith('# タイトル'));
  const e = splitFrontmatter(`---\ntype: feature\nこれは解釈できない\n---\n`);
  check('解析: 解釈できない行は errors に出す', e.errors.length === 1);
  const f = splitFrontmatter(`---\nsummary: "壊れた\n---\n`);
  check('解析: 閉じていない引用符は errors に出す', f.errors.length === 1);
}

// ---- 検証 ----
{
  const ok = validateFrontmatter(page('code:\n  - "lib/a.ts"\n'), exists(['lib/a.ts']));
  check('検証: 正しいページは通る', ok.schema.length === 0 && ok.codeMissing.length === 0);
  check('検証: frontmatter が無い', validateFrontmatter('# だけ\n').schema.length === 1);
  const bad = (text, key) => validateFrontmatter(text, () => true).schema.some((s) => s.includes(key));
  check('検証: type が不正', bad(page().replace('type: feature', 'type: bogus'), 'type が不正'));
  check('検証: scope が不正', bad(page().replace('scope: 汎用', 'scope: 全部'), 'scope が不正'));
  check('検証: status が不正', bad(page().replace('status: current', 'status: done'), 'status が不正'));
  check('検証: summary が空', bad(page().replace('summary: "要約"', 'summary: ""'), 'summary が空'));
  check('検証: summary が長すぎる', bad(page().replace('要約', 'あ'.repeat(161)), 'summary が長い'));
  check('検証: 未知のキー', bad(page('owner: me\n'), '未知のキー'));
  check('検証: code が空', bad(page('code:\n'), 'code が空'));
  check('検証: code に絶対パス', bad(page('code:\n  - "/etc/passwd"\n'), 'code のパスが不正'));
  check('検証: code に ..', bad(page('code:\n  - "../x"\n'), 'code のパスが不正'));
  const miss = validateFrontmatter(page('code:\n  - "lib/a.ts"\n  - "lib/none.ts"\n'), exists(['lib/a.ts']));
  check('検証: 実在しない code は codeMissing に出す（schema には出さない）', miss.codeMissing.join() === 'lib/none.ts' && miss.schema.length === 0);
  const mm = validateFrontmatter(page().replace('scope: 汎用', 'scope: 固有'), () => true);
  check(
    '検証: scope が本文の適用範囲と食い違う',
    mm.schema.some((s) => s.includes('食い違う')),
  );
  const alias = validateFrontmatter(page('', '# T\n\n> **適用範囲: 学校スポーツ共通**。\n').replace('scope: 汎用', 'scope: 学校'), () => true);
  check('検証: 「学校スポーツ共通」は scope: 学校 と一致とみなす', alias.schema.length === 0);
}

// ---- wiki:for の一致 ----
{
  const P = (base, code) => ({ base, title: base, meta: { type: 'feature', scope: '汎用', status: 'current', summary: base, code } });
  const pages = [
    P('analysis.md', ['lib/matchAnalysis/', 'lib/growthAnalysis/']),
    P('beta.md', ['lib/matchAnalysis/', 'lib/matchAnalysis/index.ts', 'src/pages/beta/']),
    P('rules.md', ['lib/matchRules.ts']),
    { base: 'none.md', title: 'none', meta: { type: 'index', scope: '汎用', status: 'current', summary: 'x' } },
  ];
  const names = (t) =>
    matchPages(pages, t)
      .map((m) => `${m.base}:${m.kind}`)
      .join(',');
  check(
    '一致: ディレクトリ配下のファイル → inside。項目が長い（具体的）ページが先',
    names('lib/matchAnalysis/index.ts') === 'beta.md:exact,analysis.md:inside',
    names('lib/matchAnalysis/index.ts'),
  );
  check('一致: ファイルがそのまま code: にある → exact', names('lib/matchRules.ts') === 'rules.md:exact');
  check('一致: ディレクトリを末尾の / 無しで引いても exact', names('lib/matchAnalysis') === 'analysis.md:exact,beta.md:exact', names('lib/matchAnalysis'));
  check(
    '一致: 親ディレクトリを引くと配下の項目を持つページが出る → contains',
    names('lib/') === 'analysis.md:contains,beta.md:contains,rules.md:contains',
    names('lib/'),
  );
  check('一致: 前方一致は / で区切る（lib/matchAnalysisX.ts は当たらない）', names('lib/matchAnalysisX.ts') === '');
  check('一致: どれにも当たらなければ空', names('scripts/unknown.mjs') === '');
  check('一致: ./ 付きと絶対パスを吸収', names('./lib/matchRules.ts') === 'rules.md:exact' && names(`${ROOT}/lib/matchRules.ts`) === 'rules.md:exact');
  check('一致: code: を持たないページ（meta あり）は無視', !names('lib/').includes('none.md'));
  check('正規化: 末尾の / は残す（ディレクトリの印）', normalizeTarget('./src/pages/') === 'src/pages/');
}

// ---- wiki:for の「本文で言及」 ----
{
  const P = (base, code, body) => ({
    base,
    title: base,
    body,
    meta: { type: 'feature', scope: '汎用', status: 'current', summary: base, ...(code ? { code } : {}) },
  });
  const pages = [
    P('owner.md', ['lib/a.ts'], '本文。`lib/a.ts` を使う。'),
    P('mention.md', null, '実装は `lib/a.ts` と `src/pages/beta/x.tsx` にある。'),
    P('dirmention.md', null, 'ページは `src/pages/beta/` の下。lib/ や scripts/ も使う。'),
    P('nobody.md', null, '何も書いていない。'),
  ];
  const kinds = (t) =>
    matchPages(pages, t)
      .map((m) => `${m.base}:${m.kind}`)
      .join(',');
  check(
    '言及: code: に無くても本文がそのパスを書いていれば cited。code: の一致が先',
    kinds('lib/a.ts') === 'owner.md:exact,mention.md:cited',
    kinds('lib/a.ts'),
  );
  check(
    '言及: code: で一致したページは cited と重複して出さない',
    kinds('lib/a.ts')
      .split(',')
      .filter((x) => x.startsWith('owner.md')).length === 1,
  );
  check('言及: 本文のパスは文字列として一致する（部分一致の取り違えをしない）', kinds('lib/b.ts') === '');
  // ディレクトリを引くと、そのディレクトリ自体を書いたページと、配下のファイルを書いたページ（mention.md）の両方が出る。
  check(
    '言及: 2階層以上のディレクトリも数える（配下のファイルを書いたページも含む）',
    kinds('src/pages/beta/') === 'dirmention.md:cited,mention.md:cited',
    kinds('src/pages/beta/'),
  );
  check('言及: 1階層のディレクトリ（lib/・scripts/）は雑音なので数えない', kinds('lib/') === 'owner.md:contains' && kinds('scripts/') === '', kinds('lib/'));
  check(
    '言及: body が無いページ（テスト用の最小データ）でも落ちない',
    matchPages([{ base: 'x.md', title: 'x', meta: { code: ['lib/a.ts'] } }], 'lib/a.ts').length === 1,
  );
}

// ---- index.md の生成 ----
{
  const P = (base, type, extra = {}) => ({
    base,
    title: `T-${base}`,
    errors: [],
    meta: { type, scope: '汎用', status: 'current', summary: `S-${base}`, ...extra },
  });
  const pages = [
    P('z-feature.md', 'feature'),
    P('index.md', 'index'),
    P('a-feature.md', 'feature', { status: 'draft', scope: '固有' }),
    P('m-overview.md', 'overview'),
    P('q-index.md', 'index'),
  ];
  const r = buildIndexText(pages);
  check('index: 問題が無ければ text が出る', r.text !== null && r.problems.length === 0);
  const pos = (s) => r.text.indexOf(s);
  check('index: type 順（overview → feature → index）', pos('## overview') < pos('## feature') && pos('## feature') < pos('## index'));
  check('index: 同じ type の中はファイル名順', pos('a-feature.md') < pos('z-feature.md'));
  check('index: index.md 自身は載せない', !r.text.includes('(./index.md)'));
  check('index: draft の印と scope が出る', r.text.includes('- [T-a-feature.md](./a-feature.md) `固有` `draft` — S-a-feature.md'));
  check('index: current は status を出さない', r.text.includes('- [T-z-feature.md](./z-feature.md) `汎用` — S-z-feature.md'));
  check('index: 同じ入力なら同じ出力', buildIndexText(pages).text === r.text);
  check('index: 自身の frontmatter が type: index', r.text.startsWith('---\ntype: index\n'));
  const broken = buildIndexText([...pages, { base: 'bad.md', title: 'bad', errors: ['type が不正'], meta: { type: 'bogus' } }]);
  check('index: frontmatter が不正なページがあれば作らず、問題を挙げる', broken.text === null && broken.problems[0].startsWith('bad.md'));
  const nometa = buildIndexText([{ base: 'x.md', title: 'x', errors: [], meta: null }]);
  check('index: frontmatter の無いページも問題として挙げる', nometa.text === null && nometa.problems.length === 1);
}

// ---- Compile Log の行き先 ----
{
  const dests = (t) =>
    compileLogDestinations(t)
      .map((d) => `${d.kind}:${d.name}@${d.line}`)
      .join(',');
  const note = (log) => `# T\n\n本文\n\n## Compile Log\n\n${log}\n`;
  check(
    'Compile Log: wiki:<ページ名> と ADR-<番号> を取り出す',
    dests(note('- wiki:database: 列\n- ADR-023: 判断3つ')) === 'wiki:database@7,adr:023@8',
    dests(note('- wiki:database: 列\n- ADR-023: 判断3つ')),
  );
  check('Compile Log: バッククォートで囲んでもよい', dests(note('- `wiki:seo`: x\n- `ADR-024`: y')) === 'wiki:seo@7,adr:024@8');
  check('Compile Log: .md は付けても付けなくてもよい', dests(note('- wiki:data-model.md: x')) === 'wiki:data-model@7');
  check('Compile Log: 全角コロンも区切りにできる', dests(note('- wiki:seo： x')) === 'wiki:seo@7');
  check(
    'Compile Log: 旧書式・自由記述・落とした(…)・AGENTS.md は見ない',
    dests(note('- wiki（seo.md）へ: x\n- ADR-023 へ: y\n- 落とした(重複): wiki:seo に既にある\n- `AGENTS.md`（未）: z')) === '',
  );
  check('Compile Log: 節の外の行は見ない', dests('## 概要\n\n- wiki:seo: x\n\n## Compile Log\n\n- wiki:ranking: y\n') === 'wiki:ranking@7');
  check('Compile Log: 次の同じ深さの見出しで節が終わる', dests('## Compile Log\n\n- wiki:seo: a\n\n## 次\n\n- wiki:ranking: b\n') === 'wiki:seo@3');
  check(
    'Compile Log: ### の「Compile Log（追記）」も節として扱う',
    dests('## Compile Log\n\n- wiki:seo: a\n\n### Compile Log（追記2）\n\n- ADR-012: b\n') === 'wiki:seo@3,adr:012@7',
  );
  check('Compile Log: コードブロックの中の例は見ない', dests('## Compile Log\n\n```markdown\n- wiki:example: x\n```\n\n- wiki:seo: y\n') === 'wiki:seo@7');
  check('Compile Log: 節が無ければ空', dests('# T\n\n- wiki:seo: x\n') === '');
}

// ---- 見出し ----
check('titleOf: 最初の H1', titleOf('前置き\n# 見出し A\n## 小見出し\n# 見出し B\n') === '見出し A');
check('titleOf: H1 が無ければ null', titleOf('## だけ\n') === null);

console.log(`\n${pass} 件 OK / ${failed.length} 件 NG`);
if (failed.length > 0) {
  failed.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
