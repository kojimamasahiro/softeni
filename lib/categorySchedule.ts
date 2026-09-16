// lib/categorySchedule.ts
//
// 種目別の競技日程（information の `categories[].schedule`）を表示用に整える純関数。
//
// 目的（docs/wiki/upcoming-tournaments-runbook.md S10）:
// 会期（例: 9/18〜23）だけでは「いつ見ればいいか」が分からない。代表選手が出る種目の
// 日程と決勝の予定時刻まで出して、大会ハブと選手ページから観戦のタイミングへ導く。
//
// 日程は**主催者発表の予定の転記**であり、当サイトの推定ではない。そのため
// 出典（`scheduleSource` / `scheduleSourceUrl`）と確認日（`scheduleCheckedOn`）を必ず一緒に返す。
// 出典の無い schedule は表示しない（出典を併記できないため）。

import type { TournamentInformationEntry } from '@/types/tournament';

export type CategoryScheduleRow = {
  categoryId: string;
  label: string;
  startDate: string;
  endDate: string;
  /** 決勝の開始予定時刻（HH:MM、会場の現地時刻）。無ければ null */
  finalTime: string | null;
  /** 表示用の日付（例: 9月18日〜20日 / 9月21日） */
  dateLabel: string;
};

export type CategorySchedule = {
  rows: CategoryScheduleRow[];
  source: string;
  sourceUrl: string;
  checkedOn: string | null;
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function parts(d: string): { m: number; day: number; w: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  // 日付だけの値なので UTC で曜日を取る（実行環境のタイムゾーンに左右されないように）
  const w = WEEKDAYS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
  return { m: Number(m[2]), day: Number(m[3]), w };
}

/** `9月18日（金）〜20日（日）` / `9月21日（月）`。月をまたぐときは終了側にも月を書く。 */
export function formatScheduleDates(start: string, end: string): string {
  const s = parts(start);
  const e = parts(end);
  if (!s) return start;
  const head = `${s.m}月${s.day}日（${s.w}）`;
  if (!e || end === start) return head;
  return `${head}〜${e.m === s.m ? '' : `${e.m}月`}${e.day}日（${e.w}）`;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * その年度の種目別日程を返す。schedule を持つ種目が1つも無い、または出典が無ければ null。
 * 並びは開始日 → 決勝日 → 決勝時刻の順（観戦の順番で読めるように）。
 */
export function buildCategorySchedule(edition: TournamentInformationEntry | null | undefined): CategorySchedule | null {
  if (!edition?.scheduleSource || !edition.scheduleSourceUrl) return null;

  const rows: CategoryScheduleRow[] = [];
  for (const c of edition.categories ?? []) {
    const s = c.schedule;
    if (!s?.startDate || !s.endDate) continue;
    rows.push({
      categoryId: c.categoryId,
      label: c.label,
      startDate: s.startDate,
      endDate: s.endDate,
      finalTime: s.finalTime && TIME_RE.test(s.finalTime) ? s.finalTime : null,
      dateLabel: formatScheduleDates(s.startDate, s.endDate),
    });
  }
  if (rows.length === 0) return null;

  rows.sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate) || String(a.finalTime ?? '').localeCompare(String(b.finalTime ?? '')),
  );

  return {
    rows,
    source: edition.scheduleSource,
    sourceUrl: edition.scheduleSourceUrl,
    checkedOn: edition.scheduleCheckedOn ?? null,
  };
}
