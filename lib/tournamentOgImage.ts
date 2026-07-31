// lib/tournamentOgImage.ts
// 大会の年度別結果ページに出す OGP 画像（ベスト8のトーナメント表）の所在を引く。
//
// 画像は `tools/sns-images/tournament_og.py` がローカル生成して `public/og/tournaments/` に
// PNG をコミットする（本番ビルドに画像生成の依存を増やさない。docs/raw/2026-06-22-news-ogp-image-design.md
// で決めた方針と同じ）。ここはビルド時に索引 JSON を読むだけ。
//
// 索引を details JSON ではなく別ファイルに置いているのは、details を matches の忠実な記録の
// ままにしておきたいため。画像の有無という表示都合の情報を混ぜない。

import fs from 'fs';
import path from 'path';

/** `<tournamentId>/<year>/<categoryId>` → `/og/tournaments/....png` */
type OgIndex = Record<string, string>;

let cache: OgIndex | null = null;

function load(): OgIndex {
  if (cache) return cache;
  try {
    const p = path.join(process.cwd(), 'data', 'tournaments', 'og-images.json');
    cache = JSON.parse(fs.readFileSync(p, 'utf8')) as OgIndex;
  } catch {
    // 索引がまだ生成されていない環境でもビルドは通す（既定の OGP 画像にフォールバックする）
    cache = {};
  }
  return cache;
}

/**
 * この大会・年度・種目の OGP 画像パス（サイトルートからの絶対パス）。無ければ null。
 * 決勝が未確定の大会には画像が無いので、呼び出し側は既定画像へフォールバックすること。
 */
export function getTournamentOgImage(tournamentId: string, year: string | number, categoryId: string): string | null {
  return load()[`${tournamentId}/${year}/${categoryId}`] ?? null;
}
