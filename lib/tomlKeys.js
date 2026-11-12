/**
 * Just enough TOML to tell which keys a file already defines, without re-emitting it.
 *
 * `pos-cli ai init` appends to Codex's TOML rather than rewriting it (rewriting reformats the file
 * and drops its comments), so what it needs is narrower than a parser: given a key path such as
 * `mcp_servers.platformos-cli`, is it already defined, in ANY of the spellings TOML allows? An
 * appended table that redefines a key makes the whole file invalid, and Codex then refuses it.
 *
 * Recognised, line by line:
 *   `[a.b]`, `[ a . "b" ]`, `['a'.b]`          table headers, bare, quoted or literal keys
 *   `b.c = …` under `[a]`                        dotted keys, which define `a.b` implicitly
 *   `b = { … }` under `[a]`, `a = { … }`         inline tables
 * Not recognised: keys inside multi-line strings or arrays, which no config this touches carries.
 */

const BARE_KEY = /^[A-Za-z0-9_-]+/;
const BASIC_KEY = /^"((?:[^"\\]|\\.)*)"/;
const LITERAL_KEY = /^'([^']*)'/;

/** `a . "b.c" . 'd'` -> `['a', 'b.c', 'd']`, or null when it is not a key. */
const parseKeyPath = (source) => {
  const parts = [];
  let rest = source.trim();
  for (;;) {
    let match;
    if ((match = BASIC_KEY.exec(rest))) {
      try {
        parts.push(JSON.parse(`"${match[1]}"`));
      } catch {
        return null;
      }
    } else if ((match = LITERAL_KEY.exec(rest))) {
      parts.push(match[1]);
    } else if ((match = BARE_KEY.exec(rest))) {
      parts.push(match[0]);
    } else {
      return null;
    }
    rest = rest.slice(match[0].length).trimStart();
    if (rest === '') return parts;
    if (rest[0] !== '.') return null;
    rest = rest.slice(1).trimStart();
  }
};

/**
 * `[a.b] # c` -> `{ array: false, key: 'a.b' }`, or null when the line is not a header.
 *
 * Scanned rather than matched: the header ends at the first `]` outside quotes, and a comment
 * after it may hold a `]` of its own (`[mcp_servers] # see [docs]`), which a greedy pattern would
 * take as the end and so lose the table.
 */
const headerOf = (source) => {
  const opening = /^\s*(\[\[?)/.exec(source);
  if (!opening) return null;
  const array = opening[1] === '[[';
  let quote = null;
  for (let at = opening[0].length; at < source.length; at += 1) {
    const char = source[at];
    if (quote) {
      if (char === '\\' && quote === '"') at += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ']') {
      const closing = array ? ']]' : ']';
      if (source.slice(at, at + closing.length) !== closing) return null;
      if (!/^\s*(?:#.*)?$/.test(source.slice(at + closing.length))) return null;
      return { array, key: source.slice(opening[0].length, at) };
    }
  }
  return null;
};
// The key ends at the first `=` outside quotes; a quoted key holding `=` is not worth the code.
const KEY_VALUE = /^\s*([^=#\s[][^=#]*?)\s*=\s*(.*)$/;

/**
 * Every definition in `text`, in order: `{ kind: 'table' | 'key', path, line, table?, value? }`.
 * `path` is absolute — a key's path starts with `table`, the header it sits under.
 */
const definitions = (text) => {
  const found = [];
  let table = [];
  text.split(/\r?\n/).forEach((source, line) => {
    const header = headerOf(source);
    if (header) {
      const parsed = parseKeyPath(header.key);
      table = parsed ?? [];
      if (parsed && !header.array) found.push({ kind: 'table', path: parsed, line });
      return;
    }
    const pair = KEY_VALUE.exec(source);
    if (!pair) return;
    const key = parseKeyPath(pair[1]);
    if (key) found.push({ kind: 'key', path: [...table, ...key], table, line, value: pair[2] });
  });
  return found;
};

const startsWith = (path, prefix) => prefix.every((part, index) => path[index] === part);

/**
 * Whether `keyPath` can be appended as `[keyPath]`:
 *   `present` — it is already defined: by its own header, or by a dotted or inline key that
 *               reaches it from a table above it;
 *   `blocked` — a parent is defined as a value or inline table, which TOML does not let a later
 *               table extend, so appending would break the file;
 *   `absent`  — appending is safe. A header BELOW it (`[a.b.env]` for `a.b`) leaves it absent:
 *               TOML allows the parent table to be defined after its sub-table.
 */
const keyState = (text, keyPath) => {
  let state = 'absent';
  for (const { kind, path, table } of definitions(text)) {
    if (kind === 'table') {
      if (path.length === keyPath.length && startsWith(path, keyPath)) state = 'present';
    } else if (table.length < keyPath.length && startsWith(path, keyPath)) {
      state = 'present';
    } else if (path.length < keyPath.length && startsWith(keyPath, path)) {
      return 'blocked';
    }
  }
  return state;
};

export { parseKeyPath, definitions, keyState };
