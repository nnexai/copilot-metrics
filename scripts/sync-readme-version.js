#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { version } = require('../package.json');

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has('--write');
const shouldCheck = args.has('--check') || !shouldWrite;
const readmePath = path.join(__dirname, '..', 'README.md');

function syncReadmeVersion(content) {
  return content
    .replace(/copilot-metrics@\d+\.\d+\.\d+/g, `copilot-metrics@${version}`)
    .replace(/not included in `\d+\.\d+\.\d+`/g, `not included in \`${version}\``);
}

const before = fs.readFileSync(readmePath, 'utf8');
const after = syncReadmeVersion(before);

if (shouldWrite && after !== before) {
  fs.writeFileSync(readmePath, after);
}

if (shouldCheck && after !== before) {
  throw new Error(`README.md has stale package versions. Run: npm run sync:readme-version`);
}
