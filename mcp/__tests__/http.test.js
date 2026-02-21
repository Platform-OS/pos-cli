let request;
try {
  request = require('supertest');
} catch (e) {
  request = null;
}
const { createServer } = require('../server');

let app;
beforeAll(async () => {
  if (!request) {
    request = (await import('supertest')).default;
  }
  app = createServer({ storagePath: require.resolve('../../test/fixtures/template-values.json') });
  // Supertest treats non-JSON responses as text; ensure JSON parse only for JSON endpoints.

}, 15000);

describe('/health and /tools', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('serverInfo');
  });

  test('GET /tools returns a list', async () => {
    const res = await request(app).get('/tools').expect(200);
    expect(res.body).toHaveProperty('tools');
    expect(Array.isArray(res.body.tools)).toBe(true);
  });
});

describe('/call', () => {
  test('POST /call unauthorized without key', async () => {
    await request(app).post('/call').send({ tool: 'echo', args: 'x' }).expect(401);
  });

  test('POST /call with key returns echo result', async () => {
    const res = await request(app)
      .post('/call')
      .set('X-Api-Key', 'testkey')
      .send({ tool: 'echo', args: 'hello' })
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.result).toHaveProperty('echoed');
    expect(res.body.result.echoed).toBe('hello');
  });

  test('POST /call with tool error returns 500', async () => {
    const res = await request(app)
      .post('/call')
      .set('X-Api-Key', 'testkey')
      .send({ tool: 'error' })
      .expect(500);
    expect(res.body.ok).toBe(false);
    expect(res.body).toHaveProperty('error');
  });
});

describe('/call-stream', () => {
  test('POST /call-stream streams chunks', async () => {
    const res = await request(app)
      .post('/call-stream')
      .set('X-Api-Key', 'testkey')
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => cb(null, data));
      })
      .send({ tool: 'echo', args: 'stream' })
      .expect(200);

    const chunks = String(res.body).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]).toHaveProperty('seq');
  });
});
