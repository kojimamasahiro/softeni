# 不具合: 過去年の記事の「N年連続」「N連覇」が、翌年以降の大会結果で不一致になる（verify-story-text.mjs）

## 状況

修正済み（2026-08-02）。`scripts/verify-story-text.mjs` / `scripts/check-tournament-insights.mjs`。
インターハイ2021〜2025年の男女ダブルス・団体18件を過去分としてまとめて執筆・公開する作業中に発覚。

## 症状

2025年公開ずみの記事に「広島翔洋が2021年から5年連続でベスト8以上」と書いていたところ、
2026年のインターハイが準々決勝まで進んで広島翔洋が改めてベスト8を確定させた時点で、
`check-tournament-insights.mjs`（prebuildの再照合）がこの記事を不一致として落とすようになった。
実データ側の「現在の連続年数」が6年に伸びたため。

記事自体は2025年時点では正しい記述で、本文もその時点のデータも書き換えていない。
それでも翌年の大会が進むだけで公開済みの記事が壊れる。

## 原因

`streakLength()` と `repeat-title` の判定が、`facts.years`（掲載データの全期間、最新年まで）
を起点に「最後にその条件を満たした年」から遡って数えていた。年×成績（`year-result`）や
スコアの照合は特定の年を指すため後年のデータが増えても結果が変わらないが、
「N年連続」「N連覇」は**問い自体が「現在何年連続か」**なので、翌年以降にデータが増えるたびに
答えが変わりうる。記事は「執筆した時点」の事実を書いているのに、照合は常に「今」を見ていた。

## 修正

`verify-story-text.mjs` に `-y <year>`（記事の年）を追加。`streakLength` / `entryStreak` /
`repeat-title` の起点をこの年に固定し、それより後の年のデータは「まだ無かったもの」として
無視する。`year-result` / `year-in-range` / `score` / 固有名詞の照合は従来通り全期間のまま
（記事が再戦の相手校のその後の対戦結果に触れることがあり、そこまで縛ると書けなくなるため）。

`check-tournament-insights.mjs` は再照合のたびに `insight.year` を `-y` として渡すよう変更。
公開済みインサイトは全て `year` フィールドを持つため、追加のデータは不要。

## 結果

過去年の記事に「N年連続」を書いても、その後の大会結果では不一致にならなくなった
（`-y 2025` で検証すると通り、`-y` 省略＝最新年基準では従来通り不一致になることを確認済み）。
今年（進行中）の記事は `insight.year` が実質的に最新年と一致するため、挙動は変わらない。

## 関連

- `scripts/verify-story-text.mjs` / `scripts/check-tournament-insights.mjs`
- `data/tournament-insights/highschool-championship/2025/doubles-none-girls.json`（実例）
- `docs/story-yaml/PROMPT.md` / `docs/adr/ADR-012-llm-authored-insights-with-machine-verification.md`
