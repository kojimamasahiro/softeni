const fs = require('fs');

// results.json を読み込む
fs.readFile('../data/titles.json', 'utf8', (err, data) => {
  if (err) {
    console.error('ファイルの読み込みに失敗しました:', err);
    return;
  }

  // JSONデータをパース
  const jsonData = JSON.parse(data);

  // 出現頻度を記録するオブジェクト
  const playerIdCount = {};

  // 大会ごとにデータを走査
  for (const tournament in jsonData) {
    const years = jsonData[tournament].years;

    // 年ごとの結果を走査
    for (const year in years) {
      const results = years[year].results;

      // 各結果をループしてプレイヤーIDをカウント
      results.forEach((result) => {
        const playerId = result.playerId;
        if (playerIdCount[playerId]) {
          playerIdCount[playerId]++;
        } else {
          playerIdCount[playerId] = 1;
        }
      });
    }
  }

  // 出現頻度を降順に並べ替えて表示
  const sortedPlayerIds = Object.entries(playerIdCount).sort(
    (a, b) => b[1] - a[1],
  );

  console.log('PlayerId 出現頻度 (降順):');
  sortedPlayerIds.forEach(([playerId, count]) => {
    console.log(`${playerId}: ${count}回`);
  });
});
