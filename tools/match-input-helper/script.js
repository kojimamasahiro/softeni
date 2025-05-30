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
            [pid, p.lastName, p.firstName, p.team].forEach(val => {
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
        div.innerHTML = `
        <label>選手情報（playerId / 姓 / 名 / チーム名から補完可能）：
        <input list="playerList" class="playerInput" autocomplete="off" />
        </label>
        <label>姓 (lastName)：<input type="text" class="lastName" /></label>
        <label>名 (firstName)：<input type="text" class="firstName" /></label>
        <label>チーム名 (team)：<input type="text" class="team" /></label>
        <button class="clearPlayerBtn" type="button">この選手情報をクリア</button>
        <button class="removePlayerBtn" type="button">この選手を削除</button>
    `;
        setupSpaceRemoval(div);
        div.querySelector('.removePlayerBtn').addEventListener('click', () => {
            playersContainer.removeChild(div);
        });

        // クリアボタンのイベント
        div.querySelector('.clearPlayerBtn').addEventListener('click', () => {
            div.querySelector('.playerInput').value = '';
            div.querySelector('.lastName').value = '';
            div.querySelector('.firstName').value = '';
            div.querySelector('.team').value = '';
        });
        setupAutoFill(div.querySelector('.playerInput'));
        setupNameSplit(div);
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

    lastNameInput.addEventListener('input', () => {
        const original = lastNameInput.value;

        // 不要文字除去（漢字＋々以外を削除）
        const cleaned = original.replace(/[^一-龯々ヶヵッゝゞ]/g, '');

        // 既にfirstNameがあれば処理しない
        if (firstNameInput.value.trim()) return;

        // 漢字＋々で2〜6文字のときのみ処理
        if (!/^[一-龯々]{2,6}$/.test(cleaned)) return;

        // スペース評価のため、漢字だけの部分を抽出して前後を無視
        const isSkippable = (char) => /[A-Za-zＡ-Ｚａ-ｚ0-9０-９\s　!-~！-～]/.test(char);

        let firstValidIndex = -1;
        let lastValidIndex = -1;

        for (let i = 0; i < original.length; i++) {
            if (!isSkippable(original[i])) {
                if (firstValidIndex === -1) firstValidIndex = i;
                lastValidIndex = i;
            }
        }

        const spaceIndices = [];
        if (firstValidIndex !== -1 && lastValidIndex !== -1) {
            for (let i = firstValidIndex; i <= lastValidIndex; i++) {
                if (original[i] === ' ' || original[i] === '　') {
                    spaceIndices.push(i - firstValidIndex);
                }
            }
        }

        const splitRules = { 2: 1, 3: 2, 4: 2, 5: 2, 6: 3 };
        let newLastName = '';
        let newFirstName = '';

        if (spaceIndices.length === 0) {
            // スペースなし → 文字数ルールで分割
            const k = splitRules[cleaned.length];
            newLastName = cleaned.slice(0, k);
            newFirstName = cleaned.slice(k);
        } else {
            const segments = original
                .split(/[\s　]+/)
                .map(s => s.replace(/[^一-龯々ヶヵッゝゞ]/g, ''))
                .filter(p => p.length > 0);

            const allSameLength = segments.every(s => s.length === segments[0].length);

            if (allSameLength) {
                const joined = segments.join('');
                const k = splitRules[joined.length];
                newLastName = joined.slice(0, k);
                newFirstName = joined.slice(k);
            } else {
                if (segments.length >= 3 && segments[0].length === 1 && segments[1].length === 1) {
                    newLastName = segments[0] + segments[1];
                    newFirstName = segments.slice(2).join('');
                } else if (segments.length >= 3 && segments[0].length === 2 && segments[1].length === 1) {
                    newLastName = segments[0] + segments[1];
                    newFirstName = segments.slice(2).join('');
                } else {
                    newLastName = segments[0];
                    newFirstName = segments.slice(1).join('');
                }
            }
        }

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
            const playerIdInput = div.querySelector('.playerInput').value.trim();
            const playerId = playerIdInput || null;
            const tempId = lastName + "_" + firstName + "_" + team;

            if (!lastName) {
                alert('姓は必須です');
                return;
            }

            if (team) {
                teamSet.add(team);
            }

            players.push({ lastName, firstName, team, playerId, tempId });
        }

        let representativeTeam = '';
        if (teamSet.size === 1) {
            representativeTeam = [...teamSet][0];
            for (const player of players) {
                player.team = player.team || representativeTeam;
                player.tempId = player.firstName + "_" + player.lastName + "_" + representativeTeam;
            }
        } else if (teamSet.size === 0) {
            representativeTeam = '';
        } else {
            representativeTeam = '混合';
        }

        const name = players.map(p => p.lastName).join('・') + (representativeTeam ? `（${representativeTeam}）` : '');

        const obj = {
            id: outputId++,
            name,
            information: players
        };

        jsonArray.push(obj);

        idInput.value = outputId;

        const compressedWithBreaks = '[\n' + jsonArray.map(o => JSON.stringify(o)).join(',\n') + '\n]';
        output.value = compressedWithBreaks;

        // 入力欄をリセット
        document.querySelectorAll('.playerInput').forEach(input => input.value = '');
        document.querySelectorAll('.lastName').forEach(input => input.value = '');
        document.querySelectorAll('.firstName').forEach(input => input.value = '');
        document.querySelectorAll('.team').forEach(input => input.value = '');

        if (byeCheckbox.checked) {
            const byeObj = {
                id: "bye",
                name: "1回戦免除",
                information: []
            };
            jsonArray.push(byeObj);
            const compressedWithBreaks = '[\n' + jsonArray.map(o => JSON.stringify(o)).join(',\n') + '\n]';
            output.value = compressedWithBreaks;
        }
    });

    const addByeBtn = document.getElementById('addByeBtn');

    addByeBtn.addEventListener('click', () => {
        const byeObj = {
            id: "bye",
            name: "1回戦免除",
            information: []
        };

        jsonArray.push(byeObj);

        // 出力を更新（配列ごとに改行の圧縮表示の例）
        const compressedWithBreaks = '[\n' + jsonArray.map(o => JSON.stringify(o)).join(',\n') + '\n]';
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
    navigator.clipboard.writeText(text)
        .then(() => {
            alert('JSONをクリップボードにコピーしました');
        })
        .catch(err => {
            alert('コピーに失敗しました: ' + err);
        });
});

// スペース・カッコ・数字を削除する関数
function removeUnwantedChars(event) {
    event.target.value = event.target.value.replace(/[\s0-9()（）]/g, '');
}

// 指定したコンテナ内の全対象 input にイベントを設定
function setupSpaceRemoval(container) {
    const inputs = container.querySelectorAll('input.firstName, input.team');
    inputs.forEach(input => {
        input.addEventListener('input', removeUnwantedChars);
    });
}
