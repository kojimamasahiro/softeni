# データ契約 & アルゴリズム詳細（付録・2026-07-01 実データ確定）

[実行計画](./2026-07-01-player-statistics-engine-implementation-plan.md) P0.5 相当。
実装が「止まらず書ける」ように、実データ走査（`data/tournaments/details/**` 全走査）で確定した
スキーマ・変換規則・端条件をピン留めする。**数値は 2026-07-01 時点の実データ由来**。

---

## A. detail ファイルのスキーマ変種（4 種）と取り込み方針

`data/tournaments/details/<tid>/<year>/<categoryId>.json` は 4 つの形が混在する（実測）:

| スキーマ（keys） | 件数 | 内容 | 取り込み方針 |
| --- | --- | --- | --- |
| `entries, matches, participants, results` | 279 | **標準**（knockout ＋ roundrobin を `matches.stage` で内包） | **主対象**。SourceAdapter の基準形 |
| `matches, results` | 40 | participants/entries 無し。`matches` に `pair`/`opponents`/`tempId` を直書き、`playerId:null`（`/temp/` 配下・旧形式 63 ファイル） | **第2アダプタ**。pid が無く数値id解決不可 → **当面は集計対象外**（Facts に載せない）。将来 participants 化されたら標準へ |
| `roundRobinMatches, standings` | 12 | 別形式のリーグ戦（`matches`/`results` を持たない） | **第3アダプタ**。`standings` から placement（グループ順位）のみ抽出。試合単位 W/L は形式確認後に対応（初期は placement のみ） |
| `matches, results, roundRobinMatches, standings` | 11 | 標準＋別リーグの混在 | 標準部を主に、`standings` は補助 |

原則: **標準スキーマ（279）を第一級**とし、他は「載せられる範囲で載せる／不能なら除外」を Adapter 層で吸収する。
どの変種かは keys で判定し、未知 keys はログして skip（サイレント誤集計を防ぐ）。

---

## B. categoryId → 種目 / 性別 / 年齢（確定変換表）

`categoryId` は**必ず 3 セグメント** `{disc}-{age}-{gender}`（実測: 全 405 ファイルが 3 分割）。

- `disc` ∈ `{singles, doubles, team}`（実測のみ。他は未出現）
- `gender` ∈ `{boys, girls, mixed}`
- `age` は 38 種（`none` / `u14` / `over35` / `qualifyinggrade6` / `1stgrade4` …）。**学年別は対象外**のため
  年齢は生文字列で保持するだけ（集計キーにしない）。

**種目（`category`）の決定規則**:

```
category =
  gender === 'mixed' ? 'mixed'      // 混合ダブルス（disc は doubles だが mixed を優先）
  : disc               // 'singles' | 'doubles' | 'team'
gender(表示用) = gender             // boys/girls/mixed
ageRaw = age                        // 保持のみ
```

注意: **`mixed` は種目トークンではなく性別トークン**。設計初稿が mixed を disc 扱いしていた点はこの規則で上書き。

---

## C. placement 正規化（統一モデル）

`results[].tournament.rank` の実測分布: `round`(19783, `round` 付) / `null`(4355) /
`best`(1485, **`bestLevel`** 付＝4 or 8) / `winner`(259) / `runnerup`(259)。
加えて `results[].roundrobin`（`{group, rank}`）が 5066 件、うち `tournament:null` だが roundrobin 有りが 3971 件、
`tournament:null` かつ roundrobin 無しが 384 件。

→ **フィールド名は `bestLevel`（設計初稿の `value` は誤り）**。リーグ戦順位も placement に必要。統一型:

```ts
type Placement =
  | { kind: 'winner' }
  | { kind: 'runnerup' }
  | { kind: 'best'; bestLevel: 4 | 8 }          // ベスト4 / ベスト8
  | { kind: 'roundLoss'; round: number }         // n回戦敗退（knockout）
  | { kind: 'groupOnly'; groupRank: number }     // リーグ止まり（tournament=null・roundrobin 有り）
  | { kind: 'unknown' };                          // tournament=null・roundrobin 無し（384件）

function resolvePlacement(result): Placement {
  const rk = result.tournament?.rank;
  if (rk?.kind === 'winner')   return { kind:'winner' };
  if (rk?.kind === 'runnerup') return { kind:'runnerup' };
  if (rk?.kind === 'best')     return { kind:'best', bestLevel: rk.bestLevel };
  if (rk?.kind === 'round')    return { kind:'roundLoss', round: rk.round };
  if (result.roundrobin)       return { kind:'groupOnly', groupRank: result.roundrobin.rank };
  return { kind:'unknown' };   // 優勝数・進出率の分母/分子では除外扱い
}
```

**優勝判定** = `kind==='winner'`（259 件）。**進出率**（§F）は round 名ベースで別途判定し、`unknown` は分母から除外。

---

## D. 選手同定：participant → 数値 id 解決

**実測: `participants[].playerId` は全件 null（12,040 件）**。数値 id は detail に無く、`data/players/index.json`
（`{id, lastName, firstName, count}`）へ**姓名一致**で解決する（既存 `scripts/generate-player-analysis.mjs` と同方式）。

```
nameKey(p) = `${p.lastName}\t${p.firstName}`
// index.json から構築。同姓同名は「最初の id」を採用（先勝ち。既存規約）。
playerIndexByName: Map<nameKey, id>   // set は未登録時のみ（first-wins）
resolveNumericId(participant) =
  homonyms.json に該当分割があればそれを優先 → 無ければ playerIndexByName.get(nameKey) ?? null
```

- 大会内は `entries[].playerIds`（participant の**文字列 id** 例 `金子_凌_松本市役所_長野`）で participant を引く
  （`participantById`）。self / partner / opponent はまず participant を確定 → 数値 id は上記で解決。
- **人物比較（連勝・H2H・連覇）は数値 id が付かない相手にも効くよう `playerKey`＝「正規化名@所属」を併用**
  （既存 `tournamentRecords.playerKey`）。数値 id はリンク用、`playerKey` は集計の同定用。
- 既存コードは `Map.set` が後勝ちになっている箇所があるが、**規約は first-wins**。エンジンでは未登録時のみ set する。

---

## E. スコア・勝敗・ゲームの抽出（種目別・team 特例・retired）

標準スキーマの `matches[]`: `entries:[a,b]` / `scores:{ "<entryNo>": ゲーム数 }` / `winnerEntryNo` / `retired` / `stage` / `round` / `group`。

```
selfEntryNo   = self participant を含む entry の entryNo
oppEntryNo    = entries から selfEntryNo を除いた側
gamesWon      = scores[selfEntryNo]
gamesLost     = scores[oppEntryNo]
result        = winnerEntryNo === selfEntryNo ? 'win' : 'lose'   // draw は knockout では基本無し
```

- **retired（`retired:true`）**: 勝率・ゲーム率から**全除外**（§0.6）。ただし placement／優勝／進出率には反映。
  → Facts では `countsForWinRate=false` を立てるだけにし、集計側が分子分母から外す（placement は別経路なので影響しない）。
- **draw**: knockout にはほぼ無い。リーグ戦で勝敗つかずが出た場合は勝率分母から除外。
- **team（団体）**: `entries[].playerIds` は **チームのプレースホルダ**（例 `______JAPAN_JAPAN___`）で、**個人選手が入らない**（実測）。
  よって team は**個人の試合 W/L・ゲームに寄与しない**。team から選手が得られるのは **placement（優勝等）だけ**であり、
  かつ団体の代表選手を個人 id に結び付ける情報も detail には無い。→ **team は個人統計の対象外**。
  team の優勝を「その選手の通算優勝」に数えるには別途チーム→選手の名簿が要る（現状データに無い＝**対象外／将来拡張**）。
- **スコア単位**: 個人戦の scores はゲーム数（例 4-0）。team の scores は**個人試合の勝数**（例 2-0）で単位が違う。混同しない。

---

## F. 大会メタ join（year＝年度 / isNational / stage）

- **year = 年度**（確定）。`information.json` は `year:2025` に対し `startDate:"2026-02-15"`（＝令和7年度・2月開催）という
  実例があり、**`year` は暦年でなく年度**。集計の年区切りは `year` をそのまま使う。時系列順序（連勝・初出場・Elo）は `startDate`。
- **isNational（確定・網羅）**: detail の tid は 34 種すべてが `index.json`(27) か `local_index.json`(7) に存在（未収録 0）。
  ```
  isNational = tid ∈ index.json && generationId ∉ {'international','international-qualifier'}
  ```
  local_index の tid（地方 7 種）は常に非 national。
- **stage**: `knockout`(21519) / `roundrobin`(7015) / `None`(2786)。`None` は主に第2スキーマ（temp）由来。
  標準スキーマ内で stage 欠落があれば `group` 有無等で補完せず **knockout 既定**として扱い、ログする。

---

## G. 進出率と端条件（round 名ベース・retired・連勝）

- **決勝/準決勝進出率（分子）**: `matchRules` の勝ちゲーム数に依存せず、**ラウンド名リテラルで判定**。
  実測の round 名: `1〜5回戦` / `準々決勝` / `準決勝` / `決勝`。
  ```
  reachedFinal(entry)     = placement.kind∈{winner,runnerup} || そのentryが round==='決勝' の knockout 試合に出場
  reachedSemifinal(entry) = reachedFinal || placement=best(4) || round==='準決勝' の試合に出場
  ```
- **分母（確定）**: `stage==='knockout'` かつ 種目 ∈ {singles,doubles,mixed}（team 除く）の**出場エントリー数**。
  リーグのみ・placement=unknown・team は分母から除外。
- **最長連勝（端条件・確定）**: 時系列（`startDate` → 同日は `roundOrder` 昇順）に並べ、**retired 試合はスキップ（連勝を切らない・数えない）**。
  勝率と同じく「実際に戦った試合」だけを連鎖対象にする。連敗も同規則。
- **roundOrder 正規化**: `1回戦=1 … 準々決勝→準決勝→決勝` を単調増加に写像（`準々決勝<準決勝<決勝`）。同日内順序に使う。

---

## H. 逆引き索引（選手 → 出場カテゴリ）の生成

既存 `public/data/beta-matches/reverse/by-player.json` は score 用で**大会 details を含まない**。新規に生成する:

```
scripts/generate-player-facts.mjs（の前段）:
  全 details（標準スキーマ）を 1 回走査し、participant 姓名 → 数値id 解決 →
  index: Map<numericId, Set<`${tid}/${year}/${categoryId}`>> を構築して data/players/_index/by-player.json に保存。
  Facts 生成時は当該選手の該当カテゴリだけを開く（全大会スキャン回避＝線形性の担保）。
```

増分時は「変更 details → 逆引きの影響 numericId 集合」を差分更新し、その選手だけ再生成する。

---

## I. 型の訂正（設計初稿からの差分）

実データに合わせ、姉妹ドキュメントの型を以下に訂正（実装はこちらを正とする）:

1. `PlayerEntryFact.placement`: `{ kind:'best'; value }` → **`bestLevel`** ＋ `groupOnly`/`unknown` を追加（§C の `Placement`）。
2. `category`: `mixed` は gender 由来（§B）。`PlayerMatchFact.category` の決定規則を §B に統一。
3. `PlayerMatchFact` に `countsForWinRate: boolean`（retired=false 相当）と `roundOrder` を明記。
4. **team は個人統計対象外**（§E）。`byTeam`（所属別）は個人戦の `selfTeam` 集計であり、団体戦の「チーム」とは無関係。
5. participant→数値id は `playerId` フィールドではなく**姓名解決**（§D。detail の `playerId` は常に null）。

---

## J. 実装可否の結論

上記 A〜I で、実行計画 P1（SourceAdapter/Facts）〜P2（Aggregators）で**判断待ちになる箇所は解消**した。
残る不確定は「第3スキーマ（roundRobinMatches/standings）の試合単位 W/L 取り込み」と「team→選手名簿」だけで、
いずれも**初期リリースでは placement のみ／対象外**と割り切れるため、実装を止めない。運用開始後に必要が出たら拡張する。
