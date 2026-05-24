#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

import iconv from 'iconv-lite';

import { extractLocalSourceLinks } from './extract-local-source-links.mjs';
import {
  createIgnoredMatcher,
  normalizeLocalTournamentCandidate,
} from './normalize-local-tournament-candidate.mjs';

const USER_AGENT = 'softeni-pick-local-crawler/1.0 (+https://softeni-pick.com)';
const DEFAULT_TIMEOUT_MS = 15000;

const dataDir = path.join(process.cwd(), 'data', 'local-sources');
const prefectureSourcesPath = path.join(dataDir, 'prefecture-sources.json');
const detectedDocumentsPath = path.join(dataDir, 'detected-documents.json');
const ignoredDocumentsPath = path.join(dataDir, 'ignored-documents.json');
const prefecturesPath = path.join(process.cwd(), 'data', 'prefectures.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

function getSourceUrls(source) {
  const candidates = Array.isArray(source.sourceUrls)
    ? source.sourceUrls
    : [source.sourceUrl];

  return candidates
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const options = {
    prefecture: null,
    dryRun: false,
    minConfidence: 0.6,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg.startsWith('--prefecture=')) {
      options.prefecture = arg.slice('--prefecture='.length);
      continue;
    }

    if (arg.startsWith('--min-confidence=')) {
      const value = Number(arg.slice('--min-confidence='.length));
      if (Number.isNaN(value) || value < 0 || value > 1) {
        throw new Error('min-confidence must be a number between 0 and 1');
      }
      options.minConfidence = value;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function getCharset(contentType) {
  const match = /charset=([^;]+)/i.exec(String(contentType || ''));
  return match?.[1]?.trim() || null;
}

function decodeBody(buffer, contentType) {
  const charset = getCharset(contentType);
  if (charset && iconv.encodingExists(charset)) {
    return iconv.decode(buffer, charset);
  }

  if (charset) {
    try {
      return new TextDecoder(charset).decode(buffer);
    } catch {
      return buffer.toString('utf-8');
    }
  }

  return buffer.toString('utf-8');
}

async function fetchHtml(sourceUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());
    const html = decodeBody(buffer, contentType);

    return {
      html,
      sourcePageUrl: response.url || sourceUrl,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function ensurePrefectureSlugs(prefectureSources) {
  const prefectures = readJson(prefecturesPath);
  const validIds = new Set(prefectures.map((prefecture) => prefecture.id));

  for (const source of prefectureSources) {
    if (!validIds.has(source.slug)) {
      throw new Error(`Unknown prefecture slug: ${source.slug}`);
    }

    if (getSourceUrls(source).length === 0) {
      throw new Error(
        `No source URL configured for prefecture slug: ${source.slug}`,
      );
    }
  }
}

function sortDetectedDocuments(documents) {
  return [...documents].sort((a, b) => {
    const prefecture = a.prefectureSlug.localeCompare(b.prefectureSlug, 'ja');
    if (prefecture !== 0) return prefecture;

    const detectedAt = String(a.detectedAt).localeCompare(String(b.detectedAt));
    if (detectedAt !== 0) return detectedAt;

    return String(a.title).localeCompare(String(b.title), 'ja');
  });
}

function getCurrentFiscalYear(date = new Date()) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 4 ? year : year - 1;
}

function shouldKeepCandidateForFiscalYear(candidate, fiscalYear) {
  const inferredYear = candidate.inferred?.year;
  if (typeof inferredYear !== 'number') {
    return true;
  }

  return inferredYear === fiscalYear;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prefectureSources = readJson(prefectureSourcesPath);
  const detectedDocuments = readJson(detectedDocumentsPath);
  const ignoredDocuments = readJson(ignoredDocumentsPath);

  ensurePrefectureSlugs(prefectureSources);

  const ignoredMatcher = createIgnoredMatcher(ignoredDocuments);
  const existingById = new Map(
    detectedDocuments.map((document) => [document.id, document]),
  );
  const nextById = new Map(
    detectedDocuments.map((document) => [document.id, document]),
  );
  const currentFiscalYear = getCurrentFiscalYear();

  const selectedSources = prefectureSources.filter((source) =>
    options.prefecture ? source.slug === options.prefecture : true,
  );
  const totalSourceUrls = selectedSources.reduce(
    (count, source) => count + getSourceUrls(source).length,
    0,
  );

  if (options.prefecture && selectedSources.length === 0) {
    throw new Error(`Unknown prefecture source: ${options.prefecture}`);
  }

  const stats = {
    sources: totalSourceUrls,
    crawled: 0,
    skipped: 0,
    new: 0,
    updated: 0,
    ignored: 0,
    errors: 0,
    dryRun: options.dryRun,
  };

  for (const source of selectedSources) {
    if (source.enabled === false) {
      stats.skipped += getSourceUrls(source).length;
      console.log(`[skip] ${source.slug}: enabled=false`);
      continue;
    }

    if (source.crawlLevel === 'manual') {
      stats.skipped += getSourceUrls(source).length;
      console.log(`[skip] ${source.slug}: crawlLevel=manual`);
      continue;
    }

    if (source.crawlLevel === 'html_detail') {
      console.warn(
        `[warn] ${source.slug}: crawlLevel=html_detail is reserved in v1, fallback to link_only`,
      );
    }

    const seenIds = new Set();
    for (const sourceUrl of getSourceUrls(source)) {
      try {
        const { html, sourcePageUrl } = await fetchHtml(sourceUrl);
        stats.crawled += 1;

        const links = extractLocalSourceLinks(html);

        for (const link of links) {
          const normalized = normalizeLocalTournamentCandidate({
            source: {
              ...source,
              sourceUrl,
            },
            sourcePageUrl,
            link,
            ignoredMatcher,
          });

          if (!normalized) {
            continue;
          }

          if (normalized.ignored) {
            stats.ignored += 1;
            continue;
          }

          if (
            !shouldKeepCandidateForFiscalYear(normalized, currentFiscalYear)
          ) {
            stats.ignored += 1;
            continue;
          }

          if ((normalized.inferred?.confidence || 0) < options.minConfidence) {
            stats.ignored += 1;
            continue;
          }

          if (seenIds.has(normalized.id)) {
            continue;
          }
          seenIds.add(normalized.id);

          const existing = existingById.get(normalized.id);
          const now = new Date().toISOString();
          if (existing) {
            nextById.set(normalized.id, {
              ...existing,
              ...normalized,
              detectedAt: existing.detectedAt,
              lastSeenAt: now,
              status: existing.status,
              hash: existing.hash,
            });
            stats.updated += 1;
            continue;
          }

          nextById.set(normalized.id, {
            ...normalized,
            detectedAt: now,
            lastSeenAt: now,
            status: 'new',
          });
          stats.new += 1;
        }
      } catch (error) {
        stats.errors += 1;
        console.error(
          `[error] ${source.slug} (${sourceUrl}): ${error.message}`,
        );
      }
    }
  }

  const nextDocuments = sortDetectedDocuments([...nextById.values()]);
  if (!options.dryRun) {
    writeJson(detectedDocumentsPath, nextDocuments);
  }

  console.log(JSON.stringify(stats));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
