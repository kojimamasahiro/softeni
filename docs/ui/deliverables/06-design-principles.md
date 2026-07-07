# 06-design-principles.md — デザイン原則・トークン

- ステータス: approved(D-010, 2026-07-04)
- 作成日: 2026-07-04
- フェーズ: Phase 6
- 入力: 05-page-structure.md(in-review・D-009)、02-issues.md(approved)。対応課題: I-16、I-17
- 範囲: 原則とトークン(基礎値)の定義のみ。画面のビジュアルデザインは行わない(project-plan.md)

## 1. デザイン原則(4つ)

判断に使える形(「迷ったらこうする」)で定義する。

| # | 原則 | 判断への使い方 |
|---|------|---------------|
| P1 | **データが主役** | 装飾よりも数字・名前・スコアの可読性を優先する。迷ったら要素を減らし、表の行間・桁揃えを整える方に倒す |
| P2 | **同じ情報は同じ見た目** | 同じエンティティ・同じ状態は、どのページでも同じコンポーネント・同じ色で表す(例: 優勝は常に同じバッジ)。新しい見た目を作る前に既存パターンを探す |
| P3 | **段階的開示** | 一覧では要約、ハブでは構成、詳細では全量。上位ページに詳細を詰め込まない。「このページの主役は何か」に答えられない要素は下位ページへ |
| P4 | **トークン以外の値を書かない** | 色・余白・角丸・影は本書のトークンのみ使用。任意値(Tailwind の `[]` 記法や生 HEX)を新規コードに書かない |

## 2. トークン定義

現行実装(Tailwind ユーティリティ直書き)からの移行可能性を優先し、**Tailwind の標準スケールに別名(セマンティック名)を与える**方式とする。

実装方式(D-022 で確定・実装済み): リポジトリは Tailwind v4 のため、`src/styles/globals.css` の `@theme` に CSS 変数として定義。生成クラスの対応: color-bg→`bg-bg`、color-surface→`bg-surface`、color-border→`border-border`、color-text→`text-text`、color-text-muted→`text-text-muted`、color-primary→`text-primary`/`bg-primary`、color-primary-hover→`hover:text-primary-hover`、color-accent-win→`bg-accent-win`、color-accent-dev→`text-accent-dev`、color-danger→`text-danger`。ダーク値・ステータス系トークンは D-023 で追加(下表)。

### 2.1 色

命名規則: `色-用途-段階`。値は現行実装で最頻の Tailwind 色に固定。ダーク値は D-023 で確定・実装済み(`@media (prefers-color-scheme: dark)` で上書き)。

**中立色・主要色**

| トークン | ライト値 | ダーク値 | 用途 |
|----------|---------|---------|------|
| color-bg | gray-50 | gray-900 | ページ背景 |
| color-surface | white | gray-800 | カード・テーブル背景 |
| color-bg-subtle | gray-100 | gray-700 | サブトルな背景(ホバー面・軽い区画) |
| color-border | gray-200 | gray-700 | 罫線・区切り |
| color-border-strong | gray-300 | gray-600 | 強調罫線(表の境界等) |
| color-text | gray-800 | gray-100 | 本文 |
| color-text-secondary | gray-600 | gray-300 | 準本文 |
| color-text-muted | gray-500 | gray-400 | 補足・注記 |
| color-primary | blue-600 | blue-400 | リンク・主要アクション |
| color-primary-hover | blue-500 | blue-300 | ホバー |
| color-accent-win | amber-500 | (共通・上書きなし) | 優勝・1位系の強調 |
| color-accent-dev | orange-600 | (共通・上書きなし) | DEV・ベータ表示(公開面では使わない) |
| color-danger | red-600 | red-400 | エラー・削除 |

- 補足: accent-win の現行実装値は移行時に実測して確定する(現行に複数値がある場合は最頻値へ寄せる)
- 補足(D-023): accent-win / accent-dev はダーク値を追加せず、両モード共通のソリッド値のまま据え置く(実装調査で対応する明確なダーク組が見つからなかったため)

**ステータスバッジ(D-023 で新設。bg・border・text の3点セット)**

| トークン | ライト値 | ダーク値 | 用途 |
|----------|---------|---------|------|
| success / success-bg / success-border | green-800 / green-50 / green-200 | green-300 / green-900相当(30%) / green-800 | 成功・完了系バッジ |
| warning / warning-bg / warning-border | amber-800 / amber-50 / amber-200 | amber-300 / amber-900相当(20%) / amber-800 | 注意系バッジ(yellow/orange はここへ統合) |
| danger-bg / danger-border | (text は color-danger を流用) red-50 / red-200 | red-900相当(20%) / red-800 | 危険・エラー系バッジ |
| info / info-bg / info-border | blue-700 / blue-50 / blue-200 | blue-300 / blue-900相当(20%) / blue-800 | 情報系バッジ(indigo/purple/pink はここへ統合) |
| neutral / neutral-bg / neutral-border | gray-700 / gray-100 / gray-200 | gray-300 / gray-700 / gray-700 | 中立・ニュートラル系バッジ(現状コード上は未使用、将来用に定義のみ) |

- 半透明背景(`-bg` 系のダーク値)は `color-mix(in oklch, ...)` で実装し、Tailwind の `/opacity` 記法をトークン定義側に内包する

### 2.2 タイポグラフィ

| トークン | 値 | 用途 |
|----------|-----|------|
| text-h1 | text-2xl / bold | ページタイトル(h1) |
| text-h2 | text-xl / bold | セクション見出し |
| text-h3 | text-lg / semibold | カード見出し |
| text-body | text-base | 本文 |
| text-sm | text-sm | 表・補足 |
| text-xs | text-xs | 注記・ラベル |

- 数字の桁揃えが必要な表は `tabular-nums` を必須とする(P1)

### 2.3 余白・レイアウト

| トークン | 値 | 用途 |
|----------|-----|------|
| space-page-y | py-10 | PageLayout 上下(現行値を追認) |
| space-page-x | px-4 | PageLayout 左右 |
| space-section | mt-10 | セクション間 |
| space-block | mt-4 | ブロック間 |
| space-inline | gap-2 / gap-4 | 行内要素間 |
| width-content | 3xl / 4xl / 6xl | ページタイプ別 maxWidth(05 で定義) |

### 2.4 ブレークポイント

Tailwind 標準を正とする: sm=640 / md=768 / lg=1024 / xl=1280。
サイドバーの表示切替は lg、テーブル⇔カード変換は md を既定とする。

### 2.5 角丸・影

| トークン | 値 | 用途 |
|----------|-----|------|
| radius-card | rounded-lg | カード・パネル |
| radius-chip | rounded-full | チップ・バッジ |
| shadow-card | shadow-sm | カード標準 |
| shadow-raised | shadow-md | ホバー・ドロワー |

## 3. ダークモード方針(I-17)— D-012 で改訂、D-023 でダーク値確定

- **将来対応を前提とする**(D-012)。トークン定義(§2.1)にダーク値を持ち、コンポーネント側の変更なしで切替可能な構造にする(OS の `prefers-color-scheme` に追従。手動トグルは現状なし)
- ダーク値は D-023(2026-07-07)で確定・実装済み。§2.1 の表を参照
- 既存の `dark:` クラスはコードモッドでトークン経由の実装へ機械置換した(M5-3、D-023)。実装時点の調査で `dark:` の実使用は 66 ファイル・約1,437箇所と判明し、01-inventory.md §8.3 の「Footer・Header等一部のみ」という記載は実態と乖離していた(要更新)
- 置換できたのは高頻度・低曖昧性の組み合わせ(中立色、primary/info の blue、5種のステータスバッジ)約1,000箇所。残り約430箇所(gray の中間階調・bg の用途が page/surface/subtle のどれか曖昧なもの・単発の色)は誤変換リスクを避けて `dark:` 直書きのまま残っている。解消は今後のフォローアップ
- 新規コードは `dark:` を直書きせず、本書のトークンを使う(P4)

## 4. 命名規則

1. トークン名は `種別-用途(-段階)` の kebab-case(例: `color-text-muted`)
2. 用途名はセマンティック(bg/surface/text/primary)とし、色名(blue/gray)を用途名にしない
3. トークン追加はオーナー承認事項とし、本書を改訂して追加する(勝手に増やさない)

## 5. 完了条件の確認

- Phase 7(コンポーネント)はトークンのみで色・サイズを指定できる: 2章で色 10→27(D-023 で中立色3種・ステータス系14種を追加)・文字6・余白6・角丸影4を定義済み。不足が見つかった場合は本書へ追記(改訂手続き)

## 6. 未決事項(→ project-status.md)

| # | 内容 |
|---|------|
| ~~O-012~~ | 解消(D-012: 将来対応方針。§3 改訂済み) |
| ~~O-013~~ | 解消(D-022: CSS 変数 @theme 方式。§2 に反映済み) |

- 改訂記録: 2026-07-04 D-012 反映(§3 ダークモード方針)
- 改訂記録: 2026-07-04 D-022 反映(§2 実装方式確定・globals.css に実装)
- 改訂記録: 2026-07-07 D-023 反映(§2.1 ダーク値・ステータス系トークン追加、§3 M5-3 実施状況)
- 残作業: 01-inventory.md §8.3 の記載更新(dark: の実使用範囲)、残り約430箇所の `dark:` の扱いの方針決定
