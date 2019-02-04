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

