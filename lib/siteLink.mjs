// 試合（score 系）と掲載大会データの対応付けを解決する Node 用ヘルパー。
//
// 設計は docs/wiki/score-site-link.md を参照。
// - 掲載大会に紐づく試合の URL プレフィックスは、検証済みの大会データからのみ生成する
// - 試合レコードのフリーテキスト由来フィールド（tournament_gender 等）だけでは確定させない
// - 解決できない試合（野良試合）は null を返し、ネスト URL を出さない
//
// ビルド時（generate-beta-matches-json.mjs / 逆引き表生成）にのみ使う。
// 結果は公開 JSON の match.siteLink にベイクされ、ページ側は fs を触らずに読む。

import fs from 'fs';
import path from 'path';

const parseEntryNo = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(String(value).trim());
  return Number.isFinite(numeric) ? numeric : null;
};

const readJsonIfExists = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

// 大会カテゴリ詳細ファイルに、指定 entryNo がエントリーとして存在するか
const detailContainsEntryNos = (detail, entryNos) => {
  const entries = Array.isArray(detail?.entries) ? detail.entries : [];
  const known = new Set(
    entries
      .map((entry) => parseEntryNo(entry?.entryNo))
      .filter((value) => value !== null),
  );
  return entryNos.every((entryNo) => known.has(entryNo));
};

/**
 * 試合から siteLink（{ tournamentPath, entryNos }）を解決する。
 * 紐付けできない場合は null（= 野良試合扱い）。
 *
 * @param {object} match 公開スナップショットの試合データ
 * @param {{ detailsRoot: string }} options data/tournaments/details の絶対パス
 * @returns {{ tournamentPath: string, entryNos: number[] } | null}
 */
export const resolveMatchSiteLink = (match, { detailsRoot }) => {
  if (!match) return null;

  const generation = match.tournament_generation;
  const tournamentId = match.tournament_id;
  const year = match.tournament_year;
  const gender = match.tournament_gender;
  const gameCategory = match.tournament_category;

  if (!generation || !tournamentId || !year || !gender || !gameCategory) {
    return null;
  }

  const entryA = parseEntryNo(match.team_a_entry_number);
  const entryB = parseEntryNo(match.team_b_entry_number);
  if (entryA === null || entryB === null) {
    return null;
  }
  const entryNos = [entryA, entryB];

  const yearDir = path.join(detailsRoot, tournamentId, String(year));
  if (!fs.existsSync(yearDir)) {
    return null;
  }

  // ファイル名は `{gameCategory}-{age}-{gender}.json`。
  // gameCategory / gender が一致する候補から、entryNo を含むものを選ぶ。
  let candidateFiles;
  try {
    candidateFiles = fs
      .readdirSync(yearDir)
      .filter((fileName) => fileName.endsWith('.json'));
  } catch {
    return null;
  }

  const matchingFiles = candidateFiles.filter((fileName) => {
    const categoryId = fileName.replace(/\.json$/, '');
    const [category, , fileGender] = categoryId.split('-');
    return category === gameCategory && fileGender === gender;
  });

  for (const fileName of matchingFiles) {
    const detail = readJsonIfExists(path.join(yearDir, fileName));
    if (!detail) continue;
    if (!detailContainsEntryNos(detail, entryNos)) continue;

    const categoryId = fileName.replace(/\.json$/, '');
    const [, age = 'none'] = categoryId.split('-');
    const tournamentPath = `/tournaments/${generation}/${tournamentId}/${year}/${gameCategory}/${age}/${gender}`;

    return { tournamentPath, entryNos };
  }

  return null;
};
