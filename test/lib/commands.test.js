var sh = require('shelljs');
var silentState = sh.config.silent; // save old silent state

test('should return error for missing command on stdout', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js missing');
  expect(command.stderr).toEqual(expect.stringContaining('unknown command: missing'));
  sh.config.silent = silentState;
});

test('should show help on stdout', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js help');
  expect(command.stdout).toEqual(expect.stringContaining('Usage: marketplace-kit'));
  sh.config.silent = silentState;
});


test('should run help on deploy', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js deploy');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: marketplace-kit-deploy [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on data import', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js data import');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: marketplace-kit-data-import [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on data update', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js data update');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: marketplace-kit-data-update [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on data export', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js data export');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: marketplace-kit-data-export [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run env list', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js env list');
  expect(command.code).toEqual(1);
  expect(command.stderr).toEqual(expect.stringContaining('No environments registered yet, please see marketplace-kit env add'));
  sh.config.silent = silentState;
});

test('should run help on env add', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js env add');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: marketplace-kit-env-add [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run audit', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js audit');
  expect(command.code).toEqual(0);
  sh.config.silent = silentState;
});

test('should run help on gui serve', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js gui serve');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: marketplace-kit-gui-serve [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on logs', ()  => {
  sh.config.silent = true;

  let command = sh.exec('./marketplace-kit.js logs');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: marketplace-kit-logs [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on migrations run', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js migrations run');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: marketplace-kit-migrations-run [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on migrations list', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js migrations list');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: marketplace-kit-migrations-list [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on modules list', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./marketplace-kit.js modules list');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: marketplace-kit-modules-list [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on sync', ()  => {
  sh.config.silent = true;

  let command = sh.exec('./marketplace-kit.js sync');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: marketplace-kit-sync [options] [environment]'));
  sh.config.silent = silentState;
});
