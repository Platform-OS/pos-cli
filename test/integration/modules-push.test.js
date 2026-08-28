import 'dotenv/config';
import { describe, test, expect } from 'vitest';
import cli from '#test/utils/exec';
import path from 'path';
import { requireRealCredentials } from '#test/utils/credentials';

Object.assign(process.env, {
  DEBUG: true
});

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'modules', name);

const run = (fixtureName, options) => cli(`modules push ${options}`, { cwd: cwd(fixtureName), env: process.env });

describe('Server errors', () => {
  test('Empty directory', async () => {
    requireRealCredentials();
    const { stderr } = await run('empty', '--email pos-cli-ci@platformos.com');
    expect(stderr).toMatch('pos-module.json not found.');
  });

  test('Multiple modules without pos-module.json', async () => {
    requireRealCredentials();
    const { stderr } = await run('multiple_modules', '--email pos-cli-ci@platformos.com');
    expect(stderr).toMatch('pos-module.json not found.');
  });

  test('Multiple modules without pos-module.json and invalid name', async () => {
    requireRealCredentials();
    const { stderr } = await run('multiple_modules', '--email pos-cli-ci@platformos.com --name missing');
    expect(stderr).toMatch('pos-module.json not found.');
  });

  test('Module directory does not match machine_name', async () => {
    requireRealCredentials();
    const { stderr } = await run('template_values_in_root_first', '--email pos-cli-ci@platformos.com');
    expect(stderr).toMatch('Directory modules/bar/ not found.');
  });

  test.skip('now we include template-values.json in release', async () => {
    const { stderr } = await run('no_files', '--email pos-cli-ci@platformos.com');
    expect(stderr).toMatch('There are no files in module release');
  });

  test('Wrong email', async () => {
    requireRealCredentials();
    const { stderr } = await run('good', '--email foo@example.com');
    expect(stderr).toMatch('Cannot find modules/pos_cli_ci_test, creating archive with the current directory');
    expect(stderr).toMatch('You are unauthorized to do this operation. Check if your Token/URL or email/password are correct.');
  });

  // Needs a `pos_cli_ci_test` module in the Partner Portal with version 0.0.1 already
  // published — the "Name has already been taken" error only comes back when that exact
  // version exists. The module was deleted from the portal, so the push now stops one
  // step earlier with `Module "pos_cli_ci_test" not found`. Unskip once it is recreated.
  test.skip('Wrong version', async () => {
    requireRealCredentials();
    const { stdout, stderr } = await run('good', '--email pos-cli-ci@platformos.com');
    expect(stdout).toMatch('for access token');
    expect(stdout).toMatch('Release Uploaded');
    expect(stderr).toMatch('Name has already been taken');
  });
});
