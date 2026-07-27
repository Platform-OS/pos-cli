/**
 * downloadFile is what fetches module archives and data exports. It used to pipe any
 * response body straight to disk, so an expired presigned URL (403 + XML body) was
 * saved as a .zip and only surfaced later as a corrupt-archive error.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import http from 'http';
import downloadFile from '#lib/downloadFile.js';
import { withTmpDir } from '#test/utils/withTmpDir.js';

let server;
let baseUrl;
let handler;

const startServer = () =>
  new Promise(resolve => {
    server = http.createServer((req, res) => handler(req, res));
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

describe('downloadFile', () => {
  withTmpDir('pos-cli-downloadfile-');

  beforeEach(async () => {
    await startServer();
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  const dest = () => path.join(process.cwd(), 'out.bin');

  test('writes the response body to the destination file', async () => {
    handler = (req, res) => res.end('archive contents');

    await downloadFile(`${baseUrl}/file.zip`, dest());

    expect(fs.readFileSync(dest(), 'utf8')).toBe('archive contents');
  });

  test('rejects on a 403 instead of saving the error body as the file', async () => {
    handler = (req, res) => {
      res.writeHead(403, { 'Content-Type': 'application/xml' });
      res.end('<Error><Code>AccessDenied</Code></Error>');
    };

    await expect(downloadFile(`${baseUrl}/file.zip`, dest())).rejects.toThrow(/HTTP 403/);
    expect(fs.existsSync(dest())).toBe(false);
  });

  test('surfaces the status code so callers can special-case 404', async () => {
    handler = (req, res) => {
      res.writeHead(404);
      res.end('nope');
    };

    await expect(downloadFile(`${baseUrl}/file.zip`, dest())).rejects.toMatchObject({ statusCode: 404 });
  });

  test('does not put the signed query string in the error message', async () => {
    handler = (req, res) => {
      res.writeHead(403);
      res.end('denied');
    };

    await expect(
      downloadFile(`${baseUrl}/file.zip?X-Amz-Signature=deadbeef`, dest())
    ).rejects.toThrow(/^(?!.*X-Amz-Signature).*HTTP 403/s);
  });

  test('follows redirects', async () => {
    handler = (req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(302, { Location: '/actual.zip' });
        return res.end();
      }
      res.end('redirected contents');
    };

    await downloadFile(`${baseUrl}/redirect`, dest());

    expect(fs.readFileSync(dest(), 'utf8')).toBe('redirected contents');
  });

  test('rejects on a redirect loop rather than hanging', async () => {
    handler = (req, res) => {
      res.writeHead(302, { Location: '/loop' });
      res.end();
    };

    await expect(downloadFile(`${baseUrl}/loop`, dest())).rejects.toThrow(/Download failed/);
  });

  test('does not put the signed query string in a transport-level error message', async () => {
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    server = http.createServer(() => {}); // keeps afterEach happy
    server.listen(0, '127.0.0.1');

    await expect(
      downloadFile(`http://127.0.0.1:${port}/file.zip?X-Amz-Signature=deadbeef`, dest())
    ).rejects.toThrow(/^(?!.*X-Amz-Signature).*Download failed/s);
  });

  test('rejects when the connection fails', async () => {
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    server = http.createServer(() => {}); // keeps afterEach happy
    server.listen(0, '127.0.0.1');

    await expect(downloadFile(`http://127.0.0.1:${port}/file.zip`, dest())).rejects.toThrow();
  });
});
