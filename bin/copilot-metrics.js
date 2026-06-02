#!/usr/bin/env node
'use strict';

const { main } = require('../src/cli');

main(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  env: process.env,
  cwd: process.cwd(),
  commandPath: process.argv[1],
}).catch((error) => {
  const message = error && error.message
    ? error.message
    : error && error.name
      ? error.name
      : String(error);
  process.stderr.write(`copilot-metrics: ${message}\n`);
  process.exitCode = 1;
});
