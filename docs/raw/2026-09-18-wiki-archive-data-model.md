# wiki アーカイブ: data-model.md（2026-09-18 圧縮前の全文）

2026-09-18 に [docs/wiki/data-model.md](../wiki/data-model.md) を「現在の仕様」だけに圧縮した。
圧縮前の本文（出典の誤りの実例・照合の実測・日付つきの追記）をここにそのまま残す。
手順は [docs/prompts/slim-wiki-page.md](../prompts/slim-wiki-page.md)、経緯は [2026-09-18-wiki-slimming.md](./2026-09-18-wiki-slimming.md)。

本文中の wiki 内リンク（`./xxx.md`）は `../wiki/xxx.md` に置き換えた。それ以外は原文のまま。

---

## （原題）Data Model

## 概要

このリポジトリでは、少なくとも次の 2 系統のデータを扱っています。

- 静的 JSON: `data/**`, `public/data/**`
- Supabase: score 機能の動的データ

## 静的 JSON

### 大会データ

主な配置:

- `data/tournaments/index.json`
- `data/tournaments/local_index.json`
- `data/tournaments/information/*.json`
- `data/tournaments/details/**`
- `data/tournaments/delegations/*.json`
- `data/local-sources/prefecture-sources.json`
- ~~`data/local-sources/detected-documents.json`~~（2026-09-12 削除）
- `data/local-sources/ignored-documents.json`

識別・名寄せ用データ:

- チームマスタ（連番id）: `data/teams/teams.json` ＋ 文脈 `data/teams/team-context.json`
- チーム名の正準対応表: `data/tournaments/team-name-aliases.json`
- 同姓同名の別人分割: `data/players/homonyms.json`
- 詳しくは [チーム・選手の名寄せと識別](../wiki/team-player-identity.md)

関連ドキュメント:

- `docs/wiki/tournament-data-structure.md`

現行の source of truth:

- 大会一覧・世代・地域紐付け: `index.json`, `local_index.json`
- 年度情報・開催地・外部リンク・カテゴリ表示名: `information/*.json`
- 結果本体: `details/**`
- 公式発表された代表選手団: `delegations/*.json`
- 地方大会巡回元 URL: `data/local-sources/prefecture-sources.json`

地方大会候補検知ストア（Deprecated・2026-09-12 停止）:

- ~~`detected-documents.json`~~
  巡回で見つけた候補リンクの確認用ストア。**2026-09-12 に未仕分けの 583 件ごと削除**。
  停止理由は [tournaments-local.md](../wiki/tournaments-local.md)「候補検知フロー（Deprecated）」と
  [ADR-001](../adr/ADR-001-local-source-detection-store.md) を参照
- `ignored-documents.json`
  `prefectureSlug + normalizedUrl` 完全一致で除外する恒久 deny list（空のまま維持）

### 代表名簿（`delegations`）（2026-09-08 追加）

`data/tournaments/delegations/{tournamentId}-{year}.json`。
**国際大会に出場する日本代表選手団の、公式発表の転記**。1ファイル＝1大会の1回。

他の大会データと決定的に違うのは、**当サイトのデータから導出できない外部由来の事実**である点。
そのため次の3つを規約にしている。

- `source` / `sourceUrl` / `announcedOn` を**必ず持つ**。描画側はこれを併記する
- **発表に無いことは書かない**。例: 混合ダブルスのペア構成は名簿に無いので、
  過去のペア履歴から推測して補わない
- **選手のみを持つ**（監督・トレーナーは持たない）。選手は氏名を
  `data/players/index.json` と突き合わせて検証できるが、スタッフは照合できる相手がサイト内に無く、
  転記の誤りを検出できないため

`details/**` に「エントリーのみ」として入れるのではなく別の置き場所にしたのは、
details のスキーマが entries（ペア/チーム）単位で**種目の割り当て**
（この選手はシングルスと混合に出る）を表現できないこと、ペア未発表の種目で entries が作れないこと、
年度別結果ページのURLが増えること（新規URLを作らない方針に反する）の3点による。

主なフィールド:

| | 意味 |
|---|---|
| `tournamentId` / `year` | 対応する `information` レコードを一意に決める。**この年の回の代表**という意味で、年が一致するときだけ使われる |
| `members[].gender` | `boys` / `girls`。表示のグループ分け |
| `members[].affiliation` | 名簿の表記そのまま（正式名称）。サイト内の略称へは寄せない |
| `members[].categoryIds` | 出場種目。`information` の `categories[].categoryId` と対応する |
| `note` | 入力時のメモ。**公開ページには出さない**（`information` の `note` と同じ扱い） |

生年月日・年齢は名簿にあっても取り込まない（個人情報で、掲載する用途が無い）。

検査は `npm run check:upcoming` の **[4]**。氏名が選手ページに解決できるか（表記ゆれの検出）、
`categoryId` が `information` にあるか、対応する開催情報があるかを見る。
用途と表示仕様は [public-pages.md](../wiki/public-pages.md)「公式発表された代表名簿」。

### 種目別の競技日程（`schedule`）（2026-09-17 追加）

`information` の `categories[].schedule` ＋ 年度レコードの `scheduleSource` / `scheduleSourceUrl` / `scheduleCheckedOn`。
**主催者が種目ごとの日程を出している開催前・開催中の大会だけ**に書く（最初の実例は asian-games/2026）。

```json
"scheduleSource": "第20回アジア競技大会 公式リザルトサイト",
"scheduleSourceUrl": "https://results.asiangames2026.org/#/discipline/TST/schedule/daily/2026-09-18",
"scheduleCheckedOn": "2026-09-16",
"categories": [
  { "categoryId": "team-none-boys", ..., "schedule": { "startDate": "2026-09-18", "endDate": "2026-09-20", "finalTime": "17:15" } }
]
```

| | 意味 |
|---|---|
| `schedule.startDate` / `endDate` | その種目の最初の試合日〜決勝日。1日で終わるなら同じ値 |
| `schedule.finalTime` | 決勝の開始予定時刻（`HH:MM`、**会場の現地時刻**）。出典に無ければ省略 |
| `scheduleSource` / `scheduleSourceUrl` | 出典。**無いと日程は一切表示しない**（併記できないため） |
| `scheduleCheckedOn` | 出典を確認した日。主催者の日程は変わり得るので「いつ時点か」を表示する |

規約:

- **予定の転記であって実績ではない**。表示は「（予定）」と出典・確認日を必ず併記する
- **推測で埋めない**。出典に無い日（例: 2026年アジア大会の9/19）は書かず、`note` に理由を残す。
  範囲（`startDate`〜`endDate`）は「最初の試合日〜決勝日」であって、その間の毎日試合があるとは限らない
- 日単位の細かい進行（何組が何時から）は持たない。持つのは「いつ見ればいいか」が分かる粒度まで
- 出典を `categories[]` ごとではなく年度レコードに1つ持つのは、種目ごとに出典が違う例がまだ無いため
  （**Assumption**。違う例が出たら種目側へ移す）

表示: 大会ハブの開催前ブロック（種目別の日程表、`SportsEvent.subEvent` の日付）と、代表選手の
選手ページ（その選手の出場種目の日程だけ）。整形は `lib/categorySchedule.ts`。
検査は `npm run check:upcoming` の **[5]**（出典・確認日の有無、日付・時刻の形、会期からのはみ出し）。
経緯: [raw/2026-09-17-asian-games-schedule.md](../raw/2026-09-17-asian-games-schedule.md)

### 段階で分割された大会の最終成績（2026-08-26 追加）

1つの大会を、進行段階ごとに複数の `categoryId` へ分けて取り込むことがある。
実例は2025年のアジア競技大会日本代表予選会で、
`singles-tournament-*`（決勝トーナメント）→ `singles-semifinal-*`（準決勝リーグ）→
`singles-final-*`（決勝リーグ）の3カテゴリに分かれている。

**規約: 最終成績（`results[].tournament.rank`）は、決着したカテゴリだけが持つ。**
先の段階へ進んだ選手は、手前のカテゴリでは `tournament: null` にする。

そうしないと、同じ選手・同じ大会が「ベスト8」と「優勝」の2エントリーとして集計され、
進出率やタイトル数が二重計上される。`results[].roundrobin.{group,rank}`（組内順位）は
別フィールドで、ブラケット復元（`lib/bracketLayout.ts`）が使うので**消さない**。

段階を表す `age` 語彙: `final` / `semifinal` / `tournament` / `qualifying` / `upper` / `lower` /
`top` / `second`。年齢区分（`over50` 等）や学年区分とは別物で、
**年齢区分の重複出場（全日本シニアの over50 と over60 など）は正常**。

検査は `npm run check:placements`（`scripts/check-duplicate-placements.mjs`）。

**注意**: この規約だけでは進出率の二重計上は解けない。`lib/playerStats/facts.ts` の
`isKnockoutSinglesDoublesMixed` が `appearsInKnockout`（knockout の試合に出たか）でも true になるため、
順位を外したエントリーも分母に残る。**2026-08-26 に `reachRates` 側で
`placement.kind === 'unknown'` を分母から外し**（`ENGINE_VERSION` 1.6.0→1.7.0）、
この規約と組で「分母を増やさずに最終成績を記録する」が成立するようになった。

### 中止（開催されなかった回）の記録（2026-09-05 追加）

回次（第N回）だけが進んで**開催されなかった回**は、`information/*.json` の年エントリに
`status: 'cancelled'` を持たせて記録する。`details/` 側には何も作らない
（中止は「試合結果」ではなく大会運営上の事実なので、置き場所は `information` が正しい）。

```jsonc
{
  "year": 2020,
  "location": "愛知県",       // 中止時点の開催“予定”地。実績ではない
  "startDate": "2020-10-23",  // 同上
  "endDate": "2020-10-25",
  "label": "第75回 天皇賜杯・皇后賜杯 全日本選手権大会",
  "categories": [],           // 1種目も実施されていないので空配列
  "status": "cancelled",
  "note": "公開しない入力メモ（中止の理由・日程が予定値である旨・出典）"
}
```

判定は `lib/tournamentCancellation.ts` の `isCancelledEntry()` に集約する（述語を各所に
コピーしない）。理由フィールドは持たない（打ち切りと同じ方針。`note` は公開しない）。

**打ち切り（`categories[].status: 'abandoned'`）とは別物**:

| | 打ち切り `abandoned` | 中止 `cancelled` |
|---|---|---|
| 粒度 | カテゴリ | 年（エントリ自体） |
| 実施 | 途中まで実施され成績が残る | 1試合も行われていない |
| 成績・連覇 | ベスト8等として集計に入る／開催年として数える | 一切入らない（年表にだけ存在） |

**中止年を成績系のデータ構造に混ぜてはいけない。** `champions` / `yearGroups` /
`championRows` は `details/` 由来のままにし、中止年は別配列で渡して描画時にだけ年で合流させる
（この分離により連覇・`○年ぶりN回目`・playerStats・歴代優勝者の JSON-LD は無変更で
従来どおりの結果になる）。

**投入の規約**: 中止年が**既存の収録範囲と地続きの大会だけ**入れる。間の年も未収録の大会に
中止年だけ挿すと、未収録の年と中止の年が混在して読めなくなる。収録範囲が伸びた時点で足す。
出典は一次資料（日本ソフトテニス連盟の年度別大会結果一覧の「中止」記載など）で1件ずつ確認する。
**年が飛んでいることは中止の証拠にならない**（未収録・隔年・4年周期のこともある。
`asian-games-qualifier` の 2023・2024 の欠けは中止ではない）。
経緯: [中止の回を年表に出す](../raw/2026-09-05-cancelled-tournament-editions.md)

### 大会の会場データ（`venues`）

`information/*.json` の各年レコードは、開催地を2系統で持つ。

- `location`（string）… 都道府県。**既存フィールド。書き換えない**
- `venues`（配列）… 会場の構造化データ。2026-07 に追加

`location` を温存するのは、`src/pages/tournaments/index.tsx` の `prefNameToId[info.location]` が
開催地フィルタの逆引きに使っているため。`"兵庫県、京都府"` のように壊れた値も存在するが
（複数県開催を1文字列に詰めたもの）、整理は読み取り側を `venues` へ切り替えるときにまとめて行う。

**「書き換えない」は構造の話であって、事実誤りは直す。** 温存するのは
「複数県を1文字列に詰める」「`venues` があっても `location` を消さない」といった**形**であり、
都道府県そのものが間違っていれば修正対象。`location` は**前年レコードからの複製で壊れる**
失敗モードが実在する（2026-08-28: 全中2026が前年の `熊本県` のまま。正しくは `島根県`。
検算方法は[会場データの取得元](#会場データの取得元)、経緯は
[raw/2026-08-28-zenchu-2026-location-fix.md](../raw/2026-08-28-zenchu-2026-location-fix.md)）。
`location` は年別結果ページの description（「開催地は◯◯。」）に出る**公開値**なので、
誤りはそのまま利用者に見える。

`venues` を**配列にする理由**は、大会と会場が 1:N だから。次の3パターンが実在する。

- 日別に会場が変わる（例: 全日本選手権は開会式・競技1〜2日目・3日目で施設が異なる）
- 種目・年齢区分別に会場が分かれる（例: 全日本シニアは年齢区分ごとに3〜4施設）
- 複数市区町村・複数都道府県にまたがる（例: 兵庫県神戸市／京都府福知山市・舞鶴市）

#### フィールド定義

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `prefecture` | string | ○ | 都道府県。複数県開催ではここが正（`location` ではなく） |
| `city` | string \| null | ○ | 市区町村 |
| `name` | string \| null | ○ | 施設名。要項PDF未取得なら `null` |
| `aliases` | string[] | | 別名。**ネーミングライツによる改称・旧称**を入れる |
| `nameRaw` | string | | 出典の表記そのまま。`name` と異なるときだけ書く |
| `postalCode` / `address` / `tel` | string | | `address` は都道府県から書く |
| `courts` | number | | 面数 |
| `surface` | string | | 下記の正規化語彙 |
| `usage` | string | | どの日・どの種目に使われたか。**自由文** |
| `note` | string | | 出典の誤りを直した場合の根拠、値を書かなかった理由 |

`venues` と同じくレコード直下に置ける任意フィールド:

| フィールド | 型 | 説明 |
|---|---|---|
| `guidelineUrl` | string \| null | 大会要項PDFのURL |
| `note` | string | 入力時のメモ（出典の誤り、値を書かなかった理由、日程のずれ等）。**公開ページには出さない** |

型定義は `src/types/tournament.ts` の `TournamentInformationEntry` / `TournamentVenue`。

#### 記載ルール

- **`surface` は正規化語彙**。要項の表記は「クレー**コート**」「砂入り人工芝」のように
  末尾の「コート」の有無が揺れる。施設名は識別子なので原文を保つが、`surface` は将来の
  絞り込みに使う閉じた語彙なので入力時に揃える。
  現行値: `クレー` / `ハード` / `砂入り人工芝` / `木床フローリング`
  （確認は `grep -rho '"surface": "[^"]*"' data/tournaments/information/ | sort -u`）
- **`indoor` は持たない**。要項に屋内/屋外の明記がないことが多く、施設名からの推測になるため。
- **`usage` は構造化しない**。`categories[].categoryId` と紐付けたくなるが、年度によっては
  `categories` が空で参照先がない（例: `zennihon-senior` の2026年度）。用途が固まるまで原文を保つ。
- **推測で埋めない**。値が壊れていれば書かず、`note` に理由を残す
  （例: TEL「0773-63-764」は9桁で桁落ちのため `tel` を省略）。

#### 出典（要項PDF）の誤りへの対処

**要項PDF自体に誤記がある。** 実例（`zennihon-senior` 2025年度）:
「三段池科研電機（**福山市**三段池公園）テニスコート 〒620-0017 **京都府福知山市**字猪崎377-1」。
括弧書きは誤りで正しくは福知山市。**福山市は広島県に実在し STリーグ プレーオフの開催地**でもあるため、
鵜呑みにすると正しそうな見た目のまま別県に紐づく。

対処は `name`（修正値）＋ `nameRaw`（原文）＋ `note`（根拠）の3点セットで、**原文を必ず残す**。
検出は **`address` 先頭の都道府県と `prefecture` の一致**で行う（上記の誤記はこの1点で検出した）。

#### 出典が古い／更新されないことへの対処（2026-08-29 追加）

誤記だけでなく、**出典が正しくても現状と違う**ことがある。

- **要項PDFは変更前のまま公開され続ける。** インカレ2026（`zennihon-university`）は
  令和8年熊本地震（2026-07-28）により熊本県から千葉県長生郡白子町へ開催地が変更されたが、
  要項PDFは熊本のまま差し替えられていない。**要項だけを見ると必ず誤る。**
  変更は別の通知（お知らせ）として出るので、要項を取ったら**同じ大会の新しい告知がないか確認する**。
- **`data/local-sources/jsta-yearly-events/{年度}.json` を開催地の正としない。**
  日本連盟の日程一覧PDFの写しなので、発行後の変更は反映されない
  （2026年度は「熊本県熊本市」のまま）。原本の写しとして正しいので**書き換えない**。
- **年を必ず確かめる。** 要項PDFは大会名に年が入らないことがあり、
  古い年の要項を新しい年のものと取り違えやすい（実際に2024の要項を2026として渡された）。
  既存レコードの `startDate` と突き合わせると一致で気づける。
- **変更要項は別ドメインに出ることがある。** インカレ2026の変更要項は主催の jssta.jp ではなく
  `jsta.or.jp/wp-content/uploads/` にあった。主催サイトだけ見ていると見落とす。
- **PDFのファイル名・URLの日付を信用しない。新旧の判定はメタデータの作成日時で行う。**
  上記の変更要項は、埋め込まれたWordのファイル名が `20260703ss修正…（修正版）`、
  URLが `/2026/06/` と**どちらも変更前の日付**だが、PDFの `CreationDate` は
  2026-08-03 21:26（開催地変更通知と同日）だった。
  `python3 -c "import pdfplumber;print(pdfplumber.open('x.pdf').metadata)"` で確認できる。
- 変更後にまだ発表されていない項目（面数・その他の会場等）は**書かない**。
  `note` に「未発表のため記載していない」と理由を残す。

経緯: [インカレ2026の会場データ](../raw/2026-08-29-intercollegiate-2026-venues.md)

#### 描画先（2026-08-25 追加）

`venues` は長らく**どこにも描画されていなかった**（`grep -rn "venues" src` が0件）。
2026-08-25 に大会ハブの「開催前」ブロックが唯一の描画先になった
（`src/components/tournaments/UpcomingTournamentSection.tsx`、仕様は
[public-pages.md](../wiki/public-pages.md)「開催前の大会を出す」）。
**結果が確定した過去の大会では今も描画されない**——過去の会場情報の需要が未検証のため、
まず開催前だけに絞っている。未来大会9件のうち `venues` が入っているのは2件だけで、
補充は[実行ランブック](../wiki/upcoming-tournaments-runbook.md) の S7（検出は `npm run check:upcoming`）。

#### 施設マスタ（`data/venues/venues.json`）はまだ作らない

施設属性は当面 `venues[]` にインラインで持つ。**同一施設が3回以上出現した時点でマスタへ切り出す**。
出現見込みは `千葉県白子町` 5回 / `大阪府大阪市` 4回 / `広島県広島市` 4回 / `東京都江東区` 3回 /
`北海道札幌市` 3回（`data/local-sources/venue-candidates.json` 集計）。

インライン → マスタの正規化は後から可能だが、逆はID体系を情報不足のまま決めることになるため避ける。
`aliases` にネーミングライツの旧称を貯めておくことが、切り出し時の名寄せコストを下げる。

#### 会場データの取得元

- `data/local-sources/jsta-yearly-events/{年度}.json`
  日本連盟の「大会日程及び開催地一覧」PDF（`t_records/{年度}/{年度}_taikai_alle.pdf`）を構造化したもの。
  2024・2025・2026年度が存在。**手動転記**（自動パーサ未実装）。市区町村レベルまで。
- 施設名・住所・面数・サーフェスは各大会の**要項PDF**（`{年度}_{分類コード}_10.pdf`）の「4. 会場」節。
- `data/local-sources/venue-candidates.json`
  上記と `information` を突き合わせたレビュー用候補ストア。`detected-documents.json`（2026-09-12 削除）と
  同型で、人が `status` を確定してから `information` へ書き戻す。
  **この形式は「人が仕分けないと何も進まない」ため、`detected-documents.json` は 583 件を溜めて停止した。
  こちらを育てる場合は同じ轍を踏まないこと**（出口を先に決める）。**日付だけの照合は同日開催の別大会と
  誤マッチするため、大会名の類似度を併用する**（誤マッチは confidence 0.5前後に落ちて分離できる）。

**この照合は `venues` の候補出しだけでなく、既存 `location` の検算にも使える。**
`startDate` 一致＋大会名の正規化類似度で `information` と jsta を突き合わせ、都道府県を比較する。
2026-08-28 に 2024〜2026年度の全 `information` へ通し、真の誤りを1件検出した（全中2026）。
ヒットした他2件は誤マッチ（類似度0.63）と既知の `"兵庫県、京都府"` で、真マッチの類似度は0.83。
落とし穴が2つある。

- **都道府県の切り出しを `..[県]` 系の正規表現で書かない**。和歌山県・神奈川県・鹿児島県
  （3文字＋県）が誤検出になる。47都道府県のリストで前方一致すること。
- **「連続する年で `location` が同じ」だけでは誤りを判定できない**。全21件中の大半は
  全日本インドア＝大阪府、天皇賜杯・皇后賜杯＝東京都のような**固定会場の正常データ**。
- jsta ソースは2024年度以降しか存在しないため、**2023年以前は機械照合できない**。
- 作業手順と貼り付け用の断片: [venue-input-worksheet.md](../venue-input-worksheet.md)（作業用・入力完了後は破棄可）
- 経緯: [raw/2026-07-26-idea-tournament-metadata-platform.md](../raw/2026-07-26-idea-tournament-metadata-platform.md)

## Deprecated

- `data/tournaments/{all,corporate,highschool,international-qualifier,junior,masters,university}/**`
  旧構造の `meta.json` / `entries` / `matches` / `results` / `categories.json`
  現行実装では canonical source ではない
- `data/players/*/summary.json`
  選手プロフィールの注目ポイント表示は廃止され、現行実装では参照しない
- `data/players/*/results.json`
  選手別結果の旧中間データ。現行運用では廃止し、ファイルも削除した

### 選手データ

主な配置:

- `data/players/index.json`
- `data/players/*/information.json`
- `data/players/*/analysis.json`

実装メモ:

- `/players/[slug]` のプロフィールページは `data/players/{slug}/information.json` を必須で参照する
- 同ページは `analysis.json` があれば最新試合情報を表示する
- 同ページの `/players/[id]/results` 導線は `data/players/index.json` の `count >= 5` のときだけ表示する
- `/players/[id]/results` の試合結果ページは `data/players/{slug}/results.json` を直接は参照しない
- 試合結果ページは `data/players/index.json` で数値 `id` から選手名を引き、`data/tournaments/details/**` と `data/tournaments/information/*.json` から結果を再構築する
- `data/players/*/analysis.json` は `data/tournaments/details/**` と `data/tournaments/information/*.json` をソースに自動生成する
- `latestMatch` は `results` ページ相当の大会データから最新開催の大会を選んで生成する

選手名の表示ルール:

- 選手名は `lastName`（姓）・`firstName`（名）に分けて保持する。
- 表示時の結合は `src/utils/playerName.ts` の `joinPlayerName(lastName, firstName)` を使う。
- 日本語名（ひらがな・カタカナ・漢字を含む）は姓名を詰めて表示する（例: 内本貴文）。
- ローマ字（英語表記）の国際選手は姓名の間に半角スペースを入れる（例: `UCHIMOTO TAKAFUMI`）。コリアカップ等の国際大会が該当する。
- 判定は名前にひらがな・カタカナ・漢字が含まれるかで行い、含まれなければローマ字とみなしてスペース区切りにする。大会IDによる分岐はしない。
- 適用箇所は試合結果（`MatchResults`）・出場選手一覧（`EntryOverview`）・大会トップの優勝者名表示など。トーナメント表（`TournamentBracket`）の単式は元々スペース区切りで表示している。

団体戦の表示ルール:

- 団体戦の `participants[]` は姓名を持たず（JSON 上は `lastName`/`firstName` が `null`）、`team` と `prefecture` だけを持つ。
- 表示は個人戦の「選手名（所属）」ではなく **「チーム名（都道府県）」**（例: `東北（宮城県）`）。`prefecture` が無い大会（コリアカップ、大学王座など）はチーム名のみ。
- 団体戦かどうかの判定は `src/utils/playerName.ts` の `isTeamFormatPlayers()` に集約する。**`lastName === null` で判定してはいけない**: `lib/packedPageData.ts` の `unpackTournamentDetailData()` が `readString()` を通して `null` を `''` に変換するため、ページ側に届く時点で `null` ではなくなっている。これを踏むと個人戦扱いになり、空の選手名＋括弧つきチーム名（`（東北）`）で表示される（2026-08 修正）。
- 適用箇所は対戦詳細（`MatchResults` のエントリー見出しと対戦相手名）とトーナメント表（`TournamentBracket`）。`BracketSheets` と大会トップの優勝者表示は元々「姓名が空なら団体戦」と偽値で判定している。

団体戦の対戦ごとの記録（オーダー）（2026-09-18〜、[ADR-020](../adr/ADR-020-team-match-rubber-details.md)）:

- 試合オブジェクトに任意の `matches`（対戦の配列）を持てる。型は `src/types/tournament.ts` の `TeamMatchDetail`。
  形は STリーグの `MatchDetail` に揃え、`type`（`D1` `D2` `D3` / `S`）・`winner`・`scoreA`・`scoreB`・`playersA`・`playersB`。
  **A は親の `entries[0]`、B は `entries[1]`**。
- `status` で3種類を区別する: `completed`（決着。winner あり）／`unfinished`（打ち切り。winner は null、途中の本数あり）／
  `not_played`（未実施。winner・本数とも null、ペアだけある）。
- 選手は、同じ氏名・同じ学校の個人戦の出場記録があれば `{ lastName, firstName }`、無ければ `{ name }`（名前だけ）。
  **名前だけの選手は `participants` に足さない**（選手一覧で採番されないように）。
- 勝者の数は親の `scores` と一致させる。検査は `npm run check:team-match-details`（prebuild）。
- ゲームごとのポイントがある大会は `games`（`[[Aのポイント, Bのポイント], ...]` を実施順に）も持つ。
  取ったのは多いほう。デュースで10以上になる。**表示はしていない**（データとして貯めている）。
- 持っているのは元資料にある試合だけ。現在は**高校選抜 2022・2025 の男女全140試合**（本数まで）と、
  **インターハイ 2026 女子のベスト8以降7試合**（ゲームごとのポイントつき）。インターハイは1〜3回戦には無い。
- 表示は大会結果ページの「対戦詳細」（[public-pages.md](../wiki/public-pages.md)）。`lib/packedPageData.ts` が記録のある試合にだけ詰めて渡す。
- **選手の成績集計（Player Statistics Engine）には入れない**（STリーグと同じ扱い。ADR-020 の追記）。
- **入力ツールで details を作り直すと消える**。取り込み（`scripts/pdf/highschool_senbatsu_team_matches.py`）を再実行する。

### score 公開 JSON

- `public/data/beta-matches/meta.json`
- `public/data/beta-matches/index.json`
- `public/data/beta-matches/matches/*.json`
- `public/data/beta-matches/growth/targets.json`
- `public/data/beta-matches/growth/reports/*.json`

### 成長分析の運用設定（手動メンテの静的 JSON）

- `data/growth-featured.json`（成長記録ショーケース `/growth/[slug]` の対象 allowlist。`subjectKey` / `slug` / `playerId` / `playerName` / `title` / `intro`。詳細は ADR-004）
- `data/growth-exclusions.json`（成長分析の撤回リスト。載せた `subject_key` はレポート生成から除外）

## Supabase のテーブル

score 機能の動的データ（`matches` / `games` / `points` / `match_video_sessions` /
`match_point_candidates`）の列・リレーションは [database.md](../wiki/database.md) に集約する
（重複記載を避けるため、本ページでは再掲しない）。`src/types/database.ts` 由来。

## モデル上の特徴

- `matches` はフラットな `team_a_*` / `team_b_*` と、構造化された `teams` の両方を持つ
- `games.points_a` / `games.points_b` / `games.winner_team` は `points` から再計算される派生値に近い
- score 公開用 JSON では内部フィールドを削除する

確認根拠:

- `src/pages/api/matches/[matchId]/index.ts`
- `src/pages/api/matches/[matchId]/points/index.ts`
- `scripts/generate-beta-matches-json.mjs`

## Assumption

- `src/types/database.ts` は Supabase 実体の完全な schema 定義ではなく、アプリ利用向け型
- `teams` は新しめの表現で、`team_a` / `team_b` は互換性のために残っている可能性がある

## Open Questions

- RLS、index、trigger、constraint の全体像
- `matches.status` と `processing_status` の正式状態遷移
- points の `result_type` の正式な語彙表

## 発展候補アイデア一覧（Idea Backlog）

表の「状況・目的」は**状況と1行の目的・残りだけ**を書く（数値・経緯は raw へ。規則は [idea-backlog.md](../wiki/idea-backlog.md)「使い方」）。

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| 大会メタデータ基盤（会場・施設・日程・大会要項） | **一部実装済み**（2026-08-25〜）。会場・日程・要項をエンティティ化する。「これから開催」とアジア競技大会（日本代表名簿・種目別日程）まで実装。残りは[実行ランブック](../wiki/upcoming-tournaments-runbook.md) | [アイデア](../raw/2026-07-26-idea-tournament-metadata-platform.md) |
| Knowledge Graphによるデータ設計・UX統合 | 発散フェーズ（2026-07-11）。選手/チーム/大会/試合の関係解決ロジックが機能ごとに重複実装されている実態を確認（`matchReverseIndex.ts`と`playerStats/reverseIndex.ts`等）。新機能=グラフ上の新ビュー追加、に寄せられないかを検討中。次の一歩は候補ビュー（対戦相手ネットワーク等）の小さな試作 | [アイデア](../raw/2026-07-11-idea-knowledge-graph-views.md) |
| 全中（全国中学校ソフトテニス大会）ブロック大会の掲載 | **投入済み**（2026-08-11、9ブロック）。高校地区大会と同型で登録。「中学専用カテゴリは作らない」は2026-08-12に上書き（下の行） | [アイデア](../raw/2026-08-08-idea-zenchu-block-tournament-data.md) |
| 中学カテゴリの公開ページ（/highschool 型の横展開） | **実装済み**（2026-08-12）。`/secondaryschool/`。チーム単位の設計と中学→高校の進路。残は `npm run build` 完走とGSC効果測定。仕様は [secondaryschool.md](../wiki/secondaryschool.md) | [アイデア・実測](../raw/2026-08-12-idea-juniorhigh-category-pages.md) |
| 小学生カテゴリの公開ページ（/secondaryschool 型の横展開） | **実装済み**（2026-09-13）。`/primaryschool/`（全日本小学生選手権のみ）と小学→中学の進路。残は `npm run build` 完走とGSC効果測定。仕様は [primaryschool.md](../wiki/primaryschool.md) | [アイデア・実測](../raw/2026-09-12-idea-primaryschool-category.md) |
| 団体戦のオーダー（対戦ごとのペアと本数） | **一部実装**（2026-09-18）。X で繰り返し聞かれるオーダーに答える。高校選抜 2022・2025 とインターハイ 2026 女子を投入し、対戦詳細に表示。残はインターハイ男子・他年度・ポイントの見せ方 | [アイデア](../raw/2026-09-18-idea-team-match-order.md) |
