// scripts/verify-club-transition.ts
// 実行: npm run club:verify
//
// lib/clubTransition.ts の分類を実データ全件に当て、人が目視で確認できる形に出す。
// この分類は「クラブと断定できる証拠がある場合のみ club」という下限カウント方式なので、
// 検算で見るべきは主に次の2点:
//   (1) 学校を誤って club に入れていないか（= 過大カウント。これが起きると記事が嘘になる）
//   (2) unknown に何が落ちているか（= 下限がどれくらい甘いか）
//
// 検討記録: docs/raw/2026-08-12-idea-juniorhigh-category-pages.md（候補3）

import fs from 'fs';
import path from 'path';

import { classifyTeamAffiliation, getClubTransition, type TeamAffiliationKind } from '../lib/clubTransition';

const TOURNAMENT_ID = 'secondaryschool-championship';

let failures = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  OK   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// ---- 1. 既知の分類（表記ゆれ・紛らわしい名前）を固定する ----
console.log('\n[1] 既知の団体名の分類');
const EXPECTED: [string, TeamAffiliationKind][] = [
  // 略称の学校名。「中学校」を含まないがクラブではない（誤判定するとトレンドが壊れる）
  ['名寄', 'unknown'],
  ['湊山', 'unknown'],
  ['羽須美', 'unknown'],
  ['芝東', 'unknown'],
  // 正式名称の学校
  ['名寄市立名寄中学校', 'school'],
  ['邑南町立羽須美中学校', 'school'],
  ['早来学園', 'school'],
  ['石川義塾', 'school'],
  ['附属旭川', 'school'],
  // 末尾が「中」の略称も学校（全データでクラブの混入が無いことを検算済み）
  ['人吉第一中', 'school'],
  ['砧南中', 'school'],
  ['奈良育英中', 'school'],
  // カタカナを含むが学校マーカーが優先される
  ['苫小牧市立ウトナイ中学校', 'school'],
  // 中学データに混入している高校名（データ品質問題）。クラブ側に倒さない
  ['四天王寺高校', 'school'],
  // 学校マーカーとクラブマーカーが両方ある場合は学校を優先しない例
  // （`三重高クラブ` は「高」であって「中学校」ではないのでクラブ判定でよい）
  ['三重高クラブ', 'club'],
  // 明確なクラブ
  ['鉢盛クラブ', 'club'],
  ['静内クラブ', 'club'],
  ['登別市地域クラブ', 'club'],
  ['渋川スポ少', 'club'],
  ['浜頓別ソフトテニス少年団', 'club'],
  ['筑西STC', 'club'],
  ['桜S.T.C', 'club'],
  ['白神JSTC', 'club'],
  ['今治S.O.C', 'club'],
  ['国分寺JSC', 'club'],
  ['王寺ユースクラブ', 'club'],
  ['一関協会', 'club'],
  // ラテン文字（全中の学校名には出現しないことを検算済み）
  ['iNexus', 'club'],
  ['GifuTed', 'club'],
  ['LIBERTA', 'club'],
  ["M's", 'club'],
  ['KSA１９６２', 'club'],
  ['NCT長崎', 'club'],
  ['N.N', 'club'],
  // カタカナ命名のクラブ
  ['スマイリー', 'club'],
  ['レペゼン千葉', 'club'],
  ['ネクサス兵庫', 'club'],
  ['レグルス鹿島', 'club'],
];
for (const [name, expected] of EXPECTED) {
  const actual = classifyTeamAffiliation(name);
  check(`${name} → ${expected}`, actual === expected, `実際は ${actual}`);
}

// ---- 2. 全中の全団体を年度別に分類して一覧表示 ----
console.log('\n[2] 全中の年度別内訳');
const data = getClubTransition(TOURNAMENT_ID);
if (!data) {
  console.log('  FAIL データが取得できない');
  failures += 1;
} else {
  for (const y of data.years) {
    const pct = (y.clubShare * 100).toFixed(1);
    console.log(`\n  ${y.year}年度: 全${y.totalTeams}団体 / クラブ${y.clubTeams}(${pct}%) 学校${y.schoolTeams} 判定不能${y.unknownTeams}`);
    console.log(`    クラブ: ${y.clubs.map((c) => c.name).join(' / ') || '(なし)'}`);
  }

  // 制度変更（2023年度）の前後で明確に増えているか
  const before = data.years.filter((y) => y.year < data.policyYear);
  const after = data.years.filter((y) => y.year >= data.policyYear);
  const maxBefore = Math.max(...before.map((y) => y.clubShare), 0);
  const minAfter = Math.min(...after.map((y) => y.clubShare), 1);
  console.log('');
  check(
    `制度変更前(${data.policyYear}年度未満)の最大クラブ比率 < 制度変更後の最小クラブ比率`,
    maxBefore < minAfter,
    `前=${(maxBefore * 100).toFixed(1)}% 後=${(minAfter * 100).toFixed(1)}%`,
  );
  check(
    'クラブ比率は年を追って単調増加している',
    data.years.every((y, i) => i === 0 || y.clubShare >= data.years[i - 1].clubShare),
  );
}

// ---- 3. 判定不能に落ちた名前を全部出す（下限の甘さを人が確認するため） ----
console.log('\n[3] 判定不能（unknown）に落ちた団体名 — 略称の学校名であることを目視確認する');
const tidDir = path.join(process.cwd(), 'data', 'tournaments', 'details', TOURNAMENT_ID);
for (const y of fs
  .readdirSync(tidDir)
  .filter((n) => /^\d{4}$/.test(n))
  .sort()) {
  const names = new Set<string>();
  for (const f of fs.readdirSync(path.join(tidDir, y)).filter((n) => n.endsWith('.json'))) {
    const parsed = JSON.parse(fs.readFileSync(path.join(tidDir, y, f), 'utf-8'));
    for (const p of parsed.participants ?? []) {
      if (p?.team) names.add(p.team as string);
    }
  }
  const unknown = [...names].filter((n) => classifyTeamAffiliation(n) === 'unknown').sort();
  console.log(`\n  ${y}年度 (${unknown.length}件): ${unknown.join(' / ')}`);
}

console.log(`\n${failures === 0 ? 'すべて通過' : `${failures}件 失敗`}`);
process.exit(failures === 0 ? 0 : 1);
