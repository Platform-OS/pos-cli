/**
 * Unit tests for lib/dns/mapping.js
 * Bulk-mode inputs: instances file, CSV/JSON mapping files, match-by-domain resolution.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import nock from 'nock';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn() }
}));

import { parseInstancesFile, parseMappingFile, matchByDomain } from '#lib/dns/mapping.js';
import { DnsPortalClient } from '#lib/dns/portalClient.js';

const tmpFile = (content, extension = 'txt') => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dns-mapping-')), `input.${extension}`);
  fs.writeFileSync(file, content);
  return file;
};

describe('parseInstancesFile', () => {
  test('one uuid per line, comments and blanks ignored', () => {
    const file = tmpFile('# cohort A\nuuid-one\n\nuuid-two\n');
    expect(parseInstancesFile(file)).toEqual(['uuid-one', 'uuid-two']);
  });

  test('rejects lines that do not look like uuids', () => {
    const file = tmpFile('uuid-one,uuid-two\n');
    expect(() => parseInstancesFile(file)).toThrow('does not look like an instance uuid');
  });
});

describe('parseMappingFile', () => {
  test('CSV with optional header and label', () => {
    const file = tmpFile('source_uuid,target_uuid,label\ns-1,t-1,shop\ns-2,t-2\n', 'csv');
    expect(parseMappingFile(file)).toEqual([
      { sourceUuid: 's-1', targetUuid: 't-1', label: 'shop' },
      { sourceUuid: 's-2', targetUuid: 't-2', label: 's-2' }
    ]);
  });

  test('JSON array form', () => {
    const file = tmpFile(JSON.stringify([{ source_uuid: 's-1', target_uuid: 't-1', label: 'shop' }]), 'json');
    expect(parseMappingFile(file)).toEqual([{ sourceUuid: 's-1', targetUuid: 't-1', label: 'shop' }]);
  });

  test('malformed rows and empty files error', () => {
    expect(() => parseMappingFile(tmpFile('only-source\n', 'csv'))).toThrow('expected "source_uuid,target_uuid');
    expect(() => parseMappingFile(tmpFile('', 'csv'))).toThrow('no instance pairs');
  });
});

describe('matchByDomain', () => {
  const SOURCE = 'https://portal.source.test';
  const TARGET = 'https://portal.target.test';
  let sourceClient;
  let targetClient;

  const sourceDomains = (entries) =>
    nock(SOURCE).get('/api/domains').query(true).reply(200, entries);

  const domainEntry = (name, status = 'ready') => ({
    status,
    attributes: { domain_name: name, config: { _domains: [{ name }] } }
  });

  beforeEach(() => {
    nock.disableNetConnect();
    sourceClient = new DnsPortalClient({ baseUrl: SOURCE, token: 's' });
    targetClient = new DnsPortalClient({ baseUrl: TARGET, token: 't' });
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('resolves when all source domains agree on one target instance', async () => {
    sourceDomains([domainEntry('example.com'), domainEntry('shop.example.com')]);
    nock(TARGET).get('/api/instances/search').query({ domain: 'example.com' })
      .reply(200, { data: [{ uuid: 't-1', name: 'target-app' }] });
    nock(TARGET).get('/api/instances/search').query({ domain: 'shop.example.com' })
      .reply(200, { data: [{ uuid: 't-1', name: 'target-app' }] });

    await expect(matchByDomain({ sourceClient, targetClient, sourceUuid: 's-1' })).resolves.toEqual('t-1');
  });

  test('errors when domains match different target instances', async () => {
    sourceDomains([domainEntry('a.com'), domainEntry('b.com')]);
    nock(TARGET).get('/api/instances/search').query({ domain: 'a.com' })
      .reply(200, { data: [{ uuid: 't-1', name: 'one' }] });
    nock(TARGET).get('/api/instances/search').query({ domain: 'b.com' })
      .reply(200, { data: [{ uuid: 't-2', name: 'two' }] });

    await expect(matchByDomain({ sourceClient, targetClient, sourceUuid: 's-1' }))
      .rejects.toThrow('matched multiple target instances');
  });

  test('a failed target lookup is reported as a lookup failure, not as "no match" (TASK-1.14)', async () => {
    sourceDomains([domainEntry('a.com')]);
    nock(TARGET).get('/api/instances/search').query(true).reply(503, { errors: ['upstream down'] });

    await expect(matchByDomain({ sourceClient, targetClient, sourceUuid: 's-1' }))
      .rejects.toThrow(/instance lookup for a\.com .* failed/);
  });

  test('errors when nothing matches or no customer domains exist', async () => {
    sourceDomains([domainEntry('a.com')]);
    nock(TARGET).get('/api/instances/search').query(true).reply(200, { data: [] });
    await expect(matchByDomain({ sourceClient, targetClient, sourceUuid: 's-1' }))
      .rejects.toThrow('no instance on');

    sourceDomains([domainEntry('app.prod01.oregon.platform-os.com')]);
    await expect(matchByDomain({ sourceClient, targetClient, sourceUuid: 's-1' }))
      .rejects.toThrow('no provisioned customer domains');
  });
});
