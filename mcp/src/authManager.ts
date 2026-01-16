import { FsStorage, type PlatformClient } from './storage/fsStorage';

export class AuthManager {
  private adminApiKey?: string;
  private clients = new Map<string, PlatformClient>();

  constructor(storage: FsStorage) {
    this.adminApiKey = process.env.ADMIN_API_KEY;
    this.loadClients(storage);
  }

  private async loadClients(storage: FsStorage) {
    const clients = await storage.listClients();
    this.clients.clear();
    for (const client of clients) {
      this.clients.set(client.token, client);
    }
  }

  validateAdmin(apiKey: string): boolean {
    return Boolean(this.adminApiKey && apiKey === this.adminApiKey);
  }

  validateMcpClient(token: string): PlatformClient | null {
    return this.clients.get(token) || null;
  }

  // Reload clients if needed
  async reloadClients(storage: FsStorage): Promise<void> {
    await this.loadClients(storage);
  }
}