/**
 * What `deploy-start` hands back and what it leaves running.
 *
 * An MCP deploy answers while the release is still importing and its assets have not been uploaded
 * yet, so the answer has to carry something that can be asked about later — and the asset upload,
 * which only this process can see, has to be registered before the tool returns.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const getAssets = vi.fn();
const deployAssets = vi.fn();
const makeArchive = vi.fn(async () => 7);

vi.mock('../../lib/files.js', () => ({ default: { getAssets: (...args) => getAssets(...args), getConfig: () => ({}) } }));
vi.mock('../../lib/archive.js', () => ({ makeArchive: (...args) => makeArchive(...args) }));
vi.mock('../../lib/assets.js', () => ({ deployAssets: (...args) => deployAssets(...args) }));
vi.mock('../../lib/directories.js', () => ({ default: { available: () => ['app'], ALLOWED: ['app'] } }));

const { default: deployStart } = await import('../deploy/start.js');
const { default: jobStatus } = await import('../jobs/status.js');
const { parse } = await import('../jobs/handle.js');
const { forgetUploads } = await import('../jobs/local-phases.js');

const ORIGIN = 'https://staging.example.com';
const AUTH = { url: `${ORIGIN}/`, email: 'a@b.c', token: 'staging-token' };

let workDir;
let previousCwd;

/** A Gateway whose push succeeds and whose getStatus answers from a script. */
function gatewayWith(statuses) {
  const seen = [];
  let poll = 0;
  class Gateway {
    async push(formData) {
      // The real push consumes the archive stream; nothing here does, and a stream left unread
      // opens the file later — after this test has removed its directory.
      const archive = formData['marketplace_builder[zip_file]'];
      archive.on('error', () => {});
      archive.destroy();
      return { id: 4141, status: 'ready_for_import' };
    }
    async getStatus(id) {
      seen.push(id);
      return { status: statuses[Math.min(poll++, statuses.length - 1)] };
    }
  }
  return { Gateway, seen, polls: () => poll };
}

beforeEach(() => {
  previousCwd = process.cwd();
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-deploy-start-'));
  fs.mkdirSync(path.join(workDir, 'tmp'));
  fs.writeFileSync(path.join(workDir, 'tmp', 'release.zip'), 'zip');
  process.chdir(workDir);
  getAssets.mockResolvedValue([]);
  deployAssets.mockResolvedValue({ added: [] });
});

afterEach(() => {
  process.chdir(previousCwd);
  fs.rmSync(workDir, { recursive: true, force: true });
  forgetUploads();
  vi.clearAllMocks();
});

describe('the job_id deploy-start returns', () => {
  test('names the release on the instance it deployed to', async () => {
    const { Gateway } = gatewayWith(['ready_for_import']);

    const result = await deployStart.handler(AUTH, { Gateway });

    expect(result.ok).toBe(true);
    expect(parse(result.data.job_id)).toEqual({
      valid: true,
      job: { kind: 'deploy', id: '4141', origin: ORIGIN, flags: { assets: false } }
    });
  });

  // Without this flag a process that did not start the deploy could not tell a deploy with no
  // assets from one whose upload it simply cannot see, and would never report either as finished.
  test('records whether there were assets to upload at all', async () => {
    getAssets.mockResolvedValue(['app/assets/a.css']);
    deployAssets.mockImplementation(() => new Promise(() => {}));
    const { Gateway } = gatewayWith(['success']);

    const result = await deployStart.handler(AUTH, { Gateway });

    expect(parse(result.data.job_id).job.flags).toEqual({ assets: true });
  });
});

describe('the background asset upload', () => {
  test('is registered before the tool answers, so job-status reports the deploy as still running', async () => {
    getAssets.mockResolvedValue(['app/assets/a.css']);
    deployAssets.mockImplementation(() => new Promise(() => {}));
    const { Gateway } = gatewayWith(['success']);

    const started = await deployStart.handler(AUTH, { Gateway });
    const status = await jobStatus.handler({ job_id: started.data.job_id, ...AUTH }, { Gateway });

    expect(status.data).toMatchObject({ state: 'running', done: false, status: 'success' });
    expect(status.data.result.assets).toEqual({ phase: 'uploading' });
  });

  // The manifest is sent for a release id, and the CLI only ever sends one after the import has
  // settled. Sending one mid-import is untested against the API; a deploy is the wrong place to
  // find out.
  test('waits for the release to settle, then sends the manifest for that release', async () => {
    getAssets.mockResolvedValue(['app/assets/a.css']);
    const { Gateway, seen } = gatewayWith(['ready_for_import', 'in_progress', 'success']);

    const started = await deployStart.handler(AUTH, { Gateway });
    await vi.waitFor(() => expect(deployAssets).toHaveBeenCalled(), { timeout: 10000 });

    expect(seen).toEqual([4141, 4141, 4141]);
    expect(deployAssets.mock.calls[0][1]).toEqual({ releaseId: 4141 });

    // And once it is in, the same job_id reports the deploy as finished.
    await vi.waitFor(async () => {
      const status = await jobStatus.handler({ job_id: started.data.job_id, ...AUTH }, { Gateway });
      expect(status.data).toMatchObject({ state: 'completed', done: true });
    }, { timeout: 10000 });
  }, 30000);

  test('a release that failed uploads nothing', async () => {
    getAssets.mockResolvedValue(['app/assets/a.css']);
    const { Gateway } = gatewayWith(['error']);

    const started = await deployStart.handler(AUTH, { Gateway });
    const status = await vi.waitFor(async () => {
      const current = await jobStatus.handler({ job_id: started.data.job_id, ...AUTH }, { Gateway });
      expect(current.data.state).toBe('failed');
      return current;
    }, { timeout: 10000 });

    expect(deployAssets).not.toHaveBeenCalled();
    expect(status.data.status).toBe('error');
  }, 30000);

  test('a deploy with no assets is finished as soon as its release is in', async () => {
    const { Gateway } = gatewayWith(['success']);

    const started = await deployStart.handler(AUTH, { Gateway });
    const status = await jobStatus.handler({ job_id: started.data.job_id, ...AUTH }, { Gateway });

    expect(deployAssets).not.toHaveBeenCalled();
    expect(status.data).toMatchObject({ state: 'completed', done: true });
    expect(status.data.result.assets).toEqual({ phase: 'none' });
  });
});
