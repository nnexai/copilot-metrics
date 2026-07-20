'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const DEFAULT_CHUNK_SIZE = 64 * 1024;
const CONTINUITY_WINDOW_SIZE = 4 * 1024;

function fileObservation(stat) {
  return {
    size: stat.size,
    mtimeMs: Math.trunc(stat.mtimeMs),
    identity: Number.isFinite(stat.dev) && Number.isFinite(stat.ino)
      ? `${stat.dev}:${stat.ino}`
      : null,
  };
}

function rejectedRange(observation, reason) {
  return {
    records: [],
    warnings: [],
    nextByte: 0,
    completedLines: 0,
    observation,
    resetRequired: true,
    resetReason: reason,
  };
}

function continuityAt(fd, endByte) {
  const length = Math.min(CONTINUITY_WINDOW_SIZE, endByte);
  const bytes = Buffer.allocUnsafe(length);
  const position = endByte - length;
  const bytesRead = length === 0 ? 0 : fs.readSync(fd, bytes, 0, length, position);
  if (bytesRead !== length) return null;
  return {
    algorithm: 'sha256',
    bytes: length,
    digest: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

function readJsonlContinuity(file, endByte) {
  if (!Number.isSafeInteger(endByte) || endByte < 0 || !fs.existsSync(file)) return null;
  const stat = fs.statSync(file);
  if (endByte > stat.size) return null;
  const fd = fs.openSync(file, 'r');
  try {
    return continuityAt(fd, endByte);
  } finally {
    fs.closeSync(fd);
  }
}

function parseCompleteLine(bytes, lineNumber, records, warnings) {
  const content = bytes.length > 0 && bytes[bytes.length - 1] === 0x0d
    ? bytes.subarray(0, bytes.length - 1)
    : bytes;
  let line;
  try {
    line = new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    warnings.push({
      code: 'malformed_jsonl',
      line: lineNumber,
      message: 'Invalid UTF-8 in JSONL record.',
    });
    return;
  }
  if (!line.trim()) return;
  try {
    records.push({ line: lineNumber, value: JSON.parse(line) });
  } catch (error) {
    warnings.push({
      code: 'malformed_jsonl',
      line: lineNumber,
      message: error.message,
    });
  }
}

function readJsonlRange(file, options) {
  if (!fs.existsSync(file)) {
    return {
      records: [],
      warnings: [],
      nextByte: 0,
      completedLines: 0,
      observation: null,
    };
  }

  const stat = fs.statSync(file);
  const observation = fileObservation(stat);
  const startByte = Number(options.startByte);
  const completedLines = Number(options.completedLines);
  if (!Number.isSafeInteger(startByte) || startByte < 0
    || !Number.isSafeInteger(completedLines) || completedLines < 0
    || (startByte === 0 && completedLines !== 0)) {
    return rejectedRange(observation, 'incompatible_range_metadata');
  }
  if (startByte > stat.size) return rejectedRange(observation, 'offset_beyond_eof');

  const fd = fs.openSync(file, 'r');
  try {
    if (startByte > 0) {
      const boundary = Buffer.allocUnsafe(1);
      const bytesRead = fs.readSync(fd, boundary, 0, 1, startByte - 1);
      options.onRead?.({ position: startByte - 1, length: bytesRead, purpose: 'boundary' });
      if (bytesRead !== 1 || boundary[0] !== 0x0a) {
        return rejectedRange(observation, 'invalid_byte_boundary');
      }
    }

    const requestedChunkSize = Number(options.chunkSize || DEFAULT_CHUNK_SIZE);
    const chunkSize = Number.isSafeInteger(requestedChunkSize) && requestedChunkSize > 0
      ? requestedChunkSize
      : DEFAULT_CHUNK_SIZE;
    const chunk = Buffer.allocUnsafe(chunkSize);
    const records = [];
    const warnings = [];
    let carry = Buffer.alloc(0);
    let position = startByte;
    let nextByte = startByte;
    let nextLine = completedLines;

    while (position < stat.size) {
      const bytesRead = fs.readSync(fd, chunk, 0, Math.min(chunkSize, stat.size - position), position);
      if (bytesRead <= 0) break;
      options.onRead?.({ position, length: bytesRead, purpose: 'payload' });
      position += bytesRead;
      let pending = carry.length > 0
        ? Buffer.concat([carry, chunk.subarray(0, bytesRead)])
        : chunk.subarray(0, bytesRead);
      let lineStart = 0;
      let newline;
      while ((newline = pending.indexOf(0x0a, lineStart)) !== -1) {
        nextLine += 1;
        parseCompleteLine(pending.subarray(lineStart, newline), nextLine, records, warnings);
        nextByte += newline - lineStart + 1;
        lineStart = newline + 1;
      }
      carry = Buffer.from(pending.subarray(lineStart));
    }

    return {
      records,
      warnings,
      nextByte,
      completedLines: nextLine,
      observation,
      continuity: continuityAt(fd, nextByte),
      resetRequired: false,
      resetReason: null,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function readJsonl(file, options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'startByte')) {
    return readJsonlRange(file, options);
  }
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
  readJsonlContinuity,
};
