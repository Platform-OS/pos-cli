/**
 * `pos-cli modules remove`, driven as a real process against a local instance stand-in.
 *
 * An instance refuses to remove a module whose tables still hold records, answering 422 with
 * the reason and the mutation that deletes them. The command used to print only
 * "Failed to remove the module StatusCodeError: Request failed with status 422", so the one
 * thing the operator needed to read never reached them.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const bin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'pos-cli-modules-remove.js');

const REFUSAL = 'table named modules/chat/conversation is missing in this deploy.\n' +
  'If you want to remove data completely, run `pos-cli gui serve [environment]` and this mutation:\n\n' +
  '  mutation { records_delete_all(table: "modules/chat/conversation") { count } }';

let server;
let origin;
let asked;
/** [status, body] the stand-in answers the DELETE with. */
let answer;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      asked.push({ method: req.method, url: req.url, body });
      const [status, json] = answer;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(json));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise(resolve => server.close(resolve)));

const run = args => new Promise(resolve => {
  const child = spawn(process.execPath, [bin, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MPKIT_URL: origin, MPKIT_EMAIL: 'e@x', MPKIT_TOKEN: 'tok' }
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });
  child.on('exit', code => resolve({ code, stdout, stderr }));
});

describe('pos-cli modules remove', () => {
  test('prints the reason the instance gives for refusing', async () => {
    asked = [];
    answer = [422, { error: REFUSAL }];

    const { code, stdout, stderr } = await run(['local', 'chat']);

    expect(code).toBe(1);
    expect(`${stdout}${stderr}`).toContain(REFUSAL);
    expect(`${stdout}${stderr}`).not.toContain('StatusCodeError');
    expect(asked.map(r => [r.method, r.url])).toEqual([['DELETE', '/api/app_builder/installed_modules']]);
    expect(asked[0].body).toContain('name="pos_module_name"\r\n\r\nchat');
  });

  test('reports success when the instance removes the module', async () => {
    asked = [];
    answer = [200, {}];

    const { code, stdout, stderr } = await run(['local', 'chat']);

    expect(code).toBe(0);
    expect(`${stdout}${stderr}`).toContain('[Module Remove] Successfully removed module chat');
  });
});
