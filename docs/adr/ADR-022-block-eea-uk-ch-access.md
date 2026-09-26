# ADR-022: EEA・英国・スイスからのアクセスを Cloudflare でブロックする

## Status

Accepted

## Context

- AdSense を配信している以上、Google の EU ユーザーの同意ポリシー上、EEA/UK には Google 認定 CMP
  （TCF v2.2 対応）が必要で、自作の同意バナー（[ADR-018](./ADR-018-consent-by-region.md)）は満たさない。
  ADR-018 以前からの未対応事項だった（[open-questions.md](../wiki/open-questions.md)）。
- 2026-09-25 に試合詳細ページの YouTube 埋め込みプレーヤーを外部送信の公表に足した際、
  埋め込みプレーヤーは同意状態に関係なく読み込まれることも確認した。EEA では同意前に第三者へ送信している。
- open-questions は「まず GA4 で EEA/UK のトラフィック量を測る。ごく少数なら EEA/UK には出さないほうが安い」
  としていた。**2026-09-26 にユーザーが GA4 で確認し、EEA/UK からのアクセスは 0** だった。
- `softeni-pick.com` は Cloudflare の DNS で管理され、Cloudflare 経由で配信されている（WAF が使える）。

## Decision

**EEA 30か国・英国・スイスからのアクセスを、Cloudflare の WAF カスタムルールでブロックする。**
認証済みボット（検索エンジンのクローラー）は除外する。

ルールの式（アクション: Block）:

```
(ip.src.country in {"AT" "BE" "BG" "HR" "CY" "CZ" "DK" "EE" "FI" "FR" "DE" "GR" "HU" "IE" "IT" "LV" "LT" "LU" "MT" "NL" "PL" "PT" "RO" "SK" "SI" "ES" "SE" "IS" "LI" "NO" "GB" "CH"} and not cf.client.bot)
```

- 設定は Cloudflare の管理画面で行う（リポジトリには無い）。2026-09-26 にユーザーが登録した。
- 同意バナーと地域判定（ADR-018）はそのまま残す。対象は「端末が `Asia/Tokyo` でない人」で、
  EEA 以外（米国など）からのアクセスにも出る。

## Alternatives

- **認定 CMP を導入する**: 要件は満たすが、流入 0 の地域のために同意画面の実装・運用を抱えることになる。
- **EEA には AdSense を読み込まず、YouTube を「タップで読み込む」表示にする**: サイトは読めるが、
  判定はタイムゾーン頼みで精度が落ち、コード変更が2か所に要る。GA4 と同意バナーの扱いも残るので、
  EEA 向けの対応が完全には終わらない。
- **Pages Functions の `_middleware` で国別に弾く**: IP で判定できるが、全リクエストが Worker 経由になり
  キャッシュとコストの前提が変わる（ADR-018 の Alternatives と同じ理由）。WAF ルールなら不要。

## Consequences

- EEA/UK 向けの認定 CMP の未対応が解消する。YouTube 埋め込みの同意前読み込みも EEA では起きなくなる。
- 欧州に滞在中の日本人も閲覧できなくなる。
- 欧州で国際大会（ソフトテニスの欧州選手権など）が注目され、流入が見込めるようになったら見直す。
- ブロックはリポジトリの外にあるので、wiki（[deployment.md](../wiki/deployment.md)・
  [monetization.md](../wiki/monetization.md)）から必ず辿れるようにしておく。

## Implementation Status

2026-09-26 設定済み（Cloudflare 管理画面）。日本からは動作を確かめられないため、ブロックされることは未確認。
