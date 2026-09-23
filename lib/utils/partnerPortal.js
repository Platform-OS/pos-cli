/**
 * An Instance cannot validate an API token by itself. The Partner Portal owns that answer,
 * so while the Portal is being deployed, restarted or rate-limiting, the Instance has no
 * verdict at all — and it used to report that as a 401, which reaches an operator as
 * "Check if your Token/URL are correct. To refresh your token, run: pos-cli env
 * refresh-token". That advice cannot work: the token was never judged. It also costs them
 * a working credential, and it stops being reproducible a minute later when the Portal
 * comes back, so nobody ever finds out what happened.
 *
 * Instances now answer `503 {"error":"partner_portal_unavailable"}` with a Retry-After
 * instead. This module is the one place that recognises it, so every client path reads it
 * the same way.
 */
import { isTransientStatus } from './transientStatus.js';
import { parseRetryAfter, clampRetrySeconds } from './retryAfter.js';

// The code in the body. The status alone is not enough: 503 is also what a proxy in front
// of an Instance returns when the Instance itself is down, and that is a different problem.
const PARTNER_PORTAL_UNAVAILABLE = 'partner_portal_unavailable';

const bodyOf = (error) => {
  const body = error?.response?.body;
  return body && typeof body === 'object' ? body : null;
};

const isPartnerPortalUnavailable = (error) =>
  error?.statusCode === 503 && bodyOf(error)?.error === PARTNER_PORTAL_UNAVAILABLE;

/**
 * What the Instance said about it, passed through rather than replaced: it names the
 * portal and how the call to it failed, and on a private stack — a host that does not
 * resolve, a portal URL stored without its port — that sentence is the whole diagnosis.
 */
const partnerPortalReason = (error) => {
  const errors = bodyOf(error)?.errors;
  return Array.isArray(errors) && errors.length ? errors.join('\n') : null;
};

// Bounds on the wait between retries. Retry-After is a hint from a service that is, by
// hypothesis, not behaving, so it is clamped rather than obeyed: a missing or absurd value
// must not park a deploy for an hour, and a zero must not turn a retry into a hot loop.
const MIN_RETRY_SECONDS = 2;
const MAX_RETRY_SECONDS = 30;
const DEFAULT_RETRY_SECONDS = 10;

const retryAfterSeconds = (error) => {
  const seconds = parseRetryAfter(error?.response?.headers?.['retry-after']);
  if (seconds === null) return DEFAULT_RETRY_SECONDS;

  return clampRetrySeconds(seconds, { min: MIN_RETRY_SECONDS, max: MAX_RETRY_SECONDS });
};

// The same outage seen from the other side: pos-cli talking to the Portal directly, for
// token info or a two-factor session. There is no body to read here — this is whatever the
// Portal or the network did — so it is recognised by shape. A 401 or 403 is excluded on
// purpose: that is the Portal deciding, and re-authenticating really is the answer to it.
// Which statuses count is lib/utils/transientStatus.js, shared with the CDN poll.
const isPortalOutage = (error) =>
  error?.name === 'RequestError' || isTransientStatus(error?.statusCode);

/**
 * What to say when the Portal itself is the thing that did not answer. Says what pos-cli
 * was doing, why the Portal is involved at all — operators reasonably expect `deploy` to
 * be between them and their instance — and that waiting is the whole fix.
 */
const portalOutageMessage = (portalUrl, error) => {
  const detail = error?.statusCode ? `HTTP ${error.statusCode}` : (error?.cause?.message || error?.message);

  return `The Partner Portal at ${portalUrl} is not answering (${detail}).` +
    '\nIt is the only thing that can verify your credentials, so pos-cli cannot continue without it.' +
    '\nNothing is wrong with your token — this is not something `pos-cli env refresh-token` can fix. Try again in a minute.';
};

export {
  PARTNER_PORTAL_UNAVAILABLE,
  isPartnerPortalUnavailable,
  isPortalOutage,
  partnerPortalReason,
  portalOutageMessage,
  retryAfterSeconds
};
