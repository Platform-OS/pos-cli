/**
 * Unit tests for lib/dns/auth.js
 * resolvePortalContext: per-side (source/target) portal credentials + instance uuid resolution.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn(), Log: vi.fn() }
}));

const mockSettings = vi.fn();
vi.mock('#lib/settings.js', () => ({
  settingsFromDotPos: (env) => mockSettings(env)
}));

const mockReadPassword = vi.fn();
vi.mock('#lib/utils/password.js', () => ({
  readPassword: () => mockReadPassword()
}));

import { resolvePortalContext } from '#lib/dns/auth.js';

const PORTAL = 'https://portal.source.test';
const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const INSTANCE_URL = 'https://myapp.staging.oregon.platform-os.com';
const HOSTNAME = 'myapp.staging.oregon.platform-os.com';

const stubInstances = (portal = PORTAL) =>
  nock(portal).get('/api/instances').reply(200, { data: [{ name: 'myapp', uuid: UUID }] });

describe('resolvePortalContext', () => {
  beforeEach(() => {
    nock.disableNetConnect();
    mockSettings.mockReset();
    mockReadPassword.mockReset();
    delete process.env.PARTNER_PORTAL_HOST;
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('resolves portal url + token from the .pos environment entry', async () => {
    mockSettings.mockReturnValue({
      url: INSTANCE_URL,
      token: 'pos-token',
      email: 'user@example.com',
      partner_portal_url: PORTAL
    });
    stubInstances();
    nock(PORTAL, { reqheaders: { authorization: 'Bearer pos-token' } })
      .get('/api/instances/search')
      .query({ domain: HOSTNAME })
      .reply(200, { data: [{ name: 'myapp', uuid: UUID }] });

    const context = await resolvePortalContext('staging', { label: 'source' });

    expect(mockSettings).toHaveBeenCalledWith('staging');
    expect(context.portalUrl).toEqual(PORTAL);
    expect(context.instanceUuid).toEqual(UUID);
    expect(context.client.readOnly).toBe(false);
  });

  test('flag overrides win over .pos values and instanceUuid skips the search', async () => {
    mockSettings.mockReturnValue({ url: INSTANCE_URL, token: 'pos-token', partner_portal_url: PORTAL });
    const OTHER = 'https://portal.other.test';
    stubInstances(OTHER);

    const context = await resolvePortalContext('staging', {
      portalUrl: OTHER,
      token: 'flag-token',
      instanceUuid: 'flag-uuid',
      label: 'target'
    });

    expect(context.portalUrl).toEqual(OTHER);
    expect(context.instanceUuid).toEqual('flag-uuid');
    expect(context.client.token).toEqual('flag-token');
  });

  test('errors when the environment is missing from .pos', async () => {
    mockSettings.mockReturnValue(undefined);
    await expect(resolvePortalContext('nope', { label: 'source' }))
      .rejects.toThrow('No settings for source environment "nope"');
  });

  test('errors when no token can be resolved', async () => {
    mockSettings.mockReturnValue({ url: INSTANCE_URL, partner_portal_url: PORTAL });
    await expect(resolvePortalContext('staging', { label: 'source' }))
      .rejects.toThrow('No credentials for source portal');
  });

  test('ambiguous domain match lists candidates and asks for --<label>-instance-uuid', async () => {
    mockSettings.mockReturnValue({ url: INSTANCE_URL, token: 't', partner_portal_url: PORTAL });
    stubInstances();
    nock(PORTAL)
      .get('/api/instances/search')
      .query({ domain: HOSTNAME })
      .reply(200, { data: [{ uuid: 'u1' }, { uuid: 'u2' }] });
    nock(PORTAL)
      .get('/api/instances')
      .reply(200, { data: [{ name: 'one', uuid: 'u1' }, { name: 'two', uuid: 'u2' }] });

    const error = await resolvePortalContext('staging', { label: 'target' }).catch(e => e);
    expect(error.message).toContain('--target-instance-uuid');
    expect(error.message).toContain('u1');
    expect(error.message).toContain('two');
  });

  test('no domain match errors with portal name', async () => {
    mockSettings.mockReturnValue({ url: INSTANCE_URL, token: 't', partner_portal_url: PORTAL });
    stubInstances();
    nock(PORTAL)
      .get('/api/instances/search')
      .query({ domain: HOSTNAME })
      .reply(200, { data: [] });
    nock(PORTAL).get('/api/instances').reply(200, { data: [] });

    await expect(resolvePortalContext('staging', { label: 'source' }))
      .rejects.toThrow(`No instance on ${PORTAL} has the domain ${HOSTNAME}`);
  });

  test('--email authenticates via /api/authenticate and uses the session JWT', async () => {
    mockSettings.mockReturnValue({ url: INSTANCE_URL, partner_portal_url: PORTAL });
    mockReadPassword.mockResolvedValue('pw');
    nock(PORTAL).post('/api/authenticate', { email: 'me@example.com', password: 'pw' })
      .reply(200, { auth_token: 'session-jwt' });
    nock(PORTAL, { reqheaders: { authorization: 'Bearer session-jwt' } })
      .get('/api/instances').reply(200, { data: [] });

    const context = await resolvePortalContext('staging', {
      email: 'me@example.com',
      instanceUuid: UUID,
      label: 'source'
    });
    expect(context.client.token).toEqual('session-jwt');
  });

  test('readOnly is passed through to the client', async () => {
    mockSettings.mockReturnValue({ url: INSTANCE_URL, token: 't', partner_portal_url: PORTAL });
    stubInstances();

    const context = await resolvePortalContext('staging', {
      instanceUuid: UUID,
      label: 'source',
      readOnly: true
    });
    expect(context.client.readOnly).toBe(true);
  });
});
