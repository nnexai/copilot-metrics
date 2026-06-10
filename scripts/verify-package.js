#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');

execFileSync(process.execPath, ['scripts/sync-readme-version.js', '--check'], {
  encoding: 'utf8',
  stdio: 'inherit',
});

const forbidden = [
  /^\.codex\//,
  /^\.planning\//,
  /^test\//,
  /^copilot-metrics-data\//,
  /^\.copilot-metrics\//,
  /(?:^|\/).*\.sqlite(?:-shm|-wal)?$/,
  /(?:^|\/).*\.db(?:-shm|-wal)?$/,
  /(?:^|\/).*benchmark.*store.*$/,
  /(?:^|\/).*copied.*store.*$/,
  /(?:^|\/).*temp.*db.*$/,
  /(?:^|\/).*otel.*\.jsonl$/,
  /(?:^|\/).*hooks.*\.jsonl$/,
];

const required = [
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'RELEASE.md',
  'LICENSE',
  'bin/copilot-metrics.js',
  'src/cli.js',
  'src/reports.js',
  'skills/copilot-metrics/SKILL.md',
  'scripts/manual-copilot-cli-flow.js',
  'scripts/sync-readme-version.js',
];

const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--silent'], { encoding: 'utf8' });
const [pack] = JSON.parse(output);
const files = pack.files.map((file) => file.path).sort();

const missing = required.filter((file) => !files.includes(file));
if (missing.length) {
  throw new Error(`Package is missing required files: ${missing.join(', ')}`);
}

const blocked = files.filter((file) => forbidden.some((pattern) => pattern.test(file)));
if (blocked.length) {
  throw new Error(`Package includes forbidden files: ${blocked.join(', ')}`);
}

process.stdout.write([
  `Package verification passed: ${pack.name}@${pack.version}`,
  `Tarball: ${pack.filename}`,
  `Files: ${files.length}`,
  `Unpacked size: ${pack.unpackedSize} bytes`,
].join('\n'));
process.stdout.write('\n');
