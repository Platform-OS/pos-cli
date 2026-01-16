// @ts-ignore
import request from 'supertest';
import { McpServer } from '../server/mcpServer';
import { FsStorage } from '../storage/fsStorage';
import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';

let server: McpServer;
let app: any;

beforeAll(async () => {
  process.env.ADMIN_API_KEY = 'admin123';
  // ensure clients.json exists with default client
  const clientsPath = path.join(process.cwd(), 'clients.json');
  if (!fs.existsSync(clientsPath)) {
    fs.writeFileSync(clientsPath, JSON.stringify({ default: { token: 'client-secret' } }, null, 2));
  }

  server = new McpServer();
  app = (server as any).app;
});

describe('MCP Server', () => {
  test('health unauthorized', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(401);
  });

  test('health authorized', async () => {
    const res = await request(app).get('/health').set('x-api-key', 'admin123');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tools');
  });

  test('list tools unauthorized', async () => {
    const res = await request(app).get('/tools');
    expect(res.status).toBe(401);
  });

  test('list tools authorized with client token', async () => {
    const res = await request(app).get('/tools').set('Authorization', 'Bearer client-secret');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tools');
    expect(Array.isArray(res.body.tools)).toBe(true);
  });

  test('call unknown tool', async () => {
    const res = await request(app)
      .post('/call')
      .set('Authorization', 'Bearer client-secret')
      .send({ tool: 'nonexistent', input: {} });
    expect(res.status).toBe(404);
  });

  test('call tool with invalid input', async () => {
    const res = await request(app)
      .post('/call')
      .set('Authorization', 'Bearer client-secret')
      .send({ tool: 'platformos.graphql.execute', input: { env: 123 } });
    expect(res.status).toBe(400);
  });
});
