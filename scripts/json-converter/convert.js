const fs = require('fs');

// opponent 文字列を分解して name / team に変換
function parseOpponent(opponentStr) {
  return opponentStr.split('・').map((opponent) => {
    const match = opponent.match(/([^\(（]+)[\(（](.*?)[\)）]/); // 両方のカッコに対応
    const name = match ? match[1].trim() : opponent;
    const team = match ? match[2].trim() : '';
    return { name, team, playerId: null };
  });
}

// opponent 配列内で team 情報を補完する
function enrichTeams(opponents) {
  if (opponents.length === 2) {
    opponents[0].team = opponents[0].team || opponents[1].team;
    opponents[1].team = opponents[1].team || opponents[0].team;
  }
  return opponents;
}

// score を分解して games フィールドを追加する関数
function parseScore(score) {
  const [won, lost] = score.split('-').map(Number);
  return {
    won,
    lost,
  };
}

// 変換処理の関数
function convertMatchData(inputData) {
  if (!Array.isArray(inputData)) {
    throw new Error('入力データは配列でなければなりません');
  }

  return {
    matches: inputData.map((match) => {
      const convertResults = (results) =>
        results.map((result) => {
          const opponents = enrichTeams(parseOpponent(result.opponent));
          const scoreDetails = parseScore(result.score);
          return {
            round: result.round,
            opponent: result.opponent,
            opponents,
            result: result.result,
            score: result.score,
            games: scoreDetails, // games フィールドを追加
          };
        });

      return {
        tournament: match.tournament,
        dateRange: match.dateRange,
        location: match.location,
        link: match.link,
        format: match.format,
        finalResult: match.finalResult,
        partner: match.partner || null,
        groupStage: match.groupStage
          ? {
              format: match.groupStage.format,
              group: match.groupStage.group,
              results: convertResults(match.groupStage.results),
            }
          : null,
        finalStage: match.finalStage
          ? {
              format: match.finalStage.format,
              results: convertResults(match.finalStage.results),
            }
          : null,
        results: match.results ? convertResults(match.results) : null,
      };
    }),
  };
}

// JSONファイルを読み込む
fs.readFile('input.json', 'utf8', (err, data) => {
  if (err) {
    console.error('ファイルの読み込みに失敗しました:', err);
    return;
  }

  try {
    const parsedData = JSON.parse(data);
    const matchesData = parsedData.matches;

    const convertedData = convertMatchData(matchesData);

    fs.writeFileSync(
      'output.json',
      JSON.stringify(convertedData, null, 2),
      'utf8',
    );
    console.log('変換が完了しました。出力ファイル：output.json');
  } catch (error) {
    console.error('無効なJSONデータです:', error);
  }
});
