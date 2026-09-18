# チーム・選手の名寄せと識別

> **適用範囲: 混在**。「照合と表示を分ける」「機械は提案まで・統合は人が決める」「判断を台帳に残す」は汎用。
> 学校名・大会名の具体はソフトテニス固有。
> **2026-09-18 に現在の仕様だけへ圧縮した。** 監査設計の経緯・不具合の調査記録・実測値・個別事例は
> [raw/2026-09-18-wiki-archive-team-player-identity.md](../raw/2026-09-18-wiki-archive-team-player-identity.md)。

大会結果データ（`data/tournaments/details/**`）の表記揺れを正準化し、チーム／選手を一意に識別する仕組みと運用。

| 対象 | やり方 | 対応表 |
|---|---|---|
| 都道府県 | 47都道府県の正準形へ正規化（接尾辞・地域接頭辞・外国名・崩れ字を吸収） | `scripts/normalize-prefectures.mjs` の明示マップ |
| チーム | NFKC で安全な揺れを畳み、略称・省略は人手レビューで集約 → データへ適用 | `data/tournaments/team-name-aliases.json` |
| 選手 | 氏名ベースの id を基本にし、確実な別人だけ分割 | `data/players/homonyms.json` |
| 姓名の分割 | 取り込み由来の切り位置ゆれ（`谷\|明日里` / `谷明\|日里`）を人手判断で集約 | `data/players/name-split-aliases.json` |

## 都道府県の正規化

`scripts/normalize-prefectures.mjs`（既定スコープ `all`、冪等、`--dry-run` 可）。
`participants[].prefecture` は**必ず正準形で省略しない**。

- 接尾辞（都/道/府/県）を必ず付ける。地域接頭辞は付けない（`関東・埼玉県`→`埼玉県`）。NFKC で統一。
- 崩れ字・OCR は明示マップで復元（`奈川県`→`神奈川県` 等）。
- 県でない値（連盟・外国）は「別の都道府県扱い」の値として保持（`日本学連` `高体連` `韓国` 等）。
- `participants[].id`（`姓_名_team_都道府県`）と `entries[].playerIds` も追従する。
- **「1ファイル内の `prefecture` が1種類しか無い」を疑うこと**——開催地が全員に流し込まれた形の
  データバグが大会単位で再発している（復元は他大会から同一人物の県の最頻値で行う）。

## チームマスタ `data/teams/teams.json`

生成は `scripts/build-team-master.mjs`。`{ id(連番), name(最頻出表記), prefecture, count,
boysCount?, girlsCount?, mixedCount?, aliases?, reviewPrefectures? }`。

- **男女別の収録数**は大会ファイル名（カテゴリID）の `-` 区切り**最後のセグメントを厳密一致**で判定する
  （部分一致だと `tournament` の `men` に誤ヒットする。`parseGenderFromCategory` と同じ規約）。
  ミックスは boys/girls に寄せず別に数える（ミックス種目にしか出ていないチームがある）。
- **表示名の全角ASCIIは半角へ寄せる**（`ＹＫＫ`→`YKK`）。NFKC ではなく U+FF01–FF5E 限定の変換
  （NFKC は半角カナ→全角カナ、㈱→(株) も巻き込む）。**大会データ本体は書き換えない**（表示名のみ）。
- `prefecture` は実県の最頻値。**カバー率が低いチーム（大学・連盟系）は信頼できないので null**。
- **id は位置で振る**（count 降順→名前）。**alias を反映してマスタを作り直すと id が総入れ替わりになる**ので、
  id を他の場所のキーにしてはいけない。
- 文脈サイドカー `data/teams/team-context.json`（id→選手名/年範囲/主な大会/ジャンル）をレビューと自動判定に使う。

## 機械的な揺れの正準化（データ本体）

`scripts/normalize-team-spacing.mjs` が NFKC で同一になる生表記（全角半角・スペース・中黒の差）を
**最頻出の表記へ寄せる**（人手不要・冪等・**prebuild で自動実行**）。`team`/`id`/`playerIds` も追従。

- **大文字小文字差は NFKC で畳まれない**（`UpRise`≠`Uprise`）。
- **頻度依存なのでデータが増えると採用表記が入れ替わりうる**。固定したいなら alias 表に canonical として書く。

## 異体字・旧字体（照合と表示を分ける）

NFKC は**字体差を畳まない**（`鄉`≠`郷`、`髙`≠`高`、`﨑`≠`崎`）ので、字体だけ違う同一チームが分裂する。

| 用途 | 方式 | 理由 |
|---|---|---|
| 照合（マージ候補の検出） | 新字体へ畳む（`scripts/lib/kanji-variants.mjs`） | 機械的・再現可能。取りこぼしを無くす |
| 表示（canonical） | **正式名称** | 公開サイトなので正確さ・検索流入を優先 |

- 照合キーの算出は `scripts/lib/team-core.mjs`（`teamCore()`）に集約する。
  **`build-team-merge-candidates.mjs` と `check-identity-health.mjs` は必ず同じ定義を使うこと**
  （各自複製した結果、ヘルスチェックが未統合候補を過少報告した実績あり）。
- **この畳み込みは候補検出専用**。データ本体を自動で書き換えてはいけない（正式名称に旧字体を使う学校がある）。
  表示まで新字体に統一するのは**不採用**（`國學院大學`→`国学院大学` は正式名称と乖離する）。
- **canonical は「正式名称」を採る**（最頻出表記は初期候補にすぎない）。canonical は alias 表に固定されるので
  後から出現数が逆転しても入れ替わらないが、**`normalize-team-names` を流さずに `build-team-master` だけ回すと
  表示名が alias 側に振れる**（下記の実行順序を守る）。
- 対応表には「明らかに同字の異体字」だけを入れる。

## チーム名寄せの運用

**機械は候補と既定グループの提案までで、統合の引き金は人だけ**（[ADR-019](../adr/ADR-019-team-merge-human-only.md)）。
機械だけで決めた統合を全件点検したところ**半分以上が誤統合**だったため、2026-09-12 に自動統合を廃止した。
`prebuild` にも CI にも統合処理は無く、`applyAdditions()` の呼び出し元は
`apply-auto-merges.mjs`（人の判断のみ適用）と `team-review-server.mjs`（人の操作）の2つだけ。

1. **候補生成** `scripts/build-team-merge-candidates.mjs` → `data/teams/merge-candidates.json`。
   - `signal: "core"`: 県内ブロックで接尾辞除去後のコアが完全一致（NFKC＋異体字を畳む）。
   - `signal: "players"`（[ADR-017](../adr/ADR-017-team-merge-signal-player-overlap.md)）: **同一年度に同じ氏名の選手が
     2チームへ出場**し、共有が2名以上。名前の類似度を使わないので、コア一致の盲点である**語中の脱落**
     （`岡山理大附` ⇔ `岡山理科大附高校`）に届く。偽陽性（同年に両方へ登録される別チーム）があるので
     **このシグナルのクラスタは自動OKに載せず常に人手レビュー**。
2. **レビュー** `npm run team:review`（レビューHTML生成＋サーバ）→ `http://localhost:5173`。
   - **裏付けの無い統合は通さない**。出場大会の記録が無い（`genres` が空の）メンバーが混じるクラスタは
     名前だけを根拠に統合することになるので人手へ回す。
   - **既定グループ分けは名前から読める段階を、出場大会のジャンルより優先する**
     （`level(name) ?? memGenre(...)`）。名前は**その団体が何と名乗っているか**そのもので、出場大会からの推定より強い。
     人が示した規則: **小学・中学・高校は同時に発生しない**（段階が違えば必ず別チーム）/
     **「学校」と付く名前とクラブ・STC は別** / 正式名称と略称は同一でよい。
     この判断は `scripts/lib/team-grouping.test.mjs` に固定してあり CI で回る。**規則を変えるならテストを先に更新する。**
   - **規則は判断の代わりにならない**（`淡路クラブ ← 淡路ジュニアクラブ` は同一、`佐賀クラブ ← 佐賀ジュニア` は別）。
     規則は「明らかに別のもの」を止める道具として使い、残りは人に回す。
   - **判断は `data/teams/review-decisions.json`（判断台帳）に保存する**（localStorage は作業用キャッシュ）。
     キーは**メンバー名を正準化して連結したもの**（`clusterKey`）。「統合しない」も `verdict: "separate"` として残し、
     機械が何を提案していたか（`proposedAutoOK`）と誰が決めたか（`decidedBy`）も持つ。
   - **台帳を引くときは `decisions[key]` を直接見ず、必ず `findDecision(members, decisions)` を通すこと**。
     クラスタの顔ぶれが変わるとキーが変わって過去の判断が引けなくなるため、上位集合の記録から投影して引き継ぐ。
   - **候補とチームマスタの id は必ず揃える**。マスタだけ作り直すと候補の旧 id が別チームを指し、
     レビュー画面の文脈（選手名・年・大会）が静かに嘘になる。検査は `npm run check:team-id-alignment`。
3. **反映**: サーバ方式の「確認済を反映」（台帳へ保存＋alias 反映＋マスタ・候補・画面の再生成）か、
   `node scripts/apply-team-aliases.mjs <file>`。人の判断の一括反映は `node scripts/apply-auto-merges.mjs`
   （**台帳に `decidedBy:"human"` かつ `verdict:"merge"` の判断だけ**を反映する。`--dry-run` あり。
   候補と `teams.json` の id がずれていたら実行を中止する）。
4. **データへ適用** `scripts/normalize-team-names.mjs --scope=all`（alias を `team`/`id`/`playerIds` へ反映。
   NFKC 照合・冪等・`--dry-run` 可）。

注意:

- `apply-team-aliases.mjs` は競合（別名が別の正準名に割当済 等）を取り込まずに報告する。
- **canonical が「最頻出表記」で自動決定される**ため、全角表記や略称が canonical に選ばれることがある。
  実行後は追加された canonical を必ず目視する。
- **統合済みのクラスタはレビュー画面に二度と出ない**（片方の表記が候補から消えるため）。
  誤統合の修正は `scripts/undo-team-merge.mjs`（git 履歴から復元）で行う。
- 残る事故の余地は**レビュー画面で中身を見ずに「確認済を反映」を押すこと**（機械の提案がそのまま入る）。

### 誤って適用した統合を戻す

統合は alias を当ててデータ本体を書き換えるので元の名前は現在のデータに残らないが、**git 履歴から復元できる**。
戻すときは次の3つを必ず揃える（1つでも欠けると戻らないか再発する）。

1. details の表記を戻す（id ごと置換すれば `playerIds`・`matches` の参照も直る）
2. alias 表から該当の別名を外す（残すと次の `normalize-team-names` で再統合される）
3. 判断台帳へ `decidedBy:"human"` / `verdict:"separate"` と記録する（残すと機械が再び提案する）

落とし穴: **`git log -S` は引用符込みで引く**（素の `南方` は `南方JST` にも当たる）/
**チーム名の比較は必ず NFKC 正規化を挟む**（全角と半角で本人を特定できず、修復ツールが黙って素通りする）/
**台帳の記録とデータの実態はずれうる**（既に正しい名前へ移っていることがある）。

### 対応表へ統合を反映するとき

- 人が「A と B は同じ」と判断しても、**B がそれ自体で別グループの正準名だと `applyAdditions` は弾く**。
  `apply-auto-merges.mjs` は `absorbCanonical: true` で相手グループごと吸収する。
- **吸収は相手グループの別名を全部引き取る**ので、同じ判断の中で別グループに置いた名前まで巻き込む。
  防止のため `forbid`（canonical と別グループのメンバー）を渡す。
- **適用ツールの出力は全件読む**。`適用 / スキップ / 競合` の3つとも読むこと（末尾だけ見て成功と誤報告した実例あり）。
  **dry-run に出ない副作用（吸収の中身）は、本番ファイルを退避して試算し必ず復元する。**
  適用後は「旧名がデータ本体に残っていないか」「意図しない名前が別名に入っていないか」を数える。

### alias の大会スコープ `scope`（[ADR-013](../adr/ADR-013-scoped-team-name-aliases.md)）

alias 表は文脈を持たないので、`--scope=all` で全大会へ流すと壊れるエントリがある。

```json
{ "canonical": "昇陽中学校", "aliases": ["昇陽"],
  "scope": { "tournamentPrefix": ["secondaryschool-", "zennihon-secondaryschool"] } }
```

- `scope.generation` / `scope.tournamentPrefix` / `scope.prefecture`（**参加者の都道府県**。これだけ参加者単位で効く）。
  複数あれば AND。**`scope` 無しは全大会に適用**（後方互換）。同じ別名を別 canonical へ割り当てるのは
  **双方が `scope` を持つ場合のみ**許可し、解決時は `scope` 付きを先に評価する。
- `scope` が要るのは3パターン: ①中学・クラブの文脈でだけ正しい略称（`日高` `名寄` `春日部` 等。
  **社会人クラブの略称も入る**）②中高一貫校（`昇陽` `明徳義塾` 等。素の略称が高校側の canonical でありながら
  中学の大会では中学校を指す。`generation` では足りず `tournamentPrefix` で限定する）
  ③同名の別団体が他県にもある（`野木` は**大会の系統で指すものが変わる**ので `tournamentPrefix` × `prefecture`）。
- **`scope` の付け忘れは、付け忘れた時点では検出できない**（その大会データをまだ取り込んでいなければ何も起きない）。
  実際、あとからインターハイを取り込んだ瞬間に高校が中学校名へ書き換わった。
  → **新しい年度・カテゴリを取り込んだら `normalize-team-names.mjs --scope=all` の差分を必ず目視する。**
  中学校名・小学校名・クラブ名へ寄る改名が高校/一般の大会ファイルに現れたら、ほぼ確実に `scope` の付け忘れ。
  検出は**差分の `"team"` 値を集計し、増えた側に 中学/クラブ/高校 の接尾辞が付いたものを見る**。
- 素の略称を alias にするときは、**その名前が他の generation に出現しないかを必ず確認する**
  （`participants[].team` を `generationId` で集計する）。
- `normalize-team-names.mjs`（`scopeMatches`）と `check-identity-health.mjs`（`scopedAliasLeft`）は
  **必ず同じ規約で解釈する**。`apply-auto-merges.mjs` は `scope` を出力しないので、その結果は人手確認が要る。

### 名前そのものが衝突する型

- **チームマスタの canonical が高校と大学で衝突する**（`北科大` ＝北海道科学大学高校／北海道科学大学）。
  素の表記がマスタの canonical と完全一致するので **alias 表では防げない**。
  対処は**大学側を正式名称で入れる**こと（高校側の canonical を変えると高校大会の全データに影響する）。
  同型は「`prefecture` が `日本学連` なのに `teams.json` に同名がある」参加者を洗えば列挙できる（未実装）。
- **素の名前に高校と中学が同居する**（`小城`）。alias を外しても分離できず、scope 付き別名が要る。**未対応**。
- **棚卸しの母集団を「専用大会」にしない**。大学生は一般大会にも出るので、大学専用大会だけを見ると取りこぼす。
  母集団は「そのカテゴリの所属として現れる全出場」にする（大学なら `prefecture` が `日本学連` / `学連`）。
  適用後に `build-team-master.mjs` を回して**もう一度点検する**。
- **先頭1〜2文字の脱落**（`岡大学` ← 福岡大学）は通常の正規化では別キーのまま残り、表記ゆれとして検出されない。
  「他のチーム名の末尾一致／先頭一致の断片になっている名前」を探すと拾え、確定は**同一選手が他の年に
  正準名で出場しているか**で行う。

## 表記の欠落（先頭・末尾1文字）の検出と修正

PDF 取り込みで名前の一部が落ちたまま公開データに入ることがある。表記ゆれと違い**別チームとして実体が登録され**、
公開ページにも出るので実害が大きい。

- **見つけ方**: ①**PDF と突き合わせる**（唯一確実な方法。公開済みの大会でも `scripts/pdf-to-players/` で
  抽出し直して比較すると当時の誤りが出る）②チームマスタの総当たり（「1文字足すと別の既存チーム名になる」組を、
  同一県かつ短い側の出現数が1/3以下に絞る）。**②には原理的な穴がある**——正しい表記がデータ中に1件も無ければ
  対にならず絶対に出てこない。
- **裏の取り方**（いずれかが取れたものだけ直す）: 同じ選手が両表記で登場する（最も強い）/
  同一ファイルに両表記が並ぶ / 正しい表記がデータ中に1件も無く、短い方が名前として成立しない。
  **確証が無いものは直さない**（正当な略称や別クラブの可能性がある）。
- **alias 表自体が誤りを固定していることがある**（誤った表記が canonical になっていた実例あり）。
  誤りを見つけたら alias 表に正準名として登録されていないかも必ず確認する。
- 修正後は下記の実行順序に従う。特に `npm run playerstats:facts`（チーム名を焼き込んでいる）と
  `npm run secondaryschool:build`（**pykakasi が要る**。`PATH="$PWD/.venv/bin:$PATH"` で通す）を忘れない。

## 選手の氏名まわり

姓名の分割ゆれ・改名・同姓同名の別人判定（`homonyms.json`）・チーム年度別メンバーの pid 重複は
[player-name-identity.md](./player-name-identity.md) に分けた。

## 実行順序（フル再構築）

```
node scripts/normalize-name-splits.mjs             # 姓名の分割ゆれ
node scripts/normalize-prefectures.mjs             # 県
node scripts/normalize-team-spacing.mjs            # 全角半角・スペース（prebuild でも自動実行）
node scripts/normalize-team-names.mjs --scope=all  # alias をデータへ適用
node scripts/build-team-master.mjs                 # teams.json + team-context.json
node scripts/build-team-merge-candidates.mjs       # merge-candidates.json
npm run team:review                                # レビュー（判断は台帳へ）
python3 scripts/build-player-homonyms.py           # homonyms.json
npm run playerstats:facts                          # .playerstats/_facts の再生成
node scripts/check-identity-health.mjs             # ヘルスチェック
```

**`normalize-team-names` → `build-team-master` の順序は必須**（逆順・片方だけだと表示名が alias 側に振れる）。
`.playerstats/_facts/**` はチーム名を焼き込んでいるので、名寄せ後に再生成しないと**画面上は分裂したまま**になる。

## 対応忘れを防ぐヘルスチェック

`scripts/check-identity-health.mjs`（問題があれば終了コード 1）。**新データ取り込み後に必ず実行**する。
検出項目と対応: 未解決の県値 → 明示マップに追加 / playerIds 参照切れ・id 重複 → 手動修復 /
別名のまま残る出場 → `normalize-team-names --scope=all` / 未統合候補（コア一致・選手共有）→ `npm run team:review` /
同名別校の疑い → 参考表示 / 未登録の同姓同名（D・E・F）→ `build-player-homonyms.py` で再生成 /
名が未分割の同姓衝突 → 同姓同名ではなく**取り込み元の氏名分割の不備**なので該当データを直す。

- **姓名の分割ゆれはこのスクリプトでは検出できない**（`check-name-splits.mjs` の担当。両方実行する）。
- 検出できないもの: 同じ学校に別々の年に在籍した同姓同名 / **同年に両表記へ出た選手が1人も居ない表記揺れ** /
  同世代かつ同一都道府県の同姓同名 / `kanji-variants.mjs` の対応表に無い字体。**数字は常に下限。**

## 既知の残課題

- `homonyms.json` をアプリの選手解決（`(氏名, チーム)`→person）へ統合する実装。
  登録を増やしても統合実装が無ければ画面は変わらない。
- 同一大会に同居する同一チームの綴り違い（共起ルールで「要確認」に回るが実は同一）の追い込み。
- `福誠` ⇄ `誠修`（福岡）の改称の可能性が未確認。岡崎紗奈の `焼津`(静岡) と `常磐大学高校`(茨城) が
  同一人物（転校）か別人か未確定。
- **`神戸松陰大学`（陰）は `神戸松蔭大学`（蔭）の異体字**（alias 追加 → `normalize-team-names` → `build-team-master` が要る）。
- 表記の欠落の保留: `市立柏` ↔ `柏市立柏`（正当な略称でありうる）/ `出雲JST` ↔ `東出雲JST`（別クラブの可能性）。
- 素の名前に高校と中学が同居する `小城`（上記）。
- `auto/separate`（統合し損ねている方向・安全側）が未確認で残っており、全数を見るには多すぎる。抜き取りが効くのはこちら。

## 関連

- [ADR-013](../adr/ADR-013-scoped-team-name-aliases.md)（alias の大会スコープ）/
  [ADR-017](../adr/ADR-017-team-merge-signal-player-overlap.md)（選手共有シグナル）/
  [ADR-019](../adr/ADR-019-team-merge-human-only.md)（統合は人が決める）/
  [ADR-014](../adr/ADR-014-pathway-name-match.md)（進路の氏名一致）
- [data-model.md](./data-model.md) / [data-import.md](./data-import.md) / [players-pages.md](./players-pages.md) /
  [secondaryschool.md](./secondaryschool.md) / [open-questions.md](./open-questions.md)
- 設計の経緯: `docs/raw/2026-06-26-team-identity-design.md` /
  [同姓同名の実測](../raw/2026-07-26-homonym-measurement.md) /
  [姓名分割の全数調査](../raw/2026-08-29-name-split-audit.md) /
  [大学チーム名の棚卸し](../raw/2026-08-12-university-team-name-cleanup.md)
