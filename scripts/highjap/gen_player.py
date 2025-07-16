# python gen_player.py |sed s/$/,/ |pbcopy 

import json
import re

# 選手情報（正式チーム名を含む）
player_lines = """
北海道	北海道滝川西高等学校	團塚　虹陽	
北海道	北海道滝川西高等学校	常盤　奏翔	
北海道	北海道帯広農業高等学校	中村　歩夢	
北海道	北海道科学大学高等学校	西　拓郎	
北海道	とわの森三愛高等学校	宇野　廉太朗	
北海道	とわの森三愛高等学校	岩城　啓太	
北海道	北海道科学大学高等学校	竹村　純生	
北海道	北海道岩見沢東高等学校	坂本　桔平	
青森	八戸工業大学第一高校	荒関　拓斗	
岩手	岩手県立盛岡工業高校	吉田　蓮	
宮城	東北高等学校	水木　洸	
秋田	秋田県立秋田北鷹高校	猪股　悠志	
山形	羽黒高等学校	木皿　璃夢斗	
福島	福島県立田村高等学校	吉田　拓翔	
東京	早稲田大学系属早稲田実業学校高等部	伊藤　幹太	
神奈川	東海大学付属相模高等学校	原田　興勇	
埼玉	埼玉県立松山高等学校	長島　綾汰	
千葉	木更津総合高等学校	昼間　悠佑	
茨城	霞ヶ浦高等学校	髙嶋　雅弥	
栃木	宇都宮工業高等学校	保利　彰大	
群馬	群馬県立高崎商業高等学校	大塚　陸玖	
新潟	北越高等学校	高澤　颯	
長野	長野俊英高等学校	岩吉　海利	
富山	富山県立桜井高等学校	大家　健慎	
石川	石川県立能登高等学校	藤木　晴叶	
福井	福井県立金津高等学校	佐藤　雅紀	
山梨	山梨県立笛吹高等学校	有村　翔空	
愛知	岡崎城西高等学校	長濱　瑠飛	
静岡	静岡県立富士宮北高等学校	乾　楓雅	
三重	三重高等学校	盛岡　昂生	
岐阜	中京高等学校	花田　健心	
大阪	上宮高等学校	林　宏介	
兵庫	尼崎市立尼崎高等学校	岩田　悠聖	
京都	京都文教高等学校	坂手　拓海	
滋賀	立命館守山高等学校	村井　晋之介	
奈良	大和高田市立高田商業高等学校	樋口　大翔	
和歌山	和歌山北高校	小林　直樹	
鳥取	米子松蔭高等学校	下村　駿太	
島根	島根県立松江工業高校	尾島　涼太	
岡山	岡山理科大学附属高等学校	青木　晴弥	
広島	尾道高等学校	岩永　優真	
山口	山口県立南陽工業高等学校	山本　隼平	
徳島	徳島県立富岡東高等学校	花垣　陸	
香川	尽誠学園高等学校	小山　寛晴	
愛媛	新田高等学校	毛利　航太	
高知	明徳義塾高等学校	木本　琉偉	
福岡	東福岡高等学校	伊藤　駿平	
佐賀	佐賀県立嬉野高等学校	松尾　優希	
長崎	長崎南山高等学校	白濱　凪騎	
熊本	ルーテル学院高等学校	野中　翔太	
大分	大分高等学校	坂口　竣亮	
宮崎	宮崎県立都城商業高等学校	森　良輔	
鹿児島	鹿児島実業高等学校	河野　晃大	
沖縄	沖縄県立那覇西高等学校	細川　大峨	
香川	尽誠学園高等学校	坂口　生磨	
三重	三重高等学校	南　龍之介	
奈良	大和高田市立高田商業高等学校	植田　璃音	
大阪	上宮高等学校	福田　喜大	
宮崎	宮崎県立都城商業高等学校	川﨑　康平	
秋田	秋田県立大曲高等学校	伊藤　麗央	
群馬	群馬県立高崎高等学校	大河原　兜	
和歌山	近畿大学附属和歌山高等学校	福岡　直翔	
山口	山口県立宇部高等学校	新原　慶	
大分	大分県立大分商業高校	紀野　文汰	
あ	学校	あ　あ
""".strip()

# トーナメント表（空白含む）
tournament_lines = """
1 團 塚 虹 陽 ( 北 海 道 ： 滝 川 西 )
2 花 垣 陸 ( 徳 島 県 ： 富 岡 東 )
3 小 林 直 樹 (和歌山県：和歌山北)
4 乾 楓 雅 ( 静岡県：富士宮北)
5 髙 嶋 雅 弥 ( 茨 城 県 ： 霞 ヶ 浦 )
6 岩 吉 海 利 ( 長野県：長野俊英)
7 新 原 慶 ( 山 口 県 ： 宇 部 )
8 樋 口 大 翔 ( 奈 良 県 ： 高 田 商 )
9 荒 関 拓 斗 (青森県：八戸工大一)
10 小 山 寛 晴 ( 香川県：尽誠学園)
11 竹 村 純 生 ( 北 海 道 ： 北 科 大 )
12 有 村 翔 空 ( 山 梨 県 ： 笛 吹 )
13 林 宏 介 ( 大 阪 府 ： 上 宮 )
14 大 塚 陸 玖 ( 群 馬 県 ： 高 崎 商 )
15 花 田 健 心 ( 岐 阜 県 ： 中 京 )
16 木 本 琉 偉 ( 高知県：明徳義塾)
17 下 村 駿 太 ( 鳥取県：米子松蔭)
18 猪 股 悠 志 ( 秋田県：秋田北鷹)
19 野 中 翔 太 (熊本県：ルーテル学院)
20 毛 利 航 太 ( 愛 媛 県 ： 新 田 )
21 長 濱 瑠 飛 ( 愛知県：岡崎城西)
22 川 﨑 康 平 ( 宮 崎 県 ： 都 城 商 )
23 宇 野 廉太朗 (北海道：とわの森三愛)
24 南 龍之介 ( 三 重 県 ： 三 重 )
25 青 木 晴 弥 (岡山県：岡山理大附属)
26 佐 藤 雅 紀 ( 福 井 県 ： 金 津 )
27 村 井 晋之介 (滋賀県：立命館守山)
28 坂 口 竣 亮 ( 大 分 県 ： 大 分 )
29 原 田 興 勇 (神奈川県：東海大相模)
30 昼 間 悠 佑 (千葉県：木更津総合)
31 中 村 歩 夢 ( 北 海 道 ： 帯 広 農 )
32 伊 藤 幹 太 ( 東京都：早稲田実)
33 常 盤 奏 翔 ( 北 海 道 ： 滝 川 西 )
34 吉 田 拓 翔 ( 福 島 県 ： 田 村 )
35 白 濱 凪 騎 ( 長崎県：長崎南山)
36 河 野 晃 大 (鹿児島県：鹿児島実)
37 坂 手 拓 海 ( 京都府：京都文教)
38 岩 永 優 真 ( 広 島 県 ： 尾 道 )
39 尾 島 涼 太 ( 島 根 県 ： 松 江 工 )
40 大 家 健 慎 ( 富 山 県 ： 桜 井 )
41 岩 城 啓 太 (北海道：とわの森三愛)
42 福 岡 直 翔 (和歌山県：近大和歌山)
43 大河原 兜 ( 群 馬 県 ： 高 崎 )
44 福 田 喜 大 ( 大 阪 府 ： 上 宮 )
45 岩 田 悠 聖 ( 兵 庫 県 ： 市 尼 崎 )
46 保 利 彰 大 ( 栃木県：宇都宮工)
47 伊 藤 麗 央 ( 秋 田 県 ： 大 曲 )
48 松 尾 優 希 ( 佐 賀 県 ： 嬉 野 )
49 坂 本 桔 平 ( 北海道：岩見沢東)
50 伊 藤 駿 平 ( 福 岡 県 ： 東 福 岡 )
51 植 田 璃 音 ( 奈 良 県 ： 高 田 商 )
52 高 澤 颯 ( 新 潟 県 ： 北 越 )
53 森 良 輔 ( 宮 崎 県 ： 都 城 商 )
54 山 本 隼 平 ( 山 口 県 ： 南 陽 工 )
55 細 川 大 峨 ( 沖 縄 県 ： 那 覇 西 )
56 紀 野 文 汰 ( 大 分 県 ： 大 分 商 )
57 坂 口 生 磨 ( 香川県：尽誠学園)
58 吉 田 蓮 ( 岩 手 県 ： 盛 岡 工 )
59 木 皿 璃夢斗 ( 山 形 県 ： 羽 黒 )
60 水 木 洸 ( 宮 城 県 ： 東 北 )
61 藤 木 晴 叶 ( 石 川 県 ： 能 登 )
62 長 島 綾 汰 ( 埼 玉 県 ： 松 山 )
63 西 拓 郎 ( 北 海 道 ： 北 科 大 )
64 盛 岡 昂 生 ( 三 重 県 ： 三 重 )
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
