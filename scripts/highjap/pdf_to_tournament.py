import pdfplumber
import pandas as pd
import re
import os

pd.set_option("display.max_rows", None)   # 行をすべて表示
pd.set_option("display.max_columns", None) # 列をすべて表示
pd.set_option("display.width", None)      # 横幅を自動調整（改行しない）
pd.set_option("display.max_colwidth", None)  # 列の内容を省略せず全表示

# --- 設定 ---
PDF_PATH = 'data/tournament.pdf'        # 入力PDFファイル名
PAGE_NUMS = list(range(1, 2))      # 抽出するページ番号のリスト（1から開始）
Y_TOLERANCE = 2                   # 同じ行と見なすy座標の許容誤差（ポイント）
SMALL_SIZE_THRESHOLD = 6.5
Y_CROP_MIN = 75                  # ★ 抽出範囲の最小Y座標 (上端)
Y_CROP_MAX = 1800                 # ★ 抽出範囲の最大Y座標 (下端)

X_LEFT_NAME_MIN = 0    # 左側 姓の最小X座標
X_LEFT_NAME_MAX = 205 # 左側 名の最大X座標
X_LEFT_ENTRY_MIN = 210    # 左側エントリー番号の最小X座標
X_LEFT_ENTRY_MAX = 225    # 左側エントリー番号の最大X座標

X_RIGHT_NAME_MIN = 400   # 右側 姓の最小X座標
X_RIGHT_NAME_MAX = 620 # 右側 名の最大X座標
X_RIGHT_ENTRY_MIN = 380  # 右側エントリー番号の最小X座標
X_RIGHT_ENTRY_MAX = 400  # 右側エントリー番号の最大X座標

# ---------------------------------------------
# 抽出関数
# ---------------------------------------------

def get_chars_data_from_pdf(pdf_path, page_num):
    """PDFから文字情報（テキストと座標）を抽出し、DataFrameとして返す"""
    global Y_CROP_MIN, Y_CROP_MAX
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

def _group_and_extract_side(side_chars_df, is_left_side):
    """
    左右どちらか一方の文字データを受け取り、Y軸でグループ化して選手情報を抽出する
    """
    if side_chars_df.empty:
        return []

    ################## 指定する
    extraction_strategy = singles_extraction_strategy

    # 座標設定を決定
    if is_left_side:
        X_SETTINGS = {
            'NAME_MIN': X_LEFT_NAME_MIN, 'NAME_MAX': X_LEFT_NAME_MAX,
            'ENTRY_MIN': X_LEFT_ENTRY_MIN, 'ENTRY_MAX': X_LEFT_ENTRY_MAX,
        }
    else:
        X_SETTINGS = {
            'NAME_MIN': X_RIGHT_NAME_MIN, 'NAME_MAX': X_RIGHT_NAME_MAX,
            'ENTRY_MIN': X_RIGHT_ENTRY_MIN, 'ENTRY_MAX': X_RIGHT_ENTRY_MAX,
        }

    # 1. Y座標に基づき、文字レベルのデータを「行レベル」のデータに集約 (既存のロジック)
    data = side_chars_df.sort_values(by=['top', 'left']).copy()

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

    # 3. 戦略に基づいてデータを抽出
    RESULTS = extraction_strategy(line_data, data, X_SETTINGS)
        
    return RESULTS

# singles
def singles_extraction_strategy(line_data, data_df, X_SETTINGS):
    """
    標準的な抽出戦略: 1行ずつ走査してデータを抽出する
    """
    RESULTS = []
    for i in range(len(line_data)):
        line = line_data.iloc[i]

        # スコア行などのフィルタリング
        text_check = line['full_text'].strip()
        # 非常に短いテキスト、数字・記号のみ、またはスコアパターンの場合はスキップ
        if not text_check or len(text_check) < 2 or \
           re.fullmatch(r'[\d\s\-\.,:()]+', text_check) or \
           re.search(r'\d-\d', text_check):
            continue

        # 1行からすべての情報を抽出
        name, entry_text = extract_single_line_content(line, data_df, X_SETTINGS)
        
        # 選手名が存在する場合のみ追加
        if name:
            entry_number = None
            if entry_text and entry_text.isdigit():
                entry_number = int(entry_text)
            
            RESULTS.append({
                'Name': name,
                'Entry_Number': entry_number
            })
    return RESULTS

def structure_player_data(chars_df, page_num):
    """
    PDFの文字データをX軸で左右に分割し、独立して選手情報を抽出する
    """
    if chars_df.empty:
        return pd.DataFrame(columns=['Surname', 'First_Name', 'Player_Name_Raw', 'Split_Index', 'Area_Name', 'Team_Name', 'Entry_Number'])

    # -----------------------------------------------------------------
    # ★ デバッグ機能の統合: PDFページを画像として出力し、抽出範囲を描画する
    # -----------------------------------------------------------------
    try:
        with pdfplumber.open(PDF_PATH) as pdf:
            page = pdf.pages[page_num - 1]
            DEBUG_IMAGE_PATH = f'data/debug_page_{page_num}.png'
            # draw_extraction_boxesの定義をmainブロックの外側に配置し、アクセス可能にする必要があります
            draw_extraction_boxes(page, DEBUG_IMAGE_PATH) 
    except Exception as e:
        print(f"警告: デバッグ画像の生成中にエラーが発生しました: {e}")

    try:
        with pdfplumber.open(PDF_PATH) as pdf:
            page = pdf.pages[page_num - 1]
            mid_x = page.width / 2  # ページの真ん中
    except Exception as e:
        print(f"警告: ページ幅の取得に失敗しました: {e}")
        mid_x = 300  # デフォルト値（必要に応じて調整）

    # 2. 文字データを左右に分割
    chars_left = chars_df[chars_df['left'] <= mid_x].copy()
    chars_right = chars_df[chars_df['left'] > mid_x].copy()

    # 3. 左右それぞれで抽出ロジックを実行
    results_left = _group_and_extract_side(chars_left, is_left_side=True)
    results_right = _group_and_extract_side(chars_right, is_left_side=False)

    FINAL_RESULTS = results_left + results_right

    # 4. 最終的な結果を整形
    df_results = pd.DataFrame(FINAL_RESULTS)
    
    if df_results.empty:
        return pd.DataFrame(columns=['Name', 'Entry_Number'])
    
    # 重複を削除して整形
    df_final = df_results.drop_duplicates(subset=['Name']).reset_index(drop=True)

    # 最終的な出力列を確定
    return df_final[['Name', 'Entry_Number']]

def check_line_presence(line_data_row, data_df, X_SETTINGS):
    """
    1行のデータに対して、X座標範囲に文字が存在するかを判定し、辞書で返す。
    """
    Y_MIN, Y_MAX = line_data_row['top_min'], line_data_row['top_max']

    def is_present(min_x, max_x):
        """指定されたX範囲に文字が存在するかどうか(ブール値)をチェック"""
        chars_count = data_df[
            (data_df['left'] >= min_x) & (data_df['left'] <= max_x) &
            (data_df['top'] >= Y_MIN) & (data_df['top'] <= Y_MAX)
        ].shape[0]
        return chars_count > 0

    is_name_present = is_present(X_SETTINGS['NAME_MIN'], X_SETTINGS['NAME_MAX'])
    player_present = is_name_present

    return {
        # 選手名:名前範囲に文字があることを確認
        'player': player_present, 
        'entry': is_present(X_SETTINGS['ENTRY_MIN'], X_SETTINGS['ENTRY_MAX']),
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
    raw_entry_text = extract_text(X_SETTINGS['ENTRY_MIN'], X_SETTINGS['ENTRY_MAX'])
    
    # 座標ベース使用時: 姓と名を別々に返す
    raw_name_text = extract_text(X_SETTINGS['NAME_MIN'], X_SETTINGS['NAME_MAX'])
    return raw_name_text, raw_entry_text

def draw_extraction_boxes(page, file_path):
    """
    pdfplumberページオブジェクトに、設定されたX座標の抽出範囲を描画する。
    """
    global Y_CROP_MIN, Y_CROP_MAX

    global X_LEFT_NAME_MIN, X_LEFT_NAME_MAX
    global X_RIGHT_NAME_MIN, X_RIGHT_NAME_MAX
    global X_LEFT_ENTRY_MIN, X_LEFT_ENTRY_MAX, X_RIGHT_ENTRY_MIN, X_RIGHT_ENTRY_MAX


    # 左右のエントリー番号のX設定をX_SETTINGSに含めるために統合
    X_SETTINGS_LEFT = {
        'NAME_MIN': X_LEFT_NAME_MIN, 'NAME_MAX': X_LEFT_NAME_MAX,
        'ENTRY_MIN': X_LEFT_ENTRY_MIN, 'ENTRY_MAX': X_LEFT_ENTRY_MAX,
    }
    
    X_SETTINGS_RIGHT = {
        'NAME_MIN': X_RIGHT_NAME_MIN, 'NAME_MAX': X_RIGHT_NAME_MAX,
        'ENTRY_MIN': X_RIGHT_ENTRY_MIN, 'ENTRY_MAX': X_RIGHT_ENTRY_MAX,
    }

    # 描画する矩形 (rects) のリスト
    rects = []
    
    # 色の設定 (R, G, B)
    COLORS = {
        'NAME': (0, 0, 255),    # 青
        'ENTRY': (255, 165, 0),   # オレンジ
        'CROP_LINE': (0, 0, 0)     # 黒 (クロップ境界線)
    }

    def add_rects(settings):
        # 選手名
        rects.append({'rect': (settings['NAME_MIN'], 0, settings['NAME_MAX'], page.height), 'color': COLORS['NAME']})
        # エントリー番号
        rects.append({'rect': (settings['ENTRY_MIN'], 0, settings['ENTRY_MAX'], page.height), 'color': COLORS['ENTRY']})

    # 左右の範囲を追加
    add_rects(X_SETTINGS_LEFT)
    add_rects(X_SETTINGS_RIGHT)

    rects.append({'rect': (0, Y_CROP_MIN, page.width, Y_CROP_MIN), 'color': COLORS['CROP_LINE'], 'fill': COLORS['CROP_LINE']}) # Top boundary
    rects.append({'rect': (0, Y_CROP_MAX, page.width, Y_CROP_MAX), 'color': COLORS['CROP_LINE'], 'fill': COLORS['CROP_LINE']}) # Bottom boundary

    # ページ全体を画像として取得
    im = page.to_image()

    # 各矩形を描画
    for rect in rects:
        # ページ全体にわたる縦線として描画するため、Y座標は 0 からページ高さまでとする
        im.draw_rect(
            rect['rect'], 
            stroke=rect['color'], # 枠線の色
            stroke_width=1
        ) 

    # 画像を保存
    im.save(file_path)

    print(f"✅ デバッグ画像が '{file_path}' に保存されました。X座標の確認にご利用ください。")

# ---------------------------------------------
# メイン処理
# ---------------------------------------------
if __name__ == '__main__':
    if not os.path.exists(PDF_PATH):
        print(f"エラー: 入力ファイル '{PDF_PATH}' が見つかりません。ファイルを配置してください。")
    else:
        all_structured_dfs = []
        
        for page_num in PAGE_NUMS:
            print(f"--- ページ {page_num} の処理開始 ---")
            chars_data_df = get_chars_data_from_pdf(PDF_PATH, page_num)
            
            if chars_data_df.empty:
                print(f"警告: ページ {page_num} から文字データが取得できませんでした。スキップします。")
                continue
            
            structured_df = structure_player_data(chars_data_df, page_num)
            
            if not structured_df.empty:
                all_structured_dfs.append(structured_df)
                print(f"ページ {page_num}: {len(structured_df)} 件のデータを抽出しました。")
            else:
                print(f"ページ {page_num}: 有効なデータが見つかりませんでした。")

        if all_structured_dfs:
            final_df = pd.concat(all_structured_dfs, ignore_index=True)
            output_cols = ['Entry_Number', 'Name']
            # Entry_Numberで昇順ソート（Noneは最後に）
            final_df_sorted = final_df.sort_values(by=['Entry_Number', 'Name'], na_position='last').reset_index(drop=True)

            OUTPUT_FILE = 'data/tournament.txt'
            # Entry_NumberとNameを半角スペース区切りで1行ずつ出力
            with open(OUTPUT_FILE, 'w', encoding='utf8') as f:
                for _, row in final_df_sorted.iterrows():
                    entry = str(row['Entry_Number']) if pd.notnull(row['Entry_Number']) else ''
                    name = str(row['Name']) if pd.notnull(row['Name']) else ''
                    f.write(f"{entry} {name}\n")

            print(f"\n✅ 全ページの処理が完了しました。合計 {len(final_df_sorted)} 件のデータを抽出しました。")
            print(f"結果は '{OUTPUT_FILE}' に保存されました。")
            print("\n--- 抽出結果（先頭3行） ---")
            with open(OUTPUT_FILE, 'r', encoding='utf8') as f:
                for i, line in enumerate(f):
                    if i >= 3:
                        break
                    print(line.strip())
        else:
            print("構造化処理の結果、有効な選手データが抽出されませんでした。")