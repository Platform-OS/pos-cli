const exec = require('../utils/exec');
const cliPath = require('../utils/cliPath');

const getEnvs = () => {
  const env = Object.assign({}, process.env, { CI: true });
  delete env.MPKIT_URL;
  delete env.MPKIT_EMAIL;
  delete env.MPKIT_TOKEN;
  delete env.MPKIT_PASSWORD;
  return env;
};
const run = async args => exec(`${cliPath} ${args}`, { env: getEnvs() });

test('should return error for missing command on stdout', async () => {
  let { stderr, code } = await run('missing');
  expect(stderr).toMatch('unknown command: missing');
  expect(code).toEqual(1);
});

test('should show help on stdout', async () => {
  const { stdout, code } = await run('help');
  expect(stdout).toMatch('Usage: pos-cli [options] [command]');
  expect(code).toEqual(0);
});

test('should run help on deploy', async () => {
  const { stdout, stderr, code } = await run('deploy');
  expect(stdout).toMatch('Usage: pos-cli deploy [options] [environment]');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]`');
  expect(code).toEqual(1);
});

test('should run help on data import', async () => {
  const { stdout, code } = await run('data import');
  expect(stdout).toMatch('Usage: pos-cli data import [options] [environment]');
  expect(code).toEqual(1);
});

test('should run help on data update', async () => {
  const { stdout } = await run('data update');
  expect(stdout).toMatch('Usage: pos-cli data update [options] [environment]');
});

test('should run help on data export', async () => {
  const { stdout, code } = await run('data export');
  expect(stdout).toMatch('Usage: pos-cli data export [options] [environment]');
  expect(code).toEqual(1);
});

test('should run env list', async () => {
  const { stderr, code } = await run('env list');
  expect(stderr).toMatch('No environments registered yet, please see pos-cli env add');
  expect(code).toEqual(0);
});

test('should run help on env add', async () => {
  const { stdout, code } = await run('env add');
  expect(stdout).toMatch('Usage: pos-cli env add [options] [environment]');
  expect(code).toEqual(1);
});

test('should run help on gui serve', async () => {
  const { stdout, code } = await run('gui serve');
  expect(stdout).toMatch('Usage: pos-cli gui serve [options] [environment]');
  expect(code).toEqual(1);
});

test('should run help on logs', async () => {
  const { stdout, code } = await run('logs');
  expect(stdout).toMatch('Usage: pos-cli logs [options] [environment]');
  expect(code).toEqual(1);
});

test('should run help on migrations run', async () => {
  const { stdout, code } = await run('migrations run');
  expect(stdout).toMatch('Usage: pos-cli migrations run [options] [environment]');
  expect(code).toEqual(1);
});

test('should run help on migrations list', async () => {
  const { stdout, code } = await run('migrations list');
  expect(stdout).toMatch('Usage: pos-cli migrations list [options] [environment]');
  expect(code).toEqual(1);
});

test('should run help on modules list', async () => {
  const { stdout, code } = await run('modules list');
  expect(stdout).toMatch('Usage: pos-cli modules list [options] [environment]');
  expect(code).toEqual(1);
});

// TODO: Implement
test.skip('should run help on modules remove', async () => {
  const { stdout, code } = await run('modules remove');
  expect(stdout).toMatch('Usage: pos-cli modules remove [environment] <name>');
  expect(code).toEqual(1);
});

test('should run help on modules push', async () => {
  const { stdout, code } = await run('modules push');
  expect(stdout).toMatch('Usage: pos-cli modules push [options]');
  expect(code).toEqual(1);
});

test('should run help on sync', async () => {
  const { stdout, code } = await run('sync');
  expect(stdout).toMatch('Usage: pos-cli sync [options] [environment]');
  expect(code).toEqual(1);
});

test('should run help on init', async () => {
  const { stdout, code } = await run('init --help');
  expect(stdout).toMatch('Usage: pos-cli init [options]');
  expect(code).toEqual(0);
});
