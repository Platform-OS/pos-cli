import { describe, test, expect, vi } from 'vitest';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import { path as checkPaths } from '@platformos/platformos-check-node';
import path from 'path';

vi.setConfig({ testTimeout: 60000 });

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'check', name);
const run = (fixtureName, options = '') => exec(`${cliPath} check run ${options}`, { cwd: cwd(fixtureName) });

describe('pos-cli check run', () => {
  describe('Happy path', () => {
    test('Clean liquid files - no issues', async () => {
      const { stdout, code } = await run('clean');

      expect(code).toEqual(0);
      expect(stdout).toMatch('No offenses found');
    });

    test('Clean liquid files with silent mode', async () => {
      const { stdout, code } = await run('clean', '-s');

      expect(code).toEqual(0);
      expect(stdout).not.toMatch('No offenses found');
    });

    test('Liquid files with issues', async () => {
      const { stdout, code } = await run('with-issues');

      expect(code).toEqual(1);
      expect(stdout).toMatch('3 offenses found in 1 file');
      expect(stdout).toMatch('3 warnings');
      expect(stdout).toMatch('app/views/pages/index.liquid');
      expect(stdout).toMatch('UndefinedObject');
      expect(stdout).toMatch('Unknown object \'title\' used');
      expect(stdout).toMatch('Unknown object \'user\' used');
      expect(stdout).toMatch('Unknown object \'undefined_variable\' used');
      // Check for code snippets
      expect(stdout).toMatch('{{ title }}');
      expect(stdout).toMatch('{{ user.name }}');
    });

    test('Multiple files with issues', async () => {
      const { stdout, code } = await run('multiple-issues');

      expect(code).toEqual(1);
      expect(stdout).toMatch('4 offenses found in 2 files');
      expect(stdout).toMatch('4 warnings');
      expect(stdout).toMatch('app/views/pages/about.liquid');
      expect(stdout).toMatch('app/views/pages/contact.liquid');
      expect(stdout).toMatch('Unknown object \'page_title\' used');
      expect(stdout).toMatch('Unknown object \'unknown_object\' used');
      expect(stdout).toMatch('Unknown object \'site\' used');
      expect(stdout).toMatch('Unknown object \'undefined_var\' used');
      // Check for code snippets
      expect(stdout).toMatch('{{ page_title }}');
      expect(stdout).toMatch('{{ site.name }}');
    });

    test('JSON output format with clean files', async () => {
      const { stdout, code } = await run('clean', '-f json');

      expect(code).toEqual(0);

      const json = JSON.parse(stdout);
      expect(json.offenseCount).toEqual(0);
      expect(json.fileCount).toEqual(0);
      expect(json.errorCount).toEqual(0);
      expect(json.warningCount).toEqual(0);
      expect(json.infoCount).toEqual(0);
      expect(json.files).toEqual([]);
    });

    test('JSON output format with issues', async () => {
      const { stdout, code } = await run('with-issues', '-f json');

      expect(code).toEqual(1);

      const json = JSON.parse(stdout);
      expect(json.offenseCount).toEqual(3);
      expect(json.fileCount).toEqual(1);
      expect(json.errorCount).toEqual(0);
      expect(json.warningCount).toEqual(3);
      expect(json.infoCount).toEqual(0);
      expect(json.files).toHaveLength(1);
      expect(json.files[0]).toHaveProperty('path');
      expect(json.files[0]).toHaveProperty('offenses');
      expect(json.files[0]).toHaveProperty('errorCount');
      expect(json.files[0]).toHaveProperty('warningCount');
      expect(json.files[0]).toHaveProperty('infoCount');
      expect(json.files[0].offenses).toHaveLength(3);
      expect(json.files[0].offenses[0]).toHaveProperty('check');
      expect(json.files[0].offenses[0]).toHaveProperty('severity');
      expect(json.files[0].offenses[0]).toHaveProperty('start_row');
      expect(json.files[0].offenses[0]).toHaveProperty('start_column');
      expect(json.files[0].offenses[0]).toHaveProperty('message');
      expect(json.files[0].path).toMatch('app/views/pages/index.liquid');
      expect(json.files[0].offenses[0].severity).toEqual('warning');
    });

    test('Filter by check name with --check', async () => {
      const { stdout, code } = await run('with-issues', '--check UndefinedObject');

      expect(code).toEqual(1);
      expect(stdout).toMatch('3 offenses found in 1 file');
      expect(stdout).toMatch('UndefinedObject');
    });

    test('Errors on unknown check name', async () => {
      const { stderr, code } = await run('with-issues', '--check NonExistentCheck');

      expect(code).toEqual(1);
      expect(stderr).toMatch('Unknown check: NonExistentCheck');
      expect(stderr).toMatch('Available checks:');
    });

    test('Filter by check name with -c shorthand', async () => {
      const { stdout, code } = await run('with-issues', '-c UndefinedObject');

      expect(code).toEqual(1);
      expect(stdout).toMatch('3 offenses found in 1 file');
      expect(stdout).toMatch('UndefinedObject');
    });

    test('JSON output with --check filter', async () => {
      const { stdout, code } = await run('with-issues', '-f json --check UndefinedObject');

      expect(code).toEqual(1);

      const json = JSON.parse(stdout);
      expect(json.offenseCount).toEqual(3);
      expect(json.files[0].offenses.every(o => o.check === 'UndefinedObject')).toBe(true);
    });

    test('JSON output errors on unknown check name', async () => {
      const { stderr, code } = await run('with-issues', '-f json --check NonExistentCheck');

      expect(code).toEqual(1);
      expect(stderr).toMatch('Unknown check: NonExistentCheck');
    });

    test('A subdirectory is refused, naming the root instead of checking nothing', async () => {
      // This previously asserted that a subdirectory path lints that subdirectory. It never did:
      // the path is taken as the project ROOT, and no source files are found beneath it, so the
      // run reported "No offenses found" over zero files. It now refuses and says where the root
      // is. `app/` is the only marker here, so the message reports an inference, not a fact.
      const root = cwd('with-issues');
      const specificPath = path.join(root, 'app/views/pages');
      const { stdout, stderr } = await exec(`${cliPath} check run ${specificPath}`);

      // The refusal is platformos-check's own message, and it names a path the way it keys one:
      // through a URI, which lowercases a Windows drive letter. So `D:\…` comes back as `d:\…`,
      // while path.join above keeps the case it was given. Spell the expectation with the same
      // conversion that produced the output rather than comparing case-insensitively — it is
      // exported for this, and is the identity on Linux and macOS.
      const asReported = p => checkPaths.fsPath(checkPaths.toUri(p));

      expect(stdout).not.toMatch('offenses found');
      expect(stderr).toContain(
        `Nothing was checked: ${asReported(specificPath)} is not a platformOS project root.`
      );
      expect(stderr).toContain(`The nearest above it is ${asReported(root)}, matched on app/ alone`);
    });

    test('A project root with no source files says so, instead of reporting it clean', async () => {
      // The fixture is a real project root (it has app/) holding no .liquid, .yml or .graphql
      // file. Reporting "No offenses found" here would be the same false-clean this branch fixes:
      // a success message over nothing examined.
      const { stdout, code } = await run('no-source-files');

      expect(code).toEqual(0);
      expect(stdout).not.toMatch('No offenses found');
      expect(stdout).toContain(
        `Nothing was checked: no source files found in ${cwd('no-source-files')}.`
      );
      expect(stdout).toContain(
        'Sources are .liquid, .yml, .graphql files under app/, marketplace_builder/, ' +
          'modules/*/public/, modules/*/private/ — minus anything .platformos-check.yml ignores.'
      );
    });

    test('A clean run states how many files it checked', async () => {
      // The general form of the same rule: every clean run says what was examined, so "nothing was
      // wrong" can never be confused with "nothing was looked at".
      const { stdout, code } = await run('clean');

      expect(code).toEqual(0);
      expect(stdout).toContain('No offenses found.');
      expect(stdout).toMatch(/Checked \d+ files?\. No offenses found\./);
    });
  });

  describe('Error handling', () => {
    test('Non-existent path', async () => {
      const nonExistentPath = path.join(process.cwd(), 'test', 'fixtures', 'check', 'nonexistent');
      const { stderr, code } = await exec(`${cliPath} check run ${nonExistentPath}`);

      expect(code).toEqual(1);
      expect(stderr).toMatch('Path does not exist');
    });

    test('File instead of directory', async () => {
      const filePath = path.join(cwd('clean'), 'app/views/pages/index.liquid');
      const { stderr, code } = await exec(`${cliPath} check run ${filePath}`);

      expect(code).toEqual(1);
      expect(stderr).toMatch('Path is not a directory');
    });
  });

  describe('Init command', () => {
    test('Create config file', async () => {
      const tempDir = path.join(process.cwd(), 'test', 'fixtures', 'check', 'init-test-' + Date.now());
      const fs = await import('fs');

      // Create temp directory
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, '.pos'), '{}');

      try {
        const { stdout, code } = await exec(`${cliPath} check init ${tempDir}`);

        expect(code).toEqual(0);
        expect(stdout).toMatch('Created .platformos-check.yml');

        // Verify config file was created
        const configPath = path.join(tempDir, '.platformos-check.yml');
        expect(fs.existsSync(configPath)).toBeTruthy();

        // Verify config file content
        const configContent = fs.readFileSync(configPath, 'utf8');
        expect(configContent).toMatch('extends: platformos-check:recommended');
        expect(configContent).toMatch('ignore:');
        expect(configContent).toMatch('- node_modules/**');
        expect(configContent).toMatch('# Below are all available settings');
      } finally {
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('Config file already exists', async () => {
      const tempDir = path.join(process.cwd(), 'test', 'fixtures', 'check', 'init-exists-' + Date.now());
      const fs = await import('fs');

      // Create temp directory with existing config
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, '.pos'), '{}');
      fs.writeFileSync(path.join(tempDir, '.platformos-check.yml'), 'existing config');

      try {
        const { stdout, code } = await exec(`${cliPath} check init ${tempDir}`);

        expect(code).toEqual(0);
        expect(stdout).toMatch('.platformos-check.yml already exists');

        // Verify original file wasn't overwritten
        const configContent = fs.readFileSync(path.join(tempDir, '.platformos-check.yml'), 'utf8');
        expect(configContent).toEqual('existing config');
      } finally {
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Help text', () => {
    test('Check command help', async () => {
      const { stdout } = await exec(`${cliPath} check --help`);

      expect(stdout).toMatch('Usage: pos-cli check');
      expect(stdout).toMatch('run [path]');
      expect(stdout).toMatch('init [path]');
      expect(stdout).toMatch('check Liquid code quality with platformos-check linter');
      expect(stdout).toMatch('initialize .platformos-check.yml configuration file');
    });

    test('Check run command help', async () => {
      const { stdout } = await exec(`${cliPath} check run --help`);

      expect(stdout).toMatch('Usage: pos-cli check run');
      expect(stdout).toMatch('-a');
      expect(stdout).toMatch('enable automatic fixing');
      expect(stdout).toMatch('-c, --check <name>');
      expect(stdout).toMatch('only show offenses from the named check');
      expect(stdout).toMatch('-f <format>');
      expect(stdout).toMatch('output format');
      expect(stdout).toMatch('-s, --silent');
    });

    test('Check init command help', async () => {
      const { stdout } = await exec(`${cliPath} check init --help`);

      expect(stdout).toMatch('Usage: pos-cli check init');
      expect(stdout).toMatch('initialize .platformos-check.yml configuration file');
    });
  });
});
