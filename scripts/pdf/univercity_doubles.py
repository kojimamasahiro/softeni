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
Y_TOLERANCE = 1                   # 同じ行と見なすy座標の許容誤差（ポイント）
X_MID_ADJUSTMENT = 0             # X軸の中央値調整（PDFのレイアウトにより変更推奨）
X_MAX_RIGHT_PLAYER = 50                 # 選手名が配置されるX座標の最大値（これより右側にある文字は除外）
X_MAX_LEFT_PLAYER = 80                  # 選手名が配置されるX座標の最小値（これより左側にある文字は除外）

# チーム名を特定するための予備キーワードリスト
TEAM_KEYWORDS = ['高校', '大学']
# ---------------------------------------------

# グローバル変数として辞書を読み込む
UNIVERSITY_NAMES = []
SURNAME_LIST = []

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


# ---------------------------------------------
# 判定・整形関数
# ---------------------------------------------

def is_team_name_line(text):
    print(f"DEBUG: チーム名判定対象テキスト: '{text}'")
    """テキストがチーム名を含むかどうかを判定する（辞書とキーワードベース）"""
    # 判定前に、チーム名の行に含まれる可能性のあるゴミを除去
    clean_text = re.sub(r'[\(\)\d]+', '', text).strip()
    print(f"DEBUG: クリーンテキスト: '{clean_text}'")

    if not clean_text:
        return False

    # 1. 大学名辞書とのチェック
    if UNIVERSITY_NAMES:
        for uni_name in UNIVERSITY_NAMES:
            if uni_name in clean_text:
                print(f"DEBUG: 大学名マッチ: '{uni_name}' in '{clean_text}'")
                return True
    
    # 2. 予備（キーワード）チェック
    return any(keyword in clean_text for keyword in TEAM_KEYWORDS)

def extract_team_data(raw_team_text):
    """チーム名の行から、チーム名本体とエントリー番号を分離する"""
    
    # 1. チーム名から不要な記号（()）を除去
    clean_text = raw_team_text.replace('(', '').replace(')', '').strip()
    print(f"DEBUG: チーム名行のクリーンテキスト: '{clean_text}'")

    entry_number = ""
    team_name = clean_text
    
    # 2. 最初の試み: 末尾の数字をエントリー番号として抽出 (一般的な形式)
    match_end = re.search(r'(\d+)$', clean_text)
    
    if match_end:
        entry_number = match_end.group(1)
        # エントリー番号を除去した残りをチーム名とする
        team_name = clean_text[:match_end.start()].strip()
    
    # 3. ★★★ 修正ロジック: 末尾にエントリー番号がない場合、先頭の数字をエントリー番号とする ★★★
    else:
        # 行の先頭にある連続した数字の塊（例: 63, 12, 001）を探す
        match_start = re.match(r'^(\d+)', clean_text)
        
        if match_start:
            entry_number = match_start.group(1)
            # エントリー番号として扱った数字の塊をチーム名から削除
            team_name = clean_text[match_start.end():].strip()
            
    return team_name, entry_number

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
                break # マッチしたらループを抜ける

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
            # 分割不要または不可能
            split_index = 0 
            
    # 分割を実行
    if split_index > 0:
        surname = player_name_clean[:split_index]
        first_name = player_name_clean[split_index:]
    else:
        # 分割が行われなかった場合
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
            
            # ★★★ 追加したスコア除外ロジック ★★★
            # left座標がX_MAX_PLAYERよりも大きい文字を除外する
            # ただし、右側の選手はX_MID_POINTよりも右にあるため、このフィルタリングは
            # X_MID_POINTよりも小さい値に設定するべき。
            # X_MAX_PLAYERを、左側ブロックの選手名の最大X座標として仮定する。
            
            # 実際には、X_MID_POINTで左右に分けた後に、各行のテキストからスコアを排除する方が安全です。
            # ここでは、PDF全体の中央付近にあるスコアや罫線を排除します。
            
            # X軸分離点よりも右側に配置されているが、右側の選手名ではない、
            # 短いスコアや罫線文字を削除するために、より厳しくフィルタリングする
            # **注意:** このフィルタリングは、X_MID_POINTよりも左側の領域に限定して適用すべきです。
            
            # 一旦、文字数と文字種の簡易チェックをX座標フィルタリングの代わりに使用します。
            
            # PDFの中央付近のデータを残す必要があるため、全削除はしないようにします。
            
            # 簡潔かつ効果的なスコア除外:
            # スコアは数字と記号（-）の組み合わせです。行レベルのテキスト（line_data）で除外します。

            return df.reset_index(drop=True)

    except Exception as e:
        print(f"致命的なエラー: PDF処理中にエラーが発生しました: {e}")
        return pd.DataFrame()

def _group_and_extract_side(side_chars_df):
    """
    左右どちらか一方の文字データを受け取り、Y軸でグループ化して選手情報を抽出する
    """
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

    # print(line_data[['line_group','text']])
    RESULTS = []
    i = 0
    
    # 2. 行を走査し、ダブルス（選手A -> チーム名 -> 選手B）のパターンを抽出
    while i < len(line_data):
        line = line_data.iloc[i]

        # 2.1 スコア、罫線、または純粋な数字のみの行を除外
        text_check = line['text']
        
        # スコアや数字、記号（-、:）のみで構成されているかチェック
        is_score_only = re.fullmatch(r'[\d\s\-\.,:]+', text_check) 
        
        if is_score_only:
            i += 1
            continue
        
        # 短いテキストのスキップ (トーナメント表の線など)
        if len(text_check) < 2:
            i += 1
            continue 
            
        # スコア行や予期せぬ行のスキップ 
        if re.search(r'\d-\d', line['text']) or len(line['text']) < 2:
            i += 1
            continue

        # print(f"DEBUG: 処理中の行 {i}: '{line['text']}'")
        if not is_team_name_line(line['text']):
            player_1_line = line
            
            if i + 1 < len(line_data):
                next_line = line_data.iloc[i + 1]
                
                if is_team_name_line(next_line['text']):
                    team_line = next_line
                    
                    if i + 2 < len(line_data):
                        player_2_line = line_data.iloc[i + 2]
                        # print(f"DEBUG: 3行目候補テキスト: {player_2_line['text']}")

                        # 3. 抽出と構造化
                        raw_team_text = team_line['text']
                        team_name, entry_number = extract_team_data(raw_team_text)
                        
                        # 選手Aの処理
                        _, _, raw_name_a, split_index_a = \
                            get_name_split_info(player_1_line['text']) 
                        
                        if raw_name_a:
                            RESULTS.append({
                                'Player_Name_Raw': raw_name_a,        
                                'Split_Index': split_index_a,         
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
                                'Team_Name': team_name, 
                                'Entry_Number': entry_number
                            })
                        
                        i += 3 
                        continue
                    
                    # print(f"DEBUG: 3行目が見つかりません。2行目（チーム名）まで処理し i += 2")
                    i += 2
                    continue
                else:
                    print(f"DEBUG: 2行目がチーム名ではありません: {next_line['text']}")
        else:
            print(f"DEBUG: チーム名行が選手名行として誤認されました: {line['text']}")
        
        i += 1
        
    return RESULTS

def structure_player_data(chars_df):
    """
    PDFの文字データをX軸で左右に分割し、独立して選手情報を抽出する
    """
    if chars_df.empty:
        return pd.DataFrame(columns=['Player_Name_Raw', 'Split_Index', 'Team_Name', 'Entry_Number'])

    # 1. X軸中央値の決定
    X_MID_POINT = chars_df['left'].max() / 2 + X_MID_ADJUSTMENT 
    
    # 2. 文字データを左右に分割
    chars_left = chars_df[chars_df['left'] < X_MID_POINT].copy()
    chars_right = chars_df[chars_df['left'] >= X_MID_POINT].copy()

    # ★★★ 左側ブロックのスコア文字除外ロジックを挿入 ★★★
    # 左側のブロックに紛れ込んだ、X座標が大きい不要な文字（主にスコア）を除外
    chars_left = chars_left[chars_left['left'] < X_MID_POINT - X_MAX_RIGHT_PLAYER].copy()
    chars_right = chars_right[chars_right['left'] > X_MID_POINT + X_MAX_LEFT_PLAYER].copy()

    # 3. 左右それぞれで抽出ロジックを実行
    results_left = _group_and_extract_side(chars_left)
    results_right = _group_and_extract_side(chars_right)

    FINAL_RESULTS = results_left + results_right
    
    # 4. 最終的な結果を整形
    df_results = pd.DataFrame(FINAL_RESULTS)
    
    if df_results.empty:
        return pd.DataFrame(columns=['Player_Name_Raw', 'Split_Index', 'Team_Name', 'Entry_Number'])
    
    # 重複を削除して整形
    df_final = df_results.drop_duplicates(subset=['Player_Name_Raw', 'Team_Name']).reset_index(drop=True)
    
    # 最終的な出力列を確定
    return df_final[['Player_Name_Raw', 'Split_Index', 'Team_Name', 'Entry_Number']]

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
            print("--- PDF文字データ（抽出のベース）---")
            # print(chars_data_df[['text', 'left', 'top']].head(100)) 
            print("\n---------------------------\n")

            structured_df = structure_player_data(chars_data_df)
            
            if not structured_df.empty:
                OUTPUT_FILE = 'output/softtennis_players_separated.csv'
                structured_df.to_csv(OUTPUT_FILE, index=False, encoding='utf8')
                print(f"✅ 選手情報（元の名前、分割情報付き）の抽出が完了しました。")
                print(f"結果は '{OUTPUT_FILE}' に保存されました。")
                print("\n--- 抽出結果（先頭5行） ---")
                # print(structured_df.head())
            else:
                print("構造化処理の結果、有効な選手データが抽出されませんでした。")