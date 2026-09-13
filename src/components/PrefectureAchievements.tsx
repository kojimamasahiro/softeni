// src/components/PrefectureAchievements.tsx
// 中学生・小学生カテゴリの都道府県ページに置く「全国大会での成績（ベスト8以上）」。
//
// 方針（2026-09-13 ユーザー決定）:
// - **県をまたいだ比較・順位づけはしない**。1つの県の中で、ベスト8以上に入った記録を列挙するだけ。
//   中学が県別ポイントを廃止した理由（配点が Assumption）は、数字を作らず事実だけを出すここには当たらない
// - **大会ごとに分ける**。全中と都道府県対抗は収録年数も出場枠の決まり方も違い、混ぜると
//   「どの大会の最高成績か」が読めなくなる
// - **ベスト8未満は出さない**。該当が無い大会は「収録範囲ではベスト8以上の記録なし」と書く
// - データ層はカテゴリごと（lib/primaryschool.ts / lib/secondaryschool.ts）。見た目だけ共有する
// 仕様: docs/wiki/secondaryschool.md / docs/wiki/primaryschool.md「都道府県の全国大会での成績」

import Link from 'next/link';
import { Fragment } from 'react';

import type { AchievementGroup, AchievementPlayer, AchievementRow } from '@/types/prefectureAchievements';

/** 最初から見せる件数。残りは `<details>` に畳む（閉じていても DOM にありクローラは読める） */
const VISIBLE_ROWS = 10;

/** 収録年度を「2018〜2019・2021〜2026年」の形にする。中止などで抜けた年で区切る */
export function formatYearRanges(years: number[]): string {
  if (years.length === 0) return '';
  const sorted = [...years].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (const y of sorted.slice(1)) {
    if (y === prev + 1) {
      prev = y;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}〜${prev}`);
    start = y;
    prev = y;
  }
  ranges.push(start === prev ? `${start}` : `${start}〜${prev}`);
  return `${ranges.join('・')}年`;
}

function TeamName({ name, href }: { name: string; href: string | null }) {
  return href ? (
    <Link href={href} className="text-link hover:underline">
      {name}
    </Link>
  ) : (
    <>{name}</>
  );
}

function PlayerName({ player }: { player: AchievementPlayer }) {
  if (!player.name) return null;
  return player.playerId ? (
    <Link href={`/players/${player.playerId}/results`} className="text-link hover:underline">
      {player.name}
    </Link>
  ) : (
    <>{player.name}</>
  );
}

/**
 * 出場者の表記。
 * - 団体戦（選手名なし）: チーム名だけ
 * - 同じ所属のペア: 「選手・選手（所属）」
 * - 所属の違うペア: 「選手（所属）・選手（所属）」
 */
function Entrants({ players }: { players: AchievementPlayer[] }) {
  const named = players.filter((p) => p.name);
  if (named.length === 0) {
    const teams = [...new Map(players.filter((p) => p.team).map((p) => [p.team as string, p.teamHref])).entries()];
    return (
      <>
        {teams.map(([name, href], i) => (
          <Fragment key={name}>
            {i > 0 && '・'}
            <TeamName name={name} href={href} />
          </Fragment>
        ))}
      </>
    );
  }
  const teamNames = new Set(named.map((p) => p.team ?? ''));
  if (teamNames.size === 1) {
    const first = named[0];
    return (
      <>
        {named.map((p, i) => (
          <Fragment key={`${p.name}-${i}`}>
            {i > 0 && '・'}
            <PlayerName player={p} />
          </Fragment>
        ))}
        {first.team && (
          <>
            （<TeamName name={first.team} href={first.teamHref} />）
          </>
        )}
      </>
    );
  }
  return (
    <>
      {named.map((p, i) => (
        <Fragment key={`${p.name}-${i}`}>
          {i > 0 && '・'}
          <PlayerName player={p} />
          {p.team && (
            <>
              （<TeamName name={p.team} href={p.teamHref} />）
            </>
          )}
        </Fragment>
      ))}
    </>
  );
}

function Row({ row }: { row: AchievementRow }) {
  return (
    <li className="text-sm">
      <span className="font-semibold">
        {row.year}年 {row.discipline} {row.label}
      </span>
      <span className="ml-2 text-text-secondary">
        <Entrants players={row.players} />
      </span>
    </li>
  );
}

function Group({ group, prefectureName }: { group: AchievementGroup; prefectureName: string }) {
  const range = formatYearRanges(group.years);
  const best = group.rows[0];
  const bestCount = best ? group.rows.filter((r) => r.label === best.label).length : 0;
  const visible = group.rows.slice(0, VISIBLE_ROWS);
  const rest = group.rows.slice(VISIBLE_ROWS);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-base font-semibold">
        {group.label}
        {range && <span className="ml-2 text-xs font-normal text-text-muted">収録 {range}</span>}
      </h3>

      {best ? (
        <>
          <p className="mt-1 text-sm text-text-secondary">
            {prefectureName}の最高成績は<strong className="text-lg text-text">{best.label}</strong>
            {bestCount > 1 && `（${bestCount}回）`}。ベスト8以上は{group.rows.length}件です。
          </p>
          <ul className="mt-3 space-y-1.5">
            {visible.map((row) => (
              <Row key={row.key} row={row} />
            ))}
          </ul>
          {rest.length > 0 && (
            // 開閉トグルは PlayerMajorResults.tsx の慣例に合わせる（文言＋▼▲の入れ替え）
            <details className="group mt-2">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-text-secondary hover:text-text">
                <span>
                  残り{rest.length}件を
                  <span className="group-open:hidden">見る</span>
                  <span className="hidden group-open:inline">閉じる</span>
                </span>
                <span aria-hidden className="text-text-muted group-open:hidden">
                  ▼
                </span>
                <span aria-hidden className="hidden text-text-muted group-open:inline">
                  ▲
                </span>
              </summary>
              <ul className="mt-1.5 space-y-1.5">
                {rest.map((row) => (
                  <Row key={row.key} row={row} />
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-text-secondary">収録範囲では、ベスト8以上の記録はありません。</p>
      )}
    </div>
  );
}

export default function PrefectureAchievements({
  prefectureName,
  groups,
  note,
}: {
  prefectureName: string;
  groups: AchievementGroup[];
  /** 対象大会・数え方の注記（カテゴリごとに違う） */
  note: string;
}) {
  if (groups.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-lg font-bold">{prefectureName}の全国大会での成績（ベスト8以上）</h2>
      <p className="mb-4 text-sm text-text-secondary">{note}</p>
      <div className="space-y-3">
        {groups.map((g) => (
          <Group key={g.tournamentId} group={g} prefectureName={prefectureName} />
        ))}
      </div>
    </section>
  );
}
