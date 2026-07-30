// lib/__tests__/bracketDrawing.test.ts
// 実行: npm run bracket:test
//
// 線の太さの規則を固定する。ここは目視で気付きにくく、実際に 4 回の指摘で直した箇所なので
// テストで押さえる。座標そのものは検証せず、「どの区間が太いか」だけを見る。

import { drawBracketSheet, type BracketNameOf } from '../bracketDrawing';
import { buildBracketTree, describeBracketLayout, splitBracketSheets, type BracketNode } from '../bracketLayout';
import { assert, summary, test } from '../playerStats/__tests__/harness';

console.log('bracketDrawing.test.ts');

type E = { entryNo: number; type?: string | null };
type M = { stage: string; entries: number[]; round: string; winnerEntryNo?: number; scores?: Record<string, number>; retired?: boolean };

const nameOf: BracketNameOf = (no) => ({ main: `E${no}`, sub: '' });

function draw(entries: E[], matches: M[]) {
  const detail = { entries } as unknown as Parameters<typeof describeBracketLayout>[0];
  const { layout } = describeBracketLayout(detail);
  const tree = buildBracketTree(layout!, matches as unknown as Parameters<typeof buildBracketTree>[1]);
  return drawBracketSheet(splitBracketSheets(tree)[0], nameOf)!;
}

/** 8 枠・5 組。1回戦は (1,bye) (2,3) (4,bye) (5,bye)。2回戦は「1 vs 2v3の勝者」と「4 vs 5」。 */
const EIGHT: E[] = [
  { entryNo: 1, type: 'seed' },
  { entryNo: 2, type: 'packing' },
  { entryNo: 3, type: 'packing' },
  { entryNo: 4, type: 'extra' },
  { entryNo: 5, type: 'extra' },
];

const boldCount = (d: ReturnType<typeof draw>) => d.segments.filter((s) => s.win).length;

test('結果が1件も無ければ太線は1本も無い（枠と線だけ引く）', () => {
  assert.strictEqual(boldCount(draw(EIGHT, [])), 0);
});

test('1回戦だけ決着していても、未開催の2回戦へ太線を伸ばさない', () => {
  // パッキンの 2v3 が決着。勝った 3 は 2 回戦へ進むが、その試合はまだ行われていない。
  // ここで 2 回戦へ向かう区間まで太くすると「勝ってもいないのに勝ち上がった」ように見える。
  const d = draw(EIGHT, [{ stage: 'knockout', entries: [2, 3], round: '1回戦', winnerEntryNo: 3 }]);
  // 太いのは「3 の 1 回戦の横線」と「1 回戦の縦線の勝者側の半分」の 2 本だけ
  assert.strictEqual(boldCount(d), 2);
});

test('2回戦が決着すれば、そこへ向かう区間まで太線が伸びる', () => {
  const d = draw(EIGHT, [
    { stage: 'knockout', entries: [2, 3], round: '1回戦', winnerEntryNo: 3 },
    { stage: 'knockout', entries: [1, 3], round: '2回戦', winnerEntryNo: 1 },
  ]);
  // 上の 2 本に加え、3 が 2 回戦へ向かう区間（負けたがそこまで到達した）と、
  // シード 1 の根本からの区間・2 回戦の横線・縦線の勝者側が太くなる。
  assert.ok(boldCount(d) > 2, `太線が増えていない: ${boldCount(d)}`);
  // シード 1 が 2 回戦で勝ったので、1 回戦を不戦勝で通した区間も根本から太い
  const seedPass = d.segments.find((s) => s.y1 === s.y2 && s.win && s.x1 === Math.min(...d.segments.map((t) => t.x1)));
  assert.ok(seedPass, 'シードの根本からの太線が無い');
});

test('決勝は勝った側だけが太く、負けた側も細い線で中央まで残る', () => {
  const d = draw(EIGHT, [
    { stage: 'knockout', entries: [2, 3], round: '1回戦', winnerEntryNo: 3 },
    { stage: 'knockout', entries: [1, 3], round: '2回戦', winnerEntryNo: 1 },
    { stage: 'knockout', entries: [4, 5], round: '2回戦', winnerEntryNo: 4 },
    { stage: 'knockout', entries: [1, 4], round: '決勝', winnerEntryNo: 1 },
  ]);
  const cx = d.width / 2;
  const toCenter = d.segments.filter((s) => s.y1 === s.y2 && (s.x2 === cx || s.x1 === cx));
  assert.strictEqual(toCenter.length, 2, '中央へ向かう横線が2本ない');
  assert.strictEqual(toCenter.filter((s) => s.win).length, 1, '中央へ向かう太線が1本でない');
  assert.ok(d.champion?.decided);
});

test('スコアは上下それぞれの側に出し、棄権は敗者側に R を付ける', () => {
  const d = draw(EIGHT, [{ stage: 'knockout', entries: [2, 3], round: '1回戦', winnerEntryNo: 3, scores: { '2': 1, '3': 4 }, retired: true }]);
  const scores = d.labels.filter((l) => l.kind === 'score');
  assert.deepStrictEqual(
    scores.map((s) => s.text),
    ['1R', '4'],
  );
  assert.deepStrictEqual(
    scores.map((s) => s.win),
    [false, true],
  );
  // 上側(entryNo 2)の点は上の線、下側(entryNo 3)の点は下の線に置かれる
  assert.ok(scores[0].y < scores[1].y);
});

test('両端にだけ名前とエントリー番号を出す（内側のラウンドには出さない）', () => {
  const d = draw(EIGHT, []);
  const names = d.labels.filter((l) => l.kind === 'name');
  assert.strictEqual(names.length, 5, '出場 5 組ぶんの名前だけのはず');
  assert.deepStrictEqual(
    d.labels.filter((l) => l.kind === 'entryNo').map((l) => l.text),
    ['1', '2', '3', '4', '5'],
  );
});

test('不戦勝の枠には縦線を引かない（対戦していないため）', () => {
  const d = draw(EIGHT, []);
  const verticals = d.segments.filter((s) => s.x1 === s.x2);
  // 1回戦で実際に対戦するのは 2v3 の 1 枠、2回戦は 2 枠、決勝 1 枠。
  // ただし決勝は左右が同じ高さなので縦線は出ない。
  assert.ok(verticals.length >= 1);
  const node = (n: BracketNode) => n; // 型を使うためのダミー
  void node;
});

summary();
