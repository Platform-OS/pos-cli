// platformos.deploy.wait - deprecated wrapper over the job-status deploy adapter
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import { abortableDelay, cancelled } from '../cancellation.js';
import deployAdapter from '../jobs/adapters/deploy.js';
import { originOf } from '../jobs/handle.js';
import { JobNotFoundError } from '../jobs/errors.js';

// Deprecated in 6.x, removed in the next major: `job-status` with `wait_ms` waits for any kind of
// job, with a bounded deadline. This one keeps waiting forever without maxWaitMs, and reports on
// the release only — a deploy whose assets are still uploading reads as finished here.
const waitDeployTool = {
  description: 'Deprecated: use job-status with wait_ms. Wait for a deployment to finish, polling every intervalMs (default 1000ms).',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string' },
      ...authProperties,
      id: { type: 'string', description: 'Deployment ID' },
      intervalMs: { type: 'integer', minimum: 200, default: 1000 },
      maxWaitMs: { type: 'integer', minimum: 1000, description: 'Optional maximum wait in ms; if exceeded returns timeout error' }
    },
    required: ['id']
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    try {
      const auth = await resolveAuth(params, ctx);
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });
      const deps = { gateway, origin: originOf(auth.url) };

      const interval = Number.isFinite(params?.intervalMs) ? Number(params.intervalMs) : 1000;
      const started = Date.now();
      const maxWait = Number.isFinite(params?.maxWaitMs) && params.maxWaitMs > 0 ? Number(params.maxWaitMs) : null;

      for (;;) {
        if (ctx.signal?.aborted) return cancelled();

        // The adapter is what knows a deploy is still running: this tool used to keep polling only
        // on `ready_for_import` and returned success on `in_progress`, mid-deploy.
        const polled = await deployAdapter.poll(deps, params.id, { assets: false });

        if (polled.state === 'failed') {
          return { ok: false, error: { code: 'DEPLOY_ERROR', message: polled.error, data: polled.result.release } };
        }
        if (polled.state === 'completed') {
          return { ok: true, data: polled.result.release, meta: { startedAt, finishedAt: new Date().toISOString() } };
        }
        if (maxWait && (Date.now() - started) >= maxWait) {
          return { ok: false, error: { code: 'TIMEOUT', message: `Timed out waiting for deployment after ${maxWait}ms`, data: polled.result.release } };
        }
        await abortableDelay(interval, ctx.signal);
      }
    } catch (e) {
      const code = e instanceof JobNotFoundError ? 'NOT_FOUND' : 'DEPLOY_WAIT_ERROR';
      return { ok: false, error: { code, message: String(e) } };
    }
  }
};

export default waitDeployTool;
