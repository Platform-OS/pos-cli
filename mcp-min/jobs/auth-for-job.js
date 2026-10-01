/**
 * Credentials for the instance a job was started on. `env` is optional on every tool, so polling
 * without one lands on the first `.pos` entry — which answers about *its* deploy 41, not the one
 * asked about. The origin in the handle is only ever compared, never used to build a request: a
 * forged one must not be able to point credentials anywhere.
 */
import files from '../../lib/files.js';
import { resolveAuth } from '../auth.js';
import { originOf } from './handle.js';

/** Whether the caller named the instance, in which case a mismatch is their mistake to see. */
const wasExplicit = params => Boolean(params?.env || (params?.url && params?.email && params?.token));

/** The `.pos` environments pointing at an origin, in config order. */
function environmentsFor(origin, conf) {
  return Object.entries(Object(conf)).filter(([, settings]) => originOf(settings?.url) === origin);
}

/** @returns {Promise<{ auth: object } | { mismatch: { resolved: string, message: string } }>} */
export async function authForJob(job, params, ctx = {}) {
  const auth = await resolveAuth(params, ctx);
  const resolved = originOf(auth.url);
  if (resolved === job.origin) return { auth };

  // Named instance, wrong instance: say so rather than quietly polling a third one.
  if (wasExplicit(params)) {
    return {
      mismatch: {
        resolved,
        message: `the job was started on ${job.origin}, but ${auth.source} is ${resolved ?? auth.url}`
      }
    };
  }

  // Nothing was named, so the default entry was a guess. Take the environment that does point at
  // the job's instance; two of them is not a guess worth making either.
  const matching = environmentsFor(job.origin, (ctx.files || files).getConfig());
  if (matching.length === 1) {
    const [name, settings] = matching[0];
    return { auth: { ...settings, source: `.pos(${name})` } };
  }
  return {
    mismatch: {
      resolved,
      message: matching.length === 0
        ? `the job was started on ${job.origin}; no .pos environment points there, and ${auth.source} is ${resolved ?? auth.url}. Pass env, or add that environment`
        : `the job was started on ${job.origin}; ${matching.map(([name]) => name).join(' and ')} both point there. Pass env to say which`
    }
  };
}
