#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { runHookLogger } = require('../src/hook-logger');

runHookLogger(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  env: process.env,
  cwd: process.cwd(),
}).then(() => {
  const reportPath = process.env.COPILOT_METRICS_HOOK_MODULE_REPORT;
  if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(Object.keys(require.cache), null, 2)}\n`);
}).catch((error) => {
  const message = error && error.message ? error.message : String(error);
  process.stderr.write(`copilot-metrics-hook: ${message}\n`);
  process.exitCode = 1;
});
