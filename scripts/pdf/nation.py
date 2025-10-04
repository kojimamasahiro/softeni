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
X_START_ADJUSTMENT = 5             # X軸の開始値調整（PDFのレイアウトにより変更推奨）
X_END_ADJUSTMENT = 5               # X軸の終了値調整（PDFのレイアウトにより変更推奨）

X_LEFT_PLAYER_MIN = 75    # 選手名の最小X座標
X_LEFT_PLAYER_MAX = 130    # 選手名の最大X座標
X_LEFT_AREA_MIN = 140    # エリア名の最小X座標
X_LEFT_AREA_MAX = 160    # エリア名の最大X座標
X_LEFT_TEAM_MIN = 170    # チーム名の最小X座標
X_LEFT_TEAM_MAX = 220   # チーム名の最大X座標

X_RIGHT_PLAYER_MIN = 345    # 選手名の最小X座標
X_RIGHT_PLAYER_MAX = 400    # 選手名の最大X座標
X_RIGHT_AREA_MIN = 410  # エリア名の最小X座標
X_RIGHT_AREA_MAX = 430  # エリア名の最大X座標
X_RIGHT_TEAM_MIN = 440  # チーム名の最小X座標
X_RIGHT_TEAM_MAX = 490  # チーム名の最大X座標

# チーム名を特定するための予備キーワードリスト
TEAM_KEYWORDS = ['高校', '大学']
# ---------------------------------------------

# グローバル変数として辞書とカウンターを読み込む
UNIVERSITY_NAMES = []
SURNAME_LIST = []
AREA_NAMES = []
ENTRY_COUNTER = 1 # ★★★ グローバルカウンターを初期化 ★★★

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

            df = pd.DataFrame(chars_list)[['text', 'x0', 'top', 'x1']]
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
    global ENTRY_COUNTER
    
    if side_chars_df.empty:
        return []

    # 座標設定を決定
    if is_left_side:
        X_SETTINGS = {
            'PLAYER_MIN': X_LEFT_PLAYER_MIN, 'PLAYER_MAX': X_LEFT_PLAYER_MAX,
            'AREA_MIN': X_LEFT_AREA_MIN, 'AREA_MAX': X_LEFT_AREA_MAX,
            'TEAM_MIN': X_LEFT_TEAM_MIN, 'TEAM_MAX': X_LEFT_TEAM_MAX,
        }
    else:
        X_SETTINGS = {
            'PLAYER_MIN': X_RIGHT_PLAYER_MIN, 'PLAYER_MAX': X_RIGHT_PLAYER_MAX,
            'AREA_MIN': X_RIGHT_AREA_MIN, 'AREA_MAX': X_RIGHT_AREA_MAX,
            'TEAM_MIN': X_RIGHT_TEAM_MIN, 'TEAM_MAX': X_RIGHT_TEAM_MAX,
        }

    # 1. Y座標に基づき、文字レベルのデータを「行レベル」のデータに集約 (既存のロジック)
    data = side_chars_df.sort_values(by=['top', 'left']).copy()
    data['top_diff'] = data['top'].diff().fillna(0)
    data['is_new_line'] = data['top_diff'] > Y_TOLERANCE
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
        line = line_data.iloc[i]

        # スコア行などのフィルタリング
        text_check = line['full_text'].strip()
        # 非常に短いテキスト、数字・記号のみ、またはスコアパターンの場合はスキップ
        if not text_check or len(text_check) < 2 or \
           re.fullmatch(r'[\d\s\-\.,:()]+', text_check) or \
           re.search(r'\d-\d', text_check):
            i += 1
            continue

        # 1行目: 選手A
        raw_name_a_text, _, _ = extract_single_line_content(line, data, X_SETTINGS, Y_TOLERANCE)

        if not raw_name_a_text:
            i += 1
            continue 

        p1 = check_line_presence(line, data, X_SETTINGS, Y_TOLERANCE)

        # -----------------------------------------------------------------
        # 1. パターン2: 2行セット（選手A/エリアA/チームA / 選手B/エリアB/チームB）を試す
        # -----------------------------------------------------------------
        if i + 1 < len(line_data):
            increment = 0
            line_2 = line_data.iloc[i + 1]
            p2 = check_line_presence(line_2, data, X_SETTINGS, Y_TOLERANCE)
            if (not p2['player']) and (not p2['area']) and (not p2['team']):
                if i + 2 < len(line_data):
                    increment = 1
                    line_2 = line_data.iloc[i + 2]
                    p2 = check_line_presence(line_2, data, X_SETTINGS, Y_TOLERANCE)
                else:
                    i += 1
                    continue
            
            # パターン判定ロジック (行iと行i+1の両方が「選手+エリア+チーム」であるか)
            is_pattern2 = (p1['player'] and p1['area'] and p1['team']) and \
                            (p2['player'] and p2['area'] and p2['team'])

            if is_pattern2:
                # パターン2 (2行セット) を適用
                raw_name_a, area_a, team_a = extract_single_line_content(line, data, X_SETTINGS, Y_TOLERANCE)
                raw_name_b, area_b, team_b = extract_single_line_content(line_2, data, X_SETTINGS, Y_TOLERANCE)

                if raw_name_a and raw_name_b and team_a and team_b: # 抽出されたデータが有効か最終確認
                    entry_number = ENTRY_COUNTER
                    
                    _, _, raw_name_a, split_index_a = get_name_split_info(raw_name_a) 
                    RESULTS.append({'Player_Name_Raw': raw_name_a, 'Split_Index': split_index_a, 'Area_Name': area_a, 'Team_Name': team_a, 'Entry_Number': entry_number})
                    
                    _, _, raw_name_b, split_index_b = get_name_split_info(raw_name_b) 
                    RESULTS.append({'Player_Name_Raw': raw_name_b, 'Split_Index': split_index_b, 'Area_Name': area_b, 'Team_Name': team_b, 'Entry_Number': entry_number})
                    
                    ENTRY_COUNTER += 1
                    i += 2 + increment 
                    continue

        # -----------------------------------------------------------------
        # 2. パターン1 & 3: 3行セットを試す (i+2までデータが存在する必要がある)
        # -----------------------------------------------------------------
        if i + 2 < len(line_data):
            line_2 = line_data.iloc[i + 1]
            line_3 = line_data.iloc[i + 2]

            # 各行の要素の有無をチェック
            p2 = check_line_presence(line_2, data, X_SETTINGS, Y_TOLERANCE)
            p3 = check_line_presence(line_3, data, X_SETTINGS, Y_TOLERANCE)
            
            # パターン判定ロジック:
            # 1行目: 選手 + チーム名が存在 (P T) (エリアは空か不確実)
            # 2行目: エリア名のみが存在 (A) (選手名・チーム名は空)
            # 3行目: 選手 + チーム名が存在 (P T)
            is_pattern1 = (p1['player'] and p1['team']) and \
                        (p2['area'] and not p2['player'] and not p2['team']) and \
                        (p3['player'] and p3['team'])
            
            # パターン3判定 (P / A T / P)
            is_pattern3 = (p1['player'] and not p1['area'] and not p1['team']) and \
                            (p2['area'] and p2['team'] and not p2['player']) and \
                            (p3['player'] and not p3['area'] and not p3['team'])

            if is_pattern1 or is_pattern3:
                
                # 抽出処理
                raw_name_a, area_a, team_a = extract_single_line_content(line, data, X_SETTINGS, Y_TOLERANCE)
                _, area_2, team_2 = extract_single_line_content(line_2, data, X_SETTINGS, Y_TOLERANCE)
                raw_name_b, area_b, team_b = extract_single_line_content(line_3, data, X_SETTINGS, Y_TOLERANCE)
                
                # データを組み立て
                if is_pattern1:
                    area_name = area_2 # 2行目のエリア名が共通
                    team_a_final = team_a
                    team_b_final = team_b
                else: # is_pattern3
                    area_name = area_2 # 2行目のエリア名が共通
                    team_a_final = team_2 # 2行目のチーム名が共通
                    team_b_final = team_2 # 2行目のチーム名が共通
                
                # 最終確認
                if raw_name_a and raw_name_b and (team_a_final or team_b_final):
                    entry_number = ENTRY_COUNTER
                    
                    _, _, raw_name_a, split_index_a = get_name_split_info(raw_name_a) 
                    RESULTS.append({'Player_Name_Raw': raw_name_a, 'Split_Index': split_index_a, 'Area_Name': area_name, 'Team_Name': team_a_final, 'Entry_Number': entry_number})
                    
                    _, _, raw_name_b, split_index_b = get_name_split_info(raw_name_b) 
                    RESULTS.append({'Player_Name_Raw': raw_name_b, 'Split_Index': split_index_b, 'Area_Name': area_name, 'Team_Name': team_b_final, 'Entry_Number': entry_number})
                    
                    ENTRY_COUNTER += 1
                    i += 3 
                    continue
            
        # いずれのパターンにも合致しない場合は1行進める
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
    chars_right = chars_df[chars_df['left'] >= X_MID_POINT].copy()
    chars_left = chars_left[chars_left['left'] > X_LEFT_PLAYER_MIN - X_START_ADJUSTMENT].copy()
    chars_right = chars_right[chars_right['left'] < X_RIGHT_TEAM_MAX + X_END_ADJUSTMENT].copy()

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
            (data_df['top'] >= Y_MIN - Y_TOLERANCE) & (data_df['top'] <= Y_MAX + Y_TOLERANCE)
        ].shape[0]
        return chars_count > 0

    return {
        'player': is_present(X_SETTINGS['PLAYER_MIN'], X_SETTINGS['PLAYER_MAX']),
        'area': is_present(X_SETTINGS['AREA_MIN'], X_SETTINGS['AREA_MAX']),
        'team': is_present(X_SETTINGS['TEAM_MIN'], X_SETTINGS['TEAM_MAX']),
    }

def extract_single_line_content(line_data_row, data_df, X_SETTINGS, Y_TOLERANCE):
    """
    1行のデータから、X座標設定に基づき選手名、エリア名、チーム名の実際のテキストを抽出する。
    """
    Y_MIN, Y_MAX = line_data_row['top_min'], line_data_row['top_max']
    
    def extract_text(min_x, max_x):
        """指定されたX範囲の文字を抽出し、結合する"""
        chars = data_df[
            (data_df['left'] >= min_x) & (data_df['left'] <= max_x) &
            (data_df['top'] >= Y_MIN - Y_TOLERANCE) & (data_df['top'] <= Y_MAX + Y_TOLERANCE)
        ]
        return "".join(chars['text']).strip()

    # 1. 生のテキスト抽出
    raw_name_text = extract_text(X_SETTINGS['PLAYER_MIN'], X_SETTINGS['PLAYER_MAX'])
    raw_area_text = extract_text(X_SETTINGS['AREA_MIN'], X_SETTINGS['AREA_MAX'])
    raw_team_text = extract_text(X_SETTINGS['TEAM_MIN'], X_SETTINGS['TEAM_MAX'])

    return raw_name_text, raw_area_text, raw_team_text

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
            # グローバルカウンターをリセットして、常に1から始まるようにする
            ENTRY_COUNTER = 1 
            
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