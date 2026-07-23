/**
 * Unit tests for lib/dns/cliHelpers.js
 * Shared bin-level helpers: backup paths, domain filtering, exit-code contract.
 */
import { describe, test, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { backupPathFor, filterByDomains, exitCodeFor, exitCodeForOutcomes, hostnameOf } from '#lib/dns/cliHelpers.js';

const UUID = 'aaaa-bbbb';

describe('backupPathFor', () => {
  test('bulk mode: --backup <dir> is treated as a directory even when it does not exist yet (TASK-1.10)', () => {
    const dir = path.join(os.tmpdir(), `dns-backup-test-${process.pid}`, 'not-yet-created');
    expect(fs.existsSync(dir)).toBe(false);

    const first = backupPathFor(dir, 'uuid-1', { bulk: true });
    const second = backupPathFor(dir, 'uuid-2', { bulk: true });

    expect(first).toEqual(path.join(dir, 'uuid-1.json'));
    expect(second).toEqual(path.join(dir, 'uuid-2.json'));
    expect(first).not.toEqual(second);
  });

  test('single mode: default filename, explicit file path, existing directory unchanged', () => {
    expect(backupPathFor(undefined, UUID)).toMatch(new RegExp(`^dns-export-${UUID}-.*\\.json$`));
    expect(backupPathFor(true, UUID)).toMatch(new RegExp(`^dns-export-${UUID}-.*\\.json$`)); // commander default

    expect(backupPathFor('my-backup.json', UUID)).toEqual('my-backup.json');

    const existingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dns-backup-dir-'));
    expect(backupPathFor(existingDir, UUID)).toEqual(path.join(existingDir, `${UUID}.json`));
  });
});

describe('filterByDomains', () => {
  const plans = [{ domainName: 'A.com' }, { domainName: 'b.com' }];

  test('case-insensitive filter; empty filter keeps all', () => {
    expect(filterByDomains(plans, ['a.com'])).toEqual([{ domainName: 'A.com' }]);
    expect(filterByDomains(plans, [])).toEqual(plans);
  });
});

describe('exit-code contract (TASK-1.13): 0 ok, 1 apply/errors, 2 transform errors, 3 blocked-only', () => {
  const result = (status) => ({ domainName: 'x', status });

  test('exitCodeFor ranks apply failures over blocked', () => {
    expect(exitCodeFor([result('applied')])).toEqual(0);
    expect(exitCodeFor([result('applied'), result('skipped')])).toEqual(0);
    expect(exitCodeFor([result('blocked-destructive')])).toEqual(3);
    expect(exitCodeFor([result('error'), result('blocked-destructive')])).toEqual(1);
    expect(exitCodeFor([result('invalid')])).toEqual(1);
    expect(exitCodeFor([result('apply-failed')])).toEqual(1);
  });

  test('exitCodeForOutcomes: same condition yields the same code in bulk as in single mode', () => {
    const outcome = (results, hasErrors = false) => ({ results: results.map(result), hasErrors });

    expect(exitCodeForOutcomes([outcome(['applied'])])).toEqual(0);
    // transform errors -> 2 (bulk previously collapsed this to 1)
    expect(exitCodeForOutcomes([outcome([], true), outcome(['applied'])])).toEqual(2);
    // apply errors outrank transform errors
    expect(exitCodeForOutcomes([outcome(['error']), outcome([], true)])).toEqual(1);
    // blocked-only -> 3
    expect(exitCodeForOutcomes([outcome(['blocked-destructive']), outcome(['applied'])])).toEqual(3);
  });
});

describe('hostnameOf', () => {
  test('extracts the hostname and reports scheme-less urls actionably (TASK-1.14)', () => {
    expect(hostnameOf('https://portal.example.com/', 'portal url')).toEqual('portal.example.com');
    expect(() => hostnameOf('portal.example.com', 'portal url'))
      .toThrow(/portal url.*include the scheme.*https:\/\//s);
  });
});
