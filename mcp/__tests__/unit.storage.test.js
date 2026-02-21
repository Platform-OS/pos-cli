const Storage = require('../storage');
const path = require('path');

describe('Storage', () => {
  const fixtures = path.join(__dirname, '..', '..', 'test', 'fixtures');
  const storage = new Storage({ storagePath: fixtures });

  test('listEnvironments returns array', async () => {
    const list = await storage.listEnvironments();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toContain('template-values');
  });

  test('getEnvironment returns parsed JSON', async () => {
    const env = await storage.getEnvironment('template-values');
    expect(env).toHaveProperty('aKey', 'aStringValue');
  });
});
