const fs = require('fs');

// 変換処理の関数
function convertMatchData(inputData) {
    if (!Array.isArray(inputData)) {
        throw new Error('入力データは配列でなければなりません');
    }

    return {
        matches: inputData.map(match => {
            const convertedMatch = {
                tournament: match.tournament,
                dateRange: match.dateRange,
                location: match.location,
                link: match.link,
                format: match.format,
                finalResult: match.finalResult,
                partner: match.partner,
                groupStage: {
                    format: match.groupStage.format,
                    group: match.groupStage.group,
                    results: match.groupStage.results.map(result => {
                        // opponentを名前とチームに分ける
                        const opponents = result.opponent.split("・").map(opponent => {
                            // 正規表現で名前とチームを分ける
                            const match = opponent.match(/([^\(]+)(\（.*\）)/);
                            const name = match ? match[1].trim() : opponent;
                            const team = match ? match[2] : '';

                            return {
                                name: name,
                                team: team,
                                playerId: null
                            };
                        });

                        // 二人目のteamを一人目のteamと同じにする
                        if (opponents.length === 2) {
                            opponents[0].team = opponents[0].team || opponents[1].team;
                        }

                        return {
                            round: result.round,
                            opponent: result.opponent,
                            opponents: opponents,
                            result: result.result,
                            score: result.score
                        };
                    })
                },
                finalStage: {
                    format: match.finalStage.format,
                    results: match.finalStage.results.map(result => {
                        // opponentを名前とチームに分ける
                        const opponents = result.opponent.split("・").map(opponent => {
                            // 正規表現で名前とチームを分ける
                            const match = opponent.match(/([^\(]+)(\（.*\）)/);
                            const name = match ? match[1].trim() : opponent;
                            const team = match ? match[2] : '';

                            return {
                                name: name,
                                team: team,
                                playerId: null
                            };
                        });

                        // 二人目のteamを一人目のteamと同じにする
                        if (opponents.length === 2) {
                            opponents[0].team = opponents[0].team || opponents[1].team;
                        }

                        return {
                            round: result.round,
                            opponent: result.opponent,
                            opponents: opponents,
                            result: result.result,
                            score: result.score
                        };
                    })
                }
            };

            return convertedMatch;
        })
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

        // matches 配列を取り出し
        const matchesData = parsedData.matches;

        // 変換処理
        const convertedData = convertMatchData(matchesData);

        // 結果をoutput.jsonに保存
        fs.writeFileSync('output.json', JSON.stringify(convertedData, null, 2), 'utf8');
        console.log('変換が完了しました。出力ファイル：output.json');
    } catch (error) {
        console.error('無効なJSONデータです:', error);
    }
});
