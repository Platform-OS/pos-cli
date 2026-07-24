/**
 * Unit tests for lib/dns/normalize.js
 * Record-noise normalizers shared by transform and compare:
 * TXT quoting/chunking, MX/SRV/host trailing dots and case, name canonicalization.
 */
import { describe, test, expect } from 'vitest';

import {
  normalizeTxtValue,
  normalizeRecordValue,
  normalizeName,
  sortedRecordValues
} from '#lib/dns/normalize.js';

describe('normalizeTxtValue', () => {
  test('strips surrounding quotes (Cloudflare LIST returns quoted)', () => {
    expect(normalizeTxtValue('"v=spf1 include:x.com -all"')).toEqual('v=spf1 include:x.com -all');
  });

  test('joins 255-byte quoted chunks', () => {
    expect(normalizeTxtValue('"part-one" "part-two"')).toEqual('part-onepart-two');
  });

  test('leaves unquoted values untouched', () => {
    expect(normalizeTxtValue('google-site-verification=abc')).toEqual('google-site-verification=abc');
  });

  test('preserves inner quotes of a single-quoted value', () => {
    expect(normalizeTxtValue('"he said \\"hi\\""')).toEqual('he said \\"hi\\"');
  });
});

describe('normalizeRecordValue', () => {
  test('MX: lowercases host, collapses whitespace, strips trailing dot (new stack rejects it)', () => {
    expect(normalizeRecordValue('MX', '10  ASPMX.L.GOOGLE.COM.')).toEqual('10 aspmx.l.google.com');
  });

  test('SRV: normalizes all four parts and strips target trailing dot', () => {
    expect(normalizeRecordValue('SRV', '100 1 443 SIPDIR.online.lync.com.')).toEqual('100 1 443 sipdir.online.lync.com');
  });

  test('CNAME/ALIAS/NS/PTR: lowercases and strips trailing dot', () => {
    expect(normalizeRecordValue('CNAME', 'Autodiscover.Outlook.com.')).toEqual('autodiscover.outlook.com');
    expect(normalizeRecordValue('NS', 'ns1.example.com.')).toEqual('ns1.example.com');
  });

  test('TXT: quote handling, case preserved', () => {
    expect(normalizeRecordValue('TXT', '"CaseSensitive=Value"')).toEqual('CaseSensitive=Value');
  });

  test('A: passthrough', () => {
    expect(normalizeRecordValue('A', '203.0.113.10')).toEqual('203.0.113.10');
  });
});

describe('normalizeName', () => {
  test('apex forms canonicalize to empty string', () => {
    expect(normalizeName('', 'example.com')).toEqual('');
    expect(normalizeName('@', 'example.com')).toEqual('');
    expect(normalizeName('example.com', 'example.com')).toEqual('');
  });

  test('FQDN collapses to the short form', () => {
    expect(normalizeName('www.example.com', 'example.com')).toEqual('www');
    expect(normalizeName('_sip._tls.example.com.', 'example.com')).toEqual('_sip._tls');
  });

  test('short names are lowercased and kept', () => {
    expect(normalizeName('WWW', 'example.com')).toEqual('www');
    expect(normalizeName('_domainkey.mail', 'example.com')).toEqual('_domainkey.mail');
  });

  test('mixed-case domainName still strips the suffix and matches apex (TASK-1.20)', () => {
    expect(normalizeName('www.example.com', 'Example.com')).toEqual('www');
    expect(normalizeName('Example.com', 'Example.com')).toEqual('');
    expect(normalizeName('WWW.EXAMPLE.COM', 'EXAMPLE.COM')).toEqual('www');
  });
});

describe('sortedRecordValues', () => {
  test('returns a sorted copy for order-insensitive comparison', () => {
    const values = ['b', 'a', 'c'];
    expect(sortedRecordValues(values)).toEqual(['a', 'b', 'c']);
    expect(values).toEqual(['b', 'a', 'c']);
  });
});
