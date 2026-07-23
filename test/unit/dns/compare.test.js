/**
 * Unit tests for lib/dns/compare.js
 * Port of scripts/pp-dns/ps-sg/compare-golden.rb classification with a cross-stack
 * default mode (source normalized through the transform; stack-specific fields skipped).
 */
import { describe, test, expect } from 'vitest';

import { compareInstance } from '#lib/dns/compare.js';

const record = (overrides = {}) => ({ ttl: 3600, name: '', type: 'TXT', records: ['v=spf1 -all'], ...overrides });

const makeDomain = (name, { status = 'ready', setupType = 'domain-full', records = [record()], wwwRedirect = true, details = {}, ...rest } = {}) => ({
  status,
  has_pending: false,
  www_redirect: { enabled: wwwRedirect },
  attributes: {
    domain_name: name,
    setup_type: setupType,
    data_center: rest.dataCenter || 'dc-1',
    config: {
      enable_www_redirect: wwwRedirect,
      _domains: [{ name, use_as_default: true }],
      extra_dns_records: records
    }
  },
  details: { dns_zone_name_servers: [], ...details }
});

const levelsByDomain = (outcome) =>
  Object.fromEntries(outcome.results.map(result => [result.domainName, result.level]));

describe('compareInstance (cross-stack default)', () => {
  test('identical intent is OK even with MX case, trailing dots and TXT chunking noise', () => {
    const source = [makeDomain('example.com', {
      records: [
        record({ type: 'MX', records: ['10 ASPMX.L.GOOGLE.COM.'] }),
        record({ type: 'TXT', records: ['"part-one" "part-two"'] })
      ],
      dataCenter: 'aws-london'
    })];
    const target = [makeDomain('example.com', {
      records: [
        record({ type: 'MX', records: ['10 aspmx.l.google.com'] }),
        record({ type: 'TXT', records: ['part-onepart-two'] })
      ],
      dataCenter: 'oci-uk'
    })];

    const outcome = compareInstance(source, target);
    expect(levelsByDomain(outcome)['example.com']).toEqual('OK');
    expect(outcome.totals.critical).toEqual(0);
  });

  test('status mismatch is CRITICAL, downgraded by ignoreStatus', () => {
    const source = [makeDomain('example.com', { status: 'ready' })];
    const target = [makeDomain('example.com', { status: 'ownership_verification_pending' })];

    expect(levelsByDomain(compareInstance(source, target))['example.com']).toEqual('CRITICAL');
    const relaxed = compareInstance(source, target, { ignoreStatus: true });
    expect(levelsByDomain(relaxed)['example.com']).toEqual('ADVISORY');
  });

  test('setup_type mismatch and intent record differences are CRITICAL', () => {
    const source = [makeDomain('example.com', { setupType: 'domain-full' })];
    const target = [makeDomain('example.com', { setupType: 'domain-external' })];
    expect(levelsByDomain(compareInstance(source, target))['example.com']).toEqual('CRITICAL');

    const source2 = [makeDomain('example.com', { records: [record({ records: ['v=spf1 include:a.com -all'] })] })];
    const target2 = [makeDomain('example.com', { records: [record({ records: ['v=spf1 include:b.com -all'] })] })];
    const outcome = compareInstance(source2, target2);
    expect(levelsByDomain(outcome)['example.com']).toEqual('CRITICAL');
    expect(outcome.results[0].critical.join()).toContain('extra_dns_records');
  });

  test('the www-redirect CNAME does not count as intent drift on either side', () => {
    const withWww = [record(), record({ name: 'www', type: 'CNAME', records: ['example.com'] })];
    const withoutWww = [record()];

    // The new-stack controller stores the auto-added www record in config,
    // so it may appear on either side — both must be ignored symmetrically.
    expect(levelsByDomain(compareInstance(
      [makeDomain('example.com', { records: withWww })],
      [makeDomain('example.com', { records: withoutWww })]
    ))['example.com']).toEqual('OK');

    expect(levelsByDomain(compareInstance(
      [makeDomain('example.com', { records: withoutWww })],
      [makeDomain('example.com', { records: withWww })]
    ))['example.com']).toEqual('OK');
  });

  test('live details noise (TXT quoting, hostname case, value order) is not drift', () => {
    const source = [makeDomain('example.com', {
      details: {
        extra_dns_records: [
          { name: 'txt', type: 'TXT', records: ['extraquoted', 'verify=1'] },
          { name: 'ssl', type: 'CNAME', records: ['ABC123.Comodoca.com'] }
        ]
      }
    })];
    const target = [makeDomain('example.com', {
      details: {
        extra_dns_records: [
          { name: 'txt', type: 'TXT', records: ['"verify=1"', '"extraquoted"'] },
          { name: 'ssl', type: 'CNAME', records: ['abc123.comodoca.com'] }
        ]
      }
    })];

    expect(levelsByDomain(compareInstance(source, target))['example.com']).toEqual('OK');
  });

  test('live details drift is ADVISORY only', () => {
    const source = [makeDomain('example.com', {
      details: { extra_dns_records: [{ name: '', type: 'TXT', records: ['v=spf1 -all'] }] }
    })];
    const target = [makeDomain('example.com', {
      details: { extra_dns_records: [] }
    })];

    const outcome = compareInstance(source, target);
    expect(levelsByDomain(outcome)['example.com']).toEqual('ADVISORY');
  });

  test('source-provisioned domain absent on target is MISSING_AFTER; unprovisioned entries are ignored', () => {
    const source = [
      makeDomain('example.com'),
      makeDomain('www.example.com', { status: '' })
    ];
    const target = [
      makeDomain('shop.prod01.oregon.platform-os.com', { status: '' })
    ];

    const outcome = compareInstance(source, target);
    expect(levelsByDomain(outcome)['example.com']).toEqual('MISSING_AFTER');
    expect(outcome.results).toHaveLength(1);
    expect(outcome.totals.missingAfter).toEqual(1);
  });

  test('data_center and nameserver differences are ignored cross-stack', () => {
    const source = [makeDomain('example.com', {
      dataCenter: 'aws-london',
      details: { dns_zone_name_servers: ['ns-1.awsdns-01.org'] }
    })];
    const target = [makeDomain('example.com', {
      dataCenter: 'oci-uk',
      details: { dns_zone_name_servers: ['curt.ns.cloudflare.com'] }
    })];

    expect(levelsByDomain(compareInstance(source, target))['example.com']).toEqual('OK');
  });

  test('CF-native (txt_name) verification shape on target is CRITICAL — customers cannot act on it', () => {
    const source = [makeDomain('example.com', { setupType: 'domain-external' })];
    const target = [makeDomain('example.com', {
      setupType: 'domain-external',
      details: { dns_verification_records: [{ txt_name: '_acme-challenge.example.com', txt_value: 'abc' }] }
    })];

    const outcome = compareInstance(source, target);
    expect(levelsByDomain(outcome)['example.com']).toEqual('CRITICAL');
    expect(outcome.results[0].critical.join()).toContain('wrong shape');
  });
});

describe('compareInstance (raw mode)', () => {
  test('data_center mismatch and nameserver drift surface again', () => {
    const source = [makeDomain('example.com', {
      dataCenter: 'dc-a',
      details: { dns_zone_name_servers: ['ns1.old.test'] }
    })];
    const target = [makeDomain('example.com', {
      dataCenter: 'dc-b',
      details: { dns_zone_name_servers: ['ns1.new.test'] }
    })];

    const outcome = compareInstance(source, target, { transform: false });
    const result = outcome.results[0];
    expect(result.level).toEqual('CRITICAL');
    expect(result.critical.join()).toContain('data_center');
    expect(result.advisory.join()).toContain('dns_zone_name_servers');
  });

  test('verification record value drift is CRITICAL in raw mode', () => {
    const verification = (value) => ({
      resource_record_name: '_acme-challenge.example.com',
      resource_record_type: 'CNAME',
      resource_record_value: value
    });
    const source = [makeDomain('example.com', { details: { dns_verification_records: [verification('old.dcv.cloudflare.com')] } })];
    const target = [makeDomain('example.com', { details: { dns_verification_records: [verification('new.dcv.cloudflare.com')] } })];

    const outcome = compareInstance(source, target, { transform: false });
    expect(outcome.results[0].level).toEqual('CRITICAL');
    expect(outcome.results[0].critical.join()).toContain('value differs');
  });
});
