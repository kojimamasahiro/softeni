# アイデア: 日本体育大学の独自ページ（/teams/nssu/）と大学カテゴリの関係

## 状況

Idea Backlog。**検討中・未着手（2026-09-13 起票）**。大学カテゴリ（`/university`）を実装した直後に、
ユーザーが「日本体育大学は `/teams/nssu/` を独自に持っている。どうするのがいいか」と指摘した。

## 目的

大学のページが2系統に分かれている状態を整理する。

- `/teams/nssu/`（と年度別の `/teams/nssu/[year]/[gender]/`）: 大学で唯一の個別ページ。
  `team-name-mappings.json` の `nssu`（`日本体育大学` / `日体大`）で全収録大会から集計し、
  大会別成績・年度別メンバー・FAQ を持つ。トップページの「所属別成績」からもリンクしている
- `/university/pathways/[gender]/#u-日本体育大学`（2026-09-13 新設）: 大学別の出身高校

## わかっていること（2026-09-13 実測）

- **`/teams` のチーム一覧で `日本体育大学`（収録929試合・全チーム中1位）の行にリンクが付いていない。**
  一覧のリンク解決（TeamLink 規則・D-025）は「STリーグ → 高校の学校ページ」だけで、
  `team-name-mappings.json` 由来のページを見ていないため。mapping 67チームのうち STリーグに出ていないのは
  日本体育大学だけなので、**実害はこの1件**
- 大学カテゴリ側からは既に繋がっている: `/university/pathways/[gender]/` の見出し「日本体育大学」は
  `/teams/nssu/` へリンクする（`lib/university.ts` `getUniversityTeamHref`）
- 逆方向（`/teams/nssu/` → 出身高校一覧）のリンクは無い
- `/teams/nssu/` はパンくずが「チーム一覧」配下で、大学カテゴリには属していない

## 意見（Claude・2026-09-13）

**`/teams/nssu/` は URL を変えずに残し、大学カテゴリと相互リンクで繋ぐのがよい。** 移設・統合はしない。

1. **URL を動かさない**。インデックス済みでトップからもリンクしている唯一の大学ページで、
   `/university/nssu/` に移すとリダイレクトと評価の引き継ぎが必要になる割に、読者に見える差が無い
2. **大学の個別ページは今後も `/teams/[teamId]` 型に寄せる**。大学を1校足すなら
   `team-name-mappings.json` にキーを足すだけで同じ構成のページができる
   （2026-08-12 の検討で「最小スコープのチームページ追加」として挙がっていた案）。
   `/university/[teamId]` の新ツリーは、地域軸（学連）の判断が要るうえ nssu と二重になる
3. 足りないのは導線だけ:
   - `/teams` 一覧の TeamLink に「mapping ページがあればそこへ」を足す（日本体育大学の行にリンクが付く）
   - `/teams/nssu/` に「日本体育大学の選手の出身高校（男子/女子）」への導線を足す
   - `/university/` の大学一覧で、個別ページのある大学に「成績ページ」リンクを出す

## 課題・未解決

- 他の大学にも `/teams/[teamId]` を作るか。作るなら閾値（試合数）と対象校の選び方。
  中学カテゴリでは閾値5回で343チームだった。大学は閾値5で134校（2026-08-14 実測）
- `/teams/nssu/` を大学カテゴリのパンくず（ホーム > 大学生 > 日本体育大学）に載せ替えるか。
  `/teams` 配下のページはパンくずが共通なので、大学だけ変えると例外になる
- 改称校（神戸松蔭など）を個別ページ化するなら、mapping で旧称を束ねられる（`nssu` が `日体大` を束ねているのと同じ）。
  open-questions の「改称した大学を1校にまとめるか」と一緒に決められる

## 目指したい方向性

導線3点（上の「意見」3）は小さく、判断が要らないので先にやってよい。
他大学の個別ページは、大学カテゴリの効果（GSC）を見てから決める。

## 関連

- [../wiki/university.md](../wiki/university.md) — 大学カテゴリ
- [../wiki/public-pages.md](../wiki/public-pages.md) — `/teams` の TeamLink 規則（D-025）
- [2026-08-12-idea-university-category-pages.md](./2026-08-12-idea-university-category-pages.md) — URL 設計の未決（`/university/**` か `/teams/[teamId]` か）
- [2026-09-13-idea-teams-index-junior-links.md](./2026-09-13-idea-teams-index-junior-links.md) — 同じ TeamLink 規則を触る姉妹アイデア
- `src/pages/teams/index.tsx`（`TeamCell`）/ `src/pages/teams/[teamId]/index.tsx` / `data/teams/team-name-mappings.json`

## Compile Log

- 2026-09-13 作成。wiki へは public-pages.md の Idea Backlog に1行、idea-backlog.md の公開ページ行に要約を追加。
- wiki に入れなかったもの:
  - 「意見」の3つの理由の詳細 — 未決定の提案なので wiki には結論1行のみ
  - 閾値5で134校という数値 — 2026-08-14 時点の値で、再計測してから使うべきため

---

## 追記（2026-09-14）: 一覧のリンクを直し、他大学のページ化を検討

- 「意見」3の1つ目（`/teams` 一覧から日本体育大学へリンク）は実装済み（`/teams` の TeamLink が mapping を見るようにした）
- ユーザー発言: 「teams/配下に日本体育大学のように他の大学のページも作りたいがどうか」
  → 本ノートの推奨（大学の個別ページは `/teams/[teamId]` 型に寄せる）と同じ方向

### 他大学を `/teams/[teamId]` にする場合に分かっていること（2026-09-14 実測）

- 仕組み: `team-name-mappings.json` にキー（URL の slug）と表記の配列を足すだけで、
  `/teams/[teamId]/`（年度別メンバー・大会別成績・FAQ）と `/teams/[teamId]/[year]/[gender]/` が生成される。
  チーム名の照合は mapping による**完全一致**（部分一致ではない）なので、`明治大学` が付属高校を拾う心配は無い
- 規模: 大学らしい名前で都道府県が null のチーム（`teams.json`）は、収録試合数
  5以上154校 / 20以上114校 / 50以上75校 / 100以上39校 / 200以上23校
- 年度別ページは1校あたり約20枚（日本体育大学・早稲田大学とも20）。50以上の75校なら**約1,500枚増える**見込み。
  薄いページは既存の `shouldIndexTeamPage`（5試合未満 noindex）で自動的に sitemap から外れる
- ビルド時間: `aggregateTeamResults` は1校あたり約70ms（初回のみ約500ms）。年度別ページの getStaticProps が
  毎回集計し直すかは未確認で、**増分は未計測**（Assumption: 数分程度）
- slug は手で決める必要がある（`nssu` のような英字）。中学・小学生のような pykakasi 自動生成だと
  `wasedadaigaku` のような読みにくい slug になる
- 大学カテゴリ側は自動で繋がる: `/university/pathways/` の見出しは mapping があれば `/teams/[teamId]/` へリンクする
- 改称校は mapping で旧称を束ねられる（`kobe-shoin: [神戸松蔭女子学院大学, 神戸松蔭大学]`）。
  open-questions の「改称した大学を1校にまとめるか」がページ上は解決する

---

## 追記（2026-09-14）: 37校を追加した

ユーザー: 「はい、お願い」（収録試合数100以上から始める・ID は Claude が案を作って確認する、の2点に同意）。

- `team-name-mappings.json` に37校を追加（`nssu` を含め38校）。ファイルの書式（1キー1行）は保った
- ID 案（**ユーザー確認待ち**）:

| ID | 表記 |
|---|---|
| waseda-univ | 早稲田大学 |
| meiji-univ | 明治大学 |
| shikoku-univ | 四国大学 / 四国大 |
| kokugakuin-univ | 國學院大學 |
| chukyo-univ | 中京大学 |
| hosei-univ | 法政大学 |
| doshisha-univ | 同志社大学 |
| fukuoka-univ | 福岡大学 |
| kansai-univ | 関西大学 |
| kansai-gaidai-univ | 関西外国語大学 |
| kwansei-gakuin-univ | 関西学院大学 |
| tenri-univ | 天理大学 |
| kumamoto-gakuen-univ | 熊本学園大学 |
| tokyo-joshi-taiiku-univ | 東京女子体育大学 |
| rikkyo-univ | 立教大学 |
| ritsumeikan-univ | 立命館大学 |
| tokai-univ | 東海大学 |
| matsuyama-univ | 松山大学 |
| kobe-shoin-univ | 神戸松蔭大学 / 神戸松蔭女子学院大学 |
| chuo-univ | 中央大学 |
| sapporo-gakuin-univ | 札幌学院大学 |
| tokyo-keizai-univ | 東京経済大学 |
| tohoku-gakuin-univ | 東北学院大学 |
| hokusho-univ | 北翔大学 |
| seijoh-univ | 星城大学（英語表記 Seijoh に合わせ、成城と区別） |
| fukuyama-heisei-univ | 福山平成大学 |
| tohoku-fukushi-univ | 東北福祉大学 |
| osaka-seikei-univ | 大阪成蹊大学 |
| aoyama-gakuin-univ | 青山学院大学 |
| kyushu-sangyo-univ | 九州産業大学 / 九州産業大 |
| aichi-gakuin-univ | 愛知学院大学 |
| surugadai-univ | 駿河台大学 |
| juntendo-univ | 順天堂大学 |
| osaka-taiiku-univ | 大阪体育大学 |
| bukkyo-univ | 佛教大学 |
| keio-univ | 慶應義塾大学 |
| teikyo-univ | 帝京大学 |

- 判断したこと: ID は**ローマ字＋`-univ`に統一**（実業団の `fukuoka-city` 等と衝突しない・推測しやすい）。
  神戸松蔭の2表記は1つの ID に束ねた。略称は実データにある2つ（`四国大` `九州産業大`）だけ足した
- 規模の実測: 37校で551ページ（トップ37・年度別514）、年度別で試合5未満92枚。集計は37校で約2.3秒
- 導線: 大学のチームページに出身高校一覧へのリンク（`getUniversityPathwayLinks`）、`/university/` の大学一覧に個別ページへのリンクを追加
- 2026-09-14: ID 案はユーザー確認済み（「問題ない」）。上表のまま確定
