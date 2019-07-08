var sh = require('@platform-os/shelljs');
var silentState = sh.config.silent; // save old silent state

test('should return error for missing command on stdout', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli missing');
  expect(command.stderr).toEqual(expect.stringContaining('unknown command: missing'));
  sh.config.silent = silentState;
});

test('should show help on stdout', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli help');
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli'));
  sh.config.silent = silentState;
});


test('should run help on deploy', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli deploy');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli-deploy [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on data import', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli data import');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli-data-import [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on data update', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli data update');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli-data-update [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on data export', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli data export');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli-data-export [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run env list', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli env list');
  expect(command.code).toEqual(1);
  expect(command.stderr).toEqual(expect.stringContaining('No environments registered yet, please see pos-cli env add'));
  sh.config.silent = silentState;
});

test('should run help on env add', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli env add');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli-env-add [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run audit', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli audit');
  expect(command.code).toEqual(0);
  sh.config.silent = silentState;
});

test('should run help on gui serve', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli gui serve');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli-gui-serve [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on logs', ()  => {
  sh.config.silent = true;

  let command = sh.exec('pos-cli logs');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli-logs [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on migrations run', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli migrations run');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli-migrations-run [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on migrations list', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli migrations list');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli-migrations-list [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on modules list', ()  => {
  sh.config.silent = true;
  let command = sh.exec('pos-cli modules list');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli-modules-list [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on sync', ()  => {
  sh.config.silent = true;

  let command = sh.exec('pos-cli sync');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli-sync [options] [environment]'));
  sh.config.silent = silentState;
});
