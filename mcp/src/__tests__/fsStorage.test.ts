import * as fs from 'fs';
import * as path from 'path';
import os from 'os';
import { FsStorage } from '../storage/fsStorage';

describe('FsStorage', () => {
  let testRoot: string;
  let testMcp: string;

  beforeAll(() => {
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-fs-test-'));
    testMcp = path.join(testRoot, 'mcp');
    fs.mkdirSync(testMcp, { recursive: true });
  });

  afterAll(() => {
    if (testRoot && fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    const testPosPath = path.join(testRoot!, '.pos');
    if (fs.existsSync(testPosPath)) {
      fs.rmSync(testPosPath, { recursive: true, force: true });
    }
  });

  test('save and list envs', async () => {
    const s = new FsStorage(testMcp);
    await s.saveEnv({ name: 'test', url: 'https://api', account: 'a', token: 'tok' });
    const envs = await s.listEnvs();
    expect(envs.find(e => e.name === 'test')).toBeTruthy();
  });

  test('listClients default when missing', async () => {
    const testClientsPath = path.join(testMcp, 'clients.json');
    if (fs.existsSync(testClientsPath)) {
      fs.unlinkSync(testClientsPath);
    }
    const s = new FsStorage(testMcp);
    const clients = await s.listClients();
    expect(clients[0]).toMatchObject({ name: 'default', token: 'client-secret' });
  });
});
