/**
 * The platformOS agent kit: platformOS rules, knowledge files and a diagnostics hook that
 * Claude Code reads from `.claude/` in the project root.
 *
 * Offered by `pos-cli ai init` for Claude Code only, because the archive IS a `.claude/`
 * directory — the layout is that client's, and no other tool reads it.
 */

import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import downloadFile from './downloadFile.js';

/** Published beside the documentation site; see docs/AI_TOOLS.md. */
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
 * Checked against the entry NAMES before anything is extracted, rather than trusting the
 * extractor: this archive arrives over the network, and `unzipper`'s own traversal guard is an
 * implementation detail of a dependency rather than a promise this code may rely on. An entry
 * that is absolute, that carries a Windows drive, or that climbs out of `.claude/` is refused,
 * and one refusal rejects the whole archive — a partially-applied kit is worse than none.
 *
 * Separators are normalised to `/` first because a zip written on Windows can carry `\`, which
 * `path.posix.normalize` would otherwise treat as an ordinary character in a filename.
 */
const isInsideKitDir = (entryPath) => {
  if (typeof entryPath !== 'string' || entryPath.length === 0) return false;
  if (path.isAbsolute(entryPath) || /^[A-Za-z]:/.test(entryPath)) return false;

  const normalised = path.posix.normalize(entryPath.replace(/\\/g, '/')).replace(/\/+$/, '');
  if (normalised === '..' || normalised.startsWith('../')) return false;

  return normalised === KIT_DIR || normalised.startsWith(`${KIT_DIR}/`);
};

/**
 * Staging sits under the project's own `tmp/`, for the reason module staging does
 * (lib/modules/staging.js): publishing ends in a `rename()` onto `<root>/.claude`, and
 * `rename()` fails with EXDEV across filesystems, so `os.tmpdir()` is not safe to use.
 */
const createStagingDir = async (rootPath) => {
  const base = path.join(rootPath, 'tmp', 'pos-cli-agent-kit');
  await fs.promises.mkdir(base, { recursive: true });
  return fs.promises.mkdtemp(path.join(base, 'unpack-'));
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
  if (fs.existsSync(target)) return { status: 'exists', path: target };

  const stagingDir = await createStagingDir(rootPath);

  try {
    const archive = path.join(stagingDir, ARCHIVE_FILE);
    await downloadFile(url, archive, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });

    const directory = await unzipper.Open.file(archive);
    const entries = directory.files.map((file) => file.path);

    const refused = entries.filter((entry) => !isInsideKitDir(entry));
    if (refused.length > 0) {
      throw new Error(
        `archive contains ${refused.length} ${refused.length === 1 ? 'entry' : 'entries'} outside ` +
          `${KIT_DIR}/ and was not unpacked: ${refused.slice(0, 3).join(', ')}`
      );
    }
    if (entries.length === 0) throw new Error('archive is empty');

    await directory.extract({ path: stagingDir });

    const staged = path.join(stagingDir, KIT_DIR);
    if (!fs.existsSync(staged)) throw new Error(`archive did not produce a ${KIT_DIR}/ directory`);

    // Re-checked after extraction rather than before the download: the gap between the two is
    // where a concurrent `git checkout` or a second terminal can create the directory, and
    // renaming onto it would merge two kits into one tree.
    if (fs.existsSync(target)) return { status: 'exists', path: target };

    await fs.promises.rename(staged, target);

    const files = entries.filter((entry) => !entry.endsWith('/')).length;
    return { status: 'installed', path: target, files };
  } finally {
    await fs.promises.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
  }
};

export { installAgentKit, isInsideKitDir, AGENT_KIT_URL, KIT_DIR, DOWNLOAD_TIMEOUT_MS };
