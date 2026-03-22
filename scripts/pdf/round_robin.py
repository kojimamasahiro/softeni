import pdfplumber
import pandas as pd
import re
import os

pd.set_option("display.max_rows", None)
pd.set_option("display.max_columns", None)
pd.set_option("display.width", None)
pd.set_option("display.max_colwidth", None)

# --- 設定 ---
PDF_PATH = 'tournament.pdf'       # 入力PDFファイル名
PAGE_NUMS = list(range(1,2))      # 抽出するページ番号のリスト（1から開始）
Y_TOLERANCE = 3                    # 同じ行と見なすy座標の許容誤差
Y_CROP_MIN = 50                    # 抽出範囲の最小Y座標
Y_CROP_MAX = 880                   # 抽出範囲の最大Y座標
IS_SINGLES = False                 # シングルスの場合はTrueにする

# --- X座標の設定 (要調整) ---
# [エントリー番号] [選手A姓] [選手A名] [選手B姓] [選手B名] [チーム名(エリア)] [順位] の並びを想定

# カラムのX座標定義
X_ENTRY_MIN = 55
X_ENTRY_MAX = 80

# 順位 (要調整 - 必要に応じて変更してください)
X_RANK_MIN = 400
X_RANK_MAX = 440

# 選手A
X_SURNAME_A_MIN = 80
X_SURNAME_A_MAX = 112
X_FIRSTNAME_A_MIN = 112
X_FIRSTNAME_A_MAX = 140

# 選手B
X_SURNAME_B_MIN = 80
X_SURNAME_B_MAX = 112
X_FIRSTNAME_B_MIN = 112
X_FIRSTNAME_B_MAX = 140

X_AREA_MIN = 150
X_AREA_MAX = 180

X_TEAM_MIN = 180
X_TEAM_MAX = 270

USE_NAMEDIVIDER = False

if USE_NAMEDIVIDER:
    from namedivider import BasicNameDivider
    name_divider = BasicNameDivider()

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

            df = df[(df['top'] >= Y_CROP_MIN) & (df['top'] <= Y_CROP_MAX)].reset_index(drop=True)
            
            return df.reset_index(drop=True)

    except Exception as e:
        print(f"致命的なエラー: PDF処理中にエラーが発生しました: {e}")
        return pd.DataFrame()

def extract_lines_from_range(df, x_min, x_max, y_min, y_max, y_tolerance=5):
    """
    指定された矩形範囲内のテキストを、Y座標に基づいて行ごとに抽出してリストで返す。
    各行内のテキストはX座標順にソートされる。
    """
    target = df[
        (df['left'] >= x_min) & (df['left'] <= x_max) &
        (df['top'] >= y_min) & (df['top'] <= y_max)
    ].copy()

    if target.empty:
        return []

    # Y座標で行グループ化
    target = target.sort_values(by='top')
    target['prev_top'] = target['top'].shift(1)
    target['diff'] = target['top'] - target['prev_top']
    target['is_new_line'] = (target['diff'] > y_tolerance) | target['prev_top'].isna()
    target['line_id'] = target['is_new_line'].cumsum()

    lines = []
    for _, group in target.groupby('line_id'):
        # 行内はX座標でソート
        group = group.sort_values(by=['left'])
        lines.append("".join(group['text']).strip())

    return lines

def extract_text_from_range(df, x_min, x_max, y_min, y_max):
    """
    (後方互換性用) 複数行あってもすべて結合して返す
    """
    lines = extract_lines_from_range(df, x_min, x_max, y_min, y_max)
    return "".join(lines).strip()

def group_lines(df):
    """Y座標に基づいてテキストを行ごとにグループ化する"""
    if df.empty:
        return []
    
    df = df.sort_values(by='top')
    df['prev_top'] = df['top'].shift(1)
    df['diff'] = df['top'] - df['prev_top']
    
    # 行が変わったとみなすフラグ
    df['is_new_line'] = (df['diff'] > Y_TOLERANCE) | df['prev_top'].isna()
    df['line_id'] = df['is_new_line'].cumsum()
    
    return [group for _, group in df.groupby('line_id')]

def main_extraction(pdf_path, page_nums):
    all_results = []
    
    for page_num in page_nums:
        print(f"--- Page {page_num} ---")
        df = get_chars_data_from_pdf(pdf_path, page_num)
        if df.empty:
            continue
            
        # 行ごとのグループ化 (ページ全体)
        lines = group_lines(df)
        
        # 設定
        x_settings = {
            'ENTRY_MIN': X_ENTRY_MIN, 'ENTRY_MAX': X_ENTRY_MAX,
            'RANK_MIN': X_RANK_MIN, 'RANK_MAX': X_RANK_MAX,
            'SURNAME_A_MIN': X_SURNAME_A_MIN, 'SURNAME_A_MAX': X_SURNAME_A_MAX,
            'FIRSTNAME_A_MIN': X_FIRSTNAME_A_MIN, 'FIRSTNAME_A_MAX': X_FIRSTNAME_A_MAX,
            'SURNAME_B_MIN': X_SURNAME_B_MIN, 'SURNAME_B_MAX': X_SURNAME_B_MAX,
            'FIRSTNAME_B_MIN': X_FIRSTNAME_B_MIN, 'FIRSTNAME_B_MAX': X_FIRSTNAME_B_MAX,
            'AREA_MIN': X_AREA_MIN, 'AREA_MAX': X_AREA_MAX,
            'TEAM_MIN': X_TEAM_MIN, 'TEAM_MAX': X_TEAM_MAX
        }
        
        # 行処理
        for i, line_df in enumerate(lines):
            """1行分のデータ（line_df）から、設定されたX座標に従って情報を抽出する"""
            if line_df.empty:
                continue

            y_min = line_df['top'].min()
            y_max = line_df['top'].max()
            
            # 選手A
            surname_a = extract_text_from_range(df, x_settings['SURNAME_A_MIN'], x_settings['SURNAME_A_MAX'], line_df['top'].min(), line_df['top'].max())
            firstname_a = extract_text_from_range(df, x_settings['FIRSTNAME_A_MIN'], x_settings['FIRSTNAME_A_MAX'], line_df['top'].min(), line_df['top'].max())
            player_a_text = surname_a + firstname_a

            if not (player_a_text):
                continue

            if i + 1 < len(lines):
                line_df = lines[i+1]
                y_max = line_df['top'].max()
            else:
                continue

            # エントリー
            entry_text = extract_text_from_range(df, x_settings['ENTRY_MIN'], x_settings['ENTRY_MAX'], line_df['top'].min(), line_df['top'].max())
            entry_number_match = re.search(r'[#\d]+', entry_text)
            entry_number = entry_number_match.group() if entry_number_match else None

            # 順位
            rank_text = extract_text_from_range(df, x_settings['RANK_MIN'], x_settings['RANK_MAX'], line_df['top'].min(), line_df['top'].max())
            rank_match = re.search(r'\d+', rank_text)
            rank = int(rank_match.group()) if rank_match else None

            if entry_number is None:
                continue

            if rank != 1:
            # if rank is None:
                continue

            if i + 2 < len(lines):
                line_df = lines[i+2]
                y_max = line_df['top'].max()
            else:
                continue

            # 選手B
            if not IS_SINGLES:
                surname_b = extract_text_from_range(df, x_settings['SURNAME_B_MIN'], x_settings['SURNAME_B_MAX'], line_df['top'].min(), line_df['top'].max())
                firstname_b = extract_text_from_range(df, x_settings['FIRSTNAME_B_MIN'], x_settings['FIRSTNAME_B_MAX'], line_df['top'].min(), line_df['top'].max())
                player_b_text = surname_b + firstname_b
            else:
                surname_b, firstname_b, player_b_text = "", "", ""

            # 地域名 (複数行対応)
            area_lines = extract_lines_from_range(df, x_settings['AREA_MIN'], x_settings['AREA_MAX'], y_min, y_max, y_tolerance=5)
            area_name = "".join(area_lines)

            # チーム名 (複数行対応)
            team_lines = extract_lines_from_range(df, x_settings['TEAM_MIN'], x_settings['TEAM_MAX'], y_min, y_max, y_tolerance=5)
            team_name = "".join(team_lines)

            if not (area_name and team_name):
                continue
            
            results = []
            
            def parse_team_area(text):
                match = re.match(r'^(.*?)\((.*?)\)$', text)
                if match:
                    return match.group(1), match.group(2)
                return text, ""
            
            def separate_team(text):
                if '・' in text:
                    return text.split('・', 1)
                return text, text

            # チーム名の割り振りロジック
            team_a_raw = ""
            team_b_raw = ""
            
            if len(team_lines) == 1:
                # 1行の場合は両方に同じ
                team_a_raw = team_lines[0]
                team_b_raw = team_lines[0]
            elif len(team_lines) >= 2:
                # 2行以上の場合は上から割り振り (3行以上はとりあえず最初の2つを使うか、適宜結合)
                team_a_raw = team_lines[0]
                team_b_raw = team_lines[1]
            else:
                # 0行 (フィルタリングで弾かれるはずだが念のため)
                team_a_raw = ""
                team_b_raw = ""
            
            if len(area_lines) == 1:
                # 1行の場合は両方に同じ
                area_a_raw = area_lines[0]
                area_b_raw = area_lines[0]
            elif len(area_lines) >= 2:
                # 2行以上の場合は上から割り振り (3行以上はとりあえず最初の2つを使うか、適宜結合)
                area_a_raw = area_lines[0]
                area_b_raw = area_lines[1]
            else:
                # 0行 (フィルタリングで弾かれるはずだが念のため)
                area_a_raw = ""
                area_b_raw = ""

            team_name_a, area_name_a = parse_team_area(team_a_raw)
            team_name_b, area_name_b = parse_team_area(team_b_raw)

            # if IS_SINGLES:
            #     team_a_raw = team_name.strip()
            #     team_b_raw = ""
            # else:
            #     team_a_raw, team_b_raw = separate_team(team_name)

            # --- 選手A ---
            if player_a_text:
                results.append({
                    'Entry_Number': entry_number,
                    'Rank': rank,
                    'Surname': surname_a,
                    'First_Name': firstname_a,
                    'Player_Name_Raw': player_a_text,
                    'Area_Name': area_a_raw,
                    'Team_Name': team_a_raw,
                    'Split_Index': len(surname_a)
                })

            # --- 選手B ---
            if not IS_SINGLES and player_b_text:
                results.append({
                    'Entry_Number': entry_number,
                    'Rank': rank,
                    'Surname': surname_b,
                    'First_Name': firstname_b,
                    'Player_Name_Raw': player_b_text,
                    'Area_Name': area_b_raw,
                    'Team_Name': team_b_raw,
                    'Split_Index': len(surname_b)
                })
        
            all_results.extend(results)
            
        # デバッグ用画像の作成 (座標調整用)
        draw_debug_image(page_num, x_settings)

    return pd.DataFrame(all_results)

def draw_debug_image(page_num, settings):
    """抽出範囲を可視化した画像を保存する"""
    try:
        with pdfplumber.open(PDF_PATH) as pdf:
            page = pdf.pages[page_num - 1]
            im = page.to_image()
            
            # 色定義
            colors = {
                'ENTRY': (255, 165, 0),   # Orange
                'RANK': (128, 0, 128),    # Purple
                'SURNAME': (0, 0, 255),   # Blue
                'FIRSTNAME': (0, 0, 150), # Dark Blue
                'AREA': (0, 255, 0),      # Green
                'TEAM': (0, 150, 0)       # Dark Green
            }
            
            def draw_boxes(s):
                # Entry
                im.draw_rect((s['ENTRY_MIN'], 0, s['ENTRY_MAX'], page.height), stroke=colors['ENTRY'], stroke_width=1)
                
                # Rank
                im.draw_rect((s['RANK_MIN'], 0, s['RANK_MAX'], page.height), stroke=colors['RANK'], stroke_width=1)
                
                # Player A
                im.draw_rect((s['SURNAME_A_MIN'], 0, s['SURNAME_A_MAX'], page.height), stroke=colors['SURNAME'], stroke_width=1)
                im.draw_rect((s['FIRSTNAME_A_MIN'], 0, s['FIRSTNAME_A_MAX'], page.height), stroke=colors['FIRSTNAME'], stroke_width=1)
                
                # Player B
                if not IS_SINGLES:
                    im.draw_rect((s['SURNAME_B_MIN'], 0, s['SURNAME_B_MAX'], page.height), stroke=colors['SURNAME'], stroke_width=1)
                    im.draw_rect((s['FIRSTNAME_B_MIN'], 0, s['FIRSTNAME_B_MAX'], page.height), stroke=colors['FIRSTNAME'], stroke_width=1)
                
                # Area
                im.draw_rect((s['AREA_MIN'], 0, s['AREA_MAX'], page.height), stroke=colors['AREA'], stroke_width=1)
                
                # Team
                im.draw_rect((s['TEAM_MIN'], 0, s['TEAM_MAX'], page.height), stroke=colors['TEAM'], stroke_width=1)

            draw_boxes(settings)
            
            # Y Crop lines
            im.draw_line([(0, Y_CROP_MIN), (page.width, Y_CROP_MIN)], stroke=(255, 0, 0), stroke_width=2)
            im.draw_line([(0, Y_CROP_MAX), (page.width, Y_CROP_MAX)], stroke=(255, 0, 0), stroke_width=2)
            
            output_path = f'output/debug_round_robin_page_{page_num}.png'
            os.makedirs('output', exist_ok=True)
            im.save(output_path)
            print(f"Debug image saved to {output_path}")
            
    except Exception as e:
        print(f"Failed to create debug image: {e}")

if __name__ == "__main__":
    if not os.path.exists(PDF_PATH):
        print(f"File not found: {PDF_PATH}")
    else:
        df = main_extraction(PDF_PATH, PAGE_NUMS)
        if not df.empty:
            output_csv = 'output/round_robin_results.csv'
            output_cols = ['Entry_Number', 'Rank', 'Surname', 'First_Name', 'Player_Name_Raw', 'Area_Name', 'Team_Name', 'Split_Index']
            df[output_cols].to_csv(output_csv, index=False, encoding='utf-8-sig')
            print(f"Saved results to {output_csv}")
            print(df[output_cols].head())
        else:
            print("No data extracted.")
