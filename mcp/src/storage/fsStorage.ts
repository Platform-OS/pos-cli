import * as path from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

export interface PlatformOSEnv {
  name: string;
  url: string;
  account: string;
  site?: string;
  token?: string;
  email?: string;
}

export interface PlatformClient {
  name: string;
  token: string;
}

export class FsStorage {
  private cwd: string;
  private envsDir: string;
  private clientsPath: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.envsDir = path.join(cwd, '.pos/envs');
    this.clientsPath = path.join(cwd, 'clients.json');
    this.ensureDirs();
  }

  private ensureDirs() {
    if (!existsSync(this.envsDir)) {
      mkdirSync(this.envsDir, { recursive: true });
    }
  }

  async listEnvs(): Promise<PlatformOSEnv[]> {
    if (!existsSync(this.envsDir)) return [];
    const files = (await import('fs/promises')).readdir(this.envsDir);
    const envFiles = (await files).filter(f => f.endsWith('.json'));
    const envs: PlatformOSEnv[] = [];
    for (const file of envFiles) {
      try {
        const data = JSON.parse(readFileSync(path.join(this.envsDir, file), 'utf8'));
        envs.push({ name: file.replace('.json', ''), ...data });
      } catch {}
    }
    return envs;
  }

  async saveEnv(env: PlatformOSEnv): Promise<void> {
    const filePath = path.join(this.envsDir, `${env.name}.json`);
    writeFileSync(filePath, JSON.stringify(env, null, 2));
  }

  async listClients(): Promise<PlatformClient[]> {
    if (!existsSync(this.clientsPath)) {
      return [{ name: 'default', token: 'client-secret' }];
    }
    const data = JSON.parse(readFileSync(this.clientsPath, 'utf8'));
    return Object.entries(data).map(([name, client]: any) => ({ name, token: client.token }));
  }
}