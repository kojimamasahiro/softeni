import pdfplumber
import pandas as pd
import re
import os

pd.set_option("display.max_rows", None)   # 行をすべて表示
pd.set_option("display.max_columns", None) # 列をすべて表示
pd.set_option("display.width", None)      # 横幅を自動調整（改行しない）
pd.set_option("display.max_colwidth", None)  # 列の内容を省略せず全表示

# --- 設定 ---
PDF_PATH = 'tournament.pdf'        # 入力PDFファイル名
PAGE_NUM = 1                       # 抽出するページ番号（1から開始）
UNIVERSITY_LIST_PATH = 'data/university_list.txt' # 大学名辞書ファイル
SURNAME_LIST_PATH = 'data/surname_list.txt' # 姓の辞書ファイル
AREA_LIST_PATH = 'data/area_list.txt'      # エリア名辞書ファイル
Y_TOLERANCE = 2                   # 同じ行と見なすy座標の許容誤差（ポイント）
SMALL_SIZE_THRESHOLD = 6.5

# ★ 選手名（姓・名）のX座標は、このファイルで使用される。
X_LEFT_SURNAME_MIN = 70    # 左側 姓の最小X座標
X_LEFT_SURNAME_MAX = 110   # 左側 姓の最大X座標
X_LEFT_FIRSTNAME_MIN = 120 # 左側 名の最小X座標
X_LEFT_FIRSTNAME_MAX = 160 # 左側 名の最大X座標
X_LEFT_AREA_MIN = 166    # 左側 地域名/都道府県名の最小X座標
X_LEFT_AREA_MAX = 225    # 左側 地域名/都道府県名の最大X座標
X_LEFT_TEAM_MIN = 166    # 左側 チーム名の最小X座標
X_LEFT_TEAM_MAX = 225   # 左側 チーム名の最大X座標
X_LEFT_ENTRY_MIN = 30    # 左側エントリー番号の最小X座標
X_LEFT_ENTRY_MAX = 70    # 左側エントリー番号の最大X座標

X_RIGHT_SURNAME_MIN = 360   # 右側 姓の最小X座標
X_RIGHT_SURNAME_MAX = 400   # 右側 姓の最大X座標
X_RIGHT_FIRSTNAME_MIN = 405 # 右側 名の最小X座標
X_RIGHT_FIRSTNAME_MAX = 445 # 右側 名の最大X座標
X_RIGHT_AREA_MIN = 450  # 右側 地域名/都道府県名の最小X座標
X_RIGHT_AREA_MAX = 510  # 右側 地域名/都道府県名の最大X座標
X_RIGHT_TEAM_MIN = 450  # 右側 チーム名の最小X座標
X_RIGHT_TEAM_MAX = 510  # 右側 チーム名の最大X座標
X_RIGHT_ENTRY_MIN = 520  # 右側エントリー番号の最小X座標
X_RIGHT_ENTRY_MAX = 580  # 右側エントリー番号の最大X座標

# チーム名を特定するための予備キーワードリスト
TEAM_KEYWORDS = ['高校', '大学']
# ---------------------------------------------

# グローバル変数として辞書とカウンターを読み込む
UNIVERSITY_NAMES = []
SURNAME_LIST = []
AREA_NAMES = []

try:
    with open(UNIVERSITY_LIST_PATH, 'r', encoding='utf8') as f:
        UNIVERSITY_NAMES = [line.strip() for line in f if line.strip()]
        UNIVERSITY_NAMES.sort(key=len, reverse=True) 
except FileNotFoundError:
    print(f"警告: 大学名辞書ファイル '{UNIVERSITY_LIST_PATH}' が見つかりません。")

try:
    with open(SURNAME_LIST_PATH, 'r', encoding='utf8') as f:
        SURNAME_LIST = [line.strip() for line in f if line.strip()]
        SURNAME_LIST.sort(key=len, reverse=True) 
except FileNotFoundError:
    print(f"警告: 姓の辞書ファイル '{SURNAME_LIST_PATH}' が見つかりません。文字数ルールのみ使用されます。")
    
try:
    with open(AREA_LIST_PATH, 'r', encoding='utf8') as f:
        # エリア名が他のエリア名の一部である可能性があるため、長い順にソートする（最長一致）
        AREA_NAMES = [line.strip() for line in f if line.strip()]
        AREA_NAMES.sort(key=len, reverse=True) 
except FileNotFoundError:
    print(f"警告: エリア名辞書ファイル '{AREA_LIST_PATH}' が見つかりません。エリア名は空欄になります。")


# ---------------------------------------------
# 判定・整形関数 (ほとんどは互換性維持のためのダミー)
# ---------------------------------------------

def is_team_name_line(text):
    """テキストがチーム名を含むかどうかを判定する（辞書とキーワードベース）"""
    clean_text = re.sub(r'[\(\)\d]+', '', text).strip()
    if not clean_text: return False
    return any(keyword in clean_text for keyword in TEAM_KEYWORDS)

def extract_area_and_team_data(raw_text):
    """チーム名の行から、エリア名、チーム名本体を分離する。"""
    clean_text = raw_text.replace('(', '').replace(')', '').strip()
    area_name = ""
    team_part = clean_text
    if AREA_NAMES:
        for a_name in AREA_NAMES:
            if clean_text.startswith(a_name):
                area_name = a_name
                team_part = clean_text[len(a_name):].strip()
                break
    team_name = re.sub(r'[\(\)\d]+', '', team_part).strip()
    return area_name, team_name

def get_name_split_info(raw_text, chars_in_line=pd.DataFrame()):
    """選手名から姓と名を分離し、元の文字列と分割インデックスを返す。"""
    player_name_clean = raw_text.strip()
    return "", "", player_name_clean, 0

# ---------------------------------------------
# 抽出関数
# ---------------------------------------------

def get_chars_data_from_pdf(pdf_path, page_num):
    """PDFから文字情報（テキストと座標）を抽出し、DataFrameとして返す"""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[page_num - 1]
            chars_list = page.chars
            
            if not chars_list:
                return pd.DataFrame()

            df = pd.DataFrame(chars_list)[['text', 'x0', 'top', 'x1', 'size']] 
            df = df.rename(columns={'x0': 'left'}) 
            df = df[df['text'].str.strip() != '']
            
            return df.reset_index(drop=True)

    except Exception as e:
        print(f"致命的なエラー: PDF処理中にエラーが発生しました: {e}")
        return pd.DataFrame()

def _group_and_extract_side(side_chars_df, is_left_side):
    """
    左右どちらか一方の文字データを受け取り、Y軸でグループ化して選手情報を抽出する
    新しい仕様: 3行で1ペア (1行目: 選手A + 地域, 2行目: エントリー番号, 3行目: 選手B + チーム)
    """
    if side_chars_df.empty:
        return []

    # 座標設定を決定
    if is_left_side:
        X_SETTINGS = {
            'SURNAME_MIN': X_LEFT_SURNAME_MIN, 'SURNAME_MAX': X_LEFT_SURNAME_MAX,
            'FIRSTNAME_MIN': X_LEFT_FIRSTNAME_MIN, 'FIRSTNAME_MAX': X_LEFT_FIRSTNAME_MAX,
            'AREA_MIN': X_LEFT_AREA_MIN, 'AREA_MAX': X_LEFT_AREA_MAX,
            'TEAM_MIN': X_LEFT_TEAM_MIN, 'TEAM_MAX': X_LEFT_TEAM_MAX,
            'ENTRY_MIN': X_LEFT_ENTRY_MIN, 'ENTRY_MAX': X_LEFT_ENTRY_MAX,
        }
    else:
        X_SETTINGS = {
            'SURNAME_MIN': X_RIGHT_SURNAME_MIN, 'SURNAME_MAX': X_RIGHT_SURNAME_MAX,
            'FIRSTNAME_MIN': X_RIGHT_FIRSTNAME_MIN, 'FIRSTNAME_MAX': X_RIGHT_FIRSTNAME_MAX,
            'AREA_MIN': X_RIGHT_AREA_MIN, 'AREA_MAX': X_RIGHT_AREA_MAX,
            'TEAM_MIN': X_RIGHT_TEAM_MIN, 'TEAM_MAX': X_RIGHT_TEAM_MAX,
            'ENTRY_MIN': X_RIGHT_ENTRY_MIN, 'ENTRY_MAX': X_RIGHT_ENTRY_MAX,
        }

    # 1. Y座標に基づき、文字レベルのデータを「行レベル」のデータに集約
    data = side_chars_df.sort_values(by=['top', 'left']).copy()

    # 'top' の差分と、1つ前の文字の 'size' を計算
    data['top_diff'] = data['top'].diff().fillna(0)
    data['prev_size'] = data['size'].shift(1).fillna(data['size'].iloc[0] if not data.empty else 0)

    def calculate_is_new_line(row):
        """動的な許容誤差に基づいて新しい行かどうかを判定"""
        
        if row.name == 0:
            return True

        tolerance = Y_TOLERANCE
        
        # フォントサイズが小さい場合は、許容誤差を緩める
        if (row['size'] < SMALL_SIZE_THRESHOLD) or (row['prev_size'] < SMALL_SIZE_THRESHOLD):
            tolerance = 3 
        return row['top_diff'] > tolerance

    # 動的な許容誤差に基づいて新しい行かどうかを判定
    data['is_new_line'] = data.apply(calculate_is_new_line, axis=1)
    data['line_group'] = data['is_new_line'].cumsum()
    
    # 2. line_dataの生成
    line_data = data.groupby('line_group').agg(
        full_text=('text', lambda x: "".join(x).strip()),
        top_min=('top', 'min'),   
        top_max=('top', 'max')    
    ).reset_index()

    RESULTS = []
    i = 1
    
    # 3. 行を走査する
    while i < len(line_data):
        line_1 = line_data.iloc[i] # 選手Aの行 (選手A + 地域名)

        # スコア行などのフィルタリング (Line 1に対してのみ実行)
        text_check = line_1['full_text'].strip()
        if not text_check or len(text_check) < 2 or \
           re.fullmatch(r'[\d\s\-\.,:()]+', text_check) or \
           re.search(r'\d-\d', text_check):
            i += 1
            continue

        # -----------------------------------------------------------------
        # ★ 3行セットの処理 (行 i, i+1, i+2 を使用)
        # -----------------------------------------------------------------
        if i + 2 < len(line_data):
            line_1 = line_data.iloc[i]   # 選手Aの行 (選手A + 地域名)
            line_2 = line_data.iloc[i + 1] # エントリー番号の行 (エントリー番号のみ)
            line_3 = line_data.iloc[i + 2] # 選手Bの行 (選手B + チーム名)
            # print(f"  行 {i+1} テキスト: '{line_1['full_text']}'")
            # print(f"  行 {i+2} テキスト: '{line_2['full_text']}'")
            # print(f"  行 {i+3} テキスト: '{line_3['full_text']}'")

            # --- Line 1 (選手A + 地域名) の抽出 ---
            surname_a, firstname_a, raw_name_a, area_a, team_a, entry_a = extract_single_line_content(line_1, data, X_SETTINGS)
            p1 = check_line_presence(line_1, data, X_SETTINGS)

            # --- Line 2 (エントリー番号) の抽出 ---
            # line_2はエントリー番号のみを抽出（他のフィールドは無視）
            surname_entry, firstname_entry, raw_name_entry, area_entry, team_entry, entry_number_raw = extract_single_line_content(line_2, data, X_SETTINGS)

            p2 = check_line_presence(line_2, data, X_SETTINGS) # 存在チェック
            
            # --- Line 3 (選手B + チーム名) の抽出 ---
            surname_b, firstname_b, raw_name_b, area_b, team_b, entry_b = extract_single_line_content(line_3, data, X_SETTINGS)
            p3 = check_line_presence(line_3, data, X_SETTINGS) # 存在チェック

            # -------------------------------------------------------------
            # 判定ロジック
            # -------------------------------------------------------------
            
            # 1. 選手Aの行 (line_1): 選手名 + 地域名 が存在し、チーム名、エントリー番号が空であること
            is_name_a_ok = raw_name_a and p1['player']
            is_area_a_ok = area_a and p1['area']

            # 2. エントリー番号の行 (line_2): 有効な数字のエントリー番号が存在し、選手名、地域名、チーム名が空であること
            is_entry_num_valid = entry_number_raw and entry_number_raw.isdigit() and p2['entry']

            # 3. 選手Bの行 (line_3): 選手名 + チーム名 が存在し、地域名、エントリー番号が空であること
            is_name_b_ok = raw_name_b and p3['player']
            is_team_b_ok = team_b and p3['team']

            is_valid_pair = (
                is_name_a_ok and is_area_a_ok
            ) and (
                is_entry_num_valid
            ) and (
                is_name_b_ok and is_team_b_ok
            )
            
            if is_valid_pair:
                
                # エントリー番号は2行目から確定
                entry_number = int(entry_number_raw) 
                
                # 選手A (地域名を持つ行)
                RESULTS.append({
                    'Surname': surname_a, 'First_Name': firstname_a,
                    'Player_Name_Raw': raw_name_a, 'Split_Index': len(surname_a),
                    # 地域名: line_1から取得
                    'Area_Name': area_a, 
                    # チーム名: line_3から取得
                    'Team_Name': team_b,
                    'Entry_Number': entry_number
                })
                
                # 選手B (チーム名を持つ行)
                RESULTS.append({
                    'Surname': surname_b, 'First_Name': firstname_b,
                    'Player_Name_Raw': raw_name_b, 'Split_Index': len(surname_b),
                    # 地域名: line_1から取得
                    'Area_Name': area_a,
                    # チーム名: line_3から取得
                    'Team_Name': team_b,
                    'Entry_Number': entry_number
                })
                
                i += 3 # 3行進める
                continue
            else:
                print(f"警告: 行 {i+1}～{i+3} の3行セットから選手情報を抽出できませんでした。")
                pass 
                
        # 3行セットとして成立しない場合、または無効な場合は1行進める
        i += 1
        
    return RESULTS

def structure_player_data(chars_df):
    """
    PDFの文字データをX軸で左右に分割し、独立して選手情報を抽出する
    """
    if chars_df.empty:
        return pd.DataFrame(columns=['Surname', 'First_Name', 'Player_Name_Raw', 'Split_Index', 'Area_Name', 'Team_Name', 'Entry_Number'])

    # -----------------------------------------------------------------
    # ★ デバッグ機能の統合: PDFページを画像として出力し、抽出範囲を描画する
    # -----------------------------------------------------------------
    try:
        if not os.path.exists('output'):
            os.makedirs('output')
        with pdfplumber.open(PDF_PATH) as pdf:
            page = pdf.pages[PAGE_NUM - 1]
            DEBUG_IMAGE_PATH = f'output/debug_page.png' # ページ番号をファイル名に含める
            draw_extraction_boxes(page, DEBUG_IMAGE_PATH) 
    except Exception as e:
        print(f"警告: デバッグ画像の生成中にエラーが発生しました: {e}")

    # 2. 文字データを左右に分割
    chars_left = chars_df[chars_df['left'] <= X_LEFT_TEAM_MAX].copy()
    chars_right = chars_df[chars_df['left'] >= X_RIGHT_SURNAME_MIN].copy()

    # 3. 左右それぞれで抽出ロジックを実行
    results_left = _group_and_extract_side(chars_left, is_left_side=True)
    results_right = _group_and_extract_side(chars_right, is_left_side=False)

    FINAL_RESULTS = results_left + results_right

    # 4. 最終的な結果を整形
    df_results = pd.DataFrame(FINAL_RESULTS)
    
    if df_results.empty:
        return pd.DataFrame(columns=['Surname', 'First_Name', 'Split_Index', 'Area_Name', 'Team_Name', 'Entry_Number'])
    
    # 重複を削除して整形
    df_final = df_results.drop_duplicates(subset=['Surname', 'First_Name', 'Team_Name']).reset_index(drop=True)

    # 最終的な出力列を確定
    return df_final[['Surname', 'First_Name', 'Player_Name_Raw', 'Split_Index', 'Area_Name', 'Team_Name', 'Entry_Number']]

def check_line_presence(line_data_row, data_df, X_SETTINGS):
    """
    1行のデータに対して、X座標範囲に文字が存在するかを判定し、辞書で返す。
    """
    Y_MIN, Y_MAX = line_data_row['top_min'], line_data_row['top_max']

    def is_present(min_x, max_x):
        """指定されたX範囲に文字が存在するかどうか（ブール値）をチェック"""
        chars_count = data_df[
            (data_df['left'] >= min_x) & (data_df['left'] <= max_x) &
            (data_df['top'] >= Y_MIN) & (data_df['top'] <= Y_MAX)
        ].shape[0]
        return chars_count > 0

    is_surname_present = is_present(X_SETTINGS['SURNAME_MIN'], X_SETTINGS['SURNAME_MAX'])
    is_firstname_present = is_present(X_SETTINGS['FIRSTNAME_MIN'], X_SETTINGS['FIRSTNAME_MAX'])

    return {
        # 選手名：姓と名の両方に文字があることを必須とする
        'player': is_surname_present and is_firstname_present, 
        'area': is_present(X_SETTINGS['AREA_MIN'], X_SETTINGS['AREA_MAX']),
        'team': is_present(X_SETTINGS['TEAM_MIN'], X_SETTINGS['TEAM_MAX']),
        'entry': is_present(X_SETTINGS['ENTRY_MIN'], X_SETTINGS['ENTRY_MAX']),
    }

def extract_single_line_content(line_data_row, data_df, X_SETTINGS):
    """
    1行のデータから、X座標設定に基づき選手名、エリア名、チーム名、エントリー番号の実際のテキストを抽出する。
    """
    Y_MIN, Y_MAX = line_data_row['top_min'], line_data_row['top_max']
    
    def extract_text(min_x, max_x):
        """指定されたX範囲の文字を抽出し、結合する"""
        chars = data_df[
            (data_df['left'] >= min_x) & (data_df['left'] <= max_x) &
            (data_df['top'] >= Y_MIN) & (data_df['top'] <= Y_MAX)
        ]
        # X座標の昇順で並び替えて結合
        return "".join(chars.sort_values(by='left')['text']).strip()

    # 1. 生のテキスト抽出
    raw_surname_text = extract_text(X_SETTINGS['SURNAME_MIN'], X_SETTINGS['SURNAME_MAX'])
    raw_firstname_text = extract_text(X_SETTINGS['FIRSTNAME_MIN'], X_SETTINGS['FIRSTNAME_MAX'])
    raw_area_text = extract_text(X_SETTINGS['AREA_MIN'], X_SETTINGS['AREA_MAX'])
    raw_team_text = extract_text(X_SETTINGS['TEAM_MIN'], X_SETTINGS['TEAM_MAX'])
    raw_entry_text = extract_text(X_SETTINGS['ENTRY_MIN'], X_SETTINGS['ENTRY_MAX'])

    # 選手名は姓と名を結合（間にスペースなし）
    raw_name_text = f"{raw_surname_text}{raw_firstname_text}".strip()
    
    # 新しいレイアウトに対応するため、戻り値をすべて返す
    return raw_surname_text, raw_firstname_text, raw_name_text, raw_area_text, raw_team_text, raw_entry_text

def draw_extraction_boxes(page, file_path):
    """
    pdfplumberページオブジェクトに、設定されたX座標の抽出範囲を描画する。
    """

    global X_LEFT_SURNAME_MIN, X_LEFT_SURNAME_MAX, X_LEFT_FIRSTNAME_MIN, X_LEFT_FIRSTNAME_MAX
    global X_LEFT_AREA_MIN, X_LEFT_AREA_MAX, X_LEFT_TEAM_MIN, X_LEFT_TEAM_MAX
    global X_RIGHT_SURNAME_MIN, X_RIGHT_SURNAME_MAX, X_RIGHT_FIRSTNAME_MIN, X_RIGHT_FIRSTNAME_MAX
    global X_RIGHT_AREA_MIN, X_RIGHT_AREA_MAX, X_RIGHT_TEAM_MIN, X_RIGHT_TEAM_MAX
    global X_LEFT_ENTRY_MIN, X_LEFT_ENTRY_MAX, X_RIGHT_ENTRY_MIN, X_RIGHT_ENTRY_MAX


    X_SETTINGS_LEFT = {
        'SURNAME_MIN': X_LEFT_SURNAME_MIN, 'SURNAME_MAX': X_LEFT_SURNAME_MAX,
        'FIRSTNAME_MIN': X_LEFT_FIRSTNAME_MIN, 'FIRSTNAME_MAX': X_LEFT_FIRSTNAME_MAX,
        'AREA_MIN': X_LEFT_AREA_MIN, 'AREA_MAX': X_LEFT_AREA_MAX,
        'TEAM_MIN': X_LEFT_TEAM_MIN, 'TEAM_MAX': X_LEFT_TEAM_MAX,
        'ENTRY_MIN': X_LEFT_ENTRY_MIN, 'ENTRY_MAX': X_LEFT_ENTRY_MAX,
    }
    
    X_SETTINGS_RIGHT = {
        'SURNAME_MIN': X_RIGHT_SURNAME_MIN, 'SURNAME_MAX': X_RIGHT_SURNAME_MAX,
        'FIRSTNAME_MIN': X_RIGHT_FIRSTNAME_MIN, 'FIRSTNAME_MAX': X_RIGHT_FIRSTNAME_MAX,
        'AREA_MIN': X_RIGHT_AREA_MIN, 'AREA_MAX': X_RIGHT_AREA_MAX,
        'TEAM_MIN': X_RIGHT_TEAM_MIN, 'TEAM_MAX': X_RIGHT_TEAM_MAX,
        'ENTRY_MIN': X_RIGHT_ENTRY_MIN, 'ENTRY_MAX': X_RIGHT_ENTRY_MAX,
    }

    rects = []
    
    COLORS = {
        'SURNAME': (0, 0, 255),    # 青
        'FIRSTNAME': (255, 255, 0),# 黄
        'AREA': (0, 255, 0),      # 緑 (地域名)
        'TEAM': (255, 0, 0),      # 赤 (チーム名)
        'ENTRY': (255, 165, 0),   # オレンジ
    }

    def add_rects(settings):
        # 選手名A/B
        rects.append({'rect': (settings['SURNAME_MIN'], 0, settings['SURNAME_MAX'], page.height), 'color': COLORS['SURNAME']})
        rects.append({'rect': (settings['FIRSTNAME_MIN'], 0, settings['FIRSTNAME_MAX'], page.height), 'color': COLORS['FIRSTNAME']})
        # 地域名 (Line 1)
        rects.append({'rect': (settings['AREA_MIN'], 0, settings['AREA_MAX'], page.height), 'color': COLORS['AREA']})
        # チーム名 (Line 3)
        rects.append({'rect': (settings['TEAM_MIN'], 0, settings['TEAM_MAX'], page.height), 'color': COLORS['TEAM']})
        # エントリー番号 (Line 2)
        rects.append({'rect': (settings['ENTRY_MIN'], 0, settings['ENTRY_MAX'], page.height), 'color': COLORS['ENTRY']})

    add_rects(X_SETTINGS_LEFT)
    add_rects(X_SETTINGS_RIGHT)

    im = page.to_image()

    for rect in rects:
        im.draw_rect(
            rect['rect'], 
            stroke=rect['color'],
            stroke_width=1
        ) 

    im.save(file_path)

    print(f"✅ デバッグ画像が '{file_path}' に保存されました。X座標の確認にご利用ください。")

# ---------------------------------------------
# メイン処理
# ---------------------------------------------
if __name__ == '__main__':
    if not os.path.exists(PDF_PATH):
        print(f"エラー: 入力ファイル '{PDF_PATH}' が見つかりません。ファイルを配置してください。")
    else:
        chars_data_df = get_chars_data_from_pdf(PDF_PATH, PAGE_NUM)
        
        if chars_data_df.empty:
            print("致命的なエラー: PDFから文字データが取得できませんでした。")
        else:
            print("--- PDF文字データ抽出開始 ---")
            structured_df = structure_player_data(chars_data_df)
            # print(chars_data_df[['text', 'left', 'top']])

            if not structured_df.empty:
                OUTPUT_FILE = 'output/softtennis_players_separated.csv'
                output_cols = ['Entry_Number', 'Surname', 'First_Name', 'Player_Name_Raw', 'Area_Name', 'Team_Name', 'Split_Index']
                structured_df[output_cols].to_csv(OUTPUT_FILE, index=False, encoding='utf8')

                print("\n--- 抽出結果（先頭3行） ---")
                print(structured_df[output_cols].head(3))
            else:
                print("構造化処理の結果、有効な選手データが抽出されませんでした。")
