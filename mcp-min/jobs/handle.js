/**
 * The `job_id` a starter returns and `job-status` takes back.
 *
 * It is self-contained — kind, remote id, the instance it was started on, and the flags that
 * kind needs to read its status — rather than a key into a table in this process. MCP clients
 * restart stdio servers while the agent keeps its conversation, so a table would turn every
 * restart into "unknown job".
 *
 * It travels through the model and back, so it is treated as untrusted on the way in: it is
 * parsed strictly, and nothing in it chooses credentials or the URL a request goes to. The
 * origin it carries is only ever compared against the one `resolveAuth` resolved.
 */

import log from '../log.js';

export const JOB_KINDS = Object.freeze(['deploy', 'data-import', 'data-export', 'data-clean', 'test-run']);

const PREFIX = 'pjob1_';

// Remote ids are numbers or short strings from the instance; anything else is not one of ours.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// What each kind may carry besides kind/id/origin, and the type it must have.
const FLAGS = Object.freeze({
  'data-export': Object.freeze({ zip: 'boolean' }),
  // Whether the deploy had assets to upload at all. Without it, a deploy of code alone could
  // never be reported finished by a process that did not start it (there is no asset phase to
  // observe, and "none" and "not seen from here" would be indistinguishable).
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

/**
 * @param {object} job
 * @param {string} job.kind - one of JOB_KINDS
 * @param {string|number} job.id - the id the instance gave the operation
 * @param {string} job.origin - the instance URL the operation was started on
 * @param {object} [job.flags] - kind-specific, from FLAGS
 * @returns {string}
 */
export function mint({ kind, id, origin, flags }) {
  if (!JOB_KINDS.includes(kind)) throw new TypeError(`mint: unknown job kind ${kind}`);

  const instanceOrigin = originOf(origin);
  if (!instanceOrigin) throw new TypeError(`mint: ${origin} is not an http(s) URL`);

  const remoteId = String(id);
  if (!ID_PATTERN.test(remoteId)) throw new TypeError(`mint: ${remoteId} is not a usable job id`);

  const allowed = FLAGS[kind] ?? {};
  const kept = Object.entries(flags ?? {}).filter(([name]) => Object.hasOwn(allowed, name));
  for (const [name, value] of kept) {
    if (typeof value !== allowed[name]) throw new TypeError(`mint: flag ${name} must be ${allowed[name]}`);
  }

  return PREFIX + encode({
    kind,
    id: remoteId,
    origin: instanceOrigin,
    ...(kept.length > 0 && { flags: Object.fromEntries(kept) })
  });
}

/**
 * Reads a job_id back.
 *
 * @param {unknown} jobId
 * @returns {{ valid: true, job: { kind: string, id: string, origin: string, flags: object } }
 *   | { valid: false, message: string }}
 */
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
 * The handle for a job that has just started, or `undefined` if one cannot be minted.
 *
 * A starter that has already started the job must still report what it started: a handle is how
 * the job is polled, not whether it ran, so an id the instance returned in a shape we did not
 * expect costs the caller `job-status`, not the deploy.
 *
 * @param {Parameters<typeof mint>[0]} job
 * @returns {string|undefined}
 */
export function mintFor(job) {
  try {
    return mint(job);
  } catch (e) {
    log.warn('mcp-min: could not mint a job_id', { kind: job?.kind, error: String(e.message || e) });
    return undefined;
  }
}
