/**
 * A file body is streamed, so undici's headersTimeout (refreshed per chunk the socket accepts)
 * ends only a stalled transfer. A Buffer body is a single chunk and is cut off however fast it
 * moves. Real sockets: Node's own undici Agent, reached through the global dispatcher's
 * constructor, with the timeout shortened to 1s against a server that takes ~3s to read the body.
 */
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { apiRequest } from '#lib/apiRequest.js';
import { uploadFile, uploadFileFormData } from '#lib/s3UploadFile.js';
import { getNetworkErrorCode } from '#lib/ServerError.js';

const HEADERS_TIMEOUT_MS = 1000;
const BODY_BYTES = 16 * 1024 * 1024; // more than loopback socket buffers can swallow
const READ = { chunkBytes: 512 * 1024, everyMs: 96 }; // ~5MB/s

const realFetch = globalThis.fetch;
const NodeAgent = globalThis[Symbol.for('undici.globalDispatcher.1')]?.constructor;

const slowReadingServer = () => http.createServer((req, res) => {
  req.pause();
  const pump = setInterval(() => req.read(READ.chunkBytes), READ.everyMs);
  const stop = () => clearInterval(pump);

  req.on('end', () => {
    stop();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
  });
  req.on('aborted', stop);
  res.on('close', stop);
});

describe('a streamed upload and the request timeout', () => {
  let server, origin, dir, file, agent;

  beforeAll(async () => {
    expect(NodeAgent, "Node's global undici dispatcher is not where it has been since undici 5").toBeTypeOf('function');
    agent = new NodeAgent({ headersTimeout: HEADERS_TIMEOUT_MS });
    vi.stubGlobal('fetch', (uri, options) => realFetch(uri, { ...options, dispatcher: agent }));

    server = slowReadingServer();
    origin = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
    });

    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-upload-'));
    file = path.join(dir, 'release.zip');
    fs.writeFileSync(file, Buffer.alloc(BODY_BYTES, 0x61));
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await agent.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // The control: proves the shortened timeout is in force.
  test('a Buffer body is cut off while still being sent', async () => {
    const error = await apiRequest({
      method: 'PUT',
      uri: `${origin}/u`,
      body: Buffer.alloc(BODY_BYTES, 0x61),
      json: false
    }).catch((e) => e);

    expect(getNetworkErrorCode(error)).toBe('UND_ERR_HEADERS_TIMEOUT');
  }, 30000);

  test('a presigned PUT of the same bytes from a file finishes', async () => {
    await expect(uploadFile(file, `${origin}/u`)).resolves.toBe(`${origin}/u`);
  }, 30000);

  test('a presigned POST with the file as a multipart part finishes', async () => {
    await expect(uploadFileFormData(file, { url: `${origin}/u`, fields: { key: 'release.zip' } })).resolves.toBe(true);
  }, 30000);
});
