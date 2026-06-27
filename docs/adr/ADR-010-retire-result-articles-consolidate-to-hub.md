# ADR-010: 結果記事（/news *-result）を廃止し、結果・優勝・歴代まとめを大会ハブに集約する

## Status

Accepted。決定日: 2026-06-27。現状仕様: `docs/wiki/news-context-blocks.md` / `docs/wiki/seo.md` #8 / `docs/wiki/public-pages.md`。

ADR-005（速報・プレビュー機能）の「記事の再利用先として結果記事（result）も持つ」部分を **Superseded**（結果記事のみ）。文脈ブロックを一次成果物とする中核方針、プレビュー（preview）記事、既存ページ差し込みは ADR-005 のまま有効。

## Context

`/news/<articleId>` 記事は preview（大会前の展望）と result（結果確定後の速報）の 2 type を同一 articleId で運用する設計だった（ADR-005）。result 記事は「優勝者＋節目（milestone）＋歴代優勝者」を載せる。

しかし運用してみると、result 記事は **大会 × 年度ごとに 1 枚ずつ増える**（例: `zennihon-championship-2022/2023/2024/2025-result` の 4 枚）。一方、各 result 記事が載せる「結果・優勝・歴代まとめ」は、**大会ごとに 1 枚で全年度を蓄積する大会ハブ `/tournaments/[generation]/[tournamentId]`** が既に提供しているものとほぼ同じである（ハブは歴代優勝者表＋最新年度 milestone を持ち、result 記事からも `hubHref` で既にリンクしていた）。

結果として:

- 同一実体（1 大会の結果・優勝・歴代）に対し、ハブ（大会ごと 1 枚・蓄積型）と result 記事（年度ごとに増殖）の **二重ページ**が生まれていた。これは `seo.md` が制御対象とするカニバリゼーション（#8）そのもの。
- 「大会ごとの結果・優勝・歴代まとめを 1 枚に集約し、新年度が出るたびに蓄積され一覧上位に上がる」という運用上の要望に対し、その器は新設するまでもなく**ハブが既に満たしている**。

なお高校全国大会（インターハイ / ハイスクールジャパンカップ）は、ハブではなく `/highschool/tournaments/[tournament]`（高校歴代ページ）に検索面を集中させる方針が既にある（`seo.md` #3）。

## Decision

**result 記事を廃止し、「大会ごとの結果・優勝・歴代まとめ」は大会ハブに一本化する**。`/news` は大会前の **preview（展望: 前回王者・出場校 ほか）専用**とする。

1. ビルド対象を preview のみに絞る。`lib/newsArticle.ts` に `listPublishedPreviews()` を追加し、`src/pages/news/index.tsx`（一覧）と `src/pages/news/[articleId].tsx`（`getStaticPaths`/`getStaticProps`）が preview のみを対象にする。result レコードはビルドされない。
2. 生成スクリプト `scripts/generate-news-drafts.mjs` を preview 専用化（`--type result` は廃止メッセージを出して終了）。
3. 既存の未公開 result ドラフト（63 件）の `data/news/*-result.json` を削除。preview レコードは残す。
4. 公開済みだった result 記事 5 件は `public/_redirects` で 301:
   - `highschool-japan-cup-2022〜2025-result` → `/highschool/tournaments/japan-cup/`（高校全国大会は高校歴代ページへ集中＝`seo.md` #3 に準拠）
   - `international-korea-cup-2026-result` → `/tournaments/international/international-korea-cup/`（大会ハブ）

集約先をハブにする（`/news` 内に大会ごと 1 枚を新設しない）のは、新設するとハブと丸かぶりになり、`seo.md` #8 で避けるべきとした重複を自ら作るため。

## Alternatives

- **`/news` 内に大会ごと 1 枚の結果まとめを新設し、年度別 result 記事を集約**: ハブと同一実体の二重ページになる。採用するならハブ側を noindex 等にする棲み分けが別途必要で、既存資産（ハブの内部リンク・構造化データ）を捨てることになる。不採用。
- **result 記事を年度ごとに維持しつつ noindex で薄め置き**: 増殖と二重管理が残り、要望（1 枚集約）も満たさない。不採用。
- **ハブを廃止して /news 側に寄せる**: ハブは年度なしクエリ（「大会名 結果 / 歴代」）の受け皿として既に内部リンク・構造化データを蓄積しており、移植コスト・毀損リスクが高い。不採用。

## Consequences

- 利点: 同一実体の二重ページが解消。「大会ごと 1 枚・蓄積型」の器はハブで満たされ、新年度の追加でハブが厚くなる。`/news` の役割が「大会前の展望（flow）」に純化し、ハブ（stock）と直交する。
- 影響: 過去の年度別 result 記事が持っていた「その年の節目の読み物」は失われるが、内容は (a) ハブの最新年度 milestone、(b) 年度別結果ページの `ResultContextBlocks`（注目ポイント）、(c) 歴代優勝者表でおおむねカバーされる。
- 今後: ハブを「結果・優勝・歴代まとめ」の正として強化する余地がある（歴代横断統計＝最多優勝・連覇記録ランキング・優勝校の都道府県分布の経年変化など。farm が構造的に持てない DB 由来の差別化＝`seo.md` #8 の方針）。本 ADR の集約はその前提を整える。
- 監視: 301 後、対象 URL の評価が集約先（高校歴代ページ／ハブ）に移ったかを GSC で確認する。

## Related Files

- `lib/newsArticle.ts`（`listPublishedPreviews`）
- `src/pages/news/index.tsx` / `src/pages/news/[articleId].tsx`（preview 限定）
- `scripts/generate-news-drafts.mjs`（preview 専用化）
- `public/_redirects`（旧 result URL の 301）
- `docs/wiki/news-context-blocks.md` / `docs/wiki/seo.md`（#8）/ `docs/wiki/public-pages.md`

## Open Questions

- ハブの「結果・優勝・歴代まとめ」としての強化（歴代横断統計）の具体仕様と実装順序。
- 301 集約先の評価移行が GSC で確認できるか（高校歴代ページ／ハブが対象クエリで上位を取れているか）。
