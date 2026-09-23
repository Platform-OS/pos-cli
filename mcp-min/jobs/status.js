/**
 * `job-status`: one tool for every asynchronous operation the server starts. What differs per kind
 * lives in `jobs/adapters/`, so the answer has the same shape whatever was started.
 */
import log from '../log.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError } from '../tool-error.js';
import { abortableDelay, cancelled } from '../cancellation.js';
import makeRequest, { testAuthHeaders } from '../tests/request.js';
import adapters from './adapters/index.js';
import { parse } from './handle.js';
import { authForJob } from './auth-for-job.js';
import { JobNotFoundError, absentOrUnwell, isServerError } from './errors.js';

export const MAX_WAIT_MS = 120000;

// 1 s between polls at first, easing off to 5 s, as lib/deploy/waitForAssetReport.js does:
// getStatus returns the whole release record, and a flat 1 s refetches it 120 times per wait.
const POLL_INTERVAL_MS = 1000;
const BACKOFF_AFTER = 10;
const BACKOFF_CAP = 5;
const intervalFor = (poll, base) => base * Math.min(2 ** Math.max(0, poll - BACKOFF_AFTER + 1), BACKOFF_CAP);

/**
 * A refused connection or a 5xx says nothing about the job, so while there is time left it is
 * worth asking again. The same two `lib/push.js` retries, and no more: retrying our own TypeError
 * for a whole wait would hide it.
 */
const isTransient = err => err?.name === 'RequestError' || isServerError(err);

/** What the instance said the job is not there, in the form a client reads. */
const jobNotFound = err => ToolError.not_found('JOB_NOT_FOUND', `${err.message}.`, err.details);

const jobStatusTool = {
  description: 'Status of an operation started earlier, read from the job_id that started it. state is running, completed (the work finished) or failed (the operation itself failed). Read warnings even on completed: a deploy names files it discarded there.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      job_id: { type: 'string', description: 'Opaque: pass back exactly what the starter returned.' },
      wait_ms: { type: 'integer', minimum: 0, maximum: MAX_WAIT_MS, description: 'Wait until the job is done or this long, whichever comes first.' },
      ...authProperties,
      env: { type: 'string', description: 'Must be the instance the job was started on; the job_id says which.' }
    },
    required: ['job_id']
  },
  handler: async (params, ctx = {}) => {
    const parsed = parse(params?.job_id);
    // Not a handle this server minted: the caller passed the wrong string.
    if (!parsed.valid) throw ToolError.input('INVALID_JOB_ID', `That is not a job_id: ${parsed.message}.`);
    const { job } = parsed;

    let resolution;
    try {
      resolution = await authForJob(job, params, ctx);
    } catch (e) {
      // Name the instance the job needs: "no credentials configured" does not say which
      // environment to add. The resolver's own kind and code are kept — ENV_NOT_FOUND is more
      // use than a blanket AUTH_ERROR — and only the message gains the fact it was missing.
      const failure = e instanceof ToolError ? e : ToolError.auth('AUTH_ERROR', String(e.message || e));
      throw new ToolError(failure.kind, failure.code, `${failure.message}. The job was started on ${job.origin}`, failure.details);
    }

    // Before any request: a handle for another instance must not be answered with this one's
    // status for the same id.
    if (resolution.mismatch) throw ToolError.input('JOB_INSTANCE_MISMATCH', `${resolution.mismatch.message}.`);
    const auth = resolution.auth;
    // What `resolveAuth` recorded is what it resolved first; when no env was named, authForJob
    // redirects to the environment that points at the job's instance. meta.auth has to report the
    // credentials actually used, not the ones that were reached for.
    ctx.resolvedAuth = auth;

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

    // A 5xx means either "no such job" or "unwell" (`jobs/errors.js`), so one is not an answer.
    let confirmed = false;

    for (let poll = 0; ; poll++) {
      if (ctx.signal?.aborted) throw cancelled();

      let polled;
      try {
        polled = await adapter.poll(deps, job.id, job.flags);
      } catch (e) {
        // The instance has no such job: a bad argument, not a failed job.
        if (e instanceof JobNotFoundError) throw jobNotFound(e);
        log.debug('tool:job-status poll failed', { kind: job.kind, error: String(e) });

        // Outside a wait there is nothing to retry into; inside one, a blip should not end a
        // two-minute wait early. Giving up rethrows the original, so runTool classifies the
        // status and body rather than burying them under a code named after this tool.
        if (!isTransient(e) || Date.now() >= deadline) {
          // The default wait is none at all, so without this a single slow answer for a real
          // deploy would be reported as a job that never existed.
          if (isServerError(e) && !confirmed) {
            confirmed = true;
            await abortableDelay(pollInterval, ctx.signal);
            continue;
          }

          const settled = await absentOrUnwell(e, {
            kind: job.kind,
            id: job.id,
            // Instance-wide, so it answers for every kind, including the test runner.
            health: () => deps.gateway.getInstance()
          });
          throw settled instanceof JobNotFoundError ? jobNotFound(settled) : settled;
        }

        await abortableDelay(Math.min(intervalFor(poll, pollInterval), deadline - Date.now()), ctx.signal);
        continue;
      }

      // A 5xx later in a long wait gets its own confirmation.
      confirmed = false;

      const done = polled.state !== 'running';
      if (done || Date.now() >= deadline) {
        // A job that failed is still a status call that worked: `state` carries the job's own
        // outcome, and the call only fails when the status could not be read.
        return {
          job_id: params.job_id,
          kind: job.kind,
          state: polled.state,
          done,
          status: polled.status,
          ...(polled.error && { error: polled.error }),
          ...(polled.warnings && { warnings: polled.warnings }),
          result: polled.result
        };
      }

      ctx.sendProgress?.({ progress: poll + 1, message: `${job.kind}: ${polled.status ?? 'running'}` });
      await abortableDelay(Math.min(intervalFor(poll, pollInterval), deadline - Date.now()), ctx.signal);
    }
  }
};

export default jobStatusTool;
