/**
 * `job-status`: one tool for every asynchronous operation the server starts. What differs per kind
 * lives in `jobs/adapters/`, so the answer has the same shape whatever was started.
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

export const MAX_WAIT_MS = 120000;

// 1 s between polls at first, easing off to 5 s, as lib/deploy/waitForAssetReport.js does:
// getStatus returns the whole release record, and a flat 1 s refetches it 120 times per wait.
const POLL_INTERVAL_MS = 1000;
const BACKOFF_AFTER = 10;
const BACKOFF_CAP = 5;
const intervalFor = (poll, base) => base * Math.min(2 ** Math.max(0, poll - BACKOFF_AFTER + 1), BACKOFF_CAP);

const failure = (code, message, details) => ({ ok: false, error: { code, message, ...(details && { details }) } });

/**
 * A refused connection or a 5xx says nothing about the job, so while there is time left it is
 * worth asking again. The same two `lib/push.js` retries, and no more: retrying our own TypeError
 * for a whole wait would hide it.
 */
const isTransient = err => err?.name === 'RequestError' || err?.statusCode >= 500;

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
      // status for the same id.
      const resolution = await authForJob(job, params, ctx);
      if (resolution.mismatch) return failure('JOB_INSTANCE_MISMATCH', `${resolution.mismatch.message}.`);
      auth = resolution.auth;
    } catch (e) {
      // Name the instance the job needs: "no credentials configured" does not say which
      // environment to add.
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
    // A seam, like ctx.Gateway and ctx.request: tests drive the interval rather than sleep it.
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

        // Outside a wait there is nothing to retry into; inside one, a blip should not end a
        // two-minute wait early.
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
