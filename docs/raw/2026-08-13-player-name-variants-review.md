# 選手名の表記ゆれレビュー（同じ姓・同じ所属で名が前方一致）

作成 2026-08-13。きっかけは `水木洸太` / `水木洸`（[チェックリスト](./2026-08-12-secondaryschool-release-checklist.md) C-7）。

**機械的には直せない。** 誤りの向きが2種類あるため:

- **切り詰め**: `愛美` → `愛` のように名が1文字に削れている
- **混入**: `萌衣紗` → `萌衣紗ENEOS` のようにチーム名などが名に食い込んでいる

`水木` は**長いほう（洸太）が誤り**だった（ユーザー確認済み）。多数決も前方一致の長短も決め手にならないので、
1件ずつ出典で確認すること。確認したら「正」の列に残すほうを書いて、`normalize` ではなく
**details の当該ファイルを直接直す**（`id` / `firstName` / `entries[].playerIds` の3箇所すべて）。

| 姓 | 所属 | 表記A | Aの出典 | 表記B | Bの出典 | 正 |
|---|---|---|---|---|---|---|
| MALIK | PAK | `M. HUSNAIN` | 1件（international-korea-cup 2026） | `M. HUSNAIN UL HAQ` | 1件（international-korea-cup 2026） | |
| 中山 | 上宮 | `喜` | 1件（highschool-championship 2026） | `喜太` | 1件（highschool-kinki-block 2026） | |
| 中川 | 米子松蔭 | `龍` | 6件（highschool-championship 2024・highschool-championship 2025・highschool-c） | `龍葉` | 1件（highschool-championship 2026） | |
| 丸田 | 明徳義塾 | `涼介` | 1件（highschool-championship 2023） | `涼介高` | 1件（highschool-championship 2022） | |
| 井上 | 駿台甲府 | `颯` | 3件（highschool-championship 2025・highschool-japan-cup 2026・highschool-kant） | `颯吹` | 1件（highschool-championship 2026） | |
| 伊藤 | 盛岡三 | `心` | 1件（highschool-tohoku-block 2026） | `心人` | 1件（highschool-championship 2026） | |
| 前田 | 美濃加茂 | `海` | 1件（highschool-championship 2024） | `海伶` | 1件（highschool-championship 2025） | |
| 北川 | 小俣 | `仁` | 1件（zennihon-secondaryschool-versus 2025） | `仁中` | 1件（zennihon-secondaryschool-versus 2024） | |
| 原田 | スマイリー | `圭` | 4件（secondaryschool-championship 2024・zennihon-junior 2025・zennihon-primar） | `圭小` | 1件（zennihon-secondaryschool-versus 2024） | |
| 吉井 | 霞ヶ浦 | `翼` | 4件（east-qualifying-ibaraki-singles 2025・highschool-championship 2024・high） | `翼紀` | 1件（highschool-championship 2026） | |
| 小林 | ヨネックス | `愛` | 1件（yonex-hokkaido-international 2025） | `愛美` | 22件（asian-championship-qualifier 2025・asian-games-qualifier 2025・east-japa） | |
| 小池 | 上宮 | `優` | 1件（highschool-kinki-block 2026） | `優太` | 1件（highschool-championship 2026） | |
| 山本 | ENEOS | `萌衣紗` | 3件（west-japan 2026・zennihon-championship 2025・zennihon-mixed 2025） | `萌衣紗ENEOS` | 1件（zennihon-singles 2025） | |
| 山本 | 福知山成美 | `将` | 2件（highschool-championship 2024・highschool-kinki-block 2026） | `将生` | 1件（highschool-championship 2026） | |
| 岩下 | 誠修 | `友迦` | 1件（highschool-championship 2024） | `友迦󠄀` | 1件（highschool-championship 2023） | |
| 新谷 | 尾道 | `煌` | 2件（highschool-championship 2025・highschool-chugoku-block 2026） | `煌太朗` | 1件（highschool-championship 2026） | |
| 松山 | 新潟UCHINO | `茜` | 5件（secondaryschool-championship 2024・secondaryschool-hokushinetsu-block 2） | `茜北` | 1件（secondaryschool-championship 2025） | |
| 松村 | 三国クラブ | `翼` | 1件（zennihon-primaryschool 2022） | `翼北` | 1件（secondaryschool-championship 2025） | |
| 津金 | 駿台甲府 | `飛` | 1件（highschool-championship 2026） | `飛吹` | 3件（highschool-championship 2025・highschool-japan-cup 2026・highschool-kant） | |
| 渡邊 | MASTER | `雫` | 1件（secondaryschool-championship 2025） | `雫長` | 1件（zennihon-secondaryschool-versus 2024） | |
| 生平 | 盛岡三 | `瑛` | 1件（highschool-championship 2026） | `瑛人` | 1件（highschool-tohoku-block 2026） | |
| 螺良 | 白鷗大足利 | `寧` | 1件（highschool-kanto-block 2026） | `寧々` | 9件（highschool-championship 2024・highschool-championship 2025・highschool-c） | |
| 諌山 | 精道三川台 | `紘聖` | 1件（highschool-championship 2024） | `紘聖精道三川台` | 1件（highschool-championship 2023） | |
| 諸喜田 | 東京経済大学 | `孝太` | 1件（zennihon-university 2025） | `孝太郎` | 3件（east-japan 2025・zennihon-university 2023・zennihon-university 2024） | |
| 金井 | Liberty Association | `蒼` | 1件（east-japan 2025） | `蒼汰` | 1件（east-japan 2026） | |
| 鈴木 | 明秀日立 | `想` | 1件（highschool-championship 2025） | `想奈` | 1件（highschool-championship 2022） | |
| 高畠 | 高岡商 | `健` | 1件（highschool-hokushinetsu-block 2026） | `健陽` | 1件（highschool-championship 2026） | |

## 済（2026-08-13 修正）

**7件を修正して 27件 → 21件。** 手順はいずれも details の当該ファイルで
`id` / `firstName` / `entries[].playerIds` を**ピンポイント置換**（JSON整形を保つため全体の再シリアライズはしない）。
適用前に「新しい id が同一ファイル内で衝突しないこと」「`"firstName": "◯◯"` がファイル内で一意であること」を assert している。

| 姓 | 所属 | 誤 | 正 | 根拠 | ファイル |
|---|---|---|---|---|---|
| 水木 | 尾上 | `洸太` | `洸` | 全中2022の1件のみ。他19件は `洸`（同年・同校の別大会も含む）。**ユーザー確認済み** | `secondaryschool-championship/2022/doubles-none-boys` |
| 岩下 | 誠修 | `友迦󠄀` | `友迦` | 末尾に不可視の異体字セレクタ U+E0100 が付いていただけ | `highschool-championship/2023/doubles-none-girls` |
| 山本 | ENEOS | `萌衣紗ENEOS` | `萌衣紗` | 所属名が名に食い込んでいる | `zennihon-singles/2025/singles-none-girls` |
| 諌山 | 精道三川台 | `紘聖精道三川台` | `紘聖` | 同上 | `highschool-championship/2023/doubles-none-boys` |
| 丸田 | 明徳義塾 | `涼介高` | `涼介` | 出場区分の `高` が混入 | `highschool-championship/2022/doubles-none-boys` |
| 北川 | 小俣 | `仁中` | `仁` | 同 `中` | `zennihon-secondaryschool-versus/2024/doubles-none-boys` |
| 原田 | スマイリー | `圭小` | `圭` | 同 `小` | `zennihon-secondaryschool-versus/2024/doubles-none-boys` |

**副次効果**: 進路データのペア継続の検出が **96 → 98** に増えた
（水木・松田ペアが東北高校でも一致するようになったため）。

### 検証

- 対象7件すべてで `id` が `姓_名_チーム_県` と一致（不整合0）
- `entries[].playerIds` の参照切れ **0**
- 前方一致のゆれ **27 → 21件**

### 修正中に見つかった別件 → 解決（2026-08-13）

**同一ファイル内で `id` が重複しているファイルが2件**あった（`HEAD` の時点から存在）。

原因はユーザーの説明で判明:
**片方のエントリーがリタイアし、同じ選手が別のエントリーに選手変更で出場した**パターン。
つまり**同姓同名の別人ではなく、同一人物が正当に2エントリーに登場している**。

| ファイル | 選手 | リタイアした側 | もう一方 |
|---|---|---|---|
| `zennihon-championship/2022/doubles-none-boys` | `中本_圭哉_福井県庁_福井県` | **entryNo 58**（2回戦敗退・`retired: true`） | entryNo 93 |
| `zennihon-championship/2023/doubles-none-boys` | `笹井_悠月_木更津総合_高体連` | **entryNo 24**（1回戦敗退・`retired: true`） | entryNo 87 |

いずれも `matches` 側に `retired: true` が入っており、データとしては正しく記録されていた。

**修正は `participants` の重複行を1つに畳むだけ。**
2つの participant オブジェクトは完全に同一の内容で、単なる冗長だった。
`entries[].playerIds` は **id 文字列**で、`matches` / `results` は **entryNo** で参照しており、
**participants を配列の添字で参照している箇所は無い**（確認済み）ので、消しても参照は壊れない。

- participants 374 → 373 件 / 388 → 387 件
- 全ファイル再検証: **id重複0 / 参照切れ playerIds 0**
- entryNo 58「2回戦敗退」・entryNo 24「1回戦敗退」の成績はそのまま維持

**教訓**: 「同一ファイル内の id 重複」は必ずしもデータ破損ではない。
リタイア＋選手変更で同じ人が複数エントリーに出るのは競技上ありうる。
`participants` は**人の一覧**であって**エントリー枠の一覧ではない**ので、1人1行が正しい。

## 分類（2026-08-13 追加）

ゆれの27件を、混入している「余分な部分」で分けた。上3つは**出典を当たらなくても判断できる**。

### 異体字セレクタ（同一の名）（1件）

見た目は同じで、末尾に不可視の異体字セレクタが付いているだけ。**短いほうへ寄せてよい**。

| 姓 | 所属 | 短 | 長 | 余分 |
|---|---|---|---|---|
| 岩下 | 誠修 | `友迦` | `友迦󠄀` | `󠄀` |

### 所属名の混入（2件）

チーム名が名に食い込んでいる。**短いほうが正**。

| 姓 | 所属 | 短 | 長 | 余分 |
|---|---|---|---|---|
| 山本 | ENEOS | `萌衣紗` | `萌衣紗ENEOS` | `ENEOS` |
| 諌山 | 精道三川台 | `紘聖` | `紘聖精道三川台` | `精道三川台` |

### 世代マーカーの混入（3件）

`小` `中` `高` は出場区分の注記が混入したもの。**短いほうが正**。

| 姓 | 所属 | 短 | 長 | 余分 |
|---|---|---|---|---|
| 丸田 | 明徳義塾 | `涼介` | `涼介高` | `高` |
| 北川 | 小俣 | `仁` | `仁中` | `中` |
| 原田 | スマイリー | `圭` | `圭小` | `小` |

### 方角らしき1文字の混入（2件）

`北` などが付く。組み合わせ表の位置表記の混入が疑われるが、名の一部の可能性もある。**要確認**。

| 姓 | 所属 | 短 | 長 | 余分 |
|---|---|---|---|---|
| 松山 | 新潟UCHINO | `茜` | `茜北` | `北` |
| 松村 | 三国クラブ | `翼` | `翼北` | `北` |

### 要出典確認（19件）

`水木` と同型。**どちらが正かは出典を当たるしかない**（水木は長いほうが誤りだった）。

| 姓 | 所属 | 短 | 長 | 余分 |
|---|---|---|---|---|
| MALIK | PAK | `M. HUSNAIN` | `M. HUSNAIN UL HAQ` | ` UL HAQ` |
| 中山 | 上宮 | `喜` | `喜太` | `太` |
| 中川 | 米子松蔭 | `龍` | `龍葉` | `葉` |
| 井上 | 駿台甲府 | `颯` | `颯吹` | `吹` |
| 伊藤 | 盛岡三 | `心` | `心人` | `人` |
| 前田 | 美濃加茂 | `海` | `海伶` | `伶` |
| 吉井 | 霞ヶ浦 | `翼` | `翼紀` | `紀` |
| 小林 | ヨネックス | `愛` | `愛美` | `美` |
| 小池 | 上宮 | `優` | `優太` | `太` |
| 山本 | 福知山成美 | `将` | `将生` | `生` |
| 新谷 | 尾道 | `煌` | `煌太朗` | `太朗` |
| 津金 | 駿台甲府 | `飛` | `飛吹` | `吹` |
| 渡邊 | MASTER | `雫` | `雫長` | `長` |
| 生平 | 盛岡三 | `瑛` | `瑛人` | `人` |
| 螺良 | 白鷗大足利 | `寧` | `寧々` | `々` |
| 諸喜田 | 東京経済大学 | `孝太` | `孝太郎` | `郎` |
| 金井 | Liberty Association | `蒼` | `蒼汰` | `汰` |
| 鈴木 | 明秀日立 | `想` | `想奈` | `奈` |
| 高畠 | 高岡商 | `健` | `健陽` | `陽` |
