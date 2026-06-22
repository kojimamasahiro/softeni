# ADR-001: 地方大会候補検知ストアを公開データから分離する

## Status

Accepted

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

- `accepted` 候補をどの手順で `information/*.json` に反映するか
- 既存 `local_index.json` の大会との半自動紐付けをどこまで行うか
