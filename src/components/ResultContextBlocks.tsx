// src/components/ResultContextBlocks.tsx
// 年度×種目の結果ページに差し込む「文脈ブロック（注目ポイント）」表示。
// 過去の優勝者データ＋当年の試合から導けるイベント（連覇 / 初優勝 / 王者撃破）を
// バッジで表示する。データ生成は getStaticProps 側（lib/milestones.ts）。
// あわせて「再戦」（lib/priorMeetings.ts）も出す。
// 設計: docs/wiki/news-context-blocks.md / ADR-005。

import MilestoneBadge from './MilestoneBadge';
import type { ContextMilestone } from './TournamentContextBlocks';

/** 当大会で実際に組まれた対戦のうち、直近の他大会で既に対戦していたもの */
export type PriorMeetingSummary = {
  /** 今大会でのラウンド（例: 1回戦） */
  round: string | null;
  winnerNames: string[];
  loserNames: string[];
  /** 前回対戦した大会 */
  priorLabel: string;
  priorYear: number;
  priorRound: string | null;
  /**
   * 今大会の勝者名。まだ決着していなければ null。
   * `revenge` は前回敗れた側が今回勝った（＝雪辱）ことを示す。
   */
  currentWinnerNames: string[] | null;
  revenge: boolean;
};

/**
 * 大会インサイト（LLMが執筆し機械照合を通した読み物）。
 * ADR-012。公開条件の判定は lib/tournamentInsight.ts 側で済んでおり、
 * ここに渡ってきている時点で「published かつ照合済み」が保証されている。
 */
export type InsightSummary = {
  paragraphs: string[];
  scopeNote: string;
};

export default function ResultContextBlocks({
  label,
  year,
  milestones,
  priorMeetings = [],
  insight = null,
}: {
  label: string;
  year: string;
  milestones: ContextMilestone[];
  priorMeetings?: PriorMeetingSummary[];
  insight?: InsightSummary | null;
}) {
  if (milestones.length === 0 && priorMeetings.length === 0 && !insight) return null;

  const hasScopeNote = milestones.some((m) => m.scopeNote);

  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold mb-2">
        {label} {year}年度 注目ポイント
      </h2>

      {/*
        読み物（大会インサイト）。バッジより先に置く。
        バッジは単発の事実、インサイトは複数年にまたがる文脈で、後者のほうが読み手の
        入口として機能するため。ADR-012 / docs/story-yaml/PROMPT.md
      */}
      {insight && (
        <div className="mb-3 rounded-lg border border-border bg-surface p-3">
          {insight.paragraphs.map((p, i) => (
            <p key={`insight-${i}`} className={i === 0 ? 'text-sm leading-relaxed' : 'mt-2 text-sm leading-relaxed'}>
              {p}
            </p>
          ))}
          <p className="mt-2 text-[10px] opacity-70">{insight.scopeNote}</p>
        </div>
      )}
      {milestones.length > 0 && (
        <>
          <ul className="flex flex-wrap gap-2">
            {milestones.map((m, i) => (
              <li key={`${m.kind}-${i}`}>
                <MilestoneBadge kind={m.kind} label={m.label} scopeNote={m.scopeNote} />
              </li>
            ))}
          </ul>
          {hasScopeNote && <p className="mt-1 text-[10px] opacity-70">※当サイト掲載分</p>}
        </>
      )}

      {/*
        再戦。「この試合は◯◯大会◯回戦の再戦」という、大会をまたいだ試合データを
        持っていて初めて出せる文脈。結果ページでは**実際に組まれた対戦のみ**に絞る
        （起こりうるカードの提示はプレビュー記事側の役割。docs/wiki/seo.md #8 のインテント分割）。
      */}
      {priorMeetings.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-1 text-sm font-semibold">再戦（直近大会で対戦済みのカード）</h3>
          <ul className="flex flex-col gap-1.5">
            {priorMeetings.map((p, i) => (
              <li key={`pm-${i}`} className="rounded border border-border px-2.5 py-1.5 text-sm">
                {p.round && (
                  <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-100">
                    {p.round}
                  </span>
                )}
                <span className="font-semibold">{p.winnerNames.join('・')}</span>
                <span className="mx-1 opacity-60">対</span>
                <span>{p.loserNames.join('・')}</span>
                <span className="block text-xs opacity-70">
                  {p.priorLabel} {p.priorYear}
                  {p.priorRound ? ` ${p.priorRound}` : ''}では {p.winnerNames.join('・')} が勝利
                </span>
                {/* 決着済みならこの試合の勝敗まで出す（「再戦」だけでは結果が分からないため） */}
                {p.currentWinnerNames && (
                  <span className="block text-xs font-semibold">
                    今回は {p.currentWinnerNames.join('・')} が勝利
                    {p.revenge && (
                      <span className="ml-1 rounded bg-rose-100 px-1 py-0.5 text-[10px] text-rose-800 dark:bg-rose-900 dark:text-rose-100">雪辱</span>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] opacity-70">※当サイト掲載分の試合データによる</p>
        </div>
      )}
    </section>
  );
}
