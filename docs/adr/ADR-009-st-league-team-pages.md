# ADR-009: STリーグ出場チームの /teams/[teamId] ページ生成と相互リンク

## Status

Accepted

## Context

SEO 改善計画（`docs/raw/st-league-seo-gap-analysis-2026-06.md`）の優先度③（回遊）で、
STリーグ各ページのチーム名・選手名がプレーンテキストでリンクになっておらず、チーム軸の
回遊が断線していた。

リンク先候補を調査した結果、destination が事実上存在しないことが判明:

- `/teams/[teamId]` の `getStaticPaths` は `data/teams/team-name-mappings.json` のキー
  （当時 **2件**: `nssu`/`watakyu`）のみを生成しており、STリーグ出場66チームのページはほぼ無い。
- `/players/[id]` のページは `data/players/<dir>` のディレクトリ（**22名**）だけ。STリーグ参加選手の
  id 体系（participants.json の数値 id）とも別系統で、名前一致も曖昧。

このため「名前をリンクにするだけ」では大量の 404 を生む。先に destination を用意する必要がある。
チーム軸データの置き場は既に「`/teams/[teamId]` 内のセクション」と決定済み（協議メモ参照）。

## Decision

STリーグ出場チームに `/teams/[teamId]` ページを生成し、「STリーグでの成績」セクションを追加する。
そのうえでSTリーグ各ページのチーム名を `/teams/[teamId]` へリンクする。

- **getStaticPaths（`/teams/[teamId]`）**: `team-name-mappings.json` のキー **∪**
  `getAllStLeagueTeamIds()`（全年度 participants の teamId）。
- **集計**: `src/utils/st-league.ts` に `aggregateStLeagueTeam(teamId)` を追加。年度横断で
  出場シーズン（年度・男女・所属部・W-L・順位・優勝）と通算（Ⅰ部優勝回数・出場期間）を返す。
  順位は公式 `results[div][gender].ranking` 優先、無ければ `computeRanking` の計算順位。
- **ページ描画**: 「STリーグでの成績」セクション（年度別表、各年度→`/st-league/{year}/matches` へリンク）を
  常に出す。`Article`/`BreadcrumbList`/`SportsTeam` 構造化データは既存どおり。
- **404 回避（重要）**: tournament の年度別下層ページ `/teams/[teamId]/[year]/[gender]` は従来どおり
  mapping キーのチームしか生成しない。よって**大会別成績セクション（下層ページへのリンク）は
  `hasSubPages`（= mapping キーである）チームのみ描画する**。STリーグのみのチームでは大会別リンクを
  出さず、404 を防ぐ。表示名は STリーグ名（participants の name[0]）を優先。
- **選手名のリンクは対象外**: `/players/[id]` は22名のみで id 体系も別。誤リンク・404 を避けるため
  本 ADR では選手名はリンク化しない（将来、選手ページの整備とともに別途検討）。
- **チーム名リンク箇所**: `/st-league/[year]/matches`（順位表）、`/st-league/[year]/teams`（見出し）、
  `/st-league/[year]/matches/[matchId]`（ヘッダー）。

## Alternatives

- **STリーグ専用 `/st-league/teams/[teamId]` を新設**: 既存チームページと二重化し評価分散。協議で
  `/teams/[teamId]` 内セクションに決定済みのため却下。
- **下層ページ `[year]/[gender]` も全STチームへ拡張**: ページ数が大きく増え、tournament データの無い
  チームは薄ページ化。今回は index への集約に留め、下層は mapping 対象のみ維持。
- **選手名も名前一致でリンク**: 同名・欠落で誤リンク/404 リスク。却下。

## Consequences

- メリット: STリーグの全チーム名が実在ページへリンクし、チーム軸の回遊が成立。内部リンク密度向上。
  チームページが常緑の受け皿になり指名検索・被リンクに寄与（優先度③・④）。
- コスト: `/teams/[teamId]` の生成ページ数が +約64。tournament 専用だった本ページに STリーグ依存が入る。
- 注意: `team-name-mappings.json` に新キーを足すと下層ページ対象が変わる。STリーグ teamId と
  mapping キーが将来衝突/別名になる場合は名寄せに注意。

## 追補（2026-06 方針修正）

- **チーム一覧の置き場**: 当初 `/teams`（全体ハブ）に新設したが、内容がSTリーグ専用のため
  **`/st-league/teams`（STリーグ特集の一部）に移設**。`/teams` の全体ハブは作らない（`/teams` は引き続き
  index 無し）。日体大など非STチームは対象外。
- **「全チーム」表現の回避**: STリーグにはⅢ部もあり対戦データ未掲載のチームがあるため、一覧は
  「**掲載チーム**」と表現する（`getAllStLeagueTeamIds()` ＝ participants にあるチーム＝掲載対象）。
- **66チームのフルページ化**: `data/teams/team-name-mappings.json` にSTリーグ全 teamId を
  エイリアス（正式名先頭）付きで追加。これにより `/teams/[teamId]` と下層 `[year]/[gender]` が
  生成され、tournament データの名寄せ（normalizeJa 完全一致）も有効化。名称衝突は無し（検証済）。
- **トップページ・ナビは現状維持**: トップ「所属別成績」枠の日体大・ワタキューセイモア（外部公式リンク含む）は
  元のまま。グローバルナビにも `/teams` は出さない。公式リンク撤去は今回見送り（別途検討）。

## Implementation Status

- 実装済み: `src/utils/st-league.ts`（`aggregateStLeagueTeam` / `getAllStLeagueTeamIds`）、
  `src/pages/teams/[teamId]/index.tsx`（paths 拡張・ST セクション）、
  `src/pages/st-league/teams.tsx`（掲載チーム一覧）、`data/teams/team-name-mappings.json`（66チーム追加）、
  `src/pages/st-league/index.tsx`（一覧への導線）、
  `src/pages/st-league/[year]/{matches.tsx, teams.tsx, matches/[matchId].tsx}`（チーム名リンク）。
- 検証: `tsc --noEmit` 通過。`aggregateStLeagueTeam` と getStaticPaths union 件数を実データで確認。
  ※ `next build` 本体は実行環境のアーキ差で未実行（ローカルでの確認を推奨）。
- sitemap: `/teams/[teamId]` は SSG で自動列挙される想定。ビルド後に確認。

## Related Files

- `src/utils/st-league.ts`
- `src/pages/teams/[teamId]/index.tsx`
- `src/pages/st-league/[year]/matches.tsx` / `teams.tsx` / `matches/[matchId].tsx`
- `docs/wiki/st-league.md`

## Open Questions

- 選手ページ（`/players/[id]`）の整備と、STリーグ選手→選手ページのリンク化（将来）。
- 「STリーグでの成績」に対戦履歴（相手別 head-to-head）まで載せるか（現状は年度別サマリーまで）。
