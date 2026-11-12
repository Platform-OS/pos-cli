/**
 * The platformOS Agent Playbook: platformOS rules, knowledge files and a diagnostics hook that an
 * AI coding tool reads from its own directory in the project root.
 *
 * One archive per tool, because the layout belongs to the tool: Claude Code reads `.claude/`, and
 * opencode reads `.opencode/`. Each archive is exactly one directory, which is what lets the same
 * entry-name guard serve both.
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import normalizePath from 'normalize-path';
import downloadFile from './downloadFile.js';
import logger from './logger.js';

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
 * The fixed URLs above can serve an archive from an earlier release: the CDN in front of
 * documentation.platformos.com caches `/assets/` for up to a year, and a deploy does not clear it.
 * This page is not cached. It links each archive, and a checksum file from the same Kit build, with
 * the deploy's cache-busting parameter, so its links change whenever the archives do.
 */
const PLAYBOOK_INDEX_URL = 'https://documentation.platformos.com/agent-playbook.json';
const CHECKSUMS_NAME = 'platformos-agent-playbook-checksums.json';
const SHA256_HEX = /^[0-9a-f]{64}$/i;

/**
 * The index, the checksum file and the archive together are under 70 KB from a CDN. The bounds
 * exist so a hung connection cannot stall an interactive wizard — `fetch` would otherwise sit on
 * its own 300 s headers cap, which for an optional convenience step is indistinguishable from the
 * command having crashed.
 *
 * Two bounds, not one shared: the fixed URL is the fallback for an index that does not answer, and
 * a signal the index had already used up would abort that fallback before it started.
 */
const INDEX_TIMEOUT_MS = 15_000;
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

/** The archive's published file name: how the index and the checksum file refer to it. */
const archiveName = (playbook) => path.posix.basename(new URL(playbook.url).pathname);

/** A link from a published document, resolved against that document: root-relative is legal there. */
const httpsUrl = (value, base) => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

const downloadJson = async (url, file, signal) => {
  await downloadFile(url, file, { signal });
  return JSON.parse(await fs.promises.readFile(file, 'utf8'));
};

/**
 * Where to download `playbook` from, and the SHA-256 the archive must have.
 *
 * From the index when it can be used. Otherwise the fixed URL with no checksum, which is what every
 * earlier pos-cli downloaded: a failure here costs only the fresher link, so it is logged rather
 * than raised.
 */
const resolveDownload = async ({ playbook, indexUrl, stagingDir }) => {
  const name = archiveName(playbook);
  const signal = AbortSignal.timeout(INDEX_TIMEOUT_MS);
  try {
    const { files } = await downloadJson(indexUrl, path.join(stagingDir, 'index.json'), signal);
    const archiveUrl = httpsUrl(files?.[name], indexUrl);
    const checksumsUrl = httpsUrl(files?.[CHECKSUMS_NAME], indexUrl);
    if (!archiveUrl || !checksumsUrl) throw new Error(`it has no https link to ${name} or ${CHECKSUMS_NAME}`);

    const sha256 = (await downloadJson(checksumsUrl, path.join(stagingDir, 'checksums.json'), signal))?.[name];
    if (typeof sha256 !== 'string' || !SHA256_HEX.test(sha256)) throw new Error(`${CHECKSUMS_NAME} has no SHA-256 for ${name}`);

    // `digest('hex')` is lowercase; a checksum file written in capitals means the same bytes.
    return { url: archiveUrl, sha256: sha256.toLowerCase() };
  } catch (error) {
    logger.Debug(`Agent Playbook: not using ${indexUrl} (${error.message}); downloading ${playbook.url}`);
    return { url: playbook.url, sha256: null };
  }
};

/** Every entry under `dir`, relative and with `/` separators; directories included. */
const entriesUnder = (dir) =>
  fs.readdirSync(dir, { recursive: true }).map((entry) => String(entry).split(path.sep).join('/'));

/**
 * What is at a Playbook's target directory:
 *   `absent`    — nothing; install.
 *   `adoptable` — only files listed in `keep` (and the directories holding them); install around them.
 *   `occupied`  — anything else, which is the user's own and is never touched.
 *
 * `keep` exists because pi, Codex and Cursor keep their MCP configuration INSIDE the Playbook's
 * directory. A run that registered the servers without the Playbook leaves `.pi/mcp.json` behind,
 * and reading that as "the user has their own .pi/" would refuse every later install.
 *
 * Adopting needs at least one kept file actually there. An empty directory says nothing about who
 * made it, so it is left alone as it always was. A symlink is the user's too, even one pointing at
 * a directory that holds only a kept file: installing renames the link away and replaces it with a
 * real directory, which silently unlinks a dotfiles setup.
 */
const playbookDirState = (target, keep = []) => {
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    return error.code === 'ENOENT' ? 'absent' : 'occupied';
  }
  if (!stat.isDirectory()) return 'occupied';

  const allowed = new Set();
  for (const file of keep) {
    const parts = file.split('/');
    parts.forEach((_part, index) => allowed.add(parts.slice(0, index + 1).join('/')));
  }
  try {
    const entries = entriesUnder(target);
    if (!keep.some((file) => entries.includes(file))) return 'occupied';
    return entries.every((entry) => allowed.has(entry)) ? 'adoptable' : 'occupied';
  } catch {
    return 'occupied';
  }
};

/**
 * Puts the staged Playbook at `target`, carrying over the `keep` files a target already holds.
 * Returns the kept files the archive shipped its own copy of, or `null` when the target turned
 * out to hold more than `keep` after all, in which case it is left exactly as it was.
 *
 * An existing target is moved aside first and judged again there, where nothing else can write to
 * it: a file a running tool added since the caller's check would otherwise be moved aside with the
 * directory and deleted with staging. The kept files are copied from that same moved-aside copy, so
 * what is carried over is what was judged. Moved rather than deleted, so a failed second rename can
 * put it back.
 *
 * When putting it back fails too, the user's directory exists only inside the staging directory,
 * and the cleanup that follows every install would delete it. The error then carries `preserved`,
 * which tells `installAgentPlaybook` to leave staging where it is, and says where to find it.
 */
const publishStaged = async ({ staged, target, stagingDir, keep }) => {
  if (!fs.existsSync(target)) {
    await fs.promises.rename(staged, target);
    return [];
  }

  const previous = path.join(stagingDir, 'previous');
  await fs.promises.rename(target, previous);

  const putBack = async (cause) => {
    try {
      await fs.promises.rename(previous, target);
    } catch {
      const reason = cause ? `${cause.message}; your` : 'Your';
      throw Object.assign(
        new Error(`${reason} original ${path.basename(target)}/ could not be put back and is at ${previous}`),
        { cause, preserved: previous }
      );
    }
  };

  if (playbookDirState(previous, keep) !== 'adoptable') {
    await putBack();
    return null;
  }

  const overridden = [];
  try {
    for (const file of keep) {
      const from = path.join(previous, ...file.split('/'));
      if (!(await fs.promises.lstat(from).catch(() => null))) continue;
      const to = path.join(staged, ...file.split('/'));
      // The existing copy wins: it is the tool's configuration, written by pos-cli or edited since.
      // The archive's own copy, if it had one, is reported rather than lost in silence.
      if (fs.existsSync(to) && !sameBytes(from, to)) overridden.push(file);
      // Removed first: `cp` cannot write a symlink over a file (EEXIST), whatever `force` says.
      await fs.promises.rm(to, { recursive: true, force: true });
      await fs.promises.mkdir(path.dirname(to), { recursive: true });
      // `cp` copies a symlink as the link, so a dotfiles setup stays linked.
      await fs.promises.cp(from, to, { verbatimSymlinks: true });
    }
    await fs.promises.rename(staged, target);
  } catch (error) {
    await putBack(error);
    throw error;
  }
  return overridden;
};

const sameBytes = (a, b) => {
  try {
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
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
 * An archive whose SHA-256 differs from the published checksum is refused: it comes from a
 * different Kit build than the checksum file, and installing it would install the wrong Playbook.
 *
 * @param {object}  options
 * @param {string}  options.rootPath    Project root to install into.
 * @param {object} [options.playbook]   Which Playbook; defaults to Claude Code's.
 * @param {string} [options.indexUrl]   Override the published index; for tests.
 * @param {string[]} [options.keep]     Files (relative to the Playbook directory) that may already
 *                                      be there and are kept; see `playbookDirState`.
 */
const installAgentPlaybook = async ({
  rootPath,
  playbook = PLAYBOOKS.claude,
  indexUrl = PLAYBOOK_INDEX_URL,
  keep = []
}) => {
  const playbookDir = playbook.dir;
  const target = path.join(rootPath, playbookDir);
  if (playbookDirState(target, keep) === 'occupied') return { status: 'exists' };

  const { dir: stagingDir, cleanup } = await createStagingDir(rootPath);
  let preserved = false;

  try {
    const { url, sha256 } = await resolveDownload({ playbook, indexUrl, stagingDir });
    const archive = path.join(stagingDir, ARCHIVE_FILE);
    await downloadFile(url, archive, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (sha256) {
      const actual = createHash('sha256').update(await fs.promises.readFile(archive)).digest('hex');
      if (actual !== sha256) {
        throw new Error(`archive does not match its published SHA-256 and was not unpacked (expected ${sha256}, got ${actual})`);
      }
    }

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

    // Checked again, and once more inside `publishStaged`: a directory some concurrent checkout
    // filled in the meantime is reported as `exists` rather than as a failure, and is left alone.
    if (playbookDirState(target, keep) === 'occupied') return { status: 'exists' };

    let overridden;
    try {
      overridden = await publishStaged({ staged, target, stagingDir, keep });
    } catch (error) {
      preserved = Boolean(error.preserved);
      throw error;
    }
    if (overridden === null) return { status: 'exists' };

    const files = directory.files.filter((file) => file.type !== 'Directory').length;
    return { status: 'installed', files, manifest: readManifest(target, playbookDir), overridden };
  } finally {
    if (!preserved) await cleanup();
  }
};

export { installAgentPlaybook, isInsidePlaybookDir, playbookDirState, readManifest, sameBytes, PLAYBOOKS, PLAYBOOK_INDEX_URL };
