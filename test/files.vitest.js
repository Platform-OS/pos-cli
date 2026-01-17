import files from '../lib/files';

const configFileExample = 'test/fixtures/template-values.json';
const ignoreListExample = 'test/fixtures/.posignore';

test('returns empty hash if there is a problem loading configuration file', () => {
  const config = files.readJSON('');

  expect(config).toEqual({});
});

test('parses values from configuration file', () => {
  const config = files.readJSON(configFileExample);

  expect(config['aKey']).toEqual('aStringValue');
});

test('reads values from .posignore file', () => {
  const ignoreList = files.getIgnoreList(ignoreListExample);
  expect(ignoreList).toEqual(['foo', 'bar', 'baz']);
});
