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
  const { stderr, code } = await run('env add --email email@example.com --url http://instance.com');
  expect(stderr).toMatch("error: missing required argument 'environment'");
  expect(code).toEqual(1);
});

test('should run help on gui serve', async () => {
  const { stderr, code } = await run('gui serve');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]');
  expect(code).toEqual(1);
});

test('should run help on logs', async () => {
  const { stderr, code } = await run('logs');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]');
  expect(code).toEqual(1);
});

test('should run help on migrations run', async () => {
  const { stderr, code } = await run('migrations run');
  expect(stderr).toMatch("error: missing required argument 'timestamp'")
  expect(code).toEqual(1);
});

test('should run help on migrations run with timestamp', async () => {
  const { stderr, code } = await run('migrations run 900000000');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]')
  expect(code).toEqual(1);
});

test('should run help on migrations list', async () => {
  const { stderr, code } = await run('migrations list');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]')
  expect(code).toEqual(1);
});

test('should run help on modules list', async () => {
  const { stderr, code } = await run('modules list');
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]')
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
  expect(stderr).toMatch('No environment specified, please pass environment for a command `pos-cli <command> [environment]')
  expect(code).toEqual(1);
});

test('should run help on init', async () => {
  const { stdout, code } = await run('init --help');
  expect(stdout).toMatch('Usage: pos-cli init [options]');
  expect(code).toEqual(0);
});
