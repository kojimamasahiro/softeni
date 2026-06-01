import glob
import json
import os
from collections import defaultdict
import unicodedata

def normalize_pair_name(name):
    return unicodedata.normalize("NFKC", name)

# ファイルパス
results_path = "../02result/results.json"
teams_path = "../01team/teams.json"
prefecture_path = "../prefectures.json"
output_path = "prefecture-summary.json"
alias_output_path = "inferred-team-aliases.json"
tournaments_index_path = "../../../data/tournaments/index.json"
tournaments_details_dir = "../../../data/tournaments/details"
suspicious_output_path = "suspicious-team-aliases.json"

EXCLUDED_GENERATIONS = {
    "junior",
    "university",
    "corporate",
}

def load_major_tournament_ids():
    with open(tournaments_index_path, "r", encoding="utf-8") as f:
        tournaments = json.load(f)

    return {
        tournament["tournamentId"]
        for tournament in tournaments
        if (
            tournament.get("tournamentId")
            and tournament.get("generationId")
            not in EXCLUDED_GENERATIONS
        )
    }

def build_same_name_team_alias_map(major_tournament_ids, known_highschool_team_names):
    parent = {}

    def find(name):
        parent.setdefault(name, name)
        if parent[name] != name:
            parent[name] = find(parent[name])
        return parent[name]

    def union(a, b):
        root_a = find(a)
        root_b = find(b)
        if root_a != root_b:
            parent[root_b] = root_a

    player_team_groups = defaultdict(set)
    evidence_groups = defaultdict(list)
    duplicate_players_in_same_tournament = set()

    for tournament_id in sorted(major_tournament_ids):
        tournament_dir = os.path.join(tournaments_details_dir, tournament_id)
        if not os.path.isdir(tournament_dir):
            continue

        for year in os.listdir(tournament_dir):
            year_dir = os.path.join(tournament_dir, year)
            if not os.path.isdir(year_dir):
                continue

            json_files = glob.glob(os.path.join(year_dir, "*.json"))
            for json_file in json_files:
                seen_players_in_file = defaultdict(set)
                filename = os.path.basename(json_file)
                try:
                    with open(json_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                except Exception:
                    continue

                for entry in data.get("entries", []):
                    for player_id in entry.get("playerIds", []):
                        parts = player_id.split("_")
                        if len(parts) < 3:
                            continue

                        last_name = parts[0].strip()
                        first_name = parts[1].strip()
                        team_name = parts[2].strip()

                        if not last_name or not first_name or not team_name:
                            continue

                        key = (year, last_name, first_name)

                        seen_players_in_file[key].add(team_name)

                        if len(seen_players_in_file[key]) >= 2:
                            duplicate_players_in_same_tournament.add(key)

                        player_team_groups[key].add(team_name)
                        evidence_groups[key].append(
                            {
                                "tournamentId": tournament_id,
                                "file": filename,
                                "team": team_name,
                            }
                        )

    alias_map = {}
    alias_debug = []
    groups_by_canonical = defaultdict(set)
    evidence_by_canonical = defaultdict(list)

    for (year, last_name, first_name), team_names in sorted(player_team_groups.items()):
        if (year, last_name, first_name) in duplicate_players_in_same_tournament:
            print(
                f"⚠️ 同大会同姓同名を除外:"
                f" {year} {last_name}{first_name}"
                f" -> {sorted(team_names)}"
            )
            continue

        if len(team_names) < 2:
            continue

        sorted_names = sorted(team_names)
        canonical = sorted(sorted_names, key=lambda name: (len(name), name))[0]

        for alias in sorted_names:
            union(canonical, alias)

        alias_debug.append(
            {
                "year": int(year) if str(year).isdigit() else year,
                "lastName": last_name,
                "firstName": first_name,
                "canonicalCandidate": canonical,
                "aliases": sorted_names,
                "evidence": sorted(
                    evidence_groups[(year, last_name, first_name)],
                    key=lambda item: (item["tournamentId"], item["file"], item["team"]),
                ),
            }
        )

        EXCLUDED_ALIAS_PAIRS = {
            frozenset([
                normalize_pair_name("城山観光"),
                normalize_pair_name("ＳＨＩＲＯＹＡＭＡＨＯＴＥＬｋａｇｏｓｈｉｍａ"),
            ]),
            frozenset([
                normalize_pair_name("都商OB"),
                normalize_pair_name("都城商業高校ＯＢ"),
            ]),
            frozenset([
                normalize_pair_name("YONEX"),
                normalize_pair_name("ヨネックス"),
            ]),
        }

        if len(team_names) >= 2:
            names = sorted(team_names)

            common_lengths = []
            compared_count = 0

            for i in range(len(names)):
                for j in range(i + 1, len(names)):
                    left = normalize_pair_name(names[i])
                    right = normalize_pair_name(names[j])

                    # 半角全角違いのみ
                    if left == right:
                        continue

                    # 明示的な除外ペア
                    if frozenset([left, right]) in EXCLUDED_ALIAS_PAIRS:
                        continue

                    compared_count += 1

                    common_lengths.append(
                        longest_common_substring(
                            normalize_school_name(left),
                            normalize_school_name(right),
                        )
                    )

            # 全ペアが除外された場合
            if compared_count == 0:
                continue

            max_common = max(common_lengths)

            if max_common < 2:
                print(
                    f"{year} {last_name}{first_name}"
                    f" -> {names}"
                )

    for item in alias_debug:
        canonical_root = find(item["canonicalCandidate"])
        groups_by_canonical[canonical_root].update(item["aliases"])
        evidence_by_canonical[canonical_root].append(
            {
                "year": item["year"],
                "lastName": item["lastName"],
                "firstName": item["firstName"],
                "aliases": item["aliases"],
                "evidence": item["evidence"],
            }
        )

    compact_alias_debug = []
    suspicious_aliases = []

    for canonical_root, names in sorted(groups_by_canonical.items()):
        aliases = sorted(names, key=lambda name: (len(name), name))
        if not any(alias in known_highschool_team_names for alias in aliases):
            continue
        known_aliases = [
            alias for alias in aliases if alias in known_highschool_team_names
        ]
        canonical = (
            sorted(known_aliases, key=lambda name: (len(name), name))[0]
            if known_aliases
            else aliases[0]
        )
        compact_alias_debug.append(
            {
                "canonical": canonical,
                "aliases": aliases,
                "reasons": sorted(
                    evidence_by_canonical[canonical_root],
                    key=lambda item: (
                        item["year"],
                        item["lastName"],
                        item["firstName"],
                    ),
                ),
            }
        )
        for alias in aliases:
            alias_map[alias] = canonical



        for item in compact_alias_debug:

            aliases = item["aliases"]

            normalized = [
                normalize_school_name(a)
                for a in aliases
            ]

            common_lengths = []

            for i in range(len(normalized)):
                for j in range(i + 1, len(normalized)):

                    common = longest_common_substring(
                        normalized[i],
                        normalized[j],
                    )

                    common_lengths.append(common)

            min_common = (
                min(common_lengths)
                if common_lengths
                else 999
            )

            if min_common < 2:
                suspicious_aliases.append({
                    **item,
                    "minCommonLength": min_common
                })

    return (
        alias_map,
        compact_alias_debug,
        suspicious_aliases,
    )

def normalize_team_name(team_name, alias_map):
    return alias_map.get(team_name, team_name)

def normalize_school_name(name):
    remove_words = [
        "高校",
        "高等学校",
        "中学校",
        "中等教育学校",
    ]

    for word in remove_words:
        name = name.replace(word, "")

    return name.strip()


def longest_common_substring(a, b):
    max_len = 0

    for i in range(len(a)):
        for j in range(i + 1, len(a) + 1):
            part = a[i:j]
            if part in b:
                max_len = max(max_len, len(part))

    return max_len

# データ読み込み
with open(results_path, "r", encoding="utf-8") as f:
    results_data = json.load(f)

with open(teams_path, "r", encoding="utf-8") as f:
    teams_data = json.load(f)

with open(prefecture_path, "r", encoding="utf-8") as f:
    prefecture_data = json.load(f)

major_tournament_ids = load_major_tournament_ids()
known_highschool_team_names = {team["name"] for team in teams_data}
team_alias_map, alias_debug, suspicious_aliases = build_same_name_team_alias_map(
    major_tournament_ids,
    known_highschool_team_names,
)

# 都道府県名 → id マップ
pref_name_to_id = {p["name"]: p["id"] for p in prefecture_data}

# チーム名 → {teamId, prefectureId} マップ
team_map = {}
for team in teams_data:
    team_name = team["name"]
    pref_name = team["prefecture"]
    pref_id = pref_name_to_id.get(pref_name)
    if pref_id:
        team_map[team_name] = {
            "teamId": team["id"],
            "prefectureId": pref_id,
            "prefecture": pref_name,
        }

for alias_name, canonical_name in team_alias_map.items():
    if canonical_name in team_map:
        team_map[alias_name] = team_map[canonical_name]

# 中間リスト
summary_list = []

# 各結果ごとにすべての記録を追加
for item in results_data["results"]:
    result = item["result"]
    category = item.get("category", "default")

    # 団体戦: teamキーから
    if category == "team":
        team_name = normalize_team_name(item["team"], team_alias_map)
        team_info = team_map.get(team_name)
        if not team_info:
            continue

        entry_obj = {
            "team": team_name,
            "teamId": team_info["teamId"],
            "prefecture": team_info["prefecture"],
            "prefectureId": team_info["prefectureId"],
            "result": result,
            "category": category,
            "tournamentId": item.get("tournamentId", "unknown"),
            "year": item.get("year", 2025),
            "gender": item.get("gender", "unknown"),
        }

    # 個人戦: playerIds → team名を抽出
    else:
        player_ids = item["playerIds"]
        team_names = {
            normalize_team_name(pid.split("_")[2], team_alias_map)
            for pid in player_ids
            if len(pid.split("_")) > 2
        }

        for team_name in team_names:
            team_info = team_map.get(team_name)
            if not team_info:
                continue

            entry_obj = {
                "team": team_name,
                "teamId": team_info["teamId"],
                "prefecture": team_info["prefecture"],
                "prefectureId": team_info["prefectureId"],
                "result": result,
                "category": category,
                "tournamentId": item.get("tournamentId", "unknown"),
                "year": item.get("year", 2025),
                "gender": item.get("gender", "unknown"),
                "playerIds": player_ids,
            }

            summary_list.append(entry_obj)

        continue

    summary_list.append(entry_obj)

# 都道府県 × カテゴリごとにすべてのチームを抽出
prefecture_order = [p["id"] for p in prefecture_data]
final_list = []

for pref_id in prefecture_order:
    for category in ["singles", "doubles", "team"]:
        teams = [
            e
            for e in summary_list
            if e["prefectureId"] == pref_id and e["category"] == category
        ]
        if not teams:
            continue
        final_list.extend(teams)

# 並び替え
category_order = {"team": 0, "doubles": 1, "singles": 2}
final_list.sort(
    key=lambda x: (
        prefecture_order.index(x["prefectureId"])
        if x["prefectureId"] in prefecture_order
        else 999,
        category_order.get(x["category"], 9),
        x["teamId"],
    )
)

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(final_list, f, ensure_ascii=False, indent=2)

with open(alias_output_path, "w", encoding="utf-8") as f:
    json.dump(alias_debug, f, ensure_ascii=False, indent=2)

print(f"✅ '{output_path}' を生成しました（都道府県 × 種目ごと、playerIds付き）。")
print(
    f"✅ '{alias_output_path}' を生成しました（year + last_name + first_name ベースの学校名寄せ: {len(alias_debug)} グループ）。"
)

with open(
    suspicious_output_path,
    "w",
    encoding="utf-8",
) as f:
    json.dump(
        suspicious_aliases,
        f,
        ensure_ascii=False,
        indent=2,
    )
