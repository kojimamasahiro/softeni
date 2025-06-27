(() => {
  const playersContainer = document.getElementById('playersContainer');
  const addPlayerBtn = document.getElementById('addPlayerBtn');
  const loadJsonBtn = document.getElementById('loadJsonBtn');
  const generateBtn = document.getElementById('generateBtn');
  const output = document.getElementById('output');
  const playerList = document.getElementById('playerList');
  const byeCheckbox = document.getElementById('byeCheckbox');

  let jsonArray = [];

  // datalistにplayerId, lastName, firstName, teamを全部追加
  function populateDatalist() {
    playerList.innerHTML = '';
    const added = new Set();
    for (const pid in teamData.players) {
      const p = teamData.players[pid];
      [pid, p.lastName, p.firstName, p.team].forEach((val) => {
        if (!added.has(val)) {
          const option = document.createElement('option');
          option.value = val;
          playerList.appendChild(option);
          added.add(val);
        }
      });
    }
  }

  populateDatalist();

  // 入力値に対応する選手をteamDataから探す（playerId / lastName / firstName / team のいずれか一致）
  function findPlayerByInput(input) {
    const val = input.trim();
    if (!val) return null;

    // playerId一致
    if (teamData.players[val]) {
      return { playerId: val, ...teamData.players[val] };
    }
    // lastName一致
    for (const pid in teamData.players) {
      const p = teamData.players[pid];
      if (p.lastName === val) return { playerId: pid, ...p };
    }
    // firstName一致
    for (const pid in teamData.players) {
      const p = teamData.players[pid];
      if (p.firstName === val) return { playerId: pid, ...p };
    }
    // team一致
    for (const pid in teamData.players) {
      const p = teamData.players[pid];
      if (p.team === val) return { playerId: pid, ...p };
    }
    return null;
  }

  function setupAutoFill(input) {
    let lastValue = '';
    input.addEventListener('input', () => {
      const val = input.value.trim();
      if (val === lastValue) return; // 同じ値なら何もしない
      lastValue = val;
      const player = findPlayerByInput(val);
      if (player) {
        const parent = input.closest('.player-group');
        input.value = player.playerId; // playerIdをセットして統一
        parent.querySelector('.lastName').value = player.lastName;
        parent.querySelector('.firstName').value = player.firstName;
        parent.querySelector('.team').value = player.team;
      }
    });
  }

  function createPlayerInputGroup() {
    const div = document.createElement('div');
    div.className = 'player-group';

    // playerId等の自動補完対象
    const labelPlayer = document.createElement('label');
    labelPlayer.innerHTML = `選手情報（playerId / 姓 / 名 / チーム名から補完可能）：`;
    const playerInput = document.createElement('input');
    playerInput.setAttribute('list', 'playerList');
    playerInput.className = 'playerInput';
    playerInput.autocomplete = 'off';
    labelPlayer.appendChild(playerInput);

    const labelLastName = document.createElement('label');
    labelLastName.innerText = '姓 (lastName)：';
    const lastNameInput = document.createElement('input');
    lastNameInput.type = 'text';
    lastNameInput.className = 'lastName';
    labelLastName.appendChild(lastNameInput);

    const labelFirstName = document.createElement('label');
    labelFirstName.innerText = '名 (firstName)：';
    const firstNameInput = document.createElement('input');
    firstNameInput.type = 'text';
    firstNameInput.className = 'firstName';
    labelFirstName.appendChild(firstNameInput);

    const labelTeam = document.createElement('label');
    labelTeam.innerText = 'チーム名 (team)：';
    const teamInput = document.createElement('input');
    teamInput.type = 'text';
    teamInput.className = 'team';
    labelTeam.appendChild(teamInput);

    const labelPrefecture = document.createElement('label');
    labelPrefecture.innerText = '都道府県 (prefecture)：';
    const prefectureInput = document.createElement('input');
    prefectureInput.type = 'text';
    prefectureInput.className = 'prefecture';
    labelPrefecture.appendChild(prefectureInput);

    const clearBtn = document.createElement('button');
    clearBtn.innerText = 'この選手情報をクリア';
    clearBtn.className = 'clearPlayerBtn';
    clearBtn.type = 'button';

    const removeBtn = document.createElement('button');
    removeBtn.innerText = 'この選手を削除';
    removeBtn.className = 'removePlayerBtn';
    removeBtn.type = 'button';

    // 構築
    div.appendChild(labelPlayer);
    div.appendChild(labelLastName);
    div.appendChild(labelFirstName);
    div.appendChild(labelTeam);
    div.appendChild(labelPrefecture);
    div.appendChild(clearBtn);
    div.appendChild(removeBtn);

    // イベント
    removeBtn.addEventListener('click', () => {
      playersContainer.removeChild(div);
    });

    clearBtn.addEventListener('click', () => {
      playerInput.value = '';
      lastNameInput.value = '';
      firstNameInput.value = '';
      teamInput.value = '';
      prefectureInput.value = '';
    });

    setupAutoFill(playerInput);
    setupNameSplit(div);
    setupSpaceRemoval(div);
    setupTeamPrefectureAutoFill(div);

    return div;
  }

  // 初期表示で1人分の入力欄を作成
  function initializeInputArea() {
    playersContainer.innerHTML = '';
    playersContainer.appendChild(createPlayerInputGroup());
  }

  function setupNameSplit(container) {
    const lastNameInput = container.querySelector('.lastName');
    const firstNameInput = container.querySelector('.firstName');
    const teamInput = container.querySelector('.team');
    const prefectureInput = container.querySelector('.prefecture');

    lastNameInput.addEventListener('input', () => {
      const original = lastNameInput.value.trim();
      if (!original) return;

      let segments = original.split(/[\s　]+/).filter(Boolean);

      let teamNames = [];
      let prefectureNames = [];
      let outputParsed = null;

      // ▼ 辞書から取得
      if (typeof teamPrefectureMap !== 'undefined') {
        teamNames = Object.keys(teamPrefectureMap);
        prefectureNames = [...new Set(Object.values(teamPrefectureMap))];
      }

      // ▼ output.value から動的取得
      try {
        outputParsed = JSON.parse(document.getElementById('output').value);
        if (Array.isArray(outputParsed)) {
          for (const pair of outputParsed) {
            for (const player of pair.information || []) {
              if (player.team && !teamNames.includes(player.team)) {
                teamNames.push(player.team);
              }
              if (
                player.prefecture &&
                !prefectureNames.includes(player.prefecture)
              ) {
                prefectureNames.push(player.prefecture);
              }
            }
          }
        }
      } catch (e) {
        console.warn('output.value の JSONパース失敗：', e);
      }

      // ▼ チーム名を後方一致で検出
      let matchedTeam = null;
      for (let len = Math.min(5, segments.length); len >= 1; len--) {
        const joined = segments.slice(-len).join('');
        if (teamNames.includes(joined)) {
          matchedTeam = joined;
          segments.splice(-len, len);
          break;
        }
      }

      if (matchedTeam) {
        teamInput.value = matchedTeam;

        // 他の空欄選手にも team を補完
        document.querySelectorAll('.player-group').forEach((group) => {
          const ti = group.querySelector('.team');
          if (ti && !ti.value.trim()) {
            ti.value = matchedTeam;
          }
        });

        // ▼ prefecture 補完
        if (!prefectureInput.value) {
          let pref = null;

          if (typeof teamPrefectureMap !== 'undefined') {
            pref = teamPrefectureMap[matchedTeam];
          }

          if (!pref && Array.isArray(outputParsed)) {
            for (const pair of outputParsed) {
              for (const player of pair.information || []) {
                if (player.team === matchedTeam && player.prefecture) {
                  pref = player.prefecture;
                  break;
                }
              }
              if (pref) break;
            }
          }

          if (pref) {
            prefectureInput.value = pref;

            // 他の空欄選手にも補完
            document.querySelectorAll('.player-group').forEach((group) => {
              const pi = group.querySelector('.prefecture');
              if (pi && !pi.value.trim()) {
                pi.value = pref;
              }
            });
          }
        }
      }

      // ▼ 都道府県名を末尾から検出
      for (let len = Math.min(4, segments.length); len >= 1; len--) {
        const joined = segments.slice(-len).join('');
        if (prefectureNames.includes(joined)) {
          prefectureInput.value = joined;

          // 他の空欄選手にも補完
          document.querySelectorAll('.player-group').forEach((group) => {
            const pi = group.querySelector('.prefecture');
            if (pi && !pi.value.trim()) {
              pi.value = joined;
            }
          });

          segments.splice(-len, len);
          break;
        }
      }

      // 残りを姓・名に分割

      // ✅ firstName にすでに値がある場合は補完スキップ
      if (firstNameInput.value.trim()) {
        return;
      }

      const joinedName = segments.join('');
      const nameLen = joinedName.length;
      const splitRules = { 2: 1, 3: 2, 4: 2, 5: 2, 6: 3 };
      const k = splitRules[nameLen] || 2;

      const newLastName = joinedName.slice(0, k);
      const newFirstName = joinedName.slice(k);

      lastNameInput.value = newLastName;
      firstNameInput.value = newFirstName;
    });
  }

  // プレイヤー入力欄の追加ボタン
  addPlayerBtn.addEventListener('click', () => {
    playersContainer.appendChild(createPlayerInputGroup());
  });

  loadJsonBtn.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(output.value);
      if (!Array.isArray(parsed)) {
        alert('JSONは配列である必要があります');
        return;
      }
      jsonArray = parsed;
      alert('JSONを正常に読み込みました');
    } catch (e) {
      alert('JSONのパースに失敗しました: ' + e.message);
    }
  });

  // JSON生成処理（入力欄はそのまま維持）
  generateBtn.addEventListener('click', () => {
    // id入力欄の値を取得
    const idInput = document.getElementById('outputIdInput');
    let outputId = parseInt(idInput.value, 10);
    if (isNaN(outputId) || outputId < 1) {
      alert('有効なIDを入力してください（1以上の整数）');
      return;
    }
    const playerDivs = playersContainer.querySelectorAll('.player-group');
    if (playerDivs.length === 0) {
      alert('最低1人以上の選手情報を入力してください');
      return;
    }

    const players = [];
    const teamSet = new Set();

    for (const div of playerDivs) {
      const lastName = div.querySelector('.lastName').value.trim();
      const firstName = div.querySelector('.firstName').value.trim();
      const team = div.querySelector('.team').value.trim();
      const prefecture = div.querySelector('.prefecture').value.trim();
      const playerIdInput = div.querySelector('.playerInput').value.trim();
      const playerId = playerIdInput || null;
      const tempId = lastName + '_' + firstName + '_' + team;

      if (!lastName) {
        alert('姓は必須です');
        return;
      }

      if (team) {
        teamSet.add(team);
      }

      players.push({ lastName, firstName, team, prefecture, playerId, tempId });
    }
    if (players.length === 2) {
      const prefecture1 = players[0].prefecture;
      const prefecture2 = players[1].prefecture;

      if (prefecture1 && !prefecture2) {
        players[1].prefecture = prefecture1;
      } else if (!prefecture1 && prefecture2) {
        players[0].prefecture = prefecture2;
      }
    }

    let representativeTeam = '';
    if (teamSet.size === 1) {
      representativeTeam = [...teamSet][0];
      for (const player of players) {
        player.team = player.team || representativeTeam;
        player.tempId =
          player.lastName + '_' + player.firstName + '_' + representativeTeam;
      }
    } else if (teamSet.size === 0) {
      representativeTeam = '';
    } else {
      representativeTeam = '混合';
    }

    const name =
      players.map((p) => p.lastName).join('・') +
      (representativeTeam ? `（${representativeTeam}）` : '');

    const obj = {
      id: outputId++,
      name,
      information: players,
    };

    jsonArray.push(obj);

    idInput.value = outputId;

    const compressedWithBreaks =
      '[\n' + jsonArray.map((o) => JSON.stringify(o)).join(',\n') + '\n]';
    output.value = compressedWithBreaks;

    // 入力欄をリセット
    document
      .querySelectorAll('.playerInput')
      .forEach((input) => (input.value = ''));
    document
      .querySelectorAll('.lastName')
      .forEach((input) => (input.value = ''));
    document
      .querySelectorAll('.firstName')
      .forEach((input) => (input.value = ''));
    document.querySelectorAll('.team').forEach((input) => (input.value = ''));
    document
      .querySelectorAll('.prefecture')
      .forEach((input) => (input.value = ''));

    if (byeCheckbox.checked) {
      const byeObj = {
        id: 'bye',
        name: '1回戦免除',
        information: [],
      };
      jsonArray.push(byeObj);
      const compressedWithBreaks =
        '[\n' + jsonArray.map((o) => JSON.stringify(o)).join(',\n') + '\n]';
      output.value = compressedWithBreaks;
    }
  });

  const addByeBtn = document.getElementById('addByeBtn');

  addByeBtn.addEventListener('click', () => {
    const byeObj = {
      id: 'bye',
      name: '1回戦免除',
      information: [],
    };

    jsonArray.push(byeObj);

    // 出力を更新（配列ごとに改行の圧縮表示の例）
    const compressedWithBreaks =
      '[\n' + jsonArray.map((o) => JSON.stringify(o)).join(',\n') + '\n]';
    output.value = compressedWithBreaks;
  });

  // 初期表示だけリセット
  initializeInputArea();
})();

const output = document.getElementById('output');
const copyBtn = document.getElementById('copyBtn');

copyBtn.addEventListener('click', () => {
  const text = output.value;
  if (!text) {
    alert('コピーする内容がありません');
    return;
  }
  navigator.clipboard
    .writeText(text)
    .then(() => {
      alert('JSONをクリップボードにコピーしました');
    })
    .catch((err) => {
      alert('コピーに失敗しました: ' + err);
    });
});

// スペース・カッコ・数字を削除する関数
function removeUnwantedChars(event) {
  event.target.value = event.target.value.replace(/[\s0-9()（）]/g, '');
}

// 指定したコンテナ内の全対象 input にイベントを設定
function setupSpaceRemoval(container) {
  const inputs = container.querySelectorAll(
    'input.firstName, input.team, input.prefecture',
  );
  inputs.forEach((input) => {
    input.addEventListener('input', removeUnwantedChars);
  });
}

function setupTeamPrefectureAutoFill(container) {
  const teamInput = container.querySelector('.team');
  const prefectureInput = container.querySelector('.prefecture');

  teamInput.addEventListener('input', () => {
    const teamName = teamInput.value.trim();
    if (!teamName || prefectureInput.value.trim()) return;

    // 1. teamPrefectureMap から補完
    if (
      typeof teamPrefectureMap !== 'undefined' &&
      teamPrefectureMap[teamName]
    ) {
      prefectureInput.value = teamPrefectureMap[teamName];
      return;
    }

    // 2. output.value の JSON から補完
    try {
      const parsed = JSON.parse(output.value);
      if (Array.isArray(parsed)) {
        for (const pair of parsed) {
          for (const player of pair.information || []) {
            if (player.team === teamName && player.prefecture) {
              prefectureInput.value = player.prefecture;
              return;
            }
          }
        }
      }
    } catch (e) {
      console.warn('補完用JSONがパースできませんでした：', e);
    }
  });
}
