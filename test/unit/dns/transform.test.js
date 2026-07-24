/**
 * Unit tests for lib/dns/transform.js
 * Pure old-stack -> new-stack domain payload transform.
 * Shapes mirror real GET /api/domains?version=2 responses from partners.platformos.com.
 */
import { describe, test, expect } from 'vitest';

import { transformDomain, transformEnvelope, deriveSetupType } from '#lib/dns/transform.js';

const TARGET_UUID = 'target-uuid-1234';

const record = (overrides = {}) => ({ ttl: 3600, name: '', type: 'TXT', records: ['v=spf1 -all'], ...overrides });

const sourceDomain = (overrides = {}) => ({
  status: 'ready',
  has_pending: false,
  www_redirect: { enabled: true },
  attributes: {
    domain_name: 'example-shop.com',
    setup_type: 'domain-full',
    data_center: 'production-london',
    instance_uuid: 'source-uuid-9999',
    config: {
      enable_www_redirect: null,
      _domains: [
        { name: 'example-shop.com', use_as_default: false, redirect_to: 'https://www.example-shop.com', redirect_code: 302 },
        { name: 'www.example-shop.com', use_as_default: true, redirect_to: null, redirect_code: null }
      ],
      extra_dns_records: [record()]
    }
  },
  details: { dns_zone_name_servers: ['ns-1.awsdns-01.org', 'ns-2.awsdns-02.net'] },
  ...overrides
});

const withRecords = (records, overrides = {}) => {
  const domain = sourceDomain(overrides);
  domain.attributes.config.extra_dns_records = records;
  return domain;
};

describe('transformDomain', () => {
  test('builds a POST /api/domains payload from a v2 source domain', () => {
    const result = transformDomain(sourceDomain(), { targetInstanceUuid: TARGET_UUID });

    expect(result.errors).toEqual([]);
    expect(result.payload).toEqual({
      name: 'example-shop.com',
      instance_uuid: TARGET_UUID,
      setup_type: 'domain-full',
      use_as_default: true,
      enable_www_redirect: true,
      extra_dns_records: [{ name: '', type: 'TXT', ttl: 3600, records: ['v=spf1 -all'] }]
    });
  });

  test('use_as_default falls back to the apex _domains entry when www redirect is off', () => {
    const domain = sourceDomain({ www_redirect: { enabled: false } });
    domain.attributes.config._domains = [
      { name: 'example-shop.com', use_as_default: true },
      { name: 'www.example-shop.com', use_as_default: false }
    ];
    const result = transformDomain(domain, { targetInstanceUuid: TARGET_UUID });
    expect(result.payload.enable_www_redirect).toBe(false);
    expect(result.payload.use_as_default).toBe(true);
  });

  test('drops the www redirect CNAME when enable_www_redirect derives true (target re-adds it)', () => {
    const result = transformDomain(
      withRecords([record({ name: 'www', type: 'CNAME', records: ['example-shop.com'] }), record()]),
      { targetInstanceUuid: TARGET_UUID }
    );

    expect(result.payload.extra_dns_records).toHaveLength(1);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0].reason).toContain('enable_www_redirect');
  });

  test('drops the www redirect CNAME for a mixed-case source domain name (TASK-1.20 follow-up)', () => {
    const domain = withRecords([record({ name: 'www', type: 'CNAME', records: ['Example-Shop.com.'] })]);
    domain.attributes.domain_name = 'Example-Shop.com';

    const result = transformDomain(domain, { targetInstanceUuid: TARGET_UUID });

    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0].reason).toContain('enable_www_redirect');
    expect(result.payload.extra_dns_records).toEqual([]);
  });

  test('keeps the www CNAME when it points elsewhere or the redirect is off', () => {
    const external = transformDomain(
      withRecords([record({ name: 'www', type: 'CNAME', records: ['sites.example-cdn.net'] })]),
      { targetInstanceUuid: TARGET_UUID }
    );
    expect(external.payload.extra_dns_records).toHaveLength(1);

    const redirectOff = transformDomain(
      withRecords([record({ name: 'www', type: 'CNAME', records: ['example-shop.com'] })], { www_redirect: { enabled: false } }),
      { targetInstanceUuid: TARGET_UUID }
    );
    expect(redirectOff.payload.extra_dns_records).toHaveLength(1);
    expect(redirectOff.dropped).toEqual([]);
  });

  test('old-infrastructure values are kept but flagged with a warning', () => {
    const result = transformDomain(
      withRecords([record({ name: 'app', type: 'CNAME', records: ['d123.elb.amazonaws.com.'] })]),
      { targetInstanceUuid: TARGET_UUID }
    );

    expect(result.payload.extra_dns_records).toHaveLength(1);
    expect(result.warnings.some(w => w.includes('elb.amazonaws.com'))).toBe(true);
  });

  test('--drop-value patterns drop matching records with a reason', () => {
    const result = transformDomain(
      withRecords([record({ name: 'app', type: 'CNAME', records: ['d123.elb.amazonaws.com'] }), record()]),
      { targetInstanceUuid: TARGET_UUID, dropValuePatterns: [/elb\.amazonaws\.com/i] }
    );

    expect(result.payload.extra_dns_records).toHaveLength(1);
    expect(result.dropped[0].reason).toContain('--drop-value');
  });

  test('multi-value CNAME is a hard error naming the record', () => {
    const result = transformDomain(
      withRecords([record({ name: 'multi', type: 'CNAME', records: ['a.example.net', 'b.example.net'] })]),
      { targetInstanceUuid: TARGET_UUID }
    );

    expect(result.payload).toBeNull();
    expect(result.errors[0]).toContain('multi');
    expect(result.errors[0]).toContain('exactly one value');
  });

  test('unknown record type and malformed MX/SRV are errors', () => {
    const badType = transformDomain(withRecords([record({ type: 'CAA', records: ['0 issue "ca.test"'] })]), { targetInstanceUuid: TARGET_UUID });
    expect(badType.errors[0]).toContain('CAA');

    const badMx = transformDomain(withRecords([record({ type: 'MX', records: ['not-a-priority mail.test'] })]), { targetInstanceUuid: TARGET_UUID });
    expect(badMx.errors[0]).toContain('MX');

    const badSrv = transformDomain(withRecords([record({ name: '_sip._tls', type: 'SRV', records: ['100 1 sipdir.online.lync.com'] })]), { targetInstanceUuid: TARGET_UUID });
    expect(badSrv.errors[0]).toContain('SRV');
  });

  test('normalizes values: MX trailing dot + case, CNAME trailing dot, TXT quotes', () => {
    const result = transformDomain(
      withRecords([
        record({ type: 'MX', records: ['0 Example-Shop-com.Mail.Protection.Outlook.com.'] }),
        record({ name: 'autodiscover', type: 'CNAME', records: ['autodiscover.outlook.com.'] }),
        record({ type: 'TXT', records: ['"v=spf1 include:spf.protection.outlook.com -all"'] })
      ]),
      { targetInstanceUuid: TARGET_UUID }
    );

    const [mx, cname, txt] = result.payload.extra_dns_records;
    expect(mx.records).toEqual(['0 example-shop-com.mail.protection.outlook.com']);
    expect(cname.records).toEqual(['autodiscover.outlook.com']);
    expect(txt.records).toEqual(['v=spf1 include:spf.protection.outlook.com -all']);
  });

  test('proxied passes through only when present on the source record', () => {
    const result = transformDomain(
      withRecords([
        record({ name: 'app', type: 'CNAME', records: ['app.example.net'], proxied: true }),
        record()
      ]),
      { targetInstanceUuid: TARGET_UUID }
    );

    expect(result.payload.extra_dns_records[0].proxied).toBe(true);
    expect('proxied' in result.payload.extra_dns_records[1]).toBe(false);
  });

  test('transform is idempotent: already-normalized records pass through unchanged', () => {
    const records = [
      record({ type: 'MX', records: ['0 mail.example-shop.com'] }),
      record({ name: 'autodiscover', type: 'CNAME', records: ['autodiscover.outlook.com'] }),
      record({ type: 'TXT', records: ['v=spf1 -all'] })
    ];
    const first = transformDomain(withRecords(records), { targetInstanceUuid: TARGET_UUID });
    const second = transformDomain(withRecords(first.payload.extra_dns_records), { targetInstanceUuid: TARGET_UUID });

    expect(second.payload.extra_dns_records).toEqual(first.payload.extra_dns_records);
    expect(second.errors).toEqual([]);
    expect(second.dropped).toEqual([]);
  });

  test('unprovisioned source domain (empty status) is skipped, not an error', () => {
    const result = transformDomain(sourceDomain({ status: '' }), { targetInstanceUuid: TARGET_UUID });
    expect(result.skipped).toBe(true);
    expect(result.payload).toBeNull();
    expect(result.errors).toEqual([]);
  });
});

describe('deriveSetupType', () => {
  test('prefers the v2 attribute', () => {
    expect(deriveSetupType(sourceDomain())).toEqual('domain-full');
  });

  test('infers from name servers when the attribute is missing (v1 fallback)', () => {
    const domain = sourceDomain();
    delete domain.attributes.setup_type;
    expect(deriveSetupType(domain)).toEqual('domain-full');

    domain.details.dns_zone_name_servers = [];
    expect(deriveSetupType(domain)).toEqual('domain-external');
  });
});

describe('transformEnvelope', () => {
  test('plans only primary provisioned domains; www companions and platform subdomains are skipped', () => {
    const envelope = {
      schema: 'pos-cli/dns-export/v1',
      instance: { uuid: 'source-uuid-9999' },
      domains: [
        sourceDomain({ status: '' , attributes: { config: { _domains: [{ name: 'www.example-shop.com', use_as_default: true }] } } }),
        sourceDomain(),
        sourceDomain({ status: '', attributes: { config: { _domains: [{ name: 'shop.prod01.london.platform-os.com', use_as_default: false }] } } })
      ]
    };

    const { plans } = transformEnvelope(envelope, { targetInstanceUuid: TARGET_UUID });
    const active = plans.filter(plan => !plan.skipped);
    expect(active).toHaveLength(1);
    expect(active[0].domainName).toEqual('example-shop.com');
    expect(plans.filter(plan => plan.skipped)).toHaveLength(2);
  });
});
