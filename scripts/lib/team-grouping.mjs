// チームマージ候補の「既定グループ分け」と「自動OK判定」。
//
// なぜ切り出したか（docs/raw/2026-09-06-idea-autonomous-improvement-agent.md 追記12）:
// 抜き取り監査は「機械がどう判定したか」と「人がどう判断したか」を突き合わせる。
// ところが監査は機械の判定を**判断台帳から読んでいた**。台帳の値は反映のたびに
// 上書きされ（実測で同じクラスタが14〜15回改訂されていた）、しかもIDがずれていた時期
// （`memGenre` が別チームの経歴を引いていた）に書かれたものが混ざる。
// その結果、**既に直っているバグを現在の誤り率として報告していた**（誤統合 3/3 = 100%）。
//
// 機械の判定は「いまのロジックで計算した値」でなければならない。そのために
// build-team-review-html.mjs だけが持っていたロジックをここへ出し、監査からも使う。

/** 名前から学校段階を推定する。出場大会からジャンルが決まらないときの補完。 */
export function level(name) {
  const n = String(name);
  if (/中学/.test(n)) return '中';
  if (/高校|高等学校/.test(n)) return '高';
  if (/大学/.test(n)) return '大';
  if (/小学|スポーツ少年団|スポ少|ジュニア/.test(n)) return '小';
  if (/クラブ|ＯＢ|OB|役場|電力|協会|ＳＴＣ|STC|JSC/.test(n)) return 'ク';
  return null;
}

/** 出場大会から決まる段階。一意に決まらなければ null。 */
export function memGenre(member, context) {
  const gs = (context[member.id] || {}).genres || [];
  return gs.length === 1 ? gs[0] : null;
}

/**
 * 既定グループ分け。段階が同じなら由来（出場大会 / 名前）を問わず同じグループにする。
 * 由来ごとに別の接頭辞を付けていたため、片方だけジャンルを持つクラスタが必ず分割されていた
 * （2026-09-06 修正）。
 */
export function defaultGroups(members, context) {
  const keys = members.map((m, i) => {
    const stage = memGenre(m, context) ?? level(m.name);
    return stage != null ? 'S:' + stage : 'bare' + i;
  });
  const uniq = [...new Set(keys)];
  const idx = {};
  uniq.forEach((k, i) => (idx[k] = i));
  return keys.map((k) => idx[k]);
}

/**
 * 自動OK判定（大会の共起ベース）。
 * 同一グループ内の2表記が「同一大会(大会id+年)」に同居していれば別チームの疑い→人手レビュー。
 * `signal: "players"`（選手共有シグナル）は常に人手レビュー。
 */
/**
 * 自動OK判定。
 *
 * 2026-09-06 の経緯（同じ箇所で2回、判断が反転している）:
 * 抜き取り監査で「裏付けの無い（genres 空の）メンバーを名前の段階だけで統合する型」が
 * **8件中4件の誤統合**と出たため、その型を人手レビューへ回す実装を入れた。
 * ところがその直後、**人が4件とも判断を merge へ改めた**（常磐大＝常磐大学高校、
 * 国府台＝国府台高校 などで、統合が正しかった）。誤統合は 0/8 になり、
 * 人手を46件増やす根拠が消えたので戻した。
 *
 * **この判断の根拠は merge層8件・上限32.4% でしかない。**
 * 母集団49件のうち残り48件を判断すれば全数に近くなり、推定でなく確定値になる。
 * それを待たずに動かしているので、結果次第では再び入れ直すこと。
 *
 * なお監査は「人の判断が機械の判定と独立」であることを前提にしているが、
 * レビュー画面は機械の判定を初期状態として表示するため、**その前提は厳密には成り立たない**。
 * 今回の反転も、監査結果を見た後の再判断だった。
 */
export function isAutoOK(cluster, context) {
  if (cluster.signal === 'players') return false;
  const groups = defaultGroups(cluster.members, context);
  const byGroup = {};
  cluster.members.forEach((m, i) => (byGroup[groups[i]] = byGroup[groups[i]] || []).push(m));
  for (const g in byGroup) {
    const ms = byGroup[g];
    for (let i = 0; i < ms.length; i++) {
      for (let j = i + 1; j < ms.length; j++) {
        const a = new Set((context[ms[i].id] || {}).inst || []);
        const b = new Set((context[ms[j].id] || {}).inst || []);
        for (const x of a) if (b.has(x)) return false;
      }
    }
  }
  return true;
}

/**
 * 既定グループ分けのもとで、このクラスタは統合が起きるか。
 * 2人以上が同じグループに入れば 'merge'、全員別グループなら 'separate'。
 * これが「機械の判定」であり、監査はこれと人の判断を突き合わせる。
 */
export function machineVerdict(cluster, context) {
  const groups = defaultGroups(cluster.members, context);
  const counts = {};
  for (const g of groups) counts[g] = (counts[g] || 0) + 1;
  return Object.values(counts).some((n) => n >= 2) ? 'merge' : 'separate';
}
