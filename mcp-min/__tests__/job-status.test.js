/**
 * `job-status`: one tool for every async operation, and the four defects it exists to fix.
 *
 *   1. a deploy still importing is not reported as finished
 *   2. a job_id says which instance it belongs to, so polling cannot land on another one
 *   3. no argument can point the request (and the token) at a host of the caller's choosing
 *   4. a deploy whose assets are still uploading is still running
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import jobStatus from '../jobs/status.js';
import { runTool } from '../run-tool.js';
import { rejectionFor } from '../validate-params.js';
import { mint } from '../jobs/handle.js';
import { forgetUploads, trackUpload } from '../jobs/local-phases.js';
import { cancelled } from '../cancellation.js';

const ORIGIN = 'https://staging.example.com';
const OTHER = 'https://prod.example.com';

const CONFIG = {
  staging: { url: `${ORIGIN}/api-root/`, email: 'a@b.c', token: 'staging-token' },
  prod: { url: OTHER, email: 'a@b.c', token: 'prod-token' }
};

const handle = (kind, id = '41', flags) => mint({ kind, id, origin: ORIGIN, flags });

/** ctx with the whole world stubbed: no .pos on disk, no network, no MPKIT_* leaking in. */
function context({ config = CONFIG, getStatus, dataImportStatus, dataExportStatus, dataCleanStatus, request, getInstance, pollIntervalMs = 5 } = {}) {
  const calls = { gateway: [], request: [] };
  const record = (name, fn) => async (...args) => {
    calls.gateway.push({ name, args });
    return fn?.(...args);
  };
  class Gateway {
    constructor(options) { calls.gateway.push({ name: 'new', args: [options] }); }
    getStatus = record('getStatus', getStatus);
    dataImportStatus = record('dataImportStatus', dataImportStatus);
    dataExportStatus = record('dataExportStatus', dataExportStatus);
    dataCleanStatus = record('dataCleanStatus', dataCleanStatus);
    // The health probe behind `absentOrUnwell`. It defaults to an instance that is not answering,
    // which is the conservative half: a test has to say the instance is well before a 5xx here can
    // be read as a job that does not exist.
    getInstance = record('getInstance', getInstance ?? (() => {
      throw new Error('this test did not say whether the instance answers for itself');
    }));
  }
  return {
    calls,
    ctx: {
      // Milliseconds, not seconds: these tests are about what the loop decides, not how long it
      // sleeps between decisions.
      pollIntervalMs,
      Gateway,
      files: { getConfig: () => config },
      settings: { settingsFromDotPos: name => config[name] },
      request: async (options) => {
        calls.request.push(options);
        return request ? request(options) : { statusCode: 200, body: '{}' };
      }
    }
  };
}

beforeEach(() => {
  // resolveAuth reads MPKIT_* before falling back to .pos; a developer's own .env must not decide
  // what these tests resolve to.
  vi.stubEnv('MPKIT_URL', undefined);
  vi.stubEnv('MPKIT_EMAIL', undefined);
  vi.stubEnv('MPKIT_TOKEN', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  forgetUploads();
});

/**
 * A field an agent is never told to read is a field it does not read. `warnings` can be set on a
 * job that completed, which is the one combination that looks like nothing to check.
 */
describe('the description points at the field that qualifies a success', () => {
  test('it says to read warnings even on a completed job', () => {
    expect(jobStatus.description).toMatch(/warnings/);
    expect(jobStatus.description).toMatch(/completed/);
  });
});

describe('a job_id that cannot be trusted', () => {
  test.each([
    ['is missing', undefined],
    ['is not one of ours', 'deploy-41'],
    ['is ours but forged', 'pjob1_' + Buffer.from(JSON.stringify({ kind: 'deploy', id: '1; rm -rf /', origin: ORIGIN })).toString('base64url')]
  ])('%s: INVALID_JOB_ID, and no request is made', async (_label, jobId) => {
    const { ctx, calls } = context();

    const result = await runTool(jobStatus, { job_id: jobId }, ctx);

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_JOB_ID');
    expect(calls.gateway).toEqual([]);
    expect(calls.request).toEqual([]);
  });
});

describe('which instance is asked', () => {
  test('a handle for an instance with no .pos entry is refused without a request', async () => {
    const { ctx, calls } = context();

    const result = await runTool(jobStatus, { job_id: mint({ kind: 'deploy', id: '41', origin: 'https://evil.example.com' }) }, ctx);

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('JOB_INSTANCE_MISMATCH');
    expect(result.error.message).toContain('https://evil.example.com');
    expect(calls.gateway).toEqual([]);
  });

  test('an env naming a different instance is refused: the caller sees their own mistake', async () => {
    const { ctx, calls } = context();

    const result = await runTool(jobStatus, { job_id: handle('deploy'), env: 'prod' }, ctx);

    expect(result.error.code).toBe('JOB_INSTANCE_MISMATCH');
    expect(result.error.message).toContain(ORIGIN);
    expect(result.error.message).toContain(OTHER);
    expect(calls.gateway).toEqual([]);
  });

  // `env` is optional everywhere, so an omitted one would otherwise resolve to the first .pos
  // entry and ask *it* about a numeric id belonging to another instance.
  test('with no env, the environment that points at the job\'s instance is used, not the first one', async () => {
    const config = { prod: CONFIG.prod, staging: CONFIG.staging };
    const { ctx, calls } = context({ config, getStatus: async () => ({ status: 'success' }) });

    const result = await runTool(jobStatus, { job_id: handle('deploy', '41', { assets: false }) }, ctx);

    expect(result.ok).toBe(true);
    expect(result.meta.auth).toMatchObject({ url: `${ORIGIN}/api-root/`, source: '.pos(staging)' });
    expect(calls.gateway[0]).toEqual({ name: 'new', args: [{ url: `${ORIGIN}/api-root/`, email: 'a@b.c', token: 'staging-token' }] });
  });

  test('with no credentials at all, the answer still says which instance the job needs', async () => {
    const { ctx, calls } = context({ config: {} });

    const result = await runTool(jobStatus, { job_id: handle('deploy') }, ctx);

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('AUTH_MISSING');
    expect(result.error.message).toContain(ORIGIN);
    expect(calls.gateway).toEqual([]);
  });

  test('two environments pointing at the same instance are not guessed between', async () => {
    const config = { prod: CONFIG.prod, staging: CONFIG.staging, 'staging-copy': { ...CONFIG.staging } };
    const { ctx, calls } = context({ config });

    const result = await runTool(jobStatus, { job_id: handle('deploy') }, ctx);

    expect(result.error.code).toBe('JOB_INSTANCE_MISMATCH');
    expect(result.error.message).toContain('staging and staging-copy');
    expect(calls.gateway).toEqual([]);
  });

  // Nothing in a handle may choose where a request goes: the URL comes from the credentials.
  test('the request goes to the resolved credentials\' URL, never to the handle\'s origin', async () => {
    const { ctx, calls } = context({ getStatus: async () => ({ status: 'success' }) });

    await runTool(jobStatus, {
      job_id: handle('deploy', '41', { assets: false }),
      url: `${ORIGIN}/api-root/`, email: 'someone@example.com', token: 'explicit'
    }, ctx);

    expect(calls.gateway[0].args[0]).toEqual({ url: `${ORIGIN}/api-root/`, email: 'someone@example.com', token: 'explicit' });
  });

  test('the schema has no endpoint argument to point it elsewhere', () => {
    expect(Object.keys(jobStatus.inputSchema.properties)).not.toContain('endpoint');
    expect(jobStatus.inputSchema.additionalProperties).toBe(false);
  });
});

describe('deploy', () => {
  const deploy = (getStatus, flags = { assets: false }) => runTool(jobStatus, 
    { job_id: handle('deploy', '41', flags), env: 'staging' },
    context({ getStatus }).ctx
  );

  test.each([
    ['ready_for_import', 'running', false],
    ['in_progress', 'running', false],
    ['success', 'completed', true],
    ['error', 'failed', true]
  ])('a release reading %s is %s', async (status, state, done) => {
    const result = await deploy(async () => ({ status, ...(status === 'error' && { error: { error: 'bad liquid' } }) }));

    expect(result.data).toMatchObject({ kind: 'deploy', state, done, status });
  });

  test('a failed release reports the file the instance blamed, and its warnings', async () => {
    const result = await deploy(async () => ({
      status: 'error',
      error: { error: 'unknown filter', details: { file_path: 'app/views/pages/index.liquid' }, warnings: ['modules/x is stale'] }
    }));

    expect(result.data.error).toBe('unknown filter\napp/views/pages/index.liquid');
    expect(result.data.warnings).toEqual(['modules/x is stale']);
  });

  /**
   * The deploy converter drops a file it matches no rule for, and the release still reports
   * `status: 'success'`. Reproduced against a live instance on 2026-09-22 with a file at
   * `app/tests/…`: `ok`, `state`, `status` and `done` all said the deploy landed, and the one field
   * that said otherwise was four levels down, inside the release record nobody reads.
   */
  describe('a file the deploy discarded', () => {
    const discarding = (files) => deploy(async () => ({
      status: 'success',
      warning: { files_not_matched: files }
    }));

    // The assertion is the whole task: reached from `data`, without walking into `result.release`.
    test('is named beside state, not only inside the release record', async () => {
      const result = await discarding(['tests/eval/simple_test.liquid']);

      expect(result.data.warnings).toHaveLength(1);
      expect(result.data.warnings[0]).toContain('tests/eval/simple_test.liquid');
    });

    // `completed` is the truth — the deploy finished — so the warning has to be what carries this,
    // and it has to be legible without a schema in hand.
    test('does not make the job read as an unqualified success', async () => {
      const result = await discarding(['tests/eval/simple_test.liquid']);

      expect(result.data).toMatchObject({ state: 'completed', done: true, status: 'success' });
      expect(result.data.warnings[0]).toMatch(/did not put it on the instance/);
    });

    test('says how many, and names them', async () => {
      const result = await discarding(['a.liquid', 'b.liquid', 'c.liquid']);

      expect(result.data.warnings[0]).toMatch(/^3 files /);
      expect(result.data.warnings[0]).toContain('a.liquid, b.liquid, c.liquid');
    });

    // A misplaced directory drops every file under it, and the whole list would be the result.
    test('a long list is bounded, and says how much it left out', async () => {
      const files = Array.from({ length: 25 }, (_, i) => `f${i}.liquid`);

      const result = await discarding(files);

      expect(result.data.warnings[0]).toContain('f9.liquid, and 15 more');
      expect(result.data.warnings[0]).not.toContain('f10.liquid');
      // Bounded for reading, not for completeness: the record still carries every one.
      expect(result.data.result.release.warning.files_not_matched).toHaveLength(25);
    });

    test('a deploy that discarded nothing carries no warnings at all', async () => {
      const result = await deploy(async () => ({ status: 'success' }));

      expect(result.data).not.toHaveProperty('warnings');
    });

    // The platform will add a second kind of warning before anyone here hears about it.
    test('a warning key this does not recognise is passed through rather than dropped', async () => {
      const result = await deploy(async () => ({ status: 'success', warning: { deprecated_syntax: ['old.liquid'] } }));

      expect(result.data.warnings).toEqual(['deprecated_syntax: old.liquid']);
    });

    // And it may not arrive as an object at all. `Object.entries` over a string yields one entry
    // per character, which would turn a one-line warning into a warning per letter.
    test('a warning that is not an object is reported once, not per character', async () => {
      const result = await deploy(async () => ({ status: 'success', warning: 'deploy ran against a stale cache' }));

      expect(result.data.warnings ?? []).toHaveLength(0);
      expect(JSON.stringify(result.data.warnings ?? [])).not.toContain('"0: ');
    });

    // A failed release can carry both, and one must not hide the other.
    test('a failure keeps its own warnings and gains the discarded files', async () => {
      const result = await deploy(async () => ({
        status: 'error',
        error: { error: 'unknown filter', warnings: ['modules/x is stale'] },
        warning: { files_not_matched: ['tests/a_test.liquid'] }
      }));

      expect(result.data.state).toBe('failed');
      expect(result.data.warnings[0]).toBe('modules/x is stale');
      expect(result.data.warnings[1]).toContain('tests/a_test.liquid');
    });
  });

  test('a release id this instance does not have is JOB_NOT_FOUND, not a failed deploy', async () => {
    const result = await deploy(async () => { throw Object.assign(new Error('Not Found'), { statusCode: 404 }); });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('JOB_NOT_FOUND');
  });
});

describe('a deploy is not done while its assets are still going up', () => {
  const poll = (getStatus, flags = { assets: true }) => runTool(jobStatus, 
    { job_id: handle('deploy', '41', flags), env: 'staging' },
    context({ getStatus }).ctx
  );

  test('the upload this process started is still running, though the release is in', async () => {
    trackUpload(ORIGIN, '41', new Promise(() => {}));

    const result = await poll(async () => ({ status: 'success' }));

    expect(result.data).toMatchObject({ state: 'running', done: false, status: 'success' });
    expect(result.data.result.assets).toEqual({ phase: 'uploading' });
  });

  test('the manifest is in and the instance is unpacking', async () => {
    await trackUpload(ORIGIN, '41', Promise.resolve());

    const result = await poll(async () => ({ status: 'success', asset_status: 'in_progress' }));

    expect(result.data).toMatchObject({ state: 'running', done: false });
    expect(result.data.result.assets).toEqual({ phase: 'processing' });
  });

  test('the instance reported on the assets: done, with the report', async () => {
    await trackUpload(ORIGIN, '41', Promise.resolve());

    const result = await poll(async () => ({ status: 'success', asset_report: { added: ['a.css'] } }));

    expect(result.data).toMatchObject({ state: 'completed', done: true });
    expect(result.data.result.assets).toEqual({ phase: 'done', report: { added: ['a.css'] } });
  });

  test.each([
    ['the upload failed here', async () => Promise.reject(new Error('S3 said no')), { status: 'success' }, 'S3 said no'],
    ['the instance rejected the assets', async () => Promise.resolve(), { status: 'success', asset_error: { error: 'bad zip' } }, 'bad zip']
  ])('%s: the deploy failed', async (_label, upload, response, expected) => {
    await trackUpload(ORIGIN, '41', upload()).catch(() => {});

    const result = await poll(async () => response);

    expect(result.data).toMatchObject({ state: 'failed', done: true });
    expect(result.data.error).toContain(expected);
  });

  // The honest answer after a restart: this process never saw the upload, and the instance says
  // nothing about assets. Reporting it as still running would never end.
  test('a server that did not start the deploy says the asset phase is unknown', async () => {
    const result = await poll(async () => ({ status: 'success' }));

    expect(result.data).toMatchObject({ state: 'completed', done: true });
    expect(result.data.result.assets).toEqual({ phase: 'unknown' });
  });

  test('a deploy that had no assets is done when its release is in', async () => {
    const result = await poll(async () => ({ status: 'success' }), { assets: false });

    expect(result.data).toMatchObject({ state: 'completed', done: true });
    expect(result.data.result.assets).toEqual({ phase: 'none' });
  });
});

describe('data jobs', () => {
  const KINDS = [
    ['data-import', 'dataImportStatus'],
    ['data-export', 'dataExportStatus'],
    ['data-clean', 'dataCleanStatus']
  ];

  test.each(KINDS.flatMap(([kind, method]) => [
    [kind, method, 'pending', 'running'],
    [kind, method, 'processing', 'running'],
    [kind, method, 'scheduled', 'running'],
    [kind, method, 'done', 'completed'],
    [kind, method, 'failed', 'failed']
  ]))('%s reading %s → %s', async (kind, method, status, state) => {
    const { ctx } = context({ [method]: async () => ({ status }) });

    const result = await runTool(jobStatus, { job_id: handle(kind), env: 'staging' }, ctx);

    expect(result.data).toMatchObject({ kind, state, done: state !== 'running', status });
  });

  test.each(KINDS)('%s reads a status given as an object', async (kind, method) => {
    const { ctx } = context({ [method]: async () => ({ status: { name: 'done' } }) });

    const result = await runTool(jobStatus, { job_id: handle(kind), env: 'staging' }, ctx);

    expect(result.data).toMatchObject({ state: 'completed', status: 'done' });
  });

  // A status we do not know is not a finished job: the only safe reading is "not done yet".
  test.each(KINDS)('%s reading a status nobody has seen before stays running, and echoes it', async (kind, method) => {
    const { ctx } = context({ [method]: async () => ({ status: 'quarantined' }) });

    const result = await runTool(jobStatus, { job_id: handle(kind), env: 'staging' }, ctx);

    expect(result.data).toMatchObject({ state: 'running', done: false, status: 'quarantined' });
  });

  test.each(KINDS)('%s: a 404 is JOB_NOT_FOUND', async (kind, method) => {
    const { ctx } = context({ [method]: async () => { throw Object.assign(new Error('Not Found'), { statusCode: 404 }); } });

    const result = await runTool(jobStatus, { job_id: handle(kind), env: 'staging' }, ctx);

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('JOB_NOT_FOUND');
    expect(result.error.message).toContain(kind);
  });

  /**
   * The two readers are exclusive, and the wrong one answers the same 503 an id that does not
   * exist gets — so asking the wrong way reports a finished job as a missing one.
   */
  test('a data-import status is always read the way a ZIP-sourced import can answer', async () => {
    const { ctx, calls } = context({ dataImportStatus: async () => ({ status: 'done' }) });

    await runTool(jobStatus, { job_id: handle('data-import', '9'), env: 'staging' }, ctx);

    expect(calls.gateway.find(c => c.name === 'dataImportStatus').args).toEqual(['9', true]);
  });

  test('a data-export handle carries the zip flag, so the status is read the way the export was made', async () => {
    const zipped = context({ dataExportStatus: async () => ({ status: 'done', zip_file_url: 'https://cdn.example.com/e.zip' }) });
    const plain = context({ dataExportStatus: async () => ({ status: 'done', data: { users: { results: [{ id: 1 }] } } }) });

    const asZip = await runTool(jobStatus, { job_id: handle('data-export', '9', { zip: true }), env: 'staging' }, zipped.ctx);
    const asJson = await runTool(jobStatus, { job_id: handle('data-export', '9'), env: 'staging' }, plain.ctx);

    expect(zipped.calls.gateway.find(c => c.name === 'dataExportStatus').args).toEqual(['9', true]);
    expect(plain.calls.gateway.find(c => c.name === 'dataExportStatus').args).toEqual(['9', false]);
    expect(asZip.data.result).toEqual({ zip: true, zipFileUrl: 'https://cdn.example.com/e.zip' });
    expect(asJson.data.result).toEqual({ zip: false, exportedData: { users: [{ id: 1 }], transactables: [], models: [] } });
  });
});

describe('test runs', () => {
  const run = body => context({ request: async () => ({ statusCode: 200, body: JSON.stringify(body) }) });

  test.each([
    ['pending', 'running', false],
    ['success', 'completed', true],
    ['failed', 'completed', true],
    ['error', 'failed', true]
  ])('a run reading %s → %s', async (status, state, done) => {
    const { ctx } = run({ id: 9, status, total_assertions: '4', total_errors: '1' });

    const result = await runTool(jobStatus, { job_id: handle('test-run', '9'), env: 'staging' }, ctx);

    expect(result.data).toMatchObject({ kind: 'test-run', state, done, status });
  });

  // Assertions that failed are a finished test run, not a failed job: the run did its work.
  test('failing assertions are a completed run, with its counters', async () => {
    const { ctx } = run({ id: 9, status: 'failed', total_assertions: '12', total_errors: '3', tests: [{ name: 'a' }] });

    const result = await runTool(jobStatus, { job_id: handle('test-run', '9'), env: 'staging' }, ctx);

    expect(result.data.state).toBe('completed');
    expect(result.data.result).toMatchObject({ total_assertions: 12, total_errors: 3, passed: false, done: true, tests: [{ name: 'a' }] });
  });

  test('a runner that crashed is a failed job, with its message', async () => {
    const { ctx } = run({ id: 9, status: 'error', error_message: 'runner died' });

    const result = await runTool(jobStatus, { job_id: handle('test-run', '9'), env: 'staging' }, ctx);

    expect(result.data).toMatchObject({ state: 'failed', error: 'runner died' });
  });

  test.each([
    ['a 404', { statusCode: 404, body: '' }],
    ['the runner\'s own not_found', { statusCode: 200, body: JSON.stringify({ error: 'not_found' }) }]
  ])('%s is JOB_NOT_FOUND', async (_label, response) => {
    const { ctx } = context({ request: async () => response });

    const result = await runTool(jobStatus, { job_id: handle('test-run', '9'), env: 'staging' }, ctx);

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('JOB_NOT_FOUND');
  });

  test('the results request carries the instance token and goes to the resolved instance', async () => {
    const { ctx, calls } = run({ id: 9, status: 'success' });

    await runTool(jobStatus, { job_id: handle('test-run', '9'), env: 'staging' }, ctx);

    expect(calls.request).toEqual([{
      method: 'GET',
      // The .pos URL ends in a slash; the request must not carry it into the path.
      uri: `${ORIGIN}/api-root/_tests/results/9`,
      headers: { Authorization: 'Token staging-token', UserTemporaryToken: 'staging-token' }
    }]);
  });
});

describe('wait_ms', () => {
  test('polls until the job is done, through a status that used to end the wait early', async () => {
    const seq = ['ready_for_import', 'in_progress', 'in_progress', 'success'];
    let poll = 0;
    const { ctx, calls } = context({ getStatus: async () => ({ status: seq[Math.min(poll++, seq.length - 1)] }) });

    const result = await runTool(jobStatus, { job_id: handle('deploy', '41', { assets: false }), env: 'staging', wait_ms: 5000 }, ctx);

    expect(result.data).toMatchObject({ state: 'completed', done: true, status: 'success' });
    expect(calls.gateway.filter(c => c.name === 'getStatus')).toHaveLength(4);
  }, 20000);

  test('the deadline ends the wait with done:false, not an error', async () => {
    const { ctx, calls } = context({ getStatus: async () => ({ status: 'in_progress' }) });

    const result = await runTool(jobStatus, { job_id: handle('deploy'), env: 'staging', wait_ms: 100 }, ctx);

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ state: 'running', done: false, status: 'in_progress' });
    expect(calls.gateway.filter(c => c.name === 'getStatus').length).toBeGreaterThan(1);
  }, 20000);

  test('without wait_ms it answers after one poll', async () => {
    const { ctx, calls } = context({ getStatus: async () => ({ status: 'in_progress' }) });

    const result = await runTool(jobStatus, { job_id: handle('deploy'), env: 'staging' }, ctx);

    expect(result.data.done).toBe(false);
    expect(calls.gateway.filter(c => c.name === 'getStatus')).toHaveLength(1);
  });

  test.each([
    ['longer than the maximum', 120001],
    ['negative', -1],
    ['not a whole number', 1.5]
  ])('a wait that is %s is rejected', (_label, wait_ms) => {
    const rejection = rejectionFor('job-status', jobStatus, { job_id: handle('deploy'), wait_ms });

    expect(rejection?.jsonRpcCode).toBe(-32602);
    expect(rejection.message).toContain('wait_ms');
  });

  test('progress goes out while it waits, so a client does not time the call out', async () => {
    let poll = 0;
    const { ctx } = context({ getStatus: async () => ({ status: poll++ < 2 ? 'in_progress' : 'success' }) });
    const sendProgress = vi.fn();

    await runTool(jobStatus, 
      { job_id: handle('deploy', '41', { assets: false }), env: 'staging', wait_ms: 5000 },
      { ...ctx, sendProgress }
    );

    expect(sendProgress).toHaveBeenCalledTimes(2);
    expect(sendProgress.mock.calls.map(([report]) => report))
      .toEqual([{ progress: 1, message: 'deploy: in_progress' }, { progress: 2, message: 'deploy: in_progress' }]);
  }, 20000);

  // A wait is minutes long on a degraded network; a single refused connection ending it early
  // would report "could not read the status" about a job that is running perfectly well.
  test('a blip does not end the wait', async () => {
    // What the Gateway actually throws: `lib/apiRequest.js` names a network failure RequestError
    // and a 5xx StatusCodeError with the code on it.
    const answers = [
      () => { throw Object.assign(new TypeError('fetch failed'), { name: 'RequestError' }); },
      () => { throw Object.assign(new Error('Request failed with status 502'), { name: 'StatusCodeError', statusCode: 502 }); },
      () => ({ status: 'success' })
    ];
    let poll = 0;
    const { ctx } = context({ getStatus: async () => answers[Math.min(poll++, answers.length - 1)]() });

    const result = await runTool(jobStatus, { job_id: handle('deploy', '41', { assets: false }), env: 'staging', wait_ms: 5000 }, ctx);

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ state: 'completed', status: 'success' });
    expect(poll).toBe(3);
  }, 20000);

  test('a rejection the instance means is an answer, and ends the wait', async () => {
    const { ctx, calls } = context({ getStatus: async () => { throw Object.assign(new Error('Forbidden'), { statusCode: 403 }); } });

    const result = await runTool(jobStatus, { job_id: handle('deploy'), env: 'staging', wait_ms: 5000 }, ctx);

    expect(result).toMatchObject({ ok: false, error: { kind: 'auth', code: 'UNAUTHORIZED' } });
    expect(calls.gateway.filter(c => c.name === 'getStatus')).toHaveLength(1);
  }, 20000);

  // A defect in our own code is not a blip: retrying it would hide it for the whole wait and then
  // report it as if the instance were at fault.
  test('a programming error is reported at once, however long the wait', async () => {
    const { ctx, calls } = context({ getStatus: async () => { throw new TypeError('polled is not a function'); } });

    const result = await runTool(jobStatus, { job_id: handle('deploy'), env: 'staging', wait_ms: 60000 }, ctx);

    expect(result).toMatchObject({ ok: false, error: { kind: 'internal', code: 'INTERNAL_ERROR' } });
    expect(calls.gateway.filter(c => c.name === 'getStatus')).toHaveLength(1);
  }, 20000);

  // What the instance said is the part worth reading: a 422 explains itself in its body.
  test('a rejection carries the status code and the body the instance answered with', async () => {
    const refusal = Object.assign(new Error('Request failed with status 422'), {
      name: 'StatusCodeError',
      statusCode: 422,
      response: { body: { error: 'release is locked' } }
    });
    const { ctx } = context({ getStatus: async () => { throw refusal; } });

    const result = await runTool(jobStatus, { job_id: handle('deploy'), env: 'staging' }, ctx);

    expect(result.error.details).toEqual({ statusCode: 422, body: { error: 'release is locked' } });
  });

  test('without a wait, a blip is reported rather than retried', async () => {
    const { ctx, calls } = context({ getStatus: async () => { throw Object.assign(new TypeError('fetch failed'), { name: 'RequestError' }); } });

    const result = await runTool(jobStatus, { job_id: handle('deploy'), env: 'staging' }, ctx);

    expect(result).toMatchObject({ ok: false, error: { kind: 'unavailable', code: 'INSTANCE_UNAVAILABLE', message: 'fetch failed' } });
    expect(calls.gateway.filter(c => c.name === 'getStatus')).toHaveLength(1);
  });

  test('an instance that never answers reports the failure when the deadline passes', async () => {
    const { ctx, calls } = context({ getStatus: async () => { throw Object.assign(new TypeError('fetch failed'), { name: 'RequestError' }); } });

    const result = await runTool(jobStatus, { job_id: handle('deploy'), env: 'staging', wait_ms: 100 }, ctx);

    expect(result).toMatchObject({ ok: false, error: { kind: 'unavailable', code: 'INSTANCE_UNAVAILABLE' } });
    expect(calls.gateway.filter(c => c.name === 'getStatus').length).toBeGreaterThan(1);
  }, 20000);

  test('a cancelled call stops asking the instance', async () => {
    const controller = new AbortController();
    const { ctx, calls } = context({ getStatus: async () => ({ status: 'in_progress' }) });

    const result = runTool(jobStatus, 
      { job_id: handle('deploy'), env: 'staging', wait_ms: 120000 },
      { ...ctx, signal: controller.signal }
    );
    await vi.waitFor(() => expect(calls.gateway.filter(c => c.name === 'getStatus').length).toBeGreaterThan(0));
    const polls = calls.gateway.filter(c => c.name === 'getStatus').length;
    controller.abort();

    expect(await result).toMatchObject({ ok: false, error: { kind: 'cancelled', code: 'CANCELLED' } });
    expect(calls.gateway.filter(c => c.name === 'getStatus').length).toBeLessThanOrEqual(polls + 1);
  }, 20000);
});

/**
 * platformOS answers **503**, not 404, for a release, import or export id it does not have — the
 * same page either way, so nothing in the response separates "no such job" from an unwell
 * instance. These are driven by that 503, and by the second question that does separate them.
 */
describe('a 5xx: the job is not there, or the instance is unwell', () => {
  // A 2 KB HTML error page, shortened: nothing in it is machine-readable, which is the point.
  const OOPS = '<!DOCTYPE html>\n<html>\n<head>\n  <title>Oops (503)</title>\n</head>\n</html>';

  const serviceUnavailable = () => Object.assign(new Error('Request failed with status 503'), {
    name: 'StatusCodeError',
    statusCode: 503,
    response: { statusCode: 503, body: OOPS }
  });

  const answering = async () => ({ id: 1, name: 'verification' });
  const notAnswering = () => { throw Object.assign(new TypeError('fetch failed'), { name: 'RequestError' }); };

  const polls = calls => calls.gateway.filter(c => c.name === 'getStatus').length;
  const probes = calls => calls.gateway.filter(c => c.name === 'getInstance').length;

  test('an instance answering for itself while refusing one job means the job is not there', async () => {
    const { ctx, calls } = context({ getStatus: async () => { throw serviceUnavailable(); }, getInstance: answering });

    const result = await runTool(jobStatus, { job_id: handle('deploy', '999999999'), env: 'staging' }, ctx);

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ kind: 'not_found', code: 'JOB_NOT_FOUND' });
    expect(result.error.message).toContain('999999999');
    expect(result.error.details).toEqual({ statusCode: 503, instanceResponding: true });
    expect(probes(calls)).toBe(1);
  });

  test('the same 503 from an instance that is not answering stays retryable', async () => {
    const { ctx, calls } = context({ getStatus: async () => { throw serviceUnavailable(); }, getInstance: notAnswering });

    const result = await runTool(jobStatus, { job_id: handle('deploy', '999999999'), env: 'staging' }, ctx);

    expect(result.error).toMatchObject({ kind: 'unavailable', code: 'INSTANCE_UNAVAILABLE' });
    expect(probes(calls)).toBe(1);
  });

  // The error this whole path exists to avoid: telling an agent to stop waiting on a deploy that
  // is running, because the instance was slow once.
  test('a 503 that clears when asked again is the job\'s status, and the instance is never probed', async () => {
    let asked = 0;
    const { ctx, calls } = context({
      getStatus: async () => { if (asked++ === 0) throw serviceUnavailable(); return { status: 'success' }; },
      getInstance: answering
    });

    const result = await runTool(jobStatus, { job_id: handle('deploy', '41', { assets: false }), env: 'staging' }, ctx);

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ state: 'completed', status: 'success' });
    expect(probes(calls)).toBe(0);
  });

  test('one 503 is never enough on its own: the job is always asked twice first', async () => {
    const { ctx, calls } = context({ getStatus: async () => { throw serviceUnavailable(); }, getInstance: answering });

    await runTool(jobStatus, { job_id: handle('deploy', '999999999'), env: 'staging' }, ctx);

    expect(polls(calls)).toBe(2);
  });

  // Nothing was answered at all, so there is no instance to compare against and nothing to infer.
  test('a refused connection is never read as a job that does not exist', async () => {
    const { ctx, calls } = context({
      getStatus: async () => { throw Object.assign(new TypeError('fetch failed'), { name: 'RequestError' }); },
      getInstance: answering
    });

    const result = await runTool(jobStatus, { job_id: handle('deploy'), env: 'staging' }, ctx);

    expect(result.error).toMatchObject({ kind: 'unavailable', code: 'INSTANCE_UNAVAILABLE' });
    expect(probes(calls)).toBe(0);
    expect(polls(calls)).toBe(1);
  });

  // A refusal the instance meant is already an answer; probing its health would say nothing.
  test.each([[401, 'auth'], [403, 'auth'], [422, 'instance']])('a %i is answered on its merits, not probed', async (statusCode, kind) => {
    const { ctx, calls } = context({
      getStatus: async () => { throw Object.assign(new Error(`Request failed with status ${statusCode}`), { statusCode }); },
      getInstance: answering
    });

    const result = await runTool(jobStatus, { job_id: handle('deploy'), env: 'staging' }, ctx);

    expect(result.error.kind).toBe(kind);
    expect(probes(calls)).toBe(0);
  });

  // The 503 is the whole API's answer, not the release endpoint's: imports and exports were
  // measured giving the identical page.
  test.each([
    ['data-import', 'dataImportStatus'],
    ['data-export', 'dataExportStatus'],
    ['data-clean', 'dataCleanStatus']
  ])('%s: a persistent 503 on a live instance is JOB_NOT_FOUND', async (kind, method) => {
    const { ctx } = context({ [method]: async () => { throw serviceUnavailable(); }, getInstance: answering });

    const result = await runTool(jobStatus, { job_id: handle(kind, '999999999'), env: 'staging' }, ctx);

    expect(result.error).toMatchObject({ kind: 'not_found', code: 'JOB_NOT_FOUND' });
    expect(result.error.message).toContain(kind);
  });

  // The test runner is not an app_builder endpoint, so it reaches the same decision by its own
  // route — which is why the health probe is instance-wide rather than per kind.
  test('test-run: a persistent 503 on a live instance is JOB_NOT_FOUND', async () => {
    const { ctx, calls } = context({ request: async () => ({ statusCode: 503, body: OOPS }), getInstance: answering });

    const result = await runTool(jobStatus, { job_id: handle('test-run', '999999999'), env: 'staging' }, ctx);

    expect(result.error).toMatchObject({ kind: 'not_found', code: 'JOB_NOT_FOUND' });
    expect(calls.request).toHaveLength(2);
    expect(probes(calls)).toBe(1);
  });

  // The instance says what this 503 was: the Partner Portal, the only thing that can validate a
  // token, did not answer. Nothing was decided about the job, and the advice for it is to wait.
  test('a 503 the instance explains as a Partner Portal outage is never read as a missing job', async () => {
    const outage = () => Object.assign(new Error('Request failed with status 503'), {
      name: 'StatusCodeError',
      statusCode: 503,
      response: { statusCode: 503, body: { error: 'partner_portal_unavailable' } }
    });
    const { ctx, calls } = context({ getStatus: async () => { throw outage(); }, getInstance: answering });

    const result = await runTool(jobStatus, { job_id: handle('deploy', '41'), env: 'staging' }, ctx);

    // `classify` gives this 503 a code of its own (TASK-40), so an agent can tell it from an
    // instance that is simply down without reading the message.
    expect(result.error).toMatchObject({ kind: 'unavailable', code: 'PARTNER_PORTAL_UNAVAILABLE' });
    expect(probes(calls)).toBe(0);
  });

  test('a wait spends its whole window on the instance before deciding the job is absent', async () => {
    const { ctx, calls } = context({ getStatus: async () => { throw serviceUnavailable(); }, getInstance: answering });

    const result = await runTool(jobStatus, { job_id: handle('deploy', '999999999'), env: 'staging', wait_ms: 200 }, ctx);

    expect(result.error).toMatchObject({ kind: 'not_found', code: 'JOB_NOT_FOUND' });
    expect(polls(calls)).toBeGreaterThan(2);
  }, 20000);
});
