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
- **選手名のリンク化（2026-08-11 実装）**: 上記の「対象外」は古い記述（`/players/[id]` が手動整備22名
  だった頃のもの）で、現在は Player Statistics Engine により `data/players/index.json` が18,543名を
  カバーしている。`aggregateStLeagueTeam()` が返す `StLeagueTeamSeason.players`（年度別登録メンバー、
  `participants.json` の `Team.players` 由来）を、`/teams/[teamId]/index.tsx` 側で姓名一致により
  `/players/{id}/results/` へリンクする（高校学校ページの `playerLinks` と同じパターン。
  `count>=5` の選手のみ、同姓同名は先勝ち）。
  **`participants.json` 側の `player.id` はそのファイル内だけのローカル連番で、選手DBのグローバル id とは
  別物**（実測: STリーグ側 `id:1`＝上松俊貴、選手DB側 `id:1`＝安藤圭祐で別人）。誤リンクを避けるため
  この id はリンク生成に使わず、必ず姓名照合で解決すること。
- **`/st-league/[year]/teams` の選手別成績表にも同じリンクを追加（2026-08-11）**: `TeamsRanking`
  コンポーネントは元々 `playerLinks` propに対応していたが呼び出し側（`getStaticProps`）が渡していな
  かった。`PlayerStats.id`（tournament由来のpid、または `manual_{teamId}_{姓}_{名}` の合成id）は
  形式が一定しないため、id ではなく `PlayerStats.name`（`"姓 名"` 形式で確定）を分割して姓名照合する
  （`/teams/[teamId]` と同じ `count>=5` ・先勝ちルール）。実データ（2025年男子NTT西日本）で
  10名中10名がリンク解決できることを検証済み。

### 「メンバー」クエリの受け皿（2026-08-11 追加 → 同日「年度別メンバー」に統合）

`/teams/[teamId]/index.tsx` に年度別メンバー節を置き、「{チーム名} メンバー」系クエリを拾う。
新規URLは作らず既存の `/teams/[teamId]/` を厚くするだけ（`docs/wiki/seo.md` の
「内部リンク集約」方針と同型）。

**Deprecated（初版）**: 当初は「{チーム名}のSTリーグ登録メンバー」節として
`StLeagueTeamSeason.players` のみを表示していたが、同日中に下記の統合版へ置き換えた。
STリーグ側ロースターの収録が年度・男女で大きく偏る（実測: 2025男子は40/40チームで収録、
2023/2024男子は11/40、2023〜2025女子は8〜10/18〜19）ことが動機。

**現行（統合版）**: メンバーは **STリーグ側ロースター ∪ 大会成績から確認できた選手** を
**年度×性別**でまとめた1つの節（「{チーム名}の年度別メンバー」）で表示する。

- 集計: `buildTeamRosterByYearGender()`（`src/utils/team-data-aggregator.ts`）。
  `getStaticProps` で計算済みの `aggregateTeamResults()` / `generateTeamInfo().players` /
  `aggregateStLeagueTeam().seasons` を受け取る純粋関数で、新たなファイル走査はしない。
- **他チーム選手のフィルタが必須**: `extractTeamDataFromTournament` はエントリー内に1人でも
  自チーム選手がいればエントリー全員の pid を `results[].playerIds` / `matches[].pair` に入れる。
  合同ペアの相方など他チーム所属 pid が混ざるため（`nssu` で38件）、`generateTeamInfo().players`
  の集合で必ず交差を取る。
- **氏名の正規化 dedup**: pid（`姓_名_チーム_都道府県`）は都道府県サフィックスの有無などが揺れ、
  生 pid では同一人物が重複する（`nssu` で249→118件）。`normalizeJa(姓+名)` をグルーピングキーに
  使い、表示名は「`playerLinks` で解決できる表記」を優先する（`normalizeJa` は照合専用）。
- 氏名が空（`null`）のチームエントリー pid（例: `FUJITSU_東京都`、`日本体育大学`）は除外する。
  団体戦で `entries[].playerIds` がチームを指すファイルからは選手を拾えない（既知の制約）。
- `gendersWithRealPresence`（大会別成績グリッド用フィルタ）は**適用しない**。ミックスにしか
  出ていない選手もその年度のメンバーとして掲載する。ただし上流の `aggregateTeamResults` が
  性別を推定できなかった選手はミックス分配時に落ちる。
- 表示は**男女タブ**（男女両方ある21チームのみタブを出し、片方だけの40チームはタブ無し）。
  非アクティブなパネルも HTML には出力して `hidden` で隠す（`/st-league/[year]/teams` と同方針。
  クローラーが両方の性別のメンバーを読める）。タブ内は年度降順のカード。
- title/description/FAQ は `hasStLeague` × `hasRoster`（メンバーが1件でもあるか）の**4パターン**。
  メンバーFAQは出典を問わない中立文言（「{チーム名}のメンバーは確認できますか？」）にし、
  STリーグ非出場チームでも文脈が合うようにした。実測の内訳（全67ページ）は
  `true/true` 60・`true/false` 6・`false/true` 1（`nssu`）・`false/false` 0。
- `playerLinks` は STリーグ側と大会成績側の**氏名の和集合**を対象に構築する
  （旧実装は `if (stLeague)` の中でSTリーグ側の氏名だけを対象にしていたため、
  STリーグ非出場の `nssu` では常に空だった）。照合ルール（`count>=5`・同姓同名先勝ち）は不変。
- 効果の実測: STリーグ側ロースターが全年度0件の22チームのうち**16チーム**でメンバー節が
  表示されるようになった。`nssu`（STリーグ非出場）は118名・年度×性別で最大37名を掲載。
- 設計と検証の詳細: `docs/raw/2026-08-11-teams-tournament-roster-design.md`。
- 実装: `src/utils/team-data-aggregator.ts`（`buildTeamRosterByYearGender`、
  `parseGenderFromCategory`）、`src/pages/teams/[teamId]/index.tsx`。

### 大会一覧との連携（2026-08-12）

STリーグは `data/st-league/` の独立系統のため、従来は `/tournaments`（大会一覧）に一切出ていなかった。
**結果本体は `/st-league/` に置いたまま、一覧には出す**方針で以下を追加した（結果データを
`data/tournaments/details/` に複製する案は採らない。理由は下記）。
経緯と不採用案の検討は [raw/2026-08-12-st-league-in-tournaments-list.md](../raw/2026-08-12-st-league-in-tournaments-list.md)。

- `data/tournaments/index.json` に `st-league`（`generationId: "corporate"`、
  label「STリーグ（日本ソフトテニスリーグ）」）を追加。`featurePath: "/st-league/"` を持つ。
- `data/tournaments/information/st-league.json` に第1〜3回（2023・2024・2025）を追加。
  各年度は `resultPath` で `/st-league/{year}/matches/` を指す。会場は `league.json` から
  転記し、住所・電話・コート数など未検証の項目は入れていない。
  **プレーオフ（入替戦）は日程・会場が別**だが、一覧では大会1件＝リーグ戦本体として扱い、
  別インスタンスにはしていない。
- 一覧では「実業団・社会人」「全国」バッジ付きで並び、大会名・「結果」バッジから
  `/st-league/{year}/matches/` へ内部リンクする（`resultPath` の仕組みは
  [public-pages.md](./public-pages.md) 参照）。
- ハブ `/tournaments/corporate/st-league/` は自動生成されるが、`featurePath` により
  `noindex, follow` ＋ 特集への誘導バナーになる（`/st-league/` とのカニバリ回避）。

**details に結果を複製しない理由**: (1) tie の内訳（D1・S・D2の本数と出場選手）が
details の `matches[].scores`（エントリー単位の数値）に収まらず情報が落ちる、
(2) `/st-league/[year]/matches` と検索面がカニバる、(3) 順位が `computeRanking()` の
算出値なのに details 側は `results[].roundrobin.rank` を手で持つ形になり二重管理になる。
なお details に入れれば Player Statistics Engine に乗り選手ページにSTリーグ戦績が出る
（現状 `matches.json` は選手DBに流れていない）という利点はあるため、**選手DB連携が
主目的になった場合は改めて判断する**（Open Question）。

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
