// チーム名マージレビューのローカルサーバ。
// レビュー画面を配信し、「確認済を反映」ボタンの送信を受けて
// team-name-aliases.json へ取り込み＋チームマスタ再生成までを自動実行する。
//
// 使い方:
//   node scripts/team-review-server.mjs
//   → 表示された http://localhost:5173 をブラウザで開く
//   → レビューして「確認済を反映」を押すと、その場で alias 反映＆マスタ再生成
//
// 注: 反映は確認済クラスタのみ。候補一覧(merge-candidates)は会話中は作り直さない
//     （番号がずれるため）。セッション終了後に再生成してください。
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { applyAdditions } from './apply-team-aliases.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(ROOT, 'data', 'teams', 'team-merge-review.html');
const MASTER = path.join(ROOT, 'scripts', 'build-team-master.mjs');
const PORT = process.env.PORT || 5173;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/index'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(HTML));
    return;
  }
  if (req.method === 'POST' && req.url === '/apply') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const additions = JSON.parse(body || '[]');
        const result = applyAdditions(additions);
        execFileSync('node', [MASTER], { stdio: 'ignore' }); // マスタ再生成
        console.log(`[apply] 適用 ${result.applied.length} / スキップ ${result.skipped.length} / 競合 ${result.conflicts.length}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => {
  console.log(`チームマージレビュー: http://localhost:${PORT}`);
  console.log('ブラウザで開いてレビュー→「確認済を反映」で自動取り込み。Ctrl+C で終了。');
});
