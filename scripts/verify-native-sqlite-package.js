#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const pkg = require('../package.json');

const root = path.join(__dirname, '..');
const fixtures = path.join(root, 'test', 'fixtures');

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  });
}

function main() {
  const packOutput = run('npm', ['pack', '--silent', '--json']);
  const [pack] = JSON.parse(packOutput);
  const tarball = path.join(root, pack.filename);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-metrics-native-'));
  const home = path.join(temp, 'home');
  try {
    run('npm', ['init', '-y'], { cwd: temp, stdio: 'ignore' });
    run('npm', ['install', tarball], { cwd: temp, stdio: 'ignore' });
    const nativeVersion = run(process.execPath, ['-e', "process.stdout.write(require('better-sqlite3/package.json').version)"], { cwd: temp });
    const bin = path.join(temp, 'node_modules', '.bin', process.platform === 'win32' ? 'copilot-metrics.cmd' : 'copilot-metrics');
    run(bin, ['--help'], { cwd: temp });
    run(bin, ['store', 'init', '--home', home, '--json'], { cwd: temp });
    run(bin, ['import', '--source', 'copilot-cli', '--file', path.join(fixtures, 'copilot-cli-otel.jsonl'), '--home', home, '--json'], { cwd: temp });
    run(bin, ['label', 'session-cli', 'set', 'DEMO-1717', '--home', home, '--json'], { cwd: temp });
    const report = JSON.parse(run(bin, ['report', 'labels', '--home', home, '--json'], { cwd: temp }));
    if (!Array.isArray(report.labels)) throw new Error('Expected labels array in report JSON.');
    process.stdout.write(`${JSON.stringify({
      package: `${pack.name}@${pack.version}`,
      expected_package: `${pkg.name}@${pkg.version}`,
      node: process.version,
      better_sqlite3: nativeVersion,
      labels: report.labels.length,
      native_load: true,
    }, null, 2)}\n`);
  } finally {
    try {
      fs.unlinkSync(tarball);
    } catch {
      // Ignore cleanup failure; verify-package guards packed artifacts.
    }
  }
}

main();
