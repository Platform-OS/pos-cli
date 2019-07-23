/* global test, expect */
var sh = require('shelljs');
var silentState = sh.config.silent; // save old silent state

test('should return error for missing command on stdout', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js missing');
  expect(command.stderr).toEqual(expect.stringContaining('unknown command: missing'));
  sh.config.silent = silentState;
});

test('should show help on stdout', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js help');
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli'));
  sh.config.silent = silentState;
});


test('should run help on deploy', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js deploy');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli deploy [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on data import', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js data import');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli data import [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on data update', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js data update');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli data update [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on data export', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js data export');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli data export [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run env list', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js env list');
  expect(command.code).toEqual(1);
  expect(command.stderr).toEqual(expect.stringContaining('No environments registered yet, please see pos-cli env add'));
  sh.config.silent = silentState;
});

test('should run help on env add', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js env add');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli env add [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run audit', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js audit');
  expect(command.code).toEqual(0);
  sh.config.silent = silentState;
});

test('should run help on gui serve', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js gui serve');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli gui serve [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on logs', ()  => {
  sh.config.silent = true;

  let command = sh.exec('./bin/pos-cli.js logs');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli logs [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on migrations run', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js migrations run');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli migrations run [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on migrations list', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js migrations list');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli migrations list [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on modules list', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js modules list');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli modules list [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on sync', ()  => {
  sh.config.silent = true;

  let command = sh.exec('./bin/pos-cli.js sync');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli sync [options] [environment]'));
  sh.config.silent = silentState;
});

test('should run help on init', ()  => {
  sh.config.silent = true;
  let command = sh.exec('./bin/pos-cli.js init --help');
  expect(command.code).toEqual(0);
  expect(command.stdout).toEqual(expect.stringContaining('Usage: pos-cli init [options]'));
  sh.config.silent = silentState;
});
