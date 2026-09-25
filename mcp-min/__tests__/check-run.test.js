
import { pathToFileURL } from 'url';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { runTool } from '../run-tool.js';

const checkRunModPath = pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'check', 'run.js')).href;

describe('platformos.check-run', () => {
  let checkRunTool;
  let testAppPath;

  beforeAll(async () => {
    const mod = await import(checkRunModPath);
    checkRunTool = mod.default;

    // Create a minimal temp directory so appCheckRun completes quickly.
    // Using '.' (the whole repo) can exceed the 10 s timeout when the
    // @platformos/platformos-check-node package is installed.
    testAppPath = fs.mkdtempSync(path.join(os.tmpdir(), 'check-run-test-'));
    const pagesDir = path.join(testAppPath, 'app', 'views', 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'index.liquid'), '{% liquid\n  echo "hello"\n%}', 'utf8');
  });

  afterAll(() => {
    if (testAppPath) {
      fs.rmSync(testAppPath, { recursive: true, force: true });
    }
  });

  test('has input schema with expected properties', () => {
    expect(checkRunTool.inputSchema.type).toBe('object');
    expect(checkRunTool.inputSchema.properties.appPath).toBeDefined();
    expect(checkRunTool.inputSchema.properties.autoFix).toBeDefined();
  });

  test('returns PATH_NOT_FOUND for non-existent path', async () => {
    const result = await runTool(checkRunTool, { appPath: '/tmp/does-not-exist-xyz-123' });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('PATH_NOT_FOUND');
    expect(result.error.message).toContain('/tmp/does-not-exist-xyz-123');
  });

  test('returns NOT_A_DIRECTORY for file path', async () => {
    // Use a file that definitely exists
    const tmpFile = path.join(os.tmpdir(), 'check-run-test-file.txt');
    fs.writeFileSync(tmpFile, 'test', 'utf8');

    try {
      const result = await runTool(checkRunTool, { appPath: tmpFile });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('NOT_A_DIRECTORY');
      // The same reading as NOT_A_PROJECT_ROOT below: the fix is to name a different directory,
      // which is an argument. `project` would send the agent to look at the machine instead.
      expect(result.error.kind).toBe('input');
      expect(result.error.message).toContain(tmpFile);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('includes timing metadata on success or dependency error', async () => {
    const result = await runTool(checkRunTool, { appPath: testAppPath });

    if (result.ok) {
      // theme-check-node is installed
    expect(result.meta.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.data.appPath).toBeDefined();
      expect(result.data).toBeDefined();
      expect(typeof result.data.offenseCount).toBe('number');
      expect(typeof result.data.filesChecked).toBe('number');
      expect(typeof result.data.autoFixed).toBe('boolean');
      expect(result.data.autoFixed).toBe(false);
      expect(Array.isArray(result.data.files)).toBe(true);
    } else {
      // theme-check-node is not installed — graceful handling
      expect(result.error.code).toBe('MISSING_DEPENDENCY');
      expect(result.error.message).toContain('@platformos/platformos-check-node');
    }
  });

  /**
   * `autoFixed: false` on its own could mean "nothing here is auto-fixable" or "the pass did not
   * run", and an agent had to diff its own working tree to tell them apart — on the one tool here
   * that writes to disk. `fixable` answers it, and is computed whether or not fixing was asked
   * for: gated on `autoFix`, a lint that was never asked to fix anything would have reported that
   * nothing was fixable.
   */
  describe('what autoFix did, and what it could have done', () => {
    const offending = (body) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-fix-'));
      const pages = path.join(dir, 'app', 'views', 'pages');
      fs.mkdirSync(pages, { recursive: true });
      fs.writeFileSync(path.join(pages, 'a.liquid'), body, 'utf8');
      return dir;
    };

    let dir;
    beforeAll(() => { dir = offending("{% include 'nope' %}\n{% assign unused = 1 %}\n"); });
    afterAll(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

    test.each([[false], [true]])('fixable is reported with autoFix: %s', async (autoFix) => {
      const result = await runTool(checkRunTool, { appPath: dir, autoFix });
      if (!result.ok) return; // linter not installed; covered above

      expect(result.data.offenseCount).toBeGreaterThan(0);
      expect(typeof result.data.fixable, 'fixable must be reported in both modes').toBe('number');
    });

    test('a run that wrote nothing carries no fixedFiles', async () => {
      const result = await runTool(checkRunTool, { appPath: dir, autoFix: true });
      if (!result.ok) return;

      expect(result.data.autoFixed).toBe(false);
      expect(result.data).not.toHaveProperty('fixedFiles');
    });

    /**
     * A canary on the dependency, not on us. Not one of platformos-check's 54 checks builds a fix
     * today, so `autoFix` cannot write anything whatever it is pointed at — which is the real
     * answer to "did the fix pass not run, or was nothing fixable". If this ever fails, upstream
     * has started shipping correctors: `autoFix` has become real, and the tool's description and
     * docs should stop describing it as a parameter with nothing to do.
     */
    test('the linter still ships no auto-corrections at all', async () => {
      const { allChecks } = await import('@platformos/platformos-check-node');
      const correcting = allChecks.filter(check => /addFix/.test(String(check.run)));

      expect(correcting.map(check => check.meta?.code)).toEqual([]);
    });
  });

  /**
   * A directory that is not a project root is the caller's mistake, and the linter says so in a
   * message written for whoever typed the path. It reached `classify` as an ordinary Error and
   * came back as `kind: internal` — "a defect in pos-cli" — so an evaluation that passed
   * `appPath: "app"` was told to report a bug about its own argument.
   */
  describe('a directory that is not a project root', () => {
    const dirs = [];

    /** A project whose root is marked the way `markers` says, with one page under app/. */
    const projectWith = (markers) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-root-'));
      dirs.push(dir);
      fs.mkdirSync(path.join(dir, 'app', 'views', 'pages'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'app', 'views', 'pages', 'index.liquid'), 'hello\n', 'utf8');
      for (const marker of markers) fs.writeFileSync(path.join(dir, marker), '{}', 'utf8');
      return dir;
    };

    afterAll(() => dirs.forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));

    /** Whether `haystack` names `needle`, ignoring case — see the drive-letter note below. */
    const names = (haystack, needle) => String(haystack).toLowerCase().includes(String(needle).toLowerCase());

    /**
     * Both refusals the linter can reach from inside a project: a root it can assert because
     * somebody declared it, and one it only inferred from a directory name. The message differs
     * and the classification must not — in each the fix is to name a different directory, which
     * is an argument.
     *
     * The variant for a path inside no project at all is deliberately not tested: whether an OS
     * temp directory sits under a marker is a fact about the machine, and upstream already had
     * that test fail on Windows CI.
     */
    test.each([
      ['a root declared by .pos', ['.pos']],
      ['a root inferred from app/', []]
    ])('%s refuses a subdirectory as an input error', async (_label, markers) => {
      const root = projectWith(markers);
      const given = path.join(root, 'app');

      const result = await runTool(checkRunTool, { appPath: given });

      expect(result.ok).toBe(false);
      expect(result.error.kind, `kind was ${result.error.kind}`).toBe('input');
      expect(result.error.code).toBe('NOT_A_PROJECT_ROOT');
      // The linter's own message, forwarded whole: it names the path it was given.
      //
      // Compared without case, and only here. The message is the linter's, and it round-trips the
      // path through a file URL, which lower-cases a Windows drive letter — it reported
      // `c:\Users\...\app` for the `C:\Users\...\app` Node had just handed it, and CI failed on
      // the one character. Windows paths are case-insensitive, so this is the comparison that
      // matches what the message means rather than how the linter spelled it.
      expect(names(result.error.message, given), result.error.message).toBe(true);
      // Exact, because this one is ours: `details.appPath` is the argument passed straight back,
      // untouched by anything that might normalise it.
      expect(result.error.details.appPath).toBe(given);
    });

    /**
     * The literal in `check/run.js` is what does the matching, and it is written out rather than
     * imported — an older copy exporting no constant would leave the comparison against
     * `undefined` and catch every error carrying no code. This is the other half of that: a rename
     * upstream fails here instead of quietly going back to blaming pos-cli.
     */
    test('the code it matches on is the one the linter exports', async () => {
      const { PROJECT_ROOT_ERROR_CODE } = await import('@platformos/platformos-check-node');

      expect(PROJECT_ROOT_ERROR_CODE).toBe('PLATFORMOS_PROJECT_ROOT');
    });

    test('the root itself still lints', async () => {
      const root = projectWith(['.pos']);

      const result = await runTool(checkRunTool, { appPath: root });

      expect(result.ok, JSON.stringify(result.error)).toBe(true);
      expect(result.data.appPath).toBe(root);
    });
  });

  test('returns structured file data when dependency is available', async () => {
    const result = await runTool(checkRunTool, { appPath: testAppPath });

    if (!result.ok && result.error.code === 'MISSING_DEPENDENCY') {
      // Skip — dependency not installed
      return;
    }

    expect(result.ok).toBe(true);
    expect(typeof result.data.errorCount).toBe('number');
    expect(typeof result.data.warningCount).toBe('number');
    expect(typeof result.data.infoCount).toBe('number');
    expect(typeof result.data.filesWithOffenses).toBe('number');

    // Verify each file entry structure
    for (const file of result.data.files) {
      expect(typeof file.path).toBe('string');
      expect(Array.isArray(file.offenses)).toBe(true);
      expect(typeof file.errorCount).toBe('number');
      expect(typeof file.warningCount).toBe('number');
      expect(typeof file.infoCount).toBe('number');
    }
  });
});
