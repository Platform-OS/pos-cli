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
const { runTool } = await import('../run-tool.js');
const { default: jobStatus } = await import('../jobs/status.js');
const { parse } = await import('../jobs/handle.js');
const { forgetUploads, uploadPhase } = await import('../jobs/local-phases.js');

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
  // Reset every stub's behaviour, not just its call record: vi.clearAllMocks() keeps
  // implementations, so a case that makes the archive empty would make every later one empty too.
  makeArchive.mockResolvedValue(7);
  getAssets.mockResolvedValue([]);
  deployAssets.mockResolvedValue({ added: [] });
});

afterEach(() => {
  process.chdir(previousCwd);
  fs.rmSync(workDir, { recursive: true, force: true });
  forgetUploads();
  vi.clearAllMocks();
});

describe('an empty archive', () => {
  // A release that is not partial is the whole intended state of the instance: uploading an empty
  // archive asks it to delete every file it has, so the check must precede the upload.
  test.each([
    ['nothing to archive', 0],
    ['an archive that was not built', false]
  ])('is refused before it is uploaded (%s)', async (_label, archived) => {
    makeArchive.mockResolvedValue(archived);
    const pushed = vi.fn();
    class Gateway {
      push = pushed;
      async getStatus() { return { status: 'success' }; }
    }

    const result = await runTool(deployStart, AUTH, { Gateway });

    expect(result).toMatchObject({ ok: false, error: { kind: 'project', code: 'EMPTY_ARCHIVE' } });
    expect(pushed).not.toHaveBeenCalled();
  });
});

describe('the job_id deploy-start returns', () => {
  test('names the release on the instance it deployed to', async () => {
    const { Gateway } = gatewayWith(['ready_for_import']);

    const result = await runTool(deployStart, AUTH, { Gateway });

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

    const result = await runTool(deployStart, AUTH, { Gateway });

    expect(parse(result.data.job_id).job.flags).toEqual({ assets: true });
  });

  // The release is already in, so an enumeration that throws is carried in the answer rather than
  // failing the call — but it must not be recorded as "there were none". `assets: false` is a
  // claim, and job-status reads it as an asset phase that finished.
  test('claims nothing about assets it could not enumerate', async () => {
    getAssets.mockRejectedValue(new Error('EACCES: app/assets'));
    const { Gateway } = gatewayWith(['success']);

    const started = await runTool(deployStart, AUTH, { Gateway });
    const status = await runTool(jobStatus, { job_id: started.data.job_id, ...AUTH }, { Gateway });

    expect(started.ok).toBe(true);
    expect(started.data.assets.error).toMatch(/EACCES/);
    expect(parse(started.data.job_id).job.flags).toEqual({});
    expect(status.data.result.assets).toEqual({ phase: 'unknown' });
  });
});

describe('the background asset upload', () => {
  test('is registered before the tool answers, so job-status reports the deploy as still running', async () => {
    getAssets.mockResolvedValue(['app/assets/a.css']);
    deployAssets.mockImplementation(() => new Promise(() => {}));
    const { Gateway } = gatewayWith(['success']);

    const started = await runTool(deployStart, AUTH, { Gateway });
    const status = await runTool(jobStatus, { job_id: started.data.job_id, ...AUTH }, { Gateway });

    expect(status.data).toMatchObject({ state: 'running', done: false, status: 'success' });
    expect(status.data.result.assets).toEqual({ phase: 'uploading' });
  });

  // The manifest is sent for a release id, and the CLI only ever sends one after the import has
  // settled. Sending one mid-import is untested against the API; a deploy is the wrong place to
  // find out.
  test('waits for the release to settle, then sends the manifest for that release', async () => {
    getAssets.mockResolvedValue(['app/assets/a.css']);
    const { Gateway, seen } = gatewayWith(['ready_for_import', 'in_progress', 'success']);

    const started = await runTool(deployStart, AUTH, { Gateway });
    await vi.waitFor(() => expect(deployAssets).toHaveBeenCalled(), { timeout: 10000 });

    expect(seen).toEqual([4141, 4141, 4141]);
    expect(deployAssets.mock.calls[0][1]).toEqual({ releaseId: 4141 });

    // And once it is in, the same job_id reports the deploy as finished.
    await vi.waitFor(async () => {
      const status = await runTool(jobStatus, { job_id: started.data.job_id, ...AUTH }, { Gateway });
      expect(status.data).toMatchObject({ state: 'completed', done: true });
    }, { timeout: 10000 });
  }, 30000);

  test('a release that failed uploads nothing', async () => {
    getAssets.mockResolvedValue(['app/assets/a.css']);
    const { Gateway } = gatewayWith(['error']);

    const started = await runTool(deployStart, AUTH, { Gateway });

    // Wait for the background task itself to finish, not for a status that answers from the
    // release alone — otherwise "nothing was uploaded" would hold before it had even tried.
    await vi.waitFor(() => expect(uploadPhase(ORIGIN, 4141).phase).toBe('failed'), { timeout: 10000 });
    const status = await runTool(jobStatus, { job_id: started.data.job_id, ...AUTH }, { Gateway });

    expect(deployAssets).not.toHaveBeenCalled();
    expect(status.data).toMatchObject({ state: 'failed', status: 'error' });
  }, 30000);

  test('a deploy with no assets is finished as soon as its release is in', async () => {
    const { Gateway } = gatewayWith(['success']);

    const started = await runTool(deployStart, AUTH, { Gateway });
    const status = await runTool(jobStatus, { job_id: started.data.job_id, ...AUTH }, { Gateway });

    expect(deployAssets).not.toHaveBeenCalled();
    expect(status.data).toMatchObject({ state: 'completed', done: true });
    expect(status.data.result.assets).toEqual({ phase: 'none' });
  });
});
