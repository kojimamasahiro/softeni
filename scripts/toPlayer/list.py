import re
import json

text = """
2京都産業大学

3法政大学

19神戸大学

20和洋女子大学

33日本大学

34甲南女子大学

37駿河台大学

38中部学院大学

67成蹊大学

68山口大学

1東京女子体育大学

4履正社スポーツ専門学校

5九州産業大学

6文教大学

7広島大学

8帝京大学

9関西学院大学

10関西外国語大学

11駒澤大学

12至学館大学

13松山大学

14同志社女子大学

15岡山大学

16筑柴女学園大学

17早稲田大学

18日本体育大学

21龍谷大学

22星城大学

23立命館大学

24九州大学

25仙台大学

26日本女子体育大学

27桃山学院大学

28広島修道大学

29大阪成蹊大学

30中京大学

31東海大学

32松山東雲大学

35立教大学

36関西大学

39昭和学院短期大学

40東北学院大学

41青山学院大学

42京都女子大学

43長崎国際大学

44天理大学

45四国大学

46東京学芸大学

47滋賀短期大学

48愛知淑徳大学

49福山平成大学

50武庫川女子大学

51大阪樟蔭女子大学

52東京経済大学

53明治大学

54千里金蘭大学

55筑波大学

56大阪体育大学

57北翔大学

58佛教大学

59順天堂大学

60福岡大学

61國學院大學

62神戸親和女子大学

63愛知学院大学

64同志社大学

65慶應義塾大学

66熊本学園大学

69神戸松蔭女子学院大学
"""

result = []

for line in text.strip().splitlines():
    line = line.strip()

    match = re.match(r"^(\d+)(.+)$", line)
    if not match:
        continue

    id_ = int(match.group(1))
    university = match.group(2).strip()

    result.append({
        "id": id_,
        "name": f"{university}（日本学連）",
        "team": university,
        "prefecture": "日本学連",
        "category": "team"
    })

# id順に並べる
result.sort(key=lambda x: x["id"])

print(json.dumps(result, ensure_ascii=False, indent=2))