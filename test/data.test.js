const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');

const env = Object.assign(process.env, {
  CI: true,
  MPKIT_URL: 'http://example.com',
  MPKIT_TOKEN: '1234',
  MPKIT_EMAIL: 'foo@example.com'
});

describe('Data clean', () => {
  test('shows message when wrong confirmation passed inline', async () => {
    try {
      await exec(`echo "wrong confirm" | ${cliPath} data clean`, { env });
    } catch(e) {
      expect(`${e}`).toMatch('Wrong confirmation. Closed without cleaning instance data.');
    }
  });
});

describe('Data import', () => {
  test('should show message when wrong file for data import', async ()  => {
    try {
      await exec(`echo "wrong confirm" | ${cliPath} data import foo -p ./test/fixtures/wrong_json.json`, { env });
    } catch(e) {
      expect(`${e}`).toMatch('Invalid format of ./test/fixtures/wrong_json.json. Must be a valid json file. Check file using one of JSON validators online: https://jsonlint.com');
    }
  });
});

