# python gen_player.py |sed s/$/,/ |pbcopy 

import json
import re

# 選手情報（正式チーム名を含む）
player_lines = """
北海道	北海道滝川西高等学校	松坂　拓海	新井　樹
北海道	北海道北見北斗高等学校	宮浦　陽大	前谷　碧人
北海道	旭川実業高等学校	鬼頭　謙弥	米澤　啓太
北海道	とわの森三愛高等学校	長南　理大	太田　遥来
北海道	とわの森三愛高等学校	木原　真樹	宇都　太智
北海道	北海道科学大学高等学校	西　拓郎	小杉　昂道
北海道	北海道科学大学高等学校	根田　大地	倉重　南海
北海道	北海道苫小牧工業高等学校	渡邊　哲平	櫻田　真生
青森	青森県立弘前実業高等学校	工藤　大和	樋口　拓海
岩手	一関学院高等学校	東　脩蔵	及川　莉央
宮城	東北高等学校	浅見　竣一朗	初鹿　暁哉
秋田	秋田県立秋田北鷹高校	因幡　颯汰	片岡　将武
山形	羽黒高等学校	川崎　彪雅	小田　千陽
福島	学校法人石川高等学校	佐藤　良吹	菅原　大馳
東京	駒澤大学高等学校	吉野　僚真	市村　大地
神奈川	東海大学付属相模高等学校	脇田　大吉	斎藤　恭平
埼玉	川越東高等学校	藤田　大雅	平田　泰一
千葉	木更津総合高等学校	笹井　悠月	山中　一世
茨城	霞ヶ浦高等学校	深海　星太	谷口　健斗
栃木	栃木県立宇都宮工業高等学校	金原　遥人	野口　椋平
群馬	東京農業大学第二高等学校	間庭　賢人	市川　悠翔
新潟	新潟産業大学附属高等学校	加藤　颯人	山本　楓也
長野	東京都市大学塩尻高等学校	古幡　悠馬	平林　和真
富山	富山県立高岡商業高等学校	白井　瀬都	清島　一颯
石川	石川県立能登高等学校	藤木　晴叶	出村　虹空
福井	福井県立金津高等学校	髙橋　優矢	渡辺　優希
山梨	山梨県立笛吹高等学校	依田　翔	藤原　奏
愛知	岡崎城西高等学校	板倉　豪	藤本　貫太
静岡	静岡県立富士宮西高等学校	淺倉　岳	鈴木　陽斗
三重	三重高等学校	若林　宝来	中内　謙秀
岐阜	岐阜県立岐阜商業高等学校	樋口　生真	早見　和喜
大阪	上宮高等学校	清水　駿	木内　陸人
兵庫	神戸国際大学附属高等学校	立花　輝	鳥津　颯
京都	京都文教高等学校	坂手　拓海	小杉　優太
滋賀	立命館守山高等学校	小山　悠侍郎	中野　恵多
奈良	大和高田市立高田商業高等学校	川口　隼	阿部　倖大
和歌山	和歌山県立和歌山北高等学校	後藤　優斗	中垣　敬斗
鳥取	米子松蔭高等学校	岸本　悠真	寺村　虎哲
島根	島根県立浜田高等学校	尾門　駿	津田　宙紀
岡山	岡山理科大学附属高等学校	足利　颯太	島谷　楽空
広島	清水ヶ丘高等学校	藤本　晴生	古土井　遼輝
山口	山口県立南陽工業高等学校	吉田　陸人	西岡　青晴
徳島	徳島県立つるぎ高等学校	髙井　凌凱	吉岡　莉玖
香川	尽誠学園高等学校	坂口　生磨	宮田　成将
愛媛	新田高等学校	増本　拓流	仲田　翔磨
高知	明徳義塾高等学校	石川　伊吹	福島　涼
福岡	大牟田高等学校	山下　凱空	吉田　健斗
佐賀	佐賀県立嬉野高等学校	木下　琉希	藤井　智暉
長崎	長崎県立大村工業高等学校	原田　柊	野口　悠晴
熊本	ルーテル学院高等学校	野中　翔太	藪田　陸人
大分	大分県立大分商業高等学校	衞藤　結生	簾　友翔
宮崎	宮崎県立都城商業高等学校	永田　奏輝	山口　準斗
鹿児島	鹿児島市立鹿児島商業高等学校	白井　大希	草地　凌冴
沖縄	沖縄県立八重山高等学校	福本　聖己	髙嶺　大弥
宮城	宮城県仙台第三高等学校	佐原　蒔大	宇都宮　匠
福島	福島県立田村高等学校	相山　昂慧	吉田　拓翔
岩手	岩手県立黒沢尻工業高等学校	竹内　悠真	伊藤　奏太
埼玉	昌平高等学校	池田　功佑	林　凌平
神奈川	神奈川県立秦野高等学校	青木　 真尋	金﨑　隆之介
群馬	群馬県立渋川高等学校	大須賀　聡汰	萩原　滉大
長野	長野俊英高等学校	宮原　渉	寺井　真斗
富山	富山県立富山工業高等学校	佐々木　禅叶	金津　結大
愛知	愛知産業大学三河高等学校	大音　翔和	松本　弥大
静岡	静岡県立富士宮北高等学校	青山　倫大	須田　直樹
兵庫	尼崎市立尼崎高等学校	中塚　善晴	實重　公惺
京都	立命館高等学校	星野　将輝	浜名　良祐
広島	広島県立神辺旭高等学校	清川　颯斗	坂本　賢哉
島根	島根県立松江工業高等学校	尾島　涼太	安達　諒太
愛媛	済美高等学校	西山　春樹	神野　晃希
佐賀	佐賀県立佐賀工業高等学校	山田　枇知	内田　拓真
長崎	長崎日本大学高等学校	桒原　大知	山下　将毅
鹿児島	鹿児島実業高等学校	赤塚　弘樹	原口　陽向
""".strip()
# あ	学校	あ　あ
# トーナメント表（空白含む）
tournament_lines = """
1 西 山 ・ 神 野 ( 愛 媛 県 ： 済 美 )
2 後 藤 ・ 中 垣 (和歌山県：和歌山北)
3 岸 本 ・ 寺 村 (鳥取県：米子松蔭)
4 川 崎 ・ 小 田 ( 山 形 県 ： 羽 黒 )
5 木 原 ・ 宇 都 (北海道：とわの森三愛)
6 福 本 ・ 髙 嶺 ( 沖 縄 県 ： 八 重 山 )
7 池 田 ・ 林 ( 埼 玉 県 ： 昌 平 )
8 山 田 ・ 内 田 ( 佐 賀 県 ： 佐 賀 工 )
9 桒 原 ・ 山 下 (長崎県：長崎日大)
10 佐々木 ・ 金 津 ( 富 山 県 ： 富 山 工 )
11 青 木 ・ 金 﨑 ( 神 奈 川 県 ： 秦 野 )
12 宮 原 ・ 寺 井 (長野県：長野俊英)
13 笹 井 ・ 山 中 (千葉県：木更津総合)
14 大 音 ・ 松 本 (愛知県：愛産大三河)
15 野 中 ・ 藪 田 (熊本県：ルーテル学院)
16 尾 島 ・ 安 達 ( 島 根 県 ： 松 江 工 )
17 竹 内 ・ 伊 藤 (岩手県：黒沢尻工)
18 松 坂 ・ 新 井 ( 北 海 道 ： 滝 川 西 )
19 坂 口 ・ 宮 田 (香川県：尽誠学園)
20 髙 橋 ・ 渡 辺 ( 福 井 県 ： 金 津 )
21 清 川 ・ 坂 本 ( 広 島 県 ： 神 辺 旭 )
22 鬼 頭 ・ 米 澤 ( 北 海 道 ： 旭 川 実 )
23 川 口 ・ 阿 部 ( 奈 良 県 ： 高 田 商 )
24 樋 口 ・ 早 見 (岐阜県：県岐阜商)
25 星 野 ・ 浜 名 ( 京 都 府 ： 立 命 館 )
26 大須賀 ・ 萩原 ( 群 馬 県 ： 渋 川 )
27 吉 田 ・ 西 岡 ( 山 口 県 ： 南 陽 工 )
28 深 海 ・ 谷 口 ( 茨 城 県 ： 霞 ヶ 浦 )
29 白 井 ・ 草 地 (鹿児島県：鹿児島商)
30 相 山 ・ 吉 田 ( 福 島 県 ： 田 村 )
31 吉 野 ・ 市 村 ( 東 京 都 ： 駒 大 )
32 青 山 ・ 須 田 (静岡県：富士宮北)
33 佐 原 ・ 宇都宮 (宮城県：仙台第三)
34 中 塚 ・ 實 重 ( 兵 庫 県 ： 市 尼 崎 )
35 工 藤 ・ 樋 口 ( 青 森 県 ： 弘 前 実 )
36 西 ・ 小 杉 (北海道：北科大高)
37 山 下 ・ 吉 田 ( 福 岡 県 ： 大 牟 田 )
38 依 田 ・ 藤 原 ( 山 梨 県 ： 笛 吹 )
39 木 下 ・ 藤 井 ( 佐 賀 県 ： 嬉 野 )
40 清 水 ・ 木 内 ( 大 阪 府 ： 上 宮 )
41 脇 田 ・ 斎 藤 (神奈川県：東海大相模)
42 足 利 ・ 島 谷 (岡山県：岡山理大付属)
43 渡 邊 ・ 櫻 田 (北海道：苫小牧工)
44 永 田 ・ 山 口 ( 宮 崎 県 ： 都 城 商 )
45 加 藤 ・ 山 本 (新潟県：新潟産大附属)
46 白 井 ・ 清 島 ( 富 山 県 ： 高 岡 商 )
47 藤 木 ・ 出 村 ( 石 川 県 ： 能 登 )
48 髙 井 ・ 吉 岡 ( 徳 島 県 ： つ る ぎ )
49 増 本 ・ 仲 田 ( 愛 媛 県 ： 新 田 )
50 宮 浦 ・ 前 谷 (北海道：北見北斗)
51 浅 見 ・ 初 鹿 ( 宮 城 県 ： 東 北 )
52 小 山 ・ 中 野 (滋賀県：立命館守山)
53 石 川 ・ 福 島 (高知県：明徳義塾)
54 若 林 ・ 中 内 ( 三 重 県 ： 三 重 )
55 間 庭 ・ 市 川 (群馬県：東農大二)
56 尾 門 ・ 津 田 ( 島 根 県 ： 浜 田 )
57 淺 倉 ・ 鈴 木 (静岡県：富士宮西)
58 古 幡 ・ 平 林 (長野県：都市大塩尻)
59 根 田 ・ 倉 重 (北海道：北科大高)
60 佐 藤 ・ 菅 原 (福島県：学法石川)
61 坂 手 ・ 小 杉 (京都府：京都文教)
62 金 原 ・ 野 口 (栃木県：宇都宮工)
63 東 ・ 及 川 (岩手県：一関学院)
64 因 幡 ・ 片 岡 (秋田県：秋田北鷹)
65 藤 本 ・ 古土井 (広島県：清水ヶ丘)
66 赤 塚 ・ 原 口 (鹿児島県：鹿児島実)
67 板 倉 ・ 藤 本 (愛知県：岡崎城西)
68 立 花 ・ 鳥 津 (兵庫県：神戸国際附)
69 原 田 ・ 野 口 ( 長 崎 県 ： 大 村 工 )
70 衞 藤 ・ 簾 ( 大 分 県 ： 大 分 商 )
71 藤 田 ・ 平 田 ( 埼 玉 県 ： 川 越 東 )
72 長 南 ・ 太 田 (北海道：とわの森三愛)
""".strip()

# 空白と半角数字を除去
def normalize_tournament_lines(raw_text):
    return "\n".join([re.sub(r'[ 　0-9]+', '', line) for line in raw_text.strip().splitlines()])

# トーナメント行をパース
def parse_tournament_lines(tournament_lines):
    entries = []
    for line in tournament_lines.strip().splitlines():
        name_part = line.split("(")[0].strip()
        match = re.search(r'（?\s*([^\s：()]+?[都道府県])\s*：\s*([^)）]+)', line)
        if not match:
            continue
        prefecture = match.group(1)
        team = match.group(2)
        last_names = [name.strip() for name in name_part.split("・")]
        entries.append({
            "lastNames": last_names,
            "team": team,
            "prefecture": prefecture
        })
    return entries

# 選手データを辞書化
def build_fullname_dict(player_lines):
    player_map = {}
    for line in player_lines.strip().splitlines():
        cols = line.split("\t")
        if len(cols) != 4:
            continue
        prefecture, school, p1, p2 = cols
        for name in [p1, p2]:
            name = name.strip()
            if "　" not in name:
                continue  # 姓名の区切りがない場合はスキップ
            last, first = name.split("　", 1)
            key = last + first
            player_map[key] = {
                "lastName": last,
                "firstName": first,
                "team": school.strip(),  # 正式名称
                "prefecture": prefecture.strip(),
                "playerId": None,
                "tempId": f"{last}_{first}_{school.strip()}"
            }
    return player_map

# 出力生成（シングルス対応）
def generate_output_with_original_team(player_lines, tournament_lines):
    tournament_data = parse_tournament_lines(tournament_lines)
    player_map = build_fullname_dict(player_lines)
    output = []

    for idx, entry in enumerate(tournament_data, 1):
        abbrev_team = entry["team"]
        full_prefecture = entry["prefecture"]
        info_list = []

        for last_name in entry["lastNames"]:
            match = None
            for key, value in player_map.items():
                if key.startswith(last_name):
                    match = {
                        **value,
                        "originalTeam": value["team"],
                        "team": abbrev_team,
                        "tempId": f"{value['lastName']}_{value['firstName']}_{abbrev_team}"
                    }
                    break
            if match:
                info_list.append({
                    "lastName": match["lastName"],
                    "firstName": match["firstName"],
                    "team": match["team"],
                    "originalTeam": match["originalTeam"],
                    "prefecture": full_prefecture,
                    "playerId": match["playerId"],
                    "tempId": match["tempId"]
                })
            else:
                info_list.append({
                    "lastName": last_name,
                    "firstName": "",
                    "team": abbrev_team,
                    "originalTeam": None,
                    "prefecture": full_prefecture,
                    "playerId": None,
                    "tempId": f"{last_name}_不明_{abbrev_team}"
                })

        output.append({
            "id": idx,
            "name": "・".join(entry["lastNames"]) + f"（{abbrev_team}）",
            "information": info_list,
            "category": "doubles" if len(info_list) > 1 else "singles"
        })

    return output

normalized = normalize_tournament_lines(tournament_lines)
final_output = generate_output_with_original_team(player_lines, normalized)

# JSON出力（1行ずつ）
for item in final_output:
    print(json.dumps(item, ensure_ascii=False))
