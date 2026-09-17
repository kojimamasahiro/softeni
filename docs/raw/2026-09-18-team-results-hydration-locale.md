# 年度別結果ページの hydration mismatch（localeCompare のロケール依存）

日付: 2026-09-18
対象: `src/components/Tournament/TeamResults.tsx`（「チーム別成績」ブロック）

## 症状

`npm run dev` で高校の団体・個人の年度別結果ページを開くと React の hydration error が出る。

```
Hydration failed because the server rendered HTML didn't match the client
```

Next の dev overlay は `TeamResults.tsx` のチーム名リンク
（`<Link href={/highschool/${gender}/${prefectureId}/${teamId}}>`）を指し、同じ位置の
href が SSR とクライアントで別チームになっていた。

再現ページ:

- `/tournaments/highschool/highschool-senbatsu/2024/team/none/boys/`
- `/tournaments/highschool/highschool-championship/2026/team/none/boys/`

2026-09-18 の団体戦まわりの変更（ADR-020）より前から存在する不具合。

## 原因

チームカードの並び替えの同点処理が **ロケール未指定の `localeCompare`** だった。

```ts
// 修正前
arr.sort((a, b) => {
  if (aBest !== bBest) return aBest - bBest;
  return a.team.localeCompare(b.team); // ← ロケール未指定
});
```

`resultPriority()` は 優勝=1 / 準優勝=2 / ベスト4=3 / ベスト8=4 の4段階しかないため、
**ベスト4は2校、ベスト8は4校が必ず同点**になり、この同点処理が毎回効く。

ロケール未指定の `localeCompare` は実行環境の既定ロケールに従う。実測:

| 実行環境 | `new Intl.Collator().resolvedOptions().locale` |
| --- | --- |
| Node 22（SSR） | `en-US` |
| Chrome（日本語設定） | `ja` |

漢字の照合順序は `en-US`（root 照合＝ほぼコードポイント順）と `ja`（読み順の tailoring）で違う。

```
['三重','岡崎城西','上宮','和歌山北']
  en-US → 三重, 上宮, 和歌山北, 岡崎城西
  ja    → 岡崎城西, 三重, 上宮, 和歌山北
```

つまり SSR とクライアントでカードの並びが変わり、同じ位置の `<Link>` の href が
食い違って hydration mismatch になっていた。実際の 2026 インターハイ男子団体では

- SSR（en-US）: 高田商 > 尽誠学園 > 上宮 > 岡崎城西 > 三重 > **明徳義塾** > 東北 > 都城商
- クライアント（ja）: 高田商 > 尽誠学園 > 岡崎城西 > 上宮 > 三重 > **都城商** > 東北 > 明徳義塾

となり、報告にあった「server `kochi/meitokugijuku` / client 側は別校」と一致する。

メンバー（選手名）の並び替え（`displayParts[0].text.localeCompare(...)`）も同じ問題を持っていた。

### 原因ではなかったもの（調査済み）

- `lib/packedPageData.ts` の pack/unpack: 配列順を完全に保存する素直な変換で、非決定性なし
- `highschoolTeamLinks` prop: キー引きの `Record` なので順序に依存しない
- `.sort((a, b) => a.resultOrder - b.resultOrder)` 自体: V8 の sort は安定なので、
  入力順が同じなら結果も同じ。壊れていたのは同点時の比較関数のほう

## 対応

1. `localeCompare` に `'ja'` を明示（リポジトリ内の他の並び替えは元から `'ja'` 指定が大半だった）。
   実行環境の既定ロケールに依存しなくなり、SSR とクライアントで同じ並びになる。
2. React の `key` を `key={team}`（チーム名）から bucket キー（高校の部は `team::prefecture`）に変更。
   高校の部は都道府県込みでグルーピングしているため、チーム名だけだと同名校で key が衝突する。
   実データにも該当あり:
   - `highschool-championship/2013/doubles-none-boys.json` 高田（奈良県 / 岩手県）
   - `highschool-championship/2014/doubles-none-girls.json` 高田（奈良県 / 岩手県）
   - `highschool-championship/2024/doubles-none-boys.json` 甲府南（都道府県なし / 山梨県）
3. チーム名が完全一致した場合の最終同点処理として bucket キーを比較に足した。

## 検証

`npm run dev`（preview 設定 "dev"）で確認。

- 上記2ページとも新規タブでの初回ロードで hydration error が消えた
- SSR HTML（curl）の href 順と、hydration 後の DOM の href 順が一致
- `highschool-championship/2014/doubles/none/girls`（同名校「高田」2件）もエラーなし
- `npx tsc --noEmit` / `npx eslint src/components/Tournament/TeamResults.tsx` ともにクリーン

残っているコンソールエラーは `adsbygoogle.push() error: No slot size for availableWidth=0` のみ。
これはプレビュー幅が 0 のときに AdSense が出す既知のもので、今回の件とは無関係。

## 波及（未対応・低リスク）

`MatchResults.tsx` と `TournamentBracket.tsx` にも `String(x.round).localeCompare(String(y.round))`
というロケール未指定の比較があるが、いずれも `roundRank()` が同値になったときのフォールバックで、
実データのラウンド名（1回戦 / 2回戦 / 3回戦 / 準々決勝 / 準決勝 / 決勝）は `roundRank()` で
すべて別の値になるため到達しない。今回は触っていない。

## Compile Log

docs/wiki へ compile した内容と、意図的に載せなかった内容。

| 項目 | 扱い | 理由 |
| --- | --- | --- |
| 「SSR とクライアントで結果が変わる処理を書かない」規約（locale 明示・リスト key） | wiki `architecture.md` に採用 | 今後も守るべき横断的な実装規約のため |
| 症状・dev overlay の見え方 | 除外 | 修正済みで、現在の仕様ではないため |
| ロケール別の照合順序の実測表・2026 インターハイの並び比較 | 除外 | 測定ログなので raw に置く |
| 同名校の実データ3件の一覧 | 除外 | 時点依存のデータ事実。規約（key を一意にする）だけ wiki に残す |
| `MatchResults` / `TournamentBracket` の未対応箇所 | 除外 | 現状到達しないため仕様に書くことがない。再燃したらこの note を参照する |
| packedPageData・highschoolTeamLinks が原因でなかったこと | 除外 | 再調査防止の価値はあるが、wiki の該当ページがどれも予算超過のため raw 止まりにする |
