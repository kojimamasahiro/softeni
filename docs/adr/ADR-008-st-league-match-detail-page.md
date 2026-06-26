# ADR-008: STリーグ 対戦詳細ページ（個別対戦の独立URL化）

## Status

Accepted

## Context

STリーグ期間中の検索流入最大化（`docs/raw/st-league-seo-gap-analysis-2026-06.md`）において、
最大の網羅ギャップは「○○ vs △△」系の対戦クエリを受けるURLが存在しないことだった。
従来、対戦は `/st-league/[year]/matches` 内の展開行で表示され、個別URLを持たないため、
「{チームA} vs {チームB}」での検索でランキング対象にできていなかった。総当たり戦は対戦数が
多く（Ⅰ部8チーム＝28対戦×男女）、各対戦に固有ページを与えればロングテール面が増える。

一方、全対戦（Ⅱ部・プレーオフ・予定試合まで）を個別ページ化すると、選手データの薄い対戦や
スコア未確定の「予定」が薄いページとして大量に生成され、SEO上むしろ逆効果になりうる。

## Decision

STリーグの**Ⅰ部（最上位）かつ `status: "finished"` の対戦のみ**を、独立した静的ページとして
生成する。

- **URL**: `/st-league/[year]/matches/[matchId]`
  - `[matchId]` のスラッグは `${gender}-${teamA}-vs-${teamB}`（例: `boys-tokyo-gas-vs-tohogas`）。
    - 男女で id が衝突する（boys/girls とも id=1 から振られる）ため gender を接頭辞に含める。
    - 数値 id ではなく teamId ペアを用いることで、URL自体に対戦の主体を含め「vs」意図に寄せる。
  - 既存の `matches.tsx`（`/st-league/[year]/matches`）と同階層にディレクトリ
    `matches/[matchId].tsx` を併設する（Next.js pages router はファイルと同名ディレクトリの併存可）。
- **一意性の前提**: Ⅰ部は年度×男女ごとに各無順序ペアが1回だけ対戦するため、
  `gender-teamA-vs-teamB` は一意。将来Ⅱ部やプレーオフへ拡張する場合、同一ペアが
  リーグ戦と入替戦の双方で対戦しうるため、スラッグに division/round を含める設計変更が必要。
- **内容**: 対戦の3本（D1/S/D2）の個別スコアと出場選手、両チームのその年度の順位、
  過去の同カード（他年度Ⅰ部）への内部リンク、各チームの前後の試合（次戦・前戦）への導線、
  順位表・出場チーム・分析ページへの導線、パンくず。
- **構造化データ**: `SportsEvent`（個別試合）＋ `BreadcrumbList`。
- **既存一覧との関係**: `matches.tsx` のⅠ部・finished 行に「詳細 →」リンクを足す。展開UIは維持し、
  網羅（個別URL）と回遊（一覧内展開）の両方を残す。

## Alternatives

- **全対戦を個別URL化**: 網羅は最大だが、薄ページ大量生成のSEOリスク。却下（将来Ⅰ部で効果検証後に判断）。
- **数値 id スラッグ（例 `boys-1`）**: 実装は単純だが、URLに対戦主体が出ず「vs」意図に弱い。却下。
- **日本語名スラッグ（例 `ＮＴＴ西日本-vs-ヨネックス`）**: 可読性は高いが、URLエンコード・表記揺れ・
  リンク安定性の問題。teamId（romaji）を採用。
- **`/st-league/match/[id]` のような年度非依存URL**: 年度文脈・パンくず・回遊が弱くなるため却下。

## Consequences

- メリット: 「{チームA} vs {チームB}」「{チームA} vs {チームB} 結果」のロングテール獲得。
  内部リンク密度の向上（一覧↔詳細↔過去対戦↔次戦）で回遊と順位安定に寄与。
- デメリット/コスト: 生成ページ数が増える（Ⅰ部 finished のみなので年度×男女×最大28程度に限定）。
  teamId を含むURLのため、teamId 改称時はリンク変更（必要なら `redirects-map.json` で対応）。
- sitemap: `getStaticPaths`+`getStaticProps` の静的書き出しページ。`output: export` では `out/` の
  HTMLが走査されるため自動列挙される見込みだが、ビルド後に sitemap 出力を確認し、含まれない場合は
  `next-sitemap.config.js` の `additionalPaths` で st-league JSON から補う。

## Related Files

- `src/pages/st-league/[year]/matches/[matchId].tsx`（新規）
- `src/pages/st-league/[year]/matches.tsx`（行リンク追加）
- `src/utils/st-league.ts`（既存ローダー・型を利用）
- `lib/sportsEventJsonLd.ts`（SportsEvent 推奨項目）
- `docs/wiki/st-league.md`（ページ一覧へ追記）
- `next-sitemap.config.js`（必要時のみ additionalPaths）

## Implementation Status

- 実装済み（`src/pages/st-league/[year]/matches/[matchId].tsx`）。`matches.tsx` のⅠ部・finished 行に
  「この対戦の詳細 →」リンクを追加。
- 生成ページ数: 2023〜2025 のⅠ部・finished で計161ページ（男女合算）。
- 検証: `tsc --noEmit` 型チェック通過。getStaticPaths/getStaticProps の論理を実データで再現実行し、
  slug往復0失敗・順位/スコア/勝者/過去対戦/前後試合が正当・不正slugは notFound を確認。
  ※ 本リポジトリと別アーキの実行環境のため `next build` 本体は未実行。ローカルでのビルド確認を推奨。
- sitemap: 自動列挙される想定。ビルド後に `out/sitemap-0.xml` で対戦詳細URLの有無を要確認
  （`docs/wiki/st-league.md` の sitemap 節参照）。

## Open Questions

- 過去対戦（head-to-head）の表示範囲: 同カードの他年度Ⅰ部のみを対象とする（Ⅱ部混在は当面対象外）。
- 将来Ⅱ部・プレーオフへ拡張する際のスラッグ一意性の扱い（division/round の付与）。
