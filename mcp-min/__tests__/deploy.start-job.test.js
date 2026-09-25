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
const canPresignAssetUpload = vi.fn();
const makeArchive = vi.fn(async () => 7);

vi.mock('../../lib/files.js', () => ({ default: { getAssets: (...args) => getAssets(...args), getConfig: () => ({}) } }));
vi.mock('../../lib/archive.js', () => ({ makeArchive: (...args) => makeArchive(...args) }));
vi.mock('../../lib/assets.js', () => ({
  deployAssets: (...args) => deployAssets(...args),
  canPresignAssetUpload: (...args) => canPresignAssetUpload(...args)
}));
vi.mock('../../lib/directories.js', () => ({ default: { available: () => ['app'], ALLOWED: ['app'] } }));

const { default: deployStart } = await import('../deploy/start.js');
const { runTool } = await import('../run-tool.js');
const { default: jobStatus } = await import('../jobs/status.js');
const { parse } = await import('../jobs/handle.js');
const { forgetUploads, uploadPhase } = await import('../jobs/local-phases.js');
const { DEPLOY_WORK_ROOT } = await import('../deploy/work-dir.js');

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
  // The common instance: object storage configured, so assets go up on their own.
  canPresignAssetUpload.mockResolvedValue(true);
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

/**
 * A deploy that is not partial deletes every file missing from the build, and `partial` defaults
 * to false — so the destructive mode is reached by omitting an argument. The default matches
 * `pos-cli deploy` and stays; what was missing is any way to tell which project was sent, since
 * the directories come from the server's working directory and no argument can name them.
 */
describe('the project a deploy came from', () => {
  test('the answer names it', async () => {
    const { Gateway } = gatewayWith(['ready_for_import']);

    const result = await runTool(deployStart, AUTH, { Gateway });

    expect(result.data.appPath).toBe(fs.realpathSync(workDir));
  });

  test('omitting partial still deploys the mode that deletes, and says so', async () => {
    const { Gateway } = gatewayWith(['ready_for_import']);

    const result = await runTool(deployStart, AUTH, { Gateway });

    expect(result.data.params).toEqual({ partial: false });
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

  /**
   * Replaces TASK-33's case. Enumeration used to run after the push, so a failure could not fail
   * the call and the handle had to carry "we never found out". It now decides what goes into the
   * archive, so it happens first and there is nothing left for a handle to be unsure about.
   */
  test('an enumeration it cannot do fails the call, and deploys nothing', async () => {
    getAssets.mockRejectedValue(new Error('EACCES: app/assets'));
    const pushed = vi.fn();
    class Gateway {
      push = pushed;
      async getStatus() { return { status: 'success' }; }
    }

    const started = await runTool(deployStart, AUTH, { Gateway });

    expect(started.ok).toBe(false);
    expect(started.error.message).toMatch(/EACCES/);
    expect(pushed).not.toHaveBeenCalled();
  });
});

describe('the background asset upload', () => {
  test('is registered before the tool answers, so job-status reports the deploy as still running', async () => {
    getAssets.mockResolvedValue(['app/assets/a.css']);
    deployAssets.mockImplementation(() => new Promise(() => {}));
    const { Gateway } = gatewayWith(['success']);

    const started = await runTool(deployStart, AUTH, { Gateway });
    const status = await runTool(jobStatus, { job_id: started.data.job_id, ...AUTH }, { Gateway });

    expect(status.data).toMatchObject({ state: 'running', done: false, instanceStatus: 'success' });
    expect(status.data.result.assets).toEqual({ phase: 'uploading' });
    // The exact pair an evaluation misread. Published as `status` beside `state` the two look like
    // one answer spelled twice, and it took the release's `success` for the deploy's, calling a
    // deploy finished while its assets were still going up. The old name is gone rather than kept
    // alongside: two names for one value is the confusion, not the cure.
    expect(status.data, 'the instance word must not be published as `status`').not.toHaveProperty('status');
  });

  // `deploy-start` answers the same value at the moment it hands back a job_id, so it has to use
  // the same name: a caller that learned one field from the starter reads the other from the poll.
  test('the starter names the release status the same way job-status does', async () => {
    getAssets.mockResolvedValue([]);
    const { Gateway } = gatewayWith(['success']);

    const result = await runTool(deployStart, AUTH, { Gateway });

    expect(result.data.instanceStatus).toBe('ready_for_import');
    expect(result.data).not.toHaveProperty('status');
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
    expect(deployAssets.mock.calls[0][1]).toMatchObject({ releaseId: 4141 });

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
    expect(status.data).toMatchObject({ state: 'failed', instanceStatus: 'error' });
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

/**
 * An instance with no object storage answers 501 to a presign. `pos-cli deploy` has always asked
 * first and sent the assets inside the release; `deploy-start` did not, so on exactly the
 * instances that need the fallback it uploaded into a presign that could never succeed.
 */
describe('an instance that cannot presign a direct upload', () => {
  beforeEach(() => {
    getAssets.mockResolvedValue(['app/assets/a.css', 'app/assets/b.js']);
    canPresignAssetUpload.mockResolvedValue(false);
  });

  test('puts the assets inside the release archive instead', async () => {
    const { Gateway } = gatewayWith(['success']);

    await runTool(deployStart, AUTH, { Gateway });

    expect(makeArchive.mock.calls[0][1]).toEqual({ withoutAssets: false });
    expect(deployAssets).not.toHaveBeenCalled();
  });

  test('says so, and names the cause', async () => {
    const { Gateway } = gatewayWith(['success']);

    const result = await runTool(deployStart, AUTH, { Gateway });

    expect(result.data.assets).toMatchObject({ count: 2, status: 'in_release_archive' });
    expect(result.data.assets.reason).toMatch(/cannot presign/);
    expect(result.data.archive.assetsIncluded).toBe(true);
  });

  // There is no second phase to wait for: when the release is in, the assets are in with it.
  test('is finished as soon as its release is in', async () => {
    const { Gateway } = gatewayWith(['success']);

    const started = await runTool(deployStart, AUTH, { Gateway });
    const status = await runTool(jobStatus, { job_id: started.data.job_id, ...AUTH }, { Gateway });

    expect(parse(started.data.job_id).job.flags).toEqual({ assets: false });
    expect(status.data).toMatchObject({ state: 'completed', done: true });
  });

  // Two requests to answer a question with only one answer.
  test('is not asked at all when there is nothing to upload', async () => {
    getAssets.mockResolvedValue([]);
    const { Gateway } = gatewayWith(['success']);

    await runTool(deployStart, AUTH, { Gateway });

    expect(canPresignAssetUpload).not.toHaveBeenCalled();
  });

  // Asked before the archive is built, so a failure to answer costs nothing.
  test('an unreadable answer fails the call before anything is deployed', async () => {
    canPresignAssetUpload.mockRejectedValue(Object.assign(new Error('Request failed with status 403'), { statusCode: 403 }));
    const pushed = vi.fn();
    class Gateway {
      push = pushed;
      async getStatus() { return { status: 'success' }; }
    }

    const result = await runTool(deployStart, AUTH, { Gateway });

    expect(result.ok).toBe(false);
    expect(pushed).not.toHaveBeenCalled();
    expect(makeArchive).not.toHaveBeenCalled();
  });
});

/**
 * The fixed `tmp/release.zip` and `tmp/assets.zip` are held for as long as an import takes, so a
 * second deploy in that window repacked them underneath the first.
 */
describe('two deploys started close together', () => {
  const archiveTargets = () => makeArchive.mock.calls.map(([env]) => env.TARGET);

  test('do not write the same release archive', async () => {
    const { Gateway } = gatewayWith(['success']);

    await Promise.all([runTool(deployStart, AUTH, { Gateway }), runTool(deployStart, AUTH, { Gateway })]);

    const [first, second] = archiveTargets();
    expect(first).not.toBe(second);
  });

  test('do not pack assets over each other', async () => {
    getAssets.mockResolvedValue(['app/assets/a.css']);
    deployAssets.mockImplementation(() => new Promise(() => {}));
    const { Gateway } = gatewayWith(['success']);

    await Promise.all([runTool(deployStart, AUTH, { Gateway }), runTool(deployStart, AUTH, { Gateway })]);
    await vi.waitFor(() => expect(deployAssets).toHaveBeenCalledTimes(2), { timeout: 10000 });

    const [{ workDir: a }, { workDir: b }] = deployAssets.mock.calls.map(([, options]) => options);
    expect(a).toBeDefined();
    expect(a).not.toBe(b);
  }, 30000);

  // Whatever fails before the push has answered has to take the directory away with it.
  test.each([
    ['the archive cannot be built', () => makeArchive.mockRejectedValue(new Error('ENOSPC'))],
    ['the archive is empty', () => makeArchive.mockResolvedValue(0)],
    ['the instance refuses the push', () => { /* the Gateway below does it */ }]
  ])('leave nothing behind when %s', async (_label, arrange) => {
    arrange();
    class Gateway {
      async push() { throw Object.assign(new Error('Request failed with status 422'), { statusCode: 422 }); }
      async getStatus() { return { status: 'success' }; }
    }

    const result = await runTool(deployStart, AUTH, { Gateway });

    expect(result.ok).toBe(false);
    const root = path.join(workDir, DEPLOY_WORK_ROOT);
    expect(fs.existsSync(root) ? fs.readdirSync(root) : []).toEqual([]);
  });

  // A server that ran for a week would otherwise keep every release zip it ever built.
  test('leave nothing behind once they are done', async () => {
    const { Gateway } = gatewayWith(['success']);

    await runTool(deployStart, AUTH, { Gateway });

    const root = path.join(workDir, DEPLOY_WORK_ROOT);
    expect(fs.existsSync(root) ? fs.readdirSync(root) : []).toEqual([]);
  });
});

/**
 * `runWithAuth` set MARKETPLACE_* process-wide for the length of an import plus an upload, so a
 * second tool in that window could change or clear what the upload was still reading.
 */
describe('a background upload does not export its credentials', () => {
  test('nothing sets MARKETPLACE_* for the length of the upload', async () => {
    getAssets.mockResolvedValue(['app/assets/a.css']);
    let seen;
    deployAssets.mockImplementation(async () => {
      seen = {
        url: process.env.MARKETPLACE_URL,
        token: process.env.MARKETPLACE_TOKEN,
        email: process.env.MARKETPLACE_EMAIL
      };
      return { added: [] };
    });
    const { Gateway } = gatewayWith(['success']);

    await runTool(deployStart, AUTH, { Gateway });
    await vi.waitFor(() => expect(seen).toBeDefined(), { timeout: 10000 });

    expect(seen).toEqual({ url: undefined, token: undefined, email: undefined });
  }, 30000);
});
