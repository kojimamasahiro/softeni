/* eslint-disable @typescript-eslint/no-require-imports */
/*
  CLI wrapper for the normalization logic.
  The actual logic lives in tools/shared/normalize-core.js so that the
  browser tools (tools/roundrobin, tools/tournament3) can share it.
  Run with `node` as CommonJS.
*/
const fs = require('fs');
const path = require('path');
const { normalizeResults, serializeOutput } = require(
  path.join(__dirname, '..', 'tools', 'shared', 'normalize-core.js'),
);

// allow overriding filenames via CLI args: node script [input] [output] [entriesMetaPath]
// defaults kept for backward compatibility
const argv = process.argv.slice(2);
if (argv[0] === '-h' || argv[0] === '--help') {
  console.log(
    'Usage: node normalize-to-participants-entries.cjs [input.json] [output.json] [entriesMeta.json]',
  );
  process.exit(0);
}

const src = argv[0]
  ? path.resolve(argv[0])
  : path.join('doubles-none-boys.json');
const out = argv[1] ? path.resolve(argv[1]) : path.join('output.json');
// entriesMetaPath intentionally points to sibling entries folder; keep compatibility
// If the input `src` was provided as a path, compute entriesMetaPath relative
// to that input file's directory so we look for ../entries/<basename(src)>
let entriesMetaPath;
if (argv[2]) {
  entriesMetaPath = path.resolve(argv[2]);
} else if (argv[0]) {
  try {
    const resolvedSrc = path.resolve(argv[0]);
    const srcDir = path.dirname(resolvedSrc);
    const srcBase = path.basename(src);
    entriesMetaPath = path.join(srcDir, '..', 'entries', srcBase);
  } catch (err) {
    // fallback to previous behavior on any error
    entriesMetaPath = path.join('..', 'entries', src);
  }
} else {
  entriesMetaPath = path.join('..', 'entries', src);
}

const data = JSON.parse(fs.readFileSync(src, 'utf8'));

let entriesMeta = null;
try {
  if (fs.existsSync(entriesMetaPath)) {
    entriesMeta = JSON.parse(fs.readFileSync(entriesMetaPath, 'utf8')) || [];
  }
} catch (err) {
  // ignore if missing or parse error
}

const outObj = normalizeResults(data, entriesMeta);
const outStr = serializeOutput(outObj);
fs.writeFileSync(out, outStr, 'utf8');
console.log('wrote', out);
