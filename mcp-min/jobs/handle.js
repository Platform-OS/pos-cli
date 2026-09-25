/**
 * The `job_id` a starter returns and `job-status` takes back. Self-contained — kind, remote id,
 * instance origin, kind-specific flags — rather than a key into a table in this process: MCP
 * clients restart stdio servers while the agent keeps its conversation, so a table would turn
 * every restart into "unknown job".
 *
 * It travels through the model and back, so it is untrusted on the way in: parsed strictly, and
 * nothing in it chooses credentials or the URL a request goes to.
 */

import log from '../log.js';

export const JOB_KINDS = Object.freeze(['deploy', 'data-import', 'data-export', 'data-clean']);

const PREFIX = 'pjob1_';

// Remote ids are numbers or short strings from the instance; anything else is not one of ours.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// What each kind may carry besides kind/id/origin, and the type it must have.
const FLAGS = Object.freeze({
  'data-export': Object.freeze({ zip: 'boolean' }),
  // Whether the deploy had assets at all: without it, a process that did not start the deploy
  // cannot tell "nothing to upload" from "an upload I cannot see".
  deploy: Object.freeze({ assets: 'boolean' })
});

const encode = value => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

/** The origin of a URL, when the URL is one we would talk to; null otherwise. */
export function originOf(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
}

export function mint({ kind, id, origin, flags }) {
  if (!JOB_KINDS.includes(kind)) throw new TypeError(`mint: unknown job kind ${kind}`);

  const instanceOrigin = originOf(origin);
  if (!instanceOrigin) throw new TypeError(`mint: ${origin} is not an http(s) URL`);

  const remoteId = String(id);
  if (!ID_PATTERN.test(remoteId)) throw new TypeError(`mint: ${remoteId} is not a usable job id`);

  // A programmer error, since only our own starters mint: `{ asset: true }` for `{ assets: true }`
  // would otherwise mint a handle that reports the wrong thing instead of failing.
  const allowed = FLAGS[kind] ?? {};
  const kept = Object.entries(flags ?? {});
  for (const [name, value] of kept) {
    if (!Object.hasOwn(allowed, name)) throw new TypeError(`mint: ${kind} has no flag ${name}`);
    if (typeof value !== allowed[name]) throw new TypeError(`mint: flag ${name} must be ${allowed[name]}`);
  }

  return PREFIX + encode({
    kind,
    id: remoteId,
    origin: instanceOrigin,
    ...(kept.length > 0 && { flags: Object.fromEntries(kept) })
  });
}

/** @returns {{ valid: true, job: object } | { valid: false, message: string }} */
export function parse(jobId) {
  const invalid = message => ({ valid: false, message });

  if (typeof jobId !== 'string' || !jobId.startsWith(PREFIX)) {
    return invalid('a job_id is the value a starter returned, unchanged');
  }

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(jobId.slice(PREFIX.length), 'base64url').toString('utf8'));
  } catch {
    return invalid('it is not readable');
  }
  if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) return invalid('it is not readable');

  const { kind, id, origin, flags, ...rest } = decoded;
  const extra = Object.keys(rest);
  if (extra.length > 0) return invalid(`it carries unexpected fields: ${extra.join(', ')}`);
  if (!JOB_KINDS.includes(kind)) return invalid(`it names an unknown kind of job: ${JSON.stringify(kind)}`);
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return invalid('the job id in it is not usable');
  if (typeof origin !== 'string' || originOf(origin) !== origin) return invalid('the instance in it is not an origin');

  const allowed = FLAGS[kind] ?? {};
  if (flags !== undefined) {
    if (flags === null || typeof flags !== 'object' || Array.isArray(flags)) return invalid('its flags are not readable');
    for (const [name, value] of Object.entries(flags)) {
      if (!Object.hasOwn(allowed, name)) return invalid(`it carries a flag ${kind} does not have: ${name}`);
      if (typeof value !== allowed[name]) return invalid(`its ${name} flag must be ${allowed[name]}`);
    }
  }

  return { valid: true, job: { kind, id, origin, flags: { ...flags } } };
}

/**
 * The handle for a job that has just started, or `undefined` if one cannot be minted. A handle is
 * how the job is polled, not whether it ran, so an unexpected id costs the caller `job-status`,
 * not the deploy.
 */
export function mintFor(job) {
  try {
    return mint(job);
  } catch (e) {
    log.warn('mcp-min: could not mint a job_id', { kind: job?.kind, error: String(e.message || e) });
    return undefined;
  }
}
