// src/components/Tournament/ResultCoverageNotice.tsx
//
// 大会結果ページのH1直下に出す「どこまで結果が反映されているか」の1行通知。
// docs/adr/ADR-007-in-progress-tournament-standing.md の Open Question対応。
// completed / unsupported のときは何も描画しない。
//
// coverage は呼び出し側で computeResultCoverage() 済みのものを受け取る。
// 打ち切り情報は detailData から導出できない（読み出し時点で ongoing が確定成績へ
// 解決済みのため）ので、算出は information を持つページ側の責務にしている。
// 詳細: docs/raw/2026-07-26-abandoned-tournament-ui-design.md

import { formatResultCoverageBodyText, type ResultCoverage } from '@/lib/tournamentCoverage';

interface ResultCoverageNoticeProps {
  coverage: ResultCoverage;
}

export default function ResultCoverageNotice({ coverage }: ResultCoverageNoticeProps) {
  const text = formatResultCoverageBodyText(coverage);

  if (!text) return null;

  // 打ち切りは「更新待ち」ではなく確定した最終状態なので、in_progress / not_recorded の
  // info 系（青）と視覚的に区別する。
  const tone = coverage.status === 'abandoned' ? 'border-warning-border bg-warning-bg text-warning' : 'border-info-border bg-info-bg text-info';

  return (
    <p className={`mb-4 rounded border px-3 py-2 text-sm ${tone}`} role="status">
      {text}
    </p>
  );
}
