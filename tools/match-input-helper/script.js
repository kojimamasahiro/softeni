(() => {
  const playersContainer = document.getElementById('playersContainer');
  const addPlayerBtn = document.getElementById('addPlayerBtn');
  const loadJsonBtn = document.getElementById('loadJsonBtn');
  const generateBtn = document.getElementById('generateBtn');
  const output = document.getElementById('output');
  const playerList = document.getElementById('playerList');
  const byeCheckbox = document.getElementById('byeCheckbox');

  let jsonArray = [];

  const PRIORITY_LASTNAMES = [
    '佐々木',
    '鍜冶田',
    '小佐野',
    '五十畑',
    '新行内',
    '小野寺',
    '日下部',
    '小見山',
    '瀬古沢',
    '小野川',
    '日野原',
    '大久保',
    '大多和',
  ];

  // ---- helpers: 空白/数字/カッコ除去・チーム候補抽出・比較用正規化 ----
  function removeDigitsSpacesParens(s) {
    // 半角/全角の数字・スペース・カッコを全て除去
    return s.replace(/[0-9０-９()\uFF08\uFF09\s\u3000]/g, '');
  }

  function compact(s) {
    // 空白（半角/全角）を除去
    return (s || '').replace(/[\s\u3000]/g, '');
  }

  function extractParenContent(raw) {
    // 最初に出てくるカッコ内テキストを抽出（（…）/ (...) 両方対応）
    const m = raw.match(/[（(]([^（）()]+)[）)]/);
    return m ? m[1] : null;
  }

  function findTeamFromOutputByCompact(compactTeam) {
    if (!compactTeam) return null;

    // 1) teamPrefectureMap から正規化一致を探す
    if (typeof teamPrefectureMap !== 'undefined') {
      for (const teamName of Object.keys(teamPrefectureMap)) {
        if (compact(teamName) === compactTeam)
          return { team: teamName, prefecture: teamPrefectureMap[teamName] };
      }
    }

    // 2) output.value の既存JSONから探す
    try {
      const parsed = JSON.parse(document.getElementById('output').value);
      if (Array.isArray(parsed)) {
        for (const pair of parsed) {
          for (const player of pair.information || []) {
            if (player.team && compact(player.team) === compactTeam) {
              return {
                team: player.team,
                prefecture: player.prefecture || null,
              };
            }
          }
        }
      }
    } catch {
      // パース失敗は無視
    }
    return null;
  }

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
    labelPlayer.innerHTML = `選手情報（playerId）：`;
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
      const raw = lastNameInput.value;
      if (!raw.trim()) return;

      // 0) カッコ内からチーム候補を先に拾う（空白を除去して比較）
      const paren = extractParenContent(raw); // 例: " 石川工業 高等 専門 学校 "
      const parenCompact = compact(paren); // 例: "石川工業高等専門学校"
      let detectedTeam = null;
      let detectedPref = null;

      if (parenCompact) {
        const hit = findTeamFromOutputByCompact(parenCompact);
        if (hit) {
          detectedTeam = hit.team;
          detectedPref = hit.prefecture || null;
        }
      }

      // 1) 数字・空白・カッコを削除した文字列を作る（姓名専用）
      const cleaned = removeDigitsSpacesParens(raw); // 例: "御手洗友哉石川工業高等専門学校"
      if (!cleaned) return;

      // 2) 既存の「出力JSONと辞書」からチーム一覧/都道府県一覧を取得（後方一致検出用）
      let teamNames = [];
      let prefectureNames = [];
      try {
        const outputParsed = JSON.parse(
          document.getElementById('output').value,
        );
        if (Array.isArray(outputParsed)) {
          for (const pair of outputParsed) {
            for (const player of pair.information || []) {
              if (player.team && !teamNames.includes(player.team))
                teamNames.push(player.team);
              if (
                player.prefecture &&
                !prefectureNames.includes(player.prefecture)
              )
                prefectureNames.push(player.prefecture);
            }
          }
        }
      } catch {
        /* noop */
      }
      if (typeof teamPrefectureMap !== 'undefined') {
        for (const t of Object.keys(teamPrefectureMap))
          if (!teamNames.includes(t)) teamNames.push(t);
        for (const p of new Set(Object.values(teamPrefectureMap)))
          if (!prefectureNames.includes(p)) prefectureNames.push(p);
      }

      // 3) cleaned から、まず後方に付いている「チーム名/都道府県名」を剥がす（空白なし比較）
      let rest = cleaned;
      // （優先的にカッコから見つかったチームを使う）
      if (detectedTeam) {
        teamInput.value = detectedTeam;
        if (detectedPref && !prefectureInput.value) {
          prefectureInput.value = detectedPref;
        } else if (
          !prefectureInput.value &&
          typeof teamPrefectureMap !== 'undefined'
        ) {
          const pref = teamPrefectureMap[detectedTeam];
          if (pref) prefectureInput.value = pref;
        }
        // cleaned 末尾に team が含まれていたら削る（空白無し比較）
        const teamComp = compact(detectedTeam);
        if (rest.endsWith(teamComp))
          rest = rest.slice(0, rest.length - teamComp.length);
      } else {
        // カッコから見つからない場合は後方一致で検出
        for (const t of teamNames) {
          const tc = compact(t);
          if (tc && rest.endsWith(tc)) {
            teamInput.value = t;
            rest = rest.slice(0, rest.length - tc.length);
            if (
              !prefectureInput.value &&
              typeof teamPrefectureMap !== 'undefined' &&
              teamPrefectureMap[t]
            ) {
              prefectureInput.value = teamPrefectureMap[t];
            }
            break;
          }
        }
        for (const p of prefectureNames) {
          const pc = compact(p);
          if (pc && rest.endsWith(pc)) {
            if (!prefectureInput.value) prefectureInput.value = p;
            rest = rest.slice(0, rest.length - pc.length);
            break;
          }
        }
      }

      // 4) 残り（rest）を姓・名に分割
      // 既存の優先姓ルール
      if (!firstNameInput.value.trim()) {
        const joinedName = rest; // すでに空白/数字/カッコ除去済み
        (function applyPriorityLastName() {
          if (!joinedName) return;
          const sorted = [...PRIORITY_LASTNAMES].sort(
            (a, b) => b.length - a.length,
          );
          for (const ln of sorted) {
            if (joinedName.startsWith(ln)) {
              lastNameInput.value = ln;
              firstNameInput.value = joinedName.slice(ln.length);
              return;
            }
          }
        })();

        // 優先姓で埋まらなければ通常分割
        if (!firstNameInput.value.trim()) {
          const nameLen = joinedName.length;
          const splitRules = { 2: 1, 3: 2, 4: 2, 5: 2, 6: 3 };
          const k = splitRules[nameLen] || 2;
          lastNameInput.value = joinedName.slice(0, k);
          firstNameInput.value = joinedName.slice(k);
        }
      }

      // 5) チームが空なら、ここで team にフォーカス（前回のご要望）
      if (!teamInput.value.trim()) {
        teamInput.focus();
      } else {
        // チームも埋まっている場合は、prefecture へ or 次の lastName へ好みで
        // ここでは team が埋まっていたら prefecture が空なら prefecture に、両方埋まってたら何もしない
        if (!prefectureInput.value.trim()) {
          prefectureInput.focus();
        }
      }
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
    let allBlank = true;

    for (const div of playerDivs) {
      const lastName = div.querySelector('.lastName').value.trim();
      const firstName = div.querySelector('.firstName').value.trim();
      const team = div.querySelector('.team').value.trim();
      const prefecture = div.querySelector('.prefecture').value.trim();
      const playerIdInput = div.querySelector('.playerInput').value.trim();
      const playerId = playerIdInput || null;
      const hasAny = lastName || firstName || playerId;

      if (hasAny) {
        allBlank = false;
        const tempId = [lastName, firstName, team].filter(Boolean).join('_');
        players.push({
          lastName,
          firstName,
          team,
          prefecture,
          playerId,
          tempId,
        });

        if (team) {
          teamSet.add(team);
        }
      }

      if (allBlank) {
        // 団体戦モードでチームのみ出力
        const team = playerDivs[0].querySelector('.team').value.trim();
        const prefecture = playerDivs[0]
          .querySelector('.prefecture')
          .value.trim();
        if (!team && !prefecture) {
          alert('チーム名と都道府県名は必須です（団体戦モード）');
          return;
        }

        const obj = {
          id: outputId++,
          name: team
            ? `${team}${prefecture ? `（${prefecture}）` : ''}`
            : `${prefecture}`,
          team: team || undefined,
          prefecture: prefecture || undefined,
          category: team ? 'team' : 'prefecture',
          tempId: team
            ? `${team}_${prefecture}`
            : `${prefecture}_${prefecture}`,
        };

        jsonArray.push(obj);
        idInput.value = outputId;
        output.value =
          '[\n' + jsonArray.map((o) => JSON.stringify(o)).join(',\n') + '\n]';

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
        document
          .querySelectorAll('.team')
          .forEach((input) => (input.value = ''));
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
        return;
      }
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

    // 選手人数に応じて category を付加
    let allTeamBlank = players.every((p) => !p.team);
    let allPrefectureSet = players.every((p) => !!p.prefecture);

    if (allTeamBlank && allPrefectureSet) {
      obj.category = 'prefecture';
    } else if (players.length === 1) {
      obj.category = 'singles';
    } else if (players.length === 2) {
      obj.category = 'doubles';
    } else if (players.length >= 3) {
      obj.category = 'team';
    }

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

  // Enterキーで「JSON生成・追加」ボタンと同じ処理を実行し、1人目の姓にカーソルを戻す
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // デフォルト動作（送信や改行）を防ぐ
      generateBtn.click(); // JSON生成ボタンの処理を呼ぶ

      // 最初の lastName 入力欄にフォーカスを移動
      const firstLastName = document.querySelector('.player-group .lastName');
      if (firstLastName) {
        firstLastName.focus();
      }
    }
  });
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

function focusNextLastName(fromContainer) {
  const groups = Array.from(document.querySelectorAll('.player-group'));
  const idx = groups.indexOf(fromContainer);

  let targetGroup;

  if (idx >= 0 && idx + 1 < groups.length) {
    // 既に次の選手が存在する場合だけフォーカス移動
    targetGroup = groups[idx + 1];
  } else if (groups.length > 1) {
    // 末尾だけど、2人以上いるときは新規追加してそこに移動
    addPlayerBtn.click();
    const newGroups = document.querySelectorAll('.player-group');
    targetGroup = newGroups[newGroups.length - 1];
  } else {
    // 選手が1人しかいない場合 → 何もしない
    return;
  }

  const nextLast = targetGroup.querySelector('.lastName');
  if (nextLast) {
    nextLast.focus();
    nextLast.select();
  }
}

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

  teamInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && teamInput.value.trim()) {
      e.preventDefault();
      focusNextLastName(container);
    }
  });

  teamInput.addEventListener('change', () => {
    if (teamInput.value.trim()) {
      focusNextLastName(container);
    }
  });
}
