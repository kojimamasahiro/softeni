// lib/playerCareerAffiliations.ts
// 選手結果ページの「所属歴」を SEO メタデータ（description / JSON-LD）へ出すための整形。
//
// 背景（docs/raw/2026-09-09-idea-player-page-serp-competitiveness.md）:
// title / description は最新の所属しか持っておらず、index 対象 1,723 枚のうち 790 枚（45.9%）は
// 経歴に 2 つ以上の所属を持つ。世間がその選手を指すときの名前（実業団名・出身校）が
// 本文の「所属別成績」表にしか無く、メタデータ側では拾えていなかった。
//
// 効果の前提（Assumption・重要）: 過去の所属は既に本文へ出ているので、ここで足すのは
// 新しい literal ではなく「既にある語の重み付け」である。単独で圏外を覆す施策ではない。
// 代表所属を最新以外に差し替える案は 2026-09-09 にユーザー判断で不採用（最新のみで固定）。

import type { TeamRow } from '../src/types/playerStatistics';

/** 学校名の目印。略称（例「高田商」「文大杉並」）には付かないので、判定できるのは一部だけ。 */
const SCHOOL_MARKER = /(中学校|中等教育|高等学校|高校|大学|学園|学院|高専|中学)/;

/** 表記ゆれ（「サンワxエナジー」「サンワエナジークラブ」等）を同一視するための正規化。 */
function normalizeTeamName(team: string): string {
  return team.replace(/[\s　xX×・･\-‐−ー_（）()]/g, '');
}

/**
 * 所属歴を古い順に並べ、表記ゆれを畳んだ一覧を返す。
 * `currentTeam` を渡すと、それと同一視される所属を除く（title / displayName で既に出ているため）。
 */
export function careerAffiliations(byTeam: TeamRow[] | undefined, currentTeam?: string | null): string[] {
  if (!byTeam || byTeam.length === 0) return [];
  const sorted = [...byTeam].sort((a, b) => ((a.span.from ?? '') < (b.span.from ?? '') ? -1 : 1));
  const currentKey = currentTeam ? normalizeTeamName(currentTeam) : null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of sorted) {
    const team = (row.team ?? '').trim();
    if (!team) continue;
    const key = normalizeTeamName(team);
    if (!key || key === currentKey || seen.has(key)) continue;
    seen.add(key);
    out.push(team);
  }
  return out;
}

/** description 用の所属歴フレーズ。該当が無ければ null。 */
export function careerAffiliationsDescriptionPhrase(teams: string[]): string | null {
  if (teams.length === 0) return null;
  return `これまでの所属は${teams.join('・')}。`;
}

export interface AffiliationNode {
  '@type': 'EducationalOrganization' | 'Organization';
  name: string;
}

/**
 * JSON-LD `Person.alumniOf` / `memberOf` 用のノード。
 *
 * Assumption: Google にこの2プロパティのリッチリザルトは無く、効果は測れない
 * （2026-07-20 の `award` 追加と同じ位置づけ）。エンティティ理解の材料として低コストに入れる。
 * 略称の学校は SCHOOL_MARKER に掛からず memberOf 側へ落ちる。誤りではないが不正確なので、
 * 学校の正式名対応表（1,100件規模の人手データ）が用意できるまでは既知の制約として残す。
 */
export function careerAffiliationNodes(teams: string[]): {
  alumniOf: AffiliationNode[];
  memberOf: AffiliationNode[];
} {
  const alumniOf: AffiliationNode[] = [];
  const memberOf: AffiliationNode[] = [];
  for (const name of teams) {
    if (SCHOOL_MARKER.test(name)) alumniOf.push({ '@type': 'EducationalOrganization', name });
    else memberOf.push({ '@type': 'Organization', name });
  }
  return { alumniOf, memberOf };
}

/**
 * 全角=1 / 半角=0.5 として数えた表示幅。Google のスニペット表示は概ね全角120字で、
 * ビルド済み `out/` の実測では既に 10%（166枚）がそこを超えている。
 */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += /[ -~｡-ﾟ]/.test(ch) ? 0.5 : 1;
  return w;
}

export const DESCRIPTION_MAX_WIDTH = 120;

/**
 * description の末尾2要素（主なペア / 所属歴）を予算内に収める。
 *
 * 優先順は 所属歴 > 主なペア。ペアの相手は本文の「関連選手」から相互リンクされていて
 * 相手自身の結果ページも別にあるが、所属歴は本ページにしか出ない語だから。
 * どちらも入らないときは改修前と同じ「主なペアのみ」に戻す（非破壊）。
 */
export function composeDescriptionTail(head: string, partnerPhrase: string, careerPhrase: string | null): string {
  const fits = (s: string) => displayWidth(s) <= DESCRIPTION_MAX_WIDTH;
  if (!careerPhrase) return `${head}${partnerPhrase}`;
  const both = `${head}${partnerPhrase}${careerPhrase}`;
  if (fits(both)) return both;
  const careerOnly = `${head}${careerPhrase}`;
  if (fits(careerOnly)) return careerOnly;
  return `${head}${partnerPhrase}`;
}
