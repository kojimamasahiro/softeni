# Softeni Pick

ソフトテニスの試合結果・選手情報を集約したデータベース型Webメディアです。  
全国大会を中心に、選手ごとの成績、チーム戦績、試合データを掲載しています。

---

## 📋 プロジェクト概要

**Softeni Pick（ソフテニ・ピック）** は、ソフトテニスの大会結果や選手・チーム情報を整理・記録する個人運営のWebサービスです。

現在は 2 つの公開面を同一コードベースで運用しています。

- `softeni-pick.com`
  本体サイト。大会、選手、チーム、ベータ導線、記録管理導線を持つ
- `score.softeni-pick.com`
  試合結果と成長分析を公開する閲覧専用サイト

### 目的

- 選手ごとの過去成績や出場履歴を簡単に検索・閲覧できる環境の提供
- 大会データの構造化と長期保存
- 指導者・選手・ファンの振り返りや分析への活用

### ドキュメント運用

- 運用ガイド: `docs/README.md`
- 未整理メモ: `docs/raw/`
- 整理済み Wiki: `docs/wiki/`
- 重要判断: `docs/adr/`

### 技術スタック

| カテゴリ           | 技術                                        |
| ------------------ | ------------------------------------------- |
| **フレームワーク** | Next.js 15.3.1 (React 19)                   |
| **スタイリング**   | Tailwind CSS 4                              |
| **データベース**   | Supabase (開発/管理機能用)                  |
| **デプロイ**       | Vercel (現在) → Cloudflare Pages (移行予定) |
| **言語**           | TypeScript, Python                          |
| **分析ツール**     | Vercel Analytics, Speed Insights            |

---

## 🌐 サイトモード

サイトの公開面は Host ではなく `siteConfig.mode` で切り替えています。

実装:

- `lib/siteConfig.ts`

主な設定:

| 変数                          | 用途                                  |
| ----------------------------- | ------------------------------------- |
| `SITE_MODE`                   | サーバー側のモード切り替え            |
| `NEXT_PUBLIC_SITE_MODE`       | クライアント側のモード切り替え        |
| `NEXT_PUBLIC_PUBLIC_BASE_URL` | canonical / OGP / 共有 URL の基準 URL |
| `NEXT_PUBLIC_SITE_NAME`       | サイト名                              |
| `NEXT_PUBLIC_PUBLIC_OG_IMAGE` | OGP 画像 URL                          |

モードごとの想定:

| mode           | 主ドメイン                       | 有効な公開導線                                       |
| -------------- | -------------------------------- | ---------------------------------------------------- |
| `softeni-pick` | `https://softeni-pick.com`       | `/`, `/players`, `/teams`, `/tournaments`, `/beta/*` |
| `score`        | `https://score.softeni-pick.com` | `/matches`, `/matches/[matchId]`, `/matches/growth`  |

### score モードの制約

`score` モードは初回リリースでは閲覧専用です。

- `/matches*` を公開する
- `/beta/*` は原則 404 にする
- 記録管理ページは表示しない
- `POST /api/matches` などの書き込み API は拒否する
- 公開 JSON には内部連携項目を含めない

### 公開 URL 対応

| 既存導線                          | score 側の公開先     |
| --------------------------------- | -------------------- |
| `/beta/matches-results`           | `/matches`           |
| `/beta/matches-results/[matchId]` | `/matches/[matchId]` |
| `/beta/matches-results/growth`    | `/matches/growth`    |

---

## 🏗 アーキテクチャ

### ディレクトリ構造

```
softeni-pick/
├── src/                    # 本番環境コード (Cloudflare移行対象)
│   ├── pages/             # Next.js Pages (SSG)
│   ├── components/        # Reactコンポーネント
│   ├── lib/               # ユーティリティ関数
│   ├── utils/             # データ集約ロジック
│   └── types/             # TypeScript型定義
├── data/                  # 静的JSONデータ (Cloudflare移行対象)
│   ├── tournament/        # 大会データ
│   └── players/           # 選手データ
├── public/                # 静的アセット (Cloudflare移行対象)
├── scripts/               # データ処理スクリプト (ローカル専用)
├── tools/                 # 開発補助ツール (ローカル専用)
├── lib/                   # サーバーサイドライブラリ
└── database/              # データベーススキーマ
```

---

## 🌐 本番環境 (Cloudflare移行対象)

### `src/pages/` - ページ構成 (16ページ)

全ページで **Static Site Generation (SSG)** を使用し、ビルド時に静的HTMLを生成しています。

**主要ページ:**

- `/` - トップページ (最近の大会、注目選手)
- `/players` - 選手一覧
- `/players/[id]/results` - 選手詳細・成績
- `/teams/[teamId]` - チーム別成績
- `/tournaments` - 大会一覧
- `/matches` - `score` 側の試合結果一覧
- `/matches/[matchId]` - `score` 側の試合詳細
- `/matches/growth` - `score` 側の成長分析
- `/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]` - 大会詳細
- `/highschool` - 高校カテゴリ
- `/about`, `/faq`, `/contact`, `/privacy` - 情報ページ

### `src/components/` - コンポーネント (18個)

再利用可能なUIコンポーネント:

- `Header`, `Footer`, `Breadcrumb` - レイアウト
- `MetaHead` - SEO/OGP設定
- `PlayerResults`, `PlayerSummaryStats` - 選手情報表示
- `TeamsEventSummary`, `TeamsRanking`, `TeamsYearlySummary` - チーム情報
- `DrawTable`, `ResultsTable` - トーナメント表示
- `Tournament/MatchResults`, `Tournament/Statistics` - 大会詳細

### `data/` - 静的JSONデータ (1,398ファイル)

**構造:**

```
data/
├── tournament/
│   ├── index.json                    # 大会一覧
│   ├── [tournamentId]/
│   │   ├── information/
│   │   │   └── [year].json          # 大会基本情報
│   │   └── details/
│   │       └── [year]/
│   │           └── [category].json  # 試合結果詳細
└── players/
    └── [playerId]/
        ├── information.json          # 選手プロフィール
        └── analysis.json             # 選手集計・最新試合
```

---

## 🛠 ローカル開発ツール (Cloudflare移行対象外)

以下のディレクトリは **ローカル環境でのみ使用** し、Cloudflareにはデプロイしません。

### `scripts/` - データ処理スクリプト (15ファイル)

大会PDFや手動入力データから、`data/`配下のJSONファイルを生成するスクリプト群です。

**主要スクリプト:**

| ファイル                               | 言語       | 機能                  |
| -------------------------------------- | ---------- | --------------------- |
| `convert_image_pdf.py`                 | Python     | PDF→画像→テキスト抽出 |
| `generate_entries.py`                  | Python     | エントリー情報生成    |
| `generate_roundrobin.py`               | Python     | 総当たり戦データ生成  |
| `extract-players.mjs`                  | JavaScript | 選手データ抽出        |
| `generate-players-index-from-info.mjs` | JavaScript | 選手インデックス生成  |
| `generate-og-json.mjs`                 | JavaScript | OG画像用JSON生成      |
| `batch-normalize.mjs`                  | JavaScript | データ正規化          |

### `tools/` - 開発補助ツール (5ディレクトリ)

**ツール一覧:**

| ディレクトリ          | 用途                     |
| --------------------- | ------------------------ |
| `match-input-helper/` | 試合結果の手動入力支援UI |
| `tournament/`         | トーナメント表管理       |
| `tournament2/`        | トーナメント表管理(v2)   |
| `roundrobin/`         | 総当たり戦データ管理     |
| `kintai/`             | その他管理ツール         |

これらは **HTMLベースのローカルツール** で、`data/`配下のJSONファイル生成を補助します。

---

## 🔌 API Routes (検討中)

現在、`src/pages/api/`配下に14個のAPI Routesが存在しますが、これらは **Supabase** を使用した動的機能です。

**API Routes一覧:**

| カテゴリ       | エンドポイント                 | 用途           |
| -------------- | ------------------------------ | -------------- |
| **OG画像生成** | `/api/og/**/*.tsx` (3)         | 動的OG画像生成 |
| **試合データ** | `/api/matches/**/*.ts` (5)     | 試合CRUD操作   |
| **選手データ** | `/api/players/index.ts` (1)    | 選手データ集約 |
| **大会データ** | `/api/tournaments/**/*.ts` (2) | 大会情報取得   |
| **その他**     | `/api/*.ts` (3)                | テスト・管理用 |

> [!WARNING] > **静的エクスポート時の制約**
>
> Next.jsの静的エクスポート(`output: 'export'`)では、API Routesは動作しません。
> Cloudflare移行時には以下のいずれかの対応が必要です:
>
> - Cloudflare Workersで再実装
> - ビルド時に静的JSONファイルとして生成
> - 外部APIサービス(Supabase等)に移行

---

## 📊 データ構造

### 大会データフロー

```
PDF/手動入力
    ↓
scripts/ (Python/JavaScript)
    ↓
data/tournament/ (JSON)
    ↓
src/pages/ (getStaticProps)
    ↓
静的HTML生成
```

### 選手データフロー

```
大会結果JSON
    ↓
scripts/extract-players.mjs
    ↓
data/players/ (JSON)
    ↓
src/pages/players/ (getStaticProps)
    ↓
選手ページ生成
```

---

## 💻 開発環境セットアップ

### 必要な環境

- **Node.js**: 20.x以上
- **Python**: 3.x (scriptsディレクトリ使用時)
- **npm**: 最新版

### インストール手順

```bash
# リポジトリクローン
git clone https://github.com/kojimamasahiro/softeni.git
cd softeni-pick

# 依存関係インストール
npm install

# Python依存関係 (scriptsディレクトリ使用時)
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt  # 必要に応じて
```

### 環境変数設定

`.env.local`ファイルを作成:

```bash
# site mode
SITE_MODE=softeni-pick
NEXT_PUBLIC_SITE_MODE=softeni-pick
NEXT_PUBLIC_PUBLIC_BASE_URL=https://softeni-pick.com
NEXT_PUBLIC_SITE_NAME=Softeni Pick
NEXT_PUBLIC_PUBLIC_OG_IMAGE=/og/twitter-card-summary.png

# Supabase (API Routes使用時のみ)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# その他の環境変数
# (必要に応じて追加)
```

### 開発サーバー起動

```bash
# 開発モード
npm run dev

# ビルド
npm run build

# 本番モード
npm start
```

### ローカル確認の基本パターン

`softeni-pick` mode:

```bash
NEXT_PUBLIC_SITE_MODE=softeni-pick \
NEXT_PUBLIC_PUBLIC_BASE_URL=https://softeni-pick.com \
npm run dev
```

`score` mode:

```bash
NEXT_PUBLIC_SITE_MODE=score \
NEXT_PUBLIC_PUBLIC_BASE_URL=https://score.softeni-pick.com \
NEXT_PUBLIC_SITE_NAME="Softeni Pick Score" \
npm run dev
```

確認観点:

- `softeni-pick` mode では `/beta/matches-results*` と `/beta/matches*` が有効
- `score` mode では `/matches*` が有効で `/beta/*` は 404
- canonical / OGP が `NEXT_PUBLIC_PUBLIC_BASE_URL` を向く

### データ生成 (ローカル)

```bash
# 選手データ生成
node scripts/extract-players.mjs

# OG画像JSON生成
node scripts/generate-og-json.mjs

# サイトマップ生成
npm run generate-sitemap
```

`public/data/beta-matches/` は試合結果公開と成長分析のスナップショットです。`score` 側はこの静的 JSON を前提に動作します。

---

## 🚀 Cloudflare Pages移行計画

### 移行の背景

現在Vercelで運用していますが、以下の理由でCloudflare Pagesへの移行を検討しています:

- **広告掲載**: Vercelの無料プランは商用利用不可。広告掲載には有料プラン($20/月〜)が必要
- **コスト削減**: Cloudflare Pagesは無料プランで商用利用・広告掲載が可能
- **パフォーマンス**: Cloudflareの300+エッジロケーション(Vercelは~100)

### 移行対象

✅ **Cloudflareにデプロイするもの:**

- `src/` - 全ページ・コンポーネント
- `data/` - 静的JSONデータ
- `public/` - 静的アセット
- `next.config.ts`, `package.json`, `tsconfig.json` - 設定ファイル

❌ **ローカル専用 (デプロイしない):**

- `scripts/` - データ処理スクリプト
- `tools/` - 開発補助ツール
- `database/` - データベーススキーマ
- `.venv/` - Python仮想環境

### 次のステップ

1. **現状整理** ✅ (このREADME更新)
2. **リファクタリング** (不要なコード・依存関係の削除)
3. **静的エクスポート対応** (`next.config.ts`の設定変更)
4. **Vercel固有機能の置き換え** (Analytics, OG画像生成等)
5. **Cloudflare Pagesテストデプロイ**
6. **本番移行**

詳細は [`docs/cloudflare-migration-analysis.md`](docs/cloudflare-migration-analysis.md) を参照してください。

---

## 📚 関連ドキュメント

- [beta/matches-results 保守ガイド](docs/beta-matches-results.md)
- [大会データ構造](docs/tournament-data-structure.md)
- [ポイントシステム](POINT_SYSTEM_README.md)
- [サーブ統計ガイド](SERVE_STATISTICS_GUIDE.md)

---

## 🔗 リンク

- **公開サイト**: [https://softeni-pick.com/](https://softeni-pick.com/)
- **GitHub**: [https://github.com/kojimamasahiro/softeni](https://github.com/kojimamasahiro/softeni)

---

## 📝 ライセンス

個人運営プロジェクトです。データの商用利用については事前にご相談ください。
