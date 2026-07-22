import fs from 'fs';
import path from 'path';
import stripAnsi from 'strip-ansi';
import logger from '../logger.js';
import { POS_MODULE_FILE, getModulePath } from './paths.js';

/**
 * Post-install messages — declarative, never executable.
 *
 * A module may ship setup instructions that pos-cli prints after the module is
 * downloaded (e.g. "run this generator next"). This mirrors RubyGems'
 * `post_install_message` and Homebrew's `caveats`: pure text, no code. pos-cli
 * deliberately does NOT run module-supplied code at install time — that is the
 * npm `postinstall` supply-chain hole we are avoiding.
 *
 * A message is sourced, in order, from the installed module on disk:
 *   1. `postInstall.message` in modules/<name>/pos-module.json   (short notes)
 *   2. modules/<name>/POST_INSTALL.md                            (longer content)
 */

const POST_INSTALL_MD = 'POST_INSTALL.md';

// Hard cap so a misbehaving (or malicious) module cannot flood the terminal.
// Anything longer is truncated with a pointer back to the module.
const MAX_MESSAGE_LENGTH = 4000;

// Unicode control chars (General_Category=Cc: C0, DEL, C1), except tab and
// newline. These are the bare control bytes that survive ANSI stripping (e.g.
// \r line-overwrites, BEL, NUL): strip-ansi removes ESC-introduced escape
// sequences, not lone control chars. The v flag set-subtraction (--) names the
// Unicode category and carves out the two we keep, instead of hand-listing
// codepoint gaps. The hard part (the CSI/OSC escape grammar) is still delegated
// to strip-ansi, not hand-rolled.
const CONTROL_CHARS = /[\p{Cc}--[\t\n]]/gv;

/**
 * Strips terminal-unsafe content from module-supplied text. The message comes
 * from a downloaded archive and is therefore untrusted: without this a module
 * could embed ANSI/OSC escape sequences (cursor moves, hyperlinks, colour
 * resets) that manipulate the user's terminal.
 *
 * Escape-sequence removal is delegated to strip-ansi (the battle-tested
 * ansi-regex used across the npm ecosystem, incl. npm itself) rather than
 * hand-rolled; we then drop the few remaining bare control characters, keeping
 * tabs and newlines.
 */
const stripUnsafe = (text) => stripAnsi(text).replace(CONTROL_CHARS, '');

/** Cleans, bounds, and validates a raw message. Returns null when empty. */
const normalize = (raw) => {
  if (typeof raw !== 'string') return null;
  // trimEnd (not trim) preserves any intentional leading indentation; an
  // all-whitespace message collapses to '' here, so a single emptiness check suffices.
  const cleaned = stripUnsafe(raw).trimEnd();
  if (!cleaned) return null;
  if (cleaned.length > MAX_MESSAGE_LENGTH) {
    return `${cleaned.slice(0, MAX_MESSAGE_LENGTH).trimEnd()}\n…(message truncated — see the module README)`;
  }
  return cleaned;
};

/**
 * Reads and transforms a file, returning null when it is absent or unreadable.
 * A single read (no existsSync pre-check) handles the missing-file case via the
 * ENOENT catch; any other read/parse failure is logged at Debug and treated as
 * absent, so a broken or missing file never aborts the caller (post-install
 * messages, installed-version lookups, etc.).
 */
const safeReadFile = (filePath, transform) => {
  try {
    return transform(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') logger.Debug(`[postInstall] could not read ${filePath}: ${e.message}`);
    return null;
  }
};

/**
 * Returns the post-install message for an installed module, or null when the
 * module declares none / is not on disk. Reads the module's OWN manifest under
 * modules/<name>/ — not the project-root manifest.
 */
const readPostInstall = (moduleName) => {
  const dir = getModulePath(moduleName);

  const fromManifest = safeReadFile(path.join(dir, POS_MODULE_FILE), (raw) =>
    normalize(JSON.parse(raw)?.postInstall?.message)
  );
  if (fromManifest) return fromManifest;

  return safeReadFile(path.join(dir, POST_INSTALL_MD), normalize);
};

const BOX_WIDTH = 64;

/**
 * Formats one message: a header/footer rule framing the body on a TTY, a plain
 * labelled block otherwise. The body is left flush (never indented or wrapped) so
 * the commands these messages typically contain stay copy-paste-clean. Both rules
 * are the same total width, and the header grows to fit a long module name.
 */
const formatMessage = (moduleName, message, { isTTY }) => {
  if (!isTTY) {
    return `\npost-install (${moduleName}):\n${message}\n`;
  }
  const header = `── ${moduleName} `;
  const width = Math.max(BOX_WIDTH, header.length);
  const top = header + '─'.repeat(width - header.length);
  const bottom = '─'.repeat(width);
  return `\n${top}\n${message}\n${bottom}\n`;
};

/**
 * Prints post-install messages for the given modules (in the order supplied,
 * de-duplicated). Modules without a message are skipped silently.
 *
 * @param {string[]} moduleNames
 * @param {Object}   [options]
 * @param {boolean}  [options.isTTY]  Render the bordered box (vs. plain block for pipes).
 *                                    Defaults to whether stdout is a TTY.
 * @param {Function} [options.read=readPostInstall]  Injectable reader (for tests).
 * @returns {string[]} names of modules that actually had a message printed.
 */
const printPostInstallMessages = (moduleNames, { isTTY = Boolean(process.stdout.isTTY), read = readPostInstall } = {}) => {
  const seen = new Set();
  const printed = [];
  for (const name of moduleNames) {
    if (seen.has(name)) continue;
    seen.add(name);
    const message = read(name);
    if (!message) continue;
    logger.Print(formatMessage(name, message, { isTTY }));
    printed.push(name);
  }
  return printed;
};

export { readPostInstall, printPostInstallMessages, normalize, stripUnsafe, safeReadFile };
