import { FsStorage } from './fsStorage';
import * as path from 'path';
import * as fs from 'fs';
import os from 'os';

describe('FsStorage', () => {
  let testRoot: string;
  let testMcp: string;
  
  beforeAll(() => {
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fsstorage-'));
    testMcp = path.join(testRoot, 'mcp');
    fs.mkdirSync(testMcp, { recursive: true });
  });

  afterAll(() => {
    if (testRoot && fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('lists empty envs when no .pos', async () => {
    const storage = new FsStorage(testMcp);
    const envs = await storage.listEnvs();
    expect(envs).toEqual([]);
  });

  it('parses envs from .pos JSON', async () => {
    // Write object format to repo root .pos
    const testPosPath = path.join(testRoot, '.pos');
    const posContent = JSON.stringify({
      test: {
        account: 'test.pos.cx',
        url: 'https://test.platformos.com'
      }
    });
    fs.writeFileSync(testPosPath, posContent);

    const storage = new FsStorage(testMcp);
    const envs = await storage.listEnvs();
    expect(envs).toHaveLength(1);
    expect(envs[0].name).toBe('test');
  });
});