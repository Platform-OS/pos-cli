/**
 * Unit tests for lib/dns/exportSchema.js
 * Versioned export envelope: build, bulky-detail stripping, validation.
 */
import { describe, test, expect } from 'vitest';

import { SCHEMA, buildEnvelope, stripBulkyDetails, validateEnvelope, domainName, isStrippedDetail } from '#lib/dns/exportSchema.js';

const domain = (overrides = {}) => ({
  status: 'ready',
  attributes: {
    domain_name: 'example.com',
    setup_type: 'domain-full',
    config: { extra_dns_records: [], _domains: [{ name: 'example.com', use_as_default: true }] }
  },
  details: { dns_zone_name_servers: ['a.ns', 'b.ns'] },
  ...overrides
});

describe('exportSchema', () => {
  test('buildEnvelope stamps schema, portal and instance metadata', () => {
    const envelope = buildEnvelope({
      portalUrl: 'https://portal.test',
      apiVersion: 2,
      instance: { uuid: 'u-1', url: 'https://app.test', env: 'staging' },
      domains: [domain()]
    });

    expect(envelope.schema).toEqual(SCHEMA);
    expect(envelope.portal_url).toEqual('https://portal.test');
    expect(envelope.api_version).toEqual(2);
    expect(envelope.instance.uuid).toEqual('u-1');
    expect(envelope.domains).toHaveLength(1);
    expect(Date.parse(envelope.exported_at)).not.toBeNaN();
  });

  test('stripBulkyDetails removes the legacy Terraform state blob and oversized values', () => {
    const bulky = domain({
      details: {
        state: { huge: 'terraform' },
        dns_zone_name_servers: ['a.ns'],
        oversized: 'x'.repeat(200 * 1024)
      }
    });

    const stripped = stripBulkyDetails(bulky);
    expect(stripped.details.state).toBeUndefined();
    expect(stripped.details.dns_zone_name_servers).toEqual(['a.ns']);
    expect(stripped.details.oversized).toMatch(/^\[stripped:/);
    expect(bulky.details.state).toBeDefined();
  });

  test('buildEnvelope with raw keeps details.state', () => {
    const envelope = buildEnvelope({
      portalUrl: 'p',
      apiVersion: 2,
      instance: { uuid: 'u' },
      domains: [domain({ details: { state: { keep: true } } })],
      raw: true
    });
    expect(envelope.domains[0].details.state).toEqual({ keep: true });
  });

  test('validateEnvelope accepts a valid envelope and rejects unknown majors', () => {
    const valid = buildEnvelope({ portalUrl: 'p', apiVersion: 2, instance: { uuid: 'u' }, domains: [] });
    expect(validateEnvelope(valid)).toBe(valid);

    expect(() => validateEnvelope({ ...valid, schema: 'pos-cli/dns-export/v2' }))
      .toThrow('Unsupported export schema');
    expect(() => validateEnvelope({ foo: 'bar' })).toThrow('Not a dns export file');
    expect(() => validateEnvelope({ ...valid, instance: {} })).toThrow('instance.uuid');
    expect(() => validateEnvelope({ ...valid, domains: undefined })).toThrow('domains array');
  });

  test('isStrippedDetail recognizes only the stripped-marker shape (TASK-1.16)', () => {
    expect(isStrippedDetail('[stripped: oversized exceeded 102400 bytes]')).toBe(true);
    expect(isStrippedDetail([])).toBe(false);
    expect(isStrippedDetail(null)).toBe(false);
    expect(isStrippedDetail('a normal string')).toBe(false);
  });

  test('domainName prefers v2 attribute and falls back to config._domains', () => {
    expect(domainName(domain())).toEqual('example.com');

    const v1 = domain();
    delete v1.attributes.domain_name;
    expect(domainName(v1)).toEqual('example.com');

    expect(domainName({ attributes: { config: { _domains: [{ name: null }] } } })).toBeNull();
    expect(domainName({})).toBeNull();
  });
});
