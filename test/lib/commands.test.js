const cmd = require('execa').command;

test('should return error for missing command on stdout', async () => {
  let { stderr } = await cmd('./bin/pos-cli.js missing');
  expect(stderr).toMatch('unknown command: missing');
});

test('should show help on stdout', async () => {
  let { stdout } = await cmd('./bin/pos-cli.js help');
  expect(stdout).toMatch('Usage: pos-cli');
});

test('should run help on deploy', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js deploy');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli deploy [options] [environment]');
});

test('should run help on data import', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js data import');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli data import [options] [environment]');
});

test('should run help on data update', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js data update');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli data update [options] [environment]');
});

test('should run help on data export', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js data export');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli data export [options] [environment]');
});

// No idea why this one and only fails with EPERM on cmd()
test.skip('should run env list', async () => {
  const { stderr, exitCode } = await cmd('./bin/pos-cli.js env list');
  expect(exitCode).toEqual(1);
  expect(stderr).toMatch('No environments registered yet, please see pos-cli env add');
});

test('should run help on env add', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js env add');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli env add [options] [environment]');
});

test('should run audit', async () => {
  let { exitCode } = await cmd('./bin/pos-cli.js audit');
  expect(exitCode).toEqual(0);
});

test('should run help on gui serve', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js gui serve');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli gui serve [options] [environment]');
});

test('should run help on logs', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js logs');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli logs [options] [environment]');
});

test('should run help on migrations run', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js migrations run');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli migrations run [options] [environment]');
});

test('should run help on migrations list', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js migrations list');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli migrations list [options] [environment]');
});

test('should run help on modules list', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js modules list');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli modules list [options] [environment]');
});

// TODO: Implement
test.skip('should run help on modules remove', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js modules remove');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli modules remove [environment] <name>');
});

test('should run help on sync', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js sync');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli sync [options] [environment]');
});

test('should run help on init', async () => {
  let { stdout, exitCode } = await cmd('./bin/pos-cli.js init --help');
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Usage: pos-cli init [options]');
});
