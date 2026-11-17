/**
 * Small, checked edits to a TOML file that is never re-emitted.
 *
 * Re-emitting a user's TOML reformats it and drops its comments, so `pos-cli ai init` edits the
 * text — appends a table, inserts or replaces one line. Every edit is then held to one rule: the
 * new text must parse to exactly the document the edit meant to produce. An edit that would break
 * the file or change anything else (an inline table that cannot be extended, a line that only
 * looked like a header because it sat inside a multi-line string) comes back as `null`, and the
 * caller shows the user what to add instead of writing.
 */

import { isDeepStrictEqual } from 'util';
import { parse } from 'smol-toml';

const stripBom = (text) => (text.startsWith('\uFEFF') ? text.slice(1) : text);

/** Parsed into plain objects, so a result compares equal to one built by hand. Throws on bad TOML. */
const parseToml = (text) => structuredClone(parse(stripBom(text ?? '')));

const isTable = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

/**
 * TOML basic strings accept the escapes JSON emits, so `JSON.stringify` is right for the values
 * written here; anything it gets wrong fails the check in `checked`.
 */
const tomlString = (value) => JSON.stringify(String(value));

/** A key, bare when it can be. */
const tomlKey = (key) => (/^[A-Za-z0-9_-]+$/.test(key) ? key : tomlString(key));

const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');

/** `text` with `block` (written with `\n`) appended as a paragraph of its own, in the file's line endings. */
const appendBlock = (text, block) => {
  const existing = text ?? '';
  const eol = eolOf(existing);
  const separator = existing === '' || existing.endsWith(eol + eol) ? '' : existing.endsWith('\n') ? eol : eol + eol;
  return `${existing}${separator}${block.split('\n').join(eol)}${eol}`;
};

/** One line on its own, parsed; `null` when it is not a complete TOML document by itself. */
const parseLine = (line) => {
  try {
    return parseToml(line.replace(/\r$/, ''));
  } catch {
    return null;
  }
};

/** The key path a lone `[a."b"]` header line defines, or null. Parsed by the parser, not by hand. */
const headerPath = (line) => {
  if (!/^\s*\[(?!\[)/.test(line)) return null;
  let node = parseLine(line);
  const keys = [];
  while (isTable(node) && Object.keys(node).length === 1) {
    const [key] = Object.keys(node);
    keys.push(key);
    node = node[key];
  }
  return isTable(node) && Object.keys(node).length === 0 && keys.length > 0 ? keys : null;
};

/**
 * `text` with one line in `[keyPath]` set to `key = value`: the existing `key` line replaced, or a
 * new line inserted after the header. `null` when no such header line is found.
 */
const setInTable = (text, keyPath, key, valueText) => {
  const lines = text.split('\n');
  const header = lines.findIndex((line) => isDeepStrictEqual(headerPath(line), keyPath));
  if (header === -1) return null;

  const cr = lines[header].endsWith('\r') ? '\r' : '';
  const assignment = `${tomlKey(key)} = ${valueText}`;
  for (let at = header + 1; at < lines.length && headerPath(lines[at]) === null; at += 1) {
    const parsed = parseLine(lines[at]);
    if (parsed && Object.keys(parsed).length === 1 && Object.hasOwn(parsed, key)) {
      lines[at] = assignment + (lines[at].endsWith('\r') ? '\r' : '');
      return lines.join('\n');
    }
  }
  lines.splice(header + 1, 0, assignment + cr);
  return lines.join('\n');
};

/** `after` when it parses to exactly `expected`, otherwise null. */
const checked = (after, expected) => {
  if (after === null) return null;
  try {
    return isDeepStrictEqual(parseToml(after), expected) ? after : null;
  } catch {
    return null;
  }
};

export { appendBlock, checked, isTable, parseToml, setInTable, stripBom, tomlKey, tomlString };
