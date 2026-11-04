/**
 * The platformOS Agent Playbook: platformOS rules, knowledge files and a diagnostics hook that an
 * AI coding tool reads from its own directory in the project root.
 *
 * One archive per tool, because the layout belongs to the tool: Claude Code reads `.claude/`, and
 * opencode reads `.opencode/`. Each archive is exactly one directory, which is what lets the same
 * entry-name guard serve both.
 */

import fs from 'fs';
import path from 'path';
import normalizePath from 'normalize-path';
import downloadFile from './downloadFile.js';

/**
 * Published beside the documentation site; see the agent-playbook section of README.md.
 *
 * `dir` is both the install target and the only prefix an archive entry may carry, so adding a
 * tool here is adding one row — there is no second place that decides what may be written.
 *
 * `portable` is the one whose directory is not a tool's: it is for a tool the kit has no wiring
 * for, so it unpacks somewhere visible and the user points their own tool at it.
 */
const PLAYBOOKS = {
  claude: { dir: '.claude', url: 'https://documentation.platformos.com/assets/platformos-agent-playbook.zip' },
  cursor: { dir: '.cursor', url: 'https://documentation.platformos.com/assets/platformos-agent-playbook-cursor.zip' },
  opencode: { dir: '.opencode', url: 'https://documentation.platformos.com/assets/platformos-agent-playbook-opencode.zip' },
  pi: { dir: '.pi', url: 'https://documentation.platformos.com/assets/platformos-agent-playbook-pi.zip' },
  codex: { dir: '.codex', url: 'https://documentation.platformos.com/assets/platformos-agent-playbook-codex.zip' },
  portable: {
    dir: 'platformos-playbook',
    url: 'https://documentation.platformos.com/assets/platformos-agent-playbook-portable.zip'
  }
};

/**
 * The archive is 65 KB from a CDN. The bound exists so a hung connection cannot stall an
 * interactive wizard — `fetch` would otherwise sit on its own 300 s headers cap, which for an
 * optional convenience step is indistinguishable from the command having crashed.
 */
const DOWNLOAD_TIMEOUT_MS = 60_000;

const ARCHIVE_FILE = 'agent-playbook.zip';

/**
 * What a tool has to be told about the Playbook it just unpacked. Written by the kit's compiler
 * into the archive rather than hardcoded here: the instruction list changes when a rule is added,
 * and a copy in this file would go stale without anything noticing.
 */
const MANIFEST_FILE = 'playbook.json';

/**
 * Whether one archive entry may be written.
 *
 * Entry NAMES are checked before anything is extracted, rather than trusting the extractor:
 * this archive arrives over the network, and `unzipper`'s own traversal guard drops an escaping
 * entry SILENTLY (`Open/directory.js` computes `path.relative` and returns), which would leave a
 * partial Playbook reported as a success. One refusal rejects the whole archive.
 *
 * The prefix compare is the whole test, and deliberately so: anything that escapes — absolute,
 * `..`-climbing, or carrying a Windows drive — normalises to something that cannot begin with the
 * playbook directory, so none of those needs a guard of its own. `normalizePath` converts `\`
 * (legal in a zip written on Windows) and collapses duplicate and trailing separators;
 * `path.posix.normalize` is what resolves `..`, which `normalizePath` does not do. It throws on a
 * non-string, so that check comes first.
 */
const isInsidePlaybookDir = (entryPath, playbookDir) => {
  if (typeof entryPath !== 'string') return false;
  if (typeof playbookDir !== 'string' || playbookDir === '') return false;

  const normalised = path.posix.normalize(normalizePath(entryPath));
  return normalised === playbookDir || normalised.startsWith(`${playbookDir}/`);
};

/**
 * Staging sits under the project's own `tmp/`, for the reason module staging does
 * (lib/modules/staging.js): publishing ends in a `rename()` onto `<root>/<dir>`, and
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
  const dir = await fs.promises.mkdtemp(path.join(tmpRoot, 'pos-cli-agent-playbook-'));

  const cleanup = async () => {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    if (madeTmpRoot) await fs.promises.rmdir(tmpRoot).catch(() => {});
  };

  return { dir, cleanup };
};

/**
 * The manifest, read from the unpacked Playbook, or `null` when it carries nothing usable.
 *
 * Two fields, both optional, because the runners need different wiring:
 *   `instructions` — files to list in a tool's own always-on instruction setting.
 *   `agentsFile`   — a file to copy to the project root, where that tool reads it from.
 *
 * Every path ends up acted on by the installer, and the manifest arrived over the network, so each
 * one is held to exactly the rule archive entries are held to: inside the playbook directory,
 * after normalisation. A manifest with ONE bad path is dropped WHOLE rather than filtered — a
 * partially honoured manifest would configure a Playbook that is not the one in the archive.
 * A missing or malformed manifest is not an error: an archive that needs no wiring carries none.
 */
const readManifest = (installedDir, playbookDir) => {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(installedDir, MANIFEST_FILE), 'utf8'));
  } catch {
    return null;
  }

  const result = {};

  if (manifest?.instructions !== undefined) {
    const instructions = manifest.instructions;
    if (!Array.isArray(instructions) || instructions.length === 0) return null;
    if (!instructions.every((entry) => isInsidePlaybookDir(entry, playbookDir))) return null;
    result.instructions = instructions;
  }

  if (manifest?.agentsFile !== undefined) {
    if (!isInsidePlaybookDir(manifest.agentsFile, playbookDir)) return null;
    // It is named in the manifest, but it still has to be in the archive that named it.
    if (!fs.existsSync(path.join(installedDir, '..', manifest.agentsFile))) return null;
    result.agentsFile = manifest.agentsFile;
  }

  return Object.keys(result).length > 0 ? result : null;
};

/**
 * Downloads one tool's Agent Playbook and unpacks it to `<rootPath>/<playbook.dir>`.
 *
 * Returns `{ status }` rather than throwing for the two outcomes that are not failures:
 * `installed`, and `exists` when the project already has that directory. That one is never
 * overwritten — it holds the user's own rules, settings and any local edits to the Playbook,
 * and silently replacing them is not a thing a convenience step may do.
 *
 * Genuine failures (network, a malformed or hostile archive) throw, and the caller reports them
 * without failing `ai init`: the MCP servers are registered by then, which is the command's job.
 *
 * @param {object}  options
 * @param {string}  options.rootPath   Project root to install into.
 * @param {object} [options.playbook]  Which Playbook; defaults to Claude Code's.
 * @param {string} [options.url]       Override the published archive; for tests.
 */
const installAgentPlaybook = async ({ rootPath, playbook = PLAYBOOKS.claude, url = playbook.url }) => {
  const playbookDir = playbook.dir;
  const target = path.join(rootPath, playbookDir);
  if (fs.existsSync(target)) return { status: 'exists' };

  const { dir: stagingDir, cleanup } = await createStagingDir(rootPath);

  try {
    const archive = path.join(stagingDir, ARCHIVE_FILE);
    await downloadFile(url, archive, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });

    // Loaded here rather than at the top of the module. `unzipper` and its dependencies measure
    // ~40 ms, and `lib/ai.js` imports this file on every `pos-cli ai init` — including runs that
    // decline the Playbook, name another tool, or only print --help. Same reason, and the same
    // spelling, as that file's dynamic `@inquirer/prompts` import.
    const { default: unzipper } = await import('unzipper');
    const directory = await unzipper.Open.file(archive);

    const refused = directory.files
      .map((file) => file.path)
      .filter((entry) => !isInsidePlaybookDir(entry, playbookDir));
    if (refused.length > 0) {
      throw new Error(
        `archive contains ${refused.length} ${refused.length === 1 ? 'entry' : 'entries'} outside ` +
          `${playbookDir}/ and was not unpacked: ${refused.slice(0, 3).join(', ')}`
      );
    }
    if (directory.files.length === 0) throw new Error('archive is empty');

    await directory.extract({ path: stagingDir });

    const staged = path.join(stagingDir, playbookDir);
    if (!fs.existsSync(staged)) throw new Error(`archive did not produce a ${playbookDir}/ directory`);

    // `rename` onto a non-empty directory fails with ENOTEMPTY, and onto an empty one replaces
    // it, so this can never merge two kits. What it buys is narrow and worth one line: a
    // directory some concurrent checkout created in the meantime is reported as `exists` rather
    // than as a failure, and an empty one is left alone instead of being replaced.
    if (fs.existsSync(target)) return { status: 'exists' };

    await fs.promises.rename(staged, target);

    const files = directory.files.filter((file) => file.type !== 'Directory').length;
    return { status: 'installed', files, manifest: readManifest(target, playbookDir) };
  } finally {
    await cleanup();
  }
};

export { installAgentPlaybook, isInsidePlaybookDir, readManifest, PLAYBOOKS };
