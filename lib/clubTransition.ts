// lib/clubTransition.ts
//
// 「部活動の地域移行」トラッカー: 大会に出場した団体を『学校部活動』と『地域クラブ』に
// 分類し、年度ごとの内訳を出す。検討記録: docs/raw/2026-08-12-idea-juniorhigh-category-pages.md
// （候補3）。
//
// 背景:
//   日本中学校体育連盟は令和5年度（2023年度）から全国中学校体育大会に
//   「地域クラブ活動の参加資格の特例」を設けた。全中ソフトテニスの出場団体を実際に数えると
//   2022年度1件 → 2023年度9件 → 2024年度17件 → 2025年度38件と、制度の変わり目と
//   データの変わり目が一致する。この事実は一次データからしか出せず、
//   seo.md #8 が言う「farm が構造的に持てない DB 由来の差別化」に当たる。
//
// 分類方針（重要）:
//   **クラブと断定できる積極的な証拠がある場合のみ club とする「下限カウント」**。
//   中学の大会データは出典によって略称表記が混在しており（全中は略称、ブロック大会のPDFは
//   正式名称）、`名寄`（= 名寄市立名寄中学校）や `湊山`（= 米子市立湊山中学校）のように
//   「中学校」を含まない学校名が多数ある。「中学校を含まない＝クラブ」と推定すると
//   2022年度の98団体中74件を誤ってクラブ側に倒してしまい、トレンドが表記ゆれの
//   アーティファクトになる。したがって判定できないものは unknown とし、
//   **クラブ数は常に下限**として扱う（UIにもその旨を明記すること）。
//
//   ラテン文字を含む名前をクラブと見なす規則は、中学の全大会データ（全中・9ブロック・
//   県対抗・クラブ選手権プレ）の全チーム名で検算済み: ラテン2文字以上を含む名前171件のうち、
//   学校マーカー（中学校/中等教育学校/学園/学院/義塾）も含むものは0件だった。
//
// fs を使うため getStaticProps またはビルドスクリプトからのみ import すること。

import fs from 'fs';
import path from 'path';

/** 出場団体の種別。unknown は「判定できない」であって「学校」ではない点に注意。 */
export type TeamAffiliationKind = 'club' | 'school' | 'unknown';

/**
 * 学校であることを示すマーカー。クラブ判定より優先する
 * （例: `三重高クラブ` はクラブだが `早来学園` は学校、`苫小牧市立ウトナイ中学校` は
 * カタカナを含むが学校）。
 *
 * 末尾の `中`（`人吉第一中` `砧南中` など38件）も学校として扱う。全中学大会データで
 * 検算した結果、`中` で終わる名前にカタカナ・ラテン文字を含むものは0件で、
 * クラブが紛れ込む余地が無いことを確認済み。
 *
 * `高等学校` / `高校` を含めているのは、中学の大会データに `四天王寺高校` という
 * 高校名の団体が混入しているため（中高一貫校の表記ゆれと見られるデータ品質問題）。
 * 学校であることは確かなので、クラブ側に倒さないようここで受ける。
 */
const SCHOOL_MARKER = /(中学校|中等教育学校|義務教育学校|学園|学院|義塾|附属|付属|高等学校|高校|中$)/;

/**
 * 地域クラブ・スポーツ少年団であることを示すマーカー。
 * `ＳＴＣ` のような全角表記、`S.T.C` のような区切り入り表記も拾う。
 */
const CLUB_MARKER = new RegExp(
  [
    'クラブ',
    'ｸﾗﾌﾞ',
    'CLUB',
    'ＣＬＵＢ',
    'スポ少',
    'スポーツ少年団',
    '少年団',
    'ジュニア',
    'ユース',
    '協会',
    'S[.・]?T[.・]?C',
    'Ｓ[.・]?Ｔ[.・]?Ｃ',
    'J[.・]?S[.・]?T?[.・]?C',
    'S[.・]?O[.・]?C',
    'Jr',
  ].join('|'),
  'i',
);

/**
 * ラテン文字が2文字以上（= 学校名には現れない命名）。
 * `M's` `N.N` `A.STAR.S` のように区切り記号が挟まる表記があるため、
 * 記号を落としてから数える。
 *
 * 検算: 中学の全大会データでラテン2文字以上を含む名前171件のうち、
 * 学校マーカーも含むものは0件。
 */
const LATIN_SEPARATORS = /[.・\-＿_'’`~×＊*\s（）()]/g;
const LATIN_RUN = /[A-Za-zＡ-Ｚａ-ｚ]{2,}/;

/**
 * カタカナが3文字以上連続する（`スマイリー` `レペゼン千葉` `ネクサス兵庫` など）。
 * 検算: 学校マーカーを持つ名前でカタカナ3連を含むのは `苫小牧市立ウトナイ中学校` の1件のみで、
 * これは学校マーカーが先に効くため誤判定にならない。
 */
const KATAKANA_RUN = /[ァ-ヶー]{3,}/;

/**
 * 団体名を学校 / 地域クラブ / 判定不能に分類する。
 *
 * 判定順序に意味がある:
 *   1. 学校マーカーがあれば school（`三重高クラブ` を誤って school にしないよう、
 *      学校マーカーは「中学校」系に限定してある）
 *   2. クラブマーカー / ラテン文字 / カタカナ連続があれば club
 *   3. どちらでもなければ unknown（略称の学校名が大半だが断定はしない）
 */
export function classifyTeamAffiliation(teamName: string): TeamAffiliationKind {
  const name = teamName.trim();
  if (!name) return 'unknown';
  if (SCHOOL_MARKER.test(name)) return 'school';
  if (CLUB_MARKER.test(name)) return 'club';
  if (LATIN_RUN.test(name.replace(LATIN_SEPARATORS, ''))) return 'club';
  if (KATAKANA_RUN.test(name)) return 'club';
  return 'unknown';
}

/** 1年度ぶんの内訳 */
export interface ClubTransitionYear {
  year: number;
  /** その年度に出場した団体の総数（種目をまたいで重複除去） */
  totalTeams: number;
  /** クラブと断定できた団体数（下限） */
  clubTeams: number;
  /** 学校と断定できた団体数 */
  schoolTeams: number;
  /** どちらとも断定できなかった団体数。略称の学校名が大半（Assumption） */
  unknownTeams: number;
  /** clubTeams / totalTeams。0〜1 */
  clubShare: number;
  /** クラブと判定した団体名（都道府県つき・名前順）。UI で例示に使う */
  clubs: { name: string; prefecture: string | null }[];
}

export interface ClubTransitionData {
  tournamentId: string;
  /** 古い年度が先頭（推移として読ませるため） */
  years: ClubTransitionYear[];
  /** 制度上クラブ参加が可能になった年度。この年を境に線を引く */
  policyYear: number;
  /** policyYear より前にクラブ判定された団体があるか（＝特例前の例外の有無） */
  hasPrePolicyClub: boolean;
}

/**
 * このトラッカーを出す大会の allowlist。
 * 経年比較が成立する（複数年度あり・大会の性格が一貫している）大会に限る。
 * ブロック大会は2026年度の1年分しか無く、県対抗は大会の性格が異なるため対象外
 * （2026-08-12 ユーザー決定: 全中のみ）。
 */
const CLUB_TRANSITION_TOURNAMENTS: Record<string, { policyYear: number }> = {
  'secondaryschool-championship': { policyYear: 2023 },
};

/** モジュールスコープのキャッシュ（ビルド中に大会ハブが何度も呼ぶため） */
const cache = new Map<string, ClubTransitionData | null>();

/**
 * 大会の年度別「学校 / 地域クラブ」内訳を返す。allowlist 外の大会と、
 * 年度が2つ未満で推移として読めない大会は null。
 */
export function getClubTransition(tournamentId: string): ClubTransitionData | null {
  if (cache.has(tournamentId)) return cache.get(tournamentId) ?? null;

  const config = CLUB_TRANSITION_TOURNAMENTS[tournamentId];
  if (!config) {
    cache.set(tournamentId, null);
    return null;
  }

  // nft（output file tracing）が静的解決できるよう、パスセグメントはリテラルで書く。
  // `path.join(process.cwd(), ...ARRAY, 変数)` にすると nft が解決を諦め、
  // リポジトリ全体を再帰 glob する（ビルドが数分遅くなる）。
  // 詳細: docs/wiki/deployment.md「output file tracing（nft）のワイルドカード走査」
  const tidDir = path.join(process.cwd(), 'data', 'tournaments', 'details', tournamentId);
  if (!fs.existsSync(tidDir)) {
    cache.set(tournamentId, null);
    return null;
  }

  const years: ClubTransitionYear[] = [];

  // 年度ディレクトリのみを対象にする。`2024/temp` のような作業用ディレクトリが
  // 年度直下に存在するため、4桁数字であることを明示的に確認する。
  const yearDirs = fs
    .readdirSync(tidDir)
    .filter((y) => /^\d{4}$/.test(y) && fs.statSync(path.join(tidDir, y)).isDirectory())
    .sort();

  for (const y of yearDirs) {
    const yearDir = path.join(tidDir, y);
    // 同一団体が個人戦・団体戦の両方に出るため、名前で重複除去して「出場団体数」にする。
    const teams = new Map<string, string | null>();

    for (const file of fs.readdirSync(yearDir).filter((f) => f.endsWith('.json'))) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(fs.readFileSync(path.join(yearDir, file), 'utf-8'));
      } catch {
        continue;
      }
      const participants = (parsed as { participants?: { team?: string; prefecture?: string }[] })?.participants;
      if (!Array.isArray(participants)) continue;
      for (const p of participants) {
        const team = p?.team?.trim();
        if (!team) continue;
        if (!teams.has(team)) teams.set(team, p?.prefecture ?? null);
      }
    }

    if (teams.size === 0) continue;

    const clubs: { name: string; prefecture: string | null }[] = [];
    let schoolTeams = 0;
    let unknownTeams = 0;

    for (const [name, prefecture] of teams) {
      const kind = classifyTeamAffiliation(name);
      if (kind === 'club') clubs.push({ name, prefecture });
      else if (kind === 'school') schoolTeams += 1;
      else unknownTeams += 1;
    }

    clubs.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    years.push({
      year: Number(y),
      totalTeams: teams.size,
      clubTeams: clubs.length,
      schoolTeams,
      unknownTeams,
      clubShare: clubs.length / teams.size,
      clubs,
    });
  }

  // 1年度しか無い大会は「推移」として読めないので出さない。
  if (years.length < 2) {
    cache.set(tournamentId, null);
    return null;
  }

  const data: ClubTransitionData = {
    tournamentId,
    years,
    policyYear: config.policyYear,
    hasPrePolicyClub: years.some((y) => y.year < config.policyYear && y.clubTeams > 0),
  };

  cache.set(tournamentId, data);
  return data;
}
