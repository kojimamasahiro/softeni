// src/components/AdUnit.tsx
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

import { ADSENSE_CLIENT } from '@/lib/ads';

type Props = {
  /** AdSense のスロットID（lib/ads.ts の AD_SLOTS から渡す）。空なら何も描画しない。 */
  slot: string;
  /**
   * 事前に確保する高さ(px)。レスポンシブ枠は配信されるまで実高さが分からないため、
   * ここで場所を先に取って CLS を出さないようにする。
   */
  minHeight?: number;
  /** 枠の外側に足すクラス（マージン調整用）。 */
  className?: string;
};

/**
 * 手動広告枠（AdSense ディスプレイユニット）。
 *
 * 自動広告（ページ内自動挿入）は挿入位置を選べず高さも確保しないためレイアウトが崩れる。
 * それを避けて「置く場所と高さを自分で決める」ためのコンポーネント。
 * 配置ルール（ファーストビューに置かない・1ビューポートに2枠出さない）は
 * docs/wiki/monetization.md「手動広告枠」を参照。
 *
 * 実装上の要点:
 *
 * - **ins はマウント後にだけ描画する**。AdSense のスクリプトは ins の中身を書き換えるため、
 *   サーバー出力の DOM に置くとハイドレーション不一致（Minified React error #418）→
 *   adsbygoogle 側 `no_div` を誘発しうる（2026-07-05 に本番で起きた事象。monetization.md 参照）。
 *   高さを持つラッパーだけはサーバー出力にも含めるので、マウント前後で位置はずれない。
 * - **ins に asPath の key を付ける**。SPA 遷移で React が同じ ins ノードを使い回すと、
 *   広告描画済みのノードに再 push することになり
 *   "already have ads in them" で2ページ目以降が出なくなる。key でノードごと作り直す。
 * - **未配信（unfilled）のときだけ枠を畳む**。畳むと僅かにレイアウトシフトするが、
 *   本文の途中に数百pxの空白が残り続ける方が実害が大きい（同じ判断で globals.css に
 *   自動広告向けの unfilled 非表示ルールを入れてある）。
 * - **data-full-width-responsive は false**。true にすると AdSense がモバイルで ins を
 *   端末幅いっぱい（375px幅なら 375x375 の正方形）に広げ、`margin-left: -16px` を当てて
 *   PageLayout の左右パディングの外へはみ出す。実測で確認した挙動で、確保した
 *   min-height(280px) も超えるためレイアウトシフトも出る。false なら本文カラム幅に収まり
 *   高さも 280px に収まる（＝ CLS ゼロ）。収益目的で true に振るなら、CWV を見る前提で。
 */
export default function AdUnit({ slot, minHeight = 280, className }: Props) {
  const router = useRouter();
  const insRef = useRef<HTMLModElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [unfilled, setUnfilled] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !slot) return;
    const ins = insRef.current;
    if (!ins) return;

    setUnfilled(false);

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // スクリプト未読込・広告ブロッカー等。枠が埋まらないだけなので握りつぶす。
    }

    // data-ad-status は配信の可否が決まった時点で AdSense が付ける（filled / unfilled）。
    const observer = new MutationObserver(() => {
      if (ins.getAttribute('data-ad-status') === 'unfilled') setUnfilled(true);
    });
    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => observer.disconnect();
  }, [mounted, slot, router.asPath]);

  // スロット未設定（AdSense 管理画面でユニットを作る前）は枠ごと出さない。
  if (!slot) return null;

  return (
    <aside
      aria-label="広告"
      // 未配信のときは上下マージンも消す。高さだけ畳んで余白が残ると、
      // 「広告が入らなかった不自然な隙間」がそのまま見えてしまう。
      className={unfilled ? className : `my-8${className ? ` ${className}` : ''}`}
      style={{ minHeight: unfilled ? undefined : minHeight }}
    >
      {/* 広告であることの明示。ポリシー準拠と誤クリック防止のため本文より小さく淡く出す。 */}
      {!unfilled && <p className="mb-1 text-[10px] leading-none tracking-wide text-text-muted">スポンサーリンク</p>}
      {mounted && (
        <ins
          key={router.asPath}
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="false"
        />
      )}
    </aside>
  );
}
