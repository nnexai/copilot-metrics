'use strict';

const fs = require('node:fs');

function readJsonl(file, options = {}) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const records = [];
  const warnings = [];
  const afterLine = Number(options.afterLine || 0);

  text.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    if (lineNumber <= afterLine || !line.trim()) return;
    try {
      records.push({ line: lineNumber, value: JSON.parse(line) });
    } catch (error) {
      warnings.push({
        code: 'malformed_jsonl',
        line: lineNumber,
        message: error.message,
      });
    }
  });

  return { records, warnings };
}

module.exports = {
  readJsonl,
};
