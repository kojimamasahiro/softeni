// src/components/Tournament/ResultCoverageNotice.tsx
//
// 大会結果ページのH1直下に出す「どこまで結果が反映されているか」の1行通知。
// docs/adr/ADR-007-in-progress-tournament-standing.md の Open Question対応。
// completed / unsupported のときは何も描画しない（呼び出し側の判定にも使えるよう
// null を返す関数として実装せず、コンポーネント側で早期return する）。

import { computeResultCoverage, formatResultCoverageBodyText } from '@/lib/tournamentCoverage';

interface ResultCoverageNoticeProps {
  detailData: Parameters<typeof computeResultCoverage>[0];
}

export default function ResultCoverageNotice({ detailData }: ResultCoverageNoticeProps) {
  const coverage = computeResultCoverage(detailData);
  const text = formatResultCoverageBodyText(coverage);

  if (!text) return null;

  return (
    <p className="mb-4 rounded border border-info-border bg-info-bg px-3 py-2 text-sm text-info" role="status">
      {text}
    </p>
  );
}
