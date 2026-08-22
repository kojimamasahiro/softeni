/* eslint-disable */
/*
  validate-entries.js
  大会結果データ（participants / entries / matches / results）の入力ミス検出。
  Browser + Node 両対応。normalize-core.js と同じ UMD パターン。

  - Node:    const { validateTournamentData } = require('.../validate-entries.js')
  - Browser: <script src="validate-entries.js"></script> → window.ValidateEntries

  なぜ必要か:
    統計エンジンは相方を特定できない試合を「相方不明」として黙って除外するため、
    サイトの表示を見ても入力ミスに気付けない。2026-07-19 に選手ページのパートナー別集計が
    試合数と合わない問題を追った結果、原因は全てここで検出できる類のミスだった。
    詳細: docs/raw/2026-07-19-manual-fix-checklist.md

  同じルールを scripts/check-tournament-entries.mjs（全データ一括チェック）と
  入力ツール（保存前チェック）の両方で使う。ルールの二重管理を避けるための共有モジュール。
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ValidateEntries = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  /**
   * @param {{participants?: any[], entries?: any[], matches?: any[], results?: any[]}} data
   * @param {{categoryId?: string}} [options]
   *   categoryId を渡すとシングルス/ペア戦を厳密に判定する。
   *   渡さない場合（入力ツールなど）は、entries の多数派の人数から推定する。
   * @returns {{rule: string, entryNo: number|null, message: string, severity: 'error'|'warn'}[]}
   *   severity='error' は「統計から黙って除外される＝表示を見ても気付けない」種類の入力ミス。
   *   severity='warn' は表示側が graceful に諦めるので害は小さいが、機能が欠ける類。
   *   全データ一括チェック（check-tournament-entries.mjs）は error のみ終了コード1にする。
   */
  function validateTournamentData(data, options) {
    const opts = options || {};
    const findings = [];
    const add = (rule, entryNo, message, severity) =>
      findings.push({
        rule: rule,
        entryNo: entryNo == null ? null : entryNo,
        message: message,
        severity: severity || 'error',
      });

    if (!data || !Array.isArray(data.entries)) return findings;

    const entries = data.entries;
    const participants = Array.isArray(data.participants) ? data.participants : [];
    const participantIds = new Set(participants.map((p) => p && p.id));
    const entryNos = new Set(entries.map((e) => e && e.entryNo));

    const idsOf = (e) => (e && Array.isArray(e.playerIds) ? e.playerIds : []);

    // 種目の判定。categoryId があれば確実。無い場合は entries の多数派人数で推定する
    // （入力ツールは保存先ファイル名が未定の段階で呼ばれるため）。
    const categoryId = opts.categoryId || '';
    let isSingles = null;
    let isTeam = false;
    if (categoryId) {
      isSingles = categoryId.indexOf('singles') >= 0;
      isTeam = categoryId.indexOf('team') >= 0;
    } else {
      const counts = new Map();
      for (const e of entries) {
        const n = idsOf(e).length;
        if (n > 0) counts.set(n, (counts.get(n) || 0) + 1);
      }
      let modal = 0;
      let best = -1;
      for (const [n, c] of counts) if (c > best) ((best = c), (modal = n));
      if (modal > 0) isSingles = modal === 1;
    }

    for (const entry of entries) {
      const ids = idsOf(entry);
      const no = entry && entry.entryNo;

      // ペア戦なのに1人。カテゴリの付け間違いか、相方の入力漏れ。
      if (isSingles === false && !isTeam && ids.length === 1) {
        add('pair-single-player', no, 'ペア戦だが playerIds が1人: ' + ids[0]);
      }

      // 相方欄に本人をコピーした入力ミス。
      if (ids.length > 1 && new Set(ids).size !== ids.length) {
        add('duplicate-player-id', no, 'playerIds に同一IDが重複: ' + JSON.stringify(ids));
      }

      // シングルスなのに複数人（逆パターン）。
      if (isSingles === true && ids.length > 1) {
        add('singles-multi-player', no, 'シングルスだが playerIds が' + ids.length + '人: ' + JSON.stringify(ids));
      }

      // participants に存在しない選手を参照している。
      for (const id of ids) {
        if (!participantIds.has(id)) {
          add('unknown-participant', no, 'participants に存在しない playerId: ' + id);
        }
      }
    }

    // participants に居るのに、どの entry にも登場しない選手。
    // 同一人物が表記ゆれで二重登録され、片方だけが entries で使われている場合に出る。
    const used = new Set();
    for (const e of entries) for (const id of idsOf(e)) used.add(id);
    for (const p of participants) {
      if (p && p.id && !used.has(p.id)) {
        add('orphan-participant', null, 'participants に居るが entries に登場しない: ' + p.id);
      }
    }

    // matches が存在しない entryNo を参照している。
    // null の場合は「対戦相手が entries に未登録」を意味し、その組の戦績が誰にも紐付かない。
    for (const m of Array.isArray(data.matches) ? data.matches : []) {
      for (const no of (m && m.entries) || []) {
        if (!entryNos.has(no)) {
          const label = no === null ? 'null（対戦相手が entries に未登録）' : String(no);
          add('match-entry-not-found', null, ((m && m.round) || 'round不明') + ' の match.entries に存在しない entryNo: ' + label);
        }
      }
    }

    // results が存在しない entryNo を参照している。
    for (const r of Array.isArray(data.results) ? data.results : []) {
      if (r && r.entryNo != null && !entryNos.has(r.entryNo)) {
        add('result-entry-not-found', r.entryNo, 'results に存在しない entryNo: ' + r.entryNo);
      }
    }

    // ---- 決勝トーナメントの席順 ----
    //
    // 情報源は大会の形式で 2 通りに分かれる。
    //   (1) 予選リーグ→決勝 T … `knockoutDraw`（席は「組」に属する）
    //   (2) 単純トーナメント   … `entries[].type`（席は「エントリー」に属する）
    // 詳細は docs/adr/ADR-015-knockout-draw-by-group.md。
    const allMatches = Array.isArray(data.matches) ? data.matches : [];
    const hasRoundRobin = allMatches.some((m) => m && m.stage === 'roundrobin');
    const koMatches = allMatches.filter((m) => m && m.stage === 'knockout');
    const draw = data.knockoutDraw;
    const drawSlots = draw && Array.isArray(draw.slots) ? draw.slots : null;

    // 決勝が 1 試合だけの大会（リーグ→リーグ→優勝決定戦 など）にはブラケットが無く、
    // 席順という概念も無いので `knockoutDraw` は要らない。
    // 実例: zennihon-university-ouza/2026/team-none-boys（予選リーグ→準決勝リーグ→優勝決定戦）。
    if (hasRoundRobin && koMatches.length >= 2 && !drawSlots) {
      // この形式の大会の席順は `entries[].type` では表せない（リーグが終わるまで誰が
      // その席に入るか決まらないため）。`knockoutDraw` が無いと表が組めない。
      add(
        'knockout-draw-missing',
        null,
        '予選リーグ→決勝トーナメント形式だが knockoutDraw が無い。' + 'npm run bracket:draw -- --apply で matches から生成できる（できない場合は決勝Tの試合記録が欠けている）',
        'warn',
      );
    }

    if (drawSlots) {
      const size = drawSlots.length;
      if (size === 0 || (size & (size - 1)) !== 0) {
        add('knockout-draw-parity', null, 'knockoutDraw.slots の枠数が2の冪でない（' + size + '枠）。空席は null で埋めること', 'warn');
      }

      // 席が参照する (組, 組内順位) を results から引けるか。
      // リーグが終わる前は引けなくて当たり前なので、決着した決勝Tの試合がある大会だけ見る。
      if (koMatches.some((m) => m && m.winnerEntryNo != null)) {
        const known = new Set();
        for (const r of Array.isArray(data.results) ? data.results : []) {
          const rr = r && r.roundrobin;
          if (rr && rr.group != null && rr.rank != null) known.add(rr.group + '/' + rr.rank);
        }
        const unresolved = [];
        for (const s of drawSlots) {
          if (!s) continue;
          const key = s.group + '/' + s.rank;
          if (!known.has(key)) unresolved.push(key);
        }
        if (unresolved.length > 0) {
          add('knockout-draw-unresolved', null, 'knockoutDraw の席に対応する予選リーグの順位が results に無い: ' + unresolved.join(', '), 'warn');
        }
      }
    }

    // entries[].type からブラケットの席順を復元できるか。
    //
    // 席順は entryNo 順に「seed/extra は本人＋bye で 2 枠、packing は 2 組で 2 枠」と
    // 積むと決まり、健全なドローなら合計はちょうど 2 の冪になる。2 冪にならないのは
    // packing の並びが奇数個＝type の入力ミスで、**そこから先の席が全部 1 つずれる**。
    // 表示側（lib/bracketLayout.ts）はずれを検出したら復元を諦めるので、症状は
    // 「前哨戦ブロックの『◯回戦で当たる』が大会の後半で丸ごと消える」という形で出る。
    // 2026-07-31 の全データ検証で 183 大会中 10 大会がこれに該当した。
    //
    // **予選リーグを含む大会は対象外**。この形式では entries に予選敗退組も残るうえ、
    // 決勝Tの席順は entryNo のドロー順と無関係なので、type を積んでも意味のある枠数に
    // ならない（2026-08-22 に 3 大会の誤検知として顕在化した）。席順は knockoutDraw が持つ。
    if (!hasRoundRobin && entries.some((e) => e && (e.type === 'seed' || e.type === 'extra'))) {
      const typeByNo = new Map(entries.map((e) => [e && e.entryNo, e && e.type]));
      const nos = [...typeByNo.keys()].filter((n) => n != null).sort((a, b) => a - b);
      let slotCount = 0;
      let unpaired = null;
      for (let i = 0; i < nos.length; ) {
        const t = typeByNo.get(nos[i]);
        slotCount += 2;
        if (t === 'seed' || t === 'extra') {
          i += 1;
        } else {
          if (typeByNo.get(nos[i + 1]) !== t && unpaired == null) unpaired = nos[i];
          i += 2;
        }
      }
      if (slotCount === 0 || (slotCount & (slotCount - 1)) !== 0) {
        add(
          'bracket-slot-parity',
          unpaired,
          'entries[].type から復元した枠数が2の冪でない（' +
            slotCount +
            '枠）。packing の並びが奇数個になっている' +
            (unpaired == null ? '' : '（最初のずれは entryNo ' + unpaired + ' 付近）') +
            '。以降の山が1つずつずれるため、シード/足長の指定を確認すること',
          // warn: 表示側（lib/bracketLayout.ts）はずれを検出したら復元を諦めるので、
          // 誤った情報は出ない。欠けるのは前哨戦ブロックの「◯回戦で当たる」だけ。
          // 既存データに 10 件あり、これで build を止めるのは割に合わない。
          'warn',
        );
      }
    }

    return findings;
  }

  /** ルール名 → 人が読む短い説明。ツールの警告表示に使う。 */
  var RULE_LABELS = {
    'pair-single-player': 'ペア戦なのに選手が1人',
    'duplicate-player-id': '相方が本人と同じ',
    'singles-multi-player': 'シングルスなのに複数人',
    'unknown-participant': '選手一覧に無いIDを参照',
    'orphan-participant': '選手一覧に居るが誰とも組んでいない',
    'match-entry-not-found': '試合が存在しない組を参照',
    'result-entry-not-found': '結果が存在しない組を参照',
    'bracket-slot-parity': 'シード/足長の指定がずれている（枠数が2の冪でない）',
    'knockout-draw-missing': '予選リーグ→決勝Tなのに決勝Tのドローが無い',
    'knockout-draw-parity': '決勝Tのドローの枠数が2の冪でない',
    'knockout-draw-unresolved': '決勝Tのドローが参照する予選リーグの順位が無い',
  };

  return {
    validateTournamentData: validateTournamentData,
    RULE_LABELS: RULE_LABELS,
  };
});
