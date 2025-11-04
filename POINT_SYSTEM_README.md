# ソフトテニス ポイント記録システム

ソフトテニスの試合で、1ポイントごとの詳細な記録を行うためのシステムです。

## 機能概要

- **マッチ管理**: 試合の作成・管理（大会データ連携対応）
- **大会データ連携**: 既存の大会データ構造との統合
- **カテゴリ管理**: 世代・性別・競技カテゴリの詳細分類
- **回戦情報**: 1回戦〜決勝までの回戦管理
- **リアルタイムスコア記録**: ポイントごとの詳細記録
- **詳細分析**: ラリー数、決定打の種類、選手別統計等
- **試合閲覧**: 記録された試合の詳細表示（カテゴリバッジ付き）

## 記録できる情報

### 試合基本情報
- **大会情報**: 既存の大会データとの連携（正式名称、開催年など）
- **カテゴリ情報**: 
  - 世代（高校生、一般など）
  - 性別（男子、女子、混合）
  - 競技種目（シングルス、ダブルス、団体）
- **回戦情報**: 1回戦〜決勝、準々決勝、3位決定戦など
- **チーム情報**: 対戦チーム名
- **マッチ形式**: ベスト・オブ形式（3ゲームマッチ、5ゲームマッチ等）

### ポイント詳細情報
- 勝者チーム (A/B)
- ラリー数
- 決定要因 (決定打/ミス誘発/凡ミス/ネット/アウト等)
- 勝者選手名
- サーブ関連 (1stサーブフォルト、ダブルフォルト)

### 将来の拡張予定
- 詳細なストローク分析
- ポジション記録
- 戦術パターン分析

## 技術スタック

- **Frontend**: Next.js (Pages Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabaseプロジェクトの設定

1. [Supabase](https://supabase.com/) でプロジェクトを作成
2. SQL Editorで `database/schema.sql` を実行
3. API設定から必要なキーを取得

### 3. 環境変数の設定

`.env.local` ファイルを作成:

```bash
cp .env.example .env.local
```

以下の値を設定:

```env
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# その他の設定
MICROCMS_SERVICE_DOMAIN=your_microcms_domain
MICROCMS_API_KEY=your_microcms_api_key
NEXT_PUBLIC_GA_ID=your_google_analytics_id
```

**セキュリティ注意**: 
- `.env.local`は`.gitignore`に含まれており、Gitにコミットされません
- 本番環境では適切な環境変数設定を行ってください
- すべてのスクリプト（`add-columns.mjs`など）も環境変数を使用します

### 4. 開発サーバーの起動

```bash
npm run dev
```

## 大会データ連携

### 大会データ構造
大会データは以下の階層構造で管理されています:

```
data/tournaments/
├── [generation]/          # 世代 (highschool, university, etc.)
│   └── [tournamentId]/    # 大会ID
│       ├── meta.json      # 大会基本情報
│       └── [year]/        # 開催年
│           ├── meta.json  # 年度別情報
│           └── categories.json  # カテゴリ情報
```

### 動的大会情報取得
- `lib/tournamentHelpers.ts`で大会情報を動的に読み込み
- ファイルシステムベースの柔軟な大会データ管理
- 正式名称、開催情報、カテゴリ情報の自動取得

### 大会リンク生成
試合詳細・一覧ページから大会ページへの直接リンク:
```
/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]
```

例: `/tournaments/highschool/highschool-championship/2024/doubles/none/boys`

## アクセス制御とベータ機能

### 環境ベースアクセス制御
- `lib/env.ts`で開発・デバッグ・管理者モードを管理
- 本番環境での機能制限
- ベータ機能の段階的展開

### ベータ機能
現在のポイント記録システムは`/beta`以下で展開:
- `/beta/matches/create` - 試合作成（高度なカテゴリ選択付き）
- `/beta/matches-results` - 試合一覧・詳細閲覧
- `/beta/matches/[matchId]/input` - ポイント記録入力

## 使用方法

### 1. マッチ作成
- `/beta/matches/create` で新しいマッチを作成
- **大会選択**: 既存の大会データから選択またはカスタム入力
- **カテゴリ選択**: 世代・性別・競技種目を詳細に選択
- **回戦選択**: 1回戦〜決勝までの回戦を選択
- **チーム情報**: 対戦チーム名とマッチ形式を入力

### 2. ポイント記録
- `/beta/matches/[matchId]/input` で試合の記録入力
- リアルタイムでポイント情報を記録
- 自動的にスコア計算・ゲーム終了判定
- マッチ完了時の自動次ゲーム管理

### 3. 試合閲覧
- `/beta/matches-results` でマッチ一覧表示（カテゴリバッジ付き）
- `/beta/matches-results/[matchId]` で詳細表示・統計情報
- 大会リンク機能（カテゴリパラメータ付きURL生成）

## API エンドポイント

### マッチ管理
- `GET /api/matches` - マッチ一覧取得
- `POST /api/matches` - 新しいマッチ作成
- `GET /api/matches/[matchId]` - マッチ詳細取得

### ポイント記録
- `POST /api/matches/[matchId]/points` - ポイント記録
- `GET /api/matches/[matchId]/points` - ポイント履歴取得

### ゲーム管理
- `POST /api/matches/[matchId]/games` - 新ゲーム開始

## データベース構造

### matches テーブル
- **基本情報**: tournament_name, team_a, team_b, best_of
- **カテゴリ情報**: 
  - tournament_generation (世代)
  - tournament_gender (性別)
  - tournament_category (競技種目)
- **回戦情報**: round_name (1回戦〜決勝)
- **メタデータ**: id, created_at

### games テーブル  
- ゲームごとの情報 (match_id, game_number, points_a, points_b, winner_team)
- 自動的なゲーム終了判定とマッチ進行管理

### points テーブル
- ポイントごとの詳細情報
  - 基本: game_id, point_number, winner_team
  - 詳細: rally_count, result_type, winner_player, loser_player
  - サーブ: first_serve_fault, double_fault

## 最新の実装機能 (2024年11月更新)

### ✅ 完了済み機能
1. **大会データ統合**
   - 既存の大会データ構造との完全統合
   - 動的な大会情報取得とカテゴリ管理
   - 正式名称表示とリンク生成

2. **カテゴリ管理システム**
   - 世代・性別・競技種目の詳細分類
   - カラーコーディングされたカテゴリバッジ
   - URL パラメータとしてのカテゴリ情報埋め込み

3. **回戦管理**
   - 1回戦〜決勝までの回戦選択機能
   - 回戦情報の表示とフィルタリング

4. **セキュリティ強化**
   - 環境変数による認証情報管理
   - 開発・本番環境の適切な分離

### 🔄 技術的改善点
- TypeScript型安全性の向上
- データベーススキーマの拡張
- コンポーネント再利用性の向上
- エラーハンドリングの充実

## 今後の拡張予定

1. **統計分析機能**
   - 選手別統計（カテゴリ別集計）
   - 戦術パターン分析
   - 回戦別パフォーマンス分析

2. **リアルタイム配信**
   - WebSocketによるリアルタイム更新
   - 観戦者向けライブビュー

3. **データエクスポート**
   - CSV/Excel出力（カテゴリ情報含む）
   - 分析レポート生成

4. **モバイル対応**
   - PWA化
   - オフライン記録機能

5. **大会管理機能**
   - トーナメント bracket 管理
   - 自動対戦表生成

## 開発者向け情報

### データベース管理スクリプト
環境変数を使用した安全なデータベース操作:

```bash
# カラム追加（初回セットアップ時）
node scripts/database/add-columns.mjs

# テストマッチ作成
node scripts/database/create-test-match.mjs

# データベース接続テスト
node scripts/database/test-db.mjs
```

詳細な使用方法は `scripts/database/README.md` を参照してください。

### 主要なファイル構成
```
src/
├── pages/beta/matches/         # ベータ版マッチ機能
│   ├── create.tsx             # 試合作成（カテゴリ選択付き）
│   └── [matchId]/input.tsx    # ポイント記録
├── pages/beta/matches-results/ # 試合結果表示
│   ├── index.tsx              # 一覧（カテゴリバッジ付き）
│   └── [matchId]/index.tsx    # 詳細（大会リンク付き）
├── lib/
│   ├── tournamentHelpers.ts   # 大会データ管理
│   ├── env.ts                 # 環境ベースアクセス制御
│   └── supabase.ts            # DB接続
└── types/database.ts          # 型定義（カテゴリ・回戦情報含む）
```

### デバッグ・開発環境
- `isDevelopment()` - 開発環境判定
- `isDebugMode()` - デバッグモード判定  
- `isAdmin()` - 管理者モード判定

### テスト環境
現在のテストマッチ:
- 準決勝: `ad12bc6b-e9df-4450-a0d4-9d8e497aae03`
- 決勝: `55accee1-2050-4eee-b0a0-d70e2d818391`

## ライセンス

MIT License