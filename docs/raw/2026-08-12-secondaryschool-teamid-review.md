# teamId 目視確認リスト（未確認ぶんのみ）

生成 2026-08-12。**override 済み 23件を除いた 250件**（全 273件）。

`data/secondaryschool/team-id-overrides.json` に `"チーム名": "正しいスラッグ"` を書くと上書きできる。
書いたあと `npm run secondaryschool:build` を流し直し、`npm run secondaryschool:teamid-todo` でこのリストを再生成すると
確認済みが消えて残りだけになる。

## 書くときの規約

- **長音は `ou` / `uu` を残す**（高校に合わせる）。`昇陽`→`shouyou`、`京都光華`→`kyoutokouka`
- 「中学校」「◯◯市立」「ソフトテニス」は落とす。クラブ→club / ジュニア→junior / ユース→youth
- 固有名詞のカタカナはローマ字のまま（`レペゼン千葉`→`repezenchiba`）
- **同名の学校が高校側にあるときは `scripts/highschool/01team/team_id_map.json` を先に確認**
  （相洋は高校側が `soyo` なので中学も `soyo` に合わせた）
- teamId は**県内で一意**であればよい。県が違えば同じスラッグでも問題ない

## 漢字を含む（読みを誤りやすい）: 217件

出場回数の多い順。★は進路の掲載件数で、**★が付くチームは高校ページからもリンクされる**ので優先度が高い。

| チーム名 | 都道府県 | teamId | 出場 | 進路 |
|---|---|---|---|---|
| 清明学園中学校 | 東京都 | `seimeigakuen` | 53 | ★3 |
| 奈良LEGENDS | 奈良県 | `naralegends` | 44 |  |
| 羽須美中学校 | 島根県 | `hasumi` | 34 | ★3 |
| 群馬 | 群馬県 | `gunma` | 32 |  |
| 松山中学校 | 埼玉県 | `matsuyama` | 31 |  |
| S×CREW | 高知県 | `sxcrew` | 28 |  |
| 日野フレンズ | 鳥取県 | `hinofurenzu` | 28 |  |
| 能美Jr.STARS | 石川県 | `nomijrstars` | 27 | ★1 |
| 横芝中学校 | 千葉県 | `yokoshiba` | 25 | ★2 |
| 男塾 | 福岡県 | `otokojuku` | 25 | ★1 |
| 今治S.O.C | 愛媛県 | `imabarisoc` | 22 |  |
| 王寺ユースクラブ | 奈良県 | `oujiyouthclub` | 21 |  |
| 国分寺JSC | 香川県 | `kokubunjijsc` | 20 |  |
| 静内クラブ | 北海道 | `shizunaiclub` | 20 | ★1 |
| 名寄中学校 | 北海道 | `nayoro` | 19 | ★2 |
| 札幌大谷中学校 | 北海道 | `sapporoootani` | 18 | ★3 |
| 三国クラブ | 福井県 | `mikuniclub` | 18 |  |
| 山陽学園中学校 | 岡山県 | `sanyougakuen` | 18 | ★4 |
| 筑西STC | 茨城県 | `chikuseistc` | 18 |  |
| 朝日中学校 | 愛知県 | `asahi` | 18 | ★2 |
| 長野JSTC | 長野県 | `naganojstc` | 18 |  |
| 奈良まほろばクラブ | 奈良県 | `naramahorobaclub` | 18 | ★1 |
| 綾瀬チャレンジ | 神奈川県 | `ayasecharenji` | 17 |  |
| 芝東中学校 | 埼玉県 | `shibahigashi` | 17 | ★2 |
| effort伊勢 | 三重県 | `effortise` | 16 |  |
| NASTCユース | 秋田県 | `nastcyouth` | 16 |  |
| レグルス鹿島 | 佐賀県 | `regurusukashima` | 16 |  |
| 安芸STC | 広島県 | `akistc` | 16 |  |
| 茨城 | 茨城県 | `ibaraki` | 16 |  |
| 向陽台中学校 | 宮城県 | `kouyoudai` | 16 | ★1 |
| 埼玉 | 埼玉県 | `saitama` | 16 |  |
| 桜S.T.C | 佐賀県 | `sakurastc` | 16 | ★1 |
| 山梨 | 山梨県 | `yamanashi` | 16 |  |
| 神奈川 | 神奈川県 | `kanagawa` | 16 |  |
| 千葉 | 千葉県 | `chiba` | 16 |  |
| 土浦クラブ | 茨城県 | `tsuchiuraclub` | 16 | ★2 |
| 東京 | 東京都 | `toukyou` | 16 |  |
| 栃木 | 栃木県 | `tochigi` | 16 |  |
| 芳賀中学校 | 栃木県 | `haga` | 16 | ★4 |
| 仙台白百合学園中学校 | 宮城県 | `sendaishirayurigakuen` | 15 |  |
| 秩父第一中学校 | 埼玉県 | `chichibudaiichi` | 15 |  |
| レペゼン千葉 | 千葉県 | `repezenchiba` | 14 |  |
| 安曇川中学校 | 滋賀県 | `adogawa` | 14 |  |
| 吉富中学校 | 福岡県 | `yoshitomi` | 14 |  |
| 神崎 | 大分県 | `kanzaki` | 14 |  |
| 西袋中学校 | 福島県 | `nishibukuro` | 14 | ★3 |
| 中野中学校 | 岩手県 | `nakano` | 14 | ★1 |
| 豊田健友クラブ | 静岡県 | `toyodakenyuuclub` | 14 |  |
| 留萌市立留萌中学校 | 北海道 | `rumoi` | 14 |  |
| NCT長崎 | 長崎県 | `nctnagasaki` | 13 | ★1 |
| 桑名STC | 三重県 | `kuwanastc` | 13 |  |
| 甲賀中学校 | 滋賀県 | `kouka` | 13 |  |
| 能登1st | 石川県 | `noto1st` | 13 |  |
| 鉢盛クラブ | 長野県 | `hachijouclub` | 13 | ★3 |
| ガナドール福島 | 福島県 | `ganadoorufukushima` | 12 |  |
| 阿波中学校 | 徳島県 | `awa` | 12 |  |
| 岩見沢市立光陵中学校 | 北海道 | `hikariryou` | 12 |  |
| 清明 | 東京都 | `seimei` | 12 |  |
| 胎内JSTC | 新潟県 | `tainaijstc` | 12 |  |
| 中広中学校 | 広島県 | `nakahiro` | 12 |  |
| 土佐女子中学校 | 高知県 | `tosajoshi` | 12 | ★1 |
| けたかSTC | 鳥取県 | `ketakastc` | 11 |  |
| 印南STC | 和歌山県 | `innamistc` | 11 |  |
| 因伯STC | 鳥取県 | `inhakustc` | 11 |  |
| 刈谷朝日クラブ | 愛知県 | `kariyaasahiclub` | 11 |  |
| 群馬中央中学校 | 群馬県 | `gunmachuuou` | 11 |  |
| 庄川ＳＴＡ | 富山県 | `shougawasta` | 11 |  |
| 大津中学校 | 兵庫県 | `ootsu` | 11 | ★1 |
| 白神JSTC | 秋田県 | `shirakamijstc` | 11 |  |
| 姫路ふぁみりークラブ | 兵庫県 | `himejifamiriiclub` | 11 | ★2 |
| 野木中学校 | 栃木県 | `nogi` | 11 |  |
| 琴平中学校 | 香川県 | `kotohira` | 10 | ★1 |
| 佐那河内中学校 | 徳島県 | `sanagouchi` | 10 |  |
| 取手第一中学校 | 茨城県 | `toridedaiichi` | 10 | ★1 |
| 城端中学校 | 富山県 | `jouhana` | 10 | ★2 |
| 水沢南中学校 | 岩手県 | `mizusawaminami` | 10 |  |
| 大宜味中学校 | 沖縄県 | `oogimi` | 10 |  |
| 中山中学校 | 山形県 | `nakayama` | 10 | ★1 |
| 浜頓別ソフトテニス少年団 | 北海道 | `hamatonbetsushounendan` | 10 |  |
| 附属旭川中学校 | 北海道 | `fuzokuasahikawa` | 10 | ★1 |
| 湊山中学校 | 鳥取県 | `minatoyama` | 10 | ★1 |
| 和歌山信愛中学校 | 和歌山県 | `wakayamashinai` | 10 | ★2 |
| あおもりS.T.C. | 青森県 | `aomoristc` | 9 |  |
| 江別市立中央中学校 | 北海道 | `chuuou` | 9 |  |
| 秦野フレンドリー | 神奈川県 | `hadanofurendorii` | 9 |  |
| 東長崎 | 長崎県 | `higashinagasaki` | 9 | ★1 |
| 苫小牧光洋Wings | 北海道 | `tomakomaikouyouwings` | 9 |  |
| 苫小牧西Jr.STC | 北海道 | `tomakomainishijrstc` | 9 |  |
| 旭川啓北 | 北海道 | `asahikawakeikita` | 8 | ★2 |
| 羽ノ浦中学校 | 徳島県 | `hanenoura` | 8 | ★3 |
| 岡南ＳＴＣ | 岡山県 | `kounanstc` | 8 |  |
| 加木屋中学校 | 愛知県 | `kakiya` | 8 | ★2 |
| 岩見沢少年団 | 北海道 | `iwamizawashounendan` | 8 |  |
| 七宝 | 愛知県 | `shippou` | 8 |  |
| 篠山中学校 | 愛媛県 | `shinoyama` | 8 | ★2 |
| 射水オールスターズ | 富山県 | `imizuoorusutaazu` | 8 |  |
| 西脇南中学校 | 兵庫県 | `nishiwakiminami` | 8 |  |
| 赤堀中学校 | 群馬県 | `akahori` | 8 |  |
| 双葉台STC | 茨城県 | `futabadaistc` | 8 |  |
| 大河原中学校 | 宮城県 | `oogawara` | 8 |  |
| 大台中学校 | 三重県 | `oodai` | 8 | ★1 |
| 大矢野中学校 | 熊本県 | `ooyano` | 8 | ★1 |
| 中央台南中学校 | 福島県 | `chuuoutainan` | 8 | ★1 |
| 長島ITC | 長崎県 | `nagashimaitc` | 8 |  |
| 登別市地域クラブ | 北海道 | `noboribetsushichiikiclub` | 8 |  |
| 宝達中学校 | 石川県 | `takaratooru` | 8 | ★3 |
| 北見市立南中学校 | 北海道 | `nanchuugakkou` | 8 |  |
| 北仙台中学校 | 宮城県 | `kitasendai` | 8 | ★2 |
| 余目中学校 | 山形県 | `amarume` | 8 |  |
| 羅臼町立知床未来中学校 | 北海道 | `shiretokomirai` | 8 |  |
| 蘭越町立蘭越中学校 | 北海道 | `rankoshi` | 8 |  |
| MKクラブ | 静岡県 | `mkclub` | 7 |  |
| さきがけTOクラブ | 広島県 | `sakigaketoclub` | 7 |  |
| テニ研クラブ | 福島県 | `tenikenclub` | 7 |  |
| どんぐり垂水 | 鹿児島県 | `donguritarumi` | 7 |  |
| 益田中学校 | 島根県 | `masuda` | 7 | ★1 |
| 玉城 | 沖縄県 | `tamaki` | 7 |  |
| 近大和歌山 | 和歌山県 | `kindaiwakayama` | 7 |  |
| 釧路リバティクラブ | 北海道 | `kushiroribateiclub` | 7 |  |
| 穴吹 | 徳島県 | `anabuki` | 7 |  |
| 御津中学校 | 兵庫県 | `mito` | 7 |  |
| 甲南中学校 | 滋賀県 | `kounan` | 7 |  |
| 行方STC | 茨城県 | `namegatastc` | 7 |  |
| 三原JST | 広島県 | `miharajst` | 7 | ★3 |
| 城陽 | 京都府 | `jouyou` | 7 |  |
| 垂水中央 | 鹿児島県 | `tarumichuuou` | 7 | ★2 |
| 杉戸中学校 | 埼玉県 | `sugito` | 7 |  |
| 浅川中学校 | 山梨県 | `asakawa` | 7 |  |
| 多治見中学校 | 岐阜県 | `tajimi` | 7 |  |
| 大田原Jr.STEP | 栃木県 | `ootawarajrstep` | 7 |  |
| 那須塩原STS | 栃木県 | `nasushiobarasts` | 7 |  |
| 日高中学校 | 和歌山県 | `hidaka` | 7 |  |
| 八代第六中学校 | 熊本県 | `yatsushirodairoku` | 7 |  |
| 飛鳥インドアクラブ | 奈良県 | `asukaindoaclub` | 7 |  |
| 氷見北部中学校 | 富山県 | `himihokubu` | 7 | ★1 |
| 武生第三 | 福井県 | `takefudaisan` | 7 | ★2 |
| 福部STC | 鳥取県 | `fukubestc` | 7 |  |
| 宝塚中学校 | 兵庫県 | `takarazuka` | 7 |  |
| 北海道教育大学附属旭川中学校 | 北海道 | `hokkaidoukyouikudaigakufuzokuasahikawa` | 7 |  |
| 北海道登別明日中等教育学校 | 北海道 | `hokkaidounoboribetsuashita` | 7 |  |
| NEXUS高知 | 高知県 | `nexuskouchi` | 6 |  |
| Ｖｏｌａｒｅ四日市ＳＴＣ | 三重県 | `volareyokkaichistc` | 6 |  |
| インフィニティ水沢STC | 岩手県 | `infiniteimizusawastc` | 6 |  |
| ネクサス兵庫 | 兵庫県 | `nekusasuhyougo` | 6 | ★1 |
| 綾川 | 香川県 | `ayakawa` | 6 |  |
| 稲城第三中学校 | 東京都 | `inagidaisan` | 6 |  |
| 羽村USC | 東京都 | `hamurausc` | 6 |  |
| 吉田中学校 | 山梨県 | `yoshida` | 6 |  |
| 九度山中学校 | 和歌山県 | `kudoyama` | 6 |  |
| 釧路市立鳥取西中学校 | 北海道 | `tottorinishi` | 6 |  |
| 甲府西中学校 | 山梨県 | `koufunishi` | 6 |  |
| 高瀬中学校 | 福島県 | `takase` | 6 |  |
| 黒石野中学校 | 岩手県 | `kuroishino` | 6 | ★2 |
| 妻ケ丘 | 宮崎県 | `tsumakeoka` | 6 |  |
| 犀生中学校 | 石川県 | `sainama` | 6 |  |
| 三国中学校 | 福井県 | `mikuni` | 6 |  |
| 篠栗北中学校 | 福岡県 | `sasagurikita` | 6 | ★1 |
| 小山城南 | 栃木県 | `oyamajounan` | 6 |  |
| 小俣 | 三重県 | `omata` | 6 |  |
| 小禄中学校 | 沖縄県 | `oroku` | 6 |  |
| 西有田中学校 | 佐賀県 | `nishiarita` | 6 | ★1 |
| 川崎STC | 神奈川県 | `kawasakistc` | 6 |  |
| 泰阜STC | 長野県 | `yasuokastc` | 6 |  |
| 大磯中学校 | 神奈川県 | `ooiso` | 6 | ★5 |
| 大里 | 静岡県 | `oosato` | 6 | ★3 |
| 丹原東中学校 | 愛媛県 | `tanbarahigashi` | 6 | ★1 |
| 朝日STC | 愛知県 | `asahistc` | 6 | ★1 |
| 長井北中学校 | 山形県 | `nagaikita` | 6 |  |
| 長田 | 長崎県 | `nagata` | 6 |  |
| 土崎中学校 | 秋田県 | `tsuchizaki` | 6 | ★1 |
| 東宇治 | 京都府 | `touuosamu` | 6 |  |
| 東城陽 | 京都府 | `toujouyou` | 6 |  |
| 東谷山 | 鹿児島県 | `azumayayama` | 6 |  |
| 東風平中学校 | 沖縄県 | `kochihira` | 6 |  |
| 日章中学校 | 北海道 | `nisshou` | 6 |  |
| 能登香島中学校 | 石川県 | `notokashima` | 6 |  |
| 富士川 | 山梨県 | `fujigawa` | 6 |  |
| 福井市JSTC | 福井県 | `fukuishijstc` | 6 |  |
| 湊クラブ | 茨城県 | `minatoclub` | 6 |  |
| B・wing | 山形県 | `bwing` | 5 |  |
| Le'a² | 岐阜県 | `lea2` | 5 |  |
| 綾部 | 京都府 | `ayabe` | 5 |  |
| 一宮中学校 | 山梨県 | `ichinomiya` | 5 |  |
| 一本松中学校 | 愛媛県 | `ipponmatsu` | 5 |  |
| 岡山kidsクラブ | 岡山県 | `okayamakidsclub` | 5 |  |
| 下吉田中学校 | 山梨県 | `shimoyoshita` | 5 | ★2 |
| 宮郷中学校 | 群馬県 | `miyasato` | 5 | ★1 |
| 釧路市立共栄中学校 | 北海道 | `kyouei` | 5 |  |
| 厚生 | 三重県 | `kousei` | 5 |  |
| 向原JST | 東京都 | `mukaiharajst` | 5 |  |
| 江別市立江別第一中学校 | 北海道 | `ebetsudaiichi` | 5 |  |
| 札幌市立栄中学校 | 北海道 | `sakaechuugakkou` | 5 |  |
| 七尾中学校 | 石川県 | `nanao` | 5 | ★1 |
| 若宮中学校 | 埼玉県 | `wakamiya` | 5 |  |
| 小松原中学校 | 宮崎県 | `komatsubara` | 5 |  |
| 松元中学校 | 鹿児島県 | `matsumoto` | 5 | ★1 |
| 新津中学校 | 静岡県 | `niitsu` | 5 |  |
| 清武 | 宮崎県 | `kiyotake` | 5 |  |
| 静南クラブ | 静岡県 | `seiminamiclub` | 5 |  |
| 中央中学校 | 熊本県 | `chuuou` | 5 |  |
| 中標津町立広陵中学校 | 北海道 | `kouryou` | 5 |  |
| 鶴城中学校 | 熊本県 | `kakujou` | 5 | ★1 |
| 田辺STC | 和歌山県 | `tanabestc` | 5 |  |
| 田辺クラブ | 和歌山県 | `tanabeclub` | 5 |  |
| 東広島市立向陽中学校 | 広島県 | `kouyou` | 5 |  |
| 当麻町立当麻中学校 | 北海道 | `touma` | 5 |  |
| 奈良育英中学校 | 奈良県 | `naraikuei` | 5 | ★2 |
| 二本松ジュニアSTC | 福島県 | `nihonmatsujuniorstc` | 5 |  |
| 白石 | 宮城県 | `shiroishi` | 5 | ★1 |
| 八雲町立八雲中学校 | 北海道 | `yakumo` | 5 |  |
| 半田球友 | 愛知県 | `handakyuuyuu` | 5 |  |
| 浜田第一中学校 | 島根県 | `hamadadaiichi` | 5 |  |
| 富士宮第四 | 静岡県 | `fujinomiyadaiyon` | 5 |  |
| 平川市スポ少 | 青森県 | `hirakawashisuposhou` | 5 | ★1 |
| 本渡中学校 | 熊本県 | `hondo` | 5 |  |
| 葉栗中 | 愛知県 | `haguri` | 5 |  |
| 黎明 | 千葉県 | `reimei` | 5 |  |

## カタカナ・英数のみ（読みは自明。基本そのままでよい）: 33件

| チーム名 | 都道府県 | teamId | 出場 |
|---|---|---|---|
| スマイリー | 群馬県 | `sumairii` | 17 |
| チェストクラブ | 鹿児島県 | `chesutoclub` | 15 |
| D-club | 富山県 | `dclub` | 34 |
| LIBERTA | 岐阜県 | `liberta` | 32 |
| M's | 山口県 | `ms` | 24 |
| ＵＴＣ | 香川県 | `utc` | 23 |
| iNexus | 島根県 | `inexus` | 20 |
| BLACK ROI | 山形県 | `blackroi` | 18 |
| N.N | 新潟県 | `nn` | 18 |
| GifuTed | 岐阜県 | `gifuted` | 16 |
| QueenBee | 愛知県 | `queenbee` | 15 |
| A.STAR.S | 秋田県 | `astars` | 11 |
| KAMIMINE | 佐賀県 | `kamimine` | 11 |
| Minommy | 岐阜県 | `minommy` | 11 |
| MASTER | 静岡県 | `master` | 10 |
| Volare | 三重県 | `volare` | 10 |
| NIKKOSTC | 栃木県 | `nikkostc` | 9 |
| MSTC | 山形県 | `mstc` | 8 |
| Unite | 千葉県 | `unite` | 8 |
| FUJIYAMA | 静岡県 | `fujiyama` | 7 |
| Lacrima | 山形県 | `lacrima` | 7 |
| NEOGRO | 岐阜県 | `neogro` | 7 |
| SSS | 新潟県 | `sss` | 7 |
| ＢＬＡＳＴ | 愛媛県 | `blast` | 6 |
| Gleam | 沖縄県 | `gleam` | 6 |
| HIRASUPO ace | 青森県 | `hirasupoace` | 6 |
| K-NIGHTS | 岡山県 | `knights` | 6 |
| ＫＥＮＤＡＩ | 群馬県 | `kendai` | 6 |
| Infinity One | 長崎県 | `infinityone` | 5 |
| KUREX | 広島県 | `kurex` | 5 |
| LBL | 滋賀県 | `lbl` | 5 |
| SoftTennisAcademy | 和歌山県 | `softtennisacademy` | 5 |
| STA | 和歌山県 | `sta` | 5 |
