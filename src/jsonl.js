'use strict';

const fs = require('node:fs');

function readJsonl(file) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const records = [];
  const warnings = [];

  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      records.push({ line: index + 1, value: JSON.parse(line) });
    } catch (error) {
      warnings.push({
        code: 'malformed_jsonl',
        line: index + 1,
        message: error.message,
      });
    }
  });

  return { records, warnings };
}

module.exports = {
  readJsonl,
};
