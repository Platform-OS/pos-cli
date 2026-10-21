/**
 * The platformOS agent kit: platformOS rules, knowledge files and a diagnostics hook that
 * Claude Code reads from `.claude/` in the project root.
 *
 * Offered by `pos-cli ai init` for Claude Code only, because the archive IS a `.claude/`
 * directory — the layout is that client's, and no other tool reads it.
 */

import fs from 'fs';
import path from 'path';
import normalizePath from 'normalize-path';
import downloadFile from './downloadFile.js';

/** Published beside the documentation site; see the agent-kit section of README.md. */
const AGENT_KIT_URL = 'https://documentation.platformos.com/assets/platformos-agent-kit.zip';

/** The one directory this archive may write, and the only prefix an entry may carry. */
const KIT_DIR = '.claude';

/**
 * The archive is 65 KB from a CDN. The bound exists so a hung connection cannot stall an
 * interactive wizard — `fetch` would otherwise sit on its own 300 s headers cap, which for an
 * optional convenience step is indistinguishable from the command having crashed.
 */
const DOWNLOAD_TIMEOUT_MS = 60_000;

const ARCHIVE_FILE = 'agent-kit.zip';

/**
 * Whether one archive entry may be written.
 *
 * Entry NAMES are checked before anything is extracted, rather than trusting the extractor:
 * this archive arrives over the network, and `unzipper`'s own traversal guard drops an escaping
 * entry SILENTLY (`Open/directory.js` computes `path.relative` and returns), which would leave a
 * partial kit reported as a success. One refusal rejects the whole archive.
 *
 * The prefix compare is the whole test, and deliberately so: anything that escapes — absolute,
 * `..`-climbing, or carrying a Windows drive — normalises to something that cannot begin with
 * `.claude/`, so none of those needs a guard of its own. `normalizePath` converts `\` (legal in a
 * zip written on Windows) and collapses duplicate and trailing separators; `path.posix.normalize`
 * is what resolves `..`, which `normalizePath` does not do. It throws on a non-string, so that
 * check comes first.
 */
const isInsideKitDir = (entryPath) => {
  if (typeof entryPath !== 'string') return false;

  const normalised = path.posix.normalize(normalizePath(entryPath));
  return normalised === KIT_DIR || normalised.startsWith(`${KIT_DIR}/`);
};

/**
 * Staging sits under the project's own `tmp/`, for the reason module staging does
 * (lib/modules/staging.js): publishing ends in a `rename()` onto `<root>/.claude`, and
 * `rename()` fails with EXDEV across filesystems, so `os.tmpdir()` is not safe to use.
 *
 * `cleanup` puts the project back exactly as it was. A one-shot install on a fresh project must
 * not leave a `tmp/` behind, and must not sweep away a `tmp/` that was already there — not even
 * an empty one, which `rmdir` would happily remove. `mkdir` reports the first directory it
 * created, and `undefined` when it created none, so that is a fact rather than a guess across
 * the window an `existsSync` probe would leave open. The `rmdir` is allowed to fail: ENOTEMPTY
 * is what a concurrent run writing beside us looks like, and losing that race should mean
 * leaving the directory alone.
 */
const createStagingDir = async (rootPath) => {
  const tmpRoot = path.join(rootPath, 'tmp');
  const madeTmpRoot = (await fs.promises.mkdir(tmpRoot, { recursive: true })) !== undefined;
  const dir = await fs.promises.mkdtemp(path.join(tmpRoot, 'pos-cli-agent-kit-'));

  const cleanup = async () => {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    if (madeTmpRoot) await fs.promises.rmdir(tmpRoot).catch(() => {});
  };

  return { dir, cleanup };
};

/**
 * Downloads the agent kit and unpacks it to `<rootPath>/.claude`.
 *
 * Returns `{ status }` rather than throwing for the two outcomes that are not failures:
 * `installed`, and `exists` when the project already has a `.claude/` directory. That one is
 * never overwritten — it holds the user's own rules, settings and any local edits to the kit,
 * and silently replacing them is not a thing a convenience step may do.
 *
 * Genuine failures (network, a malformed or hostile archive) throw, and the caller reports them
 * without failing `ai init`: the MCP servers are registered by then, which is the command's job.
 *
 * @param {object}  options
 * @param {string}  options.rootPath Project root to install into.
 * @param {string} [options.url]     Override the published archive; for tests.
 */
const installAgentKit = async ({ rootPath, url = AGENT_KIT_URL }) => {
  const target = path.join(rootPath, KIT_DIR);
  if (fs.existsSync(target)) return { status: 'exists' };

  const { dir: stagingDir, cleanup } = await createStagingDir(rootPath);

  try {
    const archive = path.join(stagingDir, ARCHIVE_FILE);
    await downloadFile(url, archive, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });

    // Loaded here rather than at the top of the module. `unzipper` and its dependencies measure
    // ~40 ms, and `lib/ai.js` imports this file on every `pos-cli ai init` — including runs that
    // decline the kit, name another tool, or only print --help. Same reason, and the same
    // spelling, as that file's dynamic `@inquirer/prompts` import.
    const { default: unzipper } = await import('unzipper');
    const directory = await unzipper.Open.file(archive);

    const refused = directory.files.map((file) => file.path).filter((entry) => !isInsideKitDir(entry));
    if (refused.length > 0) {
      throw new Error(
        `archive contains ${refused.length} ${refused.length === 1 ? 'entry' : 'entries'} outside ` +
          `${KIT_DIR}/ and was not unpacked: ${refused.slice(0, 3).join(', ')}`
      );
    }
    if (directory.files.length === 0) throw new Error('archive is empty');

    await directory.extract({ path: stagingDir });

    const staged = path.join(stagingDir, KIT_DIR);
    if (!fs.existsSync(staged)) throw new Error(`archive did not produce a ${KIT_DIR}/ directory`);

    // `rename` onto a non-empty directory fails with ENOTEMPTY, and onto an empty one replaces
    // it, so this can never merge two kits. What it buys is narrow and worth one line: a
    // directory some concurrent checkout created in the meantime is reported as `exists` rather
    // than as a failure, and an empty one is left alone instead of being replaced.
    if (fs.existsSync(target)) return { status: 'exists' };

    await fs.promises.rename(staged, target);

    const files = directory.files.filter((file) => file.type !== 'Directory').length;
    return { status: 'installed', files };
  } finally {
    await cleanup();
  }
};

export { installAgentKit, isInsideKitDir, AGENT_KIT_URL, KIT_DIR };
