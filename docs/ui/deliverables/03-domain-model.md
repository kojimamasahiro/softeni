# 03-domain-model.md — ドメインモデル・用語定義

- ステータス: approved(D-008, 2026-07-04)
- 作成日: 2026-07-04
- フェーズ: Phase 3
- 入力: 承認済み 01-inventory.md(D-005)、02-issues.md(D-006)。対応課題: I-08(gender 語彙)、I-12(正式名称の未定義)
- 実データ確認元: `data/**`、`docs/wiki/data-model.md`、`docs/wiki/team-player-identity.md`

## 1. 本書の役割

サイトが扱う情報の**エンティティ・関係・識別子・正式名称**を一意に定義する。
以降のフェーズ(IA・ページ構造・コンポーネント)は本書の用語のみを使う。
表示文言(UI ラベル)の最終決定は Phase 5〜6 で行うが、**概念名は本書が正**。

## 2. エンティティ一覧(全体像)

```
世代 ──┬── 大会 ──── 大会年度 ──── カテゴリ ──┬── エントリー ──── 対戦
        │     │                                  │        │
連盟 ──┘     └─(特集: 高校・STリーグ)          │        └── 成績
                                                  │
都道府県 ─── チーム ────────────────────┬─ 選手 ─┴── ランキング
                                          │      └── 成長記録
                                          │
記事(大会展望) ── 大会                   └─(記録試合: score系)── ゲーム ── ポイント
```

## 3. エンティティ定義

### 3.1 大会系

| エンティティ | 正式名称 | 定義 | 識別子 | 主要属性 | 正データ |
|--------------|---------|------|--------|---------|---------|
| 世代 | 世代(generation) | 大会を主催カテゴリで大分類する軸。全8種: 国際大会 / 国際予選 / 総合 / 実業団・社会人 / 大学 / 高校 / ジュニア / シニア | `generationId`(slug) | label | `data/tournaments/genarations.json` |
| 大会 | 大会(tournament) | 年度を持たない大会の系列(例: 東日本選手権)。URL の `/tournaments/[generation]/[tournamentId]` に対応 | `tournamentId`(slug) | label, generationId, isMajorTitle, officialUrl | `data/tournaments/index.json`, `local_index.json` |
| 大会年度 | 大会年度(tournament edition) | 1大会の1回の開催(例: 東日本選手権 2025)。開催地・日程を持つ | tournamentId + `year` | year, location, startDate, endDate, source, sourceUrl | `data/tournaments/information/{tournamentId}.json` |
| カテゴリ | カテゴリ(category) | 大会年度内の競技区分。**種目×年齢区分×性別**の組で一意 | `categoryId` = `{種目}-{年齢区分}-{性別}`(例: `doubles-none-boys`) | label(表示名。例: 男子一般) | 同上 `categories[]` |
| 連盟 | 連盟(federation) | 地域大会の主催団体(都道府県連盟)。地域大会の入口の分類軸 | `federationId` | name | `data/tournaments/federations.json` |

### 3.2 カテゴリの3軸(語彙の正規化)

| 軸 | 正式名称 | 値の語彙 | 備考 |
|----|---------|---------|------|
| 種目 | 種目(discipline) | `singles` / `doubles` / (団体は現データに独立値なし。団体戦は大会単位で表現) | **表記ゆれの事実**: details/URL では `category`、rankings JSON では `discipline` と呼ばれている。概念名は「種目(discipline)」に統一する |
| 年齢区分 | 年齢区分(age) | `none`(一般) ほか | `none` は「年齢制限なし(一般)」の意 |
| 性別 | 性別(gender) | `boys` / `girls` / `mixed` | I-08 対応: **mixed は大会カテゴリにのみ存在する値**と定義する。高校特集の男女切替(boys/girls)は「表示フィルタ」であり、mixed の結果は両方に表示する(現行仕様を追認) |

### 3.3 出場・結果系

| エンティティ | 正式名称 | 定義 | 識別子 | 主要属性 | 正データ |
|--------------|---------|------|--------|---------|---------|
| 出場選手 | 出場選手(participant) | 1大会年度カテゴリに出場した選手の**その大会での姿**(所属・都道府県つき)。選手(マスタ)とは別概念 | `姓_名_チーム_都道府県` の合成キー | lastName, firstName, team, prefecture | `details/**.json` `participants[]` |
| エントリー | エントリー(entry) | 出場単位(ダブルス=ペア、シングルス=個人)。トーナメント表の1枠 | `entryNo`(大会年度カテゴリ内) | playerIds[], type | 同上 `entries[]` |
| 対戦 | 対戦(match ※大会結果) | 大会内の1試合(勝敗・スコア・ラウンド)。**ポイント単位の記録は持たない** | `matchId`(カテゴリ内。例: match-1) | entries, scores, round, winnerEntryNo, stage(knockout/roundrobin), nextMatchId | 同上 `matches[]` |
| 成績 | 成績(result) | エントリーの最終成績(優勝・準優勝・ベスト4等) | entryNo に紐づく | tournament.rank.kind(winner/runnerup 等), roundrobin | 同上 `results[]` |

### 3.4 選手・チーム系

| エンティティ | 正式名称 | 定義 | 識別子 | 主要属性 | 正データ |
|--------------|---------|------|--------|---------|---------|
| 選手 | 選手(player) | 名寄せ済みの選手マスタ。全収録選手(約8,182) | **数値 `id`** | lastName, firstName, count(収録試合数) | `data/players/index.json`(+同姓同名分割: `homonyms.json`) |
| 選手プロフィール | 選手プロフィール(player profile) | 手動整備した選手の詳細情報(curated・約23名)。選手のサブセット | **`slug`**(文字列。例: `funemizu-hayato`) | プロフィール、通算成績、career-record、milestone | `data/players/{slug}/information.json`, `analysis.json` |
| チーム | チーム(team) | 名寄せ済みのチームマスタ(学校・実業団・クラブを包含。約4,352) | **連番 `id`** | name(最頻出表記), prefecture(信頼できない場合 null), count, aliases | `data/teams/teams.json`(+正準表: `team-name-aliases.json`) |
| 高校チーム | 高校チーム(highschool team) | 高校特集で使う学校のサブセット(約333)。**チームマスタとは別の id 体系** | **文字列 `id`**(例: `uedasomeyaoka`) | name, prefecture, prefectureId | `data/highschool/teams.json` |
| 都道府県 | 都道府県(prefecture) | 47都道府県マスタ(+連盟・外国等の例外値) | `prefectureId`(slug) | name | `data/prefectures.json` |

### 3.5 集計・読みもの系

| エンティティ | 正式名称 | 定義 | 識別子 | 主要属性 | 正データ |
|--------------|---------|------|--------|---------|---------|
| ランキング | ランキング(ranking) | 年度×種目×性別ごとの選手順位表(シーズンポイント=上位3大会合算、上位100位) | year + discipline + gender | entries[](rank, playerId, playerKey, team, points), outOf | `data/rankings/{year}-{discipline}-{gender}.json` |
| 記事 | 記事(article) | ニュース記事。現行は**大会展望(preview)専用** | `articleId` | state(published のみ公開), type(preview のみ), 本文 | `data/news/*.json` |
| 成長記録 | 成長記録(growth report) | 運営キュレーションの選手成長ショーケース | `slug` | subjectKey, playerId, playerName, title, intro | `data/growth-featured.json`(allowlist), 除外: `growth-exclusions.json` |
| STリーグ回 | STリーグ回(ST league edition) | STリーグの1年度開催(第N回) | `year` | edition, title, venue, champions(boys/girls), リーグ階層(Ⅰ/Ⅱ/Ⅲ) | `data/st-league/editions.json`, `{year}/` |

### 3.6 記録試合系(score / beta 面)

| エンティティ | 正式名称 | 定義 | 識別子 | 主要属性 | 正データ |
|--------------|---------|------|--------|---------|---------|
| 記録試合 | 記録試合(recorded match) | ポイント単位で記録した1試合。**大会結果の「対戦」とは別エンティティ**(siteLink で大会に任意リンク) | UUID(`matchId`) | teams, status, match_date, court_name, siteLink | Supabase `matches`(公開用: `public/data/beta-matches/**`) |
| ゲーム | ゲーム(game) | 記録試合内の1ゲーム | gameId | points_a/b, winner_team(ポイントからの派生値) | Supabase `games` |
| ポイント | ポイント(point) | 最小の記録単位(1ポイント) | - | result_type, サーブ情報 | Supabase `points` |
| 動画セッション | 動画セッション(video session) | 記録試合と YouTube 動画の区間対応 | sessionId | 候補区間、確定区間 | Supabase `match_video_sessions` ほか |

## 4. 識別子の対応関係(横断・重要)

選手を指す識別子が**4系統**ある。相互の関係を以下に固定する。

| 識別子 | 例 | スコープ | 用途 |
|--------|-----|---------|------|
| 数値 id | `17` | 選手マスタ全体 | `/players/{id}/results` の URL。名前からの解決は姓名一致(同姓同名は最初の id) |
| slug | `funemizu-hayato` | curated のみ | `/players/{slug}` プロフィール URL |
| 出場選手キー | `金子_凌_松本市役所_長野県` | 1大会年度カテゴリ内 | 大会詳細データ内の参照(名寄せ前の生の姿) |
| playerKey | `内本隆文@NTT西日本` | ランキング・連覇判定 | 名前だけでは曖昧な照合を所属で解消する場面 |

- 変換方向: 出場選手キー →(名寄せ)→ 数値 id →(姓名一致・curated のみ)→ slug
- チームも id 体系が**2系統**(チームマスタ連番 id / 高校チーム文字列 id)。高校チームはチームマスタへ未統合(事実)。統合の要否は Phase 4 以降の論点として O-007 に起票

## 5. URL とエンティティの対応(現行)

| URL パターン | 対応エンティティ |
|--------------|----------------|
| `/tournaments/[generation]/[tournamentId]` | 大会(ハブ) |
| `/tournaments/[generation]/[tournamentId]/[year]/[discipline]/[age]/[gender]` | 大会年度×カテゴリ |
| `/players/[id]/results` | 選手 |
| `/players/[slug]` | 選手プロフィール |
| `/teams/[teamId]` | チーム(STリーグ集計) |
| `/highschool/[gender]/[prefectureId]/[teamId]` | 高校チーム(×表示フィルタ gender) |
| `/rankings` | ランキング(全年度・全カテゴリを1ページ) |
| `/st-league/[year]` | STリーグ回 |
| `/matches/[matchId]`(score)ほか | 記録試合 |

## 6. 用語の正規化(表記ゆれの統一)

| 正式名称 | 使用禁止・注意する表記 | 理由 |
|---------|----------------------|------|
| 種目(discipline) | category(データ上の旧名), 競技 | details JSON の `category` キーと URL セグメント `[gameCategory]` は歴史的名称。概念としては discipline に統一 |
| カテゴリ(category) | 種別, 部門 | 「種目×年齢区分×性別」の組のみを指す。単独の軸(種目)には使わない |
| 世代(generation) | カテゴリ, 区分 | 大会の大分類軸のみに使う |
| 大会年度(tournament edition) | 大会(年度の意味で), 開催回 | 「大会」は年度を持たない系列を指す |
| 対戦(大会結果の match) | 試合(記録試合と混同する文脈で) | ポイント記録を持つ「記録試合」と区別する |
| 記録試合(recorded match) | ベータ試合, スコア試合 | /beta・score 面の試合 |
| 選手(player) | プレイヤー, 選手マスタ | |
| 選手プロフィール(player profile) | curated 選手(ドキュメント内部用語としては可) | |
| チーム(team) | 学校・実業団(エンティティ名としては) | 学校・実業団はチームの種類 |
| 高校チーム(highschool team) | 学校(エンティティ名としては) | |
| 成績(result) | 戦績(ページ表示名としては可) | |

## 7. 将来の拡張への耐性(検証)

| 想定される追加 | モデル上の受け皿 |
|---------------|----------------|
| 新しい大会・新しい年度 | 大会/大会年度/カテゴリの3階層で追加可能(構造変更不要) |
| 新種目(例: 団体戦の独立データ化) | 種目の語彙追加で対応。categoryId の合成規則は不変 |
| 新しい年齢区分(U-17 等) | 年齢区分の語彙追加で対応 |
| 中学・大学の特集ハブ | 世代は既に軸として存在。特集は「世代の切り出し」であり新エンティティ不要 |
| 選手の中学→高校→大学の追跡 | 現状は「出場選手」ごとの所属スナップショット。経歴の連結は playerKey/名寄せの拡張課題(O-008 起票) |

## 8. 未決事項(→ project-status.md へ登録)

| # | 内容 |
|---|------|
| O-007 | 高校チーム(文字列 id)とチームマスタ(連番 id)の統合要否 |
| O-008 | 選手の所属変遷(進学・移籍)をモデル上どう扱うか(現状は大会ごとのスナップショットのみ) |
