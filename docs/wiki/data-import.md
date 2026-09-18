# Data Import

> **適用範囲: 混在**。生成の流れ・検査・入力ツールの考え方は汎用。大会名・カテゴリはソフトテニス固有。
> **2026-09-18 に現在の仕様だけへ圧縮し、PDF の読み取りは [pdf-import.md](./pdf-import.md) へ分けた。**
> 年度ごとの実施記録・座標の実測値・調査の経緯は
> [raw/2026-09-18-wiki-archive-data-import.md](../raw/2026-09-18-wiki-archive-data-import.md)。

大会データ・選手データ・score 公開 JSON をローカルスクリプトで生成する運用。
PDF から読み取る部分は [pdf-import.md](./pdf-import.md)。

## prebuild のゲート

`npm run prebuild` が健全性チェック → 正準化 → 生成を直列に実行する（全段の並びは [deployment.md](./deployment.md) が正）。
取り込みに効くのは**先頭のゲート**で、不整合があるとここでビルドが止まる:
`normalize-team-spacing.mjs` / `check-tournament-entries.mjs` / `check-team-match-details.mjs` /
`check-highschool-pipeline-freshness.mjs` / `check-name-splits.mjs --strict`。

**`check-highschool-pipeline-freshness.mjs`** は「今の元データに対して `npm run highschool:pipeline` が
実行済みか」を、**元データのうちパイプラインが実際に読む項目だけ**の内容ハッシュで判定する
（`participants[].team` / `prefecture` / `entries[].entryNo` / `playerIds` / `results[].entryNo` /
`tournament.label` / `roundrobin.rank` と `index.json` の `(tournamentId, generationId)`）。

- **`matches` や `entries[].type` は読んでいないので、そこだけの修正では赤くならない。**
- 赤くなったら `npm run highschool:pipeline` を回し、生成物と `.pipeline-source-hash.json` を同じコミットに乗せる。
- **python 側（`01team` / `02result` / `03list`）が読む項目を増やしたら `scripts/highschool/lib/source-hash.mjs` の
  `projectDetail` も必ず更新する**（更新漏れは「元データが変わったのに緑のまま生成物が古い」という検出漏れになる）。

主な生成物: `generate-players-json.mjs` / `generate-players-lite.mjs` / `generate-player-analysis.mjs` /
`generate-beta-matches-json.mjs` / `generate-match-reverse-index.mjs` / `generate-rare-events.mjs` /
`playerstats:facts` / `playerstats:rankings` / `secondaryschool:build` / `primaryschool:build`。

## データの正と、派生の向き

- 大会データの canonical source は `data/tournaments/details/**` と `information/*.json`。
  一覧・地域紐付けは `index.json` / `local_index.json`。
- そこから選手ページ用の `data/players/**` を派生生成する（`analysis.json` は `generate-player-analysis.mjs`）。
- score 系だけは向きが違い、Supabase → `public/data/beta-matches/**` を `generate-beta-matches-json.mjs` が生成する
  （全件取得・**追記型**で、出力ディレクトリを消さない。環境変数が無ければ既存スナップショットを再利用）。
  **旧仕様の「最新50件だけ＋毎回全削除」は廃止済み**（上限から漏れた試合の詳細ページが404になるリスクがあった）。

高校カテゴリ系は `scripts/highschool/{01team,02result,03list,04summry,analysis}/` → `data/highschool/**`。
性別はファイル名から自動判定（`boys` / `girls` / `mixed`）。
**同姓同名選手の証拠から広く alias を推定する処理は、別学校の過剰集約を招くため集計には使わない。**

## 品質チェック `npm run check:entries`

`scripts/check-tournament-entries.mjs` が `details/**` を全走査する（問題があれば終了コード1。`temp/` は除外）。

| ルール | 意味 |
|---|---|
| `pair-single-player` | ペア戦なのに `playerIds` が1人（`team` / `versus` を含むカテゴリは対象外） |
| `duplicate-player-id` | `playerIds` に同一 ID が重複 |
| `singles-multi-player` | シングルスなのに複数人 |
| `unknown-participant` | `participants` に存在しない `playerId` を参照 |
| `orphan-participant` | `participants` に居るのにどの entry にも出ない＝**表記ゆれによる二重登録のサイン** |
| `match-entry-not-found` / `result-entry-not-found` | 存在しない entryNo を参照 |
| `bracket-slot-parity` | `entries[].type` から積んだ枠数が2の冪でない（warn）。予選リーグを含む大会と `preliminary` は対象外 |
| `knockout-draw-missing` / `-parity` / `-unresolved` | 予選リーグ→決勝T形式なのに `knockoutDraw` が無い／枠数が2の冪でない／席が参照する (組, 順位) が無い（warn） |

**検出は選手側から逆引きせず、details を全走査すること**（サンプリングすると絡む分を取りこぼす）。
統計エンジンはこれらを「相方不明」として**黙って除外する**ので、サイトの表示を見ても気付けない。

## 決勝トーナメントの席順（`knockoutDraw`）

**予選リーグ→決勝T形式では、決勝Tの席は「エントリー」ではなく「予選リーグの組」に属する**
（「A組1位の席」であって「◯番の組の席」ではない）。`entries[].type` に席順を持たせる方式は成立しない。

```json
"knockoutDraw": { "slots": [ {"group":"A","rank":1}, null, {"group":"D","rank":2} ] }
```

- `slots` の並びがそのまま席順。長さは2の冪、`null` は空席（不戦勝）。実際の `entryNo` は
  `results[].roundrobin.{group, rank}` を引いて解決する。
- 完了済み大会は `npm run bracket:draw -- --apply` で `matches` から生成できる。
  **書き込む前に「復元した席順の合流ラウンドが knockout の全試合と一致するか」を検算し、通らない大会には書き込まない。**
- **`entries[].type` は予選リーグを含まない大会専用。**
- **決勝が1試合だけの大会にはドローを作らない**（2枠のドローは席順の情報を持たない）。
- 入力ツールは保存時に `knockoutDraw` を出力に含める（実体は `tools/shared/knockout-draw.js` を
  入力ツールと生成スクリプトで共有）。決定の経緯は [ADR-015](../adr/ADR-015-knockout-draw-by-group.md)。

## 団体戦の対戦ごとの記録（オーダー）の取り込み

仕様は [data-model.md](./data-model.md) と [ADR-020](../adr/ADR-020-team-match-rubber-details.md)、
手順はスキル `team-match-order`。読み取りは [pdf-import.md](./pdf-import.md)。

```
python3 scripts/pdf/highschool_senbatsu_team_matches.py PDF --page 1 \
    --details data/tournaments/details/highschool-senbatsu/2025/team-none-boys.json --write
npx prettier --write data/tournaments/details/highschool-senbatsu/2025/team-none-*.json
npm run check:team-match-details
```

- **ファイル全体を書き直さず、各試合の末尾に差し込む**（全体を再シリアライズすると Prettier の折り返しが変わり、
  触っていない entries まで数千行の差分になる）。再実行は冪等。
- 書き込み前に「塊の勝ち数＝既存の本数」「同じ選手が2校に割り当てられない」を確かめ、崩れたら止まる。
  **既存データとの食い違いで止まるので、本数の検算にもなる**（実際に公式記録との食い違いが2件見つかった）。
- 選手の結び付けは「同じ氏名・同じ学校の個人戦の出場記録」。**学校名の表記が違うと結び付かず名前だけになる**。
  チームの統合は人が判断する（ADR-019）ので、スクリプトでは吸収しない。
- インターハイは**見出し行に左右のエントリー番号が印字されている**ので番号で直接対応する。
  **詳細はベスト8以降だけ**で、ゲームごとのポイントは `games` に入れる。**ポイントは10以上になる**（実測は `⑫ － 10` まで。変換表は⑳まで持つ）。
  **「打ち切り」の印字はあてにしない**（印字がある対戦と無い対戦がある）。勝者は本数の丸数字の有無で決める。
- インターハイの**対戦の塊は「－」の y 間隔で切る**（同じ対戦は約10pt・対戦の間は31pt）。
  **「打ち切り」の文字列が同じ対戦のゲーム行を1行ぶん押し下げて 20pt の隙を作る**ので、
  閾値は 25pt（`RUBBER_GAP`）。15pt だと1つの対戦が2つに割れ、1試合に4つ以上の塊が見つかる（2024 男子）。
- インターハイには**文字がアウトライン化された記録報告書**の年度がある（`pdftotext` が空・`pdffonts` も空・
  1文字＝1つの塗りパス）。列のx座標は同じなので骨格は流用でき、`highschool_championship_team_matches_outlined.py`
  が読む。この様式でだけ効く注意が4つ:
  **エントリー番号は塗り＋線（`'fs'`）**で、`'f'` だけ拾うと消える /
  **「打ち切り」の白い箱が下のゲーム行を覆う**ので、パスを1本ずつ白紙に描き直してから読む /
  **未実施の対戦は本数もゲームも印字されない**ので、対戦の区切りは氏名の行（3対戦×2人＝6行）で決める /
  **「一」は高さ0.8pt**しかなく、高さでふるうと氏名から抜ける。
- **ゲームごとのポイントがある様式では「ゲームとして成立する得点か」も見る**。
  通常のゲームは**4点先取・デュースはちょうど2点差**だが、**3-3 で迎える第7ゲームはファイナルゲームで
  7点先取**（`2 － ⑦` は正しい印字。4点のルールだけで見ると誤検知する）。
  丸数字の有無が合っていると本数の数え直しでは見つからない誤りが出る。
  **⑥と⑧は字形が近く**、アウトライン化PDFで1位と2位の差が 0.013 しかない実例があった。
  この検査は**出典の誤記でも鳴る**ので、止めずに報告する（令和7年度 女子で2件）。
- **アウトライン化PDFは字形辞書（字形→文字）で読む**。数字も氏名も同じ辞書を引くので、
  人が漢字を読むのは**辞書を作る一度だけ**。**辞書に無い字形は止める**（当て推量はしない）。
  辞書は「人が一度読んだ氏名」＋「details から分かる見出しの学校名」でラベルを作り、
  **1文字につき代表1つ**だけ入れて、入れなかった出現を全部引き直して確かめる。
  人の読み違いは、字形の一貫性（同じ字形を2つの字に読んでいないか）と名簿で見つかる。
- **出典の誤記は補正ファイルで直す**（印字が一致するときだけ当て、当てた箇所を毎回表示する）。
  読み取り側の誤りと取り違えないよう、拡大して確かめてから足す。

### 公式サイト（SPA）から読むとき

PDF ではなくブラウザの画面から読む大会がある（アジア競技大会2026 の公式リザルトサイトは Vue の SPA で、
日程データが HTTP の JSON として見えない）。手順は
[upcoming-tournaments-runbook.md](./upcoming-tournaments-runbook.md) S11。読み方の要点:

- **ページ遷移の完了を待たずに読むと、前のページの内容をそのまま読む**。1.4秒待っても起きる。
  **内容の検算は通ってしまう**（別の試合として整合しているため）。実際に男子A組の欄へ女子B組の試合が入った。
- 対策は**期待する識別子（国コード・選手名など）を先に渡し、読めた値と一致しなければ読み直す**こと。
  照合を入れた版では全試合が1回目で一致した。**SPA から読むときは必ず識別子照合を入れる。**
- 姓が3文字（`KIM` `LEE` `ALI`）だと国コードと区別できない。**文字の形で判定せず、種目から人数を決めて読み進める**。

## 名寄せとの連携

詳細は [team-player-identity.md](./team-player-identity.md) / [player-name-identity.md](./player-name-identity.md)。
取り込み側で守ること:

- **学校名**: `scripts/normalize-team-names.mjs` が `data/tournaments/team-name-aliases.json` で寄せる。
  **既定スコープは `highschool-japan-cup` のみ**なので、他大会は `--scope=<tournamentId>`（全部なら `--scope=all`）を明示する。
  対象は `participants[].team` / `prefecture` / `id` と `entries[].playerIds`（`id` を再計算して参照も張り替える）。
  JSON を再シリアライズせず元テキストへピンポイント置換するので整形が保たれる。冪等・`--dry-run` 可。
  **対応表そのものが正**（各エントリに `note` で判断根拠がある）。別団体・別校は入れない。
- **都道府県は省略しない**。`participants[].prefecture` は必ず正準形（接尾辞を付ける／地域接頭辞を付けない／NFKC）。
  連盟など県の代わりに入る値（`日本学連` / `学連` / `高体連` / `中体連` / `日本連盟`）と外国名はそのまま保持する。
  全大会への適用は `scripts/normalize-prefectures.mjs`（既定スコープ `all`・冪等・`--dry-run` 可。未解決値は警告）。
  **team には触れない**。
- このルールは取り込みツール側（`tools/shared/normalize-core.js`）でも強制する
  （連盟トークンに `県` を付けない／id 末尾が連盟なら prefecture として分離する。
  これを怠ると `学連県` や `中央大学_学連` のような汚染が生まれる）。
- **未解決警告は列ずれによるレコード破損のサイン**になる（氏名・チーム・県の手がかりから個別に修復する）。

### 国際大会（ローマ字表記のみの参加者）

コリアカップ等では `participants` がローマ字のみで、`team` も `JPN-1` のような代表内の仮ラベルになる。
選手同定は姓名の完全一致に依存するので、そのままでは既存の漢字データと紐付かない。

- **ローマ字→漢字の自動変換はしない**（同一読みに複数の漢字候補があり、同姓同名の別人と誤結合する）。
- 手動対応表 `data/tournaments/participant-aliases.json`（`tournaments[].years[].aliases[]` に
  `{ lastName, firstName, playerId, team? }`）。curated プロフィールと完全一致した分だけ収録し、残りは `unresolved[]`。
  読み込みは `lib/playerStats/participantAliases.ts` に集約し、大会・年度・姓名のスコープで引く。
- **id 解決はエイリアス優先**（`resolveAliasedPlayerId(...) ?? resolveNumericId(...)`）。
  逆順にすると、ローマ字名が `index.json` に別 id で登録されている場合に重複 id へ紐付く。
  **`reverseIndex.ts` と `facts.ts` の両方で同じ順序にすること**（片方だけ直すと、
  自分が対戦相手・パートナーとして現れる側だけローマ字表示が残る）。
- **対応表は `computeGlobalHash` の対象**なので、追記すれば prebuild の増分判定が自動で全再計算をトリガーする。
- 残課題: 旧パイプライン `generate-player-analysis.mjs` は対応表に非対応。

## 入力ツール（`tools/`）

1. `tools/index.html`（ハブ）で選手配列 JSON を貼り、形式（トーナメント / ラウンドロビン）を選ぶ
   （入力は localStorage 経由で各ツールへ渡る）。
2. `tools/tournament3` / `tools/roundrobin` でスコアを入力すると、出力欄に**成形済み JSON**（details 用の最終形式）が出る。
   保存はコピー / ダウンロード / フォルダ直接保存（Chrome 系）。
3. ラウンドロビン→トーナメント移行では RR の生結果を持ち越してマージしてから成形する。

- 成形の本体は `tools/shared/normalize-core.js`（ブラウザ・Node 両対応）。
  `scripts/normalize-to-participants-entries.cjs` は同じモジュールを呼ぶ薄い CLI ラッパー。
- **入力時の検証も同じモジュールを共有する**（`tools/shared/validate-entries.js`）。
  ツール側では `categoryId` を渡さず（localStorage に前回の種目が残っていて誤判定を招くため）、
  entries の多数派人数からシングルス/ペア戦を推定する。
- キーボードショートカット: `1`-`6` で0〜5点、`R` でリタイア、`Tab` で選手間、`I`/`M`(`↑`/`↓`) で試合間、
  `J`/`K`(`←`/`→`) で同一試合内、`PageUp`/`PageDown` でラウンド（グループ）間、`?` でヘルプ。
  `tools/tournament` / `tournament2` は共有パイプラインを通らない旧ツールで `tools/_archived/` へ移動済み。

### ドロー入力（結果を入れる前）

- **試合結果が無くても `entries` と `type` が出る**（`buildEntriesMeta()` がドローから直接組み立てる）。
  以前は `matches` から作っていたため、1回戦が不戦勝のシードが2回戦の結果を入れるまで現れなかった。
- **不戦勝の勝ち上がりを `matches` / `results` に出さない**（既定 ON）。パッキンを指定すると不戦勝どうしが
  当たり、1試合も行われていないのに対戦カードが確定してしまうため。
  **ただし「勝者が入っていれば出力する」判定が要る**——これが無いと、`extra`（足長）同士の対戦が
  勝者を入力しても永久に出力されず、**70試合が欠落して誤った大会インサイトが公開・取り下げになった**。
- **`entriesMeta` の選手を `participants` にも登録する**。これが無いと**シード・足長が `participants` から丸ごと消え**、
  出場者集合に依存するプレビューの4ブロックが同時に沈黙する（[news-context-blocks.md](./news-context-blocks.md) ⑥）。
  - **団体戦の id 規約に注意**。`participants` の id は `校名_都道府県`（`makeIdFromParts`）。
    `registerFromTeamString` は id を校名そのものにするので使ってはいけない。

## 地方大会候補検知（Deprecated・2026-09-12 停止）

都道府県公式サイトを巡回して結果資料のリンクを溜める仕組み（`scripts/crawl-local-tournaments.mjs` →
`detected-documents.json`）は**運用を停止した**。未仕分けの583件ごとストアを削除済みで、既定では巡回しない
（スクリプトは残っており、走らせれば再生成される）。理由は**出口が1種類しか無いまま入口だけ広げていた**こと
（[tournaments-local.md](./tournaments-local.md) / [ADR-001](../adr/ADR-001-local-source-detection-store.md)）。
`ignored-documents.json`（恒久 deny list）は残っている。

## Assumption

- 大会データ生成は手動補正込みのローカル運用。score 公開 JSON はデプロイ前のスナップショット生成物。
- 結果 PDF に勝者の本数が印字されない年度は、ラウンド別の規則で補完している（全中の団体戦など）。
  **根拠と適合率を必ず残すこと。**

## Open Questions

- tournament details 生成の標準手順はどのスクリプト列か。
- players 生成で最終的に正とする入力源はどれか。
- どこまでが自動生成で、どこからが手修正か。

## 関連

- [pdf-import.md](./pdf-import.md) — PDF の読み取りと検算
- [data-model.md](./data-model.md) — データの形 / [deployment.md](./deployment.md) — prebuild の全段
- [team-player-identity.md](./team-player-identity.md) / [player-name-identity.md](./player-name-identity.md) — 名寄せ
- [tournaments-local.md](./tournaments-local.md) — 地方大会の掲載運用
