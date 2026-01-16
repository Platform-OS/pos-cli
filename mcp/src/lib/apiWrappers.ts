import * as path from 'path';
import type { PlatformOSEnv } from '../storage/fsStorage';
import { FsStorage } from '../storage/fsStorage';
import { config } from '../config';
import { z } from 'zod';

export interface GraphQLResult {
  data?: any;
  errors?: Array<{ message: string; locations?: any[] }>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: any[];
}

export class PlatformOSClient {
  async getGateway(envName: string): Promise<any> {
    const storage = new FsStorage(config.cwd);
    const envs: PlatformOSEnv[] = await storage.listEnvs();
    const envConfig = envs.find(e => e.name === envName);
    if (!envConfig?.token) {
      throw new Error(`No valid token for environment '${envName}'`);
    }
    // @ts-ignore
    const mod = await import('../../../lib/proxy.js');
    const Gateway = mod.default;
    const portal = null;
    return new Gateway({ 
      url: envConfig.url, 
      token: envConfig.token, 
      email: envConfig.email || '' 
    }, portal);
  }

  async graphql(env: string, query: string, variables: Record<string, any> = {}): Promise<ApiResponse<GraphQLResult>> {
    try {
      const gw = await this.getGateway(env);
      const result = await gw.graph({ query, variables });
      return {
        success: !result.errors || result.errors.length === 0,
        data: result.data,
        errors: result.errors || [],
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async liquidRender(env: string, template: string, locals: Record<string, any> = {}): Promise<ApiResponse<string>> {
    try {
      const gw = await this.getGateway(env);
      const result = await gw.liquid({ template, locals });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async listModules(env: string): Promise<ApiResponse<any[]>> {
    try {
      const gw = await this.getGateway(env);
      const result = await gw.listModules();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async dataExportStart(env: string, export_internal = true, csv_export = false): Promise<ApiResponse<{id: string}>> {
    try {
      const gw = await this.getGateway(env);
      const result = await gw.dataExportStart(export_internal, csv_export);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async dataExportStatus(env: string, id: string, csv_export = false): Promise<ApiResponse<any>> {
    try {
      const gw = await this.getGateway(env);
      const result = await gw.dataExportStatus(id, csv_export);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async listMigrations(env: string): Promise<ApiResponse<any>> {
    try {
      const gw = await this.getGateway(env);
      const result = await gw.listMigrations();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async runMigration(env: string, version: string): Promise<ApiResponse<any>> {
    try {
      const gw = await this.getGateway(env);
      const formData = { version };
      const result = await gw.runMigration(formData);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // Add more methods as needed
}

export const client = new PlatformOSClient();