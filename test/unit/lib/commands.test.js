import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import cli from '#test/utils/exec';

// Every case asserts what the CLI says when it has not been told enough, which only holds in a
// directory with no `.pos` and no project — not the repository root, where another test file's
// config or a developer's own `.pos` changes the answers. MPKIT_* is removed for the same reason.
let workDir;

beforeAll(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-commands-'));
});

afterAll(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

const getEnvs = () => {
  const env = Object.assign({}, process.env, { CI: true });
  delete env.MPKIT_URL;
  delete env.MPKIT_EMAIL;
  delete env.MPKIT_TOKEN;
  delete env.MPKIT_PASSWORD;
  delete env.CONFIG_FILE_PATH;
  return env;
};
const run = async (args, cwd = workDir) => cli(args, { env: getEnvs(), cwd });

// That the cases above pass because of the temp directory, not because the repository root
// happened to hold no `.pos` at the time.
test('the CLI reads the working directory it is given, not the one the tests run from', async () => {
  const configured = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-commands-configured-'));
  fs.writeFileSync(
    path.join(configured, '.pos'),
    JSON.stringify({ 'only-here': { url: 'https://only-here.example.com', email: 'e@x', token: 't' } })
  );
  try {
    const { stdout, code } = await run('env list', configured);

    expect(stdout).toMatch('only-here');
    expect(code).toEqual(0);
  } finally {
    fs.rmSync(configured, { recursive: true, force: true });
  }
});

test('should return error for missing command on stdout', async () => {
  let { stderr, code } = await run('missing');
  expect(stderr).toMatch("error: unknown command 'missing'");
  expect(code).toEqual(1);
});

test('should show help on stdout', async () => {
  const { stdout, code } = await run('help');
  expect(stdout).toMatch('Usage: pos-cli [options] [command]');
  expect(code).toEqual(0);
});

test('should run help on deploy', async () => {
  const { stderr, code } = await run('deploy');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]`');
  expect(code).toEqual(1);
});

test('should run help on data import', async () => {
  const { stderr, code } = await run('data import');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]');
  expect(code).toEqual(1);
});

test('should run help on data update', async () => {
  const { stderr } = await run('data update');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]');
});

test('should run help on data export', async () => {
  const { stderr, code } = await run('data export');
  expect(stderr).toMatch("error: required option '-p --path <export-file-path>' not specified");
  expect(code).toEqual(1);
});

test('should run env list', async () => {
  const { stdout, code } = await run('env list');
  expect(stdout).toMatch('No environments registered yet, please see pos-cli env add');
  expect(code).toEqual(0);
});

test('should run help on env add', async () => {
  const { code, stderr } = await run('env add');
  expect(stderr).toMatch('Usage: pos-cli env add [options] <environment>');
  expect(code).toEqual(1);
});

test('should run help on gui serve', async () => {
  const { stderr, code } = await run('gui serve');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]`');
  expect(code).toEqual(1);
});

test('should run help on logs', async () => {
  const { stderr, code } = await run('logs');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]`');
  expect(code).toEqual(1);
});

test('should run help on migrations run', async () => {
  const { stderr, code } = await run('migrations run');
  expect(stderr).toMatch("error: missing required argument 'timestamp'");
  expect(code).toEqual(1);
});

test('should run help on migrations run with timestamp', async () => {
  const { stderr, code } = await run('migrations run 900000000');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]');
  expect(code).toEqual(1);
});

test('should run help on migrations list', async () => {
  const { stderr, code } = await run('migrations list');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]');
  expect(code).toEqual(1);
});

test('should run help on modules list', async () => {
  const { stderr, code } = await run('modules list');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]');
  expect(code).toEqual(1);
});

test('should run help on modules remove', async () => {
  const { stderr, code } = await run('modules remove');
  expect(stderr).toMatch('Usage: pos-cli modules remove [options] [environment] <name>');
  expect(code).toEqual(1);
});

test('should run help on modules push', async () => {
  const { stderr, code } = await run('modules push');
  expect(stderr).toMatch('Usage: pos-cli modules push [options]');
  expect(code).toEqual(1);
});

test('should run help on sync', async () => {
  const { stderr, code } = await run('sync');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]');
  expect(code).toEqual(1);
});

test('should run help on init', async () => {
  const { stdout, code } = await run('init --help');
  expect(stdout).toMatch('Usage: pos-cli init [options]');
  expect(code).toEqual(0);
});

test('should run help on logsv2', async () => {
  const { stderr, code } = await run('logsv2');
  expect(stderr).toMatch('Usage: pos-cli logsv2 [options] [command]');
  expect(code).toEqual(1);
});

test('should run help logsv2 search', async () => {
  const { stderr, code } = await run('logsv2 search');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]`');
  expect(code).toEqual(1);
});

