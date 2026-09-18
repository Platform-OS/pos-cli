/**
 * The six status tools job-status replaces. They stay for 6.x, on the same adapters, so what they
 * report cannot drift from what job-status reports — and the argument that let a caller point them
 * at any host is gone.
 */
import { describe, test, expect, vi } from 'vitest';
import { selectTools } from '../tool-selection.js';
import deployStatus from '../deploy/status.js';
import deployWait from '../deploy/wait.js';
import dataImportStatus from '../data/import-status.js';
import dataExportStatus from '../data/export-status.js';
import dataCleanStatus from '../data/clean-status.js';
import testsRunAsyncResult from '../tests/run-async-result.js';

// Where a request goes — and that none of these takes an `endpoint` argument any more — is
// pinned by request-target.test.js, which checks every registered tool rather than these six.
const AUTH = { url: 'https://staging.example.com', email: 'a@b.c', token: 'staging-token' };

const DEPRECATED = [
  ['deploy-status', deployStatus],
  ['deploy-wait', deployWait],
  ['data-import-status', dataImportStatus],
  ['data-export-status', dataExportStatus],
  ['data-clean-status', dataCleanStatus],
  ['tests-run-async-result', testsRunAsyncResult]
];

describe('the deprecation is visible to a client', () => {
  // What a client receives, not what the module says: `tools.config.json` overrides the
  // description, and the selection decides whether the tool is there at all.
  const exposed = selectTools({ env: {} }).tools;

  test.each(DEPRECATED)('%s says so in the description a client receives', (name) => {
    expect(exposed.get(name)?.description).toMatch(/^Deprecated: use job-status/);
  });

  test('they are all still exposed, because removing them would break callers mid-6.x', () => {
    for (const [name] of DEPRECATED) expect(exposed.has(name), name).toBe(true);
  });
});

describe('deploy-wait no longer returns in the middle of a deploy', () => {
  // `in_progress` is a running status too: polling only on `ready_for_import` reports ok:true
  // mid-deploy.
  test('a deploy that goes ready_for_import → in_progress → success is waited out', async () => {
    const seq = ['ready_for_import', 'in_progress', 'in_progress', 'success'];
    const getStatus = vi.fn(async () => ({ status: seq[Math.min(getStatus.mock.calls.length, seq.length) - 1] }));
    class Gateway { getStatus = getStatus; }

    const result = await deployWait.handler({ ...AUTH, id: '1', intervalMs: 200 }, { Gateway });

    expect(getStatus).toHaveBeenCalledTimes(4);
    expect(result).toMatchObject({ ok: true, data: { status: 'success' } });
  }, 15000);

  test('a failed deploy still reports the file the instance blamed', async () => {
    class Gateway {
      async getStatus() { return { status: 'error', error: { error: 'unknown filter', details: { file_path: 'app/views/a.liquid' } } }; }
    }

    const result = await deployWait.handler({ ...AUTH, id: '1' }, { Gateway });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: 'DEPLOY_ERROR', message: 'unknown filter\napp/views/a.liquid' });
  });

  test('maxWaitMs still bounds the wait', async () => {
    class Gateway { async getStatus() { return { status: 'in_progress' }; } }

    const result = await deployWait.handler({ ...AUTH, id: '1', intervalMs: 200, maxWaitMs: 1000 }, { Gateway });

    expect(result.error.code).toBe('TIMEOUT');
  }, 15000);
});

describe('they answer from the same adapters as job-status', () => {
  test.each([
    ['data-import-status', dataImportStatus, 'dataImportStatus'],
    ['data-export-status', dataExportStatus, 'dataExportStatus'],
    ['data-clean-status', dataCleanStatus, 'dataCleanStatus']
  ])('%s: a status nobody has seen before is still pending, not silently neither', async (_name, tool, method) => {
    const Gateway = class { [method] = async () => ({ status: 'quarantined' }); };

    const result = await tool.handler({ ...AUTH, jobId: '5' }, { Gateway });

    expect(result.data).toMatchObject({ status: 'quarantined', done: false, failed: false, pending: true });
  });

  test.each([
    ['data-import-status', dataImportStatus, 'dataImportStatus'],
    ['data-export-status', dataExportStatus, 'dataExportStatus'],
    ['data-clean-status', dataCleanStatus, 'dataCleanStatus']
  ])('%s: a job the instance does not have is NOT_FOUND', async (_name, tool, method) => {
    const Gateway = class { [method] = async () => { throw Object.assign(new Error('Not Found'), { statusCode: 404 }); }; };

    const result = await tool.handler({ ...AUTH, jobId: '5' }, { Gateway });

    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  test('tests-run-async-result keeps its own output shape', async () => {
    const request = async () => ({ statusCode: 200, body: JSON.stringify({ id: 9, status: 'failed', total_assertions: '5', total_errors: '2' }) });

    const result = await testsRunAsyncResult.handler({ ...AUTH, id: '9' }, { request });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ id: 9, status: 'failed', total_assertions: 5, total_errors: 2, pending: false, passed: false, done: true });
  });
});
