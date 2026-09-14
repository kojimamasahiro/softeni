// lib/__tests__/popularPages.test.ts
// 実行: npm run popular:test
//
// GA4 の CSV からトップページの「よく見られている」上位を求める部分を固定する。
// 列名は GA4 の表示言語で変わるので、日本語・英語の両方の書き出しを1件ずつ置いている。

import { classifyPopularPath, parseGa4PagesCsv, rankPopularPages } from '../popularPages';
import { assert, summary, test } from '../playerStats/__tests__/harness';

console.log('popularPages.test.ts');

const JA_CSV = `﻿# ----------------------------------------
# ページとスクリーン: ページパス + クエリ文字列
# アカウント: softeni-pick
# 開始日: 20260817
# 終了日: 20260913
# ----------------------------------------

ページパス + クエリ文字列,表示回数,アクティブ ユーザー,ユーザーあたりのビュー,平均エンゲージメント時間
,"12,345",3000,4.1,40
/players/19/results/,"1,200",800,1.5,50
/players/19/results/?from=top,300,200,1.5,50
/players/19/results/?q=%E5%B0%BE%E7%94%B0,11,5,1,10
/players/19/results/#google_vignette,4,4,1,10
/players/uematsu-toshiki/,100,90,1.1,30
/players/,900,700,1.3,20
/teams/nttnishinihon/,500,400,1.2,30
/teams/nttnishinihon/2025/boys/,50,40,1.2,30
/highschool/boys/nara/takadashou/,700,500,1.4,60
/highschool/girls/nara/takadashou/,10,10,1,10
/secondaryschool/pathways/boys/,999,800,1.2,30
/secondaryschool/yamagata/nagaikita/,40,30,1.3,30
/primaryschool/aichi/smiley/,30,20,1.5,30
`;

const EN_CSV = `# Start date: 20260817
# End date: 20260913

Page path and screen class,Views,Active users,Views per active user
/players/20/results,80,50,1.6
/teams/watakyu/,60,40,1.5
`;

test('日本語の書き出しを読める（合計行は除く・期間はコメント行から）', () => {
  const parsed = parseGa4PagesCsv(JA_CSV);
  assert.strictEqual(parsed.startDate, '2026-08-17');
  assert.strictEqual(parsed.endDate, '2026-09-13');
  assert.strictEqual(parsed.rows.length, 13);
  assert.deepStrictEqual(parsed.rows[0], { path: '/players/19/results/', views: 1200 });
});

test('英語の書き出しも読める（「Views per active user」を表示回数と取り違えない）', () => {
  const parsed = parseGa4PagesCsv(EN_CSV);
  assert.deepStrictEqual(parsed.rows, [
    { path: '/players/20/results', views: 80 },
    { path: '/teams/watakyu/', views: 60 },
  ]);
});

// 2026-09-14 に実際に取り込んだ書き出し（探索・自由形式）の冒頭の形。期間は「# 開始日:」ではなく1行にまとまっている
const EXPLORATION_CSV = `# ----------------------------------------
# softeni
# 自由形式-自由形式 1
# 20260817-20260913
# ----------------------------------------

ページパス + クエリ文字列,表示回数
,54334,総計
/players/4898/results/,91
/players/4898/results/#google_vignette,4
/players/4898/results/?q=%E5%B0%BE%E7%94%B0,11
/players/4898/results/?q=%E3%81%8D,6
`;

test('探索（自由形式）の書き出しを読める（期間の1行・総計行）', () => {
  const parsed = parseGa4PagesCsv(EXPLORATION_CSV);
  assert.strictEqual(parsed.startDate, '2026-08-17');
  assert.strictEqual(parsed.endDate, '2026-09-13');
  assert.strictEqual(parsed.rows.length, 4);
  const { players } = rankPopularPages(parsed.rows);
  assert.deepStrictEqual(
    players.map((p) => [p.href, p.views]),
    [['/players/4898/results/', 91]],
  );
});

test('パス列と表示回数列が無ければ止める', () => {
  assert.throws(() => parseGa4PagesCsv('国/地域,ユーザー\n日本,100\n'));
});

test('数えるページと数えないページを分ける', () => {
  const slugs = new Map([['uematsu-toshiki', '19']]);
  const cases: Array<[string, string | null]> = [
    ['/players/19/results/', '/players/19/results/'],
    ['/players/19/results', '/players/19/results/'],
    ['/players/19/results/?utm_source=x', '/players/19/results/'],
    // 検索窓の入力と AdSense のビニエット広告は閲覧回数に数えない（2026-09-14 実物の CSV で確認）
    ['/players/19/results/?q=a', null],
    ['/players/19/results/?q=%E3%81%8D&utm_source=x', null],
    ['/players/19/results/#google_vignette', null],
    ['/players/uematsu-toshiki/', '/players/19/results/'],
    ['/players/unknown-slug/', null],
    ['/players/', null],
    ['/teams/', null],
    ['/teams/nssu/', '/teams/nssu/'],
    ['/teams/nssu/2025/girls/', '/teams/nssu/'],
    ['/highschool/boys/nara/takadashou/', '/highschool/boys/nara/takadashou/'],
    ['/highschool/boys/nara/', null],
    ['/highschool/tournaments/championship/', null],
    ['/secondaryschool/yamagata/nagaikita/', '/secondaryschool/yamagata/nagaikita/'],
    ['/secondaryschool/pathways/boys/', null],
    ['/primaryschool/aichi/smiley/', '/primaryschool/aichi/smiley/'],
    ['/st-league/2025/', null],
  ];
  for (const [input, expected] of cases) {
    assert.strictEqual(classifyPopularPath(input, slugs)?.href ?? null, expected, input);
  }
});

test('同じリンク先をまとめて多い順に並べる', () => {
  const { players, teams } = rankPopularPages(parseGa4PagesCsv(JA_CSV).rows, new Map([['uematsu-toshiki', '19']]));
  assert.deepStrictEqual(
    players.map((p) => [p.href, p.views]),
    [['/players/19/results/', 1600]],
  );
  assert.deepStrictEqual(
    teams.map((t) => [t.href, t.views]),
    [
      ['/highschool/boys/nara/takadashou/', 700],
      ['/teams/nttnishinihon/', 550],
      ['/secondaryschool/yamagata/nagaikita/', 40],
      ['/primaryschool/aichi/smiley/', 30],
      ['/highschool/girls/nara/takadashou/', 10],
    ],
  );
});

summary();
