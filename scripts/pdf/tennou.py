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
Y_TOLERANCE = 1                   # 同じ行と見なすy座標の許容誤差（ポイント）
X_MID_ADJUSTMENT = 0             # X軸の中央値調整（PDFのレイアウトにより変更推奨）
X_MAX_RIGHT_PLAYER = 50                 # 選手名が配置されるX座標の最大値（これより右側にある文字は除外）
X_MAX_LEFT_PLAYER = 80                  # 選手名が配置されるX座標の最小値（これより左側にある文字は除外）

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

def _group_and_extract_side(side_chars_df):
    """
    左右どちらか一方の文字データを受け取り、Y軸でグループ化して選手情報を抽出する
    パターン: 選手A -> チーム名+エリア名 -> 選手B (3行セット)
    """
    global ENTRY_COUNTER # ★★★ グローバルカウンターの使用を宣言 ★★★
    
    if side_chars_df.empty:
        return []

    # 1. Y座標に基づき、文字レベルのデータを「行レベル」のデータに集約
    data = side_chars_df.sort_values(by=['top', 'left']).copy()
    data['top_diff'] = data['top'].diff().fillna(0)
    data['is_new_line'] = data['top_diff'] > Y_TOLERANCE
    data['line_group'] = data['is_new_line'].cumsum()
    
    line_data = data.groupby('line_group').agg(
        text=('text', lambda x: "".join(x).strip()),
        y_center=('top', 'mean'),
        x_start=('left', 'min')
    ).reset_index()

    RESULTS = []
    i = 0
    
    # 2. 行を走査し、ダブルス（選手A -> チーム名+エリア名 -> 選手B）のパターンを抽出
    while i < len(line_data):
        line = line_data.iloc[i]

        # 2.1 スコア、罫線、または純粋な数字のみの行を除外
        text_check = line['text']
        
        # スコアや数字、記号（-、:）のみで構成されているかチェック
        is_score_only = re.fullmatch(r'[\d\s\-\.,:]+', text_check) 
        
        if is_score_only or len(text_check) < 2 or re.search(r'\d-\d', line['text']):
            i += 1
            continue

        # 1行目: 選手A (チーム名行ではないことを確認)
        if not is_team_name_line(line['text']):
            player_1_line = line
            print(f"DEBUG: 選手A行検出: '{player_1_line['text']}' (行番号: {i})")

            # i+1: チーム名+エリア名
            if i + 1 < len(line_data):
                team_area_line = line_data.iloc[i + 1]
                print(f"DEBUG: チーム名候補行検出: '{team_area_line['text']}' (行番号: {i+1})")
                
                if is_team_name_line(team_area_line['text']):
                    team_line = team_area_line
                    
                    # i+2: 選手B
                    if i + 2 < len(line_data):
                        player_2_line = line_data.iloc[i + 2]

                        # 3. 抽出と構造化
                        raw_combined_text = team_line['text']
                        
                        # エリア名とチーム名を分離して取得
                        area_name, team_name = extract_area_and_team_data(raw_combined_text)
                        
                        # 連番をエントリー番号として使用
                        entry_number = ENTRY_COUNTER
                        
                        # 選手Aの処理
                        _, _, raw_name_a, split_index_a = \
                            get_name_split_info(player_1_line['text']) 
                        
                        if raw_name_a:
                            RESULTS.append({
                                'Player_Name_Raw': raw_name_a,        
                                'Split_Index': split_index_a,         
                                'Area_Name': area_name,        
                                'Team_Name': team_name, 
                                'Entry_Number': entry_number
                            })
                        
                        # 選手Bの処理
                        _, _, raw_name_b, split_index_b = \
                            get_name_split_info(player_2_line['text']) 
                        
                        if raw_name_b:
                            RESULTS.append({
                                'Player_Name_Raw': raw_name_b,        
                                'Split_Index': split_index_b,         
                                'Area_Name': area_name,        
                                'Team_Name': team_name, 
                                'Entry_Number': entry_number
                            })
                        
                        # ダブルス組を処理後、グローバルカウンターをインクリメント
                        ENTRY_COUNTER += 1
                        
                        i += 3 # 3行セットをスキップ
                        continue
                    
                    # 選手Bが見つからない場合
                    i += 2
                    continue
                else:
                    # 2行目がチーム名ではない場合
                    pass 
        
        i += 1
        
    return RESULTS

def structure_player_data(chars_df):
    """
    PDFの文字データをX軸で左右に分割し、独立して選手情報を抽出する
    """
    if chars_df.empty:
        return pd.DataFrame(columns=['Player_Name_Raw', 'Split_Index', 'Area_Name', 'Team_Name', 'Entry_Number'])

    # 1. X軸中央値の決定
    X_MID_POINT = chars_df['left'].max() / 2 + X_MID_ADJUSTMENT 
    
    # 2. 文字データを左右に分割
    chars_left = chars_df[chars_df['left'] < X_MID_POINT].copy()
    chars_right = chars_df[chars_df['left'] >= X_MID_POINT].copy()

    # スコア文字除外ロジック
    chars_left = chars_left[chars_left['left'] < X_MID_POINT - X_MAX_RIGHT_PLAYER].copy()
    chars_right = chars_right[chars_right['left'] > X_MID_POINT + X_MAX_LEFT_PLAYER].copy()

    # 3. 左右それぞれで抽出ロジックを実行
    results_left = _group_and_extract_side(chars_left)
    results_left = _group_and_extract_side(chars_left)
    # results_right = _group_and_extract_side(chars_right)

    FINAL_RESULTS = results_left
    # FINAL_RESULTS = results_left + results_right
    
    # 4. 最終的な結果を整形
    df_results = pd.DataFrame(FINAL_RESULTS)
    
    if df_results.empty:
        return pd.DataFrame(columns=['Player_Name_Raw', 'Split_Index', 'Area_Name', 'Team_Name', 'Entry_Number'])
    
    # 重複を削除して整形
    df_final = df_results.drop_duplicates(subset=['Player_Name_Raw', 'Team_Name']).reset_index(drop=True)
    
    # 最終的な出力列を確定
    return df_final[['Player_Name_Raw', 'Split_Index', 'Area_Name', 'Team_Name', 'Entry_Number']]

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