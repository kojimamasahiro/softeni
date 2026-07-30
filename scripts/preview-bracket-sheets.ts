// 実データからトーナメント表のモック HTML を生成する（見た目の検討用。本番描画ではない）。
// 実行: npm run bracket:preview
//
// 描き方（2026-07-31 ユーザー決定）:
//   - 紙のドロー表と同じく、**選手名は左右の両端にだけ**置く。
//   - 内側は**線だけ**で繋ぐ。勝ち上がった選手を各ラウンドに書き直さない。
//     誰が勝ったかは「線の濃さ」で示す（勝者側の枝を濃く引く）。
//   - 1 枚 64 枠・左右から中央へ収束・ベスト64 は別シート。
//
// この描き方だと 64 枠が横 600px 程度に収まる。名前を各ラウンドに書く方式は
// ラウンドごとに名前の幅が要るため横に伸び続けるが、線だけなら 1 ラウンド 22px で済む。
//
// 検討記録: docs/raw/2026-07-26-idea-bracket-redesign.md

import fs from 'fs';
import path from 'path';

import { drawBracketSheet, type BracketNameOf } from '../lib/bracketDrawing';
import { buildBracketTree, describeBracketLayout, splitBracketSheets, type BracketSheet } from '../lib/bracketLayout';
import type { RawDetail } from '../lib/tournamentRecords';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'tournament-bracket-preview.html');

const TARGETS: { label: string; note: string; file: string }[] = [
  {
    label: 'インターハイ2026 男子ダブルス',
    note: '開催前・1回戦の組み合わせのみ入力（結果ゼロ）。512枠・9ラウンド',
    file: 'data/tournaments/details/highschool-championship/2026/doubles-none-boys.json',
  },
  {
    label: 'インターハイ2025 男子ダブルス',
    note: '完了済み。512枠・9ラウンド',
    file: 'data/tournaments/details/highschool-championship/2025/doubles-none-boys.json',
  },
  {
    label: '九州高校2026 男子ダブルス',
    note: '完了済み。64枠なので大会全体が1枚に収まる例',
    file: 'data/tournaments/details/highschool-kyushu-block/2026/doubles-none-boys.json',
  },
  {
    label: '九州高校2026 男子団体',
    note: '完了済み。16校の小さいドロー',
    file: 'data/tournaments/details/highschool-kyushu-block/2026/team-none-boys.json',
  },
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type NameOf = BracketNameOf;

function nameResolver(detail: RawDetail): NameOf {
  const byId = new Map((detail.participants ?? []).map((p) => [p.id, p]));
  const byNo = new Map((detail.entries ?? []).map((e) => [e.entryNo, e]));
  return (entryNo) => {
    const entry = byNo.get(entryNo);
    if (!entry) return null;
    const players = entry.playerIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
    if (players.length === 0) return { main: `#${entryNo}`, sub: '' };

    // 団体戦は participants に選手名が無く team だけが入る。その場合は校名を主にする。
    const names = players.map((p) => `${p.lastName ?? ''}${p.firstName ?? ''}`).filter(Boolean);
    const teams = [...new Set(players.map((p) => p.team).filter(Boolean))];
    if (names.length === 0) {
      const prefs = [...new Set(players.map((p) => p.prefecture).filter(Boolean))];
      return { main: teams.join('／') || `#${entryNo}`, sub: prefs.join('／') };
    }
    return { main: names.join('・'), sub: teams.join('／') };
  };
}

/** 座標計算は lib/bracketDrawing.ts と共有する。ここは SVG 文字列に落とすだけ。 */
const CLASS_OF = { entryNo: 'no', name: 'nm', team: 'tm', score: 'sc' } as const;

function renderSheet(sheet: BracketSheet, name: NameOf): string {
  const d = drawBracketSheet(sheet, name);
  if (!d) return '';

  const body = [
    ...d.segments.map((s) => `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" class="${s.win ? 'w' : 'l'}"/>`),
    ...d.labels.map(
      (l) =>
        `<text x="${l.x}" y="${l.y}" text-anchor="${l.anchor}" class="${CLASS_OF[l.kind]}${l.kind === 'score' && !l.win ? ' lose' : ''}">${esc(l.text)}</text>`,
    ),
    d.champion
      ? `<circle cx="${d.champion.x}" cy="${d.champion.y}" r="${d.champion.decided ? 4 : 2.5}" class="${d.champion.decided ? 'champ' : 'champ-tbd'}"/>`
      : '',
  ].join('');

  return `<section class="sheet" data-sheet="${sheet.index}" hidden>
    <svg viewBox="0 0 ${d.width} ${d.height}" width="${d.width}" height="${d.height}" data-w="${d.width}" data-h="${d.height}">${body}</svg>
  </section>`;
}

function renderTournament(t: (typeof TARGETS)[number], tIndex: number): string {
  const detail: RawDetail = JSON.parse(fs.readFileSync(path.join(ROOT, t.file), 'utf8'));
  const { layout, failure } = describeBracketLayout(detail);
  if (!layout) return `<article class="t" data-t="${tIndex}" hidden><p class="err">復元できません（${failure}）</p></article>`;

  const tree = buildBracketTree(layout, detail.matches);
  const name = nameResolver(detail);

  // ベスト64 シートの出し分け（2026-07-31 ユーザー決定）:
  //   結果が 1 件も出ていなければ**出さない**（山シートと重複するだけで見る意味が無い）。
  //   結果が出ていれば**初期表示**にする（そこが大会の見どころなので）。
  const all = splitBracketSheets(tree);
  const sheets = all.filter((s) => s.kind !== 'final' || all.length === 1 || s.decided > 0);
  const initial = sheets.find((s) => s.kind === 'final' && s.decided > 0) ?? sheets[0];

  return `<article class="t" data-t="${tIndex}" data-initial="${initial.index}" hidden>
    <p class="note">${esc(t.note)}／${tree.size}枠・${tree.totalRounds}ラウンド・シート${sheets.length}枚${all.length > sheets.length ? '（ベスト64は結果が無いため非表示）' : ''}</p>
    <div class="tabs"><span class="tabl">エントリー番号</span>${sheets.map((s) => `<button class="tab" data-sheet="${s.index}">${esc(s.label)}</button>`).join('')}</div>
    <div class="zoom">表示倍率 <input type="range" min="60" max="300" value="100" class="z"> <span class="zv">100%</span></div>
    <div class="sheets">${sheets.map((s) => renderSheet(s, name)).join('')}</div>
  </article>`;
}

const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><title>トーナメント表 分割モック</title>
<style>
:root { --line:#aab4bf; --win:#16324f; --ink:#1f2933; --muted:#7b8794; }
* { box-sizing:border-box; }
body { margin:0; font-family:-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif; color:var(--ink); background:#eef1f5; }
header { padding:14px 18px; background:#fff; border-bottom:1px solid var(--line); position:sticky; top:0; z-index:5; }
h1 { font-size:15px; margin:0 0 8px; }
.pick button, .tab { font:inherit; font-size:12px; padding:5px 11px; margin:0 5px 5px 0; border:1px solid var(--line); background:#fff; border-radius:4px; cursor:pointer; }
.pick button.on, .tab.on { background:var(--ink); color:#fff; border-color:var(--ink); }
.note { font-size:12px; color:var(--muted); margin:10px 18px 6px; }
.tabs { margin:0 18px; }
.tabl { font-size:12px; color:var(--muted); margin-right:6px; }
.zoom { margin:8px 18px; font-size:12px; color:var(--muted); }
.zoom input { vertical-align:middle; width:220px; }
.sheets { padding:12px 18px 48px; overflow:auto; }
svg { background:#fff; border:1px solid var(--line); display:block; }
line.l { stroke:var(--line); stroke-width:1; }
line.w { stroke:var(--win); stroke-width:2.2; }
text.nm { font-size:10px; fill:var(--ink); }
text.tm { font-size:8.5px; fill:var(--muted); }
text.no { font-size:8px; fill:var(--muted); }
text.sc { font-size:7.5px; fill:var(--win); font-weight:700; }
text.sc.lose { fill:var(--muted); font-weight:400; }
circle.champ { fill:var(--win); }
circle.champ-tbd { fill:none; stroke:var(--line); }
.err { margin:18px; color:#b91c1c; }
</style></head><body>
<header>
  <h1>トーナメント表 分割モック — 両端に選手名・内側は線のみ／1枚64枠／左右から中央へ</h1>
  <div class="pick">${TARGETS.map((t, i) => `<button data-t="${i}">${esc(t.label)}</button>`).join('')}</div>
</header>
${TARGETS.map(renderTournament).join('')}
<script>
const showSheet = (t, s) => {
  t.querySelectorAll('.sheet').forEach((el) => { el.hidden = el.dataset.sheet !== String(s); });
  t.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.sheet === String(s)));
};
const show = (i) => {
  document.querySelectorAll('.t').forEach((el) => { el.hidden = el.dataset.t !== String(i); });
  document.querySelectorAll('.pick button').forEach((b) => b.classList.toggle('on', b.dataset.t === String(i)));
  const t = document.querySelector('.t[data-t="' + i + '"]');
  if (t && !t.querySelector('.tab.on')) showSheet(t, t.dataset.initial);
};
document.querySelectorAll('.pick button').forEach((b) => b.addEventListener('click', () => show(b.dataset.t)));
document.querySelectorAll('.t').forEach((t) => {
  t.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => showSheet(t, b.dataset.sheet)));
  const z = t.querySelector('.z'), zv = t.querySelector('.zv');
  // SVG なので width/height を掛けるだけで拡大できる（線も文字も綺麗に伸びる）
  const apply = () => {
    const v = Number(z.value) / 100;
    zv.textContent = Math.round(v * 100) + '%';
    t.querySelectorAll('svg').forEach((s) => {
      s.setAttribute('width', s.dataset.w * v);
      s.setAttribute('height', s.dataset.h * v);
    });
  };
  z.addEventListener('input', apply);
  apply();
});
show(0);
</script>
</body></html>`;

fs.writeFileSync(OUT, html);
console.log(`書き出しました: ${path.relative(ROOT, OUT)}`);
for (const t of TARGETS) {
  const detail: RawDetail = JSON.parse(fs.readFileSync(path.join(ROOT, t.file), 'utf8'));
  const { layout } = describeBracketLayout(detail);
  if (!layout) continue;
  const tree = buildBracketTree(layout, detail.matches);
  const sheets = splitBracketSheets(tree);
  const d = drawBracketSheet(sheets[0], nameResolver(detail));
  console.log(`  ${t.label}: ${layout.size}枠 → ${sheets.length}枚、1枚あたり ${d?.width}x${d?.height}px`);
}
