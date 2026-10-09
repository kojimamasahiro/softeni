# ADR-024: LLM Wiki の運用モデル（エージェントが読む「現在の理解」へ compile し続ける）

## Status

Draft

決定日: 2026-10-09。実装状況: 未着手（段階導入 P1〜P5）。P4（AGENTS.md の書き換え）の完了で Accepted にする。
経緯・測定・各ステップの訂正は [raw/2026-10-09-llm-wiki-redesign.md](../raw/2026-10-09-llm-wiki-redesign.md) が正。

## Context

- この repo の docs は LLM Wiki の考え方（Karpathy, 2026-04。生資料を相互リンクされた wiki へ compile し、書き戻して蓄積する）で運用してきた。
  raw は追記のみ、wiki は現在の仕様だけ、adr は決定の経緯、という三層で、`check:wiki` が規約の一部を機械で見ている。
- 運用してみて、次の点が曖昧なままだった。
  - wiki の読み手が誰か。ページは人が通読する粒度のまま、実際には毎回エージェントが読んでいる。
  - wiki が「意図（未実装の仕様）」と「記述（実装の説明）」を兼ねているのに、「実装が正」だけが書かれている。
  - Schema（規則）が AGENTS.md・docs/README.md・prompts・check スクリプトに分散し、Compile Log の規則は4か所にある。
  - 適用範囲の印をページと index の両方で手で持ち、41行の突き合わせで2件が食い違っていた。
  - 「どの事実をどのページに書くか」の判断が手順にならず、エージェントの頭の中にある。
  - 触るコードから所有ページを引く手段が無い。本文のパス言及で辿れるのは、更新されたページの35%（ファイル単位）〜75%（ディレクトリ単位）。
  - wiki 自体の操作（compile / lint / 圧縮）が、他の定型作業と違って skill になっていない。
- 直近120コミットで、コードを触るコミットの81%が同じコミットで wiki も更新している。書き戻しの習慣はあり、足りないのは構造と道具。

## Decision

1. **定義と読み手**: raw とコードを、エージェントが読む「現在の理解」へ compile し続ける。経緯は ADR、証拠は raw に分ける。
   **wiki の主な読み手はエージェント**（人間はレビュー役）。**実装済みの挙動を書いたページは実装が正、未実装の仕様は `Draft` として wiki が先行**。
2. **層**: raw / wiki / schema の3つ。コードと `data/` は層の外の一次資料。優先順位は **コード・data ＞ raw ＞ wiki**。
   ADR は第4の層にせず、wiki 層の page type「決定記録」とする（置き場は `docs/adr` のまま）。raw は「過程と証拠の記録（追記のみ）」。
   **Schema の規則の正は AGENTS.md に一本化**。手順は skill、検証の閾値は check スクリプトが正。
3. **AGENTS.md**: 「読む順 → 層と優先順位 → 操作（Query / Compile / Lint。各々に契機・入口・完了条件）→ 不変条件 → Skills」の構成、6,000字以内。
   入れ子分割は見送る（常時読込が約8,000字を超えたら再検討）。raw → wiki は **compile** で統一する（「取り込み」は大会 PDF を data に入れること）。
4. **frontmatter**: wiki に `type` / `scope` / `status` / `summary` を必須、`code:`（ディレクトリ〜モジュール粒度）を持たせる。`area:` は足さない。
   `index.md` は frontmatter から生成する。ADR には足さない。raw は新規ノートだけ `kind`（research / idea / plan / worklist / archive）を持つ。
5. **page type は6つ**: entity / concept / feature / procedure / overview / index。原則は **1ページ1型**と**事実の所有者は1つ**
   （ID の形式と置き場は entity ページだけが書く）。新規の entity ページは Player と Team の薄いページ2つだけ。
6. **Compile（Ingest）**: Triage → Route → Write → Close の1本の手順。インライン（実装と同じコミット）とバッチ（raw が溜まったとき）の2モード。
   事実の種類ごとの行き先の表に従い、Compile Log は「行き先: 内容」の1行で書く。書き戻すのは実装したセッション。
7. **Query**: 意図（index の summary）→ 触るコード（`code:`・`wiki:for`）→ 語（grep）の3経路。
   読んで足りなかった／違っていた箇所はその場で直す。再利用できる調査は raw に research ノートを残す。
8. **Lint**: ゲート／報告／意味 lint の3段。意味 lint で同種の指摘が2回出たら機械検査（報告）に、誤検知が小さければゲートに昇格する。
   ゲートに足すのは frontmatter の妥当性・`code:` の実在・index の鮮度・Compile Log の行き先の実在。本文のパスはゲートにしない。
   意味 lint の契機は「大きめの実装の後」と「月次」、出力は raw の lint ノート。
9. **接続**: wiki 操作を skill 3つ（wiki-compile / wiki-lint / wiki-slim）に移し、`docs/prompts` は raw からのリンクを守るため薄いリダイレクトで残す。
   道具は npm script（`wiki:for` / `wiki:index`）、強制は `pre-push` への `check:wiki --strict` の追加と CI。Claude Code 専用の hook は今は入れない。
10. **導入と測定**: P1（frontmatter ＋ 検証）→ P2（index 生成 ＋ `wiki:for`）→ P3（skill ＋ Compile Log の書式）→ P4（AGENTS.md の書き換え ＋ pre-push ＋ PR テンプレート ＋ CI）
    → P5（随時）。各1 PR。指標は、コードを触るコミットの wiki 更新率（基準 81%）・CI の報告件数・月次の意味 lint の指摘数。
    プロジェクトの事実と規則は repo に置き、memory は個人の好みと作業スタイルだけにする。

## Alternatives

- **wiki を人間が通読する前提のまま保つ**: 現状の粒度は維持できるが、毎回の読み手はエージェントで、ルーティングに必要な summary や `code:` が持てない。却下。
- **ADR を第4の層にする**: 「現在の理解」と「なぜそうしたか」の入口が分かれ、エージェントがどちらも引けなくなる。却下。
- **AGENTS.md の入れ子分割（`docs/AGENTS.md`）**: 常時読込が3,737字と小さく利点が無い。書き戻しの契機はコードを書いている最中に発火するのでルートに無いと見落とす。見送り。
- **`area:` を足す／`code:` をファイル単位にする**: 42ページなら type 別の index で足りる。ファイル単位は壊れやすい（本文のパス言及で35%しか当たらない）。却下。
- **本文中のコードパスの存在をゲートにする**: 388件中12件が実在しないが、文脈上は意図的な記述（削除済み・まだ作らない・Deprecated・テンプレート等）が8件で、誤検知が約8割。報告に留める。
- **Claude Code 専用の hook で所有ページを知らせる**: Codex では効かずツール間で挙動が割れる。見送り（`wiki:for` の導入後も更新率が上がらなければ再検討）。
- **既存の raw に遡って frontmatter を付ける**: 追記のみの原則に反する。新規ノートから。却下。

## Consequences

- 良い点: 意図で選ぶ・コードで選ぶの2経路でページに辿り着ける。事実の所有者が1つになり、二重管理（適用範囲の印など）が消える。
  ずれ（旧パスの残り、実在しない `code:`）が早く見つかる。wiki 操作が skill として自動発火する。
- 負担: 42ページへの frontmatter 付与（type の分類と summary の1行は書く作業）。`code:` と `summary` の保守。
  frontmatter の更新忘れは存在検査では防げない（意味 lint が拾う）。skill の発火が過剰・過少になる恐れ。
- 残る課題: idea-backlog 索引と open-questions への編集の集中（120コミット中 33 / 36）は、この設計の生成対象（index.md）の外。

## Related Files

- [raw/2026-10-09-llm-wiki-redesign.md](../raw/2026-10-09-llm-wiki-redesign.md) — 経緯・測定・各ステップの決定と訂正
- `AGENTS.md` / `CLAUDE.md` / `.github/copilot-instructions.md` — 指示の入口（P4 で書き換え）
- `docs/README.md`、`docs/prompts/*.md` — Schema の分散箇所（P3・P4 で整理）
- `scripts/check-wiki-size.mjs` — 機械検査（P1 で frontmatter と `code:` の検証を足す）
- `.githooks/pre-push`、`.github/workflows/checks.yml` — 強制（P4）
- `.claude/skills/`（実体）と `.agents/skills/`（Codex 用リンク）— wiki 操作の skill を足す（P3）

## Open Questions

- idea-backlog 索引の自動化の余地（各エリアページの表への手動同期）。
- procedure ページと大会データ系 skill の役割分担（二重化は未解決）。
- type の値は P1 で42ページを実際に分類しながら調整する。
- ADR 化の基準（`docs/adr/README.md`）に「docs・エージェント運用のモデル」を足すか。本 ADR は例外として起こした。
- 月次の意味 lint の担当。`status: draft` のまま残ったページの扱い。
