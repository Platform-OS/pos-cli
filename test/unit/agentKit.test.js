import { vi, describe, test, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import yazl from 'yazl';
import { withTmpDir } from '#test/utils/withTmpDir.js';

// The download is the one part that must not run for real. Everything after it — reading the
// archive, refusing entries, extracting, renaming into place — is exercised against genuine
// zips built below, because that is where the risk is.
const downloadFile = vi.fn();
vi.mock('#lib/downloadFile.js', () => ({ default: (...args) => downloadFile(...args) }));

const { installAgentKit, isInsideKitDir, KIT_DIR } = await import('#lib/agentKit.js');

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
  const placeholder = `${KIT_DIR}/${'X'.repeat(hostilePath.length - KIT_DIR.length - 1)}`;
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

/** Makes `downloadFile` deliver whatever `build` writes as the archive it was asked to fetch. */
const servesArchive = (build) => {
  downloadFile.mockImplementation(async (_url, fileName) => {
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

describe('isInsideKitDir', () => {
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
    expect(isInsideKitDir(entry)).toBe(true);
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
    expect(isInsideKitDir(entry)).toBe(false);
  });
});

describe('installAgentKit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('unpacks the archive into .claude/', async () => {
    serves(KIT);

    const result = await installAgentKit({ rootPath: getTmpDir(), url: 'https://example.test/kit.zip' });

    expect(result.status).toBe('installed');
    expect(result.files).toBe(3);
    expect(fs.readFileSync(path.join(getTmpDir(), '.claude', 'CLAUDE.md'), 'utf8')).toBe('# platformOS');
    expect(fs.readFileSync(path.join(getTmpDir(), '.claude', 'rules', '00-project-rules.md'), 'utf8')).toBe('rules');
  });

  test('passes an abort signal so a hung download cannot stall the wizard', async () => {
    serves(KIT);

    await installAgentKit({ rootPath: getTmpDir() });

    expect(downloadFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  test('refuses an archive that climbs out of .claude/, and writes nothing', async () => {
    servesHostile('.claude/../../escaped.md', { '.claude/CLAUDE.md': 'ok' });

    await expect(installAgentKit({ rootPath: getTmpDir() })).rejects.toThrow(/outside \.claude\//);

    expect(fs.existsSync(path.join(getTmpDir(), '.claude'))).toBe(false);
    expect(fs.existsSync(path.join(path.dirname(getTmpDir()), 'escaped.md'))).toBe(false);
  });

  // The names themselves are covered by the table above; what these add is that a whole
  // archive is refused and nothing is written, for a hostile name and for a merely wrong tree.
  test.each([
    ['an absolute path', () => servesHostile('/tmp/pos-cli-agent-kit-absolute.md', { '.claude/CLAUDE.md': 'ok' })],
    ['entries that are not the kit at all', () => serves({ 'app/views/pages/index.liquid': 'not the kit' })]
  ])('refuses an archive with %s', async (_label, arrange) => {
    arrange();

    await expect(installAgentKit({ rootPath: getTmpDir() })).rejects.toThrow(/outside \.claude\//);
    expect(fs.existsSync(path.join(getTmpDir(), '.claude'))).toBe(false);
  });

  test('refuses an empty archive', async () => {
    serves({});

    await expect(installAgentKit({ rootPath: getTmpDir() })).rejects.toThrow(/empty/);
  });

  test('never overwrites an existing .claude/, and does not download', async () => {
    const existing = path.join(getTmpDir(), '.claude');
    fs.mkdirSync(existing, { recursive: true });
    fs.writeFileSync(path.join(existing, 'CLAUDE.md'), 'mine');
    serves(KIT);

    const result = await installAgentKit({ rootPath: getTmpDir() });

    expect(result.status).toBe('exists');
    expect(downloadFile).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(existing, 'CLAUDE.md'), 'utf8')).toBe('mine');
  });

  test('leaves no tmp/ behind on a project that had none, on success or on failure', async () => {
    const tmpRoot = path.join(getTmpDir(), 'tmp');

    serves(KIT);
    await installAgentKit({ rootPath: getTmpDir() });
    expect(fs.existsSync(tmpRoot)).toBe(false);

    fs.rmSync(path.join(getTmpDir(), '.claude'), { recursive: true });
    servesHostile('.claude/../escape.md');
    await expect(installAgentKit({ rootPath: getTmpDir() })).rejects.toThrow();
    expect(fs.existsSync(tmpRoot)).toBe(false);
  });

  // tmp/release.zip is pos-cli's own scratch file; an install must not sweep it up.
  test('never removes a tmp/ the project already had, or anything in it', async () => {
    const tmpRoot = path.join(getTmpDir(), 'tmp');
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'release.zip'), 'not ours');
    serves(KIT);

    await installAgentKit({ rootPath: getTmpDir() });

    expect(fs.readdirSync(tmpRoot)).toEqual(['release.zip']);
    expect(fs.readFileSync(path.join(tmpRoot, 'release.zip'), 'utf8')).toBe('not ours');
  });

  test('leaves an empty pre-existing tmp/ in place rather than tidying it away', async () => {
    const tmpRoot = path.join(getTmpDir(), 'tmp');
    fs.mkdirSync(tmpRoot, { recursive: true });
    serves(KIT);

    await installAgentKit({ rootPath: getTmpDir() });

    expect(fs.existsSync(tmpRoot)).toBe(true);
    expect(fs.readdirSync(tmpRoot)).toEqual([]);
  });

  test('propagates a download failure rather than writing a partial kit', async () => {
    downloadFile.mockRejectedValue(new Error('Download failed with HTTP 404: https://example.test/kit.zip'));

    await expect(installAgentKit({ rootPath: getTmpDir() })).rejects.toThrow(/404/);
    expect(fs.existsSync(path.join(getTmpDir(), '.claude'))).toBe(false);
  });
});
