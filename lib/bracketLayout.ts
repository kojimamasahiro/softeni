// lib/bracketLayout.ts
// ドロー（組み合わせ）から「2 つのエントリーが最短で何回戦に当たるか」を求める。
//
// なぜ matches ではなくエントリーから復元するのか:
//   開催前のデータには 2 回戦以降の試合レコードが無く、`nextMatchId` も付かない
//   （実測: インターハイ 2026 は全 0 件／完了済みの 2025 は 314/315 件）。
//   よって matches のツリーを辿る方法では大会前に山の位置が分からない。
//
// 復元の根拠（2026-07-26 実測）:
//   - `entryNo` はドロー順で、1 回戦は必ず隣接同士（[2,3] [11,12] …）で組まれる。
//   - `entries[].type` が `seed` / `extra` の枠は 1 回戦が不戦勝なので、
//     スロット列に bye を 1 つ挟む。`packing` は 2 つで 1 試合。
//   - こうして組んだブラケットで求めた対戦ラウンドは、
//     **インターハイ 2026 男子ダブルスの実データ 128 試合と 100% 一致**した。
//
// 限界:
//   `type` が入っていない大会（入力ツールのシード対応が 2026-07-26 のため、それ以前の
//   データには `null` が多い）では復元できない。その場合は null を返す（graceful）。
//
//   また `type` の入力ミスで `packing` の並びが奇数個になると、そこから先の席が 1 つずつ
//   ずれて**大会の後半が丸ごと誤る**。2026-07-31 の全データ検証で 11 大会 733 試合が
//   不一致になり、うち 10 大会は「パディング前のスロット数が 2 冪でない」ことで機械的に
//   検出できた。誤ったラウンド名を断定口調で出す方が無害な欠落より悪いので、検出したら
//   復元を諦めて null を返す（`describeBracketLayout` で理由を取れる）。
//   入力側の検出は tools/shared/validate-entries.js の `bracket-slot-parity` ルール。
//   残る 1 大会は隣接ペアの崩れ（枠数は 2 冪のまま）でデータ誤りだった。修正後は
//   **復元適用 173 大会・18,901 試合で不一致 0 件**（`npm run bracket:verify`）。

// 相対 import なのは、ts-node（scripts/ の検証・テスト）が `@/` エイリアスを解決しないため。
// lib 内の他モジュール（newsArticle.ts 等）も相対で揃えている。
//
// **型だけを import すること**。このモジュールはブラウザ（TournamentBracket）からも
// 読まれるので、`fs` を使う `readYearDetail` を値として持ち込むとクライアントバンドルが
// 壊れる。ファイル読み込みを伴う `getBracketLayout` は bracketLayout.server.ts にある。
import type { RawDetail, RawMatch } from './tournamentRecords';

/** ラウンド index（0 始まり）→ 表示名。0=1回戦。 */
const ROUND_LABELS = ['1回戦', '2回戦', '3回戦', '4回戦', '5回戦', '6回戦', '7回戦', '準々決勝', '準決勝', '決勝'];

/**
 * ラウンド index を表示名にする。
 * 決勝から数えて 3 つ（準々決勝・準決勝・決勝）は名前付きなので、総ラウンド数から逆算する。
 */
export function roundLabelOf(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return '決勝';
  if (fromEnd === 1) return '準決勝';
  if (fromEnd === 2) return '準々決勝';
  return ROUND_LABELS[roundIndex] ?? `${roundIndex + 1}回戦`;
}

export type BracketLayout = {
  /** entryNo → ブラケットのスロット位置（0 始まり） */
  slotOf: Map<number, number>;
  /** スロット総数（2 の冪） */
  size: number;
  /** 総ラウンド数（log2(size)） */
  totalRounds: number;
};

/** 復元できなかった理由。UI には出さず、検証スクリプトと開発時の診断に使う。 */
export type BracketLayoutFailure =
  /** entries が空 */
  | 'no-entries'
  /** seed / extra が 1 件も無い＝シード未入力の大会 */
  | 'no-seed-info'
  /** packing の並びが奇数個＝type の入力ミス。席が 1 つずれるので復元を諦める */
  | 'slot-parity';

export type BracketLayoutResult = { layout: BracketLayout; failure: null } | { layout: null; failure: BracketLayoutFailure };

/**
 * `entries`（entryNo 昇順＝ドロー順）と `type` から席順を復元し、失敗時は理由も返す。
 * 表示側は理由を使わないので、通常は `buildBracketLayout` を使えばよい。
 */
export function describeBracketLayout(detail: RawDetail | null): BracketLayoutResult {
  const entries = detail?.entries ?? [];
  if (entries.length === 0) return { layout: null, failure: 'no-entries' };
  const typed = entries as Array<{ entryNo: number; type?: string | null }>;
  // seed / extra が 1 件も無い場合、次の 2 通りを区別する必要がある。
  //   (a) 出場数がちょうど 2 冪で bye が 1 つも要らないドロー（全員が 1 回戦を戦う）。
  //       これは正しく「seed も extra も無い」のであって、復元できる。実測 36 大会・
  //       1,670 試合が一致（例: 地区大会の団体戦 16 校）。
  //   (b) シード未入力の古いデータ（`type` が null）。山の位置が分からないので諦める。
  // 条件は「全件が明示的に `packing`」かつ「出場数がちょうど 2 冪」。
  //
  // 出場数の 2 冪チェックが必須なのは、**予選リーグ→決勝トーナメント**の大会が
  // 全件 `packing` になるため（リーグ参加者に `calculateEntryType` は type を付けない）。
  // その決勝 T の枠はリーグの順位で決まり entryNo のドロー順とは無関係なので、復元しては
  // いけない。実例: zennihon-senior/2025/doubles-over80-girls は 31 組・全件 packing で、
  // 素朴に組むと padding 込みで 32 枠＝2 冪になり**パリティ検査をすり抜けて誤復元する**。
  // 出場数そのもの（31）を見れば 2 冪でないと分かる。
  if (!typed.some((e) => e.type === 'seed' || e.type === 'extra')) {
    const n = typed.length;
    const byeless = typed.every((e) => e.type === 'packing') && (n & (n - 1)) === 0;
    if (!byeless) return { layout: null, failure: 'no-seed-info' };
  }

  const byNo = new Map(typed.map((e) => [e.entryNo, e.type ?? null]));
  const nos = [...byNo.keys()].sort((a, b) => a - b);

  const slots: (number | null)[] = [];
  for (let i = 0; i < nos.length; ) {
    const no = nos[i];
    const t = byNo.get(no);
    if (t === 'seed' || t === 'extra') {
      // 1 回戦不戦勝: 本人＋bye で 1 試合ぶんの席を使う
      slots.push(no, null);
      i += 1;
    } else {
      // packing: 隣同士で 1 試合
      slots.push(no, nos[i + 1] ?? null);
      i += 2;
    }
  }

  // 健全なドローなら、この時点でスロット数はちょうど 2 の冪になる（全 entries が
  // 過不足なく 1 回戦 256 試合＝512 枠に収まる）。2 冪でないのは `type` の入力ミスで
  // packing の並びが奇数個になった証拠で、そこから先の席が全部ずれている。
  // ここで黙って 2 冪までパディングすると、ずれたまま「◯回戦で当たる」を断定してしまう。
  const size = slots.length;
  if (size === 0 || (size & (size - 1)) !== 0) return { layout: null, failure: 'slot-parity' };

  const slotOf = new Map<number, number>();
  slots.forEach((no, idx) => {
    if (no != null) slotOf.set(no, idx);
  });
  return { layout: { slotOf, size, totalRounds: Math.log2(size) }, failure: null };
}

/**
 * `entries`（entryNo 昇順＝ドロー順）と `type` からブラケットの席順を復元する。
 * 復元できない場合（シード未入力・`type` の入力ミス）は null。
 */
export function buildBracketLayout(detail: RawDetail | null): BracketLayout | null {
  return describeBracketLayout(detail).layout;
}

/**
 * 2 つのエントリーが**最短で**当たるラウンド index（0=1回戦）。
 * どちらかがブラケットに無ければ null。
 *
 * 「最短で」なのは、両者が全部勝ち上がった場合の合流地点だから。実際には途中で
 * 負ければ当たらない。表示では「◯回戦で対戦の可能性」ではなく事実として扱うこと。
 */
export function meetingRoundIndex(layout: BracketLayout, a: number, b: number): number | null {
  const p = layout.slotOf.get(a);
  const q = layout.slotOf.get(b);
  if (p == null || q == null || p === q) return null;
  for (let k = 1; k <= layout.totalRounds; k++) {
    if (p >> k === q >> k) return k - 1;
  }
  return null;
}

/**
 * ラウンド index `r` で `slot` の相手になりうる「山」のスロット範囲。
 *
 * r 回戦に進むには自分の側の 2^r 枠を勝ち抜く必要があり、相手はその隣の 2^r 枠から来る。
 * 隣の山は「上位ビットが同じで r ビット目だけ反転」なので `((slot >> r) ^ 1) << r` から幅 2^r。
 * r=0 なら幅 1（＝1 回戦の相手は 1 組に確定）、最終ラウンドなら幅は全体の半分。
 */
export function opponentSlotRange(slot: number, roundIndex: number): { start: number; end: number } {
  const width = 1 << roundIndex;
  const start = ((slot >> roundIndex) ^ 1) << roundIndex;
  return { start, end: start + width };
}

/**
 * `entryNo` が各ラウンドで当たりうる相手の一覧を、1 回戦から決勝まで返す。
 *
 * これが「仮定の勝ち上がり」の基本操作。トーナメント表の本来の価値は
 * **結果が出る前に「勝ったら次は誰か」を辿れる**ことだが、`matches` には
 * 開催前は 1 回戦しか無いのでツリーを辿る方法では出せない。席順から出す。
 *
 * 各要素の `opponents` は「そのラウンドまで全部勝った場合に当たりうる相手」で、
 * 相手側の山にいる全エントリー。実際に当たるのは 1 組だけなので、UI では
 * 断定せず候補として見せること（1 回戦だけは必ず 1 組＝確定）。
 */
export function advancementPath(layout: BracketLayout, entryNo: number): { roundIndex: number; opponents: number[] }[] | null {
  const slot = layout.slotOf.get(entryNo);
  if (slot == null) return null;

  // slot → entryNo の逆引き。席は疎（bye がある）なので Map で持つ。
  const entryAt = new Map<number, number>();
  for (const [no, idx] of layout.slotOf) entryAt.set(idx, no);

  const path: { roundIndex: number; opponents: number[] }[] = [];
  for (let r = 0; r < layout.totalRounds; r++) {
    const { start, end } = opponentSlotRange(slot, r);
    const opponents: number[] = [];
    for (let s = start; s < end; s++) {
      const no = entryAt.get(s);
      if (no != null) opponents.push(no);
    }
    path.push({ roundIndex: r, opponents });
  }
  return path;
}

/** ブラケットの 1 試合枠。`entries` が両方 null でも枠と線は描く。 */
export type BracketNode = {
  roundIndex: number;
  /** そのラウンド内での通し番号（0 始まり）。供給元は前ラウンドの `matchIndex*2` と `*2+1`。 */
  matchIndex: number;
  /** 上下 2 枠に入るエントリー。未確定は null。 */
  entries: [number | null, number | null];
  /**
   * この枠に対応する実データの試合。まだ行われていなければ null。
   * 「線は繋がっているが結果は空欄」という状態がこれで表せる。
   */
  match: RawMatch | null;
  /** 勝者。試合が無い／未決着なら null。 */
  winner: number | null;
  /**
   * 対戦相手側の山にそもそもエントリーが 1 組も居ない＝**不戦勝が確定**している枠か。
   *
   * 「片側が null」とは違うので注意。片側 null は「相手がまだ決まっていない」だけのことが
   * 多く（例: シードの 2 回戦は 1 回戦の勝者待ち）、その場合は勝ち上がらせてはいけない。
   */
  bye: boolean;
  /**
   * 上下それぞれの山にエントリーが**居るか**（誰かは未確定でもよい）。
   *
   * `entries` が null かどうかとは別物。`entries` は「今その枠に誰が入るか確定しているか」で、
   * 結果未入力の大会ではほとんど null になる。一方こちらは席順だけで決まる構造の話なので、
   * **結果が 1 件も無くても線を引くべき枝**がこれで分かる。描画はこちらを見ること。
   */
  present: [boolean, boolean];
};

export type BracketTree = {
  /** `rounds[0]` が 1 回戦、最後が決勝。`rounds[r].length === size / 2^(r+1)`。 */
  rounds: BracketNode[][];
  size: number;
  totalRounds: number;
};

/** 2 エントリーの組を順不同で引くためのキー。 */
const pairKey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * 席順とノックアウトの試合から、**全ラウンドが埋まったツリー**を組み立てる。
 *
 * これがトーナメント表描画の本体。現行 `TournamentBracket.tsx` の `buildBracket()` は
 * `matches` の `nextMatchId` を決勝から逆に辿るため、**開催前は 2 回戦以降の試合レコードが
 * 無く木が作れない**（IH2026 は `nextMatchId` が 0 件）。ここでは席順から先に枠を全部作り、
 * 分かっている結果だけを後から流し込むので、**結果が 1 件も無くても表として成立する**。
 *
 * 「仮定の勝ち上がり」は勝者を選ばせる操作ではなく、**線が繋がっていて目で辿れること**なので
 * （2026-07-31 ユーザー確定）、状態は持たない。未確定の枠は null のまま返す。
 *
 * 各枠の上下は、その側の「山」（スロット範囲）に居るエントリー数で決まる:
 *   - 0 組 … 誰も居ない。永久に空席＝相手にとって不戦勝が確定する。
 *   - 1 組 … その 1 組が試合をせずに上がってくるので確定して埋まる（シード・足長）。
 *   - 2 組以上 … 供給元の試合に勝者が入っていれば埋まり、無ければ null（結果待ち）。
 *
 * 「1 組」と「2 組以上だが未決着」を区別するのが要点。どちらも供給元は 1 つの枠だが、
 * 前者は戦わずに確定していて後者は未確定。ここを混同すると、**1 回戦の結果が未入力の
 * 大会でシードが試合をしないまま勝ち上がってしまう**（実際に IH2026 で 4 回戦に
 * 「対戦確定 28」という有り得ない枠が出た）。
 */
export function buildBracketTree(layout: BracketLayout, matches: RawMatch[] | undefined): BracketTree {
  const knockout = (matches ?? []).filter((m) => m.stage === 'knockout');
  const byPair = new Map<string, RawMatch>();
  for (const m of knockout) {
    const [a, b] = m.entries ?? [];
    if (typeof a === 'number' && typeof b === 'number') byPair.set(pairKey(a, b), m);
  }

  // slot → entryNo（bye の席は欠番）
  const entryAt = new Map<number, number>();
  for (const [no, idx] of layout.slotOf) entryAt.set(idx, no);

  /** スロット範囲 [start, start+width) に居るエントリー。1 組以下しか使わないので早期打ち切り。 */
  const occupants = (start: number, width: number): { count: number; only: number | null } => {
    let count = 0;
    let only: number | null = null;
    for (let s = start; s < start + width; s++) {
      const no = entryAt.get(s);
      if (no == null) continue;
      count += 1;
      if (count === 1) only = no;
      else return { count, only: null };
    }
    return { count, only };
  };

  const rounds: BracketNode[][] = [];

  for (let r = 0; r < layout.totalRounds; r++) {
    const nodeCount = layout.size >> (r + 1);
    const half = 1 << r; // 上下それぞれの山の幅（スロット数）
    const nodes: BracketNode[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const base = i * half * 2;
      const up = occupants(base, half);
      const down = occupants(base + half, half);
      const prev = r === 0 ? null : rounds[r - 1];

      const resolve = (side: { count: number; only: number | null }, feederIndex: number): number | null => {
        if (side.count === 0) return null; // 空席
        if (side.count === 1) return side.only; // 戦わずに上がってくる
        return prev ? (prev[feederIndex].winner ?? null) : null; // 結果待ち
      };

      const top = resolve(up, i * 2);
      const bottom = resolve(down, i * 2 + 1);

      const match = top != null && bottom != null ? (byPair.get(pairKey(top, bottom)) ?? null) : null;
      // 片側の山が空＝もう一方は戦わずに通過する（不戦勝が確定している）
      const bye = (up.count === 0) !== (down.count === 0);

      nodes.push({
        roundIndex: r,
        matchIndex: i,
        entries: [top, bottom],
        match,
        winner: match?.winnerEntryNo ?? null,
        bye,
        present: [up.count > 0, down.count > 0],
      });
    }
    rounds.push(nodes);
  }

  return { rounds, size: layout.size, totalRounds: layout.totalRounds };
}

/** 1 枚に載せる枠数の上限。「ベスト64が 1 枚に収まる」が基準（2026-07-31 ユーザー決定）。 */
export const SHEET_SLOTS = 64;

export type BracketSheet = {
  kind: 'qualifying' | 'final';
  /** 0 始まりの通し番号。 */
  index: number;
  /**
   * 表示名。山シートは**その山に入っている entryNo の範囲**（例: 「1〜39」）。
   * 読者は自分の応援する組の番号でどの山かを探すので、「第1山」より番号のほうが直接的
   * （2026-07-31 ユーザー決定）。ベスト64 シートは「ベスト64」、1 枚に収まる大会は「全体」。
   */
  label: string;
  /** この枚の外側に並ぶ entryNo の範囲。確定した番号が 1 つも無ければ null。 */
  entryNoRange: [number, number] | null;
  /** この枚が受け持つラウンド index の範囲（`[from, to]` の両端含む）。 */
  roundRange: [number, number];
  /** 左半分・右半分それぞれのラウンド列。中央へ向かって収束する。 */
  left: BracketNode[][];
  right: BracketNode[][];
  /** 中央に置く枠。決勝シートなら決勝の 1 枠、山シートならその山の代表たち。 */
  center: BracketNode[];
  /**
   * この枚のうち、勝敗が決まっている枠の数。
   *
   * 表示の出し分けに使う。ベスト64 シートは山シートと重複するので、**まだ 1 件も
   * 決まっていないなら出す意味が無い**（山シートを見れば同じ情報がある）。逆に
   * 決まっているならそこが大会の見どころなので初期表示にしたい（2026-07-31 ユーザー決定）。
   */
  decided: number;
};

/** 1 枚に収めるラウンド数。64 枠が 1 組に絞られるまで＝6 ラウンド。 */
const SHEET_ROUNDS = Math.log2(SHEET_SLOTS);

/**
 * ツリーを「1 枚 64 枠」のシートに割る。
 *
 * 基準（2026-07-31 ユーザー決定）:
 *   - **山シート**: ドローを 64 枠ずつの山に割り、各山を**その山の代表が決まるまで**
 *     （64→1 の 6 ラウンド）1 枚に収める。512 枠なら 8 枚で、各枚の中央がベスト8 の 1 枠。
 *   - **ベスト64 シート**: 残り 64 組が決勝まで勝ち上がる 6 ラウンドを別に 1 枚。
 *     **山シートと後半 3 ラウンドが重複するが、それは承知の上**（山を追う見方と
 *     終盤を俯瞰する見方は別物なので、両方あってよい）。
 *   - 出場が 64 以下の大会は、1 枚で大会全体が収まる（実データ 209 大会中 124 大会）。
 *   - 各シートは**左右から中央へ収束**させる。64 枠なら左 32・右 32、中央が決着の 1 枠。
 *
 * なぜ枚数を切るか: 512 枠を 1 枚で描くと横にも縦にも極端に長くなり、
 * どの枠を見ているのか分からなくなる。紙のドロー表が山ごとに分けて刷るのと同じ理由。
 */
export function splitBracketSheets(tree: BracketTree): BracketSheet[] {
  const sheetOf = (kind: BracketSheet['kind'], index: number, label: string, from: number, to: number, slotStart: number, slotEnd: number): BracketSheet => {
    const left: BracketNode[][] = [];
    const right: BracketNode[][] = [];
    const mid = (slotStart + slotEnd) / 2;

    for (let r = from; r <= to; r++) {
      const width = 1 << (r + 1); // その枠が受け持つスロット幅
      const row = tree.rounds[r].filter((n) => n.matchIndex * width >= slotStart && n.matchIndex * width < slotEnd);
      left.push(row.filter((n) => n.matchIndex * width < mid));
      right.push(row.filter((n) => n.matchIndex * width >= mid));
    }

    // 最終列がこのシートの範囲全体を 1 枠にまとめているなら、それが中央（決着）。
    // 山シートならその山の代表、ベスト64/全体シートなら決勝。
    let center: BracketNode[] = [];
    if ((left.at(-1)?.length ?? 0) + (right.at(-1)?.length ?? 0) === 1) {
      center = [...(left.pop() ?? []), ...(right.pop() ?? [])];
    }
    const decided = [...left.flat(), ...right.flat(), ...center].filter((n) => n.winner != null).length;

    // 外側（このシートの最初のラウンド）に並ぶ entryNo の範囲。
    // ベスト64 シートは勝ち上がりが未確定なら null になるので、その場合は既定の label を使う。
    const outer = [...(left[0] ?? []), ...(right[0] ?? [])].flatMap((n) => n.entries).filter((e): e is number => e != null);
    const entryNoRange: [number, number] | null = outer.length > 0 ? [Math.min(...outer), Math.max(...outer)] : null;

    return {
      kind,
      index,
      label: kind === 'qualifying' && entryNoRange ? `${entryNoRange[0]}〜${entryNoRange[1]}` : label,
      roundRange: [from, to],
      left,
      right,
      center,
      decided,
      entryNoRange,
    };
  };

  // 出場が 64 以下＝大会まるごと 1 枚
  if (tree.size <= SHEET_SLOTS) {
    return [sheetOf('final', 0, '全体', 0, tree.totalRounds - 1, 0, tree.size)];
  }

  const sheets: BracketSheet[] = [];
  const blocks = tree.size / SHEET_SLOTS;
  for (let b = 0; b < blocks; b++) {
    sheets.push(sheetOf('qualifying', sheets.length, `第${b + 1}山`, 0, SHEET_ROUNDS - 1, b * SHEET_SLOTS, (b + 1) * SHEET_SLOTS));
  }
  // ベスト64 シート。山シートの後半と重なるが、終盤を俯瞰するために別に持つ。
  sheets.push(sheetOf('final', sheets.length, `ベスト${SHEET_SLOTS}`, tree.totalRounds - SHEET_ROUNDS, tree.totalRounds - 1, 0, tree.size));

  return sheets;
}
