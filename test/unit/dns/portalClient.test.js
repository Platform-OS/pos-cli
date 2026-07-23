/**
 * Unit tests for lib/dns/portalClient.js
 * DnsPortalClient: per-portal API client used by `pos-cli dns` commands.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn() }
}));

import {
  DnsPortalClient,
  PortalAuthError,
  PortalAccessError,
  DestructiveChangeError,
  ReadOnlyPortalError
} from '#lib/dns/portalClient.js';

const PORTAL = 'https://portal.test';
const UUID = '11111111-2222-3333-4444-555555555555';

describe('DnsPortalClient', () => {
  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('normalizes trailing slash on baseUrl', () => {
    const client = new DnsPortalClient({ baseUrl: `${PORTAL}/`, token: 't' });
    expect(client.baseUrl).toEqual(PORTAL);
  });

  test('listDomains sends Bearer token and version=2 by default', async () => {
    const scope = nock(PORTAL, { reqheaders: { authorization: 'Bearer secret-token' } })
      .get('/api/domains')
      .query({ instance_uuid: UUID, version: '2' })
      .reply(200, [{ status: 'ready' }]);

    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 'secret-token' });
    const domains = await client.listDomains(UUID);

    expect(domains).toEqual([{ status: 'ready' }]);
    expect(scope.isDone()).toBe(true);
  });

  test('listDomains supports version override', async () => {
    nock(PORTAL)
      .get('/api/domains')
      .query({ instance_uuid: UUID, version: '1' })
      .reply(200, []);

    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 't' });
    await expect(client.listDomains(UUID, { version: 1 })).resolves.toEqual([]);
  });

  test('getDomain passes the name in the path AND the query (show reads params[:name])', async () => {
    nock(PORTAL)
      .get('/api/domains/example.com')
      .query({ instance_uuid: UUID, name: 'example.com', version: '2' })
      .reply(200, { status: 'ready' });

    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 't' });
    await expect(client.getDomain('example.com', UUID)).resolves.toEqual({ status: 'ready' });
  });

  test('401 maps to PortalAuthError naming the portal', async () => {
    nock(PORTAL)
      .get('/api/instances')
      .reply(401, { errors: ['Not authorized'] });

    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 'expired' });
    await expect(client.listInstances()).rejects.toThrow(PortalAuthError);
    nock.cleanAll();
    nock(PORTAL).get('/api/instances').reply(401, { errors: ['Not authorized'] });
    await expect(client.listInstances()).rejects.toThrow(PORTAL);
  });

  test('NotAuthorized in error body maps to PortalAccessError with instance uuid', async () => {
    nock(PORTAL)
      .get('/api/domains')
      .query(true)
      .reply(500, { errors: ['DomainsAPIError: ResourceAuthorization::NotAuthorized'] });

    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 't' });
    const error = await client.listDomains(UUID).catch(e => e);
    expect(error).toBeInstanceOf(PortalAccessError);
    expect(error.message).toContain(UUID);
    expect(error.message).toContain(PORTAL);
  });

  test('destructive 422 maps to DestructiveChangeError carrying the server message', async () => {
    const warning = 'Destructive DNS change blocked: this update would delete 7 managed records. Re-submit with explicit confirmation (confirm_destructive) to proceed.';
    nock(PORTAL)
      .post('/api/domains')
      .reply(422, { errors: [warning] });

    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 't' });
    const error = await client.upsertDomain({ name: 'example.com', instance_uuid: UUID }).catch(e => e);
    expect(error).toBeInstanceOf(DestructiveChangeError);
    expect(error.message).toEqual(warning);
    expect(error.domainName).toEqual('example.com');
  });

  test('non-destructive 422 validation errors pass through untyped', async () => {
    nock(PORTAL)
      .post('/api/domains')
      .reply(422, { errors: { base: {}, dns_records: [{ type: ['is not included in the list'] }] } });

    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 't' });
    const error = await client.upsertDomain({ name: 'example.com', instance_uuid: UUID }).catch(e => e);
    expect(error.name).toEqual('StatusCodeError');
    expect(error.statusCode).toEqual(422);
  });

  test('readOnly client refuses POST methods without any network call', async () => {
    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 't', readOnly: true });
    await expect(() => client.upsertDomain({ name: 'example.com', instance_uuid: UUID }))
      .toThrow(ReadOnlyPortalError);
    await expect(() => client.refreshDomain('example.com', UUID)).toThrow(ReadOnlyPortalError);
    expect(nock.pendingMocks()).toEqual([]);
  });

  test('refreshDomain POSTs to the member refresh route', async () => {
    nock(PORTAL)
      .post('/api/domains/example.com/refresh')
      .query({ instance_uuid: UUID })
      .reply(200, { data: { status: 'ownership_verification_pending' } });

    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 't' });
    const result = await client.refreshDomain('example.com', UUID);
    expect(result.data.status).toEqual('ownership_verification_pending');
  });

  test('static authenticate returns auth_token and maps 401', async () => {
    nock(PORTAL)
      .post('/api/authenticate', { email: 'a@b.c', password: 'pw' })
      .reply(200, { auth_token: 'jwt-token' });

    await expect(DnsPortalClient.authenticate(PORTAL, 'a@b.c', 'pw')).resolves.toEqual('jwt-token');

    nock(PORTAL).post('/api/authenticate').reply(401, { errors: ['Invalid credentials'] });
    await expect(DnsPortalClient.authenticate(PORTAL, 'a@b.c', 'bad')).rejects.toThrow(PortalAuthError);
  });
});
