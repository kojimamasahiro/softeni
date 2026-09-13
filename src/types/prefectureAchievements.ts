// src/types/prefectureAchievements.ts
// 中学生・小学生カテゴリの都道府県ページに出す「全国大会での成績（ベスト8以上）」の表示用の形。
// データ層（lib/primaryschool.ts / lib/secondaryschool.ts）はカテゴリごとに分けたまま、
// 表示（src/components/PrefectureAchievements.tsx）だけを共有するための型。

export interface AchievementPlayer {
  /** 団体戦のエントリーは選手名を持たない（null）。そのときはチーム名だけを出す */
  name: string | null;
  /** 選手結果ページが実在するときだけ入る（デッドリンク防止） */
  playerId: number | null;
  team: string | null;
  /** 同じ県の掲載チーム（団体）ページが実在するときだけ入る */
  teamHref: string | null;
}

export interface AchievementRow {
  key: string;
  year: number;
  /** 例: 男子ダブルス */
  discipline: string;
  /** 優勝 / 準優勝 / ベスト4 / ベスト8 */
  label: string;
  players: AchievementPlayer[];
}

export interface AchievementGroup {
  tournamentId: string;
  label: string;
  /** 結果を収録している年度（中止などで抜けた年は含まない） */
  years: number[];
  /** 成績上位順 → 年度降順。先頭がその大会での県の最高成績 */
  rows: AchievementRow[];
}
