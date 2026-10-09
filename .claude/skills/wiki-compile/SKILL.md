---
name: wiki-compile
description: >
  調査・実装・ブレストの結論を docs/wiki と docs/adr へ書き戻す（compile）手順。
  「wiki を更新して」「書き戻して」「docs 同期」「Compile Log」「ADR にすべきか」「raw を wiki に反映」と言われたとき、
  コードや仕様を変えたあとに関連する wiki を直すとき、docs/raw に溜まったメモを整理するときは、必ずこの skill を使う。
  どの事実をどのページに書くか（行き先の表）、frontmatter（summary・code:）の更新、Compile Log の書式、
  ADR の要否の判定と書き方までを定める。
---

# wiki-compile（実装・raw → wiki・ADR）

設計は [ADR-024](../../../docs/adr/ADR-024-llm-wiki-operating-model.md)、経緯は `docs/raw/2026-10-09-llm-wiki-redesign.md`。
規則の正は `AGENTS.md`、この skill は**手順**。型の定義と frontmatter の仕様は `references/page-types.md`、
Compile Log の書式は `references/compile-log.md`。

## 前提

- 優先順位は **コード・data ＞ raw ＞ wiki**。実装済みの挙動を書いたページは実装が正で、未実装の仕様は `status: draft` として wiki が先行する。
- wiki の主な読み手は**エージェント**。現在の理解だけを書く。経緯・実測値は raw、決定の経緯は ADR に置く。
- **書き戻すのは実装したセッション**（文脈が残っているうちに）。

## 2つのモード

- **インライン**: 実装と同じコミットで小さく書き戻す。変更したコードの所有ページを確かめて直す。
- **バッチ**: idea・research の raw ノートが溜まったとき、まとめて compile する。

どちらも下の4段階（Triage → Route → Write → Close）で行う。

## 1. Triage — 中身を「事実の種類」に分ける

変更や raw ノートの中身を、次の種類に分ける。1つのノートに複数の種類が混ざっているのが普通。

| 事実の種類 | 行き先 |
|---|---|
| なぜそう決めたか・代替案 | ADR |
| ID・置き場・データの形 | entity |
| 判定規則・計算式・閾値 | concept |
| 画面・ルート・読むデータ | feature |
| 繰り返す手順・検算・落とし穴 | procedure |
| 全体の構成・基盤 | overview |
| 未解決の問い | `docs/wiki/open-questions.md`（各ページの Open Questions 節はそこへのリンク1行） |
| 棄却した案 | 該当ページに1行＋ADR の Alternatives（再調査を防ぐため） |
| 実測値・経緯・検算の中身 | raw に残し、wiki にはリンクだけ |
| この依頼限りの確認事項 | 落とす（理由を Compile Log へ） |

## 2. Route — 事実ごとに行き先を決める

- **事実の所有者は1つ**。すでに書いているページがあればそこを書き換える（別ページに同じ事実を書き足さない）。
  ID の形式と置き場は entity ページだけが書き、他のページはリンクする。
- 所有者を探す: 触るコードのパスから `npm run wiki:for -- <パス>`、意図から `docs/wiki/index.md`、語から `docs/wiki` を grep。
- **1ページ1型**。新しいページを作るときは `references/page-types.md` の判定順で型を1つ決める。
  混在しているページは、書き換えのついでに無理に分けない（圧縮・追記が大きくなったときに分ける）。
- 迷う事実は、置く先を決めてから書く。「とりあえず近いページへ追記」は二重管理の元。

## 3. Write — 該当の節を書き換える

- **追記ではなく書き換え**。「追記（YYYY-MM-DD）」を足さず、該当の節を現在の理解に直す。
  日付つきの経緯・実測値・検算は raw へ（ADR の Context / Decision / Alternatives は歴史の記録なので書き換えない）。
- **実装で確認できる内容を優先**する。「未実装」「未公開」「実装済み」のような状態語は、書く前に実装で確かめる。
  確認できない推測は **Assumption**、古くなったものは **Deprecated** と書く（黙って消さない）。
- frontmatter を更新する（仕様は `references/page-types.md`）。
  - `summary`: そのページを開く理由が分かる1行（160字以内）。書き換えた内容とずれたら直す。
  - `status`: `current` / `draft` / `deprecated`。ページ全体の状態で、節ごとの Draft 表記は本文に残す。
  - `code:`: **そのページが定義・決定している対象だけ**。言及しているだけのパス、対比で名前が出ただけのパス
    （「〜とは別物」と断っている相手など）は入れない。言及だけのパスは `wiki:for` の「本文で言及」が拾う。
    同じ項目を複数ページが持つのは、同じファイルの別側面を書くときだけ。
- 本文の「適用範囲」の行は当面残し、frontmatter の `scope` と食い違わせない（`check:wiki` が見る）。
- 新しいページは、他のページから1本以上リンクする（孤立させない）。`index.md` は**生成物**なので手で直さない。
- 未解決の問いは `open-questions.md` にだけ書く。
- 日本語で簡潔に。1ページは12,000字が目安（1.3倍を超えたら `wiki-slim`）。

## 4. Close — 閉じる前に確かめる

1. **Compile Log を書く**: 元の raw ノートの末尾に、事実ごとに「行き先: 内容」を1行ずつ。
   意図して落としたものは理由つきで書く（`references/compile-log.md`）。
2. **機械検査を通す**: `npm run wiki:index`（index の再生成）→ `npm run check:wiki -- --strict`（リンク切れ・frontmatter・index・Compile Log の行き先）。
3. **所有ページを確かめる**: 変更したコードのパスで `npm run wiki:for -- <パス>` を引き、直し忘れたページが無いか見る。
   ファイルを改名・削除したときは「本文で言及」に出るページの旧パスを直す。
4. **ADR の要否を判定する**（下）。

## ADR の要否と書き方

ADR は「いつ・なぜ決めたか」の記録で、現在の実装の説明ではない。

- **作る**: アーキテクチャ／データフロー／同期の挙動／タイムゾーンの扱い／課金ロジック／公開 API の契約／分析手法が変わるとき
  （`AGENTS.md` の ADR rules）。後戻りコストが高い、長期の前提になる、も該当（`docs/adr/README.md`）。
  **作らない**: 軽微な文言変更、局所的な UI 調整、一時的な運用メモ、raw に残せば足りる調査途中の案。
- 書式は `docs/adr/ADR-000-template.md`。実装済みか構想段階かを明記し、**代替案と捨てた理由**、関連ファイル、不明点（Open Questions）を書く。
  `## Status` の直下の1行は状態語だけ（`Draft` / `Accepted` / `Deprecated` / `Superseded`）。補足は次の行から。
- `docs/adr/README.md` の一覧に行を足す。
- **Accepted のあとは本文を書き換えない**。決定が変わるなら Status を Superseded / Deprecated にして新しい ADR を起こす。
  Draft の間は本文を直してよい。「現在の実装状況」のような現在形の部分は同期させる。
- 実装が意図せずずれたなら、直すのは実装で、ADR ではない。

## 完了の目安

- 事実の種類ごとの行き先が決まり、所有ページが書き換わっている（追記が増えていない）。
- Compile Log が「行き先: 内容」で書かれ、落としたものに理由がある。
- `npm run check:wiki -- --strict` が通り、`index.md` が最新。
- ADR の要否を判断した（作らないと判断した理由が説明できる）。
