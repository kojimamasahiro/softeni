# STリーグ ページ / データモデル

STリーグ（ソフトテニス実業団リーグ）の公開ページとデータ構造に関するwiki。

## 概要

STリーグは日本ソフトテニス連盟（JSTA）が主催する実業団リーグ戦。男女それぞれが
**STリーグⅠ・Ⅱ・Ⅲ** の階層に分かれ、各リーグ内で総当たり戦を行う。リーグ戦後の
**プレーオフ（入替戦）** で昇格・降格が決まる。

- 第1回: 2023年（令和5年）
- 第2回: 2024年（令和6年）
- 第3回: 2025年（令和7年、栃木県宇都宮市・日環アリーナ栃木）

## ディレクトリ構成

```
data/st-league/
  editions.json            ... 全体概要・開催回・年度間の昇降格（履歴）
  {year}/
    league.json            ... その回のメタ情報（開催回/会場/division構成/プレーオフ/成績）
    participants.json      ... 出場チーム・選手（チームごとに division を持つ）
    matches.json           ... 対戦結果（試合ごとに division を持つ）
```

### division フィールド

参加チーム・各試合は `division`（`"1"`/`"2"`/`"3"`）を持つ。`"1"` が最上位（STリーグⅠ）。
未設定の旧データは `"1"` とみなす（`divisionOf()`）。

**STリーグⅢ の位置付け**: Ⅲ部はⅡ部昇格を目指すチームが集う、STリーグの土台となる階層。
多数の地域チームが参加し大会データの収集が難しいため、当サイトでは**階層構成（Ⅰ・Ⅱ・Ⅲ）の
中での位置付けを紹介する**扱いとし、対戦データ・順位表は持たない。将来データを埋める前提の
「準備中」ではない点に注意。`league.json` の Ⅲ部は `hasMatchData: false` とし、`getDivisions()`
が試合結果/チーム/分析ページから除外する。

### league.json の主なキー

- `edition` / `title` / `period` / `venue` / `location`
- `format` … tie（3本勝負の順序）、game（7ゲームマッチ）
- `playoff` … 入替戦の名称・日程・会場・説明
- `divisions[]` … `{ id, name, rank, teamCount, note, hasMatchData }`
- `results` … division別・男女別の優勝/準優勝/3位（teamId）

## 共有モジュール

`src/utils/st-league.ts` に型定義・ローダー・順位計算を集約。

- `getStLeagueYears()` … 年度ディレクトリ一覧（降順）
- `loadLeagueMeta(year)` / `loadParticipants(year)` / `loadMatches(year)`
- `getDivisions(meta)` … rank昇順のdivision一覧（無ければ既定のⅠ/Ⅱ/Ⅲ）
- `computeRanking(teams, matches)` … 勝数→直接対決→得失点差→得点で順位決定
- `divisionOf(item)` / `buildPlayerMap(teams)`

## ページ

- `/st-league` … ハブ。年度・リーグ構成の概要、各年度への導線。`getStLeagueYears()`で動的生成。
- `/st-league/about` … ルール・Ⅰ/Ⅱ/Ⅲ構成・プレーオフの解説。
- `/st-league/[year]` … 年度ハブ（年度トップ）。`league.json` のメタ＋`editions.json` の王者（表示名）を読み、
  大会概要（開催回・日程・会場・リーグ構成・対戦/ゲーム形式）／優勝チーム（男女、championsへ）／
  各サブページ（matches/teams/analysis）への導線／プレーオフ案内を描画する。集計ロジックは不要。
  狙うキーワードは「STリーグ {年}」「第N回STリーグ 結果・会場」。**matches とのカニバリ回避のため、
  順位表・対戦結果は再掲せず matches へ委譲し、本ページは概要＋導線に限定する**（intent 分離）。
  SportsEvent 構造化データを出力。`getStaticProps` を持つため sitemap は自動列挙（`additionalPaths` 不要）。
  内部リンク: ハブの年度カード見出し→年度ハブ、championsの各回ダイジェスト→年度ハブ、
  各サブページのパンくず（`STリーグ > {year} > 各ページ`）→年度ハブ、matches の他ページ導線→年度ハブ。
- `/st-league/[year]/matches` … 男女タブ＋リーグ切替。順位表（昇降格ゾーンの目安表示）＋対戦結果＋プレーオフ案内。SportsEvent構造化データ。
  Ⅰ部・finished の各対戦行には「この対戦の詳細 →」リンク（下記 `[matchId]` ページへ）を出す（展開UIは維持）。
- `/st-league/[year]/matches/[matchId]` … 個別対戦の詳細ページ（ADR-008）。**Ⅰ部かつ `status:"finished"` の対戦のみ**を
  静的生成する。「{チームA} vs {チームB}」系クエリの受け皿。スラッグは `${gender}-${teamA}-vs-${teamB}`
  （男女で id が衝突するため gender 接頭辞、teamId ペアで対戦主体をURLに含める）。Ⅰ部は年度×男女ごとに
  各無順序ペアが1回のみ対戦するため一意。内容: スコア要約／D1・S・D2の個別結果と出場選手／両チームの
  リーグ順位／この2チームの過去対戦（他年度Ⅰ部、`[matchId]`へ内部リンク）／各チームの他の対戦（同年度Ⅰ部）
  ／順位表・チーム・分析・年度トップへの導線。SportsEvent（competitor付き）＋BreadcrumbList構造化データ。
  `getStaticPaths(fallback:false)`+`getStaticProps` で全対戦を事前生成（2023〜2025で計161ページ）。
  将来Ⅱ部/プレーオフへ拡張する場合、同一ペアがリーグ戦と入替戦で重複しうるためスラッグへ division/round の付与が必要。
- `/st-league/[year]/teams` … 男女タブ＋リーグ切替。チーム別年間成績・選手成績。
  選手成績は `aggregateTeamResults`（`data/tournaments/details/` の一般大会データ）を
  participants.json のチーム名・選手名で照合して集計する（STリーグ本体の `matches.json` とは
  別系統。STリーグ内の勝率は analysis ページが `matches.json` から算出）。照合は
  `normalizeJa()`（NFKC で半角/全角、簡易な異体字フォールドで `ＥＮＥＯＳ⇄ENEOS`・`髙濵⇄高濱`
  等を吸収）。一般大会の個人戦データが無い選手（主にⅡ部）は0表示のまま。
- `/st-league/[year]/analysis` … 男女タブ＋リーグ切替。選手別スタッツ・勝率ランキング。
- `/st-league/champions` … 歴代優勝・記録ページ（年度横断の常緑コンテンツ）。`editions.json` の
  `editions[]`（男女王者・会場・note）と `promotionRelegation[]`（昇降格の系譜）を読んで描画する。
  集計ロジックは不要（既存JSONを並べるだけ）。構成: 歴代王者表（男女）／記録ハイライト（連覇など）
  ／昇降格の系譜／各回ダイジェスト＋各年度 matches への内部リンク。ItemList 構造化データを出力。
  `getStaticProps` を持つため sitemap は自動列挙される（`additionalPaths` には追加しない）。
  狙うキーワードは「STリーグ 歴代優勝」「優勝チーム 一覧」「昇格 降格」など、速報系競合が手薄な常緑層。

すべての `[year]` ページは `getStLeagueYears()` でパスを動的生成するため、`data/st-league/{year}/` を追加すれば自動でページが増える。

### チームページ連携（回遊 / ADR-009）

- `/st-league/teams` … **STリーグ 掲載チーム一覧**（年度横断）。男女×所属リーグ別に各チーム→`/teams/[teamId]` へ
  リンク。STリーグ特集の一部（全体ハブ `/teams` は作らない）。Ⅲ部など未掲載があるため「掲載チーム」と表現。
  `getStaticProps` を持つため sitemap 自動列挙。STリーグハブ（`/st-league`）から導線。
- `data/teams/team-name-mappings.json` に**STリーグ全 teamId をエイリアス（正式名先頭）付きで追加**。
  これで `/teams/[teamId]` と下層 `/teams/[teamId]/[year]/[gender]` が生成され、tournament データの
  名寄せ（`normalizeJa` 完全一致）も有効化される。名称衝突なし（participants の name[] 由来、検証済）。
- `/teams/[teamId]` は従来 `team-name-mappings.json` のキーのみ生成していたが、上記により**STリーグ出場チーム
  にも生成**し、「STリーグでの成績」セクション（年度別の所属部・W-L・順位・優勝、
  各年度→`/st-league/{year}/matches`）を描画する。集計は `aggregateStLeagueTeam(teamId)`（st-league.ts）。
- トップ「所属別成績」枠（日体大・ワタキューセイモア＋外部公式リンク）とグローバルナビは現状維持。
- STリーグ各ページのチーム名は `/teams/[teamId]` へリンクする（順位表＝matches、見出し＝teams、
  対戦詳細ヘッダー＝matches/[matchId]）。
- **404 回避**: tournament の年度別下層 `/teams/[teamId]/[year]/[gender]` は mapping キーのチームしか
  生成しないため、「大会別成績」セクション（下層リンク）は `hasSubPages`（mapping キー）チームのみ描画。
  STリーグのみのチームでは大会別リンクを出さない。
- **選手名はリンク化しない**: `/players/[id]` は手動整備の22名のみで id 体系も別。誤リンク/404 回避のため
  対象外（将来、選手ページ整備とあわせて検討）。

## SEO / UX

- ハブ: ItemList 構造化データ（開催年度一覧）。h1 は「STリーグ 結果・順位表・出場チーム」（
  「STリーグとは」の解説は `/st-league/about` に集約し、ハブとのキーワード重複を避ける）。
- matches: SportsEvent 構造化データ（日程・会場・主催）。
- 全ページでパンくず（`Breadcrumb` コンポーネント）が BreadcrumbList 構造化データを出力する。
- リーグ切替・男女タブはページ内 state で切り替えるが、**全 gender×division（＋プレーオフ）の
  パネルを最初から HTML に出力し、非アクティブなパネルは CSS（Tailwind `hidden`）で隠す**。
  これにより女子・Ⅱ部・プレーオフ・選手成績など全タブの内容が静的 HTML に含まれ、クローラーが
  インデックスできる（旧実装は active タブのみ描画していたため非 active の内容が HTML に出なかった）。
  URL は従来どおり年度単位で静的（タブは URL に持たない）。
  - 実装メモ: 各 `[year]` ページは 1 パネル分を描画する純コンポーネント（`MatchesPanel` /
    `StatsPanel` 等）または純関数（`computePlayerStats`）に切り出し、props だけで計算して
    全組み合わせを描画する。対戦詳細の開閉 state（matches）はパネルをまたいで衝突しないよう
    `${gender}-${divisionId}-${matchId}` をキーにする。
- 順位表に「昇/降」バッジで入替戦対象の目安を表示（最上位は降格のみ、最下位は昇格のみ）。

### sitemap

- `next-sitemap`（`output: export` 構成）は `getStaticProps` を持たない純静的ページを自動列挙しない。
  そのため `/about` `/contact` `/faq` `/privacy` `/st-league/about` は
  `next-sitemap.config.js` の `additionalPaths` で明示的に補っている（動的/SSG ページは自動列挙
  されるので追加しない＝重複防止）。新たに純静的な公開ページを追加したらこのリストにも足すこと。
- `/st-league/[year]/matches/[matchId]`（対戦詳細）は `fallback:false` で全対戦を静的書き出しするため、
  既存の `/st-league/{year}/matches/` と同じ仕組みで自動列挙される想定（`additionalPaths` には足さない）。
  **要ビルド後確認**: `npm run build` 後に `out/sitemap-0.xml`（または `public/sitemap-0.xml`）へ
  `https://softeni-pick.com/st-league/2025/matches/<slug>/` が含まれるか確認すること。含まれない場合のみ、
  st-league JSON から生成する `additionalPaths` ジェネレータを追加する（その際は二重計上に注意）。

## データ追加手順（新年度・新リーグ）

1. `data/st-league/{year}/league.json` を作成（divisions・playoff・results）。
2. `participants.json` に各チーム（`division` 付き）と選手を追加。
3. `matches.json` に各試合（`division` 付き）を追加。
4. 必要に応じ `editions.json` に開催回・昇降格を追記。

## Open Questions / 未入力データ

- STリーグⅢ は階層構成の中での位置付けを紹介する扱いとし、対戦データは持たない方針（上記「STリーグⅢ の位置付け」参照）。
  「準備中」の TODO ではないため、データ収集対象には含めない。
- STリーグⅡ（女子）は2025（第3回）を入力済み。予選リーグ（3ブロック・各4チーム）の星取り18タイと
  最終順位（公式記録、`results.2.girls` の `ranking`/`blocks`）を掲載。順位決定戦の個別対戦・選手別データは
  未入力（女子は公式PDFに選手名簿が無いため tie 単位のみ／`matches: []`）。開催日は男子Ⅱ部に合わせた
  仮置き（2025-12-11、Assumption）で要確認。他年度（2023・2024）の女子Ⅱ部や2026以降は別途入力が必要。
- 年度間の昇降格の確定情報（`editions.json` の `promotionRelegation` は一部 Assumption）。
- NTT西日本の連覇数など個別記録の裏取り。

詳細は `docs/wiki/open-questions.md` を参照。
