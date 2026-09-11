# ADR-001: 地方大会候補検知ストアを公開データから分離する

## Status

Deprecated（2026-09-12。理由は末尾の「2026-09-12 追記」を参照。Context / Decision / Alternatives は当時の記録として残す）

## Context

地方大会ページの更新は、都道府県ごとの公式サイトを手動確認して `data/tournaments/information/*.json` に反映している。  
公開導線の source of truth は既存の `local_index.json` と `information/*.json` にあり、これを直接自動更新すると誤検出がそのまま公開面に出るリスクが高い。

また、候補として確認済みであることと、公開データへ反映済みであることは意味が異なる。

## Decision

- 巡回候補は `data/local-sources/**` に別管理する。
- 公開データの source of truth は引き続き以下とする。
  - `data/tournaments/local_index.json`
  - `data/tournaments/information/*.json`
- `data/local-sources/prefecture-sources.json` は巡回元 URL 管理の source of truth とする。
- `data/local-sources/detected-documents.json` の `accepted` は「候補として確認済み」の意味に限定する。
- `accepted` は公開データ反映済みを意味しない。
- 恒久的な除外は `data/local-sources/ignored-documents.json` で管理する。

## Alternatives

- `information/*.json` を巡回結果で直接更新する
  - 自動化は進むが、誤検出時の公開リスクが高い
- `accepted` を公開反映済みフラグとして使う
  - 意味が混線し、人手確認フローと公開反映フローを分離しにくい

## Consequences

- 候補検知と公開反映の責務を分離できる
- 人手確認を前提にした安全な半自動運用にできる
- v1 では `accepted` 後の公開反映が別作業のまま残る

## Related Files

- `data/local-sources/prefecture-sources.json`
- `data/local-sources/detected-documents.json`
- `data/local-sources/ignored-documents.json`
- `scripts/crawl-local-tournaments.mjs`
- `docs/wiki/tournaments-local.md`

## Open Questions

- ~~`accepted` 候補をどの手順で `information/*.json` に反映するか~~（2026-09-12 に運用停止で決着）
- ~~既存 `local_index.json` の大会との半自動紐付けをどこまで行うか~~（同上・失効）

## 2026-09-12 追記: 運用停止

`detected-documents.json` を削除し、本 ADR の運用を停止した（Status: Deprecated）。

この分離（候補検知と公開反映を別ストアにする）という決定自体は誤りではなかったが、
**人手を挟む前提のまま、出口の受け皿を 1 種類（インターハイ予選）しか作らなかった**ため、
検知は動き続け、反映は一度も動かないまま止まった。実測は次の通り。

- 583 件が `status: "new"` のまま 2026-06-13 以降放置（`accepted` 0 / `appliedAt` 0）
- 反映先が決まる `qualifierType` を持つのは 20 件のみ。残り 563 件は仕分けても入れる先が無い
- `eventType` が `unknown` のものが 531 件、`contentType` も unknown が 361 件

教訓として残すこと: **検知の設計より先に、出口（どのデータにどう入るか）を決めること。**
出口が 1 種類しか無いなら、検知もその 1 種類に絞る。

再開する場合は本 ADR を復活させるのではなく、出口から設計し直した新しい ADR を書く。
関連: [raw 2026-09-06 追記20](../raw/2026-09-06-idea-autonomous-improvement-agent.md)、
[tournaments-local.md](../wiki/tournaments-local.md)
