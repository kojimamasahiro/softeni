#!/bin/bash

echo "🎾 ソフトテニス ポイント記録システムのセットアップを開始します..."

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
npm install

# 環境変数ファイルの作成
if [ ! -f .env.local ]; then
    echo "⚙️ 環境変数ファイルを作成中..."
    cp .env.example .env.local
    echo "✅ .env.local を作成しました。Supabaseの設定値を入力してください。"
else
    echo "ℹ️ .env.local は既に存在します。"
fi

echo ""
echo "🎯 次のステップ:"
echo "1. Supabaseプロジェクトを作成"
echo "2. database/schema.sql をSupabase SQL Editorで実行"
echo "3. .env.local にSupabaseの設定値を入力"
echo "4. npm run dev で開発サーバーを起動"
echo ""
echo "📚 詳細は POINT_SYSTEM_README.md をご確認ください。"