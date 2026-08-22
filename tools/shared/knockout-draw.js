/*
  knockout-draw.js
  決勝トーナメントのドロー（席順）を `matches` から起こす。Browser + Node 両対応。

  - Node:    const { buildKnockoutDraw } = require('.../knockout-draw.js')
  - Browser: <script src="knockout-draw.js"></script> → window.KnockoutDraw

  なぜ必要か:
    予選リーグ→決勝トーナメント形式の大会では、決勝Tの席は **エントリーではなく
    予選リーグの組に属する**（「A組1位の席」であって「◯番の組の席」ではない）。
    誰がその席に入るかはリーグが終わるまで決まらないので、`entries[].type` に
    席順を持たせる方式は原理的に成立しない（実測で 90 大会中 17 大会が誤復元）。
    詳細は docs/adr/ADR-015-knockout-draw-by-group.md。

    完了済み大会は `matches` に決勝Tの木がそのまま残っているので、そこから席順を
    起こせる。入力ツール（normalize-core.js）と一括生成スクリプト
    （scripts/generate-knockout-draw.mjs）が**同じモジュールを共有する**
    （ルールの二重管理を避けるため。validate-entries.js と同じ方針）。
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KnockoutDraw = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  /** ラウンドの進行順。大きいほど後。表記ゆれ（決勝を「4回戦」と書く大会）に耐える。 */
  function roundOrder(name) {
    if (!name) return -1;
    if (name.indexOf('準々決勝') >= 0) return 8000;
    if (name.indexOf('準決勝') >= 0) return 9000;
    // 「優勝決定戦」は決勝の言い換え。順位決定戦（3位決定戦・7・8位決定戦）とは別物なので先に見る。
    if (name.indexOf('優勝決定') >= 0) return 10000;
    if (name.indexOf('決勝') >= 0) return 10000;
    var m = /(\d+)/.exec(name);
    return m ? Number(m[1]) : 0;
  }

  /** 'N回戦' / '準々決勝' / '準決勝' / '決勝' → ラウンド番号（1 始まり）。検算用。 */
  function roundNumber(name, totalRounds) {
    if (!name) return null;
    if (name === '決勝') return totalRounds;
    if (name === '準決勝') return totalRounds - 1;
    if (name === '準々決勝') return totalRounds - 2;
    var m = /^(\d+)回戦$/.exec(name);
    return m ? Number(m[1]) : null;
  }

  /**
   * 決勝から遡って決勝Tの木を組む。
   * 戻り値は `{ kind:'match', match, children:[node,node] }` か `{ kind:'entry', entryNo }`。
   *
   * `nextMatchId` があるならそれだけで辿る。**順位決定戦（3位決定戦・7・8位決定戦）を
   * 勝ち上がりと取り違えないため**で、勝った試合を遡る方式だと3位決定戦の勝者が
   * 準決勝の「前の試合」に見えて木が1段深くなる（実例:
   * zennihon-university-ouza/2026/team-none-girls）。順位決定戦は本戦の枠に繋がらないので
   * `nextMatchId` が付かず、この方式なら自然に外れる。
   */
  function buildTree(matches) {
    var ko = (matches || []).filter(function (m) {
      return m && m.stage === 'knockout' && (m.entries || []).length === 2;
    });
    if (ko.length === 0) return { error: 'knockout の試合が無い' };

    var useNext = ko.some(function (m) {
      return m.nextMatchId;
    });

    var prevWinOf;
    if (useNext) {
      var feeders = {};
      ko.forEach(function (m) {
        if (!m.nextMatchId) return;
        (feeders[m.nextMatchId] = feeders[m.nextMatchId] || []).push(m);
      });
      prevWinOf = function (entryNo, before) {
        var cands = feeders[before.matchId] || [];
        for (var i = 0; i < cands.length; i++) if (cands[i].winnerEntryNo === entryNo) return cands[i];
        return null;
      };
    } else {
      prevWinOf = function (entryNo, before) {
        var cands = ko.filter(function (m) {
          return m !== before && m.winnerEntryNo === entryNo && roundOrder(m.round) < roundOrder(before.round);
        });
        if (cands.length === 0) return null;
        return cands.reduce(function (best, m) {
          return roundOrder(m.round) > roundOrder(best.round) ? m : best;
        });
      };
    }

    // 決勝＝どこにも勝ち上がらない試合のうち、いちばん後のラウンドのもの。
    // 順位決定戦も `nextMatchId` を持たないので、ラウンド順で選び分ける。
    var roots = useNext
      ? ko.filter(function (m) {
          return !m.nextMatchId;
        })
      : ko;
    if (roots.length === 0) return { error: '決勝にあたる試合が無い（nextMatchId が循環している）' };
    var final = roots.reduce(function (best, m) {
      return roundOrder(m.round) > roundOrder(best.round) ? m : best;
    });

    var seen = {};
    function node(match) {
      if (match.matchId && seen[match.matchId]) return { error: '試合の参照が循環している（' + match.matchId + '）' };
      if (match.matchId) seen[match.matchId] = true;
      var children = match.entries.map(function (no) {
        var prev = prevWinOf(no, match);
        return prev ? node(prev) : { kind: 'entry', entryNo: no };
      });
      for (var i = 0; i < children.length; i++) if (children[i].error) return children[i];
      return { kind: 'match', match: match, children: children };
    }
    return node(final);
  }

  /** 木の高さ（葉まで何ラウンドあるか）。葉は 0。 */
  function heightOf(node) {
    if (node.kind === 'entry') return 0;
    return 1 + Math.max.apply(null, node.children.map(heightOf));
  }

  /**
   * 木から席順（長さが2の冪の配列。空席は null）を作る。
   *
   * 葉はその枝が担当するスロット範囲の先頭に置く。範囲に他の組は居ないので、
   * どのラウンドで誰と当たるかは範囲内のどこに置いても変わらない
   * （不戦勝の空席が範囲の残りになる）。
   */
  function slotsOf(node) {
    var size = Math.pow(2, heightOf(node));
    var slots = new Array(size);
    for (var i = 0; i < size; i++) slots[i] = null;
    (function place(n, lo, hi) {
      if (n.kind === 'entry') {
        slots[lo] = n.entryNo;
        return;
      }
      var mid = (lo + hi) / 2;
      place(n.children[0], lo, mid);
      place(n.children[1], mid, hi);
    })(node, 0, size);
    return slots;
  }

  /** 席順で計算した合流ラウンドが knockout の全試合と一致するか検算する。 */
  function verifySlots(slots, matches) {
    var totalRounds = Math.log(slots.length) / Math.log(2);
    var slotOf = {};
    slots.forEach(function (no, idx) {
      if (no != null) slotOf[no] = idx;
    });

    var ok = 0;
    var bad = [];
    (matches || []).forEach(function (m) {
      if (!m || m.stage !== 'knockout') return;
      var a = (m.entries || [])[0];
      var b = (m.entries || [])[1];
      var p = slotOf[a];
      var q = slotOf[b];
      if (p == null || q == null || p === q) return;

      // データのラウンド名は表記ゆれがあるので、決勝からの距離で比べる。
      var expected = null;
      for (var k = 1; k <= totalRounds; k++) {
        if (p >> k === q >> k) {
          expected = k;
          break;
        }
      }
      var actual = roundNumber(m.round, totalRounds);
      if (actual == null) return;
      if (expected === actual) ok += 1;
      else bad.push((m.matchId || '?') + ' [' + a + ',' + b + '] データ=' + m.round + ' 復元=' + expected + '回戦相当');
    });
    return { ok: ok, bad: bad };
  }

  /**
   * `matches` から `knockoutDraw` を組む。
   *
   * @param {{matches?: any[], results?: any[]}} data
   * @returns {{draw: {slots: any[]}, entryNos: number[], verified: number}
   *           | {skip: string} | {error: string}}
   *   - `skip` … この大会には決勝Tのドローが無い（予選リーグ無し／決勝1試合のみ 等）。
   *   - `error` … 組めなかった。データ側に問題がある可能性が高い。
   */
  function buildKnockoutDraw(data) {
    var matches = ((data && data.matches) || []).filter(function (m) {
      return m && typeof m === 'object';
    });
    var hasRR = matches.some(function (m) {
      return m.stage === 'roundrobin';
    });
    var hasKO = matches.some(function (m) {
      return m.stage === 'knockout';
    });
    // 席が「組」に属するのは予選リーグを挟む大会だけ。純トーナメントは entries[].type が持つ。
    if (!hasRR || !hasKO) return { skip: '予選リーグ→決勝トーナメント形式ではない' };

    var tree = buildTree(matches);
    if (tree.error) return { error: tree.error };

    // 決勝が1試合だけの大会（リーグ→リーグ→優勝決定戦 など）にはブラケットが無い。
    // 2枠のドローは席順の情報を何も持たないので作らない。
    if (heightOf(tree) < 2) return { skip: '決勝1試合のみでブラケットが無い' };

    var slots = slotsOf(tree);
    var checked = verifySlots(slots, matches);
    if (checked.bad.length > 0) {
      return { error: '検算で不一致 ' + checked.bad.length + ' 件: ' + checked.bad.slice(0, 3).join(' / ') };
    }

    // 決勝Tの成績を持つ組は、全員この席順に載っていなければおかしい。
    // 載っていないなら knockout の試合が欠けているか、成績と試合記録が食い違っている。
    var placed = {};
    slots.forEach(function (no) {
      if (no != null) placed[no] = true;
    });
    var unplaced = ((data && data.results) || [])
      .filter(function (r) {
        return r && r.tournament && !placed[r.entryNo];
      })
      .map(function (r) {
        return r.entryNo;
      });
    if (unplaced.length > 0) {
      return { error: '決勝Tの成績があるのに席順に載らない組: ' + unplaced.join(', ') + '（決勝Tの試合記録が欠けている可能性）' };
    }

    // entryNo → (組, 組内順位)。席はエントリーではなく組に属するので、書き込むのは組のほう。
    var rrOf = {};
    ((data && data.results) || []).forEach(function (r) {
      var rr = r && r.roundrobin;
      if (!r || r.entryNo == null || !rr || rr.group == null || rr.rank == null) return;
      rrOf[r.entryNo] = { group: String(rr.group), rank: rr.rank };
    });
    var missing = slots.filter(function (no) {
      return no != null && !rrOf[no];
    });
    if (missing.length > 0) {
      return { error: 'results[].roundrobin が無い組がある: ' + missing.join(', ') };
    }
    // (組, 順位) が一意でないと席から entryNo を引けない。
    var keys = slots
      .filter(function (no) {
        return no != null;
      })
      .map(function (no) {
        return rrOf[no].group + '/' + rrOf[no].rank;
      });
    var dup = keys.filter(function (k, i) {
      return keys.indexOf(k) !== i;
    });
    if (dup.length > 0) {
      return { error: '(組, 組内順位) が重複している: ' + dup.join(', ') };
    }

    return {
      draw: {
        slots: slots.map(function (no) {
          return no == null ? null : rrOf[no];
        }),
      },
      entryNos: slots,
      verified: checked.ok,
    };
  }

  return {
    buildKnockoutDraw: buildKnockoutDraw,
    roundOrder: roundOrder,
  };
});
