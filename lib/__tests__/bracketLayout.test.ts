// lib/__tests__/bracketLayout.test.ts
// 実行: npm run bracket:test
//
// ブラケット復元（entries[].type → 席順）の単体テスト。
// 実データとの突き合わせは scripts/verify-bracket-layout.mjs が担当する。ここでは
// 席の積み方・整合性検出・勝ち上がり経路という「小さく壊れやすい規則」だけを固定する。

import {
  advancementPath,
  buildBracketTree,
  describeBracketLayout,
  meetingRoundIndex,
  opponentSlotRange,
  roundLabelOf,
  splitBracketSheets,
} from '../bracketLayout';
import { packTournamentDetailData, unpackTournamentDetailData } from '../packedPageData';
import { assert, summary, test } from '../playerStats/__tests__/harness';

// 入力ツールと共有する UMD モジュール（tools/shared/）。型定義は無いので require で読む。
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildKnockoutDraw } = require('../../tools/shared/knockout-draw.js');

console.log('bracketLayout.test.ts');

type E = { entryNo: number; type?: string | null };
const detail = (entries: E[]) => ({ entries }) as unknown as Parameters<typeof describeBracketLayout>[0];

/** 4 枠: 1=seed(bye) / 2,3=packing。1 回戦は 2v3、2 回戦は 1 vs その勝者。 */
const FOUR: E[] = [
  { entryNo: 1, type: 'seed' },
  { entryNo: 2, type: 'packing' },
  { entryNo: 3, type: 'packing' },
];

test('seed/extra は bye を1つ挟み、packing は2組で1試合ぶんの席を使う', () => {
  const { layout, failure } = describeBracketLayout(detail(FOUR));
  assert.strictEqual(failure, null);
  assert.strictEqual(layout!.size, 4);
  assert.strictEqual(layout!.totalRounds, 2);
  assert.strictEqual(layout!.slotOf.get(1), 0); // seed は 0 番、1 番は bye
  assert.strictEqual(layout!.slotOf.get(2), 2);
  assert.strictEqual(layout!.slotOf.get(3), 3);
});

// ---- knockoutDraw（予選リーグ→決勝T。席は「組」に属する） ----
// 詳細は docs/adr/ADR-015-knockout-draw-by-group.md。

type Slot = { group: string; rank: number } | null;
const drawDetail = (slots: Slot[], standings: { entryNo: number; group: string; rank: number }[]) =>
  ({
    entries: standings.map((s) => ({ entryNo: s.entryNo, type: null })),
    knockoutDraw: { slots },
    results: standings.map((s) => ({ entryNo: s.entryNo, roundrobin: { group: s.group, rank: s.rank } })),
  }) as unknown as Parameters<typeof describeBracketLayout>[0];

/** A組1位 / 空席 / B組2位 / C組1位 の 4 枠。「1位 vs 別組2位」のクロス配置。 */
const DRAW: Slot[] = [{ group: 'A', rank: 1 }, null, { group: 'B', rank: 2 }, { group: 'C', rank: 1 }];
const STANDINGS = [
  { entryNo: 7, group: 'A', rank: 1 },
  { entryNo: 3, group: 'B', rank: 2 },
  { entryNo: 5, group: 'C', rank: 1 },
];

test('knockoutDraw があれば (組, 組内順位) を entryNo に解決して席順にする', () => {
  const { layout, failure } = describeBracketLayout(drawDetail(DRAW, STANDINGS));
  assert.strictEqual(failure, null);
  assert.strictEqual(layout!.size, 4);
  assert.strictEqual(layout!.slotOf.get(7), 0); // A組1位
  assert.strictEqual(layout!.slotOf.get(3), 2); // B組2位
  assert.strictEqual(layout!.slotOf.get(5), 3); // C組1位
  assert.strictEqual(meetingRoundIndex(layout!, 3, 5), 0); // 隣接＝1回戦
  assert.strictEqual(meetingRoundIndex(layout!, 7, 3), 1); // 空席側の A組1位 とは2回戦
});

test('knockoutDraw は entryNo 順の復元より優先される', () => {
  // entryNo 順（3,5,7）に積むと 3v5 が1回戦・7 が seed になるが、ドローでは
  // 7 が単独の山。席が「組」に属することを取り違えないための固定。
  const { layout } = describeBracketLayout(drawDetail(DRAW, STANDINGS));
  assert.strictEqual(layout!.slotOf.get(7), 0);
  assert.notStrictEqual(meetingRoundIndex(layout!, 3, 7), 0);
});

test('予選リーグが終わっていなければ knockoutDraw があっても復元しない', () => {
  // 席は決まっているが誰が入るか未確定。空の表を描かないよう理由付きで諦める。
  const { layout, failure } = describeBracketLayout(drawDetail(DRAW, []));
  assert.strictEqual(layout, null);
  assert.strictEqual(failure, 'draw-unresolved');
});

test('knockoutDraw の枠数が2冪でなければ復元しない', () => {
  const { layout, failure } = describeBracketLayout(drawDetail([{ group: 'A', rank: 1 }, null, { group: 'B', rank: 2 }], STANDINGS));
  assert.strictEqual(layout, null);
  assert.strictEqual(failure, 'draw-slot-parity');
});

test('knockoutDraw はページデータの pack/unpack を通っても席順を保つ', () => {
  // ページに渡るのは packed 形式なので、そこに載せ忘れると本番だけ復元できなくなる
  // （packed はホワイトリスト方式で、知らないキーは黙って落ちる）。
  const source = { participants: [], matches: [], ...(drawDetail(DRAW, STANDINGS) as object) } as unknown as Parameters<typeof packTournamentDetailData>[0];
  const roundTripped = unpackTournamentDetailData(packTournamentDetailData(source)) as unknown as Parameters<typeof describeBracketLayout>[0];

  const { layout, failure } = describeBracketLayout(roundTripped);
  assert.strictEqual(failure, null);
  assert.strictEqual(layout!.size, 4);
  assert.strictEqual(layout!.slotOf.get(7), 0);
  assert.strictEqual(layout!.slotOf.get(3), 2);
  assert.strictEqual(layout!.slotOf.get(5), 3);
});

test('matches → knockoutDraw → 席順 が一周する（入力ツールと同じ経路）', () => {
  // tools/shared/knockout-draw.js は入力ツール（normalize-core.js）と
  // scripts/generate-knockout-draw.mjs が共有する。ここで作ったドローを
  // describeBracketLayout がそのまま読めることを固定しておく。
  //
  // 4枠の決勝T: [A1, 空席] [B2, C1] → 準決勝で A1 vs (B2/C1 の勝者)。
  const matches = [
    { entries: [3, 5], round: '準決勝', stage: 'knockout', winnerEntryNo: 5, matchId: 'm1', nextMatchId: 'm2' },
    { entries: [7, 5], round: '決勝', stage: 'knockout', winnerEntryNo: 7, matchId: 'm2', nextMatchId: null },
    { entries: [7, 8], round: null, stage: 'roundrobin', winnerEntryNo: 7, matchId: 'r1', nextMatchId: null },
  ];
  const results = STANDINGS.map((s) => ({ entryNo: s.entryNo, roundrobin: { group: s.group, rank: s.rank } }));

  const built = buildKnockoutDraw({ matches, results }) as { draw?: { slots: unknown[] }; error?: string; skip?: string };
  assert.strictEqual(built.error, undefined);
  assert.strictEqual(built.draw!.slots.length, 4);

  const { layout, failure } = describeBracketLayout({
    entries: STANDINGS.map((s) => ({ entryNo: s.entryNo, type: null })),
    knockoutDraw: built.draw,
    results,
  } as unknown as Parameters<typeof describeBracketLayout>[0]);
  assert.strictEqual(failure, null);
  assert.strictEqual(meetingRoundIndex(layout!, 3, 5), 0); // 準決勝を戦った2組は隣接
  assert.strictEqual(meetingRoundIndex(layout!, 7, 5), 1); // 決勝で当たる
});

test('決勝1試合だけの大会にはドローを作らない（席順という概念が無い）', () => {
  // 予選リーグ→準決勝リーグ→優勝決定戦のような形式。2枠のドローは情報を持たない。
  // 実例: zennihon-university-ouza/2026/team-none-boys
  const built = buildKnockoutDraw({
    matches: [
      { entries: [1, 16], round: '優勝決定戦', stage: 'knockout', winnerEntryNo: 1, matchId: 'm1', nextMatchId: null },
      { entries: [1, 2], round: null, stage: 'roundrobin', winnerEntryNo: 1, matchId: 'r1', nextMatchId: null },
    ],
    results: [],
  }) as { draw?: unknown; skip?: string };
  assert.strictEqual(built.draw, undefined);
  assert.ok(typeof built.skip === 'string');
});

test('meetingRoundIndex は合流ラウンドを返す（0=1回戦）', () => {
  const { layout } = describeBracketLayout(detail(FOUR));
  assert.strictEqual(meetingRoundIndex(layout!, 2, 3), 0); // 1回戦で対戦
  assert.strictEqual(meetingRoundIndex(layout!, 1, 2), 1); // seed とは2回戦
  assert.strictEqual(meetingRoundIndex(layout!, 1, 99), null); // 居ない組
});

test('全件 packing かつ出場数が2冪なら bye 無しドローとして復元する', () => {
  const { layout, failure } = describeBracketLayout(detail([1, 2, 3, 4].map((entryNo) => ({ entryNo, type: 'packing' }))));
  assert.strictEqual(failure, null);
  assert.strictEqual(layout!.size, 4);
  assert.strictEqual(meetingRoundIndex(layout!, 1, 2), 0); // 隣接＝1回戦
  assert.strictEqual(meetingRoundIndex(layout!, 1, 4), 1);
});

test('全件 packing でも出場数が2冪でなければ復元しない（予選リーグ→決勝T）', () => {
  // リーグ参加者には type が付かず全件 packing になる。決勝Tの枠はリーグ順位で決まり
  // entryNo のドロー順とは無関係なので復元してはいけない。padding 込みだと 2 冪に
  // なってしまうため、出場数そのものを見る必要がある。
  const { layout, failure } = describeBracketLayout(detail([1, 2, 3].map((entryNo) => ({ entryNo, type: 'packing' }))));
  assert.strictEqual(layout, null);
  assert.strictEqual(failure, 'no-seed-info');
});

test('type が null なら復元しない（シード未入力の古いデータ）', () => {
  const { layout, failure } = describeBracketLayout(
    detail([
      { entryNo: 1, type: null },
      { entryNo: 2, type: 'packing' },
    ]),
  );
  assert.strictEqual(layout, null);
  assert.strictEqual(failure, 'no-seed-info');
});

test('packing の並びが奇数個なら復元を諦める（黙って2冪に詰めない）', () => {
  // packing が 3 組。1 組あぶれるので席が 1 つずれ、以降の山が全部狂う。
  const { layout, failure } = describeBracketLayout(
    detail([
      { entryNo: 1, type: 'seed' },
      { entryNo: 2, type: 'packing' },
      { entryNo: 3, type: 'packing' },
      { entryNo: 4, type: 'packing' },
    ]),
  );
  assert.strictEqual(layout, null);
  assert.strictEqual(failure, 'slot-parity');
});

test('entries が空なら no-entries', () => {
  assert.strictEqual(describeBracketLayout(detail([])).failure, 'no-entries');
});

test('opponentSlotRange: 1回戦は幅1、決勝は全体の半分', () => {
  assert.deepStrictEqual(opponentSlotRange(0, 0), { start: 1, end: 2 });
  assert.deepStrictEqual(opponentSlotRange(1, 0), { start: 0, end: 1 });
  assert.deepStrictEqual(opponentSlotRange(0, 1), { start: 2, end: 4 });
  assert.deepStrictEqual(opponentSlotRange(5, 2), { start: 0, end: 4 });
});

test('advancementPath: 各ラウンドで当たりうる相手を1回戦から順に返す', () => {
  const { layout } = describeBracketLayout(detail(FOUR));
  // seed(1) は 1 回戦が bye なので相手なし、2 回戦で 2 か 3 のどちらか。
  assert.deepStrictEqual(advancementPath(layout!, 1), [
    { roundIndex: 0, opponents: [] },
    { roundIndex: 1, opponents: [2, 3] },
  ]);
  // packing(2) は 1 回戦で 3 と確定、勝てば 2 回戦で 1。
  assert.deepStrictEqual(advancementPath(layout!, 2), [
    { roundIndex: 0, opponents: [3] },
    { roundIndex: 1, opponents: [1] },
  ]);
  assert.strictEqual(advancementPath(layout!, 99), null);
});

test('roundLabelOf は決勝から逆算して名前を付ける', () => {
  // 全9ラウンド（512枠）の場合: index 8=決勝, 7=準決勝, 6=準々決勝, 5以下は「N回戦」
  assert.strictEqual(roundLabelOf(8, 9), '決勝');
  assert.strictEqual(roundLabelOf(7, 9), '準決勝');
  assert.strictEqual(roundLabelOf(6, 9), '準々決勝');
  assert.strictEqual(roundLabelOf(5, 9), '6回戦');
  assert.strictEqual(roundLabelOf(0, 9), '1回戦');
  assert.strictEqual(roundLabelOf(1, 2), '決勝');
});

// ---- buildBracketTree ----

/**
 * 8 枠・5 組。1 回戦は (1,bye) (2,3) (4,bye) (5,bye) の 4 枠。
 * 2 回戦は「1 vs 2v3の勝者」と「4 vs 5」。後者は結果が無くても対戦が確定する。
 */
const EIGHT: E[] = [
  { entryNo: 1, type: 'seed' },
  { entryNo: 2, type: 'packing' },
  { entryNo: 3, type: 'packing' },
  { entryNo: 4, type: 'extra' },
  { entryNo: 5, type: 'extra' },
];
const treeOf = (entries: E[], matches: unknown[] = []) => {
  const { layout } = describeBracketLayout(detail(entries));
  return buildBracketTree(layout!, matches as Parameters<typeof buildBracketTree>[1]);
};

test('結果が1件も無くても全ラウンドの枠が揃う（線を繋ぐのが目的）', () => {
  const t = treeOf(EIGHT);
  assert.strictEqual(t.size, 8);
  assert.deepStrictEqual(
    t.rounds.map((r) => r.length),
    [4, 2, 1],
  );
});

test('1回戦は席順から確定し、空席の相手は bye になる', () => {
  const t = treeOf(EIGHT);
  assert.deepStrictEqual(t.rounds[0][0].entries, [1, null]); // seed は不戦勝
  assert.strictEqual(t.rounds[0][0].bye, true);
  assert.deepStrictEqual(t.rounds[0][1].entries, [2, 3]); // packing 同士
  assert.strictEqual(t.rounds[0][1].bye, false);
});

test('山に1組しか居なければ、試合をせずに次ラウンドへ上がる', () => {
  const t = treeOf(EIGHT);
  // 2回戦の第0枠: 上は seed(1)、下は 2v3 の勝者待ち
  assert.deepStrictEqual(t.rounds[1][0].entries, [1, null]);
  // 4 と 5 はどちらも1回戦不戦勝なので、2回戦で対戦することが結果無しで確定する
  assert.deepStrictEqual(t.rounds[1][1].entries, [4, 5]);
});

test('結果待ちの枠を bye と混同しない（シードが勝手に勝ち上がらない）', () => {
  const t = treeOf(EIGHT);
  const n = t.rounds[1][0];
  // 片側 null だが相手は「まだ決まっていない」だけ。bye ではないので上へは進めない。
  assert.strictEqual(n.bye, false);
  assert.strictEqual(t.rounds[2][0].entries[0], null);
});

test('試合結果があれば枠が埋まり、勝者が次ラウンドへ進む', () => {
  const t = treeOf(EIGHT, [{ stage: 'knockout', entries: [2, 3], round: '1回戦', winnerEntryNo: 3 }]);
  assert.strictEqual(t.rounds[0][1].winner, 3);
  assert.deepStrictEqual(t.rounds[1][0].entries, [1, 3]); // seed vs 1回戦の勝者
});

test('present は結果に関係なく「その山に誰か居るか」を示す（線を引く判断に使う）', () => {
  const t = treeOf(EIGHT); // 結果は 1 件も無い
  // 1回戦: seed(1) の相手側は空席
  assert.deepStrictEqual(t.rounds[0][0].present, [true, false]);
  assert.deepStrictEqual(t.rounds[0][1].present, [true, true]); // 2 と 3
  // 2回戦: 上は seed の山、下は 2v3 の山。どちらにも人が居るので両方 true。
  // entries は [1, null]（勝者未定）だが、**線は両側に引かなければならない**。
  assert.deepStrictEqual(t.rounds[1][0].present, [true, true]);
  assert.deepStrictEqual(t.rounds[1][0].entries, [1, null]);
  // 決勝も同様に、結果ゼロでも両側に人が居る
  assert.deepStrictEqual(t.rounds[2][0].present, [true, true]);
});

test('present は空席の山を false にする（不戦勝の枠）', () => {
  // 3 組・4 枠。entryNo 3 の相手側スロットは誰も居ない。
  const t = treeOf([
    { entryNo: 1, type: 'packing' },
    { entryNo: 2, type: 'packing' },
    { entryNo: 3, type: 'seed' },
  ]);
  assert.deepStrictEqual(t.rounds[0][1].present, [true, false]);
  assert.strictEqual(t.rounds[0][1].bye, true);
});

// ---- splitBracketSheets ----

/** entryNo 1..n を全て packing にした 2 冪ドロー（bye 無し）。 */
const flat = (n: number): E[] => Array.from({ length: n }, (_, i) => ({ entryNo: i + 1, type: 'packing' }));
const sheetsOf = (n: number) => {
  const { layout } = describeBracketLayout(detail(flat(n)));
  return { tree: buildBracketTree(layout!, []), sheets: splitBracketSheets(buildBracketTree(layout!, [])) };
};

test('64枠以下は大会全体が1枚に収まる', () => {
  for (const n of [16, 32, 64]) {
    const { sheets } = sheetsOf(n);
    assert.strictEqual(sheets.length, 1, `${n}枠`);
    assert.strictEqual(sheets[0].label, '全体');
    assert.strictEqual(sheets[0].center.length, 1); // 中央が決勝
  }
});

test('512枠は「山8枚＋ベスト64」の9枚になる', () => {
  const { sheets } = sheetsOf(512);
  assert.strictEqual(sheets.length, 9);
  assert.strictEqual(sheets.filter((s) => s.kind === 'qualifying').length, 8);
  assert.strictEqual(sheets[8].label, 'ベスト64');
});

test('山シートの名前は「第N山」ではなく entryNo の範囲', () => {
  // 読者は自分の応援する組の番号で山を探すので、番号のほうが直接的。
  // bye 無しの 512 組なら 64 組ずつきれいに切れる。
  const { sheets } = sheetsOf(512);
  assert.strictEqual(sheets[0].label, '1〜64');
  assert.strictEqual(sheets[1].label, '65〜128');
  assert.deepStrictEqual(sheets[0].entryNoRange, [1, 64]);
});

test('山シートは1回戦から「その山の代表が決まる枠」までを持つ', () => {
  const { sheets } = sheetsOf(512);
  const yama = sheets[0];
  assert.deepStrictEqual(yama.roundRange, [0, 5]); // 1回戦〜6回戦
  assert.strictEqual(yama.center.length, 1); // 中央＝ベスト8 を決める枠
  assert.strictEqual(yama.center[0].matchIndex, 0);
  assert.strictEqual(sheets[7].center[0].matchIndex, 7); // 第8山は8番目の枠
});

test('ベスト64シートは決勝までを持ち、山シートと後半が重複する', () => {
  const { sheets } = sheetsOf(512);
  const best64 = sheets[8];
  assert.deepStrictEqual(best64.roundRange, [3, 8]); // 4回戦〜決勝
  assert.strictEqual(best64.center[0].roundIndex, 8); // 中央＝決勝
  // 山シート(0..5) と 4〜6回戦が重なる。重複は承知の上の仕様。
  assert.ok(best64.roundRange[0] <= sheets[0].roundRange[1]);
});

test('decided は勝敗が決まった枠の数（ベスト64シートの出し分けに使う）', () => {
  const { layout } = describeBracketLayout(detail(flat(4)));
  const noResult = splitBracketSheets(buildBracketTree(layout!, []));
  assert.strictEqual(noResult[0].decided, 0);

  const withResult = splitBracketSheets(
    buildBracketTree(layout!, [{ stage: 'knockout', entries: [1, 2], round: '1回戦', winnerEntryNo: 1 }] as Parameters<typeof buildBracketTree>[1]),
  );
  assert.strictEqual(withResult[0].decided, 1);
});

test('どのシートも左右が対称で、枠の合計は63になる', () => {
  const { sheets } = sheetsOf(512);
  for (const s of sheets) {
    assert.deepStrictEqual(
      s.left.map((c) => c.length),
      s.right.map((c) => c.length),
      s.label,
    );
    const total = s.left.flat().length + s.right.flat().length + s.center.length;
    assert.strictEqual(total, 63, s.label);
  }
});

summary();
