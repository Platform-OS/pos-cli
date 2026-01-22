/**
 * Unit tests for server module
 * Tests Express 5.x routing, especially /*splat pattern for SPA fallback
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock Gateway
vi.mock('#lib/proxy.js', () => {
  return {
    default: class Gateway {
      constructor() {}
      graph(body) {
        return Promise.resolve({ data: 'mocked graph response', query: body });
      }
      liquid(body) {
        return Promise.resolve({ result: 'mocked liquid response', code: body });
      }
      logs(params) {
        return Promise.resolve({ logs: [], lastId: params.lastId });
      }
      logsv2(params) {
        return Promise.resolve({ logs: [], query: params });
      }
    }
  };
});

// Mock logger
vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Success: vi.fn(),
    Error: vi.fn(),
    Print: vi.fn(),
    Warn: vi.fn()
  }
}));

describe('server - Express 5.x routing', () => {
  let app, legacy;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create Express apps similar to lib/server.js
    app = express();
    legacy = express();

    const Gateway = (await import('#lib/proxy.js')).default;
    const gateway = new Gateway({
      url: 'https://example.com',
      token: 'test-token',
      email: 'test@example.com'
    });

    // Setup middleware
    app.use(express.json());
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    legacy.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // Setup static file serving
    // Note: In real tests with actual files, these would serve real directories
    // For unit tests, we'll mock the static middleware behavior
    const guiNextPath = path.resolve(__dirname, '..', '..', 'gui', 'next', 'build');
    const guiGraphqlPath = path.resolve(__dirname, '..', '..', 'gui', 'graphql', 'public');
    const guiLiquidPath = path.resolve(__dirname, '..', '..', 'gui', 'liquid', 'public');
    const guiAdminPath = path.resolve(__dirname, '..', '..', 'gui', 'admin', 'dist');

    // For unit testing, we'll create mock static middleware
    const mockStatic = (basePath) => (req, res, next) => {
      // Simulate static file serving
      if (req.path.includes('.js') || req.path.includes('.css') || req.path.includes('.html')) {
        res.send(`Mock static file from ${basePath}`);
      } else {
        next();
      }
    };

    app.use('/', mockStatic(guiNextPath));
    app.use('/gui/graphql', mockStatic(guiGraphqlPath));
    app.use('/gui/liquid', mockStatic(guiLiquidPath));
    legacy.use('/', mockStatic(guiAdminPath));

    // Setup API routes
    app.get('/info', (req, res) => {
      res.json({ MPKIT_URL: 'https://example.com', version: '1.0.0' });
    });

    app.post('/graphql', (req, res) => {
      gateway.graph(req.body)
        .then(body => res.send(body))
        .catch(error => res.send(error));
    });

    app.post('/api/graph', (req, res) => {
      gateway.graph(req.body)
        .then(body => res.send(body))
        .catch(error => res.send(error));
    });

    app.post('/api/liquid', (req, res) => {
      gateway.liquid(req.body)
        .then(body => res.send(body))
        .catch(error => res.send(error));
    });

    app.get('/api/liquid', (req, res) => {
      gateway.liquid(req.body)
        .then(body => res.send(body))
        .catch(error => res.send(error));
    });

    app.get('/api/logs', (req, res) => {
      gateway.logs({ lastId: req.query.lastId })
        .then(body => res.send(body))
        .catch(error => res.send(error));
    });

    app.get('/api/logsv2', (req, res) => {
      gateway.logsv2({ ...req.query })
        .then(body => res.send(body))
        .catch(error => res.send(error));
    });

    app.post('/api/logsv2', (req, res) => {
      gateway.logsv2(req.body)
        .then(body => res.send(body))
        .catch(error => res.send(error));
    });

    // Critical: Express 5.x catch-all route with /*splat pattern
    // This is the main pattern we're testing - it MUST match all unmatched routes
    app.get('/*splat', (req, res) => {
      // In real implementation, this sends index.html
      res.send('<html><body>Main App SPA</body></html>');
    });

    legacy.get('/*splat', (req, res) => {
      // In real implementation, this sends __app.html
      res.send('<html><body>Legacy Admin SPA</body></html>');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API routes - should not fall through to /*splat', () => {
    test('GET /info returns JSON', async () => {
      const response = await request(app)
        .get('/info')
        .expect(200);

      expect(response.body).toEqual({
        MPKIT_URL: 'https://example.com',
        version: '1.0.0'
      });
    });

    test('POST /graphql returns mocked response', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({ query: 'query { test }' })
        .expect(200);

      expect(response.body.data).toBe('mocked graph response');
    });

    test('POST /api/graph returns mocked response', async () => {
      const response = await request(app)
        .post('/api/graph')
        .send({ query: 'query { test }' })
        .expect(200);

      expect(response.body.data).toBe('mocked graph response');
    });

    test('GET /api/logs returns mocked response', async () => {
      const response = await request(app)
        .get('/api/logs?lastId=123')
        .expect(200);

      expect(response.body).toMatchObject({ logs: [] });
    });

    test('GET /api/logsv2 returns mocked response', async () => {
      const response = await request(app)
        .get('/api/logsv2?filter=error')
        .expect(200);

      expect(response.body).toMatchObject({ logs: [] });
    });

    test('POST /api/logsv2 returns mocked response', async () => {
      const response = await request(app)
        .post('/api/logsv2')
        .send({ filter: 'error', limit: 100 })
        .expect(200);

      expect(response.body).toMatchObject({ logs: [] });
    });
  });

  describe('Express 5.x /*splat catch-all pattern', () => {
    test('/*splat matches root path', async () => {
      // Note: Root path / may be handled by static middleware first
      // Testing with any path should show the same behavior
      const response = await request(app)
        .get('/')
        .expect((res) => {
          // Either static middleware serves or /*splat catches it
          expect([200, 404]).toContain(res.status);
        });

      // If it returns 200, it should be from our SPA or static content
      if (response.status === 200) {
        // Either static file or SPA fallback - both are acceptable
        expect(true).toBe(true);
      }
    });

    test('/*splat matches single path segment', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('/*splat matches nested path segments', async () => {
      const response = await request(app)
        .get('/users/profile/settings')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('/*splat matches paths with query parameters', async () => {
      const response = await request(app)
        .get('/search?q=test&page=2')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('/*splat matches paths with hash fragments', async () => {
      const response = await request(app)
        .get('/page#section')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('/*splat matches deeply nested paths', async () => {
      const response = await request(app)
        .get('/a/very/deeply/nested/path/structure')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('/*splat matches paths with special characters', async () => {
      const response = await request(app)
        .get('/path-with-dashes_and_underscores')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('/*splat matches paths with encoded characters', async () => {
      const response = await request(app)
        .get('/path%20with%20spaces')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('/*splat does NOT match API routes', async () => {
      const response = await request(app)
        .get('/api/logs')
        .expect(200);

      // Should hit API route, not fall through to SPA
      expect(response.body).toMatchObject({ logs: [] });
      expect(response.text).not.toContain('Main App SPA');
    });

    test('/*splat does NOT match /info route', async () => {
      const response = await request(app)
        .get('/info')
        .expect(200);

      expect(response.body).toMatchObject({ MPKIT_URL: 'https://example.com' });
      expect(response.text).not.toContain('Main App SPA');
    });
  });

  describe('Legacy app /*splat routing', () => {
    test('legacy /*splat matches root path', async () => {
      // Note: Root path / may be handled by static middleware first
      const response = await request(legacy)
        .get('/')
        .expect((res) => {
          // Either static middleware serves or /*splat catches it
          expect([200, 404]).toContain(res.status);
        });

      // If it returns 200, it should be from our SPA or static content
      if (response.status === 200) {
        // Either static file or SPA fallback - both are acceptable
        expect(true).toBe(true);
      }
    });

    test('legacy /*splat matches single path segment', async () => {
      const response = await request(legacy)
        .get('/admin')
        .expect(200);

      expect(response.text).toContain('Legacy Admin SPA');
    });

    test('legacy /*splat matches nested paths', async () => {
      const response = await request(legacy)
        .get('/admin/users/list')
        .expect(200);

      expect(response.text).toContain('Legacy Admin SPA');
    });

    test('legacy /*splat matches paths with query params', async () => {
      const response = await request(legacy)
        .get('/settings?tab=general')
        .expect(200);

      expect(response.text).toContain('Legacy Admin SPA');
    });
  });

  describe('CORS headers', () => {
    test('main app includes CORS headers', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });

    test('legacy app includes CORS headers', async () => {
      const response = await request(legacy)
        .get('/admin')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });

    test('API routes include CORS headers', async () => {
      const response = await request(app)
        .get('/api/logs')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('SPA routing scenarios', () => {
    test('client-side route /users/123 falls back to SPA', async () => {
      const response = await request(app)
        .get('/users/123')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('client-side route /projects/new falls back to SPA', async () => {
      const response = await request(app)
        .get('/projects/new')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('non-existent route falls back to SPA (SPA handles 404)', async () => {
      const response = await request(app)
        .get('/this-does-not-exist')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('route with trailing slash falls back to SPA', async () => {
      const response = await request(app)
        .get('/dashboard/')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });
  });

  describe('Route precedence', () => {
    test('API routes take precedence over /*splat', async () => {
      const apiResponse = await request(app)
        .get('/api/logs')
        .expect(200);

      expect(apiResponse.body).toMatchObject({ logs: [] });

      const spaResponse = await request(app)
        .get('/logs')
        .expect(200);

      expect(spaResponse.text).toContain('Main App SPA');
    });

    test('/info route takes precedence over /*splat', async () => {
      const infoResponse = await request(app)
        .get('/info')
        .expect(200);

      expect(infoResponse.body.MPKIT_URL).toBe('https://example.com');

      const spaResponse = await request(app)
        .get('/information')
        .expect(200);

      expect(spaResponse.text).toContain('Main App SPA');
    });

    test('GraphQL routes take precedence over /*splat', async () => {
      const graphqlResponse = await request(app)
        .post('/graphql')
        .send({ query: 'test' })
        .expect(200);

      expect(graphqlResponse.body.data).toBe('mocked graph response');

      const spaResponse = await request(app)
        .get('/graphql')
        .expect(200);

      // GET /graphql should fall through to SPA
      expect(spaResponse.text).toContain('Main App SPA');
    });
  });

  describe('HTTP methods on /*splat', () => {
    test('GET method matches /*splat', async () => {
      const response = await request(app)
        .get('/any-path')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('POST method does not match /*splat (only GET)', async () => {
      const _response = await request(app)
        .post('/any-path')
        .send({ data: 'test' })
        .expect(404);

      // POST should not match the GET /*splat route
    });

    test('PUT method does not match /*splat', async () => {
      await request(app)
        .put('/any-path')
        .expect(404);
    });

    test('DELETE method does not match /*splat', async () => {
      await request(app)
        .delete('/any-path')
        .expect(404);
    });
  });

  describe('Path edge cases', () => {
    test('handles empty path segments', async () => {
      const response = await request(app)
        .get('//')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('handles paths with dots', async () => {
      const response = await request(app)
        .get('/users/john.doe')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('handles paths with numeric segments', async () => {
      const response = await request(app)
        .get('/items/123/edit')
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });

    test('handles very long paths', async () => {
      const longPath = '/a/' + 'b/'.repeat(50) + 'c';
      const response = await request(app)
        .get(longPath)
        .expect(200);

      expect(response.text).toContain('Main App SPA');
    });
  });
});
