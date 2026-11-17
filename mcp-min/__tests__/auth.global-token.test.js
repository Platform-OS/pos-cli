/**
 * A global token reaches many instances, and an instance runs tenant-authored code, so the MCP
 * server never sends one to an instance: every credential a tool resolves is traded for a token
 * bound to that instance first, as the CLI does in fetchSettings (lib/globalBinding.js).
 *
 * These go through the real resolution — a `.pos` and a portals file on disk, MPKIT_*, explicit
 * params — with only the Partner Portal faked, and assert on what a tool is handed.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/portal.js', async (importOriginal) => {
  const original = await importOriginal();
  return { default: { ...original.default, bindGlobalToken: vi.fn() } };
});

vi.mock('../../lib/twoFactorSession.js', async (importOriginal) => ({
  ...(await importOriginal()),
  ensureSession: vi.fn(async () => null)
}));

import Portal from '../../lib/portal.js';
import { storePortal } from '../../lib/portals.js';
import { resolveAuth } from '../auth.js';
import { authForJob } from '../jobs/auth-for-job.js';
import { runTool } from '../run-tool.js';
import uploadsPushTool from '../uploads/push.js';

const GLOBAL = 'posg_global-root';
const PORTAL_URL = 'https://portal.example.com';

describe('a global token is bound before any tool uses it', () => {
  let dir;

  const writeDotPos = (config) => fs.writeFileSync(process.env.CONFIG_FILE_PATH, JSON.stringify(config, null, 2));

  beforeEach(() => {
    vi.clearAllMocks();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-mcp-global-'));
    vi.stubEnv('CONFIG_FILE_PATH', path.join(dir, '.pos'));
    vi.stubEnv('POS_PORTALS_FILE', path.join(dir, 'portals.json'));
    vi.stubEnv('PARTNER_PORTAL_HOST', PORTAL_URL);
    vi.stubEnv('MPKIT_URL', undefined);
    vi.stubEnv('MPKIT_EMAIL', undefined);
    vi.stubEnv('MPKIT_TOKEN', undefined);
    writeDotPos({});
    Portal.bindGlobalToken.mockImplementation(async ({ instanceHost }) => ({ access_token: `posg_bound-to-${instanceHost}`, expires_in: 3600 }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('from a named .pos environment', async () => {
    writeDotPos({ staging: { url: 'https://staging.example.com', email: 'a@b.c', token: GLOBAL } });
    const ctx = {};

    const auth = await resolveAuth({ env: 'staging' }, ctx);

    expect(Portal.bindGlobalToken).toHaveBeenCalledWith(expect.objectContaining({ token: GLOBAL, instanceHost: 'staging.example.com' }));
    expect(auth).toMatchObject({ token: 'posg_bound-to-staging.example.com', source: '.pos(staging)' });
    // meta.auth is built from this: it must describe the credential that was sent.
    expect(ctx.resolvedAuth.token).toBe('posg_bound-to-staging.example.com');
  });

  test('from explicit params', async () => {
    const auth = await resolveAuth({ url: 'https://other.example.com', email: 'a@b.c', token: GLOBAL });

    expect(auth.token).toBe('posg_bound-to-other.example.com');
  });

  test('from MPKIT_*', async () => {
    vi.stubEnv('MPKIT_URL', 'https://ci.example.com');
    vi.stubEnv('MPKIT_EMAIL', 'a@b.c');
    vi.stubEnv('MPKIT_TOKEN', GLOBAL);

    const auth = await resolveAuth({});

    expect(auth).toMatchObject({ token: 'posg_bound-to-ci.example.com', source: 'env' });
  });

  test('from an environment that uses a portal\'s token, named or the only one', async () => {
    storePortal('shared', { url: PORTAL_URL, token: GLOBAL, email: 'me@example.com' });
    writeDotPos({ staging: { url: 'https://staging.example.com', portal: 'shared' } });

    expect((await resolveAuth({ env: 'staging' })).token).toBe('posg_bound-to-staging.example.com');
    // Step 4: an environment with no token of its own used to be skipped, answering AUTH_MISSING.
    expect(await resolveAuth({})).toMatchObject({ token: 'posg_bound-to-staging.example.com', source: '.pos(staging)' });
    expect(Portal.bindGlobalToken).toHaveBeenCalledWith(expect.objectContaining({ portalUrl: PORTAL_URL, token: GLOBAL }));
  });

  test('a token for one instance is used as it is, asking the Portal nothing', async () => {
    writeDotPos({ staging: { url: 'https://staging.example.com', email: 'a@b.c', token: 'per-instance' } });

    expect((await resolveAuth({ env: 'staging' })).token).toBe('per-instance');
    expect(Portal.bindGlobalToken).not.toHaveBeenCalled();
  });

  // page-fetch sends no credential, so there is nothing to bind.
  test('an anonymous tool binds nothing', async () => {
    writeDotPos({ staging: { url: 'https://staging.example.com', email: 'a@b.c', token: GLOBAL } });

    await resolveAuth({ env: 'staging' }, {}, { anonymous: true });

    expect(Portal.bindGlobalToken).not.toHaveBeenCalled();
  });

  // The observable outcome: what a tool's Gateway is built with.
  test('a tool is handed the bound token, never the global one', async () => {
    writeDotPos({ staging: { url: 'https://staging.example.com', email: 'a@b.c', token: GLOBAL } });
    const zip = path.join(dir, 'uploads.zip');
    fs.writeFileSync(zip, 'zip');
    const built = [];
    class Gateway {
      constructor(auth) { built.push(auth); }
      async getInstance() { return { id: 'inst' }; }
    }

    const result = await runTool(uploadsPushTool, { env: 'staging', filePath: zip }, {
      Gateway,
      presignUrl: async () => ({ uploadUrl: 'https://s3.example.com/u', accessUrl: 'https://cdn.example.com/u.zip' }),
      uploadFile: async () => 'ok'
    });

    expect(result.ok).toBe(true);
    expect(built.map(auth => auth.token)).toEqual(['posg_bound-to-staging.example.com']);
    expect(JSON.stringify(result)).not.toContain(GLOBAL);
  });

  describe('job-status, polling without naming the instance', () => {
    const job = { origin: 'https://prod.example.com' };

    test('binds the token of the one environment pointing at the job\'s instance', async () => {
      storePortal('shared', { url: PORTAL_URL, token: GLOBAL });
      writeDotPos({
        staging: { url: 'https://staging.example.com', email: 'a@b.c', token: 'per-instance' },
        prod: { url: 'https://prod.example.com', portal: 'shared' }
      });

      const { auth } = await authForJob(job, {});

      expect(auth).toMatchObject({ token: 'posg_bound-to-prod.example.com', source: '.pos(prod)' });
    });

    // A `.pos` copied from a colleague names a portal this machine never added.
    test('a portal that is not on this machine is a project failure, not a defect', async () => {
      writeDotPos({
        staging: { url: 'https://staging.example.com', email: 'a@b.c', token: 'per-instance' },
        prod: { url: 'https://prod.example.com', portal: 'shared' }
      });

      await expect(authForJob(job, {})).rejects.toMatchObject({ kind: 'project', code: 'PORTAL_MISSING' });
    });
  });
});
