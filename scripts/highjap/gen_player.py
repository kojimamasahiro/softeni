import json
import re

# 選手情報（正式チーム名を含む）
player_lines = """
北海道	北海道滝川工業高等学校  佐藤　聖敦
北海道	北海道帯広農業高等学校  古川　琉慎
北海道	旭川実業高校    沖中　瑛太
北海道	とわの森三愛高等学校    岩城　啓太
北海道	とわの森三愛高等学校    五十嵐　奨真
北海道	北海道科学大学高等学校  竹村　純生
北海道	北海道科学大学高等学校  松田　快晴
北海道	北海道大谷室蘭高等学校  加藤　虎牙
青森	八戸工業大学第一高校	山中　裕太	
岩手	岩手県立黒沢尻北高等学校	八島　銀音	
宮城	東北高等学校	根津　圭威士	
秋田	秋田令和高校	町田　佳紀	
山形	学校法人羽黒学園羽黒高等学校	中易　快翔	
福島	福島県立田村高等学校	草野　春真	
東京	豊南高等学校	小林　瑛	
神奈川	慶應義塾高等学校	赤坂　英昭	
埼玉	埼玉県立松山高等学校	原田　蒼空	
千葉	木更津総合高等学校	手塚　康介	
茨城	霞ヶ浦高等学校	善福　留生	
栃木	宇都宮短期大学附属高等学校	並木　孝輔	
群馬	群馬県立高崎商業高等学校	大塚　陸玖	
新潟	北越高等学校	高澤　颯	
長野	長野俊英高等学校	川上　琳太郎	
富山	富山県立高岡商業高等学校	前川　悠成	
石川	石川県立能登高等学校	古本　竜吾	
福井	福井県立敦賀高等学校	小林　奏來	
山梨	山梨県立笛吹高等学校	藤原　奏	
愛知	岡崎城西高等学校	長濱　瑠飛	
静岡	知徳高等学校	坂井　優斗	
三重	三重高等学校	南　龍之介	
岐阜	美濃加茂高等学校	島崎　羚音	
大阪	上宮高等学校	福田　喜大	
兵庫	尼崎市立尼崎高等学校	栗岡　優志	
京都	福知山成美高等学校	津田　柚翔	
滋賀	滋賀県立草津東高等学校	染矢　永太	
奈良	大和高田市立高田商業高等学校	植田　璃音	
和歌山	和歌山北高校	野田　弦輝	
鳥取	鳥取県立鳥取東高等学校	砂田　隆稔	
島根	島根県立松江工業高校	井原　蓮	
岡山	岡山理科大学附属高等学校	堺　瑠音	
広島	広島翔洋高等学校	小保　伶太	
山口	山口県立南陽工業高等学校	松本　一真	
徳島	徳島県立富岡東高等学校	花垣　陸	
香川	尽誠学園高等学校	伊藤　陽聖	
愛媛	済美高等学校	尾﨑　健人	
高知	明徳義塾高等学校	木本　琉偉	
福岡	筑紫台高等学校	中島　遥斗	
佐賀	佐賀県立嬉野高等学校塩田校舎	松尾　航希	
長崎	長崎南山高等学校	下田　詠太	
熊本	文徳高等学校	下森　吏	
大分	学校法人大分高等学校	坂口　竣亮	
宮崎	宮崎県立都城商業高等学校	田中　涼介	
鹿児島	鹿児島実業高等学校	河野　晃大	
沖縄	沖縄県立八重山高等学校	福本　礼央夏
愛知	岡崎城西高等学校	塚本　光琉	
三重	三重高等学校	竹内　慶悟	
奈良	高田商業高等学校	飯降　脩	
奈良	高田商業高等学校	前田　蒼生	
香川	尽誠学園高等学校	宮田　亮	
青森	青森明の星中学・高等学校	北俣　航太	
神奈川	神奈川県立小田原高等学校	若生　裕希	
滋賀	立命館守山高等学校	保海　祥真	
広島	尾道高等学校	佐藤　礼	
島根	島根県立出雲工業高等学校	山本　遥斗
""".strip()

# トーナメント表（空白含む）
tournament_lines = """
小 保 伶 太 ( 広 島 県 ： 広 島 翔 洋 )
福 田 喜 大 ( 大 阪 府 ： 上 宮 )
草 野 春 真 ( 福 島 県 ： 田 村 )
加 藤 虎 牙 ( 北 海 道 ： 大 谷 室 蘭 )
大 塚 陸 ( 群 馬 県 ： 高 崎 商 )
赤 阪 英 昭 (神奈川県 ：慶應義塾)
宮 田 亮 ( 香 川 県 ： 尽 誠 学 園 )
長 濱 瑠 飛 ( 愛 知 県 ： 岡 崎 城 西 )
町 田 佳 紀 ( 秋 田 県 ： 秋 田 令 和 )
河 野 晃 大 (鹿児島県 ：鹿児島実)
中 易 快 翔 ( 山 形 県 ： 羽 黒 )
野 田 弦 輝 (和歌山県 ：和歌山北)
竹 内 慶 悟 ( 三 重 県 ： 三 重 )
岩 城 啓 太 (北海道：とわの森三愛)
高 澤 颯 ( 新 潟 県 ： 北 越 )
前 田 蒼 生 ( 奈 良 県 ： 高 田 商 )
下 田 詠 太 ( 長 崎 県 ： 長 崎 南 山 )
福 本 礼央夏 ( 沖 縄 県 ： 八 重 山 )
染 矢 永 太 ( 滋 賀 県 ： 草 津 東 )
尾 﨑 健 人 ( 愛 媛 県 ： 済 美 )
植 田 璃 音 ( 奈 良 県 ： 高 田 商 )
古 川 琉 慎 ( 北 海 道 ： 帯 広 農 )
北 俣 航 太 (青森 県： 青森明の 星)
善 福 留 生 ( 茨 城 県 ： 霞 ヶ 浦 )
小 林 奏 來 ( 福 井 県 ： 敦 賀 )
下 森 吏 ( 熊 本 県 ： 文 徳 )
中 島 遙 斗 ( 福 岡 県 ： 筑 紫 台 )
井 原 蓮 ( 島 根 県 ： 松 江 工 )
八 島 銀 音 ( 岩 手 県 ： 黒 沢 尻 北 )
五十嵐 奨 真 (北海道：とわの森三愛)
坂 口 竣 亮 ( 大 分 県 ： 大 分 )
原 田 蒼 空 ( 埼 玉 県 ： 松 山 )
 古 本竜 吾 ( 石 川 県 ： 能 登 )
 松 田 快 晴 ( 北 海 道 ： 北 科 大 )
 保 海 祥 真(滋賀 県：立命 館守山)
 南 龍之介 ( 三 重 県 ： 三 重 )
栗 岡 優 志( 兵 庫 県 ： 市 尼 崎 )
 山 本 遥 斗 ( 島 根 県 ： 出 雲 工 )
 木 本 琉 偉( 高 知 県 ： 明 徳 義 塾 )
 塚 本 光 琉 ( 愛 知 県 ： 岡 崎 城 西 )
 並 木 孝 輔(栃木県：宇都宮短大附)
 根 津 圭威士 ( 宮 城 県 ： 東 北 )
 佐 藤 聖 敦( 北 海 道 ： 滝 川 工 )
 藤 原 奏 ( 山 梨 県 ： 笛 吹 )
 佐 藤 礼( 広 島 県 ： 尾 道 )
 堺 瑠 音 (岡山県：岡山理大附属)
 松 本 一 真( 山 口 県 ： 南 陽 工 )
 伊 藤 陽 聖 ( 香 川 県 ： 尽 誠 学 園 )
 津 田 柚 翔(京都 府：福知 山成美)
 前 川 悠 成 ( 富 山 県 ： 高 岡 商 )
 沖 中 瑛 太( 北 海 道 ： 旭 川 実 )
 坂 井 優 斗 ( 静 岡 県 ： 知 徳 )
 川 上 琳太郎( 長 野 県 ： 長 野 俊 英 )
 松 尾 航 希 ( 佐 賀 県 ： 嬉 野 )
 砂 田 隆 稔( 鳥 取 県 ： 鳥 取 東 )
 若 生 裕 希 ( 神 奈 川 県 ： 小 田 原 )
 島 﨑 羚 音 ( 岐 阜 県 ： 美 濃 加 茂 )
 小 林 瑛 ( 東 京 都 ： 豊 南 )
 田 中 涼 介 ( 宮 崎 県 ： 都 城 商 )
 山 中 裕 太 (青森 県：八戸 工大一)
 飯 降 脩 ( 奈 良 県 ： 高 田 商 )
 手 塚 康 介 (千葉 県：木更 津総合)
 竹 村 純 生 ( 北 海 道 ： 北 科 大 )
 花 垣 陸 ( 徳 島 県 ： 富 岡 東 )
""".strip()

# 空白除去
def normalize_tournament_lines(raw_text):
    return "\n".join([re.sub(r'[ 　]+', '', line) for line in raw_text.strip().splitlines()])

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
                info_list.append(match)
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
            "information": info_list
        })

    return output

normalized = normalize_tournament_lines(tournament_lines)
final_output = generate_output_with_original_team(player_lines, normalized)

# JSON出力（1行ずつ）
for item in final_output:
    print(json.dumps(item, ensure_ascii=False))
