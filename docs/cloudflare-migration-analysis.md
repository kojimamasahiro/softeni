# Cloudflare Pages 移行調査レポート

## 📋 調査概要

現在Vercelで運用中のSofteni Pickについて、Cloudflare Pagesへの移行可能性と広告掲載時の無料プラン利用可否を調査しました。

---

## ✅ 結論

### 1. Cloudflare Pagesへの移行は可能か?

**はい、移行可能です。**

現在のプロジェクト構成を確認したところ、Next.js 15.3.1を使用した静的サイト生成(SSG)ベースのアプリケーションです。Cloudflare Pagesは静的サイトのホスティングに優れており、Next.jsの静的エクスポートを完全にサポートしています。

### 2. 広告を貼っても無料プランで利用可能か?

**はい、可能です。**

Cloudflare Pagesの無料プランは商用利用および広告掲載を明示的に許可しています。Google AdSenseなどの広告プラットフォームを使用しても、無料プランのまま利用できます。

---

## 🔍 詳細分析

### Vercelの広告ポリシー

Vercelの無料プラン(Hobby)は**非商用・個人利用のみ**に制限されています。以下は商用利用とみなされます:

- ✗ 訪問者からの支払い処理
- ✗ 製品やサービスの販売広告
- ✗ サイト作成・更新・ホスティングに対する報酬受取
- ✗ アフィリエイトリンクが主目的のサイト
- ✗ **Google AdSenseなどのオンライン広告プラットフォームの広告掲載**

つまり、**Vercelで広告を掲載するには有料プラン(Pro以上)が必要**です。

### Cloudflare Pagesの広告ポリシー

Cloudflare Pagesの無料プランは以下を許可しています:

- ✓ 商用利用(クライアントプロジェクト、スタートアップサイト、ECサイト等)
- ✓ 広告掲載(Google Adsなど)
- ✓ その他の収益化手段
- ✓ コンテンツの所有権は利用者に帰属

コミュニティディスカッションでも、Cloudflare Pages上でGoogle Adsを掲載することは問題ないとの合意があります。

---

## 🛠 技術的な移行要件

### 現在のプロジェクト構成

```json
{
  "name": "softeni-pick",
  "dependencies": {
    "next": "15.3.1",
    "@vercel/analytics": "^1.5.0",
    "@vercel/og": "^0.6.8",
    "@vercel/speed-insights": "^1.2.0"
  }
}
```

### 移行に必要な変更点

#### 1. Next.js設定の変更

`next.config.ts`に静的エクスポート設定を追加:

```typescript
const nextConfig = {
  output: 'export',  // 静的エクスポートを有効化
  images: {
    unoptimized: true  // Cloudflare Pagesでは画像最適化を無効化
  },
  // 既存の設定...
};
```

#### 2. Vercel固有の依存関係の置き換え

以下のパッケージはVercel固有のため、代替が必要です:

| Vercelパッケージ | Cloudflare代替 | 備考 |
|---|---|---|
| `@vercel/analytics` | Cloudflare Web Analytics | 無料で利用可能 |
| `@vercel/speed-insights` | Cloudflare Web Analytics | 同上 |
| `@vercel/og` | Cloudflare Workers | OG画像生成はWorkers APIで実装 |

#### 3. ビルド設定

Cloudflare Pagesのビルド設定:

- **ビルドコマンド**: `npm run build`
- **ビルド出力ディレクトリ**: `out` (静的エクスポート時)
- **Node.jsバージョン**: 20.x (現在の`@types/node`バージョンと互換)

#### 4. リダイレクト設定

現在`next.config.ts`で定義されているリダイレクトは、Cloudflare Pagesの`_redirects`ファイルまたは`_headers`ファイルに移行する必要があります。

---

## 📊 比較: Vercel vs Cloudflare Pages

### 無料プランの制限

| 項目 | Vercel (Hobby) | Cloudflare Pages (Free) |
|---|---|---|
| **商用利用** | ✗ 不可 | ✓ 可能 |
| **広告掲載** | ✗ 不可 | ✓ 可能 |
| **帯域幅** | 100GB/月 | 無制限 |
| **ビルド時間** | 6,000分/月 | 500ビルド/月 |
| **デプロイ数** | 無制限 | 無制限 |
| **カスタムドメイン** | ✓ | ✓ |
| **SSL証明書** | ✓ 自動 | ✓ 自動 |
| **エッジネットワーク** | ~100拠点 | 300+拠点 |

### パフォーマンス

- **Cloudflare**: 世界300以上のデータセンターでコンテンツを配信、グローバルなレスポンスタイムが優れている
- **Vercel**: 約100拠点のエッジネットワーク

### コスト面

- **Vercel Pro**: $20/月〜 (広告掲載に必要)
- **Cloudflare Pages**: $0/月 (広告掲載可能)

**年間コスト削減額: $240以上**

---

## 🚀 移行手順の概要

### フェーズ1: 準備(1-2日)

1. `next.config.ts`に`output: 'export'`を追加
2. Vercel固有パッケージの削除・代替実装
3. ローカルで`npm run build`を実行し、静的エクスポートが正常に動作することを確認

### フェーズ2: Cloudflare Pagesセットアップ(1日)

1. Cloudflare Pagesアカウント作成
2. GitHubリポジトリと連携
3. ビルド設定の構成
4. 初回デプロイとテスト

### フェーズ3: ドメイン移行(1日)

1. カスタムドメイン`softeni-pick.com`をCloudflare Pagesに設定
2. DNS設定の更新
3. SSL証明書の自動発行確認

### フェーズ4: 検証と最適化(1-2日)

1. 全ページの動作確認
2. リダイレクトの動作確認
3. パフォーマンステスト
4. Cloudflare Analyticsの設定

---

## ⚠️ 注意点と制約事項

### 1. サーバーサイド機能の制限

現在のプロジェクトは主に静的サイト生成(SSG)を使用していますが、以下の機能は静的エクスポートでは使用できません:

- `getServerSideProps` (SSR) → **現在未使用**
- API Routes (`/api/*`) → **14個のAPIルートが存在**
- Incremental Static Regeneration (ISR)
- Image Optimization (デフォルト)

#### 現在使用中のAPI Routes

プロジェクト内で以下のAPIルートが確認されました:

**OG画像生成 (3ファイル)**
- `/api/og/[tournamentId]/[year].tsx`
- `/api/og/highschool/tournament/[tournamentId]/[year].tsx`
- `/api/og/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx`

**試合データAPI (5ファイル)**
- `/api/matches/index.ts`
- `/api/matches/[matchId]/index.ts`
- `/api/matches/[matchId]/games/index.ts`
- `/api/matches/[matchId]/games/[gameId].ts`
- `/api/matches/[matchId]/points/index.ts`

**選手データAPI (1ファイル)**
- `/api/players/index.ts`

**大会データAPI (2ファイル)**
- `/api/tournaments/index.ts`
- `/api/tournaments/[tournamentId]/categories.ts`

**その他 (3ファイル)**
- `/api/hello.ts` (テスト用)
- `/api/test-db.ts` (データベーステスト)
- `/api/clear-data.ts` (データクリア)

**対策**: 

1. **OG画像生成**: Cloudflare Workersで`@vercel/og`の代替実装が必要
2. **データAPI**: 以下の選択肢があります:
   - **オプションA**: ビルド時に全データを静的JSONファイルとして生成(推奨)
   - **オプションB**: Cloudflare Workersで動的APIとして実装
   - **オプションC**: Supabase等の外部APIサービスを利用
3. **画像最適化**: `images.unoptimized: true`で無効化

### 2. OG画像生成

`@vercel/og`を使用している場合、Cloudflare Workersで同等の機能を実装する必要があります。

### 3. リダイレクト設定の移行

`next.config.ts`の`redirects()`関数は静的エクスポートでは動作しないため、Cloudflareの`_redirects`ファイルに移行が必要です。

---

## 💡 推奨事項

### 短期的な対応

1. **まずは静的エクスポートのテスト**: ローカル環境で`output: 'export'`を設定し、ビルドが成功するか確認
2. **Vercel固有機能の棚卸し**: 現在使用しているVercel固有の機能をリストアップ
3. **段階的な移行**: 本番環境はVercelのまま、テスト環境でCloudflare Pagesを試す

### 長期的な対応

1. **Cloudflare Pagesへの完全移行**: 広告収益化を開始する前に移行を完了
2. **Cloudflare Workersの活用**: 動的機能が必要な場合はWorkersで実装
3. **モニタリング体制の構築**: Cloudflare Analyticsで継続的なパフォーマンス監視

---

## 📈 期待される効果

### コスト削減

- Vercel Pro ($20/月) → Cloudflare Pages (無料)
- **年間約$240の削減**

### パフォーマンス向上

- より多くのエッジロケーション(300+拠点)
- 無制限の帯域幅
- グローバルなレスポンスタイム改善

### 柔軟性の向上

- 広告掲載による収益化が可能
- ベンダーロックインの軽減
- Cloudflareエコシステムとの統合(Workers, R2, D1など)

---

## 🎯 次のステップ

1. **現状確認**: API Routesや`getServerSideProps`の使用状況を確認
2. **テスト移行**: 開発環境でCloudflare Pagesへのデプロイをテスト
3. **移行計画の策定**: 具体的なタイムラインと作業項目を決定
4. **段階的な実施**: リスクを最小化するため、段階的に移行

---

## 📚 参考リンク

- [Cloudflare Pages公式ドキュメント](https://developers.cloudflare.com/pages/)
- [Next.js Static Exports](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [@cloudflare/next-on-pages](https://github.com/cloudflare/next-on-pages)
- [Cloudflare Pages料金](https://www.cloudflare.com/plans/developer-platform/)
