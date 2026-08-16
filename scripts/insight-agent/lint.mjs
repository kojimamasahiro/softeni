#!/usr/bin/env node
// scripts/insight-agent/lint.mjs
// 大会インサイト本文の「文章としての作法」を機械チェックする。
//
// 背景: docs/story-yaml/PROMPT.md は「評価語を使うな」「推測を書くな」「story idを併記しろ」を
// 文章で指示しているだけで、これまでどのスクリプトも検査していなかった。
// scripts/verify-story-text.mjs が見るのは事実（年×成績・連続年数・連覇・スコア・固有名詞）だけで、
// 修辞や推測は素通りする。クラウドLLMは指示を守れていたので穴が表面化しなかったが、
// ローカル9〜14Bクラスに書かせるなら指示追従が落ちる前提で機械側に移す必要がある。
// 設計: docs/raw/2026-08-14-idea-local-llm-skill-replacement.md
//
// 使い方:
//   node scripts/insight-agent/lint.mjs -t highschool-championship -y 2025 \
//     -c team-none-boys,team-none-girls,doubles-none-boys,doubles-none-girls draft.md
//   node scripts/insight-agent/lint.mjs --insight data/tournament-insights/highschool-championship/2025/team-none-boys.json
//   node scripts/insight-agent/lint.mjs --text "強豪の尽誠学園が悲願の優勝" --no-coverage
//
// 終了コード: ERROR が1件でもあれば 1。WARN のみなら 0（人が判断する材料として出す）。

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const VERIFIER = path.join(process.cwd(), 'scripts', 'verify-story-text.mjs');

// ---------------------------------------------------------------- 検査語彙

// PROMPT.md「評価語・修飾語を使わないこと」の禁止例をそのまま機械化したもの。
// 「順位と年数だけで語る」がADR-005由来の制約なので、成績以外の価値判断語はすべてここに入る。
const BANNED_WORDS = [
  '強豪', '名門', '古豪', '王者', '女王', '絶対王者',
  '悲願', '雪辱', 'リベンジ', '復活', '返り咲',
  '圧巻', '圧倒的', '驚異的', '驚異の', '衝撃', '劇的', '見事',
  '注目の', '実力者', '実力校', '優勝候補', '本命', '大本命',
  '常勝', '無敵', '最強', '快挙', '偉業', '金字塔',
  '底力', '意地', '執念', '気迫', '死闘', '熱戦', '激闘',
];

// PROMPT.md「推測を書かないこと。理由・心境・背景・今後の見通しは、YAMLに無い限り書かない」。
// 進行中版では「これから起こることの予想を書かない」がさらに強く効く。
const SPECULATION_PATTERNS = [
  { re: /とみられ/, label: '推測（とみられる）' },
  { re: /だろう/, label: '推測（だろう）' },
  { re: /と思われ/, label: '推測（と思われる）' },
  { re: /期待され/, label: '推測（期待される）' },
  { re: /注目され/, label: '推測（注目される）' },
  { re: /有力(?!校名)/, label: '予想（有力）' },
  { re: /今後/, label: '見通し（今後）' },
  { re: /来年|翌年に(は|も)/, label: '見通し（来年）' },
  { re: /が期待/, label: '見通し（期待）' },
  { re: /だ(ろ|っ)た(はず|の)/, label: '推測（はず）' },
  { re: /(悔し|嬉し|喜び|涙)/, label: '心境（データに無い）' },
];

// verify-story-text.mjs が「実データと突き合わせた」と言える主張の型。
// 固有名詞の存在確認・年が掲載範囲内かの2つは、文が factually 誤っていても通るため除く
// （公開済み24本の実測で、この2型が全主張の73.6%を占めていた）。
const SUBSTANTIVE = /^\[\s*(OK|WARN|ERROR)\s*\]\s*(?!固有名詞)(?!\d{4}年 — 掲載範囲内)/;

// 照合の網に原理的にかからないと分かっている言い回し。
// 素通りすること自体は既知なので、「未照合の文」ではなくこちらで名指しして警告する。
const UNVERIFIABLE_CLAIMS = [
  { re: /初優勝|初めての優勝|初の優勝/, label: '「初優勝」は照合対象の主張型に無く、機械では検証されない' },
  { re: /勝ち残(り|って)が(無|な)く/, label: '「勝ち残りが無い」は集計値で照合対象外（2026年女子ダブルスで誤公開した型）' },
  { re: /(何|[0-9０-９]+)組(が)?(残|勝ち残)/, label: '「N組残っている」は集計値で照合対象外' },
  { re: /全(勝|敗)|無敗/, label: '「無敗」は照合対象の主張型に無い' },
];

// ---------------------------------------------------------------- 未知の固有名詞

// この記事群が固有名詞以外に使う漢字・カタカナ。
// 公開済みインサイト24本(64段落)から「既知の固有名詞をすべて伏せた残り」として機械的に導出した。
// 導出時点で93種類しかなく、記事の語彙が極端に狭いことがそのまま検出力になっている。
// 別の大会を書き始めると正当な新語彙が増えるので、そのときは
//   node scripts/insight-agent/lint.mjs --learn-vocab -t <tid> -c <cat,...>
// で洗い直し、下の定数か scripts/insight-agent/genre-vocab.txt に足す。
const GENRE_CHARS = new Set(
  '々イウゲサスタダトドハブベムラルンー上下両人今以会伸位体個優入再出切初前勝去合同回団囲場士大女子対差己年当後成戦手掲敗新方更最来果校残決準男目相着破種範組結続績自記試載退連進過選重録顔高',
);

const VOCAB_FILE = path.join(process.cwd(), 'scripts', 'insight-agent', 'genre-vocab.txt');

function genreChars() {
  const set = new Set(GENRE_CHARS);
  if (fs.existsSync(VOCAB_FILE)) {
    for (const line of fs.readFileSync(VOCAB_FILE, 'utf8').split('\n')) {
      if (line.startsWith('#')) continue; // 由来を書いておくための注釈行
      for (const ch of line) if (ch.trim()) set.add(ch);
    }
  }
  return set;
}

/** 照合器に「実在する固有名詞」を聞く。長い順に並べて最長一致で伏せられるようにする。 */
function knownNames(tournament, category) {
  const r = spawnSync('node', [VERIFIER, '-t', tournament, '-c', category, '--list-names'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`--list-names に失敗: ${r.stderr}`);
  const d = JSON.parse(r.stdout);
  const all = new Set([...d.names, ...d.teams, ...d.nameParts]);
  for (const k of [...all]) all.add(k.replace(/(高等学校|高校|中学校|中学|大学)$/, ''));
  return [...all].filter((s) => s.length >= 2).sort((a, b) => b.length - a.length);
}

/** 既知の固有名詞と定型語彙を伏せた残りを返す。捏造された固有名詞はここに残る。 */
function residue(text, known, vocab) {
  let s = text;
  for (const k of known) if (s.includes(k)) s = s.split(k).join(' ');
  // ひらがな・数字・記号・成績語は固有名詞になり得ないので落とす。
  s = s.replace(/[ぁ-ん０-９0-9\s、。「」『』（）()・･,.\-−ー〜%％]/g, ' ');
  return [...s.matchAll(/[^\s]+/g)]
    .map((m) => [...m[0]].filter((ch) => !vocab.has(ch)).join(''))
    .filter(Boolean);
}

/**
 * 本文に「掲載データに無い固有名詞」が混ざっていないかを見る。
 * 照合器は既知の名前と一致した語しか主張として抽出しないため、捏造された名前は
 * 主張にすらならず警告ゼロで通る（実測で確認済み）。その穴を本文側から塞ぐ。
 */
function lintUnknownNames(text, { tournament, category }) {
  if (!tournament || !category) return [];
  const known = knownNames(tournament, category);
  const vocab = genreChars();
  const findings = [];
  for (const s of sentences(text)) {
    for (const r of residue(s, known, vocab)) {
      findings.push({
        level: 'WARN',
        rule: '未知の固有名詞',
        message: `「${r}」は掲載データに無い（捏造か、語彙表の未登録か）`,
        sentence: s,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const args = { files: [], coverage: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--tournament' || a === '-t') args.tournament = argv[++i];
    else if (a === '--category' || a === '-c') args.category = argv[++i];
    else if (a === '--year' || a === '-y') args.year = Number(argv[++i]);
    else if (a === '--text') args.text = argv[++i];
    else if (a === '--insight') args.insight = argv[++i];
    else if (a === '--no-coverage') args.coverage = false;
    else if (a === '--no-names') args.noNames = true;
    else if (a === '--learn-vocab') args.learnVocab = true;
    else if (a === '--whole') args.whole = true;
    else if (a === '--quiet' || a === '-q') args.quiet = true;
    else if (!a.startsWith('-')) args.files.push(a);
  }
  return args;
}

/**
 * markdown下書きから「記事本文」だけを取り出す。
 * この種のファイルは本文と、分類・設計メモ・裏取り記録が同居している。
 * 全体を検査すると解説文の語彙まで「未知の固有名詞」として報告され、
 * 警告が数百件になって読まれなくなる（実測で676件出た）。
 * 目印は PROMPT.md の出力形式（`## 投稿N`）と、この repo の下書き習慣（引用ブロック）。
 */
function extractBody(raw) {
  const lines = raw.split('\n');
  const quoted = lines.filter((l) => /^\s*>/.test(l));
  let body;
  if (quoted.length > 0) {
    body = quoted;
  } else {
    const picked = [];
    let inPost = false;
    for (const l of lines) {
      const h = l.match(/^#{1,6}\s*(.*)$/);
      if (h) {
        inPost = /^(投稿|案)\s*\d/.test(h[1].trim());
        continue;
      }
      if (inPost) picked.push(l);
    }
    body = picked.length > 0 ? picked : lines;
  }
  return body
    .map((l) => l.replace(/^\s*>\s?/, ''))
    .join('\n')
    .replace(/https?:\/\/\S+/g, ' ') // 記事末尾のURL
    .replace(/`[^`]*`/g, ' ') // コード片
    .replace(/\*\*?/g, '');
}

/** 入力を「本文テキスト」と「使ったstory id」に正規化する。 */
function loadInput(args) {
  if (args.insight) {
    const d = JSON.parse(fs.readFileSync(args.insight, 'utf8'));
    return {
      text: (d.paragraphs ?? []).join('\n'),
      usedIds: d.usedStoryIds ?? [],
      source: args.insight,
      tournament: args.tournament ?? d.tournamentId,
      year: args.year ?? d.year,
      category: args.category ?? d.categoryId,
      state: d.state,
    };
  }
  const raw = args.text ?? args.files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const text = args.whole ? raw : extractBody(raw);
  // markdown下書きは PROMPT.md の指示どおり各投稿末尾に `used: <id>, <id>` を持つ。
  // `used:` は本文の外（引用ブロックの下）に置かれることがあるので、抜き出す前の全文から拾う。
  const usedIds = [...raw.matchAll(/^\s*>?\s*used:\s*(.+)$/gim)].flatMap((m) => m[1].split(/[,、]/).map((s) => s.trim()).filter(Boolean));
  return { text, usedIds, source: args.files[0] ?? '--text', tournament: args.tournament, year: args.year, category: args.category };
}

// ---------------------------------------------------------------- 検査

/** 本文を文に割る。用例が「。」区切りなので素朴な分割で足りる。 */
const sentences = (text) =>
  text
    .split(/\n/)
    .flatMap((line) => line.split(/(?<=。)/))
    .map((s) => s.trim())
    .filter((s) => s && !/^used:/i.test(s) && !/^#{1,6}\s/.test(s));

function lintWording(text) {
  const findings = [];
  for (const s of sentences(text)) {
    for (const w of BANNED_WORDS) {
      if (s.includes(w)) {
        findings.push({ level: 'ERROR', rule: '評価語', message: `禁止語「${w}」`, sentence: s });
      }
    }
    for (const { re, label } of SPECULATION_PATTERNS) {
      const m = s.match(re);
      if (m) findings.push({ level: 'ERROR', rule: '推測', message: `${label}: 「${m[0]}」`, sentence: s });
    }
    for (const { re, label } of UNVERIFIABLE_CLAIMS) {
      if (re.test(s)) findings.push({ level: 'WARN', rule: '照合不能', message: label, sentence: s });
    }
  }
  return findings;
}

function lintUsedIds(usedIds, source) {
  if (usedIds.length > 0) return [];
  return [{
    level: 'ERROR',
    rule: 'used',
    message: 'story id の併記が無い（ADR-012 は usedStoryIds を公開の必須条件にしている）',
    sentence: source,
  }];
}

/**
 * 各文が verify-story-text.mjs で「実データと突き合わせた主張」を1つでも生むかを調べる。
 * 生まない文は、事実が誤っていても照合が黙って通す領域なので、人に名指しで見せる。
 */
function lintCoverage(text, { tournament, category, year }) {
  if (!tournament || !category) {
    return [{ level: 'WARN', rule: 'カバレッジ', message: '-t / -c が無いため照合カバレッジを測っていない', sentence: '' }];
  }
  const findings = [];
  for (const s of sentences(text)) {
    // 「初優勝」のように照合対象外だと既に名指しした文は、汎用の未照合警告を重ねない。
    // 同じ文に2行出ると件数が水増しされ、警告そのものが読み飛ばされるようになる。
    if (UNVERIFIABLE_CLAIMS.some(({ re }) => re.test(s))) continue;
    const argv = [VERIFIER, '-t', tournament, '-c', category, '--text', s];
    if (year) argv.push('-y', String(year));
    const r = spawnSync('node', argv, { encoding: 'utf8' });
    const substantive = (r.stdout ?? '').split('\n').filter((l) => SUBSTANTIVE.test(l)).length;
    if (substantive === 0) {
      findings.push({ level: 'WARN', rule: 'カバレッジ', message: '実データと突き合わせた主張が0件（誤っていても照合を通る文）', sentence: s });
    }
  }
  return findings;
}

// ---------------------------------------------------------------- main

function main() {
  const args = parseArgs(process.argv.slice(2));

  // 定型語彙の洗い直し。既に正しいと分かっている本文（＝公開済みインサイト）から、
  // 固有名詞を伏せた残りを集めて語彙表を作る。別の大会を書き始めたときに使う。
  if (args.learnVocab) {
    const dir = path.join(process.cwd(), 'data', 'tournament-insights', args.tournament ?? '');
    const files = fs.existsSync(dir)
      ? fs.readdirSync(dir).flatMap((y) => {
          const d = path.join(dir, y);
          return fs.statSync(d).isDirectory() ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => path.join(d, f)) : [];
        })
      : [];
    const known = knownNames(args.tournament, args.category);
    const chars = new Set();
    let paragraphs = 0;
    for (const f of files) {
      for (const p of JSON.parse(fs.readFileSync(f, 'utf8')).paragraphs ?? []) {
        paragraphs += 1;
        for (const r of residue(p, known, new Set())) for (const ch of r) chars.add(ch);
      }
    }
    console.error(`${files.length}本 / ${paragraphs}段落から導出。${chars.size}種類。`);
    console.log([...chars].sort().join(''));
    process.exit(0);
  }

  if (!args.text && !args.insight && args.files.length === 0) {
    console.error('使い方: node scripts/insight-agent/lint.mjs [-t <id> -c <cat,...> -y <year>] <draft.md>');
    console.error('        node scripts/insight-agent/lint.mjs --insight <insight.json>');
    process.exit(2);
  }

  const input = loadInput(args);
  const findings = [
    ...lintWording(input.text),
    ...lintUsedIds(input.usedIds, input.source),
    ...(args.noNames ? [] : lintUnknownNames(input.text, input)),
    ...(args.coverage ? lintCoverage(input.text, input) : []),
  ];

  const errors = findings.filter((f) => f.level === 'ERROR');
  const warns = findings.filter((f) => f.level === 'WARN');

  console.log(`対象: ${input.source}${input.tournament ? ` / ${input.tournament}` : ''}${input.year ? ` / ${input.year}` : ''}`);
  console.log(`文数: ${sentences(input.text).length} / 併記された story id: ${input.usedIds.length}件`);
  console.log('');

  for (const f of findings) {
    if (args.quiet && f.level !== 'ERROR') continue;
    const mark = f.level === 'ERROR' ? 'ERROR ' : ' WARN ';
    console.log(`[${mark}] ${f.rule}: ${f.message}`);
    if (f.sentence) console.log(`         ${f.sentence}`);
  }

  console.log('');
  console.log(`ERROR ${errors.length} / WARN ${warns.length}`);
  if (errors.length > 0) {
    console.log('');
    console.log('ERROR は PROMPT.md の絶対の制約に反しています。本文を直してください。');
  }
  if (warns.length > 0 && !args.quiet) {
    console.log('WARN は「機械が事実を確かめられない文」です。書き手が根拠を自分で確認してください。');
  }
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
