// src/components/PlayerLiteLink.tsx
//
// 結果ページを持たない選手（index.json の count<5）の名前を、ページ遷移せずに
// モーダルで「どの大会に・誰と出たか」だけ見せるためのリンク風ボタン。
//
// SEO 方針: これらの選手は薄いページの量産を避けるため個別ページを作らない。
// 固有 URL を持たず、クリック時に public/data/players-lite/{id}.json をクライアントで
// fetch して表示するだけなので検索エンジンにはインデックスされない（docs/wiki/players-pages.md）。
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type PartnerLite = {
  name: string;
  id: string | null;
  hasPage: boolean;
};

const GAME_CATEGORY_LABEL: Record<string, string> = {
  doubles: 'ダブルス',
  singles: 'シングルス',
};

type TournamentLite = {
  tournamentName: string;
  year: number | string;
  gameCategory: string | null;
  team: string | null;
  partner: PartnerLite | null;
};

type PlayerLite = {
  id: string;
  name: string;
  tournaments: TournamentLite[];
};

type Props = {
  id: string;
  name: string;
  className?: string;
};

// 同一データの多重 fetch を避ける簡易キャッシュ（モーダルを開くたびに取り直さない）
const liteCache = new Map<string, PlayerLite>();

export default function PlayerLiteLink({ id, name, className }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PlayerLite | null>(liteCache.get(id) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (liteCache.has(id)) {
      setData(liteCache.get(id)!);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/data/players-lite/${id}.json`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as PlayerLite;
      liteCache.set(id, json);
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    void load();
  }, [load]);

  // ESC で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={className ?? 'text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid'}
        aria-haspopup="dialog"
      >
        {name}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} の出場大会`}
          onClick={() => setOpen(false)}
        >
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-text">{data?.name ?? name}</h2>
                <p className="text-xs text-text-muted">出場した大会と当時のペア</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md px-2 py-1 text-sm text-text-muted hover:bg-bg-subtle"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            {loading && <p className="py-6 text-center text-sm text-text-muted">読み込み中…</p>}
            {error && <p className="py-6 text-center text-sm text-text-muted">情報を取得できませんでした。</p>}
            {!loading && !error && data && data.tournaments.length === 0 && (
              <p className="py-6 text-center text-sm text-text-muted">収録された出場大会がありません。</p>
            )}

            {!loading && !error && data && data.tournaments.length > 0 && (
              <ul className="divide-y divide-border">
                {data.tournaments.map((t, i) => (
                  <li key={i} className="py-2 text-sm">
                    <div className="font-medium text-text">
                      {t.year ? `${t.year}年 ` : ''}
                      {t.tournamentName}
                    </div>
                    {t.gameCategory && <div className="text-xs text-text-muted">{GAME_CATEGORY_LABEL[t.gameCategory] ?? t.gameCategory}</div>}
                    {t.partner && (
                      <div className="text-text-secondary">
                        ペア{' '}
                        {t.partner.hasPage && t.partner.id ? (
                          <Link
                            href={`/players/${t.partner.id}/results`}
                            onClick={() => setOpen(false)}
                            className="text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid"
                          >
                            {t.partner.name}
                          </Link>
                        ) : (
                          // 結果ページを持たないペアはモーダル内では入れ子モーダルにせず名前のみ表示
                          t.partner.name
                        )}
                      </div>
                    )}
                    {t.team && <div className="text-text-secondary">所属 {t.team}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
