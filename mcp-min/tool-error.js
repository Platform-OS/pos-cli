/**
 * How a tool says a call did not do what was asked.
 *
 * `ok: false` on its own is too coarse to act on: "env staging is not in .pos", "the instance
 * refused the token", "the connection was refused" and "pos-cli threw a TypeError" all reached the
 * client as the same thing, under one of twenty catch-all codes — `DEPLOY_START_ERROR`,
 * `MIGRATIONS_LIST_ERROR` — that named the tool the caller already knew it had called.
 *
 * So an error carries a `kind` as well as a `code`. The kind is a closed set, and each member
 * answers one question: what should the caller do next. The code stays for precision, and is what
 * an agent branches on when it wants to handle one specific failure.
 */

import { isPartnerPortalUnavailable, partnerPortalReason, retryAfterSeconds } from '../lib/utils/partnerPortal.js';

/** The closed set, with the next action each one implies. */
export const ERROR_KINDS = Object.freeze({
  input: 'the arguments were wrong; change them and call again',
  not_found: 'what the arguments named is not there',
  auth: 'the credentials were rejected or missing; re-authenticate rather than retry',
  project: 'the project or machine is not ready for this',
  instance: 'the instance ran it and refused; the message says why',
  unavailable: 'nothing was decided; the same call may work later',
  internal: 'a defect in pos-cli',
  cancelled: 'the client stopped the call'
});

export class ToolError extends Error {
  /**
   * @param {keyof ERROR_KINDS} kind
   * @param {string} code - stable, and specific enough to branch on
   * @param {string} message - for a person, and for a model deciding what to do
   * @param {object} [details] - whatever the caller needs to act, e.g. a status code or a file path
   */
  constructor(kind, code, message, details) {
    super(message);
    // A typo in a kind would publish a classification no caller can act on, and it would read as
    // a valid one. Loud here, where it is a programming error, rather than quiet on the wire.
    if (!Object.hasOwn(ERROR_KINDS, kind)) {
      throw new TypeError(`ToolError: ${kind} is not one of ${Object.keys(ERROR_KINDS).join(', ')}`);
    }
    this.name = 'ToolError';
    this.kind = kind;
    this.code = code;
    if (details !== undefined) this.details = details;
  }

  /** The body a client receives, with the text in `details` bounded — see `boundedDetails`. */
  toResult() {
    return { kind: this.kind, code: this.code, message: this.message, ...(this.details !== undefined && { details: boundedDetails(this.details) }) };
  }
}

/**
 * The kind an HTTP status implies.
 *
 * One table, because three places need the same judgement and a second copy is a second answer:
 * `classify` below reads it off a thrown error, the `/_tests/*` tools read it off a response that
 * carries a status instead of throwing, and `sync-file` reads it off a response whose body it has
 * already opened. A status this does not recognise is the instance having refused.
 */
export const kindForStatus = (status) => {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429 || status >= 500) return 'unavailable';
  return 'instance';
};

// Named after the kind, so a call site cannot mistype one and cannot put the code where the kind
// goes: `ToolError.input('VALIDATION_ERROR', 'Provide one of: filePath or jsonData')`.
for (const kind of Object.keys(ERROR_KINDS)) {
  ToolError[kind] = (code, message, details) => new ToolError(kind, code, message, details);
}

/** The code for a failure the thrower did not classify, one per kind `classify` assigns. */
const UNCLASSIFIED = {
  auth: 'UNAUTHORIZED',
  not_found: 'NOT_FOUND',
  unavailable: 'INSTANCE_UNAVAILABLE',
  instance: 'INSTANCE_REFUSED',
  internal: 'INTERNAL_ERROR'
};

// A network failure keeps its code — and the name it failed to resolve — two or three `cause`
// levels down (CLAUDE.md), so the chain is walked rather than read at the top.
const fromCauses = (err, field, depth = 0) => {
  if (!err || depth > 5) return null;
  if (typeof err[field] === 'string') return err[field];
  return fromCauses(err.cause, field, depth + 1);
};

const UNREACHABLE = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN']);

// The one distinction that leads somewhere different: a name that did not resolve is a URL to
// check, and everything else is a host that is there and did not answer.
const NAME_DID_NOT_RESOLVE = new Set(['ENOTFOUND', 'EAI_AGAIN']);

/**
 * The host a failed request was for. `apiRequest` wraps the fetch failure, whose message is
 * `fetch failed` and names nothing, so an unreachable instance and an unreachable Partner Portal
 * are otherwise the same three words. The origin, not the URI: a query string is a tool's to
 * build, and this reaches the model on every failure.
 */
const unreachableHost = (err) => {
  const uri = err?.options?.uri;
  if (typeof uri === 'string') {
    try {
      return new URL(uri).origin;
    } catch {
      // Not a URL; the system error underneath may still name the host.
    }
  }
  return fromCauses(err, 'hostname');
};

const networkFailure = (err, code, message, details) => {
  const host = unreachableHost(err);
  if (!host) return ToolError.unavailable(code, message, details);

  const what = NAME_DID_NOT_RESOLVE.has(code)
    ? 'does not resolve; check the instance URL'
    : 'did not answer';
  return ToolError.unavailable(code, `${message}: ${host} ${what}`, { ...details, host });
};

/**
 * What `lib/ServerError.js` tells an operator at a status, as a field rather than printed prose.
 * Only the statuses where pos-cli knows something the response does not say; one that is missing
 * keeps the bare message, because restating a code the caller already has is tokens for nothing.
 */
const ALREADY_REPORTED = 'platformOS has been notified about it, so there is nothing to report and nothing to work around';

const STATUS_ADVICE = new Map([
  // `entityTooLarge`: the instance answers with a page, so the limit is all this failure can say.
  [413, { code: 'PAYLOAD_TOO_LARGE', note: 'the request body is over the 50MB limit; deploy fewer files, or keep large assets out of the release' }],
  [500, { note: ALREADY_REPORTED }],
  [502, { note: ALREADY_REPORTED }],
  [504, { note: ALREADY_REPORTED }]
]);

/**
 * The one 503 an instance explains, and the one whose obvious next move is wrong: the Portal is the
 * only thing that can verify an API token, so an unreachable one means the token was never judged.
 * `unavailable` keeps the refresh-token remedy off; the message has to say so as well, or an agent
 * reads a failure that mentions a token and has someone refresh a working one.
 */
const portalOutage = (err, details) => ToolError.unavailable(
  'PARTNER_PORTAL_UNAVAILABLE',
  (partnerPortalReason(err) || 'This instance could not reach the Partner Portal to verify the API token.')
    + ' Nothing is wrong with the token; wait and call again.',
  { ...details, retryAfterSeconds: retryAfterSeconds(err) }
);

/**
 * A ceiling on the text in `details`, which the model pays for in tokens while it is already
 * dealing with a failure.
 */
export const MAX_DETAILS_STRING_LENGTH = 4096;

const capped = (text) => (text.length <= MAX_DETAILS_STRING_LENGTH
  ? text
  : `${text.slice(0, MAX_DETAILS_STRING_LENGTH)}… (${text.length - MAX_DETAILS_STRING_LENGTH} more characters)`);

const HTML_PAGE = /^\s*(?:<!doctype\s+html|<html[\s>])/i;
const HTML_TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;

/**
 * `body` has a rule of its own. `apiRequest` parses JSON when it can, so a string here means the
 * instance, or something in front of it, answered with a page; an HTML error page is all markup
 * and no signal — the two this API serves are 1,430 and 2,062 bytes whose only content is
 * `<title>Aw, Snap!</title>` and `<title>Oops (503)</title>`, and an evaluation measured a pair of
 * them at 12% of everything it spent on this server. Parsed JSON is never cut: it is small,
 * structured, and carries the file paths a failed deploy names.
 */
export const upstreamBody = (body) => {
  if (typeof body !== 'string') return body;

  if (HTML_PAGE.test(body)) {
    const title = HTML_TITLE.exec(body)?.[1]?.trim();
    return `HTML error page${title ? `: ${title}` : ''} (${body.length} bytes, not shown)`;
  }

  return capped(body);
};

/**
 * Bounded here rather than at each thrower, for the reason redaction lives in `log.js`: doing it
 * at call sites is a rule the next one will not know about.
 *
 * Every string is capped, not just `body`: `liquid-exec` forwards the whole endpoint response, so
 * its `result` — a page a template rendered before failing — travelled whole, and naming the
 * fields to cap is an allowlist the next thrower will not know about either. Nested values are
 * left alone, which is what keeps a parsed JSON `body` and any other structured upstream record
 * intact.
 */
const boundedDetails = (details) => {
  if (typeof details === 'string') return capped(details);
  if (details === null || typeof details !== 'object' || Array.isArray(details)) return details;

  return Object.fromEntries(Object.entries(details).map(
    ([key, value]) => [key, key === 'body' ? upstreamBody(value) : (typeof value === 'string' ? capped(value) : value)]
  ));
};

/**
 * What a thrown error means, when whatever threw it did not say. It lives here rather than with
 * the invoker because it is the same judgement `kindForStatus` is: a tool that needs it must not
 * have to import `run-tool.js`, which is the thing that calls tools.
 *
 * Having it in one place is how twenty tools stopped reporting a 401, a 503 and a TypeError under
 * one code named after the tool.
 */
export function classify(err) {
  if (err instanceof ToolError) return err;

  const status = err?.statusCode ?? err?.status;
  const code = fromCauses(err, 'code');
  const details = status ? { statusCode: status, ...(err?.response?.body !== undefined && { body: err.response.body }) } : undefined;
  const message = String(err?.message || err);

  const unreachable = code && UNREACHABLE.has(code);
  if (err?.name === 'RequestError' || unreachable) {
    return networkFailure(err, unreachable ? code : UNCLASSIFIED.unavailable, message, details);
  }
  // Only a status decides a kind here; without one there is nothing to read, and a guess would be
  // a worse answer than "we do not know what this is".
  if (status >= 400) {
    if (isPartnerPortalUnavailable(err)) return portalOutage(err, details);

    const kind = kindForStatus(status);
    // A Map, so a status arriving as a string cannot reach Object.prototype.
    const advice = STATUS_ADVICE.get(Number(status));
    return new ToolError(kind, advice?.code ?? UNCLASSIFIED[kind], advice ? `${message}: ${advice.note}` : message, details);
  }

  return ToolError.internal(UNCLASSIFIED.internal, message);
}

export default ToolError;
