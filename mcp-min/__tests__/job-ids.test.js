/**
 * Every starter hands back a job_id, and what each one carries is what its kind needs to be polled
 * later — by a different process, against the right instance.
 */
import { describe, test, expect, vi } from 'vitest';
import dataImport from '../data/import.js';
import dataExport from '../data/export.js';
import dataClean from '../data/clean.js';
import testsRunAsync from '../tests/run-async.js';
import jobStatus from '../jobs/status.js';
import { parse } from '../jobs/handle.js';

const ORIGIN = 'https://staging.example.com';
const AUTH = { url: `${ORIGIN}/`, email: 'a@b.c', token: 'staging-token' };

const gatewayReturning = methods => class {
  constructor() { Object.assign(this, methods); }
};

describe('data-import', () => {
  test('returns a job_id for the import it started', async () => {
    const Gateway = gatewayReturning({ dataImportStart: async () => ({ id: 'imp-1', status: 'pending' }) });

    const result = await dataImport.handler({ ...AUTH, zipFileUrl: 'https://cdn.example.com/d.zip' }, { Gateway });

    expect(result.ok).toBe(true);
    expect(parse(result.data.job_id)).toEqual({ valid: true, job: { kind: 'data-import', id: 'imp-1', origin: ORIGIN, flags: {} } });
  });
});

describe('data-export', () => {
  test.each([
    ['a ZIP export', true],
    ['a JSON export', false]
  ])('%s carries its zip flag, because reading the status needs it', async (_label, zip) => {
    const Gateway = gatewayReturning({ dataExportStart: async () => ({ id: 'exp-1', status: 'pending' }) });

    const result = await dataExport.handler({ ...AUTH, zip }, { Gateway });

    expect(parse(result.data.job_id).job).toEqual({ kind: 'data-export', id: 'exp-1', origin: ORIGIN, flags: { zip } });
  });
});

describe('data-clean', () => {
  test('returns a job_id for the clean it started', async () => {
    const Gateway = gatewayReturning({ dataClean: async () => ({ id: 'cln-1', status: 'pending' }) });

    const result = await dataClean.handler({ ...AUTH, confirmation: 'CLEAN DATA' }, { Gateway });

    expect(result.ok, JSON.stringify(result.error)).toBe(true);
    expect(parse(result.data.job_id).job).toEqual({ kind: 'data-clean', id: 'cln-1', origin: ORIGIN, flags: {} });
  });
});

describe('tests-run-async', () => {
  test('returns a job_id for the run it triggered', async () => {
    const request = async () => ({ statusCode: 200, body: JSON.stringify({ id: 'run-1', status: 'pending' }) });

    const result = await testsRunAsync.handler(AUTH, { request });

    expect(parse(result.data.job_id).job).toEqual({ kind: 'test-run', id: 'run-1', origin: ORIGIN, flags: {} });
  });
});

describe('a job_id a starter could not mint', () => {
  // The job has already started by then; reporting the start as failed because the handle could
  // not be built would be the worse answer.
  test('is simply absent, and the rest of the answer stands', async () => {
    const Gateway = gatewayReturning({ dataImportStart: async () => ({ id: 'no spaces allowed', status: 'pending' }) });

    const result = await dataImport.handler({ ...AUTH, zipFileUrl: 'https://cdn.example.com/d.zip' }, { Gateway });

    expect(result.ok).toBe(true);
    expect(result.data.id).toBe('no spaces allowed');
    expect(result.data.job_id).toBeUndefined();
  });
});

describe('the handle a starter mints is the one job-status reads', () => {
  test('round-trip: start an export, poll it, get the export back', async () => {
    const Gateway = gatewayReturning({
      dataExportStart: async () => ({ id: 'exp-9', status: 'pending' }),
      dataExportStatus: vi.fn(async () => ({ status: 'done', zip_file_url: 'https://cdn.example.com/e.zip' }))
    });

    const started = await dataExport.handler({ ...AUTH, zip: true }, { Gateway });
    const status = await jobStatus.handler({ job_id: started.data.job_id, ...AUTH }, { Gateway });

    expect(status.data).toMatchObject({ kind: 'data-export', state: 'completed', done: true, status: 'done' });
    expect(status.data.result).toEqual({ zip: true, zipFileUrl: 'https://cdn.example.com/e.zip' });
  });
});
