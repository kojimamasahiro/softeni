# チーム・選手の名寄せと識別

大会結果データ（`data/tournaments/details/**`）の表記揺れを正準化し、チーム／選手を一意に
識別するための仕組みと運用をまとめる。設計の経緯・判断は
`docs/raw/2026-06-26-team-identity-design.md` を参照。

## 全体像

- **都道府県**: 47都道府県の正準形へ正規化（接尾辞・地域接頭辞・外国名・崩れ字を吸収）。
- **チーム**: NFKC で安全な揺れを畳み、人手レビューで略称・省略を `team-name-aliases.json` に
  集約 → 大会データへ適用。`data/teams/teams.json` を連番idのマスタとして生成。
- **選手**: 氏名ベースの id（`data/players/index.json`）を基本とし、確実な同姓同名の別人だけ
  `data/players/homonyms.json` でチーム単位に分割。

## 都道府県の正規化

- スクリプト: `scripts/normalize-prefectures.mjs`（既定スコープ `all`、冪等、`--dry-run` 可）。
- ルール（`participants[].prefecture` は必ず正準形・省略しない）:
  - 接尾辞（都/道/府/県）を必ず付ける（`徳島`→`徳島県`、`東京`→`東京都`）。
  - 地域接頭辞を付けない（`関東・埼玉県`→`埼玉県`）。NFKC で全角半角・区切り（`•`→`・`）統一。
  - 崩れ字・OCR は明示マップで復元（`奈川県`→`神奈川県`、`愛緩県`→`愛媛県` 等）。
  - 県でない値（連盟・外国）は「別の都道府県扱い」の値として保持（`日本学連` `高体連` `韓国` 等）。
- `participants[].id`（`姓_名_team_都道府県`）と `entries[].playerIds` も追従。
- 一括修復済みデータバグ: **primaryschool-championship 2024** は全3,244人が開催地の `秋田県`
  になっていた。他大会から各チームの実県を復元（2,226件）、復元不可は `null`（1,018件）。

## チームマスタ `data/teams/teams.json`

- 生成: `scripts/build-team-master.mjs`。`{ id(連番), name(最頻出表記), prefecture, count, aliases?, reviewPrefectures? }`。
- `prefecture` は実県の最頻値だが、**実県カバー率が低いチーム（大学・連盟系など）は信頼できない
  ため null**（社会人/学校は県が安定するので付与される）。
- id は count 降順→名前で決定的に採番（再生成で安定）。
- 文脈サイドカー `data/teams/team-context.json`（id→選手名/年範囲/主な大会/ジャンル/大会インスタンス）。
  レビューと自動判定に使用。

## 機械的な揺れの正準化（データ本体）

`scripts/normalize-team-spacing.mjs`: NFKC で同一になる生表記（全角半角・スペース・中黒記号の差）を
大会データ本体で**最頻出の表記へ寄せる**（人手不要・冪等）。例: `one team`/`oneteam`→`one team`、
`Up Rise`/`UpRise`→`Up Rise`、`ＵＢＥ`/`UBE`→片方へ。`team`/`id`/`playerIds` を追従。
注意: **大文字小文字差は NFKC で畳まれない**（`UpRise`≠`Uprise`）。必要なら別途対応。

## チーム名寄せの運用

正準名の対応表 `data/tournaments/team-name-aliases.json`（`canonical ← aliases`）に人手判断を
蓄積し、大会データへ適用する。

1. **候補生成** `scripts/build-team-merge-candidates.mjs`: 県内ブロックで接尾辞除去後のコア一致を
   抽出（高校/中学校/中/少年団/各種クラブ等を除去、付↔附を同一視）。`data/teams/merge-candidates.json`。
2. **レビュー** `scripts/build-team-review-html.mjs` → `data/teams/team-merge-review.html`
   （ブラウザでクリック判断）。各メンバーに選手名・年・大会を表示。
   - **自動判定（大会の共起ベース）**: ジャンル（出場大会の段階）が違えば自動で別チーム。
     同一グループ内で2表記が「同一大会(大会id+年)」に同居していれば要確認、そうでなければ自動OK。
   - 段階ジャンルは大会から判定（`team-context.json` の genres）。**社会人とシニアは同じ成人
     カテゴリに統合**（同一人物が両方に出るため）。
   - 「確認済にする」を押したものだけが反映対象。判断は localStorage に保存。
3. **反映**:
   - サーバ方式（保存ボタンで即反映）: `node scripts/team-review-server.mjs` →
     `http://localhost:5173` でレビュー →「確認済を反映」で `apply-team-aliases.mjs` 経由で
     alias 反映＋マスタ再生成。
   - ファイル方式: 書き出した `team-alias-additions.json` を
     `node scripts/apply-team-aliases.mjs <file>`。
   - 自動OK一括: `node scripts/apply-auto-merges.mjs`（自動OKクラスタの統合を一括反映）。
4. **データへ適用** `scripts/normalize-team-names.mjs --scope=all`: alias を `team`/`id`/`playerIds`
   へ反映（**NFKC照合**。全角半角差の別名も取りこぼさない）。冪等・`--dry-run` 可。

注意: `apply-team-aliases.mjs` は競合（ある別名が別の正準名に割当済 等）を取り込まずに報告する。

## 選手の別人判定 `data/players/homonyms.json`

- 基本は氏名ベース id（`data/players/index.json`、team非依存）。同姓同名の別人だけ分割する。
- 生成: `scripts/build-player-homonyms.py`。
- **別人とみなす根拠**: 同一年に「**非隣接の学校段階**」（小↔高 / 小↔大 / 中↔大 / 高↔成 等＝
  物理的に不可能）が共存する氏名のみ。隣接段階（中3→高1 等の卒業境界）は同一人物として除外。
- **識別キーはチーム**: 1人＝氏名＋その人のチーム集合。参加者は `(氏名, チーム)` で person に解決。
  割り当ては「同一チーム／共通の相棒（ダブルスペア）／段階進行」で同一人物へ寄せ、衝突は別人。
- 中間段階の所属が曖昧・3人以上等は `needsReview: true`。2026-06 時点で確実な別人 **16名**を登録。
- 限界: **同じ学校に別々の年に在籍した同姓同名**（同年に重ならない）は段階もチームも同じため
  自動では分けられず、1人に残る。

## 実行順序（フル再構築）

```
node scripts/normalize-prefectures.mjs          # 県の正準化
node scripts/normalize-team-spacing.mjs         # 全角半角・スペース揺れの正準化
node scripts/normalize-team-names.mjs --scope=all  # alias をデータへ適用
node scripts/build-team-master.mjs              # teams.json + team-context.json
node scripts/build-team-merge-candidates.mjs    # merge-candidates.json
node scripts/build-team-review-html.mjs         # レビューHTML
python3 scripts/build-player-homonyms.py        # homonyms.json
node scripts/check-identity-health.mjs          # 未対応項目のヘルスチェック
```

## 運用: 対応忘れを防ぐヘルスチェック

`scripts/check-identity-health.mjs` が、人手対応が必要な未処理項目を1か所に件数つきで一覧する
（問題があれば終了コード 1。CI・定期実行のゲートに使える）。**新データ取り込み後に必ず実行**する。
検出項目と対応:

- 未解決の県値 → `normalize-prefectures.mjs` の明示マップに追加、または列ずれ破損レコードを手動修復。
- playerIds 参照切れ / id 重複 → 該当レコードを手動修復。
- 別名のまま残る出場 → `normalize-team-names.mjs --scope=all` を実行。
- 自動OK可の未統合候補 → `apply-auto-merges.mjs` を実行。
- 要人手レビュー候補（同一大会同居等）→ レビューHTMLで同一/別を判断。
- 同名別校の疑い（reviewPrefectures）→ 参考表示。別チームでよければ放置可。
- 未登録の同姓同名（同年×非隣接段階）→ `build-player-homonyms.py` で再生成し確認・登録。

検出できないもの（信号が無い）: 内部略称（理大/理科大）と、同じ学校に別々の年に在籍した同姓同名。
これらは外部情報や気づきに依存する。

## 既知の残課題

- チーム名の内部略称（例: `岡山理大附` ↔ `岡山理科大附高校` の 理大／理科大）はコア一致で拾えず
  手動残務。部分列一致は誤爆（鹿児島実/鹿児島商 等）のため不採用。
- 同一大会に同居する同一チームの綴り違い（共起ルールで「要確認」に回るが実は同一）の追い込み。
- `homonyms.json` をアプリの選手解決（`(氏名, チーム)`→person）へ統合する実装。
- 岡崎紗奈の `焼津`(静岡) と `常磐大学高校`(茨城) が同一人物（転校）か別人かは未確定。
