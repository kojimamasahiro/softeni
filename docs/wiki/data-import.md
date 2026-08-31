# Data Import

## 概要

このリポジトリでは、大会データ、選手データ、score 公開 JSON をローカルスクリプトで生成する運用が確認できます。

## package.json から確認できる主要コマンド

- `npm run prebuild`
  - `node scripts/generate-players-json.mjs`
  - `node scripts/generate-player-analysis.mjs`
  - `node scripts/generate-beta-matches-json.mjs`
- `npm run check:growth`
  - `node scripts/check-growth-analysis.mjs`

## score 公開データ生成

### `scripts/generate-beta-matches-json.mjs`

役割:

- Supabase から `matches`, `games`, `points` を取得
- `public/data/beta-matches/**` を生成
- `buildGrowthReports` を使って成長分析レポートも出力
- 公開不要な内部フィールドを除外

確認できる仕様:

- 全件を対象（取得上限なし。`matches` を `created_at` 降順で全件取得）
- 環境変数が無い場合は既存スナップショット再利用
- `meta.json` / `index.json` / `matches/*.json` / `growth/**` を更新
- 出力は追記型（既存ファイルを更新し、出力ディレクトリの全削除はしない）

### Deprecated: 50 件上限と公開 URL の消失リスク（解消済み）

旧仕様では最新 50 件のみを対象（`LATEST_BETA_MATCH_LIMIT = 50`）とし、出力ディレクトリを毎回削除して
再生成（`ensureCleanDir`）していたため、上限から漏れた古い試合は JSON ごと消え、詳細ページが
404 になるリスクがあった。

現在は **上限撤廃（全件取得）＋追記型生成** に変更済みで、このリスクは構造的に解消されている
（経緯は docs/wiki/score-site-link.md）。コード上も `LATEST_BETA_MATCH_LIMIT` / `ensureCleanDir` は存在しない。

## 大会・選手データ生成

確認できた主要スクリプト:

- `scripts/generate-players-json.mjs`
- `scripts/generate-player-analysis.mjs`
- `scripts/extract-players.mjs`
- `scripts/generate-players-index-from-info.mjs`
- `scripts/generate_players_from_tournaments.mjs`
- `scripts/crawl-local-tournaments.mjs`
- `scripts/generate_entries.py`
- `scripts/generate_roundrobin.py`
- `scripts/matches/convert.py`
- `scripts/matches/roundrobin/convert.py`

Deprecated:

- `scripts/generate_analysis.py`
  現行運用では `scripts/generate-player-analysis.mjs` を使う
- `scripts/toPlayer/convert.py`
  廃止済みの `data/players/*/results.json` を手動追記する旧運用スクリプト

関連データ:

- `data/tournaments/**`
- `data/players/**`
- `scripts/matches/input.json`
- `scripts/matches/roundrobin/input.json`

### PDFトーナメント表からの選手抽出

- `scripts/pdf/master.py`
  大会結果のトーナメント表PDFから、文字の座標(X/Y)を指定して選手・チーム情報を抽出する。
  レイアウト種別(団体/シングルス/ダブルス/全中 等)ごとに抽出戦略と多数のX座標定数を手動調整する運用。
- `scripts/pdf/calibrate.py`
  master.py のX座標調整を補助する非破壊のキャリブレーションツール。
  PDFを解析して左右分割・Y_CROP・列境界・`( )`区切りを自動検出し、
  X軸ルーラー付きの注釈デバッグ画像(`output/calibrate_pageN.png`)と
  master.py へ貼り付け可能な定数候補を出力する。
  `python3 scripts/pdf/calibrate.py <pdf> [--page N] [--gap 6]`
  ※ 各列が姓/名/チーム/エリアのどれに当たるか(意味づけ)と抽出戦略の選択は
  レイアウト依存のため、出力値は確認のうえ手動で転記する。
- `scripts/pdf-to-players/extract_tournament.py`
  **組み合わせ（ドロー）表PDF → `initialPlayers` 形式JSON**。`scripts/pdf/master.py` が
  大会ごとに座標定数をソースへ書く運用なのに対し、こちらは座標を持たず**行ごとの投票**で
  列を検出する。既知の大会は `profiles.py` の署名（PDF本文の大会名）で自動選択される
  （全中 / インカレ）。手順は `scripts/pdf-to-players/RUNBOOK.md`、仕組みは同 `README.md`。
  - **1ページ目だけ出して人が確認 → 承認後に全ページ** の順を守る。元PDFに誤植・列ズレが
    あり得るため、一気に全変換しない。
  - 姓名が1つの枠に均等割り付けで入る様式（インカレ）でも姓名を分割できる
    （`namesplit.py`）。**均等割り付けは氏名全体ではなく姓と名それぞれに掛かっている**ので、
    境目の字間だけが 2.5pt ほど広い。2026年インカレ男子ダブルス1170名では94%がこの字間で
    決まり、既存選手データと照合できた796名のうち793名（99.6%）が一致した
    （不一致3件はいずれも既存データ側の誤り）。
  - **同じ大会でも字間が効くPDFと効かないPDFがある。効くかどうかはPDFの作られ方次第で、
    性別や種目では決まらない。** 2026年インカレでは、ダブルスは男子94%・女子42/664名
    （女子は氏名全体を等間隔に置く）だったが、シングルスは男子88/92・**女子84/84**だった。
    ただし誤検出は無く（信号のあった行は既存データと100%一致）、決まらない分は下の段に落ちる。
    種目ごとに内訳を確認すること。
  - 字間で決まらない行は、`data/` 配下の既存 `lastName`/`firstName`（約23,800組）を
    **(氏名, 所属) で引く → 氏名だけで引く → 姓と名の辞書**、の順に落とす。所属まで見るのは、
    同姓同名の別人を避けられるうえ、**既存の `playerId` と結びつけるには
    その所属で使われている綴りに揃っているほうが正しい**ため。
  - 姓名の割り方は `data/players/name-split-aliases.json` が正準（`check-name-splits.mjs` /
    `normalize-name-splits.mjs`）。PDFから作った JSON もこれに揃えること。
  - **辞書を作るときは `count: 0` の行を除く。** `data/players/index.json` には正準化で
    使われなくなった綴りが `count: 0` で残るので、混ぜると誤りを正例として学習する。
  - **PDFの座標は、正準化の検出器が届かない誤りに届く。** 検出器は data/ 内に別解が
    存在してはじめて気づけるので、誤った綴りが1通りしか無い氏名は検出されない
    （`榎祐|希人` が実例）。ドロー表の字間という外部の根拠があると、この型も拾える。
    見つけたら alias 表に登録して `normalize-name-splits.mjs` を流す。
  - **そこでも決まらなければ推測せず未分割**にし、`firstName` を空のまま
    `review_name_split` に出して人に回す。
  - 表の本体は**エントリー番号の並びの範囲**で判定する。番号の列に「番号として読める値」が
    入っている行だけを数えること。見出しの大会名はページを横断して番号の列にも掛かるので、
    非空かどうかで数えると**見出しがエントリーとして紛れ込む**（大学対抗選手権の団体戦で
    `部科学大臣杯全日` がチーム名として2件入っていた）。
  - **同じ週に開かれる大会でもプロファイルは分ける**。インカレの個人戦は
    「三笠宮賜杯全日本学生選手権」、団体戦は「文部科学大臣杯全日本大学対抗選手権」で
    別大会・別様式。署名を共用させると片方の設定がもう片方を壊す。
  - **シングルスは自動判定しない**（`--category singles` かプロファイルで明示する）。
    ドロー表の見た目はダブルスと同じで、違いは「1つの番号に何名ぶら下がるか」だけ。
    行のまとまり方が崩れているときも同じ形に見えるので、機械に見分けさせると
    崩れをシングルスと誤認する。
  - **プロファイルの署名は「その大会だけに出る語」にする**。`detect()` は先に一致した
    ものを返すので、包含関係のある署名（`全日本学生` は `全日本学生シングルス選手権` にも
    当たる）を並べると順序に依存して壊れる。
  - **大会中の選手交代は `--substitutions` で上乗せする**。ドロー表PDFは開幕前に配られ、
    開幕後の差し替えでは出し直されない。出来上がったJSONを直接書き換えると
    **PDFから作り直した瞬間に交代が消え**、誰がいつ誰に代わったのかも残らない。
    交代を別ファイル（`tools/<大会>/substitutions.json` 等）に書いて抽出のたびに当てれば、
    PDFが一次情報のまま残り、履歴が git の差分として読める。書式は
    `scripts/pdf-to-players/substitutions.py` の docstring を見ること。
  - `python3 scripts/pdf-to-players/extract_tournament.py <pdf> --pages 1 --out /tmp/page1.json`

- `scripts/pdf/university_indoor.py`
  全日本学生選抜インドア選手権大会（内閣総理大臣杯, JSSTA）の公式結果PDFから
  `data/tournaments/details/zennihon-university-indoor/<year>/{doubles-none-boys,doubles-none-girls}.json`
  を生成する専用パーサ。第59回(2025)のレイアウトを前提とする。
  - 構成: p1-4 ブロック成績(予選リーグ星取表), p5-6 エントリー一覧+ブロック編成, p8 入賞(優勝/準優勝/3位)
  - 予選リーグはスコアまで星取表から復元する（丸数字=勝者ゲーム）。
  - 決勝トーナメントのゲームスコアはPDFに記載が無いため、勝敗のみ公式入賞から確定し
    `scores` は空にする（捏造しない）。準決勝の組合せは A-D / B-C 固定。
  - 康熙部首・異体字はNFKC + 変換表で常用字へ寄せて氏名/団体名を照合する。
  - 棄権等でスコアの無い対戦はスキップし、該当ペアの roundrobin.rank は null。
  - `python3 scripts/pdf/university_indoor.py <pdf> --year 2025 --out data/tournaments/details/zennihon-university-indoor`
- `scripts/pdf/highschool_championship_entries.py`
  インターハイ（`highschool-championship`）の公式記録報告書PDFから、**エントリー（選手・チーム情報）
  のみ**を抽出する専用パーサ。2019年度レイアウトで検証済み。
  - スコープを意図的にエントリーのみに限定している。理由: 個人戦の予選ラウンド（1回戦〜準々決勝前）は
    敗者側のゲーム数1桁のみが合流点付近に印字される形式で、勝者は表示されず、対戦カードの再掲も無い。
    赤色罫線（ブラケット線）のジオメトリを座標追跡しても、合流点では勝者側・敗者側どちらの入力線も
    同じ縦線に接続するため勝敗を機械的に確定できず、誤った勝敗を記録するリスクがある
    （インターハイ2026の欠落試合が誤った大会インサイト公開・取り下げに繋がった前例
    [2026-08-01-bug-bye-derived-matches-not-exported.md](../raw/2026-08-01-bug-bye-derived-matches-not-exported.md)
    を踏まえた判断）。個人戦・準々決勝以降と団体戦・全ラウンドはペア別ゲームスコア＋丸数字＝勝者の形式で
    完全にテキストから読み取れるため技術的には自動化可能だが、本スクリプトでは未実装（`matches`/`results`
    は空配列で出力）。予選ラウンドの結果を入れる場合は `tools/tournament3` に本スクリプトの抽出結果を
    `initialPlayers` として渡し、PDFを見ながら人手でスコア入力する運用を想定する。
  - **姓名分割は座標ベース**（`_split_name_by_x`、`DBL_LEFT`/`DBL_RIGHT`の`name_split_x`）。
    姓名列は文字数に応じて均等割り付け（字間が伸縮）されるため、氏名は1つのX範囲でまとめて
    取得しつつ文字ごとのX座標を保持し、しきい値（本PDFでは左側ブロック=約100pt、右側ブロック=
    約405pt）未満を姓・以上を名として機械的に分割する。姓の文字数（1〜3文字）に関わらず
    有効なことを30件超の実データで検証済み。**「姓/名内部の字間」だけで境界を判定してはいけない**
    （2文字姓の内部字間が姓名境界の字間とほぼ同じ大きさになるケースがあり誤判定した実例:
    「奥西／巧」で奥→西=24.2pt・西→巧=37.6ptとなり、2文字姓「浪岡」の内部字間24.6ptと一致、
    西→巧の37.6ptが姓名境界（他の確定済み1文字姓と同じ間隔）と一致——つまり字間の大小だけでは
    「奥西」が1セットか「巧」の前で切るべきかを区別できない。固定座標のしきい値ならどちらの
    ケースも正しく分かれる）。旧実装は`姓2文字+名残り`の文字数ヒューリスティックだったが、
    2018/2019年の全件を座標分割で再検証したところ男女合計148件の誤分割が見つかり修正した
    （3文字姓「五十嵐」「長谷川」等が2文字目で誤って切られる、1文字姓「原」「谷」等が誤って
    2文字目まで含まれる、など）。2文字の氏名（姓名とも1文字）は座標でも区別できないため
    `_split_name`の文字数フォールバック（1+1分割、ユーザー確認済み）に委ねる。
    氏名列と都道府県/学校名列の境界もページ・行によって数pt前後するため、固定しきい値だけでなく
    「都道府県が47都道府県の正式表記と完全一致するか」を検証し、不一致なら氏名側から
    都道府県側へ1文字ずつ付け替える補正パス（`_fix_leaked_area`）を入れて解消している。
    エントリー番号行と氏名行の判定はX範囲でなく「行の文字が全部数字か」で行う。
  - 既知の制約: ページ最下部で特定の1文字がテキストレイヤーから丸ごと欠落するケースが稀にある
    （2019年男子individual: entryNo 209「會田」の會, 305「辻花」の辻。2018年男子: entryNo 274
    「前田」の前。手動で復元済み。座標分割はこの種の欠落を直せない——分割位置でなく文字の
    有無の問題のため）。新しい年度のPDFを処理した際は、既存の確定済みエントリーと再抽出結果を
    突き合わせ、**姓名を連結した文字列が完全一致する差分だけを機械的に採用し、文字列自体が
    異なる差分（＝欠落文字の手修正が入っている可能性）は上書きしない**運用を徹底する。
  - `python3 scripts/pdf/highschool_championship_entries.py <pdf> --year 2019 --boys-doubles-pages 19-26 --girls-doubles-pages 56-63 --boys-team-page 29 --girls-team-page 66 --out data/tournaments/details/highschool-championship`
    （年度によりページ範囲は変わる。2018年は男女別々のPDFで、男子は `--boys-doubles-pages 1-8
    --boys-team-page 10`、女子は `--girls-doubles-pages 1-8 --girls-team-page 10` を別々に実行し
    同じ `--year 2018` の出力先へ書き込む。個人戦/団体戦のいずれかの引数を省略できる）
  - 実行後は `node scripts/normalize-prefectures.mjs --scope=highschool-championship` で
    団体戦の都道府県接尾辞（`奈良`→`奈良県`等）を補完すること（団体戦概況ページは都道府県が
    省略形でしか印字されないため）。
  - 詳細な調査過程は [2026-08-20-interhigh-2019-pdf-entries-import.md](../raw/2026-08-20-interhigh-2019-pdf-entries-import.md)。
- `scripts/pdf/zennihon_championship_entries.py`
  天皇賜杯・皇后賜杯 全日本選手権（`zennihon-championship`）のドロー表PDFからエントリーを抽出する。
  2019年度（第74回, `2019_A08_40.pdf`、テキストレイヤーあり）で検証済み。個人戦のみの大会。
  - ページ構成: p1-4=男子ドロー, **p5=男子の準々決勝〜決勝**, p6-9=女子ドロー, **p10=女子の同**。
    p5/p10 はエントリー表ではないが、氏名・県・所属が再掲されるので**抽出結果の独立した検算**に使う
    （2019年度は16エントリーが全項目一致）。
  - **一般カテゴリ特有の構造**: 都道府県・所属は「ペアで共通なら括弧行、選手ごとに違えば選手の行」に
    印字され、両方違うと括弧の中身が空になる。**その選手の行にあればそれ、無ければ括弧行**で解く。
    学校単位の高校・中学の大会には無い構造なので、そちらのパーサは流用できない。
  - 姓名分割は**7スロット固定グリッド**（全角スペース詰め、スロット0-2=姓／3=区切り／4-6=名）。
    3まで埋まるのは4文字姓のときだけ。`highschool_championship_entries.py` のパターン2・3のような
    動的なしきい値計算は不要で、既知の等間隔グリッドにスロット番号を当てるだけで確定する。
  - **行の組み立ては文字の上端でなく上下中心で行う**。所属欄は列幅に収まらないとフォントが
    小さくなる（8.8pt→4.7pt）ため、上端で揃えると小さい字が別の行に流れる。
  - 所属名が2行に折り返される場合がある。**座標では折り返しと隣接エントリーを区別できない**
    （行送り比・アンカーからの距離・列幅の使い切りのどれも効かないことを実測で確認）ため、
    「1文字だけの所属名は無い」という意味的な条件で結合し、結合したものは必ず警告に出す。
    `teams.json` には1文字チームが15件あるので、この条件を他大会へ持ち込まないこと。
  - `python3 scripts/pdf/zennihon_championship_entries.py <pdf> --pages 1-4 --out tools/zennihon-championship-2019/doubles-none-boys.initialPlayers.json`
  - 実施記録: [2026-08-30-zennihon-championship-2019-pdf-entries-import.md](../raw/2026-08-30-zennihon-championship-2019-pdf-entries-import.md)
  - **同じ大会でも年度で組版が変わる。2018年度（第73回, `2018_A08_40b.pdf`）でも検証済み**
    （男子178ペア / 女子163ペア）。骨格（3行で1エントリー・括弧行が共通値）は同じだが:
    - **氏名フィールドのスロット数が違う**（2019年度=7、2018年度=5）。決め打ちせずページごとに
      実測する。**出現数の多い上位N本を採る、はダメ**——2019年度 p6 右ブロックの5番目のスロットだけ
      出現数が低く、頻度で切ると氏名欄が途中で打ち切られて名が所属列へ流れた。
      基準位置とピッチは高頻度2本から取り、あとは文字の有無で伸ばす。
    - **5スロットは中央が埋まると姓名の境界が座標で決まらない**（`小田島｜俊介` と
      `加藤｜健太郎` が同じ形。2018年度は714行中100行）。`data/tournaments/details/**` を
      語彙にして (1)姓名ペアの完全一致 (2)姓・名それぞれの既知度 の順で決め、
      決まらなければ姓2文字で仮置きして警告に出す。**`data/players/index.json` を語彙に
      そのまま使わないこと**——誤った分割が162件（`count: 0` の履歴レコード）混ざっており、
      `小茄子川｜夏月` が `小茄子｜川夏月` に退行する。除外には
      `data/players/name-split-aliases.json` の `aliases` を使う。
    - 最後まで決まらない行は `--name-split '姓名=姓|名'` で人が指定する。
      一度も一致しなかった指定は警告に出る。
    - **ページ下部の再掲ブロック**（2018年度は奇数ページの「準々決勝戦」）は本体と同じ列に
      番号つきで組まれる。見出しより下を**文字の段階で**捨てる。アンカー行だけ落とすと
      再掲の県・所属が直上のエントリーにくっつく。
    - **エントリー番号が括弧行に無いページがある**（2018年度 女子 p16/p17 の右ブロックは
      1人目の行）。番号はエントリー単位の値なので括弧行に無ければ選手の行から拾う。
    - 枠に入りきらない氏名はフォントを縮めて詰め込むため、文字がスロットの整数倍からずれる。
      氏名欄の中にある文字は捨てず両端のスロットへ寄せる（捨てると `ミヒニャック瑠偉` の
      `偉` が落ちる）。
    - 実施記録: [2026-09-01-zennihon-championship-2018-pdf-entries-import.md](../raw/2026-09-01-zennihon-championship-2018-pdf-entries-import.md)

- `scripts/pdf/zenshakai_entries.py`
  全日本社会人（`zennihon-workers`）の公式記録PDFから、エントリーのみを抽出する専用パーサ。
  2022・2023年度レイアウトで検証済み。方針は `highschool_championship_entries.py` と同じ
  （`matches`/`results` は空、勝敗はブラケット線の座標追跡では確定できないため未実装）。
  - **レイアウトがインターハイPDFと構造的に異なり、流用できない**: 都道府県と所属(team)が
    別々の列（インターハイは1つの括弧に「都道府県＋所属」がまとめて入る）。
  - **トーナメント表の列範囲はページ・ブロック（左の山/右の山）ごとに自動検出する**
    （`detect_bracket_cols`）。列のX座標は年度・男女・年代で違うだけでなく、同じレイアウトの
    中でもページごと・ブロックごとに動く（列幅がその中身に合わせて詰められるため）。
    基準は全行に必ず1つずつ出る「(都道府県 所属)」の括弧のX座標（1ブロック内では完全に
    一定なので最頻値で決まる）。括弧を原点にした相対オフセットのうちレイアウトで変わるのは
    氏名列の左端（実測 括弧-57〜-68）と所属列の左端（同 +38〜+41）だけで、列間の空き
    （14〜22pt）は氏名列の内部字間（6〜9pt）よりはっきり大きいため「最大の空き」で境界を取れる。
    - **オフセットの実測は左の山で行い、右の山へは同じ相対オフセットを流用する**。
      右の山は氏名列の左隣がブラケット線のスコア文字で、行ごとに有無が変わって空きが偶然
      小さくなる（実測で最大の空きが8.3ptしかないページがあった）。同一ページの左右は同じ
      テンプレートなので、相対オフセットは1.5pt以内で一致する。
    - 氏名列の左端だけマージンを大きめ（6pt）に取る。氏名セルは姓2+名2の4スロットだが、
      それより長い氏名はスロットの外へ左右対称にはみ出す（実測の最長は8文字で4.2pt）。
      上限は右の山でスコア文字に届かない範囲（実測で最も近いケースが9.4pt）。
    - `--bracket "cat=pages:layout"` の `:layout` プリセット（`general`/`female`/`age`/`2022`）は
      **自動検出が失敗したときのフォールバック**としてのみ残っている。新しい年度のPDFの
      ために実測して追加する必要はない。
  - **「欠番0」はブロックの取りこぼしを検出できない**。エントリー番号はブロック単位で連番
    （例: p14左=1-29, p14右=30-59, p15左=60-89, p15右=90-118）なので、最終ページの右の山が
    落ちると「連番の末尾がまるごと無い」形になり、欠番チェックを素通りする（2023年度の
    35歳男子89/118組・45歳男子70/93組が実際にこれで見逃されていた）。
    そのため`parse_bracket_pages`は**ブロックごとに「開き括弧の数＝エントリー数」と抽出件数を
    突き合わせる検算**を行い、不一致なら警告を出す。取り込み時はこの警告が出ないことを必ず確認し、
    加えて**PDF紙面の最終エントリー番号と件数が一致するか**を目視で確かめること。
    詳細は[2026-08-29-zennihon-workers-2023-missing-right-bracket-blocks.md](../raw/2026-08-29-zennihon-workers-2023-missing-right-bracket-blocks.md)。
  - ラウンドロビン表（本大会では35歳女子・45歳女子）はグループ数に応じて列幅がページごとに
    変わるため、固定座標でなく見出し行（氏名/支部/対戦成績列）のX座標から都度検出する
    （`detect_rr_cols`）。対戦成績列の先頭見出しは`"1"`とは限らない（グループがページを
    跨ぐと`"22"`のように途中の数字から始まる）ため、見出し行自身の数字文字のうちX座標最小の
    ものを使う。見出し行の判定はY座標を`top<120`のように緩く取ると、たまたま同じ高さに来た
    データ行のエントリー番号を誤って拾うため、見出し行そのもの（氏名ラベルと同じtop）に絞る。
  - 抽出のハマりどころ: 都道府県・所属(team)の文字が氏名の行より**前にも後ろにも**浮くことが
    ある（フォントのベースライン差の向きはページ・年度依存）。都道府県・所属の探索は「氏名列
    だけを別クラスタ化して求めた氏名行のY座標」を基準に前後どちらへもtoleranceを張って行い、
    かつ選手Aの帯で拾えなければ選手Bの帯の値を、その逆も補完する（片方向だけの補完だと、共通の
    都道府県・所属が選手Bの帯寄りに印字されたページでペアがまるごと1つ抜ける実害があった）。
    都道府県が3文字（神奈川/鹿児島/北海道等）だと列境界を跨いで欠けたり所属側に食い込んだり
    するため、都道府県列を広め(+30pt)に取ったうえで、47都道府県の短縮表記と完全一致するか
    検証し、不一致なら末尾の余分な文字を所属側へ戻す補正パス（`_fix_pref_overflow`）を入れている。
    氏名列と隣接列（エントリー番号列等）の境界も、脱落文字が隣の列の判定（`isdigit()`等）を
    壊してペアリング全体をずらす二次被害を起こすため、余裕を持ったマージンを取る
    （固定座標のラウンドロビン表は16pt以上。トーナメント表は実データから境界を検出するので
    各列6〜10ptの実効マージンが確保される）。
  - **姓名分割は座標ベース**。氏名列は姓2文字+名2文字ぶんの固定スロットに均等割り付けされ、
    姓の先頭文字は常にスロット1、名の末尾文字は常にスロット4に来る（姓・名どちらかが3文字に
    なる場合は中間の空白スロットへ同じ側の内側だけあふれる）ため、文字数1〜3のどの姓長でも
    機械的に分割できる（姓名合計2文字＝1+1のケースも含む）。トーナメント表と
    ラウンドロビン表で判定方式が異なる点に注意:
    - **トーナメント表**（`parse_bracket_page`）: 姓名境界の字間は内部字間と全く同じ大きさに
      なる（字間だけでは判別不能、インターハイPDFと同じ落とし穴）。一方でスロットの絶対X座標は
      同一レイアウト内でもページごとに数pt動く（固定しきい値では対応できない）。そのため
      `_dynamic_name_split_x`が、そのページ・列で実際に使われた氏名列文字のX座標の
      最小値（=スロット1）と最大値（=スロット4）の中点を毎ページ計算し、姓名境界として使う。
      `general`/`female`/`age`/`2022`のどのレイアウトでも実測・追試済みで、新しい年度の
      PDFでも座標を実測・追加する必要がない。
    - **ラウンドロビン表**（`parse_roundrobin_page`）: 逆に姓名境界の字間は内部字間より
      明確に大きい（実測: 境界≈9〜22pt vs 内部≈6〜13pt）ため、`_split_name_by_max_gap`で
      行ごとに独立して「最大の字間」を境界とみなして分割する（ページ単位の補助計算は不要）。
    氏名文字が無いなど座標が取れない場合のみ`_split_name`（姓2文字固定の文字数ヒューリスティック、
    氏名が2文字なら姓名1文字ずつに分割、ユーザー確認済み）にフォールバックする。
    詳細は[2026-08-26-zennihon-workers-2022-name-split-coordinate-fix.md](../raw/2026-08-26-zennihon-workers-2022-name-split-coordinate-fix.md)。
  - **一般男子（2022年1〜8ページ）はテキスト層が無いため、本スクリプトでは扱えない**
    （`page.chars`がほぼ空）。ただし未対応ではなく、`scripts/pdf/zenshakai_outlined_glyphs.py`
    で取り込み済み。下の「アウトライン化されたPDF」を参照。
  - `python3 scripts/pdf/zenshakai_entries.py <pdf> --year 2023 --bracket "doubles-none-boys=1-8" --bracket "doubles-none-girls=10-11:female" --bracket "doubles-over35-boys=14-15:age" --roundrobin "doubles-over35-girls=17" --bracket "doubles-over45-boys=19-20" --roundrobin "doubles-over45-girls=22" --out data/tournaments/details/zennihon-workers`
    （2022年のページ割りは 一般女子=10-11 / 35歳男子=13-14 / 35歳女子=15 / 45歳男子=16-17 /
    45歳女子=19-20。`:layout` はフォールバック指定なので通常は省略してよい）
  - 実行後は `node scripts/normalize-prefectures.mjs --scope=zennihon-workers` を忘れず実行する。
  - 詳細な調査過程は [2026-08-20-zennihon-workers-2023-pdf-entries-import.md](../raw/2026-08-20-zennihon-workers-2023-pdf-entries-import.md)。
- `scripts/pdf/zenshakai_outlined_glyphs.py`
  **文字がアウトライン化された（テキスト層を持たない）トーナメント表PDF**専用の抽出。
  2022年度 全日本社会人 一般男子（1〜8ページ）で使用。

  #### テキスト層が無いPDFを見たら、OCRの前に `get_drawings()` を数える

  テキスト層が無いPDFには2種類ある。**スキャン画像**（ビットマップが1枚入っている）と、
  **アウトライン化**（文字が図形＝ベクターパスに変換されている）。前者はOCRが要るが、
  **後者にOCRを使うのは、PDFに残っている情報を捨てる行為**なので絶対にやらないこと。

  判定は簡単で、`len(page.get_drawings())` がそのページの文字数と同じオーダーなら
  アウトライン化。このとき `even_odd` の fill path 1個が1文字に対応し、
  外接矩形がそのまま文字の切り出しになる。OCRが解くべき問題のうち「文字の位置」
  「文字の切り出し」「同じ文字かどうか」はPDF側に既にあり、残るのは
  「この形は何という文字か」だけになる。

  #### 別ページの正解セットでブートストラップする

  大会PDFには「ベスト64表」「準々決勝詳細」のように**同じ選手が別ページに載り、
  そちらは通常のテキスト層を持つ**構造がよくある（インターハイPDFも同様）。
  エントリー番号つきで載っていれば、アウトライン側のグリフ列に位置で突き合わせるだけで
  大量の文字が機械的に確定する。2022年一般男子では**氏名欄の文字の77%**がこれだけで
  決まり、残りだけを1文字ずつ同定すれば済んだ。

  #### 土/士・末/未 は形状の正規化では分離できない

  この2組は「横棒の長さの比」だけが違うため、サイズ正規化した画像では**完全に同一**になる。
  クラスタリングでも同じクラスに混ざり、目視でも間違える。ベクターがあるので
  **横棒の実寸を1文字ずつ測って**決めること（土=下の棒が長い / 士=上の棒が長い、
  末=1本目が長い / 未=2本目が長い）。確認用に文字を並べた画像を作るときも、
  **幅ではなく字高で正規化**する（幅で正規化すると土と士が同じ絵になる）。

  #### 正解セット（別ページのテキスト層）にも誤記はある

  2022年一般男子の entry 36 は、ベスト64表のテキスト層では「畑本理土」だが、ドロー表の
  実測とプロジェクトの選手辞書はどちらも「畑本理士」だった。別ページのテキスト層は
  「一次資料の1つ」であって絶対の正解ではない。実測・既存辞書との三点照合で決めること。

  - 依存: `pymupdf`（`pdfplumber` ではベクターパスの塗り規則・色まで取れないため）。
    確認画像を出す `--montage` は追加で `pillow` / `numpy` が要る。
  - 実行: `python3 scripts/pdf/zenshakai_outlined_glyphs.py <pdf> --out <details.json>`
    （未同定グリフの確認画像は `--montage <dir>`）。
    グリフ座標→文字の対応表は `scripts/pdf/zenshakai-2022-general-boys-glyphs.json`。
  - 実測精度・手順の詳細は
    [2026-08-20-zennihon-workers-2022-general-boys-vector-glyph-import.md](../raw/2026-08-20-zennihon-workers-2022-general-boys-vector-glyph-import.md)、
    要確認リストは
    [2026-08-20-zennihon-workers-2022-general-boys-review.md](../raw/2026-08-20-zennihon-workers-2022-general-boys-review.md)。
- `scripts/pdf/details_to_initial_players.py`
  上記2スクリプトが出力した `data/tournaments/details/**/*.json`（participants/entries形式、
  まだ結果が入っていない=`matches`が空のカテゴリ）を、`tools/`（ブラウザ入力ツール）に貼り付ける
  `initialPlayers` 形式JSONへ変換する（tournament-pdf-to-players skill が定義する形式に準拠）。
  個人戦は姓・姓（学校名）形式の`name`と`information[]`（`tempId`は姓_名_学校の3項目）、団体戦は
  学校名（都道府県）形式の`name`を組み立てる。
  `python3 scripts/pdf/details_to_initial_players.py <details.json> --out <initialPlayers.json>`

## 高校カテゴリ系の生成

確認できた主要スクリプト:

- `scripts/highschool/01team/entries-to-teams.py`
- `scripts/highschool/02result/extract.py`
- `scripts/highschool/03list/summary.py`
- `scripts/highschool/04summry/generate_prefecture_summaries.py`
- `scripts/highschool/analysis/generate_school_analysis.py`

出力先:

- `data/highschool/prefectures/**`

### 性別の扱い

- `scripts/highschool/02result/extract.py` はファイル名から性別を自動判定する
- 現在は `boys` / `girls` / `mixed` を判定対象としている
- 抽出結果には `gender` フィールドが付与され、後続の高校カテゴリ集計に渡される

### 学校名の寄せ方

- `scripts/highschool/03list/summary.py` は既知の学校名を安全に正規化して集計する
- 同姓同名選手の証拠から広く alias を推定する処理は、別学校の過剰集約を招くため集計には使わない
- `scripts/highschool/04summry/generate_prefecture_summaries.py` は毎回 `summary.json` をフル再生成する

## tournament details / players 生成の見方

- 大会データの canonical source は `data/tournaments/details/**` と `data/tournaments/information/*.json`
- 一覧や地域紐付けは `data/tournaments/index.json` / `local_index.json` を使う
- そこから選手ページ用の `data/players/**` を派生生成する流れがある
- `data/players/*/analysis.json` は `data/tournaments/details/**` と `data/tournaments/information/*.json` から `scripts/generate-player-analysis.mjs` で自動生成する
- score 系は `data/**` ではなく Supabase -> `public/data/beta-matches/**` 生成の流れを持つ

### データ品質チェック: `npm run check:entries`

`scripts/check-tournament-entries.mjs` が `data/tournaments/details/**` を全走査し、
entries の入力ミスを検出する。問題があれば終了コード1。取り込み後に実行する
（`check-identity-health.mjs` と同じ位置づけ）。`temp/` 配下は作業中ファイルなので除外する。

検出ルール:

| ルール | 意味 |
|---|---|
| `pair-single-player` | ペア戦なのに `playerIds` が1人。カテゴリの付け間違いか相方の入力漏れ |
| `duplicate-player-id` | `playerIds` に同一IDが重複。相方欄に本人をコピーした入力ミス |
| `singles-multi-player` | シングルスなのに複数人 |
| `unknown-participant` | `participants` に存在しない `playerId` を参照 |
| `orphan-participant` | `participants` に居るのに、どの entry にも登場しない。**表記ゆれによる二重登録のサイン** |
| `match-entry-not-found` | `matches[].entries` が存在しない entryNo（`null` 含む）を参照 |
| `result-entry-not-found` | `results[].entryNo` が存在しない |
| `bracket-slot-parity` | `entries[].type` から積んだ枠数が2の冪でない＝シード/足長の指定ずれ（warn）。**予選リーグを含む大会は対象外**（席順は `knockoutDraw` が持つため） |
| `knockout-draw-missing` | 予選リーグ→決勝T形式（決勝Tの試合が2件以上）なのに `knockoutDraw` が無い（warn）。`npm run bracket:draw -- --apply` で生成できる。生成できない場合は決勝Tの試合記録が欠けている |
| `knockout-draw-parity` | `knockoutDraw.slots` の枠数が2の冪でない（warn）。空席は `null` で埋める |
| `knockout-draw-unresolved` | `knockoutDraw` の席が参照する (組, 組内順位) が `results[].roundrobin` に無い（warn）。予選リーグが終わる前は対象外 |

### 決勝トーナメントの席順（`knockoutDraw`）

**予選リーグ→決勝T形式の大会では、決勝Tの席は「エントリー」ではなく「予選リーグの組」に属する**
（「A組1位の席」であって「◯番の組の席」ではない）。誰がそこに入るかはリーグが終わるまで
決まらないので、`entries[].type` に席順を持たせる方式は成立しない
（`entryNo` 順に積むと 90 大会中 17 大会が誤ったブラケットになる）。

```json
"knockoutDraw": {
  "slots": [
    {"group":"A","rank":1},
    null,
    {"group":"D","rank":2},
    {"group":"E","rank":2}
  ]
}
```

- `slots` の並びがそのままブラケットの席順。長さは2の冪、`null` は空席（不戦勝）
- 実際の `entryNo` は `results[].roundrobin.{group, rank}` を引いて解決する
- 完了済み大会は `npm run bracket:draw -- --apply` で `matches` から生成できる。
  書き込む前に「復元した席順で計算した合流ラウンドが knockout の全試合と一致するか」を
  検算し、通らない大会には書き込まない
- **`entries[].type` は予選リーグを含まない大会専用**。予選リーグ大会の `type` は席順として読まない

**入力ツール（`tools/index.html`）は保存時に `knockoutDraw` を出力に含める**ので、
新しく入力した大会に生成スクリプトを別途走らせる必要は無い。席順を起こす手順の実体は
`tools/shared/knockout-draw.js`（Browser + Node 両対応の UMD）にあり、入力ツール
（`normalize-core.js`）と生成スクリプトが同じモジュールを共有する。
`entries` メタJSON（`type`）は予選リーグを挟む大会では不要。

**決勝が1試合だけの大会にはドローを作らない**。リーグ→リーグ→優勝決定戦のような形式には
ブラケットが無く、2枠のドローは席順の情報を持たないため。実例:
`zennihon-university-ouza/2026/team-none-boys`（予選リーグ6組 → 準決勝リーグ2組 → 優勝決定戦）。
なお `results[].roundrobin` は組を1つしか持てないので、**2段目のリーグの順位は記録されない**
（試合そのものは `matches` に残る）。

決定の経緯と実測は [ADR-015](../adr/ADR-015-knockout-draw-by-group.md)。

なぜ必要か: 統計エンジンはこれらを「相方不明」として**黙って除外する**ため、
サイトの表示を見ても気付けない。2026-07-19 に、選手ページのパートナー別集計が
試合数と合わない問題を追った結果、原因は全てここに挙げた入力ミスだった。

### 入力ツール側の同時チェック

ルールの実体は `tools/shared/validate-entries.js`（Browser + Node 両対応の UMD）にあり、
上記の Node スクリプトと入力ツールが**同じモジュールを共有する**（二重管理を避けるため）。

`ToolBridge.normalize()` が成形直後に検証を走らせ、`ToolBridge.renderValidation(el)` が
結果を描画する。組み込み済みのツール:

- `tools/tournament3/` — `#validationResult` に表示
- `tools/roundrobin/` — 同上

`tools/tournament/` と `tools/tournament2/` は共有パイプライン（normalize-core /
tool-bridge）を経由しない旧ツールのため未対応。2026-08-01、リポジトリ整理により
`tools/_archived/tournament/` `tools/_archived/tournament2/` に移動済み（現役では使わない。
`tools/_archived/README.md` 参照）。

ツール側では `categoryId` を渡していない。保存ファイル名は localStorage 由来で
前回の種目が残っている可能性があり、誤判定を招くため。代わりに entries の
多数派人数からシングルス/ペア戦を推定する。

**検出は選手側から逆引きせず、details を全走査すること。**
選手をサンプリングして逆引きすると、サンプル外の選手が絡む分を取りこぼす
（2026-07-19 に実際に4件見落とした）。

実例（2026-07-19）: `asian-games-qualifier/2025` の6ファイルが `doubles-*` だったが
127エントリー全部が1人で、実際はシングルス戦だった。`singles-*` に訂正し、
`public/_redirects` に旧 URL からの 301 を追加した。
詳細は docs/raw/2026-07-19-asian-games-qualifier-2025-singles-correction.md。

### 大会結果データの学校名・県名の名寄せ

- 大会結果（`data/tournaments/details/**`）は表示にそのまま使われるため、学校名・県名の表記揺れがあると同一校が別チームのように見える（例: `高田商` / `高田商業` / `高田商業高校`、`徳島` / `徳島県`）
- `scripts/normalize-team-names.mjs` が2種類の揺れを統一する:
  - 学校名: 手動メンテの対応表 `data/tournaments/team-name-aliases.json`（`teamAliases` に「正準名 ← 別名」）で寄せる
  - 都道府県: 接尾辞（県/府/都）が無い短縮表記に正しい接尾辞を補う（スクリプト内蔵の47都道府県マップ。対応表には書かない）
- **対象スコープは既定で `highschool-japan-cup`（ハイスクールジャパンカップ）のみ**。他大会へ広げる場合のみ `--scope=<tournamentId>`（`--scope=all` で全大会）を明示する
- 対象は各 JSON の `participants[].team` / `participants[].prefecture` / `participants[].id` と `entries[].playerIds`。`id`（`姓_名_チーム_都道府県`）を再計算し参照も張り替える
- スクリプトは JSON を再シリアライズせず元テキストへピンポイント置換するため整形（インライン配列など）が保たれる。冪等で、`--dry-run` で事前確認できる
- `temp/` 配下の中間生成物は対象外。データを再生成した場合は本スクリプトを再実行する
- 別団体（例: `高田商ＯＢクラブ`＝OB団体）や別校（`大分`≠`大分商`、`高崎`≠`高崎商`）は対象に含めない。新しい揺れは対応表に追記して再実行する
- 登録済みの学校名エイリアス（HJC適用済み）: 高田商 / 大分商 / 明豊 / 旭川工 / 北科大 / 焼津 / 高崎商
- 判断保留（別校か同一校か未確定のため未登録）: `岐阜商` vs `県岐阜商`、`富士見` vs `静岡県富士見`
- 一回限りのデータ破損修復は `scripts/fix-hjc-2024-doubles.mjs`（2024男子ダブルスで和歌山勢の氏名・県名混入により参照切れ等が発生していたもの。氏名はドロー＝`entries` を一次情報として修復）。本スクリプト実行後に上記の正規化を流す

#### ルール: 都道府県は省略しない

- **`participants[].prefecture` は必ず正準形で保持し、省略形を使わない。** 正準形とは:
  - 接尾辞（都/道/府/県）を必ず付ける（`徳島` ではなく `徳島県`、`東京` ではなく `東京都`）
  - 地域接頭辞を付けない（`関東・埼玉県` ではなく `埼玉県`、`開催地・北海道` ではなく `北海道`）
  - NFKC で全角/半角・区切り（`•`→`・`）・空白を統一する
  - 47都道府県の正準表記は1値1表記に固定する
- **例外（都道府県でない区分はそのまま保持）**: 連盟など県の代わりに入る値は「別の都道府県扱い」の値として残す（`日本学連` / `学連` / `高体連` / `中体連` / `日本連盟`）。誤付与された県だけ外す（`学連県`→`学連` など。連盟保持集合から機械的に導出、2026-07 汎用化）。外国は県を外して国名で保持（`韓国県`→`韓国`）。
- 連盟値の扱いの決定（2026-07）: 表示は `学連` のまま、集計上は `日本学連` に寄せてよい（`学連`/`日本学連` は同一連盟の表記揺れ。データ値の統一は未実施）
- このルールは取り込みツール側 `tools/shared/normalize-core.js` でも強制する（2026-07 根本修正）:
  - `normalizePrefectureName()` は連盟・外国トークン（`NON_PREFECTURE_TOKENS`）に `県` を付与しない（旧実装は `日本学連` のみ除外で、`学連`→`学連県` の汚染を生んでいた）
  - `registerFromIdString()` は id 末尾が都道府県または連盟・外国トークンなら prefecture として分離する（旧実装は `都|道|府|県` 終端のみで、`学連` がチーム名に吸収され `中央大学_学連` の汚染を生んでいた）
  - この2欠陥による east-japan/2026 の汚染は一回限りの修復スクリプトで修復済み（スクリプト自体は適用後に削除。背景と修復ロジックの記録: docs/raw/2026-07-17-gakuren-prefecture-pollution-plan.md）
- このルールを全大会へ適用するのが `scripts/normalize-prefectures.mjs`:
  - Tier A（機械的・安全）: 接尾辞補完 / 地域接頭辞の除去 / 外国名の県除去 / 連盟名への誤付与県の除去
  - Tier B（崩れ・誤字の明示マップで一意復元）: `奈川県`→`神奈川県`、`德島県`→`徳島県`、`愛緩県`→`愛媛県`、`伊勢県`→`三重県` など
  - team には触れない（学校名寄せは `normalize-team-names.mjs` の管轄）。`prefecture` と、それを含む `id`（フィールド再構成と一致する正常な id のみ）・`entries[].playerIds` を追従
  - 既定スコープは `all`。冪等で `--dry-run` 可。未解決値（県・連盟・外国いずれでもない値）は警告に出す
  - フィールド置換はコロン前後の空白差を許容する正規表現で行う（2026-07 修正。旧実装の固定文字列 `"prefecture": "` はコンパクト整形のファイルにマッチせず置換漏れした）
- 2026-06 一括適用済み: prefecture の distinct 値 187 → 61（47都道府県＋連盟/外国/残存）。id 重複（誤マージ）ゼロ
- 人手判断のバックログ（2026-06 解消済み）: 当初の未変換4件は単純な県揺れではなく**列ずれによるレコード破損**だった。氏名・チーム・県の手がかり（チームメイトの県、ペア相手、同名の他大会）から特定し修復:
  - `中村日花莉_大分_大商鬼魄会_日本製鉄大分` → `中村_日花莉_大商鬼魄会_大分県`（firstNameに県混入。ペア相手が大商鬼魄会＝大分県）
  - `麻田陽愛_学連_同志社大学_立命館大学` → `麻田_陽愛_立命館大学_学連`（partner=同志社の中尾＝学連ペア。所属は立命館大学と確認）
  - `森田_晴紀_宮崎_都城商業高校OBクラブ` → `森田_晴紀_都城商業高校OBクラブ_宮崎県`（県とチーム入替。同名が他大会で宮崎県×7）
  - `大和田_夏美_…_い県` → `…_福島県`（ミックス相手＝磐城（いわき）福島県、team「わき」≈いわき）
  - 今後同種の列ずれが出たら、未解決警告を起点に同様の手がかりで個別修復する
- 残課題: `entries[].playerIds` の参照切れ3件（`田端_一葵_和歌山`＝参加者は `…_印南ジュニアクラブ` 等）はチーム名・氏名の表記差由来で、都道府県とは別問題
- 自動変換済みだが推定を含むもの（巻き戻さない方針）: `伊勢県`→`三重県`、`沖県`→`沖縄県`、`熊`→`熊本県`
- 既知の残課題（本ルールとは別の学校名揺れ）: `entries[].playerIds` の一部に participant id と不一致の参照が残る（`田端_一葵_和歌山`＝参加者は `…_印南ジュニアクラブ`、`房野_紗千_四天王寺高`＝参加者は `…_四天王寺高校`）。これは都道府県ではなくチーム名・氏名の表記差に起因する既存の参照切れで、別途対応

### 国際大会（ローマ字表記のみの参加者）の選手同定（2026-07 追加）

課題:

- コリアカップ等の国際大会は `data/tournaments/details/international-korea-cup/**` の `participants[].lastName/firstName` がローマ字表記のみで登録される。日本選手も例外ではなく、`team` も所属先ではなく `JPN-1`〜`JPN-10` のような代表内の仮ラベルになっている
- 選手同定は姓名の完全一致（`resolveNumericId` / 各所の `p.lastName === ... && p.firstName === ...`）に依存しているため、ローマ字参加者は既存の漢字選手データ（`data/players/index.json` の数値 id、curated プロフィール）と一切紐付かない。結果として、既に curated プロフィールを持つ有名選手であっても、国際大会の成績が本人の `analysis.json` に反映されず、結果ページでも本人の他大会成績ページへリンクされない
- さらに、ローマ字参加者は `data/players/index.json` に別の数値 id として自動登録され得る（例: `UCHIMOTO TAKAFUMI` が id 8410、本人の漢字プロフィール `内本隆文` は id 17）。この場合 `resolveNumericId` がローマ字名で重複 id を返すため、対応表を「フォールバック」（`resolveNumericId(...) ?? resolveAliasedPlayerId(...)`）にしていると本人 id へ寄らず重複 id に紐付く。ランキング（`data/rankings/*.json`）では本人と重複ローマ字が別行で並ぶ不具合になっていた（2026-07-09 に判明・修正、`reverseIndex.ts` のみ対応）
- 上記の重複id問題は `lib/playerStats/facts.ts` の `personRefFromParticipant`（対戦相手・パートナーの id/表示名解決）には同時に直っておらず、`resolveNumericId(...) ?? resolveAliasedPlayerId(...)`（数値一致を先に試す）の順のままだった。このため、対応表に本人が登録されていても、**自分が対戦相手・パートナーとして他選手の成績に現れる側**のときは重複 id（ローマ字連結名。例 `MIYAMAEKIHO`＝id 8329、本人は `宮前希帆`＝id 44）に紐付いてしまい、パートナー別・対戦成績にローマ字表示が残っていた（2026-07-20 に判明・修正。詳細は下記対応）
- ローマ字→漢字の自動変換は行わない。同一読みに複数の漢字候補があり得るうえ、同姓同名の別人物と誤結合するリスクがある（`docs/wiki/open-questions.md`「同姓同名の人物別 id 分離」と同種のリスク）

対応:

- 手動対応表 `data/tournaments/participant-aliases.json` を新設。`tournaments[].years[].aliases[]` に `{ lastName, firstName, playerId, team? }` を持つ（`team` は代表内仮ラベルではなく実所属。無ければ元の `team` をそのまま使う）。curated プロフィールの slug と参加者名が完全一致した場合のみ確度100%で収録し、未解決の参加者は `unresolved[]` に残して後日追記する
- 読み込みは `lib/playerStats/participantAliases.ts`（`resolveAliasedPlayerId` / `resolveAliasedTeam` / `participantMatchesAliasedId`）に集約。大会・年度・姓名のスコープで引く
- 参照箇所:
  - `lib/playerStats/reverseIndex.ts`: `buildReverseIndex` / `applyReverseIndexDelta` の選手→出場カテゴリ逆引き。**id 解決はエイリアス優先**（`resolveAliasedPlayerId(...) ?? resolveNumericId(...)`）。ローマ字名が index.json に別 id で登録されていても、対応表があれば本人 id へ集約する。エイリアスは大会・年度・ローマ字姓名のスコープでしか一致しないため、国内大会の漢字参加者には影響しない（漢字名はエイリアス key に一致せず null → `resolveNumericId` にフォールバック）
  - `lib/playerStats/facts.ts`: `buildFacts` の対象選手 participant 特定（`matchingIds`）、`personRefFromParticipant` の対戦相手・パートナー解決（id・表示名・所属）。**id 解決は `reverseIndex.ts` と同じくエイリアス優先**（`resolveAliasedPlayerId(...) ?? resolveNumericId(...)`。従来は逆順で `resolveNumericId` を先に試しており、重複idバグが対戦相手・パートナー解決側にだけ残っていた。2026-07-20 修正、`ENGINE_VERSION` を `1.5.0 → 1.6.0` に上げて全再計算で誤った紐付けの facts を一掃）
  - `lib/playerStats/legacyAnalysis.ts`: `resolveFinalResult`（`analysis.json` の `latestMatch` ラベル）
  - `src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx` の `getStaticProps`: 結果ページ・ドローの表示（`playerId` 解決時に `lastName`/`firstName`/`team` を対応表の漢字名・実所属へ差し替え、`/players/{id}/results/` へのリンクも既存の仕組みでそのまま張られる）
  - `src/pages/players/[id]/results.tsx` の `getStaticProps`: 選手詳細ページの「過去の大会一覧」。detail の participant を姓名の完全一致で拾うため、ローマ字参加者は対応表で漢字名・実所属へ正規化してから照合する（2026-07-09 追加）。これを行わないと国際大会が本人の大会一覧に一切出ない。相手・パートナー名も漢字化され、count≥5 の本人ページへリンクされる
- 運用: 対応表を更新（追記）した後はフル再計算が必要。**`participant-aliases.json` は `computeGlobalHash`（`lib/playerStats/manifest.ts`）の対象に含めた**ため、prebuild の増分判定で自動的に全再計算がトリガされる（従来は手動 `--full` 前提だった）。ロジック変更時は `ENGINE_VERSION`（`lib/playerStats/facts.ts`。本対応で `1.1.0 → 1.2.0`）を上げて旧索引・順位表を一掃する
- ランキングへの反映: 上記により国際大会の成績は本人 id の `_facts` に集約され、`data/rankings/*.json`（新エンジン: facts→season points）で本人行に合算される。ローマ字重複行は消える（`generate-facts --full` の stale prune で重複 `_facts` も削除）
- 選手詳細ページ「過去の大会一覧」への反映: `src/pages/players/[id]/results.tsx` が detail から build 時に直接組み立てるため、同ページ側でも対応表による正規化を行う（上記参照箇所）。これで国際大会が本人の大会一覧に表示される
- 残課題: 旧パイプライン `scripts/generate-player-analysis.mjs`（`analysis.json`）は対応表非対応。選手ページの一部サマリ（`latestMatch` 等）や `verify-facts-golden` は facts と analysis の差分を該当選手で検出する。将来的に analysis 生成もエイリアス対応するか、facts ベースへ寄せるかは別途
- 状態: **対策済（コリアカップ2026・日本選手63名中27名を解決済み）／残 36 名は unresolved**（2026-07-20時点、`data/tournaments/participant-aliases.json` 実データで確認）。連盟発表等で漢字が判明した選手から `aliases` に追記していく
- 実装: `data/tournaments/participant-aliases.json`、`lib/playerStats/participantAliases.ts`

## 地方大会候補検知

### `scripts/crawl-local-tournaments.mjs`

役割:

- `data/local-sources/prefecture-sources.json` の都道府県公式サイトを巡回
- HTML から結果資料らしきリンクを抽出
- `data/local-sources/detected-documents.json` に候補を蓄積
- `data/local-sources/ignored-documents.json` にある URL は保存しない

設定メモ:

- 各都道府県は `sourceUrl` 1 本でも `sourceUrls` 複数本でも設定できる
- `sourceUrls` を使う場合は、結果一覧ページ、年度別一覧、連盟大会情報ページなどを並べてよい
- `sourceUrls` がある場合はそちらを優先し、`sourceUrl` は後方互換用に扱う

CLI:

- `node scripts/crawl-local-tournaments.mjs`
- `node scripts/crawl-local-tournaments.mjs --prefecture=ibaraki`
- `node scripts/crawl-local-tournaments.mjs --dry-run`
- `node scripts/crawl-local-tournaments.mjs --min-confidence=0.75`

運用メモ:

- `enabled === false` の都道府県だけ巡回対象外
- `manual` は巡回せずスキップログを出す
- `html_detail` は v1 では `link_only` と同等で警告ログを出す
- PDF / Excel 直リンクは保存しない
- 例外として、島根県の大会一覧ページの `結果` 列にある資料リンクは結果候補として保存する
- 「要項」「案内」「申込」「募集」など案内系キーワードを含む候補は保存しない
- 保存対象は当年度候補と年度不明候補に絞る
  - 現在日付から日本の年度を計算し、4 月始まりで判定する
  - 今年度以外の候補は保存しない
- `--min-confidence` を指定した場合、その値未満の候補は保存しない
- `--min-confidence` の既定値は `0.6`
- 網羅的に見たい場合は、都道府県ごとに `sourceUrls` へ複数の結果系ページを登録する
- `--dry-run` はファイルを更新せず、`sources / crawled / skipped / new / updated / ignored / errors / dryRun` を標準出力に出す
- `detected-documents.json` の `accepted` は候補として確認済みであることだけを意味し、公開データ反映済みは意味しない

## Assumption

- 大会データ生成は手動補正込みのローカル運用
- score 公開 JSON はデプロイ前のスナップショット生成物として扱われる

## Open Questions

- tournament details 生成の標準手順はどのスクリプト列か
- players 生成で最終的に正とする入力源はどれか
- どこまでが自動生成で、どこからが手修正か

## 大会結果入力ツール（tools/）

2026-06 更新: 手動工程削減のため、ブラウザツールに入力受け渡し・成形(normalize)機能を統合した。

フロー:

1. `tools/index.html`（ハブ）で選手配列JSONを貼り付け、形式（トーナメント / ラウンドロビン）を選択
   - ラウンドロビン選択時は `scripts/generate_roundrobin.py` 相当のグループ分割をブラウザ内で実行（標準サイズ / サイズ上書き / ラベル種別に対応）
   - 入力は localStorage 経由で各ツールに渡る（従来どおり `initialPlayer.js` 直接編集も可。localStorage 入力が優先される）
2. 各ツール（`tools/roundrobin` / `tools/tournament3`）でスコア入力
   - 出力 textarea には成形済みJSON（`data/tournaments/details` 用の最終形式）が直接表示される
   - `tools/roundrobin` ではこの成形済みJSONを textarea 上で直接編集でき、編集するとスコア入力による自動上書きが止まる（編集内容がそのままコピー / ダウンロード / 保存に使われる）。試合結果から作り直す場合は「試合結果から再生成」ボタンで編集を破棄して再生成する
   - 保存はコピー / ダウンロード / File System Access API によるフォルダ直接保存（Chrome系のみ）に対応
3. ラウンドロビン→トーナメント移行: RR画面で「各グループ上位N位を進出」を指定して抽出→編集→トーナメント画面へ遷移
   - RRの生結果（roundRobinMatches / standings）は持ち越され、トーナメント出力にマージしてから成形される
   - 持ち越すRR結果は、成形済みJSONを**手動編集していない場合はUIのスコア状態**から、**手動編集した場合は編集後の成形済みJSONから復元**して作る。これにより、RR結果をJSON編集で入力した場合でも、RRで敗退し本戦へ進出しない選手が持ち越し（=最終出力の participants / entries / results）から欠落しない
   - 持ち越しの standings は normalize 側で roundRobinMatches から再計算されるため参考値（最終順位の正は roundRobinMatches）

成形ロジック:

- 本体は `tools/shared/normalize-core.js`（ブラウザ・Node 両対応）
- `scripts/normalize-to-participants-entries.cjs` は同モジュールを呼ぶ薄いCLIラッパーに変更（`scripts/batch-normalize.mjs` からの利用・出力は従来と同一であることを確認済み）
- entries メタ（type情報）はハブページの任意入力欄から渡せる。未指定時は従来どおり試合内容から推定
- **`entriesMeta` は入力ツールが毎回ドローから作り直して `raw` に載せる**（2026-07-26〜）。`ToolBridge.normalize` は `raw.entriesMeta` を最優先し、無い場合だけ localStorage 側（ハブの任意入力欄）を使う。ツール側は現在のパッキン配置から生成するので常に最新で正しい

### キーボードショートカット（2026-08-27〜 roundrobin対応）

`tools/tournament3` と `tools/roundrobin` は同じキー割り当てでスコア入力できる
（マウス操作の score-button クリックと等価）。`1`-`6` で0〜5点を設定（設定後は次の
試合の1人目へ移動）、`R` でリタイア、`Tab`/`Shift+Tab` で選手間、`I`/`M`（または
`↑`/`↓`）で試合間、`J`/`K`（または`←`/`→`）で同一試合内の選手切替、`PageUp`/`PageDown`
でラウンド間（roundrobinはグループ間）移動、`Home`/`End`で先頭/末尾へ、`?`でヘルプ表示。
テキスト入力欄にフォーカスがある間は無効（`?`と`Esc`を除く）。
tournament3固有のパッキン操作（`P`/`B`）はroundrobinには無い（bye/パッキンの概念が無いため）。

### ドロー入力（結果を入れる前）の扱い（2026-07-26）

大会前に組み合わせだけを入力する運用に対応するため、次の 3 点を入れた。経緯は
[news-context-blocks.md](./news-context-blocks.md) の⑥「直近の対戦」と合わせて参照。

- **試合結果が無くても `entries` と `type` が出る**。従来は `entries` を `matches[].entryNo` から
  作っていたため、**1回戦が不戦勝（パッキン）のシードは 2 回戦の結果を入力するまで
  `entries` に現れなかった**（bye を含む試合をツールが出力しないため）。
  `buildEntriesMeta()` がドローから直接 `entriesMeta` を組み立て、`normalize-core` が
  そこにしか無いエントリーを補う。
- **不戦勝の勝ち上がりを `matches` / `results` に出さない**（ツールの「不戦勝の勝ち上がりを
  出力しない」トグル、既定 ON）。パッキンを指定すると不戦勝どうしが 2 回戦以降で当たり、
  **1 試合も行われていないのに対戦カードが確定**する。ドロー段階でこれを出すと結果ページが
  「1回戦未実施なのに進行中」に見えるため除外する（`reachedOnlyByByes()`）。
  1 回戦の結果を入れれば通常どおり 2 回戦以降が現れるので、最終的なデータは同じに収束する
  **…はずだったが、`extra`（足長）同士の対戦では実際には収束しないバグが2026-08-01まで存在した**。
  判定が「この枠に不戦勝だけで来たか」（`byeDerived`）だけを見て「結果が入ったか」を見ておらず、
  勝者を入力しても永久に出力されない試合があった（インターハイ2026女子ダブルスで70試合欠落、
  誤った大会インサイト記事が公開・取り下げになる実害あり）。`shouldSkipByeDerived()` に
  「勝者が入っていれば出力する」判定を追加して修正済み。詳細:
  [2026-08-01-bug-bye-derived-matches-not-exported.md](../raw/2026-08-01-bug-bye-derived-matches-not-exported.md)。
- **`entriesMeta` の選手を `participants` にも登録する**。上の 2 点だけだと
  **シード・足長が `participants` から丸ごと消える**。出場者集合はプレビュー記事の
  ①連覇ウォッチ・②前回入賞者・③過去の優勝者・④直近好成績者すべてが参照するため、
  ここが欠けると「注目の選手」が軒並みゼロになる（実測: インターハイ 2026 の出場者が
  1,344 人 → 752 人、注目の選手が 13 人 → 1 人）。ツールは `entriesMeta[].players` に
  姓名・所属・都道府県を載せ、`normalize-core` が `registerOpponent` で登録する。
  - **団体戦の id 規約に注意**。`participants` の id は `makeIdFromParts` による
    `校名_都道府県`（例: `文徳_熊本県`）。`registerFromTeamString` は id を校名そのものに
    するため使ってはいけない（`文徳` を作って `matches` 由来の正規 id と重複し、
    48 校に対し `participants` が 80 件になった）。`entries[].playerIds` 側も同じ規約で揃える。

**検証観点**: 入れ直したデータは `participants` 件数（個人＝エントリー数×2 / 団体＝エントリー数）と
`entries[].playerIds` の参照切れ・未参照の 3 つを突き合わせること。参照切れ 0 だけ見ていると
重複登録を見逃す。
- ラウンドロビン→トーナメント移行時は `roundRobinMatches`（RR持ち越し）と `matches`（トーナメント）が同一入力に共存する。participants と entries は両方をマージして収集する（どちらか一方だけを採用しない）。これにより、トーナメント側のペア・対戦相手・entryが participants / entries から欠落しない
- RRで敗退し本戦へ進めなかった選手も `results` に残す。形式は `{"entryNo":N,"tournament":null,"roundrobin":{"group":..,"rank":..}}`（例: `data/tournaments/details/highschool-japan-cup/2025/doubles-none-boys.json`）。「予選敗退」「予選N位」等のラベルはJSONには保存せず、`tournament:null` かつ `roundrobin` ありの形から表示側（選手ページ・メジャータイトル判定等）で導出する
- エントリー成績（`results[].tournament.rank`）は `matches` から `deriveEntryStanding` で算出する。**最深試合が未確定（`winnerEntryNo==null`）の間は敗退でなく進行中（`rank.kind:'ongoing'`）**として扱うため、大会途中の export でも `results` を生成できる（完了大会の出力は不変）。語彙・運用は [tournament-data-structure.md](../tournament-data-structure.md) と [ADR-007](../adr/ADR-007-in-progress-tournament-standing.md) を参照
