/**
 * Unit tests for lib/dns/cutover.js
 * Per-domain post-import cutover instruction rendering.
 */
import { describe, test, expect } from 'vitest';

import { cutoverInstructions } from '#lib/dns/cutover.js';

const fullDomain = {
  status: 'initializing',
  attributes: { domain_name: 'example.com', setup_type: 'domain-full', config: {} },
  details: { dns_zone_name_servers: ['curt.ns.cloudflare.com', 'mina.ns.cloudflare.com'] }
};

const externalDomain = {
  status: 'ownership_verification_pending',
  attributes: { domain_name: 'shop.example.org', setup_type: 'domain-external', config: {} },
  details: {
    dns_verification_records: [
      {
        resource_record_name: '_acme-challenge.shop.example.org',
        resource_record_type: 'CNAME',
        resource_record_value: 'shop.example.org.313e8bf2329b2f4a.dcv.cloudflare.com'
      }
    ],
    private_lb_cname: 'fallback.uk-siteglide.com',
    lb_public_ip: '132.145.42.224'
  }
};

describe('cutoverInstructions', () => {
  test('domain-full: registrar nameserver repoint with the target zone NS', () => {
    const output = cutoverInstructions(fullDomain);
    expect(output).toContain('CUTOVER example.com');
    expect(output).toContain('registrar');
    expect(output).toContain('curt.ns.cloudflare.com');
    expect(output).toContain('mina.ns.cloudflare.com');
  });

  test('domain-external: verification records + CNAME/A targets', () => {
    const output = cutoverInstructions(externalDomain);
    expect(output).toContain('CUTOVER shop.example.org');
    expect(output).toContain('_acme-challenge.shop.example.org');
    expect(output).toContain('dcv.cloudflare.com');
    expect(output).toContain('CNAME -> fallback.uk-siteglide.com');
    expect(output).toContain('A     -> 132.145.42.224');
    expect(output).toContain('waiting for the DNS changes below');
  });

  test('ssl_validation_pending substatus explains ownership is already verified', () => {
    const output = cutoverInstructions({ ...externalDomain, substatus: 'ssl_validation_pending' });
    expect(output).toContain('ownership verified');
  });

  test('ready domain needs nothing', () => {
    const output = cutoverInstructions({ ...fullDomain, status: 'ready' });
    expect(output).toContain('Nothing left to do');
  });
});
