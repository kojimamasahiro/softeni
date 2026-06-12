#!/usr/bin/env node
// detected-documents.json の accepted 済み予選候補(qualifierType 付き)を
// local_index.json / information/{tournamentId}.json の sourceUrl へ反映する。
//
// 反映ルール:
// - 対象は status === 'accepted' かつ inferred.qualifierType が一致する候補のみ
//   (--allow-new を付けると status === 'new' も対象。dry-run での事前確認用)
// - tournamentId は `highschool-{prefectureSlug}-{qualifierType}-qualifier`
// - local_index.json に大会が無ければ自動登録する(初回のみ)
// - information に該当年度が無ければ sourceUrl のみの年度エントリを追加する
// - 既に sourceUrl が入っている年度は --force が無い限り上書きしない
// - 反映済みの候補には appliedAt / appliedTournamentId を記録し、再実行時はスキップする
//
// usage:
//   node scripts/apply-accepted-qualifiers.mjs --dry-run
//   node scripts/apply-accepted-qualifiers.mjs --type=interhigh
//   node scripts/apply-accepted-qualifiers.mjs --dry-run --allow-new --min-confidence=0.7

import fs from 'fs';
import path from 'path';

import { inferQualifierType } from './normalize-local-tournament-candidate.mjs';

const dataDir = path.join(process.cwd(), 'data');
const localSourcesDir = path.join(dataDir, 'local-sources');
const tournamentsDir = path.join(dataDir, 'tournaments');
const informationDir = path.join(tournamentsDir, 'information');

const QUALIFIER_LABELS = {
  interhigh: '高校総体（インターハイ予選）',
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    force: false,
    allowNew: false,
    type: 'interhigh',
    minConfidence: 0.6,
    documentsPath: path.join(localSourcesDir, 'detected-documents.json'),
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--allow-new') {
      options.allowNew = true;
    } else if (arg.startsWith('--type=')) {
      options.type = arg.slice('--type='.length);
    } else if (arg.startsWith('--min-confidence=')) {
      const value = Number(arg.slice('--min-confidence='.length));
      if (Number.isNaN(value) || value < 0 || value > 1) {
        throw new Error('min-confidence must be a number between 0 and 1');
      }
      options.minConfidence = value;
    } else if (arg.startsWith('--documents=')) {
      options.documentsPath = path.resolve(arg.slice('--documents='.length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!QUALIFIER_LABELS[options.type]) {
    throw new Error(
      `Unknown qualifier type: ${options.type} (known: ${Object.keys(QUALIFIER_LABELS).join(', ')})`,
    );
  }

  return options;
}

function resolveQualifierType(doc) {
  return (
    doc.inferred?.qualifierType ??
    inferQualifierType(
      doc.rawTitle,
      doc.title,
      doc.contextText,
      doc.normalizedUrl,
    )
  );
}

// 年度(4月始まり)を解決する。inferred.year を優先し、無ければ検知日時から推定する。
function resolveFiscalYear(doc) {
  if (typeof doc.inferred?.year === 'number') {
    return doc.inferred.year;
  }
  const detectedAt = doc.detectedAt || doc.lastSeenAt;
  if (!detectedAt) return undefined;
  const date = new Date(detectedAt);
  if (Number.isNaN(date.getTime())) return undefined;
  const month = date.getMonth() + 1;
  return month >= 4 ? date.getFullYear() : date.getFullYear() - 1;
}

// 同一県・同一年度に複数候補がある場合の優先順位:
// confidence 降順 → html を pdf/excel より優先 → lastSeenAt 降順
function pickBestDocument(docs) {
  const typeRank = { html: 0, pdf: 1, excel: 1 };
  return [...docs].sort((a, b) => {
    const conf = (b.inferred?.confidence || 0) - (a.inferred?.confidence || 0);
    if (conf !== 0) return conf;
    const rank =
      (typeRank[a.contentType] ?? 2) - (typeRank[b.contentType] ?? 2);
    if (rank !== 0) return rank;
    return String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || ''));
  })[0];
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  const documents = readJson(options.documentsPath);
  const prefectures = readJson(path.join(dataDir, 'prefectures.json'));
  const localIndexPath = path.join(tournamentsDir, 'local_index.json');
  const localIndex = readJson(localIndexPath);

  const prefNameById = new Map(prefectures.map((p) => [p.id, p.name]));
  const localIndexIds = new Set(localIndex.map((t) => t.tournamentId));

  let prefectureSources = [];
  const prefectureSourcesPath = path.join(
    localSourcesDir,
    'prefecture-sources.json',
  );
  if (fs.existsSync(prefectureSourcesPath)) {
    prefectureSources = readJson(prefectureSourcesPath);
  }
  const officialUrlBySlug = new Map(
    prefectureSources.map((s) => [s.slug, s.sourceUrl]),
  );

  // 対象候補の抽出
  const candidates = documents.filter((doc) => {
    if (doc.appliedAt) return false;
    if (
      doc.status !== 'accepted' &&
      !(options.allowNew && doc.status === 'new')
    )
      return false;
    if ((doc.inferred?.confidence || 0) < options.minConfidence) return false;
    if (resolveQualifierType(doc) !== options.type) return false;
    if (!prefNameById.has(doc.prefectureSlug)) return false;
    return true;
  });

  // (県, 年度) ごとに最良の1件へ集約
  const grouped = new Map();
  for (const doc of candidates) {
    const year = resolveFiscalYear(doc);
    if (!year) continue;
    const key = `${doc.prefectureSlug}::${year}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(doc);
  }

  const summary = {
    applied: [],
    skippedExisting: [],
    registeredTournaments: [],
  };

  let localIndexDirty = false;
  const appliedDocIds = new Set();

  for (const [key, docs] of grouped) {
    const [slug, yearStr] = key.split('::');
    const year = Number(yearStr);
    const doc = pickBestDocument(docs);
    const prefName = prefNameById.get(slug);
    const tournamentId = `highschool-${slug}-${options.type}-qualifier`;
    const label = `${prefName}${QUALIFIER_LABELS[options.type]}`;

    // local_index への登録(無ければ)
    if (!localIndexIds.has(tournamentId)) {
      const entry = {
        tournamentId,
        generationId: 'highschool',
        federationId: slug,
        label,
        ...(officialUrlBySlug.get(slug)
          ? { officialUrl: officialUrlBySlug.get(slug) }
          : {}),
      };
      localIndex.push(entry);
      localIndexIds.add(tournamentId);
      localIndexDirty = true;
      summary.registeredTournaments.push(tournamentId);
    }

    // information の年度エントリ
    const infoPath = path.join(informationDir, `${tournamentId}.json`);
    const infos = fs.existsSync(infoPath) ? readJson(infoPath) : [];
    const existing = infos.find((e) => e.year === year);

    if (existing && existing.sourceUrl && !options.force) {
      summary.skippedExisting.push({ tournamentId, year, url: doc.url });
      continue;
    }

    if (existing) {
      existing.sourceUrl = doc.url;
      existing.source = doc.title || existing.source || label;
    } else {
      infos.push({
        year,
        location: prefName,
        startDate: '',
        endDate: '',
        label,
        source: doc.title || label,
        sourceUrl: doc.url,
        categories: [],
      });
      infos.sort((a, b) => a.year - b.year);
    }

    if (!options.dryRun) {
      writeJson(infoPath, infos);
    }
    appliedDocIds.add(doc.id);
    summary.applied.push({ tournamentId, year, url: doc.url });
  }

  if (!options.dryRun && localIndexDirty) {
    writeJson(localIndexPath, localIndex);
  }

  // 反映済みマーク
  if (!options.dryRun && appliedDocIds.size > 0) {
    const now = new Date().toISOString();
    for (const doc of documents) {
      if (appliedDocIds.has(doc.id)) {
        doc.appliedAt = now;
        doc.appliedTournamentId = `highschool-${doc.prefectureSlug}-${options.type}-qualifier`;
      }
    }
    writeJson(options.documentsPath, documents);
  }

  const mode = options.dryRun ? '[dry-run] ' : '';
  console.log(`${mode}type=${options.type}`);
  console.log(`${mode}candidates: ${candidates.length}`);
  console.log(
    `${mode}new tournaments registered: ${summary.registeredTournaments.length}`,
  );
  for (const t of summary.registeredTournaments) {
    console.log(`  + ${t}`);
  }
  console.log(`${mode}sourceUrl applied: ${summary.applied.length}`);
  for (const a of summary.applied) {
    console.log(`  + ${a.tournamentId} ${a.year} <- ${a.url}`);
  }
  console.log(
    `${mode}skipped (sourceUrl exists): ${summary.skippedExisting.length}`,
  );
  for (const s of summary.skippedExisting) {
    console.log(`  - ${s.tournamentId} ${s.year} (use --force to overwrite)`);
  }
}

main();
