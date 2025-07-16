import json
import re

# 選手情報（正式チーム名を含む）
player_lines = """
北海道	北海道滝川西高等学校	清水　蒼太	常盤　奏翔
北海道	北海道滝川西高等学校	福田　悠真	冨田　青空
北海道	北海道旭川東高等学校	那須　雄太	谷口　康生
北海道	とわの森三愛高等学校	永田　侑也	佐藤　光駿
北海道	北海道科学大学高等学校	西　拓郎	小杉　昂道
北海道	とわの森三愛高等学校	宇野　廉太朗	上ケ島　大叶
北海道	北海道科学大学高等学校	加藤　龍牙	鈴木　莱
北海道	北海道岩見沢東高等学校	坂本　桔平	駒谷　颯磨
青森	八戸工業大学第一高校	山中　裕太	荒関　拓斗
岩手	一関学院高等学校	津田　聖弥	藤井　李成
宮城	聖ウルスラ学院英智高等学校	佐藤　榎南	冨主　純翔
秋田	秋田令和高校	町田　佳紀	伊藤　玲央
山形	羽黒高等学校	小見　碧斗	阿部　瑛斗
福島	福島県立田村高等学校	袴塚　昊和	樋口　琥珀
東京	明法高等学校	山本　悠路	今井　瞭
神奈川	慶應義塾高等学校	高橋　勇貴	赤坂　英昭
埼玉	埼玉県立松山高等学校	長島　綾汰	郷　暖太
千葉	木更津総合高等学校	昼間　悠佑	竹之内　琉汰
茨城	霞ヶ浦高等学校	長谷川　博人	髙嶋　雅弥
栃木	文星芸術大学附属高等学校	園部　友也	白石　将也
群馬	群馬県立前橋商業高等学校	武田　豊	中島　魁成
新潟	北越高等学校	高澤　颯	高橋　憐依
長野	東京都市大学塩尻高等学校	古幡　悠馬	笠原　朗杜
富山	富山県立高岡商業高等学校	丸山　慈央	室　愛琉
石川	石川県立能登高等学校	藤木　晴叶	中山　煌貴
福井	福井県立金津高等学校	西田　心大郎	戸田　大晴
山梨	山梨県立笛吹高等学校	有村　翔空	藤原　奏
愛知	岡崎城西高等学校	丹羽　奏人	香山　侑月
静岡	知徳高等学校	坂井　優斗	鈴木　龍賀
三重	三重高等学校	南　龍之介	竹内　慶悟
岐阜	中京高等学校	佐藤　直輝	前田　英貴
大阪	上宮高等学校	三上　柊二	平井　啓吾
兵庫	尼崎市立尼崎高等学校	本勝　裕人	藤井　歩陸
京都	京都文教高等学校	坂手　拓海	小杉　優太
滋賀	綾羽高等学校	松川　憲伸	竹原　悠斗
奈良	大和高田市立高田商業高等学校	植田　璃音	結城　琉衣
和歌山	和歌山北高校	下田　隼輝	山下　來空
鳥取	米子松蔭高等学校	佐々木　康太	下田　悠貴
島根	浜田高等学校	山本　洋輔	中川　優月
岡山	岡山理科大学附属高等学校	今田　迅	茶木　將臣
広島	清水ヶ丘高等学校	藤本　晴生	神田　陽飛
山口	山口県立宇部工業高等学校	久野　莉輝	義永　啓人
徳島	徳島県立つるぎ高等学校	澤田　空	大谷　瑠尉
香川	尽誠学園高等学校	内田　陽斗	宮田　成将
愛媛	新田高等学校	毛利　航太	仲田　翔磨
高知	明徳義塾高等学校	福島　惇	加藤　歓基
福岡	東福岡高等学校	伊藤　駿平	帆足　光平
佐賀	佐賀県立嬉野高等学校	木下　琉希	藤井　智暉
長崎	精道三川台高等学校	三村　遥人	立川　凌世
熊本	ルーテル学院高等学校	野中　翔太	坂本　旭
大分	大分県立大分商業高等学校	紀野　文汰	小野　弘太郎
宮崎	宮崎県立都城商業高等学校	川﨑　康平	森　良輔
鹿児島	鹿児島実業高等学校	松元　蓮	堀之内　颯汰
沖縄	沖縄県立八重山高等学校	髙嶺　大弥	福本　礼央夏
青森	青森県立三本木高等学校	向平　優介	蛯名　陽
秋田	秋田県立秋田北鷹高等学校	猪股　悠志	畠山　七樹
福島	学校法人石川高等学校	唐澤　季弥	猪股　健人
埼玉	昌平高等学校	南　亮斗	北島　光琉
茨城	常磐大学高等学校	小貫　暁都	小沼　海靖
栃木	栃木県立宇都宮工業高等学校	保利　彰大	星　克尚
長野	長野俊英高等学校	川上　琳太郎	鹿田　陸
富山	富山県立桜井高等学校	大家　健慎	大江　陽太
愛知	大同大学大同高等学校	鳥居　悠人	奥　直翔
岐阜	岐阜県立岐阜商業高等学校	林　大嘉	早見　和喜
京都	京都府立南丹高等学校	西村　脩	木村　秀人
奈良	奈良県立奈良高等学校	島谷　拓和	久下　素輝
広島	広島県立神辺旭高等学校	武山　悠成	上貝　悠斗
島根	島根県立松江工業高等学校	尾島　涼太	永見　翔
香川	香川県立高瀬高等学校	吉田　真紘	入江　辰
佐賀	佐賀県立佐賀工業高等学校	三ヶ島　稀莉斗	松隈　勇太
長崎	長崎日本大学高等学校	丸田　一仁	山下　将毅
沖縄	沖縄県立向陽高等学校	照屋　盛也	渡邉　波輝
""".strip()

# トーナメント表（空白含む）
tournament_lines = """
清 水 ・ 常 盤 ( 北 海 道 ： 滝 川 西 )
伊 藤 ・ 帆 足 ( 福 岡 県 ： 東 福 岡 )
鳥 居 ・ 奥 ( 愛知県 ： 大同大学大同 )
下 田 ・ 山 下 (和歌山県：和歌山北)
坂 手 ・ 小 杉 (京都府：京都文教)
尾 島 ・ 永 見 ( 島 根 県 ： 松 江 工 )
久 野 ・ 義 永 ( 山 口 県 ： 宇 部 工 )
南 ・ 竹 内 ( 三 重 県 ： 三 重 )
髙 嶺 ・ 福 本 ( 沖 縄 県 ： 八 重 山 )
佐々木 ・ 下 田 (鳥取県：米子松蔭)
山 本 ・ 今 井 ( 東 京 都 ： 明 法 )
園 部 ・ 白 石 (栃木県：文星芸大附)
大 家 ・ 大 江 ( 富 山 県 ： 桜 井 )
袴 塚 ・ 樋 口 ( 福 島 県 ： 田 村 )
津 田 ・ 藤 井 (岩手県：一関学院)
那 須 ・ 谷 口 ( 北 海 道 ： 旭 川 東 )
紀 野 ・ 小 野 ( 大 分 県 ： 大 分 商 )
有 村 ・ 藤 原 ( 山 梨 県 ： 笛 吹 )
向 平 ・ 蛯 名 ( 青 森 県 ： 三 本 木 )
内 田 ・ 宮 田 (香川県：尽誠学園)
猪 股 ・ 畠 山 (秋田県：秋田北鷹)
松 川 ・ 竹 原 ( 滋 賀 県 ： 綾 羽 )
福 島 ・ 加 藤 (高知県：明徳義塾)
木 下 ・ 藤 井 ( 佐 賀 県 ： 嬉 野 )
澤 田・ 大 谷 ( 徳 島 県 ： つ る ぎ )
福 田 ・ 冨 田 ( 北 海 道 ： 滝 川 西 )
林 ・ 早 見 (岐阜県：県岐阜商)
藤 本 ・ 神 田 (広島県：清水ヶ丘)
野 中 ・ 坂 本 (熊本県：ルーテル学院)
加 藤 ・ 鈴 木 ( 北 海 道 ： 北 科 大 )
川 上 ・ 鹿 田 (長野県：長野俊英)
武 田 ・ 中 島 ( 群 馬 県 ： 前 橋 商 )
丸 田 ・ 山 下 (長崎県：長崎日大)
植 田 ・ 結 城 ( 奈 良 県 ： 高 田 商 )
長谷川 ・ 髙 嶋 ( 茨 城 県 ： 霞 ヶ 浦 )
長 島 ・ 郷 ( 埼 玉 県 ： 松 山 )
高 橋 ・ 高 澤 ( 新 潟 県 ： 北 越 )
小 貫・ 小 沼 ( 茨 城 県 ： 常 磐 大 )
西 田 ・ 戸 田 ( 福 井 県 ： 金 津 )
本 勝 ・ 藤 井 ( 兵 庫 県 ： 市 尼 崎 )
西 村・ 木 村 ( 京 都 府 ： 南 丹 )
山 中 ・ 荒 関 (青森県：八戸工大一)
島 谷 ・ 久 下 ( 奈 良 県 ： 奈 良 )
坂 井・ 鈴 木 ( 静 岡 県 ： 知 徳 )
坂 本 ・ 駒 谷 (北海道：岩見沢東)
佐 藤 ・ 前 田 ( 岐 阜 県 ： 中 京 )
山 本・ 中 川 ( 島 根 県 ： 浜 田 )
毛 利・ 仲 田 ( 愛 媛 県 ： 新 田 )
保 利 ・ 星 (栃木県：宇都宮工)
町 田・ 伊 藤 (秋田県：秋田令和)
唐 澤 ・ 猪 股 (福島県：学法石川)
三 上 ・平 井 ( 大 阪 府 ： 上 宮 )
宇 野 ・ 上ケ島 (北海道：とわの森三愛)
高 橋 ・ 赤 阪 (神奈川県：慶應義塾) 
松 元 ・ 堀之内 (鹿児島県 ：鹿児島実)
永 田 ・ 佐 藤 (北海道：とわの森三愛)
三ヶ島 ・ 松 隈 (佐賀県：佐賀工)
三 村 ・ 立 川 (長崎県：精道三川台)
照 屋・ 渡 邉 ( 沖 縄 県 ： 向 陽 )
吉 田 ・ 入 江 ( 香 川 県 ： 高 瀬 )
丸 山 ・ 室 ( 富 山 県 ： 高 岡 商 )
武 山・ 上 貝 ( 広 島 県 ： 神 辺 旭 )
佐 藤 ・ 冨 主 ( 宮 城 県 ： ウ ル ス ラ )
茶 木 ・ 今 田 (岡山県：岡山理大付属)
古 幡・ 笠 原 (長野県：都市大塩尻)
森 ・川 﨑 ( 宮 崎 県 ： 都 城 商 )
昼 間 ・ 竹之内 (千葉県：木更津総合)
丹 羽・ 香 山 (愛知県：岡崎城西)
藤 木 ・ 中 山 ( 石 川 県 ： 能 登 )
南 ・ 北 島 ( 埼 玉 県 ： 昌 平 )
小 見 ・ 阿 部  ( 山 形 県 ： 羽 黒 )
西 ・ 小 杉 ( 北 海 道 ： 北 科 大 )
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
            "information": info_list,
            "category": "doubles" if len(info_list) > 1 else "singles"
        })

    return output

normalized = normalize_tournament_lines(tournament_lines)
final_output = generate_output_with_original_team(player_lines, normalized)

# JSON出力（1行ずつ）
for item in final_output:
    print(json.dumps(item, ensure_ascii=False))
