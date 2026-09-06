// チーム名マージレビューのローカルサーバ。
// レビュー画面を配信し、「確認済を反映」ボタンの送信を受けて
// team-name-aliases.json へ取り込み＋チームマスタ再生成までを自動実行する。
//
// 使い方:
//   node scripts/team-review-server.mjs
//   → 表示された http://localhost:5173 をブラウザで開く
//   → レビューして「確認済を反映」を押すと、その場で alias 反映＆マスタ再生成
//
// 注: 反映は確認済クラスタのみ。
//
// 2026-09-06: 判断台帳(data/teams/review-decisions.json)への保存を追加した。
// それまで判断はブラウザの localStorage にしか無く、しかも配列インデックスで持っていたため
// 「候補一覧(merge-candidates)は会話中は作り直さない（番号がずれるため）」という制約があった。
// 台帳はメンバーの team id でクラスタを識別するので、**候補をいつ作り直してもよい**。
// あわせて「統合しない」という否定の判断も残す（機械の自動OK判定の誤り率を測る素になる）。
// 経緯: docs/raw/2026-09-06-idea-autonomous-improvement-agent.md
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

import { applyAdditions } from './apply-team-aliases.mjs';
import { clusterKey, readLedger, recordDecision, summarize, writeLedger } from './lib/review-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(ROOT, 'data', 'teams', 'team-merge-review.html');
const MASTER = path.join(ROOT, 'scripts', 'build-team-master.mjs');
const CANDIDATES = path.join(ROOT, 'scripts', 'build-team-merge-candidates.mjs');
const REVIEW_HTML = path.join(ROOT, 'scripts', 'build-team-review-html.mjs');
const PORT = process.env.PORT || 5173;

/** レビュー画面から届いた判断を台帳へ記録する。 */
function saveDecisions(decisions) {
  const ledger = readLedger();
  const at = new Date().toISOString();
  for (const d of decisions || []) {
    if (!d || !d.key) continue;
    recordDecision(ledger, { ...d, decidedAt: d.decidedAt || at });
  }
  writeLedger(ledger);
  return summarize(ledger);
}

/** 作り直した後の候補件数と、そのうち未判断の件数を数える。画面に出して再読み込みを促す。 */
function countRemaining() {
  try {
    const clusters = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams', 'merge-candidates.json'), 'utf8'));
    const ledger = readLedger();
    const keys = new Set(Object.keys(ledger.decisions));
    const done = clusters.filter((c) => keys.has(clusterKey(c.members))).length;
    return { clusters: clusters.length, done, todo: clusters.length - done };
  } catch {
    return null;
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/index'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(HTML));
    return;
  }
  if (req.method === 'POST' && (req.url === '/apply' || req.url === '/decisions')) {
    const onlyDecisions = req.url === '/decisions';
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        // 旧形式（additions の配列そのもの）も受ける。
        const additions = Array.isArray(parsed) ? parsed : parsed.additions || [];
        const decisions = Array.isArray(parsed) ? [] : parsed.decisions || [];
        const ledger = saveDecisions(decisions);
        if (onlyDecisions) {
          console.log(`[decisions] 台帳 ${ledger.total}件（人 ${ledger.human}・統合 ${ledger.merge}・別チーム ${ledger.separate}）`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ledger }));
          return;
        }
        const result = applyAdditions(additions);
        // マスタ→候補→レビュー画面の順に作り直す。
        // マスタだけ作り直すと、build-team-master.mjs が `const id = teams.length + 1` と
        // 位置でIDを振るせいで merge-candidates.json の旧IDが別チームを指すようになり、
        // レビュー画面の文脈（選手名・年・出場大会）が**別チームのもの**になる
        // （2026-09-06 実測: 819メンバー中707がずれた）。候補まで作り直せば揃う。
        // 判断台帳はチーム名キーなので、候補を作り直しても判断は失われない。
        execFileSync('node', [MASTER], { stdio: 'ignore' });
        execFileSync('node', [CANDIDATES], { stdio: 'ignore' });
        execFileSync('node', [REVIEW_HTML], { stdio: 'ignore' });
        console.log(
          `[apply] 適用 ${result.applied.length} / スキップ ${result.skipped.length} / 競合 ${result.conflicts.length}` +
            ` / 台帳 ${ledger.total}件（人 ${ledger.human}・統合 ${ledger.merge}・別チーム ${ledger.separate}` +
            `・自動OKを人が覆した ${ledger.autoOKOverturned}）`,
        );
        const remaining = countRemaining();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...result, ledger, remaining }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

// 既に起動している場合は、生のスタックトレースではなく対処を出す。
// レビューは同じサーバを開いたまま何度も回すので、二重起動は普通に起きる。
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ポート ${PORT} は既に使われている。レビューサーバが既に起動している可能性が高い。`);
    console.error('');
    console.error('  そのまま使う場合   : ブラウザで http://localhost:' + PORT + ' を開く');
    console.error('  （コードを変えたなら古いサーバは新しい実装を読んでいないので、止めて起動し直すこと）');
    console.error('');
    console.error('  止めて起動し直す場合:');
    console.error(`    kill $(lsof -nP -iTCP:${PORT} -sTCP:LISTEN -t)`);
    console.error('    npm run team:review');
    console.error('');
    console.error(`  別のポートで動かす場合: PORT=5174 npm run team:review`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`チームマージレビュー: http://localhost:${PORT}`);
  console.log('ブラウザで開いてレビュー→「確認済を反映」で自動取り込み。Ctrl+C で終了。');
});
