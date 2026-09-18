/**
 * `job-status`: one tool for every asynchronous operation the server starts.
 *
 * The five starters (deploy-start, data-import, data-export, data-clean, tests-run-async) return a
 * `job_id`; this reads it back. What differs per kind lives in `jobs/adapters/`, so the answer has
 * the same shape whatever was started: `state` is running, completed or failed, and `done` is
 * derived from it rather than reported separately by each kind.
 */
import log from '../log.js';
import Gateway from '../../lib/proxy.js';
import { maskToken } from '../auth.js';
import { authProperties } from '../schemas/auth.js';
import { abortableDelay, cancelled } from '../cancellation.js';
import makeRequest, { testAuthHeaders } from '../tests/request.js';
import adapters from './adapters/index.js';
import { parse } from './handle.js';
import { authForJob } from './auth-for-job.js';
import { JobNotFoundError } from './errors.js';

// The upper bound the schema enforces on wait_ms. Shorter than the 120 s shutdown deadline is not
// required — a wait that outlives the session is stopped by the signal, not by this number — but a
// call that can never end is not something a client should be able to ask for.
export const MAX_WAIT_MS = 120000;

// While waiting: 1 s between polls at first, easing off to 5 s, as lib/deploy/waitForAssetReport.js
// does. getStatus returns the whole release record, so a flat 1 s over two minutes refetches and
// reparses it 120 times for a job that will not have changed.
const POLL_INTERVAL_MS = 1000;
const BACKOFF_AFTER = 10;
const BACKOFF_CAP = 5;
const intervalFor = (poll, base) => base * Math.min(2 ** Math.max(0, poll - BACKOFF_AFTER + 1), BACKOFF_CAP);

const failure = (code, message, details) => ({ ok: false, error: { code, message, ...(details && { details }) } });

/**
 * Whether a failed status request says anything about the job. A refused connection or a 5xx does
 * not — the job is still there — so while there is still time to wait, it is worth asking again.
 * The same two `lib/push.js` retries when it polls a deploy, and no more than those: a defect in
 * our own code throws a TypeError, and retrying that for the whole wait would hide it.
 */
const isTransient = err => err?.name === 'RequestError' || err?.statusCode >= 500;

/** What the instance said, when it said anything: the code and the body it answered with. */
const apiDetails = err => (err?.statusCode
  ? { statusCode: err.statusCode, body: err.response?.body }
  : undefined);

const jobStatusTool = {
  description: 'Status of an operation started earlier: a deploy, a data import, export or clean, or an async test run. Returns state: running, completed (it finished; tests that failed still count as completed) or failed (the operation itself failed).',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      job_id: { type: 'string', description: 'Opaque; pass back the job_id the starter returned, unchanged' },
      wait_ms: { type: 'integer', minimum: 0, maximum: MAX_WAIT_MS, description: 'Poll until done or this long, whichever comes first' },
      env: { type: 'string', description: 'Environment from .pos; must be the instance the job was started on' },
      ...authProperties
    },
    required: ['job_id']
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();

    const parsed = parse(params?.job_id);
    if (!parsed.valid) return failure('INVALID_JOB_ID', `That is not a job_id: ${parsed.message}.`);
    const { job } = parsed;

    let auth;
    try {
      // Before any request: a handle for another instance must not be answered with this one's
      // status for the same number.
      const resolution = await authForJob(job, params, ctx);
      if (resolution.mismatch) return failure('JOB_INSTANCE_MISMATCH', `${resolution.mismatch.message}.`);
      auth = resolution.auth;
    } catch (e) {
      // Name the instance the job needs: "no credentials configured" is not much help when the
      // question is which environment to add.
      return failure('AUTH_ERROR', `${String(e.message || e)}. The job was started on ${job.origin}`);
    }

    const adapter = adapters.get(job.kind);
    const GatewayCtor = ctx.Gateway || Gateway;
    const deps = {
      // The URL comes from the credentials, never from the handle.
      gateway: new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email }),
      origin: job.origin,
      auth: { url: auth.url, headers: testAuthHeaders(auth.token) },
      request: ctx.request || makeRequest
    };

    const deadline = Date.now() + (Number.isInteger(params?.wait_ms) ? params.wait_ms : 0);
    // A seam, like ctx.Gateway and ctx.request: the tests drive the interval rather than sleep
    // through it. Nothing but a test ever sets it.
    const pollInterval = ctx.pollIntervalMs ?? POLL_INTERVAL_MS;
    const meta = () => ({
      startedAt,
      finishedAt: new Date().toISOString(),
      auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
    });

    for (let poll = 0; ; poll++) {
      if (ctx.signal?.aborted) return cancelled();

      let polled;
      try {
        polled = await adapter.poll(deps, job.id, job.flags);
      } catch (e) {
        if (e instanceof JobNotFoundError) return failure('JOB_NOT_FOUND', `${e.message}.`);
        log.debug('tool:job-status poll failed', { kind: job.kind, error: String(e) });

        // Outside a wait there is nothing to retry into, so the error is the answer; inside one,
        // a blip that ends a two-minute wait early would be the wrong answer to give.
        if (!isTransient(e) || Date.now() >= deadline) {
          return failure('JOB_STATUS_ERROR', String(e.message || e), apiDetails(e));
        }
        await abortableDelay(Math.min(intervalFor(poll, pollInterval), deadline - Date.now()), ctx.signal);
        continue;
      }

      const done = polled.state !== 'running';
      if (done || Date.now() >= deadline) {
        return {
          ok: true,
          data: {
            job_id: params.job_id,
            kind: job.kind,
            state: polled.state,
            done,
            status: polled.status,
            ...(polled.error && { error: polled.error }),
            ...(polled.warnings && { warnings: polled.warnings }),
            result: polled.result
          },
          meta: meta()
        };
      }

      ctx.sendProgress?.(poll + 1, undefined, `${job.kind}: ${polled.status ?? 'running'}`);
      await abortableDelay(Math.min(intervalFor(poll, pollInterval), deadline - Date.now()), ctx.signal);
    }
  }
};

export default jobStatusTool;
