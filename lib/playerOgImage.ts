// lib/playerOgImage.ts
// 選手結果ページの OGP 画像（全国大会優勝者の成績カード）の所在を引く。
//
// 画像は `tools/sns-images/player_og.py` がローカル生成して `public/og/players/` に PNG をコミットする
// （本番ビルドに画像生成の依存を増やさない。lib/tournamentOgImage.ts と同じ方針）。ここは索引を読むだけ。

import fs from 'fs';
import path from 'path';

/** 選手 id → `/og/players/<id>-<hash>.png` */
type OgIndex = Record<string, string>;

let cache: OgIndex | null = null;

function load(): OgIndex {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'players', 'og-images.json'), 'utf8')) as OgIndex;
  } catch {
    // 索引が無い環境でもビルドは通す（既定の OGP 画像にフォールバックする）
    cache = {};
  }
  return cache;
}

/** この選手の OGP 画像パス（サイトルートからの絶対パス）。無ければ null。 */
export function getPlayerOgImage(playerId: string | number): string | null {
  return load()[String(playerId)] ?? null;
}
