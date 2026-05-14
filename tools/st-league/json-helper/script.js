// JSON入力補助ツールのJavaScriptコードを作成しました。
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('jsonForm');
  const output = document.getElementById('output');
  const matchesContainer = document.getElementById('matchesContainer');

  // デフォルト値の設定
  document.getElementById('matchId').value = 1;
  document.getElementById('matchDate').value = new Date()
    .toISOString()
    .split('T')[0];
  document.getElementById('status').value = 'finished';

  // participants.jsからデータを取得
  const teamASelect = document.getElementById('teamA');
  const teamBSelect = document.getElementById('teamB');

  // デフォルトの未選択オプションを追加
  const defaultOptionA = document.createElement('option');
  defaultOptionA.value = '';
  defaultOptionA.textContent = '未選択';
  defaultOptionA.selected = true;
  defaultOptionA.disabled = true;
  teamASelect.appendChild(defaultOptionA);

  const defaultOptionB = document.createElement('option');
  defaultOptionB.value = '';
  defaultOptionB.textContent = '未選択';
  defaultOptionB.selected = true;
  defaultOptionB.disabled = true;
  teamBSelect.appendChild(defaultOptionB);

  // 初期化: 常に3試合を表示
  const matchTypes = ['D1', 'S', 'D2'];
  // 現在のgenderを管理
  let currentGender = 'girls';

  const teamList =
    currentGender === 'girls' ? participants.girls : participants.boys;
  teamList.forEach((team) => {
    const optionA = document.createElement('option');
    optionA.value = team.teamId;
    optionA.textContent = team.name[0];
    teamASelect.appendChild(optionA);

    const optionB = document.createElement('option');
    optionB.value = team.teamId;
    optionB.textContent = team.name[0];
    teamBSelect.appendChild(optionB);
  });

  // チーム選択時に選手を更新
  const updatePlayers = (teamId, dropdownId) => {
    const dropdown = document.getElementById(dropdownId);
    const teamList =
      currentGender === 'girls' ? participants.girls : participants.boys;
    dropdown.innerHTML = '';
    if (!teamId) return;
    const team = teamList.find((t) => t.teamId === teamId);
    if (!team) return;
    if (team) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '未選択';
      option.selected = true;
      option.disabled = true;
      dropdown.appendChild(option);
      team.players.forEach((player) => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = `${player.lastName} ${player.firstName}`;
        dropdown.appendChild(option);
      });
    }
  };

  matchTypes.forEach((type, index) => {
    const matchDiv = document.createElement('div');
    matchDiv.classList.add('match');
    matchDiv.innerHTML = `
      <h3>${type}</h3>
      <label for="winner${index}">勝者:</label>
      <input type="text" id="winner${index}" name="winner${index}" required><br>

      <label>チームAのスコア:</label>
      <div id="scoreAButtons${index}" class="score-buttons">
        ${[0, 1, 2, 3, 4]
          .map(
            (score) =>
              `<button type='button' class='score-button' data-team='A' data-index='${index}' data-score='${score}'>${score}</button>`,
          )
          .join('')}
      </div>
      <input type="hidden" id="scoreA${index}" name="scoreA${index}" value="4">

      <label>チームBのスコア:</label>
      <div id="scoreBButtons${index}" class="score-buttons">
        ${[0, 1, 2, 3, 4]
          .map(
            (score) =>
              `<button type='button' class='score-button' data-team='B' data-index='${index}' data-score='${score}'>${score}</button>`,
          )
          .join('')}
      </div>
      <input type="hidden" id="scoreB${index}" name="scoreB${index}" value="4">

      <label for="playersA${index}">チームAの選手:</label>
      ${
        type === 'D1' || type === 'D2'
          ? `<select id="playersA1_${index}" name="playersA1_${index}" required></select>
         <select id="playersA2_${index}" name="playersA2_${index}" required></select>`
          : `<select id="playersA${index}" name="playersA${index}" required></select>`
      }<br>

      <label for="playersB${index}">チームBの選手:</label>
      ${
        type === 'D1' || type === 'D2'
          ? `<select id="playersB1_${index}" name="playersB1_${index}" required></select>
         <select id="playersB2_${index}" name="playersB2_${index}" required></select>`
          : `<select id="playersB${index}" name="playersB${index}" required></select>`
      }<br>
    `;
    matchesContainer.appendChild(matchDiv);

    // スコアボタンのイベントリスナーを追加
    const scoreButtons = matchDiv.querySelectorAll('.score-button');
    scoreButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        const team = e.target.dataset.team;
        const score = e.target.dataset.score;
        const index = e.target.dataset.index;

        // スコアを設定
        if (team === 'A') {
          document.getElementById(`scoreA${index}`).value = score;
        } else if (team === 'B') {
          document.getElementById(`scoreB${index}`).value = score;
        }

        // スコアボタンの選択状態を更新
        const buttonsGroup = matchDiv.querySelectorAll(
          `.score-button[data-team='${team}'][data-index='${index}']`,
        );
        buttonsGroup.forEach((btn) => btn.classList.remove('selected'));
        e.target.classList.add('selected');

        // スコアを比較して勝者を自動入力
        const scoreA = parseInt(
          document.getElementById(`scoreA${index}`).value,
          10,
        );
        const scoreB = parseInt(
          document.getElementById(`scoreB${index}`).value,
          10,
        );
        const winnerInput = document.getElementById(`winner${index}`);

        if (scoreA > scoreB) {
          winnerInput.value = 'A';
        } else if (scoreB > scoreA) {
          winnerInput.value = 'B';
        } else {
          winnerInput.value = ''; // 引き分けの場合は空にする
        }
      });
    });

    const updateDropdownOptions = (index, team) => {
      const selectedPlayers = new Set();

      // Collect all selected players for the given team
      if (team === 'A') {
        if (type === 'D1' || type === 'D2') {
          const playerA1 = document.getElementById(`playersA1_${index}`);
          const playerA2 = document.getElementById(`playersA2_${index}`);
          if (playerA1) selectedPlayers.add(playerA1.value);
          if (playerA2) selectedPlayers.add(playerA2.value);
        } else {
          const playerA = document.getElementById(`playersA${index}`);
          if (playerA) selectedPlayers.add(playerA.value);
        }
      } else if (team === 'B') {
        if (type === 'D1' || type === 'D2') {
          const playerB1 = document.getElementById(`playersB1_${index}`);
          const playerB2 = document.getElementById(`playersB2_${index}`);
          if (playerB1) selectedPlayers.add(playerB1.value);
          if (playerB2) selectedPlayers.add(playerB2.value);
        } else {
          const playerB = document.getElementById(`playersB${index}`);
          if (playerB) selectedPlayers.add(playerB.value);
        }
      }

      // Update options for all dropdowns in the team
      const dropdowns =
        team === 'A'
          ? [
              document.getElementById(`playersA1_${index}`),
              document.getElementById(`playersA2_${index}`),
            ]
          : [
              document.getElementById(`playersB1_${index}`),
              document.getElementById(`playersB2_${index}`),
            ];

      dropdowns.forEach((dropdown) => {
        if (dropdown) {
          Array.from(dropdown.options).forEach((option) => {
            if (selectedPlayers.has(option.value)) {
              option.disabled = true;
            } else {
              option.disabled = false;
            }
          });
        }
      });
    };

    // Add event listeners to update dropdowns on change
    if (type === 'D1' || type === 'D2') {
      const playerA1 = document.getElementById(`playersA1_${index}`);
      const playerA2 = document.getElementById(`playersA2_${index}`);
      const playerB1 = document.getElementById(`playersB1_${index}`);
      const playerB2 = document.getElementById(`playersB2_${index}`);

      if (playerA1) {
        playerA1.addEventListener('change', () =>
          updateDropdownOptions(index, 'A'),
        );
      }
      if (playerA2) {
        playerA2.addEventListener('change', () =>
          updateDropdownOptions(index, 'A'),
        );
      }
      if (playerB1) {
        playerB1.addEventListener('change', () =>
          updateDropdownOptions(index, 'B'),
        );
      }
      if (playerB2) {
        playerB2.addEventListener('change', () =>
          updateDropdownOptions(index, 'B'),
        );
      }
    }

    teamASelect.addEventListener('change', () => {
      if (type === 'D1' || type === 'D2') {
        if (teamASelect.value) {
          updatePlayers(teamASelect.value, `playersA1_${index}`);
          updatePlayers(teamASelect.value, `playersA2_${index}`);
        } else {
          document.getElementById(`playersA1_${index}`).innerHTML = '';
          document.getElementById(`playersA2_${index}`).innerHTML = '';
        }
      } else {
        if (teamASelect.value) {
          updatePlayers(teamASelect.value, `playersA${index}`);
        } else {
          document.getElementById(`playersA${index}`).innerHTML = '';
        }
      }
    });

    teamBSelect.addEventListener('change', () => {
      if (type === 'D1' || type === 'D2') {
        if (teamBSelect.value) {
          updatePlayers(teamBSelect.value, `playersB1_${index}`);
          updatePlayers(teamBSelect.value, `playersB2_${index}`);
        } else {
          document.getElementById(`playersB1_${index}`).innerHTML = '';
          document.getElementById(`playersB2_${index}`).innerHTML = '';
        }
      } else {
        if (teamBSelect.value) {
          updatePlayers(teamBSelect.value, `playersB${index}`);
        } else {
          document.getElementById(`playersB${index}`).innerHTML = '';
        }
      }
    });
  });

  // 男女選手データを切り替えるための関数
  const updateParticipants = (gender) => {
    currentGender = gender;
    const participantsData =
      gender === 'girls' ? participants.girls : participants.boys;

    // チームセレクトボックスを更新
    teamASelect.innerHTML = '';
    teamBSelect.innerHTML = '';
    addDefaultOption(teamASelect);
    addDefaultOption(teamBSelect);

    participantsData.forEach((team) => {
      const optionA = document.createElement('option');
      optionA.value = team.teamId;
      optionA.textContent = team.name[0];
      teamASelect.appendChild(optionA);

      const optionB = document.createElement('option');
      optionB.value = team.teamId;
      optionB.textContent = team.name[0];
      teamBSelect.appendChild(optionB);
    });

    // 各試合詳細の選手ドロップダウンも再初期化
    matchTypes.forEach((type, index) => {
      if (type === 'D1' || type === 'D2') {
        updatePlayers(teamASelect.value, `playersA1_${index}`);
        updatePlayers(teamASelect.value, `playersA2_${index}`);
        updatePlayers(teamBSelect.value, `playersB1_${index}`);
        updatePlayers(teamBSelect.value, `playersB2_${index}`);
      } else {
        updatePlayers(teamASelect.value, `playersA${index}`);
        updatePlayers(teamBSelect.value, `playersB${index}`);
      }
    });
    // 選手ドロップダウンのイベントリスナーも再設定
    initializePlayerDropdowns();
  };

  // ページ読み込み時に男子チームを表示
  document.addEventListener('DOMContentLoaded', () => {
    updateParticipants('boys');
  });

  // 男女切り替えボタンを追加
  const genderSwitchContainer = document.createElement('div');
  genderSwitchContainer.style.marginBottom = '10px'; // ボタン間の余白を追加
  genderSwitchContainer.innerHTML = `
    <button id="switchToBoys" type="button">男子</button>
    <button id="switchToGirls" type="button">女子</button>
  `;
  form.insertBefore(genderSwitchContainer, form.firstChild);

  // ボタンのイベントリスナーを追加
  document.getElementById('switchToBoys').addEventListener('click', () => {
    updateParticipants('boys');
  });

  document.getElementById('switchToGirls').addEventListener('click', () => {
    updateParticipants('girls');
  });

  // 選択済みの選手を追跡するためのセット
  const selectedPlayers = new Set();

  // 全試合のドロップダウンを更新する関数
  const updateAllDropdowns = () => {
    const allDropdowns = document.querySelectorAll('select[id^="players"]');
    allDropdowns.forEach((dropdown) => {
      const currentValue = dropdown.value;
      Array.from(dropdown.options).forEach((option) => {
        if (
          selectedPlayers.has(option.value) &&
          option.value !== currentValue
        ) {
          option.disabled = true;
        } else {
          option.disabled = false;
        }
      });
    });
  };

  // 選手が選択された際にセットを更新し、全ドロップダウンを更新
  const handlePlayerSelection = (event) => {
    const dropdown = event.target;
    const previousValue = dropdown.getAttribute('data-previous-value');
    const newValue = dropdown.value;

    if (previousValue) {
      selectedPlayers.delete(previousValue);
    }
    if (newValue) {
      selectedPlayers.add(newValue);
    }

    dropdown.setAttribute('data-previous-value', newValue);
    updateAllDropdowns();
  };

  // 全ての選手ドロップダウンにイベントリスナーを追加
  const addDefaultOption = (dropdown) => {
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '未選択';
    defaultOption.selected = true;
    defaultOption.disabled = true;
    dropdown.insertBefore(defaultOption, dropdown.firstChild);
  };

  const initializePlayerDropdowns = () => {
    const allDropdowns = document.querySelectorAll('select[id^="players"]');
    allDropdowns.forEach((dropdown) => {
      addDefaultOption(dropdown);
      dropdown.setAttribute('data-previous-value', dropdown.value);
      dropdown.addEventListener('change', handlePlayerSelection);
    });
  };

  // 初期化時に呼び出し
  initializePlayerDropdowns();

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const teamAId = formData.get('teamA');
    const teamBId = formData.get('teamB');

    const json = {
      id: parseInt(formData.get('matchId')),
      date: formData.get('matchDate'),
      status: formData.get('status'),
      teamA: teamAId,
      teamB: teamBId,
      winner: '', // 初期値を空に設定
      scoreA: parseInt(document.getElementById('scoreA').value, 10),
      scoreB: parseInt(document.getElementById('scoreB').value, 10),
      matches: matchTypes.map((type, index) => {
        const scoreA = parseInt(
          document.getElementById(`scoreA${index}`).value,
          10,
        );
        const scoreB = parseInt(
          document.getElementById(`scoreB${index}`).value,
          10,
        );

        let playersA = [];
        let playersB = [];

        if (type === 'D1' || type === 'D2') {
          const playerA1 = document.getElementById(`playersA1_${index}`);
          const playerA2 = document.getElementById(`playersA2_${index}`);
          const playerB1 = document.getElementById(`playersB1_${index}`);
          const playerB2 = document.getElementById(`playersB2_${index}`);

          if (playerA1 && playerA2) {
            playersA = [
              parseInt(playerA1.value, 10),
              parseInt(playerA2.value, 10),
            ];
          }
          if (playerB1 && playerB2) {
            playersB = [
              parseInt(playerB1.value, 10),
              parseInt(playerB2.value, 10),
            ];
          }
        } else {
          const playerA = document.getElementById(`playersA${index}`);
          const playerB = document.getElementById(`playersB${index}`);

          if (playerA) {
            playersA = Array.from(playerA.selectedOptions).map((option) =>
              parseInt(option.value, 10),
            );
          }
          if (playerB) {
            playersB = Array.from(playerB.selectedOptions).map((option) =>
              parseInt(option.value, 10),
            );
          }
        }

        return {
          type,
          winner: document.getElementById(`winner${index}`).value,
          scoreA,
          scoreB,
          playersA,
          playersB,
        };
      }),
    };

    // チームAとチームBの勝利数を計算
    let teamAWins = 0;
    let teamBWins = 0;

    json.matches.forEach((match) => {
      if (match.winner === 'A') {
        teamAWins += 1;
      } else if (match.winner === 'B') {
        teamBWins += 1;
      }
    });

    // チームスコアを自動入力
    const scoreAField = document.getElementById('scoreA');
    const scoreBField = document.getElementById('scoreB');
    scoreAField.removeAttribute('readonly'); // 一時的にreadonlyを解除
    scoreBField.removeAttribute('readonly');
    scoreAField.value = teamAWins;
    scoreBField.value = teamBWins;
    scoreAField.setAttribute('readonly', true); // 再度readonlyを設定
    scoreBField.setAttribute('readonly', true);

    // 勝者をteamIdで自動設定
    const winnerField = document.getElementById('winner');
    if (teamAWins > teamBWins) {
      winnerField.value = teamAId;
    } else if (teamBWins > teamAWins) {
      winnerField.value = teamBId;
    } else {
      winnerField.value = ''; // 引き分けの場合は空にする
    }

    json.winner = winnerField.value; // JSONにも反映

    output.textContent = JSON.stringify(json, null, 2);
  });
});
