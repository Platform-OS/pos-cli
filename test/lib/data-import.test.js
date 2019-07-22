var sh = require('shelljs');
var silentState = sh.config.silent; // save old silent state
var authEnvs = 'MPKIT_URL=http://example.com MPKIT_TOKEN=1234 MPKIT_EMAIL=foo@example.com';

test('should show message when wrong file for data import', ()  => {
  sh.config.silent = true;
  let command = sh.exec(`${authEnvs} ./bin/pos-cli.js data import foo -p ./test/fixtures/wrong_json.json`);

  expect(command.code).toEqual(1);
  expect(command.stderr).toEqual(expect.stringContaining('Invalid format of ./test/fixtures/wrong_json.json. Must be a valid json file. Check file using one of JSON validators online: https://jsonlint.com'));
  sh.config.silent = silentState;
});
