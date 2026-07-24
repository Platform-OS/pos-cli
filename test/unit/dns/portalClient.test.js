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
  ReadOnlyPortalError,
  PortalRequestError
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

  test('non-destructive 422 maps to PortalRequestError with flattened validation messages', async () => {
    nock(PORTAL)
      .post('/api/domains')
      .reply(422, { errors: { base: {}, dns_records: [{ type: ['is not included in the list'] }] } });

    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 't' });
    const error = await client.upsertDomain({ name: 'example.com', instance_uuid: UUID }).catch(e => e);
    expect(error).toBeInstanceOf(PortalRequestError);
    expect(error.statusCode).toEqual(422);
    expect(error.message).toContain('POST /api/domains responded with status 422');
    expect(error.message).toContain('dns_records[0].type: is not included in the list');
  });

  test('500 with an errors array surfaces the server messages (SetDomains validation)', async () => {
    const serverMessage = 'Name has to be unique, but "communityfoods.co.uk" is in use by other instance.';
    nock(PORTAL)
      .post('/api/domains')
      .reply(500, { errors: [serverMessage] });

    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 't' });
    const error = await client.upsertDomain({ name: 'communityfoods.co.uk', instance_uuid: UUID }).catch(e => e);
    expect(error).toBeInstanceOf(PortalRequestError);
    expect(error.statusCode).toEqual(500);
    expect(error.domainName).toEqual('communityfoods.co.uk');
    expect(error.message).toContain('POST /api/domains responded with status 500');
    expect(error.message).toContain(serverMessage);
    // Known message gets an actionable hint appended.
    expect(error.message).toContain('already attached to a different instance');
  });

  test('500 with a string errors value surfaces it (destroy/show error shape)', async () => {
    nock(PORTAL)
      .get('/api/domains/missing.com')
      .query(true)
      .reply(404, { errors: 'Domain not found' });

    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 't' });
    const error = await client.getDomain('missing.com', UUID).catch(e => e);
    expect(error).toBeInstanceOf(PortalRequestError);
    expect(error.message).toContain('GET /api/domains/missing.com responded with status 404: Domain not found');
    // The query string is noise — the path in the message must not include it.
    expect(error.message).not.toContain('instance_uuid=');
  });

  test('500 with an HTML body reports that no details were returned', async () => {
    nock(PORTAL)
      .post('/api/domains')
      .reply(500, '<html><body>Internal Server Error</body></html>', { 'Content-Type': 'text/html' });

    const client = new DnsPortalClient({ baseUrl: PORTAL, token: 't' });
    const error = await client.upsertDomain({ name: 'example.com', instance_uuid: UUID }).catch(e => e);
    expect(error).toBeInstanceOf(PortalRequestError);
    expect(error.message).toContain('responded with status 500');
    expect(error.message).toContain('no error details');
    expect(error.message).not.toContain('<html>');
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
