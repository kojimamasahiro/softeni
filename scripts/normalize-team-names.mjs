#!/usr/bin/env node
/**
 * 大会結果データ（data/tournaments/details）の学校名・都道府県の表記揺れを統一する。
 *
 * 2種類の揺れを正規化する:
 *   1. 学校名: data/tournaments/team-name-aliases.json の対応表で別名 -> 正準名へ寄せる
 *   2. 都道府県: 接尾辞（県/府/都）が無い表記（例: 奈良 / 大阪 / 東京）に
 *      正しい接尾辞を補う（47都道府県の内蔵マップ）。
 *
 * 対象: participants[].team / participants[].prefecture / participants[].id と
 *       entries[].playerIds（参加者IDの参照）。id（`姓_名_チーム_都道府県`）を再計算し参照も張り替える。
 *
 * 重要: JSON 全体を再シリアライズすると playerIds 等のインライン配列の整形が変わり巨大な差分が出る。
 *       そこで JSON はパースして「どの文字列をどう置換すべきか」だけを算出し、元テキストへ
 *       ピンポイント置換する（整形を保つ）。冪等。
 *
 * 対象スコープ:
 *   既定では highschool-japan-cup（HJC）配下のみ。--scope=<tournamentId>（--scope=all で全大会）で変更可。
 *
 * 使い方:
 *   node scripts/normalize-team-names.mjs
 *   node scripts/normalize-team-names.mjs --dry-run
 *   node scripts/normalize-team-names.mjs --scope=all
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DETAILS_DIR = path.join(ROOT, 'data', 'tournaments', 'details');
const ALIAS_FILE = path.join(ROOT, 'data', 'tournaments', 'team-name-aliases.json');

const DRY_RUN = process.argv.includes('--dry-run');
const SCOPE_ARG = process.argv.find((a) => a.startsWith('--scope='));
const SCOPE = SCOPE_ARG ? SCOPE_ARG.slice('--scope='.length) : 'highschool-japan-cup';

// 47都道府県: 接尾辞なし表記 -> 正準表記
const PREF_CANON = (() => {
  const ken = [
    '青森',
    '岩手',
    '宮城',
    '秋田',
    '山形',
    '福島',
    '茨城',
    '栃木',
    '群馬',
    '埼玉',
    '千葉',
    '神奈川',
    '新潟',
    '富山',
    '石川',
    '福井',
    '山梨',
    '長野',
    '岐阜',
    '静岡',
    '愛知',
    '三重',
    '滋賀',
    '兵庫',
    '奈良',
    '和歌山',
    '鳥取',
    '島根',
    '岡山',
    '広島',
    '山口',
    '徳島',
    '香川',
    '愛媛',
    '高知',
    '福岡',
    '佐賀',
    '長崎',
    '熊本',
    '大分',
    '宮崎',
    '鹿児島',
    '沖縄',
  ];
  const m = new Map();
  for (const k of ken) m.set(k, k + '県');
  m.set('東京', '東京都');
  m.set('大阪', '大阪府');
  m.set('京都', '京都府');
  m.set('北海道', '北海道');
  return m;
})();

/** 都道府県を正準表記へ。既に接尾辞付き or 不明ならそのまま返す。 */
function canonPref(pref) {
  if (pref == null) return pref;
  if (/[都道府県]$/.test(pref)) return pref; // 既に接尾辞あり
  return PREF_CANON.get(pref) ?? pref; // 既知の短縮形のみ補完
}

/** チーム名のNFKC正規化（全角半角・空白・中黒の差を吸収）。マスタ生成と同じ規則。 */
function normTeam(s) {
  return s == null ? s : s.normalize('NFKC').replace(/[ 　]/g, '').replace(/[･•]/g, '・');
}

/**
 * 大会ID -> generationId。alias の scope 判定に使う。
 * index.json（全国大会）と local_index.json（地方大会）の両方を見る。
 */
function buildGenerationMap() {
  const map = new Map();
  for (const f of ['index.json', 'local_index.json']) {
    const p = path.join(ROOT, 'data', 'tournaments', f);
    if (!fs.existsSync(p)) continue;
    for (const t of JSON.parse(fs.readFileSync(p, 'utf8'))) {
      if (t.tournamentId) map.set(t.tournamentId, t.generationId ?? null);
    }
  }
  return map;
}

/**
 * alias エントリの scope が現在の大会に当てはまるか。
 *
 * scope を持たないエントリは従来どおり全大会に適用される（後方互換）。
 * scope を持つ場合は、指定された条件を **すべて** 満たすときだけ適用する。
 *   - `generation`: 大会の generationId がこの配列に含まれること
 *   - `tournamentPrefix`: 大会IDがこの配列のいずれかで始まること
 *   - `prefecture`: **参加者の都道府県**がこの配列に含まれること（他の2つと違い参加者単位で効く）
 *
 * なぜ必要か: alias 表はもともと文脈を持たず、`日高 -> 日高中学校`（和歌山）や
 * `柏崎 -> 柏崎ジュニア`（新潟）のように、**中学・クラブの文脈でだけ正しい**
 * エントリが混ざっている。--scope=all で全大会に流すと、インターハイに出ている
 * 同名の高校（和歌山県立日高高校・新潟県立柏崎高校）まで中学校名／クラブ名に
 * 書き換わってしまう。docs/raw/2026-08-12-idea-juniorhigh-category-pages.md
 */
function scopeMatches(scope, ctx) {
  if (!scope) return true;
  if (Array.isArray(scope.generation) && !scope.generation.includes(ctx.generation)) return false;
  if (Array.isArray(scope.tournamentPrefix) && !scope.tournamentPrefix.some((p) => (ctx.tournamentId ?? '').startsWith(p))) return false;
  // prefecture は参加者ごとに違うので ctx.prefecture が渡ってきたときだけ判定する
  if (Array.isArray(scope.prefecture) && !scope.prefecture.includes(ctx.prefecture ?? null)) return false;
  return true;
}

/**
 * team別名 -> 正準名 のルックアップを構築（キーはNFKC正規化形で照合）。
 * scope 付きエントリがあるため、単純な Map ではなく「文脈を受け取って引く関数」を返す。
 */
function buildTeamAliasResolver() {
  const raw = JSON.parse(fs.readFileSync(ALIAS_FILE, 'utf8'));
  /** @type {Map<string, {canonical: string, scope: object|null}[]>} */
  const map = new Map();
  for (const e of raw.teamAliases ?? []) {
    for (const a of e.aliases ?? []) {
      const k = normTeam(a);
      const list = map.get(k) ?? [];
      // 同じ別名を別の正準名へ割り当てるのは、scope で棲み分けている場合のみ許す。
      // scope なし同士 / scope なしと scope あり の衝突は従来どおりエラーにする
      // （どちらが勝つか決まらないため）。
      for (const prev of list) {
        if (prev.canonical === e.canonical) continue;
        if (!prev.scope || !e.scope) {
          throw new Error(`alias table conflict: "${a}" -> ${prev.canonical} / ${e.canonical}（scope で棲み分けてください）`);
        }
      }
      list.push({ canonical: e.canonical, scope: e.scope ?? null });
      map.set(k, list);
    }
  }
  // scope 付きを先に評価する（より限定的な指定を優先）
  for (const list of map.values()) list.sort((a, b) => (a.scope ? 0 : 1) - (b.scope ? 0 : 1));

  return (name, ctx) => {
    const list = map.get(normTeam(name));
    if (!list) return undefined;
    for (const cand of list) {
      if (scopeMatches(cand.scope, ctx)) return cand.canonical;
    }
    return undefined;
  };
}

function listDetailFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'temp') continue; // 中間生成物は対象外
      out.push(...listDetailFiles(full));
    } else if (ent.isFile() && ent.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

function normalizeFile(file, resolveTeamAlias, ctx) {
  let text = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(text);
  if (!Array.isArray(data.participants)) return null;

  const teamRepl = new Map(); // oldTeam -> canonical
  const prefRepl = new Map(); // oldPref -> canonical
  const idRepl = []; // { oldId, newId }

  for (const p of data.participants) {
    const newTeam = resolveTeamAlias(p.team, { ...ctx, prefecture: p.prefecture ?? null }) ?? p.team;
    const newPref = canonPref(p.prefecture);
    if (newTeam !== p.team) teamRepl.set(p.team, newTeam);
    if (newPref !== p.prefecture && p.prefecture != null) prefRepl.set(p.prefecture, newPref);
    // normalize-core.js の makeIdFromParts と同じく空要素を除去してから join する
    // （filter なしだとチーム参加者= lastName/firstName が null の id が "__チーム_県" に壊れる）
    const newId = [p.lastName ?? '', p.firstName ?? '', newTeam, newPref ?? ''].filter(Boolean).join('_');
    if (p.id && p.id !== newId) idRepl.push({ oldId: p.id, newId });
  }

  if (!teamRepl.size && !prefRepl.size && !idRepl.length) return null;

  let changed = 0;

  // フィールド値の置換（id 内部の部分文字列には当たらない）。
  // コロン後のスペース有無（`"team": "x"` / `"team":"x"`）の両方に対応する。
  // 大会追加ツール生成のインライン圧縮形式でスペースなしがあり、固定文字列
  // `"team": "x"` では置換漏れして id と team が不一致になる事故があった（選抜2024男子）。
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const applyField = (field, oldV, newV) => {
    const re = new RegExp(`("${field}"\\s*:\\s*)"${escapeRegExp(oldV)}"`, 'g');
    const count = (text.match(re) || []).length;
    if (!count) return;
    text = text.replace(re, (_, prefix) => `${prefix}"${newV}"`);
    changed += count;
  };
  for (const [oldT, newT] of teamRepl) applyField('team', oldT, newT);
  for (const [oldP, newP] of prefRepl) applyField('prefecture', oldP, newP);
  // 参加者ID（id フィールド + playerIds 等の配列要素）。
  // 裸の `"${oldId}"` 全文置換は禁止: prefecture 無しのチーム参加者では team/name の
  // フィールド値が oldId と一致し、置換のたびに team フィールドが壊れた id で上書き
  // されて実行回数分アンダースコアが増殖する事故があった（korea-cup 等）。
  const applyId = (oldId, newId) => {
    const o = escapeRegExp(oldId);
    for (const re of [
      new RegExp(`("id"\\s*:\\s*)"${o}"`, 'g'), // "id" フィールド
      new RegExp(`([\\[,]\\s*)"${o}"(?=\\s*[,\\]])`, 'g'), // playerIds / pair 等の配列要素
    ]) {
      const count = (text.match(re) || []).length;
      if (!count) continue;
      text = text.replace(re, (_, prefix) => `${prefix}"${newId}"`);
      changed += count;
    }
  };
  for (const { oldId, newId } of idRepl) applyId(oldId, newId);

  // 検証
  const after = JSON.parse(text);
  const seen = new Map();
  for (const p of after.participants) seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
  const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);

  if (changed && !DRY_RUN) fs.writeFileSync(file, text, 'utf8');
  return changed ? { changed, dups, teamRenames: [...teamRepl.entries()] } : null;
}

const INSIGHTS_DIR = path.join(ROOT, 'data', 'tournament-insights');

/**
 * 名寄せで改名したチームについて、旧名のまま残っている公開インサイトを列挙する（報告のみ）。
 *
 * なぜ必要か: 掲載データ側だけ改名すると、公開済みの本文が旧名のまま取り残される。
 * scripts/verify-story-text.mjs の teamKey() が吸収するのは末尾の学校種別だけなので、
 * 「王寺ユース」→「王寺ユースクラブ」のような差は照合が落ちる。prebuild まで気づけないと
 * 原因が名寄せだと分からないので、改名した本人がその場で分かるようにする
 * （2026-08-30 に実際に prebuild を止めた。docs/raw/2026-08-30-zennihon-championship-2019-pdf-entries-import.md）。
 *
 * **本文の自動書き換えはしない。** 別名には「東海」「柏崎」「村上」のような、姓や他チーム名の
 * 部分文字列と衝突するものが多数あり、散文への機械置換は壊す方が大きい。人が直す。
 */
function reportStaleInsights(renames) {
  if (!renames.size || !fs.existsSync(INSIGHTS_DIR)) return;
  const hits = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith('.json')) {
        let d;
        try {
          d = JSON.parse(fs.readFileSync(full, 'utf8'));
        } catch {
          continue;
        }
        if (d.state !== 'published' || !Array.isArray(d.paragraphs)) continue;
        const text = d.paragraphs.join('\n');
        for (const [oldName, newName] of renames) {
          // 新名の一部としての出現は数えない（「王寺ユースクラブ」の中の「王寺ユース」）
          if (!text.split(newName).join('\u0000').includes(oldName)) continue;
          hits.push({ file: path.relative(ROOT, full), oldName, newName });
        }
      }
    }
  };
  walk(INSIGHTS_DIR);
  if (!hits.length) return;
  console.warn('\n⚠ 公開インサイトの本文が旧名のまま残っています（照合が落ちます。本文を更新してください）:');
  for (const h of hits) console.warn(`  ${h.file}: 「${h.oldName}」-> 「${h.newName}」`);
}

function main() {
  const resolveTeamAlias = buildTeamAliasResolver();
  const generationMap = buildGenerationMap();
  const scopeRoot = SCOPE === 'all' ? DETAILS_DIR : path.join(DETAILS_DIR, SCOPE);
  if (!fs.existsSync(scopeRoot)) {
    console.error(`対象が見つかりません: ${path.relative(ROOT, scopeRoot)}`);
    process.exit(1);
  }
  console.log(`対象スコープ: ${SCOPE}`);
  const files = listDetailFiles(scopeRoot);
  let totalFiles = 0;
  let totalChanges = 0;
  const dupWarnings = [];
  const teamRenames = new Map(); // 旧名 -> 新名（この実行で実際に適用したもの）

  for (const file of files) {
    let res;
    // data/tournaments/details/<tournamentId>/<year>/<category>.json から大会IDを取り出す
    const tournamentId = path.relative(DETAILS_DIR, file).split(path.sep)[0] ?? null;
    const ctx = { tournamentId, generation: generationMap.get(tournamentId) ?? null };
    try {
      res = normalizeFile(file, resolveTeamAlias, ctx);
    } catch (err) {
      console.error(`ERROR ${path.relative(ROOT, file)}: ${err.message}`);
      process.exitCode = 1;
      continue;
    }
    if (!res) continue;
    totalFiles++;
    totalChanges += res.changed;
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${path.relative(ROOT, file)}: ${res.changed} 箇所置換`);
    if (res.dups && res.dups.length) dupWarnings.push({ file: path.relative(ROOT, file), dups: res.dups });
    for (const [oldName, newName] of res.teamRenames ?? []) teamRenames.set(oldName, newName);
  }

  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}完了: ${totalFiles} ファイル / ${totalChanges} 箇所を置換`);
  if (dupWarnings.length) {
    console.warn('\n⚠ 同一IDへ統合された参加者があります（要確認）:');
    for (const w of dupWarnings) console.warn(`  ${w.file}: ${w.dups.join(', ')}`);
  }
  reportStaleInsights(teamRenames);
}

main();
