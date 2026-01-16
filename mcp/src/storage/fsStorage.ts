import * as path from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

export interface PlatformOSEnv {
  name: string;
  url: string;
  account?: string;
  site?: string;
  token?: string;
  email?: string;
}

export interface PlatformClient {
  name: string;
  token: string;
}

type StoredEnv = Omit<PlatformOSEnv, 'name'>;export class FsStorage {
  private readonly baseCwd: string;
  private readonly repoRoot: string;
  private readonly posPath: string;
  private readonly clientsPath: string;

  constructor(baseCwd: string = process.cwd()) {
    this.baseCwd = baseCwd;
    this.repoRoot = path.dirname(baseCwd);
    this.posPath = path.join(this.repoRoot, '.pos');
    this.clientsPath = path.join(this.baseCwd, 'clients.json');
  }  async listEnvs(): Promise<PlatformOSEnv[]> {
    if (!existsSync(this.posPath)) return [];
    try {
      const content = readFileSync(this.posPath, 'utf8');
      const posConfig: Record<string, StoredEnv> = JSON.parse(content);
      return Object.entries(posConfig).map(([name, envData]) => ({
        name,
        ...envData
      } as PlatformOSEnv));
    } catch (e) {
      return [];
    }
  }

  async saveEnv(env: PlatformOSEnv): Promise<void> {
    let posConfig: Record<string, StoredEnv> = {};
    if (existsSync(this.posPath)) {
      try {
        const content = readFileSync(this.posPath, 'utf8');
        posConfig = JSON.parse(content);
      } catch (e) {
        // Invalid .pos, start fresh
      }
    }
    posConfig[env.name] = {
      url: env.url,
      account: env.account,
      site: env.site,
      token: env.token,
      email: env.email
    };
    writeFileSync(this.posPath, JSON.stringify(posConfig, null, 2));
  }

  async listClients(): Promise<PlatformClient[]> {
    if (!existsSync(this.clientsPath)) {
      return [{ name: 'default', token: 'client-secret' }];
    }
    const data = JSON.parse(readFileSync(this.clientsPath, 'utf8'));
    return Object.entries(data).map(([name, client]: any) => ({ name, token: client.token }));
  }
}