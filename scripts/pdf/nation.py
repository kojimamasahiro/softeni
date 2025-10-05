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
PAGE_NUM = 8                       # 抽出するページ番号（1から開始）
UNIVERSITY_LIST_PATH = 'data/university_list.txt' # 大学名辞書ファイル
SURNAME_LIST_PATH = 'data/surname_list.txt' # 姓の辞書ファイル
AREA_LIST_PATH = 'data/area_list.txt'      # エリア名辞書ファイル
Y_TOLERANCE = 2                   # 同じ行と見なすy座標の許容誤差（ポイント）

X_LEFT_PLAYER_MIN = 75    # 選手名の最小X座標
X_LEFT_PLAYER_MAX = 130    # 選手名の最大X座標
X_LEFT_AREA_MIN = 140    # エリア名の最小X座標
X_LEFT_AREA_MAX = 160    # エリア名の最大X座標
X_LEFT_TEAM_MIN = 170    # チーム名の最小X座標
X_LEFT_TEAM_MAX = 225   # チーム名の最大X座標
X_LEFT_ENTRY_MIN = 10    # 左側エントリー番号の最小X座標
X_LEFT_ENTRY_MAX = 70    # 左側エントリー番号の最大X座標

X_RIGHT_PLAYER_MIN = 345    # 選手名の最小X座標
X_RIGHT_PLAYER_MAX = 400    # 選手名の最大X座標
X_RIGHT_AREA_MIN = 410  # エリア名の最小X座標
X_RIGHT_AREA_MAX = 430  # エリア名の最大X座標
X_RIGHT_TEAM_MIN = 440  # チーム名の最小X座標
X_RIGHT_TEAM_MAX = 495  # チーム名の最大X座標
X_RIGHT_ENTRY_MIN = 500  # 右側エントリー番号の最小X座標
X_RIGHT_ENTRY_MAX = 560  # 右側エントリー番号の最大X座標

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
# 判定・整形関数
# ---------------------------------------------

def is_team_name_line(text):
    """テキストがチーム名を含むかどうかを判定する（辞書とキーワードベース）"""
    # 判定前に、チーム名の行に含まれる可能性のあるゴミを除去
    clean_text = re.sub(r'[\(\)\d]+', '', text).strip()
    # print(f"DEBUG: チーム名判定対象テキスト: '{text}' -> クリーン: '{clean_text}'")

    if not clean_text:
        return False

    # 1. 大学名辞書とのチェック
    if UNIVERSITY_NAMES:
        for uni_name in UNIVERSITY_NAMES:
            if uni_name in clean_text:
                # print(f"DEBUG: 大学名マッチ: '{uni_name}' in '{clean_text}'")
                return True
            
    if AREA_NAMES:
        for area_name in AREA_NAMES:
            if clean_text.startswith(area_name):
                # print(f"DEBUG: エリア名マッチ: '{area_name}' in '{clean_text}'")
                return True
    
    # 2. 予備（キーワード）チェック
    return any(keyword in clean_text for keyword in TEAM_KEYWORDS)


def extract_area_and_team_data(raw_text):
    """
    チーム名の行から、エリア名、チーム名本体を分離する。
    PDF由来のエントリー番号は無視する。
    """
    clean_text = raw_text.replace('(', '').replace(')', '').strip()
    
    # 1. エリア名の抽出 (最長一致)
    area_name = ""
    team_part = clean_text
    
    # エリア名が定義されている場合
    if AREA_NAMES:
        # AREA_NAMES は長い順にソートされている前提
        for a_name in AREA_NAMES:
            # 行がエリア名で始まっているかチェック
            if clean_text.startswith(a_name):
                area_name = a_name
                # エリア名を取り除いた残りの文字列
                team_part = clean_text[len(a_name):].strip()
                break
    
    # 2. チーム名の抽出 (PDF由来の数字を除去)
    # 数字（エントリー番号）や括弧を削除し、純粋なチーム名だけを残す
    team_name = re.sub(r'[\(\)\d]+', '', team_part).strip()

    return area_name, team_name


def get_name_split_info(raw_text):
    """
    選手名から姓と名を分離し、元の文字列と分割インデックスを返す。
    
    戻り値: (surname, first_name, raw_name, split_index)
    """
    player_name_clean = raw_text.strip()
    if not player_name_clean:
        return "", "", "", 0

    name_len = len(player_name_clean)
    split_index = 0

    # 1. 姓の辞書マッチング（最優先）
    if SURNAME_LIST:
        for sname in SURNAME_LIST:
            sname_len = len(sname)
            if player_name_clean.startswith(sname) and name_len > sname_len:
                split_index = sname_len
                break 

    # 2. シンプルな文字数ルール（辞書にない場合、かつ未分割の場合）
    if split_index == 0:
        if name_len >= 6:
            split_point = 3
        elif name_len == 2:
            split_point = 1
        else:
            split_point = 2
            
        if split_point > 0 and split_point < name_len:
            split_index = split_point
        else:
            split_index = 0 
            
    # 分割を実行 (ここでは実行はせず、情報を返すのみ)
    if split_index > 0:
        surname = player_name_clean[:split_index]
        first_name = player_name_clean[split_index:]
    else:
        surname = "" 
        first_name = player_name_clean

    return surname, first_name, player_name_clean, split_index

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
    """
    if side_chars_df.empty:
        return []

    # 座標設定を決定
    if is_left_side:
        X_SETTINGS = {
            'PLAYER_MIN': X_LEFT_PLAYER_MIN, 'PLAYER_MAX': X_LEFT_PLAYER_MAX,
            'AREA_MIN': X_LEFT_AREA_MIN, 'AREA_MAX': X_LEFT_AREA_MAX,
            'TEAM_MIN': X_LEFT_TEAM_MIN, 'TEAM_MAX': X_LEFT_TEAM_MAX,
            'ENTRY_MIN': X_LEFT_ENTRY_MIN, 'ENTRY_MAX': X_LEFT_ENTRY_MAX,
        }
    else:
        X_SETTINGS = {
            'PLAYER_MIN': X_RIGHT_PLAYER_MIN, 'PLAYER_MAX': X_RIGHT_PLAYER_MAX,
            'AREA_MIN': X_RIGHT_AREA_MIN, 'AREA_MAX': X_RIGHT_AREA_MAX,
            'TEAM_MIN': X_RIGHT_TEAM_MIN, 'TEAM_MAX': X_RIGHT_TEAM_MAX,
            'ENTRY_MIN': X_RIGHT_ENTRY_MIN, 'ENTRY_MAX': X_RIGHT_ENTRY_MAX,
        }

    # 1. Y座標に基づき、文字レベルのデータを「行レベル」のデータに集約 (既存のロジック)
    data = side_chars_df.sort_values(by=['top', 'left']).copy()
    # 小さい文字と見なすフォントサイズの閾値 (例: 5.5ポイント未満)
    SMALL_SIZE_THRESHOLD = 5.5
    
    # 'top' の差分と、1つ前の文字の 'size' を計算
    data['top_diff'] = data['top'].diff().fillna(0)
    data['prev_size'] = data['size'].shift(1).fillna(data['size'].iloc[0] if not data.empty else 0)

    def calculate_is_new_line(row):
        """現在の行または直前の文字のサイズが小さい場合、より大きなY許容誤差を適用する"""
        
        # 最初の行は必ず False
        if row.name == 0:
            return False

        # デフォルトの許容誤差
        tolerance = Y_TOLERANCE
        
        # 現在の文字または直前の文字のいずれかが小さいフォントサイズであれば、許容誤差を緩める
        if (row['size'] < SMALL_SIZE_THRESHOLD):
            tolerance = 3
        elif (row['prev_size'] < SMALL_SIZE_THRESHOLD):
            tolerance = 1
        return row['top_diff'] > tolerance

    # 動的な許容誤差に基づいて新しい行かどうかを判定
    data['is_new_line'] = data.apply(calculate_is_new_line, axis=1)
    data['line_group'] = data['is_new_line'].cumsum()
    
    # 2. line_dataの生成 (Y座標の範囲を使用するためtop_min/maxを取得)
    line_data = data.groupby('line_group').agg(
        full_text=('text', lambda x: "".join(x).strip()),
        top_min=('top', 'min'),   
        top_max=('top', 'max')    
    ).reset_index()

    RESULTS = []
    i = 0
    
# 3. 行を走査する
    while i < len(line_data):
        line_1 = line_data.iloc[i] # 選手Aの行

        # スコア行などのフィルタリング
        text_check = line_1['full_text'].strip()
        # 非常に短いテキスト、数字・記号のみ、またはスコアパターンの場合はスキップ
        if not text_check or len(text_check) < 2 or \
           re.fullmatch(r'[\d\s\-\.,:()]+', text_check) or \
           re.search(r'\d-\d', text_check):
            i += 1
            continue

        p1 = check_line_presence(line_1, data, X_SETTINGS, Y_TOLERANCE)
        
        # -----------------------------------------------------------------
        # ★ 統一された3行セットの処理 (行 i, i+1, i+2 を使用)
        # -----------------------------------------------------------------
        if i + 2 < len(line_data):
            line_2 = line_data.iloc[i + 1] # エントリー番号/エリア/チームの行
            line_3 = line_data.iloc[i + 2] # 選手Bの行
            print(f"DEBUG: 処理中の行 {i}: '{line_1['full_text']}'")
            print(f"DEBUG: 処理中の行 {i + 1}: '{line_2['full_text']}'")
            print(f"DEBUG: 処理中の行 {i + 2}: '{line_3['full_text']}'")

            # 2行目からすべての情報を抽出
            # raw_name_2 は通常空（選手名なし）のはず
            raw_name_2, area_2, team_2, entry_text_2 = extract_single_line_content(line_2, data, X_SETTINGS)
            # print(f"DEBUG: 2行目抽出結果 - raw_name: '{raw_name_2}', area: '{area_2}', team: '{team_2}', entry: '{entry_text_2}'")
            
            # 必須条件: 2行目に有効な数字（エントリー番号）が存在すること
            is_entry_line = entry_text_2 and entry_text_2.isdigit()
            
            if is_entry_line:
                p3 = check_line_presence(line_3, data, X_SETTINGS, Y_TOLERANCE)
                
                # 判定条件: 1行目と3行目に選手名が存在すること
                is_valid_3_line_group = p1['player'] and p3['player']

                if is_valid_3_line_group:
                    
                    # 選手Aと選手Bの行からデータを抽出 (2行目から取れるデータは無視)
                    raw_name_a, area_a, team_a, _ = extract_single_line_content(line_1, data, X_SETTINGS)
                    raw_name_b, area_b, team_b, _ = extract_single_line_content(line_3, data, X_SETTINGS)

                    # 選手Aと選手Bのどちらからも有効なデータ（選手名）が取得できた場合
                    if raw_name_a and raw_name_b: 
                        
                        # 1. エントリー番号を2行目から確定
                        entry_number = int(entry_text_2)

                        # 選手Aの情報を追加
                        _, _, raw_name_a, split_index_a = get_name_split_info(raw_name_a) 
                        RESULTS.append({
                            'Player_Name_Raw': raw_name_a, 'Split_Index': split_index_a, 
                            'Area_Name': area_2 if area_2 else area_a, 
                            'Team_Name': team_2 if team_2 else team_a,
                            'Entry_Number': entry_number
                        })
                        
                        # 選手Bの情報を追加
                        _, _, raw_name_b, split_index_b = get_name_split_info(raw_name_b) 
                        RESULTS.append({
                            'Player_Name_Raw': raw_name_b, 'Split_Index': split_index_b, 
                            'Area_Name': area_2 if area_2 else area_b, 
                            'Team_Name': team_2 if team_2 else team_b,
                            'Entry_Number': entry_number
                        })
                        
                        i += 3 
                        continue
                    else:
                        print(f"警告: 行 {i+1} と {i+3} から選手名が抽出できません。")  
                else:
                    print(f"警告: 行 {i+1} から始まる3行セットが無効です。選手名が見つかりません。")
            
        # 3行セットとして成立しない場合、またはエントリー番号の行でない場合は1行進める
        i += 1
        
    return RESULTS

def structure_player_data(chars_df):
    """
    PDFの文字データをX軸で左右に分割し、独立して選手情報を抽出する
    """
    if chars_df.empty:
        return pd.DataFrame(columns=['Player_Name_Raw', 'Split_Index', 'Area_Name', 'Team_Name', 'Entry_Number'])

    # 1. X軸中央値の決定
    X_MID_POINT = chars_df['left'].max() / 2 
    
    # 2. 文字データを左右に分割
    chars_left = chars_df[chars_df['left'] < X_MID_POINT].copy()
    chars_left = chars_left[chars_left['left'] <= X_LEFT_TEAM_MAX].copy()
    chars_right = chars_df[chars_df['left'] >= X_MID_POINT].copy()
    chars_right = chars_right[chars_right['left'] >= X_RIGHT_PLAYER_MIN].copy()

    # 3. 左右それぞれで抽出ロジックを実行
    results_left = _group_and_extract_side(chars_left, is_left_side=True)
    results_right = _group_and_extract_side(chars_right, is_left_side=False)

    FINAL_RESULTS = results_left + results_right
    
    # 4. 最終的な結果を整形
    df_results = pd.DataFrame(FINAL_RESULTS)
    
    if df_results.empty:
        return pd.DataFrame(columns=['Player_Name_Raw', 'Split_Index', 'Area_Name', 'Team_Name', 'Entry_Number'])
    
    # 重複を削除して整形
    df_final = df_results.drop_duplicates(subset=['Player_Name_Raw', 'Team_Name']).reset_index(drop=True)
    
    # 最終的な出力列を確定
    return df_final[['Player_Name_Raw', 'Split_Index', 'Area_Name', 'Team_Name', 'Entry_Number']]

def check_line_presence(line_data_row, data_df, X_SETTINGS, Y_TOLERANCE):
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

    return {
        'player': is_present(X_SETTINGS['PLAYER_MIN'], X_SETTINGS['PLAYER_MAX']),
        'area': is_present(X_SETTINGS['AREA_MIN'], X_SETTINGS['AREA_MAX']),
        'team': is_present(X_SETTINGS['TEAM_MIN'], X_SETTINGS['TEAM_MAX']),
    }

def extract_single_line_content(line_data_row, data_df, X_SETTINGS):
    """
    1行のデータから、X座標設定に基づき選手名、エリア名、チーム名の実際のテキストを抽出する。
    """
    Y_MIN, Y_MAX = line_data_row['top_min'], line_data_row['top_max']
    
    def extract_text(min_x, max_x):
        """指定されたX範囲の文字を抽出し、結合する"""
        chars = data_df[
            (data_df['left'] >= min_x) & (data_df['left'] <= max_x) &
            (data_df['top'] >= Y_MIN) & (data_df['top'] <= Y_MAX)
        ]
        return "".join(chars['text']).strip()

    # 1. 生のテキスト抽出
    raw_name_text = extract_text(X_SETTINGS['PLAYER_MIN'], X_SETTINGS['PLAYER_MAX'])
    raw_area_text = extract_text(X_SETTINGS['AREA_MIN'], X_SETTINGS['AREA_MAX'])
    raw_team_text = extract_text(X_SETTINGS['TEAM_MIN'], X_SETTINGS['TEAM_MAX'])
    raw_entry_text = extract_text(X_SETTINGS['ENTRY_MIN'], X_SETTINGS['ENTRY_MAX'])

    return raw_name_text, raw_area_text, raw_team_text, raw_entry_text

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
            # print(chars_data_df)  # 抽出データの先頭10行を表示
            structured_df = structure_player_data(chars_data_df)
            
            if not structured_df.empty:
                OUTPUT_FILE = 'output/softtennis_players_separated.csv'
                
                # 姓と名を分割した列を追加して出力（確認用）
                def split_name(row):
                    _, _, _, split_index = get_name_split_info(row['Player_Name_Raw'])
                    if split_index > 0:
                        return row['Player_Name_Raw'][:split_index], row['Player_Name_Raw'][split_index:]
                    return "", row['Player_Name_Raw'] # 分割できなかった場合は姓を空欄に
                
                structured_df[['Surname', 'First_Name']] = structured_df.apply(split_name, axis=1, result_type='expand')
                
                output_cols = ['Entry_Number', 'Surname', 'First_Name', 'Player_Name_Raw', 'Area_Name', 'Team_Name', 'Split_Index']
                structured_df[output_cols].to_csv(OUTPUT_FILE, index=False, encoding='utf8')
                
                print(f"✅ 選手情報（エリア名、連番付き）の抽出が完了しました。")
                print(f"結果は '{OUTPUT_FILE}' に保存されました。")
                print("\n--- 抽出結果（先頭5行） ---")
                print(structured_df[output_cols].head())
            else:
                print("構造化処理の結果、有効な選手データが抽出されませんでした。")