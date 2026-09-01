// components/Tournament/BracketSheets.tsx
//
// ドロー（entryNo ＋ entries[].type）から復元したトーナメント表。
//
// 従来の TournamentBracket（matches のツリーを decision から逆算）と違い、
// **結果が 1 件も入っていなくても全ラウンドの枠と線を描ける**。開催前のデータには
// 2 回戦以降の試合レコードが無く nextMatchId も付かないため、ツリーを辿る方法では
// 大会前にトーナメント表が成立しない（インターハイ2026 は 60 本の独立ツリーになっていた）。
//
// 描き方の規約と、なぜそうなっているかは lib/bracketDrawing.ts の冒頭にまとめてある。
// 検討記録: docs/raw/2026-07-26-idea-bracket-redesign.md

import { useMemo, useState } from 'react';

import { drawBracketSheet, type BracketNameOf } from '@/lib/bracketDrawing';
import { buildBracketTree, describeBracketLayout, splitBracketSheets } from '@/lib/bracketLayout';
import { TournamentDetailData } from '@/types/index';
import { joinPlayerName } from '@/utils/playerName';

interface BracketSheetsProps {
  detailData: TournamentDetailData;
  /** 名前をタップしたときに対戦詳細を出す。TournamentBracket のモーダルと共有する。 */
  onSelectEntry?: (entryNo: number) => void;
}

const ZOOM_STEPS = [0.8, 1, 1.3, 1.7] as const;

/**
 * SVG の text 幅の見積もり。半角は 0.5em・それ以外（CJK）は 1em として数える。
 * 下線を引くのに幅が要るが、`getComputedTextLength()` はブラウザでしか使えず SSG で描けない。
 * 実測（インターハイ2026 男子ダブルスの名前 10 件）ではこの見積もりが実値と完全に一致した。
 */
function estimateSvgTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) em += /[\u0020-\u007e\uff61-\uff9f]/.test(ch) ? 0.5 : 1;
  return em * fontSize;
}

/** entryNo → 表示名。団体戦は participants に選手名が無く team だけ入る。 */
function useNameOf(detailData: TournamentDetailData): BracketNameOf {
  return useMemo(() => {
    const byId = new Map(detailData.participants.map((p) => [p.id, p]));
    const byNo = new Map(detailData.entries.map((e) => [e.entryNo, e]));
    return (entryNo: number) => {
      const entry = byNo.get(entryNo);
      if (!entry) return null;
      const players = (entry.playerIds ?? []).map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
      if (players.length === 0) return null;

      const names = players.map((p) => joinPlayerName(p.lastName, p.firstName)).filter(Boolean);
      const teams = [...new Set(players.map((p) => p.team).filter(Boolean))];
      if (names.length === 0) {
        const prefs = [...new Set(players.map((p) => p.prefecture).filter(Boolean))];
        return { main: teams.join('／') || `#${entryNo}`, sub: prefs.join('／') };
      }
      return { main: names.join('・'), sub: teams.join('／') };
    };
  }, [detailData]);
}

/**
 * 復元でトーナメント表を描けるなら描く。描けなければ null を返すので、
 * 呼び出し側は従来描画へフォールバックすること。
 */
export default function BracketSheets({ detailData, onSelectEntry }: BracketSheetsProps) {
  const nameOf = useNameOf(detailData);

  const sheets = useMemo(() => {
    const { layout } = describeBracketLayout(detailData);
    if (!layout) return null;
    const tree = buildBracketTree(layout, detailData.matches);
    const all = splitBracketSheets(tree);
    // ベスト64 シートは山シートと後半が重複するので、まだ 1 件も決まっていなければ出さない。
    // 決まっていればそこが大会の見どころなので初期表示にする。
    return all.filter((s) => s.kind !== 'final' || all.length === 1 || s.decided > 0);
  }, [detailData]);

  const initialIndex = useMemo(() => {
    if (!sheets) return 0;
    const best = sheets.find((s) => s.kind === 'final' && s.decided > 0);
    return best ? sheets.indexOf(best) : 0;
  }, [sheets]);

  const [current, setCurrent] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const active = current ?? initialIndex;
  const drawing = useMemo(() => (sheets ? drawBracketSheet(sheets[active], nameOf) : null), [sheets, active, nameOf]);

  if (!sheets || !drawing) return null;

  return (
    <div className="w-full">
      {sheets.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="トーナメント表の山（エントリー番号）">
          <span className="text-xs text-gray-500">エントリー番号</span>
          {sheets.map((s, i) => (
            <button
              key={s.index}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={s.entryNoRange && s.kind === 'qualifying' ? `エントリー番号 ${s.entryNoRange[0]} から ${s.entryNoRange[1]}` : s.label}
              onClick={() => setCurrent(i)}
              className={`rounded border px-2.5 py-1 text-xs ${i === active ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="mb-2 flex items-center gap-1.5 text-xs text-gray-500">
        <span>表示倍率</span>
        {ZOOM_STEPS.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => setZoom(z)}
            aria-pressed={zoom === z}
            className={`rounded border px-2 py-0.5 ${zoom === z ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
          >
            {Math.round(z * 100)}%
          </button>
        ))}
      </div>

      <div className="overflow-auto">
        <svg
          viewBox={`0 0 ${drawing.width} ${drawing.height}`}
          width={drawing.width * zoom}
          height={drawing.height * zoom}
          role="img"
          aria-label={`${sheets[active].label}のトーナメント表`}
          className="block border border-gray-200 bg-white"
        >
          {drawing.segments.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.win ? '#16324f' : '#aab4bf'} strokeWidth={s.win ? 2.2 : 1} />
          ))}

          {drawing.labels.map((l, i) => {
            const common = { x: l.x, y: l.y, textAnchor: l.anchor };
            if (l.kind === 'score') {
              return (
                <text key={i} {...common} fontSize={7.5} fontWeight={l.win ? 700 : 400} fill={l.win ? '#16324f' : '#7b8794'}>
                  {l.text}
                </text>
              );
            }
            if (l.kind === 'entryNo') {
              return (
                <text key={i} {...common} fontSize={8} fill="#7b8794">
                  {l.text}
                </text>
              );
            }
            if (l.kind === 'team') {
              return (
                <text key={i} {...common} fontSize={8.5} fill="#7b8794">
                  {l.text}
                </text>
              );
            }
            // タップできることが分かるように、サイト共通の「点線の下線＝選手へのリンク」を引く。
            // hover だけだとモバイルで気付けず、トーナメント表が行き止まりになる。
            // SVG は text-decoration-style を無視する（Chrome 実測で solid のまま）ので、
            // text-decoration ではなく破線の line を自分で引いている。
            // 色はこの図の固定パレット（team / entryNo と同じ #7b8794）に合わせる。
            // 図全体が bg-white 固定でダークモードを持たないため、ここだけトークンを使うと反転する。
            const clickable = onSelectEntry && l.entryNo != null;
            const underlineW = clickable ? estimateSvgTextWidth(l.text, 10) : 0;
            const underlineX = l.anchor === 'end' ? l.x - underlineW : l.anchor === 'middle' ? l.x - underlineW / 2 : l.x;
            return (
              <g key={i}>
                <text
                  {...common}
                  fontSize={10}
                  fill="#1f2933"
                  className={clickable ? 'cursor-pointer' : undefined}
                  onClick={clickable ? () => onSelectEntry(l.entryNo!) : undefined}
                >
                  {l.text}
                </text>
                {clickable && (
                  <line
                    x1={underlineX}
                    y1={l.y + 2.5}
                    x2={underlineX + underlineW}
                    y2={l.y + 2.5}
                    stroke="#7b8794"
                    strokeWidth={0.7}
                    strokeDasharray="1 1.5"
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}

          {drawing.champion && (
            <circle
              cx={drawing.champion.x}
              cy={drawing.champion.y}
              r={drawing.champion.decided ? 4 : 2.5}
              fill={drawing.champion.decided ? '#16324f' : 'none'}
              stroke={drawing.champion.decided ? undefined : '#aab4bf'}
            />
          )}
        </svg>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        左右の端が出場者で、内側は勝ち上がりの線。太い線がその組の到達したところを示す。数字は左端・右端がエントリー番号、線の上が獲得ゲーム数（R は途中棄権）。
      </p>
      <p className="mt-1 text-xs text-gray-500">名前をタップすると、その組の全対戦とスコア、選手ページ・学校ページへのリンクが開く。</p>
    </div>
  );
}
