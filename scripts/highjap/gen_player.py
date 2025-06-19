import json
import re

# 選手情報（正式チーム名を含む）
player_lines = """
北海道	旭川実業高校	沖中　瑛太	大村　健斗
北海道	旭川実業高	濱本　陽向	西原　蒼太
北海道	北海道帯広農業高等学校	渡部　拳斗	古川　琉慎
北海道	とわの森三愛高等学校	岩城　啓太	高野　郁海
北海道	北海道科学大学高等学校	竹村　純生	松田　快晴
北海道	とわの森三愛高等学校	宮崎　航和	佐藤　諒
北海道	北海道大谷室蘭高等学校	加藤　虎牙	関　悠陽
北海道	北海道科学大学高等学校	森谷　太一	秋山　想太
青森	八戸工業大学第一高校	山中　裕太	苫米地　空隼
岩手	学校法人一関学院高等学校	山内　蒼良	佐々木　柊羽
宮城	東北高等学校	白井　颯	千田　夏輝
秋田	秋田令和高校	町田　佳紀	伊藤　玲央
山形	学校法人羽黒学園羽黒高等学校	佐藤　悠翔	日野　莉大
福島	福島県立田村高等学校	草野　春真	宗像　鷲
東京	文化学園大学杉並高等学校	小路　常晃	宍倉　希
神奈川	東海大学付属相模高等学校	原田　興勇	神藏　悠月
埼玉	埼玉県立松山高等学校	渡辺　幸誠	木田　大翔
千葉	木更津総合高等学校	手塚　康介	竹之内　琉汰
茨城	霞ヶ浦高等学校	善福　留生	白川　隼平
栃木	宇都宮短期大学附属高等学校	並木　孝輔	和久井　結仁
群馬	群馬県立高崎高等学校	大河原　兜	齊藤　慧伸
新潟	新潟県立巻高等学校	町澤　緯宙	近山　諒成
長野	長野俊英高等学校	川上　琳太郎	飛岡　煌志朗
富山	富山県立高岡商業高等学校	前川　悠成	角崎　豪哉
石川	石川県立能登高等学校	常岡　葵	藤岡　蓮
福井	福井県立金津高等学校	西田　心大郎	戸田　大晴
山梨	山梨県立笛吹高等学校	小林　侑永	藤原　奏
愛知	岡崎城西高等学校	石川　智弘	木崎　天満
静岡	知徳高等学校	山本　凌夢	井手　海哩
三重	三重高等学校	南　龍之介	竹内　慶悟
岐阜	岐阜県立岐阜商業高等学校	林　大嘉	中家　悠斗
大阪	上宮高等学校	立石　健成	中村　悠人
兵庫	尼崎市立尼崎高等学校	岩田　悠聖	栗岡　優志
京都	西城陽高等学校	髙山　泰志	清見　悠仁
滋賀	立命館守山高等学校	保海　祥真	竹田　央
奈良	大和高田市立高田商業高等学校	植田　璃音	荻谷　侑磨
和歌山	和歌山北高校	野田　弦輝	秋田　駿登
鳥取	米子松蔭高等学校	中川　龍	大田　万葉
島根	出雲北陵高等学校	川角　光夢	山下　柊人
岡山	岡山理科大学附属高等学校	青木　晴弥	長久　悠真
広島	広島翔洋高等学校	森川　倖志	灰田　麟太郎
山口	山口県立南陽工業高等学校	松本　一真	山本　大輔
徳島	徳島県立脇町高等学校	吉田　圭汰	亀井　奏佑
香川	尽誠学園高等学校	大門　登馬	関口　光希
愛媛	済美高等学校	平岡　大輝	石丸　玄昇
高知	明徳義塾高等学校	福島　惇	木本　琉偉
福岡	筑紫台高等学校	中山　太稀	中島　遥斗
佐賀	佐賀県立嬉野高等学校	松尾　航希	山口　柊
長崎	九州文化学園高等学校	澤田　博史	吉松　要琉生
熊本	文徳高等学校	下森　吏	外田　悠斗
大分	学校法人大分高等学校	河野　暖斗	石本　瑠偉
宮崎	宮崎県立都城商業高等学校	田中　涼介	石川　銀次
鹿児島	鹿児島商業高等学校	萩原　填ノ祐	川内　聡一郎
沖縄	沖縄県立八重山高等学校	福本　礼央夏	座波　晃也
宮城	聖ウルスラ学院英智高等学校	青柳　空杜	佐々木　成愛
岩手	岩手県立黒沢尻北高等学校	佐藤　駿	山室　晴廉
山形	山形市立商業高等学校	渡辺　琉惺	岡本　光貴
栃木	文星芸術大学附属高等学校	黒須　祐希	神長　璃武
埼玉	昌平高等学校	久保　響生	山端　里玖
神奈川	立花学園高等学校	髙山　輝也	大谷地　蒼星
新潟	学校法人　北越高等学校	高澤　 颯	高橋　憐依
石川	石川工業高等専門学校	金森　悠生	齊藤　秀哉
岐阜	中京高等学校	秋山　知暉	吉松　駿佑
愛知	享栄高校	柴田　海音	百武　駿
和歌山	和歌山県立田辺高等学校	山口　匠己	山本　流碧
滋賀	滋賀県立甲西高等学校	沢田　直紀	田實　月
広島	広島県立神辺旭高等学校	岡本　大登	上貝　悠斗
山口	山口県立宇部工業高等学校	藤井　太一	植木　陽丸
愛媛	愛媛県立西条高等学校	安藤　大輝	福光　寛慈
大分	大分県立大分商業高等学校	小野　泰輝	小野　弘太郎
佐賀	佐賀県立佐賀工業高等学校	西　駿介	石井　礼都
鹿児島	鹿児島実業高校	河野　晃大	猪鹿野　奏
""".strip()

# トーナメント表（空白含む）
tournament_lines = """
手 塚 ・ 竹之内 (千葉県：木更津総合)
  福 本 ・ 座 波 ( 沖 縄 県 ： 八 重 山 )
森 川 ・ 灰 田 ( 広 島 県 ： 広 島 翔 洋 )
  加 藤 ・ 関 ( 北 海 道 ： 大 谷 室 蘭 )
町 澤 ・ 近 山 ( 新 潟 県 ： 巻 )
  佐 藤 ・ 山 室( 岩 手 県 ： 黒 沢 尻 北 )
福 島 ・ 木 本 ( 高 知 県 ： 明 徳 義 塾 )
  青 柳 ・ 佐々木 ( 宮 城 県 ： ウ ル ス ラ )
小 野 ・ 小 野 ( 大 分 県 ： 大 分 商 )
  松 本 ・ 山 本( 山 口 県 ： 南 陽 工 )
大 門 ・ 関 口 ( 香 川 県 ： 尽 誠 学 園 )
  金 森 ・ 齊 藤 ( 石 川 県 ： 石 川 高 専 )
野 田 ・ 秋 田 (和歌山県：和歌山北)
  岡 本 ・ 上 貝( 広 島 県 ： 神 辺 旭 )
立 石 ・ 中 村 ( 大 阪 府 ： 上 宮 )
  岩 田 ・ 栗 岡 ( 兵 庫 県 ： 市 尼 崎 )
森 谷 ・ 秋 山 ( 北 海 道 ： 北 科 大 )
  沢 田 ・ 田 實( 滋 賀 県 ： 甲 西 )
川 角 ・ 山 下 ( 島 根 県 ： 出 雲 北 陵 )
  髙 山 ・ 大谷地 (神奈川県：立花学園)
町 田 ・ 伊 藤 ( 秋 田 県 ： 秋 田 令 和 )
  久 保 ・ 山 端( 埼 玉 県 ： 昌 平 )
高 山 ・ 清 見 ( 京 都 府 ： 西 城 陽 )
  山 口 ・ 山 本 ( 和 歌 山 県 ： 田 辺 )
安 藤 ・ 福 光 ( 愛 媛 県 ： 西 条 )
  高 橋 ・ 高 澤( 新 潟 県 ： 北 越 )
石 川 ・ 木 崎 ( 愛 知 県 ： 岡 崎 城 西 )
  河 野 ・ 石 本 ( 大 分 県 ： 大 分 )
岩 城 ・ 高 野 (北海道：とわの森三愛)
  草 野 ・ 宗 像( 福 島 県 ： 田 村 )
南 ・ 竹 内 ( 三 重 県 ： 三 重 )
  佐 藤 ・ 日 野 ( 山 形 県 ： 羽 黒 )
原 田 ・ 神 藏 (神奈川県：東海大相模)
  濱 本 ・ 西 原( 北 海 道 ： 旭 川 実 )
山 中 ・ 苫米地 (青森県：八戸工大一)
  秋 山 ・ 吉 松 ( 岐 阜 県 ： 中 京 )
沖 中 ・ 大 村 ( 北 海 道 ： 旭 川 実 )
  大河原 ・ 齊 藤( 群 馬 県 ： 高 崎 )
西 ・ 石 井 ( 佐 賀 県 ： 佐 賀 工 )
  善 福 ・ 白 川 ( 茨 城 県 ： 霞 ヶ 浦 )
青 木 ・ 長 久 (岡山県：岡山理大附)
  山 本 ・ 井 手( 静 岡 県 ： 知 徳 )
白 井 ・ 千 田 ( 宮 城 県 ： 東 北 )
  植 田 ・ 荻 谷 ( 奈 良 県 ： 高 田 商 )
河 野 ・ 猪鹿野 (鹿児島県：鹿児島実)
  中 山 ・ 中 島( 福 岡 県 ： 筑 紫 台 )
保 海 ・ 竹 田 (滋賀県：立命館守山)
  萩 原 ・ 川 内 (鹿児島県：鹿児島商)
渡 辺 ・ 木 田 ( 埼 玉 県 ： 松 山 )
  平 岡 ・ 石 丸( 愛 媛 県 ： 済 美 )
林 ・ 中 家 ( 岐 阜 県 ： 岐 阜 商 )
  下 森 ・ 外 田 ( 熊 本 県 ： 文 徳 )
田 中 ・ 石 川 ( 宮 崎 県 ： 都 城 商 )
  渡 部 ・ 古 川( 北 海 道 ： 帯 広 農 )
常 岡 ・ 藤 岡 ( 石 川 県 ： 能 登 )
  前 川 ・ 角 崎 ( 富 山 県 ： 高 岡 商 )
川 上 ・ 飛 岡 ( 長 野 県 ： 長 野 俊 英 )
  中 川 ・ 大 田( 鳥 取 県 ： 米 子 松 蔭 )
山 内 ・ 佐々木 ( 岩 手 県 ： 一 関 学 院 )
  田 ・ 亀 井 ( 徳 島 県 ： 脇 町 )
西 田 ・ 戸 田 ( 福 井 県 ： 金 津 )
  澤 田 ・ 吉 松( 長 崎 県 ： 九 州 文 化 )
黒 須 ・ 神 長 (栃木県：文星芸大附)
  柴 田 ・ 百 武 ( 愛 知 県 ： 享 栄 )
渡 辺 ・ 岡 本 (山形県：山形市立商)
  並 木 ・ 和久井(栃木県：宇都宮短大附)
植 木 ・ 藤 井 ( 山 口 県 ： 宇 部 工 )
  宮 崎 ・ 佐 藤 (北海道：とわの森三愛)
小 路 ・ 宍 倉 ( 東 京 都 ： 文 大 杉 並 )
  小 林 ・ 藤 原( 山 梨 県 ： 笛 吹 )
竹 村 ・ 松 田 ( 北 海 道 ： 北 科 大 )
  松 尾 ・ 山 口 ( 佐 賀 県 ： 嬉 野 )
""".strip()

# 空白除去
def normalize_tournament_lines(raw_text):
    return "\n".join([re.sub(r'[ 　]+', '', line) for line in raw_text.strip().splitlines()])

# 正規化されたトーナメント表
normalized_tournament_lines = normalize_tournament_lines(tournament_lines)

# トーナメント情報解析
def parse_tournament_lines(tournament_lines):
    entries = []
    for line in tournament_lines.strip().splitlines():
        name_part = line.split("(")[0].strip()
        match = re.search(r'（?\s*([^\s：()]+?県|都|道|府)\s*：\s*([^)）]+)', line)
        if not match:
            continue
        prefecture = match.group(1).replace(" ", "")
        team = match.group(2).replace(" ", "")
        last_names = [name.strip() for name in name_part.split("・")]
        entries.append({
            "lastNames": last_names,
            "team": team,
            "prefecture": prefecture
        })
    return entries

# フルネーム辞書構築
def build_fullname_dict(player_lines):
    player_map = {}
    for line in player_lines.strip().splitlines():
        cols = line.split("\t")
        if len(cols) != 4:
            continue
        prefecture, school, p1, p2 = cols
        for name in [p1, p2]:
            last, first = name.split("　")
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

# 出力作成（略称と正式名の両方を含む）
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
            "name": f"{entry['lastNames'][0]}・{entry['lastNames'][1]}（{abbrev_team}）",
            "information": info_list
        })

    return output

# 実行
final_output = generate_output_with_original_team(player_lines, normalized_tournament_lines)
print(json.dumps(final_output, indent=2, ensure_ascii=False))
