// scripts/verify-story-text.mjs
// 大会インサイト（過去の事実ベース5分類ストーリー）のLLM出力を、実データと機械照合する。
//
// 背景: 試作YAMLを実データと突合したところ「もっともらしい」事実誤りが3件見つかった
// （選手の成績・連続年数の取り違え）。いずれも人のレビューでは素通りする性質のもので、
// ADR-005「事実のみ・推測を含めない」を人手の注意力に依存させないために必須。
// 設計: docs/raw/2026-08-01-idea-news-fact-based-story-categories.md 5.
//
// 照合先は **ストーリーYAMLではなく生データ**（data/tournaments/details/**）にする。
// YAML生成スクリプト自体のバグとLLMの捏造の両方を同じ仕組みで捕まえられるため。
//
// 使い方:
//   node scripts/verify-story-text.mjs --tournament zennihon-championship --category doubles-none-boys draft.md
//   node scripts/verify-story-text.mjs -t highschool-championship -c team-none-boys --text "尽誠学園は3連覇"
//
// 終了コード: 未検証(UNVERIFIED)または不一致(MISMATCH)が1件でもあれば 1。

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DETAILS_DIR = path.join(process.cwd(), 'data', 'tournaments', 'details');

// ---------------------------------------------------------------- 正規化

const normalize = (s) => (s ?? '').toString().replace(/\s|　/g, '');

/** 学校・所属名の比較キー。接尾辞の表記ゆれ（高校/高等学校 等）を吸収する。 */
const teamKey = (s) => normalize(s).replace(/(高等学校|高校|中学校|中学|大学)$/, '');

const RANK_LABEL = { 100: '優勝', 90: '準優勝', 80: 'ベスト4', 70: 'ベスト8' };

/** results[].tournament.rank -> 比較可能なスコア。ベスト8未満はドロー規模依存なので null。 */
function rankScore(rank) {
  if (!rank) return null;
  if (rank.kind === 'winner') return 100;
  if (rank.kind === 'runnerup') return 90;
  if (rank.kind === 'best') return { 4: 80, 8: 70 }[rank.bestLevel] ?? null;
  return null;
}

// ---------------------------------------------------------------- 事実の読み込み

/**
 * 1大会×1種目ぶんの「照合可能な事実」を全年度ぶん構築する。
 *  - playerYear: 氏名 -> { 年: 成績スコア }
 *  - teamYear:   所属キー -> { 年: 成績スコア }
 *  - names:      実在する氏名の集合（表記そのまま）
 *  - teams:      実在する所属名の集合
 *  - scores:     「勝者名 vs 敗者名」のスコア（例 '5-4'）
 */
function loadFacts(tournamentId, categoryId) {
  const base = path.join(DETAILS_DIR, tournamentId);
  if (!fs.existsSync(base)) throw new Error(`大会が見つかりません: ${tournamentId}`);

  const years = fs
    .readdirSync(base)
    .filter((y) => /^\d{4}$/.test(y))
    .filter((y) => fs.existsSync(path.join(base, y, `${categoryId}.json`)))
    .map(Number)
    .sort((a, b) => a - b);

  if (years.length === 0) throw new Error(`種目が見つかりません: ${tournamentId} / ${categoryId}`);

  const playerYear = new Map();
  const teamYear = new Map();
  const playerEntryYears = new Map();
  const teamEntryYears = new Map();
  const names = new Set();
  const teams = new Set();
  const matchScores = [];

  for (const year of years) {
    const detail = JSON.parse(fs.readFileSync(path.join(base, String(year), `${categoryId}.json`), 'utf8'));
    const byId = new Map((detail.participants ?? []).map((p) => [p.id, p]));

    const entryPlayers = new Map();
    for (const entry of detail.entries ?? []) {
      const players = (entry.playerIds ?? []).map((id) => byId.get(id)).filter(Boolean);
      entryPlayers.set(entry.entryNo, players);
      for (const p of players) {
        const full = normalize(p.lastName) + normalize(p.firstName);
        if (full) {
          names.add(full);
          if (!playerEntryYears.has(full)) playerEntryYears.set(full, new Set());
          playerEntryYears.get(full).add(year);
        }
        if (normalize(p.team)) {
          teams.add(normalize(p.team));
          const tk = teamKey(p.team);
          if (!teamEntryYears.has(tk)) teamEntryYears.set(tk, new Set());
          teamEntryYears.get(tk).add(year);
        }
      }
    }

    for (const result of detail.results ?? []) {
      const score = rankScore(result?.tournament?.rank);
      if (score == null) continue;
      for (const p of entryPlayers.get(result.entryNo) ?? []) {
        const full = normalize(p.lastName) + normalize(p.firstName);
        if (full) {
          if (!playerYear.has(full)) playerYear.set(full, {});
          playerYear.get(full)[year] = Math.max(playerYear.get(full)[year] ?? 0, score);
        }
        const tk = teamKey(p.team);
        if (tk) {
          if (!teamYear.has(tk)) teamYear.set(tk, {});
          teamYear.get(tk)[year] = Math.max(teamYear.get(tk)[year] ?? 0, score);
        }
      }
    }

    for (const match of detail.matches ?? []) {
      if (match.winnerEntryNo == null || !match.scores) continue;
      const values = Object.entries(match.scores);
      if (values.length !== 2) continue;
      const win = match.scores[String(match.winnerEntryNo)];
      const lose = values.find(([no]) => Number(no) !== match.winnerEntryNo)?.[1];
      if (win == null || lose == null) continue;
      const loserEntryNo = values.map(([no]) => Number(no)).find((no) => no !== match.winnerEntryNo);
      // 団体戦の対戦主語は**学校名**。選手名で持つと「岡崎城西が2-1で勝った」のような
      // 学校を主語にしたスコア記述を照合できない（団体戦はメンバー名で語られないため）。
      const isTeamEvent = categoryId.startsWith('team-');
      const nameOf = (players) =>
        isTeamEvent
          ? [...new Set((players ?? []).map((p) => teamKey(p.team)).filter(Boolean))]
          : (players ?? []).map((p) => normalize(p.lastName) + normalize(p.firstName));
      const base = {
        year,
        round: match.round ?? null,
        winners: nameOf(entryPlayers.get(match.winnerEntryNo)),
        losers: nameOf(entryPlayers.get(loserEntryNo)),
      };
      // 勝者視点「2-1で勝った」と敗者視点「0-2で敗れた」の両方が日本語では自然なので、
      // 逆順も登録する。片方しか持たないと正しい記述を未検証として弾いてしまう。
      matchScores.push({ ...base, text: `${win}-${lose}` });
      if (win !== lose) matchScores.push({ ...base, text: `${lose}-${win}` });
    }
  }

  return { years, playerYear, teamYear, playerEntryYears, teamEntryYears, names, teams, matchScores };
}

// ---------------------------------------------------------------- 主張の抽出

/**
 * 本文から検証可能な主張を抜き出す。
 * 「文中に登場する固有名詞のうち、直近に現れたもの」を主語とみなす素朴な方式にしている。
 * 形態素解析を入れないのは、誤りを見逃すより過剰に報告する方が安全なため
 * （UNVERIFIED は人が確認するだけで、自動で落とすわけではない）。
 */
function extractClaims(text, facts) {
  const claims = [];
  const subjects = [...facts.names, ...[...facts.teams].map(teamKey)].filter(Boolean).sort((a, b) => b.length - a.length);

  // 本文を行・句点で区切り、各断片ごとに「直近に登場した主語」を持ち回る。
  // 空行は捨てずに残す。構造の切れ目で主語をリセットするために使う。
  const segments = text.split(/[\n。]/).map((s) => s.trim());
  let carried = [];
  let staleSubject = false;

  for (const [segIndex, segment] of segments.entries()) {
    // YAMLのストーリー区切り（`- id:`）は主語を完全に断ち切る。ここをまたいで引き継ぐと、
    // ある種目に登場しない主語が前のストーリーから漏れ、無関係な成績をその主語の主張として
    // 誤判定する（インターハイの複数種目YAMLで実際に25件の誤検出が出た）。
    if (/^-?\s*id:/.test(segment)) {
      carried = [];
      staleSubject = false;
      continue;
    }
    // 空行は断ち切らない。散文では「◯◯高の5年間。」の次に空行を挟んで成績を並べる書き方が
    // 普通で、ここで切ると主語不明だらけになる。ただし段落をまたいだ主語は確度が落ちるので
    // 印を付け、外れたときに ERROR ではなく WARN に落とす。
    if (segment === '') {
      if (carried.length > 0) staleSubject = true;
      continue;
    }
    const flat = normalize(segment);
    // 成績ラベルを伏せてから固有名詞を探す。実データに「ベスト」という所属が実在し、
    // 「ベスト8」の部分文字列に誤ヒットして主語を乗っ取るため。
    const masked = flat.replace(/ベスト\s*\d+/g, ' ');

    const here = subjects.filter((s) => masked.includes(s));
    // 短い名前が長い名前に内包される場合（例「東北」と「東北高」）は長い方だけ残す
    const present = here.filter((s) => !here.some((o) => o !== s && o.includes(s)));
    if (present.length > 0) {
      carried = present;
      staleSubject = false;
    }
    const owners = present.length > 0 ? present : carried;
    const stale = present.length === 0 && staleSubject;

    // (a) 「2024年優勝」「2024年は準優勝」「2024年も優勝」形式。
    // 助詞を挟む書き方を拾い漏らすと実際の誤りを見逃すため、年と成績の間の助詞を許容する
    // （「2024年も優勝」を取りこぼして誤りをすり抜けさせた実例があるため）。
    for (const m of flat.matchAll(/(\d{4})年(?:[はもにでandの、]|\s)*(優勝|準優勝|ベスト4|ベスト8)/g)) {
      claims.push({ type: 'year-result', segIndex, owners, stale, year: Number(m[1]), result: m[2], raw: m[0] });
    }
    // (a2) 「YYYY年の◯◯大会△△は<主体>が優勝しました」形式。
    // (a) は年と成績が隣接する語順しか拾わないため、PROMPT.md が指示する書き出し
    // （「今年何が起きたか」を最初に書く＝年→大会名→種目→主体→成績の語順）が
    // まるごと網から漏れていた。実測では公開済みインサイト24本すべてで、
    // 記事の主語である「今年誰が優勝したか」が1件も照合されていなかった。
    // 誤って年を結び付けないよう、年がちょうど1つの断片に限定する。
    const yearsInSegment = [...new Set([...flat.matchAll(/(\d{4})年/g)].map((m) => Number(m[1])))];
    if (yearsInSegment.length === 1) {
      // 「が優勝し」に限定する。「準優勝となりました」のような、主体が主語でない
      // 言い回しまで拾うと語順の推定が外れて誤検出になるため。
      for (const m of flat.matchAll(/が(優勝|準優勝)し/g)) {
        claims.push({
          type: 'year-result',
          segIndex,
          owners,
          stale,
          year: yearsInSegment[0],
          result: m[1],
          raw: `${yearsInSegment[0]}年${m[1]}`,
        });
      }
    }
    // (b) 「4年連続ベスト8以上」「5年連続出場」「3年連続で決勝」。
    // 「N年連続」だけを見て一律にベスト8以上と解釈すると、別の意味の連続（決勝進出・出場）を
    // 誤って不一致と報告してしまう。直後の語から水準を読み取り、判定できない語は未検証にする。
    for (const m of flat.matchAll(/(\d+)年連続(?:で|の)?\s*(優勝|決勝|準優勝|ベスト4|ベスト8|入賞|出場)?/g)) {
      let level = m[2] ?? null;
      let inferred = false;
      if (!level) {
        // 「4年連続で同じペアで出場」のように水準語が離れている書き方を拾う。
        // 直後になければ、同じ文の後方を少しだけ探す。
        const tail = flat.slice(m.index + m[0].length, m.index + m[0].length + 12);
        const near = tail.match(/(優勝|決勝|準優勝|ベスト4|ベスト8|入賞|出場)/);
        if (near) [, level] = near;
        // 水準が文中から読み取れないときは「ベスト8以上」と仮定するが、
        // 仮定であることを持ち回り、外れても ERROR ではなく WARN に落とす。
        else inferred = true;
      }
      claims.push({ type: 'streak', segIndex, owners, stale, years: Number(m[1]), level, inferred, raw: m[0] });
    }
    // (c) 「3連覇」
    for (const m of flat.matchAll(/(\d+)連覇/g)) {
      claims.push({ type: 'repeat-title', segIndex, owners, stale, times: Number(m[1]), raw: m[0] });
    }
    // (d) 「5-4」
    for (const m of flat.matchAll(/(\d+)[-−](\d+)/g)) {
      claims.push({ type: 'score', segIndex, owners, stale, text: `${m[1]}-${m[2]}`, raw: m[0] });
    }
    // (e) 本文に出てくる人名・学校名そのものの実在確認
    for (const s of present) claims.push({ type: 'name', segIndex, subject: s, raw: s });
    // (f) 掲載範囲外の年
    for (const m of flat.matchAll(/(\d{4})年/g)) {
      claims.push({ type: 'year-in-range', segIndex, year: Number(m[1]), raw: m[0] });
    }
  }
  return claims;
}

// ---------------------------------------------------------------- 照合

function historyOf(subject, facts) {
  return facts.playerYear.get(subject) ?? facts.teamYear.get(teamKey(subject)) ?? null;
}

/** 「N年連続」の水準語 -> 必要な最低スコア。null は「ベスト8以上」（既定）。 */
const STREAK_LEVEL = { 優勝: 100, 決勝: 90, 準優勝: 90, ベスト4: 80, ベスト8: 70, 入賞: 70 };

/**
 * 条件を満たす最新年から遡って**暦年で連続**している回数。掲載年の欠落は連続とみなさない
 * （例: 2019, 2022-2025 のように間が抜けている大会で 2022 を 2019 の翌年扱いしない。
 * 2020年のような大会中止年も同様で、橋渡ししない — generate-story-yaml.mjs の
 * streakEndingAt と同じ判定に揃える。旧実装は years 配列をインデックスで遡るだけで、
 * 配列の隣接要素が実際に暦年で隣接しているかを見ておらず、この判定を満たしていなかった）。
 *
 * maxYear を渡すと、それより後の年は「まだ無かったもの」として無視する。
 * 過去の記事（例: 2025年公開の記事）が「N年連続」と書いた時点の事実は、翌年以降に
 * 大会が続いて記録が伸びても変わらない。maxYear 無指定（フル照合の手動実行など）では
 * 従来通り最新年まで見る。
 */
function calendarStreak(years, maxYear, predicate) {
  const scoped = maxYear == null ? years : years.filter((y) => y <= maxYear);
  const yearSet = new Set(scoped);
  const present = scoped.filter(predicate);
  if (present.length === 0) return 0;
  const last = present[present.length - 1];
  let streak = 1;
  for (let y = last - 1; yearSet.has(y) && predicate(y); y -= 1) streak += 1;
  return streak;
}

function streakLength(history, facts, minScore = 70, maxYear) {
  return calendarStreak(facts.years, maxYear, (y) => (history[y] ?? 0) >= minScore);
}

/** 出場（エントリー）の連続年数。成績を問わない「N年連続出場」の照合に使う。maxYear の扱いは streakLength と同じ。 */
function entryStreak(entryYears, facts, maxYear) {
  return calendarStreak(facts.years, maxYear, (y) => entryYears.has(y));
}

function verify(claims, facts, maxYear) {
  const findings = [];
  const seen = new Set();

  for (const claim of claims) {
    const dedupe = JSON.stringify(claim);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    // 種目に依存しない主張キー。複数種目で照合した結果をまとめるときに使う。
    const key = claim.type === 'name' ? `name:${claim.subject}` : `${claim.type}:${claim.segIndex}:${claim.raw}`;

    if (claim.type === 'name') {
      // 実在確認はエントリー全体（facts.teams / facts.names）に対して行う。
      // teamYear はベスト8以上に限られるため、実在するのに未検証と報告してしまう。
      const ok = facts.names.has(claim.subject) || [...facts.teams].some((t) => teamKey(t) === teamKey(claim.subject));
      findings.push({
        key,
        status: ok ? 'OK' : 'UNVERIFIED',
        message: `固有名詞「${claim.subject}」`,
        detail: ok ? '掲載データに存在' : '掲載データに見つからない',
      });
      continue;
    }

    if (claim.type === 'year-in-range') {
      const ok = facts.years.includes(claim.year);
      findings.push({
        key,
        status: ok ? 'OK' : 'UNVERIFIED',
        message: `${claim.year}年`,
        detail: ok ? '掲載範囲内' : `掲載範囲(${facts.years.join(',')})の外`,
      });
      continue;
    }

    if (claim.type === 'score') {
      // スコアは「その数字の試合が、登場人物の関わる形で実在するか」までしか見ない。
      // どの試合を指しているかは文脈依存で機械判定できないため、一致した試合を出力に
      // 添えて人が確認できるようにする（照合ではなく手掛かりの提示）。
      const hit = facts.matchScores.find(
        (m) => m.text === claim.text && (claim.owners.length === 0 || claim.owners.some((o) => m.winners.includes(o) || m.losers.includes(o))),
      );
      findings.push({
        key,
        status: hit ? 'OK' : 'UNVERIFIED',
        message: `スコア ${claim.text}${claim.owners.length ? `（${claim.owners.join('・')}）` : ''}`,
        detail: hit
          ? `該当: ${hit.year}年${hit.round ?? ''} ${hit.winners.join('・')} 対 ${hit.losers.join('・')}（要目視確認）`
          : '該当する試合が見つからない',
      });
      continue;
    }

    if (!claim.owners || claim.owners.length === 0) {
      findings.push({ key, status: 'UNVERIFIED', message: `「${claim.raw}」`, detail: '主語を特定できず照合不能' });
      continue;
    }

    // 1文に複数の主語が出る場合（ダブルスのペアなど）は候補それぞれで照合し、
    // 1人でも一致すれば OK とする。全員外れたときだけ不一致として報告する。
    const attempts = claim.owners.map((owner) => {
      // 「N年連続出場」は成績を問わないので、ベスト8以上の記録が無くても照合できる。
      // 順位ベースの判定より先に処理する。
      if (claim.type === 'streak' && claim.level === '出場') {
        const years = facts.playerEntryYears.get(owner) ?? facts.teamEntryYears.get(teamKey(owner));
        if (!years) return { owner, ok: false, actual: '出場記録なし' };
        const actual = entryStreak(years, facts, maxYear);
        return { owner, ok: actual === claim.years, actual: `${actual}年連続出場` };
      }

      const history = historyOf(owner, facts);
      if (!history) return { owner, ok: false, actual: 'ベスト8以上の記録なし' };

      if (claim.type === 'year-result') {
        const actual = history[claim.year] == null ? null : RANK_LABEL[history[claim.year]];
        return { owner, ok: actual === claim.result, actual: actual ?? 'ベスト8以上の記録なし' };
      }
      if (claim.type === 'streak') {
        if (claim.level === '出場') {
          const years = facts.playerEntryYears.get(owner) ?? facts.teamEntryYears.get(teamKey(owner));
          if (!years) return { owner, ok: false, actual: '出場記録なし' };
          const actual = entryStreak(years, facts, maxYear);
          return { owner, ok: actual === claim.years, actual: `${actual}年連続出場` };
        }
        const minScore = STREAK_LEVEL[claim.level] ?? 70;
        const actual = streakLength(history, facts, minScore, maxYear);
        return { owner, ok: actual === claim.years, actual: `${actual}年連続（${claim.level ?? 'ベスト8'}以上）` };
      }
      if (claim.type === 'repeat-title') {
        const actual = calendarStreak(facts.years, maxYear, (y) => history[y] === 100);
        return { owner, ok: actual === claim.times, actual: `連続優勝${actual}回` };
      }
      return { owner, ok: false, actual: '未対応の主張' };
    });

    const hit = attempts.find((a) => a.ok);
    const label = {
      'year-result': `${claim.year}年${claim.result}`,
      streak: `${claim.years}年連続${claim.level ?? 'ベスト8以上'}`,
      'repeat-title': `${claim.times}連覇`,
    }[claim.type];

    // 何を主張しているのか読み取れなかった「N年連続」は、外れても断定しない。
    // 断定すると正しい文まで不一致として弾き、チェックが信用されなくなる。
    const uncertain = (claim.type === 'streak' && claim.inferred) || claim.stale;
    findings.push({
      key,
      status: hit ? 'OK' : uncertain ? 'UNVERIFIED' : 'MISMATCH',
      message: `${hit ? hit.owner : claim.owners.join('/')} ${label}`,
      detail: hit
        ? undefined
        : `${claim.stale ? '段落をまたいで主語を推定したため確度が低い。' : ''}${claim.type === 'streak' && claim.inferred ? '何の連続かを文から判定できず、ベスト8以上と仮定した。' : ''}実データは ${attempts.map((a) => `${a.owner}=${a.actual}`).join(' / ')}`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const args = { files: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--tournament' || a === '-t') args.tournament = argv[++i];
    else if (a === '--category' || a === '-c') args.category = argv[++i];
    else if (a === '--text') args.text = argv[++i];
    else if (a === '--quiet' || a === '-q') args.quiet = true;
    else if (a === '--year' || a === '-y') args.year = Number(argv[++i]);
    else if (a === '--list-names') args.listNames = true;
    else args.files.push(a);
  }
  return args;
}

/**
 * 複数種目をまとめて照合する。記事の単位は「大会×年（全種目束ね）」と決めたため、
 * 1本の原稿に複数種目の事実が混在する。種目ごとに facts を持ったまま順に当て、
 * **どれか1つの種目で一致すれば OK** とする（種目をまたいで事実を混ぜない）。
 *
 * maxYear: 「N年連続」「N連覇」の起点をこの年に固定する（過去の記事が後年の大会結果で
 * 不一致になるのを防ぐ）。年×成績・スコア・固有名詞などそれ以外の主張は、記事が後年の
 * 対戦履歴（例: 再戦の相手校のその後の対戦結果）に触れることがあるため、従来通り
 * 掲載データの全期間で照合する。
 */
function verifyAcross(text, tournamentId, categoryIds, maxYear) {
  const factsList = categoryIds.map((categoryId) => ({ categoryId, facts: loadFacts(tournamentId, categoryId) }));

  const perCategory = factsList.map(({ categoryId, facts }) => ({
    categoryId,
    findings: verify(extractClaims(text, facts), facts, maxYear),
  }));

  // 主張の同一性は「本文中の位置＋元の文字列」で判定する。
  // message で突き合わせると、ある種目では主語を解決できて「◯◯ 2024年優勝」、
  // 別の種目では解決できず「主語を特定できず」となり、同じ主張が別物として二重計上される。
  const rank = { OK: 0, UNVERIFIED: 1, MISMATCH: 2 };
  const merged = new Map();
  for (const { categoryId, findings } of perCategory) {
    for (const f of findings) {
      const prev = merged.get(f.key);
      if (!prev || rank[f.status] < rank[prev.status]) merged.set(f.key, { ...f, categoryId });
    }
  }
  return { findings: [...merged.values()], years: factsList[0]?.facts.years ?? [] };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  // 実在する固有名詞の一覧をJSONで吐くだけのモード。
  // 照合器は「既知の名前と一致した語」しか主張として抽出しないため、
  // 捏造された固有名詞は主張にすらならず警告ゼロで素通りする（実測で確認済み）。
  // その穴は本文側から「知らない名前が出ていないか」を見ないと塞げないので、
  // 事実の読み込みを持つこのスクリプトから名前だけを外に出せるようにする。
  // 利用側は scripts/insight-agent/lint.mjs。
  if (args.listNames) {
    if (!args.tournament || !args.category) {
      console.error('使い方: node scripts/verify-story-text.mjs -t <tournamentId> -c <categoryId[,...]> --list-names');
      process.exit(2);
    }
    const names = new Set();
    const teams = new Set();
    for (const categoryId of args.category.split(',').map((s) => s.trim()).filter(Boolean)) {
      const facts = loadFacts(args.tournament, categoryId);
      for (const n of facts.names) names.add(n);
      for (const t of facts.teams) teams.add(t);
    }
    // 本文は「亀安・関口組」のように姓だけで呼ぶ。氏名の連結形しか返さないと、
    // 正しい表記まで「知らない名前」に見えてしまうため、姓と名の断片も併せて返す。
    // 元データは姓名を別フィールドで持つが facts は連結済みなので、ここで読み直す。
    const parts = new Set();
    for (const categoryId of args.category.split(',').map((s) => s.trim()).filter(Boolean)) {
      const base = path.join(DETAILS_DIR, args.tournament);
      for (const y of fs.readdirSync(base).filter((v) => /^\d{4}$/.test(v))) {
        const file = path.join(base, y, `${categoryId}.json`);
        if (!fs.existsSync(file)) continue;
        for (const p of JSON.parse(fs.readFileSync(file, 'utf8')).participants ?? []) {
          for (const v of [p.lastName, p.firstName]) if (normalize(v)) parts.add(normalize(v));
        }
      }
    }
    console.log(JSON.stringify({ names: [...names], teams: [...teams], nameParts: [...parts] }));
    process.exit(0);
  }

  if (!args.tournament || !args.category || (!args.text && args.files.length === 0)) {
    console.error('使い方: node scripts/verify-story-text.mjs -t <tournamentId> -c <categoryId[,categoryId...]> [file...] [--text "..."] [-y <year>]');
    console.error('  -c は種目をカンマ区切りで複数指定できる（全種目束ねの原稿を照合する場合）。');
    console.error('  -y はこの記事が「何年時点」の記事かを指定する。「N年連続」「N連覇」の起点をその年に固定し、');
    console.error('  翌年以降に大会が続いて記録が伸びても過去の記事が不一致にならないようにする（省略時は最新年まで見る）。');
    process.exit(2);
  }

  const categoryIds = args.category
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const text = args.text ?? args.files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const { findings, years } = verifyAcross(text, args.tournament, categoryIds, args.year);

  const counts = { OK: 0, MISMATCH: 0, UNVERIFIED: 0 };
  for (const f of findings) counts[f.status] += 1;

  console.log(`照合対象: ${args.tournament} / ${categoryIds.join(', ')} / 掲載年 ${years.join(', ')}\n`);
  for (const f of findings) {
    if (args.quiet && f.status === 'OK') continue;
    const mark = { OK: '  OK  ', MISMATCH: 'ERROR ', UNVERIFIED: ' WARN ' }[f.status];
    console.log(`[${mark}] ${f.message}${f.detail ? ` — ${f.detail}` : ''}`);
  }
  console.log(`\n一致 ${counts.OK} / 不一致 ${counts.MISMATCH} / 未検証 ${counts.UNVERIFIED}`);

  if (counts.MISMATCH > 0) {
    console.log('\n不一致があります。実データと突き合わせて修正してください。');
    process.exit(1);
  }
  if (counts.UNVERIFIED > 0) {
    console.log('\n未検証の記述があります。掲載範囲外の事実か、捏造かを人が確認してください。');
    process.exit(1);
  }
}

main();
