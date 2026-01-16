import { FsStorage } from './fsStorage';
import * as path from 'path';
import * as fs from 'fs';

describe('FsStorage', () => {
  const testDir = '/tmp/test-pos';
  
  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('lists empty envs when no .pos', async () => {
    const storage = new FsStorage(testDir);
    const envs = await storage.listEnvs();
    expect(envs).toEqual([]);
  });

  it('parses envs from .pos JSON', async () => {
    const posContent = JSON.stringify({
      envs: [
        { name: 'test', account: 'test.pos.cx' }
      ]
    });
    fs.writeFileSync(path.join(testDir, '.pos'), posContent);

    const storage = new FsStorage(testDir);
    const envs = await storage.listEnvs();
    expect(envs).toHaveLength(1);
    expect(envs[0].name).toBe('test');
  });
});