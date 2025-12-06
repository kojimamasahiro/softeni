import json
import os
import glob

DATA_DIR = "../../../data/tournaments/details"
RESULTS_PATH = "results.json"

def main():
    all_results = []
    team_prefecture_map = {}

    print(f"📂 {DATA_DIR} を探索します...")
    target_tournaments = [d for d in os.listdir(DATA_DIR) if d.startswith("highschool-")]

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
                if "boys" in filename:
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
                            team_name = team_names[0]
                            prefecture = team_prefecture_map.get(team_name, "")
                            
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
