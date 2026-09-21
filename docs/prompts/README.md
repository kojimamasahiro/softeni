# Prompts

`docs/prompts/` は、**AI アシスタントに繰り返し渡す定型プロンプト**の置き場です。
中身はただの Markdown の指示なので、**どのアシスタントでも使えます**（もともと Codex 向けに
書き始めたが、道具は問わない。2026-09-19 に表記を中立化）。

使い方:

- **Claude Code**: 「`docs/prompts/update-wiki.md` の手順で wiki を更新して」のようにファイルを指定する。
  よく使うものは `.claude/skills/` の skill 側にも手順があるので、そちらが発火すればそれでよい。
- **Codex**: 同じくファイルを指定する。skill は `.agents/skills/`（`.claude/skills/` へのリンク）から読まれる。
- **その他**: ファイルの中身をそのまま貼る。

主な用途:

- raw メモの要約
- wiki 更新
- ADR 作成
- 実装と docs のズレ確認
- wiki ページの圧縮

一覧:

- [update-wiki.md](./update-wiki.md)
- [summarize-raw.md](./summarize-raw.md)
- [create-adr.md](./create-adr.md)
- [review-docs-drift.md](./review-docs-drift.md)
- [slim-wiki-page.md](./slim-wiki-page.md) — wiki ページを「現在の仕様」だけに圧縮し、全文を raw に退避する（2026-09-18）
