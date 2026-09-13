# 小学生カテゴリ teamId 目視確認リスト

生成は `npm run primaryschool:teamid-todo`。override 済み 17件を除いた 281件（閾値5の全 298件）。

`data/primaryschool/team-id-overrides.json` に `"チーム名": "正しいスラッグ"` を書くと上書きできる。
書いたあとこれを流し直すと、確認済みが消えて残りだけになる。

## 書くときの規約

- 長音は `ou` / `uu` を残す（`昇陽` は `shoyo` でなく `shouyou`）。サイト全体の一貫性を優先する規約
- 競技名（`ソフトテニス` / `テニス`）は落とす。当サイトでは自明なため
- `クラブ` `ジュニア` `ユース` `スポーツ` `センター` `チーム` は英語綴りへ。それ以外のカタカナはローマ字のまま
- `スポ少` と `スポーツ少年団` は統一しない。各団体が自分で名乗っている名前の違いなので
- **同名の学校が高校側にある場合は `scripts/highschool/01team/team_id_map.json` を先に確認する**

## A. 最優先: 既存カテゴリと読みが食い違う（0件）

同じ地名が高校・中学のマスタにあり、そちらの ID と読みが合わない。ほぼ確実に pykakasi の誤読。

なし。

## B. 要確認: 既存カテゴリで読みを確かめられない（135件）

同じ地名がマスタに無いか、あっても**前方一致どまり**で読みの裏づけにならないもの。
人が読みを確認するしかない。出場延べの多い順。

| # | 県 | 団体名 | 出場延べ | 地名 | pykakasi | 参考（前方一致） |
|---|---|---|---|---|---|---|
| 1 | 大阪府 | 堺市テニススポーツ少年団 | 31 | 堺市 | `sakaishi` |  |
| 2 | 鹿児島県 | 青葉ジュニア | 28 | 青葉 | `aoba` |  |
| 3 | 滋賀県 | 蒲生スポーツ少年団 | 23 | 蒲生 | `gamou` |  |
| 4 | 高知県 | 東中筋ジュニアクラブ | 22 | 東中筋 | `higashinakasuji` |  |
| 5 | 京都府 | 舞鶴ひまわりクラブ | 22 | 舞鶴ひまわり | `maizuruhimawari` |  |
| 6 | 山口県 | 永源クラブ | 21 | 永源 | `eigen` |  |
| 7 | 長崎県 | 大村なんてジュニア | 18 | 大村なんて | `oomuranante` |  |
| 8 | 奈良県 | 王寺ジュニアクラブ | 17 | 王寺 | `ouji` | 中学 王寺ユースクラブ=`oujiyouthclub` |
| 9 | 福岡県 | カブトの森ジュニア | 16 | カブトの森 | `kabutonomori` |  |
| 10 | 山梨県 | 一宮町スポ少 | 16 | 一宮町 | `ichinomiyachou` |  |
| 11 | 茨城県 | 常陸太田スポ少 | 16 | 常陸太田 | `hitachioota` |  |
| 12 | 岐阜県 | 瑞穂ジュニアクラブ | 16 | 瑞穂 | `mizuho` |  |
| 13 | 神奈川県 | 横須賀Ｄｒｅａｍスポーツ少年団 | 15 | 横須賀Ｄｒｅａｍ | `yokosukadream` |  |
| 14 | 青森県 | 十和田STC | 15 | 十和田 | `towada` |  |
| 15 | 長野県 | あずみ松川ジュニアクラブ | 14 | あずみ松川 | `azumimatsukawa` |  |
| 16 | 鹿児島県 | 広木小スポーツ少年団 | 14 | 広木小 | `hirokishou` |  |
| 17 | 岐阜県 | 大垣市スポーツ少年団 | 14 | 大垣市 | `oogakishi` |  |
| 18 | 岐阜県 | 池田町少年団 | 14 | 池田町 | `ikedachou` |  |
| 19 | 静岡県 | 豊田健友ジュニア | 13 | 豊田健友 | `toyodakenyuu` | 中学 豊田健友クラブ=`toyodakenyuuclub` |
| 20 | 富山県 | ＷＩＮＧ射水スポーツ少年団 | 12 | ＷＩＮＧ射水 | `wingimizu` |  |
| 21 | 岡山県 | ももっち岡山 | 12 | ももっち岡山 | `momotchiokayama` |  |
| 22 | 山形県 | レッツ中山 | 12 | レッツ中山 | `rettsunakayama` |  |
| 23 | 福井県 | 丸岡町スポ少 | 12 | 丸岡町 | `maruokamachi` |  |
| 24 | 神奈川県 | 座間ジュニアクラブ | 12 | 座間 | `zama` |  |
| 25 | 秋田県 | 秋田市ジュニア | 12 | 秋田市 | `akitashi` |  |
| 26 | 宮城県 | 仙台東STC | 12 | 仙台東 | `sendaihigashi` |  |
| 27 | 大阪府 | 泉南ジュニアクラブ | 12 | 泉南 | `sennan` |  |
| 28 | 千葉県 | 船橋ジュニア | 12 | 船橋 | `funabashi` |  |
| 29 | 奈良県 | 奈良USJ | 12 | 奈良USJ | `narausj` |  |
| 30 | 徳島県 | 永遠クラブ | 11 | 永遠 | `eien` |  |
| 31 | 大阪府 | 岸和田ジュニア | 11 | 岸和田 | `kishiwada` |  |
| 32 | 鳥取県 | 江府小STC | 11 | 江府小 | `koufushou` |  |
| 33 | 山梨県 | 甲府ストロング | 11 | 甲府ストロング | `koufusutorongu` |  |
| 34 | 兵庫県 | 上郡ジュニア | 11 | 上郡 | `kamigoori` |  |
| 35 | 秋田県 | 森吉ジュニア | 11 | 森吉 | `moriyoshi` |  |
| 36 | 埼玉県 | 深谷スキャリオン | 11 | 深谷スキャリオン | `fukayasukyarion` |  |
| 37 | 山梨県 | 都留クラブジュニア | 11 | 都留 | `tsuru` | 中学 都留クラブ=`tsuruclub` |
| 38 | 広島県 | 原スポ少 | 10 | 原 | `hara` |  |
| 39 | 千葉県 | 市原ジュニア | 10 | 市原 | `ichihara` |  |
| 40 | 山形県 | 真室川ジュニア | 10 | 真室川 | `mamurogawa` |  |
| 41 | 高知県 | 須崎ジュニア | 10 | 須崎 | `susaki` |  |
| 42 | 秋田県 | 仙北スポ少 | 10 | 仙北 | `senboku` |  |
| 43 | 愛知県 | 朝日Ｓ．Ｔ．Ｃ | 10 | 朝日Ｓ．Ｔ．Ｃ | `asahistc` |  |
| 44 | 青森県 | 八戸市ジュニア | 10 | 八戸市 | `hachinoheshi` |  |
| 45 | 山梨県 | 富士吉田スポ少 | 10 | 富士吉田 | `fujiyoshida` |  |
| 46 | 長野県 | あづみ野クラブ | 9 | あづみ野 | `azumino` |  |
| 47 | 福島県 | テニ研ジュニア | 9 | テニ研 | `teniken` | 中学 テニ研クラブ=`tenikenclub` |
| 48 | 京都府 | 宇治ジュニアクラブ | 9 | 宇治 | `uji` |  |
| 49 | 宮崎県 | 延岡Ｋｉｄｓ | 9 | 延岡Ｋｉｄｓ | `nobeokakids` |  |
| 50 | 山梨県 | 境川スポ少 | 9 | 境川 | `sakaigawa` |  |
| 51 | 高知県 | 黒潮ジュニアクラブ | 9 | 黒潮 | `kuroshio` |  |
| 52 | 佐賀県 | 上峰ジュニアSTC | 9 | 上峰 | `kamimine` |  |
| 53 | 鳥取県 | 伯耆ＳＴＣ | 9 | 伯耆 | `houki` |  |
| 54 | 秋田県 | 八郎潟町スポ少 | 9 | 八郎潟町 | `hachirougatamachi` |  |
| 55 | 北海道 | 本郷少年団 | 9 | 本郷 | `hongou` |  |
| 56 | 熊本県 | けんぐん元気クラブ | 8 | けんぐん元気 | `kengungenki` |  |
| 57 | 長野県 | サービスエース飯島 | 8 | サービスエース飯島 | `saabisueesuiijima` |  |
| 58 | 山形県 | スポーツ少年団山形クラブ | 8 | スポーツ少年団山形 | `supootsushounendanyamagata` |  |
| 59 | 山形県 | スポ少山形 | 8 | スポ少山形 | `suposhouyamagata` |  |
| 60 | 宮城県 | 河北STC | 8 | 河北 | `kahoku` |  |
| 61 | 新潟県 | 見附市スポーツ少年団 | 8 | 見附市 | `mitsukeshi` |  |
| 62 | 鳥取県 | 黒坂ジュニア | 8 | 黒坂 | `kurosaka` |  |
| 63 | 栃木県 | 今市ジュニア | 8 | 今市 | `imaichi` |  |
| 64 | 岩手県 | 水沢大鐘ジュニア | 8 | 水沢大鐘 | `mizusawaoogane` |  |
| 65 | 福岡県 | 大牟田リトルキッズ | 8 | 大牟田リトルキッズ | `oomutaritorukizzu` |  |
| 66 | 岩手県 | 長中 | 8 | 長中 | `chounaka` |  |
| 67 | 熊本県 | 天水オレンジ | 8 | 天水オレンジ | `tensuiorenji` |  |
| 68 | 神奈川県 | 南大師ジュニア | 8 | 南大師 | `minamitaishi` |  |
| 69 | 静岡県 | 浜北ジュニアクラブ | 8 | 浜北 | `hamakita` |  |
| 70 | 香川県 | 豊中小学生クラブ | 8 | 豊中小学生 | `toyonakashougakusei` |  |
| 71 | 愛媛県 | 北伊予スクール | 8 | 北伊予 | `kitaiyo` |  |
| 72 | 島根県 | Ｓｔ．キッズ益田 | 7 | Ｓｔ．キッズ益田 | `stkizzumasuda` |  |
| 73 | 広島県 | 因島ＪＳＴ | 7 | 因島 | `inshima` |  |
| 74 | 鳥取県 | 羽合スポ少 | 7 | 羽合 | `hawai` |  |
| 75 | 千葉県 | 浦安ジュニア | 7 | 浦安 | `urayasu` |  |
| 76 | 岡山県 | 岡山Ｋｉｄｓクラブ | 7 | 岡山Ｋｉｄｓ | `okayamakids` |  |
| 77 | 青森県 | 弘前あすなろジュニア | 7 | 弘前あすなろ | `hirosakiasunaro` |  |
| 78 | 岡山県 | 瀬戸ジュニア | 7 | 瀬戸 | `seto` |  |
| 79 | 埼玉県 | 川島STC | 7 | 川島 | `kawashima` |  |
| 80 | 新潟県 | 村上市スポ少 | 7 | 村上市 | `murakamishi` |  |
| 81 | 長崎県 | 長崎ドリームジュニア | 7 | 長崎ドリーム | `nagasakidoriimu` |  |
| 82 | 大分県 | 姫島ジュニアクラブ | 7 | 姫島 | `himejima` |  |
| 83 | 北海道 | 名寄ピヤシリ少年団 | 7 | 名寄ピヤシリ | `nayoropiyashiri` |  |
| 84 | 宮崎県 | 飫肥ジュニア | 7 | 飫肥 | `obi` |  |
| 85 | 鳥取県 | 羽合STスポ少 | 6 | 羽合ST | `hawaist` |  |
| 86 | 沖縄県 | 宮古島パニパニ | 6 | 宮古島パニパニ | `miyakoshimapanipani` |  |
| 87 | 福岡県 | 宮田ジュニア | 6 | 宮田 | `miyata` |  |
| 88 | 熊本県 | 熊本春竹ジュニア | 6 | 熊本春竹 | `kumamotoharutake` |  |
| 89 | 石川県 | 穴水町教室 | 6 | 穴水町教室 | `anamizumachikyoushitsu` |  |
| 90 | 福島県 | 三春・船引ジュニアクラブ | 6 | 三春・船引 | `miharufunehiki` |  |
| 91 | 熊本県 | 春竹ジュニア | 6 | 春竹 | `harutake` |  |
| 92 | 埼玉県 | 小川ジュニアテニスクラブ | 6 | 小川 | `ogawa` |  |
| 93 | 熊本県 | 上天草ジュニア | 6 | 上天草 | `kamiamakusa` |  |
| 94 | 愛媛県 | 吹揚クラブ | 6 | 吹揚 | `suiyou` |  |
| 95 | 鹿児島県 | 垂水キッズＳＴスポ少 | 6 | 垂水キッズＳＴ | `tarumikizzust` |  |
| 96 | 宮崎県 | 清武ジュニアC | 6 | 清武ジュニアC | `kiyotakejuniac` |  |
| 97 | 長崎県 | 西海あおぞらジュニア | 6 | 西海あおぞら | `saikaiaozora` |  |
| 98 | 福島県 | 西郷村協会ジュニアクラブ | 6 | 西郷村 | `saigoumura` |  |
| 99 | 宮城県 | 仙台青葉STC | 6 | 仙台青葉 | `sendaiaoba` |  |
| 100 | 福岡県 | 筑前ジュニア | 6 | 筑前 | `chikuzen` |  |
| 101 | 愛知県 | 津島市ジュニアクラブ | 6 | 津島市 | `tsushimashi` |  |
| 102 | 三重県 | 津凪ＳＴＣ | 6 | 津凪 | `tsunagi` |  |
| 103 | 新潟県 | 白根スポ少 | 6 | 白根 | `shirone` |  |
| 104 | 宮城県 | 白石ST協会 | 6 | 白石ST | `shiroishist` |  |
| 105 | 北海道 | 比布町少年団 | 6 | 比布町 | `pippumachi` |  |
| 106 | 島根県 | 美郷ＳＴＣ | 6 | 美郷 | `misato` |  |
| 107 | 熊本県 | 本渡北クラブ | 6 | 本渡北 | `hondokita` |  |
| 108 | 大分県 | 臼杵リターンエース | 5 | 臼杵リターンエース | `usukiritaaneesu` |  |
| 109 | 神奈川県 | 横浜PSC | 5 | 横浜P | `yokohamap` |  |
| 110 | 岐阜県 | 加茂ジュニア | 5 | 加茂 | `kamo` |  |
| 111 | 宮崎県 | 宮崎フェニックスSTC | 5 | 宮崎フェニックス | `miyazakifenikkusu` |  |
| 112 | 広島県 | 呉キッズ | 5 | 呉キッズ | `kurekizzu` |  |
| 113 | 広島県 | 広島土曜クラブジュニア | 5 | 広島土曜 | `hiroshimadoyou` |  |
| 114 | 高知県 | 香南ジュニア | 5 | 香南 | `kounan` |  |
| 115 | 大分県 | 佐賀関STJr. | 5 | 佐賀関ST | `saganosekist` |  |
| 116 | 奈良県 | 桜井ガンバクラブ | 5 | 桜井ガンバ | `sakuraiganba` |  |
| 117 | 宮城県 | 将監JST | 5 | 将監 | `shougen` |  |
| 118 | 愛媛県 | 吹揚クラブスポーツ少年団 | 5 | 吹揚 | `suiyou` |  |
| 119 | 東京都 | 世田谷ジュニア | 5 | 世田谷 | `setagaya` |  |
| 120 | 静岡県 | 清水キッズ | 5 | 清水キッズ | `shimizukizzu` |  |
| 121 | 佐賀県 | 多良ジュニア | 5 | 多良 | `tara` |  |
| 122 | 福岡県 | 大刀洗ジュニア | 5 | 大刀洗 | `tachiarai` |  |
| 123 | 高知県 | 朝倉スポ少 | 5 | 朝倉 | `asakura` |  |
| 124 | 山形県 | 天童ウィナーズスポーツ少年団 | 5 | 天童ウィナーズ | `tendouuinaazu` |  |
| 125 | 富山県 | 入善ＥＡＳＴクラブスポ少 | 5 | 入善ＥＡＳＴ | `nyuuzeneast` |  |
| 126 | 愛媛県 | 波方ジュニア | 5 | 波方 | `namikata` |  |
| 127 | 静岡県 | 函南ジュニア | 5 | 函南 | `kannami` |  |
| 128 | 愛媛県 | 風早ＳＴＣ | 5 | 風早 | `kazahaya` |  |
| 129 | 福岡県 | 福岡市ジュニア | 5 | 福岡市 | `fukuokashi` |  |
| 130 | 三重県 | 北浜クラブ | 5 | 北浜 | `kitahama` |  |
| 131 | 長野県 | 箕輪オードリー | 5 | 箕輪オードリー | `minowaoodorii` |  |
| 132 | 山梨県 | 鳴沢村スポーツ少年団 | 5 | 鳴沢村 | `narusawamura` |  |
| 133 | 北海道 | 野幌少年団 | 5 | 野幌 | `nopporo` |  |
| 134 | 茨城県 | 友部ジュニア | 5 | 友部 | `tomobe` |  |
| 135 | 宮崎県 | 絆 | 5 | 絆 | `kizuna` |  |

## C. 確認不要: 既存カテゴリで読みの裏が取れた（110件）

地名部分が高校・中学のマスタと完全一致するか、前方一致したうえで**残りの読みも ID と一致**したもの。人が一度目を通した ID と同じ読みなので確認不要。

| 県 | 団体名 | 地名 | pykakasi | 一致した既存 |
|---|---|---|---|---|
| 兵庫県 | 姫路ジュニア | 姫路 | `himeji` | 高校 姫路商=`himejishou` |
| 岡山県 | 倉敷ジュニアクラブ | 倉敷 | `kurashiki` | 高校 倉敷南=`kurashikiminami` |
| 佐賀県 | 桜ジュニア | 桜 | `sakura` | 高校 桜井=`sakurai` |
| 岐阜県 | 多治見ジュニアクラブ | 多治見 | `tajimi` | 高校 多治見西=`tajiminishi` |
| 福井県 | 武生スポ少 | 武生 | `takefu` | 高校 武生=`takefu` |
| 愛媛県 | 東予ジュニア | 東予 | `touyo` | 中学 東予STC=`touyostc` |
| 神奈川県 | 綾瀬チャレンジ | 綾瀬チャレンジ | `ayasecharenji` | 中学 綾瀬チャレンジ=`ayasecharenji` |
| 東京都 | 稲城ジュニア | 稲城 | `inagi` | 中学 稲城第三中学校=`inagidaisan` |
| 三重県 | 桑名ジュニアクラブ | 桑名 | `kuwana` | 中学 桑名STC=`kuwanastc` |
| 福井県 | 三国クラブ | 三国 | `mikuni` | 高校 三国丘=`mikunioka` |
| 和歌山県 | 田辺STC | 田辺 | `tanabe` | 高校 田辺=`tanabe` |
| 長崎県 | 諫早ジュニア | 諫早 | `isahaya` | 高校 諫早商=`isahayashou` |
| 秋田県 | 大館ジュニア | 大館 | `oodate` | 高校 大館鳳鳴=`oodateootorimei` |
| 石川県 | 七尾ジュニアクラブ | 七尾 | `nanao` | 高校 七尾=`nanao` |
| 栃木県 | 芳賀クラブジュニア | 芳賀 | `haga` | 中学 芳賀中学校=`haga` |
| 広島県 | 安芸STC | 安芸 | `aki` | 中学 安芸STC=`akistc` |
| 香川県 | 善通寺ＪＳＣ | 善通寺 | `zentsuuji` | 高校 善通寺第一=`zentsuujidaiichi` |
| 長野県 | 長野JSTC | 長野 | `nagano` | 高校 長野吉田=`naganoyoshida` |
| 福島県 | 二本松ジュニア | 二本松 | `nihonmatsu` | 高校 二本松工=`nihonmatsukou` |
| 兵庫県 | 明石ジュニア | 明石 | `akashi` | 高校 明石北=`akashikita` |
| 栃木県 | 一本松テニスクラブＪｒ | 一本松 | `ipponmatsu` | 中学 一本松中学校=`ipponmatsu` |
| 香川県 | 国分寺JSC | 国分寺 | `kokubunji` | 中学 国分寺JSC=`kokubunjijsc` |
| 滋賀県 | 大津ジュニアクラブ | 大津 | `ootsu` | 高校 大津商=`ootsushou` |
| 富山県 | 砺波クラブ | 砺波 | `tonami` | 高校 砺波=`tonami` |
| 岩手県 | 北上ジュニア | 北上 | `kitakami` | 高校 北上翔南=`kitakamishouminami` |
| 香川県 | 丸亀スポ少 | 丸亀 | `marugame` | 高校 丸亀=`marugame` |
| 沖縄県 | 玉城クラブ | 玉城 | `tamaki` | 中学 玉城=`tamaki` |
| 広島県 | 三原ジュニアクラブ | 三原 | `mihara` | 中学 三原JST=`miharajst` |
| 三重県 | 松阪ジュニアクラブ | 松阪 | `matsusaka` | 高校 松阪=`matsusaka` |
| 福井県 | 福井市ジュニアクラブ | 福井市 | `fukuishi` | 中学 福井市JSTC=`fukuishijstc` |
| 青森県 | 平川市スポ少 | 平川市 | `hirakawashi` | 中学 平川市スポ少=`hirakawashisuposhou` |
| 岩手県 | 一関スポ少 | 一関 | `ichinoseki` | 高校 一関学院=`ichinosekigakuin` |
| 和歌山県 | 印南STC | 印南 | `innami` | 中学 印南=`innami` |
| 山口県 | 宇部ジュニア | 宇部 | `ube` | 高校 宇部=`ube` |
| 沖縄県 | 大宜味ジュニア | 大宜味 | `oogimi` | 中学 大宜味中学校=`oogimi` |
| 沖縄県 | 東風平ジュニア | 東風平 | `kochihira` | 中学 東風平中学校=`kochihira` |
| 大阪府 | 藤井寺ジュニアクラブ | 藤井寺 | `fujiidera` | 高校 藤井寺=`fujiidera` |
| 島根県 | 浜田ジュニア | 浜田 | `hamada` | 高校 浜田=`hamada` |
| 徳島県 | 阿波ジュニアクラブ | 阿波 | `awa` | 高校 阿波=`awa` |
| 山口県 | 下松ジュニア | 下松 | `kudamatsu` | 高校 下松=`kudamatsu` |
| 新潟県 | 巻ジュニア | 巻 | `kan` | 高校 巻総合=`kansougou` |
| 三重県 | 四日市ジュニアクラブ | 四日市 | `yokkaichi` | 高校 四日市商=`yokkaichishou` |
| 岡山県 | 総社ジュニア | 総社 | `souja` | 高校 総社南=`soujaminami` |
| 石川県 | 能登スポーツ少年団 | 能登 | `noto` | 高校 能登=`noto` |
| 石川県 | 能美ジュニアクラブ | 能美 | `nomi` | 中学 能美Jr.STARS=`nomijrstars` |
| 京都府 | 八幡スポ少 | 八幡 | `hachiman` | 高校 八幡=`hachiman` |
| 富山県 | 滑川ジュニアクラブ | 滑川 | `namerikawa` | 高校 滑川=`namerikawa` |
| 香川県 | 琴平ジュニアクラブ | 琴平 | `kotohira` | 中学 琴平中学校=`kotohira` |
| 山形県 | 鶴岡スポ少 | 鶴岡 | `tsuruoka` | 高校 鶴岡工=`tsuruokakou` |
| 山口県 | 徳山ジュニア | 徳山 | `tokuyama` | 高校 徳山=`tokuyama` |
| 富山県 | 氷見ジュニアクラブ | 氷見 | `himi` | 中学 氷見北部中学校=`himihokubu` |
| 宮崎県 | 宮崎ジュニア | 宮崎 | `miyazaki` | 高校 宮崎西=`miyazakinishi` |
| 東京都 | 向原JST | 向原 | `mukaihara` | 中学 向原JST=`mukaiharajst` |
| 滋賀県 | 甲賀テニススポーツ少年団 | 甲賀 | `kouka` | 中学 甲賀中学校=`kouka` |
| 埼玉県 | 芝SCジュニアクラブ | 芝 | `shiba` | 中学 芝東中学校=`shibahigashi` |
| 島根県 | 出雲JST | 出雲 | `izumo` | 高校 出雲北陵=`izumohokuryou` |
| 栃木県 | 小山クラブ | 小山 | `oyama` | 中学 小山城南=`oyamajounan` |
| 島根県 | 松江ジュニアスクール | 松江 | `matsue` | 高校 松江工=`matsuekou` |
| 京都府 | 城陽ジュニアクラブ | 城陽 | `jouyou` | 中学 城陽=`jouyou` |
| 埼玉県 | 杉戸ジュニアテニススポーツ少年団 | 杉戸 | `sugito` | 中学 杉戸中学校=`sugito` |
| 長野県 | 朝日クラブ | 朝日 | `asahi` | 中学 朝日中学校=`asahi` |
| 山形県 | 南陽スポ少 | 南陽 | `nanyou` | 高校 南陽工=`nanyoukou` |
| 徳島県 | 福井ジュニアクラブ | 福井 | `fukui` | 高校 福井商=`fukuishou` |
| 群馬県 | 箕郷スポ少 | 箕郷 | `misato` | 中学 箕郷中学校=`misato` |
| 兵庫県 | 龍野ジュニア | 龍野 | `tatsuno` | 高校 龍野北=`tatsunokita` |
| 京都府 | 綾部ジュニアクラブ | 綾部 | `ayabe` | 高校 綾部=`ayabe` |
| 滋賀県 | 安曇川スポーツ少年団 | 安曇川 | `adogawa` | 中学 安曇川中学校=`adogawa` |
| 熊本県 | 宇土ジュニア | 宇土 | `uto` | 高校 宇土=`uto` |
| 和歌山県 | 橋本ジュニアクラブ | 橋本 | `hashimoto` | 高校 橋本=`hashimoto` |
| 奈良県 | 高田ジュニアクラブ | 高田 | `takada` | 高校 高田商=`takadashou` |
| 愛媛県 | 篠山ジュニアクラブ | 篠山 | `shinoyama` | 中学 篠山中学校=`shinoyama` |
| 富山県 | 庄川少年団 | 庄川 | `shougawa` | 中学 庄川ＳＴＡ=`shougawasta` |
| 愛知県 | 半田球友クラブ | 半田球友 | `handakyuuyuu` | 中学 半田球友=`handakyuuyuu` |
| 茨城県 | 豊浦 | 豊浦 | `toyoura` | 高校 豊浦=`toyoura` |
| 栃木県 | 野木クラブ | 野木 | `nogi` | 中学 野木中学校=`nogi` |
| 東京都 | 砧南ジュニア | 砧南 | `kinutaminami` | 中学 砧南中学校=`kinutaminami` |
| 和歌山県 | 九度山ジュニアクラブ | 九度山 | `kudoyama` | 中学 九度山中学校=`kudoyama` |
| 福島県 | 郡山ジュニア | 郡山 | `kouriyama` | 高校 郡山=`kouriyama` |
| 愛媛県 | 松山ジュニア | 松山 | `matsuyama` | 高校 松山=`matsuyama` |
| 北海道 | 静内少年団 | 静内 | `shizunai` | 中学 静内第三=`shizunaidaisan` |
| 群馬県 | 前橋ジュニアクラブ | 前橋 | `maebashi` | 高校 前橋商=`maebashishou` |
| 兵庫県 | 相生ジュニア | 相生 | `aioi` | 高校 相生学院=`aioigakuin` |
| 秋田県 | 大曲ジュニア | 大曲 | `oomagari` | 高校 大曲=`oomagari` |
| 茨城県 | 土浦ジュニア | 土浦 | `tsuchiura` | 高校 土浦三=`tsuchiurasan` |
| 鳥取県 | 日野ジュニア | 日野 | `hino` | 中学 日野フレンズ=`hinofurenzu` |
| 茨城県 | 旭ジュニアスポ少 | 旭 | `asahi` | 高校 旭川工=`asahikawakou` |
| 香川県 | 綾川ジュニア | 綾川 | `ayakawa` | 中学 綾川=`ayakawa` |
| 茨城県 | 下妻クラブJr. | 下妻 | `shimozuma` | 高校 下妻一=`shimozumaichi` |
| 北海道 | 岩見沢少年団 | 岩見沢 | `iwamizawa` | 高校 岩見沢東=`iwamizawahigashi` |
| 京都府 | 亀岡スポ少 | 亀岡 | `kameoka` | 高校 亀岡=`kameoka` |
| 佐賀県 | 牛津ジュニアクラブ | 牛津 | `ushizu` | 高校 牛津=`ushizu` |
| 島根県 | 江津ジュニア | 江津 | `goutsu` | 高校 江津=`goutsu` |
| 高知県 | 高知ジュニアクラブ | 高知 | `kouchi` | 高校 高知小津=`kouchiozu` |
| 栃木県 | 黒磯ジュニア | 黒磯 | `kuroiso` | 高校 黒磯南=`kuroisominami` |
| 富山県 | 城端スポーツ少年団 | 城端 | `jouhana` | 中学 城端中学校=`jouhana` |
| 和歌山県 | 新宮ＳＴＣ | 新宮 | `shinguu` | 高校 新宮・新翔=`shinguushinshou` |
| 東京都 | 千歳クラブ | 千歳 | `chitose` | 高校 千歳=`chitose` |
| 秋田県 | 増田ジュニア | 増田 | `masuda` | 高校 増田=`masuda` |
| 福岡県 | 男塾 | 男塾 | `otokojuku` | 中学 男塾=`otokojuku` |
| 愛知県 | 日進ジュニア | 日進 | `nisshin` | 高校 日進西=`nisshinnishi` |
| 静岡県 | 富士宮スポーツ少年団 | 富士宮 | `fujinomiya` | 高校 富士宮西=`fujinomiyanishi` |
| 石川県 | 宝ジュニアクラブ | 宝 | `takara` | 中学 宝達中学校=`takaratooru` |
| 山形県 | 余目スポ少 | 余目 | `amarume` | 中学 余目中学校=`amarume` |
| 茨城県 | 霞ヶ浦クラブ | 霞ヶ浦 | `kasumikeura` | 高校 霞ヶ浦=`kasumikeura` |
| 山口県 | 光ジュニア | 光 | `hikari` | 高校 光=`hikari` |
| 佐賀県 | 鹿島ジュニア | 鹿島 | `kashima` | 高校 鹿島=`kashima` |
| 茨城県 | 水戸スポーツ少年団 | 水戸 | `mito` | 高校 水戸女子=`mitojoshi` |
| 島根県 | 大社スポーツ少年団 | 大社 | `taisha` | 高校 大社=`taisha` |
| 愛知県 | 東海ジュニア | 東海 | `toukai` | 高校 東海大相模=`toukaidaisagami` |
| 秋田県 | 白神JSTC | 白神 | `shirakami` | 中学 白神JSTC=`shirakamijstc` |

## D. 対象外: 地名部分に漢字が無い（36件）

pykakasi の誤読は起きない。カタカナ・英字はローマ字化の規約どおりに落ちる。

PUERICLUB（大分県・24） / ＢＣファイターズ（栃木県・20） / はすみスポーツ少年団（島根県・20） / わかくさ（埼玉県・20） / T.Mクラブ（奈良県・17） / スターキッズ（宮崎県・16） / FSTA（東京都・15） / Ｓｈｉｎｇｕ-ＪＳＴ（福岡県・15） / ニューウィンズクラブ（奈良県・15） / ＫＳＴＣ（三重県・13） / ＳＴＣキッズ（山口県・13） / みらいジュニア（茨城県・12） / あかぼりＪＳＴ（群馬県・11） / しらかわジュニア（福島県・11） / スマイリー（群馬県・11） / アイビージュニア（徳島県・10） / さざジュニア（長崎県・10） / しもきたSTC（青森県・9） / ダンディズム（岡山県・9） / フェニックスJr.（広島県・9） / スマイリーＳＴＣ（群馬県・8） / ふれあいクラブジュニア（千葉県・8） / ＡＪクラブ（愛知県・7） / クレイスポ少（京都府・7） / ふれあいクラブジュニア（富山県・7） / KSTクラブパレット（石川県・6） / UniteJunior（千葉県・6） / いすみジュニア（千葉県・6） / エナジーJSTC（岡山県・6） / おもろ７８（沖縄県・6） / かなんジュニアクラブ（大阪府・6） / Ｌ．Ｃ．Ｃ．（和歌山県・5） / ＭＣＤ（茨城県・5） / Willスポーツ（青森県・5） / かずさスマイリーズ（千葉県・5） / リベロスポーツクラブ（青森県・5）

