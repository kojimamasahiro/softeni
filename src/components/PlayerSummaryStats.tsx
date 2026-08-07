// src/components/PlayerSummaryStats.tsx
// 常時表示（畳まない）の軽量サマリー。主なペア・直近年度をチップで見せるだけに絞り、
// 全パートナー・全年度の表（勝率・ゲーム率つき）は PlayerStatisticsSections.tsx の
// 「対戦成績（全パートナー・全年度）」カード（詳細側、<details> で畳む深掘り層）に
// 移した（2026-08-07: 旧・関連選手セクションとの重複解消、その後「対戦成績」と「詳細スタッツ」の
// 見出しが2つ並んで見えた問題の解消で PlayerStatisticsSections.tsx へ統合。検討経緯は
// docs/raw/2026-08-07-idea-player-results-page-hierarchy.md）。
// 自前の <h2> は持たない。呼び出し側（results.tsx）が「スタッツ」という1つの見出しの下に
// このチップ＋<details>（詳細）をまとめて配置する（2026-08-07: 「サマリー」と「詳細スタッツ」
// という別々の見出しを持つのをやめ、「スタッツ」1本＋「詳細を見る」に統一）。
import Link from 'next/link';

import { PlayerInfo, PlayerStats } from '@/types/index';

type SummaryStatsProps = {
  playerStats: PlayerStats;
  allPlayers: PlayerInfo[];
};

// 直近何年ぶんを見せるか。詳細スタッツ側（対戦成績カード）には全年度がある。
const RECENT_YEARS_COUNT = 3;

function resolvePartnerName(id: string, name: string | undefined, allPlayers: PlayerInfo[]) {
  // エンジン解決済みの名前（stats.name、docs/wiki/players-pages.md「不具合修正 2026-07-20」）を
  // allPlayers ルックアップより優先する。順序を変えるとキー集合の食い違いで数値IDがそのまま
  // 表示される不具合を再発しうる。
  if (name) return name;
  const matched = allPlayers.find((p) => p.id === id);
  return matched ? `${matched.lastName}${matched.firstName || ''}` : '';
}

export default function PlayerSummaryStats({ playerStats, allPlayers }: SummaryStatsProps) {
  if (!playerStats || !playerStats.totalMatches) return null;

  const partnerChips = Object.entries(playerStats.byPartner)
    .filter(([key]) => key !== 'singles')
    .map(([id, agg]) => {
      const matchedPlayer = allPlayers.find((p) => p.id === id);
      return {
        id,
        name: resolvePartnerName(id, agg.name, allPlayers),
        total: agg.matches.total,
        wins: agg.matches.wins,
        losses: agg.matches.losses,
        hasPage: (matchedPlayer?.count ?? 0) >= 5,
      };
    })
    .filter((p) => p.name !== '')
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const yearChips = Object.entries(playerStats.byYear)
    .sort(([a], [b]) => Number(b) - Number(a))
    .slice(0, RECENT_YEARS_COUNT)
    .map(([year, agg]) => ({
      year,
      total: agg.matches.total,
      wins: agg.matches.wins,
      losses: agg.matches.losses,
    }));

  if (partnerChips.length === 0 && yearChips.length === 0) return null;

  return (
    <>
      {partnerChips.length > 0 && (
        <div className="mb-3">
          <p className="mb-2 text-xs text-text-muted">主なペア（試合数の多い順）</p>
          <ul className="flex flex-wrap gap-2">
            {partnerChips.map((p) => {
              const label = `${p.name}（${p.total}試合 ${p.wins}勝${p.losses}敗）`;
              return (
                <li key={p.id}>
                  {p.hasPage ? (
                    <Link
                      href={`/players/${p.id}/results`}
                      className="inline-block rounded-full border border-border bg-gray-50 px-3 py-1 text-sm text-info transition-colors hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span className="inline-block rounded-full border border-border bg-gray-50 px-3 py-1 text-sm text-text-secondary dark:bg-gray-800">
                      {label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {yearChips.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-text-muted">直近{RECENT_YEARS_COUNT}年の成績</p>
          <ul className="flex flex-wrap gap-2">
            {yearChips.map((y) => (
              <li key={y.year}>
                <span className="inline-block rounded-full border border-border bg-gray-50 px-3 py-1 text-sm text-text-secondary dark:bg-gray-800">
                  {y.year}年（{y.total}試合 {y.wins}勝{y.losses}敗）
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
