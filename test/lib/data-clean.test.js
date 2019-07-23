var sh = require('shelljs');
var authEnvs = 'MPKIT_URL=http://example.com MPKIT_TOKEN=1234 MPKIT_EMAIL=foo@example.com';

test('should show message when wrong confirmation passed inline', () => {
  sh.config.silent = true;
  let command = sh.exec(`echo "wrong confirm" | ${authEnvs} ./bin/pos-cli.js data clean`);

  expect(command.code).toEqual(1);
  expect(command.stderr).toEqual(expect.stringContaining('Wrong confirmation. Closed without cleaning instance data.'));
});
