# Open Questions

このページは**未解決の問いだけ**を置く。解決したものは末尾の
「[解決済み（記録）](#解決済み記録)」へ移し、1〜3行の結論と参照先だけ残す
（2026-09-02 に整理。解決済みの節が本文中に居座り「未解決の一覧」として読めなくなっていたため）。

## ドキュメント運用（2026-08-12 lint → 2026-09-02 lint で更新）

`docs/raw/2026-08-12-llm-wiki-lint.md` / `docs/raw/2026-09-02-llm-wiki-lint.md`
（リポジトリ全体のヘルスチェック）の §5 より。機械的に直せるものは各 lint で修正済みで、
ここには判断が要るものだけを残す。

**2026-09-02 に解消したもの**（項目は落とし、経緯だけ残す）:

- 解決済み Open Question の置き場 → 末尾に「[解決済み（記録）](#解決済み記録)」を新設し、
  解決した6件を移した。以後、解決したものは本文から外してそこへ移す。
- `docs/sql/*.sql` の適用追跡 → [docs/sql/APPLIED.md](../sql/APPLIED.md) を新設して解決。
  ただし `receive-order.sql` の本番適用可否は**まだ「未確認」のまま**で、下に単独の項目として残す。
- Compile Log 欠落26本の遡及 → AGENTS.md に適用開始日（2026-07-11）と
  2026-08-01 以降のバックフィル済みを明記して打ち切り済み。**2026-08-13 以降に新規追加された
  raw 36本のうち7本に Compile Log が無い**ため、下に運用の項目として残す。
- CI スクリプト2本（`check-highschool-pipeline-freshness.mjs` / `check-orphan-entries.mjs`）の
  docs 未言及 → 解消済み。

現在の未解決:

- **`docs/sql/receive-order.sql` を本番 Supabase に適用したかが未確認。** 未適用ならポイント入力の
  レシーブ選手自動推定が働かない（`games.initial_receive_player_index` が常に null）。
  確認して [APPLIED.md](../sql/APPLIED.md) に日付を入れる。
- **Compile Log の運用が定着しきっていない。** 2026-08-13 以降の raw 36本中7本が未記入
  （`2026-08-12-secondaryschool-{release-checklist,teamid-review}` / `2026-08-12-university-team-name-cleanup` /
  `2026-08-13-player-name-variants-review` / `2026-08-15-m4-gsc-review` /
  `2026-08-20-zennihon-workers-2022-general-boys-review` / `2026-08-31-player-registered-name-change`）。
  うち作業リスト型（teamId 目視・要確認リスト）は wiki へ載せるものが元々無い可能性が高いので、
  **「作業リスト型の raw には Compile Log を求めない」と AGENTS.md に例外を書くか、
  「除外のみ1行」で必ず書かせるか**を決める。
- **選手の登録名変更（改名）の対応表が未実装。**
  `data/players/player-name-aliases.json` と `scripts/normalize-player-names.mjs` の実装、
  林 湧太郎 → 林 佑太郎 の適用（`index.json` の count 22 → 24 を含む）が残っている。
  設計は [team-player-identity.md](./team-player-identity.md)「選手の登録名変更（改名）」、
  経緯は [raw/2026-08-31-player-registered-name-change.md](../raw/2026-08-31-player-registered-name-change.md)。
- **`docs/wiki/idea-backlog.md` の「一言サマリ」が一言でなくなっている。** 1セルが数千字あり、
  索引としての用（どこにあるかを1ページで把握する）を果たしていない。
  文字数上限を決めて各エリアページへ寄せるか、索引の責務自体を見直すか。
- **文部科学大臣杯全日本大学対抗選手権大会（インカレ団体戦）の `tournamentId` が未定義。**
  `data/tournaments/index.json` の generation `university` には
  `zennihon-university` / `zennihon-university-ouza` / `zennihon-university-indoor` はあるが、
  大学対抗選手権に当たるIDが無い。2026年の組み合わせは
  `tools/incare-2026/team-none-boys.initialPlayers.json` に変換済みなので、結果を
  `data/tournaments/details/` に入れる段階でIDを決める必要がある
  （[インカレの姓名分割](../raw/2026-08-29-intercollegiate-name-split.md) 追記2）。
- 2026-05-24 最終更新の4ページ（`backend.md` / `database.md` / `project-overview.md` /
  `score-analysis.md`）を「復元した初期メモ」から「現行仕様」へ昇格させるか、統合して
  Deprecated にするか。実装との突き合わせでは内容はほぼ正しく、格付けだけが古い
  （2026-09-02 lint でも API エンドポイント11本が実装と全一致することを再確認。
  ただし同 lint で `prebuild` の記述が3段のまま実態15段とずれていたのを修正しており、
  「内容は正しい」は無条件ではない）。
- wiki → raw の参照が「バッククォートのパス表記」と Markdown リンクで混在しており、
  到達性を機械チェックできない。どちらかに寄せるか。
- 中断案件の「再開トリガー」を統一フォーマットで持たせる
  （`docs/exploration-cycle-audit-2026-08-10.md` §1-7 の提言。最初の適用先候補は
  `docs/ui/**` の M5＝トークン導入、2026-07-04 から停止中）。
- この lint 自体を `scripts/check-docs-lint.mjs` として CI 化するか
  （リンク切れ・孤立・Compile Log 欠落・ADR Status 記入漏れは機械判定できる）。

## 発展候補アイデア一覧（Idea Backlog・プロジェクト運用/メタ）

プロダクト機能でなく、開発・AI協働の進め方に関するアイデアはここに積む
（score機能まわりの機能アイデアは [score-general-availability.md](./score-general-availability.md) の表を参照）。

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| AIとの共同探索と探索プロセスの属人性 | 発散フェーズ・中断中（2026-07-11）。中心の問い=「AIは人間の探索の属人性をどこまで減らせるか（品質の底上げ、答えの均一化でなく）」。消化状態の追跡はミクロ層として下位に位置付け。**再開はrawファイル末尾の「再開ポイント」（未回答の問い3つ）から** | [アイデア](../raw/2026-07-11-idea-ai-co-exploration-context.md) |
| skillのローカルLLM代替（Claude不在時） | **2026-08-14: 設計→実データ検証で優先順位を修正**。対象3skillのうち venue-data は実装済み（`scripts/venue-agent/`）、pdf-to-players は LLM不要、**insight が本命**。公開済みインサイト24本(417主張)で照合の実効カバレッジを実測したところ、**実データと事実を突き合わせている主張は26.4%のみ**（残りは固有名詞の存在確認38.8%＋年の範囲確認34.8%で、文が誤っていても通る型）。さらに**記事の主語「今年誰が優勝したか」が24本すべてで未照合だった(0/24)**——PROMPT.mdの構成指示「今年何が起きたかを最初に書く」が生む語順が、照合器の抽出パターンから漏れていたため。抽出パターン(a2)を追加して**0/24→23/24**に修正済み（公開24本のERROR/WARNは0のまま）。逸脱の注入テストでは8種のうち機械が落とせるのは2種のみで、**存在しない固有名詞の捏造は警告ゼロで通る**。当初は「禁止語チェックが急務」としていたが、禁止語は8種で唯一の非・事実系の逸脱（実コーパスで出現0件）だったため**優先度を下げ、照合の網の拡張を最優先へ変更**。`scripts/insight-agent/lint.mjs`（評価語・推測・used:・照合カバレッジ）は実装済み・正解コーパスで誤検出0。**同日、網の拡張の最優先項目「未知の固有名詞の検出」も実装済み**（照合器に`--list-names`を追加し、本文から既知の固有名詞と定型語彙を伏せた残りを報告する方式。**記事の語彙は固有名詞を除くと93文字しかない**ことが検出力の根拠。正解コーパス24本で誤検出0、架空校名・架空人名はいずれも検出。別大会の下書きで676件出た誤検出は、原因が「下書きファイルに解説文が同居している」ことと判明し、markdown本文抽出を足して1件に）。残る穴は②複数主体の誤帰属・④スコア照合の粗さ・⑦「初優勝」が照合対象外（24本中17本に出る定型文が未検証）。次の一歩は⑦の照合器への追加。**2026-08-14: A・Bのレビューも実施**——Aは`test_regression.py`を実測して5/5 passを確認（記録の追認でなく実行）、`venue-candidates.json`は実在するので限界1は「データ待ち」でなく「実装待ち」と判明。**Bは前提が誤っていた**——`extract_tournament.py`というファイル名が無いだけで、`scripts/pdf/`に同じ仕事をする資産が15本あり、特に`convert.py`が**initialPlayers形式JSONを既に出力**、`calibrate.py`が**提案した`layouts.py`の上位互換**（座標の実測自体を自動化）。さらに**SKILL.md自体に2つの誤り**を発見: `tempId`は実データ全ファイルで3項目(`姓_名_学校`)なのにSKILL.mdは4項目と記載、`COL_SPLIT`/`DOUBLES_SIDES`は実在しない（実際は`master.py`のフィールドごとX範囲）。欠けているのはCLI化・検証レポート6項目・回帰テストの3つだけで、正しい形はゼロからの新規実装でなく既存3本をCLIとレポート層で束ねること。着手前にSKILL.mdの修正が要る。 **同日、Bを実装済み（`scripts/pdf-to-players/`）**——LLMの担当を「検出した列のどれが姓か学校名か」の1点に絞ったが、実装するとヒューリスティックだけでかなり当たると分かり**LLMは既定オフ・Ollama無しで最後まで通る**形にした。`master.py`を再利用せず別に作ったのは、座標をモジュール定数で持ち戦略もソース直書きで**大会ごとにソースを書き換える運用**になっているため（量をこなす前提だと詰まる）。**団体戦は人が作った正解データ`tools/tournament3/initialPlayer.js`と49件全項目一致**、回帰テスト32/32 pass。実PDFで直した誤りは2点（スコア欄0/1をエントリー番号と誤認／所属と都道府県が同じ列に入る）。**同日、全中2024のドロー表PDFで個人戦も検証済み**——2段組の一覧とは別物の**ブラケット表**（氏名が文字ごとの固定スロット／所属と都道府県が同じ列に行ごとの交互／`近畿・滋賀県`のブロック付き表記／下部に再掲枠）で、初版は全く処理できなかった。**左右の境目も列も「行ごとの投票」で決める方式に変更**したのが要（見出しの1行がページを横断するだけで列が全融合するため）。個人戦4ページとも32エントリーを正しく抽出、PDFをfixture化して回帰テストに組み込み**64/64 pass**。**団体戦ページ(p5-6)も同日対応し25チームずつcleanで抽出、回帰78/78 pass**（詰まっていたのは左右の境目でなく**見出し判定**で、女子団体戦はチーム名12.7pt・都道府県8.2ptのため「最頻の1.5倍より大きい＝見出し」という条件でチーム名が丸ごと消えていた。「大きく、かつ全体のごく一部」に条件を変えて解決）。なお引っかかった5点はどれも幾何の取り方の問題で、LLMに列の意味を聞いても解決しない種類だったため、**LLM不要という判断がさらに強まった**。**同日、ユーザーの指摘（未知の様式への融通が欲しい／気にしているのは実施手順と自力で直せるか）を受けて方針修正**——それまでの「崩れたら`--gap`/`--y-tol`を人が振る」設計は運用者に幾何の理解を要求しており目的に反していた。**パラメータの自動調整層(`tuning.py`)を追加**し、抽出結果を決定的に採点していちばん良いものを選ぶようにした（採点材料は都道府県辞書のヒット率・エントリー番号の連番らしさ・所属の充填率・ペアの成立率で、列がずれると全部崩れるため素直に効く）。検証済みPDFは全て1通り目で点数1.00、ドロー表でない書類では15通り試して0.71＋平易な診断を出力。**LLMは「点数が0.75未満のときだけ列判定を丸ごと聞く」切り札に変更**（追記3の「LLM不要」は"検証済みの様式では不要・未知の様式への保険としては必要"へ修正）。**実施手順書`RUNBOOK.md`を追加**（座標の話を出さず、点数の読み方・レポート項目ごとの対処・困ったときの対応表・「無理に自動化しない」を明記）。**2023年のPDFで失敗した際に語彙を足して対応しかけたが「アドホックな固定対応はしない」と指摘され撤回**——構造的な手掛かり（都道府県が半分程度しか当たらないこと自体が交互列のサイン）だけで足りると判明し、**決定的な層は構造的・統計的手掛かりのみ、語彙に頼る判断はLLMへ**という線引きを明文化。あわせて**LLMを「提案する側」にする修復ループ(`tuning.repair`)を実装**——LLMが提案→機械が採点→外れた内訳をフィードバックして最大3回直させる形にし、採否は常に機械が決める（ADR-012と同じ形をパラメータ調整に適用）。Ollama無しでも検証できるよう提案側を差し替え可能にし回帰88/88 pass。**実機のOllamaでの検証は未了**。**2026-08-14: インカレ（三笠宮賜杯）も通した**——詰まりの正体は知能を要する判断ではなく普通のバグ2つ（行のまとまりを直前の文字とだけ比べて数珠つなぎに融合／エントリー番号を区切りと誤解）と、採点の設計誤り2つ（存在しない項目を減点して上限0.74・目安0.75に到達不能／採点項目が少ない退化解釈ほど満点を取りやすい）だった。ユーザーの「全中とインカレが通ればよい・ある程度アドホックでよい」という方針を受けて**大会プロファイル方式(`profiles.py`)を導入**（PDF本文の署名で自動選択、宣言的で他様式に影響しない、`has_prefecture`/`splits_name`で無い項目を検証から外せる）。全中6ページ＋インカレ2ページ＋一覧型が通り**回帰103/103 pass**。**残る本質的な穴はLLMに生データを見せていないこと**（`describe_columns`は壊れた解釈後の表しか渡していない）。あわせて**SKILL.mdの2つの誤記も修正済み**（修正版をユーザーに受け渡し。tempIdを3項目に、実在しない`COL_SPLIT`/`DOUBLES_SIDES`の記述を実際の仕組みに差し替え、パス修正、崩れたときの手当て表を追加して「スクリプト本体は書き換えない」を明記）。モデル選定(9B/14B/Swallow)は網の拡張後で遅くないと判断し保留。**2026-08-29: インカレの「姓名の境目が座標に無い」という前提が誤りと判明**——均等割り付けは氏名全体ではなく姓と名それぞれに掛かっており、境目の字間だけが2.5pt広い。1170名の94%がこの字間で決まり、既存選手データと照合できた796名中793名(99.6%)が一致（不一致3件は既存データ側の誤り）。残る43名は既存データ→姓名辞書で41名が決まり、最後の2名は**推測せず未分割**にして人に回す形にした。ここでもLLMは使っていない。回帰65/65 pass | [アイデア](../raw/2026-08-14-idea-local-llm-skill-replacement.md)、[インカレの姓名分割](../raw/2026-08-29-intercollegiate-name-split.md) |

## 姓名の分割ゆれ（2026-08-29 棚卸し）

**未解決なし**。検出器A（分割衝突）・検出器B（辞書照合）とも 0 件
（`node scripts/check-name-splits.mjs --strict` が成功する状態）。
保留していた 6 件と辞書照合の 21 件は 2026-08-29 にユーザー判断で確定した。
判断の物差しは [team-player-identity.md](./team-player-identity.md) の「姓名の分割ゆれ」節、
全数の根拠は [raw/2026-08-29-name-split-audit.md](../raw/2026-08-29-name-split-audit.md)。

- **対応済み（2026-08-29）**: `check-name-splits.mjs --strict` を `prebuild` のゲートに入れた
  （`check-highschool-pipeline-freshness.mjs` の次、実行 0.7 秒）。
  新しい取り込みで疑いが出た時点でビルドが止まるので、`verified` に足すか表に判断を書いて
  `normalize-name-splits.mjs` を回すまで通らない。
- **未着手**: ダブルスの**ペアの境界ずれ**（`林楓|恋荒` ＋ `川|琴美` → `林|楓恋` ＋ `荒川|琴美`）を
  拾う検出器が無い。検出器 A・B のどちらにも掛からず、2026-08-29 の 1 件は副作用で偶然見つかった。
  「同一エントリー内の 2 人の氏名を連結し直し、別の切り方なら双方の姓名が辞書に当たるか」を
  見れば検出できるはず。他に残っているかは未調査。

## 全日本学生選抜インドア（zennihon-university-indoor）

- 第59回(2025)の開催会場が公式公開情報から特定できず、`information` の `location` を空にしている。
  要項PDF等で会場が判明したら補完する（開催日は2025-11-03で確定）。
- 2023(第57回)・それ以前の年度は別レイアウトの可能性があり、`scripts/pdf/university_indoor.py`
  のページ割当・座標前提を年度ごとに確認してから取り込む。

## 公開面 / ドメイン分離

方針決定済み（2026-06、ADR-003）: 「閲覧公開（メディア）＝本体 `softeni-pick.com` に統合」
「ツール公開（UGC）＝`score.softeni-pick.com` を本拠地に分離」と役割で割り切る。
コードベースは分けず、分析エンジン（`lib/`）は共有。詳細は
[ADR-003](../adr/ADR-003-score-media-tool-separation.md)。

残る Open Question:

- score 側のヘッダー/フッターやブランド表現を分ける正式方針はあるか
- `score` mode を Phase 2 で UGC 本拠地に転換する際の既存 score mode ラッパとの整合

## 試合詳細の beta 昇格（設計 2026-06 → **実装済み 2026-07-02**）

設計の詳細は [score-site-link.md](./score-site-link.md)。決定はすべて実装に入っている
（2026-09-02 に確認）:

- ネスト URL `/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/matches/[matchId]`
  のページが実在（2026-07-02 追加）。野良試合は `/beta/matches-results/*` のまま
- 逆引き表は `public/data/beta-matches/reverse/by-tournament.json` / `by-player.json` の2本を
  `scripts/generate-match-reverse-index.mjs`（`prebuild` 済み）が生成
- 掲載試合は25件中24件に `siteLink` が付いている

残る Open Question:

- ~~逆引き表の置き場所とファイル分割（全選手1ファイルで足りるか）~~
  → **足りている**（`by-player.json` が29KB / `by-tournament.json` が10KB、25試合時点）。
  試合数が3桁になったら再評価する
- 手入力フォールバック（野良）試合に後から `siteLink` を付与して掲載大会試合へ昇格させる導線を作るか
  （現在 `siteLink` なしは1件）
- **[score-site-link.md](./score-site-link.md) 自体がドラフトの文体のまま**（「本リリースでは急がない」
  「移行スクリプトで一括付与する」等の未来形）。最終更新 2026-06-25 で、wiki 32ページ中もっとも古い。
  実装済みの現状仕様として書き直すか、設計ドラフトとして明示するか

## score データモデル

**2026-09-02 に実装から回答できたもの**（下記は Open Question から外した）:

- **`matches.status` / `processing_status` の値と遷移**（`src/types/database.ts`・書き込み箇所を実測）
  - `matches.status`: 型は `draft | in_progress | completed | archived` の4値。実際に書かれるのは
    `draft`（作成時の一部）→ `in_progress`（試合作成・ゲーム追加時）→ `completed`（入力完了時）で、
    **`archived` は読み書きとも0箇所＝死んだ値**。
  - `processing_status`（動画レビューセッション）: 型は5値。実際は
    `draft`（セッション作成）→ `reviewing`（セグメント登録・レビュー中）→ `committed`（確定時、
    `lib/videoReview.ts`）の3値のみで、**`ready` / `processing` は未使用**。
- **`points.result_type` の enum**: winner 7値（`smash_winner` / `volley_winner` / `passing_winner` /
  `drop_winner` / `net_in_winner` / `service_ace` / `winner`）＋ error 7値（`net` / `out` /
  `smash_error` / `volley_error` / `double_fault` / `receive_error` / `follow_error`）＋
  旧データ用の `forced_error` / `unforced_error`。
- **`edit_token` / `edit_token_hash` の撤去**: アプリ側（`src/**` / `lib/**` / `src/types/database.ts`）
  からは**既に消えている**。残るのは `scripts/generate-beta-matches-json.mjs` の
  `INTERNAL_FIELD_NAMES`（公開 JSON から落とす防御用の名前リスト）と、Supabase 側の実カラムだけ。

残る Open Question:

- score 機能の正式な source of truth は Supabase か、それとも生成済み JSON か
- 上記の**死んだ値（`archived` / `ready` / `processing`）を型から落とすか**、将来使う予定として残すか
- `result_type` の集合が**3箇所に重複定義**されている（`lib/matchLogic.ts`・
  `lib/matchAnalysis/helpers.ts`・`src/pages/beta/matches-results/[matchId]/index.tsx`）。
  `forced_error` / `unforced_error` を含むかが箇所ごとに違うので、一本化するか
- Supabase の `edit_token` 列そのものをいつ落とすか（落とすなら `docs/sql/` に DDL と
  [APPLIED.md](../sql/APPLIED.md) の行が要る）

## 公開/編集権限

方針（2026-06、ADR-003）: UGC 公開を前提に、`edit_token` トークン方式は廃止し、
認証ユーザー所有モデル（`Match.owner_user_id`）と `visibility`（public / private 既定 /
限定公開）に寄せる。静的 JSON 生成は public のみを対象にする。

残る Open Question:

- `visibility` の正式 enum と既定値（private 既定で確定だが限定公開の表現方法）
- 認証方式（プロバイダ・セッション・Supabase Auth を使うか）
- UGC のモデレーションと公開審査の運用
- `score` mode 以外の本番環境で API 書き込みをどのように制御しているか

## 成長分析の公開境界 / 同意

方針（2026-06、ADR-004 Draft）: 成長分析は**グループ内限定公開（L1: パスワード/限定リンクを知る人のみ）**を
当面の主運用とする。実名で個人をサイト全体に公開・ランキング掲載する「全体公開」（L2/L3）は提供せず、
UGC 統合とあわせて保留し、コンテンツ拡大とユーザー反響を見てから再検討する。
グループ内展開（学生含む）では本人・保護者の個別同意は基本不要。詳細は
[ADR-004](../adr/ADR-004-growth-analysis-visibility-consent.md)。

決定で解消:

- 同意主体（グループか本人か）／未成年の保護者同意 → 全体公開しないため当面発生しない。
- コンテンツ化の経路（旧 A3）→ 一般公開コンテンツはグループ内限定機能と切り離し、サイト責任者が
  既に公開されている情報をもとに作成・公開する（運営の既存の公開運用と同じ範囲、個人の追加同意は不要）。
- 名前付き成長の公開先 → 1〜2 選手に絞った運営キュレーションの**ショーケース公開**（visibility `public` を
  allowlist にだけ付与）。公開先はトップレベルの `/growth`（ハブ）＋ `/growth/[slug]`（インデックス対象）。
  将来 score への集客導線にする。選手ページ統合・results 作り込みは行わない。
- スタンドアロンの `/beta/matches-results/growth` は「グループ＝公開済みの試合」とみなし、A1 を待たず
  公開試合の参加者（`targets.json`）を対象ドロップダウンに表示する内部ツール面（`noindex`）。
  旧「A1 整備まで一覧非表示」は撤回（2026-06）。
- 実装状況 → Decision 5 の土台（`GrowthTarget.visibility`・撤回リスト・noindex）と
  ショーケース基盤（`data/growth-featured.json`・`featuredKeys`・`/growth` ハブ＋ `/growth/[slug]`・
  `lib/growthShowcase.ts`・共有表示コンポーネント・results 相互リンク・シングルス/ダブルスのタブ集約・
  もとにした試合の表示）は実装済み。score CTA 配線・集客導線は次フェーズ。
  詳細は ADR-004 の Implementation Status。

後回し（運用開始後に詰める。詳細は ADR-004 の A1/A2）:

- A1: 「公開済みの試合」より狭く、特定グループだけに限定したい場合のアクセス制御方式（ゲート/認証/パスワード等）。
  現状の `/beta/matches-results/growth` は公開試合の参加者を表示する内部ツール（noindex）で足りており、A1 は
  さらに絞り込みが必要になった段階で検討する。
- A2: 撤回（オプトアウト）の反映タイミングと緊急削除（該当 JSON 即時削除／CDN パージ）経路。

保留（再検討トリガー＝コンテンツ拡大・ユーザー反響。詳細は ADR-004 の P1/P2）:

- P1: 実名の全体公開（L2/L3）を採用する場合の同意・実名/匿名・未成年・引き上げ導線の設計。
- P2: score mode を UGC 本拠地へ転換する際の `growth_consent`（氏名ベース）と認証アカウント同意の統合・移行。

## score機能の一般公開・新機能ピボット（検討中 2026-07-11）

詳細は [score-general-availability.md](./score-general-availability.md)。

- 差別化の核（動画事後記録／大会DB接続／重要局面分析）のどれを一番の訴求にするか
- ターゲット（個人選手 or チーム/クラブ単位）のどちらから攻めるか
- 「顧問や選手がこの手の分析を欲しがるか」の聞き取り検証
- パイロット相関分析（16試合・717ポイント）の母数拡大後の再検証
  （特にブレークポイント非対称性・ラリー長効果・1stサーブフォルトの無影響という結果の再現性）

## YouTube / 動画レビュー

- YouTube 連携の保存方式と正式運用ルールは何か
- `match_video_sessions` / `match_point_candidates` の本番利用状況はどうなっているか
- 動画レビュー候補を誰がどの手順で確定するか

## 予選リーグ→決勝Tのデータ表現（積み残し）

本体（`bracket-slot-parity` の誤検知）は 2026-08-22 に `knockoutDraw` の導入で解決済み。
経緯は末尾の[解決済み（記録）](#解決済み記録)。以下はそこから残った未解決事項。


- **2段リーグ形式（予選リーグ→準決勝リーグ→優勝決定戦）の2段目の順位が記録されない。**
  `results[].roundrobin` は組を1つしか持てないため、`zennihon-university-ouza/2026/team-none-boys`
  では準決勝リーグの順位が残らず、「ベスト4」「ベスト8」の根拠が `matches` にしか無い。
  `roundrobin` を段ごとの配列にするかは、この形式が現状1大会だけなので保留。
- 開催前・進行中の大会で未確定席をどう見せるか（「A組1位」と書くか空欄のままか）。
  データ上は開催前でも表を組めるようになったが、表示は未設計で現状は空席として描かれる。
- 予選リーグ大会に残っている `entries[].type` を消すか。**2026-09-02 に再実測して2点訂正**:
  - 件数は「90ファイル中26」ではなく、**予選リーグ／`knockoutDraw` を持つ112ファイルの全件**に
    残っている。投入ツール（`tools/tournament3` の `buildEntriesMeta`）が書き続けているため、
    放置すると増える一方（値の内訳は `packing` 18,018 / `extra` 10,634 / `seed` 5,890 / null 4,963）。
  - **「表示・検証はもう読まない」は誤り**。`lib/bracketLayout.ts` は
    ノックアウトのみの大会で今も `entries[].type` から席順を組む（`seed` / `extra` / `packing`）。
    予選リーグ大会では `knockoutDraw` の経路が先に効くので実害は出ていないが、
    同ファイルには「全件 `packing` かつ出場数が2冪だとパリティ検査をすり抜けて誤復元する」という
    実例（`zennihon-senior/2025/doubles-over80-girls`）への防御コードが入っており、
    **予選リーグ側の `type` を消せばこの防御そのものが不要になる**。

## 分析ロジック

- 分析指標の採用基準は何か
- 研究や現場知見に基づく裏付けをどこまで持たせるか
- 成長分析 JSON の更新タイミングと運用担当は誰か

## データ生成運用

- tournament details 生成の正式手順はどれか
- players 生成の最終入力源はどれか
- 手動補正のルールや履歴をどこに残すか

## 地域大会ページ

- `data/tournaments/local_index.json` の `officialUrl` を今後 UI で使うか
- `/tournaments/local/[federationId]` の大会カード並び順を明示ソートするか
- `areaId: "city"` の大会を都道府県ページから分離する予定があるか
- `detected-documents.json` で `accepted` にした候補を、どの手順で `information/*.json` に反映するか
- 巡回候補から既存 `local_index.json` の大会をどこまで半自動で推定するか

## STリーグ

- STリーグⅢ は大会データの収集が難しいため、階層構成（Ⅰ・Ⅱ・Ⅲ）の中での位置付けを紹介する扱いとし、対戦データは持たない方針。
  「準備中」の TODO ではないため、データ収集対象には含めない（`hasMatchData: false`）。
- STリーグⅡ（女子）は2025（第3回）は入力済み（`hasMatchData: true`、予選リーグの星取り・最終順位を掲載）。
  順位決定戦の個別対戦・選手別データのみ未入力（女子は公式PDFに選手名簿が無いため）。
  他年度（2023・2024）の女子Ⅱ部や2026以降は別途入力が必要（2023・2024の男女本戦データ自体は
  `participants.json` / `matches.json` とも既存）。詳細は `st-league.md` の
  「Open Questions / 未入力データ」節を参照（2026-06-25時点の本ページ記述はここで陳腐化していたため2026-08-01に修正）。
- **STリーグの結果を `data/tournaments/details/` にも入れるか**（2026-08-12 保留）: 一覧掲載は
  `information[].resultPath` での内部リンクで済ませ、結果本体は `/st-league/` に委譲した
  （`st-league.md`「大会一覧との連携」）。details へ複製すると Player Statistics Engine に乗り
  選手ページにSTリーグ戦績を出せるが、tie の内訳が落ちる・カニバる・順位が二重管理になる。
  選手DB連携が主目的になった時点で再判断する。
- `data/st-league/editions.json` の `promotionRelegation`（年度間の昇格・降格）は一部 Assumption。
  公式記録での裏取りが必要。NTT西日本の連覇数など個別記録の裏取りも同様。
- 詳細は `docs/wiki/st-league.md` を参照。

## 選手データベース拡張（計画・未実装 2026-07-01）

設計ドラフト: 機能仕様 [docs/raw/2026-07-01-player-page-comprehensive-design.md](../raw/2026-07-01-player-page-comprehensive-design.md)、
集計エンジン [docs/raw/2026-07-01-player-statistics-engine.md](../raw/2026-07-01-player-statistics-engine.md)。
wiki 反映は [players-pages.md](./players-pages.md)「選手データベース拡張」節。

決定で解消（2026-07-01）:

- 学年別成績 → 確実な生年・入学年データが無いため**除外（実装しない）**。
- 全国大会の定義 → `index.json` の大会のうち `generationId` が `international` / `international-qualifier` 以外。
- 年区切り → 年度（大会データ `year` が既に年度指定のためそのまま使用）。
- ランキングの掲載偏り補正 → その年度の上位 3 大会のみ合算＋ `scope-limited` 注記。tier・係数は `data/ranking-config.json` に外出し。
- 勝率・ゲーム率の算入（データ実体に基づき改訂 2026-07-01）→ 不戦勝と途中棄権はデータ上 `retired:true` で判別不能。方針=「実際に戦った試合だけで集計」。`retired:true` は勝率・ゲーム率から全除外、draw は分母除外。ただし順位・進出率・優勝判定など placement 側には反映する。
- ダブルス H2H の既定軸 → 対個人（相方問わず名寄せ）。ペア対ペアはオプション。
- 追加統計の閾値・分母 → 最高勝率=年度別（最小10試合）、苦手・得意選手=H2H 3対戦以上、決勝・準決勝進出率=ノックアウト個人戦を分母。
  閾値 `minMatchesForSeasonWinRate=10` / `minMeetingsForH2H=3` は `ranking-config.json` に外出し。

データ実体確認済み（2026-07-01）:

- 不戦勝 / bye は独立表現を持たず `retired:true` で登録され、途中棄権と判別不能（retired 451 件中 約84% が「勝者=規定ゲーム到達・敗者=0」の既定スコア）。ルールは上記に確定反映。

決定で解消（2026-07-11、ランキング較正ハーネスによる。詳細は
[docs/raw/2026-07-11-ranking-calibration-harness-plan.md](../raw/2026-07-11-ranking-calibration-harness-plan.md)）:

- tier の微調整 → バックテスト（27,199試合・予測的中率）で較正。**外国選手参加の国際大会
  （korea-cup・平和カップひろしま）はランキング集計から除外**（`excludeTournaments`）、
  **国際予選3つ＋ルーセント東京インドアは major、ヨネックス北海道は national に再分類**
  （`tierOverrides`。旧 resolveTier では国際系→local に落ちておりミスプライシングだった）。
  再生成後の前年度スナップショット的中率 67.6%→68.1%。
- 順位係数・topN → グリッドサーチで flat係数＋topN=2 が的中率+1pt と判明したが、実績表彰としての
  性格を変えるため**現行維持を決定**（予測は Elo 副指標に任せる役割分担）。
- Elo の K 値 → K/scale 比 0.16 が Brier 最良（kByTier {80,64,48} を config 反映済み。enabled は
  false のまま）。

決定で解消（2026-07-11、P3）:

- Elo副指標の有効化 → **生成のみ有効化**（`npm run ratings:generate` → `data/ratings/current.json`、
  内部利用）。レートは選手1人に1本（統合）、ダブルスはペア平均→両者同デルタ、provisional は
  K倍率でなく表示ゲート（10試合未満は無順位）として扱う。

残る Open Question（実装フェーズで詰める）:

- Eloレーティングの**公開面の設計**: 未成年の実名で「負けると下がる数字」を出すかの感度整理、
  出すなら established のみ・注記付き・下降表現を避けた見せ方。当面は内部利用に留める（2026-07-11決定）。
- `data/ratings/current.json` の更新運用（prebuild 組み込みは giant-killing 実装時に判断。
  それまでは details 追加時に手動で `ratings:generate` を再実行）。
- lucent-tokyo-indoor / yonex-hokkaido-international を index.json に掲載するか（tierOverrides は
  非掲載でも機能するが、大会ページとしての露出は別判断）。
- **同姓同名の人物別 id 分離 → 当面は「融合を許容」で決定（2026-07-02）**:
  `data/players/index.json` は「1 名前 = 1 数値 id」しか持たず、同姓同名の別人物を numeric id で分離できない
  （実測: index.json に nameKey 重複は 0 組。一方、同一カテゴリ内に同姓同名が別 participant.id で並ぶ実データが 30 件、
  `homonyms.json` に複数人物登録が 16 名）。numeric id を名前単位で解決するため、該当 id は複数実在人物の成績を融合しうる。
  - **決定**: 対象者が少なく実害が限定的なため、**当面は融合を許容する**（人物別 id の払い出しは行わない）。
    緩和策のみ実装して運用し、対象者が増えて実害が顕在化した段階で再検討する。
  - 実装済みの緩和（2026-07-02）: (1) H2H/ペアは `playerKey`（名前@所属）で分離（データ契約 §D）、
    (2) `lib/playerStats/facts.ts` で同一カテゴリ内 self-vs-self 試合をスキップ（自己対戦化・二重計上の除去）、
    (3) `homonyms.json` を読み `PlayerStatistics.identity.homonymRisk` を付与（UI 注記・記事で警告可能）。
  - 将来の解決策（採用保留）: participant.id が所属を含むことを利用し人物別に numeric id を払い出す
    （index.json 生成パイプラインの変更）。既存 id・ページ URL・リンクへの影響が大きいため、必要が生じるまで着手しない。

## 選手結果ページ「スコア詳細のある試合」の大会結果統合（2026-08-07 追加）

選手結果ページのセクション階層化（[players-pages.md](./players-pages.md)「結果ページの
セクション階層化」）で検討したが見送った案。「スコア詳細のある試合」（`scoreMatchLinks`）は
大会結果（試合結果一覧）の一部試合への逆引きリンクで、内容が重複している。大会結果側の
該当試合カードにバッジ的に統合できれば別枠の表示が不要になるが、`ScoreMatchLink.matchId`
に対応する結合キーが `PlayerMatch`（`src/components/PlayerResults.tsx`）に無く、
新規joinの実装が要る。効果とコストを見て着手判断する。

## 国際大会の選手同定（ローマ字表記）

詳細は [data-import.md](./data-import.md)「国際大会（ローマ字表記のみの参加者）の選手同定」。

- コリアカップ2026は日本選手63名中27名が `data/tournaments/participant-aliases.json` で解決済み（curated slugとの完全一致で確度100%が取れた分のみ、2026-07-20時点）。残り36名は連盟発表等で漢字が判明次第、追記する
- 対応表はこの1大会・1年度に限定していない（`tournaments[].years[]` 構造）ため、今後の国際大会（アジア選手権、ワールドカップ予選等）でも同じ仕組みを使い回せる。次の国際大会でも「代表発表(ローマ字)に対して、既存curatedプロフィールとの機械的完全一致でどこまで拾えるか」をまず確認し、残りは手動追記する運用を継続する
- 対応表の更新はincremental差分検知の対象（`participant-aliases.json` は `computeGlobalHash`、`lib/playerStats/manifest.ts` のグローバル入力ハッシュ対象に含まれている）。追記すればハッシュが変わり prebuild が自動でフル再計算をトリガーするため、手動で `--full` を付ける必要はない（旧・対象外という記述は誤りだったため訂正。2026-07-20）
- パートナー（対戦相手だけでなく、自分と組んだ相方）の紐付けもこの対応表で解決される。`personRefFromParticipant`（`lib/playerStats/facts.ts`）は対戦相手・パートナーを区別せず同じロジックで解決するため、対応表に載っている相手であれば byPartner 集計（`lib/playerStats/aggregators/byPartner.ts`）や選手結果ページの「サマリー」→「パートナー別」でも自動的に本人の数値idへ紐付く。追加の実装は不要で、`aliases[]` にエントリを追記するだけで反映される

## 高校カテゴリ

- 高校カテゴリの学校名表記揺れは、`data/tournaments/index.json` に載る大会を横断して、同年度・同姓同名選手が別学校名で出た場合に同一校として寄せる暫定ルールを採用している
- 上記ルールは誤結合を許容した暫定運用であり、別校を同一校として結合するリスクがある
- `scripts/highschool/03list/inferred-team-aliases.json` の確認頻度と、手動補正ルールの置き場所をどうするか
- **`normalize-team-names.mjs` の既定スコープが `highschool-japan-cup` のままである点**（2026-09-02 確認）。
  未適用の揺れは現在0件だが、それは誰かが `--scope=all` を明示して流した結果で、
  既定で流すと HJC しか直らない。既定を `all` にするか、`prebuild` に組み込むか。
  なお `normalize-team-spacing.mjs`（全角半角の正準化）は既に `prebuild` の先頭に入っている。
  → 対応表の仕組み・登録済みエイリアス・過去の修正履歴は [data-import.md](./data-import.md) が正。

## 大会 information の `location` 検算（2026-08-28 追加）

全中2026の `location` が前年の値（`熊本県`）の複製で誤っていた件
（[raw/2026-08-28-zenchu-2026-location-fix.md](../raw/2026-08-28-zenchu-2026-location-fix.md)）の残タスク。

- **2023年以前の `location` は未検算**（Assumption）。機械照合に使った
  `data/local-sources/jsta-yearly-events/` は2024年度以降しか存在しないため、
  遡るには大会ごとの要項/公式サイトを個別に当たることになる。
  優先度は低い判断: 2023年以前で「連続する年に同じ `location`」が出るのは
  高校選抜2020-2023（愛知県）・STリーグ2023-2024（愛知県）等で、いずれも
  固定会場の大会として説明がつく。ただし**一次情報での確認はしていない**。
- 検算を `scripts/` に常設するか。今回は使い捨てスクリプトで回した。
  `check:upcoming` と同じく「終了コード0の運用タスク一覧」として足す余地はある。
- `surface` の実在値と [data-model.md](./data-model.md) の語彙が食い違う。
  **実測（2026-09-02）**: `砂入り人工芝` 21件 / `人工クレー` 6件 / `クレー` 1件の**3種類だけ**で、
  語彙にある `ハード` と `木床フローリング` は**実データに1件も無い**。
  `人工クレー` を `クレー` へ寄せるか語彙に足すか、`ハード` / `木床フローリング` を語彙に残すかを決める
  （再実測: `grep -rho '"surface": "[^"]*"' data/tournaments/information/ | sort | uniq -c`）

## `verify-facts-golden.ts` の golden 値が陳腐化している（2026-08-28 記録）

`npm run playerstats:verify` の1つめ `scripts/playerStats/verify-facts-golden.ts` が
**14人で DIFF** になる。いずれも facts のほうが golden より試合数が多い方向。

**母数（2026-09-02 再訂正）**: DIFF の母数が **22** である点は正しいが、理由の説明が誤っていた。
`lib/playerStats/fixtures.ts` の `CURATED_FIXTURES` は **22エントリ（id 1..22）で全件 `slug` を持つ**。
slug を持たない4件（id 35 / 122 / 125 / 69）は別の定数 `HIGH_VOLUME_FIXTURES` の側にあり、
`verify-facts-golden.ts` はこれを読まない。したがってループ冒頭の `if (!fx.slug) continue;` は
**一度も発火しない**。「26エントリのうち4件が飛ばされて22になる」という説明は誤り。

**golden 値はハードコードされていない（2026-08-28 訂正）**。旧記述は「同スクリプトにハードコード、
最終更新2026-07-02」としていたが誤り。`verify-facts-golden.ts:55-62` は
`data/players/{slug}/analysis.json` を読み、その中身をそのまま golden として比較している。
ハードコードされているのは `CURATED_FIXTURES` の id / slug / name だけで、数値は
`data/players` のコミット内容に追随する。2026-07-02 に固まったのは**数値ではなく fixture 一覧**。

この違いは対処法を変える。DIFF の正体は「再計算した facts vs **コミット済みの analysis.json**」であり、
**本番ビルドが書き換えるファイルそのもの**なので、**再生成された analysis.json をコミットすれば
verify は副作用として green になる**。2026-08-28 の実測では、ビルドが書き換えた analysis.json は
14件で、**全件が `CURATED_FIXTURES` の中**（外は0件）だった＝DIFF 集合と同一。

エンジンの不具合ではないことは `verify-golden-final.ts`
（facts キャッシュ vs ソースからの再計算、76人で ok=76）が別途担保している。

- `playerstats:verify` は **prebuild に入っていない**のでビルドは落ちない。
  落ちるのは手で verify を回したときだけ
- 2026-07-19 の時点では2人（funemizu-hayato / kurosaka-takuya）だった
  （[raw/2026-07-19-cloudflare-build-time.md](../raw/2026-07-19-cloudflare-build-time.md) 追記2）。
  データが増えるたびに広がるので、放置すると verify が常に赤い状態になり
  「本物の退行に気付けない」検査になる

- ~~**カバレッジの穴**: `tsukamoto-hikaru` だけ検証対象外~~
  → **解決（2026-09-02）**。`lib/playerStats/fixtures.ts` の `CURATED_FIXTURES` に
  `tsukamoto-hikaru`（塚本光琉・id 159）を追加し、**23件 = `analysis.json` 23人で一致**。
  同じ足し忘れが再発しないよう、配列の JSDoc に「`analysis.json` を増やしたらここにも足す」
  という注意書きと件数の確認方法を入れた。

やること: 再生成された `analysis.json` をコミットして golden を現在値に合わせるか、
`analysis.json` を golden に使うのをやめて「前回値との差分がしきい値を超えたら落とす」形に
変えるかを決める。**前者は「値を貼り直す」作業ではなく、生成物をコミットするだけ**である点に注意。

**現状（2026-09-02）**: 前者は事実上の運用になっている。2026-08-28 に
`768918cc 選手の analysis.json を現在のデータで再生成する` でリセットされて以降、
データ取り込みのたびに再生成された `analysis.json` が同じコミットに乗っている
（8/28以降で10コミット）。つまり「DIFF が溜まり続ける」状態ではない。
**残る判断は「この運用を明文化して終わりにするか、差分しきい値方式へ作り替えるか」**の1点。

再発見の経緯: [raw/2026-08-28-build-time-nft-glob.md](../raw/2026-08-28-build-time-nft-glob.md) 追記2

---

## 解決済み（記録）

解決した問いは本文から外し、結論と参照先だけをここに残す（2026-09-02 新設）。
「なぜそう決めたか」の詳細は各リンク先が正。

### 「全国大会」判定の二重基準（2026-07-20 追加 → 同日解決）

選手ページの「全国」判定は `lib/nationalTitles.ts` のホワイトリスト（22大会）に統一
（`ENGINE_VERSION` 1.4.0）。バッジ・SEO 文言・キャリア年表の「全国初出場/初優勝」がすべて同じ基準を使う。
東日本・西日本選手権（地域大会）が「全国初優勝」として年表に出る問題は解消。
**残る二重性は意図的**: ランキングの tier 判定は引き続き広義 `isNational`
（`generationId` が `international` / `international-qualifier` 以外）を使う。用途が
「表示上の事実表明」ではなく「大会格の重み付け」のため。
→ [players-pages.md](./players-pages.md)「全国大会優勝の実績表示」

### ブラケット復元と決勝Tの席順（2026-08-22 解決）

真因は「決勝Tの席をエントリー単位（`entries[].type`）で持っていたこと」で、席を**予選リーグの組**に
持たせる `knockoutDraw` を導入して解決。復元適用 285 → 372 大会・突合 26,527 → 27,633 試合で不一致0件。
入力ツール（`tools/index.html`）も保存時に `knockoutDraw` を出力する。
→ [ADR-015](../adr/ADR-015-knockout-draw-by-group.md) /
[調査メモ](../raw/2026-08-22-bracket-slot-parity-roundrobin-false-positive.md)。
積み残しは本文「予選リーグ→決勝Tのデータ表現（積み残し）」。

### アジア競技大会日本代表予選会2025 女子準決勝リーグ グループAの順位（2026-08-26 記録 → 同日解決）

正しい順位は **宮前1位 / 長谷川2位 / 左近3位 / 浪岡4位**（ユーザーより提供）。ゲーム差でも三すくみになり、
内部で得失点差による順位決定が行われた。`roundrobin.rank` を修正し（浪岡 2→4 / 長谷川 4→2）、
両グループとも上位2名が進出する形に整合。`npm run bracket:verify` は376大会・28,385試合が一致／不一致0件。
→ 経緯は [raw/2026-07-26-idea-tournament-metadata-platform.md](../raw/2026-07-26-idea-tournament-metadata-platform.md) 追記10

### STリーグ チームページのメンバー欠落（2026-08-11 緩和）

`participants.json` のロースター収録が年度・男女で偏るため22チームでメンバー表示が皆無だった件は、
大会成績側の選手を年度×性別で統合する実装により16チームで解消。残る6チームは大会データが無いか、
団体戦のチーム単位エントリーしか無く選手を拾えない（元データのロースター入力が進めば埋まる）。
→ [st-league.md](./st-league.md)「『メンバー』クエリの受け皿」

### 高校カテゴリのチーム名対応表を全大会へ広げるか（2026-07-17 → 2026-09-02 解決）

`--scope=all --dry-run` で648箇所あった未適用揺れは **0箇所**。全スコープ適用が進み、
`normalize-team-spacing.mjs` が `prebuild` の先頭ゲートに入ったため、新規取り込みの揺れも次のビルドで潰れる。

### highschool パイプラインの鮮度チェックの守備範囲（2026-09-02 解決）

`prebuild` のゲート `check-highschool-pipeline-freshness.mjs` のハッシュ対象が
`details/highschool*/` だけで、生成側の `02result/extract.py` が読む22大会のうち
**19大会がハッシュ対象外**だった（件数の主力は `zennihon-university` 4,308 /
`zennihon-workers` 3,642 / `zennihon-singles` 2,813 件）。全日本選手権や社会人を取り込んでも
チェックは緑のまま生成物が古くなる状態。

**対応**: 入力範囲の定義を `scripts/highschool/lib/pipeline-sources.json` に切り出し、
`extract.py`（除外リスト）と `lib/source-hash.mjs`（ハッシュ対象）が**同じファイルを読む**ようにした。
片方だけ育って気付けない、という再発の型を潰すのが狙い。
ハッシュ対象は **13大会・122ファイル → 32大会・292ファイル**（01team が読む `highschool*` と
02result が読む22大会の和集合）。

**副産物**: 広げた直後にチェックが落ちたのでパイプラインを再実行したところ、
`scripts/highschool/**` の中間生成物（`01team/teams.json` / `02result/results.json` /
`03list/prefecture-summary.json`）が**1コミットぶん古いまま残っていた**ことが分かった。
直前のコミットが `data/highschool/*`（サイトが読む側）だけを commit していたため。
再生成した中間生成物は `data/highschool/*` と完全一致したので、**公開データに誤りは無い**。

### `lib/matchAnalysis/` と `lib/growthAnalysis/` の責務境界（2026-08-12 解決）

「1試合の中 / 複数試合をまたぐ」で分割。→ [score-analysis.md](./score-analysis.md)「責務境界」
