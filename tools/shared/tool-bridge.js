/* eslint-disable */
/*
  tool-bridge.js
  ハブページ(tools/index.html)と各ツール(roundrobin / tournament3)間の
  データ受け渡し・成形(normalize)・保存UIをまとめた共有モジュール。
  normalize-core.js を先に読み込むこと。
*/
const ToolBridge = (() => {
  const KEYS = {
    roundrobin: 'softeni.input.roundrobin',
    tournament: 'softeni.input.tournament',
    entriesMeta: 'softeni.entriesMeta',
    rrCarry: 'softeni.rrCarry',
    outputName: 'softeni.outputName',
  };

  function getJSON(key) {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      console.warn('ToolBridge: failed to read', key, e);
      return null;
    }
  }

  function setJSON(key, value) {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }

  // ---- 入力受け渡し ----
  function loadInput(kind) {
    return getJSON(KEYS[kind]);
  }
  function storeInput(kind, data) {
    setJSON(KEYS[kind], data);
  }

  // ---- entries メタ（任意） ----
  function getEntriesMeta() {
    return getJSON(KEYS.entriesMeta);
  }
  function setEntriesMeta(meta) {
    setJSON(KEYS.entriesMeta, meta);
  }

  // ---- ラウンドロビン結果の持ち越し（RR→トーナメント時にマージ） ----
  function getRRCarry() {
    return getJSON(KEYS.rrCarry);
  }
  function setRRCarry(carry) {
    setJSON(KEYS.rrCarry, carry);
  }
  function clearRRCarry() {
    localStorage.removeItem(KEYS.rrCarry);
  }

  // ---- 出力ファイル名 ----
  function getOutputName(fallback) {
    return localStorage.getItem(KEYS.outputName) || fallback || 'output.json';
  }
  function setOutputName(name) {
    if (name) localStorage.setItem(KEYS.outputName, name);
  }

  // ---- 成形（normalize） ----
  // raw: ツールが生成した生JSON（matches / results / roundRobinMatches / standings）
  // 戻り値: data/tournaments/details 用の最終JSON文字列
  function normalize(raw) {
    const outObj = NormalizeCore.normalizeResults(raw, getEntriesMeta());
    return NormalizeCore.serializeOutput(outObj);
  }

  // ---- 保存UI ----
  let dirHandle = null;

  async function chooseFolder() {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    return dirHandle;
  }

  async function saveToFolder(filename, text) {
    if (!dirHandle) await chooseFolder();
    const fh = await dirHandle.getFileHandle(filename, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copy(text) {
    await navigator.clipboard.writeText(text);
  }

  // containerEl に「ファイル名 / コピー / ダウンロード / フォルダへ保存」UIを生成する。
  // getText: 保存対象テキストを返す関数
  function buildSaveUI(containerEl, getText) {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0;';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = '例: doubles-none-girls.json';
    nameInput.value = getOutputName('');
    nameInput.style.cssText = 'width:260px;padding:4px;';
    nameInput.addEventListener('change', () => setOutputName(nameInput.value));

    const status = document.createElement('span');
    status.style.cssText = 'font-size:12px;color:#2e7d32;';
    const flash = (msg, isError) => {
      status.textContent = msg;
      status.style.color = isError ? '#c62828' : '#2e7d32';
      setTimeout(() => (status.textContent = ''), 4000);
    };

    const mkBtn = (label, handler) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', async () => {
        const text = getText();
        if (!text) return flash('出力がありません', true);
        try {
          await handler(text);
        } catch (e) {
          if (e && e.name === 'AbortError') return;
          flash('失敗: ' + (e && e.message ? e.message : e), true);
        }
      });
      return b;
    };

    const filename = () => (nameInput.value || 'output.json').trim();

    wrap.appendChild(document.createTextNode('ファイル名:'));
    wrap.appendChild(nameInput);
    wrap.appendChild(
      mkBtn('コピー', async (t) => {
        await copy(t);
        flash('コピーしました');
      }),
    );
    wrap.appendChild(
      mkBtn('ダウンロード', async (t) => {
        download(filename(), t);
        flash('ダウンロードしました');
      }),
    );
    wrap.appendChild(
      mkBtn('フォルダへ保存', async (t) => {
        await saveToFolder(filename(), t);
        flash(`保存しました → ${filename()}`);
      }),
    );
    const folderBtn = mkBtn('保存先フォルダ変更', async () => {
      await chooseFolder();
      flash('保存先を設定しました');
    });
    // フォルダ変更は出力が無くても押せるようにする
    folderBtn.onclick = async () => {
      try {
        await chooseFolder();
        flash('保存先を設定しました');
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        flash('失敗: ' + e.message, true);
      }
    };
    wrap.appendChild(folderBtn);
    wrap.appendChild(status);

    containerEl.appendChild(wrap);
    return { flash };
  }

  return {
    KEYS,
    loadInput,
    storeInput,
    getEntriesMeta,
    setEntriesMeta,
    getRRCarry,
    setRRCarry,
    clearRRCarry,
    getOutputName,
    setOutputName,
    normalize,
    buildSaveUI,
    download,
    copy,
  };
})();
if (typeof module === 'object' && module.exports) module.exports = ToolBridge;
