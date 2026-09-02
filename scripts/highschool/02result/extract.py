import json
import os
import glob
import pathlib

# ファイルパス（実行時のカレントディレクトリに依存しないよう、このファイルの場所を基準にする）
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
DATA_DIR = str(SCRIPT_DIR / "../../../data/tournaments/details")
RESULTS_PATH = str(SCRIPT_DIR / "results.json")
TOURNAMENTS_INDEX_PATH = str(SCRIPT_DIR / "../../../data/tournaments/index.json")


# 中学生・小学生**専用**の大会。高校カテゴリの集計に入れてはいけない（2026-08-13 追加）。
#
# ここを除外しないと、中学校のチームが高校の学校ページに混ざる。
# 経路は2つあり、どちらも実在した:
#   1. `四天王寺中学校` のような中高一貫校が、03list の normalize_school_name で
#      「中学校」を落とされて高校の `四天王寺` に一致する（同日に normalize 側も修正済み）
#   2. `栃木` `砺波` `豊浦` のように**接尾辞が無く高校名と完全一致する**中学校名。
#      正規化を直しても一致してしまうので、大会そのものを除外するしかない（39種・143件）
#
# **全日本選手権・全日本シングルス・東西日本などは除外しない。** 高体連の高校生が
# 正当に出場しており、「この高校の選手が全日本でベスト8」は高校ページに出すべき情報。
# `zennihon-junior` も除外しない（u17/u20 は高校生。u14 で高校名に一致するのは実測0件）。
#
# 一覧の実体は ../lib/pipeline-sources.json に置いてある（2026-09-02 に移動）。
# 鮮度チェック（../lib/source-hash.mjs）が同じ集合をハッシュ対象にする必要があり、
# 両方に書くと片方だけ育って気付けないため。
PIPELINE_SOURCES_PATH = str(SCRIPT_DIR / "../lib/pipeline-sources.json")

with open(PIPELINE_SOURCES_PATH, encoding="utf-8") as f:
    EXCLUDED_TOURNAMENT_IDS = set(json.load(f)["excludedTournamentIds"])


def load_target_tournaments():
    with open(TOURNAMENTS_INDEX_PATH, encoding="utf-8") as f:
        tournaments = json.load(f)

    tournament_ids = []
    skipped = []
    for tournament in tournaments:
        tournament_id = tournament.get("tournamentId")
        if not tournament_id:
            continue
        tournament_path = os.path.join(DATA_DIR, tournament_id)
        if not os.path.isdir(tournament_path):
            continue
        if tournament_id in EXCLUDED_TOURNAMENT_IDS:
            skipped.append(tournament_id)
            continue
        tournament_ids.append(tournament_id)

    if skipped:
        print(f"⏭️  中学・小学専用の大会を除外しました: {len(skipped)}件 ({', '.join(sorted(skipped))})")

    return tournament_ids

def main():
    all_results = []
    team_prefecture_map = {}

    print(f"📂 {DATA_DIR} を探索します...")
    target_tournaments = load_target_tournaments()

    # 1. チーム・都道府県マップの構築 (participants があるファイルから)
    print("🔄 チーム・都道府県マップを構築中...")
    for tournament_id in target_tournaments:
        tournament_path = os.path.join(DATA_DIR, tournament_id)
        if not os.path.isdir(tournament_path):
            continue
        
        for year in os.listdir(tournament_path):
            year_path = os.path.join(tournament_path, year)
            if not os.path.isdir(year_path):
                continue
            
            json_files = glob.glob(os.path.join(year_path, "*.json"))
            for json_file in json_files:
                try:
                    with open(json_file, encoding="utf-8") as f:
                        data = json.load(f)
                        if "participants" in data and isinstance(data["participants"], list):
                            for p in data["participants"]:
                                team = p.get("team", "")
                                if team:
                                    team = team.strip()
                                
                                pref = p.get("prefecture")
                                if pref:
                                    pref = pref.strip()
                                else:
                                    pref = ""

                                if team and pref:
                                    team_prefecture_map[team] = pref
                except Exception:
                    pass

    print(f"✅ {len(team_prefecture_map)} チームの都道府県情報を取得しました")

    # 2. 結果の抽出
    print("🔄 結果データを抽出中...")
    for tournament_id in target_tournaments:
        tournament_path = os.path.join(DATA_DIR, tournament_id)
        if not os.path.isdir(tournament_path):
            continue
        
        for year in os.listdir(tournament_path):
            year_path = os.path.join(tournament_path, year)
            if not os.path.isdir(year_path):
                continue
            
            json_files = glob.glob(os.path.join(year_path, "*.json"))
            for json_file in json_files:
                filename = os.path.basename(json_file)
                
                # カテゴリ判定
                category = "default"
                if "doubles" in filename:
                    category = "doubles"
                elif "singles" in filename:
                    category = "singles"
                elif "team" in filename:
                    category = "team"

                # 性別判定
                gender = "unknown"
                if "mixed" in filename:
                    gender = "mixed"
                elif "boys" in filename:
                    gender = "boys"
                elif "girls" in filename:
                    gender = "girls"

                try:
                    with open(json_file, encoding="utf-8") as f:
                        data = json.load(f)

                    entries = {e["entryNo"]: e for e in data.get("entries", [])}
                    results = data.get("results", [])

                    for res in results:
                        entry_no = res.get("entryNo")
                        entry_info = entries.get(entry_no)
                        
                        if not entry_info:
                            continue

                        tournament = res.get("tournament")
                        result_label = ""
                        
                        if tournament and isinstance(tournament, dict):
                            result_label = tournament.get("label", "")
                        
                        # ラウンドロビンで敗退した場合は「予選敗退」として扱う
                        if not result_label:
                            # roundRobin と roundrobin の両方をチェック
                            round_robin = res.get("roundRobin") or res.get("roundrobin")
                            if round_robin and isinstance(round_robin, dict) and round_robin.get("rank"):
                                result_label = "予選敗退"
                        
                        if not result_label:
                            continue

                        # 団体戦
                        if category == "team":
                            # playerIds にチーム名が入っている
                            team_names = entry_info.get("playerIds", [])
                            if not team_names:
                                continue
                            team_name_raw = team_names[0]
                            team_name = team_name_raw
                            prefecture = team_prefecture_map.get(team_name_raw, "")

                            # 新フォーマット: "__チーム名_都道府県"（姓_名_チーム_都道府県 の統一形式で姓名が空）
                            if not prefecture and isinstance(team_name_raw, str) and team_name_raw.startswith("__"):
                                stripped = team_name_raw[2:]  # "__" を除去
                                if "_" in stripped:
                                    team_name, prefecture = stripped.rsplit("_", 1)
                                else:
                                    team_name = stripped
                            # 旧フォーマット: "チーム名_都道府県"
                            elif not prefecture and isinstance(team_name_raw, str) and "_" in team_name_raw:
                                base, suffix = team_name_raw.rsplit("_", 1)
                                # まず base 名でマップを探す
                                if base and base in team_prefecture_map:
                                    prefecture = team_prefecture_map.get(base, "")
                                    team_name = base
                                else:
                                    # マップに無ければ suffix をそのまま都道府県として使う
                                    prefecture = suffix
                            
                            all_results.append({
                                "team": team_name,
                                "prefecture": prefecture,
                                "result": result_label,
                                "category": category,
                                "tournamentId": tournament_id,
                                "year": int(year) if year.isdigit() else year,
                                "gender": gender
                            })

                        # 個人戦 (シングルス・ダブルス)
                        else:
                            player_ids = entry_info.get("playerIds", [])
                            all_results.append({
                                "playerIds": player_ids,
                                "result": result_label,
                                "category": category,
                                "tournamentId": tournament_id,
                                "year": int(year) if year.isdigit() else year,
                                "gender": gender
                            })

                except Exception as e:
                    print(f"⚠️ {json_file} の処理中にエラー: {e}")

    output = {"results": all_results}

    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"✅ {RESULTS_PATH} を生成しました。合計 {len(all_results)} 件の結果を含みます。")

if __name__ == "__main__":
    main()
