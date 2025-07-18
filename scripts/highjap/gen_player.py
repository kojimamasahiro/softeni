# python gen_player.py |sed s/$/,/ |pbcopy 

import json
import re

# 選手情報（正式チーム名を含む）
player_lines = """
北海道	北海道滝川西高等学校	新井　樹	
北海道	北海道旭川工業高等学校	川原　和馬	
北海道	北海道北見北斗高等学校	前谷　碧人	
北海道	北海道科学大学高等学校	西　拓郎	
北海道	とわの森三愛高等学校	太田　遥来	
北海道	北海道科学大学高等学校	根田　大地	
北海道	とわの森三愛高等学校	長南　理大	
北海道	北海道苫小牧工業高等学校	西　健太	
青森	青森県立弘前実業高等学校	樋口　拓海	
岩手	一関学院高等学校	東　脩蔵	
宮城	東北高等学校	浅見　竣一朗	
秋田	秋田県立花輪高等学校	畠山　颯太	
山形	羽黒高等学校	木皿　璃夢斗	
福島	福島県立田村高等学校	草野　春真	
東京	早稲田大学系属早稲田実業学校高等部	伊藤　幹太	
神奈川	神奈川県立秦野高等学校	青木　真尋	
埼玉	埼玉県立松山高等学校	長島　綾汰	
千葉	木更津総合高等学校	昼間　悠佑	
茨城	霞ヶ浦高等学校	谷口　健斗	
栃木	宇都宮短期大学附属高等学校	峯　一誠	
群馬	東京農業大学第二高等学校	間庭　賢人	
新潟	新潟産業大学附属高等学校	青木　優河	
長野	長野県飯田OIDE長姫高等学校	小林　健太	
富山	富山県立高岡商業高等学校	西川　陽都	
石川	小松大谷高等学校	古橋　迅	
福井	福井県立金津高等学校	今井　奏良	
山梨	山梨県立笛吹高等学校	依田　翔	
愛知	岡崎城西高等学校	板倉　豪	
静岡	静岡県立富士宮北高等学校	青山　倫大	
三重	三重高等学校	森　煌大	
岐阜	中京高校	工藤　康治朗	
大阪	上宮高等学校	清水　駿	
兵庫	神戸星城高等学校	岩井　亮樹	
京都	京都府立南丹高等学校	髙垣　佳弘	
滋賀	立命館守山高等学校	村井　晋之介	
奈良	大和高田市立高田商業高等学校	植田　璃音	
和歌山	和歌山県立和歌山北高等学校	松場　淳生	
鳥取	米子松蔭高等学校	吉川　恵大	
島根	島根県立松江工業高校	安達　諒大	
岡山	岡山理科大学附属高等学校	足利　颯太	
広島	尾道高等学校	大曲　李空	
山口	山口県立南陽工業高等学校	吉田　陸人	
徳島	徳島県立つるぎ高等学校	髙井　凌凱	
香川	尽誠学園高等学校	野本　凌生	
愛媛	新田高等学校	毛利　航太	
高知	明徳義塾高等学校	佐渡　宝来	
福岡	大牟田高等学校	山下　凱空	
佐賀	佐賀県立嬉野高等学校	木下　琉希	
長崎	長崎県立大村工業高等学校	原田　柊	
熊本	ルーテル学院高等学校	野中　翔太	
大分	大分県立大分商業高等学校	衞藤　結生	
宮崎	都城東高等学校	大山　瑠偉	
鹿児島	鹿児島市立鹿児島商業高等学校	白井　大希	
沖縄	沖縄県立那覇西高等学校	細川　大峨	
香川	尽誠学園高等学校	米川　雅翔	
香川	尽誠学園高等学校	坂口　生磨	
奈良	大和高田市立高田商業高等学校	安達　宣	
愛知	岡崎城西高等学校	塚本　星弥	
岡山	岡山理科大学附属高等学校	小泉　瑠唯	
埼玉	昌平高等学校	熊木　暖人	
愛知	大同大学大同高等学校	鳥居　悠人	
山口	徳山工業高等専門学校	木村　颯	
愛媛	愛媛県立今治工業高等学校	濱川　響輝	
宮崎	宮崎県立都城商業高等学校	稲丸　獅道	
あ	学校	あ　あ	
""".strip()
# あ	学校	あ　あ
# トーナメント表（空白含む）
tournament_lines = """
1 大 曲 李 空 ( 広 島 県 ： 尾 道 )
2 根 田 大 地 (北海道：北科大高)
3 吉 川 恵 大 (鳥取県：米子松蔭)
4 清 水 駿 ( 大 阪 府 ： 上 宮 )
5 坂 口 生 磨 (香川県：尽誠学園)
6 安 達 諒 大 ( 島 根 県 ： 松 江 工 )
7 稲 丸 獅 道 ( 宮 崎 県 ： 都 城 商 )
8 工 藤 康治朗 ( 岐 阜 県 ： 中 京 )
9 川 原 和 馬 ( 北 海 道 ： 旭 川 工 )
10 足 利 颯 太 (岡山県：岡山理大附)
11 野 中 翔 太 (熊本県：ルーテル学院)
12 吉 田 陸 人 ( 山 口 県 ： 南 陽 工 )
13 髙 井 凌 凱 ( 徳 島 県 ： つ る ぎ )
14 安 達 宣 ( 奈 良 県 ： 高 田 商 )
15 西 川 陽 都 ( 富 山 県 ： 高 岡 商 )
16 岩 井 亮 樹 (兵庫県：神戸星城)
17 小 林 健 太 (長野県：OIDE長姫)
18 峯 一 誠 (栃木県：宇都宮短大附)
19 西 拓 郎 (北海道：北科大高)
20 村 井 晋之介 (滋賀県：立命館守山)
21 青 山 倫 大 (静岡県：富士宮北)
22 畠 山 颯 太 ( 秋 田 県 ： 花 輪 )
23 松 場 淳 生 (和歌山県：和歌山北)
24 塚 本 星 弥 (愛知県：岡崎城西)
25 長 島 綾 汰 ( 埼 玉 県 ： 松 山 )
26 前 谷 碧 人 (北海道：北見北斗)
27 昼 間 悠 佑 (千葉県：木更津総合)
28 東 脩 蔵 (岩手県：一関学院)
29 細 川 大 峨 ( 沖 縄 県 ： 那 覇 西 )
30 谷 口 健 斗 ( 茨 城 県 ： 霞 ヶ 浦 )
31 今 井 奏 良 ( 福 井 県 ： 金 津 )
32 毛 利 航 太 ( 愛 媛 県 ： 新 田 )
33 植 田 璃 音 ( 奈 良 県 ： 高 田 商 )
34 山 下 凱 空 ( 福 岡 県 ： 大 牟 田 )
35 青 木 真 尋 ( 神 奈 川 県 ： 秦 野 )
36 浅 見 竣一朗 ( 宮 城 県 ： 東 北 )
37 小 泉 瑠 唯 (岡山県：岡山理大附)
38 西 健 太 (北海道：苫小牧工)
39 青 木 優 河 (新潟県：新潟産大附属)
40 米 川 雅 翔 (香川県：尽誠学園)
41 板 倉 豪 (愛知県：岡崎城西)
42 原 田 柊 ( 長 崎 県 ： 大 村 工 )
43 太 田 遥 来 (北海道：とわの森三愛)
44 大 山 瑠 偉 ( 宮 崎 県 ： 都 城 東 )
45 木 村 颯 (山口県：徳山高専)
46 白 井 大 希 (鹿児島県：鹿児島商)
47 伊 藤 幹 太 (東京都：早稲田実)
48 濱 川 響 輝 ( 愛 媛 県 ： 今 治 工 )
49 熊 木 暖 人 ( 埼 玉 県 ： 昌 平 )
50 鳥 居 悠 人 (愛知県：大同大学大同)
51 古 橋 迅 (石川県：小松大谷)
52 佐 渡 宝 来 (高知県：明徳義塾)
53 長 南 理 大 (北海道：とわの森三愛)
54 木 下 琉 希 ( 佐 賀 県 ： 嬉 野 )
55 髙 垣 佳 弘 ( 京 都 府 ： 南 丹 )
56 野 本 凌 生 (香川県：尽誠学園)
57 衞 藤 結 生 ( 大 分 県 ： 大 分 商 )
58 新 井 樹 ( 北 海 道 ： 滝 川 西 )
59 木 皿 璃夢斗 ( 山 形 県 ： 羽 黒 )
60 森 煌 大 ( 三 重 県 ： 三 重 )
61 依 田 翔 ( 山 梨 県 ： 笛 吹 )
62 樋 口 拓 海 ( 青 森 県 ： 弘 前 実 )
63 間 庭 賢 人 (群馬県：東農大二)
64 草 野 春 真 ( 福 島 県 ： 田 村 )
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
