// lib/tournamentInsight.ts
// 大会インサイト（LLMが執筆した読み物）の読み込み。
//
// ADR-012: サイト本文でのLLM利用を「機械照合を通ったものに限り可」として解禁した。
// ADR-005 は「本文はテンプレートのみ・LLM不使用」だったが、その前提は
// 「LLMの捏造を機械的に検出できない」ことだった。scripts/verify-story-text.mjs が
// その前提を崩したため、検証済みであることを公開条件にして解禁している。
//
// 保存先: data/tournament-insights/<tournamentId>/<year>/<categoryId>.json
// 生成手順: docs/story-yaml/PROMPT.md（YAML生成 -> LLM執筆 -> 機械照合 -> 人のレビュー）

import fs from 'fs';
import path from 'path';

/**
 * 公開状態。既存の news レコード（draft -> review -> published）と同じ語彙に揃える。
 * published 以外はビルド対象にしない。
 */
export type InsightState = 'draft' | 'review' | 'published';

export type TournamentInsight = {
  tournamentId: string;
  year: number;
  categoryId: string;
  state: InsightState;
  /** 本文。段落ごとの配列（改行の扱いを描画側に委ねない） */
  paragraphs: string[];
  /** 執筆の根拠にした story の id。docs/story-yaml/*.yaml の id と対応する */
  usedStoryIds: string[];
  /** 掲載範囲の注記。全ストーリー共通なので本文末に1回だけ出す */
  scopeNote: string;
  /** どのモデルに書かせたか（人が書いた場合は 'human'） */
  writtenBy: string;
  /**
   * scripts/verify-story-text.mjs を通した日付（YYYY-MM-DD）。
   * published なのにこれが無い、または本文が変わっているものはビルドで弾く。
   */
  verifiedAt: string | null;
};

const INSIGHTS_DIR = path.join(process.cwd(), 'data', 'tournament-insights');

function insightPath(tournamentId: string, year: string | number, categoryId: string): string {
  return path.join(INSIGHTS_DIR, tournamentId, String(year), `${categoryId}.json`);
}

/**
 * 公開済みのインサイトを返す。draft/review、未検証、ファイル無しはすべて null。
 * 描画側は null を「セクションごと出さない」と解釈する。
 */
export function getPublishedInsight(tournamentId: string, year: string | number, categoryId: string): TournamentInsight | null {
  const file = insightPath(tournamentId, year, categoryId);
  if (!fs.existsSync(file)) return null;

  let insight: TournamentInsight;
  try {
    insight = JSON.parse(fs.readFileSync(file, 'utf8')) as TournamentInsight;
  } catch {
    return null;
  }

  if (insight.state !== 'published') return null;
  // 未検証の本文は出さない。ADR-012 の公開条件そのものなので、描画側で握りつぶさず
  // ここで落とす（表示箇所が増えても条件が分散しない）。
  if (!insight.verifiedAt) return null;
  if (!Array.isArray(insight.paragraphs) || insight.paragraphs.length === 0) return null;

  return insight;
}

/** 検証スクリプト・ビルドチェック用。state を問わず全件返す。 */
export function listAllInsights(): { file: string; insight: TournamentInsight }[] {
  if (!fs.existsSync(INSIGHTS_DIR)) return [];
  const out: { file: string; insight: TournamentInsight }[] = [];

  for (const tournamentId of fs.readdirSync(INSIGHTS_DIR)) {
    const tDir = path.join(INSIGHTS_DIR, tournamentId);
    if (!fs.statSync(tDir).isDirectory()) continue;
    for (const year of fs.readdirSync(tDir)) {
      const yDir = path.join(tDir, year);
      if (!fs.statSync(yDir).isDirectory()) continue;
      for (const f of fs.readdirSync(yDir)) {
        if (!f.endsWith('.json')) continue;
        const file = path.join(yDir, f);
        try {
          out.push({ file, insight: JSON.parse(fs.readFileSync(file, 'utf8')) as TournamentInsight });
        } catch {
          // 壊れたJSONはビルドチェック側で報告する
        }
      }
    }
  }
  return out;
}
