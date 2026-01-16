import { PlatformOSClient } from '../lib/apiWrappers';
import { FsStorage } from '../storage/fsStorage';
import * as fs from 'fs';
import * as path from 'path';

describe('PlatformOSClient', () => {
  let backupPos: string | null = null;
  const repoPosPath = path.join(path.dirname(process.cwd()), '.pos');

  beforeAll(() => {
    // Backup current .pos
    if (fs.existsSync(repoPosPath)) {
      backupPos = path.join(process.cwd(), 'staging-test-backup.pos');
      fs.copyFileSync(repoPosPath, backupPos);
    }

    // Seed staging without token
    fs.writeFileSync(repoPosPath, JSON.stringify({
      staging: {
        url: 'https://api.example.com',
        account: 'acc'
      }
    }));
  });

  afterAll(() => {
    // Restore backup
    if (backupPos && fs.existsSync(backupPos)) {
      fs.copyFileSync(backupPos, repoPosPath);
      fs.unlinkSync(backupPos);
    } else if (!backupPos) {
      fs.unlinkSync(repoPosPath);
    }
  });

  test('getGateway throws when token missing', async () => {
    const client = new PlatformOSClient();
    await expect(client.getGateway('staging')).rejects.toThrow('No valid token');
  });
});
