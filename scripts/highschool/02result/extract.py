import json
import os
import glob
import pathlib

# ファイルパス（実行時のカレントディレクトリに依存しないよう、このファイルの場所を基準にする）
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
DATA_DIR = str(SCRIPT_DIR / "../../../data/tournaments/details")
RESULTS_PATH = str(SCRIPT_DIR / "results.json")
TOURNAMENTS_INDEX_PATH = str(SCRIPT_DIR / "../../../data/tournaments/index.json")


def load_target_tournaments():
    with open(TOURNAMENTS_INDEX_PATH, encoding="utf-8") as f:
        tournaments = json.load(f)

    tournament_ids = []
    for tournament in tournaments:
        tournament_id = tournament.get("tournamentId")
        if not tournament_id:
            continue
        tournament_path = os.path.join(DATA_DIR, tournament_id)
        if os.path.isdir(tournament_path):
            tournament_ids.append(tournament_id)

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
