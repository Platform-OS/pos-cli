/**
 * `pos-cli modules push` stopping dead after "Release Uploaded".
 *
 * The upload is not where it ends: the Partner Portal then unpacks the release in a
 * background job and the CLI polls for the verdict. That job has two endings --
 * `accepted` and `rejected` (PosModuleVersion's enum) -- and a third outcome nobody
 * writes down, which is the job never running at all and the version sitting on
 * `pending`.
 *
 * pos-cli recognised exactly one of those. Everything else meant "still working", so a
 * release the portal had already refused was polled every five seconds, in silence,
 * for as long as the operator was willing to watch it -- with the reason sitting in an
 * email the CLI never mentioned.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const { portal } = vi.hoisted(() => ({
  portal: {
    url: vi.fn(() => 'https://partners.platformos.com'),
    jwtToken: vi.fn(),
    findModules: vi.fn(),
    createVersion: vi.fn(),
    moduleVersionStatus: vi.fn()
  }
}));

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn(), Success: vi.fn(), Log: vi.fn() }
}));
vi.mock('#lib/portal.js', () => ({ default: portal, partnerPortalEnv: () => ({}) }));
vi.mock('fast-glob', () => ({ default: vi.fn(async () => ['public/views/pages/index.liquid']) }));
vi.mock('#lib/prepareArchive.js', () => ({
  default: vi.fn(() => ({ addFile: vi.fn(), addBuffer: vi.fn(), finalize: vi.fn(), done: Promise.resolve(2) }))
}));
vi.mock('#lib/presignUrl.js', () => ({
  presignUrlForPortal: vi.fn(async () => ({
    uploadUrl: 'https://s3.example.com/upload',
    accessUrl: 'https://s3.example.com/release.zip'
  }))
}));
vi.mock('#lib/s3UploadFile.js', () => ({ uploadFile: vi.fn(async () => 'https://s3.example.com/upload') }));

const MODULE_VERSION_ID = 1540;
const MINUTE = 60 * 1000;

describe('pos-cli modules push — waiting for the portal verdict', () => {
  let tmpDir;
  let originalCwd;
  let logger;
  let publishVersion;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-modules-push-'));
    process.chdir(tmpDir);
    fs.writeFileSync('pos-module.json', JSON.stringify({ machine_name: 'community', version: '1.6.8' }));
    fs.mkdirSync(path.join('modules', 'community'), { recursive: true });

    // Skips the interactive password prompt; the 2FA prompt is never reached because the
    // mocked portal answers the token request.
    process.env.POS_PORTAL_PASSWORD = 'hunter2';
    portal.jwtToken.mockResolvedValue({ auth_token: 'jwt-token' });
    portal.findModules.mockResolvedValue([{ id: 42, name: 'community' }]);
    portal.createVersion.mockResolvedValue({ id: MODULE_VERSION_ID });

    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });

    ({ publishVersion } = await import('#lib/modules.js'));
    logger = (await import('#lib/logger.js')).default;
  });

  afterEach(() => {
    vi.useRealTimers();
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.POS_PORTAL_PASSWORD;
    vi.restoreAllMocks();
  });

  // Returns a flag that flips as soon as the command is over, however it ended: the bug
  // is not a wrong message, it is no message and no exit.
  const pushAndWait = async (waitMs) => {
    vi.useFakeTimers();
    let finished = false;
    // publishVersion reports through logger.Error and exits, so a rejection here is the
    // command ending, not the test failing.
    publishVersion({ email: 'lukasz@platformos.com' }).then(() => { finished = true; }, () => { finished = true; });

    await vi.advanceTimersByTimeAsync(waitMs);
    return finished;
  };

  test('stops when the portal rejects the release instead of polling it forever', async () => {
    portal.moduleVersionStatus.mockResolvedValue({
      id: MODULE_VERSION_ID,
      status: 'rejected',
      error_message: 'Archive structurte is wrong. At the root level of the archive there should be a folder with the name matching module scope_name.'
    });

    const finished = await pushAndWait(20 * MINUTE);

    expect(finished).toBe(true);
    // The verdict was in the very first answer: there is nothing to wait for.
    expect(portal.moduleVersionStatus).toHaveBeenCalledTimes(1);
    expect(logger.Error).toHaveBeenCalledWith(expect.stringContaining('rejected'));
    expect(logger.Success).not.toHaveBeenCalled();
  });

  test('passes on the reason the portal rejected it, rather than only pointing at email', async () => {
    portal.moduleVersionStatus.mockResolvedValue({
      id: MODULE_VERSION_ID,
      status: 'rejected',
      error_message: 'Module has validation errors ["Scope name is invalid"]'
    });

    await pushAndWait(MINUTE);

    expect(logger.Error).toHaveBeenCalledWith(expect.stringContaining('Scope name is invalid'));
  });

  test('gives up on a version that never leaves pending', async () => {
    // What a lost background job looks like from here: a status that answers, and never
    // changes. Without a deadline this is indistinguishable from a hang.
    portal.moduleVersionStatus.mockResolvedValue({ id: MODULE_VERSION_ID, status: 'pending' });

    const finished = await pushAndWait(30 * MINUTE);

    expect(finished).toBe(true);
    expect(logger.Error).toHaveBeenCalledWith(expect.stringMatching(/still .*pending|timed out|did not finish/i));
    expect(logger.Success).not.toHaveBeenCalled();
  });

  // A failed check is not a verdict. The release is uploaded and the portal-side job is
  // very likely running; a 504 from a proxy says nothing about it, and failing the push on
  // one reports a release that was published as one that was not.
  const gatewayTimeout = () => Object.assign(new Error('Request failed with status 504'), {
    name: 'StatusCodeError',
    statusCode: 504,
    options: { uri: 'https://partners.platformos.com/api/pos_modules/42/pos_module_versions/1540' },
    response: { statusCode: 504, body: '<html>504 Gateway Time-out</html>' }
  });

  test('rides out a gateway error while the portal is processing the release', async () => {
    portal.moduleVersionStatus
      .mockRejectedValueOnce(gatewayTimeout())
      .mockRejectedValueOnce(gatewayTimeout())
      .mockResolvedValue({ id: MODULE_VERSION_ID, status: 'accepted' });

    const finished = await pushAndWait(MINUTE);

    expect(finished).toBe(true);
    expect(logger.Success).toHaveBeenCalledWith('Module uploaded.');
    expect(logger.Error).not.toHaveBeenCalled();
    // Said, though: an operator watching a push pause for a minute deserves the reason.
    expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining('HTTP 504'));
  });

  test('gives up naming the gateway error when it never clears', async () => {
    portal.moduleVersionStatus.mockRejectedValue(gatewayTimeout());

    const finished = await pushAndWait(30 * MINUTE);

    expect(finished).toBe(true);
    expect(logger.Error).toHaveBeenCalledWith(expect.stringContaining('504'));
    expect(logger.Success).not.toHaveBeenCalled();
  });

  test('stops at once when the portal refuses the check', async () => {
    // 401 is the portal deciding, which is an answer -- asking again cannot change it.
    portal.moduleVersionStatus.mockRejectedValue(Object.assign(new Error('Request failed with status 401'), {
      name: 'StatusCodeError',
      statusCode: 401,
      options: { uri: 'https://partners.platformos.com/api/pos_modules/42/pos_module_versions/1540' },
      response: { statusCode: 401, body: {} }
    }));

    const finished = await pushAndWait(20 * MINUTE);

    expect(finished).toBe(true);
    expect(portal.moduleVersionStatus).toHaveBeenCalledTimes(1);
    expect(logger.Success).not.toHaveBeenCalled();
  });

  test('gives each status check a deadline of its own, shorter than the poll interval', async () => {
    portal.moduleVersionStatus.mockResolvedValue({ id: MODULE_VERSION_ID, status: 'accepted' });

    await pushAndWait(MINUTE);

    // Otherwise a stalled check inherits undici's five minutes and the loop stops looping.
    const [, , , options] = portal.moduleVersionStatus.mock.calls[0];
    expect(options.timeout).toBeGreaterThan(0);
    expect(options.timeout).toBeLessThan(5000);
  });

  test('still waits through pending polls and reports a release the portal accepts', async () => {
    portal.moduleVersionStatus
      .mockResolvedValueOnce({ id: MODULE_VERSION_ID, status: 'pending' })
      .mockResolvedValueOnce({ id: MODULE_VERSION_ID, status: 'pending' })
      .mockResolvedValue({ id: MODULE_VERSION_ID, status: 'accepted' });

    const finished = await pushAndWait(MINUTE);

    expect(finished).toBe(true);
    expect(portal.moduleVersionStatus).toHaveBeenCalledTimes(3);
    expect(logger.Success).toHaveBeenCalledWith('Module uploaded.');
    expect(logger.Error).not.toHaveBeenCalled();
  });
});
