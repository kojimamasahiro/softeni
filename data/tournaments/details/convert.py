import os
import glob
import unicodedata
import re

# 変換対象のディレクトリを指定
TARGET_DIR = "."
# 変換対象の拡張子を指定
EXTENSIONS = ["*.txt", "*.json"]

def convert_half_to_full(text):
    # 半角カタカナの範囲(\uFF61-\uFF9F)のみを抽出して全角に変換する
    # これにより全角・半角の括弧や英数字はそのまま保持されます
    return re.sub(r'[\uFF61-\uFF9F]+', lambda m: unicodedata.normalize('NFKC', m.group(0)), text)

for ext in EXTENSIONS:
    # サブディレクトリも含めて再帰的に検索
    for filepath in glob.glob(os.path.join(TARGET_DIR, '**', ext), recursive=True):
        if not os.path.isfile(filepath):
            continue
            
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        converted = convert_half_to_full(content)
        
        if content != converted:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(converted)
            print(f"Converted: {filepath}")

print("変換が完了しました。")
