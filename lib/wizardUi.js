/**
 * Terminal presentation for pos-cli's interactive wizards.
 *
 * Two renderers behind one interface: a framed wizard at a terminal, the ordinary `logger`
 * everywhere else. The second is not a degraded mode — it is the output pos-cli has always
 * produced, which keeps CI logs parseable and lets the suites assert the same strings they always
 * did without knowing this file exists.
 *
 * Drawn here rather than taken from a prompt library because the look has to be pos-cli's own.
 * `@clack/prompts` renders this shape but its symbols and colours are fixed, so matching it would
 * mean looking like every other clack CLI. `@inquirer/prompts` is already a dependency and is
 * themeable, so the questions carry the same rail.
 */

import process from 'process';
import os from 'os';
import chalk from 'chalk';
import logger, { isServerMode } from './logger.js';

/**
 * Narrower than this and the wizard is not drawn. MEASURED: a pty reporting `columns: 0` — what
 * `script` allocates without a size, and what some CI runners give — wraps every box to zero and
 * prints one character per line.
 */
const MIN_COLUMNS = 40;

/** Widest the frames grow, so a very wide terminal does not get a banner. */
const MAX_COLUMNS = 96;

/** Deliberately none of the shapes a clack-based CLI draws. */
const RAIL = '┃';
const S = {
  open: '┏',
  close: '┗',
  dash: '━',
  ask: '▸',
  done: '✔',
  info: '·',
  warn: '▲',
  fail: '✖',
  boxTopLeft: '╭',
  boxTopRight: '╮',
  boxBottomLeft: '╰',
  boxBottomRight: '╯',
  boxBar: '│',
  boxDash: '─'
};

const accent = (text) => chalk.red(text);
const rail = () => accent(RAIL);
const width = () => Math.min(process.stdout.columns ?? 0, MAX_COLUMNS);

/**
 * Display only: an absolute path is one unbreakable word, so a long one cannot be wrapped.
 *
 * Only where the home directory is a whole path segment: with home at `/home/mk`, the path
 * `/home/mkk/app` is someone else's, and `~k/app` names nothing.
 */
const shortenHome = (text) => {
  const home = os.homedir();
  if (!home || home === '/') return String(text);
  const escaped = home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text).replace(new RegExp(`${escaped}(?![^\\\\/\\s.,;:'"\`)\\]])`, 'g'), '~');
};

/**
 * Whether this run has written anything yet, so a cancel can say truthfully what it left behind.
 * Set by the caller at each write; the wizard cannot see the filesystem.
 */
let changed = false;
const recordChange = () => {
  changed = true;
};

/**
 * Both streams have to be a terminal, because a prompt reads keys from stdin. Server mode is
 * excluded: `logger` already redirects to stderr there, and a prompt would corrupt the protocol.
 */
const isWizardTerminal = () =>
  Boolean(process.stdout.isTTY && process.stdin.isTTY) &&
  !isServerMode() &&
  (process.stdout.columns ?? 0) >= MIN_COLUMNS;

/** Drawn, not logged: no timestamps. */
const draw = (line) => process.stdout.write(`${line}\n`);
const blank = () => draw(rail());

/** Never takes a string that already carries colour: an escape has length but no width. */
const wrap = (text, limit) => {
  const out = [];
  for (const paragraph of String(text).split('\n')) {
    if (paragraph === '') {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line === '') line = word;
      else if (line.length + 1 + word.length <= limit) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
};

const markerLines = (marker, text, paint = (t) => t) => {
  const [first, ...rest] = wrap(shortenHome(text), Math.max(20, width() - 6));
  draw(`${rail()}  ${marker} ${paint(first ?? '')}`);
  for (const line of rest) draw(`${rail()}    ${paint(line)}`);
};

/**
 * `lines` arrive final. Both borders derive from one `span`: computing them separately is how a
 * header ends up a character short of its body.
 */
const drawBox = (lines, title) => {
  const span = Math.max(...lines.map((line) => line.length), title ? title.length + 2 : 0) + 2;
  const fill = (count) => S.boxDash.repeat(Math.max(0, count));
  const head = title ? `${S.boxDash} ${title} ${fill(span - title.length - 3)}` : fill(span);

  draw(`${rail()}  ${accent(`${S.boxTopLeft}${head}${S.boxTopRight}`)}`);
  for (const line of lines) {
    draw(`${rail()}  ${accent(S.boxBar)} ${line.padEnd(span - 2)} ${accent(S.boxBar)}`);
  }
  draw(`${rail()}  ${accent(`${S.boxBottomLeft}${fill(span)}${S.boxBottomRight}`)}`);
};

const start = async (title) => {
  if (!isWizardTerminal()) return;
  const bar = S.dash.repeat(Math.max(0, width() - title.length - 6));
  draw(`${accent(`${S.open}${S.dash}${S.dash}`)} ${chalk.bold(title)} ${accent(bar)}`);
  blank();
};

/**
 * Information, not success: a run can end having changed nothing, and "restart your tool" is
 * advice either way. The suite asserts such a run reports no success at all.
 *
 * Adds no leading gap — every block above owns the blank rail line that follows it.
 */
const finish = async (message) => {
  if (!isWizardTerminal()) return logger.Info(message);
  draw(`${accent(`${S.close}${S.dash}${S.dash}`)} ${message}`);
};

const success = async (message) => {
  if (!isWizardTerminal()) return logger.Success(message);
  markerLines(chalk.green(S.done), message);
  blank();
};

const info = async (message, ...opts) => {
  if (!isWizardTerminal()) return logger.Info(message, ...opts);
  markerLines(chalk.dim(S.info), message, chalk.dim);
  blank();
};

const warn = async (message) => {
  if (!isWizardTerminal()) return logger.Warn(message);
  markerLines(chalk.yellow(S.warn), message);
  blank();
};

/**
 * A failure the run carries on past, in both modes: the caller decides what it costs — `ai init`
 * sets the exit code once everything else has been done. An exit here would stop a run half way,
 * with the steps after it (and the summary saying what happened) never reached.
 */
const error = async (message) => {
  if (!isWizardTerminal()) return logger.Error(message, { exit: false, notify: false });
  markerLines(chalk.red(S.fail), message);
  blank();
};

/**
 * Text something downstream may read — a JSON snippet, a TOML block to paste. Never reframed and
 * never rewritten: no rail, no timestamp, and the home directory is not shortened to `~`, because
 * the reader is a parser. At a terminal it is written synchronously, like everything else drawn
 * here, so it lands under the line that introduced it rather than after whatever follows.
 */
const raw = async (text) => {
  if (!isWizardTerminal()) return logger.Log(text);
  draw(String(text));
  blank();
};

/** A boxed aside. The trust gates are what this exists for: they must not be skimmed past. */
const note = async (body, title) => {
  if (!isWizardTerminal()) return logger.Info(title ? `${title}: ${body}` : body);
  drawBox(wrap(body, Math.max(20, width() - 10)), title);
  blank();
};

/** The width depends on every row, so the padding cannot be left to the caller. */
const alignRows = (rows) => {
  const kept = rows.filter(([, value]) => value !== undefined && value !== null && value !== '');
  const labelWidth = Math.max(0, ...kept.map(([label]) => String(label).length));
  return kept.map(([label, value]) => `${String(label).padEnd(labelWidth)}   ${value}`).join('\n');
};

/** Not wrapped: its columns are spaces, and wrapping collapses runs of whitespace. */
const summary = async (rows, title = 'Summary') => {
  const body = alignRows(rows);
  if (body === '') return;
  if (!isWizardTerminal()) return logger.Info(`${title}:\n${body}`);
  drawBox(body.split('\n'), title);
  blank();
};

/**
 * Not boxed and not wrapped: a URL is one unbreakable word, so a frame around it either overflows
 * or truncates it, and a truncated URL is not a link. When label and URL do not fit together the
 * label takes its own line, leaving the URL as far left as it can start.
 */
const links = async (rows, title = 'Documentation') => {
  const kept = rows.filter(([, url]) => url);
  if (kept.length === 0) return;
  if (!isWizardTerminal()) return logger.Info(`${title}:\n${alignRows(kept)}`);

  const labelWidth = Math.max(...kept.map(([label]) => String(label).length));
  const longest = Math.max(...kept.map(([, url]) => String(url).length));
  const inline = labelWidth + longest + 9 <= (process.stdout.columns ?? 0);

  draw(`${rail()}  ${chalk.bold(title)}`);
  for (const [label, url] of kept) {
    if (inline) {
      draw(`${rail()}    ${chalk.dim(String(label).padEnd(labelWidth))}   ${chalk.underline(url)}`);
    } else {
      draw(`${rail()}    ${chalk.dim(label)}`);
      draw(`${rail()}    ${chalk.underline(url)}`);
    }
  }
  blank();
};

const promptTheme = () => ({
  prefix: { idle: `${rail()}  ${accent(S.ask)}`, done: `${rail()}  ${chalk.green(S.done)}` },
  style: {
    // Not wrapped: the prompt erases its previous render by counting the lines IT drew, so an
    // injected newline leaves debris — MEASURED at 56 columns, a continuation line printed three
    // times. The messages are kept short enough to fit instead.
    message: (text) => chalk.bold(text),
    answer: (text) => accent(text),
    highlight: (text) => accent(text),
    help: (text) => chalk.dim(text)
  },
  icon: { cursor: S.ask }
});

/** Ctrl-C at a wizard is a decision, not a failure, so it exits 0. */
const select = async ({ message, options }) => {
  const { select: pick } = await import('@inquirer/prompts');
  const question = {
    message,
    choices: options.map(({ value, label, hint }) => ({ value, name: label, description: hint })),
    ...(isWizardTerminal() ? { theme: promptTheme() } : {})
  };

  try {
    const answer = await pick(question);
    if (isWizardTerminal()) blank();
    return answer;
  } catch (err) {
    if (err.name === 'ExitPromptError') {
      if (isWizardTerminal()) {
        await finish(
          changed
            ? 'Cancelled. What was already written is kept; run the command again to finish.'
            : 'Cancelled. Nothing was changed.'
        );
      }
      return process.exit(0);
    }
    throw err;
  }
};

/**
 * Only a terminal gets a spinner: its redraws in a log file are hundreds of identical lines. It
 * draws on stdout, like every other line here — ora's default is stderr, which a `2>` would hide.
 *
 * A failure is rethrown for the caller to report, and outside a terminal nothing is printed for
 * it here — a line of our own would only precede the caller's, saying the same thing twice. At a
 * terminal the spinner has to end on something, which is `fail` or the start text.
 *
 * `done` may answer nothing for a result that is not a success; the spinner is then cleared and
 * the caller reports the outcome itself, once and as what it is.
 */
const task = async ({ start: startText, done, fail }, work) => {
  const ended = (value, result) => (typeof value === 'function' ? value(result) : value);

  if (!isWizardTerminal()) {
    const result = await work();
    const text = ended(done, result);
    if (text) await success(text);
    return result;
  }

  const { default: ora } = await import('ora');
  const spinner = ora({ text: startText, prefixText: `${rail()} `, color: 'red', stream: process.stdout }).start();
  try {
    const result = await work();
    const text = ended(done, result);
    if (text) {
      spinner.stopAndPersist({ symbol: chalk.green(S.done), text });
      blank();
    } else {
      spinner.stop();
    }
    return result;
  } catch (err) {
    spinner.stopAndPersist({ symbol: chalk.red(S.fail), text: ended(fail, err) ?? startText });
    blank();
    throw err;
  }
};

export { isWizardTerminal, shortenHome, recordChange, start, finish, success, info, warn, error, raw, note, summary, links, select, task };
export default { isWizardTerminal, recordChange, start, finish, success, info, warn, error, raw, note, summary, links, select, task };
