# Android

## 概要

このリポジトリ内では、Softeni Pick 本体の Android アプリ実装は確認できませんでした。

一方で、`adinsight-site/` には `AdInsight` という Android アプリ向けの静的紹介サイトがあります。

## このリポジトリで確認できたもの

### `adinsight-site/`

- `adinsight.softeni-pick.com` 向けの静的サイト
- `adinsight-site/index.html` では Android アプリを案内
- 説明文上は以下に言及
- AdMob / AdSense 収益確認
- 通知
- Google Sign-In
- Firebase Cloud Messaging
- Google Play Billing

### 確認できなかったもの

- Android ネイティブコード
- `app/` ディレクトリ
- Gradle 設定
- Kotlin / Java 実装
- Play Billing 実装コード

## Softeni Pick 本体との関係

- 現状、このリポジトリで明確に確認できるのは「Android アプリ本体」ではなく「Android アプリ紹介サイト」
- Softeni Pick 本体の試合データや Supabase と AdInsight が直接つながっているコードは未確認

## Assumption

- Android 実装本体は別リポジトリ管理の可能性が高い
- `adinsight-site/` は配布導線・法務ページ・サポート導線のみを担う

## Open Questions

- Android アプリ本体のリポジトリはどこか
- AdInsight と Softeni Pick が同一バックエンドを共有しているか
- 課金、通知、OAuth の実装責務がこのリポジトリ外にあるか
