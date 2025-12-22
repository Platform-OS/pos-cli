import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';

const env = Object.assign(process.env, {
  CI: true,
  MPKIT_URL: 'http://google.com',
  MPKIT_TOKEN: '1234',
  MPKIT_EMAIL: 'foo@google.com'
});

describe('Data clean', () => {
  test('shows message when wrong confirmation passed inline', async () => {
    const {code, stderr} = await exec(`echo "wrong confirm" | ${cliPath} data clean`, { env });
    expect(stderr).toMatch('Wrong confirmation. Closed without cleaning instance data.');
    expect(code).toEqual(1);
  });
});

describe('Data clean real', () => {
  test('shows message when wrong confirmation passed inline', async () => {
    const {code, stderr, stdout} = await exec(`echo "CLEAN DATA" | ${cliPath} data clean`, { env });
    expect(stderr).toMatch('WARNING!!! You are going to REMOVE your data from instance: http://google.com')
    expect(stderr).toMatch('There is no coming back.')
    expect(stderr).toMatch('"statusCode": 405')
    expect(stderr).toMatch('"pathname": "/api/app_builder/data_clean"')
    expect(stderr).toMatch(env.MPKIT_URL)
  });
});

describe('Data import', () => {
  test('should show message when wrong file for data import', async ()  => {
    const {code, stderr} = await exec(`echo "wrong confirm" | ${cliPath} data import foo -p ./test/fixtures/wrong_json.json`, { env });
    expect(stderr).toMatch('Invalid format of ./test/fixtures/wrong_json.json. Must be a valid json file. Check file using one of JSON validators online: https://jsonlint.com');
    expect(code).toEqual(1);
  });
});
