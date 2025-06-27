const initialPlayers = [
  {
    id: 1,
    name: '上松（NTT西日本）',
    information: [
      {
        lastName: '上松',
        firstName: '俊貴',
        team: 'NTT西日本',
        playerId: 'uematsu-toshiki',
        tempId: '俊貴_上松_NTT西日本',
      },
    ],
  },
  {
    id: 37,
    name: '本倉（NTT西日本）',
    information: [
      {
        lastName: '本倉',
        firstName: '健太郎',
        team: 'NTT西日本',
        playerId: 'motokura-kentaro',
        tempId: '健太郎_本倉_NTT西日本',
      },
    ],
  },
  {
    id: 94,
    name: '岩田（日本体育大学）',
    information: [
      {
        lastName: '岩田',
        firstName: '皓平',
        team: '日本体育大学',
        playerId: 'iwata-kohei',
        tempId: '皓平_岩田_日本体育大学',
      },
    ],
  },
  {
    id: 127,
    name: '植田（高田商業高校）',
    information: [
      {
        lastName: '植田',
        firstName: '璃音',
        team: '高田商業高校',
        playerId: 'ueda-rio',
        tempId: '璃音_植田_高田商業高校',
      },
    ],
  },
  {
    id: 145,
    name: '橋場（法政大学）',
    information: [
      {
        lastName: '橋場',
        firstName: '柊一郎',
        team: '法政大学',
        playerId: 'hashiba-toichiro',
        tempId: '柊一郎_橋場_法政大学',
      },
    ],
  },
  {
    id: 216,
    name: '広岡（NTT西日本）',
    information: [
      {
        lastName: '広岡',
        firstName: '宙',
        team: 'NTT西日本',
        playerId: 'hirooka-sora',
        tempId: '宙_広岡_NTT西日本',
      },
    ],
  },
  {
    id: 235,
    name: '長江（NTT西日本）',
    information: [
      {
        lastName: '長江',
        firstName: '光一',
        team: 'NTT西日本',
        playerId: 'nagae-koichi',
        tempId: '光一_長江_NTT西日本',
      },
    ],
  },
  {
    id: 270,
    name: '清水（同志社大学）',
    information: [
      {
        lastName: '清水',
        firstName: '駿',
        team: '同志社大学',
        playerId: null,
        tempId: '駿_清水_同志社大学',
      },
    ],
  },

  {
    id: 1,
    name: '上松（NTT西日本）',
    information: [
      {
        lastName: '上松',
        firstName: '俊貴',
        team: 'NTT西日本',
        playerId: 'uematsu-toshiki',
        tempId: '俊貴_上松_NTT西日本',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 2,
    name: '白井（東北高校）',
    information: [
      {
        lastName: '白井',
        firstName: '颯',
        team: '東北高校',
        playerId: null,
        tempId: '颯_白井_東北高校',
      },
    ],
  },
  {
    id: 3,
    name: '段原（松山大学）',
    information: [
      {
        lastName: '段原',
        firstName: '大樹',
        team: '松山大学',
        playerId: null,
        tempId: '大樹_段原_松山大学',
      },
    ],
  },
  {
    id: 4,
    name: '菅野（LILAC）',
    information: [
      {
        lastName: '菅野',
        firstName: '浩久',
        team: 'LILAC',
        playerId: null,
        tempId: '浩久_菅野_LILAC',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 5,
    name: '林田（綾小路クラブ）',
    information: [
      {
        lastName: '林田',
        firstName: '翔',
        team: '綾小路クラブ',
        playerId: null,
        tempId: '翔_林田_綾小路クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 6,
    name: '山田（医療法人社団心）',
    information: [
      {
        lastName: '山田',
        firstName: '就蔵',
        team: '医療法人社団心',
        playerId: null,
        tempId: '就蔵_山田_医療法人社団心',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 7,
    name: '福地（熊本学園大学）',
    information: [
      {
        lastName: '福地',
        firstName: '想楽',
        team: '熊本学園大学',
        playerId: null,
        tempId: '想楽_福地_熊本学園大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 8,
    name: '濱中（濱中純誠）',
    information: [
      {
        lastName: '濱中',
        firstName: '純誠',
        team: '濱中純誠',
        playerId: null,
        tempId: '純誠_濱中_濱中純誠',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 9,
    name: '平野（能美クラブ）',
    information: [
      {
        lastName: '平野',
        firstName: '悠斗',
        team: '能美クラブ',
        playerId: null,
        tempId: '悠斗_平野_能美クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 10,
    name: '松本（東海大学）',
    information: [
      {
        lastName: '松本',
        firstName: '隼',
        team: '東海大学',
        playerId: null,
        tempId: '隼_松本_東海大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 11,
    name: '山口（嬉野高校）',
    information: [
      {
        lastName: '山口',
        firstName: '柊',
        team: '嬉野高校',
        playerId: null,
        tempId: '柊_山口_嬉野高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 12,
    name: '米川（明治大学）',
    information: [
      {
        lastName: '米川',
        firstName: '雅翔',
        team: '明治大学',
        playerId: null,
        tempId: '雅翔_米川_明治大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 13,
    name: '池上（ヨシザワ）',
    information: [
      {
        lastName: '池上',
        firstName: '陽介',
        team: 'ヨシザワ',
        playerId: null,
        tempId: '陽介_池上_ヨシザワ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 14,
    name: '大和（國學院大学）',
    information: [
      {
        lastName: '大和',
        firstName: '昌生',
        team: '國學院大学',
        playerId: null,
        tempId: '昌生_大和_國學院大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 15,
    name: '井上（高田商業高校）',
    information: [
      {
        lastName: '井上',
        firstName: '弘翔',
        team: '高田商業高校',
        playerId: null,
        tempId: '弘翔_井上_高田商業高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 16,
    name: '松尾（UBE）',
    information: [
      {
        lastName: '松尾',
        firstName: '優希',
        team: 'UBE',
        playerId: null,
        tempId: '優希_松尾_UBE',
      },
    ],
  },
  {
    id: 17,
    name: '加藤（大谷室蘭高校）',
    information: [
      {
        lastName: '加藤',
        firstName: '虎牙',
        team: '大谷室蘭高校',
        playerId: null,
        tempId: '虎牙_加藤_大谷室蘭高校',
      },
    ],
  },
  {
    id: 18,
    name: '幡谷（ＮＴＴ東日本東京）',
    information: [
      {
        lastName: '幡谷',
        firstName: '康平',
        team: 'ＮＴＴ東日本東京',
        playerId: null,
        tempId: '康平_幡谷_ＮＴＴ東日本東京',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 19,
    name: '北野（ワタキューセイモア）',
    information: [
      {
        lastName: '北野',
        firstName: '亮介',
        team: 'ワタキューセイモア',
        playerId: null,
        tempId: '亮介_北野_ワタキューセイモア',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 20,
    name: '西牧（石川工業高専）',
    information: [
      {
        lastName: '西牧',
        firstName: '幹起',
        team: '石川工業高専',
        playerId: null,
        tempId: '幹起_西牧_石川工業高専',
      },
    ],
  },
  {
    id: 21,
    name: '金谷（金谷宇恭）',
    information: [
      {
        lastName: '金谷',
        firstName: '宇恭',
        team: '金谷宇恭',
        playerId: null,
        tempId: '宇恭_金谷_金谷宇恭',
      },
    ],
  },
  {
    id: 22,
    name: '伊賀（田村高校）',
    information: [
      {
        lastName: '伊賀',
        firstName: '凌巧',
        team: '田村高校',
        playerId: null,
        tempId: '凌巧_伊賀_田村高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 23,
    name: '酒井（プロテリアル）',
    information: [
      {
        lastName: '酒井',
        firstName: '光生',
        team: 'プロテリアル',
        playerId: null,
        tempId: '光生_酒井_プロテリアル',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 24,
    name: '堀（山鹿協会）',
    information: [
      {
        lastName: '堀',
        firstName: '貴裕',
        team: '山鹿協会',
        playerId: null,
        tempId: '貴裕_堀_山鹿協会',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 25,
    name: '合屋（愛知学院大学）',
    information: [
      {
        lastName: '合屋',
        firstName: '颯人',
        team: '愛知学院大学',
        playerId: null,
        tempId: '颯人_合屋_愛知学院大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 26,
    name: '吉岡（東ソー南陽）',
    information: [
      {
        lastName: '吉岡',
        firstName: '真司',
        team: '東ソー南陽',
        playerId: null,
        tempId: '真司_吉岡_東ソー南陽',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 27,
    name: '立木（太平洋工業）',
    information: [
      {
        lastName: '立木',
        firstName: '雅也',
        team: '太平洋工業',
        playerId: null,
        tempId: '雅也_立木_太平洋工業',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 28,
    name: '原村（ＢＡＮＺ）',
    information: [
      {
        lastName: '原村',
        firstName: '勇飛',
        team: 'ＢＡＮＺ',
        playerId: null,
        tempId: '勇飛_原村_ＢＡＮＺ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 29,
    name: '田村（中部電力愛知）',
    information: [
      {
        lastName: '田村',
        firstName: '翔',
        team: '中部電力愛知',
        playerId: null,
        tempId: '翔_田村_中部電力愛知',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 30,
    name: '小山（立命館大学）',
    information: [
      {
        lastName: '小山',
        firstName: '悠侍郎',
        team: '立命館大学',
        playerId: null,
        tempId: '悠侍郎_小山_立命館大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 31,
    name: '高洲（天草ＮＴＣ）',
    information: [
      {
        lastName: '高洲',
        firstName: '拓巳',
        team: '天草ＮＴＣ',
        playerId: null,
        tempId: '拓巳_高洲_天草ＮＴＣ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 32,
    name: '松久（大商鬼魄会）',
    information: [
      {
        lastName: '松久',
        firstName: '銀河',
        team: '大商鬼魄会',
        playerId: null,
        tempId: '銀河_松久_大商鬼魄会',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 33,
    name: '原田（出雲御縁クラブ）',
    information: [
      {
        lastName: '原田',
        firstName: '裕二',
        team: '出雲御縁クラブ',
        playerId: null,
        tempId: '裕二_原田_出雲御縁クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 34,
    name: '結城（関西学院大学）',
    information: [
      {
        lastName: '結城',
        firstName: '琉衣',
        team: '関西学院大学',
        playerId: null,
        tempId: '琉衣_結城_関西学院大学',
      },
    ],
  },
  {
    id: 35,
    name: '毛利（尽誠学園高校）',
    information: [
      {
        lastName: '毛利',
        firstName: '涼介',
        team: '尽誠学園高校',
        playerId: null,
        tempId: '涼介_毛利_尽誠学園高校',
      },
    ],
  },
  {
    id: 36,
    name: '黒坂（日本体育大学）',
    information: [
      {
        lastName: '黒坂',
        firstName: '卓矢',
        team: '日本体育大学',
        playerId: 'kurosaka-takuya',
        tempId: '卓矢_黒坂_日本体育大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 37,
    name: '本倉（NTT西日本）',
    information: [
      {
        lastName: '本倉',
        firstName: '健太郎',
        team: 'NTT西日本',
        playerId: 'motokura-kentaro',
        tempId: '健太郎_本倉_NTT西日本',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 38,
    name: '待木（都城商業高校ＯＢクラブ）',
    information: [
      {
        lastName: '待木',
        firstName: '慶太',
        team: '都城商業高校ＯＢクラブ',
        playerId: null,
        tempId: '慶太_待木_都城商業高校ＯＢクラブ',
      },
    ],
  },
  {
    id: 39,
    name: '森（日本体育大学）',
    information: [
      {
        lastName: '森',
        firstName: '良輔',
        team: '日本体育大学',
        playerId: 'mori-ryosuke',
        tempId: '良輔_森_日本体育大学',
      },
    ],
  },
  {
    id: 40,
    name: '齋藤（太平洋工業）',
    information: [
      {
        lastName: '齋藤',
        firstName: '龍二',
        team: '太平洋工業',
        playerId: null,
        tempId: '龍二_齋藤_太平洋工業',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 41,
    name: '大薗（四国大学）',
    information: [
      {
        lastName: '大薗',
        firstName: '善',
        team: '四国大学',
        playerId: null,
        tempId: '善_大薗_四国大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 42,
    name: '溝端（ふれあいクラブ）',
    information: [
      {
        lastName: '溝端',
        firstName: '亮二',
        team: 'ふれあいクラブ',
        playerId: null,
        tempId: '亮二_溝端_ふれあいクラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 43,
    name: '栗岡（尼崎高校）',
    information: [
      {
        lastName: '栗岡',
        firstName: '優志',
        team: '尼崎高校',
        playerId: null,
        tempId: '優志_栗岡_尼崎高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 44,
    name: '浅川（信州大学）',
    information: [
      {
        lastName: '浅川',
        firstName: '縁心',
        team: '信州大学',
        playerId: null,
        tempId: '縁心_浅川_信州大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 45,
    name: '佐田（レペゼン長崎）',
    information: [
      {
        lastName: '佐田',
        firstName: '賢太',
        team: 'レペゼン長崎',
        playerId: null,
        tempId: '賢太_佐田_レペゼン長崎',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 46,
    name: '藤澤（川口市役所）',
    information: [
      {
        lastName: '藤澤',
        firstName: '豊和',
        team: '川口市役所',
        playerId: null,
        tempId: '豊和_藤澤_川口市役所',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 47,
    name: '長根（岩手高校）',
    information: [
      {
        lastName: '長根',
        firstName: '煌和',
        team: '岩手高校',
        playerId: null,
        tempId: '煌和_長根_岩手高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 48,
    name: '室山（鳥取大学）',
    information: [
      {
        lastName: '室山',
        firstName: '瑠星',
        team: '鳥取大学',
        playerId: null,
        tempId: '瑠星_室山_鳥取大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 49,
    name: '森（東大阪市協会）',
    information: [
      {
        lastName: '森',
        firstName: '靖貴',
        team: '東大阪市協会',
        playerId: null,
        tempId: '靖貴_森_東大阪市協会',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 50,
    name: '横尾（小城協会）',
    information: [
      {
        lastName: '横尾',
        firstName: '凌大',
        team: '小城協会',
        playerId: null,
        tempId: '凌大_横尾_小城協会',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 51,
    name: '一ノ宮（早稲田大学）',
    information: [
      {
        lastName: '一ノ宮',
        firstName: '大和',
        team: '早稲田大学',
        playerId: null,
        tempId: '大和_一ノ宮_早稲田大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 52,
    name: '小坂（三重高校）',
    information: [
      {
        lastName: '小坂',
        firstName: '咲翔',
        team: '三重高校',
        playerId: null,
        tempId: '咲翔_小坂_三重高校',
      },
    ],
  },
  {
    id: 53,
    name: '東郷（王寺ユースクラブ）',
    information: [
      {
        lastName: '東郷',
        firstName: '翔太',
        team: '王寺ユースクラブ',
        playerId: null,
        tempId: '翔太_東郷_王寺ユースクラブ',
      },
    ],
  },
  {
    id: 54,
    name: '塚本（同志社大学）',
    information: [
      {
        lastName: '塚本',
        firstName: '星弥',
        team: '同志社大学',
        playerId: null,
        tempId: '星弥_塚本_同志社大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 55,
    name: '戸畑（UBE）',
    information: [
      {
        lastName: '戸畑',
        firstName: '勝喜',
        team: 'UBE',
        playerId: null,
        tempId: '勝喜_戸畑_UBE',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 56,
    name: '常岡（能登高校）',
    information: [
      {
        lastName: '常岡',
        firstName: '葵',
        team: '能登高校',
        playerId: null,
        tempId: '葵_常岡_能登高校',
      },
    ],
  },
  {
    id: 57,
    name: '高橋（ミヤギ・ブルズ）',
    information: [
      {
        lastName: '高橋',
        firstName: '衛司',
        team: 'ミヤギ・ブルズ',
        playerId: null,
        tempId: '衛司_高橋_ミヤギ・ブルズ',
      },
    ],
  },
  {
    id: 58,
    name: '岡田（明治大学）',
    information: [
      {
        lastName: '岡田',
        firstName: '侑也',
        team: '明治大学',
        playerId: null,
        tempId: '侑也_岡田_明治大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 59,
    name: '松本（M/BASE）',
    information: [
      {
        lastName: '松本',
        firstName: '秀之',
        team: 'M/BASE',
        playerId: null,
        tempId: '秀之_松本_M/BASE',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 60,
    name: '坂寄（小山クラブ）',
    information: [
      {
        lastName: '坂寄',
        firstName: '友紀',
        team: '小山クラブ',
        playerId: null,
        tempId: '友紀_坂寄_小山クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 61,
    name: '北野（ワタキューセイモア）',
    information: [
      {
        lastName: '北野',
        firstName: '敦貴',
        team: 'ワタキューセイモア',
        playerId: null,
        tempId: '敦貴_北野_ワタキューセイモア',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 62,
    name: '大鳥（岡山理科大附高校）',
    information: [
      {
        lastName: '大鳥',
        firstName: '琉稀',
        team: '岡山理科大附高校',
        playerId: null,
        tempId: '琉稀_大鳥_岡山理科大附高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 63,
    name: '菊山（法政大学）',
    information: [
      {
        lastName: '菊山',
        firstName: '太陽',
        team: '法政大学',
        playerId: null,
        tempId: '太陽_菊山_法政大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 64,
    name: '木本（明徳義塾高校）',
    information: [
      {
        lastName: '木本',
        firstName: '琉偉',
        team: '明徳義塾高校',
        playerId: null,
        tempId: '琉偉_木本_明徳義塾高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 65,
    name: '確田（松山大学）',
    information: [
      {
        lastName: '確田',
        firstName: '冬吹樹',
        team: '松山大学',
        playerId: null,
        tempId: '冬吹樹_確田_松山大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 66,
    name: '早川（マツダ）',
    information: [
      {
        lastName: '早川',
        firstName: '守隼',
        team: 'マツダ',
        playerId: null,
        tempId: '守隼_早川_マツダ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 67,
    name: '米澤（ヨネックス）',
    information: [
      {
        lastName: '米澤',
        firstName: '要',
        team: 'ヨネックス',
        playerId: null,
        tempId: '要_米澤_ヨネックス',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 68,
    name: '内村（ジョイントクラブ）',
    information: [
      {
        lastName: '内村',
        firstName: '太陽',
        team: 'ジョイントクラブ',
        playerId: null,
        tempId: '太陽_内村_ジョイントクラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 69,
    name: '竹田（日本体育大学）',
    information: [
      {
        lastName: '竹田',
        firstName: '凌',
        team: '日本体育大学',
        playerId: 'takeda-ryo',
        tempId: '凌_竹田_日本体育大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 70,
    name: '前田（高田商業高校）',
    information: [
      {
        lastName: '前田',
        firstName: '蒼生',
        team: '高田商業高校',
        playerId: null,
        tempId: '蒼生_前田_高田商業高校',
      },
    ],
  },
  {
    id: 71,
    name: '西脇（星城大学）',
    information: [
      {
        lastName: '西脇',
        firstName: '拓馬',
        team: '星城大学',
        playerId: null,
        tempId: '拓馬_西脇_星城大学',
      },
    ],
  },
  {
    id: 72,
    name: '足利（東邦ガス）',
    information: [
      {
        lastName: '足利',
        firstName: '颯太',
        team: '東邦ガス',
        playerId: null,
        tempId: '颯太_足利_東邦ガス',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 73,
    name: '上岡（Up Rise）',
    information: [
      {
        lastName: '上岡',
        firstName: '俊介',
        team: 'Up Rise',
        playerId: 'ueoka-shunsuke',
        tempId: '俊介_上岡_Up Rise',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 74,
    name: '持永（宮崎市役所）',
    information: [
      {
        lastName: '持永',
        firstName: '唆秀',
        team: '宮崎市役所',
        playerId: null,
        tempId: '唆秀_持永_宮崎市役所',
      },
    ],
  },
  {
    id: 75,
    name: '宇田川（清明学園中学校）',
    information: [
      {
        lastName: '宇田川',
        firstName: '成寿',
        team: '清明学園中学校',
        playerId: null,
        tempId: '成寿_宇田川_清明学園中学校',
      },
    ],
  },
  {
    id: 76,
    name: '松田（東北高校）',
    information: [
      {
        lastName: '松田',
        firstName: '拳弥',
        team: '東北高校',
        playerId: null,
        tempId: '拳弥_松田_東北高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 77,
    name: '朝日（鳥取大学）',
    information: [
      {
        lastName: '朝日',
        firstName: '禮夢',
        team: '鳥取大学',
        playerId: null,
        tempId: '禮夢_朝日_鳥取大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 78,
    name: '桑原（明電舎）',
    information: [
      {
        lastName: '桑原',
        firstName: '丈',
        team: '明電舎',
        playerId: null,
        tempId: '丈_桑原_明電舎',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 79,
    name: '三好（広島経済大学）',
    information: [
      {
        lastName: '三好',
        firstName: '翔馬',
        team: '広島経済大学',
        playerId: null,
        tempId: '翔馬_三好_広島経済大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 80,
    name: '山口（マツダ）',
    information: [
      {
        lastName: '山口',
        firstName: '大志',
        team: 'マツダ',
        playerId: null,
        tempId: '大志_山口_マツダ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 81,
    name: '初鹿（法政大学）',
    information: [
      {
        lastName: '初鹿',
        firstName: '暁哉',
        team: '法政大学',
        playerId: null,
        tempId: '暁哉_初鹿_法政大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 82,
    name: '松本（早稲田大学）',
    information: [
      {
        lastName: '松本',
        firstName: '翔太',
        team: '早稲田大学',
        playerId: null,
        tempId: '翔太_松本_早稲田大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 83,
    name: '濵田（和北クラブ）',
    information: [
      {
        lastName: '濵田',
        firstName: '剛',
        team: '和北クラブ',
        playerId: null,
        tempId: '剛_濵田_和北クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 84,
    name: '室（ワインクラブ）',
    information: [
      {
        lastName: '室',
        firstName: '智輝',
        team: 'ワインクラブ',
        playerId: null,
        tempId: '智輝_室_ワインクラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 85,
    name: '小川（UBE）',
    information: [
      {
        lastName: '小川',
        firstName: '友貴',
        team: 'UBE',
        playerId: null,
        tempId: '友貴_小川_UBE',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 86,
    name: '井上（厚木市役所）',
    information: [
      {
        lastName: '井上',
        firstName: '拓海',
        team: '厚木市役所',
        playerId: null,
        tempId: '拓海_井上_厚木市役所',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 87,
    name: '神田（松山大学）',
    information: [
      {
        lastName: '神田',
        firstName: '好太郎',
        team: '松山大学',
        playerId: null,
        tempId: '好太郎_神田_松山大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 88,
    name: '中村（兼六クラブ）',
    information: [
      {
        lastName: '中村',
        firstName: '一翔',
        team: '兼六クラブ',
        playerId: null,
        tempId: '一翔_中村_兼六クラブ',
      },
    ],
  },
  {
    id: 89,
    name: '山内（立命館大学）',
    information: [
      {
        lastName: '山内',
        firstName: '風我',
        team: '立命館大学',
        playerId: null,
        tempId: '風我_山内_立命館大学',
      },
    ],
  },
  {
    id: 90,
    name: '古藤（対馬市連盟）',
    information: [
      {
        lastName: '古藤',
        firstName: '瑛亘',
        team: '対馬市連盟',
        playerId: null,
        tempId: '瑛亘_古藤_対馬市連盟',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 91,
    name: '濵田（太平洋工業）',
    information: [
      {
        lastName: '濵田',
        firstName: '祐',
        team: '太平洋工業',
        playerId: null,
        tempId: '祐_濵田_太平洋工業',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 92,
    name: '岩本（東ソー南陽）',
    information: [
      {
        lastName: '岩本',
        firstName: '将志',
        team: '東ソー南陽',
        playerId: null,
        tempId: '将志_岩本_東ソー南陽',
      },
    ],
  },
  {
    id: 93,
    name: '金山（ワタキューセイモア）',
    information: [
      {
        lastName: '金山',
        firstName: '勇波',
        team: 'ワタキューセイモア',
        playerId: null,
        tempId: '勇波_金山_ワタキューセイモア',
      },
    ],
  },
  {
    id: 94,
    name: '岩田（日本体育大学）',
    information: [
      {
        lastName: '岩田',
        firstName: '皓平',
        team: '日本体育大学',
        playerId: 'iwata-kohei',
        tempId: '皓平_岩田_日本体育大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 95,
    name: '草野（田村高校）',
    information: [
      {
        lastName: '草野',
        firstName: '春真',
        team: '田村高校',
        playerId: null,
        tempId: '春真_草野_田村高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 96,
    name: '小澤（TeamG.U.R.U.I）',
    information: [
      {
        lastName: '小澤',
        firstName: '優真',
        team: 'TeamG.U.R.U.I',
        playerId: null,
        tempId: '優真_小澤_TeamG.U.R.U.I',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 97,
    name: '澤田（四国大学）',
    information: [
      {
        lastName: '澤田',
        firstName: '壮史',
        team: '四国大学',
        playerId: null,
        tempId: '壮史_澤田_四国大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 98,
    name: '松村（熊本学園クラブ）',
    information: [
      {
        lastName: '松村',
        firstName: '駿樹',
        team: '熊本学園クラブ',
        playerId: null,
        tempId: '駿樹_松村_熊本学園クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 99,
    name: '岩﨑（國學院大学）',
    information: [
      {
        lastName: '岩﨑',
        firstName: '俊介',
        team: '國學院大学',
        playerId: null,
        tempId: '俊介_岩﨑_國學院大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 100,
    name: '橋本（見前ＳＴＣ）',
    information: [
      {
        lastName: '橋本',
        firstName: '年真',
        team: '見前ＳＴＣ',
        playerId: null,
        tempId: '年真_橋本_見前ＳＴＣ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 101,
    name: '小山（明治大学）',
    information: [
      {
        lastName: '小山',
        firstName: '寛晴',
        team: '明治大学',
        playerId: null,
        tempId: '寛晴_小山_明治大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 102,
    name: '瀬口（松葉クラブ）',
    information: [
      {
        lastName: '瀬口',
        firstName: '翔太',
        team: '松葉クラブ',
        playerId: null,
        tempId: '翔太_瀬口_松葉クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 103,
    name: '平國（Lien）',
    information: [
      {
        lastName: '平國',
        firstName: '弘兼',
        team: 'Lien',
        playerId: null,
        tempId: '弘兼_平國_Lien',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 104,
    name: '丈田（砺波市協会）',
    information: [
      {
        lastName: '丈田',
        firstName: '宗太郎',
        team: '砺波市協会',
        playerId: null,
        tempId: '宗太郎_丈田_砺波市協会',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 105,
    name: '本田（中京大学）',
    information: [
      {
        lastName: '本田',
        firstName: '蒼偉',
        team: '中京大学',
        playerId: null,
        tempId: '蒼偉_本田_中京大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 106,
    name: '林田（高田商業高校）',
    information: [
      {
        lastName: '林田',
        firstName: '遼太郎',
        team: '高田商業高校',
        playerId: null,
        tempId: '遼太郎_林田_高田商業高校',
      },
    ],
  },
  {
    id: 107,
    name: '松橋（東京ガス）',
    information: [
      {
        lastName: '松橋',
        firstName: '嘉依',
        team: '東京ガス',
        playerId: null,
        tempId: '嘉依_松橋_東京ガス',
      },
    ],
  },
  {
    id: 108,
    name: '内本（NTT西日本）',
    information: [
      {
        lastName: '内本',
        firstName: '貴文',
        team: 'NTT西日本',
        playerId: 'uchimoto-takafumi',
        tempId: '貴文_内本_NTT西日本',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 109,
    name: '西本（アキム）',
    information: [
      {
        lastName: '西本',
        firstName: '一雅',
        team: 'アキム',
        playerId: null,
        tempId: '一雅_西本_アキム',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 110,
    name: '白井（志學館大学）',
    information: [
      {
        lastName: '白井',
        firstName: '大希',
        team: '志學館大学',
        playerId: null,
        tempId: '大希_白井_志學館大学',
      },
    ],
  },
  {
    id: 111,
    name: '辻浦（辻浦壱経）',
    information: [
      {
        lastName: '辻浦',
        firstName: '壱経',
        team: '辻浦壱経',
        playerId: null,
        tempId: '壱経_辻浦_辻浦壱経',
      },
    ],
  },
  {
    id: 112,
    name: '青木（岡山理科大附高校）',
    information: [
      {
        lastName: '青木',
        firstName: '晴弥',
        team: '岡山理科大附高校',
        playerId: null,
        tempId: '晴弥_青木_岡山理科大附高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 113,
    name: '鈴木（ＹＫＫ）',
    information: [
      {
        lastName: '鈴木',
        firstName: '尚人',
        team: 'ＹＫＫ',
        playerId: null,
        tempId: '尚人_鈴木_ＹＫＫ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 114,
    name: '森川（祇園）',
    information: [
      {
        lastName: '森川',
        firstName: '翔雲',
        team: '祇園',
        playerId: null,
        tempId: '翔雲_森川_祇園',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 115,
    name: '野田（太平洋工業）',
    information: [
      {
        lastName: '野田',
        firstName: '太陽',
        team: '太平洋工業',
        playerId: null,
        tempId: '太陽_野田_太平洋工業',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 116,
    name: '淺野（フェニックス）',
    information: [
      {
        lastName: '淺野',
        firstName: '祐太',
        team: 'フェニックス',
        playerId: null,
        tempId: '祐太_淺野_フェニックス',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 117,
    name: '善福（霞ヶ浦高校）',
    information: [
      {
        lastName: '善福',
        firstName: '留生',
        team: '霞ヶ浦高校',
        playerId: null,
        tempId: '留生_善福_霞ヶ浦高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 118,
    name: '内田（法政大学）',
    information: [
      {
        lastName: '内田',
        firstName: '陽斗',
        team: '法政大学',
        playerId: null,
        tempId: '陽斗_内田_法政大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 119,
    name: '千坂（KEISPORTS）',
    information: [
      {
        lastName: '千坂',
        firstName: '亮智',
        team: 'KEISPORTS',
        playerId: null,
        tempId: '亮智_千坂_KEISPORTS',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 120,
    name: '藤井（日本体育大学）',
    information: [
      {
        lastName: '藤井',
        firstName: '智暉',
        team: '日本体育大学',
        playerId: 'fujii-tomoki',
        tempId: '智暉_藤井_日本体育大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 121,
    name: '渡辺（ワタキューセイモア）',
    information: [
      {
        lastName: '渡辺',
        firstName: '澪治',
        team: 'ワタキューセイモア',
        playerId: null,
        tempId: '澪治_渡辺_ワタキューセイモア',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 122,
    name: '錦見（尽誠学園高校）',
    information: [
      {
        lastName: '錦見',
        firstName: '琉生',
        team: '尽誠学園高校',
        playerId: null,
        tempId: '琉生_錦見_尽誠学園高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 123,
    name: '河合（愛知工業大学）',
    information: [
      {
        lastName: '河合',
        firstName: '汰珠',
        team: '愛知工業大学',
        playerId: null,
        tempId: '汰珠_河合_愛知工業大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 124,
    name: '山﨑（大矢野クラブ）',
    information: [
      {
        lastName: '山﨑',
        firstName: '公貴',
        team: '大矢野クラブ',
        playerId: null,
        tempId: '公貴_山﨑_大矢野クラブ',
      },
    ],
  },
  {
    id: 125,
    name: '仲川（東邦ガス）',
    information: [
      {
        lastName: '仲川',
        firstName: '晴智',
        team: '東邦ガス',
        playerId: null,
        tempId: '晴智_仲川_東邦ガス',
      },
    ],
  },
  {
    id: 126,
    name: '川合（UBE）',
    information: [
      {
        lastName: '川合',
        firstName: '佑人',
        team: 'UBE',
        playerId: null,
        tempId: '佑人_川合_UBE',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 127,
    name: '植田（高田商業高校）',
    information: [
      {
        lastName: '植田',
        firstName: '璃音',
        team: '高田商業高校',
        playerId: 'ueda-rio',
        tempId: '璃音_植田_高田商業高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 128,
    name: '中村（信州大学）',
    information: [
      {
        lastName: '中村',
        firstName: '允音',
        team: '信州大学',
        playerId: null,
        tempId: '允音_中村_信州大学',
      },
    ],
  },
  {
    id: 129,
    name: '松中（JFE西日本福山）',
    information: [
      {
        lastName: '松中',
        firstName: '友',
        team: 'JFE西日本福山',
        playerId: null,
        tempId: '友_松中_JFE西日本福山',
      },
    ],
  },
  {
    id: 130,
    name: '今城（十八親和銀行）',
    information: [
      {
        lastName: '今城',
        firstName: '大貴',
        team: '十八親和銀行',
        playerId: null,
        tempId: '大貴_今城_十八親和銀行',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 131,
    name: '石田（CROSSTYHOLDINGS）',
    information: [
      {
        lastName: '石田',
        firstName: '輝',
        team: 'CROSSTYHOLDINGS',
        playerId: null,
        tempId: '輝_石田_CROSSTYHOLDINGS',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 132,
    name: '大河原（高崎高校）',
    information: [
      {
        lastName: '大河原',
        firstName: '兜',
        team: '高崎高校',
        playerId: null,
        tempId: '兜_大河原_高崎高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 133,
    name: '中尾（中央大学）',
    information: [
      {
        lastName: '中尾',
        firstName: '彦斗',
        team: '中央大学',
        playerId: null,
        tempId: '彦斗_中尾_中央大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 134,
    name: '深沢（帝京安積高校）',
    information: [
      {
        lastName: '深沢',
        firstName: '雅人',
        team: '帝京安積高校',
        playerId: null,
        tempId: '雅人_深沢_帝京安積高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 135,
    name: '橋本（ヨシザワクラブ）',
    information: [
      {
        lastName: '橋本',
        firstName: '旭陽',
        team: 'ヨシザワクラブ',
        playerId: null,
        tempId: '旭陽_橋本_ヨシザワクラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 136,
    name: '樋口（白根クラブ）',
    information: [
      {
        lastName: '樋口',
        firstName: '貴',
        team: '白根クラブ',
        playerId: null,
        tempId: '貴_樋口_白根クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 137,
    name: '中村（日南学園高校）',
    information: [
      {
        lastName: '中村',
        firstName: '匡起',
        team: '日南学園高校',
        playerId: null,
        tempId: '匡起_中村_日南学園高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 138,
    name: '安達（早稲田大学）',
    information: [
      {
        lastName: '安達',
        firstName: '宣',
        team: '早稲田大学',
        playerId: null,
        tempId: '宣_安達_早稲田大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 139,
    name: '中川（大阪ガス）',
    information: [
      {
        lastName: '中川',
        firstName: '直輝',
        team: '大阪ガス',
        playerId: null,
        tempId: '直輝_中川_大阪ガス',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 140,
    name: '林（明徳義塾高校）',
    information: [
      {
        lastName: '林',
        firstName: '寿李稀',
        team: '明徳義塾高校',
        playerId: null,
        tempId: '寿李稀_林_明徳義塾高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 141,
    name: '広光（TOMOT）',
    information: [
      {
        lastName: '広光',
        firstName: '謙太',
        team: 'TOMOT',
        playerId: null,
        tempId: '謙太_広光_TOMOT',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 142,
    name: '高本（松山大学）',
    information: [
      {
        lastName: '高本',
        firstName: '和昌',
        team: '松山大学',
        playerId: null,
        tempId: '和昌_高本_松山大学',
      },
    ],
  },
  {
    id: 143,
    name: '小宮（山口教員クラブ）',
    information: [
      {
        lastName: '小宮',
        firstName: '剛',
        team: '山口教員クラブ',
        playerId: null,
        tempId: '剛_小宮_山口教員クラブ',
      },
    ],
  },
  {
    id: 144,
    name: '米川（YONEX）',
    information: [
      {
        lastName: '米川',
        firstName: '悠翔',
        team: 'YONEX',
        playerId: 'yonekawa-yuto',
        tempId: '悠翔_米川_YONEX',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 145,
    name: '橋場（法政大学）',
    information: [
      {
        lastName: '橋場',
        firstName: '柊一郎',
        team: '法政大学',
        playerId: 'hashiba-toichiro',
        tempId: '柊一郎_橋場_法政大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 146,
    name: '鳥居（立命館守山高校）',
    information: [
      {
        lastName: '鳥居',
        firstName: '幹太',
        team: '立命館守山高校',
        playerId: null,
        tempId: '幹太_鳥居_立命館守山高校',
      },
    ],
  },
  {
    id: 147,
    name: '松原（ヨシザワ）',
    information: [
      {
        lastName: '松原',
        firstName: '幹',
        team: 'ヨシザワ',
        playerId: null,
        tempId: '幹_松原_ヨシザワ',
      },
    ],
  },
  {
    id: 148,
    name: '竹添（十八親和銀行）',
    information: [
      {
        lastName: '竹添',
        firstName: '幹倫',
        team: '十八親和銀行',
        playerId: null,
        tempId: '幹倫_竹添_十八親和銀行',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 149,
    name: '簗田（道後・八千代クラブ）',
    information: [
      {
        lastName: '簗田',
        firstName: '亮',
        team: '道後・八千代クラブ',
        playerId: null,
        tempId: '亮_簗田_道後・八千代クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 150,
    name: '飯田（國學院大学）',
    information: [
      {
        lastName: '飯田',
        firstName: '航仁',
        team: '國學院大学',
        playerId: null,
        tempId: '航仁_飯田_國學院大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 151,
    name: '玉水（東ソー南陽）',
    information: [
      {
        lastName: '玉水',
        firstName: '康貴',
        team: '東ソー南陽',
        playerId: null,
        tempId: '康貴_玉水_東ソー南陽',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 152,
    name: '吉久保（T-bonds）',
    information: [
      {
        lastName: '吉久保',
        firstName: '太晴',
        team: 'T-bonds',
        playerId: null,
        tempId: '太晴_吉久保_T-bonds',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 153,
    name: '根岸（日本体育大学）',
    information: [
      {
        lastName: '根岸',
        firstName: '澪紋',
        team: '日本体育大学',
        playerId: 'negishi-remon',
        tempId: '澪紋_根岸_日本体育大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 154,
    name: '大友（東邦ガス）',
    information: [
      {
        lastName: '大友',
        firstName: '駿',
        team: '東邦ガス',
        playerId: null,
        tempId: '駿_大友_東邦ガス',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 155,
    name: '髙田（早稲田大学）',
    information: [
      {
        lastName: '髙田',
        firstName: '淳貴',
        team: '早稲田大学',
        playerId: null,
        tempId: '淳貴_髙田_早稲田大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 156,
    name: '笹原（清明学園中学校）',
    information: [
      {
        lastName: '笹原',
        firstName: '太陽',
        team: '清明学園中学校',
        playerId: null,
        tempId: '太陽_笹原_清明学園中学校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 157,
    name: '大関（秋田県立大学）',
    information: [
      {
        lastName: '大関',
        firstName: '勇輝',
        team: '秋田県立大学',
        playerId: null,
        tempId: '勇輝_大関_秋田県立大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 158,
    name: '松永（岡山南高校）',
    information: [
      {
        lastName: '松永',
        firstName: '凌',
        team: '岡山南高校',
        playerId: null,
        tempId: '凌_松永_岡山南高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 159,
    name: '川神（松山大学）',
    information: [
      {
        lastName: '川神',
        firstName: '堅汰',
        team: '松山大学',
        playerId: null,
        tempId: '堅汰_川神_松山大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 160,
    name: '松久（大商鬼魄会）',
    information: [
      {
        lastName: '松久',
        firstName: '大地',
        team: '大商鬼魄会',
        playerId: null,
        tempId: '大地_松久_大商鬼魄会',
      },
    ],
  },
  {
    id: 161,
    name: '内藤（関西大学）',
    information: [
      {
        lastName: '内藤',
        firstName: '拓磨',
        team: '関西大学',
        playerId: null,
        tempId: '拓磨_内藤_関西大学',
      },
    ],
  },
  {
    id: 162,
    name: '池田（高砂クラブ）',
    information: [
      {
        lastName: '池田',
        firstName: '和樹',
        team: '高砂クラブ',
        playerId: null,
        tempId: '和樹_池田_高砂クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 163,
    name: '坂口（明治大学）',
    information: [
      {
        lastName: '坂口',
        firstName: '生磨',
        team: '明治大学',
        playerId: null,
        tempId: '生磨_坂口_明治大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 164,
    name: '松尾（嬉野高校）',
    information: [
      {
        lastName: '松尾',
        firstName: '航希',
        team: '嬉野高校',
        playerId: null,
        tempId: '航希_松尾_嬉野高校',
      },
    ],
  },
  {
    id: 165,
    name: '小林（太平洋工業）',
    information: [
      {
        lastName: '小林',
        firstName: '凌大',
        team: '太平洋工業',
        playerId: null,
        tempId: '凌大_小林_太平洋工業',
      },
    ],
  },
  {
    id: 166,
    name: '荒木（ヨネックス）',
    information: [
      {
        lastName: '荒木',
        firstName: '駿',
        team: 'ヨネックス',
        playerId: null,
        tempId: '駿_荒木_ヨネックス',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 167,
    name: '藤田（出雲御縁クラブ）',
    information: [
      {
        lastName: '藤田',
        firstName: '大輝',
        team: '出雲御縁クラブ',
        playerId: null,
        tempId: '大輝_藤田_出雲御縁クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 168,
    name: '宮田（ミヤタスポーツ）',
    information: [
      {
        lastName: '宮田',
        firstName: '智友',
        team: 'ミヤタスポーツ',
        playerId: null,
        tempId: '智友_宮田_ミヤタスポーツ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 169,
    name: '山下（M/BASE）',
    information: [
      {
        lastName: '山下',
        firstName: '憲哉',
        team: 'M/BASE',
        playerId: null,
        tempId: '憲哉_山下_M/BASE',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 170,
    name: '中村（高田商業高校）',
    information: [
      {
        lastName: '中村',
        firstName: '智葵',
        team: '高田商業高校',
        playerId: null,
        tempId: '智葵_中村_高田商業高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 171,
    name: '山田（見前ＳＴＣ）',
    information: [
      {
        lastName: '山田',
        firstName: '拓真',
        team: '見前ＳＴＣ',
        playerId: null,
        tempId: '拓真_山田_見前ＳＴＣ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 172,
    name: '平島（ＢＡＮＺ）',
    information: [
      {
        lastName: '平島',
        firstName: '大雅',
        team: 'ＢＡＮＺ',
        playerId: null,
        tempId: '大雅_平島_ＢＡＮＺ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 173,
    name: '内藤（UBE）',
    information: [
      {
        lastName: '内藤',
        firstName: '祐哉',
        team: 'UBE',
        playerId: null,
        tempId: '祐哉_内藤_UBE',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 174,
    name: '長根（同志社大学）',
    information: [
      {
        lastName: '長根',
        firstName: '新太',
        team: '同志社大学',
        playerId: null,
        tempId: '新太_長根_同志社大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 175,
    name: '山本（ワタキューセイモア）',
    information: [
      {
        lastName: '山本',
        firstName: '貴大',
        team: 'ワタキューセイモア',
        playerId: null,
        tempId: '貴大_山本_ワタキューセイモア',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 176,
    name: '中野（厚木市役所）',
    information: [
      {
        lastName: '中野',
        firstName: '寛大',
        team: '厚木市役所',
        playerId: null,
        tempId: '寛大_中野_厚木市役所',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 177,
    name: '堀（尽誠学園高校）',
    information: [
      {
        lastName: '堀',
        firstName: '拓仁',
        team: '尽誠学園高校',
        playerId: null,
        tempId: '拓仁_堀_尽誠学園高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 178,
    name: '中島（飯田協会）',
    information: [
      {
        lastName: '中島',
        firstName: '和志',
        team: '飯田協会',
        playerId: null,
        tempId: '和志_中島_飯田協会',
      },
    ],
  },
  {
    id: 179,
    name: '竹澤（信州大学）',
    information: [
      {
        lastName: '竹澤',
        firstName: '陽向',
        team: '信州大学',
        playerId: null,
        tempId: '陽向_竹澤_信州大学',
      },
    ],
  },
  {
    id: 180,
    name: '矢野（ＮＴＴ西日本）',
    information: [
      {
        lastName: '矢野',
        firstName: '颯人',
        team: 'ＮＴＴ西日本',
        playerId: null,
        tempId: '颯人_矢野_ＮＴＴ西日本',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 181,
    name: '端山（稲門クラブ）',
    information: [
      {
        lastName: '端山',
        firstName: '羅行',
        team: '稲門クラブ',
        playerId: null,
        tempId: '羅行_端山_稲門クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 182,
    name: '榎（島根大学）',
    information: [
      {
        lastName: '榎',
        firstName: '虎太郎',
        team: '島根大学',
        playerId: null,
        tempId: '虎太郎_榎_島根大学',
      },
    ],
  },
  {
    id: 183,
    name: '田中（松葉クラブ）',
    information: [
      {
        lastName: '田中',
        firstName: '健太',
        team: '松葉クラブ',
        playerId: null,
        tempId: '健太_田中_松葉クラブ',
      },
    ],
  },
  {
    id: 184,
    name: '利根川（尽誠学園高校）',
    information: [
      {
        lastName: '利根川',
        firstName: '碧生',
        team: '尽誠学園高校',
        playerId: null,
        tempId: '碧生_利根川_尽誠学園高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 185,
    name: '前川（小城協会）',
    information: [
      {
        lastName: '前川',
        firstName: '太一',
        team: '小城協会',
        playerId: null,
        tempId: '太一_前川_小城協会',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 186,
    name: '福田（上宮高校）',
    information: [
      {
        lastName: '福田',
        firstName: '喜大',
        team: '上宮高校',
        playerId: null,
        tempId: '喜大_福田_上宮高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 187,
    name: '御手洗（石川工業高専）',
    information: [
      {
        lastName: '御手洗',
        firstName: '友哉',
        team: '石川工業高専',
        playerId: null,
        tempId: '友哉_御手洗_石川工業高専',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 188,
    name: '浦川（マツダ）',
    information: [
      {
        lastName: '浦川',
        firstName: '優生',
        team: 'マツダ',
        playerId: null,
        tempId: '優生_浦川_マツダ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 189,
    name: '古幡（東京経済大学）',
    information: [
      {
        lastName: '古幡',
        firstName: '悠馬',
        team: '東京経済大学',
        playerId: null,
        tempId: '悠馬_古幡_東京経済大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 190,
    name: '内海（CROSSTYHOLDINGS）',
    information: [
      {
        lastName: '内海',
        firstName: '大輔',
        team: 'CROSSTYHOLDINGS',
        playerId: null,
        tempId: '大輔_内海_CROSSTYHOLDINGS',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 191,
    name: '北野（東北高校）',
    information: [
      {
        lastName: '北野',
        firstName: '咲斗',
        team: '東北高校',
        playerId: null,
        tempId: '咲斗_北野_東北高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 192,
    name: '杉原（松山大学）',
    information: [
      {
        lastName: '杉原',
        firstName: '僚太',
        team: '松山大学',
        playerId: null,
        tempId: '僚太_杉原_松山大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 193,
    name: '柳田（ESOFIA）',
    information: [
      {
        lastName: '柳田',
        firstName: '賢太朗',
        team: 'ESOFIA',
        playerId: null,
        tempId: '賢太朗_柳田_ESOFIA',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 194,
    name: '小坂（明電舎）',
    information: [
      {
        lastName: '小坂',
        firstName: '正虎',
        team: '明電舎',
        playerId: null,
        tempId: '正虎_小坂_明電舎',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 195,
    name: '野田（高田商業高校）',
    information: [
      {
        lastName: '野田',
        firstName: '悠貴',
        team: '高田商業高校',
        playerId: null,
        tempId: '悠貴_野田_高田商業高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 196,
    name: '山根（福山平成大学）',
    information: [
      {
        lastName: '山根',
        firstName: '寛人',
        team: '福山平成大学',
        playerId: null,
        tempId: '寛人_山根_福山平成大学',
      },
    ],
  },
  {
    id: 197,
    name: '中村（東松山東山クラブ）',
    information: [
      {
        lastName: '中村',
        firstName: '駿希',
        team: '東松山東山クラブ',
        playerId: null,
        tempId: '駿希_中村_東松山東山クラブ',
      },
    ],
  },
  {
    id: 198,
    name: '平山（UBE）',
    information: [
      {
        lastName: '平山',
        firstName: '綾一',
        team: 'UBE',
        playerId: null,
        tempId: '綾一_平山_UBE',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 199,
    name: '阪本（ワタキューセイモア）',
    information: [
      {
        lastName: '阪本',
        firstName: '崚',
        team: 'ワタキューセイモア',
        playerId: null,
        tempId: '崚_阪本_ワタキューセイモア',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 200,
    name: '手塚（木更津総合高校）',
    information: [
      {
        lastName: '手塚',
        firstName: '康介',
        team: '木更津総合高校',
        playerId: null,
        tempId: '康介_手塚_木更津総合高校',
      },
    ],
  },
  {
    id: 201,
    name: '國松（法政大学）',
    information: [
      {
        lastName: '國松',
        firstName: '樹人',
        team: '法政大学',
        playerId: null,
        tempId: '樹人_國松_法政大学',
      },
    ],
  },
  {
    id: 202,
    name: '渡邉（学法石川高校）',
    information: [
      {
        lastName: '渡邉',
        firstName: '智隼',
        team: '学法石川高校',
        playerId: null,
        tempId: '智隼_渡邉_学法石川高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 203,
    name: '鈴木（鳥取大学）',
    information: [
      {
        lastName: '鈴木',
        firstName: '瑛心',
        team: '鳥取大学',
        playerId: null,
        tempId: '瑛心_鈴木_鳥取大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 204,
    name: '垣本（レペゼン長崎）',
    information: [
      {
        lastName: '垣本',
        firstName: '瑞貴',
        team: 'レペゼン長崎',
        playerId: null,
        tempId: '瑞貴_垣本_レペゼン長崎',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 205,
    name: '香山（豊田自動織機）',
    information: [
      {
        lastName: '香山',
        firstName: '侑月',
        team: '豊田自動織機',
        playerId: null,
        tempId: '侑月_香山_豊田自動織機',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 206,
    name: '入江（璃羽クラブ）',
    information: [
      {
        lastName: '入江',
        firstName: '雅明',
        team: '璃羽クラブ',
        playerId: null,
        tempId: '雅明_入江_璃羽クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 207,
    name: '工藤（四国大学）',
    information: [
      {
        lastName: '工藤',
        firstName: '祐輝',
        team: '四国大学',
        playerId: null,
        tempId: '祐輝_工藤_四国大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 208,
    name: '坂本（Net-in）',
    information: [
      {
        lastName: '坂本',
        firstName: '凜',
        team: 'Net-in',
        playerId: null,
        tempId: '凜_坂本_Net-in',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 209,
    name: '花垣（富岡東高校）',
    information: [
      {
        lastName: '花垣',
        firstName: '陸',
        team: '富岡東高校',
        playerId: null,
        tempId: '陸_花垣_富岡東高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 210,
    name: '吉田（日本体育大学）',
    information: [
      {
        lastName: '吉田',
        firstName: '拓翔',
        team: '日本体育大学',
        playerId: 'yoshida-takuto',
        tempId: '拓翔_吉田_日本体育大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 211,
    name: '西田（ＹＫＫ）',
    information: [
      {
        lastName: '西田',
        firstName: '慎',
        team: 'ＹＫＫ',
        playerId: null,
        tempId: '慎_西田_ＹＫＫ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 212,
    name: '田村（茨城県教職員クラブ）',
    information: [
      {
        lastName: '田村',
        firstName: '律',
        team: '茨城県教職員クラブ',
        playerId: null,
        tempId: '律_田村_茨城県教職員クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 213,
    name: '濵田（和北クラブ）',
    information: [
      {
        lastName: '濵田',
        firstName: '迅',
        team: '和北クラブ',
        playerId: null,
        tempId: '迅_濵田_和北クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 214,
    name: '渡辺（広島経済大学）',
    information: [
      {
        lastName: '渡辺',
        firstName: '柊介',
        team: '広島経済大学',
        playerId: null,
        tempId: '柊介_渡辺_広島経済大学',
      },
    ],
  },
  {
    id: 215,
    name: '加藤（太平洋工業）',
    information: [
      {
        lastName: '加藤',
        firstName: '英雄',
        team: '太平洋工業',
        playerId: null,
        tempId: '英雄_加藤_太平洋工業',
      },
    ],
  },
  {
    id: 216,
    name: '広岡（NTT西日本）',
    information: [
      {
        lastName: '広岡',
        firstName: '宙',
        team: 'NTT西日本',
        playerId: 'hirooka-sora',
        tempId: '宙_広岡_NTT西日本',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 217,
    name: '丸山（one team）',
    information: [
      {
        lastName: '丸山',
        firstName: '海斗',
        team: 'one team',
        playerId: 'maruyama-kaito',
        tempId: '海斗_丸山_one team',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 218,
    name: '相山（田村高校）',
    information: [
      {
        lastName: '相山',
        firstName: '尚慧',
        team: '田村高校',
        playerId: null,
        tempId: '尚慧_相山_田村高校',
      },
    ],
  },
  {
    id: 219,
    name: '田中（鳥取大学）',
    information: [
      {
        lastName: '田中',
        firstName: '雄一朗',
        team: '鳥取大学',
        playerId: null,
        tempId: '雄一朗_田中_鳥取大学',
      },
    ],
  },
  {
    id: 220,
    name: '太田（札幌学院大学）',
    information: [
      {
        lastName: '太田',
        firstName: '遥来',
        team: '札幌学院大学',
        playerId: null,
        tempId: '遥来_太田_札幌学院大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 221,
    name: '緒方（祇園）',
    information: [
      {
        lastName: '緒方',
        firstName: '勇門',
        team: '祇園',
        playerId: null,
        tempId: '勇門_緒方_祇園',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 222,
    name: '関（天理大学）',
    information: [
      {
        lastName: '関',
        firstName: '暖太',
        team: '天理大学',
        playerId: null,
        tempId: '暖太_関_天理大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 223,
    name: '田中（松葉クラブ）',
    information: [
      {
        lastName: '田中',
        firstName: '翔',
        team: '松葉クラブ',
        playerId: null,
        tempId: '翔_田中_松葉クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 224,
    name: '岡本（岡本崇杜）',
    information: [
      {
        lastName: '岡本',
        firstName: '崇杜',
        team: '岡本崇杜',
        playerId: null,
        tempId: '崇杜_岡本_岡本崇杜',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 225,
    name: '犬童（JX金属倉見）',
    information: [
      {
        lastName: '犬童',
        firstName: '涼太',
        team: 'JX金属倉見',
        playerId: null,
        tempId: '涼太_犬童_JX金属倉見',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 226,
    name: '白川（ワタキューセイモア）',
    information: [
      {
        lastName: '白川',
        firstName: '雄己',
        team: 'ワタキューセイモア',
        playerId: null,
        tempId: '雄己_白川_ワタキューセイモア',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 227,
    name: '小倉（松山大学）',
    information: [
      {
        lastName: '小倉',
        firstName: '光生',
        team: '松山大学',
        playerId: null,
        tempId: '光生_小倉_松山大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 228,
    name: '藤岡（能登高校）',
    information: [
      {
        lastName: '藤岡',
        firstName: '蓮',
        team: '能登高校',
        playerId: null,
        tempId: '蓮_藤岡_能登高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 229,
    name: '稲垣（信州大学）',
    information: [
      {
        lastName: '稲垣',
        firstName: '颯時',
        team: '信州大学',
        playerId: null,
        tempId: '颯時_稲垣_信州大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 230,
    name: '安井（太平洋工業）',
    information: [
      {
        lastName: '安井',
        firstName: '梧透',
        team: '太平洋工業',
        playerId: null,
        tempId: '梧透_安井_太平洋工業',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 231,
    name: '河野（鹿児島実業高校）',
    information: [
      {
        lastName: '河野',
        firstName: '晃大',
        team: '鹿児島実業高校',
        playerId: null,
        tempId: '晃大_河野_鹿児島実業高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 232,
    name: '松田（東ソー南陽）',
    information: [
      {
        lastName: '松田',
        firstName: '蒼生',
        team: '東ソー南陽',
        playerId: null,
        tempId: '蒼生_松田_東ソー南陽',
      },
    ],
  },
  {
    id: 233,
    name: '青山（砧南中学校）',
    information: [
      {
        lastName: '青山',
        firstName: '航大',
        team: '砧南中学校',
        playerId: null,
        tempId: '航大_青山_砧南中学校',
      },
    ],
  },
  {
    id: 234,
    name: '片岡（日本体育大学）',
    information: [
      {
        lastName: '片岡',
        firstName: '暁紀',
        team: '日本体育大学',
        playerId: 'kataoka-aki',
        tempId: '暁紀_片岡_日本体育大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 235,
    name: '長江（NTT西日本）',
    information: [
      {
        lastName: '長江',
        firstName: '光一',
        team: 'NTT西日本',
        playerId: 'nagae-koichi',
        tempId: '光一_長江_NTT西日本',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 236,
    name: '上田（明治大学）',
    information: [
      {
        lastName: '上田',
        firstName: '泰大',
        team: '明治大学',
        playerId: null,
        tempId: '泰大_上田_明治大学',
      },
    ],
  },
  {
    id: 237,
    name: '中村（東京ガス）',
    information: [
      {
        lastName: '中村',
        firstName: '日紀',
        team: '東京ガス',
        playerId: null,
        tempId: '日紀_中村_東京ガス',
      },
    ],
  },
  {
    id: 238,
    name: '岡原（四国大学）',
    information: [
      {
        lastName: '岡原',
        firstName: '煌虎',
        team: '四国大学',
        playerId: null,
        tempId: '煌虎_岡原_四国大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 239,
    name: '飯降（高田商業高校）',
    information: [
      {
        lastName: '飯降',
        firstName: '脩',
        team: '高田商業高校',
        playerId: null,
        tempId: '脩_飯降_高田商業高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 240,
    name: '水木（東北高校）',
    information: [
      {
        lastName: '水木',
        firstName: '洸',
        team: '東北高校',
        playerId: null,
        tempId: '洸_水木_東北高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 241,
    name: '昼間（日本体育大学）',
    information: [
      {
        lastName: '昼間',
        firstName: '悠佑',
        team: '日本体育大学',
        playerId: 'hiruma-yusuke',
        tempId: '悠佑_昼間_日本体育大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 242,
    name: '石灘（岡山理科大附高校）',
    information: [
      {
        lastName: '石灘',
        firstName: '蒼瑛',
        team: '岡山理科大附高校',
        playerId: null,
        tempId: '蒼瑛_石灘_岡山理科大附高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 243,
    name: '井口（スマッシュイグチクラブ）',
    information: [
      {
        lastName: '井口',
        firstName: '雄介',
        team: 'スマッシュイグチクラブ',
        playerId: null,
        tempId: '雄介_井口_スマッシュイグチクラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 244,
    name: '倉橋（TeamG.U.R.U.I）',
    information: [
      {
        lastName: '倉橋',
        firstName: '凜',
        team: 'TeamG.U.R.U.I',
        playerId: null,
        tempId: '凜_倉橋_TeamG.U.R.U.I',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 245,
    name: '近藤（関西学院大学）',
    information: [
      {
        lastName: '近藤',
        firstName: '拓空',
        team: '関西学院大学',
        playerId: null,
        tempId: '拓空_近藤_関西学院大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 246,
    name: '井田（福岡大学）',
    information: [
      {
        lastName: '井田',
        firstName: '隼介',
        team: '福岡大学',
        playerId: null,
        tempId: '隼介_井田_福岡大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 247,
    name: '岩田（尼崎高校）',
    information: [
      {
        lastName: '岩田',
        firstName: '悠聖',
        team: '尼崎高校',
        playerId: null,
        tempId: '悠聖_岩田_尼崎高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 248,
    name: '夏見（和歌山県庁）',
    information: [
      {
        lastName: '夏見',
        firstName: '佳憲',
        team: '和歌山県庁',
        playerId: null,
        tempId: '佳憲_夏見_和歌山県庁',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 249,
    name: '下國（ヨシザワ）',
    information: [
      {
        lastName: '下國',
        firstName: '康生',
        team: 'ヨシザワ',
        playerId: null,
        tempId: '康生_下國_ヨシザワ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 250,
    name: '東川（ＹＫＫ）',
    information: [
      {
        lastName: '東川',
        firstName: '晃太',
        team: 'ＹＫＫ',
        playerId: null,
        tempId: '晃太_東川_ＹＫＫ',
      },
    ],
  },
  {
    id: 251,
    name: '川崎（UBE）',
    information: [
      {
        lastName: '川崎',
        firstName: '貴博',
        team: 'UBE',
        playerId: null,
        tempId: '貴博_川崎_UBE',
      },
    ],
  },
  {
    id: 252,
    name: '浅見（早稲田大学）',
    information: [
      {
        lastName: '浅見',
        firstName: '竣一朗',
        team: '早稲田大学',
        playerId: null,
        tempId: '竣一朗_浅見_早稲田大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 253,
    name: '伊藤（ヨネックス）',
    information: [
      {
        lastName: '伊藤',
        firstName: '幹',
        team: 'ヨネックス',
        playerId: null,
        tempId: '幹_伊藤_ヨネックス',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 254,
    name: '田川（國學院大学）',
    information: [
      {
        lastName: '田川',
        firstName: '雅也',
        team: '國學院大学',
        playerId: null,
        tempId: '雅也_田川_國學院大学',
      },
    ],
  },
  {
    id: 255,
    name: '吉川（マツダ）',
    information: [
      {
        lastName: '吉川',
        firstName: '恵大',
        team: 'マツダ',
        playerId: null,
        tempId: '恵大_吉川_マツダ',
      },
    ],
  },
  {
    id: 256,
    name: '高橋（湯前モンロー）',
    information: [
      {
        lastName: '高橋',
        firstName: '颯太',
        team: '湯前モンロー',
        playerId: null,
        tempId: '颯太_高橋_湯前モンロー',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 257,
    name: '横山（KEISPORTS）',
    information: [
      {
        lastName: '横山',
        firstName: '豪人',
        team: 'KEISPORTS',
        playerId: null,
        tempId: '豪人_横山_KEISPORTS',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 258,
    name: '安藤（東邦ガス）',
    information: [
      {
        lastName: '安藤',
        firstName: '悠作',
        team: '東邦ガス',
        playerId: 'ando-yusaku',
        tempId: '悠作_安藤_東邦ガス',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 259,
    name: '今村（志學館大学）',
    information: [
      {
        lastName: '今村',
        firstName: '恒志',
        team: '志學館大学',
        playerId: null,
        tempId: '恒志_今村_志學館大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 260,
    name: '柴崎（明徳義塾中学校）',
    information: [
      {
        lastName: '柴崎',
        firstName: '雄斗',
        team: '明徳義塾中学校',
        playerId: null,
        tempId: '雄斗_柴崎_明徳義塾中学校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 261,
    name: '村井（立命館大学）',
    information: [
      {
        lastName: '村井',
        firstName: '晋之介',
        team: '立命館大学',
        playerId: null,
        tempId: '晋之介_村井_立命館大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 262,
    name: '金子（松本市役所）',
    information: [
      {
        lastName: '金子',
        firstName: '凌',
        team: '松本市役所',
        playerId: null,
        tempId: '凌_金子_松本市役所',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 263,
    name: '保利（東海大学）',
    information: [
      {
        lastName: '保利',
        firstName: '彰大',
        team: '東海大学',
        playerId: null,
        tempId: '彰大_保利_東海大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 264,
    name: '伊藤（浜松ホトニクス）',
    information: [
      {
        lastName: '伊藤',
        firstName: '凜',
        team: '浜松ホトニクス',
        playerId: null,
        tempId: '凜_伊藤_浜松ホトニクス',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 265,
    name: '井上（ワインクラブ）',
    information: [
      {
        lastName: '井上',
        firstName: '翔',
        team: 'ワインクラブ',
        playerId: null,
        tempId: '翔_井上_ワインクラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 266,
    name: '近藤（アキム）',
    information: [
      {
        lastName: '近藤',
        firstName: '昴',
        team: 'アキム',
        playerId: null,
        tempId: '昴_近藤_アキム',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 267,
    name: '川﨑（ワタキューセイモア）',
    information: [
      {
        lastName: '川﨑',
        firstName: '浩希',
        team: 'ワタキューセイモア',
        playerId: null,
        tempId: '浩希_川﨑_ワタキューセイモア',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 268,
    name: '真柄（UBE）',
    information: [
      {
        lastName: '真柄',
        firstName: '壮太郎',
        team: 'UBE',
        playerId: null,
        tempId: '壮太郎_真柄_UBE',
      },
    ],
  },
  {
    id: 269,
    name: '渋田（KAMIMINE）',
    information: [
      {
        lastName: '渋田',
        firstName: '将平',
        team: 'KAMIMINE',
        playerId: null,
        tempId: '将平_渋田_KAMIMINE',
      },
    ],
  },
  {
    id: 270,
    name: '清水（同志社大学）',
    information: [
      {
        lastName: '清水',
        firstName: '駿',
        team: '同志社大学',
        playerId: null,
        tempId: '駿_清水_同志社大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 271,
    name: '野本（法政大学）',
    information: [
      {
        lastName: '野本',
        firstName: '凌生',
        team: '法政大学',
        playerId: null,
        tempId: '凌生_野本_法政大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 272,
    name: '吉末（山口クラブ）',
    information: [
      {
        lastName: '吉末',
        firstName: '尚之',
        team: '山口クラブ',
        playerId: null,
        tempId: '尚之_吉末_山口クラブ',
      },
    ],
  },
  {
    id: 273,
    name: '岩城（とわの森三愛高校）',
    information: [
      {
        lastName: '岩城',
        firstName: '啓太',
        team: 'とわの森三愛高校',
        playerId: null,
        tempId: '啓太_岩城_とわの森三愛高校',
      },
    ],
  },
  {
    id: 274,
    name: '宮内（土浦クラブ）',
    information: [
      {
        lastName: '宮内',
        firstName: '健太',
        team: '土浦クラブ',
        playerId: null,
        tempId: '健太_宮内_土浦クラブ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 275,
    name: '及川（見前ＳＴＣ）',
    information: [
      {
        lastName: '及川',
        firstName: '太希',
        team: '見前ＳＴＣ',
        playerId: null,
        tempId: '太希_及川_見前ＳＴＣ',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 276,
    name: '相良（福岡市役所）',
    information: [
      {
        lastName: '相良',
        firstName: '昌慶',
        team: '福岡市役所',
        playerId: null,
        tempId: '昌慶_相良_福岡市役所',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 277,
    name: '樋口（高田商業高校）',
    information: [
      {
        lastName: '樋口',
        firstName: '大翔',
        team: '高田商業高校',
        playerId: null,
        tempId: '大翔_樋口_高田商業高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 278,
    name: '工藤（星城大学）',
    information: [
      {
        lastName: '工藤',
        firstName: '康治朗',
        team: '星城大学',
        playerId: null,
        tempId: '康治朗_工藤_星城大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 279,
    name: '南（三重高校）',
    information: [
      {
        lastName: '南',
        firstName: '龍之介',
        team: '三重高校',
        playerId: null,
        tempId: '龍之介_南_三重高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 280,
    name: '伊藤（尽誠学園高校）',
    information: [
      {
        lastName: '伊藤',
        firstName: '陽聖',
        team: '尽誠学園高校',
        playerId: null,
        tempId: '陽聖_伊藤_尽誠学園高校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 281,
    name: '川崎（日本体育大学）',
    information: [
      {
        lastName: '川崎',
        firstName: '康平',
        team: '日本体育大学',
        playerId: 'kawasaki-kohei',
        tempId: '康平_川崎_日本体育大学',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 282,
    name: '畑本（レペゼン長崎）',
    information: [
      {
        lastName: '畑本',
        firstName: '理士',
        team: 'レペゼン長崎',
        playerId: null,
        tempId: '理士_畑本_レペゼン長崎',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 283,
    name: '石井（ENEOS）',
    information: [
      {
        lastName: '石井',
        firstName: '佑一',
        team: 'ENEOS',
        playerId: null,
        tempId: '佑一_石井_ENEOS',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 284,
    name: '鈴木（野木中学校）',
    information: [
      {
        lastName: '鈴木',
        firstName: '佐禄',
        team: '野木中学校',
        playerId: null,
        tempId: '佐禄_鈴木_野木中学校',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 285,
    name: '藤井（ルーセント大阪）',
    information: [
      {
        lastName: '藤井',
        firstName: '一貴',
        team: 'ルーセント大阪',
        playerId: null,
        tempId: '一貴_藤井_ルーセント大阪',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
  {
    id: 286,
    name: '長峯（エビス商事）',
    information: [
      {
        lastName: '長峯',
        firstName: '慶',
        team: 'エビス商事',
        playerId: null,
        tempId: '慶_長峯_エビス商事',
      },
    ],
  },
  {
    id: 287,
    name: '鬼塚（東洋大学）',
    information: [
      {
        lastName: '鬼塚',
        firstName: '一成',
        team: '東洋大学',
        playerId: null,
        tempId: '一成_鬼塚_東洋大学',
      },
    ],
  },
  {
    id: 288,
    name: '内田（NTT西日本）',
    information: [
      {
        lastName: '内田',
        firstName: '理久',
        team: 'NTT西日本',
        playerId: 'uchida-riku',
        tempId: '理久_内田_NTT西日本',
      },
    ],
  },
  { id: 'bye', name: '1回戦免除', information: [] },
];
