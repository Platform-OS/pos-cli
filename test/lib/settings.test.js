const settings = require('./../../lib/settings');

const configFileExample = 'test/fixtures/template-values.json';

test('returns empty hash if there is a problem loading configuration file', () => {
  const config = settings.loadSettingsFile('');

  expect(config).toEqual({});
});

test('parses values from configuration file', () => {
  const config = settings.loadSettingsFile(configFileExample);

  expect(config['aKey']).toEqual('aStringValue');
});
