const files = require('../../lib/files');

const configFileExample = 'test/fixtures/template-values.json';

test('returns empty hash if there is a problem loading configuration file', () => {
  const config = files.readJSON('');

  expect(config).toEqual({});
});

test('parses values from configuration file', () => {
  const config = files.readJSON(configFileExample);

  expect(config['aKey']).toEqual('aStringValue');
});
