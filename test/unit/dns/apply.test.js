/**
 * Unit tests for lib/dns/apply.js
 * applyPlans: sequential upserts with destructive-change guard and status polling.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn() }
}));

import { DnsPortalClient } from '#lib/dns/portalClient.js';
import { applyPlans } from '#lib/dns/apply.js';

const PORTAL = 'https://portal.target.test';
const UUID = 'target-uuid';

const plan = (name, overrides = {}) => ({
  domainName: name,
  payload: {
    name,
    instance_uuid: UUID,
    setup_type: 'domain-external',
    use_as_default: false,
    enable_www_redirect: false,
    extra_dns_records: []
  },
  kept: [],
  dropped: [],
  errors: [],
  warnings: [],
  skipped: false,
  ...overrides
});

const fastOpts = { pollIntervalMs: 1, timeoutMs: 50, interPostDelayMs: 0 };

describe('applyPlans', () => {
  let client;

  beforeEach(() => {
    nock.disableNetConnect();
    client = new DnsPortalClient({ baseUrl: PORTAL, token: 't' });
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('POSTs each applicable plan and polls until the provision settles', async () => {
    nock(PORTAL).post('/api/domains', body => body.name === 'a.test' && body.confirm_destructive === undefined)
      .reply(200, { data: { status: 'initializing' } });
    nock(PORTAL).get('/api/domains/a.test').query(true)
      .reply(200, { status: 'initializing', locked: true });
    nock(PORTAL).get('/api/domains/a.test').query(true)
      .reply(200, { status: 'ownership_verification_pending', substatus: null, locked: false });

    const { results } = await applyPlans({ client, plans: [plan('a.test')], ...fastOpts });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      domainName: 'a.test',
      status: 'applied',
      finalStatus: 'ownership_verification_pending'
    });
  });

  test('destructive 422 is reported as blocked-destructive and never auto-retried', async () => {
    const warning = 'Destructive DNS change blocked: would delete 7 managed records. Re-submit with explicit confirmation (confirm_destructive) to proceed.';
    const scope = nock(PORTAL).post('/api/domains').reply(422, { errors: [warning] });

    const { results } = await applyPlans({ client, plans: [plan('a.test')], ...fastOpts });

    expect(results[0]).toMatchObject({ domainName: 'a.test', status: 'blocked-destructive', serverMessage: warning });
    expect(scope.isDone()).toBe(true);
    expect(nock.pendingMocks()).toEqual([]);
  });

  test('confirmDestructive forwards confirm_destructive=true', async () => {
    nock(PORTAL).post('/api/domains', body => body.confirm_destructive === true)
      .reply(200, { data: { status: 'initializing' } });
    nock(PORTAL).get('/api/domains/a.test').query(true)
      .reply(200, { status: 'ready', locked: false });

    const { results } = await applyPlans({ client, plans: [plan('a.test')], confirmDestructive: true, ...fastOpts });
    expect(results[0].status).toEqual('applied');
  });

  test('other errors are recorded per-domain and do not abort the batch', async () => {
    nock(PORTAL).post('/api/domains').reply(500, { errors: ['DomainsAPIError: boom'] });
    nock(PORTAL).post('/api/domains').reply(200, { data: { status: 'initializing' } });
    nock(PORTAL).get('/api/domains/b.test').query(true).reply(200, { status: 'ready', locked: false });

    const { results } = await applyPlans({ client, plans: [plan('a.test'), plan('b.test')], ...fastOpts });

    expect(results[0].status).toEqual('error');
    expect(results[1].status).toEqual('applied');
  });

  test('skipped and errored plans are not POSTed', async () => {
    const plans = [
      plan('skip.test', { skipped: true, skipReason: 'not provisioned', payload: null }),
      plan('bad.test', { errors: ['record invalid'], payload: null })
    ];

    const { results } = await applyPlans({ client, plans, ...fastOpts });

    expect(results.map(r => r.status)).toEqual(['skipped', 'invalid']);
    expect(nock.pendingMocks()).toEqual([]);
  });

  test('a response without the locked field still settles (TASK-1.15 tolerance)', async () => {
    nock(PORTAL).post('/api/domains').reply(200, { data: { status: 'initializing' } });
    nock(PORTAL).get('/api/domains/a.test').query(true)
      .reply(200, { status: 'ready' });

    const { results } = await applyPlans({ client, plans: [plan('a.test')], ...fastOpts });
    expect(results[0]).toMatchObject({ status: 'applied', finalStatus: 'ready', stillProcessing: false });
  });

  test('wait: false skips polling', async () => {
    nock(PORTAL).post('/api/domains').reply(200, { data: { status: 'initializing' } });

    const { results } = await applyPlans({ client, plans: [plan('a.test')], wait: false, ...fastOpts });
    expect(results[0].status).toEqual('applied');
    expect(results[0].finalStatus).toBeUndefined();
  });

  test('a failed provision worker run surfaces as apply-failed with the server message', async () => {
    nock(PORTAL).post('/api/domains').reply(200, { data: { status: 'initializing' } });
    nock(PORTAL).get('/api/domains/a.test').query(true).reply(200, {
      status: 'unknown',
      locked: false,
      last_operation_status: {
        operation: 'apply',
        status: 'failed',
        message: ['Dns::DomainProvisioner::ProvisionError: DNS record create failed: [{"code"=>81053}]']
      }
    });

    const { results } = await applyPlans({ client, plans: [plan('a.test')], ...fastOpts });

    expect(results[0].status).toEqual('apply-failed');
    expect(results[0].serverMessage).toContain('81053');
  });

  test('a blocked provision worker run surfaces as blocked-destructive', async () => {
    nock(PORTAL).post('/api/domains').reply(200, { data: { status: 'initializing' } });
    nock(PORTAL).get('/api/domains/a.test').query(true).reply(200, {
      status: 'ready',
      locked: false,
      last_operation_status: { operation: 'apply', status: 'blocked', message: ['Destructive DNS change blocked: ...'] }
    });

    const { results } = await applyPlans({ client, plans: [plan('a.test')], ...fastOpts });
    expect(results[0].status).toEqual('blocked-destructive');
  });

  test('polling timeout reports the last seen status as still processing', async () => {
    nock(PORTAL).post('/api/domains').reply(200, { data: { status: 'initializing' } });
    nock(PORTAL).get('/api/domains/a.test').query(true).times(100)
      .reply(200, { status: 'initializing', locked: true });

    const { results } = await applyPlans({ client, plans: [plan('a.test')], ...fastOpts, timeoutMs: 5 });
    expect(results[0].status).toEqual('applied');
    expect(results[0].finalStatus).toEqual('initializing');
    expect(results[0].stillProcessing).toBe(true);
  });
});
