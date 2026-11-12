import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import yazl from 'yazl';
import { withTmpDir } from '#test/utils/withTmpDir.js';

// The download is the one part that must not run for real. Everything after it — reading the
// archive, refusing entries, extracting, renaming into place — is exercised against genuine
// zips built below, because that is where the risk is.
const downloadFile = vi.fn();
vi.mock('#lib/downloadFile.js', () => ({ default: (...args) => downloadFile(...args) }));

const { installAgentPlaybook, isInsidePlaybookDir, playbookDirState, readManifest, PLAYBOOKS, PLAYBOOK_INDEX_URL } =
  await import('#lib/agentPlaybook.js');

const PLAYBOOK_DIR = PLAYBOOKS.claude.dir;

const getTmpDir = withTmpDir();

/** Writes a real zip holding the given `{ entryPath: contents }` and resolves its path. */
const makeZip = (filePath, entries) =>
  new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    for (const [entry, contents] of Object.entries(entries)) zip.addBuffer(Buffer.from(contents), entry);
    zip.end();
    const out = fs.createWriteStream(filePath);
    zip.outputStream.pipe(out).on('close', () => resolve(filePath)).on('error', reject);
  });

/**
 * Builds an archive holding a path yazl itself refuses to write — an absolute one, or one that
 * climbs with `..`. A real attacker's zip has no such scruples, so the name is written in
 * afterwards: yazl stores filenames uncompressed in both the local and the central header, so
 * replacing every occurrence with a string of the SAME LENGTH leaves a structurally valid
 * archive whose entry name is hostile. Patching lengths would mean rewriting the offsets.
 */
const makeHostileZip = async (filePath, hostilePath, otherEntries = {}) => {
  const placeholder = `${PLAYBOOK_DIR}/${'X'.repeat(hostilePath.length - PLAYBOOK_DIR.length - 1)}`;
  await makeZip(filePath, { ...otherEntries, [placeholder]: 'payload' });

  const bytes = fs.readFileSync(filePath);
  const from = Buffer.from(placeholder, 'utf8');
  const to = Buffer.from(hostilePath, 'utf8');
  let at = bytes.indexOf(from);
  let replacements = 0;
  while (at !== -1) {
    to.copy(bytes, at);
    replacements += 1;
    at = bytes.indexOf(from, at + to.length);
  }
  // Local header and central directory: fewer than two means the patch missed one and the
  // archive would no longer be testing what it claims to.
  if (replacements < 2) throw new Error(`patched ${replacements} occurrences, expected at least 2`);
  fs.writeFileSync(filePath, bytes);
};

const notFound = (url) => Object.assign(new Error(`Download failed with HTTP 404: ${url}`), { statusCode: 404 });

/**
 * Makes `downloadFile` deliver whatever `build` writes as the archive it was asked to fetch. The
 * index answers 404, as it did before it was published, so these installs take the fixed URL.
 */
const servesArchive = (build) => {
  downloadFile.mockImplementation(async (url, fileName) => {
    if (url === PLAYBOOK_INDEX_URL) throw notFound(url);
    await build(fileName);
  });
};

const serves = (entries) => servesArchive((fileName) => makeZip(fileName, entries));
const servesHostile = (hostilePath, otherEntries) =>
  servesArchive((fileName) => makeHostileZip(fileName, hostilePath, otherEntries));

const KIT = {
  '.claude/CLAUDE.md': '# platformOS',
  '.claude/rules/00-project-rules.md': 'rules',
  '.claude/settings.json': '{}'
};

describe('isInsidePlaybookDir', () => {
  test.each([
    '.claude',
    '.claude/',
    '.claude/CLAUDE.md',
    '.claude/rules/00-project-rules.md',
    '.claude/a/b/c.md',
    // normalize-path collapses these; they are legal spellings in a zip, not escapes.
    '.claude//CLAUDE.md',
    '.claude\\rules\\x.md',
    './.claude/x'
  ])('accepts %s', (entry) => {
    expect(isInsidePlaybookDir(entry, PLAYBOOK_DIR)).toBe(true);
  });

  test.each([
    ['../outside.md'],
    ['.claude/../../etc/passwd'],
    ['.claude/../.ssh/authorized_keys'],
    ['/etc/passwd'],
    ['C:\\Windows\\system32\\drivers\\etc\\hosts'],
    ['.claude\\..\\..\\escape.md'],
    ['..'],
    ['other/file.md'],
    ['.claudex/file.md'],
    ['app/views/pages/index.liquid'],
    [''],
    [null]
  ])('refuses %s', (entry) => {
    expect(isInsidePlaybookDir(entry, PLAYBOOK_DIR)).toBe(false);
  });
});

describe('installAgentPlaybook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('unpacks the archive into .claude/', async () => {
    serves(KIT);

    const result = await installAgentPlaybook({ rootPath: getTmpDir() });

    expect(result.status).toBe('installed');
    expect(result.files).toBe(3);
    expect(fs.readFileSync(path.join(getTmpDir(), '.claude', 'CLAUDE.md'), 'utf8')).toBe('# platformOS');
    expect(fs.readFileSync(path.join(getTmpDir(), '.claude', 'rules', '00-project-rules.md'), 'utf8')).toBe('rules');
  });

  test('passes an abort signal so a hung download cannot stall the wizard', async () => {
    serves(KIT);

    await installAgentPlaybook({ rootPath: getTmpDir() });

    expect(downloadFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  // One shared deadline would already be spent when an index that hung for it fell back to the
  // fixed URL, so the fallback would abort before it started.
  test('the archive download does not inherit the index request\u2019s deadline', async () => {
    const signals = {};
    downloadFile.mockImplementation(async (url, fileName, { signal }) => {
      signals[url === PLAYBOOK_INDEX_URL ? 'index' : 'archive'] = signal;
      if (url === PLAYBOOK_INDEX_URL) throw notFound(url);
      await makeZip(fileName, KIT);
    });

    await installAgentPlaybook({ rootPath: getTmpDir() });

    expect(signals.archive).toBeInstanceOf(AbortSignal);
    expect(signals.archive).not.toBe(signals.index);
    expect(signals.archive.aborted).toBe(false);
  });

  test('refuses an archive that climbs out of .claude/, and writes nothing', async () => {
    servesHostile('.claude/../../escaped.md', { '.claude/CLAUDE.md': 'ok' });

    await expect(installAgentPlaybook({ rootPath: getTmpDir() })).rejects.toThrow(/outside \.claude\//);

    expect(fs.existsSync(path.join(getTmpDir(), '.claude'))).toBe(false);
    expect(fs.existsSync(path.join(path.dirname(getTmpDir()), 'escaped.md'))).toBe(false);
  });

  // The names themselves are covered by the table above; what these add is that a whole
  // archive is refused and nothing is written, for a hostile name and for a merely wrong tree.
  test.each([
    ['an absolute path', () => servesHostile('/tmp/pos-cli-agent-playbook-absolute.md', { '.claude/CLAUDE.md': 'ok' })],
    ['entries that are not the kit at all', () => serves({ 'app/views/pages/index.liquid': 'not the kit' })]
  ])('refuses an archive with %s', async (_label, arrange) => {
    arrange();

    await expect(installAgentPlaybook({ rootPath: getTmpDir() })).rejects.toThrow(/outside \.claude\//);
    expect(fs.existsSync(path.join(getTmpDir(), '.claude'))).toBe(false);
  });

  test('refuses an empty archive', async () => {
    serves({});

    await expect(installAgentPlaybook({ rootPath: getTmpDir() })).rejects.toThrow(/empty/);
  });

  test('never overwrites an existing .claude/, and does not download', async () => {
    const existing = path.join(getTmpDir(), '.claude');
    fs.mkdirSync(existing, { recursive: true });
    fs.writeFileSync(path.join(existing, 'CLAUDE.md'), 'mine');
    serves(KIT);

    const result = await installAgentPlaybook({ rootPath: getTmpDir() });

    expect(result.status).toBe('exists');
    expect(downloadFile).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(existing, 'CLAUDE.md'), 'utf8')).toBe('mine');
  });

  test('leaves no tmp/ behind on a project that had none, on success or on failure', async () => {
    const tmpRoot = path.join(getTmpDir(), 'tmp');

    serves(KIT);
    await installAgentPlaybook({ rootPath: getTmpDir() });
    expect(fs.existsSync(tmpRoot)).toBe(false);

    fs.rmSync(path.join(getTmpDir(), '.claude'), { recursive: true });
    servesHostile('.claude/../escape.md');
    await expect(installAgentPlaybook({ rootPath: getTmpDir() })).rejects.toThrow();
    expect(fs.existsSync(tmpRoot)).toBe(false);
  });

  // tmp/release.zip is pos-cli's own scratch file; an install must not sweep it up.
  test('never removes a tmp/ the project already had, or anything in it', async () => {
    const tmpRoot = path.join(getTmpDir(), 'tmp');
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'release.zip'), 'not ours');
    serves(KIT);

    await installAgentPlaybook({ rootPath: getTmpDir() });

    expect(fs.readdirSync(tmpRoot)).toEqual(['release.zip']);
    expect(fs.readFileSync(path.join(tmpRoot, 'release.zip'), 'utf8')).toBe('not ours');
  });

  test('leaves an empty pre-existing tmp/ in place rather than tidying it away', async () => {
    const tmpRoot = path.join(getTmpDir(), 'tmp');
    fs.mkdirSync(tmpRoot, { recursive: true });
    serves(KIT);

    await installAgentPlaybook({ rootPath: getTmpDir() });

    expect(fs.existsSync(tmpRoot)).toBe(true);
    expect(fs.readdirSync(tmpRoot)).toEqual([]);
  });

  test('propagates a download failure rather than writing a partial kit', async () => {
    downloadFile.mockRejectedValue(new Error('Download failed with HTTP 404: https://example.test/kit.zip'));

    await expect(installAgentPlaybook({ rootPath: getTmpDir() })).rejects.toThrow(/404/);
    expect(fs.existsSync(path.join(getTmpDir(), '.claude'))).toBe(false);
  });
});

describe('where the archive is downloaded from', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const CHECKSUMS_NAME = 'platformos-agent-playbook-checksums.json';
  const CHECKSUMS_URL = `https://files.example.test/assets/${CHECKSUMS_NAME}?updated=7`;
  const archiveUrl = (name) => `https://files.example.test/assets/${name}?updated=7`;
  const nameOf = (playbook) => path.posix.basename(new URL(playbook.url).pathname);
  const urlsFetched = () => downloadFile.mock.calls.map(([url]) => url);

  /**
   * Publishes `entries` as `playbook`'s archive the way the documentation site does: at its fixed
   * URL, and through an index linking it and a checksum file. `index` and `checksums` replace those
   * two documents' text to break one thing at a time; `null` makes one answer 404.
   */
  const publish = async ({ playbook = PLAYBOOKS.claude, entries = KIT, index, checksums } = {}) => {
    const name = nameOf(playbook);
    const publishedDir = path.join(getTmpDir(), 'published');
    fs.mkdirSync(publishedDir, { recursive: true });
    const zip = await makeZip(path.join(publishedDir, name), entries);
    const sha256 = createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
    const documents = {
      [PLAYBOOK_INDEX_URL]: index !== undefined ? index
        : JSON.stringify({ files: { [CHECKSUMS_NAME]: CHECKSUMS_URL, [name]: archiveUrl(name) } }),
      [CHECKSUMS_URL]: checksums !== undefined ? checksums : JSON.stringify({ [name]: sha256 })
    };
    downloadFile.mockImplementation(async (url, fileName) => {
      if (url === archiveUrl(name) || url === playbook.url) return fs.copyFileSync(zip, fileName);
      if (typeof documents[url] === 'string') return fs.writeFileSync(fileName, documents[url]);
      throw notFound(url);
    });
    return { name };
  };

  test('downloads the archive the index links, and installs it when its SHA-256 matches', async () => {
    const { name } = await publish();

    const result = await installAgentPlaybook({ rootPath: getTmpDir() });

    expect(result.status).toBe('installed');
    expect(urlsFetched()).toEqual([PLAYBOOK_INDEX_URL, CHECKSUMS_URL, archiveUrl(name)]);
    expect(fs.readFileSync(path.join(getTmpDir(), '.claude', 'CLAUDE.md'), 'utf8')).toBe('# platformOS');
  });

  test('each tool downloads its own archive from the index', async () => {
    const { name } = await publish({ playbook: PLAYBOOKS.opencode, entries: { '.opencode/opencode.json': '{}' } });

    const result = await installAgentPlaybook({ rootPath: getTmpDir(), playbook: PLAYBOOKS.opencode });

    expect(result.status).toBe('installed');
    expect(name).toBe('platformos-agent-playbook-opencode.zip');
    expect(urlsFetched().at(-1)).toBe(archiveUrl(name));
  });

  test('refuses an archive whose SHA-256 differs from the published one, and writes nothing', async () => {
    await publish({ checksums: JSON.stringify({ [nameOf(PLAYBOOKS.claude)]: 'a'.repeat(64) }) });

    await expect(installAgentPlaybook({ rootPath: getTmpDir() })).rejects.toThrow(/does not match its published SHA-256/);
    expect(fs.existsSync(path.join(getTmpDir(), '.claude'))).toBe(false);
    expect(fs.existsSync(path.join(getTmpDir(), 'tmp'))).toBe(false);
  });

  // The index is a published page, and a root-relative link is ordinary there. Reading it as
  // "no link" would quietly download the stale, unverified archive on every install.
  test('a root-relative link and an upper-case checksum are honoured', async () => {
    const name = nameOf(PLAYBOOKS.claude);
    const zip = await makeZip(path.join(getTmpDir(), name), KIT);
    const sha256 = createHash('sha256').update(fs.readFileSync(zip)).digest('hex').toUpperCase();
    const origin = new URL(PLAYBOOK_INDEX_URL).origin;
    const documents = {
      [PLAYBOOK_INDEX_URL]: JSON.stringify({
        files: { [name]: `/assets/${name}?updated=8`, [CHECKSUMS_NAME]: `/assets/${CHECKSUMS_NAME}?updated=8` }
      }),
      [`${origin}/assets/${CHECKSUMS_NAME}?updated=8`]: JSON.stringify({ [name]: sha256 })
    };
    downloadFile.mockImplementation(async (url, fileName) => {
      if (url === `${origin}/assets/${name}?updated=8`) return fs.copyFileSync(zip, fileName);
      if (documents[url]) return fs.writeFileSync(fileName, documents[url]);
      throw notFound(url);
    });

    const result = await installAgentPlaybook({ rootPath: getTmpDir() });

    expect(result.status).toBe('installed');
    expect(urlsFetched().at(-1)).toBe(`${origin}/assets/${name}?updated=8`);
  });

  test.each([
    ['the index is not published', { index: null }],
    ['the index is not JSON', { index: '<!doctype html><p>Not found</p>' }],
    ['the index does not link this archive', { index: JSON.stringify({ files: { [CHECKSUMS_NAME]: CHECKSUMS_URL } }) }],
    [
      'the index links it over plain http',
      {
        index: JSON.stringify({
          files: { [CHECKSUMS_NAME]: CHECKSUMS_URL, 'platformos-agent-playbook.zip': 'http://files.example.test/a.zip' }
        })
      }
    ],
    ['the checksum file is not published', { checksums: null }],
    ['the checksum file has no entry for this archive', { checksums: JSON.stringify({ 'other.zip': 'a'.repeat(64) }) }],
    ['the checksum is not a SHA-256', { checksums: JSON.stringify({ 'platformos-agent-playbook.zip': 'md5:abc' }) }]
  ])('falls back to the fixed URL, unverified, when %s', async (_label, published) => {
    await publish(published);

    const result = await installAgentPlaybook({ rootPath: getTmpDir() });

    expect(result.status).toBe('installed');
    expect(urlsFetched().at(-1)).toBe(PLAYBOOKS.claude.url);
  });
});

describe('per-tool playbooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('the opencode playbook unpacks into .opencode/', async () => {
    serves({
      '.opencode/opencode.json': '{}',
      '.opencode/agents/platformos-coding-agent.md': 'agent',
      '.opencode/plugins/platformos.js': 'export default {};'
    });

    const result = await installAgentPlaybook({ rootPath: getTmpDir(), playbook: PLAYBOOKS.opencode });

    expect(result.status).toBe('installed');
    expect(fs.existsSync(path.join(getTmpDir(), '.opencode', 'opencode.json'))).toBe(true);
    expect(fs.existsSync(path.join(getTmpDir(), '.claude'))).toBe(false);
  });

  test('each playbook refuses the other playbook\u2019s entries', async () => {
    serves({ '.claude/CLAUDE.md': '# platformOS' });
    await expect(
      installAgentPlaybook({ rootPath: getTmpDir(), playbook: PLAYBOOKS.opencode })
    ).rejects.toThrow(/outside \.opencode\//);
  });

  test('an existing .opencode/ is never overwritten', async () => {
    fs.mkdirSync(path.join(getTmpDir(), '.opencode'), { recursive: true });
    fs.writeFileSync(path.join(getTmpDir(), '.opencode', 'mine.json'), 'keep me');
    serves({ '.opencode/opencode.json': '{}' });

    const result = await installAgentPlaybook({ rootPath: getTmpDir(), playbook: PLAYBOOKS.opencode });

    expect(result.status).toBe('exists');
    expect(fs.readFileSync(path.join(getTmpDir(), '.opencode', 'mine.json'), 'utf8')).toBe('keep me');
    expect(downloadFile).not.toHaveBeenCalled();
  });

  // pi keeps `.pi/mcp.json` inside the Playbook's directory, so a run that registered the servers
  // without the Playbook leaves a `.pi/` that is pos-cli's, not the user's.
  test('a directory holding only the kept file is installed around, and the file survives', async () => {
    fs.mkdirSync(path.join(getTmpDir(), '.pi'), { recursive: true });
    fs.writeFileSync(path.join(getTmpDir(), '.pi', 'mcp.json'), '{"mine":true}');
    serves({ '.pi/AGENTS.md': 'agent', '.pi/mcp.json': '{"archive":true}' });

    const result = await installAgentPlaybook({ rootPath: getTmpDir(), playbook: PLAYBOOKS.pi, keep: ['mcp.json'] });

    expect(result.status).toBe('installed');
    expect(fs.readFileSync(path.join(getTmpDir(), '.pi', 'AGENTS.md'), 'utf8')).toBe('agent');
    expect(fs.readFileSync(path.join(getTmpDir(), '.pi', 'mcp.json'), 'utf8')).toBe('{"mine":true}');
    expect(fs.existsSync(path.join(getTmpDir(), 'tmp'))).toBe(false);
    // The archive's own copy lost, and that is said rather than swallowed.
    expect(result.overridden).toEqual(['mcp.json']);
  });

  test('a kept file the archive does not ship overrides nothing', async () => {
    fs.mkdirSync(path.join(getTmpDir(), '.pi'), { recursive: true });
    fs.writeFileSync(path.join(getTmpDir(), '.pi', 'mcp.json'), '{"mine":true}');
    serves({ '.pi/AGENTS.md': 'agent' });

    const result = await installAgentPlaybook({ rootPath: getTmpDir(), playbook: PLAYBOOKS.pi, keep: ['mcp.json'] });

    expect(result.overridden).toEqual([]);
  });

  // A dotfiles setup links the config in; copying it would leave a plain file, and the link would
  // go with the old directory.
  test.skipIf(process.platform === 'win32')('a symlinked kept file stays a link', async () => {
    const dotfiles = path.join(getTmpDir(), 'dotfiles');
    fs.mkdirSync(dotfiles, { recursive: true });
    fs.writeFileSync(path.join(dotfiles, 'pi-mcp.json'), '{"linked":true}');
    fs.mkdirSync(path.join(getTmpDir(), '.pi'), { recursive: true });
    fs.symlinkSync(path.join(dotfiles, 'pi-mcp.json'), path.join(getTmpDir(), '.pi', 'mcp.json'));
    serves({ '.pi/AGENTS.md': 'agent' });

    const result = await installAgentPlaybook({ rootPath: getTmpDir(), playbook: PLAYBOOKS.pi, keep: ['mcp.json'] });

    expect(result.status).toBe('installed');
    const kept = path.join(getTmpDir(), '.pi', 'mcp.json');
    expect(fs.lstatSync(kept).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(kept)).toBe(fs.realpathSync(path.join(dotfiles, 'pi-mcp.json')));
  });

  test('anything beside the kept file makes the directory the user\u2019s', async () => {
    fs.mkdirSync(path.join(getTmpDir(), '.pi'), { recursive: true });
    fs.writeFileSync(path.join(getTmpDir(), '.pi', 'mcp.json'), '{}');
    fs.writeFileSync(path.join(getTmpDir(), '.pi', 'settings.json'), 'mine');
    serves({ '.pi/AGENTS.md': 'agent' });

    const result = await installAgentPlaybook({ rootPath: getTmpDir(), playbook: PLAYBOOKS.pi, keep: ['mcp.json'] });

    expect(result.status).toBe('exists');
    expect(downloadFile).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(getTmpDir(), '.pi', 'AGENTS.md'))).toBe(false);
  });

  // An empty directory says nothing about who made it, so it is left alone as it always was.
  test('an empty directory is not adopted', () => {
    fs.mkdirSync(path.join(getTmpDir(), '.pi'), { recursive: true });

    expect(playbookDirState(path.join(getTmpDir(), '.pi'), ['mcp.json'])).toBe('occupied');
  });

  // Installing renames the target away and puts a real directory there, which would silently
  // unlink a dotfiles setup — even one whose directory holds only the kept file.
  test.skipIf(process.platform === 'win32')('a symlinked directory is never adopted', () => {
    const dotfiles = path.join(getTmpDir(), 'dotfiles-pi');
    fs.mkdirSync(dotfiles, { recursive: true });
    fs.writeFileSync(path.join(dotfiles, 'mcp.json'), '{}');
    fs.symlinkSync(dotfiles, path.join(getTmpDir(), '.pi'));

    expect(playbookDirState(path.join(getTmpDir(), '.pi'), ['mcp.json'])).toBe('occupied');
  });

  // The user's directory is inside staging at that moment; the cleanup after every install would
  // otherwise delete the only copy of it.
  test('an original that cannot be put back is kept, and the error says where', async () => {
    const pi = path.join(getTmpDir(), '.pi');
    fs.mkdirSync(pi, { recursive: true });
    fs.writeFileSync(path.join(pi, 'mcp.json'), '{"mine":true}');
    serves({ '.pi/AGENTS.md': 'agent' });

    const realRename = fs.promises.rename;
    const rename = vi.spyOn(fs.promises, 'rename').mockImplementation(async (from, to) => {
      // Moving the original aside works; publishing the staged copy and restoring both fail.
      if (to === pi) throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });
      return realRename(from, to);
    });

    let error;
    try {
      await installAgentPlaybook({ rootPath: getTmpDir(), playbook: PLAYBOOKS.pi, keep: ['mcp.json'] }).catch((e) => {
        error = e;
      });
    } finally {
      rename.mockRestore();
    }

    expect(error.message).toMatch(/could not be put back and is at/);
    expect(fs.readFileSync(path.join(error.preserved, 'mcp.json'), 'utf8')).toBe('{"mine":true}');
  });

  test('the manifest travels back to the caller', async () => {
    serves({
      '.opencode/opencode.json': '{}',
      '.opencode/playbook.json': JSON.stringify({
        instructions: ['.opencode/platformos-attitude.md', '.opencode/rules/00-project-rules.md']
      })
    });

    const result = await installAgentPlaybook({ rootPath: getTmpDir(), playbook: PLAYBOOKS.opencode });

    expect(result.manifest).toEqual({
      instructions: ['.opencode/platformos-attitude.md', '.opencode/rules/00-project-rules.md']
    });
  });

  test('an archive with no manifest reports none, and still installs', async () => {
    serves({ '.claude/CLAUDE.md': '# platformOS' });

    const result = await installAgentPlaybook({ rootPath: getTmpDir() });

    expect(result.status).toBe('installed');
    expect(result.manifest).toBeNull();
  });
});

describe('readManifest', () => {
  /** Writes a playbook directory holding the given manifest text and reads it back. */
  const withManifest = (contents) => {
    const dir = path.join(getTmpDir(), '.opencode');
    fs.mkdirSync(dir, { recursive: true });
    if (contents !== null) fs.writeFileSync(path.join(dir, 'playbook.json'), contents);
    return readManifest(dir, '.opencode');
  };

  test('reads the instruction list', () => {
    expect(withManifest(JSON.stringify({ instructions: ['.opencode/a.md'] })))
      .toEqual({ instructions: ['.opencode/a.md'] });
  });

  test.each([
    ['an instruction escaping the playbook directory', { instructions: ['.opencode/../../.ssh/config'] }],
    ['an absolute instruction', { instructions: ['/etc/passwd'] }],
    ['an instruction belonging to another tool', { instructions: ['.claude/CLAUDE.md'] }],
    ['one bad path among good ones', { instructions: ['.opencode/a.md', '../escape.md'] }],
    ['instructions that are not a list', { instructions: '.opencode/a.md' }],
    ['an empty list', { instructions: [] }],
    ['no instructions at all', { other: true }]
  ])('drops %s', (_name, manifest) => {
    expect(withManifest(JSON.stringify(manifest))).toBeNull();
  });

  test('a malformed manifest is not an error', () => {
    expect(withManifest('{ not json')).toBeNull();
  });

  test('a missing manifest is not an error', () => {
    expect(withManifest(null)).toBeNull();
  });

  /** Writes a manifest plus the files it names, and reads it back. */
  const withFiles = (manifest, files = {}) => {
    const dir = path.join(getTmpDir(), '.codex');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, contents] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), contents);
    fs.writeFileSync(path.join(dir, 'playbook.json'), JSON.stringify(manifest));
    return readManifest(dir, '.codex');
  };

  test('reads an agentsFile that the archive actually contains', () => {
    expect(withFiles({ agentsFile: '.codex/AGENTS.md' }, { 'AGENTS.md': 'x' }))
      .toEqual({ agentsFile: '.codex/AGENTS.md' });
  });

  // Named but not shipped: the installer would copy a file that is not there, so the whole
  // manifest is refused rather than acted on in part.
  test('drops an agentsFile the archive does not contain', () => {
    expect(withFiles({ agentsFile: '.codex/AGENTS.md' })).toBeNull();
  });

  test.each([
    ['one escaping the playbook directory', '.codex/../../../etc/passwd'],
    ['an absolute one', '/etc/passwd'],
    ["another tool's", '.claude/CLAUDE.md']
  ])('drops %s agentsFile', (_name, agentsFile) => {
    expect(withFiles({ agentsFile }, { 'AGENTS.md': 'x' })).toBeNull();
  });

  test('one bad field drops the whole manifest, not just that field', () => {
    expect(withFiles(
      { instructions: ['.codex/ok.md'], agentsFile: '../escape.md' },
      { 'AGENTS.md': 'x', 'ok.md': 'y' }
    )).toBeNull();
  });

  test('both fields travel together when both are valid', () => {
    expect(withFiles(
      { instructions: ['.codex/ok.md'], agentsFile: '.codex/AGENTS.md' },
      { 'AGENTS.md': 'x', 'ok.md': 'y' }
    )).toEqual({ instructions: ['.codex/ok.md'], agentsFile: '.codex/AGENTS.md' });
  });
});
