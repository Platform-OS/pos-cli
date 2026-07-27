/**
 * Unit tests for lib/dns/cliHelpers.js
 * Shared bin-level helpers: backup paths, domain filtering, exit-code contract.
 */
import { describe, test, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn(), Log: vi.fn() }
}));

import {
  backupPathFor,
  resolveBulkBackupDir,
  summarizeBulkOutcome,
  filterByDomains,
  filterOutcomeByDomain,
  exitCodeFor,
  exitCodeForOutcomes,
  describeApplyTarget,
  hostnameOf,
  reportError
} from '#lib/dns/cliHelpers.js';

const UUID = 'aaaa-bbbb';

describe('backupPathFor', () => {
  test('default filename, explicit file path, existing directory', () => {
    expect(backupPathFor(undefined, UUID)).toMatch(new RegExp(`^dns-export-${UUID}-.*\\.json$`));
    expect(backupPathFor(true, UUID)).toMatch(new RegExp(`^dns-export-${UUID}-.*\\.json$`)); // commander default

    expect(backupPathFor('my-backup.json', UUID)).toEqual('my-backup.json');

    const existingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dns-backup-dir-'));
    expect(backupPathFor(existingDir, UUID)).toEqual(path.join(existingDir, `${UUID}.json`));
  });
});

describe('resolveBulkBackupDir (TASK-1.18): resolved once, shared by every pair in the cohort', () => {
  test('no --backup / --backup with no value: resolves once, so every pair shares the same directory', () => {
    const dir = resolveBulkBackupDir(undefined);
    expect(dir).toMatch(/^dns-backups-/);

    // Passing the ALREADY-RESOLVED dir to backupPathFor (as the bin file now does per pair)
    // must land every pair in the same directory, unlike calling backupPathFor directly per
    // pair with a falsy backup (which mints a fresh timestamp each time).
    const first = backupPathFor(dir, 'uuid-1', { bulk: true });
    const second = backupPathFor(dir, 'uuid-2', { bulk: true });
    expect(path.dirname(first)).toEqual(path.dirname(second));
    expect(path.dirname(first)).toEqual(dir);
  });

  test('--no-backup (false) is passed through unchanged', () => {
    expect(resolveBulkBackupDir(false)).toBe(false);
  });

  test('an explicit --backup <dir> is passed through unchanged', () => {
    expect(resolveBulkBackupDir('my-cohort-backups')).toEqual('my-cohort-backups');
  });
});

describe('summarizeBulkOutcome (TASK-1.19): apply-failed counts as a failure', () => {
  const outcome = (statuses, hasErrors = false) => ({
    plans: statuses.map(() => ({ skipped: false })),
    results: statuses.map(status => ({ domainName: 'x', status })),
    hasErrors
  });

  test('apply-failed is counted in errors, not silently dropped', () => {
    expect(summarizeBulkOutcome(outcome(['applied', 'apply-failed']))).toEqual({
      domains: 2, applied: 1, blocked: 0, errors: 1
    });
  });

  test('applied/blocked/errors/hasErrors are counted independently', () => {
    expect(summarizeBulkOutcome(outcome(['applied', 'blocked-destructive', 'error', 'invalid']))).toEqual({
      domains: 4, applied: 1, blocked: 1, errors: 2
    });
    expect(summarizeBulkOutcome(outcome([], true))).toEqual({ domains: 0, applied: 0, blocked: 0, errors: 1 });
  });

  test('a synthetic bulk failure (one error result, hasErrors false) counts as ONE error, not two', () => {
    // The migrate bin pushes { results: [{status:'error'}], hasErrors: false } for a
    // failed pair — hasErrors flags transform errors only, or the failure counts twice.
    expect(summarizeBulkOutcome(outcome(['error']))).toEqual({ domains: 1, applied: 0, blocked: 0, errors: 1 });
  });
});

describe('filterByDomains', () => {
  const plans = [{ domainName: 'A.com' }, { domainName: 'b.com' }];

  test('case-insensitive filter; empty filter keeps all', () => {
    expect(filterByDomains(plans, ['a.com'])).toEqual([{ domainName: 'A.com' }]);
    expect(filterByDomains(plans, [])).toEqual(plans);
  });
});

describe('filterOutcomeByDomain (TASK-1.17)', () => {
  const outcome = {
    results: [
      { domainName: 'A.com', level: 'OK' },
      { domainName: 'b.com', level: 'CRITICAL' }
    ],
    totals: { ok: 1, advisory: 0, critical: 1, missingBefore: 0, missingAfter: 0 }
  };

  test('empty filter returns the outcome unchanged', () => {
    expect(filterOutcomeByDomain(outcome, [])).toBe(outcome);
    expect(filterOutcomeByDomain(outcome, undefined)).toBe(outcome);
  });

  test('filters results case-insensitively and recomputes totals', () => {
    const filtered = filterOutcomeByDomain(outcome, ['a.com']);
    expect(filtered.results).toEqual([{ domainName: 'A.com', level: 'OK' }]);
    expect(filtered.totals).toEqual({ ok: 1, advisory: 0, critical: 0, missingBefore: 0, missingAfter: 0 });
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

  test('exitCodeForOutcomes: folds transform errors into the contract, worst code wins', () => {
    const outcome = (results, hasErrors = false) => ({ results: results.map(result), hasErrors });

    expect(exitCodeForOutcomes([outcome(['applied'])])).toEqual(0);
    expect(exitCodeForOutcomes([outcome([], true), outcome(['applied'])])).toEqual(2);
    // apply errors outrank transform errors
    expect(exitCodeForOutcomes([outcome(['error']), outcome([], true)])).toEqual(1);
    expect(exitCodeForOutcomes([outcome(['blocked-destructive']), outcome(['applied'])])).toEqual(3);
  });
});

describe('describeApplyTarget: the confirm-prompt target must identify the instance, not just the portal', () => {
  test('prefers the actual instance/site URL over the shared portal URL', () => {
    expect(describeApplyTarget({
      instanceUrl: 'https://dev.example.com',
      instanceUuid: 'uuid-1',
      portalUrl: 'https://portal.ps-01-platformos.com'
    })).toEqual('https://dev.example.com (https://portal.ps-01-platformos.com)');
  });

  test('falls back to the instance uuid when no instance url is known (e.g. explicit --instance-uuid with no registered environment)', () => {
    expect(describeApplyTarget({
      instanceUrl: undefined,
      instanceUuid: 'uuid-1',
      portalUrl: 'https://portal.ps-01-platformos.com'
    })).toEqual('instance uuid-1 (https://portal.ps-01-platformos.com)');
  });
});

describe('hostnameOf', () => {
  test('extracts the hostname and reports scheme-less urls actionably (TASK-1.14)', () => {
    expect(hostnameOf('https://portal.example.com/', 'portal url')).toEqual('portal.example.com');
    expect(() => hostnameOf('portal.example.com', 'portal url'))
      .toThrow(/portal url.*include the scheme.*https:\/\//s);
  });
});

describe('reportError: any failure reaching the shared handler exits non-zero (never 0)', () => {
  const expectExit1 = async (error) => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('__exit__'); });
    try {
      await expect(reportError(error)).rejects.toThrow('__exit__');
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      exit.mockRestore();
    }
  };

  test('a network error whose code ServerError does not recognize (logs with exit:false) still exits 1', async () => {
    await expectExit1(Object.assign(new Error('fetch failed'), { name: 'RequestError', cause: { code: 'EAI_AGAIN' } }));
  });

  test('a 422 whose body lacks error/errors keys (ServerError prints nothing) still exits 1', async () => {
    await expectExit1(Object.assign(new Error('422 Unprocessable Entity'), {
      name: 'StatusCodeError',
      statusCode: 422,
      response: { body: 'plain text, not the expected JSON shape' },
      options: { uri: 'https://portal.test/api/domains' }
    }));
  });

  test('a typed portal/transform error exits 1', async () => {
    await expectExit1(new Error('boom'));
  });
});
