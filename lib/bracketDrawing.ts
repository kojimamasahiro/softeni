// lib/bracketDrawing.ts
// ブラケットの 1 シートを「線と文字の座標」へ落とす。SVG 文字列や JSX は作らない。
//
// なぜ描画結果を素の配列で返すのか:
//   同じ絵を 2 か所で描く必要があるため。検討用モック（scripts/preview-bracket-sheets.ts、
//   SVG 文字列を組み立てる）と本番コンポーネント（React が <line> を描く）で、
//   座標計算だけを共有したい。文字列を返すと React 側で dangerouslySetInnerHTML が要る。
//
// 描き方の規約（2026-07-31 ユーザー決定。docs/wiki/public-pages.md にも記載）:
//   - 選手名は**左右の両端にだけ**置き、内側は線だけで繋ぐ。勝ち上がった選手を
//     各ラウンドに書き直さない。エントリー番号は名前のさらに外側。
//   - 勝ち上がりは線の濃さで示す。**縦線も勝者側の半分を太く**して、横→縦→横が
//     1 本に繋がるようにする。
//   - 太線は**根本から**引く。不戦勝で通した区間は、その先で勝った時点に遡って太くする。
//   - **負けた枠へ向かう区間も太くする**。太線は「どこまで到達したか」を示すので、
//     2 回戦以降で負けた選手の線が前の枠の中点で途切れて宙に浮かないようにする。
//     ただし**その試合が実際に行われている場合だけ**。未開催の試合へ太線を伸ばすと、
//     勝ってもいないのに勝ち上がったように見える。
//   - スコアは上下それぞれの獲得ゲーム数を、その側の横線の上に 1 つずつ。決勝は
//     中央の左右に振り分ける。棄権は敗者側に「R」。
//   - **決勝の横線だけは「勝った側のみ太く」**。他のラウンドと違い左右が同じ高さで
//     ぶつかるため、両方太くすると 1 本の長い太線になりどちらが勝ったか読めなくなる。
//     負けた側は細い線で中央まで残し、決勝まで来たことは示す。
//   - **左右は描く前に高さを揃える**（2026-09-01 修正）。leafYOf が不戦勝の空席ぶんの行を
//     確保しないため、不戦勝の位置が左右で違うと収束する高さがずれる（全1,002シート中
//     461＝46.0%・最大 24.2px）。convergedYOf で両側の収束点を先に測り、**低い方の側を
//     丸ごと下げてから描く**。上の「決勝は左右が同じ高さでぶつかる」という前提はこれで
//     常に成り立つので、決勝の線・スコア・優勝の丸に特別扱いは要らない。
//     揃えずに描こうとすると、決勝の横線が左右で別の高さになり、優勝の丸がどちらの線にも
//     接しない宙ぶらりんの点になる。段差を線で吸収する方法も試したが、準決勝を勝った太線が
//     元の高さで終わって突き出るため（縦線の終点が横線とずれる）採らなかった。
//   - ラウンド名の見出しは出さない（列幅に対して長すぎて隣と重なる。紙のドロー表にも無い）。

import type { BracketNode, BracketSheet } from './bracketLayout';

/** 図形の寸法。呼び出し側で上書きできる。 */
export const BRACKET_METRICS = {
  rowH: 19,
  /** エントリー番号の欄 */
  noW: 20,
  nameW: 138,
  /** 1 ラウンドぶんの横幅。スコア 1 桁が載る幅。 */
  colW: 24,
  margin: 16,
  /** 左右の代表がぶつかる中央のあき */
  centerGap: 54,
  /** 1 回戦の組の中、エントリーとその対戦相手との間に足す追加の縦あき */
  entryGap: 6,
  /** 1 回戦の組（2 エントリー）と次の組との間に足す追加の縦あき */
  matchGap: 10,
} as const;

export type BracketSegment = { x1: number; y1: number; x2: number; y2: number; win: boolean };

export type BracketLabel = {
  kind: 'entryNo' | 'name' | 'team' | 'score';
  x: number;
  y: number;
  text: string;
  anchor: 'start' | 'end' | 'middle';
  /** score のとき、その点を取ったのが勝者か。name のとき、その組が優勝したか。 */
  win?: boolean;
  /** name / entryNo のとき、リンクを張るための entryNo。 */
  entryNo?: number;
};

export type BracketDrawing = {
  width: number;
  height: number;
  segments: BracketSegment[];
  labels: BracketLabel[];
  /** 中央の決着点。`decided` が false なら未確定（白丸）。 */
  champion: { x: number; y: number; decided: boolean } | null;
};

export type BracketNameOf = (entryNo: number) => { main: string; sub: string } | null;

/**
 * 1 回戦の枠（BracketNode）を上から積み上げて、片側ぶんの葉（名前の行）の中心 y を組み立てる。
 *
 * 不戦勝（`present` が片方だけ true）の枠は、**居ない側の 1 行ぶんを確保しない**。
 * 以前は両側とも必ず 2 行ぶん確保していたため、シードの隣に実在しないエントリーの
 * スペースが空いて見えた（2026-08 ユーザー指摘）。左右は別々に積み上げるので、
 * 不戦勝の位置が左右で違うと対応する行の高さがずれることがあるが、線は各側の
 * 実際の y だけで引くため描画上の問題にはならない。
 */
function leafYOf(nodes: BracketNode[], rowH: number, entryGap: number, matchGap: number, top: number): { ys: number[]; bottom: number } {
  const ys: number[] = [];
  let cursor = top;
  nodes.forEach((n, i) => {
    if (i > 0) cursor += matchGap;
    const [p0, p1] = n.present;
    if (p0 && p1) {
      const y0 = cursor + rowH / 2;
      cursor += rowH + entryGap;
      const y1 = cursor + rowH / 2;
      cursor += rowH;
      ys.push(y0, y1);
    } else {
      // 片方（または両方）空席。実在する側だけに 1 行ぶんを使う。
      const y = cursor + rowH / 2;
      cursor += rowH;
      ys.push(y, y);
    }
  });
  return { ys, bottom: cursor };
}

/**
 * 上下それぞれの獲得ゲーム数。「4-2」と 1 つにまとめると常に勝者が左に来て
 * **どちらの組の点か読めない**ので、側ごとに返す。
 */
function scoresOf(n: BracketNode): { text: string; won: boolean }[] | null {
  if (n.winner == null || !n.match?.scores) return null;
  const scores = n.match.scores;
  const vals = n.entries.map((e) => (e == null ? null : scores[String(e)]));
  if (vals.some((v) => v == null)) return null;
  return n.entries.map((e, i) => ({
    text: `${vals[i]}${e !== n.winner && n.match?.retired ? 'R' : ''}`,
    won: e === n.winner,
  }));
}

/**
 * 片側が最後に 1 本へ収束する y を、描かずに求める。drawSide と同じ中点の漸化式。
 *
 * 左右で不戦勝の位置が違うと収束する高さがずれるので、描く前にこれで両側を測って
 * **低い方の側を丸ごと下げ、決勝が左右同じ高さでぶつかるように揃える**。
 * 揃えずに描くと決勝の横線が左右で別の高さになり、優勝の丸も片側の線にしか乗らない。
 */
function convergedYOf(columns: BracketNode[][], rowH: number, entryGap: number, matchGap: number, top: number): number | null {
  if (columns.length === 0) return null;
  let ys = leafYOf(columns[0] ?? [], rowH, entryGap, matchGap, top).ys;
  for (const nodes of columns) {
    const next: number[] = [];
    nodes.forEach((n, k) => {
      const ya = ys[2 * k];
      const yb = ys[2 * k + 1];
      const [pa, pb] = n.present;
      next.push(pa && pb ? (ya + yb) / 2 : pa ? ya : pb ? yb : (ya + yb) / 2);
    });
    ys = next;
  }
  return ys[0] ?? null;
}

/** 1 シートぶんの線と文字を組み立てる。 */
export function drawBracketSheet(sheet: BracketSheet, nameOf: BracketNameOf, metrics: typeof BRACKET_METRICS = BRACKET_METRICS): BracketDrawing | null {
  const { rowH, noW, nameW, colW, margin, centerGap, entryGap, matchGap } = metrics;
  const cols = sheet.left.length; // 中央を除いた片側のラウンド数
  const sideSlots = (sheet.left[0]?.length ?? 0) * 2;
  if (sideSlots === 0) return null;

  const width = (margin + noW + nameW + cols * colW) * 2 + centerGap;
  const top = margin;

  /** 左側のラウンド r の縦線 x。r=-1 は名前の右端。 */
  const xL = (r: number) => margin + noW + nameW + (r + 1) * colW;
  const xR = (r: number) => width - xL(r);

  const segments: BracketSegment[] = [];
  const labels: BracketLabel[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, win = false): number => segments.push({ x1, y1, x2, y2, win }) - 1;

  const drawSide = (columns: BracketNode[][], x: (r: number) => number, isLeft: boolean, sideTop: number) => {
    const anchor: 'start' | 'end' = isLeft ? 'end' : 'start';
    const leaf = leafYOf(columns[0] ?? [], rowH, entryGap, matchGap, sideTop);

    // 両端のエントリー番号と選手名
    (columns[0] ?? [])
      .flatMap((n) => n.entries)
      .forEach((no, i) => {
        if (no == null) return;
        const v = nameOf(no);
        if (!v) return;
        const y = leaf.ys[i];
        const tx = isLeft ? x(-1) - 5 : x(-1) + 5;
        labels.push({ kind: 'entryNo', x: isLeft ? margin : width - margin, y: y - 1, text: String(no), anchor: isLeft ? 'start' : 'end', entryNo: no });
        labels.push({ kind: 'name', x: tx, y: y - 1, text: v.main, anchor, entryNo: no });
        if (v.sub) labels.push({ kind: 'team', x: tx, y: y + 8, text: v.sub, anchor, entryNo: no });
      });

    let prevY = leaf.ys;
    /** 不戦勝で通しただけの区間。勝った時点で遡って太くする。 */
    let prevChain: number[][] = prevY.map(() => []);
    /** 直前の枠で勝って上がってきたか。負ける枠へ向かう区間も太くするために要る。 */
    let prevWon: boolean[] = prevY.map(() => false);

    columns.forEach((nodes, r) => {
      const nextY: number[] = [];
      const nextChain: number[][] = [];
      const nextWon: boolean[] = [];

      nodes.forEach((n, k) => {
        const ya = prevY[2 * k];
        const yb = prevY[2 * k + 1];
        const xPrev = x(r - 1);
        const xCur = x(r);
        const [pa, pb] = n.present;
        // 出ていく高さ: 対戦があれば中点、不戦勝なら居る側の高さのまま
        const yOut = pa && pb ? (ya + yb) / 2 : pa ? ya : pb ? yb : (ya + yb) / 2;
        nextY.push(yOut);

        const topWon = n.winner != null && n.winner === n.entries[0];
        const botWon = n.winner != null && n.winner === n.entries[1];

        // present（構造）で引くので、結果が未入力でも線は繋がる。
        //
        // 太くするのは「この枠に勝った側」と「勝って上がってきた側」。ただし後者は
        // **この枠の試合が実際に行われている場合だけ**（`n.winner != null`）。
        // まだ行われていない試合へ太線を伸ばすと、勝ってもいないのに勝ち上がったように
        // 見える（未開催の大会で 1 回戦の勝者の線が 2 回戦まで太く伸びていた）。
        const played = n.winner != null;
        const ia = pa ? line(xPrev, ya, xCur, ya, topWon || (played && prevWon[2 * k])) : -1;
        const ib = pb ? line(xPrev, yb, xCur, yb, botWon || (played && prevWon[2 * k + 1])) : -1;

        const sc = scoresOf(n);
        if (sc) {
          const sx = isLeft ? xCur - 3 : xCur + 3;
          [ya, yb].forEach((sy, i) => labels.push({ kind: 'score', x: sx, y: sy - 2.5, text: sc[i].text, anchor, win: sc[i].won }));
        }

        if (pa && pb) {
          // 縦線は細く全体を引き、勝者側の半分だけ太く上書きする
          line(xCur, ya, xCur, yb);
          if (topWon) line(xCur, ya, xCur, yOut, true);
          if (botWon) line(xCur, yb, xCur, yOut, true);
          if (topWon) prevChain[2 * k].forEach((i) => (segments[i].win = true));
          if (botWon) prevChain[2 * k + 1].forEach((i) => (segments[i].win = true));
          nextChain.push([]);
          nextWon.push(n.winner != null);
        } else {
          const from = pa ? prevChain[2 * k] : pb ? prevChain[2 * k + 1] : [];
          const here = pa ? ia : ib;
          nextChain.push(here >= 0 ? [...from, here] : [...from]);
          // 戦わずに通っただけ。ただし不戦勝の前に勝っていればその状態は引き継ぐ。
          nextWon.push(pa ? prevWon[2 * k] : pb ? prevWon[2 * k + 1] : false);
        }
      });

      prevY = nextY;
      prevChain = nextChain;
      prevWon = nextWon;
    });

    return { ys: prevY, chains: prevChain, wons: prevWon, leafBottom: leaf.bottom };
  };

  // 描く前に左右が収束する高さを測り、低い方を丸ごと下げて揃える。
  // こうしないと決勝の横線が左右で別の高さになる（全1,002シート中461＝46.0%・最大24.2px）。
  // 揃えてしまえば「決勝は左右が同じ高さでぶつかる」という以下の描き方の前提が常に成り立ち、
  // 決勝の線・スコア・優勝の丸に特別扱いが要らなくなる。
  const lyPre = convergedYOf(sheet.left, rowH, entryGap, matchGap, top);
  const ryPre = convergedYOf(sheet.right, rowH, entryGap, matchGap, top);
  const gap = lyPre != null && ryPre != null ? lyPre - ryPre : 0;
  const leftSide = drawSide(sheet.left, xL, true, top + Math.max(0, -gap));
  const rightSide = drawSide(sheet.right, xR, false, top + Math.max(0, gap));
  const height = Math.max(leftSide.leafBottom, rightSide.leafBottom) + margin;

  let champion: BracketDrawing['champion'] = null;
  const c = sheet.center[0];
  if (c) {
    const cx = width / 2;
    const ly = leftSide.ys[0] ?? top + rowH / 2;
    const ry = rightSide.ys[0] ?? top + rowH / 2;
    const [pa, pb] = c.present;
    const leftWon = c.winner != null && c.winner === c.entries[0];
    const rightWon = c.winner != null && c.winner === c.entries[1];
    // 上で左右を揃えてあるので、両方居れば ly === ry。
    const yOut = pa && pb ? (ly + ry) / 2 : pa ? ly : ry;

    // 決勝の横線は**両側とも中央まで引くが、太いのは勝った側だけ**（2026-07-31 ユーザー決定）。
    //
    // ここだけ他のラウンドと扱いが違う。他は「勝ってその枠へ来た側」も太くするが、
    // 決勝は左右の代表が同じ高さでぶつかるため、両方を太くすると 1 本の長い太線になり、
    // 縦線も無いので**どちらが勝ったか読めなくなる**。負けた側は細い線で中央まで残し、
    // 「決勝まで来た」ことは示しつつ、太線は優勝者の 1 本だけが通るようにする。
    if (pa) line(xL(cols - 1), ly, cx, ly, leftWon);
    if (pb) line(xR(cols - 1), ry, cx, ry, rightWon);

    if (leftWon) (leftSide.chains[0] ?? []).forEach((i) => (segments[i].win = true));
    if (rightWon) (rightSide.chains[0] ?? []).forEach((i) => (segments[i].win = true));

    // 決勝は左右が同じ高さの 1 本になるので、スコアは中央の左右へ振り分ける
    const sc = scoresOf(c);
    if (sc) {
      labels.push({ kind: 'score', x: cx - 7, y: ly - 4, text: sc[0].text, anchor: 'end', win: sc[0].won });
      labels.push({ kind: 'score', x: cx + 7, y: ry - 4, text: sc[1].text, anchor: 'start', win: sc[1].won });
    }
    champion = { x: cx, y: yOut, decided: c.winner != null };
  }

  // 細線が先、太線が後（太線が上に来るように）
  segments.sort((a, b) => Number(a.win) - Number(b.win));

  return { width, height, segments, labels, champion };
}
